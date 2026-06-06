package handlers

// Handlers pour les annonces  création, listage, mise à jour et suppression douce.
// Les vérifications de propriété (est-ce que c'est bien mon annonce ?) se font dans le service.

import (
	"upcycleconnect/api/middleware"
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"upcycleconnect/api/models"
	"upcycleconnect/api/repositories"
	"upcycleconnect/api/services"
)

var annonceService = services.NewAnnonceService()

func CreateAnnonce(w http.ResponseWriter, r *http.Request) {
	// On récupère les champs du body : on ne prend que ce dont on a besoin
	var input struct {
		Titre       string  `json:"titre"`
		Description string  `json:"description"`
		TypeAnnonce string  `json:"type_annonce"`
		Prix        float64 `json:"prix"`
		IDObjet     uint    `json:"id_objet"`
		CategorieID *uint   `json:"categorie_id"`
		Etat        string  `json:"etat"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}

	// userID vient du token JWT, le client peut pas le falsifier
	userID := r.Context().Value(middleware.ContextUserID).(uint)

	// Si aucun objet fourni, on en crée un automatiquement à partir du titre de l'annonce
	// TODO: permettre au front d'envoyer des infos objet plus détaillées
	objetID := input.IDObjet
	if objetID == 0 {
		etat := input.Etat
		if etat == "" {
			etat = "bon"
		}
		obj := &models.Objet{
			Nom:         input.Titre,
			Description: input.Description,
			CategorieID: input.CategorieID,
			Etat:        etat,
		}
		objetRepo := &repositories.ObjetRepository{}
		if err := objetRepo.Create(obj); err != nil {
			http.Error(w, `{"error":"Erreur création objet"}`, http.StatusInternalServerError)
			return
		}
		objetID = obj.ID
	}

	annonce := &models.Annonce{
		Titre:         input.Titre,
		Description:   input.Description,
		TypeAnnonce:   input.TypeAnnonce,
		Prix:          input.Prix,
		IDUtilisateur: userID,
		IDObjet:       objetID,
	}

	if err := annonceService.CreateAnnonce(annonce); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(annonce)
}

func ListAnnonces(w http.ResponseWriter, r *http.Request) {
	// TODO: ajouter des filtres par catégorie et localisation GPS
	filtre := r.URL.Query().Get("filter")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	lang := r.URL.Query().Get("lang")
	if lang == "" {
		lang = "fr"
	}

	listeAnnonces, err := annonceService.ListAnnonces(filtre, page, 20, lang)
	if err != nil {
		log.Println("Erreur listing annonces:", err)
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(listeAnnonces)
}

func UpdateAnnonce(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	idStr := r.PathValue("id")
	parsed, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}

	var input models.Annonce
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}

	// On s'assure que l'annonce appartient bien à cet utilisateur
	input.ID = uint(parsed)
	input.IDUtilisateur = userID

	if err := annonceService.UpdateAnnonce(&input); err != nil {
		// FIXME: distinguer les erreurs 403 (pas le droit) des erreurs 400 (données invalides)
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func DeleteAnnonce(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	idStr := r.PathValue("id")
	parsed, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}

	// suppression douce, on passe en statut desactivee
	if err := annonceService.DeleteAnnonce(uint(parsed), userID, ""); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func MesAnnonces(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	repo := &repositories.AnnonceRepository{}
	annonces, err := repo.ListByUser(userID, 50, 0)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(annonces)
}

func ListPendingAnnonces(w http.ResponseWriter, r *http.Request) {
	role := r.Context().Value(middleware.ContextRole).(string)
	if role != "admin" {
		http.Error(w, `{"error":"Accès interdit"}`, http.StatusForbidden)
		return
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}

	annonces, err := annonceService.ListPending(page, 20)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(annonces)
}

func ValidateAnnonce(w http.ResponseWriter, r *http.Request) {
	role := r.Context().Value(middleware.ContextRole).(string)
	if role != "admin" {
		http.Error(w, `{"error":"Accès interdit"}`, http.StatusForbidden)
		return
	}

	var req struct {
		AnnonceID   uint   `json:"annonce_id"`
		Decision    string `json:"decision"`
		Commentaire string `json:"commentaire"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}

	adminID := r.Context().Value(middleware.ContextUserID).(uint)

	if err := annonceService.ValidateAnnonce(req.AnnonceID, adminID, req.Decision, req.Commentaire); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
