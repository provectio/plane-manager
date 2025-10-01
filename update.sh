#!/bin/bash

# Script de mise à jour pour Plane Manager
# Usage: ./update.sh [--force] [--backup]

set -e

DEPLOY_DIR="/opt/plane-manager"
FORCE_UPDATE=false
BACKUP_DATA=false

# Analyser les arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE_UPDATE=true
            shift
            ;;
        --backup)
            BACKUP_DATA=true
            shift
            ;;
        *)
            echo "Usage: $0 [--force] [--backup]"
            echo "  --force: Force la reconstruction complète"
            echo "  --backup: Sauvegarde les données avant mise à jour"
            exit 1
            ;;
    esac
done

echo "🔄 Mise à jour de Plane Manager"

# Vérifier que le répertoire existe
if [ ! -d "$DEPLOY_DIR" ]; then
    echo "❌ Répertoire de déploiement non trouvé: $DEPLOY_DIR"
    echo "💡 Utilisez d'abord ./deploy.sh pour le déploiement initial"
    exit 1
fi

cd "$DEPLOY_DIR"

# Sauvegarder les données si demandé
if [ "$BACKUP_DATA" = true ]; then
    echo "💾 Sauvegarde des données..."
    BACKUP_DIR="/opt/plane-manager-backup-$(date +%Y%m%d-%H%M%S)"
    sudo mkdir -p "$BACKUP_DIR"
    
    # Sauvegarder les volumes Docker
    sudo docker run --rm -v plane-manager_plane_data:/data -v "$BACKUP_DIR":/backup alpine tar czf /backup/data.tar.gz -C /data .
    echo "✅ Données sauvegardées dans: $BACKUP_DIR"
fi

# Mettre à jour le code
echo "📥 Mise à jour du code depuis GitHub..."
sudo git pull origin main

# Arrêter les conteneurs
echo "🛑 Arrêt des conteneurs..."
sudo docker-compose down

# Reconstruire si nécessaire
if [ "$FORCE_UPDATE" = true ]; then
    echo "🔨 Reconstruction complète des images..."
    sudo docker-compose build --no-cache
else
    echo "🔨 Reconstruction des images..."
    sudo docker-compose build
fi

# Redémarrer les conteneurs
echo "🚀 Redémarrage des conteneurs..."
sudo docker-compose up -d

# Attendre que les services soient prêts
echo "⏳ Attente du démarrage..."
sleep 15

# Vérifier la santé
echo "🏥 Vérification de la santé..."
if curl -f http://localhost:3020/health > /dev/null 2>&1; then
    echo "✅ Mise à jour terminée avec succès!"
    echo "🌐 Application accessible sur: http://localhost:3020"
else
    echo "❌ Problème lors de la mise à jour"
    echo "📋 Logs des conteneurs:"
    sudo docker-compose logs --tail=20
    exit 1
fi

echo "🎉 Mise à jour terminée!"