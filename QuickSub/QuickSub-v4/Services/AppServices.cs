using System.Net;
using System.Net.Http.Headers;

namespace QuickSub.Services;

public sealed class AppServices : IDisposable
{
    public AppServices()
    {
        Logger = new AppLogger();
        Settings = new SettingsService(Logger);
        Theme = new ThemeService();

        var socketsHandler = new SocketsHttpHandler
        {
            AutomaticDecompression = DecompressionMethods.All,
            PooledConnectionLifetime = TimeSpan.FromMinutes(10),
            ConnectTimeout = TimeSpan.FromSeconds(20)
        };

        HttpClient = new HttpClient(socketsHandler)
        {
            Timeout = TimeSpan.FromSeconds(60)
        };
        HttpClient.DefaultRequestHeaders.UserAgent.Add(
            new ProductInfoHeaderValue("QuickSub", "1.0"));

        TvMaze = new TvMazeClient(HttpClient, Logger);
        OpenSubtitles = new OpenSubtitlesClient(HttpClient, Logger);
        Scanner = new FolderScanner(Logger);
        SubtitleConverter = new SubtitleConverter(Logger);
    }

    public HttpClient HttpClient { get; }
    public AppLogger Logger { get; }
    public SettingsService Settings { get; }
    public ThemeService Theme { get; }
    public TvMazeClient TvMaze { get; }
    public OpenSubtitlesClient OpenSubtitles { get; }
    public FolderScanner Scanner { get; }
    public SubtitleConverter SubtitleConverter { get; }

    public void Dispose() => HttpClient.Dispose();
}
