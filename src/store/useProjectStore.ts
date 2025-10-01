import { create } from 'zustand';
import { Project, Module, Task, SubTask, ModuleType, ModuleStatus, TaskStatus } from '../types';
import { planeApi } from '../services/planeApi';
import { useLocalDataStore } from './useLocalDataStore';
import { autoSaveToBackend } from '../utils/backendStorage';

interface ProjectStore {
  createProject: (projectData: {
    name: string;
    salesforceNumber: string;
    description?: string;
    modules: string[];
  }) => Promise<Project>;
  addModuleToProject: (projectId: string, moduleName: string) => Promise<void>;
  removeModuleFromProject: (projectId: string, moduleId: string) => Promise<void>;
  deleteProject: (projectId: string, planeProjectId?: string) => Promise<void>;
}

// Helper function to get default tasks for a module from templates
const getDefaultTasksForModule = (moduleName: string, salesforceNumber: string) => {
  // Use the correct store - LocalDataStore instead of ModuleTemplatesStore
  const { data: localData } = useLocalDataStore.getState();
  const templates = localData.moduleTemplates;
  
  // Try to find template by exact name first
  let template = templates.find(t => t.name === moduleName);
  
  // If not found, try to find by removing the team prefix
  if (!template && moduleName.startsWith('[')) {
    const nameWithoutPrefix = moduleName.replace(/^\[.*?\]\s*/, '');
    template = templates.find(t => t.name === nameWithoutPrefix);
  }
  
  // If still not found, try to find by partial match
  if (!template) {
    template = templates.find(t => 
      moduleName.toLowerCase().includes(t.name.toLowerCase()) ||
      t.name.toLowerCase().includes(moduleName.toLowerCase())
    );
  }
  
  console.log(`🔍 Looking for template for module: "${moduleName}"`);
  console.log(`📋 Available templates:`, templates.map(t => t.name));
  console.log(`✅ Found template:`, template ? template.name : 'None');
  
  if (template && template.tasks) {
    console.log(`📝 Using ${template.tasks.length} tasks from template "${template.name}"`);
    console.log(`🔍 Template tasks:`, template.tasks);
    
    const mappedTasks = template.tasks.map(task => {
      console.log(`🔍 Processing task:`, task);
      return {
        name: task.name || `Tâche sans nom`,
        description: task.description || '',
        subTasks: task.subTasks || []
      };
    });
    
    console.log(`✅ Mapped tasks:`, mappedTasks);
    return mappedTasks;
  }
  
  console.log(`⚠️ No template found, using fallback tasks`);
  // Fallback to default tasks if template not found
  return [
    { name: `Tâche 1`, description: '', subTasks: [] },
    { name: `Tâche 2`, description: '', subTasks: [] },
    { name: `Tâche 3`, description: '', subTasks: [] }
  ];
};

// Helper function to calculate project progress
const calculateProjectProgress = (modules: Module[]): number => {
  if (modules.length === 0) return 0;
  
  const allTasks = modules.flatMap(module => module.tasks);
  if (allTasks.length === 0) return 0;
  
  const totalProgress = allTasks.reduce((total, task) => {
    const taskProgress = task.status === 'done' ? 100 : 
                       task.status === 'in_progress' ? 50 : 0;
    return total + taskProgress;
  }, 0);
  
  return Math.round(totalProgress / allTasks.length);
};

