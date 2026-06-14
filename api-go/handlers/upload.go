package handlers

// upload de photos pour les annonces
// max 10 fichiers, 2 Mo chacun, jpeg/png/webp uniquement

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"upcycleconnect/api/database"
	"upcycleconnect/api/middleware"
)

const (
	maxPhotoSize  = 2 << 20 // 2 Mo
	maxPhotos     = 10
	uploadDir     = "./uploads/annonces"
)

func UploadPhotosAnnonce(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	idStr := r.PathValue("id")
	annonceID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}

	// vérifier que l'annonce appartient à cet utilisateur
	var ownerID uint
	database.DB.QueryRow(`SELECT id_utilisateur FROM annonce WHERE id_annonce = ?`, annonceID).Scan(&ownerID)
	if ownerID != userID {
		http.Error(w, `{"error":"Accès interdit"}`, http.StatusForbidden)
		return
	}

	// vérifier le nombre de photos déjà existantes
	var nbExistantes int
	database.DB.QueryRow(`SELECT COUNT(*) FROM photo_annonce WHERE id_annonce = ?`, annonceID).Scan(&nbExistantes)

	if err := r.ParseMultipartForm(int64(maxPhotos) * maxPhotoSize); err != nil {
		http.Error(w, `{"error":"Formulaire invalide"}`, http.StatusBadRequest)
		return
	}

	files := r.MultipartForm.File["photos"]
	if len(files)+nbExistantes > maxPhotos {
		http.Error(w, fmt.Sprintf(`{"error":"Maximum %d photos par annonce"}`, maxPhotos), http.StatusBadRequest)
		return
	}

	os.MkdirAll(uploadDir, 0755)

	var urls []string
	ordre := nbExistantes

	for _, fh := range files {
		if fh.Size > maxPhotoSize {
			http.Error(w, `{"error":"Fichier trop lourd (max 2 Mo)"}`, http.StatusBadRequest)
			return
		}

		// vérifier le type MIME
		f, err := fh.Open()
		if err != nil {
			continue
		}
		header := make([]byte, 512)
		f.Read(header)
		mime := http.DetectContentType(header)
		f.Close()

		if !strings.HasPrefix(mime, "image/") {
			http.Error(w, `{"error":"Seules les images sont acceptées"}`, http.StatusBadRequest)
			return
		}

		// extension à partir du nom original
		ext := strings.ToLower(filepath.Ext(fh.Filename))
		if ext == "" {
			ext = ".jpg"
		}

		filename := fmt.Sprintf("%d_%d_%d%s", annonceID, userID, time.Now().UnixNano(), ext)
		dst := filepath.Join(uploadDir, filename)

		f2, _ := fh.Open()
		out, err := os.Create(dst)
		if err != nil {
			f2.Close()
			continue
		}
		io.Copy(out, f2)
		out.Close()
		f2.Close()

		url := fmt.Sprintf("/uploads/annonces/%s", filename)
		database.DB.Exec(
			`INSERT INTO photo_annonce (id_annonce, url, ordre) VALUES (?, ?, ?)`,
			annonceID, url, ordre,
		)
		urls = append(urls, url)
		ordre++
	}

	w.Header().Set("Content-Type", "application/json")
	if len(urls) == 0 {
		w.Write([]byte(`{"urls":[]}`))
		return
	}
	parts := make([]string, len(urls))
	for i, u := range urls {
		parts[i] = `"` + u + `"`
	}
	w.Write([]byte(`{"urls":[` + strings.Join(parts, ",") + `]}`))
}

func GetPhotosAnnonce(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	annonceID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}

	rows, err := database.DB.Query(
		`SELECT url FROM photo_annonce WHERE id_annonce = ? ORDER BY ordre ASC`, annonceID,
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var urls []string
	for rows.Next() {
		var u string
		rows.Scan(&u)
		urls = append(urls, `"`+u+`"`)
	}

	w.Header().Set("Content-Type", "application/json")
	if urls == nil {
		w.Write([]byte(`[]`))
		return
	}
	w.Write([]byte(`[` + strings.Join(urls, ",") + `]`))
}

func DeletePhotoAnnonce(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	photoID, err := strconv.ParseUint(r.PathValue("photoId"), 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}

	// vérifier la propriété via JOIN
	var url string
	var ownerID uint
	err = database.DB.QueryRow(
		`SELECT p.url, a.id_utilisateur FROM photo_annonce p
		 JOIN annonce a ON a.id_annonce = p.id_annonce
		 WHERE p.id_photo = ?`, photoID,
	).Scan(&url, &ownerID)
	if err != nil || ownerID != userID {
		http.Error(w, `{"error":"Accès interdit"}`, http.StatusForbidden)
		return
	}

	database.DB.Exec(`DELETE FROM photo_annonce WHERE id_photo = ?`, photoID)

	// supprimer le fichier physique
	if url != "" {
		os.Remove("." + url)
	}

	w.WriteHeader(http.StatusNoContent)
}
