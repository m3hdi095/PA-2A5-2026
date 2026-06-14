package handlers

// export du planning personnel au format iCal (.ics)
// compatible Google Calendar, Apple Calendar, Outlook

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"upcycleconnect/api/database"
	"upcycleconnect/api/middleware"
	"upcycleconnect/api/utils"
)

func ExportPlanningIcal(w http.ResponseWriter, r *http.Request) {
	// le token peut venir du header Authorization OU du query param ?token= (pour les liens de téléchargement)
	userID, _ := r.Context().Value(middleware.ContextUserID).(uint)
	if userID == 0 {
		if tok := r.URL.Query().Get("token"); tok != "" {
			id, _, err := utils.ValidateJWT(tok)
			if err == nil {
				userID = id
			}
		}
	}
	if userID == 0 {
		http.Error(w, `{"error":"Non authentifié"}`, http.StatusUnauthorized)
		return
	}

	rows, err := database.DB.Query(
		`SELECT COALESCE(titre,''), date_heure, COALESCE(duree_minutes,60), COALESCE(notes,'')
		 FROM planning
		 WHERE id_utilisateur = ?
		 ORDER BY date_heure ASC`,
		userID,
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type entry struct {
		titre   string
		start   time.Time
		duree   int
		notes   string
	}
	var entries []entry
	for rows.Next() {
		var e entry
		rows.Scan(&e.titre, &e.start, &e.duree, &e.notes)
		entries = append(entries, e)
	}

	var sb strings.Builder
	sb.WriteString("BEGIN:VCALENDAR\r\n")
	sb.WriteString("VERSION:2.0\r\n")
	sb.WriteString("PRODID:-//UpcycleConnect//Planning//FR\r\n")
	sb.WriteString("CALSCALE:GREGORIAN\r\n")
	sb.WriteString("METHOD:PUBLISH\r\n")

	for i, e := range entries {
		endTime := e.start.Add(time.Duration(e.duree) * time.Minute)
		uid := fmt.Sprintf("planning-%d-%d@upcycleconnect", userID, i)
		sb.WriteString("BEGIN:VEVENT\r\n")
		sb.WriteString(fmt.Sprintf("UID:%s\r\n", uid))
		sb.WriteString(fmt.Sprintf("DTSTAMP:%s\r\n", time.Now().UTC().Format("20060102T150405Z")))
		sb.WriteString(fmt.Sprintf("DTSTART:%s\r\n", e.start.UTC().Format("20060102T150405Z")))
		sb.WriteString(fmt.Sprintf("DTEND:%s\r\n", endTime.UTC().Format("20060102T150405Z")))
		sb.WriteString(fmt.Sprintf("SUMMARY:%s\r\n", escapeIcal(e.titre)))
		if e.notes != "" {
			sb.WriteString(fmt.Sprintf("DESCRIPTION:%s\r\n", escapeIcal(e.notes)))
		}
		sb.WriteString("END:VEVENT\r\n")
	}

	sb.WriteString("END:VCALENDAR\r\n")

	w.Header().Set("Content-Type", "text/calendar; charset=utf-8")
	w.Header().Set("Content-Disposition", "attachment; filename=planning-upcycleconnect.ics")
	w.Write([]byte(sb.String()))
}

func escapeIcal(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, ";", "\\;")
	s = strings.ReplaceAll(s, ",", "\\,")
	s = strings.ReplaceAll(s, "\n", "\\n")
	return s
}
