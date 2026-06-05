// envoi et lecture des notifications in-app et push OneSignal
// FIXME: SendNotification devrait vérifier que l'expéditeur a le droit d'écrire au destinataire
// FIXME: n'importe quel utilisateur peut ecrire a n'importe qui, a corriger avant prod

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
    _ = r.Context().Value(middleware.ContextUserID).(uint)
    var req struct {
        ToUserID uint   `json:"to_user_id"`
        Title    string `json:"title"`
        Message  string `json:"message"`
        Type     string `json:"type"`
        Canal    string `json:"canal"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
        return
    }
    // pour l'instant n'importe qui peut ecrire a n'importe qui, c'est le FIXME du haut
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

func MarkNotificationRead(w http.ResponseWriter, r *http.Request) {
    _ = r.Context().Value(middleware.ContextUserID).(uint)
    var req struct {
        NotificationID uint `json:"notification_id"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
        return
    }
    // on devrait verifier ici que la notif appartient bien a cet user, mais on le fait pas encore
    if err := notificationService.MarkAsRead(req.NotificationID); err != nil {
        http.Error(w, `{"error":"Erreur"}`, http.StatusInternalServerError)
        return
    }
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}