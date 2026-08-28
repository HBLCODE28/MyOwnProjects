StreamLocal Windows App Packager
================================

This package turns the existing React/Vite StreamLocal frontend into a Windows app-style installation.
It does NOT require .NET, Node.js, npm, Python, Go, or Vite on the target computer.

Runtime on the target PC
------------------------
StreamLocal uses Microsoft Edge in Windows "app mode". Current Windows 10/11 systems normally already include Edge.
Nothing from .NET is installed by StreamLocal.

Build a release
---------------
1. Extract this package directly into the StreamLocal project folder with Replace / Merge.
2. Double-click Make-StreamLocal-Release.cmd.
3. The release folder will contain:
   - StreamLocal-Setup.exe
   - StreamLocal-Portable.zip

If frontend source files are newer than frontend\dist, the development PC runs npm run build automatically.
The target PC never needs npm.

Windows / network folder support
--------------------------------
When launched with StreamLocal.exe, the Library page uses the local Windows bridge for folders.
It supports normal paths, mapped drives, and Windows network paths such as:
  Z:\Movies
  \\NAS\Series
  \\SERVER\Media\Movies

The media bytes remain local/network-local. StreamLocal does not upload video files.

TV / display scaling
--------------------
The frontend now scales its navigation, hero, rails, cards, library tables and series overlay according to the actual viewport.
The previous hard minimum width was removed, so Windows display scaling and TV resolutions no longer force an oversized layout.

Native launcher source
----------------------
desktop\launcher\main.go contains the launcher source.
A prebuilt tools\windows-packager\StreamLocal.exe is included, so Go is NOT required for normal use.
Only developers changing the native launcher need Go; they can run scripts\build-desktop-launcher.ps1.
