namespace QuickSub.Models;

public sealed class VideoEpisode
{
    public required string FullPath { get; init; }
    public required string FileName { get; init; }
    public required string BaseName { get; init; }
    public int Season { get; init; }
    public IReadOnlyList<int> Episodes { get; init; } = [];
    public string? ExistingSubtitlePath { get; set; }
    public bool ReplaceExisting { get; set; }
    public string? MovieHash { get; set; }
    public long FileSize { get; set; }
    public List<SubtitleCandidate> Candidates { get; set; } = [];
    public SubtitleCandidate? SelectedCandidate { get; set; }
    public EpisodeSearchStatus Status { get; set; } = EpisodeSearchStatus.Pending;
    public string Message { get; set; } = string.Empty;

    public bool IsMultiEpisode => Episodes.Count > 1;

    public string EpisodeCode => Episodes.Count == 0
        ? $"S{Season:00}"
        : $"S{Season:00}" + string.Concat(Episodes.Select(number => $"E{number:00}"));

    public string OutputDirectory => Path.GetDirectoryName(FullPath)!;
}

public sealed class UnrecognizedVideo
{
    public required string FullPath { get; init; }
    public required string FileName { get; init; }
}

public sealed class MissingDiskEpisode
{
    public int Season { get; init; }
    public int Episode { get; init; }
    public string Name { get; init; } = string.Empty;
    public bool HasAired { get; init; }

    public string Display => $"S{Season:00}E{Episode:00} - {Name}";
}

public enum EpisodeSearchStatus
{
    Pending,
    Existing,
    Found,
    Missing,
    Downloading,
    Downloaded,
    Skipped,
    Failed
}

public sealed class FolderScanResult
{
    public List<VideoEpisode> Episodes { get; init; } = [];
    public List<UnrecognizedVideo> UnrecognizedFiles { get; init; } = [];
}

public sealed class SearchSessionResult
{
    public required TvShow Show { get; init; }
    public required string SeriesFolder { get; init; }
    public List<VideoEpisode> VideoEpisodes { get; init; } = [];
    public List<UnrecognizedVideo> UnrecognizedFiles { get; init; } = [];
    public List<MissingDiskEpisode> MissingFromDisk { get; init; } = [];
    public List<MissingDiskEpisode> NotAiredYet { get; init; } = [];

    public int CoveredCount => VideoEpisodes.Count(item =>
        item.Status is EpisodeSearchStatus.Existing or EpisodeSearchStatus.Found or EpisodeSearchStatus.Downloaded);

    public int MissingSubtitleCount => VideoEpisodes.Count(item => item.Status == EpisodeSearchStatus.Missing);
}
