// Service de synchronisation de l'avancement des projets avec Plane.so
import { planeApi } from './planeApi';
import { useLocalDataStore } from '../store/useLocalDataStore';
import { autoSaveToBackend } from '../utils/backendStorage';

// Mapping des statuts Plane.so vers des pourcentages d'avancement
const STATE_TO_PROGRESS = {
  'backlog': 0,
  'unstarted': 0,
  'started': 50,
  'completed': 100,
  'cancelled': 100
} as const;

export interface ProgressSyncResult {
  projectId: string;
  projectName: string;
  oldProgress: number;
  newProgress: number;
  issuesCount: number;
  updated: boolean;
}

class ProgressSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private stateMapping: Map<string, string> = new Map();

  // Initialiser le mapping des statuts depuis les issues existantes
  private async initializeStateMapping(): Promise<void> {
    try {
      console.log('🔄 Récupération des statuts depuis les issues existantes...');
      
      // Récupérer les issues d'un projet existant pour analyser les statuts
      const { data: localData } = useLocalDataStore.getState();
      const projects = localData.projects.filter(p => p.planeProjectId);
      
      if (projects.length === 0) {
        console.log('⚠️ Aucun projet trouvé pour analyser les statuts');
        return;
      }
      
      // Prendre le premier projet pour analyser les statuts
      const firstProject = projects[0];
      console.log(`📊 Analyse des statuts depuis le projet: ${firstProject.name}`);
      
      const issues = await planeApi.getProjectIssues(firstProject.planeProjectId);
      
      this.stateMapping.clear();
      
      // Analyser les issues pour déduire les statuts
      const uniqueStates = new Set<string>();
      issues.forEach(issue => {
        if (issue.state) {
          uniqueStates.add(issue.state);
        }
      });
      
      console.log(`📊 Statuts uniques trouvés: ${uniqueStates.size}`);
      
      // Pour chaque statut unique, essayer de déterminer le groupe
      for (const stateId of uniqueStates) {
        // Logique de déduction basée sur les patterns connus
        let group = 'unstarted'; // Par défaut
        
        // Si on a des informations sur le statut dans l'issue, on peut les utiliser
        const issueWithState = issues.find(issue => issue.state === stateId);
        if (issueWithState) {
          // Analyser les propriétés de l'issue pour déduire le statut
          if (issueWithState.completed_at) {
            group = 'completed';
          } else if (issueWithState.started_at) {
            group = 'started';
          } else {
            group = 'unstarted';
          }
        }
        
        this.stateMapping.set(stateId, group);
        console.log(`📊 Statut mappé: ${stateId} -> ${group}`);
      }
      
      console.log(`✅ Mapping des statuts initialisé: ${this.stateMapping.size} statuts`);
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation du mapping des statuts:', error);
    }
  }

  // Calculer l'avancement d'un projet basé sur les statuts des issues
  private calculateProjectProgress(issues: any[]): number {
    if (issues.length === 0) return 0;

    const totalProgress = issues.reduce((total, issue) => {
      // Obtenir le statut via le mapping des IDs
      const stateId = issue.state;
      const stateGroup = this.stateMapping.get(stateId) || 'unstarted';
      
      console.log(`    Calcul pour "${issue.name}": ID="${stateId}" -> groupe="${stateGroup}"`);
      
      const progress = STATE_TO_PROGRESS[stateGroup as keyof typeof STATE_TO_PROGRESS] || 0;
      console.log(`    Progression: ${progress}%`);
      
      return total + progress;
    }, 0);

    const averageProgress = Math.round(totalProgress / issues.length);
    console.log(`📊 Avancement calculé: ${averageProgress}% (total: ${totalProgress}, issues: ${issues.length})`);
    
    return averageProgress;
  }

  // Synchroniser l'avancement d'un projet spécifique
  async syncProjectProgress(projectId: string): Promise<ProgressSyncResult | null> {
    try {
      console.log(`🔄 Synchronisation de l'avancement pour le projet ${projectId}...`);

      // Récupérer les issues du projet depuis Plane.so
      const issues = await planeApi.getProjectIssues(projectId);
      console.log(`📋 Issues récupérées: ${issues.length}`);
      
      // Log des détails des issues pour debug
      issues.forEach((issue, index) => {
        console.log(`  Issue ${index + 1}: ${issue.name}`);
        console.log(`    - state:`, issue.state);
        console.log(`    - completed_at:`, issue.completed_at);
        console.log(`    - started_at:`, issue.started_at);
        console.log(`    - created_at:`, issue.created_at);
        console.log(`    - updated_at:`, issue.updated_at);
      });
      
      // Calculer le nouvel avancement
      const newProgress = this.calculateProjectProgress(issues);

      // Récupérer le projet local
      const { data: localData } = useLocalDataStore.getState();
      const project = localData.projects.find(p => p.planeProjectId === projectId);
      
      if (!project) {
        console.warn(`⚠️ Projet ${projectId} non trouvé localement`);
        return null;
      }

      const oldProgress = project.progress;
      const updated = oldProgress !== newProgress;

      if (updated) {
        // Mettre à jour l'avancement dans le store local
        useLocalDataStore.getState().updateProject(project.id, { 
          progress: newProgress,
          updatedAt: new Date().toISOString()
        });

        // Sauvegarder dans les fichiers JSON
        const { data } = useLocalDataStore.getState();
        await autoSaveToBackend(data);

        console.log(`✅ Avancement mis à jour: ${project.name} (${oldProgress}% → ${newProgress}%)`);
      }

      return {
        projectId,
        projectName: project.name,
        oldProgress,
        newProgress,
        issuesCount: issues.length,
        updated
      };

    } catch (error) {
      console.error(`❌ Erreur lors de la synchronisation du projet ${projectId}:`, error);
      return null;
    }
  }

  // Synchroniser tous les projets
  async syncAllProjects(): Promise<ProgressSyncResult[]> {
    if (this.isSyncing) {
      console.log('⏳ Synchronisation déjà en cours...');
      return [];
    }

    this.isSyncing = true;
    console.log('🔄 Début de la synchronisation de tous les projets...');

    try {
      // Initialiser le mapping des statuts si nécessaire
      if (this.stateMapping.size === 0) {
        await this.initializeStateMapping();
      }
      const { data: localData } = useLocalDataStore.getState();
      const projects = localData.projects.filter(p => p.planeProjectId);
      
      console.log(`📊 Projets trouvés pour synchronisation: ${projects.length}`);
      projects.forEach(p => {
        console.log(`  - ${p.name} (ID: ${p.id}, Plane ID: ${p.planeProjectId})`);
      });
      
      const results: ProgressSyncResult[] = [];
      
      for (const project of projects) {
        const result = await this.syncProjectProgress(project.planeProjectId);
        if (result) {
          results.push(result);
        }
        
        // Délai entre les synchronisations pour éviter le rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const updatedCount = results.filter(r => r.updated).length;
      console.log(`✅ Synchronisation terminée: ${updatedCount}/${results.length} projets mis à jour`);

      return results;
    } finally {
      this.isSyncing = false;
    }
  }

  // Démarrer la synchronisation automatique toutes les 5 minutes
  startAutoSync(): void {
    if (this.syncInterval) {
      console.log('⚠️ Synchronisation automatique déjà démarrée');
      return;
    }

    console.log('🚀 Démarrage de la synchronisation automatique (toutes les 5 minutes)');
    
    // Synchronisation immédiate
    this.syncAllProjects();

    // Puis toutes les 5 minutes
    this.syncInterval = setInterval(() => {
      this.syncAllProjects();
    }, 5 * 60 * 1000); // 5 minutes
  }

  // Arrêter la synchronisation automatique
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏹️ Synchronisation automatique arrêtée');
    }
  }

  // Synchronisation manuelle
  async manualSync(): Promise<ProgressSyncResult[]> {
    console.log('🔄 Synchronisation manuelle demandée...');
    return await this.syncAllProjects();
  }
}

export const progressSyncService = new ProgressSyncService();
