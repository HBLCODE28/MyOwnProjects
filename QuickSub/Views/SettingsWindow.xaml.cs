using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using QuickSub.Models;

namespace QuickSub.Views;

public partial class SettingsWindow : Window
{
    private readonly bool _passwordIsLocked;
    private readonly bool _apiKeyExists;

    public SettingsWindow(bool firstRun)
    {
        InitializeComponent();
        IsFirstRun = firstRun;

        AppSettings settings = App.Services.Settings.Current;
        _passwordIsLocked = !string.IsNullOrWhiteSpace(settings.EncryptedPassword);
        _apiKeyExists = !string.IsNullOrWhiteSpace(App.Services.Settings.GetSavedApiKey());

        UsernameTextBox.Text = settings.OpenSubtitlesUsername;
        IncludeSpecialsCheckBox.IsChecked = settings.IncludeSpecials;

        if (_passwordIsLocked)
        {
            UsernameTextBox.IsReadOnly = true;
            UsernameHelpText.Text = "The username is locked because it belongs to the saved password.";

            PasswordInput.Password = "SavedSecurely";
            PasswordInput.IsEnabled = false;
            PasswordHelpText.Text = "Saved securely. The password cannot be viewed, copied, or changed in Settings.";
        }
        else
        {
            UsernameHelpText.Text = "Enter the username for the OpenSubtitles account.";
            PasswordHelpText.Text = "Enter the password once. After it is saved, it will be locked and hidden.";
        }

        ApiKeyHelpText.Text = _apiKeyExists
            ? "An API key is saved securely. Leave this field empty to keep it, or paste a new API key to replace it. The saved key cannot be displayed or copied."
            : "Paste the API key here. It will be encrypted and will not be displayed again.";

        SelectByTag(LanguageComboBox, settings.SubtitleLanguage);
        SelectByTag(ThemeComboBox, settings.Theme.ToString());
        SelectByTag(HearingComboBox, settings.HearingImpairedPreference.ToString());

        if (LanguageComboBox.SelectedIndex < 0)
            LanguageComboBox.SelectedIndex = 0;
        if (ThemeComboBox.SelectedIndex < 0)
            ThemeComboBox.SelectedIndex = 0;
        if (HearingComboBox.SelectedIndex < 0)
            HearingComboBox.SelectedIndex = 2;

        if (firstRun)
        {
            ConnectionStatusText.Text =
                "Create an OpenSubtitles.com account and an API key, then enter them here. " +
                "QuickSub cannot download subtitles without these credentials.";
        }
    }

    public bool IsFirstRun { get; }

    private async void TestConnection_Click(object sender, RoutedEventArgs e)
    {
        string username = UsernameTextBox.Text.Trim();
        string password = _passwordIsLocked
            ? App.Services.Settings.GetSavedPassword()
            : PasswordInput.Password;
        string apiKey = !string.IsNullOrWhiteSpace(ApiKeyInput.Password)
            ? ApiKeyInput.Password.Trim()
            : App.Services.Settings.GetSavedApiKey();

        if (string.IsNullOrWhiteSpace(username) ||
            string.IsNullOrWhiteSpace(password) ||
            string.IsNullOrWhiteSpace(apiKey))
        {
            ConnectionStatusText.Text = "Username, password, and API key are required for the connection test.";
            return;
        }

        TestConnectionButton.IsEnabled = false;
        ConnectionStatusText.Text = "Testing connection...";

        try
        {
            OpenSubtitlesLoginResponse login = await App.Services.OpenSubtitles.LoginAsync(
                username,
                password,
                apiKey,
                CancellationToken.None);

            int allowedDownloads = login.User?.AllowedDownloads ?? 0;
            ConnectionStatusText.Text =
                $"Connection successful. Account level: {login.User?.Level ?? "unknown"}. " +
                $"Account download allowance: {allowedDownloads}. " +
                "This test verifies login only. Download quota and file-download errors are checked during an actual subtitle download.";
        }
        catch (Exception ex)
        {
            App.Services.Logger.Error("OpenSubtitles connection test failed.", ex);
            ConnectionStatusText.Text = $"Connection failed: {ex.Message}";
        }
        finally
        {
            TestConnectionButton.IsEnabled = true;
        }
    }

