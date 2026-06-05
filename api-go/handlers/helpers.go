package handlers

// helpers partagés entre les handlers
// au début on concaténait les erreurs en string, ca cassait si le message avait des guillemets

import (
	"encoding/json"
	"net/http"
)

// json.Encoder echappe les guillemets dans msg, fmt.Sprintf ne le ferait pas
func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	// on ignore l'erreur d'ecriture si la connexion est coupee
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
