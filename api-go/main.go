package main

// Point d'entrée de l'API UpcycleConnect
// net/http stdlib, pas de framework pour rester leger
// TODO: si le projet grandit, envisager d'adopter Echo ou Fiber pour le routing avancé.

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"upcycleconnect/api/config"
	"upcycleconnect/api/database"
	"upcycleconnect/api/handlers"
	"upcycleconnect/api/middleware"
	"upcycleconnect/api/services"
	"upcycleconnect/api/utils"
)

func main() {
	// variables d'env en premier, la DB a besoin du DSN
	config.LoadConfig()

	// connexion MySQL, la fonction gere le panic si ca echoue
	database.Connect()

	// expiration automatique des dépôts non récupérés après 7 jours
	go func() {
		svc := services.NewConteneurService()
		for {
			svc.ExpireOldDepots()
			time.Sleep(1 * time.Hour)
		}
	}()

	// rappels 48h avant les événements (email + push)
	go func() {
		svc := services.NewEvenementService()
		for {
			svc.EnvoyerRappels()
			time.Sleep(1 * time.Hour)
		}
	}()

	// notification 30 jours avant expiration des contrats pro
	go func() {
		for {
			notifierContratsExpirants()
			time.Sleep(24 * time.Hour)
		}
	}()

	mux := http.NewServeMux()

	// route de sante pour verifier que l'API tourne
	mux.HandleFunc("GET /api", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","service":"UpcycleConnect API"}`))
	})
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","service":"UpcycleConnect API"}`))
	})

	// fichiers uploadés (photos annonces, etc.)
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads/"))))

	// routes publiques
	mux.HandleFunc("GET /api/public/stats", handlers.PublicStats)
	mux.HandleFunc("POST /api/register", handlers.Register)
	mux.HandleFunc("POST /api/login", handlers.Login)
	mux.HandleFunc("POST /api/forgot-password", handlers.ForgotPassword)
	mux.HandleFunc("POST /api/reset-password", handlers.ResetPassword)
	mux.HandleFunc("GET /api/verify-email", handlers.VerifyEmail)
	// les frontends prestataires et salaries utilisent /auth/login, on mappe sur le meme handler
	mux.HandleFunc("POST /api/auth/login", handlers.Login)
	mux.HandleFunc("POST /api/auth/register", handlers.Register)
	mux.HandleFunc("GET /api/annonces", handlers.ListAnnonces)
	mux.HandleFunc("GET /api/conteneurs", handlers.ListConteneurs)
	mux.HandleFunc("GET /api/evenements", handlers.ListEvenements)
	mux.HandleFunc("GET /api/projets", handlers.ListProjetsPublics)
	mux.HandleFunc("GET /api/categories", handlers.ListCategories)
	// traductions en lecture publique, l'ecriture est admin-only plus bas
	mux.HandleFunc("GET /api/traductions/{table}/{id}/{langue}", handlers.GetTraduction)
	// configuration publique (clé Stripe publishable, pas de secret)
	mux.HandleFunc("GET /api/config", handlers.GetPublicConfig)

	// routes protegees (token JWT requis)

	// Profil utilisateur
	mux.HandleFunc("GET /api/users/me", middleware.AuthMiddleware(handlers.GetCurrentUser))
	mux.HandleFunc("PUT /api/users/me", middleware.AuthMiddleware(handlers.UpdateUser))
	mux.HandleFunc("DELETE /api/users/me", middleware.AuthMiddleware(handlers.DeactivateMyAccount))
	mux.HandleFunc("POST /api/users/change-password", middleware.AuthMiddleware(handlers.ChangePassword))
	mux.HandleFunc("POST /api/users/tutorial", middleware.AuthMiddleware(handlers.MarkTutorialSeen))
	// FIXME: le tutoriel devrait aussi vérifier que l'utilisateur est un particulier

	// annonces des particuliers
	mux.HandleFunc("GET /api/annonces/mes-annonces", middleware.AuthMiddleware(handlers.MesAnnonces))
	mux.HandleFunc("POST /api/annonces/{id}/renouveler", middleware.AuthMiddleware(handlers.RenouvelerAnnonce))
	mux.HandleFunc("POST /api/annonces", middleware.AuthMiddleware(handlers.CreateAnnonce))
	mux.HandleFunc("PUT /api/annonces/{id}", middleware.AuthMiddleware(handlers.UpdateAnnonce))
	mux.HandleFunc("DELETE /api/annonces/{id}", middleware.AuthMiddleware(handlers.DeleteAnnonce))
	mux.HandleFunc("POST /api/annonces/{id}/reserver", middleware.AuthMiddleware(handlers.ReserverAnnonce))
	// photos annonces
	mux.HandleFunc("GET /api/annonces/{id}/photos", handlers.GetPhotosAnnonce)
	mux.HandleFunc("POST /api/annonces/{id}/photos", middleware.AuthMiddleware(handlers.UploadPhotosAnnonce))
	mux.HandleFunc("DELETE /api/annonces/{id}/photos/{photoId}", middleware.AuthMiddleware(handlers.DeletePhotoAnnonce))
	// messagerie annonce (style LeBonCoin)
	mux.HandleFunc("GET /api/annonces/mes-conversations", middleware.AuthMiddleware(handlers.MesConversations))
	mux.HandleFunc("GET /api/annonces/mes-conversations/count", middleware.AuthMiddleware(handlers.CountMessagesNonLus))
	mux.HandleFunc("GET /api/annonces/{id}/messages", middleware.AuthMiddleware(handlers.GetMessagesAnnonce))
	mux.HandleFunc("POST /api/annonces/{id}/messages", middleware.AuthMiddleware(handlers.SendMessageAnnonce))
	// favoris
	mux.HandleFunc("GET /api/annonces/favoris", middleware.AuthMiddleware(handlers.GetFavoris))
	mux.HandleFunc("POST /api/annonces/{id}/favori", middleware.AuthMiddleware(handlers.ToggleFavori))

	// Dépôts en conteneur
	mux.HandleFunc("POST /api/depots", middleware.AuthMiddleware(handlers.CreateDepot))
	mux.HandleFunc("GET /api/depots", middleware.AuthMiddleware(handlers.ListDepots))
	// reservee aux professionnels, le service verifie le role
	mux.HandleFunc("POST /api/depots/{id}/recuperer", middleware.AuthMiddleware(handlers.RecupererDepot))
	mux.HandleFunc("POST /api/depots/recuperer-par-code", middleware.AuthMiddleware(handlers.RecupererDepotParCode))
	mux.HandleFunc("GET /api/depots/infos-code", middleware.AuthMiddleware(handlers.InfosCodeDepot))

	// Projets upcycling
	mux.HandleFunc("POST /api/projets", middleware.AuthMiddleware(handlers.CreateProjet))
	mux.HandleFunc("GET /api/projets/mes-projets", middleware.AuthMiddleware(handlers.ListMesProjets))
	mux.HandleFunc("PUT /api/projets/{id}", middleware.AuthMiddleware(handlers.UpdateProjet))
	mux.HandleFunc("POST /api/projets/{id}/etapes", middleware.AuthMiddleware(handlers.AddEtapeProjet))

	// evenements, inscriptions et planning
	mux.HandleFunc("POST /api/evenements", middleware.AuthMiddleware(handlers.CreateEvenement))
	mux.HandleFunc("PUT /api/evenements/{id}", middleware.AuthMiddleware(middleware.RoleMiddleware("admin", "salarie")(handlers.UpdateEvenement)))
	mux.HandleFunc("DELETE /api/evenements/{id}", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.DeleteEvenement)))
	mux.HandleFunc("PUT /api/evenements/{id}/annuler", middleware.AuthMiddleware(middleware.RoleMiddleware("salarie")(handlers.AnnulerEvenementSalarie)))
	mux.HandleFunc("POST /api/evenements/inscription", middleware.AuthMiddleware(handlers.InscrireEvenement))
	mux.HandleFunc("DELETE /api/evenements/{id}/inscription", middleware.AuthMiddleware(handlers.SeDesinscrire))
	mux.HandleFunc("GET /api/evenements/mes-inscriptions", middleware.AuthMiddleware(handlers.MesInscriptions))

	// Planning personnel (salariés + tous utilisateurs)
	mux.HandleFunc("GET /api/planning/me", middleware.AuthMiddleware(handlers.GetMonPlanning))
	mux.HandleFunc("POST /api/planning", middleware.AuthMiddleware(handlers.CreatePlanningEntry))
	mux.HandleFunc("DELETE /api/planning/{id}", middleware.AuthMiddleware(handlers.DeletePlanningEntry))
	mux.HandleFunc("GET /api/planning/export.ics", middleware.AuthMiddleware(handlers.ExportPlanningIcal))

	// paiements Stripe (sandbox pendant le dev)
	mux.HandleFunc("POST /api/create-payment-intent", middleware.AuthMiddleware(handlers.CreatePaymentIntent))
	mux.HandleFunc("POST /api/stripe-webhook", handlers.StripeWebhook) // webhook public signé par Stripe

	// Notifications push
	mux.HandleFunc("POST /api/notifications/send", middleware.AuthMiddleware(handlers.SendNotification))
	mux.HandleFunc("POST /api/admin/notifications", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.BroadcastNotification)))
	mux.HandleFunc("GET /api/admin/notifications/history", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.GetNotificationHistory)))
	mux.HandleFunc("GET /api/notifications", middleware.AuthMiddleware(handlers.GetNotifications))
	mux.HandleFunc("PUT /api/notifications/read-all", middleware.AuthMiddleware(handlers.MarkAllNotificationsRead))
	mux.HandleFunc("PUT /api/notifications/{id}/read", middleware.AuthMiddleware(handlers.MarkNotificationRead))
	mux.HandleFunc("POST /api/notifications/register-player", middleware.AuthMiddleware(handlers.RegisterPlayerID))

	// traductions, ecriture reservee a l'admin
	mux.HandleFunc("POST /api/traductions", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.AddTraduction)))

	// Conseils (articles rédigés par les salariés)
	mux.HandleFunc("GET /api/conseils", middleware.AuthMiddleware(handlers.ListConseils))
	mux.HandleFunc("GET /api/conseils/mes-articles", middleware.AuthMiddleware(handlers.MesConseils))
	mux.HandleFunc("POST /api/conseils", middleware.AuthMiddleware(handlers.CreateConseil))
	mux.HandleFunc("PUT /api/conseils/{id}", middleware.AuthMiddleware(handlers.UpdateConseil))
	mux.HandleFunc("DELETE /api/conseils/{id}", middleware.AuthMiddleware(handlers.DeleteConseil))
	mux.HandleFunc("GET /api/admin/conseils/en-attente", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.AdminListConseils)))
	mux.HandleFunc("POST /api/admin/conseils/valider", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.ValiderConseil)))
	// stats et commentaires conseils
	mux.HandleFunc("POST /api/conseils/{id}/vue", middleware.AuthMiddleware(handlers.VueConseil))
	mux.HandleFunc("POST /api/conseils/{id}/like", middleware.AuthMiddleware(handlers.LikeConseil))
	mux.HandleFunc("GET /api/conseils/{id}/commentaires", middleware.AuthMiddleware(handlers.ListCommentairesConseil))
	mux.HandleFunc("POST /api/conseils/{id}/commentaires", middleware.AuthMiddleware(handlers.CreateCommentaireConseil))
	mux.HandleFunc("GET /api/commentaires/en-attente", middleware.AuthMiddleware(handlers.ListCommentairesEnAttente))
	mux.HandleFunc("PUT /api/commentaires/{id}/moderer", middleware.AuthMiddleware(handlers.ModererCommentaire))

	// forum et moderation
	mux.HandleFunc("GET /api/forum", middleware.AuthMiddleware(handlers.ListForumMessages))
	mux.HandleFunc("POST /api/forum/messages", middleware.AuthMiddleware(handlers.PostForumMessage))
	mux.HandleFunc("POST /api/forum/signalements", middleware.AuthMiddleware(handlers.SignalerMessage))
	mux.HandleFunc("GET /api/forum/signalements", middleware.AuthMiddleware(handlers.ListSignalements))
	mux.HandleFunc("PUT /api/forum/signalements/{id}", middleware.AuthMiddleware(handlers.TraiterSignalement))

	// Alertes matériaux (professionnels)
	mux.HandleFunc("GET /api/alertes", middleware.AuthMiddleware(handlers.GetAlertes))
	mux.HandleFunc("POST /api/alertes", middleware.AuthMiddleware(handlers.CreateAlerte))
	mux.HandleFunc("DELETE /api/alertes/{id}", middleware.AuthMiddleware(handlers.DeleteAlerte))

	// Abonnements professionnels
	mux.HandleFunc("GET /api/abonnements/me", middleware.AuthMiddleware(handlers.GetMonAbonnement))
	mux.HandleFunc("POST /api/abonnements/upgrade", middleware.AuthMiddleware(handlers.UpgradeAbonnement))
	mux.HandleFunc("POST /api/abonnements/resilier", middleware.AuthMiddleware(handlers.ResilierAbonnement))
	mux.HandleFunc("GET /api/abonnements/factures", middleware.AuthMiddleware(handlers.MesFacturesAbonnement))
	mux.HandleFunc("GET /api/paiements/mes-factures", middleware.AuthMiddleware(handlers.MesFactures))

	// Upcycling Score
	mux.HandleFunc("GET /api/score", middleware.AuthMiddleware(handlers.GetScore))
	// stats consolidées prestataire (kg, co2, dépôts, projets)
	mux.HandleFunc("GET /api/stats/pro", middleware.AuthMiddleware(handlers.StatsPro))
	// Questionnaires satisfaction post-événement
	mux.HandleFunc("POST /api/evenements/{id}/questionnaire", middleware.AuthMiddleware(handlers.CreateQuestionnaire))
	mux.HandleFunc("GET /api/evenements/{id}/questionnaire", middleware.AuthMiddleware(handlers.GetQuestionnaire))
	mux.HandleFunc("POST /api/questionnaires/{qid}/envoyer", middleware.AuthMiddleware(handlers.EnvoyerQuestionnaire))
	mux.HandleFunc("POST /api/questionnaires/{qid}/repondre", middleware.AuthMiddleware(handlers.RepondreQuestionnaire))
	mux.HandleFunc("GET /api/questionnaires/{qid}/reponses", middleware.AuthMiddleware(handlers.GetReponsesQuestionnaire))

	// back-office admin
	mux.HandleFunc("GET /api/admin/factures", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.AdminFactures)))
	mux.HandleFunc("GET /api/admin/publicites", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.ListPublicites)))
	mux.HandleFunc("POST /api/admin/publicites", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.CreatePublicite)))
	mux.HandleFunc("PUT /api/admin/publicites/{id}/statut", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.UpdatePubliciteStatut)))
	mux.HandleFunc("DELETE /api/admin/publicites/{id}", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.DeletePublicite)))
	mux.HandleFunc("GET /api/publicites/mes-campagnes", middleware.AuthMiddleware(handlers.MesCampagnes))
	mux.HandleFunc("POST /api/publicites/demande", middleware.AuthMiddleware(handlers.DemanderPublicite))
	mux.HandleFunc("GET /api/contrats/mon-contrat", middleware.AuthMiddleware(handlers.MonContrat))
	mux.HandleFunc("GET /api/admin/contrats", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.AdminListContrats)))
	mux.HandleFunc("PUT /api/admin/contrats/{id}/statut", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.AdminUpdateContratStatut)))
	mux.HandleFunc("GET /api/admin/stats", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.GetAdminStats)))
	mux.HandleFunc("GET /api/admin/alertes", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.GetAdminAlertes)))
	mux.HandleFunc("GET /api/admin/users", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.ListUsers)))
	mux.HandleFunc("GET /api/admin/users/counts", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.CountUsersByRole)))
	mux.HandleFunc("POST /api/admin/users", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.AdminCreateUser)))
	mux.HandleFunc("PUT /api/admin/users/{id}", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.UpdateAdminUser)))
	mux.HandleFunc("PUT /api/admin/users/{id}/activate", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.ActivateUser)))
	// soft delete RGPD, pas de suppression physique
	mux.HandleFunc("DELETE /api/admin/users/{id}", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.SoftDeleteUser)))
	mux.HandleFunc("GET /api/admin/projets/en-attente", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.AdminListProjetsEnAttente)))
	mux.HandleFunc("POST /api/admin/projets/validate", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.AdminValiderProjet)))
	mux.HandleFunc("GET /api/admin/annonces/en-attente", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.ListPendingAnnonces)))
	mux.HandleFunc("POST /api/admin/annonces/validate", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.ValidateAnnonce)))
	mux.HandleFunc("POST /api/admin/evenements/validate", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.ValidateEvenement)))
	mux.HandleFunc("GET /api/admin/evenements", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.AdminListEvenements)))
	mux.HandleFunc("GET /api/admin/evenements/en-attente", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.ListEvenementsEnAttente)))
	mux.HandleFunc("GET /api/evenements/mes-creations", middleware.AuthMiddleware(handlers.MesCreations))
	mux.HandleFunc("GET /api/admin/depots/en-attente", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.ListDepotsEnAttente)))
	mux.HandleFunc("POST /api/admin/depots/validate", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.ValidateDepotAdmin)))
	mux.HandleFunc("POST /api/admin/tournees", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.CreateTournee)))
	mux.HandleFunc("GET /api/admin/tournees", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.ListTournees)))
	mux.HandleFunc("POST /api/admin/conteneurs", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.CreateConteneur)))
	mux.HandleFunc("PUT /api/admin/conteneurs/{id}/statut", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.UpdateConteneurStatut)))
	// categories en lecture publique, admin en ecriture
	mux.HandleFunc("POST /api/categories", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.CreateCategorie)))
	mux.HandleFunc("PUT /api/categories/{id}", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.UpdateCategorie)))
	mux.HandleFunc("DELETE /api/categories/{id}", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.DeleteCategorie)))
	mux.HandleFunc("GET /api/admin/config", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.GetAdminConfig)))
	mux.HandleFunc("PUT /api/admin/config", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.UpdateAdminConfig)))

	// CORS pour les appels du front en dev
	handler := middleware.CORS(mux)

	log.Println("API UpcycleConnect démarrée sur le port 8080")
	log.Fatal(http.ListenAndServe(":8080", handler))
}

func notifierContratsExpirants() {
	rows, err := database.DB.Query(
		`SELECT c.id_contrat, c.type_contrat, c.date_fin, u.email, u.prenom
         FROM contrat c
         JOIN professionnel p ON p.id_professionnel = c.id_professionnel
         JOIN utilisateur u ON u.id_utilisateur = p.id_utilisateur
         WHERE c.statut = 'actif'
           AND c.date_fin BETWEEN CURDATE() + INTERVAL 29 DAY AND CURDATE() + INTERVAL 30 DAY`)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var id uint
		var typeContrat, email, prenom string
		var dateFin string
		if err := rows.Scan(&id, &typeContrat, &dateFin, &email, &prenom); err != nil {
			continue
		}
		body := fmt.Sprintf(`<p>Bonjour %s,</p>
<p>Votre contrat <strong>%s</strong> arrive à expiration le <strong>%s</strong>.</p>
<p>Connectez-vous à votre espace professionnel pour le renouveler.</p>`, prenom, typeContrat, dateFin)
		utils.SendEmail(email, "Votre contrat UpcycleConnect expire bientôt", body)
	}
}
