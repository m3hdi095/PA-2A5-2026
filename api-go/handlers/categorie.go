package handlers

// categories d'objets, lecture publique, les modifs passent par l'admin

import (
	"encoding/json"
	"net/http"
	"strconv"

	"upcycleconnect/api/models"
	"upcycleconnect/api/repositories"
)

var catRepo = repositories.CategorieRepository{}

func ListCategories(w http.ResponseWriter, r *http.Request) {
	// TODO: mettre un cache, cette liste change vraiment rarement et est appelée à chaque chargement
	cats, err := catRepo.List()
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	if cats == nil {
		cats = []models.Categorie{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cats)
}

func CreateCategorie(w http.ResponseWriter, r *http.Request) {
	var c models.Categorie
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	if c.Nom == "" {
		http.Error(w, `{"error":"Le nom est obligatoire"}`, http.StatusBadRequest)
		return
	}
	if err := catRepo.Create(&c); err != nil {
		http.Error(w, `{"error":"Erreur lors de la création"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(c)
}

func UpdateCategorie(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	parsed, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}
	var c models.Categorie
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	c.ID = uint(parsed)
	if err := catRepo.Update(&c); err != nil {
		http.Error(w, `{"error":"Erreur lors de la mise à jour"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func DeleteCategorie(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	parsed, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}
	// on prefixe le nom au lieu de supprimer, pour pas casser les objets déjà rattachés
	if err := catRepo.Delete(uint(parsed)); err != nil {
		http.Error(w, `{"error":"Erreur lors de la suppression"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
