package handlers

// handlers pour mot de passe oublié et vérification email
// les tokens sont des hex aléatoires, expiration 1h pour reset et 24h pour email

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"upcycleconnect/api/config"
	"upcycleconnect/api/database"
	"upcycleconnect/api/utils"
)

func generateToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.Email == "" {
		http.Error(w, `{"error":"Email requis"}`, http.StatusBadRequest)
		return
	}

	// on répond toujours OK pour ne pas révéler si l'email existe
	w.Header().Set("Content-Type", "application/json")

	var userID uint
	var prenom string
	err := database.DB.QueryRow(
		`SELECT id_utilisateur, prenom FROM utilisateur WHERE email = ? AND actif = 1`, input.Email,
	).Scan(&userID, &prenom)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		return
	}

	token := generateToken()
	expires := time.Now().Add(1 * time.Hour)
	database.DB.Exec(
		`UPDATE utilisateur SET reset_pwd_token = ?, reset_pwd_expires = ? WHERE id_utilisateur = ?`,
		token, expires, userID,
	)

	body := utils.EmailResetPasswordBody(prenom, token, config.AppConfig.BaseURL)
	utils.SendEmail(input.Email, "Réinitialisation de votre mot de passe UpcycleConnect", body)

	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func ResetPassword(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Token      string `json:"token"`
		NouveauMdp string `json:"nouveau_mdp"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.Token == "" || input.NouveauMdp == "" {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	if len(input.NouveauMdp) < 8 {
		http.Error(w, `{"error":"Mot de passe trop court (min 8 caractères)"}`, http.StatusBadRequest)
		return
	}

	var userID uint
	var expires time.Time
	err := database.DB.QueryRow(
		`SELECT id_utilisateur, reset_pwd_expires FROM utilisateur WHERE reset_pwd_token = ?`, input.Token,
	).Scan(&userID, &expires)
	if err != nil || time.Now().After(expires) {
		http.Error(w, `{"error":"Lien expiré ou invalide"}`, http.StatusBadRequest)
		return
	}

	hashed, err := utils.HashPassword(input.NouveauMdp)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}

	database.DB.Exec(
		`UPDATE utilisateur SET mot_de_passe = ?, reset_pwd_token = NULL, reset_pwd_expires = NULL WHERE id_utilisateur = ?`,
		hashed, userID,
	)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "msg": "Mot de passe mis à jour"})
}

func SendVerificationEmail(userID uint, email, prenom string) {
	token := generateToken()
	database.DB.Exec(
		`UPDATE utilisateur SET email_token = ? WHERE id_utilisateur = ?`, token, userID,
	)
	body := utils.EmailVerificationBody(prenom, token, config.AppConfig.BaseURL)
	utils.SendEmail(email, "Activez votre compte UpcycleConnect", body)
}

func VerifyEmail(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprint(w, verifyPage("Token manquant", "Aucun token de vérification fourni.", ""))
		return
	}

	var userID uint
	var role string
	err := database.DB.QueryRow(
		`SELECT id_utilisateur, role FROM utilisateur WHERE email_token = ?`, token,
	).Scan(&userID, &role)
	if err != nil {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprint(w, verifyPage("Lien invalide ou déjà utilisé", "Ce lien a déjà été utilisé ou est expiré. Vous pouvez vous connecter directement si votre compte est actif.", ""))
		return
	}

	database.DB.Exec(
		`UPDATE utilisateur SET actif = 1, email_verifie = 1, email_token = NULL WHERE id_utilisateur = ?`, userID,
	)

	loginPaths := map[string]string{
		"particulier":   "/frontend-particuliers/index.html",
		"professionnel": "/frontend-prestataires/index.html",
		"salarie":       "/frontend-salaries/index.html",
	}
	loginPath, ok := loginPaths[role]
	if !ok {
		loginPath = "/index.html"
	}
	loginURL := config.AppConfig.BaseURL + loginPath

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprint(w, verifyPage("✓ Compte activé avec succès !", "Votre adresse email a été vérifiée. Vous allez être redirigé vers la page de connexion…", loginURL))
}

func verifyPage(titre, message, loginURL string) string {
	meta := ""
	link := ""
	if loginURL != "" {
		meta = fmt.Sprintf(`<meta http-equiv="refresh" content="4;url=%s">`, loginURL)
		link = fmt.Sprintf(`<p><a href="%s">Cliquer ici si la redirection ne fonctionne pas</a></p>`, loginURL)
	}
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">%s
<title>Vérification email UpcycleConnect</title>
<style>body{font-family:sans-serif;text-align:center;padding:80px 20px;color:#1c1917;background:#f9fafb}
h2{color:#0d9488;margin-bottom:16px}p{color:#57534e}a{color:#0d9488}</style>
</head>
<body>
<h2>%s</h2>
<p>%s</p>
%s
</body>
</html>`, meta, titre, message, link)
}
