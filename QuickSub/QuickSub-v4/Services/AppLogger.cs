using System.Text;

namespace QuickSub.Services;

public sealed class AppLogger
{
    private readonly object _sync = new();
    private readonly string _logDirectory;
    private readonly string _logPath;

    public AppLogger()
    {
        _logDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "QuickSub",
            "Logs");

        Directory.CreateDirectory(_logDirectory);
        _logPath = Path.Combine(_logDirectory, $"QuickSub-{DateTime.Now:yyyy-MM-dd}.log");
        DeleteOldLogs();
    }

    public string LogPath => _logPath;

    public void Info(string message) => Write("INFO", message, null);
    public void Warning(string message) => Write("WARN", message, null);
    public void Error(string message, Exception? exception = null) => Write("ERROR", message, exception);

    private void Write(string level, string message, Exception? exception)
    {
        try
        {
            var builder = new StringBuilder()
                .Append(DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff"))
                .Append(" [")
                .Append(level)
                .Append("] ")
                .AppendLine(message);

            if (exception is not null)
                builder.AppendLine(exception.ToString());

            lock (_sync)
            {
                File.AppendAllText(_logPath, builder.ToString(), Encoding.UTF8);
            }
        }
        catch
        {
            // Logging must never crash the application.
        }
    }

    private void DeleteOldLogs()
    {
        try
        {
            DateTime cutoff = DateTime.Now.AddDays(-14);
            foreach (string file in Directory.EnumerateFiles(_logDirectory, "QuickSub-*.log"))
            {
                if (File.GetLastWriteTime(file) < cutoff)
                    File.Delete(file);
            }
        }
        catch
        {
            // Ignore log cleanup failures.
        }
    }
}
