#!/bin/bash

# Script de rollback pour Plane Manager
# Usage: ./rollback.sh [backup_file]

set -e

DEPLOY_DIR="/opt/plane-manager"
BACKUP_DIR="/opt/plane-manager/backups"

echo "🔄 Rollback de Plane Manager"

# Lister les sauvegardes disponibles
if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ Aucune sauvegarde trouvée dans $BACKUP_DIR"
    exit 1
fi

echo "📋 Sauvegardes disponibles:"
ls -la "$BACKUP_DIR"/*.tar.gz 2>/dev/null || {
    echo "❌ Aucune sauvegarde trouvée"
    exit 1
}

# Si un fichier de sauvegarde est spécifié
if [ $# -eq 1 ]; then
    BACKUP_FILE="$1"
    if [ ! -f "$BACKUP_FILE" ]; then
        echo "❌ Fichier de sauvegarde non trouvé: $BACKUP_FILE"
        exit 1
    fi
else
    # Sélectionner la sauvegarde la plus récente
    BACKUP_FILE=$(ls -t "$BACKUP_DIR"/*.tar.gz | head -n1)
    echo "📁 Utilisation de la sauvegarde la plus récente: $(basename $BACKUP_FILE)"
fi

echo "🛑 Arrêt des conteneurs..."
cd "$DEPLOY_DIR"
sudo docker-compose -f docker-compose.prod.yml down

echo "🔄 Restauration des données..."
sudo docker run --rm -v plane-manager_plane_data:/data -v "$BACKUP_DIR":/backup alpine tar xzf "/backup/$(basename $BACKUP_FILE)" -C /data

echo "🚀 Redémarrage des conteneurs..."
sudo docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Attente du démarrage..."
sleep 10

echo "🏥 Vérification de la santé..."
if curl -f http://localhost:3020/api/load-data > /dev/null 2>&1; then
    echo "✅ Rollback terminé avec succès!"
    echo "🌐 Application accessible sur: http://localhost:3020"
else
    echo "❌ Problème lors du rollback"
    sudo docker-compose -f docker-compose.prod.yml logs --tail=20
    exit 1
fi
