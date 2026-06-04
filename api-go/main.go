package main

// Point d'entrée de l'API UpcycleConnect
// net/http stdlib, pas de framework pour rester leger
// TODO: si le projet grandit, envisager d'adopter Echo ou Fiber pour le routing avancé.

import (
    "log"
    "net/http"

    "upcycleconnect/api/config"
    "upcycleconnect/api/database"
    "upcycleconnect/api/handlers"
    "upcycleconnect/api/middleware"
)

func main() {
    // variables d'env en premier, la DB a besoin du DSN
    config.LoadConfig()

    // connexion MySQL, la fonction gere le panic si ca echoue
    database.Connect()

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

    // routes publiques
    mux.HandleFunc("POST /api/register", handlers.Register)
    mux.HandleFunc("POST /api/login", handlers.Login)
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

    // routes protegees (token JWT requis)

    // Profil utilisateur
    mux.HandleFunc("GET /api/users/me", middleware.AuthMiddleware(handlers.GetCurrentUser))
    mux.HandleFunc("PUT /api/users/me", middleware.AuthMiddleware(handlers.UpdateUser))
    // FIXME: le tutoriel devrait aussi vérifier que l'utilisateur est un particulier
    mux.HandleFunc("POST /api/users/tutorial", middleware.AuthMiddleware(handlers.MarkTutorialSeen))

    // annonces des particuliers
    mux.HandleFunc("GET /api/annonces/mes-annonces", middleware.AuthMiddleware(handlers.MesAnnonces))
    mux.HandleFunc("POST /api/annonces", middleware.AuthMiddleware(handlers.CreateAnnonce))
    mux.HandleFunc("PUT /api/annonces/{id}", middleware.AuthMiddleware(handlers.UpdateAnnonce))
    mux.HandleFunc("DELETE /api/annonces/{id}", middleware.AuthMiddleware(handlers.DeleteAnnonce))

    // Dépôts en conteneur
    mux.HandleFunc("POST /api/depots", middleware.AuthMiddleware(handlers.CreateDepot))
    mux.HandleFunc("GET /api/depots", middleware.AuthMiddleware(handlers.ListDepots))
    // reservee aux professionnels, le service verifie le role
    mux.HandleFunc("POST /api/depots/{id}/recuperer", middleware.AuthMiddleware(handlers.RecupererDepot))

    // Projets upcycling
    mux.HandleFunc("POST /api/projets", middleware.AuthMiddleware(handlers.CreateProjet))
    mux.HandleFunc("GET /api/projets/mes-projets", middleware.AuthMiddleware(handlers.ListMesProjets))
    mux.HandleFunc("POST /api/projets/{id}/etapes", middleware.AuthMiddleware(handlers.AddEtapeProjet))

    // evenements, inscriptions et planning
    mux.HandleFunc("POST /api/evenements", middleware.AuthMiddleware(handlers.CreateEvenement))
    mux.HandleFunc("PUT /api/evenements/{id}", middleware.AuthMiddleware(middleware.RoleMiddleware("admin", "salarie")(handlers.UpdateEvenement)))
    mux.HandleFunc("DELETE /api/evenements/{id}", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.DeleteEvenement)))
    mux.HandleFunc("POST /api/evenements/inscription", middleware.AuthMiddleware(handlers.InscrireEvenement))
    mux.HandleFunc("GET /api/evenements/mes-inscriptions", middleware.AuthMiddleware(handlers.MesInscriptions))

    // Planning personnel (salariés + tous utilisateurs)
    mux.HandleFunc("GET /api/planning/me", middleware.AuthMiddleware(handlers.GetMonPlanning))
    mux.HandleFunc("POST /api/planning", middleware.AuthMiddleware(handlers.CreatePlanningEntry))
    mux.HandleFunc("DELETE /api/planning/{id}", middleware.AuthMiddleware(handlers.DeletePlanningEntry))

    // paiements Stripe (sandbox pendant le dev)
    mux.HandleFunc("POST /api/create-payment-intent", middleware.AuthMiddleware(handlers.CreatePaymentIntent))
    mux.HandleFunc("POST /api/stripe-webhook", handlers.StripeWebhook) // webhook public signé par Stripe

    // Notifications push
    mux.HandleFunc("POST /api/notifications/send", middleware.AuthMiddleware(handlers.SendNotification))
    mux.HandleFunc("GET /api/notifications", middleware.AuthMiddleware(handlers.GetNotifications))
    mux.HandleFunc("PUT /api/notifications/{id}/read", middleware.AuthMiddleware(handlers.MarkNotificationRead))

    // traductions, ecriture reservee a l'admin
    mux.HandleFunc("POST /api/traductions", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.AddTraduction)))

    // Conseils (articles rédigés par les salariés)
    mux.HandleFunc("GET /api/conseils", middleware.AuthMiddleware(handlers.ListConseils))
    mux.HandleFunc("GET /api/conseils/mes-articles", middleware.AuthMiddleware(handlers.MesConseils))
    mux.HandleFunc("POST /api/conseils", middleware.AuthMiddleware(handlers.CreateConseil))
    mux.HandleFunc("PUT /api/conseils/{id}", middleware.AuthMiddleware(handlers.UpdateConseil))
    mux.HandleFunc("POST /api/admin/conseils/valider", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.ValiderConseil)))

    // forum et moderation
    mux.HandleFunc("GET /api/forum", middleware.AuthMiddleware(handlers.ListForumMessages))
    mux.HandleFunc("POST /api/forum/messages", middleware.AuthMiddleware(handlers.PostForumMessage))
    mux.HandleFunc("POST /api/forum/signalements", middleware.AuthMiddleware(handlers.SignalerMessage))
    mux.HandleFunc("GET /api/forum/signalements", middleware.AuthMiddleware(handlers.ListSignalements))
    mux.HandleFunc("PUT /api/forum/signalements/{id}", middleware.AuthMiddleware(handlers.TraiterSignalement))

    // Abonnements professionnels
    mux.HandleFunc("GET /api/abonnements/me", middleware.AuthMiddleware(handlers.GetMonAbonnement))
    mux.HandleFunc("POST /api/abonnements/upgrade", middleware.AuthMiddleware(handlers.UpgradeAbonnement))
    mux.HandleFunc("POST /api/abonnements/resilier", middleware.AuthMiddleware(handlers.ResilierAbonnement))
    mux.HandleFunc("GET /api/abonnements/factures", middleware.AuthMiddleware(handlers.MesFacturesAbonnement))

    // Upcycling Score
    mux.HandleFunc("GET /api/score", middleware.AuthMiddleware(handlers.GetScore))

    // back-office admin
    mux.HandleFunc("GET /api/admin/stats", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.GetAdminStats)))
    mux.HandleFunc("GET /api/admin/users", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.ListUsers)))
    mux.HandleFunc("PUT /api/admin/users/{id}", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.UpdateAdminUser)))
    mux.HandleFunc("PUT /api/admin/users/{id}/activate", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.ActivateUser)))
    // soft delete RGPD, pas de suppression physique
    mux.HandleFunc("DELETE /api/admin/users/{id}", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.SoftDeleteUser)))
    mux.HandleFunc("GET /api/admin/annonces/en-attente", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.ListPendingAnnonces)))
    mux.HandleFunc("POST /api/admin/annonces/validate", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.ValidateAnnonce)))
    mux.HandleFunc("POST /api/admin/evenements/validate", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.ValidateEvenement)))
    mux.HandleFunc("GET /api/admin/depots/en-attente", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.ListDepotsEnAttente)))
    // categories en lecture publique, admin en ecriture
    mux.HandleFunc("POST /api/categories", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.CreateCategorie)))
    mux.HandleFunc("PUT /api/categories/{id}", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.UpdateCategorie)))
    mux.HandleFunc("DELETE /api/categories/{id}", middleware.AuthMiddleware(middleware.RoleMiddleware("admin")(handlers.DeleteCategorie)))

    // CORS pour les appels du front en dev
    handler := middleware.CORS(mux)

    log.Println("API UpcycleConnect démarrée sur le port 8080")
    log.Fatal(http.ListenAndServe(":8080", handler))
}
