using System.Windows;
using QuickSub.Services;
using QuickSub.Views;

namespace QuickSub;

public partial class App : Application
{
    public static AppServices Services { get; private set; } = null!;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        Services = new AppServices();
        Services.Theme.Apply(Services.Settings.Current.Theme);

        DispatcherUnhandledException += (_, args) =>
        {
            Services.Logger.Error("Unhandled UI exception", args.Exception);
            MessageBox.Show(
                "QuickSub encountered an unexpected error. Details were written to the log file.",
                "QuickSub",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
            args.Handled = true;
        };

        var mainWindow = new MainWindow();
        MainWindow = mainWindow;
        mainWindow.Show();
    }
}
