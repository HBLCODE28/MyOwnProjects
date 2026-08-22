Unicode true
RequestExecutionLevel admin

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "FileFunc.nsh"

!define PRODUCT_NAME "Auto Brightness for VLC"
!define PRODUCT_VERSION "1.0.0"
!define COMPANY_NAME "Auto Brightness"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\AutoBrightnessForVLC"

Name "${PRODUCT_NAME}"
OutFile "dist\AutoBrightnessSetup.exe"
InstallDir "$PROGRAMFILES\AutoBrightness for VLC"
SetCompressor /SOLID lzma
ShowInstDetails show
ShowUninstDetails show

!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Var VLC32
Var VLC64
Var VLC32Version
Var VLC64Version
Var FoundSupported

Function DetectVLC
    StrCpy $VLC32 ""
    StrCpy $VLC64 ""
    StrCpy $VLC32Version ""
    StrCpy $VLC64Version ""
    StrCpy $FoundSupported "0"

    ${If} ${RunningX64}
        SetRegView 64
        ReadRegStr $VLC64 HKLM "Software\VideoLAN\VLC" "InstallDir"
        ReadRegStr $VLC64Version HKLM "Software\VideoLAN\VLC" "Version"
        ${If} $VLC64 == ""
            StrCpy $VLC64 "$PROGRAMFILES64\VideoLAN\VLC"
        ${EndIf}
        IfFileExists "$VLC64\vlc.exe" +2 0
            StrCpy $VLC64 ""

        SetRegView 32
        ReadRegStr $VLC32 HKLM "Software\VideoLAN\VLC" "InstallDir"
        ReadRegStr $VLC32Version HKLM "Software\VideoLAN\VLC" "Version"
        ${If} $VLC32 == ""
            StrCpy $VLC32 "$PROGRAMFILES32\VideoLAN\VLC"
        ${EndIf}
        IfFileExists "$VLC32\vlc.exe" +2 0
            StrCpy $VLC32 ""
        SetRegView lastused
    ${Else}
        SetRegView 32
        ReadRegStr $VLC32 HKLM "Software\VideoLAN\VLC" "InstallDir"
        ReadRegStr $VLC32Version HKLM "Software\VideoLAN\VLC" "Version"
        ${If} $VLC32 == ""
            StrCpy $VLC32 "$PROGRAMFILES\VideoLAN\VLC"
        ${EndIf}
        IfFileExists "$VLC32\vlc.exe" +2 0
            StrCpy $VLC32 ""
        SetRegView lastused
    ${EndIf}

    ${If} $VLC64 != ""
        ${If} $VLC64Version == ""
            ${GetFileVersion} "$VLC64\vlc.exe" $VLC64Version
        ${EndIf}
        StrCpy $0 $VLC64Version 1
        ${If} $0 == "3"
            StrCpy $FoundSupported "1"
        ${Else}
            StrCpy $VLC64 ""
        ${EndIf}
    ${EndIf}

    ${If} $VLC32 != ""
        ${If} $VLC32Version == ""
            ${GetFileVersion} "$VLC32\vlc.exe" $VLC32Version
        ${EndIf}
        StrCpy $0 $VLC32Version 1
        ${If} $0 == "3"
            StrCpy $FoundSupported "1"
        ${Else}
            StrCpy $VLC32 ""
        ${EndIf}
    ${EndIf}
FunctionEnd

Function .onInit
    Call DetectVLC
    ${If} $FoundSupported != "1"
        MessageBox MB_OK|MB_ICONSTOP "VLC 3.x was not found.$\r$\n$\r$\nInstall VLC 3.x first, then run this setup again.$\r$\nThis plugin build is not intended for VLC 4.x."
        Abort
    ${EndIf}

    MessageBox MB_OK|MB_ICONINFORMATION "Please close VLC before continuing.$\r$\n$\r$\nSetup will install the correct 32-bit or 64-bit plugin automatically."
FunctionEnd

