import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TeamType, SubTask, Module, ModuleType, ModuleStatus, Task, TaskStatus } from '../types';
import {
  saveToBackend,
  loadFromBackend,
  initializeBackendStorage,
  autoSaveToBackend
} from '../utils/backendStorage';

export interface LocalTeam {
  id: string;
  name: string;
  description: string;
  color: string;
  trigramme: string;
  icon: string;
}

export interface LocalModuleTemplate {
  id: string;
  name: string;
  team: TeamType;
  tasks: Task[];
  description?: string;
  color?: string;
  icon?: string;
}

export interface LocalProject {
  id: string;
  name: string;
  salesforceNumber: string;
  boardId: string;
  planeProjectId: string;
  identifier: string;
  description: string;
  modules: Module[];
  status: 'not_started' | 'in_progress' | 'completed' | 'on_hold' | 'archived';
  progress: number;
  createdAt: string;
  updatedAt: string;
  syncStatus?: 'syncing' | 'synced' | 'error';
}

export interface LocalData {
  teams: LocalTeam[];
  moduleTemplates: LocalModuleTemplate[];
  projects: LocalProject[];
  lastSync: string | null;
}

interface LocalDataStore {
  data: LocalData;
  
  // Teams
  addTeam: (team: Omit<LocalTeam, 'id'>) => void;
  updateTeam: (id: string, updates: Partial<LocalTeam>) => void;
  deleteTeam: (id: string) => void;
  getTeamById: (id: string) => LocalTeam | undefined;
  getTeamByTrigramme: (trigramme: string) => LocalTeam | undefined;
  
  // Module Templates
  addModuleTemplate: (template: Omit<LocalModuleTemplate, 'id'>) => void;
  updateModuleTemplate: (id: string, updates: Partial<LocalModuleTemplate>) => void;
  deleteModuleTemplate: (id: string) => void;
  getModuleTemplatesByTeam: (team: TeamType) => LocalModuleTemplate[];
  
  // Sub-tasks in templates
  addSubTaskToTemplate: (templateId: string, taskIndex: number, subTask: Omit<SubTask, 'id' | 'planeSubIssueId'>) => void;
  updateSubTaskInTemplate: (templateId: string, taskIndex: number, subTaskIndex: number, updates: Partial<SubTask>) => void;
  removeSubTaskFromTemplate: (templateId: string, taskIndex: number, subTaskIndex: number) => void;
  reorderSubTasksInTemplate: (templateId: string, taskIndex: number, oldIndex: number, newIndex: number) => void;
  
