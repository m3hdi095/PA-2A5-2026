package utils

import (
    "bytes"
    "encoding/json"
    "net/http"

    "upcycleconnect/api/config"
)

type OneSignalRequest struct {
    AppID             string                   `json:"app_id"`
    Contents          map[string]string        `json:"contents"`
    Headings          map[string]string        `json:"headings"`
    IncludePlayerIDs  []string                 `json:"include_player_ids,omitempty"`
    Filters           []map[string]interface{} `json:"filters,omitempty"`
    IncludedSegments  []string                 `json:"included_segments,omitempty"`
}

func SendPushNotification(userID uint, title, message string) error {
    reqBody := OneSignalRequest{
        AppID: config.AppConfig.OneSignalAppID,
        Contents: map[string]string{
            "en": message,
            "fr": message,
        },
        Headings: map[string]string{
            "en": title,
            "fr": title,
        },
        Filters: []map[string]interface{}{
            {
                "field":    "tag",
                "key":      "user_id",
                "relation": "=",
                "value":    userID,
            },
        },
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

func BroadcastPushNotification(segment, title, message string) error {
    reqBody := OneSignalRequest{
        AppID: config.AppConfig.OneSignalAppID,
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