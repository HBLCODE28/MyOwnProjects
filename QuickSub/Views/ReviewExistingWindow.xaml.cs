using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows;
using QuickSub.Models;

namespace QuickSub.Views;

public partial class ReviewExistingWindow : Window
{
    public ReviewExistingWindow(IReadOnlyList<VideoEpisode> videos)
    {
        InitializeComponent();
        Choices = videos.Select(video => new ExistingSubtitleChoice(video)).ToList();
        DataContext = Choices;
    }

    public List<ExistingSubtitleChoice> Choices { get; }

    private void Continue_Click(object sender, RoutedEventArgs e)
    {
        foreach (ExistingSubtitleChoice choice in Choices)
            choice.Video.ReplaceExisting = choice.Replace;
        DialogResult = true;
    }

    private void Cancel_Click(object sender, RoutedEventArgs e) => DialogResult = false;
}

public sealed class ExistingSubtitleChoice : INotifyPropertyChanged
{
    private bool _replace;

    public ExistingSubtitleChoice(VideoEpisode video)
    {
        Video = video;
    }

    public VideoEpisode Video { get; }

    public bool Replace
    {
        get => _replace;
        set
        {
            if (_replace == value)
                return;
            _replace = value;
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Replace)));
        }
    }

    public event PropertyChangedEventHandler? PropertyChanged;
}
