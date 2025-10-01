// Plane.so API service
import { mapColorToPlane } from '../utils/colorMapping';

// Utiliser le proxy local pour éviter les problèmes CORS
const PLANE_API_ENDPOINT = import.meta.env.DEV ? '' : (import.meta.env.VITE_PLANE_API_ENDPOINT || 'https://plane.provect.io');
const PLANE_API_KEY = import.meta.env.VITE_PLANE_API_KEY;
const PLANE_WORKSPACE_SLUG = import.meta.env.VITE_PLANE_WORKSPACE_SLUG;

// API Queue system to prevent rate limiting
class ApiQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private delayMs = 200; // Base delay between requests (300/minute = 200ms)

  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const request = this.queue.shift();
      if (request) {
        await request();
        // Add delay between requests to prevent rate limiting
        await this.delay(this.delayMs);
      }
    }
    
    this.processing = false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const apiQueue = new ApiQueue();

interface PlaneResponse {
  results?: any[];
  count?: number;
  [key: string]: any;
}

interface PlaneError {
  status: number;
  body: any;
  message: string;
}

export class PlaneApiError extends Error {
  public status: number;
  public body: any;

  constructor(status: number, body: any, message: string) {
    super(message);
    this.status = status;
    this.body = body;
    this.name = 'PlaneApiError';
  }
}