    private void Save_Click(object sender, RoutedEventArgs e)
    {
        string username = UsernameTextBox.Text.Trim();
        string replacementApiKey = ApiKeyInput.Password.Trim();
        string initialPassword = _passwordIsLocked ? string.Empty : PasswordInput.Password;

        if (string.IsNullOrWhiteSpace(username))
        {
            MessageBox.Show(
                this,
                "OpenSubtitles username is required.",
                "QuickSub",
                MessageBoxButton.OK,
                MessageBoxImage.Warning);
            return;
        }

        if (!_passwordIsLocked && string.IsNullOrWhiteSpace(initialPassword))
        {
            MessageBox.Show(
                this,
                "OpenSubtitles password is required during initial setup.",
                "QuickSub",
                MessageBoxButton.OK,
                MessageBoxImage.Warning);
            return;
        }

        if (!_apiKeyExists && string.IsNullOrWhiteSpace(replacementApiKey))
        {
            MessageBox.Show(
                this,
                "OpenSubtitles API key is required.",
                "QuickSub",
                MessageBoxButton.OK,
                MessageBoxImage.Warning);
            return;
        }

        var settings = new AppSettings
        {
            OpenSubtitlesUsername = username,
            OpenSubtitlesApiKey = App.Services.Settings.Current.OpenSubtitlesApiKey,
            EncryptedApiKey = App.Services.Settings.Current.EncryptedApiKey,
            RememberPassword = true,
            EncryptedPassword = App.Services.Settings.Current.EncryptedPassword,
            SubtitleLanguage = GetSelectedTag(LanguageComboBox, "en"),
            Theme = Enum.TryParse(GetSelectedTag(ThemeComboBox, "Dark"), out AppTheme theme)
                ? theme
                : AppTheme.Dark,
            IncludeSpecials = IncludeSpecialsCheckBox.IsChecked == true,
            HearingImpairedPreference = Enum.TryParse(
                GetSelectedTag(HearingComboBox, "AllowIfNeeded"),
                out HearingImpairedPreference preference)
                ? preference
                : HearingImpairedPreference.AllowIfNeeded,
            MaxConcurrentSearches = 2
        };

        try
        {
            App.Services.Settings.Save(settings, initialPassword, replacementApiKey);
            App.Services.Theme.Apply(settings.Theme);
            DialogResult = true;
        }
        catch (Exception ex)
        {
            App.Services.Logger.Error("Could not save Settings.", ex);
            MessageBox.Show(
                this,
                ex.Message,
                "QuickSub",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
    }

    private void Cancel_Click(object sender, RoutedEventArgs e) => DialogResult = false;

    private void CreateAccount_Click(object sender, RoutedEventArgs e) =>
        OpenUrl(
            "https://www.opensubtitles.com/en/users/sign_up",
            "OpenSubtitles registration page");

    private void OpenApiKeyPage_Click(object sender, RoutedEventArgs e) =>
        OpenUrl(
            "https://www.opensubtitles.com/en/consumers",
            "OpenSubtitles API key page");

    private void OpenUrl(string url, string pageName)
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = url,
                UseShellExecute = true,
                Verb = "open",
                ErrorDialog = true
            });
            return;
        }
        catch (Exception firstException)
        {
            App.Services.Logger.Warning(
                $"The default browser could not open {pageName}: {firstException.Message}");
        }

        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "explorer.exe",
                Arguments = $"\"{url}\"",
                UseShellExecute = true
            });
            return;
        }
        catch (Exception secondException)
        {
            App.Services.Logger.Error($"Could not open {pageName}.", secondException);
        }

        try
        {
            Clipboard.SetText(url);
        }
        catch
        {
            // Clipboard access can fail when it is temporarily locked by another process.
        }

        MessageBox.Show(
            this,
            $"QuickSub could not open the browser. The address was copied to the clipboard when possible.\n\n{url}",
            "QuickSub",
            MessageBoxButton.OK,
            MessageBoxImage.Information);
    }

    private static void SelectByTag(ComboBox comboBox, string value)
    {
        foreach (object item in comboBox.Items)
        {
            if (item is ComboBoxItem comboItem &&
                string.Equals(comboItem.Tag?.ToString(), value, StringComparison.OrdinalIgnoreCase))
            {
                comboBox.SelectedItem = comboItem;
                return;
            }
        }
    }

    private static string GetSelectedTag(ComboBox comboBox, string fallback) =>
        (comboBox.SelectedItem as ComboBoxItem)?.Tag?.ToString() ?? fallback;
}
