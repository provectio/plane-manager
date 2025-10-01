# 🚀 Guide de Déploiement - Plane Manager

Ce guide vous explique comment déployer Plane Manager en production sur un serveur Linux avec Docker.

## 📋 Prérequis

### Serveur Linux
- **OS** : Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- **RAM** : Minimum 2GB, recommandé 4GB+
- **Stockage** : Minimum 10GB d'espace libre
- **Réseau** : Accès internet pour cloner le repository

### Logiciels requis
- **Docker** : Version 20.10+
- **Docker Compose** : Version 2.0+
- **Git** : Pour cloner le repository
- **Curl** : Pour les tests de santé

## 🔧 Installation des prérequis

### Ubuntu/Debian
```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Installer Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Installer Git
sudo apt install git curl -y

# Redémarrer la session pour activer les groupes Docker
newgrp docker
```

### CentOS/RHEL
```bash
# Mettre à jour le système
sudo yum update -y

# Installer Docker
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install docker-ce docker-ce-cli containerd.io -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# Installer Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Installer Git
sudo yum install git curl -y

# Redémarrer la session
newgrp docker
```

## 🚀 Déploiement

### 1. Cloner le repository
```bash
# Créer le répertoire de déploiement
sudo mkdir -p /opt/plane-manager
cd /opt/plane-manager

# Cloner le repository
sudo git clone https://github.com/provectio/plane-manager.git .
```

### 2. Configuration
```bash
# Copier le fichier de configuration
sudo cp env.production.example .env.production

# Éditer la configuration
sudo nano .env.production
```

**Configuration requise dans `.env.production` :**
```env
# Configuration Plane.so API
VITE_PLANE_API_ENDPOINT=https://plane.provect.io
VITE_PLANE_API_KEY=votre_cle_api_plane
VITE_PLANE_WORKSPACE_SLUG_FRONTEND=votre_workspace_slug

# Configuration serveur
NODE_ENV=production
PORT=3001
```

### 3. Déploiement automatique
```bash
# Rendre le script exécutable
sudo chmod +x deploy.sh

# Lancer le déploiement
sudo ./deploy.sh production
```

### 4. Déploiement manuel
```bash
# Construire et démarrer les conteneurs
sudo docker-compose -f docker-compose.prod.yml up -d --build

# Vérifier le statut
sudo docker-compose -f docker-compose.prod.yml ps

# Voir les logs
sudo docker-compose -f docker-compose.prod.yml logs -f
```

## 🔍 Vérification du déploiement

### Test de santé
```bash
# Test de l'API
curl -f http://localhost:3001/api/load-data

# Test de l'interface web
curl -f http://localhost:3001/
```

### Vérification des volumes
```bash
# Lister les volumes Docker
docker volume ls | grep plane

# Inspecter le volume des données
docker volume inspect plane-manager_plane_data
```

## 📊 Gestion des données

### Sauvegarde des données
```bash
# Créer une sauvegarde
sudo docker run --rm -v plane-manager_plane_data:/data -v $(pwd):/backup alpine tar czf /backup/plane-data-backup-$(date +%Y%m%d).tar.gz -C /data .

# Restaurer une sauvegarde
sudo docker run --rm -v plane-manager_plane_data:/data -v $(pwd):/backup alpine tar xzf /backup/plane-data-backup-YYYYMMDD.tar.gz -C /data
```

### Accès direct aux données
```bash
# Accéder au conteneur pour voir les données
sudo docker exec -it plane-manager-app ls -la /app/data/

# Copier des données depuis le conteneur
sudo docker cp plane-manager-app:/app/data/teams.json ./teams-backup.json
```

## 🔧 Maintenance

### Mise à jour de l'application
```bash
cd /opt/plane-manager
sudo git pull origin main
sudo ./deploy.sh production
```

### Redémarrage des services
```bash
# Redémarrer l'application
sudo docker-compose -f docker-compose.prod.yml restart

# Redémarrer avec reconstruction
sudo docker-compose -f docker-compose.prod.yml up -d --build
```

### Nettoyage
```bash
# Nettoyer les images inutilisées
sudo docker system prune -f

# Nettoyer les volumes inutilisés
sudo docker volume prune -f
```

## 📝 Logs et monitoring

### Consulter les logs
```bash
# Logs en temps réel
sudo docker-compose -f docker-compose.prod.yml logs -f

# Logs de l'application uniquement
sudo docker-compose -f docker-compose.prod.yml logs -f plane-manager

# Logs de Nginx
sudo docker-compose -f docker-compose.prod.yml logs -f nginx
```

### Monitoring des ressources
```bash
# Utilisation des ressources
sudo docker stats

# Espace disque des volumes
sudo docker system df -v
```

## 🔒 Sécurité

### Configuration du pare-feu
```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Firewalld (CentOS)
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### SSL/TLS (optionnel)
```bash
# Créer le répertoire SSL
sudo mkdir -p /opt/plane-manager/ssl

# Copier vos certificats
sudo cp your-cert.pem /opt/plane-manager/ssl/cert.pem
sudo cp your-key.pem /opt/plane-manager/ssl/key.pem

# Redémarrer Nginx
sudo docker-compose -f docker-compose.prod.yml restart nginx
```

## 🆘 Dépannage

### Problèmes courants

**L'application ne démarre pas :**
```bash
# Vérifier les logs
sudo docker-compose -f docker-compose.prod.yml logs plane-manager

# Vérifier la configuration
sudo docker-compose -f docker-compose.prod.yml config
```

**Problème de permissions :**
```bash
# Corriger les permissions
sudo chown -R 1001:1001 /opt/plane-manager/data
```

**Problème de réseau :**
```bash
# Vérifier les ports
sudo netstat -tlnp | grep :3001
sudo netstat -tlnp | grep :80
```

### Commandes de diagnostic
```bash
# Statut des conteneurs
sudo docker-compose -f docker-compose.prod.yml ps

# Informations système Docker
sudo docker system info

# Espace disque
df -h
```

## 📞 Support

En cas de problème :
1. Consultez les logs : `sudo docker-compose -f docker-compose.prod.yml logs -f`
2. Vérifiez la configuration : `sudo docker-compose -f docker-compose.prod.yml config`
3. Testez la connectivité : `curl -f http://localhost:3001/api/load-data`

---

**🎉 Votre application Plane Manager est maintenant déployée en production !**

- **Interface web** : http://votre-serveur:3001
- **API** : http://votre-serveur:3001/api/
- **Données persistantes** : Volume Docker `plane_data`
