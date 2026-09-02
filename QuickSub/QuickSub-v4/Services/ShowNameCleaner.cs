using System.Text.RegularExpressions;

namespace QuickSub.Services;

public static partial class ShowNameCleaner
{
    [GeneratedRegex(@"(?i)\bS\d{1,3}(?:\s*[-]\s*S?\d{1,3})?\b|\bSeason\s*\d{1,3}(?:\s*[-]\s*\d{1,3})?\b")]
    private static partial Regex SeasonRegex();

    [GeneratedRegex(@"(?i)\b(Complete(?:\s+Series)?|All\s+Seasons|全集|כל\s+העונות)\b")]
    private static partial Regex CompleteRegex();

    [GeneratedRegex(@"(?i)\b(480p|720p|1080p|2160p|4k|uhd|hdr10?|dv|dolby[ ._-]?vision|bluray|bdrip|web[ ._-]?dl|webrip|hdtv|x264|x265|h[ ._-]?264|h[ ._-]?265|hevc|aac|dts|remux)\b")]
    private static partial Regex QualityRegex();

    [GeneratedRegex(@"(?i)\b(19|20)\d{2}\b")]
    private static partial Regex YearRegex();

    [GeneratedRegex(@"[\[\]{}()]")]
    private static partial Regex BracketsRegex();

    [GeneratedRegex(@"\s+")]
    private static partial Regex SpacesRegex();

    [GeneratedRegex(@"(?i)^(?:Season|Saison|Staffel|Temporada|Sesoen|Seasone|Seasons|Sesón|עונה|S)\s*[-._]?\s*\d{1,3}$")]
    private static partial Regex SeasonFolderRegex();

    public static string GetSearchName(string folderPath)
    {
        var directory = new DirectoryInfo(folderPath);
        string sourceName = directory.Name;

        if (SeasonFolderRegex().IsMatch(sourceName) && directory.Parent is not null)
            sourceName = directory.Parent.Name;

        string cleaned = sourceName
            .Replace('.', ' ')
            .Replace('_', ' ');

        cleaned = SeasonRegex().Replace(cleaned, " ");
        cleaned = CompleteRegex().Replace(cleaned, " ");
        cleaned = QualityRegex().Replace(cleaned, " ");
        cleaned = BracketsRegex().Replace(cleaned, " ");
        cleaned = SpacesRegex().Replace(cleaned, " ").Trim(' ', '-', '.');

        return string.IsNullOrWhiteSpace(cleaned) ? sourceName : cleaned;
    }

    public static string RemoveYear(string value)
    {
        string result = YearRegex().Replace(value, " ");
        return SpacesRegex().Replace(result, " ").Trim();
    }

    public static string RemoveDashSuffix(string value)
    {
        int separatorIndex = value.IndexOf(" - ", StringComparison.Ordinal);
        if (separatorIndex <= 0)
            return value;

        string result = value[..separatorIndex].Trim();
        return string.IsNullOrWhiteSpace(result) ? value : result;
    }

    public static string NormalizeForComparison(string value)
    {
        string normalized = value.Normalize().ToLowerInvariant();
        normalized = Regex.Replace(normalized, @"[^\p{L}\p{N}]", string.Empty);
        return normalized;
    }
}

