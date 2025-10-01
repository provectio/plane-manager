/**
 * Stockage simplifié via le serveur backend
 * Toutes les données sont stockées dans les fichiers JSON du répertoire data/
 */

import { LocalData } from '../store/useLocalDataStore';

const BACKEND_URL = 'http://localhost:3001';

/**
 * Charge les données depuis le serveur backend
 */
export const loadFromBackend = async (): Promise<LocalData | null> => {
  try {
    console.log('📁 Chargement des données depuis le serveur backend...');
    
    const response = await fetch(`${BACKEND_URL}/api/load-data`);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log('📁 Aucune donnée trouvée, création des données par défaut...');
        return createDefaultData();
      }
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ Données chargées depuis le serveur backend:', {
      teams: data.teams?.length || 0,
      moduleTemplates: data.moduleTemplates?.length || 0,
      projects: data.projects?.length || 0
    });
    
    return data;
  } catch (error) {
    console.error('❌ Erreur lors du chargement depuis le backend:', error);
    console.log('🔄 Fallback vers les données par défaut...');
    return createDefaultData();
  }
};

/**
 * Sauvegarde les données vers le serveur backend
 */
export const saveToBackend = async (data: LocalData): Promise<void> => {
  try {
    console.log('💾 Sauvegarde des données vers le serveur backend...');
    
    const response = await fetch(`${BACKEND_URL}/api/save-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ Données sauvegardées vers le serveur backend:', result);
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde vers le backend:', error);
    throw error;
  }
};

/**
 * Crée les données par défaut avec les équipes
 */
const createDefaultData = (): LocalData => {
  const defaultData: LocalData = {
    teams: [
      {
        id: 'local_1759319112480_5ommtilwg',
        trigramme: 'INF',
        name: 'Infrasctruture',
        description: 'Gestion des infrastructures IT, serveurs, réseaux et équipements',
        color: '#579bfc',
        icon: '🏗️'
      },
      {
        id: 'local_1759319152350_f38eesrkv',
        trigramme: 'CYB',
        name: 'Cybersécurité',
        description: 'Sécurité informatique, protection des données et des flux',
        color: '#e2445c',
        icon: '🔒'
      },
      {
        id: 'local_1759319184309_6qz7nidqu',
        trigramme: 'TEL',
        name: 'Télécom',
        description: 'Télécommunications, connectivité et services de communication',
        color: '#00c875',
        icon: '📡'
      },
      {
        id: 'local_1759319216326_4w7uv2ucg',
        trigramme: 'CLO',
        name: 'Cloud',
        description: 'Services cloud, virtualisation et solutions hébergées',
        color: '#784bd1',
        icon: '☁️'
      },
      {
        id: 'local_1759319243368_8jy3693xv',
        trigramme: 'ING',
        name: 'Infogérance',
        description: 'Supervision, maintenance et assistance des systèmes d\'information',
        color: '#ff9800',
        icon: '🔧'
      },
      {
        id: 'local_1759319277176_brve1o0nx',
        trigramme: 'COF',
        name: 'Conformité',
        description: 'Gouvernance, conformité et maîtrise des risques informatiques',
        color: '#ff642e',
        icon: '📋'
      }
    ],
    moduleTemplates: [
      {
        id: 'local_1759319304401_59xf6une2',
        name: 'Serveur',
        description: '',
        team: 'Infrasctruture',
        tasks: [
          {
            name: '',
            subTasks: []
          }
        ],
        icon: '🏗️'
      },
      {
        id: 'local_1759319539672_8e926ssep',
        name: 'Création d\'un lien internet',
        description: '',
        team: 'Télécom',
        tasks: [
          {
            name: 'Validation des prérequis',
            subTasks: [
              {
                name: 'Contact client',
                status: 'todo',
                assignedPerson: '',
                id: 'subtask_1759319367096_0ye3u3aeg',
                mondaySubItemId: null
              },
              {
                name: 'Location du site de raccordement',
                status: 'todo',
                assignedPerson: '',
                id: 'subtask_1759319348134_ga0l6jd6q',
                mondaySubItemId: null
              },
              {
                name: 'Date souhaitée',
                status: 'todo',
                assignedPerson: '',
                id: 'subtask_1759319382155_8x9g4eu9x',
                mondaySubItemId: null
              },
              {
                name: 'Environnement coffret/baie',
                status: 'todo',
                assignedPerson: '',
                id: 'subtask_1759319359311_njac3b7fu',
                mondaySubItemId: null
              }
            ]
          },
          {
            name: 'Lancement de la production vers l\'OI'
          },
          {
            name: 'Confirmation de la date de construction avec l\'OI'
          },
          {
            name: 'Mise en service par l\'OI'
          },
          {
            name: 'Préparation de la configuration du lien en coeur de réseau'
          },
          {
            name: 'Confirmation de l\'IMES'
          },
          {
            name: 'Tests et recette'
          },
          {
            name: 'Passage en exploitation',
            subTasks: [
              {
                name: 'Intégration à la supervision',
                status: 'todo',
                assignedPerson: '',
                id: 'subtask_1759319484500_326fvwsse',
                mondaySubItemId: null
              },
              {
                name: 'Mise à jour des outils et documentation',
                status: 'todo',
                assignedPerson: '',
                id: 'subtask_1759319536621_slfcx2itr',
                mondaySubItemId: null
              }
            ]
          }
        ],
        icon: '📡'
      },
      {
        id: 'local_1759319565787_sbywka9y1',
        name: 'Firewall',
        description: '',
        team: 'Cybersécurité',
        tasks: [
          {
            name: ''
          }
        ],
        icon: '🔒'
      },
      {
        id: 'local_1759319578343_6qmwuaduj',
        name: 'EPP/EDR/XDR',
        description: '',
        team: 'Cybersécurité',
        tasks: [
          {
            name: '',
            subTasks: []
          }
        ],
        icon: '🔒'
      },
      {
        id: 'local_1759319582581_rp4ykkn3d',
        name: 'MDR (SOC)',
        description: '',
        team: 'Cybersécurité',
        tasks: [
          {
            name: '',
            subTasks: []
          }
        ],
        icon: '🔒'
      },
      {
        id: 'local_1759319599765_yyk433rgo',
        name: 'ProCyber',
        description: '',
        team: 'Cybersécurité',
        tasks: [
          {
            name: '',
            subTasks: []
          }
        ],
        icon: '🔒'
      },
      {
        id: 'local_1759319638216_z9fk4bwiu',
        name: 'Création d\'un VM hébergée',
        description: '',
        team: 'Cloud',
        tasks: [
          {
            name: '',
            subTasks: []
          }
        ],
        icon: '☁️'
      },
      {
        id: 'local_1759319675717_yxtxlq2sl',
        name: 'Onboarding d\'un contrat d\'infogérance',
        description: '',
        team: 'Infogérance',
        tasks: [
          {
            name: '',
            subTasks: []
          }
        ],
        icon: '🔧'
      }
    ],
    projects: [],
    lastSync: null
  };
  
  console.log('✅ Données par défaut créées avec', {
    teams: defaultData.teams.length,
    moduleTemplates: defaultData.moduleTemplates.length,
    projects: defaultData.projects.length
  });
  
  return defaultData;
};

/**
 * Initialise le système de stockage backend
 */
export const initializeBackendStorage = async (): Promise<void> => {
  try {
    console.log('🚀 Initialisation du stockage backend...');
    
    // Essayer de charger les données existantes
    const data = await loadFromBackend();
    
    if (data) {
      // Si on a des données, les sauvegarder pour s'assurer qu'elles sont bien dans le backend
      await saveToBackend(data);
      console.log('✅ Stockage backend initialisé avec les données existantes');
    } else {
      console.log('✅ Stockage backend initialisé avec les données par défaut');
    }
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation du stockage backend:', error);
    throw error;
  }
};

/**
 * Sauvegarde automatique vers le backend
 */
export const autoSaveToBackend = async (data: LocalData): Promise<void> => {
  try {
    await saveToBackend(data);
    console.log('💾 Sauvegarde automatique vers le backend effectuée');
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde automatique vers le backend:', error);
    // Ne pas lancer l'erreur pour la sauvegarde automatique
  }
};
