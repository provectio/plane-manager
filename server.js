/**
 * Serveur Express pour Plane Manager
 * Sert l'application React et l'API backend
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3020;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Créer le répertoire data s'il n'existe pas
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialiser les fichiers de données par défaut s'ils n'existent pas
const initializeDefaultData = () => {
  const defaultTeams = [
    {
      id: "team-1",
      name: "Développement",
      color: "#3B82F6",
      description: "Équipe de développement logiciel"
    },
    {
      id: "team-2", 
      name: "Infrastructure",
      color: "#10B981",
      description: "Équipe infrastructure et DevOps"
    },
    {
      id: "team-3",
      name: "Support",
      color: "#F59E0B", 
      description: "Équipe support technique"
    }
  ];

  const defaultTemplates = [
    {
      id: "template-1",
      name: "Template Développement",
      description: "Template pour les projets de développement",
      team: "Développement",
      icon: "💻",
      tasks: []
    },
    {
      id: "template-2",
      name: "Template Infrastructure", 
      description: "Template pour les projets infrastructure",
      team: "Infrastructure",
      icon: "🔧",
      tasks: []
    }
  ];

  const defaultMetadata = {
    lastSync: null,
    version: "1.0.0",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Créer les fichiers s'ils n'existent pas
  const files = [
    { name: 'teams.json', data: defaultTeams },
    { name: 'module-templates.json', data: defaultTemplates },
    { name: 'projects.json', data: [] },
    { name: 'metadata.json', data: defaultMetadata }
  ];

  files.forEach(file => {
    const filePath = path.join(dataDir, file.name);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(file.data, null, 2));
      console.log(`📝 Fichier ${file.name} créé avec des données par défaut`);
    }
  });
};

// Initialiser les données au démarrage
initializeDefaultData();

// Servir les fichiers statiques de l'application React
app.use(express.static(path.join(__dirname, 'dist')));

// Route pour sauvegarder les données
app.post('/api/save-data', (req, res) => {
  try {
    const { teams, moduleTemplates, projects, lastSync } = req.body;
    
    // Sauvegarder chaque type de données dans des fichiers séparés
    fs.writeFileSync(path.join(dataDir, 'teams.json'), JSON.stringify(teams, null, 2));
    fs.writeFileSync(path.join(dataDir, 'module-templates.json'), JSON.stringify(moduleTemplates, null, 2));
    fs.writeFileSync(path.join(dataDir, 'projects.json'), JSON.stringify(projects, null, 2));
    fs.writeFileSync(path.join(dataDir, 'metadata.json'), JSON.stringify({
      lastSync,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, null, 2));
    
    console.log('✅ Données sauvegardées dans les fichiers JSON');
    res.json({ success: true, message: 'Données sauvegardées avec succès' });
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route pour charger les données
app.get('/api/load-data', (req, res) => {
  try {
    // Vérifier si les fichiers existent, sinon retourner des données par défaut
    let teams = [];
    let moduleTemplates = [];
    let projects = [];
    let lastSync = null;

    try {
      teams = JSON.parse(fs.readFileSync(path.join(dataDir, 'teams.json'), 'utf8'));
    } catch (e) {
      console.log('📝 Fichier teams.json non trouvé, utilisation des données par défaut');
    }

    try {
      moduleTemplates = JSON.parse(fs.readFileSync(path.join(dataDir, 'module-templates.json'), 'utf8'));
    } catch (e) {
      console.log('📝 Fichier module-templates.json non trouvé, utilisation des données par défaut');
    }

    try {
      projects = JSON.parse(fs.readFileSync(path.join(dataDir, 'projects.json'), 'utf8'));
    } catch (e) {
      console.log('📝 Fichier projects.json non trouvé, utilisation des données par défaut');
    }

    try {
      const metadata = JSON.parse(fs.readFileSync(path.join(dataDir, 'metadata.json'), 'utf8'));
      lastSync = metadata.lastSync;
    } catch (e) {
      console.log('📝 Fichier metadata.json non trouvé');
    }
    
    res.json({
      teams,
      moduleTemplates,
      projects,
      lastSync
    });
  } catch (error) {
    console.error('❌ Erreur lors du chargement:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route de santé pour les health checks
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Route catch-all pour servir l'application React (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  console.error('❌ Erreur serveur:', err);
  res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur Plane Manager démarré sur le port ${PORT}`);
  console.log(`📁 Répertoire de données: ${dataDir}`);
  console.log(`🌐 Application accessible sur: http://localhost:${PORT}`);
  console.log(`🔧 API accessible sur: http://localhost:${PORT}/api/`);
});