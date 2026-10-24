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

## Privacy and storage

- Video files stay at their original paths; scanning is read-only.
- Library metadata, watch progress, and settings are stored in Electron's per-user `userData` directory.
- The OpenSubtitles key is encrypted using Electron `safeStorage` (Windows DPAPI) and is excluded from library exports.
- Library export/import contains catalogue records and watch history only, never videos or API keys.
