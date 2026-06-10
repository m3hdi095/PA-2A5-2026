// traductions dynamiques des contenus, titres annonces, descriptions categories
// les fichiers i18n couvrent l'interface, cette table c'est pour les contenus metier (annonces, descriptions...)

package handlers

import (
	"upcycleconnect/api/middleware"
    "encoding/json"
    "net/http"
    "strconv"

    "upcycleconnect/api/services"
)

var traductionService = services.NewTraductionService()

func GetTraduction(w http.ResponseWriter, r *http.Request) {
    table := r.PathValue("table")
    idStr := r.PathValue("id")
    champ := r.PathValue("champ")
    langue := r.PathValue("langue")
    id, err := strconv.ParseUint(idStr, 10, 32)
    if err != nil {
        http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
        return
    }
    valeur, err := traductionService.GetTraduction(table, uint(id), champ, langue)
    if err != nil {
        http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
        return
    }
    if valeur == "" {
        // on retourne vide si pas de trad, le front affiche le texte original dans ce cas
    }
    json.NewEncoder(w).Encode(map[string]string{"valeur": valeur})
}

func AddTraduction(w http.ResponseWriter, r *http.Request) {
	SetTraduction(w, r)
}

func SetTraduction(w http.ResponseWriter, r *http.Request) {
    role := r.Context().Value(middleware.ContextRole).(string)
    if role != "admin" && role != "salarie" {
	// TODO: elargir aux prestataires aussi ? pour l'instant seulement admin et salarie
        http.Error(w, `{"error":"Accès interdit"}`, http.StatusForbidden)
        return
    }
    var req struct {
        Table       string `json:"table"`
        RecordID    uint   `json:"record_id"`
        Champ       string `json:"champ"`
        Langue      string `json:"langue"`
        Valeur      string `json:"valeur"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
        return
    }
    if err := traductionService.SetTraduction(req.Table, req.RecordID, req.Champ, req.Langue, req.Valeur); err != nil {
        http.Error(w, `{"error":"Erreur d'enregistrement"}`, http.StatusInternalServerError)
        return
    }
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}