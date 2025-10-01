#!/bin/bash

# Script d'initialisation des données par défaut
# Usage: ./init-data.sh

set -e

echo "🚀 Initialisation des données par défaut pour Plane Manager"

# Vérifier que Docker est en cours d'exécution
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker n'est pas en cours d'exécution"
    exit 1
fi

# Vérifier que le conteneur existe
if ! docker ps -a | grep -q plane-manager-app; then
    echo "❌ Conteneur plane-manager-app non trouvé"
    echo "💡 Lancez d'abord ./deploy.sh"
    exit 1
fi

echo "📦 Initialisation des données dans le conteneur..."

# Créer les fichiers de données par défaut dans le conteneur
docker exec plane-manager-app sh -c '
# Créer le répertoire data s il n existe pas
mkdir -p /app/data

# Créer teams.json avec des données par défaut
cat > /app/data/teams.json << EOF
[
  {
    "id": "team-1",
    "name": "Développement",
    "color": "#3B82F6",
    "description": "Équipe de développement logiciel"
  },
  {
    "id": "team-2", 
    "name": "Infrastructure",
    "color": "#10B981",
    "description": "Équipe infrastructure et DevOps"
  },
  {
    "id": "team-3",
    "name": "Support",
    "color": "#F59E0B", 
    "description": "Équipe support technique"
  }
]
EOF

# Créer module-templates.json avec des données par défaut
cat > /app/data/module-templates.json << EOF
[
  {
    "id": "template-1",
    "name": "Template Développement",
    "description": "Template pour les projets de développement",
    "team": "Développement",
    "icon": "💻",
    "tasks": []
  },
  {
    "id": "template-2",
    "name": "Template Infrastructure", 
    "description": "Template pour les projets infrastructure",
    "team": "Infrastructure",
    "icon": "🔧",
    "tasks": []
  }
]
EOF

# Créer projects.json vide
cat > /app/data/projects.json << EOF
[]
EOF

# Créer metadata.json
cat > /app/data/metadata.json << EOF
{
  "lastSync": null,
  "version": "1.0.0",
  "createdAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'",
  "updatedAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
}
EOF

echo "✅ Fichiers de données créés avec succès"
'

echo "🎉 Initialisation terminée!"
echo ""
echo "📊 Données créées:"
echo "   - 3 équipes par défaut"
echo "   - 2 templates de modules"
echo "   - Fichier projets vide"
echo "   - Métadonnées d'initialisation"
echo ""
echo "🌐 Votre application est maintenant prête sur: http://localhost:3020"
echo ""
echo "💡 Pour vérifier les données:"
echo "   curl http://localhost:3020/api/load-data"
