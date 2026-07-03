using System.Net.Http.Json;
using QuickSub.Models;

namespace QuickSub.Services;

public sealed class TvMazeClient
{
    private static readonly Uri BaseUri = new("https://api.tvmaze.com/");
    private readonly HttpClient _httpClient;
    private readonly AppLogger _logger;

    public TvMazeClient(HttpClient httpClient, AppLogger logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<List<TvShow>> SearchShowsAsync(
        string query,
        CancellationToken cancellationToken)
    {
        string url = new Uri(BaseUri, $"search/shows?q={Uri.EscapeDataString(query)}").ToString();
        using HttpResponseMessage response = await HttpRetry.SendAsync(
            _httpClient,
            () => new HttpRequestMessage(HttpMethod.Get, url),
            cancellationToken);

        response.EnsureSuccessStatusCode();
        List<TvMazeSearchResult> results =
            await response.Content.ReadFromJsonAsync<List<TvMazeSearchResult>>(cancellationToken: cancellationToken)
            ?? [];

        List<TvShow> shows = results.Take(12).Select(item => item.Show).ToList();
        using var semaphore = new SemaphoreSlim(4);

        await Task.WhenAll(shows.Select(async show =>
        {
            await semaphore.WaitAsync(cancellationToken);
            try
            {
                show.SeasonCount = await GetSeasonCountAsync(show.Id, cancellationToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.Warning($"Could not load the season count for TVmaze show {show.Id}: {ex.Message}");
            }
            finally
            {
                semaphore.Release();
            }
        }));

        return shows;
    }

    public async Task<List<TvMazeEpisode>> GetEpisodesAsync(
        int showId,
        bool includeSpecials,
        CancellationToken cancellationToken)
    {
        string suffix = includeSpecials ? "?specials=1" : string.Empty;
        string url = new Uri(BaseUri, $"shows/{showId}/episodes{suffix}").ToString();

        using HttpResponseMessage response = await HttpRetry.SendAsync(
            _httpClient,
            () => new HttpRequestMessage(HttpMethod.Get, url),
            cancellationToken);

        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<List<TvMazeEpisode>>(cancellationToken: cancellationToken)
               ?? [];
    }

    private async Task<int> GetSeasonCountAsync(int showId, CancellationToken cancellationToken)
    {
        string url = new Uri(BaseUri, $"shows/{showId}/seasons").ToString();
        using HttpResponseMessage response = await HttpRetry.SendAsync(
            _httpClient,
            () => new HttpRequestMessage(HttpMethod.Get, url),
            cancellationToken);

        response.EnsureSuccessStatusCode();
        List<TvMazeSeason> seasons =
            await response.Content.ReadFromJsonAsync<List<TvMazeSeason>>(cancellationToken: cancellationToken)
            ?? [];

        return seasons.Count(item => item.Number > 0);
    }

    public static bool IsConfidentAutomaticMatch(string query, IReadOnlyList<TvShow> shows)
    {
        if (shows.Count == 0)
            return false;

        string normalizedQuery = ShowNameCleaner.NormalizeForComparison(ShowNameCleaner.RemoveYear(query));
        string firstName = ShowNameCleaner.NormalizeForComparison(shows[0].Name);

        if (!normalizedQuery.Equals(firstName, StringComparison.OrdinalIgnoreCase))
            return false;

        if (shows.Count == 1)
            return true;

        string secondName = ShowNameCleaner.NormalizeForComparison(shows[1].Name);
        return !secondName.Equals(firstName, StringComparison.OrdinalIgnoreCase);
    }
}
