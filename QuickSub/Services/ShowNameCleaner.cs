using System.Text.RegularExpressions;

namespace QuickSub.Services;

public static partial class ShowNameCleaner
{
    private static readonly HashSet<string> VideoExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mkv", ".mp4", ".avi", ".mov", ".m4v", ".wmv", ".ts", ".m2ts"
    };

    private static readonly HashSet<string> GenericFolderNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "downloads", "download", "series", "shows", "tv", "television", "videos", "video",
        "season", "complete", "collection", "media", "new folder"
    };

    [GeneratedRegex(@"(?ix)\b(?:S\d{1,3}(?:E\d{1,3}(?:E\d{1,3})*)?(?:\s*-\s*S?\d{1,3})?|Season\s*\d{1,3}(?:\s*-\s*\d{1,3})?|\d{1,3}x\d{1,3})\b")]
    private static partial Regex SeasonOrEpisodeRegex();

    [GeneratedRegex(@"(?ix)\b(?:Complete(?:\s+Series)?|All\s+Seasons|Full\s+Series|全集|כל\s+העונות)\b")]
    private static partial Regex CompleteRegex();

    [GeneratedRegex(@"(?ix)\b(?:
        360p|480p|576p|720p|1080p|1080i|1440p|2160p|4320p|4k|8k|uhd|
        hdr10\+?|hdr|sdr|dolby[ ._-]?vision|dv|
        bluray|blu[ ._-]?ray|bdrip|brrip|web[ ._-]?dl|webdl|webrip|web[ ._-]?rip|hdtv|pdtv|dvdrip|remux|
        xvid|divx|x264|x265|h[ ._-]?264|h[ ._-]?265|hevc|av1|mpeg2|mpeg4|
        aac|aac2[ ._-]?0|ac3|eac3|e[ ._-]?ac[ ._-]?3|ddp?|dd\+|dts|dtshd|truehd|atmos|flac|mp3|
        2[ ._-]?0|5[ ._-]?1|7[ ._-]?1|8bit|10bit|12bit|
        proper|repack|rerip|internal|limited|extended|uncut|remastered|readnfo|nfofix|
        multi|dual|dubbed|subbed|heb|hebrew|eng|english|
        nf|netflix|amzn|amazon|dsnp|disney\+?|hmax|max|atvp|apple[ ._-]?tv|
        mkv|mp4|avi|m4v|wmv|m2ts
    )\b")]
    private static partial Regex TechnicalRegex();

    [GeneratedRegex(@"(?ix)\b(?:
        S\d{1,3}(?:E\d{1,3}(?:E\d{1,3})*)?(?:\s*-\s*S?\d{1,3})?|
        Season\s*\d{1,3}(?:\s*-\s*\d{1,3})?|
        \d{1,3}x\d{1,3}|
        Complete(?:\s+Series)?|All\s+Seasons|Full\s+Series|全集|כל\s+העונות|
        360p|480p|576p|720p|1080p|1080i|1440p|2160p|4320p|4k|8k|uhd|
        hdr10\+?|hdr|sdr|dolby[ ._-]?vision|dv|
        bluray|blu[ ._-]?ray|bdrip|brrip|web[ ._-]?dl|webdl|webrip|web[ ._-]?rip|hdtv|pdtv|dvdrip|remux|
        xvid|divx|x264|x265|h[ ._-]?264|h[ ._-]?265|hevc|av1|mpeg2|mpeg4|
        aac|ac3|eac3|ddp?|dts|truehd|atmos|flac|mp3|
        8bit|10bit|12bit|proper|repack|rerip|internal|readnfo|nfofix|
        heb|eng|nf|amzn|dsnp|hmax|atvp|
        rarbg|eztv|ion10|galaxytv|megusta|tgx|ntb|sample
    )\b")]
    private static partial Regex NoiseBoundaryRegex();

    [GeneratedRegex(@"(?i)\b(19|20)\d{2}\b")]
    private static partial Regex YearRegex();

    [GeneratedRegex(@"^[\s._-]*(?:\[[^\]]+\]|\{[^}]+\})[\s._-]*")]
    private static partial Regex LeadingBracketTagRegex();

    [GeneratedRegex(@"(?i)^\s*(?:https?://)?(?:www\.)?[a-z0-9-]+\.(?:com|net|org|io|tv|me|to)\s*[-_. ]+")]
    private static partial Regex WebsitePrefixRegex();

    [GeneratedRegex(@"(?i)^\s*(?:Season\s*\d{1,3}|S\d{1,3})\s*[-_.: ]+")]
    private static partial Regex LeadingSeasonRegex();

    [GeneratedRegex(@"[\[\]{}()]")]
    private static partial Regex BracketsRegex();

    [GeneratedRegex(@"[._]+")]
    private static partial Regex DotSeparatorsRegex();

    [GeneratedRegex(@"\s+-\s+")]
    private static partial Regex SpacedDashRegex();

    [GeneratedRegex(@"\s+")]
    private static partial Regex SpacesRegex();

    [GeneratedRegex(@"(?i)^Season\s*\d{1,3}$|^S\d{1,3}$")]
    private static partial Regex SeasonFolderRegex();

    public static string GetSearchName(string folderPath)
    {
        var directory = new DirectoryInfo(folderPath);
        string sourceName = directory.Name;

        if (SeasonFolderRegex().IsMatch(sourceName) && directory.Parent is not null)
            sourceName = directory.Parent.Name;

        string folderTitle = CleanTitle(sourceName, removeExtension: false);
        string? videoTitle = TryGetCommonVideoTitle(folderPath);

        if (ShouldPreferVideoTitle(folderTitle, videoTitle))
            return videoTitle!;

        return string.IsNullOrWhiteSpace(folderTitle) ? sourceName : folderTitle;
    }

    public static string RemoveYear(string value)
    {
        string result = YearRegex().Replace(value, " ");
        return SpacesRegex().Replace(result, " ").Trim();
    }

    public static string NormalizeForComparison(string value)
    {
        string normalized = value.Normalize().ToLowerInvariant();
        normalized = Regex.Replace(normalized, @"[^\p{L}\p{N}]", string.Empty);
        return normalized;
    }

    private static string CleanTitle(string rawName, bool removeExtension)
    {
        string value = removeExtension
            ? Path.GetFileNameWithoutExtension(rawName).Trim()
            : rawName.Trim();

        // Release groups and download sites are commonly placed before the actual title.
        while (LeadingBracketTagRegex().IsMatch(value))
            value = LeadingBracketTagRegex().Replace(value, string.Empty, 1);

        value = WebsitePrefixRegex().Replace(value, string.Empty);
        value = LeadingSeasonRegex().Replace(value, string.Empty);
        value = DotSeparatorsRegex().Replace(value, " ");
        value = SpacedDashRegex().Replace(value, " ");
        value = BracketsRegex().Replace(value, " ");
        value = SpacesRegex().Replace(value, " ").Trim(' ', '-', '.');

        // The title normally appears before the first season, episode, quality,
        // source, codec or audio marker. Everything after that marker is release metadata.
        Match boundary = NoiseBoundaryRegex().Match(value);
        string prefix = boundary.Success && boundary.Index > 0
            ? value[..boundary.Index]
            : value;

        prefix = SpacesRegex().Replace(prefix, " ").Trim(' ', '-', '.');
        if (IsUsableTitle(prefix))
            return prefix;

        // Fallback for unusual ordering where metadata appears before the title.
        string cleaned = SeasonOrEpisodeRegex().Replace(value, " ");
        cleaned = CompleteRegex().Replace(cleaned, " ");
        cleaned = TechnicalRegex().Replace(cleaned, " ");
        cleaned = SpacesRegex().Replace(cleaned, " ").Trim(' ', '-', '.');

        return IsUsableTitle(cleaned) ? cleaned : prefix;
    }

    private static string? TryGetCommonVideoTitle(string folderPath)
    {
        try
        {
            var options = new EnumerationOptions
            {
                RecurseSubdirectories = true,
                IgnoreInaccessible = true,
                ReturnSpecialDirectories = false
            };

            List<string> titles = Directory
                .EnumerateFiles(folderPath, "*", options)
                .Where(path => VideoExtensions.Contains(Path.GetExtension(path)))
                .Take(20)
                .Select(path => CleanTitle(Path.GetFileName(path), removeExtension: true))
                .Where(IsUsableTitle)
                .ToList();

            if (titles.Count == 0)
                return null;

            return titles
                .GroupBy(NormalizeForComparison)
                .OrderByDescending(group => group.Count())
                .ThenByDescending(group => group.First().Length)
                .Select(group => group.First())
                .FirstOrDefault();
        }
        catch
        {
            return null;
        }
    }

    private static bool ShouldPreferVideoTitle(string folderTitle, string? videoTitle)
    {
        if (!IsUsableTitle(videoTitle))
            return false;

        if (!IsUsableTitle(folderTitle) || IsGenericName(folderTitle))
            return true;

        string normalizedFolder = NormalizeForComparison(folderTitle);
        string normalizedVideo = NormalizeForComparison(videoTitle!);

        if (normalizedFolder.Equals(normalizedVideo, StringComparison.OrdinalIgnoreCase))
            return false;

        // A title derived from several episode file names is normally more reliable
        // when it is contained inside a longer, noisy folder name.
        if (normalizedFolder.Contains(normalizedVideo, StringComparison.OrdinalIgnoreCase))
            return true;

        int folderWords = CountWords(folderTitle);
        int videoWords = CountWords(videoTitle!);
        return videoWords >= 2 && folderWords >= videoWords + 2;
    }

    private static bool IsUsableTitle(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return false;

        string normalized = NormalizeForComparison(value);
        return normalized.Length >= 2 && !IsGenericName(value);
    }

    private static bool IsGenericName(string value)
    {
        string normalized = SpacesRegex().Replace(value, " ").Trim();
        return GenericFolderNames.Contains(normalized);
    }

    private static int CountWords(string value) =>
        value.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Length;
}
