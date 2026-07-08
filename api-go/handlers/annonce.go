package handlers

// tout ce qui touche aux annonces, creation, modif, suppression
// la verif "c'est bien mon annonce ?" se passe dans le service, pas ici

import (
	"upcycleconnect/api/middleware"
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"upcycleconnect/api/database"
	"upcycleconnect/api/models"
	"upcycleconnect/api/repositories"
	"upcycleconnect/api/services"
)

var annonceService = services.NewAnnonceService()

func CreateAnnonce(w http.ResponseWriter, r *http.Request) {
	// on prend que ce qu'il faut du body, le reste on ignore
	var input struct {
		Titre           string   `json:"titre"`
		Description     string   `json:"description"`
		TypeAnnonce     string   `json:"type_annonce"`
		Prix            float64  `json:"prix"`
		IDObjet         uint     `json:"id_objet"`
		CategorieID     *uint    `json:"categorie_id"`
		Etat            string   `json:"etat"`
		Localisation    string   `json:"localisation"`
		Latitude        *float64 `json:"latitude,omitempty"`
		Longitude       *float64 `json:"longitude,omitempty"`
		ProjetPotentiel string   `json:"projet_potentiel"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}

	// userID vient du token JWT, le client peut pas le falsifier
	userID := r.Context().Value(middleware.ContextUserID).(uint)

	// si l'objet est pas fourni on en fabrique un depuis le titre, c'est probablement pas parfait
	// TODO: laisser le front envoyer un vrai objet avec categorie etc.
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
		Titre:           input.Titre,
		Description:     input.Description,
		TypeAnnonce:     input.TypeAnnonce,
		Prix:            input.Prix,
		Localisation:    input.Localisation,
		Latitude:        input.Latitude,
		Longitude:       input.Longitude,
		IDUtilisateur:   userID,
		IDObjet:         objetID,
		ProjetPotentiel: input.ProjetPotentiel,
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
	filtre := r.URL.Query().Get("filter")
	projetPotentiel := r.URL.Query().Get("projet_potentiel")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	lang := r.URL.Query().Get("lang")
	if lang == "" {
		lang = "fr"
	}
	lat, _ := strconv.ParseFloat(r.URL.Query().Get("lat"), 64)
	lon, _ := strconv.ParseFloat(r.URL.Query().Get("lon"), 64)
	rayon, _ := strconv.ParseFloat(r.URL.Query().Get("rayon"), 64)

	listeAnnonces, err := annonceService.ListAnnonces(filtre, projetPotentiel, page, 20, lang, lat, lon, rayon)
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

	input.ID = uint(parsed)
	input.IDUtilisateur = userID

	// vérifier l'appartenance avant d'appeler le service
	var ownerID uint
	database.DB.QueryRow(`SELECT id_utilisateur FROM annonce WHERE id_annonce = ?`, input.ID).Scan(&ownerID)
	if ownerID == 0 {
		jsonError(w, "annonce introuvable", http.StatusNotFound)
		return
	}
	if ownerID != userID {
		jsonError(w, "accès interdit", http.StatusForbidden)
		return
	}

	if err := annonceService.UpdateAnnonce(&input); err != nil {
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
	offset := (page - 1) * 20

	rows, err := database.DB.Query(
		`SELECT a.id_annonce, a.titre, a.description, a.type_annonce, a.prix, a.statut, a.date_publication,
		        a.id_utilisateur, a.id_objet,
		        COALESCE(u.prenom,''), COALESCE(u.nom,'')
		 FROM annonce a
		 LEFT JOIN utilisateur u ON u.id_utilisateur = a.id_utilisateur
		 WHERE a.statut = 'en_attente'
		 ORDER BY a.date_publication ASC
		 LIMIT 20 OFFSET ?`, offset,
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type annonceAvecAuteur struct {
		models.Annonce
		AuteurPrenom string `json:"auteur_prenom"`
		AuteurNom    string `json:"auteur_nom"`
	}
	var annonces []annonceAvecAuteur
	for rows.Next() {
		var a annonceAvecAuteur
		rows.Scan(&a.ID, &a.Titre, &a.Description, &a.TypeAnnonce, &a.Prix, &a.Statut, &a.DatePublication,
			&a.IDUtilisateur, &a.IDObjet, &a.AuteurPrenom, &a.AuteurNom)
		annonces = append(annonces, a)
	}
	if annonces == nil {
		annonces = []annonceAvecAuteur{}
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

func RenouvelerAnnonce(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}
	var ownerID uint
	var statut string
	row := database.DB.QueryRow(`SELECT id_utilisateur, statut FROM annonce WHERE id_annonce = ?`, id)
	if err := row.Scan(&ownerID, &statut); err != nil || ownerID != userID {
		jsonError(w, "annonce introuvable ou accès interdit", http.StatusForbidden)
		return
	}
	if statut != "validee" {
		jsonError(w, "seules les annonces validées peuvent être renouvelées", http.StatusBadRequest)
		return
	}
	database.DB.Exec(`UPDATE annonce SET date_expiration = DATE_ADD(NOW(), INTERVAL 30 DAY) WHERE id_annonce = ?`, id)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "renouvelee"})
}

func ReserverAnnonce(w http.ResponseWriter, r *http.Request) {
	acheteurID := r.Context().Value(middleware.ContextUserID).(uint)
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}
	annonce, err := annonceService.GetAnnonce(uint(id))
	if err != nil || annonce == nil {
		jsonError(w, "annonce introuvable", http.StatusNotFound)
		return
	}
	if annonce.Statut != "validee" {
		jsonError(w, "cette annonce n'est plus disponible", http.StatusBadRequest)
		return
	}
	if acheteurID == annonce.IDUtilisateur {
		jsonError(w, "vous ne pouvez pas réserver votre propre annonce", http.StatusBadRequest)
		return
	}

	var req struct {
		PaymentIntentID string `json:"payment_intent_id"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	var montant float64
	commissionTaux := 10.0
	if annonce.TypeAnnonce == "vente" && annonce.Prix > 0 {
		montant = annonce.Prix
		if req.PaymentIntentID == "" {
			jsonError(w, "payment_intent_id requis pour une annonce payante", http.StatusPaymentRequired)
			return
		}
		paiementSvc := services.NewPaiementService()
		if err := paiementSvc.ConfirmPayment(req.PaymentIntentID); err != nil {
			jsonError(w, "paiement non confirmé par Stripe", http.StatusPaymentRequired)
			return
		}
		// 5 % pour les vendeurs professionnels premium, 10 % sinon
		var niveauAbo string
		database.DB.QueryRow(
			`SELECT niveau_abonnement FROM professionnel WHERE id_professionnel = ?`,
			annonce.IDUtilisateur,
		).Scan(&niveauAbo)
		if niveauAbo == "premium" {
			commissionTaux = 5.0
		}
	}

	_, dbErr := database.DB.Exec(
		`INSERT INTO transaction_achat (montant, commission_taux, statut, id_annonce, id_acheteur, id_vendeur)
		 VALUES (?, ?, 'payee', ?, ?, ?)`,
		montant, commissionTaux, annonce.ID, acheteurID, annonce.IDUtilisateur,
	)
	if dbErr != nil {
		log.Printf("ReserverAnnonce insert error: %v", dbErr)
		jsonError(w, "erreur lors de la réservation", http.StatusInternalServerError)
		return
	}
	database.DB.Exec(`UPDATE annonce SET statut = 'desactivee' WHERE id_annonce = ?`, annonce.ID)
	if annonce.TypeAnnonce == "vente" && annonce.Prix > 0 {
		go creerFactureManuel(acheteurID, "transaction")
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "reservee"})
}
