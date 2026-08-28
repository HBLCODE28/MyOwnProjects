package main

import (
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
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

const (
	listenAddress = "127.0.0.1:17836"
	siteURL       = "http://127.0.0.1:17836/"
	chunkSize     = 1024 * 1024
)

type jsonError struct {
	Error string `json:"error"`
}
type folderInfo struct {
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
		log.Fatal("Windows only")
	}
	exe, err := os.Executable()
	if err != nil {
		return
	}
	root := filepath.Dir(exe)
	appDir := filepath.Join(root, "app")
	if _, err := os.Stat(filepath.Join(appDir, "index.html")); err != nil {
		return
	}

	listener, err := net.Listen("tcp", listenAddress)
	if err != nil {
		openBrowser(siteURL)
		return
	}

	mux := http.NewServeMux()
	registerNetworkHandlers(mux)
	mux.Handle("/", spaHandler(appDir))
	server := &http.Server{Handler: securityHeaders(mux), ReadHeaderTimeout: 10 * time.Second}
	go openBrowser(siteURL)
	if err := server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Printf("server: %v", err)
	}
}

func openBrowser(url string) {
	time.Sleep(250 * time.Millisecond)
	_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
}

func registerNetworkHandlers(mux *http.ServeMux) {
	mux.HandleFunc("/__streamlocal_network/status", localOnly(func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"network": true, "version": 2})
	}))
	mux.HandleFunc("/__streamlocal_network/validate-root", localOnly(func(w http.ResponseWriter, r *http.Request) {
		root := strings.TrimSpace(r.URL.Query().Get("root"))
		if root == "" {
			writeJSON(w, http.StatusBadRequest, jsonError{"Missing network path."})
			return
		}
		info, err := os.Stat(root)
		if err != nil || !info.IsDir() {
			writeJSON(w, http.StatusBadRequest, jsonError{"The network folder cannot be opened. Open it once in File Explorer and verify Windows permissions/credentials."})
			return
		}
		writeJSON(w, http.StatusOK, folderInfo{Path: filepath.Clean(root), Name: rootDisplayName(root)})
	}))
	mux.HandleFunc("/__streamlocal_network/scan", localOnly(func(w http.ResponseWriter, r *http.Request) {
		root := r.URL.Query().Get("root")
		result, err := scanFolder(root, r.URL.Query().Get("recursive") != "0")
		if err != nil {
			writeJSON(w, http.StatusBadRequest, jsonError{err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, result)
	}))
	mux.HandleFunc("/__streamlocal_network/fingerprint", localOnly(func(w http.ResponseWriter, r *http.Request) {
		path, err := safePath(r.URL.Query().Get("root"), r.URL.Query().Get("relative"))
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
	mux.HandleFunc("/__streamlocal_network/media", localOnly(func(w http.ResponseWriter, r *http.Request) {
		path, err := safePath(r.URL.Query().Get("root"), r.URL.Query().Get("relative"))
		if err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		serveDiskFile(w, r, path)
	}))
	mux.HandleFunc("/__streamlocal_network/file", localOnly(func(w http.ResponseWriter, r *http.Request) {
		path, err := safePath(r.URL.Query().Get("root"), r.URL.Query().Get("relative"))
		if err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		serveDiskFile(w, r, path)
	}))
	mux.HandleFunc("/__streamlocal_network/text", localOnly(func(w http.ResponseWriter, r *http.Request) {
		path, err := safePath(r.URL.Query().Get("root"), r.URL.Query().Get("relative"))
		if err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		info, err := os.Stat(path)
		if err != nil {
			if os.IsNotExist(err) {
				http.NotFound(w, r)
				return
			}
			http.Error(w, "Could not open file", 400)
			return
		}
		if info.Size() > 8*1024*1024 {
			http.Error(w, "Text sidecar is too large", 413)
			return
		}
		data, err := os.ReadFile(path)
		if err != nil {
			http.Error(w, "Could not read file", 400)
			return
		}
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		_, _ = w.Write(data)
	}))
}

func localOnly(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		host, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil || (host != "127.0.0.1" && host != "::1") {
			http.Error(w, "Local requests only", 403)
			return
		}
		if origin := r.Header.Get("Origin"); origin != "" && origin != "http://127.0.0.1:17836" {
			http.Error(w, "Invalid origin", 403)
			return
		}
		next(w, r)
	}
}

func scanFolder(root string, recursive bool) (scanResult, error) {
	info, err := os.Stat(root)
	if err != nil || !info.IsDir() {
		return scanResult{}, fmt.Errorf("network folder unavailable; verify Windows share permissions")
	}
	root = filepath.Clean(root)
	out := scanResult{Files: make([]scannedFile, 0, 128)}
	err = filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			if entry != nil && entry.IsDir() {
				return fs.SkipDir
			}
			return nil
		}
		if path == root {
			return nil
		}
		if entry.IsDir() {
			if !recursive && filepath.Dir(path) == root {
				return fs.SkipDir
			}
			return nil
		}
		ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(entry.Name()), "."))
		if ext != "mp4" && ext != "mkv" {
			return nil
		}
		stat, err := entry.Info()
		if err != nil {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return nil
		}
		out.Files = append(out.Files, scannedFile{RelativePath: filepath.ToSlash(rel), FileName: entry.Name(), Extension: ext, Size: stat.Size(), LastModified: stat.ModTime().UnixMilli()})
		return nil
	})
	return out, err
}

