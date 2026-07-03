using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using QuickSub.Models;

namespace QuickSub.Services;

public sealed class SettingsService
{
    private readonly AppLogger _logger;
    private readonly string _settingsDirectory;
    private readonly string _settingsPath;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true
    };

    public SettingsService(AppLogger logger)
    {
        _logger = logger;
        _settingsDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "QuickSub");
        _settingsPath = Path.Combine(_settingsDirectory, "settings.json");
        Current = Load();
    }

    public AppSettings Current { get; private set; }
    public bool IsFirstRun => !File.Exists(_settingsPath) || !Current.HasRequiredCredentials;

    public void Save(AppSettings settings, string? initialPassword, string? replacementApiKey)
    {
        Directory.CreateDirectory(_settingsDirectory);

        // Once a password has been stored, Settings cannot replace it.
        if (!string.IsNullOrWhiteSpace(Current.EncryptedPassword))
        {
            settings.EncryptedPassword = Current.EncryptedPassword;
        }
        else
        {
            if (string.IsNullOrWhiteSpace(initialPassword))
                throw new InvalidOperationException("An OpenSubtitles password is required during initial setup.");

            settings.EncryptedPassword = WindowsDataProtection.Protect(
                initialPassword,
                "QuickSub OpenSubtitles password");
        }

        settings.RememberPassword = true;

        string apiKeyToStore = !string.IsNullOrWhiteSpace(replacementApiKey)
            ? replacementApiKey.Trim()
            : GetSavedApiKey();

        if (string.IsNullOrWhiteSpace(apiKeyToStore))
            throw new InvalidOperationException("An OpenSubtitles API key is required.");

        settings.EncryptedApiKey = WindowsDataProtection.Protect(
            apiKeyToStore,
            "QuickSub OpenSubtitles API key");

        // Remove the legacy plaintext value whenever settings are saved.
        settings.OpenSubtitlesApiKey = string.Empty;

        string json = JsonSerializer.Serialize(settings, JsonOptions);
        File.WriteAllText(_settingsPath, json, Encoding.UTF8);
        Current = settings;
        _logger.Info("Settings saved.");
    }

    public string GetSavedPassword()
    {
        if (string.IsNullOrWhiteSpace(Current.EncryptedPassword))
            return string.Empty;

        try
        {
            return WindowsDataProtection.Unprotect(Current.EncryptedPassword);
        }
        catch (Exception ex)
        {
            _logger.Error("Could not decrypt the saved OpenSubtitles password.", ex);
            return string.Empty;
        }
    }

    public string GetSavedApiKey()
    {
        try
        {
            if (!string.IsNullOrWhiteSpace(Current.EncryptedApiKey))
                return WindowsDataProtection.Unprotect(Current.EncryptedApiKey);

            // Migration support for QuickSub 1.0.2 and earlier.
            return Current.OpenSubtitlesApiKey?.Trim() ?? string.Empty;
        }
        catch (Exception ex)
        {
            _logger.Error("Could not decrypt the saved OpenSubtitles API key.", ex);
            return string.Empty;
        }
    }

    private AppSettings Load()
    {
        try
        {
            if (!File.Exists(_settingsPath))
                return new AppSettings();

            string json = File.ReadAllText(_settingsPath, Encoding.UTF8);
            return JsonSerializer.Deserialize<AppSettings>(json, JsonOptions) ?? new AppSettings();
        }
        catch (Exception ex)
        {
            _logger.Error("Could not load settings. Default settings will be used.", ex);
            return new AppSettings();
        }
    }
}

internal static class WindowsDataProtection
{
    private const int CryptProtectUiForbidden = 0x1;

    public static string Protect(string plainText, string description)
    {
        byte[] bytes = Encoding.UTF8.GetBytes(plainText);
        DataBlob input = DataBlob.FromBytes(bytes);
        DataBlob output = default;

        try
        {
            if (!CryptProtectData(
                    ref input,
                    description,
                    IntPtr.Zero,
                    IntPtr.Zero,
                    IntPtr.Zero,
                    CryptProtectUiForbidden,
                    ref output))
            {
                throw new InvalidOperationException(
                    $"Windows could not encrypt the value. Error: {Marshal.GetLastWin32Error()}");
            }

            return Convert.ToBase64String(output.ToBytes());
        }
        finally
        {
            input.Free();
            output.FreeLocal();
        }
    }

    public static string Unprotect(string encryptedText)
    {
        byte[] encryptedBytes = Convert.FromBase64String(encryptedText);
        DataBlob input = DataBlob.FromBytes(encryptedBytes);
        DataBlob output = default;

        try
        {
            if (!CryptUnprotectData(
                    ref input,
                    IntPtr.Zero,
                    IntPtr.Zero,
                    IntPtr.Zero,
                    IntPtr.Zero,
                    CryptProtectUiForbidden,
                    ref output))
            {
                throw new InvalidOperationException(
                    $"Windows could not decrypt the value. Error: {Marshal.GetLastWin32Error()}");
            }

            return Encoding.UTF8.GetString(output.ToBytes());
        }
        finally
        {
            input.Free();
            output.FreeLocal();
        }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct DataBlob
    {
        public int Length;
        public IntPtr Data;

        public static DataBlob FromBytes(byte[] bytes)
        {
            var blob = new DataBlob
            {
                Length = bytes.Length,
                Data = Marshal.AllocHGlobal(bytes.Length)
            };
            Marshal.Copy(bytes, 0, blob.Data, bytes.Length);
            return blob;
        }

        public byte[] ToBytes()
        {
            if (Length <= 0 || Data == IntPtr.Zero)
                return [];

            byte[] bytes = new byte[Length];
            Marshal.Copy(Data, bytes, 0, Length);
            return bytes;
        }

        public void Free()
        {
            if (Data == IntPtr.Zero)
                return;

            Marshal.FreeHGlobal(Data);
            Data = IntPtr.Zero;
            Length = 0;
        }

        public void FreeLocal()
        {
            if (Data == IntPtr.Zero)
                return;

            LocalFree(Data);
            Data = IntPtr.Zero;
            Length = 0;
        }
    }

    [DllImport("crypt32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CryptProtectData(
        ref DataBlob pDataIn,
        string? szDataDescr,
        IntPtr pOptionalEntropy,
        IntPtr pvReserved,
        IntPtr pPromptStruct,
        int dwFlags,
        ref DataBlob pDataOut);

    [DllImport("crypt32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CryptUnprotectData(
        ref DataBlob pDataIn,
        IntPtr ppszDataDescr,
        IntPtr pOptionalEntropy,
        IntPtr pvReserved,
        IntPtr pPromptStruct,
        int dwFlags,
        ref DataBlob pDataOut);

    [DllImport("kernel32.dll")]
    private static extern IntPtr LocalFree(IntPtr hMem);
}