Section "Install"
    SetOutPath "$INSTDIR"
    File "enable_autobrightness.ps1"
    File "disable_autobrightness.ps1"

    ${If} $VLC64 != ""
        CreateDirectory "$VLC64\plugins\video_filter"
        SetOutPath "$VLC64\plugins\video_filter"
        File /oname=libautobrightness_plugin.dll "payload\x64\libautobrightness_plugin.dll"
    ${EndIf}

    ${If} $VLC32 != ""
        CreateDirectory "$VLC32\plugins\video_filter"
        SetOutPath "$VLC32\plugins\video_filter"
        File /oname=libautobrightness_plugin.dll "payload\x86\libautobrightness_plugin.dll"
    ${EndIf}

    SetOutPath "$INSTDIR"
    nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\enable_autobrightness.ps1"'

    ${If} $VLC64 != ""
        nsExec::ExecToLog '"$VLC64\vlc.exe" --reset-plugins-cache vlc://quit'
    ${EndIf}
    ${If} $VLC32 != ""
        nsExec::ExecToLog '"$VLC32\vlc.exe" --reset-plugins-cache vlc://quit'
    ${EndIf}

    WriteUninstaller "$INSTDIR\Uninstall.exe"

    SetRegView 32
    WriteRegStr HKLM "${UNINST_KEY}" "DisplayName" "${PRODUCT_NAME}"
    WriteRegStr HKLM "${UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegStr HKLM "${UNINST_KEY}" "Publisher" "${COMPANY_NAME}"
    WriteRegStr HKLM "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegStr HKLM "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
    WriteRegDWORD HKLM "${UNINST_KEY}" "NoModify" 1
    WriteRegDWORD HKLM "${UNINST_KEY}" "NoRepair" 1
    SetRegView lastused
SectionEnd

Function un.DetectVLC
    StrCpy $VLC32 ""
    StrCpy $VLC64 ""

    ${If} ${RunningX64}
        SetRegView 64
        ReadRegStr $VLC64 HKLM "Software\VideoLAN\VLC" "InstallDir"
        ${If} $VLC64 == ""
            StrCpy $VLC64 "$PROGRAMFILES64\VideoLAN\VLC"
        ${EndIf}
        IfFileExists "$VLC64\vlc.exe" +2 0
            StrCpy $VLC64 ""

        SetRegView 32
        ReadRegStr $VLC32 HKLM "Software\VideoLAN\VLC" "InstallDir"
        ${If} $VLC32 == ""
            StrCpy $VLC32 "$PROGRAMFILES32\VideoLAN\VLC"
        ${EndIf}
        IfFileExists "$VLC32\vlc.exe" +2 0
            StrCpy $VLC32 ""
        SetRegView lastused
    ${Else}
        SetRegView 32
        ReadRegStr $VLC32 HKLM "Software\VideoLAN\VLC" "InstallDir"
        ${If} $VLC32 == ""
            StrCpy $VLC32 "$PROGRAMFILES\VideoLAN\VLC"
        ${EndIf}
        IfFileExists "$VLC32\vlc.exe" +2 0
            StrCpy $VLC32 ""
        SetRegView lastused
    ${EndIf}
FunctionEnd

Section "Uninstall"
    Call un.DetectVLC

    ${If} $VLC64 != ""
        Delete "$VLC64\plugins\video_filter\libautobrightness_plugin.dll"
    ${EndIf}
    ${If} $VLC32 != ""
        Delete "$VLC32\plugins\video_filter\libautobrightness_plugin.dll"
    ${EndIf}

    nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\disable_autobrightness.ps1"'

    ${If} $VLC64 != ""
        nsExec::ExecToLog '"$VLC64\vlc.exe" --reset-plugins-cache vlc://quit'
    ${EndIf}
    ${If} $VLC32 != ""
        nsExec::ExecToLog '"$VLC32\vlc.exe" --reset-plugins-cache vlc://quit'
    ${EndIf}

    Delete "$INSTDIR\enable_autobrightness.ps1"
    Delete "$INSTDIR\disable_autobrightness.ps1"
    Delete "$INSTDIR\Uninstall.exe"
    RMDir "$INSTDIR"

    SetRegView 32
    DeleteRegKey HKLM "${UNINST_KEY}"
    SetRegView lastused
SectionEnd
