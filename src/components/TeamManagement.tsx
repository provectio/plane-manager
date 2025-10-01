import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlusIcon,
  TrashIcon,
  PencilIcon,
  XMarkIcon,
  ChartBarIcon,
  DocumentPlusIcon
} from '@heroicons/react/24/outline';
import { Team, TeamType } from '../types';
import { useLocalDataStore } from '../store/useLocalDataStore';
// Migration désactivée - faite dans App.tsx
import TeamStats from './TeamStats';

const AVAILABLE_COLORS = [
  '#579bfc', '#e2445c', '#00c875', '#784bd1', '#ff642e', 
  '#9c27b0', '#607d8b', '#f44336', '#4caf50', '#ff9800',
  '#2196f3', '#9c27b0', '#795548', '#607d8b', '#ff5722'
];

const AVAILABLE_ICONS = [
  '🏗️', '🔒', '📡', '☁️', '⚙️', '📋', '🎯', '💻', '🔧', '📊', 
  '🛡️', '🌐', '📱', '💾', '🔍', '📈', '🎨', '⚡', '🔐', '📝'
];

// Fonction pour générer un trigramme à partir du nom
const generateTrigramme = (name: string): string => {
  if (!name || name.trim().length === 0) return '';
  
  const words = name.trim().split(/\s+/);
  
  if (words.length === 1) {
    // Un seul mot : prendre les 3 premières lettres
    return words[0].substring(0, 3).toUpperCase();
  } else if (words.length === 2) {
    // Deux mots : première lettre du premier + 2 premières du second
    return (words[0][0] + words[1].substring(0, 2)).toUpperCase();
  } else {
    // Plus de 2 mots : première lettre de chaque mot
    return words.map(word => word[0]).join('').substring(0, 3).toUpperCase();
  }
};

// Fonction pour valider un trigramme
const validateTrigramme = (trigramme: string): boolean => {
  if (!trigramme || trigramme.length !== 3) return false;
  return /^[A-Z]{3}$/.test(trigramme);
};


