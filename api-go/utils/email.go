package utils

// envoi d'emails transactionnels via SMTP
// les credentials viennent de la config (variables d'environnement)

import (
	"fmt"
	"net/smtp"
	"strings"

	"upcycleconnect/api/config"
)

func SendEmail(to, subject, body string) error {
	cfg := config.AppConfig
	if cfg.SMTPUser == "" {
		// pas de config SMTP, on log juste pour le dev
		fmt.Printf("[EMAIL] À:%s | Sujet:%s\n%s\n", to, subject, body)
		return nil
	}

	auth := smtp.PlainAuth("", cfg.SMTPUser, cfg.SMTPPass, cfg.SMTPHost)
	addr := fmt.Sprintf("%s:%d", cfg.SMTPHost, cfg.SMTPPort)

	msg := strings.Join([]string{
		fmt.Sprintf("From: UpcycleConnect <%s>", cfg.SMTPUser),
		fmt.Sprintf("To: %s", to),
		fmt.Sprintf("Subject: %s", subject),
		"MIME-Version: 1.0",
		"Content-Type: text/html; charset=UTF-8",
		"",
		body,
	}, "\r\n")

	return smtp.SendMail(addr, auth, cfg.SMTPUser, []string{to}, []byte(msg))
}

func EmailVerificationBody(prenom, token, baseURL string) string {
	link := fmt.Sprintf("%s/api/verify-email?token=%s", baseURL, token)
	return fmt.Sprintf(`
<p>Bonjour %s,</p>
<p>Merci de votre inscription sur <strong>UpcycleConnect</strong>.</p>
<p>Cliquez sur le lien ci-dessous pour activer votre compte :</p>
<p><a href="%s" style="background:#0d9488;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Activer mon compte</a></p>
<p>Ce lien est valable 24h.</p>
<p>L'équipe UpcycleConnect</p>
`, prenom, link)
}

func EmailResetPasswordBody(prenom, token, baseURL string) string {
	link := fmt.Sprintf("%s/reset-password.html?token=%s", baseURL, token)
	return fmt.Sprintf(`
<p>Bonjour %s,</p>
<p>Vous avez demandé la réinitialisation de votre mot de passe sur <strong>UpcycleConnect</strong>.</p>
<p><a href="%s" style="background:#0d9488;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Réinitialiser mon mot de passe</a></p>
<p>Ce lien est valable 1h. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
<p>L'équipe UpcycleConnect</p>
`, prenom, link)
}

func EmailInscriptionEvenementBody(prenom, titreEvent, dateEvent string) string {
	return fmt.Sprintf(`
<p>Bonjour %s,</p>
<p>Votre inscription à l'événement <strong>%s</strong> du %s a bien été enregistrée.</p>
<p>Vous recevrez un rappel 48h avant.</p>
<p>L'équipe UpcycleConnect</p>
`, prenom, titreEvent, dateEvent)
}
