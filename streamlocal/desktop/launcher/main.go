// StreamLocal Windows desktop launcher.
// Pure Go: target computers do not need .NET, Node.js, Python, or Go.
package main

import (
    "context"
    "crypto/sha256"
    "encoding/hex"
    "encoding/json"
    "errors"
    "fmt"
    "io"
    "io/fs"
    "log"
    "mime"
    "net"
    "net/http"
    "net/url"
    "os"
    "os/exec"
    "path/filepath"
    "runtime"
    "strconv"
    "strings"
    "sync/atomic"
    "syscall"
    "time"
)

const (
    listenAddress = "127.0.0.1:17836"
    appURL        = "http://127.0.0.1:17836/"
    chunkSize     = 1024 * 1024
)

type jsonError struct {
    Error string `json:"error"`
}

type pickedFolder struct {
    Path string `json:"path"`
    Name string `json:"name"`
}

type scannedFile struct {
    RelativePath string `json:"relativePath"`
    FileName     string `json:"fileName"`
    Extension    string `json:"extension"`
    Size         int64  `json:"size"`
    LastModified int64  `json:"lastModified"`
}

type scanResult struct {
    Files []scannedFile `json:"files"`
}

func main() {
    if runtime.GOOS != "windows" {
        log.Fatal("StreamLocal desktop launcher is intended for Windows")
    }

    exe, err := os.Executable()
    if err != nil {
        messageBoxFallback("StreamLocal", "Could not locate StreamLocal.exe.")
        return
    }
    root := filepath.Dir(exe)
    appDir := filepath.Join(root, "app")
    if _, err := os.Stat(filepath.Join(appDir, "index.html")); err != nil {
        messageBoxFallback("StreamLocal", "The app folder is missing. Keep StreamLocal.exe together with the app folder.")
        return
    }

    listener, err := net.Listen("tcp", listenAddress)
    if err != nil {
        // A previous StreamLocal launcher is probably already serving the stable origin.
        if launchAppWindow(root) == nil {
            return
        }
        messageBoxFallback("StreamLocal", "Port 17836 is already in use and the app window could not be opened.")
        return
    }

    mux := http.NewServeMux()
    registerNativeHandlers(mux)
    mux.Handle("/", spaHandler(appDir))

    server := &http.Server{
        Handler:           securityHeaders(mux),
        ReadHeaderTimeout: 10 * time.Second,
    }
    go func() {
        if err := server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
            log.Printf("server: %v", err)
        }
    }()

    lastHeartbeat.Store(time.Now().UnixMilli())
    startHistoryBridge(root)
    if err := launchAppWindow(root); err != nil {
        _ = server.Shutdown(context.Background())
        messageBoxFallback("StreamLocal", "Microsoft Edge or Google Chrome could not be opened in app mode.")
        return
    }

    // Edge/Chrome may hand the app window to another process and let the launcher command exit.
    // A lightweight heartbeat keeps the server alive only while the StreamLocal app window is open.
    graceUntil := time.Now().Add(30 * time.Second)
    ticker := time.NewTicker(5 * time.Second)
    defer ticker.Stop()
    for range ticker.C {
        last := time.UnixMilli(lastHeartbeat.Load())
        if time.Now().After(graceUntil) && time.Since(last) > 25*time.Second {
            break
        }
    }
    _ = server.Shutdown(context.Background())
}

var lastHeartbeat atomic.Int64

