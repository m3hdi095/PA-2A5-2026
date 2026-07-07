#!/usr/bin/env bash
# stop.sh sert à arrêter proprement la stack 
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Arrêt de l'API Go..."
pkill -f "exe/api" 2>/dev/null && echo "  OK" || echo "  Pas de processus actif"

echo "Arrêt du serveur frontend..."
pkill -f "serve.mjs" 2>/dev/null && echo "  OK" || echo "  Pas de processus actif"

echo "Arrêt de MySQL Docker..."
cd "$ROOT/api-go" && docker compose stop db 2>&1
echo "  OK"

echo "Stack arrêtée."