  // Projects
  addProject: (project: Omit<LocalProject, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProject: (id: string, updates: Partial<LocalProject>) => void;
  deleteProject: (id: string) => void;
  getProjectById: (id: string) => LocalProject | undefined;
  
  // Sync
  setLastSync: (date: string) => void;
  exportData: () => LocalData;
  importData: (data: LocalData) => void;
  clearAllData: () => void;
  
  // Backend storage functions (stockage via le serveur backend)
  initializeBackendStorage: () => Promise<void>;
  saveToBackend: () => Promise<void>;
  loadFromBackend: () => Promise<void>;
}

const generateId = () => `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const generateTrigramme = (name: string): string => {
  const words = name.split(' ').filter(word => word.length > 0);
  if (words.length === 0) return 'XXX';
  
  if (words.length === 1) {
    return words[0].substring(0, 3).toUpperCase();
  }
  
  return words.map(word => word[0]).join('').substring(0, 3).toUpperCase();
};

// Helper function for auto-saving
const autoSaveData = async (get: () => LocalDataStore) => {
  try {
    const currentData = get().data;
    await autoSaveToBackend(currentData);
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde automatique:', error);
  }
};

export const useLocalDataStore = create<LocalDataStore>()(
  persist(
    (set, get) => ({
      data: {
        teams: [],
        moduleTemplates: [],
        projects: [],
        lastSync: null
      },

      // Teams
      addTeam: (teamData) => {
        const id = generateId();
        const trigramme = generateTrigramme(teamData.name);
        
        // Ensure trigramme is unique
        let finalTrigramme = trigramme;
        let counter = 1;
        const maxAttempts = 10; // Prevent infinite loop
        while (get().getTeamByTrigramme(finalTrigramme) && counter <= maxAttempts) {
          finalTrigramme = `${trigramme}${counter}`.substring(0, 3);
          counter++;
        }
        
        // If still not unique after max attempts, add timestamp
        if (get().getTeamByTrigramme(finalTrigramme)) {
          finalTrigramme = `${trigramme}${Date.now().toString().slice(-1)}`.substring(0, 3);
        }

        const team: LocalTeam = {
          id,
          trigramme: finalTrigramme,
          ...teamData
        };

        set((state) => ({
          data: {
            ...state.data,
            teams: [...state.data.teams, team]
          }
        }));
        
        // Auto-save to files
        autoSaveData(get);
      },

      updateTeam: (id, updates) => {
        set((state) => ({
          data: {
            ...state.data,
            teams: state.data.teams.map(team => 
              team.id === id ? { ...team, ...updates } : team
            )
          }
        }));
        
        // Auto-save to files
        autoSaveData(get);
      },

      deleteTeam: (id) => {
        set((state) => ({
          data: {
            ...state.data,
            teams: state.data.teams.filter(team => team.id !== id)
          }
        }));
        
        // Auto-save to files
        autoSaveData(get);
      },

      getTeamById: (id) => {
        return get().data.teams.find(team => team.id === id);
      },

      getTeamByTrigramme: (trigramme) => {
        return get().data.teams.find(team => team.trigramme === trigramme);
      },

      // Module Templates
      addModuleTemplate: (templateData) => {
        const id = generateId();
        const template: LocalModuleTemplate = {
          id,
          ...templateData
        };

        set((state) => ({
          data: {
            ...state.data,
            moduleTemplates: [...state.data.moduleTemplates, template]
          }
        }));
        
        // Auto-save to files
        autoSaveData(get);
      },

      updateModuleTemplate: (id, updates) => {
        set((state) => ({
          data: {
            ...state.data,
            moduleTemplates: state.data.moduleTemplates.map(template => 
              template.id === id ? { ...template, ...updates } : template
            )
          }
        }));
        
        // Auto-save to files
        autoSaveData(get);
      },

      deleteModuleTemplate: (id) => {
        set((state) => ({
          data: {
            ...state.data,
            moduleTemplates: state.data.moduleTemplates.filter(template => template.id !== id)
          }
        }));
        
        // Auto-save to files
        autoSaveData(get);
      },

      getModuleTemplatesByTeam: (team) => {
        return get().data.moduleTemplates.filter(template => template.team === team);
      },

      // Sub-tasks in templates
      addSubTaskToTemplate: (templateId, taskIndex, subTaskData) => {
        const id = generateId();
        const subTask: SubTask = {
          id,
          planeSubIssueId: '', // Will be set when synced with Plane
          ...subTaskData
        };

        set((state) => ({
          data: {
            ...state.data,
            moduleTemplates: state.data.moduleTemplates.map(template => {
              if (template.id === templateId) {
                const newTasks = [...template.tasks];
                if (newTasks[taskIndex]) {
                  newTasks[taskIndex] = {
                    ...newTasks[taskIndex],
                    subTasks: [...(newTasks[taskIndex].subTasks || []), subTask]
                  };
                }
                return { ...template, tasks: newTasks };
              }
              return template;
            })
          }
        }));
        
        // Auto-save to files
        autoSaveData(get);
      },

      updateSubTaskInTemplate: (templateId, taskIndex, subTaskIndex, updates) => {
        set((state) => ({
          data: {
            ...state.data,
            moduleTemplates: state.data.moduleTemplates.map(template => {
              if (template.id === templateId) {
                const newTasks = [...template.tasks];
                if (newTasks[taskIndex] && newTasks[taskIndex].subTasks) {
                  const newSubTasks = [...newTasks[taskIndex].subTasks];
                  if (newSubTasks[subTaskIndex]) {
                    newSubTasks[subTaskIndex] = { ...newSubTasks[subTaskIndex], ...updates };
                    newTasks[taskIndex] = { ...newTasks[taskIndex], subTasks: newSubTasks };
                  }
                }
                return { ...template, tasks: newTasks };
              }
              return template;
            })
          }
        }));
        
        // Auto-save to files
        autoSaveData(get);
      },

      removeSubTaskFromTemplate: (templateId, taskIndex, subTaskIndex) => {
        set((state) => ({
          data: {
            ...state.data,
            moduleTemplates: state.data.moduleTemplates.map(template => {
              if (template.id === templateId) {
                const newTasks = [...template.tasks];
                if (newTasks[taskIndex] && newTasks[taskIndex].subTasks) {
                  const newSubTasks = newTasks[taskIndex].subTasks.filter((_, index) => index !== subTaskIndex);
                  newTasks[taskIndex] = { ...newTasks[taskIndex], subTasks: newSubTasks };
                }
                return { ...template, tasks: newTasks };
              }
              return template;
            })
          }
        }));
        
        // Auto-save to files
        autoSaveData(get);
      },

      reorderSubTasksInTemplate: (templateId, taskIndex, oldIndex, newIndex) => {
        set((state) => ({
          data: {
            ...state.data,
            moduleTemplates: state.data.moduleTemplates.map(template => {
              if (template.id === templateId) {
                const newTasks = [...template.tasks];
                if (newTasks[taskIndex] && newTasks[taskIndex].subTasks) {
                  const newSubTasks = [...newTasks[taskIndex].subTasks];
                  const [movedSubTask] = newSubTasks.splice(oldIndex, 1);
                  newSubTasks.splice(newIndex, 0, movedSubTask);
                  newTasks[taskIndex] = { ...newTasks[taskIndex], subTasks: newSubTasks };
                }
                return { ...template, tasks: newTasks };
              }
              return template;
            })
          }
        }));
        
        // Auto-save to files
        autoSaveData(get);
      },

      // Projects
      addProject: (projectData) => {
        const id = generateId();
        const now = new Date().toISOString();
        const project: LocalProject = {
          id,
          createdAt: now,
          updatedAt: now,
          ...projectData
        };

        set((state) => ({
          data: {
            ...state.data,
            projects: [...state.data.projects, project]
          }
        }));
        
        // Auto-save to files
        autoSaveData(get);
      },

      updateProject: (id, updates) => {
        set((state) => ({
          data: {
            ...state.data,
            projects: state.data.projects.map(project => 
              project.id === id ? { ...project, ...updates, updatedAt: new Date().toISOString() } : project
            )
          }
        }));
        
        // Auto-save to files
        autoSaveData(get);
      },

      deleteProject: (id) => {
        set((state) => ({
          data: {
            ...state.data,
            projects: state.data.projects.filter(project => project.id !== id)
          }
        }));
        
        // Auto-save to files
        autoSaveData(get);
      },

      getProjectById: (id) => {
        return get().data.projects.find(project => project.id === id);
      },

      // Sync
      setLastSync: (date) => {
        set((state) => ({
          data: {
            ...state.data,
            lastSync: date
          }
        }));
        
        // Auto-save to files
        autoSaveData(get);
      },

      exportData: () => {
        return get().data;
      },

      importData: (data) => {
        set({ data });
        
        // Auto-save to files
        autoSaveData(get);
      },

      clearAllData: () => {
        set({
          data: {
            teams: [],
            moduleTemplates: [],
            projects: [],
            lastSync: null
          }
        });

        console.log('✅ All data cleared and reset to default state');
        console.log('🔄 Please refresh the page to reload with clean data');
      },

      // Backend storage functions (stockage via le serveur backend)
      initializeBackendStorage: async () => {
        try {
          await initializeBackendStorage();
          console.log('✅ Stockage backend initialisé');
        } catch (error) {
          console.error('❌ Erreur lors de l\'initialisation du stockage backend:', error);
          throw error;
        }
      },

      saveToBackend: async () => {
        try {
          const currentData = get().data;
          await saveToBackend(currentData);
          console.log('✅ Données sauvegardées vers le backend');
        } catch (error) {
          console.error('❌ Erreur lors de la sauvegarde vers le backend:', error);
          throw error;
        }
      },

      loadFromBackend: async () => {
        try {
          const data = await loadFromBackend();
          if (data) {
            set({ data });
            console.log('✅ Données chargées depuis le backend');
          }
        } catch (error) {
          console.error('❌ Erreur lors du chargement depuis le backend:', error);
          throw error;
        }
      },

    }),
    {
      name: 'local-data-storage',
      partialize: (state) => ({ data: state.data })
    }
  )
);