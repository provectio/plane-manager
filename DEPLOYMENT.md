# 🚀 Guide de Déploiement - Plane Manager

Ce guide explique comment déployer Plane Manager en production avec Docker.

## 📋 Prérequis

- Docker (version 20.10+)
- Docker Compose (version 2.0+)
- Git
- Accès au repository GitHub: https://github.com/provectio/plane-manager

## 🚀 Déploiement Rapide

### 1. Cloner et déployer

```bash
# Cloner le repository
git clone https://github.com/provectio/plane-manager.git
cd plane-manager

# Rendre les scripts exécutables
chmod +x *.sh

# Configuration interactive
./configure.sh

# Déploiement
./deploy.sh
```

### 2. Accès à l'application

- **Application**: http://localhost:3020
- **API**: http://localhost:3020/api/
- **Health Check**: http://localhost:3020/health

## ⚙️ Configuration

### Variables d'environnement

Créez un fichier `.env.production` avec vos paramètres:

```bash
# Configuration Plane.so
VITE_PLANE_API_ENDPOINT=https://plane.provect.io
VITE_PLANE_API_KEY=your_plane_api_key_here
VITE_PLANE_WORKSPACE_SLUG_FRONTEND=your_workspace_slug_here

# Configuration serveur
NODE_ENV=production
PORT=3020
```

### Configuration interactive

```bash
./configure.sh
```

## 🔄 Mise à jour

### Mise à jour simple

```bash
./update.sh
```

### Mise à jour avec sauvegarde

```bash
./update.sh --backup
```

### Mise à jour forcée (reconstruction complète)

```bash
./update.sh --force
```

## 🛠️ Commandes utiles

### Gestion des conteneurs

```bash
# Voir le statut
docker-compose ps

# Voir les logs
docker-compose logs -f

# Redémarrer
docker-compose restart

# Arrêter
docker-compose down

# Reconstruire
docker-compose build --no-cache
```

### Gestion des données

```bash
# Voir les volumes
docker volume ls

# Sauvegarder les données
docker run --rm -v plane-manager_plane_data:/data -v $(pwd):/backup alpine tar czf /backup/data-backup.tar.gz -C /data .

# Restaurer les données
docker run --rm -v plane-manager_plane_data:/data -v $(pwd):/backup alpine tar xzf /backup/data-backup.tar.gz -C /data
```

## 📁 Structure des données

Les données sont stockées dans des volumes Docker persistants:

- `plane_data`: Fichiers JSON (teams.json, projects.json, etc.)
- `plane_logs`: Logs de l'application

## 🔧 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Nginx       │────│  Plane Manager  │────│   Volumes       │
│  (Reverse Proxy)│    │   (Node.js)     │    │   (Données)     │
│   Port: 80/443  │    │   Port: 3020    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚨 Dépannage

### L'application ne démarre pas

```bash
# Vérifier les logs
docker-compose logs plane-manager

# Vérifier la santé
curl http://localhost:3020/health

# Reconstruire complètement
./update.sh --force
```

### Problème de permissions

```bash
# Vérifier les permissions des volumes
docker volume inspect plane-manager_plane_data

# Corriger les permissions
sudo chown -R 1001:1001 /var/lib/docker/volumes/plane-manager_plane_data/_data
```

### Problème de réseau

```bash
# Vérifier les ports
netstat -tlnp | grep :3020

# Vérifier les conteneurs
docker ps
```

## 📊 Monitoring

### Health Check

L'application expose un endpoint de santé:

```bash
curl http://localhost:3020/health
```

Réponse attendue:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Logs

```bash
# Logs en temps réel
docker-compose logs -f

# Logs des 100 dernières lignes
docker-compose logs --tail=100
```

## 🔒 Sécurité

### Recommandations

1. **HTTPS**: Configurez un certificat SSL pour Nginx
2. **Firewall**: Limitez l'accès aux ports nécessaires
3. **Variables d'environnement**: Ne commitez jamais les clés API
4. **Mises à jour**: Maintenez Docker et les images à jour

### Configuration SSL (optionnel)

1. Placez vos certificats dans le dossier `ssl/`
2. Modifiez `nginx.conf` pour activer HTTPS
3. Redémarrez les conteneurs

## 📞 Support

En cas de problème:

1. Vérifiez les logs: `docker-compose logs -f`
2. Vérifiez la santé: `curl http://localhost:3020/health`
3. Consultez ce guide de dépannage
4. Créez une issue sur GitHub si nécessaire

## 🎯 Prochaines étapes

- [ ] Configuration SSL/HTTPS
- [ ] Monitoring avec Prometheus/Grafana
- [ ] Sauvegarde automatique
- [ ] Scaling horizontal
- [ ] CI/CD pipeline