# Multi-stage build pour optimiser la taille de l'image
FROM node:18-alpine AS builder

# Installer git pour cloner le repository
RUN apk add --no-cache git

# Définir le répertoire de travail
WORKDIR /app

# Cloner le repository GitHub
RUN git clone https://github.com/provectio/plane-manager.git .

# Installer toutes les dépendances (y compris dev dependencies pour le build)
RUN npm ci

# Build de l'application
RUN npm run build

# Stage de production
FROM node:18-alpine AS production

# Installer dumb-init pour une meilleure gestion des signaux
RUN apk add --no-cache dumb-init

# Créer un utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer uniquement les dépendances de production
RUN npm ci --only=production && npm cache clean --force

# Copier les fichiers buildés depuis le stage builder
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/server.js ./

# Copier le fichier d'environnement de production
COPY --from=builder --chown=nextjs:nodejs /app/.env.production ./.env.production

# Créer le répertoire pour les données persistantes
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# Changer vers l'utilisateur non-root
USER nextjs

# Exposer le port
EXPOSE 3020

# Variables d'environnement
ENV NODE_ENV=production
ENV PORT=3020

# Utiliser dumb-init pour gérer les signaux correctement
ENTRYPOINT ["dumb-init", "--"]

# Commande de démarrage
CMD ["node", "server.js"]