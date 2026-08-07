using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace QuickSub.Services;

public sealed partial class SubtitleConverter
{
    private readonly AppLogger _logger;

    public SubtitleConverter(AppLogger logger)
    {
        _logger = logger;
    }

    [GeneratedRegex(@"\{[^}]*\}")]
    private static partial Regex AssTagRegex();

    [GeneratedRegex(@"<[^>]+>")]
    private static partial Regex HtmlTagRegex();

    public static bool IsConvertibleExtension(string extension) =>
        extension.Equals(".srt", StringComparison.OrdinalIgnoreCase) ||
        extension.Equals(".ass", StringComparison.OrdinalIgnoreCase) ||
        extension.Equals(".ssa", StringComparison.OrdinalIgnoreCase) ||
        extension.Equals(".vtt", StringComparison.OrdinalIgnoreCase) ||
        extension.Equals(".download", StringComparison.OrdinalIgnoreCase) ||
        string.IsNullOrWhiteSpace(extension);

    public async Task ConvertToSrtAsync(
        string sourcePath,
        string destinationPath,
        CancellationToken cancellationToken)
    {
        string extension = Path.GetExtension(sourcePath).ToLowerInvariant();
        byte[] bytes = await File.ReadAllBytesAsync(sourcePath, cancellationToken);

        bool hasTextBom = HasUtf8Bom(bytes) || HasUtf16Bom(bytes);
        if (!hasTextBom && LooksBinary(bytes))
        {
            throw new InvalidOperationException(
                "The selected subtitle is image-based and cannot be converted safely to SRT.");
        }

        string text = DecodeText(bytes);
        string output;

        if (extension == ".ass" || extension == ".ssa" || text.Contains("[Events]", StringComparison.OrdinalIgnoreCase))
            output = ConvertAssToSrt(text);
        else if (extension == ".vtt" || text.TrimStart().StartsWith("WEBVTT", StringComparison.OrdinalIgnoreCase))
            output = ConvertVttToSrt(text);
        else
            output = NormalizeSrt(text);

        if (string.IsNullOrWhiteSpace(output))
            throw new InvalidOperationException("The subtitle could not be converted to a valid SRT file.");

        string? directory = Path.GetDirectoryName(destinationPath);
        if (!string.IsNullOrWhiteSpace(directory))
            Directory.CreateDirectory(directory);

        await File.WriteAllTextAsync(
            destinationPath,
            output.Trim() + Environment.NewLine,
            new UTF8Encoding(encoderShouldEmitUTF8Identifier: false),
            cancellationToken);

        _logger.Info($"Converted subtitle to SRT: {destinationPath}");
    }

    private static string ConvertAssToSrt(string text)
    {
        string[] lines = NormalizeLines(text).Split('\n');
        bool inEvents = false;
        string[] format = [];
        var cues = new List<SrtCue>();

        foreach (string rawLine in lines)
        {
            string line = rawLine.TrimEnd();
            if (line.StartsWith("[Events]", StringComparison.OrdinalIgnoreCase))
            {
                inEvents = true;
                continue;
            }

            if (line.StartsWith('[') && !line.StartsWith("[Events]", StringComparison.OrdinalIgnoreCase))
            {
                if (inEvents)
                    break;
                continue;
            }

            if (!inEvents)
                continue;

            if (line.StartsWith("Format:", StringComparison.OrdinalIgnoreCase))
            {
                format = line[7..].Split(',').Select(item => item.Trim()).ToArray();
                continue;
            }

            if (!line.StartsWith("Dialogue:", StringComparison.OrdinalIgnoreCase))
                continue;

            if (format.Length == 0)
            {
                format = ["Layer", "Start", "End", "Style", "Name", "MarginL", "MarginR", "MarginV", "Effect", "Text"];
            }

            string payload = line[9..].TrimStart();
            string[] fields = SplitWithLimit(payload, ',', format.Length);
            if (fields.Length < format.Length)
                continue;

            int startIndex = Array.FindIndex(format, item => item.Equals("Start", StringComparison.OrdinalIgnoreCase));
            int endIndex = Array.FindIndex(format, item => item.Equals("End", StringComparison.OrdinalIgnoreCase));
            int textIndex = Array.FindIndex(format, item => item.Equals("Text", StringComparison.OrdinalIgnoreCase));
            if (startIndex < 0 || endIndex < 0 || textIndex < 0)
                continue;

            if (!TryParseAssTime(fields[startIndex], out TimeSpan start) ||
                !TryParseAssTime(fields[endIndex], out TimeSpan end))
            {
                continue;
            }

            string cueText = AssTagRegex().Replace(fields[textIndex], string.Empty)
                .Replace("\\N", Environment.NewLine, StringComparison.OrdinalIgnoreCase)
                .Replace("\\n", Environment.NewLine, StringComparison.OrdinalIgnoreCase)
                .Replace("\\h", " ", StringComparison.OrdinalIgnoreCase)
                .Trim();

            if (!string.IsNullOrWhiteSpace(cueText))
                cues.Add(new SrtCue(start, end, cueText));
        }

        return BuildSrt(cues);
    }

