package middleware

// middleware d'authentification JWT
// on injecte userID et role dans le contexte, les handlers lisent ca avec r.Context().Value(...)

import (
    "context"
    "net/http"
    "strings"

    "upcycleconnect/api/utils"
)

// type opaque pour les cles de contexte, evite les collisions entre packages
type ContextKey string

const (
    ContextUserID ContextKey = "userID"
    ContextRole   ContextKey = "role"
)

func AuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        authHeader := r.Header.Get("Authorization")
        if authHeader == "" {
            http.Error(w, `{"error":"Token manquant"}`, http.StatusUnauthorized)
            return
        }
        parts := strings.Split(authHeader, " ")
        if len(parts) != 2 || parts[0] != "Bearer" {
            http.Error(w, `{"error":"Format du token invalide"}`, http.StatusUnauthorized)
            return
        }
        userID, role, csrfToken, err := utils.ValidateJWT(parts[1])
        if err != nil {
            http.Error(w, `{"error":"Token invalide ou expiré"}`, http.StatusUnauthorized)
            return
        }

        switch r.Method {
        case http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodPatch:
            if r.Header.Get("X-CSRF-Token") != csrfToken {
                http.Error(w, `{"error":"CSRF token invalide"}`, http.StatusForbidden)
                return
            }
        }

        ctx := context.WithValue(r.Context(), ContextUserID, userID)
        ctx = context.WithValue(ctx, ContextRole, role)
        next(w, r.WithContext(ctx))
    }
}

func RoleMiddleware(allowedRoles ...string) func(http.HandlerFunc) http.HandlerFunc {
    return func(next http.HandlerFunc) http.HandlerFunc {
        return func(w http.ResponseWriter, r *http.Request) {
            role := r.Context().Value(ContextRole).(string)
            for _, allowed := range allowedRoles {
                if role == allowed {
                    next(w, r)
                    return
                }
            }
            http.Error(w, `{"error":"Accès interdit"}`, http.StatusForbidden)
        }
    }
}