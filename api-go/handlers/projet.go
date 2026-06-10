// projets d'upcycling des particuliers avec suivi par etapes
// chaque etape peut avoir une photo, on stocke l'URL (upload a part)
// TODO: limiter le nombre d'étapes par projet (éviter l'abus de stockage)

package handlers

import (
	"upcycleconnect/api/middleware"
    "encoding/json"
    "net/http"
    "strconv"
    "time"

    "upcycleconnect/api/database"
    "upcycleconnect/api/models"
    "upcycleconnect/api/services"
)

var projetService = services.NewProjetService()

func CreateProjet(w http.ResponseWriter, r *http.Request) {
    userID := r.Context().Value(middleware.ContextUserID).(uint)
    var input struct {
        Titre       string    `json:"titre"`
        Description string    `json:"description"`
        DateDebut   time.Time `json:"date_debut"`
        DateFin     time.Time `json:"date_fin"`
    }
    if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
        http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
        return
    }
    projet := &models.ProjetUpcycling{
        Titre:        input.Titre,
        Description:  input.Description,
        DateDebut:    input.DateDebut,
        DateFin:      input.DateFin,
        Statut:       "en_cours",
        IDUtilisateur: userID,
    }
    if err := projetService.CreateProjet(projet); err != nil {
        jsonError(w, err.Error(), http.StatusBadRequest)
        return
    }
    database.AddUpcyclingScore(userID, 15, "creation_projet")
    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(projet)
}

func ListMesProjets(w http.ResponseWriter, r *http.Request) {
	ListUserProjets(w, r)
}

func AddEtapeProjet(w http.ResponseWriter, r *http.Request) {
	AddEtape(w, r)
}

func ListProjetsPublics(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	projets, err := projetService.ListPublics(page, 10)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(projets)
}

func ListUserProjets(w http.ResponseWriter, r *http.Request) {
    userID := r.Context().Value(middleware.ContextUserID).(uint)
    page, _ := strconv.Atoi(r.URL.Query().Get("page"))
    if page < 1 {
        page = 1
    }
    projets, err := projetService.ListUserProjets(userID, page, 10)
    if err != nil {
        http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
        return
    }
    json.NewEncoder(w).Encode(projets)
}

func UpdateProjet(w http.ResponseWriter, r *http.Request) {
    userID := r.Context().Value(middleware.ContextUserID).(uint)
    id, err := strconv.ParseUint(r.PathValue("id"), 10, 32)
    if err != nil {
        http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
        return
    }
    var req struct {
        Statut string `json:"statut"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
        return
    }
    if err := projetService.UpdateStatut(uint(id), userID, req.Statut); err != nil {
        jsonError(w, err.Error(), http.StatusBadRequest)
        return
    }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func AddEtape(w http.ResponseWriter, r *http.Request) {
    userID := r.Context().Value(middleware.ContextUserID).(uint)
    var input struct {
        ProjetID    uint      `json:"projet_id"`
        Titre       string    `json:"titre"`
        Description string    `json:"description"`
        Ordre       int       `json:"ordre"`
        DateEtape   time.Time `json:"date_etape"`
        PhotoURL    string    `json:"photo_url"`
    }
    if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
        http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
        return
    }
    // on verifie avant d'ajouter que le projet est bien au bon user
    projet, err := projetService.GetProjet(input.ProjetID)
    if err != nil || projet == nil || projet.IDUtilisateur != userID {
        http.Error(w, `{"error":"Projet non trouvé ou accès interdit"}`, http.StatusForbidden)
        return
    }
    etape := &models.EtapeProjet{
        Titre:       input.Titre,
        Description: input.Description,
        Ordre:       input.Ordre,
        DateEtape:   input.DateEtape,
        PhotoURL:    input.PhotoURL,
        IDProjet:    input.ProjetID,
    }
    if err := projetService.AddEtape(etape); err != nil {
        jsonError(w, err.Error(), http.StatusBadRequest)
        return
    }
    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(etape)
}