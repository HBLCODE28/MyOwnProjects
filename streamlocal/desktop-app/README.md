# StreamLocal Desktop

Standalone Windows desktop app for a private local movie and TV library. It is separate from `../frontend` and bundles Electron in the final installer; users do not need Edge, Node.js, Python, or a server.

## Development

```powershell
cd desktop-app
npm install
npm run dev
```

## Create the Windows installer

Run this on a Windows x64 build machine:

```powershell
npm install
npm run dist
```

The output is `release\StreamLocal-Setup.exe`. The NSIS installer is per-user, requires no administrator permissions, and creates Start Menu and Desktop shortcuts.

## Run the already-built Windows app

The unpacked Windows release is available at `release\StreamLocal-win-x64`. Copy the entire folder to a Windows PC and double-click `StreamLocal.exe`. Do not move `StreamLocal.exe` out of that folder, because it needs the adjacent Electron runtime files.

To create the single-file NSIS installer, run `npm run dist` from Windows. Building NSIS from Linux requires Wine.

## Privacy and storage

- Video files stay at their original paths; scanning is read-only.
- Library metadata, watch progress, and settings are stored in Electron's per-user `userData` directory.
- The OpenSubtitles key is encrypted using Electron `safeStorage` (Windows DPAPI) and is excluded from library exports.
- Library export/import contains catalogue records and watch history only, never videos or API keys.
