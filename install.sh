#!/usr/bin/env bash
# install.sh : installation complète d'UpcycleConnect sur un serveur vierge (Ubuntu/Debian)
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$ROOT/api-go"
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
info() { echo -e "${YELLOW}[..] $1${NC}"; }
err()  { echo -e "${RED}[ERREUR]${NC} $1"; exit 1; }

echo ""
echo "  UpcycleConnect — Installation "
echo ""

# Prérequis 

info "Vérification des prérequis..."

# Docker
if ! command -v docker &>/dev/null; then
  info "Installation de Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  ok "Docker installé."
else
  ok "Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"
fi

# Docker Compose plugin
if ! docker compose version &>/dev/null; then
  info "Installation du plugin Docker Compose..."
  sudo apt-get install -y docker-compose-plugin 2>/dev/null || true
fi

# Go 1.22+
if ! command -v go &>/dev/null; then
  info "Installation de Go 1.22..."
  GO_VER="1.22.4"
  ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')
  curl -fsSL "https://go.dev/dl/go${GO_VER}.linux-${ARCH}.tar.gz" -o /tmp/go.tar.gz
  sudo rm -rf /usr/local/go && sudo tar -C /usr/local -xzf /tmp/go.tar.gz
  echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.profile
  export PATH=$PATH:/usr/local/go/bin
  ok "Go installé."
else
  ok "Go $(go version | awk '{print $3}')"
fi

# Node.js 18+
if ! command -v node &>/dev/null; then
  info "Installation de Node.js 18..."
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ok "Node.js installé."
else
  ok "Node.js $(node --version)"
fi

# Configuration .env 

ENV_FILE="$API_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  info "Création du fichier .env depuis le template..."
  cat > "$ENV_FILE" <<'EOF'
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=uc_user
DB_PASSWORD=uc_password_2026
DB_NAME=upcycleconnect

JWT_SECRET=CHANGEZ_CE_SECRET_JWT_EN_PRODUCTION

STRIPE_SECRET_KEY=
STRIPE_PUBLIC_KEY=
STRIPE_WEBHOOK_SECRET=    # Clé de signature webhook Stripe (dashboard Stripe -> Webhooks -> Signing secret)

ONESIGNAL_APP_ID=
ONESIGNAL_REST_API_KEY=

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
EOF
  echo ""
  echo -e "${YELLOW}  IMPORTANT : éditez $ENV_FILE pour renseigner${NC}"
  echo "   - JWT_SECRET     (chaîne aléatoire longue)"
  echo "   - STRIPE_*       (clés Stripe tableau de bord)"
  echo "   - SMTP_USER / SMTP_PASSWORD  (compte Gmail avec app password)"
  echo "   - ONESIGNAL_*    (clés OneSignal push)"
  echo ""
  read -r -p "Appuyez sur Entrée quand le .env est configuré..." _
else
  ok ".env déjà présent."
fi

# Base de données 

info "Démarrage MySQL via Docker..."
cd "$API_DIR"
docker compose up -d db

info "Attente de MySQL..."
for i in $(seq 1 30); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' api-go-db-1 2>/dev/null || echo "starting")
  [ "$STATUS" = "healthy" ] && break
  sleep 2
done
ok "MySQL prêt."

info "Import du schéma SQL..."
docker exec -i api-go-db-1 mysql -uroot -proot_password_2026 < "$ROOT/upcycleconnect.sql" 2>/dev/null && ok "Schéma importé." || ok "Schéma déjà présent ou ignoré."

#  Compilation Go 

info "Compilation de l'API Go..."
cd "$API_DIR"
go build -o uc-api .
ok "API compilée."

#  Dossiers runtime 

mkdir -p "$API_DIR/uploads/photos" "$API_DIR/uploads/barcodes"
ok "Dossiers uploads créés."

#  Démarrage 

echo ""
info "Démarrage de la stack complète..."
cd "$ROOT"
bash start.sh

echo ""
echo "  Installation terminée ! "
echo ""
echo "  Accès :"
echo "   Admin   : http://localhost:3000/admin/"
echo "   Partis  : http://localhost:3000/frontend-particuliers/"
echo "   API     : http://localhost:8080/api"
echo ""
echo "  Compte admin par défaut : admin@upcycleconnect.fr / admin2026"
echo "  (changez le mot de passe après la première connexion)"
@