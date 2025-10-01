#!/bin/bash

# Script de reconstruction complète pour Plane Manager
# Usage: ./rebuild.sh

set -e

echo "🔄 Reconstruction complète de Plane Manager"

# Arrêter tous les conteneurs
echo "🛑 Arrêt des conteneurs..."
sudo docker-compose -f docker-compose.prod.yml down

# Supprimer l'image existante
echo "🗑️  Suppression de l'image existante..."
sudo docker rmi plane-manager_plane-manager:latest 2>/dev/null || echo "Image non trouvée, continuons..."

# Nettoyer le cache Docker
echo "🧹 Nettoyage du cache Docker..."
sudo docker system prune -f

# Reconstruire sans cache
echo "🔨 Reconstruction complète (sans cache)..."
sudo docker-compose -f docker-compose.prod.yml build --no-cache

# Démarrer les conteneurs
echo "🚀 Démarrage des conteneurs..."
sudo docker-compose -f docker-compose.prod.yml up -d

# Attendre le démarrage
echo "⏳ Attente du démarrage..."
sleep 15

# Vérifier le statut
echo "📊 Statut des conteneurs:"
sudo docker-compose -f docker-compose.prod.yml ps

# Afficher les logs récents
echo "📋 Logs récents:"
sudo docker-compose -f docker-compose.prod.yml logs --tail=20 plane-manager

# Test de connectivité
echo "🏥 Test de connectivité..."
if curl -f http://localhost:3020/ > /dev/null 2>&1; then
    echo "✅ Application accessible sur: http://localhost:3020"
else
    echo "❌ Application non accessible"
    echo "📋 Logs complets:"
    sudo docker-compose -f docker-compose.prod.yml logs plane-manager
fi
