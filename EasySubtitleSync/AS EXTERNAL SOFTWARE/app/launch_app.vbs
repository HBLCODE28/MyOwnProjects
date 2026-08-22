Option Explicit
Dim shell, fso, scriptDir, ps, cmd
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
ps = scriptDir & "\EasySubtitleSync.ps1"
cmd = "powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps & """"
shell.Run cmd, 0, False
