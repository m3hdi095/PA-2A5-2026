package utils

import (
    "errors"
    "time"

    "upcycleconnect/api/config"

    "github.com/golang-jwt/jwt/v5"
)

type Claims struct {
    UserID uint   `json:"user_id"`
    Role   string `json:"role"`
    jwt.RegisteredClaims
}

func GenerateJWT(userID uint, role string) (string, error) {
    claims := Claims{
        UserID: userID,
        Role:   role,
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(72 * time.Hour)),
            IssuedAt:  jwt.NewNumericDate(time.Now()),
        },
    }
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString([]byte(config.AppConfig.JWTSecret))
}

func ValidateJWT(tokenString string) (uint, string, error) {
    token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
        return []byte(config.AppConfig.JWTSecret), nil
    })
    if err != nil {
        return 0, "", err
    }
    if claims, ok := token.Claims.(*Claims); ok && token.Valid {
        return claims.UserID, claims.Role, nil
    }
    return 0, "", errors.New("token invalide")
}