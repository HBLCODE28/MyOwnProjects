using System.Windows;

namespace QuickSub.Views;

public enum PartialResultAction
{
    Cancel,
    Review,
    Download
}

public partial class PartialResultsWindow : Window
{
    public PartialResultsWindow(int found, int total)
    {
        InitializeComponent();
        ResultText.Text = $"Subtitles found: {found} of {total}\nMissing: {total - found}";
    }

    public PartialResultAction Action { get; private set; } = PartialResultAction.Cancel;

    private void Cancel_Click(object sender, RoutedEventArgs e)
    {
        Action = PartialResultAction.Cancel;
        DialogResult = true;
    }

    private void Review_Click(object sender, RoutedEventArgs e)
    {
        Action = PartialResultAction.Review;
        DialogResult = true;
    }

    private void Download_Click(object sender, RoutedEventArgs e)
    {
        Action = PartialResultAction.Download;
        DialogResult = true;
    }
}
