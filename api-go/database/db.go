package database

import (
    "database/sql"
    "fmt"
    "log"
    "time"

    "upcycleconnect/api/config"

    _ "github.com/go-sql-driver/mysql"
)

var DB *sql.DB

// si la db repond pas ca crash direct, c'est voulu
func Connect() {
    dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=true&loc=Local",
        config.AppConfig.DBUser,
        config.AppConfig.DBPassword,
        config.AppConfig.DBHost,
        config.AppConfig.DBPort,
        config.AppConfig.DBName,
    )

    var err error
    DB, err = sql.Open("mysql", dsn)
    if err != nil {
        log.Fatal("Impossible de se connecter à la base :", err)
    }

    DB.SetMaxOpenConns(25)
    DB.SetMaxIdleConns(25)
    DB.SetConnMaxLifetime(5 * time.Minute)

    if err = DB.Ping(); err != nil {
        log.Fatal("La base de données ne répond pas :", err)
    }

    log.Println("Connecté à la base de données")

    DB.Exec(`CREATE TABLE IF NOT EXISTS config_plateforme (
        cle VARCHAR(100) PRIMARY KEY,
        valeur TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
}