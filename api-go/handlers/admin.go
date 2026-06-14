package handlers

// routes admin pour la gestion des utilisateurs
// on verifie le role deux fois (middleware + ici), ca semble redondant mais si on se plante dans le cablage des routes ca protege quand meme

import (
	"encoding/json"
	"net/http"
	"strconv"

	"upcycleconnect/api/config"
	"upcycleconnect/api/database"
	"upcycleconnect/api/models"
	"upcycleconnect/api/repositories"
)

func GetPublicConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"stripe_pk":      config.AppConfig.StripePublicKey,
		"onesignal_app_id": config.AppConfig.OneSignalAppID,
	})
}

// userRepo partagé pour les routes admin
var adminUserRepo = repositories.UserRepository{}

func CountUsersByRole(w http.ResponseWriter, r *http.Request) {
	counts := map[string]int{"tous": 0, "particulier": 0, "professionnel": 0, "salarie": 0, "admin": 0}
	rows, err := database.DB.Query("SELECT role, COUNT(*) FROM utilisateur WHERE actif = 1 GROUP BY role")
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var role string
		var n int
		rows.Scan(&role, &n)
		counts[role] = n
		counts["tous"] += n
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(counts)
}

func GetNotificationHistory(w http.ResponseWriter, r *http.Request) {
	repo := repositories.NotificationRepository{}
	history, err := repo.GetBroadcastHistory(50)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	type Item struct {
		Titre   string `json:"titre"`
		Message string `json:"message"`
		Segment string `json:"segment"`
		Envoyes int    `json:"envoyes"`
		Date    string `json:"date"`
	}
	items := make([]Item, 0, len(history))
	for _, h := range history {
		items = append(items, Item{
			Titre:   h.Titre,
			Message: h.Contenu,
			Segment: "tous",
			Envoyes: h.NbEnvoyes,
			Date:    h.DateEnvoi.UTC().Format("2006-01-02T15:04:05Z"),
		})
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func ListUsers(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	users, err := adminUserRepo.ListAll(20, (page-1)*20)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

func ActivateUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID uint `json:"user_id"`
		Actif  bool `json:"actif"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	if err := adminUserRepo.UpdateActivation(req.UserID, req.Actif); err != nil {
		http.Error(w, `{"error":"Erreur lors de la mise à jour"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func AdminCreateUser(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email     string `json:"email"`
		Password  string `json:"password"`
		Nom       string `json:"nom"`
		Prenom    string `json:"prenom"`
		Role      string `json:"role"`
		Telephone string `json:"telephone"`
		Adresse   string `json:"adresse"`
		Statut    string `json:"statut"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	if input.Email == "" || input.Password == "" || input.Nom == "" {
		http.Error(w, `{"error":"Email, mot de passe et nom sont requis"}`, http.StatusBadRequest)
		return
	}
	validRoles := map[string]bool{"particulier": true, "professionnel": true, "salarie": true, "admin": true}
	if !validRoles[input.Role] {
		input.Role = "particulier"
	}
	user := &models.Utilisateur{
		Email:      input.Email,
		MotDePasse: input.Password,
		Nom:        input.Nom,
		Prenom:     input.Prenom,
		Role:       input.Role,
		Telephone:  input.Telephone,
		Adresse:    input.Adresse,
		Actif:      input.Statut != "inactif",
	}
	if err := authService.Register(user); err != nil {
		jsonError(w, err.Error(), http.StatusConflict)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]uint{"id": user.ID})
}

func AdminFactures(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	offset := (page - 1) * 20

	type FactureLigne struct {
		ID      uint    `json:"id"`
		Num     string  `json:"num"`
		Client  string  `json:"client"`
		Type    string  `json:"type"`
		HT      float64 `json:"ht"`
		TVA     float64 `json:"tva"`
		TTC     float64 `json:"ttc"`
		Date    string  `json:"date"`
		Statut  string  `json:"statut"`
		PDF     string  `json:"pdf,omitempty"`
	}

	rows, err := database.DB.Query(`
		SELECT f.id_facture, f.numero_facture,
		       CONCAT(COALESCE(u.prenom,''), ' ', COALESCE(u.nom,'')) AS client,
		       COALESCE(py.type_paiement, 'abonnement') AS type_paiement,
		       f.montant_ht, f.tva, f.montant_ttc,
		       f.date_emission, f.statut, COALESCE(f.fichier_pdf,'')
		FROM facture f
		JOIN utilisateur u ON u.id_utilisateur = f.id_utilisateur
		LEFT JOIN paiement py ON py.id_paiement = f.id_paiement
		ORDER BY f.date_emission DESC
		LIMIT 20 OFFSET ?`, offset)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	factures := make([]FactureLigne, 0)
	for rows.Next() {
		var f FactureLigne
		var dateRaw []byte
		rows.Scan(&f.ID, &f.Num, &f.Client, &f.Type, &f.HT, &f.TVA, &f.TTC, &dateRaw, &f.Statut, &f.PDF)
		if len(dateRaw) >= 10 {
			f.Date = string(dateRaw[:10])
		}
		factures = append(factures, f)
	}

	// stats financières
	type Stats struct {
		TotalMois    float64 `json:"total_mois"`
		Abonnements  float64 `json:"abonnements"`
		Formations   float64 `json:"formations"`
		Impayees     float64 `json:"impayees"`
		NbImpayees   int     `json:"nb_impayees"`
	}
	var stats Stats
	mois := r.URL.Query().Get("mois")
	if mois == "" {
		mois = "%" // tous les mois si pas précisé
	}
	database.DB.QueryRow(`
		SELECT COALESCE(SUM(f.montant_ttc),0)
		FROM facture f WHERE f.statut='payee' AND DATE_FORMAT(f.date_emission,'%Y-%m') LIKE ?`, mois,
	).Scan(&stats.TotalMois)
	database.DB.QueryRow(`
		SELECT COALESCE(SUM(f.montant_ttc),0) FROM facture f
		LEFT JOIN paiement p ON p.id_paiement = f.id_paiement
		WHERE f.statut='payee' AND COALESCE(p.type_paiement,'abonnement')='abonnement'`,
	).Scan(&stats.Abonnements)
	database.DB.QueryRow(`
		SELECT COALESCE(SUM(f.montant_ttc),0) FROM facture f
		JOIN paiement p ON p.id_paiement = f.id_paiement
		WHERE f.statut='payee' AND p.type_paiement='evenement'`,
	).Scan(&stats.Formations)
	database.DB.QueryRow(`
		SELECT COALESCE(SUM(montant_ttc),0), COUNT(*) FROM facture WHERE statut='en_attente'`,
	).Scan(&stats.Impayees, &stats.NbImpayees)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"factures": factures,
		"stats":    stats,
	})
}

func UpdateAdminUser(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}
	var req struct {
		Nom       string `json:"nom"`
		Prenom    string `json:"prenom"`
		Email     string `json:"email"`
		Role      string `json:"role"`
		Statut    string `json:"statut"`
		Telephone string `json:"telephone"`
		Adresse   string `json:"adresse"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	actif := req.Statut == "actif"
	_, err = database.DB.Exec(
		`UPDATE utilisateur SET nom=?, prenom=?, email=?, role=?, actif=?, telephone=?, adresse=? WHERE id_utilisateur=?`,
		req.Nom, req.Prenom, req.Email, req.Role, actif, req.Telephone, req.Adresse, uint(id),
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur lors de la mise à jour"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
