import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppState, Project, Module, Task, SubTask, ApiStatus, Theme, ModuleType, ModuleStatus, TaskStatus, ProjectStatus } from '../types';
import { planeApi } from '../services/planeApi';
import { useModuleTemplatesStore } from './useModuleTemplatesStore';
import { useTeamsStore } from './useTeamsStore';

// Utility function to calculate project progress based on task statuses
const calculateProjectProgress = (modules: Module[]): number => {
  const allTasks = modules.flatMap(module => module.tasks);
  
  if (allTasks.length === 0) return 0;
  
  let totalProgress = 0;
  
  allTasks.forEach(task => {
    switch (task.status) {
      case 'done':
        totalProgress += 100;
        break;
      case 'in_progress':
        totalProgress += 50;
        break;
      case 'todo':
      default:
        totalProgress += 0;
        break;
    }
  });
  
  return Math.round(totalProgress / allTasks.length);
};

interface AppStore extends AppState {
  // Cache state
  projectsCache: Project[] | null;
  lastCacheUpdate: number | null;
  isRefreshing: boolean;
  isBackgroundSyncRunning: boolean;
  syncInterval: any;
  deletedProjectIds: Set<string>; // Track deleted projects to prevent them from reappearing
  
  // Actions
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  deleteProject: (projectId: string, planeProjectId?: string) => Promise<void>;
  setApiStatus: (status: ApiStatus) => void;
  setTheme: (theme: Theme) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  loadProjectsFromPlane: (useCache?: boolean) => Promise<void>;
  refreshProjectsInBackground: () => Promise<void>;
  invalidateCache: () => void;
  forceSync: () => Promise<void>;
  createProject: (projectData: {
    name: string;
    salesforceNumber: string;
    description?: string;
    modules: string[];
  }) => Promise<any>;
  addModuleToProject: (projectId: string, moduleName: string) => Promise<void>;
  removeModuleFromProject: (projectId: string, moduleId: string) => Promise<void>;
  updateModuleInProject: (projectId: string, moduleId: string, updates: Partial<Module>) => Promise<void>;
  addSubTaskToTask: (projectId: string, moduleId: string, taskId: string, subTask: Omit<import('../types').SubTask, 'id' | 'planeSubIssueId'>) => Promise<void>;
  updateSubTaskInTask: (projectId: string, moduleId: string, taskId: string, subTaskId: string, updates: Partial<import('../types').SubTask>) => Promise<void>;
  removeSubTaskFromTask: (projectId: string, moduleId: string, taskId: string, subTaskId: string) => Promise<void>;
  refreshProject: (projectId: string) => Promise<void>;
  startAutoSync: () => void;
  stopAutoSync: () => void;
  manualSync: () => Promise<void>;
}

