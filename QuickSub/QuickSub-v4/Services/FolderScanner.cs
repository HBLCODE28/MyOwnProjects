using System.Text.RegularExpressions;
using QuickSub.Models;

namespace QuickSub.Services;

public sealed partial class FolderScanner
{
    private static readonly HashSet<string> VideoExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mkv", ".mp4", ".avi", ".mov", ".m4v", ".wmv", ".ts", ".m2ts", ".mts", ".m2t",
        ".webm", ".flv", ".vob", ".ogv", ".ogm", ".divx", ".asf", ".rm", ".rmvb",
        ".mpg", ".mpeg", ".m2v", ".3gp", ".3g2"
    };

    private static readonly HashSet<string> SubtitleExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".srt", ".ass", ".ssa", ".vtt"
    };

    private readonly AppLogger _logger;

    public FolderScanner(AppLogger logger)
    {
        _logger = logger;
    }

    [GeneratedRegex(@"(?i)(?:^|[.\s_\-\[])S(?<season>\d{1,3})[.\s_\-]*E(?<episodes>\d{1,3}(?:[.\s_\-]*E?\d{1,3})*)")]
    private static partial Regex StandardEpisodeRegex();

    [GeneratedRegex(@"(?i)(?:^|[.\s_\-\[])(?<season>\d{1,3})x(?<episodes>\d{1,3}(?:[.\s_\-]*x?\d{1,3})*)")]
    private static partial Regex AlternativeEpisodeRegex();

    [GeneratedRegex(@"(?i)(?:Season|Saison|Staffel|Temporada|Sesoen|Seasone|Seasons|Sesón|עונה|S)\s*[-._]?\s*(?<season>\d{1,3})\s*[-._]?\s*(?:Episode|Episodio|Ep|E)?\s*[-._]?\s*(?<episodes>\d{1,3}(?:[.\s_\-]*E?\d{1,3})*)")]
    private static partial Regex ExplicitSeasonEpisodeRegex();

    [GeneratedRegex(@"(?i)(?:^|[.\s_\-\[])(?<code>\d{3,4})(?:$|[.\s_\-\]])")]
    private static partial Regex Code34DigitRegex();

    [GeneratedRegex(@"(?i)\b(?:Season|Saison|Staffel|Temporada|Sesoen|Seasone|Seasons|Sesón|עונה|S)\s*[-._]?\s*(?<season>\d{1,3})\b")]
    private static partial Regex ParentSeasonRegex();

    [GeneratedRegex(@"(?i)(?:^|[.\s_\-\[])(?:Episode|Episodio|Ep|E)?\s*[-._]?\s*(?<episode>\d{1,3})(?:$|[.\s_\-\]])")]
    private static partial Regex EpisodeNumberRegex();

    [GeneratedRegex(@"(?i)\b(?<episode>\d{1,3})\b")]
    private static partial Regex AdditionalEpisodeNumbersRegex();

    public FolderScanResult Scan(string folderPath, string languageCode)
    {
        var result = new FolderScanResult();
        var options = new EnumerationOptions
        {
            RecurseSubdirectories = true,
            IgnoreInaccessible = true,
            ReturnSpecialDirectories = false
        };

        List<string> subtitleFiles = Directory
            .EnumerateFiles(folderPath, "*", options)
            .Where(path => SubtitleExtensions.Contains(Path.GetExtension(path)))
            .ToList();

        foreach (string videoPath in Directory.EnumerateFiles(folderPath, "*", options))
        {
            if (!VideoExtensions.Contains(Path.GetExtension(videoPath)))
                continue;

            VideoEpisode? episode = ParseVideo(videoPath);
            if (episode is null)
            {
                result.UnrecognizedFiles.Add(new UnrecognizedVideo
                {
                    FullPath = videoPath,
                    FileName = Path.GetFileName(videoPath)
                });
                continue;
            }

            episode.ExistingSubtitlePath = FindExistingSubtitle(episode, subtitleFiles, languageCode);
            if (episode.ExistingSubtitlePath is not null)
                episode.Status = EpisodeSearchStatus.Existing;

            result.Episodes.Add(episode);
        }

        result.Episodes.Sort((left, right) =>
        {
            int season = left.Season.CompareTo(right.Season);
            return season != 0
                ? season
                : left.Episodes.FirstOrDefault().CompareTo(right.Episodes.FirstOrDefault());
        });

        _logger.Info($"Folder scan completed. Videos: {result.Episodes.Count}, unrecognized: {result.UnrecognizedFiles.Count}.");
        return result;
    }

    public static VideoEpisode? ParseVideo(string path)
    {
        string baseName = Path.GetFileNameWithoutExtension(path);

        // Pass 1: Standard S01E01 / S01E01E02 / S01.E01
        Match standard = StandardEpisodeRegex().Match(baseName);
        if (standard.Success && int.TryParse(standard.Groups["season"].Value, out int season1))
        {
            List<int> episodes = ParseEpisodeList(standard.Groups["episodes"].Value);
            if (episodes.Count > 0)
            {
                return CreateEpisode(path, baseName, season1, episodes);
            }
        }

        // Pass 2: Alternative 1x01 / 01x05
        Match alt = AlternativeEpisodeRegex().Match(baseName);
        if (alt.Success && int.TryParse(alt.Groups["season"].Value, out int season2))
        {
            List<int> episodes = ParseEpisodeList(alt.Groups["episodes"].Value);
            if (episodes.Count > 0)
            {
                return CreateEpisode(path, baseName, season2, episodes);
            }
        }

        // Pass 3: Explicit "Season 1 Episode 1" / "Season 1 Ep 01" in filename
        Match explicitMatch = ExplicitSeasonEpisodeRegex().Match(baseName);
        if (explicitMatch.Success && int.TryParse(explicitMatch.Groups["season"].Value, out int season3))
        {
            List<int> episodes = ParseEpisodeList(explicitMatch.Groups["episodes"].Value);
            if (episodes.Count > 0)
            {
                return CreateEpisode(path, baseName, season3, episodes);
            }
        }

        // Pass 4: 3 or 4 digit episode numbers (e.g. 101 for S01E01, 1205 for S12E05)
        foreach (Match codeMatch in Code34DigitRegex().Matches(baseName))
        {
            if (int.TryParse(codeMatch.Groups["code"].Value, out int codeVal))
            {
                // Filter out common resolutions / years
                if (codeVal is 720 or 1080 or 2160 or 480 or 576 or (>= 1900 and <= 2099))
                    continue;

                int season4 = codeVal / 100;
                int ep4 = codeVal % 100;

                if (season4 is >= 1 and <= 99 && ep4 is >= 1 and <= 99)
                {
                    return CreateEpisode(path, baseName, season4, [ep4]);
                }
            }
        }

        // Pass 5: Parent directory season fallback (e.g., folder "Season 1" or "SESOEN 1", file "01.mkv" or "Episode 1.mp4")
        int? parentSeason = ExtractSeasonFromPath(path);
        if (parentSeason.HasValue)
        {
            int season5 = parentSeason.Value;
            foreach (Match epMatch in EpisodeNumberRegex().Matches(baseName))
            {
                if (int.TryParse(epMatch.Groups["episode"].Value, out int ep5) && ep5 is >= 1 and <= 99)
                {
                    // Filter out 720/1080/480/2160 if matched
                    if (ep5 is 720 or 1080 or 480 or 576)
                        continue;

                    return CreateEpisode(path, baseName, season5, [ep5]);
                }
            }
        }

        return null;
    }

    private static List<int> ParseEpisodeList(string text)
    {
        var episodes = new List<int>();
        foreach (Match match in AdditionalEpisodeNumbersRegex().Matches(text))
        {
            if (int.TryParse(match.Groups["episode"].Value, out int number) && number is >= 1 and <= 99)
            {
                if (!episodes.Contains(number))
                    episodes.Add(number);
            }
        }
        return episodes;
    }

    private static int? ExtractSeasonFromPath(string fullPath)
    {
        string? directoryPath = Path.GetDirectoryName(fullPath);
        while (!string.IsNullOrEmpty(directoryPath))
        {
            string dirName = Path.GetFileName(directoryPath);
            Match match = ParentSeasonRegex().Match(dirName);
            if (match.Success && int.TryParse(match.Groups["season"].Value, out int season))
            {
                return season;
            }

            directoryPath = Path.GetDirectoryName(directoryPath);
        }

        return null;
    }

    private static VideoEpisode CreateEpisode(string path, string baseName, int season, List<int> episodes)
    {
        return new VideoEpisode
        {
            FullPath = path,
            FileName = Path.GetFileName(path),
            BaseName = baseName,
            Season = season,
            Episodes = episodes,
            FileSize = new FileInfo(path).Length
        };
    }

    private static string? FindExistingSubtitle(
        VideoEpisode video,
        IEnumerable<string> subtitleFiles,
        string languageCode)
    {
        string normalizedVideoName = NormalizeSubtitleStem(video.BaseName);
        string episodeCode = ShowNameCleaner.NormalizeForComparison(video.EpisodeCode);

        string[] languageTokens = languageCode.Equals("he", StringComparison.OrdinalIgnoreCase)
            ? ["he", "heb", "hebrew"]
            : ["en", "eng", "english"];

        foreach (string subtitlePath in subtitleFiles)
        {
            string subtitleStem = Path.GetFileNameWithoutExtension(subtitlePath);
            if (HasExplicitOtherLanguage(subtitleStem, languageCode))
                continue;

            string normalizedSubtitleName = NormalizeSubtitleStem(subtitleStem);

            bool exactBaseMatch = normalizedSubtitleName.Equals(normalizedVideoName, StringComparison.OrdinalIgnoreCase);
            bool languageSuffixMatch = languageTokens.Any(token =>
                normalizedSubtitleName.Equals(normalizedVideoName + token, StringComparison.OrdinalIgnoreCase));

            if (exactBaseMatch || languageSuffixMatch)
                return subtitlePath;

            string normalizedRaw = ShowNameCleaner.NormalizeForComparison(subtitleStem);
            if (normalizedRaw.Contains(episodeCode, StringComparison.OrdinalIgnoreCase) &&
                ShowNameCleaner.NormalizeForComparison(video.BaseName).Contains(episodeCode, StringComparison.OrdinalIgnoreCase))
            {
                string videoPrefix = RemoveEpisodeCode(ShowNameCleaner.NormalizeForComparison(video.BaseName), episodeCode);
                string subtitlePrefix = RemoveEpisodeCode(normalizedRaw, episodeCode);
                if (videoPrefix.Length >= 3 && subtitlePrefix.Contains(videoPrefix, StringComparison.OrdinalIgnoreCase))
                    return subtitlePath;
            }
        }

        return null;
    }

    private static bool HasExplicitOtherLanguage(string subtitleStem, string selectedLanguage)
    {
        string lower = subtitleStem.ToLowerInvariant();
        string[] english = [".en", ".eng", ".english", "_en", "_eng", "-en", "-eng"];
        string[] hebrew = [".he", ".heb", ".hebrew", "_he", "_heb", "-he", "-heb"];

        bool markedEnglish = english.Any(token => lower.EndsWith(token, StringComparison.OrdinalIgnoreCase));
        bool markedHebrew = hebrew.Any(token => lower.EndsWith(token, StringComparison.OrdinalIgnoreCase));

        return selectedLanguage.Equals("he", StringComparison.OrdinalIgnoreCase)
            ? markedEnglish
            : markedHebrew;
    }

    private static string NormalizeSubtitleStem(string value)
    {
        string normalized = ShowNameCleaner.NormalizeForComparison(value);
        string[] removableSuffixes = ["forced", "default", "sdh", "cc", "he", "heb", "hebrew", "en", "eng", "english"];

        bool changed;
        do
        {
            changed = false;
            foreach (string suffix in removableSuffixes)
            {
                if (normalized.EndsWith(suffix, StringComparison.OrdinalIgnoreCase) && normalized.Length > suffix.Length)
                {
                    normalized = normalized[..^suffix.Length];
                    changed = true;
                    break;
                }
            }
        } while (changed);

        return normalized;
    }

    private static string RemoveEpisodeCode(string value, string code)
    {
        int index = value.IndexOf(code, StringComparison.OrdinalIgnoreCase);
        return index >= 0 ? value[..index] : value;
    }
}