func safePath(root, relative string) (string, error) {
	if root == "" || relative == "" {
		return "", errors.New("missing path")
	}
	root = filepath.Clean(root)
	info, err := os.Stat(root)
	if err != nil || !info.IsDir() {
		return "", errors.New("network root is unavailable")
	}
	relative = filepath.FromSlash(relative)
	if filepath.IsAbs(relative) {
		return "", errors.New("relative media path expected")
	}
	joined := filepath.Clean(filepath.Join(root, relative))
	rel, err := filepath.Rel(root, joined)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
		return "", errors.New("path is outside the selected network folder")
	}
	return joined, nil
}

func fingerprint(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		return "", err
	}
	size := info.Size()
	firstSize := min64(chunkSize, size)
	first := make([]byte, firstSize)
	if firstSize > 0 {
		if _, err := io.ReadFull(f, first); err != nil {
			return "", err
		}
	}
	firstHash := sha256.Sum256(first)
	lastSize := min64(chunkSize, size)
	last := make([]byte, lastSize)
	if lastSize > 0 {
		if _, err := f.ReadAt(last, size-lastSize); err != nil && !errors.Is(err, io.EOF) {
			return "", err
		}
	}
	lastHash := sha256.Sum256(last)
	return strconv.FormatInt(size, 10) + ":" + hex.EncodeToString(firstHash[:]) + ":" + hex.EncodeToString(lastHash[:]), nil
}
func min64(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}

func serveDiskFile(w http.ResponseWriter, r *http.Request, path string) {
	f, err := os.Open(path)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		http.NotFound(w, r)
		return
	}
	ct := mime.TypeByExtension(strings.ToLower(filepath.Ext(path)))
	if ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	http.ServeContent(w, r, info.Name(), info.ModTime(), f)
}

func rootDisplayName(path string) string {
	clean := strings.TrimRight(filepath.Clean(path), `\/`)
	name := filepath.Base(clean)
	if name == "." || name == string(filepath.Separator) || name == "" {
		return clean
	}
	return name
}
func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "same-origin")
		// The frontend uses stable asset names in the Website Portable build. Do not
		// let a browser cache from an older extracted Portable hide a newer build.
		if !strings.HasPrefix(r.URL.Path, "/__streamlocal_network/") {
			w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
			w.Header().Set("Pragma", "no-cache")
			w.Header().Set("Expires", "0")
		}
		next.ServeHTTP(w, r)
	})
}
func spaHandler(appDir string) http.Handler {
	fsrv := http.FileServer(http.Dir(appDir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		clean := filepath.Clean(filepath.FromSlash(strings.TrimPrefix(r.URL.Path, "/")))
		candidate := filepath.Join(appDir, clean)
		if r.URL.Path != "/" {
			if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
				fsrv.ServeHTTP(w, r)
				return
			}
		}
		http.ServeFile(w, r, filepath.Join(appDir, "index.html"))
	})
}