export const useProjectStore = create<ProjectStore>()((set, get) => ({
  createProject: async (projectData) => {
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
      identifier: projectData.name.substring(0, 12).toUpperCase(),
      modules: [],
      status: 'in_progress',
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'syncing'
    };

    // Update UI immediately with optimistic update
    const { data: localData } = useLocalDataStore.getState();
    useLocalDataStore.setState({
      data: {
        ...localData,
        projects: [...localData.projects, optimisticProject]
      }
    });
    
    // Auto-save to files
    const { data } = useLocalDataStore.getState();
    await autoSaveToBackend(data);

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
      const { data: localData } = useLocalDataStore.getState();
      const { teams } = localData;
      
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

      // Get local data once
      const { data: currentLocalData } = useLocalDataStore.getState();
      
      // Create modules in Plane.so
      for (const moduleName of projectData.modules) {
        // Find the team for this module from templates
        const moduleTeam = currentLocalData.moduleTemplates.find(t => t.name === moduleName)?.team || 'Infrastructure';
        
        // Check if module name already has a prefix
        const moduleNameWithPrefix = moduleName.startsWith('[') 
          ? moduleName  // Already has prefix
          : `[${moduleTeam}] ${moduleName}`;  // Add prefix
        
        const moduleResult = await planeApi.createModule(
          projectResult.id,
          moduleNameWithPrefix,
          `Module ${moduleName} pour le projet ${projectData.name}`
        );
        
        // Get default tasks for this module
        const defaultTasks = getDefaultTasksForModule(moduleName, projectData.salesforceNumber);
        const createdTasks: Task[] = [];
        
        // Create tasks (issues) in Plane.so - in reverse order
        for (let i = defaultTasks.length - 1; i >= 0; i--) {
          const task = defaultTasks[i];
          try {
            const issueResult = await planeApi.createIssueInModule(
              projectResult.id,
              moduleResult.id,
              task.name,
              task.description || ''
            );
            
            // Assign team label to the issue
            const moduleTemplate = localData.moduleTemplates.find(t => t.name === moduleName);
            if (moduleTemplate && teamLabelsMap.has(moduleTemplate.team)) {
              const labelId = teamLabelsMap.get(moduleTemplate.team);
              if (labelId) {
                try {
                  await planeApi.assignLabelsToIssue(projectResult.id, issueResult.id, [labelId]);
                  console.log(`✅ Assigned team label to task: ${task.name}`);
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
              subTasks: [] as SubTask[]
            };
            
            // Create sub-tasks if they exist in the template - in reverse order
            if (task.subTasks && task.subTasks.length > 0) {
              for (let j = task.subTasks.length - 1; j >= 0; j--) {
                const subTask = task.subTasks[j];
                try {
                  const subIssueResult = await planeApi.createSubIssue(
                    projectResult.id,
                    issueResult.id,
                    subTask.name,
                    ''
                  );
                  
                  // Assign team label to the sub-issue as well
                  if (moduleTemplate && teamLabelsMap.has(moduleTemplate.team)) {
                    const labelId = teamLabelsMap.get(moduleTemplate.team);
                    if (labelId) {
                      try {
                        await planeApi.assignLabelsToIssue(projectResult.id, subIssueResult.id, [labelId]);
                        console.log(`✅ Assigned team label to sub-task: ${subTask.name}`);
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

        // Add the real module directly
        const realModule = {
          id: moduleResult.id,
          name: moduleNameWithPrefix,
          type: 'Infrastructure' as ModuleType, // Default type, will be updated based on template
          team: moduleTeam,
          planeModuleId: moduleResult.id,
          tasks: createdTasks,
          status: 'not_started' as ModuleStatus,
        };
        
        project.modules.push(realModule);
        console.log(`✅ Added module "${moduleNameWithPrefix}" with real ID: ${moduleResult.id}`);
      }

      // Update project progress after modules are created
      project.progress = calculateProjectProgress(project.modules);

      // Replace optimistic project with real project
      const { data: updatedLocalData } = useLocalDataStore.getState();
      useLocalDataStore.setState({
        data: {
          ...updatedLocalData,
          projects: updatedLocalData.projects.map(p => 
            p.id === tempId ? { ...project, syncStatus: 'synced' as const } : p
          )
        }
      });
      
      // Auto-save to files
      const { data } = useLocalDataStore.getState();
      await autoSaveToBackend(data);

      return project;
    } catch (error) {
      console.error('Error creating project:', error);
      // Remove optimistic project on error
      const { data: currentLocalData } = useLocalDataStore.getState();
      useLocalDataStore.setState({
        data: {
          ...currentLocalData,
          projects: currentLocalData.projects.filter(p => p.id !== tempId)
        }
      });
      
      // Auto-save to files
      const { data } = useLocalDataStore.getState();
      await autoSaveToBackend(data);
      throw error;
    }
  },

  addModuleToProject: async (projectId: string, moduleName: string) => {
    // Get project from local data
    const { data: localData } = useLocalDataStore.getState();
    const project = localData.projects.find(p => p.id === projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Find the corresponding project in Plane.so
    const planeProjectsResponse = await planeApi.getProjects();
    const planeProject = planeProjectsResponse.projects.find(p => p.name === project.name);
    if (!planeProject) {
      throw new Error('Project not found in Plane.so');
    }

    // Get team from template using local data store
    const teamTemplate = localData.moduleTemplates.find(t => t.name === moduleName);
    const moduleTeam = teamTemplate?.team || 'Infrastructure';
    
    // Check if module name already has a prefix
    const moduleNameWithPrefix = moduleName.startsWith('[') 
      ? moduleName  // Already has prefix
      : `[${moduleTeam}] ${moduleName}`;  // Add prefix
    
    // Create module in Plane.so
    const moduleResult = await planeApi.createModule(
      planeProject.id,
      moduleNameWithPrefix,
      `Module ${moduleName} pour le projet ${project.name}`
    );
    
    // Get default tasks for this module
    const defaultTasks = getDefaultTasksForModule(moduleName, project.salesforceNumber);
    const createdTasks: Task[] = [];
    
    // Get project labels once for all tasks
    const projectLabels = await planeApi.getLabels(planeProject.id);
    const teamLabel = projectLabels.find(label => label.name === moduleTeam);
    console.log(`🔍 Looking for team label: ${moduleTeam}`);
    console.log(`📋 Available labels:`, projectLabels.map(l => l.name));
    console.log(`✅ Found team label:`, teamLabel ? teamLabel.name : 'None');
    
    // Create tasks (issues) in Plane.so - in reverse order
    for (let i = defaultTasks.length - 1; i >= 0; i--) {
      const task = defaultTasks[i];
      try {
        const issueResult = await planeApi.createIssueInModule(
          planeProject.id,
          moduleResult.id,
          task.name,
          task.description || ''
        );
        if (teamLabel) {
          try {
            await planeApi.assignLabelsToIssue(planeProject.id, issueResult.id, [teamLabel.id]);
            console.log(`✅ Assigned team label to task: ${task.name}`);
          } catch (labelError) {
            console.error(`Error assigning label to issue ${issueResult.id}:`, labelError);
          }
        }
        
        const createdTask = {
          id: issueResult.id,
          name: task.name,
          itemId: issueResult.id,
          planeIssueId: issueResult.id,
          status: 'todo' as TaskStatus,
          subTasks: [] as SubTask[]
        };
        
        // Create sub-tasks if they exist in the template - in reverse order
        if (task.subTasks && task.subTasks.length > 0) {
          console.log(`🔍 Creating ${task.subTasks.length} sub-tasks for task: ${task.name}`);
          for (let j = task.subTasks.length - 1; j >= 0; j--) {
            const subTask = task.subTasks[j];
            console.log(`🔍 Processing sub-task: ${subTask.name}`);
            try {
              const subIssueResult = await planeApi.createSubIssue(
                planeProject.id,
                issueResult.id,
                subTask.name,
                ''
              );
              
              // Assign team label to the sub-issue as well
              if (teamLabel) {
                try {
                  await planeApi.assignLabelsToIssue(planeProject.id, subIssueResult.id, [teamLabel.id]);
                  console.log(`✅ Assigned team label to sub-task: ${subTask.name}`);
                } catch (labelError) {
                  console.error(`Error assigning label to sub-issue ${subIssueResult.id}:`, labelError);
                }
              }
              
              createdTask.subTasks.push({
                id: subIssueResult.id,
                name: subTask.name,
                planeSubIssueId: subIssueResult.id,
                status: subTask.status
              });
              console.log(`✅ Created sub-task: ${subTask.name}`);
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
        } else {
          console.log(`ℹ️ No sub-tasks for task: ${task.name}`);
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

    // Add the real module to the project
    const realModule = {
      id: moduleResult.id,
      name: moduleNameWithPrefix,
      type: 'Infrastructure' as ModuleType,
      team: moduleTeam,
      planeModuleId: moduleResult.id,
      tasks: createdTasks,
      status: 'not_started' as ModuleStatus,
    };
    
    // Update the project in local storage
    const { data: currentLocalData } = useLocalDataStore.getState();
    console.log(`🔍 Before update - Project modules:`, currentLocalData.projects.find(p => p.id === projectId)?.modules.map(m => m.name));
    console.log(`🔍 Real module to add:`, realModule);
    
    useLocalDataStore.setState({
      data: {
        ...currentLocalData,
        projects: currentLocalData.projects.map(p => 
          p.id === projectId 
            ? { ...p, modules: [...p.modules, realModule] }
            : p
        )
      }
    });
    
    // Auto-save to files
    const { data } = useLocalDataStore.getState();
    await autoSaveToBackend(data);

    // Verify the update
    const { data: updatedLocalData } = useLocalDataStore.getState();
    console.log(`🔍 After update - Project modules:`, updatedLocalData.projects.find(p => p.id === projectId)?.modules.map(m => m.name));

    console.log(`✅ Added module "${moduleNameWithPrefix}" to project ${project.name}`);
  },

  removeModuleFromProject: async (projectId: string, moduleId: string) => {
    // Get project from local data
    const { data: localData } = useLocalDataStore.getState();
    const project = localData.projects.find(p => p.id === projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const module = project.modules.find(m => m.id === moduleId);
    if (!module) {
      throw new Error('Module not found');
    }

    // Find the corresponding project in Plane.so
    const planeProjectsResponse = await planeApi.getProjects();
    const planeProject = planeProjectsResponse.projects.find(p => p.name === project.name);
    if (!planeProject) {
      throw new Error('Project not found in Plane.so');
    }

    // Delete module from Plane.so if it has a real ID
    if (module.planeModuleId) {
      try {
        await planeApi.deleteModule(planeProject.id, module.planeModuleId);
        console.log(`✅ Deleted module "${module.name}" from Plane.so`);
      } catch (error) {
        console.error(`Error deleting module from Plane.so:`, error);
        // Continue with local deletion even if Plane.so deletion fails
      }
    } else {
      console.warn(`⚠️ Module "${module.name}" has no Plane.so ID, skipping Plane.so deletion`);
    }

    // Remove module from local project
    const { data: currentLocalData } = useLocalDataStore.getState();
    useLocalDataStore.setState({
      data: {
        ...currentLocalData,
        projects: currentLocalData.projects.map(p => 
          p.id === projectId 
            ? { ...p, modules: p.modules.filter(m => m.id !== moduleId) }
            : p
        )
      }
    });
    
    // Auto-save to files
    const { data } = useLocalDataStore.getState();
    await autoSaveToBackend(data);

    console.log(`✅ Removed module "${module.name}" from project ${project.name}`);
  },

  deleteProject: async (projectId: string, planeProjectId?: string) => {
    // Get project from local data
    const { data: localData } = useLocalDataStore.getState();
    const project = localData.projects.find(p => p.id === projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Delete project from Plane.so if we have the ID
    if (planeProjectId) {
      try {
        await planeApi.deleteProject(planeProjectId);
        console.log(`✅ Deleted project "${project.name}" from Plane.so`);
      } catch (error) {
        console.error(`Error deleting project from Plane.so:`, error);
        // Continue with local deletion even if Plane.so deletion fails
      }
    }

    // Remove project from local storage
    const { data: currentLocalData } = useLocalDataStore.getState();
    useLocalDataStore.setState({
      data: {
        ...currentLocalData,
        projects: currentLocalData.projects.filter(p => p.id !== projectId)
      }
    });
    
    // Auto-save to files
    const { data } = useLocalDataStore.getState();
    await autoSaveToBackend(data);

    console.log(`✅ Deleted project "${project.name}" from local storage`);
  }
}));