// Helper function to get default tasks for a module from templates
const getDefaultTasksForModule = (moduleName: string, salesforceNumber: string): { name: string; subTasks?: SubTask[] }[] => {
  // Get templates from the module templates store
  const templates = useModuleTemplatesStore.getState().templates;
  
  // Find the template that matches the module name
  const template = templates.find(t => t.name === moduleName);
  
  if (template) {
    // Reverse the order and add numbering
    return template.tasks.map((task, index) => {
      const taskNumber = template.tasks.length - index; // Reverse order
      const taskName = task.name; // Keep only the descriptive name
      
      // Reverse sub-tasks order and add numbering
      const subTasks = task.subTasks ? task.subTasks.map((subTask, subIndex) => {
        const subTaskNumber = task.subTasks!.length - subIndex; // Reverse order
        return {
          ...subTask,
          name: subTask.name // Keep only the descriptive name
        };
      }).reverse() : [];
      
      return { 
        name: taskName,
        subTasks: subTasks
      };
    }).reverse(); // Reverse the entire array
  }
  
  // Fallback to default tasks if template not found
  return [
    { name: 'Tâche 3', subTasks: [] },
    { name: 'Tâche 2', subTasks: [] },
    { name: 'Tâche 1', subTasks: [] },
  ];
};

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
               // Initial state
               projects: [],
               projectsCache: null,
               lastCacheUpdate: null,
               isRefreshing: false,
               isBackgroundSyncRunning: false,
               syncInterval: null,
               deletedProjectIds: new Set<string>(),
               apiStatus: {
                 isConnected: false,
                 lastChecked: new Date().toISOString(),
               },
               theme: {
                 mode: 'light',
               },
               isLoading: false,
               error: null,

      // Actions
      setProjects: (projects) => set({ projects }),
      
      addProject: (project) => set((state) => ({
        projects: [...state.projects, project]
      })),
      
      updateProject: (projectId, updates) => set((state) => ({
        projects: state.projects.map(project =>
          project.id === projectId ? { ...project, ...updates } : project
        )
      })),
      
      
      setApiStatus: (apiStatus) => set({ apiStatus }),
      
      setTheme: (theme) => set({ theme }),
      
      setLoading: (isLoading) => set({ isLoading }),
      
      setError: (error) => set({ error }),
      
      clearError: () => set({ error: null }),

      // Load projects from Plane.so with cache support
      loadProjectsFromPlane: async (useCache = true) => {
        const state = get();
        const now = Date.now();
        const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache
        
        // If cache is valid and useCache is true, return cached data immediately
        if (useCache && state.projectsCache && state.lastCacheUpdate && 
            (now - state.lastCacheUpdate) < CACHE_DURATION) {
          set({ projects: state.projectsCache, isLoading: false });
          
          // Start background refresh if cache is older than 5 minutes and not already running
          if ((now - state.lastCacheUpdate) > 5 * 60 * 1000 && !state.isBackgroundSyncRunning) {
            state.refreshProjectsInBackground();
          }
          return;
        }
        
        try {
          set({ isLoading: true, error: null });
          
          // Check if workspace slug is configured
          const workspaceSlug = import.meta.env.VITE_PLANE_WORKSPACE_SLUG;
          if (!workspaceSlug) {
            throw new Error('Workspace slug not configured. Please set VITE_PLANE_WORKSPACE_SLUG in your .env.local file.');
          }
          
          const result = await planeApi.getProjects();
          const state = get();
          const filteredProjects = result.projects.filter((project: any) => 
            !project.archived_at && !state.deletedProjectIds.has(project.id)
          );
          
          // Load project details sequentially to avoid rate limiting
          const resolvedProjects: Project[] = [];
          
          for (let i = 0; i < filteredProjects.length; i++) {
            const project = filteredProjects[i];
            
            try {
              console.log(`Loading details for project ${i + 1}/${filteredProjects.length}: ${project.name}`);
              
              // Add delay between requests to avoid rate limiting
              if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between requests
              }
              
              // Get detailed project data with modules and issues
              const projectDetails = await planeApi.getProject(project.id);
              
              const processedProject: Project = {
                id: project.id,
                name: project.name,
                description: project.description || '',
                salesforceNumber: project.name.split('-')[0] || '',
                boardId: project.id,
                planeProjectId: project.id,
                identifier: project.identifier,
                status: 'in_progress' as ProjectStatus,
                modules: projectDetails.modules.map((module: any) => {
                  // Get module color and team from templates
                  const template = useModuleTemplatesStore.getState().templates.find(t => t.name === module.name);
                  const moduleColor = template ? template.color : '#3B82F6';
                  const moduleTeam = template?.team || 'Infrastructure';
                  
                  return {
                    id: module.id,
                    name: module.name,
                    type: 'Infrastructure' as ModuleType, // Default type
                    team: moduleTeam,
                    planeModuleId: module.id,
                    tasks: module.issues.map((issue: any) => {
                      // Map Plane.so state to our TaskStatus
                      let taskStatus: TaskStatus = 'todo';
                      if (issue.state === 'completed' || issue.state === 'done') {
                        taskStatus = 'done';
                      } else if (issue.state === 'in_progress' || issue.state === 'started') {
                        taskStatus = 'in_progress';
                      }
                      
                      return {
                        id: issue.id,
                        name: issue.name,
                        itemId: issue.id,
                        planeIssueId: issue.id,
                        status: taskStatus,
                        description: issue.description,
                      };
                    }),
                    status: 'not_started' as ModuleStatus,
                  };
                }),
                createdAt: project.created_at,
                updatedAt: project.updated_at,
              };
              
              resolvedProjects.push(processedProject);
              
            } catch (error) {
              console.warn(`Failed to load details for project ${project.name}:`, error);
              
              // If it's a 429 error, add a longer delay before continuing
              if (error instanceof Error && error.message.includes('429')) {
                console.log('Rate limit hit, waiting 2 seconds before continuing...');
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
              
              // Add a basic project entry even if details failed
              const basicProject: Project = {
                id: project.id,
                name: project.name,
                description: project.description || '',
                salesforceNumber: project.name.split('-')[0] || '',
                boardId: project.id,
                planeProjectId: project.id,
                identifier: project.identifier,
                status: 'in_progress' as ProjectStatus,
                modules: [],
                createdAt: project.created_at,
                updatedAt: project.updated_at,
              };
              
              resolvedProjects.push(basicProject);
            }
          }
          const projectsWithProgress = resolvedProjects.map(project => ({
            ...project,
            progress: calculateProjectProgress(project.modules)
          }));
          
          // Update cache
          set({ 
            projects: projectsWithProgress, 
            projectsCache: projectsWithProgress, 
            lastCacheUpdate: now,
            isLoading: false 
          });
        } catch (error) {
          console.error('Error loading projects:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load projects',
            isLoading: false 
          });
        }
      },

      // Refresh projects in background
      refreshProjectsInBackground: async () => {
        const state = get();
        if (state.isRefreshing || state.isBackgroundSyncRunning) return; // Prevent multiple simultaneous refreshes
        
        try {
          set({ isRefreshing: true, isBackgroundSyncRunning: true });
          
          // Check if workspace slug is configured
          const workspaceSlug = import.meta.env.VITE_PLANE_WORKSPACE_SLUG;
          if (!workspaceSlug) {
            console.warn('Workspace slug not configured for background refresh');
            return;
          }
          
          const result = await planeApi.getProjects();
          const state = get();
          const filteredProjects = result.projects.filter((project: any) => 
            !project.archived_at && !state.deletedProjectIds.has(project.id)
          );
          
          // Load project details sequentially to avoid rate limiting
          const resolvedProjects: Project[] = [];
          
          for (let i = 0; i < filteredProjects.length; i++) {
            const project = filteredProjects[i];
            
            try {
              // Add delay between requests to avoid rate limiting
              if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between requests
              }
              
              // Get detailed project data with modules and issues
              const projectDetails = await planeApi.getProject(project.id);
              
              const processedProject: Project = {
                id: project.id,
                name: project.name,
                description: project.description || '',
                salesforceNumber: project.name.split('-')[0] || '',
                boardId: project.id,
                planeProjectId: project.id,
                identifier: project.identifier,
                status: 'in_progress' as ProjectStatus,
                modules: projectDetails.modules.map((module: any) => {
                  // Get module color and team from templates
                  const template = useModuleTemplatesStore.getState().templates.find(t => t.name === module.name);
                  const moduleColor = template ? template.color : '#3B82F6';
                  const moduleTeam = template?.team || 'Infrastructure';
                  
                  return {
                    id: module.id,
                    name: module.name,
                    type: 'Infrastructure' as ModuleType, // Default type
                    team: moduleTeam,
                    planeModuleId: module.id,
                    tasks: module.issues.map((issue: any) => {
                      // Map Plane.so state to our TaskStatus
                      let taskStatus: TaskStatus = 'todo';
                      if (issue.state === 'completed' || issue.state === 'done') {
                        taskStatus = 'done';
                      } else if (issue.state === 'in_progress' || issue.state === 'started') {
                        taskStatus = 'in_progress';
                      }
                      
                      return {
                        id: issue.id,
                        name: issue.name,
                        itemId: issue.id,
                        planeIssueId: issue.id,
                        status: taskStatus,
                        description: issue.description,
                      };
                    }),
                    status: 'not_started' as ModuleStatus,
                  };
                }),
                createdAt: project.created_at,
                updatedAt: project.updated_at,
              };
              
              resolvedProjects.push(processedProject);
              
            } catch (error) {
              console.warn(`Failed to load details for project ${project.name} in background sync:`, error);
              
              // If it's a 429 error, add a longer delay before continuing
              if (error instanceof Error && error.message.includes('429')) {
                console.log('Rate limit hit in background sync, waiting 2 seconds before continuing...');
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
              
              // Add a basic project entry even if details failed
              const basicProject: Project = {
                id: project.id,
                name: project.name,
                description: project.description || '',
                salesforceNumber: project.name.split('-')[0] || '',
                boardId: project.id,
                planeProjectId: project.id,
                identifier: project.identifier,
                status: 'in_progress' as ProjectStatus,
                modules: [],
                createdAt: project.created_at,
                updatedAt: project.updated_at,
              };
              
              resolvedProjects.push(basicProject);
            }
          }
          const projectsWithProgress = resolvedProjects.map(project => ({
            ...project,
            progress: calculateProjectProgress(project.modules)
          }));
          
          // Update cache and projects silently
          set({ 
            projects: projectsWithProgress, 
            projectsCache: projectsWithProgress, 
            lastCacheUpdate: Date.now(),
            isRefreshing: false,
            isBackgroundSyncRunning: false
          });
          
        } catch (error) {
          console.error('Error in background refresh:', error);
          set({ isRefreshing: false, isBackgroundSyncRunning: false });
          
          // If background sync fails, we could optionally show a notification
          // but keep the optimistic UI update for better UX
          console.warn('Background sync failed, but UI remains updated for better user experience');
        }
      },

      // Invalidate cache to force next load to fetch fresh data
      invalidateCache: () => {
        set({ 
          projectsCache: null, 
          lastCacheUpdate: null 
        });
      },

      // Force sync - invalidate cache and reload
      forceSync: async () => {
        const state = get();
        state.invalidateCache();
        await state.loadProjectsFromPlane(false);
      },


      // Create project
      createProject: async (projectData: {
        name: string;
        salesforceNumber: string;
        description?: string;
        modules: string[];
      }) => {
        // Generate temporary ID for optimistic update
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create project object for optimistic update
        const optimisticProject: Project = {
          id: tempId,
          name: projectData.name,
          description: projectData.description || '',
          salesforceNumber: projectData.salesforceNumber,
          boardId: tempId,
          planeProjectId: tempId,
          modules: [],
          status: 'in_progress',
          progress: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          syncStatus: 'syncing'
        };

        // Update UI immediately with optimistic update
        set((state) => {
          const updatedProjects = [...state.projects, optimisticProject];
          return {
            projects: updatedProjects,
            // Update cache immediately for instant navigation
            projectsCache: updatedProjects,
            lastCacheUpdate: Date.now(),
            isLoading: false,
            error: null
          };
        });

        // Process Plane.so creation in background
        try {
          // Create project in Plane.so
          const projectResult = await planeApi.createProject(
            projectData.name,
            projectData.description || '',
            projectData.salesforceNumber
          );
          
          const project: Project = {
            id: projectResult.id,
            name: projectData.name,
            description: projectData.description || '',
            salesforceNumber: projectData.salesforceNumber,
            boardId: projectResult.id,
            planeProjectId: projectResult.id,
            identifier: projectResult.identifier,
            modules: [],
            status: 'in_progress',
            progress: 0,
            createdAt: projectResult.created_at,
            updatedAt: projectResult.updated_at,
            syncStatus: 'synced'
          };

          // Create team labels for this project
          const teamLabelsMap = new Map<string, string>(); // teamName -> labelId
          const { teams } = useTeamsStore.getState();
          
          for (const team of teams) {
            try {
              const label = await planeApi.createLabel(
                projectResult.id,
                team.name,
                team.color
              );
              teamLabelsMap.set(team.name, label.id);
            } catch (error) {
              console.error(`Error creating label for team ${team.name}:`, error);
            }
          }

          // Create modules in Plane.so
          for (const moduleName of projectData.modules) {
            // Récupérer la couleur du template
            const colorTemplate = useModuleTemplatesStore.getState().templates.find(t => t.name === moduleName);
            const moduleColor = colorTemplate?.color;
            
            const moduleResult = await planeApi.createModule(
              projectResult.id,
              moduleName,
              `Module ${moduleName} pour le projet ${projectData.name}`
            );
            
            // Get default tasks for this module
            const defaultTasks = getDefaultTasksForModule(moduleName, projectData.salesforceNumber);
            const createdTasks: Task[] = [];
            
            // Create tasks (issues) in Plane.so
            for (const task of defaultTasks) {
              try {
                const issueResult = await planeApi.createIssueInModule(
                  projectResult.id,
                  moduleResult.id,
                  task.name,
                  task.description || ''
                );
                
                // Assign team label to the issue
                const moduleTemplate = useModuleTemplatesStore.getState().templates.find(t => t.name === moduleName);
                if (moduleTemplate && teamLabelsMap.has(moduleTemplate.team)) {
                  const labelId = teamLabelsMap.get(moduleTemplate.team);
                  if (labelId) {
                    try {
                      await planeApi.assignLabelsToIssue(projectResult.id, issueResult.id, [labelId]);
                    } catch (labelError) {
                      console.error(`Error assigning label to issue ${issueResult.id}:`, labelError);
                    }
                  }
                }
                
                const createdTask = {
                  id: issueResult.id,
                  name: task.name,
                  itemId: issueResult.id,
                  planeIssueId: issueResult.id,
                  status: 'todo' as TaskStatus,
                  dueDate: task.dueDate,
                  subTasks: [] as SubTask[]
                };
                
                // Create sub-tasks if they exist in the template
                if (task.subTasks && task.subTasks.length > 0) {
                  for (const subTask of task.subTasks) {
                    try {
                      const subIssueResult = await planeApi.createSubIssue(
                        projectResult.id,
                        issueResult.id,
                        subTask.name,
                        subTask.description || ''
                      );
                      
                      // Assign team label to the sub-issue as well
                      if (moduleTemplate && teamLabelsMap.has(moduleTemplate.team)) {
                        const labelId = teamLabelsMap.get(moduleTemplate.team);
                        if (labelId) {
                          try {
                            await planeApi.assignLabelsToIssue(projectResult.id, subIssueResult.id, [labelId]);
                          } catch (labelError) {
                            console.error(`Error assigning label to sub-issue ${subIssueResult.id}:`, labelError);
                          }
                        }
                      }
                      
                      createdTask.subTasks.push({
                        id: subIssueResult.id,
                        name: subTask.name,
                        planeSubIssueId: subIssueResult.id,
                        status: subTask.status
                      });
                    } catch (subTaskError) {
                      console.error(`Error creating sub-task ${subTask.name}:`, subTaskError);
                      // Add sub-task locally even if Plane.so creation fails
                      createdTask.subTasks.push({
                        id: `temp_sub_${Date.now()}_${Math.random()}`,
                        name: subTask.name,
                        planeSubIssueId: null,
                        status: subTask.status
                      });
                    }
                  }
                }
                
                createdTasks.push(createdTask);
              } catch (error) {
                console.error('Error creating task:', error);
                // Add task locally even if Plane.so creation fails
                createdTasks.push({
                  id: `temp_${Date.now()}_${Math.random()}`,
                  name: task.name,
                  itemId: `temp_${Date.now()}_${Math.random()}`,
                  planeIssueId: null,
                  status: 'todo' as TaskStatus,
                  subTasks: task.subTasks || []
                });
              }
            }
            
            // Get team from template
            const teamTemplate = useModuleTemplatesStore.getState().templates.find(t => t.name === moduleName);
            const moduleTeam = teamTemplate?.team || 'Infrastructure';

            project.modules.push({
              id: moduleResult.id,
              name: moduleName,
              type: 'Infrastructure' as ModuleType, // Default type, will be updated based on template
              team: moduleTeam,
              planeModuleId: moduleResult.id,
              tasks: createdTasks,
              status: 'not_started' as ModuleStatus,
            });
          }

          // Update project progress after modules are created
          project.progress = calculateProjectProgress(project.modules);

          // Replace optimistic project with real project
          set((state) => {
            const updatedProjects = state.projects.map(p => 
              p.id === tempId ? { ...project, syncStatus: 'synced' as const } : p
            );
            return {
              projects: updatedProjects,
              projectsCache: updatedProjects,
              lastCacheUpdate: Date.now(),
              isLoading: false,
              error: null
            };
          });

          return project;
        } catch (error) {
          console.error('Error creating project:', error);
          
          // Update project with error status
          set((state) => {
            const updatedProjects = state.projects.map(p => 
              p.id === tempId ? { 
                ...p, 
                syncStatus: 'error' as const,
                syncError: error instanceof Error ? error.message : 'Erreur lors de la création du projet'
              } : p
            );
            return {
              projects: updatedProjects,
              projectsCache: updatedProjects,
              lastCacheUpdate: Date.now(),
              isLoading: false,
              error: null
            };
          });
          
          throw error;
        }
      },

      // Add module to project
      addModuleToProject: async (projectId: string, moduleName: string) => {
        try {
          set({ isLoading: true, error: null });
          
          const project = get().projects.find(p => p.id === projectId);
          if (!project) {
            throw new Error('Project not found');
          }

          // Check if module already exists
          const existingModule = project.modules.find(m => m.name === moduleName);
          if (existingModule) {
            console.warn(`Module "${moduleName}" already exists in project "${project.name}"`);
            set({ isLoading: false, error: `Le module "${moduleName}" existe déjà dans ce projet` });
            return;
          }

          // Get team from template
          const templates = useModuleTemplatesStore.getState().templates;
          const teamTemplate = templates.find(t => t.name === moduleName);
          const moduleTeam = teamTemplate?.team || 'Infrastructure';
          

          // Create module in Plane.so
          let moduleResult;
          try {
            moduleResult = await planeApi.createModule(
              project.planeProjectId,
              moduleName,
              `Module ${moduleName} pour le projet ${project.name}`
            );
          } catch (error) {
            console.warn('Cannot create module in Plane.so:', error);
            throw error;
          }

          // Get default tasks for this module
          const defaultTasks = getDefaultTasksForModule(moduleName, '00000000'); // Fallback number
          const createdTasks: Task[] = [];
          
          // Create tasks (issues) in Plane.so
          for (const task of defaultTasks) {
            try {
              const issueResult = await planeApi.createIssue(
                project.planeProjectId,
                task.name,
                task.description || '',
                moduleResult.id
              );
              
              const createdTask = {
                id: issueResult.id,
                name: task.name,
                itemId: issueResult.id,
                planeIssueId: issueResult.id,
                status: 'todo' as TaskStatus,
                subTasks: [] as SubTask[]
              };

              createdTasks.push(createdTask);
            } catch (error) {
              console.error('Error creating task:', error);
              // Add task locally even if Plane.so creation fails
              const createdTask = {
                id: `temp_${Date.now()}_${Math.random()}`,
                name: task.name,
                itemId: `temp_${Date.now()}_${Math.random()}`,
                planeIssueId: null,
                status: 'todo' as TaskStatus,
                subTasks: []
              };
              createdTasks.push(createdTask);
            }
          }

          const newModule: Module = {
            id: moduleResult.id,
            name: moduleName,
            type: 'Infrastructure' as ModuleType, // Default type
            team: moduleTeam,
            planeModuleId: moduleResult.id,
            tasks: createdTasks,
            status: 'not_started' as ModuleStatus,
          };

          // Update UI immediately with optimistic update
          set((state) => {
            const updatedProjects = state.projects.map(p =>
              p.id === projectId
                ? { ...p, modules: [...p.modules, newModule] }
                : p
            );
            
            return {
              projects: updatedProjects,
              // Update cache immediately for instant navigation
              projectsCache: updatedProjects,
              lastCacheUpdate: Date.now(),
              isLoading: false,
              error: null
            };
          });

          // Trigger background sync to Plane.so after UI update (with longer delay)
          setTimeout(() => {
            get().refreshProjectsInBackground();
          }, 5000);
        } catch (error) {
          console.error('Error adding module:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to add module',
            isLoading: false 
          });
          throw error;
        }
      },

      // Remove module from project
      removeModuleFromProject: async (projectId: string, moduleId: string) => {
        try {
          set({ isLoading: true, error: null });
          
          const project = get().projects.find(p => p.id === projectId);
          if (!project) {
            throw new Error('Project not found');
          }

          const module = project.modules.find(m => m.id === moduleId);
          if (!module) {
            throw new Error('Module not found');
          }

          // Delete module from Plane.so
          await planeApi.deleteModule(project.planeProjectId, module.planeModuleId);

          // Update UI immediately with optimistic update
          set((state) => {
            const updatedProjects = state.projects.map(p =>
              p.id === projectId
                ? { ...p, modules: p.modules.filter(m => m.id !== moduleId) }
                : p
            );
            
            return {
              projects: updatedProjects,
              // Update cache immediately for instant navigation
              projectsCache: updatedProjects,
              lastCacheUpdate: Date.now(),
              isLoading: false
            };
          });

          // Trigger background sync to Plane.so after UI update (with longer delay)
          setTimeout(() => {
            get().refreshProjectsInBackground();
          }, 5000);
        } catch (error) {
          console.error('Error removing module:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to remove module',
            isLoading: false 
          });
          throw error;
        }
      },

      // Update module in project
      updateModuleInProject: async (projectId: string, moduleId: string, updates: Partial<Module>) => {
        try {
          set({ isLoading: true, error: null });
          
          const project = get().projects.find(p => p.id === projectId);
          if (!project) {
            throw new Error('Project not found');
          }

          const module = project.modules.find(m => m.id === moduleId);
          if (!module) {
            throw new Error('Module not found');
          }

          // Update module in Plane.so if needed
          if (updates.tasks) {
            // For now, we'll just update locally
            // Future: Implement Plane.so task creation/deletion
          }

          set((state) => ({
            projects: state.projects.map(p =>
              p.id === projectId
                ? {
                    ...p,
                    modules: p.modules.map(m =>
                      m.id === moduleId
                        ? { ...m, ...updates }
                        : m
                    )
                  }
                : p
            ),
            isLoading: false
          }));
        } catch (error) {
          console.error('Error updating module:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to update module',
            isLoading: false 
          });
          throw error;
        }
      },

      // Refresh project data from Plane.so
      refreshProject: async (projectId: string) => {
        try {
          set({ isLoading: true, error: null });
          
          const project = get().projects.find(p => p.id === projectId);
          if (!project) {
            throw new Error('Project not found');
          }

          // Get updated project data from Plane.so
          const result = await planeApi.getProject(project.planeProjectId);

          const updatedProject: Project = {
            ...project,
            name: result.name,
            description: result.description || '',
            modules: result.modules.map((module: any) => {
              // Get module color and team from templates
              const template = useModuleTemplatesStore.getState().templates.find(t => t.name === module.name);
              const moduleColor = template ? template.color : '#3B82F6';
              const moduleTeam = template?.team || 'Infrastructure';
              
              return {
                id: module.id,
                name: module.name,
                type: 'Infrastructure' as ModuleType, // Default type
                team: moduleTeam,
                planeModuleId: module.id,
                tasks: module.issues.map((issue: any) => {
                  // Map Plane.so state to our TaskStatus
                  let taskStatus: TaskStatus = 'todo';
                  if (issue.state === 'completed' || issue.state === 'done') {
                    taskStatus = 'done';
                  } else if (issue.state === 'in_progress' || issue.state === 'started') {
                    taskStatus = 'in_progress';
                  }
                  
                  return {
                    id: issue.id,
                    name: issue.name,
                    itemId: issue.id,
                    planeIssueId: issue.id,
                    status: taskStatus,
                    description: issue.description,
                  };
                }),
                status: 'not_started' as ModuleStatus,
              };
            }),
            updatedAt: result.updated_at,
          };

          set((state) => ({
            projects: state.projects.map(p =>
              p.id === projectId ? updatedProject : p
            ),
            isLoading: false
          }));
        } catch (error) {
          console.error('Error refreshing project:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to refresh project',
            isLoading: false 
          });
          throw error;
        }
      },

        // Delete project permanently with optimistic update
        deleteProject: async (projectId: string, planeProjectId?: string) => {
          try {
            set({ isLoading: true, error: null });
            
            // Use provided planeProjectId or find project in store
            let projectIdToDelete = planeProjectId;
            if (!projectIdToDelete) {
              const project = get().projects.find(p => p.id === projectId);
              if (!project) {
                throw new Error('Project not found');
              }
              projectIdToDelete = project.planeProjectId;
            }

            // Store the project data for potential rollback
            const projectToDelete = get().projects.find(p => p.id === projectId);
            if (!projectToDelete) {
              throw new Error('Project not found');
            }

            // Mark project as being deleted (optimistic update)
            set((state) => ({
              projects: state.projects.map(p => 
                p.id === projectId ? { ...p, isDeleting: true } : p
              ),
              projectsCache: state.projectsCache?.map(p => 
                p.id === projectId ? { ...p, isDeleting: true } : p
              ) || null,
              deletedProjectIds: new Set([...state.deletedProjectIds, projectId]),
              isLoading: false
            }));

            // Delete project permanently in Plane.so in background
            try {
              await planeApi.deleteProject(projectIdToDelete);
              
              // Success - remove project from UI completely
              set((state) => ({
                projects: state.projects.filter(p => p.id !== projectId),
                projectsCache: state.projectsCache?.filter(p => p.id !== projectId) || null,
                deletedProjectIds: new Set([...state.deletedProjectIds, projectId]),
                isLoading: false
              }));
              console.log('Project deleted successfully from Plane.so');
              
            } catch (error) {
              console.error('Error deleting project from Plane.so:', error);
              
              // Rollback: restore project to UI and remove deleting state
              set((state) => {
                const newDeletedIds = new Set(state.deletedProjectIds);
                newDeletedIds.delete(projectId);
                return {
                  projects: state.projects.map(p => 
                    p.id === projectId ? { ...p, isDeleting: false } : p
                  ),
                  projectsCache: state.projectsCache?.map(p => 
                    p.id === projectId ? { ...p, isDeleting: false } : p
                  ) || null,
                  deletedProjectIds: newDeletedIds,
                  isLoading: false,
                  error: error instanceof Error ? error.message : 'Failed to delete project'
                };
              });
              
              throw error;
            }
        } catch (error) {
          console.error('Error deleting project:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Failed to delete project',
            isLoading: false
          });
          throw error;
        }
      },

      // Add sub-task to task
      addSubTaskToTask: async (projectId: string, moduleId: string, taskId: string, subTask) => {
        try {
          set({ isLoading: true, error: null });
          
          const state = get();
          const project = state.projects.find(p => p.id === projectId);
          if (!project) {
            throw new Error('Projet introuvable');
          }

          const module = project.modules.find(m => m.id === moduleId);
          if (!module) {
            throw new Error('Module introuvable');
          }

          const task = module.tasks.find(t => t.id === taskId);
          if (!task) {
            throw new Error('Tâche introuvable');
          }

          // Create new sub-task with ID
          const newSubTask = {
            ...subTask,
            id: `subtask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            planeSubIssueId: null
          };

          // Update local state
          const updatedProjects = state.projects.map(p => {
            if (p.id === projectId) {
              return {
                ...p,
                modules: p.modules.map(m => {
                  if (m.id === moduleId) {
                    return {
                      ...m,
                      tasks: m.tasks.map(t => {
                        if (t.id === taskId) {
                          return {
                            ...t,
                            subTasks: [...(t.subTasks || []), newSubTask]
                          };
                        }
                        return t;
                      })
                    };
                  }
                  return m;
                })
              };
            }
            return p;
          });

          set({ projects: updatedProjects });

          // Create sub-issue in Plane.so
          try {
            console.log('🚀 Attempting to create sub-issue in Plane.so:', {
              taskId: task.id,
              taskName: task.name,
              planeIssueId: task.planeIssueId,
              subTaskName: newSubTask.name
            });

            const result = await planeApi.createSubIssue(
              project.planeProjectId,
              task.planeIssueId || '',
              newSubTask.name,
              newSubTask.description || ''
            );

            // Update the sub-task with Plane.so ID
            const updatedProjectsWithPlaneId = updatedProjects.map(p => {
              if (p.id === projectId) {
                return {
                  ...p,
                  modules: p.modules.map(m => {
                    if (m.id === moduleId) {
                      return {
                        ...m,
                        tasks: m.tasks.map(t => {
                          if (t.id === taskId) {
                            return {
                              ...t,
                              subTasks: t.subTasks.map(st => {
                                if (st.id === newSubTask.id) {
                                  return { ...st, planeSubIssueId: result.id };
                                }
                                return st;
                              })
                            };
                          }
                          return t;
                        })
                      };
                    }
                    return m;
                  })
                };
              }
              return p;
            });

            set({ projects: updatedProjectsWithPlaneId });
          } catch (planeError) {
            console.error('Error creating sub-issue in Plane.so:', planeError);
            // Continue without Plane.so integration for now
          }

          set({ isLoading: false });
        } catch (error) {
          console.error('Error adding sub-task:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Erreur lors de l\'ajout de la sous-tâche',
            isLoading: false 
          });
          throw error;
        }
      },

      // Update sub-task in task
      updateSubTaskInTask: async (projectId: string, moduleId: string, taskId: string, subTaskId: string, updates) => {
        try {
          set({ isLoading: true, error: null });
          
          const state = get();
          const project = state.projects.find(p => p.id === projectId);
          if (!project) {
            throw new Error('Projet introuvable');
          }

          const module = project.modules.find(m => m.id === moduleId);
          if (!module) {
            throw new Error('Module introuvable');
          }

          const task = module.tasks.find(t => t.id === taskId);
          if (!task) {
            throw new Error('Tâche introuvable');
          }

          // Update local state
          const updatedProjects = state.projects.map(p => {
            if (p.id === projectId) {
              return {
                ...p,
                modules: p.modules.map(m => {
                  if (m.id === moduleId) {
                    return {
                      ...m,
                      tasks: m.tasks.map(t => {
                        if (t.id === taskId) {
                          return {
                            ...t,
                            subTasks: (t.subTasks || []).map(st => {
                              if (st.id === subTaskId) {
                                return { ...st, ...updates };
                              }
                              return st;
                            })
                          };
                        }
                        return t;
                      })
                    };
                  }
                  return m;
                })
              };
            }
            return p;
          });

          set({ projects: updatedProjects });

          // Update sub-issue in Plane.so
          try {
            const subTask = task.subTasks?.find(st => st.id === subTaskId);
            if (subTask?.planeSubIssueId) {
              await planeApi.updateIssue(
                project.planeProjectId,
                subTask.planeSubIssueId,
                updates
              );
            }
          } catch (planeError) {
            console.error('Error updating sub-issue in Plane.so:', planeError);
            // Continue without Plane.so integration for now
          }

          set({ isLoading: false });
        } catch (error) {
          console.error('Error updating sub-task:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Erreur lors de la mise à jour de la sous-tâche',
            isLoading: false 
          });
          throw error;
        }
      },

      // Remove sub-task from task
      removeSubTaskFromTask: async (projectId: string, moduleId: string, taskId: string, subTaskId: string) => {
        try {
          set({ isLoading: true, error: null });
          
          const state = get();
          const project = state.projects.find(p => p.id === projectId);
          if (!project) {
            throw new Error('Projet introuvable');
          }

          const module = project.modules.find(m => m.id === moduleId);
          if (!module) {
            throw new Error('Module introuvable');
          }

          const task = module.tasks.find(t => t.id === taskId);
          if (!task) {
            throw new Error('Tâche introuvable');
          }

          // Update local state
          const updatedProjects = state.projects.map(p => {
            if (p.id === projectId) {
              return {
                ...p,
                modules: p.modules.map(m => {
                  if (m.id === moduleId) {
                    return {
                      ...m,
                      tasks: m.tasks.map(t => {
                        if (t.id === taskId) {
                          return {
                            ...t,
                            subTasks: (t.subTasks || []).filter(st => st.id !== subTaskId)
                          };
                        }
                        return t;
                      })
                    };
                  }
                  return m;
                })
              };
            }
            return p;
          });

          set({ projects: updatedProjects });

          // Delete sub-issue from Plane.so
          try {
            const subTask = task.subTasks?.find(st => st.id === subTaskId);
            if (subTask?.planeSubIssueId) {
              await planeApi.deleteIssue(project.planeProjectId, subTask.planeSubIssueId);
            }
          } catch (planeError) {
            console.error('Error deleting sub-issue from Plane.so:', planeError);
            // Continue without Plane.so integration for now
          }

          set({ isLoading: false });
        } catch (error) {
          console.error('Error removing sub-task:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Erreur lors de la suppression de la sous-tâche',
            isLoading: false 
          });
          throw error;
        }
      },

      // Start auto sync
      startAutoSync: () => {
        const state = get();
        if (state.syncInterval) {
          clearInterval(state.syncInterval);
        }
        
        const interval = setInterval(() => {
          state.refreshProjectsInBackground();
        }, 30 * 60 * 1000); // 30 minutes
        
        set({ syncInterval: interval, isBackgroundSyncRunning: true });
      },

      // Stop auto sync
      stopAutoSync: () => {
        const state = get();
        if (state.syncInterval) {
          clearInterval(state.syncInterval);
          set({ syncInterval: null, isBackgroundSyncRunning: false });
        }
      },

      // Manual sync
      manualSync: async () => {
        try {
          await get().loadProjectsFromPlane(false);
        } catch (error) {
          console.error('Manual sync failed:', error);
          throw error;
        }
      },
    }),
    {
      name: 'plane-app-storage',
      partialize: (state) => ({
        projects: state.projects,
        projectsCache: state.projectsCache,
        lastCacheUpdate: state.lastCacheUpdate,
        theme: state.theme,
        deletedProjectIds: Array.from(state.deletedProjectIds),
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Convert array back to Set
          state.deletedProjectIds = new Set(state.deletedProjectIds || []);
        }
      },
    }
  )
);