    private static string ConvertVttToSrt(string text)
    {
        string[] lines = NormalizeLines(text).Split('\n');
        var cues = new List<SrtCue>();
        int index = 0;

        while (index < lines.Length)
        {
            string line = lines[index].Trim();
            if (line.Length == 0 || line.StartsWith("WEBVTT", StringComparison.OrdinalIgnoreCase) ||
                line.StartsWith("NOTE", StringComparison.OrdinalIgnoreCase) ||
                line.StartsWith("STYLE", StringComparison.OrdinalIgnoreCase) ||
                line.StartsWith("REGION", StringComparison.OrdinalIgnoreCase))
            {
                index++;
                continue;
            }

            if (!line.Contains("-->", StringComparison.Ordinal))
            {
                index++;
                if (index >= lines.Length)
                    break;
                line = lines[index].Trim();
            }

            if (!line.Contains("-->", StringComparison.Ordinal))
            {
                index++;
                continue;
            }

            string[] timeParts = line.Split("-->", 2, StringSplitOptions.TrimEntries);
            string endPart = timeParts[1].Split(' ', StringSplitOptions.RemoveEmptyEntries)[0];
            if (!TryParseVttTime(timeParts[0], out TimeSpan start) ||
                !TryParseVttTime(endPart, out TimeSpan end))
            {
                index++;
                continue;
            }

            index++;
            var textLines = new List<string>();
            while (index < lines.Length && !string.IsNullOrWhiteSpace(lines[index]))
            {
                textLines.Add(HtmlTagRegex().Replace(lines[index], string.Empty));
                index++;
            }

            string cueText = string.Join(Environment.NewLine, textLines).Trim();
            if (!string.IsNullOrWhiteSpace(cueText))
                cues.Add(new SrtCue(start, end, cueText));
        }

        return BuildSrt(cues);
    }

    private static string NormalizeSrt(string text)
    {
        string normalized = NormalizeLines(text);

        // Convert WebVTT-style decimal separators only inside SRT timestamp lines.
        string[] lines = normalized.Split('\n');
        for (int i = 0; i < lines.Length; i++)
        {
            if (!lines[i].Contains("-->", StringComparison.Ordinal))
                continue;

            lines[i] = Regex.Replace(
                lines[i],
                @"(?<=\d{2}:\d{2}:\d{2})\.(?=\d{3})",
                ",");
        }

        return string.Join(Environment.NewLine, lines).Trim();
    }

    private static string BuildSrt(IEnumerable<SrtCue> cues)
    {
        var builder = new StringBuilder();
        int index = 1;
        foreach (SrtCue cue in cues)
        {
            builder.AppendLine(index.ToString(CultureInfo.InvariantCulture));
            builder.Append(FormatSrtTime(cue.Start));
            builder.Append(" --> ");
            builder.AppendLine(FormatSrtTime(cue.End));
            builder.AppendLine(cue.Text);
            builder.AppendLine();
            index++;
        }

        return builder.ToString().Trim();
    }

