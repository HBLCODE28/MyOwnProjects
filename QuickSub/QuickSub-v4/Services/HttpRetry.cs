using System.Net;

namespace QuickSub.Services;

internal static class HttpRetry
{
    public static async Task<HttpResponseMessage> SendAsync(
        HttpClient client,
        Func<HttpRequestMessage> requestFactory,
        CancellationToken cancellationToken,
        int attempts = 3)
    {
        Exception? lastException = null;

        for (int attempt = 1; attempt <= attempts; attempt++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                using HttpRequestMessage request = requestFactory();
                HttpResponseMessage response = await client.SendAsync(
                    request,
                    HttpCompletionOption.ResponseHeadersRead,
                    cancellationToken);

                if (!ShouldRetry(response.StatusCode) || attempt == attempts)
                    return response;

                TimeSpan delay = GetDelay(response, attempt);
                response.Dispose();
                await Task.Delay(delay, cancellationToken);
            }
            catch (Exception ex) when (
                (ex is HttpRequestException || ex is TaskCanceledException) &&
                !cancellationToken.IsCancellationRequested)
            {
                lastException = ex;
                if (attempt == attempts)
                    throw;

                await Task.Delay(TimeSpan.FromSeconds(attempt * 2), cancellationToken);
            }
        }

        throw lastException ?? new HttpRequestException("The request failed after several attempts.");
    }

    private static bool ShouldRetry(HttpStatusCode statusCode) =>
        statusCode == HttpStatusCode.RequestTimeout ||
        (int)statusCode == 429 ||
        (int)statusCode >= 500;

    private static TimeSpan GetDelay(HttpResponseMessage response, int attempt)
    {
        if (response.Headers.RetryAfter?.Delta is TimeSpan delta)
            return delta;

        if (response.Headers.RetryAfter?.Date is DateTimeOffset retryDate)
        {
            TimeSpan calculated = retryDate - DateTimeOffset.UtcNow;
            if (calculated > TimeSpan.Zero)
                return calculated;
        }

        return TimeSpan.FromSeconds(attempt * 2);
    }
}
