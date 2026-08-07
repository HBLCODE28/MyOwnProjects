using System.Windows;

namespace QuickSub.Views;

public enum ExistingSubtitleDecision
{
    KeepAll,
    ReplaceAll,
    Review
}

public partial class ExistingSubtitlesWindow : Window
{
    public ExistingSubtitlesWindow(int count)
    {
        InitializeComponent();
        DescriptionText.Text = count == 1
            ? "One existing subtitle was found. Choose how QuickSub should handle it."
            : $"{count} existing subtitles were found. Choose how QuickSub should handle them.";
    }

    public ExistingSubtitleDecision Decision { get; private set; } = ExistingSubtitleDecision.KeepAll;

    private void KeepAll_Click(object sender, RoutedEventArgs e)
    {
        Decision = ExistingSubtitleDecision.KeepAll;
        DialogResult = true;
    }

    private void ReplaceAll_Click(object sender, RoutedEventArgs e)
    {
        Decision = ExistingSubtitleDecision.ReplaceAll;
        DialogResult = true;
    }

    private void Review_Click(object sender, RoutedEventArgs e)
    {
        Decision = ExistingSubtitleDecision.Review;
        DialogResult = true;
    }
}