func registerNativeHandlers(mux *http.ServeMux) {
    mux.HandleFunc("/__streamlocal_native/status", nativeOnly(func(w http.ResponseWriter, r *http.Request) {
        lastHeartbeat.Store(time.Now().UnixMilli())
        writeJSON(w, http.StatusOK, map[string]any{"native": true, "version": 2})
    }))

    mux.HandleFunc("/__streamlocal_native/heartbeat", nativeOnly(func(w http.ResponseWriter, r *http.Request) {
        lastHeartbeat.Store(time.Now().UnixMilli())
        w.WriteHeader(http.StatusNoContent)
    }))

    mux.HandleFunc("/__streamlocal_native/pick-folder", nativeOnly(func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodPost {
            writeJSON(w, http.StatusMethodNotAllowed, jsonError{"POST required"})
            return
        }
        path, err := windowsPickFolder()
        if err != nil {
            if errors.Is(err, errCancelled) {
                writeJSON(w, 499, jsonError{"Folder selection was cancelled."})
            } else {
                writeJSON(w, http.StatusInternalServerError, jsonError{err.Error()})
            }
            return
        }
        writeJSON(w, http.StatusOK, pickedFolder{Path: path, Name: rootDisplayName(path)})
    }))

    mux.HandleFunc("/__streamlocal_native/validate-root", nativeOnly(func(w http.ResponseWriter, r *http.Request) {
        root := r.URL.Query().Get("root")
        info, err := os.Stat(root)
        if err != nil || !info.IsDir() {
            writeJSON(w, http.StatusBadRequest, jsonError{"The folder cannot be opened. Check the path and Windows network permissions."})
            return
        }
        writeJSON(w, http.StatusOK, pickedFolder{Path: root, Name: rootDisplayName(root)})
    }))

    mux.HandleFunc("/__streamlocal_native/scan", nativeOnly(func(w http.ResponseWriter, r *http.Request) {
        root := r.URL.Query().Get("root")
        recursive := r.URL.Query().Get("recursive") != "0"
        result, err := scanFolder(root, recursive)
        if err != nil {
            writeJSON(w, http.StatusBadRequest, jsonError{err.Error()})
            return
        }
        writeJSON(w, http.StatusOK, result)
    }))

    mux.HandleFunc("/__streamlocal_native/fingerprint", nativeOnly(func(w http.ResponseWriter, r *http.Request) {
        path, err := safeMediaPath(r.URL.Query().Get("root"), r.URL.Query().Get("relative"))
        if err != nil {
            writeJSON(w, http.StatusBadRequest, jsonError{err.Error()})
            return
        }
        value, err := fingerprint(path)
        if err != nil {
            writeJSON(w, http.StatusBadRequest, jsonError{fmt.Sprintf("Could not fingerprint file: %v", err)})
            return
        }
        writeJSON(w, http.StatusOK, map[string]string{"fingerprint": value})
    }))

    mux.HandleFunc("/__streamlocal_native/media", nativeOnly(func(w http.ResponseWriter, r *http.Request) {
        path, err := safeMediaPath(r.URL.Query().Get("root"), r.URL.Query().Get("relative"))
        if err != nil {
            http.Error(w, err.Error(), http.StatusBadRequest)
            return
        }
        serveDiskFile(w, r, path)
    }))

    mux.HandleFunc("/__streamlocal_native/file", nativeOnly(func(w http.ResponseWriter, r *http.Request) {
        path, err := safeMediaPath(r.URL.Query().Get("root"), r.URL.Query().Get("relative"))
        if err != nil {
            http.Error(w, err.Error(), http.StatusBadRequest)
            return
        }
        serveDiskFile(w, r, path)
    }))

    mux.HandleFunc("/__streamlocal_native/text", nativeOnly(func(w http.ResponseWriter, r *http.Request) {
        path, err := safeMediaPath(r.URL.Query().Get("root"), r.URL.Query().Get("relative"))
        if err != nil {
            http.Error(w, err.Error(), http.StatusBadRequest)
            return
        }
        info, err := os.Stat(path)
        if err != nil {
            if os.IsNotExist(err) { http.NotFound(w, r); return }
            http.Error(w, "Could not open file", http.StatusBadRequest)
            return
        }
        if info.Size() > 8*1024*1024 {
            http.Error(w, "Text sidecar is too large", http.StatusRequestEntityTooLarge)
            return
        }
        data, err := os.ReadFile(path)
        if err != nil {
            http.Error(w, "Could not read file", http.StatusBadRequest)
            return
        }
        w.Header().Set("Content-Type", "text/plain; charset=utf-8")
        _, _ = w.Write(data)
    }))
}

func nativeOnly(next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        host, _, err := net.SplitHostPort(r.RemoteAddr)
        if err != nil || (host != "127.0.0.1" && host != "::1") {
            http.Error(w, "Local requests only", http.StatusForbidden)
            return
        }
        if origin := r.Header.Get("Origin"); origin != "" && origin != "http://127.0.0.1:17836" {
            http.Error(w, "Invalid origin", http.StatusForbidden)
            return
        }
        if referer := r.Header.Get("Referer"); referer != "" && !strings.HasPrefix(referer, appURL) {
            http.Error(w, "Invalid referer", http.StatusForbidden)
            return
        }
        next(w, r)
    }
}

