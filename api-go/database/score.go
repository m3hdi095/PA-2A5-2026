package database

// ajoute des points upcycling et log l'action en base
// on ignore les erreurs ici, si le score plante c'est pas grave, c'est juste un bonus
func AddUpcyclingScore(userID uint, points int, motif string) {
	DB.Exec(
		`INSERT INTO score_log (id_particulier, points, motif) VALUES (?, ?, ?)`,
		userID, points, motif,
	)
	DB.Exec(
		`UPDATE particulier SET upcycling_score_total = COALESCE(upcycling_score_total, 0) + ? WHERE id_particulier = ?`,
		points, userID,
	)
}
