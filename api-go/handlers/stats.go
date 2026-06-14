package handlers

// stats globales de la plateforme pour le dashboard admin

import (
	"upcycleconnect/api/middleware"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"upcycleconnect/api/database"
	"upcycleconnect/api/models"
	"upcycleconnect/api/repositories"
)

var statsRepo = repositories.StatsRepository{}

func GetAdminStats(w http.ResponseWriter, r *http.Request) {
	stats, err := statsRepo.Get()
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// score upcycling + historique des 20 dernières actions du particulier
func GetScore(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)

	// Score total depuis la table particulier
	var scoreTotal int
	database.DB.QueryRow(
		`SELECT COALESCE(upcycling_score_total, 0) FROM particulier WHERE id_particulier = ?`, userID,
	).Scan(&scoreTotal)

	// Historique des 20 dernières actions
	rows, err := database.DB.Query(
		`SELECT id_log, points, COALESCE(motif,''), date_action, id_particulier
         FROM score_log WHERE id_particulier = ? ORDER BY date_action DESC LIMIT 20`,
		userID,
	)
	var historique []models.ScoreLog
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var s models.ScoreLog
			rows.Scan(&s.ID, &s.Points, &s.Motif, &s.DateAction, &s.IDParticulier)
			historique = append(historique, s)
		}
	}

	// kg de déchets évités via les projets de l'utilisateur
	var kgRecycles float64
	database.DB.QueryRow(
		`SELECT COALESCE(SUM(kg_dechets_evites), 0) FROM projet_upcycling WHERE id_utilisateur = ?`, userID,
	).Scan(&kgRecycles)

	// nombre d'événements à venir auxquels l'utilisateur est inscrit
	var evenementsVenir int
	database.DB.QueryRow(
		`SELECT COUNT(*) FROM inscription i
		 JOIN evenement e ON i.id_evenement = e.id_evenement
		 WHERE i.id_utilisateur = ? AND i.statut != 'annule' AND e.date_debut > NOW()`, userID,
	).Scan(&evenementsVenir)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"score_total":      scoreTotal,
		"historique":       historique,
		"kg_recycles":      kgRecycles,
		"evenements_venir": evenementsVenir,
	})
}

// suppression RGPD : on anonymise l'email et on desactive, on ne supprime rien
func SoftDeleteUser(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	parsed, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}
	userID := uint(parsed)

	// on prefixe l'email pour eviter les doublons si quelqu'un se reinscrit avec le meme mail
	_, err = database.DB.Exec(
		`UPDATE utilisateur SET actif = 0, email = CONCAT('deleted_', id_utilisateur, '_', email) WHERE id_utilisateur = ?`,
		userID,
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur lors de l'archivage"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "utilisateur archivé (RGPD)"})
}

// alertes dashboard : conteneurs saturés + paiements échoués
func GetAdminAlertes(w http.ResponseWriter, r *http.Request) {
	type Alerte struct {
		Type    string `json:"type"`
		Message string `json:"message"`
		Lien    string `json:"lien,omitempty"`
	}
	var alertes []Alerte

	// conteneurs dont le taux de remplissage dépasse 90%
	rows, err := database.DB.Query(
		`SELECT id_conteneur, adresse, ville, nb_objets, capacite
		 FROM conteneur
		 WHERE capacite > 0 AND nb_objets >= capacite * 0.9 AND statut = 'actif'
		 ORDER BY (nb_objets / capacite) DESC LIMIT 10`,
	)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var id, nb, cap int
			var adresse, ville string
			rows.Scan(&id, &adresse, &ville, &nb, &cap)
			pct := nb * 100 / cap
			alertes = append(alertes, Alerte{
				Type:    "conteneur",
				Message: adresse + ", " + ville + " — " + fmt.Sprintf("%d%%", pct) + " de remplissage",
				Lien:    "conteneurs.html",
			})
		}
	}

	// paiements échoués des 30 derniers jours
	rows2, err2 := database.DB.Query(
		`SELECT p.id_paiement, COALESCE(u.prenom,''), COALESCE(u.nom,''), p.montant, p.date_paiement
		 FROM paiement p
		 LEFT JOIN utilisateur u ON u.id_utilisateur = p.id_utilisateur
		 WHERE p.statut = 'echoue' AND p.date_paiement >= DATE_SUB(NOW(), INTERVAL 30 DAY)
		 ORDER BY p.date_paiement DESC LIMIT 10`,
	)
	if err2 == nil {
		defer rows2.Close()
		for rows2.Next() {
			var id int
			var prenom, nom string
			var montant float64
			var date string
			rows2.Scan(&id, &prenom, &nom, &montant, &date)
			alertes = append(alertes, Alerte{
				Type:    "paiement",
				Message: fmt.Sprintf("Paiement échoué — %s %s — %.2f €", prenom, nom, montant),
				Lien:    "factures.html",
			})
		}
	}

	if alertes == nil {
		alertes = []Alerte{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(alertes)
}

// depots en attente de confirmation, pour le panel admin
func ListDepotsEnAttente(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.Query(
		`SELECT d.id_depot, d.statut, d.date_demande, d.id_particulier, d.id_conteneur, d.id_objet,
                COALESCE(d.code_ouverture,''), COALESCE(d.code_barre_retrait,''),
                COALESCE(u.prenom,''), COALESCE(u.nom,'')
         FROM depot d
         LEFT JOIN utilisateur u ON u.id_utilisateur = d.id_particulier
         WHERE d.statut = 'en_attente' ORDER BY d.date_demande ASC`,
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type depotAvecAuteur struct {
		models.Depot
		AuteurPrenom string `json:"auteur_prenom"`
		AuteurNom    string `json:"auteur_nom"`
	}
	var depots []depotAvecAuteur
	for rows.Next() {
		var d depotAvecAuteur
		rows.Scan(&d.ID, &d.Statut, &d.DateDemande, &d.IDParticulier, &d.IDConteneur, &d.IDObjet,
			&d.CodeOuverture, &d.CodeBarreRetrait, &d.AuteurPrenom, &d.AuteurNom)
		depots = append(depots, d)
	}
	if depots == nil {
		depots = []depotAvecAuteur{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(depots)
}

func ListEvenementsEnAttente(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.Query(
		`SELECT e.id_evenement, e.titre, e.type, e.description, e.date_debut, e.date_fin, e.lieu, e.tarif, e.nb_places, e.statut, e.id_salarie_createur,
                COALESCE(u.prenom,''), COALESCE(u.nom,'')
         FROM evenement e
         LEFT JOIN utilisateur u ON u.id_utilisateur = e.id_salarie_createur
         WHERE e.statut = 'en_attente' ORDER BY e.id_evenement DESC`,
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type evenementAvecAuteur struct {
		models.Evenement
		AuteurPrenom string `json:"auteur_prenom"`
		AuteurNom    string `json:"auteur_nom"`
	}
	var events []evenementAvecAuteur
	for rows.Next() {
		var e evenementAvecAuteur
		rows.Scan(&e.ID, &e.Titre, &e.Type, &e.Description, &e.DateDebut, &e.DateFin, &e.Lieu, &e.Tarif, &e.NbPlaces, &e.Statut, &e.IDSalarieCreateur,
			&e.AuteurPrenom, &e.AuteurNom)
		events = append(events, e)
	}
	if events == nil {
		events = []evenementAvecAuteur{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}
