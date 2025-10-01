#!/bin/bash

# Script de reconstruction complète pour Plane Manager
# Usage: ./rebuild.sh

set -e

echo "🔨 Reconstruction complète de Plane Manager"
echo "============================================="

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Ce script doit être exécuté dans le répertoire du projet"
    exit 1
fi

# Arrêter tous les conteneurs
echo "🛑 Arrêt des conteneurs..."
sudo docker-compose down || true

# Supprimer l'image existante
echo "🗑️  Suppression de l'image existante..."
sudo docker rmi plane-manager_plane-manager:latest || true

# Nettoyer le cache Docker
echo "🧹 Nettoyage du cache Docker..."
sudo docker system prune -f

# Supprimer les volumes (ATTENTION: cela supprime les données)
echo "⚠️  Suppression des volumes (données perdues)..."
sudo docker volume rm plane-manager_plane_data || true
sudo docker volume rm plane-manager_plane_logs || true

# Reconstruire complètement sans cache
echo "🔨 Reconstruction complète sans cache..."
sudo docker-compose build --no-cache --pull

# Démarrer les conteneurs
echo "🚀 Démarrage des conteneurs..."
sudo docker-compose up -d

# Attendre que les services soient prêts
echo "⏳ Attente du démarrage..."
sleep 20

# Vérifier le statut
echo "📊 Statut des conteneurs:"
sudo docker-compose ps

# Vérifier la santé
echo "🏥 Vérification de la santé..."
if curl -f http://localhost:3020/health > /dev/null 2>&1; then
    echo "✅ Reconstruction terminée avec succès!"
    echo "🌐 Application accessible sur: http://localhost:3020"
else
    echo "❌ Problème lors de la reconstruction"
    echo "📋 Logs des conteneurs:"
    sudo docker-compose logs --tail=30
    exit 1
fi

echo "🎉 Reconstruction complète terminée!"