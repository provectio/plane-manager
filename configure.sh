#!/bin/bash

# Script de configuration pour Plane Manager
# Usage: ./configure.sh

set -e

DEPLOY_DIR="/opt/plane-manager"
ENV_FILE="$DEPLOY_DIR/.env.production"

echo "⚙️  Configuration de Plane Manager"
echo "📁 Fichier de configuration: $ENV_FILE"

# Vérifier que le fichier existe
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Fichier de configuration non trouvé: $ENV_FILE"
    echo "💡 Lancez d'abord ./deploy.sh pour créer le fichier de configuration"
    exit 1
fi

echo ""
echo "🔧 Configuration des variables d'environnement"
echo ""

# Fonction pour demander une valeur avec valeur par défaut
ask_value() {
    local var_name=$1
    local description=$2
    local default_value=$3
    
    echo -n "📝 $description"
    if [ -n "$default_value" ]; then
        echo -n " (défaut: $default_value)"
    fi
    echo -n ": "
    
    read -r value
    if [ -z "$value" ] && [ -n "$default_value" ]; then
        value="$default_value"
    fi
    
    echo "$var_name=$value"
}

# Configuration interactive
echo "🌐 Configuration de l'API Plane.so"
echo ""

# Endpoint API
current_endpoint=$(grep "^VITE_PLANE_API_ENDPOINT=" "$ENV_FILE" | cut -d'=' -f2- || echo "https://plane.provect.io")
new_endpoint=$(ask_value "VITE_PLANE_API_ENDPOINT" "Endpoint de l'API Plane.so" "$current_endpoint")

# Clé API
current_key=$(grep "^VITE_PLANE_API_KEY=" "$ENV_FILE" | cut -d'=' -f2- || echo "your_plane_api_key_here")
new_key=$(ask_value "VITE_PLANE_API_KEY" "Clé API Plane.so" "$current_key")

# Workspace slug
current_slug=$(grep "^VITE_PLANE_WORKSPACE_SLUG_FRONTEND=" "$ENV_FILE" | cut -d'=' -f2- || echo "your_workspace_slug_here")
new_slug=$(ask_value "VITE_PLANE_WORKSPACE_SLUG_FRONTEND" "Slug du workspace Plane.so" "$current_slug")

echo ""
echo "💾 Sauvegarde de la configuration..."

# Créer une sauvegarde
cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d-%H%M%S)"

# Mettre à jour le fichier
cat > "$ENV_FILE" << EOF
# Configuration de production pour Plane Manager
# Générée le $(date)

# Configuration Plane.so API
VITE_PLANE_API_ENDPOINT=$new_endpoint
VITE_PLANE_API_KEY=$new_key
VITE_PLANE_WORKSPACE_SLUG_FRONTEND=$new_slug

# Configuration serveur
NODE_ENV=production
PORT=3020

# Configuration Docker
COMPOSE_PROJECT_NAME=plane-manager
EOF

echo "✅ Configuration sauvegardée!"
echo ""
echo "📋 Configuration actuelle:"
echo "   - Endpoint API: $new_endpoint"
echo "   - Clé API: ${new_key:0:10}..."
echo "   - Workspace: $new_slug"
echo ""
echo "🔄 Pour appliquer la configuration:"
echo "   sudo docker-compose -f docker-compose.prod.yml down"
echo "   sudo docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "💡 Ou utilisez le script de mise à jour:"
echo "   sudo ./update.sh"
