// CRUD des evenements et formations crees par les salaries
// les evenements crées passent en attente_validation, un admin doit valider avant que ca soit visible
// TODO: envoyer une notif push aux particuliers quand un événement est validé

package handlers

import (
	"upcycleconnect/api/middleware"
    "encoding/json"
    "net/http"
    "strconv"
    "time"

    "upcycleconnect/api/models"
    "upcycleconnect/api/repositories"
    "upcycleconnect/api/services"
)

var evenementService = services.NewEvenementService()

func CreateEvenement(w http.ResponseWriter, r *http.Request) {
    role := r.Context().Value(middleware.ContextRole).(string)
    if role != "salarie" && role != "admin" {
        http.Error(w, `{"error":"Accès interdit"}`, http.StatusForbidden)
        return
    }
    userID := r.Context().Value(middleware.ContextUserID).(uint)
    var input struct {
        Titre       string  `json:"titre"`
        Type        string  `json:"type"`
        Description string  `json:"description"`
        DateDebut   string  `json:"date_debut"`
        DateFin     string  `json:"date_fin"`
        Lieu        string  `json:"lieu"`
        Tarif       float64 `json:"tarif"`
        NbPlaces    int     `json:"nb_places"`
    }
    if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
        http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
        return
    }
    parseDate := func(s string) time.Time {
        for _, layout := range []string{time.RFC3339, "2006-01-02T15:04", "2006-01-02T15:04:05", "2006-01-02"} {
            if t, err := time.ParseInLocation(layout, s, time.Local); err == nil {
                return t
            }
        }
        return time.Time{}
    }
    var salarieID *uint
    if role == "salarie" {
        salarieID = &userID
    }
    dateDebut := parseDate(input.DateDebut)
    dateFin   := parseDate(input.DateFin)
    if dateFin.IsZero() {
        dateFin = dateDebut.Add(2 * time.Hour)
    }
    evt := &models.Evenement{
        Titre:             input.Titre,
        Type:              input.Type,
        Description:       input.Description,
        DateDebut:         dateDebut,
        DateFin:           dateFin,
        Lieu:              input.Lieu,
        Tarif:             input.Tarif,
        NbPlaces:          input.NbPlaces,
        IDSalarieCreateur: salarieID,
    }
    if err := evenementService.CreateEvenement(evt); err != nil {
        jsonError(w, err.Error(), http.StatusBadRequest)
        return
    }
    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(evt)
}

func ListEvenements(w http.ResponseWriter, r *http.Request) {
    page, _ := strconv.Atoi(r.URL.Query().Get("page"))
    if page < 1 {
        page = 1
    }
    lang := r.URL.Query().Get("lang")
    if lang == "" {
        lang = "fr"
    }
    events, err := evenementService.ListUpcoming(page, 10, lang)
    if err != nil {
        http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
        return
    }
    json.NewEncoder(w).Encode(events)
}

func InscrireEvenement(w http.ResponseWriter, r *http.Request) {
    userID := r.Context().Value(middleware.ContextUserID).(uint)
    var req struct {
        EvenementID uint `json:"evenement_id"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
        return
    }
    if err := evenementService.InscrireUtilisateur(userID, req.EvenementID); err != nil {
        jsonError(w, err.Error(), http.StatusBadRequest)
        return
    }
    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(map[string]string{"status": "inscrit"})
}

func MesInscriptions(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	inscriptions, err := evenementService.ListMesInscriptions(userID, page, 10)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(inscriptions)
}

func UpdateEvenement(w http.ResponseWriter, r *http.Request) {
    id, err := strconv.Atoi(r.PathValue("id"))
    if err != nil || id <= 0 {
        http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
        return
    }
    var input struct {
        Titre       string  `json:"titre"`
        Type        string  `json:"type"`
        Description string  `json:"description"`
        DateDebut   string  `json:"date_debut"`
        DateFin     string  `json:"date_fin"`
        Lieu        string  `json:"lieu"`
        Tarif       float64 `json:"tarif"`
        NbPlaces    int     `json:"nb_places"`
        Statut      string  `json:"statut"`
    }
    if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
        http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
        return
    }
    parseDate := func(s string) time.Time {
        for _, layout := range []string{time.RFC3339, "2006-01-02T15:04", "2006-01-02T15:04:05", "2006-01-02"} {
            if t, err := time.ParseInLocation(layout, s, time.Local); err == nil {
                return t
            }
        }
        return time.Time{}
    }
    evt := &models.Evenement{
        ID:          uint(id),
        Titre:       input.Titre,
        Type:        input.Type,
        Description: input.Description,
        DateDebut:   parseDate(input.DateDebut),
        DateFin:     parseDate(input.DateFin),
        Lieu:        input.Lieu,
        Tarif:       input.Tarif,
        NbPlaces:    input.NbPlaces,
        Statut:      input.Statut,
    }
    if err := evenementService.UpdateEvenement(evt); err != nil {
        jsonError(w, err.Error(), http.StatusBadRequest)
        return
    }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(evt)
}

func DeleteEvenement(w http.ResponseWriter, r *http.Request) {
    id, err := strconv.Atoi(r.PathValue("id"))
    if err != nil || id <= 0 {
        http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
        return
    }
    if err := evenementService.DeleteEvenement(uint(id)); err != nil {
        jsonError(w, err.Error(), http.StatusInternalServerError)
        return
    }
    w.WriteHeader(http.StatusNoContent)
}

func ValidateEvenement(w http.ResponseWriter, r *http.Request) {
    role := r.Context().Value(middleware.ContextRole).(string)
    if role != "admin" {
        http.Error(w, `{"error":"Accès interdit"}`, http.StatusForbidden)
        return
    }
    var req struct {
        EvenementID uint   `json:"evenement_id"`
        Decision    string `json:"decision"` // "valide" ou "annule"
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
        return
    }
    adminID := r.Context().Value(middleware.ContextUserID).(uint)
    if err := evenementService.ValidateEvenement(req.EvenementID, adminID, req.Decision); err != nil {
        jsonError(w, err.Error(), http.StatusInternalServerError)
        return
    }
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
func AdminListEvenements(w http.ResponseWriter, r *http.Request) {
    repo := repositories.EvenementRepository{}
    events, err := repo.ListAll(200, 0)
    if err != nil {
        http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
        return
    }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(events)
}

func MesCreations(w http.ResponseWriter, r *http.Request) {
    userID := r.Context().Value(middleware.ContextUserID).(uint)
    repo   := repositories.EvenementRepository{}
    events, err := repo.ListByCreator(userID)
    if err != nil {
        http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
        return
    }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(events)
}
