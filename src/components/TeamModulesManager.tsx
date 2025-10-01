import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { 
  TrashIcon,
  PlusIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { Project, Module, TeamType } from '../types';
import { useLocalDataStore } from '../store/useLocalDataStore';
// Migration désactivée - faite dans App.tsx
import SubTaskModal from './SubTaskModal';

interface TeamModulesManagerProps {
  project: Project;
  onAddTask: (moduleId: string) => Promise<void>;
  onRemoveTask: (moduleId: string, taskId: string) => Promise<void>;
  onRemoveModule: (moduleId: string) => Promise<void>;
  onUpdateModule: (moduleId: string, updates: Partial<Module>) => Promise<void>;
  onAddModule: (moduleType: string) => Promise<void>;
  onAddSubTask: (moduleId: string, taskId: string, subTask: Omit<import('../types').SubTask, 'id' | 'planeSubIssueId'>) => Promise<void>;
  onUpdateSubTask: (moduleId: string, taskId: string, subTaskId: string, updates: Partial<import('../types').SubTask>) => Promise<void>;
  onDeleteSubTask: (moduleId: string, taskId: string, subTaskId: string) => Promise<void>;
  newTaskNames: Record<string, string>;
  setNewTaskNames: (names: Record<string, string>) => void;
  setShowDeleteConfirm: (module: Module | null) => void;
  loading: boolean;
  modulesBeingAdded: Set<string>;
  modulesBeingDeleted: Set<string>;
}

export default function TeamModulesManager({
  project,
  onAddTask,
  onRemoveTask,
  onRemoveModule,
  onUpdateModule,
  onAddModule,
  onAddSubTask,
  onUpdateSubTask,
  onDeleteSubTask,
  newTaskNames,
  setNewTaskNames,
  setShowDeleteConfirm,
  loading,
  modulesBeingAdded,
  modulesBeingDeleted
}: TeamModulesManagerProps) {
  const { data: localData, addTeam, addModuleTemplate } = useLocalDataStore();
  const [selectedTeam, setSelectedTeam] = useState<TeamType | null>(null);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [showSubTaskModal, setShowSubTaskModal] = useState<{ moduleId: string; taskId: string; taskName: string } | null>(null);

  // Migration automatique des données au chargement - désactivé (fait dans App.tsx)


  const getModuleInfo = (moduleName: string) => {
    return localData.moduleTemplates.find(template => template.name === moduleName) || localData.moduleTemplates[0];
  };

  // Extract original module name without team prefix
  const getOriginalModuleName = (moduleName: string) => {
    // Remove pattern like [Team] from the beginning
    const match = moduleName.match(/^\[.*?\]\s*(.+)$/);
    return match ? match[1] : moduleName;
  };

  // Ensure modules have correct team assignment and prefix
  const ensureModuleTeams = () => {
    let hasChanges = false;
    project.modules.forEach(module => {
      const originalName = getOriginalModuleName(module.name);
      const template = localData.moduleTemplates.find(t => t.name === originalName);
      
      if (template) {
        // Ensure team is set correctly - fix if wrong team
        if (!module.team || module.team !== template.team) {
          module.team = template.team;
          hasChanges = true;
          console.log(`Fixed team for module ${module.name}: ${template.team}`);
        }
      }
    });
    
    if (hasChanges) {
      // Update local storage
      const { updateProject } = useLocalDataStore.getState();
      updateProject(project.id, { modules: project.modules });
      
      // Force re-render
      setForceUpdate(prev => prev + 1);
    }
  };

  // Call this on component mount
  useEffect(() => {
    ensureModuleTeams();
  }, []);

  // Count modules per team for badges
  const getModulesCountByTeam = (teamName: TeamType) => {
    if (!project?.modules || !Array.isArray(project.modules) || !localData.moduleTemplates || !Array.isArray(localData.moduleTemplates)) {
      return 0;
    }
    
    const count = project.modules.filter(module => {
      // First try to use module.team if it exists
      if (module.team && module.team === teamName) {
        return true;
      }
      
      // Fallback to template lookup
      const template = localData.moduleTemplates.find(t => t.name === module.name);
      return template?.team === teamName;
    }).length;
    
    return count;
  };

  // Debug logs
  console.log('🔍 TeamModulesManager Debug:', {
    moduleTemplates: localData.moduleTemplates?.length || 0,
    teams: localData.teams?.length || 0,
    projectModules: project.modules?.length || 0,
    selectedTeam,
    templates: localData.moduleTemplates
  });

  return (
    <div className="space-y-4">
      {/* Team Filter */}
      <div className="space-y-3 mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Filtrer par équipe
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedTeam(null)}
            className={`px-3 py-2 rounded-full text-sm font-medium transition-colors flex items-center space-x-2 ${
              selectedTeam === null
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <span>🏢</span>
            <span>Toutes les équipes</span>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              project.modules.length > 0
                ? 'bg-green-500 text-white'
                : 'bg-white bg-opacity-20 text-white'
            }`}>
              {project.modules.length}
            </span>
            {selectedTeam === null && <CheckIcon className="w-4 h-4" />}
          </button>
          
          {localData.teams && Array.isArray(localData.teams) && localData.teams.map((team) => {
            const moduleCount = getModulesCountByTeam(team.name);
            return (
              <button
                key={team.id}
                onClick={() => setSelectedTeam(team.name)}
                className={`px-3 py-2 rounded-full text-sm font-medium transition-colors flex items-center space-x-2 ${
                  selectedTeam === team.name
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                <span>{team.icon}</span>
                <span>{team.name}</span>
                <span className="px-1.5 py-0.5 bg-white bg-opacity-20 rounded text-xs font-mono">
                  {team.trigramme}
                </span>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  moduleCount > 0
                    ? 'bg-green-500 text-white'
                    : 'bg-white bg-opacity-20 text-white'
                }`}>
                  {moduleCount}
                </span>
                {selectedTeam === team.name && <CheckIcon className="w-4 h-4" />}
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Modules List */}
      <div className="space-y-2">
        <AnimatePresence>
          {localData.moduleTemplates
            .filter(template => !selectedTeam || template.team === selectedTeam)
                    .map((template) => {
                      const isAlreadyAdded = project.modules.some(m => getOriginalModuleName(m.name) === template.name);
                      const existingModule = project.modules.find(m => getOriginalModuleName(m.name) === template.name);
                      
                      // Debug logs
                      console.log(`🔍 Template: ${template.name}`);
                      console.log(`📋 Project modules:`, project.modules.map(m => m.name));
                      console.log(`🔍 Template name without prefix: ${getOriginalModuleName(template.name)}`);
                      console.log(`🔍 Project module names without prefix:`, project.modules.map(m => `${m.name} -> ${getOriginalModuleName(m.name)}`));
                      console.log(`✅ Is already added:`, isAlreadyAdded);
                      console.log(`🔍 Existing module:`, existingModule?.name);
                      
              
              return (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="w-full p-3 rounded-lg border transition-all duration-200 flex items-center justify-between bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-start space-x-3">
                    <span className="text-xl">{template.icon}</span>
                    <div className="flex-1 min-w-0">
                      {/* Tag d'équipe en haut */}
                      <div className="mb-2">
                        <span 
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white bg-blue-500"
                        >
                          {template.team}
                        </span>
                      </div>
                      
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {template.name}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {template.description}
                      </p>
                      {isAlreadyAdded && existingModule && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {existingModule.tasks.length} tâche(s)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {isAlreadyAdded ? (
                      modulesBeingDeleted.has(existingModule!.id) ? (
                        <button
                          disabled
                          className="p-1.5 rounded-full bg-green-500 text-white opacity-75 cursor-not-allowed transition-colors"
                          title="Module en cours de suppression..."
                        >
                          <PlusIcon className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            console.log('Delete button clicked, calling onRemoveModule with ID:', existingModule!.id);
                            onRemoveModule(existingModule!.id);
                          }}
                          className="p-1.5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                          title="Supprimer le module"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )
                    ) : modulesBeingAdded.has(template.name) ? (
                      <button
                        disabled
                        className="p-1.5 rounded-full bg-red-500 text-white opacity-75 cursor-not-allowed transition-colors"
                        title="Module en cours d'ajout..."
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => onAddModule(template.name)}
                        className="p-1.5 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors"
                        title="Ajouter le module"
                      >
                        <PlusIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
        </AnimatePresence>
      </div>

      {/* SubTask Modal */}
      {showSubTaskModal && (
        <SubTaskModal
          isOpen={true}
          onClose={() => setShowSubTaskModal(null)}
          taskId={showSubTaskModal.taskId}
          taskName={showSubTaskModal.taskName}
          subTasks={(() => {
            const module = project.modules.find(m => m.id === showSubTaskModal.moduleId);
            const task = module?.tasks.find(t => t.id === showSubTaskModal.taskId);
            return task?.subTasks || [];
          })()}
          onAddSubTask={(taskId, subTask) => onAddSubTask(showSubTaskModal.moduleId, taskId, subTask)}
          onUpdateSubTask={(taskId, subTaskId, updates) => onUpdateSubTask(showSubTaskModal.moduleId, taskId, subTaskId, updates)}
          onDeleteSubTask={(taskId, subTaskId) => onDeleteSubTask(showSubTaskModal.moduleId, taskId, subTaskId)}
          onReorderSubTasks={() => {}}
          loading={loading}
        />
      )}
    </div>
  );
}