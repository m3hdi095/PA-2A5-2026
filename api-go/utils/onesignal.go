package utils

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"

	"upcycleconnect/api/config"
	"upcycleconnect/api/database"
)

type OneSignalRequest struct {
	AppID            string                   `json:"app_id"`
	Contents         map[string]string        `json:"contents"`
	Headings         map[string]string        `json:"headings"`
	IncludePlayerIDs []string                 `json:"include_player_ids,omitempty"`
	Filters          []map[string]interface{} `json:"filters,omitempty"`
	IncludedSegments []string                 `json:"included_segments,omitempty"`
}

func getPlayerID(userID uint) (string, error) {
	var playerID string
	err := database.DB.QueryRow(
		`SELECT COALESCE(onesignal_player_id,'') FROM utilisateur WHERE id_utilisateur = ?`, userID,
	).Scan(&playerID)
	if err != nil || playerID == "" {
		return "", errors.New("player_id introuvable")
	}
	return playerID, nil
}

func sendNotification(reqBody OneSignalRequest) error {
	jsonBody, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "https://onesignal.com/api/v1/notifications", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Basic "+config.AppConfig.OneSignalKey)
	resp, err := (&http.Client{}).Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func SendPushNotification(userID uint, title, message string) error {
	playerID, err := getPlayerID(userID)
	if err != nil {
		return err
	}
	return sendNotification(OneSignalRequest{
		AppID:            config.AppConfig.OneSignalAppID,
		Contents:         map[string]string{"en": message, "fr": message},
		Headings:         map[string]string{"en": title, "fr": title},
		IncludePlayerIDs: []string{playerID},
	})
}


func BroadcastPushNotification(segment, title, message string) error {
	reqBody := OneSignalRequest{
		AppID:    config.AppConfig.OneSignalAppID,
		Contents: map[string]string{"en": message, "fr": message},
		Headings: map[string]string{"en": title, "fr": title},
	}
	if segment == "" || segment == "all" {
		reqBody.IncludedSegments = []string{"All"}
	} else {
		reqBody.Filters = []map[string]interface{}{
			{"field": "tag", "key": "role", "relation": "=", "value": segment},
		}
	}
	jsonBody, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "https://onesignal.com/api/v1/notifications", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Basic "+config.AppConfig.OneSignalKey)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}