func securityHeaders(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("X-Content-Type-Options", "nosniff")
        w.Header().Set("Referrer-Policy", "same-origin")
        next.ServeHTTP(w, r)
    })
}

func spaHandler(appDir string) http.Handler {
    fileServer := http.FileServer(http.Dir(appDir))
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        clean := filepath.Clean(filepath.FromSlash(strings.TrimPrefix(r.URL.Path, "/")))
        candidate := filepath.Join(appDir, clean)
        if r.URL.Path != "/" {
            if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
                fileServer.ServeHTTP(w, r)
                return
            }
        }
        http.ServeFile(w, r, filepath.Join(appDir, "index.html"))
    })
}

func scanFolder(root string, recursive bool) (scanResult, error) {
    info, err := os.Stat(root)
    if err != nil || !info.IsDir() {
        return scanResult{}, fmt.Errorf("the selected folder cannot be opened; check Windows or network-share permissions")
    }
    root = filepath.Clean(root)
    out := scanResult{Files: make([]scannedFile, 0, 128)}
    err = filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
        if walkErr != nil {
            // Network shares can contain inaccessible subfolders. Skip them rather than aborting the whole library.
            if entry != nil && entry.IsDir() { return fs.SkipDir }
            return nil
        }
        if path == root { return nil }
        if entry.IsDir() {
            if !recursive && filepath.Dir(path) == root { return fs.SkipDir }
            return nil
        }
        ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(entry.Name()), "."))
        if ext != "mp4" && ext != "mkv" { return nil }
        stat, err := entry.Info()
        if err != nil { return nil }
        rel, err := filepath.Rel(root, path)
        if err != nil { return nil }
        out.Files = append(out.Files, scannedFile{
            RelativePath: filepath.ToSlash(rel),
            FileName: entry.Name(),
            Extension: ext,
            Size: stat.Size(),
            LastModified: stat.ModTime().UnixMilli(),
        })
        return nil
    })
    return out, err
}

func safeMediaPath(root, relative string) (string, error) {
    if root == "" || relative == "" { return "", errors.New("missing path") }
    root = filepath.Clean(root)
    info, err := os.Stat(root)
    if err != nil || !info.IsDir() { return "", errors.New("media root is unavailable") }
    relative = filepath.FromSlash(relative)
    if filepath.IsAbs(relative) { return "", errors.New("relative media path expected") }
    joined := filepath.Clean(filepath.Join(root, relative))
    rel, err := filepath.Rel(root, joined)
    if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
        return "", errors.New("path is outside the selected media folder")
    }
    return joined, nil
}

func fingerprint(path string) (string, error) {
    file, err := os.Open(path)
    if err != nil { return "", err }
    defer file.Close()
    info, err := file.Stat()
    if err != nil { return "", err }
    size := info.Size()

    firstSize := min64(chunkSize, size)
    first := make([]byte, firstSize)
    if firstSize > 0 {
        if _, err := io.ReadFull(file, first); err != nil { return "", err }
    }
    firstHash := sha256.Sum256(first)

    lastSize := min64(chunkSize, size)
    last := make([]byte, lastSize)
    if lastSize > 0 {
        if _, err := file.ReadAt(last, size-lastSize); err != nil && !errors.Is(err, io.EOF) { return "", err }
    }
    lastHash := sha256.Sum256(last)
    return strconv.FormatInt(size, 10) + ":" + hex.EncodeToString(firstHash[:]) + ":" + hex.EncodeToString(lastHash[:]), nil
}

func min64(a int64, b int64) int64 { if a < b { return a }; return b }

func serveDiskFile(w http.ResponseWriter, r *http.Request, path string) {
    file, err := os.Open(path)
    if err != nil { http.NotFound(w, r); return }
    defer file.Close()
    info, err := file.Stat()
    if err != nil { http.NotFound(w, r); return }
    ext := strings.ToLower(filepath.Ext(path))
    contentType := mime.TypeByExtension(ext)
    if contentType == "" {
        switch ext {
        case ".mp4": contentType = "video/mp4"
        case ".mkv": contentType = "video/x-matroska"
        case ".jpg", ".jpeg": contentType = "image/jpeg"
        case ".png": contentType = "image/png"
        case ".webp": contentType = "image/webp"
        case ".srt": contentType = "application/x-subrip"
        case ".vtt": contentType = "text/vtt; charset=utf-8"
        }
    }
    if contentType != "" { w.Header().Set("Content-Type", contentType) }
    w.Header().Set("Accept-Ranges", "bytes")
    http.ServeContent(w, r, info.Name(), info.ModTime(), file)
}