export default function TeamManagement() {
  const { data: localData, addTeam, updateTeam, deleteTeam, updateTemplate } = useLocalDataStore();
  
  // Migration automatique des données au chargement - désactivé (fait dans App.tsx)
  // Les templates sont maintenant dans le stockage local
  // Removed useAppStore - using local data only
  const { projects, moduleTemplates: templates } = localData;
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Team | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [trigrammeError, setTrigrammeError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#579bfc',
    icon: '🏗️',
    trigramme: ''
  });

  const [teamName, setTeamName] = useState('');


  const handleAddTeam = () => {
    console.log('🔍 handleAddTeam called, teamName:', teamName);
    if (!teamName.trim()) {
      console.log('⚠️ No team name provided');
      return;
    }
    
    // Valider le trigramme
    if (!validateTrigramme(formData.trigramme)) {
      console.log('⚠️ Trigramme validation failed');
      setTrigrammeError('Le trigramme doit faire exactement 3 lettres majuscules et être unique');
      return;
    }
    
    console.log('✅ Adding team:', { name: teamName, trigramme: formData.trigramme });
    addTeam({
      name: teamName as TeamType,
      description: formData.description,
      color: formData.color,
      icon: formData.icon,
      trigramme: formData.trigramme
    });
    
    setFormData({
      name: '',
      description: '',
      color: '#579bfc',
      icon: '🏗️',
      trigramme: ''
    });
    setTeamName('');
    setTrigrammeError('');
    setShowAddForm(false);
  };

  const handleEditTeam = () => {
    if (!editingTeam || !teamName.trim()) return;
    
    // Valider le trigramme
    if (!validateTrigramme(formData.trigramme, editingTeam.id)) {
      setTrigrammeError('Le trigramme doit faire exactement 3 lettres majuscules et être unique');
      return;
    }
    
    const oldTeamName = editingTeam.name;
    const newTeamName = teamName as TeamType;
    
    // Mettre à jour l'équipe
    updateTeam(editingTeam.id, {
      name: newTeamName,
      description: formData.description,
      color: formData.color,
      icon: formData.icon,
      trigramme: formData.trigramme
    });
    
    // Si le nom a changé, synchroniser les templates et modules
    if (oldTeamName !== newTeamName) {
      console.log(`🔄 Synchronisation: ${oldTeamName} -> ${newTeamName}`);
      
      // Mettre à jour tous les templates qui appartiennent à l'ancienne équipe
      templates.forEach(template => {
        if (template.team === oldTeamName) {
          console.log(`📝 Mise à jour template: ${template.name} (${template.team} -> ${newTeamName})`);
          updateTemplate(template.id, { team: newTeamName });
        }
      });
      
      // Mettre à jour tous les modules dans les projets qui appartiennent à l'ancienne équipe
      projects.forEach(project => {
        const updatedModules = project.modules.map(module => {
          if (module.team === oldTeamName) {
            console.log(`🏗️ Mise à jour module: ${module.name} dans projet ${project.name} (${module.team} -> ${newTeamName})`);
            return { ...module, team: newTeamName };
          }
          return module;
        });
        
        if (updatedModules.some((module, index) => module.team !== project.modules[index].team)) {
          updateProject(project.id, { modules: updatedModules });
        }
      });
      
      console.log('✅ Synchronisation terminée');
    }
    
    setEditingTeam(null);
    setShowAddForm(false);
    setTrigrammeError('');
    setFormData({
      name: '',
      description: '',
      color: '#579bfc',
      icon: '🏗️',
      trigramme: ''
    });
  };

  const handleDeleteTeam = () => {
    if (!showDeleteConfirm || deleteConfirmText !== 'DELETE') return;
    
    deleteTeam(showDeleteConfirm.id);
    setShowDeleteConfirm(null);
    setDeleteConfirmText('');
  };

  const startEdit = (team: Team) => {
    setEditingTeam(team);
    setTeamName(team.name);
    setFormData({
      name: team.name,
      description: team.description,
      color: team.color,
      icon: team.icon,
      trigramme: team.trigramme
    });
    setTrigrammeError('');
    setShowAddForm(true);
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingTeam(null);
    setTrigrammeError('');
    setFormData({
      name: '',
      description: '',
      color: '#579bfc',
      icon: '🏗️',
      trigramme: ''
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Gestion des équipes
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Gérez les équipes et leurs modules
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowStats(!showStats)}
            className="btn-secondary flex items-center space-x-2"
          >
            <ChartBarIcon className="w-5 h-5" />
            <span>{showStats ? 'Masquer les statistiques' : 'Afficher les statistiques'}</span>
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-secondary flex items-center space-x-2"
          >
            <PlusIcon className="w-5 h-5" />
            <span>Ajouter une équipe</span>
          </button>
        </div>
      </div>

      {/* Statistics */}
      {showStats && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-6"
        >
          <TeamStats />
        </motion.div>
      )}

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {localData.teams.map((team) => (
            <motion.div
              key={team.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Team Header */}
              <div 
                className="p-4 text-white"
                style={{ backgroundColor: team.color }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{team.icon}</span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-lg">{team.name}</h3>
                        <span className="px-2 py-1 bg-white bg-opacity-20 rounded text-xs font-mono">
                          {team.trigramme}
                        </span>
                      </div>
                      <p className="text-sm opacity-90">{team.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => startEdit(team)}
                      className="p-1.5 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-colors"
                      title="Modifier l'équipe"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Team Actions */}
              <div className="p-4 flex justify-between items-center">
                <Link
                  to={`/module-templates?team=${encodeURIComponent(team.name)}`}
                  className="flex items-center space-x-2 px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  title="Créer un module pour cette équipe"
                >
                  <DocumentPlusIcon className="w-4 h-4" />
                  <span>Créer un module</span>
                </Link>
                
                <button
                  onClick={() => setShowDeleteConfirm(team)}
                  className="flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Supprimer l'équipe"
                >
                  <TrashIcon className="w-4 h-4" />
                  <span>Supprimer</span>
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl mx-4 w-full max-h-[80vh] overflow-y-auto"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {editingTeam ? 'Modifier l\'équipe' : 'Ajouter une équipe'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nom de l'équipe
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => {
                    setTeamName(e.target.value);
                    setFormData(prev => ({ 
                      ...prev, 
                      name: e.target.value
                    }));
                  }}
                  placeholder="Ex: Infrastructure"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Trigramme
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={formData.trigramme}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 3);
                      setFormData({ ...formData, trigramme: value });
                      setTrigrammeError('');
                    }}
                    placeholder="Ex: INF"
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 flex-1 ${trigrammeError ? 'border-red-500' : ''}`}
                    maxLength={3}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      console.log('🔍 Auto button clicked, teamName:', teamName);
                      if (teamName.trim()) {
                        const generated = generateTrigramme(teamName);
                        console.log('🔍 Generated trigramme:', generated);
                        setFormData({ ...formData, trigramme: generated });
                        setTrigrammeError('');
                      } else {
                        console.log('⚠️ No team name provided');
                      }
                    }}
                    disabled={!teamName.trim()}
                    className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                      !teamName.trim() 
                        ? 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                    title="Générer automatiquement"
                  >
                    Auto
                  </button>
                </div>
                {trigrammeError && (
                  <p className="text-red-500 text-sm mt-1">{trigrammeError}</p>
                )}
                <p className="text-gray-500 text-xs mt-1">
                  3 lettres majuscules pour identifier l'équipe
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description de l'équipe..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Couleur
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-full border-2 ${
                        formData.color === color ? 'border-gray-900 dark:border-white' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Icône
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_ICONS.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setFormData({ ...formData, icon })}
                      className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-lg ${
                        formData.icon === icon ? 'border-blue-500 bg-blue-50 dark:bg-blue-900' : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={cancelForm}
                className="btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={editingTeam ? handleEditTeam : handleAddTeam}
                disabled={!teamName.trim()}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingTeam ? 'Modifier' : 'Ajouter'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4 w-full"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Supprimer l'équipe
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Êtes-vous sûr de vouloir supprimer l'équipe <strong>{showDeleteConfirm.name}</strong> ?
              Cette action est irréversible.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tapez <strong>DELETE</strong> pour confirmer :
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="DELETE"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(null);
                  setDeleteConfirmText('');
                }}
                className="btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteTeam}
                disabled={deleteConfirmText !== 'DELETE'}
                className="btn-danger disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Supprimer
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
