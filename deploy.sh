#!/bin/bash

# Script de déploiement pour Plane Manager
# Usage: ./deploy.sh [environment]

set -e

# Configuration
REPO_URL="https://github.com/provectio/plane-manager.git"
APP_NAME="plane-manager"
ENVIRONMENT=${1:-production}

echo "🚀 Déploiement de Plane Manager - Environnement: $ENVIRONMENT"
echo "📦 Repository: $REPO_URL"

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé. Veuillez installer Docker d'abord."
    exit 1
fi

# Vérifier que Docker Compose est installé
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose n'est pas installé. Veuillez installer Docker Compose d'abord."
    exit 1
fi

# Créer le répertoire de déploiement s'il n'existe pas
DEPLOY_DIR="/opt/plane-manager"
echo "📁 Répertoire de déploiement: $DEPLOY_DIR"

if [ ! -d "$DEPLOY_DIR" ]; then
    echo "📂 Création du répertoire de déploiement..."
    sudo mkdir -p "$DEPLOY_DIR"
fi

# Cloner ou mettre à jour le repository
if [ -d "$DEPLOY_DIR/.git" ]; then
    echo "🔄 Mise à jour du repository..."
    cd "$DEPLOY_DIR"
    sudo git pull origin main
else
    echo "📥 Clonage du repository..."
    sudo git clone "$REPO_URL" "$DEPLOY_DIR"
    cd "$DEPLOY_DIR"
fi

# Copier les fichiers de configuration si nécessaire
if [ ! -f "$DEPLOY_DIR/.env.production" ]; then
    echo "⚙️  Création du fichier de configuration de production..."
    sudo cp "$DEPLOY_DIR/.env.example" "$DEPLOY_DIR/.env.production"
    echo "📝 Veuillez configurer le fichier .env.production avec vos paramètres"
fi

# Arrêter les conteneurs existants
echo "🛑 Arrêt des conteneurs existants..."
sudo docker-compose down || true

# Construire et démarrer les nouveaux conteneurs
echo "🔨 Construction et démarrage des conteneurs..."
sudo docker-compose up -d --build

# Attendre que les services soient prêts
echo "⏳ Attente du démarrage des services..."
sleep 10

# Vérifier le statut des conteneurs
echo "📊 Statut des conteneurs:"
sudo docker-compose ps

# Vérifier la santé de l'application
echo "🏥 Vérification de la santé de l'application..."
if curl -f http://localhost:3020/api/load-data > /dev/null 2>&1; then
    echo "✅ Application démarrée avec succès!"
    echo "🌐 Application accessible sur: http://localhost:3020"
    echo "🔧 API accessible sur: http://localhost:3020/api/"
else
    echo "❌ L'application ne répond pas correctement"
    echo "📋 Logs des conteneurs:"
    sudo docker-compose logs --tail=50
    exit 1
fi

# Afficher les informations de déploiement
echo ""
echo "🎉 Déploiement terminé avec succès!"
echo "📊 Informations de déploiement:"
echo "   - Application: $APP_NAME"
echo "   - Environnement: $ENVIRONMENT"
echo "   - Repository: $REPO_URL"
echo "   - Répertoire: $DEPLOY_DIR"
echo ""
echo "🔧 Commandes utiles:"
echo "   - Voir les logs: sudo docker-compose logs -f"
echo "   - Redémarrer: sudo docker-compose restart"
echo "   - Arrêter: sudo docker-compose down"
echo "   - Mettre à jour: ./deploy.sh"
echo ""
echo "📁 Données persistantes:"
echo "   - Volume des données: plane_data"
echo "   - Volume des logs: plane_logs"
