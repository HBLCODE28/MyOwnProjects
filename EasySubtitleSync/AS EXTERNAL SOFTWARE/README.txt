Easy Subtitle Sync for VLC v1.0

WHAT WAS FIXED
- Removed PowerShell BackgroundWorker usage that caused:
  "There is no Runspace available to run scripts in this thread."
- The helper now runs as a normal hidden process.
- A Windows Forms timer checks completion on the UI thread.
- No CMD window is required during automatic synchronization.

VISIBLE APP
- The app is launched from a Desktop shortcut and Start Menu shortcut.
- It is no longer hidden inside VLC's View menu.
- The window is not full-screen.
- It is resizable and scrollable.
- "Keep above VLC" is enabled by default and can be turned off.

INSTALL
1. Extract the ZIP.
2. Run INSTALL.bat.
3. Open "Easy Subtitle Sync for VLC" from Desktop or Start Menu.

If an older v0.9 installation already works with FFmpeg, v1.0 automatically reuses that local FFmpeg before replacing the old installation.

OFFLINE TRANSFER TO ANOTHER COMPUTER
On the working computer:
1. Run BUILD_OFFLINE_PACKAGE.bat.
2. Transfer EasySubtitleSync_v1.0_Offline.zip.
3. Extract it on the other Windows x64 computer.
4. Run INSTALL.bat.
5. No internet download is required on the destination computer.

TEST
The test folder contains a video and an intentionally early SRT file.
Expected correction is about +1.5 seconds.
