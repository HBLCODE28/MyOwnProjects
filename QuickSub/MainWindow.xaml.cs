using System.ComponentModel;
using System.Diagnostics;
using System.Net;
using System.Windows;
using System.Windows.Media.Imaging;
using Microsoft.Win32;
using QuickSub.Models;
using QuickSub.Services;
using QuickSub.Views;

namespace QuickSub;

public partial class MainWindow : Window
{
    private string? _selectedFolder;
    private TvShow? _selectedShow;
    private List<TvShow> _candidateShows = [];
    private SearchSessionResult? _lastResult;
    private CancellationTokenSource? _operationCancellation;
    private bool _isBusy;
    private bool _canScan;

    public MainWindow()
    {
        InitializeComponent();
    }

    private void Window_Loaded(object sender, RoutedEventArgs e)
    {
        if (App.Services.Settings.IsFirstRun)
            OpenSettings(firstRun: true);
    }

    private void DropPanel_DragEnter(object sender, DragEventArgs e) => UpdateDragEffect(e);
    private void DropPanel_DragOver(object sender, DragEventArgs e) => UpdateDragEffect(e);

    private async void DropPanel_Drop(object sender, DragEventArgs e)
    {
        if (_isBusy || !e.Data.GetDataPresent(DataFormats.FileDrop))
            return;

        string[] paths = (string[])e.Data.GetData(DataFormats.FileDrop);
        string? folder = paths.FirstOrDefault(Directory.Exists);
        if (folder is null)
        {
            MessageBox.Show(this, "Drop a folder, not a file.", "QuickSub", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        await IdentifyFolderAsync(folder);
    }

    private static void UpdateDragEffect(DragEventArgs e)
    {
        if (!e.Data.GetDataPresent(DataFormats.FileDrop))
        {
            e.Effects = DragDropEffects.None;
            e.Handled = true;
            return;
        }

        string[] paths = (string[])e.Data.GetData(DataFormats.FileDrop);
        e.Effects = paths.Any(Directory.Exists) ? DragDropEffects.Copy : DragDropEffects.None;
        e.Handled = true;
    }

    private async Task IdentifyFolderAsync(string folder)
    {
        _selectedFolder = folder;
        _selectedShow = null;
        _lastResult = null;
        _canScan = false;
        ResetResultButtons();
        SetBusy(true, "Identifying the series...");
        _operationCancellation = new CancellationTokenSource();

        try
        {
            string query = ShowNameCleaner.GetSearchName(folder);
            List<TvShow>? shows = null;

            while (true)
            {
                try
                {
                    shows = await App.Services.TvMaze.SearchShowsAsync(query, _operationCancellation.Token);
                    if (shows.Count == 0)
                    {
                        string withoutYear = ShowNameCleaner.RemoveYear(query);
                        if (!withoutYear.Equals(query, StringComparison.OrdinalIgnoreCase))
                            shows = await App.Services.TvMaze.SearchShowsAsync(withoutYear, _operationCancellation.Token);
                    }
                    break;
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    App.Services.Logger.Error("TVmaze series search failed.", ex);
                    MessageBoxResult retry = MessageBox.Show(
                        this,
                        $"QuickSub could not identify the series.\n\n{ex.Message}\n\nRetry?",
                        "QuickSub",
                        MessageBoxButton.YesNo,
                        MessageBoxImage.Warning);
                    if (retry != MessageBoxResult.Yes)
                        return;
                }
            }

            _candidateShows = shows ?? [];
            if (_candidateShows.Count == 0)
            {
                StatusText.Text = "No matching series was found.";
                SummaryText.Text = $"Search name: {query}";
                return;
            }

            TvShow? selected;
            if (TvMazeClient.IsConfidentAutomaticMatch(query, _candidateShows))
            {
                selected = _candidateShows[0];
            }
            else
            {
                selected = PromptForShow();
            }

            if (selected is null)
            {
                StatusText.Text = "Series selection was cancelled.";
                return;
            }

            ApplySelectedShow(selected);
            FolderScanResult localScan = App.Services.Scanner.Scan(
                folder,
                App.Services.Settings.Current.SubtitleLanguage);

            StatusText.Text = "Ready to scan for subtitles.";
            SummaryText.Text = localScan.UnrecognizedFiles.Count == 0
                ? $"{localScan.Episodes.Count} video files detected."
                : $"{localScan.Episodes.Count} video files detected. {localScan.UnrecognizedFiles.Count} files will be skipped because their names do not contain S01E01 or 1x01.";
            WorkProgress.Value = 0;
            _canScan = localScan.Episodes.Count > 0;
            ScanButton.IsEnabled = _canScan;
        }
        catch (OperationCanceledException)
        {
            StatusText.Text = "Operation cancelled.";
        }
        finally
        {
            SetBusy(false);
            _operationCancellation?.Dispose();
            _operationCancellation = null;
        }
    }

    private void ApplySelectedShow(TvShow show)
    {
        _selectedShow = show;
        ShowNameText.Text = show.Name;
        ShowDetailsText.Text = $"{show.StartYear}  |  {show.SeasonText}";
        FolderPathText.Text = _selectedFolder ?? string.Empty;
        ChangeSeriesButton.Visibility = Visibility.Visible;
        DropPlaceholder.Visibility = Visibility.Collapsed;

        string? imageUrl = show.Image?.Original ?? show.Image?.Medium;
        if (Uri.TryCreate(imageUrl, UriKind.Absolute, out Uri? uri))
        {
            try
            {
                PosterImage.Source = new BitmapImage(uri);
                PosterImage.Visibility = Visibility.Visible;
            }
            catch
            {
                PosterImage.Source = null;
                PosterImage.Visibility = Visibility.Collapsed;
            }
        }
        else
        {
            PosterImage.Source = null;
            PosterImage.Visibility = Visibility.Collapsed;
        }
    }

    private TvShow? PromptForShow()
    {
        var window = new ShowSelectionWindow(_candidateShows) { Owner = this };
        return window.ShowDialog() == true ? window.SelectedShow : null;
    }

    private async void ChangeSeriesButton_Click(object sender, RoutedEventArgs e)
    {
        if (_isBusy || _candidateShows.Count == 0)
            return;

        TvShow? selected = PromptForShow();
        if (selected is null)
            return;

        ApplySelectedShow(selected);
        _lastResult = null;
        ResetResultButtons();
        StatusText.Text = "Ready to scan for subtitles.";
        ScanButton.IsEnabled = _canScan;
        await Task.CompletedTask;
    }

    private async void ScanButton_Click(object sender, RoutedEventArgs e)
    {
        if (_isBusy || _selectedFolder is null || _selectedShow is null)
            return;

        if (!Directory.Exists(_selectedFolder))
        {
            ResetMissingSelectedFolder();
            return;
        }

        if (!App.Services.Settings.Current.HasRequiredCredentials && !OpenSettings(firstRun: true))
            return;

        if (_selectedFolder is null || _selectedShow is null || !Directory.Exists(_selectedFolder))
        {
            ResetMissingSelectedFolder();
            return;
        }

        string password = App.Services.Settings.GetSavedPassword();

        if (string.IsNullOrWhiteSpace(password))
        {
            if (!OpenSettings(firstRun: true))
                return;

            if (_selectedFolder is null || _selectedShow is null || !Directory.Exists(_selectedFolder))
            {
                ResetMissingSelectedFolder();
                return;
            }

            password = App.Services.Settings.GetSavedPassword();
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            MessageBox.Show(
                this,
                "QuickSub could not read the saved OpenSubtitles password. Open Settings and complete the initial setup again.",
                "QuickSub",
                MessageBoxButton.OK,
                MessageBoxImage.Information);
            return;
        }

        SetBusy(true, "Connecting to OpenSubtitles...");
        _operationCancellation = new CancellationTokenSource();

        try
        {
            if (!await LoginWithRetryAsync(password, _operationCancellation.Token))
                return;

            AppSettings settings = App.Services.Settings.Current;
            FolderScanResult localScan = App.Services.Scanner.Scan(_selectedFolder, settings.SubtitleLanguage);
            if (localScan.Episodes.Count == 0)
            {
                StatusText.Text = "No recognized episode files were found.";
                SummaryText.Text = "Video names must contain S01E01 or 1x01.";
                return;
            }

            var session = new SearchSessionResult
            {
                Show = _selectedShow,
                SeriesFolder = _selectedFolder,
                VideoEpisodes = localScan.Episodes,
                UnrecognizedFiles = localScan.UnrecognizedFiles
            };
            _lastResult = session;

            if (localScan.UnrecognizedFiles.Count > 0)
            {
                MessageBox.Show(
                    this,
                    $"{localScan.UnrecognizedFiles.Count} video files were skipped because their names do not contain S01E01 or 1x01. " +
                    "QuickSub does not guess these files because that could download subtitles for the wrong episode.",
                    "QuickSub",
                    MessageBoxButton.OK,
                    MessageBoxImage.Information);
            }

            if (!HandleExistingSubtitles(session.VideoEpisodes))
            {
                StatusText.Text = "Operation cancelled.";
                return;
            }

            await CheckMissingDiskEpisodesAsync(session, settings, _operationCancellation.Token);
            await SearchAllSubtitlesAsync(session, settings, _operationCancellation.Token);

            int covered = session.CoveredCount;
            int total = session.VideoEpisodes.Count;
            bool shouldDownload = false;

            if (covered == total)
            {
                shouldDownload = true;
            }
            else
            {
                var partial = new PartialResultsWindow(covered, total) { Owner = this };
                partial.ShowDialog();

                if (partial.Action == PartialResultAction.Download)
                {
                    shouldDownload = true;
                }
                else if (partial.Action == PartialResultAction.Review)
                {
                    var review = new ResultsReviewWindow(session.VideoEpisodes) { Owner = this };
                    review.ShowDialog();
                    shouldDownload = review.DownloadRequested;
                }
            }

            if (shouldDownload)
                await DownloadFoundSubtitlesAsync(session, settings, _operationCancellation.Token);
            else
                ShowSearchSummary(session, downloaded: false);
        }
        catch (OperationCanceledException)
        {
            StatusText.Text = "Operation cancelled.";
            SummaryText.Text = string.Empty;
        }
        catch (Exception ex)
        {
            App.Services.Logger.Error("Subtitle workflow failed.", ex);
            StatusText.Text = "The operation failed.";
            SummaryText.Text = ex.Message;
            MessageBox.Show(
                this,
                $"QuickSub could not complete the operation.\n\n{ex.Message}\n\nTechnical details were written to the log file.",
                "QuickSub",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
        finally
        {
            SetBusy(false);
            _operationCancellation?.Dispose();
            _operationCancellation = null;
            UpdateResultButtons();
        }
    }

    private async Task<bool> LoginWithRetryAsync(string password, CancellationToken cancellationToken)
    {
        while (true)
        {
            try
            {
                AppSettings settings = App.Services.Settings.Current;
                string apiKey = App.Services.Settings.GetSavedApiKey();
                if (string.IsNullOrWhiteSpace(apiKey))
                    throw new InvalidOperationException("The saved OpenSubtitles API key could not be read.");

                await App.Services.OpenSubtitles.LoginAsync(
                    settings.OpenSubtitlesUsername,
                    password,
                    apiKey,
                    cancellationToken);
                return true;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                App.Services.Logger.Error("OpenSubtitles login failed.", ex);
                MessageBoxResult retry = MessageBox.Show(
                    this,
                    $"OpenSubtitles connection failed.\n\n{ex.Message}\n\nRetry?",
                    "QuickSub",
                    MessageBoxButton.YesNo,
                    MessageBoxImage.Warning);
                if (retry != MessageBoxResult.Yes)
                    return false;
            }
        }
    }

    private bool HandleExistingSubtitles(IReadOnlyList<VideoEpisode> videos)
    {
        List<VideoEpisode> existing = videos
            .Where(item => item.ExistingSubtitlePath is not null)
            .ToList();
        if (existing.Count == 0)
            return true;

        var decisionWindow = new ExistingSubtitlesWindow(existing.Count) { Owner = this };
        if (decisionWindow.ShowDialog() != true)
            return false;

        switch (decisionWindow.Decision)
        {
            case ExistingSubtitleDecision.KeepAll:
                foreach (VideoEpisode video in existing)
                {
                    video.ReplaceExisting = false;
                    video.Status = EpisodeSearchStatus.Existing;
                }
                return true;

            case ExistingSubtitleDecision.ReplaceAll:
                foreach (VideoEpisode video in existing)
                {
                    video.ReplaceExisting = true;
                    video.Status = EpisodeSearchStatus.Pending;
                }
                return true;

            case ExistingSubtitleDecision.Review:
                var review = new ReviewExistingWindow(existing) { Owner = this };
                if (review.ShowDialog() != true)
                    return false;

                foreach (VideoEpisode video in existing)
                    video.Status = video.ReplaceExisting ? EpisodeSearchStatus.Pending : EpisodeSearchStatus.Existing;
                return true;

            default:
                return true;
        }
    }

    private async Task CheckMissingDiskEpisodesAsync(
        SearchSessionResult session,
        AppSettings settings,
        CancellationToken cancellationToken)
    {
        StatusText.Text = "Checking the episode list...";
        WorkProgress.IsIndeterminate = true;

        List<TvMazeEpisode> episodes = await App.Services.TvMaze.GetEpisodesAsync(
            session.Show.Id,
            settings.IncludeSpecials,
            cancellationToken);

        HashSet<(int Season, int Episode)> filesOnDisk = session.VideoEpisodes
            .SelectMany(video => video.Episodes.Select(episode => (video.Season, episode)))
            .ToHashSet();

        foreach (TvMazeEpisode episode in episodes)
        {
            if (!episode.Number.HasValue)
                continue;

            var key = (episode.Season, episode.Number.Value);
            if (filesOnDisk.Contains(key))
                continue;

            var missing = new MissingDiskEpisode
            {
                Season = episode.Season,
                Episode = episode.Number.Value,
                Name = episode.Name,
                HasAired = episode.HasAired
            };

            if (episode.HasAired)
                session.MissingFromDisk.Add(missing);
            else
                session.NotAiredYet.Add(missing);
        }

        WorkProgress.IsIndeterminate = false;
    }

    private async Task SearchAllSubtitlesAsync(
        SearchSessionResult session,
        AppSettings settings,
        CancellationToken cancellationToken)
    {
        List<VideoEpisode> toSearch = session.VideoEpisodes
            .Where(video => video.ExistingSubtitlePath is null || video.ReplaceExisting)
            .ToList();

        int total = toSearch.Count;
        int current = 0;
        WorkProgress.IsIndeterminate = false;
        WorkProgress.Maximum = Math.Max(1, total);
        WorkProgress.Value = 0;

        foreach (VideoEpisode video in toSearch)
        {
            cancellationToken.ThrowIfCancellationRequested();
            current++;
            StatusText.Text = $"Searching {video.EpisodeCode}...";
            SummaryText.Text = $"{current} of {total}";
            WorkProgress.Value = current - 1;

            try
            {
                video.Candidates = await App.Services.OpenSubtitles.SearchEpisodeAsync(
                    video,
                    session.Show,
                    settings,
                    cancellationToken);

                video.SelectedCandidate = video.Candidates.FirstOrDefault();
                if (video.SelectedCandidate is null)
                {
                    video.Status = EpisodeSearchStatus.Missing;
                    video.Message = "No matching subtitle was found.";
                }
                else
                {
                    video.Status = EpisodeSearchStatus.Found;
                    video.Message = video.SelectedCandidate.MatchDescription;
                }
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (OpenSubtitlesApiException ex) when (ex.StatusCode == (HttpStatusCode)429)
            {
                video.Status = EpisodeSearchStatus.Failed;
                video.Message = "OpenSubtitles rate limit reached.";
                App.Services.Logger.Error($"Rate limit while searching {video.FileName}.", ex);
            }
            catch (Exception ex)
            {
                video.Status = EpisodeSearchStatus.Failed;
                video.Message = ex.Message;
                App.Services.Logger.Error($"Search failed for {video.FileName}.", ex);
            }

            WorkProgress.Value = current;
        }

        StatusText.Text = "Subtitle search completed.";
        SummaryText.Text = $"Subtitles available for {session.CoveredCount} of {session.VideoEpisodes.Count} video files.";
    }

    private async Task DownloadFoundSubtitlesAsync(
        SearchSessionResult session,
        AppSettings settings,
        CancellationToken cancellationToken)
    {
        List<VideoEpisode> downloads = session.VideoEpisodes
            .Where(video => video.Status == EpisodeSearchStatus.Found && video.SelectedCandidate is not null)
            .ToList();

        if (downloads.Count == 0)
        {
            ShowSearchSummary(session, downloaded: false);
            return;
        }

        WorkProgress.IsIndeterminate = false;
        WorkProgress.Maximum = Math.Max(1, downloads.Count);
        WorkProgress.Value = 0;

        int current = 0;
        string? alternateDownloadFolder = null;
        bool stopRemainingDownloads = false;

        foreach (VideoEpisode video in downloads)
        {
            cancellationToken.ThrowIfCancellationRequested();
            current++;
            video.Status = EpisodeSearchStatus.Downloading;
            StatusText.Text = $"Downloading {video.EpisodeCode}...";
            SummaryText.Text = $"{current} of {downloads.Count}";

            string destination = BuildSubtitleDestination(
                video,
                settings.SubtitleLanguage,
                alternateDownloadFolder);

            while (true)
            {
                App.Services.Logger.Info($"Saving subtitle for {video.FileName} to: {destination}");

                string destinationDirectory = Path.GetDirectoryName(destination)
                    ?? throw new InvalidOperationException("The subtitle destination folder could not be determined.");
                bool destinationDirectoryExistedBeforeAttempt = Directory.Exists(destinationDirectory);

                try
                {
                    await DownloadWithFallbackAsync(video, destination, cancellationToken);
                    VerifySavedSubtitle(destination);

                    video.Status = EpisodeSearchStatus.Downloaded;
                    video.Message = destination;

                    FileInfo savedFile = new(destination);
                    App.Services.Logger.Info(
                        $"Verified subtitle for {video.FileName}: {destination} ({savedFile.Length} bytes)");
                    break;
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (Exception ex) when (IsAccessDenied(ex))
                {
                    App.Services.Logger.Error(
                        $"Access denied while saving {video.FileName} to {destination}.",
                        ex);

                    if (alternateDownloadFolder is null)
                    {
                        TryCleanupBlockedSubtitleDirectory(
                            destination,
                            destinationDirectoryExistedBeforeAttempt);
                    }

                    string? selectedFolder = PromptForWritableSubtitleFolder(
                        destination,
                        ex,
                        session.Show.Name);
                    if (string.IsNullOrWhiteSpace(selectedFolder))
                    {
                        video.Status = EpisodeSearchStatus.Failed;
                        video.Message =
                            $"Access was denied for '{destination}'. No alternative download folder was selected.";
                        stopRemainingDownloads = true;
                        break;
                    }

                    alternateDownloadFolder = selectedFolder;
                    destination = BuildSubtitleDestination(
                        video,
                        settings.SubtitleLanguage,
                        alternateDownloadFolder);

                    StatusText.Text = $"Downloading {video.EpisodeCode} to the selected folder...";
                    SummaryText.Text = alternateDownloadFolder;
                }
                catch (Exception ex)
                {
                    video.Status = EpisodeSearchStatus.Failed;
                    video.Message = ex.Message;
                    App.Services.Logger.Error($"Download failed for {video.FileName}.", ex);
                    break;
                }
            }

            WorkProgress.Value = current;

            if (stopRemainingDownloads)
                break;
        }

        if (stopRemainingDownloads)
        {
            foreach (VideoEpisode video in downloads.Where(item => item.Status == EpisodeSearchStatus.Found))
            {
                video.Status = EpisodeSearchStatus.Failed;
                video.Message =
                    "The download was not attempted because no writable alternative folder was selected.";
            }
        }

        ShowSearchSummary(session, downloaded: true);
    }

    private static string BuildSubtitleDestination(
        VideoEpisode video,
        string languageCode,
        string? alternateDownloadFolder)
    {
        string outputDirectory = string.IsNullOrWhiteSpace(alternateDownloadFolder)
            ? video.OutputDirectory
            : alternateDownloadFolder;

        return Path.GetFullPath(Path.Combine(
            outputDirectory,
            $"{video.BaseName}.{languageCode}.srt"));
    }

    private static void VerifySavedSubtitle(string destination)
    {
        FileInfo savedFile = new(destination);
        savedFile.Refresh();

        if (!savedFile.Exists || savedFile.Length == 0)
        {
            throw new IOException(
                $"QuickSub finished the download but could not verify the saved file: {destination}");
        }
    }

    private string? PromptForWritableSubtitleFolder(
        string blockedDestination,
        Exception exception,
        string seriesName)
    {
        string blockedDirectory = Path.GetDirectoryName(blockedDestination) ?? blockedDestination;

        MessageBox.Show(
            this,
            "QuickSub cannot write subtitle files to the original folder.\n\n" +
            $"Folder:\n{blockedDirectory}\n\n" +
            $"Reason:\n{exception.Message}\n\n" +
            "Select another folder. QuickSub will save the remaining subtitles inside:\n" +
            "Subtitles\\<series name>",
            "Choose another subtitle folder",
            MessageBoxButton.OK,
            MessageBoxImage.Warning);

        string initialDirectory = Directory.Exists(_selectedFolder)
            ? _selectedFolder!
            : Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);

        while (true)
        {
            var dialog = new OpenFolderDialog
            {
                Title = "Select the parent folder for downloaded subtitles",
                InitialDirectory = initialDirectory,
                Multiselect = false
            };

            if (dialog.ShowDialog(this) != true)
                return null;

            string selectedRoot = Path.GetFullPath(dialog.FolderName);
            string selectedSubtitleDirectory = BuildAlternateSubtitleDirectory(
                selectedRoot,
                seriesName);

            if (CanWriteToDirectory(selectedSubtitleDirectory, out string? writeError))
            {
                App.Services.Logger.Info(
                    $"The user selected an alternative subtitle folder: {selectedSubtitleDirectory}");
                return selectedSubtitleDirectory;
            }

            MessageBox.Show(
                this,
                "QuickSub cannot write to the selected destination.\n\n" +
                $"{selectedSubtitleDirectory}\n\n" +
                $"{writeError}\n\n" +
                "Select a different parent folder.",
                "Folder is not writable",
                MessageBoxButton.OK,
                MessageBoxImage.Warning);

            initialDirectory = selectedRoot;
        }
    }

    private static string BuildAlternateSubtitleDirectory(
        string selectedRoot,
        string seriesName)
    {
        string safeSeriesName = SanitizeDirectoryName(seriesName);
        return Path.GetFullPath(Path.Combine(
            selectedRoot,
            "Subtitles",
            safeSeriesName));
    }

    private static string SanitizeDirectoryName(string value)
    {
        char[] invalidCharacters = Path.GetInvalidFileNameChars();
        string sanitized = new(value
            .Select(character => invalidCharacters.Contains(character) ? '_' : character)
            .ToArray());

        sanitized = sanitized.Trim().TrimEnd('.', ' ');
        if (string.IsNullOrWhiteSpace(sanitized))
            sanitized = "Series";

        string[] reservedNames =
        [
            "CON", "PRN", "AUX", "NUL",
            "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
            "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
        ];

        if (reservedNames.Contains(sanitized, StringComparer.OrdinalIgnoreCase))
            sanitized = "_" + sanitized;

        const int maximumLength = 100;
        if (sanitized.Length > maximumLength)
            sanitized = sanitized[..maximumLength].TrimEnd('.', ' ');

        return sanitized;
    }

    private static void TryCleanupBlockedSubtitleDirectory(
        string blockedDestination,
        bool directoryExistedBeforeAttempt)
    {
        if (directoryExistedBeforeAttempt)
            return;

        string? blockedDirectory = Path.GetDirectoryName(blockedDestination);
        if (string.IsNullOrWhiteSpace(blockedDirectory) ||
            !Path.GetFileName(blockedDirectory).Equals(
                "Subtitles",
                StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        try
        {
            if (File.Exists(blockedDestination))
            {
                try
                {
                    File.Delete(blockedDestination);
                }
                catch (Exception fileCleanupException)
                {
                    App.Services.Logger.Warning(
                        $"QuickSub could not remove the incomplete subtitle file '{blockedDestination}': " +
                        fileCleanupException.Message);
                }
            }

            if (Directory.Exists(blockedDirectory) &&
                !Directory.EnumerateFileSystemEntries(blockedDirectory).Any())
            {
                Directory.Delete(blockedDirectory);
                App.Services.Logger.Info(
                    $"Removed the empty subtitle folder created during the failed save: {blockedDirectory}");
            }
        }
        catch (Exception cleanupException)
        {
            App.Services.Logger.Warning(
                $"QuickSub could not remove the empty blocked subtitle folder '{blockedDirectory}': " +
                cleanupException.Message);
        }
    }

    private static bool CanWriteToDirectory(string folder, out string? error)
    {
        string? testFile = null;

        try
        {
            Directory.CreateDirectory(folder);
            testFile = Path.Combine(folder, $".quicksub-write-test-{Guid.NewGuid():N}.tmp");

            using (FileStream stream = new(
                       testFile,
                       FileMode.CreateNew,
                       FileAccess.Write,
                       FileShare.None,
                       1,
                       FileOptions.DeleteOnClose))
            {
                stream.WriteByte(0);
                stream.Flush(flushToDisk: true);
            }

            if (File.Exists(testFile))
                File.Delete(testFile);

            error = null;
            return true;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            return false;
        }
        finally
        {
            if (!string.IsNullOrWhiteSpace(testFile))
            {
                try
                {
                    if (File.Exists(testFile))
                        File.Delete(testFile);
                }
                catch
                {
                    // A failed test-file cleanup does not change the write-access result.
                }
            }
        }
    }

    private static bool IsAccessDenied(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            if (current is UnauthorizedAccessException)
                return true;

            if (current.HResult == unchecked((int)0x80070005))
                return true;

            if (current is IOException &&
                current.Message.Contains("access", StringComparison.OrdinalIgnoreCase) &&
                current.Message.Contains("denied", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }


    private static async Task DownloadWithFallbackAsync(
        VideoEpisode video,
        string destination,
        CancellationToken cancellationToken)
    {
        List<SubtitleCandidate> candidates = new[] { video.SelectedCandidate! }
            .Concat(video.Candidates)
            .DistinctBy(candidate => candidate.FileId)
            .Take(3)
            .ToList();

        Exception? lastError = null;
        foreach (SubtitleCandidate candidate in candidates)
        {
            try
            {
                await App.Services.OpenSubtitles.DownloadAsync(
                    candidate,
                    destination,
                    App.Services.SubtitleConverter,
                    cancellationToken);

                FileInfo savedFile = new(destination);
                savedFile.Refresh();
                if (!savedFile.Exists || savedFile.Length == 0)
                    throw new IOException($"The subtitle was not saved correctly: {destination}");

                video.SelectedCandidate = candidate;
                return;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (OpenSubtitlesApiException ex) when (
                ex.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.NotFound or HttpStatusCode.Gone)
            {
                lastError = ex;
                App.Services.Logger.Warning(
                    $"Subtitle candidate {candidate.FileId} could not be downloaded for {video.FileName}. Trying another candidate.");
            }
            catch (InvalidOperationException ex)
            {
                lastError = ex;
                App.Services.Logger.Warning(
                    $"Subtitle candidate {candidate.FileId} could not be converted for {video.FileName}. Trying another candidate.");
            }
            catch (IOException ex)
            {
                lastError = ex;
                App.Services.Logger.Warning(
                    $"Subtitle candidate {candidate.FileId} could not be saved for {video.FileName}. Trying another candidate.");
            }
        }

        throw lastError ?? new InvalidOperationException("No usable subtitle candidate could be downloaded.");
    }

    private void ShowSearchSummary(SearchSessionResult session, bool downloaded)
    {
        int total = session.VideoEpisodes.Count;
        int downloadedCount = session.VideoEpisodes.Count(item => item.Status == EpisodeSearchStatus.Downloaded);
        int existingCount = session.VideoEpisodes.Count(item => item.Status == EpisodeSearchStatus.Existing);
        int missingCount = session.VideoEpisodes.Count(item =>
            item.Status is EpisodeSearchStatus.Missing or EpisodeSearchStatus.Failed);

        if (downloadedCount + existingCount == total && missingCount == 0)
        {
            StatusText.Text = downloadedCount > 0
                ? "All subtitle files were saved successfully."
                : "All subtitle files already existed.";
            SummaryText.Text = $"{downloadedCount} saved, {existingCount} already existed, {total} total.";
        }
        else if (downloadedCount > 0)
        {
            StatusText.Text = "Some subtitle files were saved.";
            SummaryText.Text = $"{downloadedCount} saved, {existingCount} already existed, {missingCount} missing or failed.";
        }
        else if (downloaded)
        {
            StatusText.Text = "No subtitle files were saved.";

            string? firstError = session.VideoEpisodes
                .Where(item => item.Status == EpisodeSearchStatus.Failed)
                .Select(item => item.Message)
                .FirstOrDefault(message => !string.IsNullOrWhiteSpace(message));

            SummaryText.Text = string.IsNullOrWhiteSpace(firstError)
                ? $"{existingCount} already existed, {missingCount} missing or failed. Open details for the error."
                : $"{existingCount} already existed, {missingCount} missing or failed. First error: {ShortenForSummary(firstError, 180)}";
        }
        else
        {
            StatusText.Text = "Not all subtitles were found.";
            SummaryText.Text = $"{existingCount} already existed, {missingCount} missing.";
        }

        WorkProgress.IsIndeterminate = false;
        WorkProgress.Maximum = 100;
        WorkProgress.Value = 100;
    }

    private static string ShortenForSummary(string value, int maximumLength)
    {
        string singleLine = string.Join(
            " ",
            value.Split(
                ['\r', '\n'],
                StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));

        return singleLine.Length <= maximumLength
            ? singleLine
            : singleLine[..maximumLength].TrimEnd() + "...";
    }

    private void SettingsButton_Click(object sender, RoutedEventArgs e)
    {
        if (!_isBusy)
            OpenSettings(firstRun: false);
    }

    private bool OpenSettings(bool firstRun)
    {
        var window = new SettingsWindow(firstRun) { Owner = this };
        bool saved = window.ShowDialog() == true;
        if (saved && _selectedFolder is not null)
        {
            if (!Directory.Exists(_selectedFolder))
            {
                ResetMissingSelectedFolder();
                return true;
            }

            try
            {
                FolderScanResult scan = App.Services.Scanner.Scan(
                    _selectedFolder,
                    App.Services.Settings.Current.SubtitleLanguage);
                _canScan = scan.Episodes.Count > 0;
                ScanButton.IsEnabled = !_isBusy && _canScan;
                SummaryText.Text = $"{scan.Episodes.Count} video files detected.";
            }
            catch (DirectoryNotFoundException)
            {
                ResetMissingSelectedFolder();
            }
        }
        return saved;
    }

    private void ResetMissingSelectedFolder()
    {
        if (!string.IsNullOrWhiteSpace(_selectedFolder))
            App.Services.Logger.Warning($"The selected folder no longer exists: {_selectedFolder}");

        _selectedFolder = null;
        _selectedShow = null;
        _candidateShows = [];
        _lastResult = null;
        _canScan = false;

        PosterImage.Source = null;
        PosterImage.Visibility = Visibility.Collapsed;
        DropPlaceholder.Visibility = Visibility.Visible;
        ShowNameText.Text = string.Empty;
        ShowDetailsText.Text = string.Empty;
        FolderPathText.Text = string.Empty;
        ChangeSeriesButton.Visibility = Visibility.Collapsed;
        ScanButton.IsEnabled = false;
        ResetResultButtons();

        StatusText.Text = "The previously selected folder no longer exists.";
        SummaryText.Text = "Drag the series folder into QuickSub again.";
    }

    private void CancelButton_Click(object sender, RoutedEventArgs e) => _operationCancellation?.Cancel();

    private void ViewDetailsButton_Click(object sender, RoutedEventArgs e)
    {
        if (_lastResult is null)
            return;

        var window = new MissingItemsWindow(_lastResult) { Owner = this };
        window.ShowDialog();
    }

    private void OpenFolderButton_Click(object sender, RoutedEventArgs e)
    {
        string? subtitlePath = _lastResult?.VideoEpisodes
            .Where(item => item.Status == EpisodeSearchStatus.Downloaded)
            .Select(item => item.Message)
            .FirstOrDefault(path => !string.IsNullOrWhiteSpace(path) && File.Exists(path));

        subtitlePath ??= _lastResult?.VideoEpisodes
            .Where(item => item.Status == EpisodeSearchStatus.Existing)
            .Select(item => item.ExistingSubtitlePath)
            .FirstOrDefault(path => !string.IsNullOrWhiteSpace(path) && File.Exists(path));

        if (!string.IsNullOrWhiteSpace(subtitlePath) && File.Exists(subtitlePath))
        {
            Process.Start(new ProcessStartInfo(
                "explorer.exe",
                $"/select,\"{subtitlePath}\"")
            {
                UseShellExecute = true
            });
            return;
        }

        if (_selectedFolder is null || !Directory.Exists(_selectedFolder))
        {
            ResetMissingSelectedFolder();
            return;
        }

        Process.Start(new ProcessStartInfo("explorer.exe", $"\"{_selectedFolder}\"")
        {
            UseShellExecute = true
        });
    }

    private void SetBusy(bool busy, string? status = null)
    {
        _isBusy = busy;
        SettingsButton.IsEnabled = !busy;
        ScanButton.IsEnabled = !busy && _canScan && _selectedFolder is not null && _selectedShow is not null;
        ChangeSeriesButton.IsEnabled = !busy;
        CancelButton.Visibility = busy ? Visibility.Visible : Visibility.Collapsed;
        WorkProgress.IsIndeterminate = busy;

        if (!string.IsNullOrWhiteSpace(status))
            StatusText.Text = status;
    }

    private void ResetResultButtons()
    {
        ViewDetailsButton.Visibility = Visibility.Collapsed;
        OpenFolderButton.Visibility = Visibility.Collapsed;
    }

    private void UpdateResultButtons()
    {
        if (_lastResult is null)
            return;

        bool hasDetails = _lastResult.MissingSubtitleCount > 0 ||
                          _lastResult.MissingFromDisk.Count > 0 ||
                          _lastResult.NotAiredYet.Count > 0 ||
                          _lastResult.UnrecognizedFiles.Count > 0 ||
                          _lastResult.VideoEpisodes.Any(item => item.Status == EpisodeSearchStatus.Failed);

        ViewDetailsButton.Visibility = hasDetails ? Visibility.Visible : Visibility.Collapsed;
        OpenFolderButton.Visibility = Visibility.Visible;
    }

    private void Window_Closing(object? sender, CancelEventArgs e)
    {
        _operationCancellation?.Cancel();
    }
}
