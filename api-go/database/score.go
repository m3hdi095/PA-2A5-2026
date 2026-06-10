package database

// AddUpcyclingScore crédite des points à un particulier et log l'action dans score_log.
// Les erreurs sont silencieuses : le score est un bonus, pas un blocant.
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
