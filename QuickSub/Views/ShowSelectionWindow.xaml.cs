using System.Windows;
using System.Windows.Controls;
using QuickSub.Models;

namespace QuickSub.Views;

public partial class ShowSelectionWindow : Window
{
    public ShowSelectionWindow(IReadOnlyList<TvShow> shows)
    {
        InitializeComponent();
        ShowsItemsControl.ItemsSource = shows;
    }

    public TvShow? SelectedShow { get; private set; }

    private void ShowButton_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button { Tag: TvShow show })
        {
            SelectedShow = show;
            DialogResult = true;
        }
    }

    private void Cancel_Click(object sender, RoutedEventArgs e) => DialogResult = false;
}
