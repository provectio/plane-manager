#!/bin/bash

# Script de configuration interactive pour Plane Manager
# Usage: ./configure.sh

set -e

ENV_FILE=".env.production"
BACKUP_FILE=".env.production.bak"

echo "⚙️  Configuration des variables d'environnement pour Plane Manager"
echo "=================================================================="

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Ce script doit être exécuté dans le répertoire du projet"
    exit 1
fi

# Sauvegarder l'ancien fichier si existant
if [ -f "$ENV_FILE" ]; then
    echo "💾 Sauvegarde de la configuration existante vers $BACKUP_FILE"
    cp "$ENV_FILE" "$BACKUP_FILE"
fi

echo ""
echo "📝 Veuillez saisir les informations de configuration:"
echo ""

# Demander les variables
read -p "🌐 Endpoint de l'API Plane.so (ex: https://plane.provect.io): " VITE_PLANE_API_ENDPOINT_INPUT
read -p "🔑 Clé API Plane.so: " VITE_PLANE_API_KEY_INPUT
read -p "📁 Slug du workspace Plane.so (frontend): " VITE_PLANE_WORKSPACE_SLUG_FRONTEND_INPUT
read -p "🔌 Port du serveur (par défaut 3020): " PORT_INPUT
PORT_INPUT=${PORT_INPUT:-3020} # Valeur par défaut

# Validation basique
if [ -z "$VITE_PLANE_API_ENDPOINT_INPUT" ]; then
    echo "❌ L'endpoint API est requis"
    exit 1
fi

if [ -z "$VITE_PLANE_API_KEY_INPUT" ]; then
    echo "❌ La clé API est requise"
    exit 1
fi

if [ -z "$VITE_PLANE_WORKSPACE_SLUG_FRONTEND_INPUT" ]; then
    echo "❌ Le slug du workspace est requis"
    exit 1
fi

# Écrire le nouveau fichier .env.production
echo ""
echo "💾 Création du fichier de configuration..."

cat > "$ENV_FILE" << EOF
# Configuration de production pour Plane Manager
# Généré le $(date)

# Configuration Plane.so
VITE_PLANE_API_ENDPOINT=${VITE_PLANE_API_ENDPOINT_INPUT}
VITE_PLANE_API_KEY=${VITE_PLANE_API_KEY_INPUT}
VITE_PLANE_WORKSPACE_SLUG_FRONTEND=${VITE_PLANE_WORKSPACE_SLUG_FRONTEND_INPUT}

# Configuration serveur
NODE_ENV=production
PORT=${PORT_INPUT}
COMPOSE_PROJECT_NAME=plane-manager

# Configuration Docker
DOCKER_BUILDKIT=1
COMPOSE_DOCKER_CLI_BUILD=1
EOF

echo "✅ Fichier $ENV_FILE créé et configuré avec succès !"
echo ""
echo "📋 Configuration actuelle:"
echo "=================================================================="
cat "$ENV_FILE"
echo "=================================================================="
echo ""
echo "🚀 Prochaines étapes:"
echo "   1. Vérifiez la configuration ci-dessus"
echo "   2. Lancez le déploiement avec: ./deploy.sh"
echo "   3. Ou mettez à jour avec: ./update.sh"
echo ""
echo "💡 Pour modifier la configuration plus tard, relancez ce script"