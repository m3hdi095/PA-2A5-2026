package main

import (
    "encoding/json"
    "log"
    "net/http"
)

func main() {
    http.HandleFunc("/api/go/hello", func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(map[string]string{
            "message": "Hello from Go API!",
            "status":  "running",
        })
    })

    log.Println("Go API listening on :8080")
    log.Fatal(http.ListenAndServe(":8080", nil))
}