    private static bool TryParseAssTime(string value, out TimeSpan result)
    {
        string[] parts = value.Trim().Split(':');
        if (parts.Length != 3 ||
            !int.TryParse(parts[0], out int hours) ||
            !int.TryParse(parts[1], out int minutes) ||
            !double.TryParse(parts[2], NumberStyles.Float, CultureInfo.InvariantCulture, out double seconds))
        {
            result = default;
            return false;
        }

        result = TimeSpan.FromHours(hours) + TimeSpan.FromMinutes(minutes) + TimeSpan.FromSeconds(seconds);
        return true;
    }

    private static bool TryParseVttTime(string value, out TimeSpan result)
    {
        value = value.Trim().Replace(',', '.');
        string[] parts = value.Split(':');

        if (parts.Length == 2 &&
            int.TryParse(parts[0], out int minutes) &&
            double.TryParse(parts[1], NumberStyles.Float, CultureInfo.InvariantCulture, out double seconds))
        {
            result = TimeSpan.FromMinutes(minutes) + TimeSpan.FromSeconds(seconds);
            return true;
        }

        if (parts.Length == 3 &&
            int.TryParse(parts[0], out int hours) &&
            int.TryParse(parts[1], out minutes) &&
            double.TryParse(parts[2], NumberStyles.Float, CultureInfo.InvariantCulture, out seconds))
        {
            result = TimeSpan.FromHours(hours) + TimeSpan.FromMinutes(minutes) + TimeSpan.FromSeconds(seconds);
            return true;
        }

        result = default;
        return false;
    }

    private static string FormatSrtTime(TimeSpan value)
    {
        int totalHours = (int)value.TotalHours;
        return $"{totalHours:00}:{value.Minutes:00}:{value.Seconds:00},{value.Milliseconds:000}";
    }

    private static string[] SplitWithLimit(string value, char separator, int count)
    {
        var parts = new List<string>(count);
        int start = 0;
        for (int i = 0; i < value.Length && parts.Count < count - 1; i++)
        {
            if (value[i] != separator)
                continue;

            parts.Add(value[start..i]);
            start = i + 1;
        }
        parts.Add(value[start..]);
        return parts.ToArray();
    }

    private static string NormalizeLines(string text) =>
        text.Replace("\r\n", "\n").Replace('\r', '\n').Trim('\uFEFF');

    private static string DecodeText(byte[] bytes)
    {
        if (HasUtf8Bom(bytes))
            return Encoding.UTF8.GetString(bytes, 3, bytes.Length - 3);

        if (bytes.Length >= 2 && bytes[0] == 0xFF && bytes[1] == 0xFE)
            return Encoding.Unicode.GetString(bytes, 2, bytes.Length - 2);

        if (bytes.Length >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF)
            return Encoding.BigEndianUnicode.GetString(bytes, 2, bytes.Length - 2);

        return new UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: false)
            .GetString(bytes);
    }

    private static bool HasUtf8Bom(byte[] bytes) =>
        bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF;

    private static bool HasUtf16Bom(byte[] bytes) =>
        bytes.Length >= 2 &&
        ((bytes[0] == 0xFF && bytes[1] == 0xFE) ||
         (bytes[0] == 0xFE && bytes[1] == 0xFF));

    private static bool LooksBinary(byte[] bytes)
    {
        int sample = Math.Min(bytes.Length, 4096);
        if (sample == 0)
            return false;

        int zeroBytes = 0;
        int controlBytes = 0;
        for (int i = 0; i < sample; i++)
        {
            byte value = bytes[i];
            if (value == 0)
                zeroBytes++;
            else if (value < 8 || (value > 13 && value < 32))
                controlBytes++;
        }

        return zeroBytes > 2 || controlBytes > sample / 10;
    }

    private sealed record SrtCue(TimeSpan Start, TimeSpan End, string Text);
}
