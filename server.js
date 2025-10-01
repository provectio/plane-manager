/**
 * Serveur simple pour écrire directement dans les fichiers JSON
 * Ce serveur permet d'écrire dans les fichiers du répertoire data/
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
app.use(express.json());

// Créer le répertoire data s'il n'existe pas
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

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

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur de données démarré sur le port ${PORT}`);
  console.log(`📁 Répertoire de données: ${dataDir}`);
});
