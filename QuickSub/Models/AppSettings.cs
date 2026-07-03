namespace QuickSub.Models;

public sealed class AppSettings
{
    public string OpenSubtitlesUsername { get; set; } = string.Empty;

    // Kept only for migration from QuickSub 1.0.2 and earlier.
    // New saves store the API key only in EncryptedApiKey.
    public string OpenSubtitlesApiKey { get; set; } = string.Empty;

    public string EncryptedApiKey { get; set; } = string.Empty;

    // Kept for backward compatibility. QuickSub now always stores the password
    // encrypted for the current Windows user.
    public bool RememberPassword { get; set; } = true;
    public string EncryptedPassword { get; set; } = string.Empty;

    public string SubtitleLanguage { get; set; } = "en";
    public AppTheme Theme { get; set; } = AppTheme.Dark;
    public bool IncludeSpecials { get; set; }
    public HearingImpairedPreference HearingImpairedPreference { get; set; } = HearingImpairedPreference.AllowIfNeeded;
    public int MaxConcurrentSearches { get; set; } = 2;

    public bool HasRequiredCredentials =>
        !string.IsNullOrWhiteSpace(OpenSubtitlesUsername) &&
        (!string.IsNullOrWhiteSpace(EncryptedApiKey) ||
         !string.IsNullOrWhiteSpace(OpenSubtitlesApiKey)) &&
        !string.IsNullOrWhiteSpace(EncryptedPassword);
}

public enum AppTheme
{
    Dark,
    Light
}

public enum HearingImpairedPreference
{
    PreferStandard,
    NoPreference,
    AllowIfNeeded
}
