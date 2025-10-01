#!/bin/bash

# Script de mise à jour pour Plane Manager
# Usage: ./update.sh [--backup] [--force]

set -e

# Configuration
DEPLOY_DIR="/opt/plane-manager"
BACKUP_DIR="/opt/plane-manager/backups"
FORCE_UPDATE=false
CREATE_BACKUP=false

# Analyser les arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --backup)
            CREATE_BACKUP=true
            shift
            ;;
        --force)
            FORCE_UPDATE=true
            shift
            ;;
        *)
            echo "Usage: $0 [--backup] [--force]"
            echo "  --backup: Créer une sauvegarde avant la mise à jour"
            echo "  --force: Forcer la mise à jour même s'il n'y a pas de changements"
            exit 1
            ;;
    esac
done

echo "🔄 Mise à jour de Plane Manager"
echo "📁 Répertoire: $DEPLOY_DIR"

# Vérifier que nous sommes dans le bon répertoire
if [ ! -d "$DEPLOY_DIR" ]; then
    echo "❌ Répertoire de déploiement non trouvé: $DEPLOY_DIR"
    exit 1
fi

cd "$DEPLOY_DIR"

# Vérifier les changements Git
echo "🔍 Vérification des changements..."
git fetch origin

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ] && [ "$FORCE_UPDATE" = false ]; then
    echo "✅ Aucune mise à jour disponible"
    exit 0
fi

echo "📥 Mise à jour disponible détectée"
echo "   Local:  $LOCAL"
echo "   Remote: $REMOTE"

# Créer une sauvegarde si demandé
if [ "$CREATE_BACKUP" = true ]; then
    echo "💾 Création d'une sauvegarde..."
    
    # Créer le répertoire de sauvegarde
    sudo mkdir -p "$BACKUP_DIR"
    
    # Sauvegarder les données
    BACKUP_FILE="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).tar.gz"
    sudo docker run --rm -v plane-manager_plane_data:/data -v "$BACKUP_DIR":/backup alpine tar czf "/backup/backup-$(date +%Y%m%d-%H%M%S).tar.gz" -C /data .
    
    echo "✅ Sauvegarde créée: $BACKUP_FILE"
fi

# Arrêter les conteneurs
echo "🛑 Arrêt des conteneurs..."
sudo docker-compose -f docker-compose.prod.yml down

# Mettre à jour le code
echo "📥 Mise à jour du code source..."
sudo git pull origin main

# Reconstruire et redémarrer
echo "🔨 Reconstruction et redémarrage..."
sudo docker-compose -f docker-compose.prod.yml up -d --build

# Attendre que les services soient prêts
echo "⏳ Attente du démarrage des services..."
sleep 15

# Vérifier la santé de l'application
echo "🏥 Vérification de la santé de l'application..."
if curl -f http://localhost:3020/api/load-data > /dev/null 2>&1; then
    echo "✅ Mise à jour terminée avec succès!"
    echo "🌐 Application accessible sur: http://localhost:3020"
else
    echo "❌ L'application ne répond pas correctement"
    echo "📋 Logs des conteneurs:"
    sudo docker-compose -f docker-compose.prod.yml logs --tail=50
    
    # Proposer de restaurer la sauvegarde
    if [ "$CREATE_BACKUP" = true ] && [ -f "$BACKUP_FILE" ]; then
        echo ""
        echo "🔄 Pour restaurer la sauvegarde:"
        echo "   sudo docker-compose -f docker-compose.prod.yml down"
        echo "   sudo docker run --rm -v plane-manager_plane_data:/data -v $BACKUP_DIR:/backup alpine tar xzf /backup/$(basename $BACKUP_FILE) -C /data"
        echo "   sudo docker-compose -f docker-compose.prod.yml up -d"
    fi
    
    exit 1
fi

# Nettoyer les anciennes images (optionnel)
echo "🧹 Nettoyage des anciennes images Docker..."
sudo docker image prune -f

echo ""
echo "🎉 Mise à jour terminée avec succès!"
echo "📊 Informations:"
echo "   - Version précédente: $LOCAL"
echo "   - Nouvelle version: $REMOTE"
echo "   - Sauvegarde: $([ "$CREATE_BACKUP" = true ] && echo "Créée" || echo "Non créée")"
echo ""
echo "🔧 Commandes utiles:"
echo "   - Voir les logs: sudo docker-compose -f docker-compose.prod.yml logs -f"
echo "   - Redémarrer: sudo docker-compose -f docker-compose.prod.yml restart"
echo "   - Arrêter: sudo docker-compose -f docker-compose.prod.yml down"