class PlaneApiService {
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Retry function with exponential backoff
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Check if it's a rate limit error
        if (error instanceof PlaneApiError && error.status === 429) {
          if (attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000; // Add jitter
            console.log(`🔄 Rate limit hit, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
            await this.delay(delay);
            continue;
          }
        }
        
        // For non-429 errors or final attempt, throw immediately
        throw error;
      }
    }
    
    throw lastError!;
  }

  private async makeRequest(path: string, options: RequestInit = {}): Promise<any> {
    return apiQueue.add(async () => {
      if (!PLANE_API_KEY) {
        throw new Error('Plane API key not configured');
      }

      if (!PLANE_WORKSPACE_SLUG) {
        throw new Error('Plane workspace slug not configured');
      }

      const url = `${PLANE_API_ENDPOINT}${path.startsWith('/') ? path : `/${path}`}`;
      
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': PLANE_API_KEY,
        ...options.headers,
      };

      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        let body: any = null;
        const contentType = response.headers.get('content-type');
        
        if (contentType?.includes('application/json')) {
          body = await response.json();
        } else {
          body = await response.text();
        }

        if (!response.ok) {
          const errorMessage = body?.message || body?.error || `HTTP ${response.status}: ${response.statusText}`;
          console.error('Plane API Error:', {
            status: response.status,
            statusText: response.statusText,
            url,
            body: body,
            requestBody: options.body
          });
          throw new PlaneApiError(response.status, body, errorMessage);
        }

        return body;
      } catch (error) {
        if (error instanceof PlaneApiError) {
          throw error;
        }
        
        // Erreur réseau ou autre
        throw new PlaneApiError(
          0,
          null,
          `Erreur réseau: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
        );
      }
    });
  }

  // Log structuré pour les actions Plane
  private logPlaneAction(action: string, status: 'success' | 'error', data?: any, error?: any) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      action,
      status,
      ...(data && { data }),
      ...(error && { error: error.message || error }),
    }));
  }

  // Créer un nouveau projet
  async createProject(name: string, description: string = '', identifier?: string): Promise<any> {
    try {
      this.logPlaneAction('create_project', 'start', { name, identifier });
      
      // Générer un identifier valide pour Plane.so
      let projectIdentifier: string;
      
      if (identifier) {
        // Utiliser l'identifier fourni s'il est valide
        projectIdentifier = identifier.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
      } else {
        // Générer un identifier basé sur le nom
        projectIdentifier = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 8);
      }
      
      // S'assurer que l'identifier n'est pas vide et commence par une lettre
      if (!projectIdentifier || /^[0-9]/.test(projectIdentifier)) {
        projectIdentifier = 'proj' + (projectIdentifier || 'default');
      }
      
      // Limiter la longueur de l'identifier (Plane.so a des contraintes strictes)
      if (projectIdentifier.length > 12) {
        projectIdentifier = projectIdentifier.substring(0, 12);
      }
      
      // S'assurer que l'identifier ne se termine pas par un tiret
      projectIdentifier = projectIdentifier.replace(/-+$/, '');
      
      // Validation finale de l'identifier
      if (!/^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/.test(projectIdentifier)) {
        // Si l'identifier n'est pas valide, générer un identifier simple
        const timestamp = Date.now().toString().slice(-6);
        projectIdentifier = 'proj' + timestamp;
      }
      
      const payload = {
        name,
        identifier: projectIdentifier,
        description: description || '',
        cycle_view: false,  // Explicitly disable cycles
        module_view: true,  // Keep modules enabled
      };
      
      console.log('🚀 Creating project with payload:', payload);
      
      // Ajouter un délai initial pour éviter les conflits avec la synchronisation
      await this.delay(500);
      
          // Vérifier si l'identifier existe déjà
          try {
            const existingProjectsResponse = await this.retryWithBackoff(() =>
              this.makeRequest(
                `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/`
              )
            );
        const existingProjects = existingProjectsResponse.results || [];
        const identifierExists = existingProjects.some((p: any) => p.identifier === projectIdentifier);
        
        if (identifierExists) {
          // Ajouter un suffixe unique court
          const timestamp = Date.now().toString().slice(-4);
          projectIdentifier = projectIdentifier.substring(0, 8) + timestamp;
          payload.identifier = projectIdentifier;
          console.log('🔄 Identifier already exists, using:', projectIdentifier);
        }
      } catch (error) {
        console.warn('Could not check existing projects:', error);
      }
      
      const project = await this.retryWithBackoff(() =>
        this.makeRequest(
          `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/`,
          {
            method: 'POST',
            body: JSON.stringify(payload),
          }
        )
      );

      this.logPlaneAction('create_project', 'success', { 
        projectId: project.id, 
        identifier: project.identifier 
      });

      return project;
    } catch (error) {
      this.logPlaneAction('create_project', 'error', { name, identifier }, error);
      throw error;
    }
  }

  // Créer un module dans un projet
  async createModule(projectId: string, name: string, description: string = ''): Promise<any> {
    try {
      this.logPlaneAction('create_module', 'start', { projectId, moduleName: name });
      
      const payload = {
        name,
        description,
      };
      
      // Ajouter un délai pour éviter les erreurs 429
      await this.delay(300);
      
      const module = await this.retryWithBackoff(() =>
        this.makeRequest(
          `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/modules/`,
          {
            method: 'POST',
            body: JSON.stringify(payload),
          }
        )
      );

      this.logPlaneAction('create_module', 'success', { 
        moduleId: module.id, 
        projectId,
        moduleName: module.name 
      });

      return module;
    } catch (error) {
      this.logPlaneAction('create_module', 'error', { projectId, moduleName: name }, error);
      throw error;
    }
  }

  // Ajouter des issues à un module
  async addIssuesToModule(projectId: string, moduleId: string, issueIds: string[]): Promise<any> {
    try {
      this.logPlaneAction('add_issues_to_module', 'start', { projectId, moduleId, issueIds });
      
      const payload = {
        issues: issueIds
      };
      
      const response = await this.retryWithBackoff(() =>
        this.makeRequest(
          `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/modules/${moduleId}/module-issues/`,
          {
            method: 'POST',
            body: JSON.stringify(payload),
          }
        )
      );

      this.logPlaneAction('add_issues_to_module', 'success', { 
        projectId, 
        moduleId, 
        issueIds 
      });

      return response;
    } catch (error) {
      this.logPlaneAction('add_issues_to_module', 'error', { projectId, moduleId, issueIds }, error);
      throw error;
    }
  }

  // Créer une issue et l'ajouter à un module
  async createIssueInModule(projectId: string, moduleId: string, name: string, description: string = ''): Promise<any> {
    try {
      // 1. Créer l'issue d'abord
      const issue = await this.createIssue(projectId, name, description);
      
      // 2. Ajouter l'issue au module
      await this.addIssuesToModule(projectId, moduleId, [issue.id]);
      
      return issue;
    } catch (error) {
      this.logPlaneAction('create_issue_in_module', 'error', { projectId, moduleId, issueName: name }, error);
      throw error;
    }
  }

  // Créer une issue (tâche) dans un projet
  async createIssue(projectId: string, name: string, description: string = '', moduleId?: string): Promise<any> {
    try {
      this.logPlaneAction('create_issue', 'start', { projectId, issueName: name, moduleId });
      
      const issueData = {
        name
      };
      
      console.log('🚀 Creating issue with payload:', issueData);
      
      // Ajouter un délai pour éviter les erreurs 429
      await this.delay(400);
      
      const issue = await this.retryWithBackoff(() =>
        this.makeRequest(
          `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/issues/`,
          {
            method: 'POST',
            body: JSON.stringify(issueData),
          }
        )
      );

      this.logPlaneAction('create_issue', 'success', { 
        projectId, 
        issueName: name, 
        issueId: issue.id,
        moduleId 
      });

      return issue;
    } catch (error) {
      this.logPlaneAction('create_issue', 'error', { projectId, issueName: name, moduleId }, error);
      throw error;
    }
  }

  // Ajouter une issue à un module
  async addIssueToModule(projectId: string, moduleId: string, issueId: string): Promise<any> {
    try {
      this.logPlaneAction('add_issue_to_module', 'success', { projectId, moduleId, issueId });
      
      const result = await this.makeRequest(
        `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/modules/${moduleId}/module-issues/`,
        {
          method: 'POST',
          body: JSON.stringify({
            issues: [issueId],
          }),
        }
      );

      this.logPlaneAction('add_issue_to_module', 'success', { 
        projectId,
        moduleId,
        issueId 
      });

      return result;
    } catch (error) {
      this.logPlaneAction('add_issue_to_module', 'error', { projectId, moduleId, issueId }, error);
      throw error;
    }
  }

  // Créer une sous-tâche (sub-issue)
  async createSubIssue(projectId: string, parentIssueId: string, name: string, description: string = ''): Promise<any> {
    try {
      this.logPlaneAction('create_sub_issue', 'start', { projectId, parentIssueId, issueName: name });
      
      // Ajouter un délai pour éviter les erreurs 429
      await this.delay(500);
      
      // D'abord, créer l'issue normale
      const issueData = {
        name,
        description: description || '',
      };
      
      console.log('🚀 Creating sub-issue with payload:', issueData);
      
      const issue = await this.retryWithBackoff(() =>
        this.makeRequest(
          `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/issues/`,
          {
            method: 'POST',
            body: JSON.stringify(issueData),
          }
        )
      );
      
      // Ensuite, essayer de lier l'issue à son parent via l'API d'update
      try {
        const updateData = {
          parent: parentIssueId,
        };
        
        console.log('🔗 Linking sub-issue to parent:', updateData);
        
        // Ajouter un délai avant le PATCH
        await this.delay(200);
        
        await this.retryWithBackoff(() =>
          this.makeRequest(
            `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/issues/${issue.id}/`,
            {
              method: 'PATCH',
              body: JSON.stringify(updateData),
            }
          )
        );
      } catch (linkError) {
        console.warn('Could not link sub-issue to parent:', linkError);
        // Continue même si le lien échoue
      }

      this.logPlaneAction('create_sub_issue', 'success', { 
        issueId: issue.id, 
        projectId,
        parentIssueId,
        issueName: issue.name 
      });

      return issue;
    } catch (error) {
      this.logPlaneAction('create_sub_issue', 'error', { projectId, parentIssueId, issueName: name }, error);
      throw error;
    }
  }

  // Récupérer la liste des projets
  async getProjects(): Promise<any> {
    try {
      this.logPlaneAction('get_projects', 'success', { workspaceSlug: PLANE_WORKSPACE_SLUG });
      
      const response = await this.makeRequest(
        `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/`
      );

      const formattedProjects = response.results?.map((project: any) => ({
        id: project.id,
        name: project.name,
        identifier: project.identifier,
        description: project.description,
        created_at: project.created_at,
        updated_at: project.updated_at,
      })) || [];

      this.logPlaneAction('get_projects', 'success', { 
        count: formattedProjects.length,
        total: response.count 
      });

      return {
        projects: formattedProjects,
        total: response.count || 0,
      };
    } catch (error) {
      this.logPlaneAction('get_projects', 'error', { workspaceSlug: PLANE_WORKSPACE_SLUG }, error);
      throw error;
    }
  }

  // Récupérer un projet spécifique avec ses modules et issues
  async getProject(projectId: string): Promise<any> {
    try {
      this.logPlaneAction('get_project', 'success', { projectId });
      
      // Récupérer les détails du projet
      const project = await this.makeRequest(
        `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/`
      );

      // Récupérer les modules du projet
      const modulesResponse = await this.makeRequest(
        `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/modules/`
      );

      // Récupérer les issues du projet
      const issuesResponse = await this.makeRequest(
        `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/issues/`
      );

      // Organiser les issues par module
      const modules = modulesResponse.results?.map((module: any) => {
        // Trouver les issues qui appartiennent à ce module
        const moduleIssues = issuesResponse.results?.filter((issue: any) => 
          issue.module === module.id
        ) || [];

        return {
          id: module.id,
          name: module.name,
          description: module.description,
          issues: moduleIssues.map((issue: any) => ({
            id: issue.id,
            name: issue.name,
            description: issue.description,
            state: issue.state,
            priority: issue.priority,
            created_at: issue.created_at,
            updated_at: issue.updated_at,
          }))
        };
      }) || [];

      this.logPlaneAction('get_project', 'success', { 
        projectId,
        modulesCount: modules.length,
        issuesCount: issuesResponse.results?.length || 0
      });

      return {
        ...project,
        modules,
        issues: issuesResponse.results || []
      };
    } catch (error) {
      this.logPlaneAction('get_project', 'error', { projectId }, error);
      throw error;
    }
  }

  // Mettre à jour un module
  async updateModule(projectId: string, moduleId: string, updates: any): Promise<any> {
    try {
      this.logPlaneAction('update_module', 'start', { projectId, moduleId, updates });
      
      const result = await this.makeRequest(
        `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/modules/${moduleId}/`,
        {
          method: 'PATCH',
          body: JSON.stringify(updates),
        }
      );

      this.logPlaneAction('update_module', 'success', { 
        projectId,
        moduleId,
        updates
      });

      return result;
    } catch (error) {
      this.logPlaneAction('update_module', 'error', { projectId, moduleId, updates }, error);
      throw error;
    }
  }

  // Supprimer un module
  async deleteModule(projectId: string, moduleId: string): Promise<any> {
    try {
      this.logPlaneAction('delete_module', 'start', { projectId, moduleId });
      
      const result = await this.makeRequest(
        `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/modules/${moduleId}/`,
        {
          method: 'DELETE',
        }
      );

      this.logPlaneAction('delete_module', 'success', { 
        projectId,
        moduleId 
      });

      return result;
    } catch (error) {
      this.logPlaneAction('delete_module', 'error', { projectId, moduleId }, error);
      throw error;
    }
  }

  // Supprimer tous les modules de tous les projets
  async deleteAllModules(): Promise<void> {
    try {
      console.log('🗑️ Starting deletion of all modules...');
      
      // Get all projects
      const projectsResponse = await this.makeRequest(
        `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/`
      );
      
      const projects = projectsResponse.results || projectsResponse;
      console.log(`📋 Found ${projects.length} projects`);
      
      for (const project of projects) {
        console.log(`🔍 Processing project: ${project.name} (${project.id})`);
        
        try {
          // Get all modules for this project
          const modulesResponse = await this.makeRequest(
            `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${project.id}/modules/`
          );
          
          const modules = modulesResponse.results || modulesResponse;
          console.log(`📦 Found ${modules.length} modules in project ${project.name}`);
          
          // Delete each module
          for (const module of modules) {
            try {
              console.log(`🗑️ Deleting module: ${module.name} (${module.id})`);
              await this.deleteModule(project.id, module.id);
              console.log(`✅ Module deleted: ${module.name}`);
              
              // Add delay between deletions to avoid rate limiting
              await this.delay(500);
            } catch (error) {
              console.error(`❌ Failed to delete module ${module.name}:`, error);
            }
          }
        } catch (error) {
          console.error(`❌ Failed to process project ${project.name}:`, error);
        }
      }
      
      console.log('✅ All modules deletion completed');
    } catch (error) {
      console.error('❌ Failed to delete all modules:', error);
      throw error;
    }
  }

  // Supprimer une issue
  async deleteIssue(projectId: string, issueId: string): Promise<any> {
    try {
      this.logPlaneAction('delete_issue', 'success', { projectId, issueId });
      
      const result = await this.makeRequest(
        `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/issues/${issueId}/`,
        {
          method: 'DELETE',
        }
      );

      this.logPlaneAction('delete_issue', 'success', { 
        projectId,
        issueId 
      });

      return result;
    } catch (error) {
      this.logPlaneAction('delete_issue', 'error', { projectId, issueId }, error);
      throw error;
    }
  }

  // Mettre à jour une issue
  async updateIssue(projectId: string, issueId: string, updates: any): Promise<any> {
    try {
      this.logPlaneAction('update_issue', 'success', { projectId, issueId, updates });
      
      const result = await this.makeRequest(
        `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/issues/${issueId}/`,
        {
          method: 'PATCH',
          body: JSON.stringify(updates),
        }
      );

      this.logPlaneAction('update_issue', 'success', { 
        projectId,
        issueId 
      });

      return result;
    } catch (error) {
      this.logPlaneAction('update_issue', 'error', { projectId, issueId, updates }, error);
      throw error;
    }
  }

  // Supprimer définitivement un projet
  async deleteProject(projectId: string): Promise<any> {
    try {
      this.logPlaneAction('delete_project', 'start', { projectId });
      
      console.log(`🗑️ Attempting to delete project: ${projectId}`);
      console.log(`🔗 API URL: /api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/`);
      
      const result = await this.retryWithBackoff(() =>
        this.makeRequest(
          `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/`,
          {
            method: 'DELETE',
          }
        )
      );

      console.log(`✅ Project deleted successfully: ${projectId}`);
      this.logPlaneAction('delete_project', 'success', { 
        projectId 
      });

      return result;
    } catch (error) {
      console.error(`❌ Failed to delete project ${projectId}:`, error);
      
      // Provide more specific error information
      if (error instanceof PlaneApiError) {
        console.error(`Status: ${error.status}, Body:`, error.body);
        
        if (error.status === 404) {
          throw new Error('Le projet n\'existe plus dans Plane.so');
        } else if (error.status === 403) {
          throw new Error('Vous n\'avez pas les permissions pour supprimer ce projet');
        } else if (error.status === 429) {
          throw new Error('Trop de requêtes simultanées. Veuillez patienter et réessayer.');
        }
      }
      
      this.logPlaneAction('delete_project', 'error', { projectId }, error);
      throw error;
    }
  }

  // ===== LABELS MANAGEMENT =====

  // Créer un label pour une équipe
  async createLabel(projectId: string, teamName: string, teamColor: string): Promise<any> {
    try {
      this.logPlaneAction('create_label', 'start', { projectId, teamName, teamColor });
      
      const payload = {
        name: teamName,
        description: `Étiquette pour l'équipe ${teamName}`,
        color: teamColor,
      };
      
      // Ajouter un délai pour éviter les erreurs 429
      await this.delay(200);
      
      const label = await this.retryWithBackoff(() =>
        this.makeRequest(
          `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/labels/`,
          {
            method: 'POST',
            body: JSON.stringify(payload),
          }
        )
      );

      this.logPlaneAction('create_label', 'success', { 
        projectId, 
        teamName, 
        labelId: label.id 
      });

      return label;
    } catch (error) {
      this.logPlaneAction('create_label', 'error', { projectId, teamName, teamColor }, error);
      throw error;
    }
  }

  // Lister les labels d'un projet
  async getLabels(projectId: string): Promise<any> {
    try {
      this.logPlaneAction('get_labels', 'start', { projectId });
      
      const response = await this.retryWithBackoff(() =>
        this.makeRequest(
          `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/labels/`
        )
      );

      this.logPlaneAction('get_labels', 'success', { 
        projectId, 
        count: response.results?.length || 0 
      });

      return response.results || [];
    } catch (error) {
      this.logPlaneAction('get_labels', 'error', { projectId }, error);
      throw error;
    }
  }

  // Assigner des labels à une issue
  async assignLabelsToIssue(projectId: string, issueId: string, labelIds: string[]): Promise<any> {
    try {
      this.logPlaneAction('assign_labels', 'start', { projectId, issueId, labelIds });
      
      const payload = {
        labels: labelIds,
      };
      
      // Ajouter un délai pour éviter les erreurs 429
      await this.delay(200);
      
      const result = await this.retryWithBackoff(() =>
        this.makeRequest(
          `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/issues/${issueId}/`,
          {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }
        )
      );

      this.logPlaneAction('assign_labels', 'success', { 
        projectId, 
        issueId, 
        labelIds 
      });

      return result;
    } catch (error) {
      this.logPlaneAction('assign_labels', 'error', { projectId, issueId, labelIds }, error);
      throw error;
    }
  }

  // Get project issues with their states for progress calculation
  async getProjectIssues(projectId: string): Promise<any[]> {
    try {
      this.logPlaneAction('get_project_issues', 'start', { projectId });
      
      const response = await this.retryWithBackoff(() =>
        this.makeRequest(
          `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/issues/`
        )
      );

      this.logPlaneAction('get_project_issues', 'success', { 
        projectId, 
        count: response.results?.length || 0 
      });

      return response.results || [];
    } catch (error) {
      this.logPlaneAction('get_project_issues', 'error', { projectId }, error);
      throw error;
    }
  }

  // ===== STATES MANAGEMENT =====

  // Récupérer les states d'un projet
  async getProjectStates(projectId: string): Promise<any[]> {
    try {
      this.logPlaneAction('get_project_states', 'start', { projectId });
      
      const response = await this.retryWithBackoff(() =>
        this.makeRequest(
          `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/states/`
        )
      );

      this.logPlaneAction('get_project_states', 'success', { 
        projectId, 
        count: response.results?.length || 0 
      });

      return response.results || [];
    } catch (error) {
      this.logPlaneAction('get_project_states', 'error', { projectId }, error);
      throw error;
    }
  }

  // Créer un state personnalisé
  async createState(projectId: string, name: string, color: string, description?: string): Promise<any> {
    try {
      this.logPlaneAction('create_state', 'start', { projectId, stateName: name, color });
      
      const payload = {
        name,
        color,
        description: description || `State: ${name}`,
      };
      
      await this.delay(200);
      
      const state = await this.retryWithBackoff(() =>
        this.makeRequest(
          `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/states/`,
          {
            method: 'POST',
            body: JSON.stringify(payload),
          }
        )
      );

      this.logPlaneAction('create_state', 'success', { 
        projectId, 
        stateId: state.id, 
        stateName: state.name 
      });

      return state;
    } catch (error) {
      this.logPlaneAction('create_state', 'error', { projectId, stateName: name, color }, error);
      throw error;
    }
  }

  // ===== ASSIGNEES MANAGEMENT =====

  // Récupérer les utilisateurs du workspace
  async getWorkspaceUsers(): Promise<any[]> {
    try {
      this.logPlaneAction('get_workspace_users', 'start', { workspaceSlug: PLANE_WORKSPACE_SLUG });
      
      const response = await this.retryWithBackoff(() =>
        this.makeRequest(
          `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/users/`
        )
      );

      this.logPlaneAction('get_workspace_users', 'success', { 
        count: response.results?.length || 0 
      });

      return response.results || [];
    } catch (error) {
      this.logPlaneAction('get_workspace_users', 'error', { workspaceSlug: PLANE_WORKSPACE_SLUG }, error);
      throw error;
    }
  }

  // Assigner une issue à un utilisateur
  async assignIssueToUser(projectId: string, issueId: string, userId: string): Promise<any> {
    try {
      this.logPlaneAction('assign_issue_to_user', 'start', { projectId, issueId, userId });
      
      const result = await this.updateIssue(projectId, issueId, {
        assignees: [userId]
      });

      this.logPlaneAction('assign_issue_to_user', 'success', { 
        projectId, 
        issueId, 
        userId 
      });

      return result;
    } catch (error) {
      this.logPlaneAction('assign_issue_to_user', 'error', { projectId, issueId, userId }, error);
      throw error;
    }
  }

  // Assigner une issue à plusieurs utilisateurs
  async assignIssueToUsers(projectId: string, issueId: string, userIds: string[]): Promise<any> {
    try {
      this.logPlaneAction('assign_issue_to_users', 'start', { projectId, issueId, userIds });
      
      const result = await this.updateIssue(projectId, issueId, {
        assignees: userIds
      });

      this.logPlaneAction('assign_issue_to_users', 'success', { 
        projectId, 
        issueId, 
        userIds 
      });

      return result;
    } catch (error) {
      this.logPlaneAction('assign_issue_to_users', 'error', { projectId, issueId, userIds }, error);
      throw error;
    }
  }

  // ===== DATES MANAGEMENT =====

  // Définir les dates d'une issue
  async setIssueDates(projectId: string, issueId: string, startDate?: string, targetDate?: string): Promise<any> {
    try {
      this.logPlaneAction('set_issue_dates', 'start', { projectId, issueId, startDate, targetDate });
      
      const updateData: any = {};
      if (startDate) updateData.start_date = startDate;
      if (targetDate) updateData.target_date = targetDate;
      
      const result = await this.updateIssue(projectId, issueId, updateData);

      this.logPlaneAction('set_issue_dates', 'success', { 
        projectId, 
        issueId, 
        startDate, 
        targetDate 
      });

      return result;
    } catch (error) {
      this.logPlaneAction('set_issue_dates', 'error', { projectId, issueId, startDate, targetDate }, error);
      throw error;
    }
  }

  // ===== IMPROVED SUB-ISSUES MANAGEMENT =====

  // Créer une sous-tâche avec state et assigné
  async createSubIssueWithState(
    projectId: string, 
    parentIssueId: string, 
    name: string, 
    description: string = '',
    stateId?: string,
    assigneeId?: string,
    startDate?: string,
    targetDate?: string
  ): Promise<any> {
    try {
      this.logPlaneAction('create_sub_issue_with_state', 'start', { 
        projectId, 
        parentIssueId, 
        issueName: name, 
        stateId, 
        assigneeId 
      });
      
      // D'abord, créer l'issue normale
      const issue = await this.createIssue(projectId, name, description);
      
      // Ensuite, la mettre à jour avec toutes les informations
      const updateData: any = { parent: parentIssueId };
      if (stateId) updateData.state = stateId;
      if (assigneeId) updateData.assignees = [assigneeId];
      if (startDate) updateData.start_date = startDate;
      if (targetDate) updateData.target_date = targetDate;
      
      console.log('🔗 Linking sub-issue with full data:', updateData);
      
      await this.delay(300);
      
      const updatedIssue = await this.retryWithBackoff(() =>
        this.makeRequest(
          `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/issues/${issue.id}/`,
          {
            method: 'PATCH',
            body: JSON.stringify(updateData),
          }
        )
      );

      this.logPlaneAction('create_sub_issue_with_state', 'success', { 
        issueId: issue.id, 
        projectId,
        parentIssueId,
        issueName: issue.name,
        stateId,
        assigneeId
      });

      return updatedIssue;
    } catch (error) {
      this.logPlaneAction('create_sub_issue_with_state', 'error', { 
        projectId, 
        parentIssueId, 
        issueName: name, 
        stateId, 
        assigneeId 
      }, error);
      throw error;
    }
  }

  // Créer une issue complète avec toutes les informations
  async createCompleteIssue(
    projectId: string,
    name: string,
    description: string = '',
    stateId?: string,
    assigneeIds?: string[],
    startDate?: string,
    targetDate?: string,
    priority?: string,
    labels?: string[]
  ): Promise<any> {
    try {
      this.logPlaneAction('create_complete_issue', 'start', { 
        projectId, 
        issueName: name, 
        stateId, 
        assigneeIds,
        priority,
        labels
      });
      
      const issueData: any = { name };
      if (description) issueData.description = description;
      if (stateId) issueData.state = stateId;
      if (assigneeIds && assigneeIds.length > 0) issueData.assignees = assigneeIds;
      if (startDate) issueData.start_date = startDate;
      if (targetDate) issueData.target_date = targetDate;
      if (priority) issueData.priority = priority;
      if (labels && labels.length > 0) issueData.labels = labels;
      
      console.log('🚀 Creating complete issue with payload:', issueData);
      
      await this.delay(400);
      
      const issue = await this.retryWithBackoff(() =>
        this.makeRequest(
          `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/issues/`,
          {
            method: 'POST',
            body: JSON.stringify(issueData),
          }
        )
      );

      this.logPlaneAction('create_complete_issue', 'success', { 
        projectId, 
        issueName: name, 
        issueId: issue.id,
        stateId,
        assigneeIds,
        priority,
        labels
      });

      return issue;
    } catch (error) {
      this.logPlaneAction('create_complete_issue', 'error', { 
        projectId, 
        issueName: name, 
        stateId, 
        assigneeIds,
        priority,
        labels
      }, error);
      throw error;
    }
  }

  // ===== PRIORITY MANAGEMENT =====

  // Récupérer les priorités disponibles
  async getProjectPriorities(projectId: string): Promise<any[]> {
    try {
      this.logPlaneAction('get_project_priorities', 'start', { projectId });
      
      const response = await this.retryWithBackoff(() =>
        this.makeRequest(
          `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/priorities/`
        )
      );

      this.logPlaneAction('get_project_priorities', 'success', { 
        projectId, 
        count: response.results?.length || 0 
      });

      return response.results || [];
    } catch (error) {
      this.logPlaneAction('get_project_priorities', 'error', { projectId }, error);
      throw error;
    }
  }

  // ===== ENHANCED PROJECT SYNC =====

  // Synchroniser complètement un projet avec toutes ses données
  async syncProjectComplete(projectId: string): Promise<any> {
    try {
      this.logPlaneAction('sync_project_complete', 'start', { projectId });
      
      // Récupérer le projet avec tous ses détails
      const project = await this.getProject(projectId);
      
      // Récupérer les states
      const states = await this.getProjectStates(projectId);
      
      // Récupérer les priorités
      const priorities = await this.getProjectPriorities(projectId);
      
      // Récupérer les utilisateurs
      const users = await this.getWorkspaceUsers();
      
      // Récupérer les labels
      const labels = await this.getLabels(projectId);

      const completeProject = {
        ...project,
        states,
        priorities,
        users,
        labels
      };

      this.logPlaneAction('sync_project_complete', 'success', { 
        projectId,
        statesCount: states.length,
        prioritiesCount: priorities.length,
        usersCount: users.length,
        labelsCount: labels.length
      });

      return completeProject;
    } catch (error) {
      this.logPlaneAction('sync_project_complete', 'error', { projectId }, error);
      throw error;
    }
  }

}

export const planeApi = new PlaneApiService();
