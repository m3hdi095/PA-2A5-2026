package config

import (
    "log"
    "os"
    "strconv"

    "github.com/joho/godotenv"
)

type Config struct {
    DBHost     string
    DBPort     string
    DBUser     string
    DBPassword string
    DBName     string
    JWTSecret  string
    StripeKey       string
    StripePublicKey string
    StripeWebhookSecret string
    OneSignalAppID string
    OneSignalKey   string
    SMTPHost   string
    SMTPPort   int
    SMTPUser   string
    SMTPPass   string
    BaseURL    string
}

var AppConfig *Config

// charge le .env, si y'a pas de .env on tombe sur les vars d'env système
func LoadConfig() {
    err := godotenv.Load()
    if err != nil {
        log.Println(" .env non trouvé, utilisation des variables d'environnement système")
    }

    smtpPort, _ := strconv.Atoi(getEnv("SMTP_PORT", "587"))

    AppConfig = &Config{
        DBHost:     getEnv("DB_HOST", "localhost"),
        DBPort:     getEnv("DB_PORT", "3306"),
        DBUser:     getEnv("DB_USER", "root"),
        DBPassword: getEnv("DB_PASSWORD", ""),
        DBName:     getEnv("DB_NAME", "upcycleconnect"),
        JWTSecret:  getEnv("JWT_SECRET", "defaultsecret"),
        StripeKey:           getEnv("STRIPE_SECRET_KEY", ""),
        StripePublicKey:     getEnv("STRIPE_PUBLIC_KEY", ""),
        StripeWebhookSecret: getEnv("STRIPE_WEBHOOK_SECRET", ""),
        OneSignalAppID: getEnv("ONESIGNAL_APP_ID", ""),
        OneSignalKey:   getEnv("ONESIGNAL_REST_API_KEY", ""),
        SMTPHost:   getEnv("SMTP_HOST", "smtp.gmail.com"),
        SMTPPort:   smtpPort,
        SMTPUser:   getEnv("SMTP_USER", ""),
        SMTPPass:   getEnv("SMTP_PASSWORD", ""),
        BaseURL:    getEnv("BASE_URL", "http://localhost:8080"),
    }
}

func getEnv(key, defaultValue string) string {
    if value := os.Getenv(key); value != "" {
        return value
    }
    return defaultValue
}