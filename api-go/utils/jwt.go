package utils

import (
    "crypto/rand"
    "encoding/hex"
    "errors"
    "time"

    "upcycleconnect/api/config"

    "github.com/golang-jwt/jwt/v5"
)

type Claims struct {
    UserID    uint   `json:"user_id"`
    Role      string `json:"role"`
    CsrfToken string `json:"csrf_token"`
    jwt.RegisteredClaims
}

func GenerateJWT(userID uint, role string) (string, string, error) {
    b := make([]byte, 32)
    if _, err := rand.Read(b); err != nil {
        return "", "", err
    }
    csrfToken := hex.EncodeToString(b)

    claims := Claims{
        UserID:    userID,
        Role:      role,
        CsrfToken: csrfToken,
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(72 * time.Hour)),
            IssuedAt:  jwt.NewNumericDate(time.Now()),
        },
    }
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    signed, err := token.SignedString([]byte(config.AppConfig.JWTSecret))
    return signed, csrfToken, err
}

func ValidateJWT(tokenString string) (uint, string, string, error) {
    token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (any, error) {
        return []byte(config.AppConfig.JWTSecret), nil
    })
    if err != nil {
        return 0, "", "", err
    }
    if claims, ok := token.Claims.(*Claims); ok && token.Valid {
        return claims.UserID, claims.Role, claims.CsrfToken, nil
    }
    return 0, "", "", errors.New("token invalide")
}