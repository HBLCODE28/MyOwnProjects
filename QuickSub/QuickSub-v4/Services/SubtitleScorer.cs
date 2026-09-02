using System.Text.RegularExpressions;
using QuickSub.Models;

namespace QuickSub.Services;

public static partial class SubtitleScorer
{
    private static readonly HashSet<string> IgnoredTokens = new(StringComparer.OrdinalIgnoreCase)
    {
        "mkv", "mp4", "avi", "srt", "ass", "ssa", "vtt", "subbed", "dubbed"
    };

    private static readonly string[] RipSources = ["bluray", "bdrip", "brrip", "web-dl", "webdl", "webrip", "hdtv", "dvdrip", "remux"];
    private static readonly string[] Resolutions = ["1080p", "720p", "2160p", "4k", "480p", "576p"];
    private static readonly string[] Codecs = ["x264", "x265", "hevc", "h264", "h265", "xvid"];

    [GeneratedRegex(@"(?i)-(?<group>[a-z0-9]+)(?:\[.*?\]|\.srt|\.mkv|\.mp4|\.avi|\.zip|\.rar|$)")]
    private static partial Regex ReleaseGroupRegex();

    public static void Score(
        VideoEpisode video,
        IEnumerable<SubtitleCandidate> candidates,
        HearingImpairedPreference hearingPreference)
    {
        string videoGroup = ExtractReleaseGroup(video.BaseName);
        string videoSource = ExtractTag(video.BaseName, RipSources);
        string videoRes = ExtractTag(video.BaseName, Resolutions);
        string videoCodec = ExtractTag(video.BaseName, Codecs);

        foreach (SubtitleCandidate candidate in candidates)
        {
            double score = 0;
            var reasons = new List<string>();

            if (candidate.MovieHashMatch)
            {
                score += 1000;
                reasons.Add("Exact file hash");
            }

            string subFullName = candidate.Release + " " + candidate.FileName;
            string subGroup = ExtractReleaseGroup(subFullName);
            string subSource = ExtractTag(subFullName, RipSources);
            string subRes = ExtractTag(subFullName, Resolutions);
            string subCodec = ExtractTag(subFullName, Codecs);

            // Release Group matching
            if (!string.IsNullOrEmpty(videoGroup) && !string.IsNullOrEmpty(subGroup) &&
                videoGroup.Equals(subGroup, StringComparison.OrdinalIgnoreCase))
            {
                score += 250;
                reasons.Add($"Matching release group ({videoGroup})");
            }

            // Source matching (e.g. BluRay vs WEB-DL vs HDTV)
            if (!string.IsNullOrEmpty(videoSource) && !string.IsNullOrEmpty(subSource))
            {
                if (videoSource.Equals(subSource, StringComparison.OrdinalIgnoreCase))
                {
                    score += 150;
                    reasons.Add($"Matching source ({videoSource})");
                }
                else
                {
                    // Penalize source conflict (e.g. video BluRay vs sub HDTV)
                    score -= 100;
                }
            }

            // Resolution & Codec matching
            if (!string.IsNullOrEmpty(videoRes) && videoRes.Equals(subRes, StringComparison.OrdinalIgnoreCase))
            {
                score += 40;
            }
            if (!string.IsNullOrEmpty(videoCodec) && videoCodec.Equals(subCodec, StringComparison.OrdinalIgnoreCase))
            {
                score += 25;
            }

            // Token similarity match
            double releaseMatch = ReleaseSimilarity(video.BaseName, subFullName);
            score += releaseMatch * 200;
            if (releaseMatch >= 0.75)
                reasons.Add("Strong release match");
            else if (releaseMatch >= 0.4)
                reasons.Add("Release match");

            // Human translation vs AI / machine translation
            if (!candidate.AiTranslated && !candidate.MachineTranslated)
            {
                score += 50;
            }
            else
            {
                score -= 60;
                reasons.Add("Machine translation penalty");
            }

            // Uploader rank
            string rank = candidate.UploaderRank.ToLowerInvariant();
            if (rank.Contains("trusted") || rank.Contains("gold") || rank.Contains("administrator") || rank.Contains("vip"))
            {
                score += 40;
                reasons.Add("Trusted uploader");
            }

            // Hearing impaired preference
            switch (hearingPreference)
            {
                case HearingImpairedPreference.PreferStandard:
                    score += candidate.HearingImpaired ? -60 : 25;
                    break;
                case HearingImpairedPreference.AllowIfNeeded:
                    score += candidate.HearingImpaired ? -25 : 15;
                    break;
            }

            // Downloads / Popularity
            score += Math.Log10(Math.Max(1, candidate.DownloadCount) + 1) * 20;

            candidate.Score = score;
            candidate.MatchDescription = reasons.Count > 0
                ? string.Join(", ", reasons)
                : "Episode match";
        }
    }

    private static string ExtractReleaseGroup(string text)
    {
        Match match = ReleaseGroupRegex().Match(text);
        if (match.Success)
        {
            string group = match.Groups["group"].Value;
            if (group.Length >= 2 && !RipSources.Contains(group.ToLowerInvariant()) && !Codecs.Contains(group.ToLowerInvariant()))
                return group.ToUpperInvariant();
        }
        return string.Empty;
    }

    private static string ExtractTag(string text, string[] tags)
    {
        string lower = text.ToLowerInvariant();
        foreach (string tag in tags)
        {
            if (lower.Contains(tag, StringComparison.OrdinalIgnoreCase))
                return tag;
        }
        return string.Empty;
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
        string[] tokens = Regex
            .Split(value.ToLowerInvariant(), @"[^\p{L}\p{N}]+")
            .Where(token => token.Length >= 2 && !IgnoredTokens.Contains(token))
            .ToArray();

        return new HashSet<string>(tokens, StringComparer.OrdinalIgnoreCase);
    }
}

