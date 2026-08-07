using QuickSub.Models;

namespace QuickSub.Services;

public static class SubtitleScorer
{
    private static readonly HashSet<string> IgnoredTokens = new(StringComparer.OrdinalIgnoreCase)
    {
        "mkv", "mp4", "avi", "srt", "ass", "ssa", "vtt", "x264", "x265", "h264", "h265", "hevc",
        "aac", "dts", "proper", "repack", "internal", "multi", "subbed", "dubbed"
    };

    public static void Score(
        VideoEpisode video,
        IEnumerable<SubtitleCandidate> candidates,
        HearingImpairedPreference hearingPreference)
    {
        foreach (SubtitleCandidate candidate in candidates)
        {
            double score = 0;
            var reasons = new List<string>();

            if (candidate.MovieHashMatch)
            {
                score += 1000;
                reasons.Add("Exact file hash");
            }

            double releaseMatch = ReleaseSimilarity(video.BaseName, candidate.Release + " " + candidate.FileName);
            score += releaseMatch * 350;
            if (releaseMatch >= 0.75)
                reasons.Add("Strong release match");
            else if (releaseMatch >= 0.4)
                reasons.Add("Release match");

            if (!candidate.AiTranslated && !candidate.MachineTranslated)
                score += 45;
            else
                score -= 40;

            string rank = candidate.UploaderRank.ToLowerInvariant();
            if (rank.Contains("trusted") || rank.Contains("gold") || rank.Contains("administrator"))
                score += 35;

            switch (hearingPreference)
            {
                case HearingImpairedPreference.PreferStandard:
                    score += candidate.HearingImpaired ? -60 : 25;
                    break;
                case HearingImpairedPreference.AllowIfNeeded:
                    score += candidate.HearingImpaired ? -25 : 15;
                    break;
            }

            score += Math.Log10(Math.Max(1, candidate.DownloadCount) + 1) * 15;

            candidate.Score = score;
            candidate.MatchDescription = reasons.Count > 0
                ? string.Join(", ", reasons)
                : "Episode match";
        }
    }

    private static double ReleaseSimilarity(string videoName, string subtitleName)
    {
        HashSet<string> videoTokens = Tokenize(videoName);
        HashSet<string> subtitleTokens = Tokenize(subtitleName);

        if (videoTokens.Count == 0 || subtitleTokens.Count == 0)
            return 0;

        int intersection = videoTokens.Intersect(subtitleTokens, StringComparer.OrdinalIgnoreCase).Count();
        int union = videoTokens.Union(subtitleTokens, StringComparer.OrdinalIgnoreCase).Count();
        return union == 0 ? 0 : (double)intersection / union;
    }

    private static HashSet<string> Tokenize(string value)
    {
        string[] tokens = System.Text.RegularExpressions.Regex
            .Split(value.ToLowerInvariant(), @"[^\p{L}\p{N}]+")
            .Where(token => token.Length >= 2 && !IgnoredTokens.Contains(token))
            .ToArray();

        return new HashSet<string>(tokens, StringComparer.OrdinalIgnoreCase);
    }
}
