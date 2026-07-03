using System.Text.Json.Serialization;

namespace QuickSub.Models;

public sealed class TvMazeSearchResult
{
    [JsonPropertyName("score")]
    public double Score { get; set; }

    [JsonPropertyName("show")]
    public TvShow Show { get; set; } = new();
}

public sealed class TvShow
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("language")]
    public string? Language { get; set; }

    [JsonPropertyName("premiered")]
    public string? Premiered { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonPropertyName("image")]
    public TvMazeImage? Image { get; set; }

    [JsonPropertyName("externals")]
    public TvMazeExternalIds? Externals { get; set; }

    [JsonIgnore]
    public int SeasonCount { get; set; }

    [JsonIgnore]
    public string StartYear => DateTime.TryParse(Premiered, out DateTime date)
        ? date.Year.ToString()
        : "Unknown year";

    [JsonIgnore]
    public string SeasonText => SeasonCount == 1 ? "1 season" : $"{SeasonCount} seasons";
}

public sealed class TvMazeImage
{
    [JsonPropertyName("medium")]
    public string? Medium { get; set; }

    [JsonPropertyName("original")]
    public string? Original { get; set; }
}

public sealed class TvMazeExternalIds
{
    [JsonPropertyName("imdb")]
    public string? Imdb { get; set; }

    [JsonPropertyName("thetvdb")]
    public int? TvDb { get; set; }
}

public sealed class TvMazeSeason
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("number")]
    public int Number { get; set; }
}

public sealed class TvMazeEpisode
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("season")]
    public int Season { get; set; }

    [JsonPropertyName("number")]
    public int? Number { get; set; }

    [JsonPropertyName("airdate")]
    public string? AirDate { get; set; }

    [JsonPropertyName("airstamp")]
    public string? AirStamp { get; set; }

    [JsonPropertyName("type")]
    public string? Type { get; set; }

    [JsonIgnore]
    public bool HasAired
    {
        get
        {
            if (DateTimeOffset.TryParse(AirStamp, out DateTimeOffset airStamp))
                return airStamp <= DateTimeOffset.UtcNow;

            if (DateTime.TryParse(AirDate, out DateTime date))
                return date.Date <= DateTime.Today;

            return false;
        }
    }
}
