package handlers

import (
	"upcycleconnect/api/middleware"
	"encoding/json"
	"net/http"

	"upcycleconnect/api/models"
	"upcycleconnect/api/services"
)

var conseilService = services.NewConseilService()

// articles publiés visibles par tous, le middleware JWT filtre quand meme les anonymes
func ListConseils(w http.ResponseWriter, r *http.Request) {
	lang := r.URL.Query().Get("lang")
	if lang == "" {
		lang = "fr"
	}
	articles, err := conseilService.ListPublies(lang)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(articles)
}

// tous les articles du salarie, meme ceux en attente ou refuses
func MesConseils(w http.ResponseWriter, r *http.Request) {
	role := r.Context().Value(middleware.ContextRole).(string)
	if role != "salarie" && role != "admin" {
		http.Error(w, `{"error":"Réservé aux salariés"}`, http.StatusForbidden)
		return
	}
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	articles, err := conseilService.ListMesArticles(userID)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(articles)
}

// nouvel article, passe en attente_validation, l'admin doit valider avant que ca soit visible
func CreateConseil(w http.ResponseWriter, r *http.Request) {
	role := r.Context().Value(middleware.ContextRole).(string)
	if role != "salarie" {
		http.Error(w, `{"error":"Réservé aux salariés"}`, http.StatusForbidden)
		return
	}
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	var input models.ArticleConseil
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	input.IDSalarieRedacteur = userID
	if err := conseilService.Create(&input); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(input)
}

// le service verifie que l'article est bien à celui qui modifie
func UpdateConseil(w http.ResponseWriter, r *http.Request) {
	role := r.Context().Value(middleware.ContextRole).(string)
	if role != "salarie" {
		http.Error(w, `{"error":"Réservé aux salariés"}`, http.StatusForbidden)
		return
	}
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	var input models.ArticleConseil
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	if err := conseilService.Update(&input, userID); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// admin valide ou refuse un article, decision = 'publie' ou 'refuse'
func ValiderConseil(w http.ResponseWriter, r *http.Request) {
	role := r.Context().Value(middleware.ContextRole).(string)
	if role != "admin" {
		http.Error(w, `{"error":"Réservé aux administrateurs"}`, http.StatusForbidden)
		return
	}
	adminID := r.Context().Value(middleware.ContextUserID).(uint)
	var req struct {
		ArticleID uint   `json:"article_id"`
		Decision  string `json:"decision"` // publie ou refuse
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	if err := conseilService.Valider(req.ArticleID, req.Decision, adminID); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
