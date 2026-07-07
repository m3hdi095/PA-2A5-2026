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

func EmailDepotBody(prenom, codeOuverture, codeBarre string) string {
	return fmt.Sprintf(`
<p>Bonjour %s,</p>
<p>Votre dépôt a bien été enregistré et est <strong>en attente de validation</strong>.</p>
<table style="border-collapse:collapse;margin:20px 0">
  <tr>
    <td style="padding:10px 16px;background:#f0fdf4;border-radius:8px 0 0 8px;font-size:13px;color:#555">Code d'ouverture du conteneur</td>
    <td style="padding:10px 20px;background:#0d9488;color:#fff;border-radius:0 8px 8px 0;font-size:22px;font-weight:700;letter-spacing:3px">%s</td>
  </tr>
</table>
<table style="border-collapse:collapse;margin:20px 0">
  <tr>
    <td style="padding:10px 16px;background:#f0fdf4;border-radius:8px 0 0 8px;font-size:13px;color:#555">Code barre de retrait</td>
    <td style="padding:10px 20px;background:#134e4a;color:#fff;border-radius:0 8px 8px 0;font-size:20px;font-weight:700;letter-spacing:2px;font-family:monospace">%s</td>
  </tr>
</table>
<p style="color:#666;font-size:13px">Conservez ce code — il vous sera demandé pour récupérer votre objet.</p>
<p>L'équipe UpcycleConnect</p>
`, prenom, codeOuverture, codeBarre)
}

func EmailInscriptionEvenementBody(prenom, titreEvent, dateEvent string) string {
	return fmt.Sprintf(`
<p>Bonjour %s,</p>
<p>Votre inscription à l'événement <strong>%s</strong> du %s a bien été enregistrée.</p>
<p>Vous recevrez un rappel 48h avant.</p>
<p>L'équipe UpcycleConnect</p>
`, prenom, titreEvent, dateEvent)
}

func EmailDepotValideBody(prenom, codeOuverture, codeBarre string) string {
	return fmt.Sprintf(`
<p>Bonjour %s,</p>
<p>Bonne nouvelle ! Votre dépôt a été <strong>validé</strong> par l'équipe UpcycleConnect.</p>
<p>Présentez ce code barre au conteneur pour déposer votre objet :</p>
<table style="border-collapse:collapse;margin:20px 0">
  <tr>
    <td style="padding:10px 16px;background:#f0fdf4;border-radius:8px 0 0 8px;font-size:13px;color:#555">Code d'ouverture du conteneur</td>
    <td style="padding:10px 20px;background:#0d9488;color:#fff;border-radius:0 8px 8px 0;font-size:22px;font-weight:700;letter-spacing:3px">%s</td>
  </tr>
</table>
<table style="border-collapse:collapse;margin:20px 0">
  <tr>
    <td style="padding:10px 16px;background:#f0fdf4;border-radius:8px 0 0 8px;font-size:13px;color:#555">Code barre de retrait</td>
    <td style="padding:10px 20px;background:#134e4a;color:#fff;border-radius:0 8px 8px 0;font-size:20px;font-weight:700;letter-spacing:2px;font-family:monospace">%s</td>
  </tr>
</table>
<p style="color:#666;font-size:13px">Conservez ce code — il sera scanné par le prestataire lors de la récupération de votre objet.</p>
<p>L'équipe UpcycleConnect</p>
`, prenom, codeOuverture, codeBarre)
}

func EmailValidationProBody(prenom string) string {
	return fmt.Sprintf(`
<p>Bonjour %s,</p>
<p>Bonne nouvelle ! Votre compte professionnel sur <strong>UpcycleConnect</strong> a été <strong>validé</strong> par notre équipe.</p>
<p>Vous pouvez dès maintenant vous connecter à votre espace et accéder à toutes les fonctionnalités professionnelles.</p>
<p><a href="https://upcycleconnect.com/frontend-prestataires/index.html" style="background:#0d9488;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Accéder à mon espace</a></p>
<p>L'équipe UpcycleConnect</p>
`, prenom)
}

func EmailRejetProBody(prenom string) string {
	return fmt.Sprintf(`
<p>Bonjour %s,</p>
<p>Après examen de votre dossier, nous ne sommes pas en mesure de valider votre compte professionnel sur <strong>UpcycleConnect</strong> pour le moment.</p>
<p>Si vous pensez qu'il s'agit d'une erreur ou si vous souhaitez soumettre des informations complémentaires, contactez-nous à <a href="mailto:contact@upcycleconnect.com">contact@upcycleconnect.com</a>.</p>
<p>L'équipe UpcycleConnect</p>
`, prenom)
}
