# Script de déploiement PowerShell pour Plane Manager
# Usage: .\deploy.ps1 [environment]

param(
    [string]$Environment = "production"
)

# Configuration
$RepoUrl = "https://github.com/provectio/plane-manager.git"
$AppName = "plane-manager"
$DeployDir = "C:\opt\plane-manager"

Write-Host "🚀 Déploiement de Plane Manager - Environnement: $Environment" -ForegroundColor Green
Write-Host "📦 Repository: $RepoUrl" -ForegroundColor Cyan

# Vérifier que Docker est installé
try {
    docker --version | Out-Null
    Write-Host "✅ Docker détecté" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker n'est pas installé. Veuillez installer Docker Desktop d'abord." -ForegroundColor Red
    exit 1
}

# Vérifier que Docker Compose est installé
try {
    docker-compose --version | Out-Null
    Write-Host "✅ Docker Compose détecté" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Compose n'est pas installé. Veuillez installer Docker Compose d'abord." -ForegroundColor Red
    exit 1
}

# Créer le répertoire de déploiement s'il n'existe pas
Write-Host "📁 Répertoire de déploiement: $DeployDir" -ForegroundColor Cyan

if (-not (Test-Path $DeployDir)) {
    Write-Host "📂 Création du répertoire de déploiement..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $DeployDir -Force | Out-Null
}

# Cloner ou mettre à jour le repository
Set-Location $DeployDir

if (Test-Path ".git") {
    Write-Host "🔄 Mise à jour du repository..." -ForegroundColor Yellow
    git pull origin main
} else {
    Write-Host "📥 Clonage du repository..." -ForegroundColor Yellow
    git clone $RepoUrl .
}

# Copier les fichiers de configuration si nécessaire
if (-not (Test-Path ".env.production")) {
    Write-Host "⚙️  Création du fichier de configuration de production..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env.production"
    Write-Host "📝 Veuillez configurer le fichier .env.production avec vos paramètres" -ForegroundColor Yellow
}

# Arrêter les conteneurs existants
Write-Host "🛑 Arrêt des conteneurs existants..." -ForegroundColor Yellow
docker-compose down

# Construire et démarrer les nouveaux conteneurs
Write-Host "🔨 Construction et démarrage des conteneurs..." -ForegroundColor Yellow
docker-compose up -d --build

# Attendre que les services soient prêts
Write-Host "⏳ Attente du démarrage des services..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Vérifier le statut des conteneurs
Write-Host "📊 Statut des conteneurs:" -ForegroundColor Cyan
docker-compose ps

# Vérifier la santé de l'application
Write-Host "🏥 Vérification de la santé de l'application..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3020/api/load-data" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Application démarrée avec succès!" -ForegroundColor Green
        Write-Host "🌐 Application accessible sur: http://localhost:3020" -ForegroundColor Green
        Write-Host "🔧 API accessible sur: http://localhost:3020/api/" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ L'application ne répond pas correctement" -ForegroundColor Red
    Write-Host "📋 Logs des conteneurs:" -ForegroundColor Yellow
    docker-compose logs --tail=50
    exit 1
}

# Afficher les informations de déploiement
Write-Host ""
Write-Host "🎉 Déploiement terminé avec succès!" -ForegroundColor Green
Write-Host "📊 Informations de déploiement:" -ForegroundColor Cyan
Write-Host "   - Application: $AppName" -ForegroundColor White
Write-Host "   - Environnement: $Environment" -ForegroundColor White
Write-Host "   - Repository: $RepoUrl" -ForegroundColor White
Write-Host "   - Répertoire: $DeployDir" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Commandes utiles:" -ForegroundColor Cyan
Write-Host "   - Voir les logs: docker-compose logs -f" -ForegroundColor White
Write-Host "   - Redémarrer: docker-compose restart" -ForegroundColor White
Write-Host "   - Arrêter: docker-compose down" -ForegroundColor White
Write-Host "   - Mettre à jour: .\deploy.ps1" -ForegroundColor White
Write-Host ""
Write-Host "📁 Données persistantes:" -ForegroundColor Cyan
Write-Host "   - Volume des données: plane_data" -ForegroundColor White
Write-Host "   - Volume des logs: plane_logs" -ForegroundColor White
