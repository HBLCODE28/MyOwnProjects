using System.Windows;
using QuickSub.Models;

namespace QuickSub.Views;

public partial class MissingItemsWindow : Window
{
    public MissingItemsWindow(SearchSessionResult result)
    {
        InitializeComponent();

        MissingSubtitlesList.ItemsSource = result.VideoEpisodes
            .Where(item => item.Status is EpisodeSearchStatus.Missing or EpisodeSearchStatus.Failed)
            .Select(item => $"{item.EpisodeCode} - {item.FileName}")
            .ToList();

        MissingVideosList.ItemsSource = result.MissingFromDisk
            .Select(item => item.Display)
            .ToList();

        FutureEpisodesList.ItemsSource = result.NotAiredYet
            .Select(item => item.Display)
            .ToList();

        SkippedFilesList.ItemsSource = result.UnrecognizedFiles
            .Select(item => item.FileName)
            .ToList();
    }

    private void Close_Click(object sender, RoutedEventArgs e) => Close();
}