var errCancelled = errors.New("cancelled")

func windowsPickFolder() (string, error) {
    script := `Set shell = CreateObject("Shell.Application")
Set folder = shell.BrowseForFolder(0, "Select a StreamLocal media folder", 0, 0)
If folder Is Nothing Then WScript.Quit 2
WScript.Echo folder.Self.Path
`
    temp, err := os.CreateTemp("", "streamlocal-folder-*.vbs")
    if err != nil { return "", err }
    name := temp.Name()
    defer os.Remove(name)
    if _, err := temp.WriteString(script); err != nil { temp.Close(); return "", err }
    if err := temp.Close(); err != nil { return "", err }

    cmd := exec.Command("cscript.exe", "//Nologo", name)
    cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
    output, err := cmd.Output()
    if err != nil {
        if exit, ok := err.(*exec.ExitError); ok && exit.ExitCode() == 2 { return "", errCancelled }
        return "", fmt.Errorf("Windows folder picker failed: %w", err)
    }
    path := strings.TrimSpace(string(output))
    if path == "" { return "", errCancelled }
    return filepath.Clean(path), nil
}

func rootDisplayName(path string) string {
    cleaned := strings.TrimRight(filepath.Clean(path), `\/`)
    base := filepath.Base(cleaned)
    if base == "." || base == "" || base == string(filepath.Separator) { return cleaned }
    return base
}

func launchAppWindow(root string) error {
    browser := findBrowser()
    profile := filepath.Join(localAppData(), "StreamLocal", "BrowserProfile")
    _ = os.MkdirAll(profile, 0o755)
    if browser != "" {
        cmd := exec.Command(browser,
            "--app="+appURL,
            "--start-maximized",
            "--no-first-run",
            "--disable-features=msEdgeSidebarV2",
            "--user-data-dir="+profile,
        )
        cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
        return cmd.Start()
    }

    cmd := exec.Command("rundll32.exe", "url.dll,FileProtocolHandler", appURL)
    cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
    return cmd.Start()
}

func findBrowser() string {
    candidates := []string{
        filepath.Join(os.Getenv("ProgramFiles(x86)"), "Microsoft", "Edge", "Application", "msedge.exe"),
        filepath.Join(os.Getenv("ProgramFiles"), "Microsoft", "Edge", "Application", "msedge.exe"),
        filepath.Join(os.Getenv("LOCALAPPDATA"), "Microsoft", "Edge", "Application", "msedge.exe"),
        filepath.Join(os.Getenv("ProgramFiles"), "Google", "Chrome", "Application", "chrome.exe"),
        filepath.Join(os.Getenv("ProgramFiles(x86)"), "Google", "Chrome", "Application", "chrome.exe"),
        filepath.Join(os.Getenv("LOCALAPPDATA"), "Google", "Chrome", "Application", "chrome.exe"),
    }
    for _, candidate := range candidates {
        if candidate == "" { continue }
        if info, err := os.Stat(candidate); err == nil && !info.IsDir() { return candidate }
    }
    return ""
}

func startHistoryBridge(root string) {
    script := filepath.Join(root, "scripts", "player-history-bridge.ps1")
    if _, err := os.Stat(script); err != nil { return }
    cmd := exec.Command("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", script)
    cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
    _ = cmd.Start()
}

func localAppData() string {
    if value := os.Getenv("LOCALAPPDATA"); value != "" { return value }
    home, _ := os.UserHomeDir()
    return filepath.Join(home, "AppData", "Local")
}

func messageBoxFallback(title, message string) {
    // mshta is built into Windows and avoids a console window or .NET dependency.
    escapedTitle := url.QueryEscape(title)
    escapedMessage := url.QueryEscape(message)
    js := fmt.Sprintf(`javascript:var sh=new ActiveXObject('WScript.Shell');sh.Popup(decodeURIComponent('%s'),0,decodeURIComponent('%s'),16);close()`, escapedMessage, escapedTitle)
    cmd := exec.Command("mshta.exe", js)
    cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
    _ = cmd.Run()
}

func writeJSON(w http.ResponseWriter, status int, value any) {
    w.Header().Set("Content-Type", "application/json; charset=utf-8")
    w.WriteHeader(status)
    _ = json.NewEncoder(w).Encode(value)
}
