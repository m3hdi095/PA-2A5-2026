package handlers

import (
    "encoding/json"
    "net/http"

    "upcycleconnect/api/database"
)

var configDefaults = map[string]string{
    "nom_plateforme":        "UpcycleConnect",
    "email_contact":         "contact@upcycleconnect.fr",
    "telephone":             "+33 1 00 00 00 00",
    "adresse_siege":         "174 rue La Fayette, Paris 10e",
    "maintenance":           "false",
    "inscriptions_ouvertes": "true",
    "validation_manuelle":   "true",
    "commission_taux":       "7",
    "tarif_abo_pro":         "30",
    "smtp_host":             "smtp.upcycleconnect.fr",
    "smtp_port":             "587",
    "smtp_user":             "no-reply@upcycleconnect.fr",
    "notif_annonce":         "true",
    "notif_conteneur":       "true",
    "notif_formation":       "true",
    "notif_paiement":        "true",
    "session_duree":         "3600",
    "https_force":           "true",
    "rate_limit":            "true",
    "logs_admin":            "true",
    "langue_defaut":         "fr",
}

func GetAdminConfig(w http.ResponseWriter, r *http.Request) {
    rows, err := database.DB.Query(`SELECT cle, valeur FROM config_plateforme`)
    if err != nil {
        jsonError(w, "Erreur lecture config", http.StatusInternalServerError)
        return
    }
    defer rows.Close()

    cfg := make(map[string]string)
    for k, v := range configDefaults {
        cfg[k] = v
    }
    for rows.Next() {
        var k, v string
        rows.Scan(&k, &v)
        cfg[k] = v
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(cfg)
}

func UpdateAdminConfig(w http.ResponseWriter, r *http.Request) {
    var body map[string]string
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
        jsonError(w, "Données invalides", http.StatusBadRequest)
        return
    }

    for k, v := range body {
        if _, ok := configDefaults[k]; !ok {
            continue
        }
        database.DB.Exec(
            `INSERT INTO config_plateforme (cle, valeur) VALUES (?, ?) ON DUPLICATE KEY UPDATE valeur = ?`,
            k, v, v,
        )
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
