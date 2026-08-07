using System.Text.Json.Serialization;

namespace QuickSub.Models;

public sealed class OpenSubtitlesLoginResponse
{
    [JsonPropertyName("token")]
    public string Token { get; set; } = string.Empty;

    [JsonPropertyName("base_url")]
    public string? BaseUrl { get; set; }

    [JsonPropertyName("status")]
    public int Status { get; set; }

    [JsonPropertyName("user")]
    public OpenSubtitlesUser? User { get; set; }
}

public sealed class OpenSubtitlesUser
{
    [JsonPropertyName("allowed_downloads")]
    public int AllowedDownloads { get; set; }

    [JsonPropertyName("level")]
    public string? Level { get; set; }

    [JsonPropertyName("user_id")]
    public int UserId { get; set; }

    [JsonPropertyName("vip")]
    public bool Vip { get; set; }
}

public sealed class OpenSubtitlesSearchResponse
{
    [JsonPropertyName("total_pages")]
    public int TotalPages { get; set; }

    [JsonPropertyName("total_count")]
    public int TotalCount { get; set; }

    [JsonPropertyName("data")]
    public List<OpenSubtitlesDataItem> Data { get; set; } = [];
}

public sealed class OpenSubtitlesDataItem
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("attributes")]
    public OpenSubtitlesAttributes Attributes { get; set; } = new();
}

public sealed class OpenSubtitlesAttributes
{
    [JsonPropertyName("subtitle_id")]
    public string? SubtitleId { get; set; }

    [JsonPropertyName("language")]
    public string Language { get; set; } = string.Empty;

    [JsonPropertyName("download_count")]
    public int DownloadCount { get; set; }

    [JsonPropertyName("new_download_count")]
    public int NewDownloadCount { get; set; }

    [JsonPropertyName("hearing_impaired")]
    public bool HearingImpaired { get; set; }

    [JsonPropertyName("hd")]
    public bool Hd { get; set; }

    [JsonPropertyName("fps")]
    public double? Fps { get; set; }

    [JsonPropertyName("votes")]
    public int Votes { get; set; }

    [JsonPropertyName("ratings")]
    public double? Ratings { get; set; }

    [JsonPropertyName("ratings_from_users")]
    public double? RatingsFromUsers { get; set; }

    [JsonPropertyName("foreign_parts_only")]
    public bool ForeignPartsOnly { get; set; }

    [JsonPropertyName("ai_translated")]
    public bool AiTranslated { get; set; }

    [JsonPropertyName("machine_translated")]
    public bool MachineTranslated { get; set; }

    [JsonPropertyName("release")]
    public string? Release { get; set; }

    [JsonPropertyName("moviehash_match")]
    public bool MovieHashMatch { get; set; }

    [JsonPropertyName("uploader")]
    public OpenSubtitlesUploader? Uploader { get; set; }

    [JsonPropertyName("files")]
    public List<OpenSubtitlesFile> Files { get; set; } = [];
}

public sealed class OpenSubtitlesUploader
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("rank")]
    public string? Rank { get; set; }
}

public sealed class OpenSubtitlesFile
{
    [JsonPropertyName("file_id")]
    public int FileId { get; set; }

    [JsonPropertyName("file_name")]
    public string FileName { get; set; } = string.Empty;
}

public sealed class OpenSubtitlesDownloadResponse
{
    [JsonPropertyName("link")]
    public string Link { get; set; } = string.Empty;

    [JsonPropertyName("file_name")]
    public string FileName { get; set; } = string.Empty;

    [JsonPropertyName("requests")]
    public int Requests { get; set; }

    [JsonPropertyName("remaining")]
    public int Remaining { get; set; }

    [JsonPropertyName("message")]
    public string? Message { get; set; }

    [JsonPropertyName("reset_time")]
    public string? ResetTime { get; set; }
}

public sealed class SubtitleCandidate
{
    public int FileId { get; init; }
    public string FileName { get; init; } = string.Empty;
    public string Release { get; init; } = string.Empty;
    public string Language { get; init; } = string.Empty;
    public int DownloadCount { get; init; }
    public bool MovieHashMatch { get; init; }
    public bool HearingImpaired { get; init; }
    public bool AiTranslated { get; init; }
    public bool MachineTranslated { get; init; }
    public string UploaderRank { get; init; } = string.Empty;
    public double Score { get; set; }
    public string MatchDescription { get; set; } = string.Empty;

    public string DisplayName => string.IsNullOrWhiteSpace(Release) ? FileName : Release;
    public string Details => $"{MatchDescription} | {DownloadCount:N0} downloads";
}
