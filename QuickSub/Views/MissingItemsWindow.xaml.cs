using System.Diagnostics;
using System.Windows;
using QuickSub.Models;

namespace QuickSub.Views;

public partial class MissingItemsWindow : Window
{
    public MissingItemsWindow(SearchSessionResult result)
    {
        InitializeComponent();

        List<DetailRow> errors = result.VideoEpisodes
            .Where(item => item.Status == EpisodeSearchStatus.Failed)
            .Select(item => new DetailRow(
                $"{item.EpisodeCode} - {item.FileName}",
                string.IsNullOrWhiteSpace(item.Message) ? "Unknown download or save error." : item.Message,
                item.OutputDirectory))
            .ToList();

        List<DetailRow> missingSubtitles = result.VideoEpisodes
            .Where(item => item.Status == EpisodeSearchStatus.Missing)
            .Select(item => new DetailRow(
                $"{item.EpisodeCode} - {item.FileName}",
                string.IsNullOrWhiteSpace(item.Message) ? "No matching subtitle was found." : item.Message,
                item.FullPath))
            .ToList();

        List<DetailRow> missingVideos = result.MissingFromDisk
            .Select(item => new DetailRow(
                item.Display,
                "This aired episode was not found in the selected series folder.",
                string.Empty))
            .ToList();

        List<DetailRow> futureEpisodes = result.NotAiredYet
            .Select(item => new DetailRow(
                item.Display,
                "This episode has not aired yet and is not counted as missing.",
                string.Empty))
            .ToList();

        List<DetailRow> skippedFiles = result.UnrecognizedFiles
            .Select(item => new DetailRow(
                item.FileName,
                "The file name does not contain a supported episode pattern such as S01E01 or 1x01.",
                item.FullPath))
            .ToList();

        ErrorsList.ItemsSource = errors;
        MissingSubtitlesList.ItemsSource = missingSubtitles;
        MissingVideosList.ItemsSource = missingVideos;
        FutureEpisodesList.ItemsSource = futureEpisodes;
        SkippedFilesList.ItemsSource = skippedFiles;

        ErrorsTab.Header = $"Errors ({errors.Count})";
        MissingSubtitlesTab.Header = $"Not found ({missingSubtitles.Count})";
        MissingVideosTab.Header = $"Missing videos ({missingVideos.Count})";
        FutureEpisodesTab.Header = $"Not aired yet ({futureEpisodes.Count})";
        SkippedFilesTab.Header = $"Skipped names ({skippedFiles.Count})";

        int downloaded = result.VideoEpisodes.Count(item => item.Status == EpisodeSearchStatus.Downloaded);
        int existing = result.VideoEpisodes.Count(item => item.Status == EpisodeSearchStatus.Existing);
        SummaryText.Text =
            $"{downloaded} saved, {existing} already existed, {errors.Count} failed, {missingSubtitles.Count} not found.";

        if (errors.Count > 0)
            ErrorsTab.IsSelected = true;
        else if (missingSubtitles.Count > 0)
            MissingSubtitlesTab.IsSelected = true;
        else if (missingVideos.Count > 0)
            MissingVideosTab.IsSelected = true;
        else if (futureEpisodes.Count > 0)
            FutureEpisodesTab.IsSelected = true;
        else
            SkippedFilesTab.IsSelected = true;
    }

    private void OpenLog_Click(object sender, RoutedEventArgs e)
    {
        string logPath = App.Services.Logger.LogPath;
        if (!File.Exists(logPath))
        {
            MessageBox.Show(
                this,
                "The log file does not exist yet.",
                "QuickSub",
                MessageBoxButton.OK,
                MessageBoxImage.Information);
            return;
        }

        Process.Start(new ProcessStartInfo("explorer.exe", $"/select,\"{logPath}\"")
        {
            UseShellExecute = true
        });
    }

    private void CopySelectedError_Click(object sender, RoutedEventArgs e)
    {
        if (ErrorsList.SelectedItem is not DetailRow selected)
        {
            MessageBox.Show(
                this,
                "Select an error first.",
                "QuickSub",
                MessageBoxButton.OK,
                MessageBoxImage.Information);
            return;
        }

        Clipboard.SetText($"{selected.Title}{Environment.NewLine}{selected.Message}{Environment.NewLine}{selected.Path}".Trim());
    }

    private void Close_Click(object sender, RoutedEventArgs e) => Close();
}

public sealed class DetailRow
{
    public DetailRow(string title, string message, string path)
    {
        Title = title;
        Message = message;
        Path = path;
    }

    public string Title { get; }
    public string Message { get; }
    public string Path { get; }
    public Visibility PathVisibility => string.IsNullOrWhiteSpace(Path)
        ? Visibility.Collapsed
        : Visibility.Visible;
}
