# StreamLocal Stage 10 test media

Stage 10 includes a helper that creates two local 20-minute MP4 files:

- `StreamLocal.Test.Movie.2026.mp4`
- `StreamLocal.Test.Show.S01E01.mp4`

Run from the StreamLocal project directory:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\download-test-media.ps1
```

The script downloads the public Big Buck Bunny H.264 MP4 engineering sample and
uses FFmpeg to loop/remux it to exactly 20:00. It creates one movie-shaped
filename and one episode-shaped filename so playback progress, Continue
Watching, Started/Watched thresholds and filename recognition can be tested.

The generated files are deliberately NOT committed to Git.
