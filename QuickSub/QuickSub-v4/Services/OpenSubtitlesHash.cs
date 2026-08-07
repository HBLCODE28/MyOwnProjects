using System.Buffers.Binary;

namespace QuickSub.Services;

public static class OpenSubtitlesHash
{
    private const int ChunkSize = 64 * 1024;

    public static async Task<string> ComputeAsync(string filePath, CancellationToken cancellationToken)
    {
        var fileInfo = new FileInfo(filePath);
        if (fileInfo.Length < ChunkSize * 2)
            throw new InvalidOperationException("The video file is too small for an OpenSubtitles hash.");

        ulong hash = unchecked((ulong)fileInfo.Length);
        byte[] buffer = new byte[ChunkSize];

        await using var stream = new FileStream(
            filePath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            ChunkSize,
            FileOptions.Asynchronous | FileOptions.SequentialScan);

        await ReadExactlyAsync(stream, buffer, cancellationToken);
        hash = AddBuffer(hash, buffer);

        stream.Seek(-ChunkSize, SeekOrigin.End);
        await ReadExactlyAsync(stream, buffer, cancellationToken);
        hash = AddBuffer(hash, buffer);

        return hash.ToString("x16");
    }

    private static ulong AddBuffer(ulong current, byte[] buffer)
    {
        for (int offset = 0; offset < buffer.Length; offset += sizeof(ulong))
        {
            ulong value = BinaryPrimitives.ReadUInt64LittleEndian(buffer.AsSpan(offset, sizeof(ulong)));
            current = unchecked(current + value);
        }

        return current;
    }

    private static async Task ReadExactlyAsync(
        Stream stream,
        byte[] buffer,
        CancellationToken cancellationToken)
    {
        int total = 0;
        while (total < buffer.Length)
        {
            int read = await stream.ReadAsync(buffer.AsMemory(total), cancellationToken);
            if (read == 0)
                throw new EndOfStreamException("The video file ended while calculating its hash.");
            total += read;
        }
    }
}
