package middleware

import (
	"net/http"

	"github.com/rs/cors"
)

func CORS(next http.Handler) http.Handler {
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "https://upcycleconnect.fr", "https://www.upcycleconnect.fr"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type", "X-CSRF-Token"},
		AllowCredentials: true,
	})
	return c.Handler(next)
}
