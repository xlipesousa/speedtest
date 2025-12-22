package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	defaultDownloadBytes = 5 * 1024 * 1024  // 5 MiB default payload
	maxDownloadBytes     = 25 * 1024 * 1024 // cap download payload to 25 MiB
	maxUploadBytes       = 25 * 1024 * 1024
)

func main() {
	server := newAPI()
	mux := http.NewServeMux()
	mux.HandleFunc("/health", withCORS(server.handleHealth))
	mux.HandleFunc("/download", withCORS(server.handleDownload))
	mux.HandleFunc("/upload", withCORS(server.handleUpload))
	mux.HandleFunc("/latency", withCORS(server.handleLatency))
	mux.HandleFunc("/ip", withCORS(server.handleIP))
	mux.HandleFunc("/webrtc/offer", withCORS(server.handleWebRTCOffer))

	addr := ":8080"
	log.Printf("backend listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

type apiServer struct{}

func newAPI() *apiServer {
	return &apiServer{}
}

func (s *apiServer) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *apiServer) handleDownload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	size, err := parseSize(r.URL.Query().Get("size"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	buf := make([]byte, 32*1024)
	remaining := size
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Length", strconv.FormatInt(size, 10))
	for remaining > 0 {
		chunk := buf
		if remaining < int64(len(buf)) {
			chunk = buf[:remaining]
		}
		written, err := w.Write(chunk)
		if err != nil {
			log.Printf("download stream interrupted: %v", err)
			return
		}
		remaining -= int64(written)
	}
}

func (s *apiServer) handleUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodPut {
		methodNotAllowed(w)
		return
	}
	reader := http.MaxBytesReader(w, r.Body, maxUploadBytes)
	defer reader.Close()
	uploaded, err := io.Copy(io.Discard, reader)
	if err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "payload exceeds maximum size"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to read payload"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"bytes":    uploaded,
		"received": true,
	})
}

func (s *apiServer) handleLatency(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	now := time.Now().UTC()
	writeJSON(w, http.StatusOK, map[string]any{
		"timestamp": now.Format(time.RFC3339Nano),
		"epochMs":   now.UnixMilli(),
	})
}

func (s *apiServer) handleIP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"ip":    clientIP(r),
		"agent": r.UserAgent(),
	})
}

func (s *apiServer) handleWebRTCOffer(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	writeJSON(w, http.StatusNotImplemented, map[string]string{
		"status":  "not_implemented",
		"message": "WebRTC negotiation will be added in a future iteration",
	})
}

func parseSize(raw string) (int64, error) {
	if raw == "" {
		return defaultDownloadBytes, nil
	}
	size, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || size <= 0 {
		return 0, fmt.Errorf("invalid size parameter")
	}
	if size > maxDownloadBytes {
		return maxDownloadBytes, nil
	}
	return size, nil
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("json encoding failed: %v", err)
	}
}

func methodNotAllowed(w http.ResponseWriter) {
	w.Header().Set("Allow", "GET,POST,PUT,OPTIONS")
	w.WriteHeader(http.StatusMethodNotAllowed)
}

func withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func clientIP(r *http.Request) string {
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		parts := strings.Split(forwarded, ",")
		return strings.TrimSpace(parts[0])
	}
	if realIP := r.Header.Get("X-Real-IP"); realIP != "" {
		return realIP
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
