using System.Text.RegularExpressions;
using QuickSub.Models;

namespace QuickSub.Services;

public sealed partial class FolderScanner
{
    private static readonly HashSet<string> VideoExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mkv", ".mp4", ".avi", ".mov", ".m4v", ".wmv", ".ts", ".m2ts", ".webm"
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

    [GeneratedRegex(@"(?i)(?:^|[.\s_\-])S(?<season>\d{1,3})E(?<episodes>\d{1,3}(?:E\d{1,3})*)")]
    private static partial Regex StandardEpisodeRegex();

    [GeneratedRegex(@"(?i)(?:^|[.\s_\-])(?<season>\d{1,3})x(?<episode>\d{1,3})(?:$|[.\s_\-])")]
    private static partial Regex AlternativeEpisodeRegex();

    [GeneratedRegex(@"(?i)E(?<episode>\d{1,3})")]
    private static partial Regex AdditionalEpisodeRegex();

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
        Match standard = StandardEpisodeRegex().Match(baseName);

        if (standard.Success && int.TryParse(standard.Groups["season"].Value, out int season))
        {
            var episodes = new List<int>();
            string episodeText = "E" + standard.Groups["episodes"].Value;
            foreach (Match episodeMatch in AdditionalEpisodeRegex().Matches(episodeText))
            {
                if (int.TryParse(episodeMatch.Groups["episode"].Value, out int number))
                    episodes.Add(number);
            }

            if (episodes.Count > 0)
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
        }

        Match alternative = AlternativeEpisodeRegex().Match(baseName);
        if (alternative.Success &&
            int.TryParse(alternative.Groups["season"].Value, out int altSeason) &&
            int.TryParse(alternative.Groups["episode"].Value, out int altEpisode))
        {
            return new VideoEpisode
            {
                FullPath = path,
                FileName = Path.GetFileName(path),
                BaseName = baseName,
                Season = altSeason,
                Episodes = [altEpisode],
                FileSize = new FileInfo(path).Length
            };
        }

        return null;
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
