#!/usr/bin/env bash
# start.sh : démarre toute la stack UpcycleConnect 
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$ROOT/api-go"
LOG_DIR="/tmp/uc-logs"
mkdir -p "$LOG_DIR"

#  1. MySQL via Docker 
echo "[1/3] Démarrage MySQL Docker (port 3307)..."
cd "$API_DIR"
docker compose up -d db 2>&1

# Attendre que MySQL soit healthy
echo "    Attente de MySQL..."
for i in $(seq 1 30); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' api-go-db-1 2>/dev/null)
  if [ "$STATUS" = "healthy" ]; then
    echo "    MySQL prêt."
    break
  fi
  sleep 2
done

#  2. API Go 
echo "[2/3] Démarrage API Go (port 8080)..."
# Tuer l'ancienne instance si elle tourne
pkill -f "exe/api" 2>/dev/null || true
sleep 1

go run . > "$LOG_DIR/api-go.log" 2>&1 &
API_PID=$!
echo "    PID: $API_PID - logs: $LOG_DIR/api-go.log"
sleep 3

if ! kill -0 $API_PID 2>/dev/null; then
  echo "    ERREUR: l'API n'a pas démarré. Logs:"
  cat "$LOG_DIR/api-go.log"
  exit 1
fi
echo "    API démarrée."

#  3. Serveur de fichiers statiques 
echo "[3/3] Démarrage serveur frontend (port 3000)..."
cd "$ROOT"
pkill -f "serve.mjs" 2>/dev/null || true
sleep 1

node serve.mjs > "$LOG_DIR/frontend.log" 2>&1 &
FE_PID=$!
echo "    PID: $FE_PID - logs: $LOG_DIR/frontend.log"
sleep 1

#  Résumé 
echo ""
echo "  UpcycleConnect démarrage réussi "
echo ""
echo "  Admin back-office : http://localhost:3000/admin/"
echo "  API Go            : http://localhost:8080/api"
echo "  Base de données   : localhost:3307 (uc_user / uc_password_2026)"
echo ""
echo "  Compte admin      : admin@upcycleconnect.fr / admin2026"
echo ""
echo "  Logs : $LOG_DIR/"
echo "  Arrêt : ./stop.sh"
