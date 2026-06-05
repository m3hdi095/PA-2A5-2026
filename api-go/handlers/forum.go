package handlers

// messages du forum communautaire et moderation
// la moderation se fait par signalement puis traitement, les roles sont verifies dans chaque handler
// FIXME: créer une vraie table signalement pour tracer qui a signalé quoi

import (
	"upcycleconnect/api/middleware"
	"encoding/json"
	"net/http"
	"strconv"

	"upcycleconnect/api/models"
	"upcycleconnect/api/services"
)

var forumService = services.NewForumService()

func ListForumMessages(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	forumID, _ := strconv.ParseUint(r.URL.Query().Get("forum_id"), 10, 32)
	if forumID == 0 {
		forumID = 1
	}
	messages, err := forumService.ListMessages(uint(forumID), page, 30)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	if messages == nil {
		messages = []models.ForumMessage{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

func PostForumMessage(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	var input struct {
		Contenu         string `json:"contenu"`
		IDForum         uint   `json:"id_forum"`
		IDParentMessage *uint  `json:"id_parent_message,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	if input.IDForum == 0 {
		input.IDForum = 1
	}
	msg := &models.ForumMessage{
		Contenu:         input.Contenu,
		IDUtilisateur:   userID,
		IDForum:         input.IDForum,
		IDParentMessage: input.IDParentMessage,
	}
	if err := forumService.PostMessage(msg); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(msg)
}

func SignalerMessage(w http.ResponseWriter, r *http.Request) {
	role := r.Context().Value(middleware.ContextRole).(string)
	if role != "salarie" && role != "admin" {
		http.Error(w, `{"error":"Accès réservé à la modération"}`, http.StatusForbidden)
		return
	}
	var req struct {
		MessageID uint `json:"message_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	if err := forumService.Signaler(req.MessageID); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "message masqué"})
}

// TODO: table signalement pas dans le schema pour l'instant, on retourne vide en attendant
func ListSignalements(w http.ResponseWriter, r *http.Request) {
	role := r.Context().Value(middleware.ContextRole).(string)
	if role != "salarie" && role != "admin" {
		http.Error(w, `{"error":"Accès réservé à la modération"}`, http.StatusForbidden)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`[]`))
}

// restaure ou cache un message, on reutilise Signaler() pour les deux directions
func TraiterSignalement(w http.ResponseWriter, r *http.Request) {
	role := r.Context().Value(middleware.ContextRole).(string)
	if role != "salarie" && role != "admin" {
		http.Error(w, `{"error":"Accès réservé à la modération"}`, http.StatusForbidden)
		return
	}
	idStr := r.PathValue("id")
	parsed, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}
	var req struct {
		Action string `json:"action"` // "supprimer" ou "restaurer"
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	messageID := uint(parsed)
	if req.Action == "restaurer" {
		err = forumService.Restaurer(messageID)
	} else {
		err = forumService.Signaler(messageID)
	}
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "traité"})
}
