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

  // Supprimer un module
  async deleteModule(projectId: string, moduleId: string): Promise<any> {
    try {
      this.logPlaneAction('delete_module', 'success', { projectId, moduleId });
      
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
      
      const result = await this.retryWithBackoff(() =>
        this.makeRequest(
          `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/`,
          {
            method: 'DELETE',
          }
        )
      );

      this.logPlaneAction('delete_project', 'success', { 
        projectId 
      });

      return result;
    } catch (error) {
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
}

export const planeApi = new PlaneApiService();
