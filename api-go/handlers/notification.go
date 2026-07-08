// envoi et lecture des notifications in-app et push OneSignal

package handlers

import (
	"upcycleconnect/api/middleware"
    "encoding/json"
    "net/http"
    "strconv"

    "upcycleconnect/api/services"
)

var notificationService = services.NewNotificationService()

func SendNotification(w http.ResponseWriter, r *http.Request) {
    role := r.Context().Value(middleware.ContextRole).(string)
    if role != "admin" && role != "salarie" {
        http.Error(w, `{"error":"Accès interdit"}`, http.StatusForbidden)
        return
    }
    var req struct {
        ToUserID uint   `json:"to_user_id"`
        Title    string `json:"title"`
        Message  string `json:"message"`
        Type     string `json:"type"`
        Canal    string `json:"canal"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ToUserID == 0 || req.Title == "" {
        http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
        return
    }
    if err := notificationService.SendNotification(req.ToUserID, req.Title, req.Message, req.Type, req.Canal); err != nil {
        http.Error(w, `{"error":"Erreur d'envoi"}`, http.StatusInternalServerError)
        return
    }
    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(map[string]string{"status": "sent"})
}

func GetNotifications(w http.ResponseWriter, r *http.Request) {
	GetMyNotifications(w, r)
}

func GetMyNotifications(w http.ResponseWriter, r *http.Request) {
    userID := r.Context().Value(middleware.ContextUserID).(uint)
    page, _ := strconv.Atoi(r.URL.Query().Get("page"))
    if page < 1 {
        page = 1
    }
    notifs, err := notificationService.GetUserNotifications(userID, page, 20)
    if err != nil {
        http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
        return
    }
    json.NewEncoder(w).Encode(notifs)
}

func BroadcastNotification(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Titre   string `json:"titre"`
        Message string `json:"message"`
        Segment string `json:"segment"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Titre == "" || req.Message == "" {
        http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
        return
    }
    if req.Segment == "" {
        req.Segment = "tous"
    }
    count, err := notificationService.BroadcastToSegment(req.Segment, req.Titre, req.Message)
    if err != nil {
        http.Error(w, `{"error":"Erreur d'envoi"}`, http.StatusInternalServerError)
        return
    }
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(map[string]interface{}{"status": "sent", "count": count})
}

func MarkNotificationRead(w http.ResponseWriter, r *http.Request) {
    _ = r.Context().Value(middleware.ContextUserID).(uint)
    idStr := r.PathValue("id")
    id, err := strconv.ParseUint(idStr, 10, 64)
    if err != nil || id == 0 {
        http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
        return
    }
    if err := notificationService.MarkAsRead(uint(id)); err != nil {
        http.Error(w, `{"error":"Erreur"}`, http.StatusInternalServerError)
        return
    }
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func MarkAllNotificationsRead(w http.ResponseWriter, r *http.Request) {
    userID := r.Context().Value(middleware.ContextUserID).(uint)
    if err := notificationService.MarkAllAsRead(userID); err != nil {
        http.Error(w, `{"error":"Erreur"}`, http.StatusInternalServerError)
        return
    }
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}