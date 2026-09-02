using System.IO.Compression;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using QuickSub.Models;

namespace QuickSub.Services;

public sealed class OpenSubtitlesClient
{
    private readonly HttpClient _httpClient;
    private readonly AppLogger _logger;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private Uri _apiBase = new("https://api.opensubtitles.com/api/v1/");
    private string _apiKey = string.Empty;
    private string _token = string.Empty;

    public OpenSubtitlesClient(HttpClient httpClient, AppLogger logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public bool IsAuthenticated => !string.IsNullOrWhiteSpace(_token);

    public async Task<OpenSubtitlesLoginResponse> LoginAsync(
        string username,
        string password,
        string apiKey,
        CancellationToken cancellationToken)
    {
        _apiKey = apiKey.Trim();
        _token = string.Empty;
        _apiBase = new Uri("https://api.opensubtitles.com/api/v1/");

        using HttpResponseMessage response = await SendAsync(
            HttpMethod.Post,
            "login",
            new { username, password },
            includeAuthorization: false,
            cancellationToken);

        await EnsureSuccessAsync(response, "OpenSubtitles login failed", cancellationToken);
        OpenSubtitlesLoginResponse login =
            await response.Content.ReadFromJsonAsync<OpenSubtitlesLoginResponse>(
                _jsonOptions,
                cancellationToken)
            ?? throw new InvalidOperationException("OpenSubtitles returned an empty login response.");

        if (string.IsNullOrWhiteSpace(login.Token))
            throw new InvalidOperationException("OpenSubtitles did not return an authentication token.");

        _token = login.Token;
        if (!string.IsNullOrWhiteSpace(login.BaseUrl))
        {
            if (TryNormalizeApiBase(login.BaseUrl, out Uri? normalizedBase))
            {
                _apiBase = normalizedBase;
            }
            else
            {
                // Login already succeeded. Keep the known working API endpoint instead of
                // failing because OpenSubtitles returned a host name without a URI scheme.
                _logger.Warning(
                    $"OpenSubtitles returned an unusable base_url value: '{login.BaseUrl}'. " +
                    "QuickSub will continue with the default API endpoint.");
            }
        }

        _logger.Info($"OpenSubtitles login succeeded. Account level: {login.User?.Level ?? "unknown"}.");
        return login;
    }

    public async Task<List<SubtitleCandidate>> SearchEpisodeAsync(
        VideoEpisode video,
        TvShow show,
        AppSettings settings,
        CancellationToken cancellationToken)
    {
        EnsureAuthenticated();
        var candidatesByFileId = new Dictionary<int, SubtitleCandidate>();

        if (string.IsNullOrWhiteSpace(video.MovieHash))
        {
            try
            {
                video.MovieHash = await OpenSubtitlesHash.ComputeAsync(video.FullPath, cancellationToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.Warning($"Hash calculation failed for {video.FileName}: {ex.Message}");
            }
        }

        if (!string.IsNullOrWhiteSpace(video.MovieHash))
        {
            await AddSearchResultsAsync(
                new Dictionary<string, string>
                {
                    ["languages"] = settings.SubtitleLanguage,
                    ["moviehash"] = video.MovieHash
                },
                candidatesByFileId,
                cancellationToken);
        }

        string? imdbId = NormalizeImdbId(show.Externals?.Imdb);
        string cleanShowName = ShowNameCleaner.RemoveYear(ShowNameCleaner.RemoveDashSuffix(show.Name));

        if (video.IsMultiEpisode)
        {
            var query = new Dictionary<string, string>
            {
                ["languages"] = settings.SubtitleLanguage,
                ["query"] = video.BaseName
            };
            if (!string.IsNullOrWhiteSpace(imdbId))
                query["parent_imdb_id"] = imdbId;

            await AddSearchResultsAsync(query, candidatesByFileId, cancellationToken);

            if (candidatesByFileId.Count == 0)
            {
                query.Remove("parent_imdb_id");
                query["query"] = $"{cleanShowName} {video.EpisodeCode}";
                await AddSearchResultsAsync(query, candidatesByFileId, cancellationToken);
            }
        }
        else
        {
            int episodeNumber = video.Episodes[0];

            // Primary search: IMDB ID + Season + Episode
            if (!string.IsNullOrWhiteSpace(imdbId))
            {
                var imdbQuery = new Dictionary<string, string>
                {
                    ["languages"] = settings.SubtitleLanguage,
                    ["season_number"] = video.Season.ToString(),
                    ["episode_number"] = episodeNumber.ToString(),
                    ["parent_imdb_id"] = imdbId
                };
                await AddSearchResultsAsync(imdbQuery, candidatesByFileId, cancellationToken);
            }

            // Secondary search: Show Name + Season + Episode
            var nameQuery = new Dictionary<string, string>
            {
                ["languages"] = settings.SubtitleLanguage,
                ["season_number"] = video.Season.ToString(),
                ["episode_number"] = episodeNumber.ToString(),
                ["query"] = show.Name
            };
            await AddSearchResultsAsync(nameQuery, candidatesByFileId, cancellationToken);

            // Cleaned name search if different
            if (!cleanShowName.Equals(show.Name, StringComparison.OrdinalIgnoreCase))
            {
                nameQuery["query"] = cleanShowName;
                await AddSearchResultsAsync(nameQuery, candidatesByFileId, cancellationToken);
            }

            // Fallback search by video release base name if still 0 candidates
            if (candidatesByFileId.Count == 0)
            {
                var baseQuery = new Dictionary<string, string>
                {
                    ["languages"] = settings.SubtitleLanguage,
                    ["query"] = video.BaseName
                };
                await AddSearchResultsAsync(baseQuery, candidatesByFileId, cancellationToken);
            }
        }

        List<SubtitleCandidate> candidates = candidatesByFileId.Values
            .Where(candidate => !IsKnownImageSubtitle(candidate.FileName))
            .ToList();

        if (video.IsMultiEpisode && candidates.Count > 0)
        {
            List<string> episodeTokens = video.Episodes.Select(ep => $"e{ep:00}").ToList();
            List<SubtitleCandidate> filtered = candidates
                .Where(candidate =>
                {
                    string searchable = ShowNameCleaner.NormalizeForComparison(candidate.Release + candidate.FileName);
                    return episodeTokens.All(token => searchable.Contains(token, StringComparison.OrdinalIgnoreCase)) ||
                           searchable.Contains(ShowNameCleaner.NormalizeForComparison(video.EpisodeCode), StringComparison.OrdinalIgnoreCase);
                })
                .ToList();

            if (filtered.Count > 0)
                candidates = filtered;
        }

        if (settings.HearingImpairedPreference == HearingImpairedPreference.AllowIfNeeded &&
            candidates.Any(candidate => !candidate.HearingImpaired))
        {
            candidates = candidates.Where(candidate => !candidate.HearingImpaired).ToList();
        }

        SubtitleScorer.Score(video, candidates, settings.HearingImpairedPreference);
        candidates = candidates
            .OrderByDescending(candidate => candidate.Score)
            .ThenByDescending(candidate => candidate.DownloadCount)
            .Take(30)
            .ToList();

        _logger.Info($"Subtitle search for {video.FileName}: {candidates.Count} candidates.");
        return candidates;
    }

    public async Task<OpenSubtitlesDownloadResponse> DownloadAsync(
        SubtitleCandidate candidate,
        string destinationSrtPath,
        SubtitleConverter converter,
        CancellationToken cancellationToken)
    {
        EnsureAuthenticated();
        Directory.CreateDirectory(Path.GetDirectoryName(destinationSrtPath)!);

        OpenSubtitlesDownloadResponse download;
        using (HttpResponseMessage response = await SendAsync(
                   HttpMethod.Post,
                   "download",
                   new { file_id = candidate.FileId, sub_format = "srt" },
                   includeAuthorization: true,
                   cancellationToken))
        {
            if (response.StatusCode == HttpStatusCode.BadRequest)
            {
                response.Dispose();
                using HttpResponseMessage fallback = await SendAsync(
                    HttpMethod.Post,
                    "download",
                    new { file_id = candidate.FileId },
                    includeAuthorization: true,
                    cancellationToken);
                await EnsureSuccessAsync(fallback, "Could not request the subtitle download", cancellationToken);
                download = await ReadDownloadResponseAsync(fallback, cancellationToken);
            }
            else
            {
                await EnsureSuccessAsync(response, "Could not request the subtitle download", cancellationToken);
                download = await ReadDownloadResponseAsync(response, cancellationToken);
            }
        }

        if (string.IsNullOrWhiteSpace(download.Link))
            throw new InvalidOperationException("OpenSubtitles returned an empty download link.");

        string tempRoot = Path.Combine(Path.GetTempPath(), "QuickSub", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempRoot);
        string downloadedPath = Path.Combine(tempRoot, SanitizeFileName(download.FileName, "subtitle.download"));

        try
        {
            using HttpResponseMessage fileResponse = await HttpRetry.SendAsync(
                _httpClient,
                () => new HttpRequestMessage(HttpMethod.Get, download.Link),
                cancellationToken);
            await EnsureSuccessAsync(fileResponse, "The subtitle file could not be downloaded", cancellationToken);

            await using (FileStream output = new(
                             downloadedPath,
                             FileMode.Create,
                             FileAccess.Write,
                             FileShare.None,
                             81920,
                             FileOptions.Asynchronous))
            {
                await fileResponse.Content.CopyToAsync(output, cancellationToken);
            }

            string sourcePath = await ExtractIfNeededAsync(downloadedPath, tempRoot, cancellationToken);
            await converter.ConvertToSrtAsync(sourcePath, destinationSrtPath, cancellationToken);
            _logger.Info($"Subtitle saved: {destinationSrtPath}");
            return download;
        }
        finally
        {
            try
            {
                if (Directory.Exists(tempRoot))
                    Directory.Delete(tempRoot, recursive: true);
            }
            catch
            {
                // Temporary cleanup failure is not fatal.
            }
        }
    }

    private async Task AddSearchResultsAsync(
        IReadOnlyDictionary<string, string> parameters,
        IDictionary<int, SubtitleCandidate> output,
        CancellationToken cancellationToken)
    {
        string queryString = string.Join("&", parameters.Select(pair =>
            $"{Uri.EscapeDataString(pair.Key)}={Uri.EscapeDataString(pair.Value)}"));

        using HttpResponseMessage response = await SendAsync(
            HttpMethod.Get,
            $"subtitles?{queryString}",
            body: null,
            includeAuthorization: true,
            cancellationToken);

        await EnsureSuccessAsync(response, "OpenSubtitles search failed", cancellationToken);
        OpenSubtitlesSearchResponse search =
            await response.Content.ReadFromJsonAsync<OpenSubtitlesSearchResponse>(
                _jsonOptions,
                cancellationToken)
            ?? new OpenSubtitlesSearchResponse();

        foreach (OpenSubtitlesDataItem item in search.Data)
        {
            OpenSubtitlesAttributes attributes = item.Attributes;
            foreach (OpenSubtitlesFile file in attributes.Files)
            {
                if (file.FileId <= 0 || output.ContainsKey(file.FileId))
                    continue;

                output[file.FileId] = new SubtitleCandidate
                {
                    FileId = file.FileId,
                    FileName = file.FileName,
                    Release = attributes.Release ?? string.Empty,
                    Language = attributes.Language,
                    DownloadCount = Math.Max(attributes.DownloadCount, attributes.NewDownloadCount),
                    MovieHashMatch = attributes.MovieHashMatch,
                    HearingImpaired = attributes.HearingImpaired,
                    AiTranslated = attributes.AiTranslated,
                    MachineTranslated = attributes.MachineTranslated,
                    UploaderRank = attributes.Uploader?.Rank ?? string.Empty
                };
            }
        }
    }

    private async Task<HttpResponseMessage> SendAsync(
        HttpMethod method,
        string relativePath,
        object? body,
        bool includeAuthorization,
        CancellationToken cancellationToken)
    {
        Uri uri = new(_apiBase, relativePath);

        return await HttpRetry.SendAsync(
            _httpClient,
            () =>
            {
                var request = new HttpRequestMessage(method, uri);
                request.Headers.TryAddWithoutValidation("Api-Key", _apiKey);
                request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

                if (includeAuthorization && !string.IsNullOrWhiteSpace(_token))
                    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _token);

                if (body is not null)
                    request.Content = JsonContent.Create(body);

                return request;
            },
            cancellationToken);
    }

    private static async Task<OpenSubtitlesDownloadResponse> ReadDownloadResponseAsync(
        HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        return await response.Content.ReadFromJsonAsync<OpenSubtitlesDownloadResponse>(
                   cancellationToken: cancellationToken)
               ?? throw new InvalidOperationException("OpenSubtitles returned an empty download response.");
    }

    private static async Task EnsureSuccessAsync(
        HttpResponseMessage response,
        string context,
        CancellationToken cancellationToken)
    {
        if (response.IsSuccessStatusCode)
            return;

        string details;
        try
        {
            details = await response.Content.ReadAsStringAsync(cancellationToken);
            if (details.Length > 600)
                details = details[..600];
        }
        catch
        {
            details = response.ReasonPhrase ?? "Unknown error";
        }

        throw new OpenSubtitlesApiException(
            $"{context}. HTTP {(int)response.StatusCode}: {details}",
            response.StatusCode);
    }

    private static bool TryNormalizeApiBase(string baseUrl, out Uri? normalizedBase)
    {
        normalizedBase = null;
        string value = baseUrl.Trim();
        if (string.IsNullOrWhiteSpace(value))
            return false;

        // OpenSubtitles may return only a host name, for example
        // "api.opensubtitles.com", rather than a complete absolute URI.
        if (!Uri.TryCreate(value, UriKind.Absolute, out Uri? parsed))
        {
            string valueWithScheme = $"https://{value.TrimStart('/')}";
            if (!Uri.TryCreate(valueWithScheme, UriKind.Absolute, out parsed))
                return false;
        }

        if (!string.Equals(parsed.Scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(parsed.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var builder = new UriBuilder(parsed)
        {
            Scheme = Uri.UriSchemeHttps,
            Port = -1,
            Query = string.Empty,
            Fragment = string.Empty
        };

        string path = builder.Path.TrimEnd('/');
        if (string.IsNullOrEmpty(path))
            path = "/api/v1";
        else if (!path.Contains("/api/v1", StringComparison.OrdinalIgnoreCase))
            path += "/api/v1";

        builder.Path = path.TrimEnd('/') + "/";
        normalizedBase = builder.Uri;
        return true;
    }

    private static string? NormalizeImdbId(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        value = value.Trim();
        return value.StartsWith("tt", StringComparison.OrdinalIgnoreCase)
            ? value[2..]
            : value;
    }

    private static async Task<string> ExtractIfNeededAsync(
        string downloadedPath,
        string tempRoot,
        CancellationToken cancellationToken)
    {
        byte[] header = new byte[4];
        await using (FileStream stream = File.OpenRead(downloadedPath))
        {
            int read = await stream.ReadAsync(header.AsMemory(), cancellationToken);
            if (read < 4)
                return downloadedPath;
        }

        bool isZip = header[0] == (byte)'P' && header[1] == (byte)'K';
        if (!isZip)
            return downloadedPath;

        string extractDirectory = Path.Combine(tempRoot, "extracted");
        Directory.CreateDirectory(extractDirectory);
        ZipFile.ExtractToDirectory(downloadedPath, extractDirectory, overwriteFiles: true);

        string? subtitle = Directory
            .EnumerateFiles(extractDirectory, "*", SearchOption.AllDirectories)
            .FirstOrDefault(path => SubtitleConverter.IsConvertibleExtension(Path.GetExtension(path)));

        return subtitle ?? throw new InvalidOperationException(
            "The downloaded archive did not contain an SRT, ASS, SSA, or VTT subtitle.");
    }

    private static bool IsKnownImageSubtitle(string fileName)
    {
        string extension = Path.GetExtension(fileName);
        return extension.Equals(".sup", StringComparison.OrdinalIgnoreCase) ||
               extension.Equals(".pgs", StringComparison.OrdinalIgnoreCase) ||
               extension.Equals(".idx", StringComparison.OrdinalIgnoreCase) ||
               extension.Equals(".sub", StringComparison.OrdinalIgnoreCase);
    }

    private static string SanitizeFileName(string? value, string fallback)
    {
        string fileName = string.IsNullOrWhiteSpace(value) ? fallback : Path.GetFileName(value);
        foreach (char invalid in Path.GetInvalidFileNameChars())
            fileName = fileName.Replace(invalid, '_');
        return fileName;
    }

    private void EnsureAuthenticated()
    {
        if (!IsAuthenticated)
            throw new InvalidOperationException("QuickSub is not logged in to OpenSubtitles.");
    }
}

public sealed class OpenSubtitlesApiException : Exception
{
    public OpenSubtitlesApiException(string message, HttpStatusCode statusCode)
        : base(message)
    {
        StatusCode = statusCode;
    }

    public HttpStatusCode StatusCode { get; }
}
