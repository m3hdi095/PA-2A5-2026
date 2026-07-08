// CRUD des evenements et formations crees par les salaries
// les evenements crées passent en attente_validation, un admin doit valider avant que ca soit visible

package handlers

import (
	"upcycleconnect/api/middleware"
    "encoding/json"
    "fmt"
    "net/http"
    "strconv"
    "time"

    "upcycleconnect/api/database"
    "upcycleconnect/api/models"
    "upcycleconnect/api/repositories"
    "upcycleconnect/api/services"
    "upcycleconnect/api/utils"
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
    database.AddUpcyclingScore(userID, 3, "inscription_evenement")
    go envoyerEmailInscriptionEvenement(userID, req.EvenementID)
    go envoyerEmailFormateurInscription(userID, req.EvenementID)
    go creerFactureManuel(userID, "evenement")
    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(map[string]string{"status": "inscrit"})
}

func SeDesinscrire(w http.ResponseWriter, r *http.Request) {
    userID := r.Context().Value(middleware.ContextUserID).(uint)
    id, err := strconv.ParseUint(r.PathValue("id"), 10, 32)
    if err != nil {
        http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
        return
    }
    if err := evenementService.SeDesinscrire(userID, uint(id)); err != nil {
        jsonError(w, err.Error(), http.StatusBadRequest)
        return
    }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{"status": "désinscrit"})
}

func MesInscriptions(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	inscriptions, err := evenementService.ListMesInscriptions(userID, page, 200)
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

func AnnulerEvenementSalarie(w http.ResponseWriter, r *http.Request) {
    id, err := strconv.Atoi(r.PathValue("id"))
    if err != nil || id <= 0 {
        http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
        return
    }
    userID := r.Context().Value(middleware.ContextUserID).(uint)
    if err := evenementService.AnnulerEvenementSalarie(uint(id), userID); err != nil {
        jsonError(w, err.Error(), http.StatusForbidden)
        return
    }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{"status": "annule"})
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

func envoyerEmailFormateurInscription(participantID, eventID uint) {
    var emailFormateur, prenomFormateur, titreEvent string
    var prenomParticipant, nomParticipant string
    var nbInscrits int
    database.DB.QueryRow(
        `SELECT u.email, u.prenom, e.titre,
                (SELECT CONCAT(p.prenom, ' ', p.nom) FROM utilisateur p WHERE p.id_utilisateur = ?) AS participant,
                (SELECT COUNT(*) FROM inscription i WHERE i.id_evenement = e.id_evenement AND i.statut IN ('paye','non_paye')) AS nb
         FROM evenement e
         JOIN salarie s ON s.id_salarie = e.id_salarie_createur
         JOIN utilisateur u ON u.id_utilisateur = s.id_utilisateur
         WHERE e.id_evenement = ?`,
        participantID, eventID,
    ).Scan(&emailFormateur, &prenomFormateur, &titreEvent, &nomParticipant, &nbInscrits)
    if emailFormateur == "" {
        return
    }
    _ = prenomParticipant
    body := fmt.Sprintf(`<p>Bonjour %s,</p>
<p>Un nouveau participant s'est inscrit à votre événement <strong>%s</strong>.</p>
<p>Participant : <strong>%s</strong><br>Nombre total d'inscrits : <strong>%d</strong></p>`,
        prenomFormateur, titreEvent, nomParticipant, nbInscrits)
    utils.SendEmail(emailFormateur, "Nouvelle inscription : "+titreEvent, body)
}

func envoyerEmailInscriptionEvenement(userID, eventID uint) {
    var email, prenom, titreEvent string
    var dateDebut time.Time
    database.DB.QueryRow(
        `SELECT u.email, u.prenom, e.titre, e.date_debut
         FROM utilisateur u, evenement e
         WHERE u.id_utilisateur = ? AND e.id_evenement = ?`,
        userID, eventID,
    ).Scan(&email, &prenom, &titreEvent, &dateDebut)
    if email == "" {
        return
    }
    dateStr := dateDebut.Format("02/01/2006 à 15h04")
    body := utils.EmailInscriptionEvenementBody(prenom, titreEvent, dateStr)
    utils.SendEmail(email, "Confirmation d'inscription : "+titreEvent, body)
}
