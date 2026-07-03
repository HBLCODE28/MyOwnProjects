using System.Windows;
using QuickSub.Models;

namespace QuickSub.Views;

public partial class AlternativesWindow : Window
{
    private readonly VideoEpisode _episode;

    public AlternativesWindow(VideoEpisode episode)
    {
        InitializeComponent();
        _episode = episode;
        EpisodeText.Text = $"{episode.EpisodeCode} - {episode.FileName}";
        AlternativesListBox.ItemsSource = episode.Candidates;
        AlternativesListBox.SelectedItem = episode.SelectedCandidate ?? episode.Candidates.FirstOrDefault();
    }

    private void UseSelected_Click(object sender, RoutedEventArgs e)
    {
        if (AlternativesListBox.SelectedItem is not SubtitleCandidate candidate)
        {
            MessageBox.Show(this, "Select a subtitle.", "QuickSub", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        _episode.SelectedCandidate = candidate;
        _episode.Status = EpisodeSearchStatus.Found;
        DialogResult = true;
    }

    private void Cancel_Click(object sender, RoutedEventArgs e) => DialogResult = false;
}
