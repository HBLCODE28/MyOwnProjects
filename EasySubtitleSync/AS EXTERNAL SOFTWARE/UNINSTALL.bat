@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$d=[Environment]::GetFolderPath('Desktop'); $s=Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'; Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $d 'Easy Subtitle Sync for VLC.lnk'),(Join-Path $s 'Easy Subtitle Sync for VLC.lnk'); Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $env:LOCALAPPDATA 'EasySubtitleSync')"
echo Easy Subtitle Sync was removed.
pause
