using System.Windows;
using QuickSub.Models;

namespace QuickSub.Views;

public partial class ResultsReviewWindow : Window
{
    private readonly IReadOnlyList<VideoEpisode> _videos;

    public ResultsReviewWindow(IReadOnlyList<VideoEpisode> videos)
    {
        InitializeComponent();
        _videos = videos;
        ResultsListBox.ItemsSource = videos;
    }

    public bool DownloadRequested { get; private set; }

    private void ChooseAlternative_Click(object sender, RoutedEventArgs e)
    {
        if (ResultsListBox.SelectedItem is not VideoEpisode episode)
        {
            MessageBox.Show(this, "Select an episode first.", "QuickSub", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        if (episode.Candidates.Count == 0)
        {
            MessageBox.Show(this, "No alternatives were found for this episode.", "QuickSub", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        var window = new AlternativesWindow(episode) { Owner = this };
        window.ShowDialog();
        ResultsListBox.Items.Refresh();
    }

    private void Download_Click(object sender, RoutedEventArgs e)
    {
        DownloadRequested = true;
        DialogResult = true;
    }

    private void Close_Click(object sender, RoutedEventArgs e)
    {
        DownloadRequested = false;
        DialogResult = true;
    }
}
