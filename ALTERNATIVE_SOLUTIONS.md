# Solutions Alternatives pour les Limitations API Plane.so

## 🚨 Fonctionnalités Problématiques et Solutions

### 1. 📦 **Archivage de Projets**

#### ❌ **Problème**
L'API Plane.so pourrait ne pas supporter le champ `archived_at` pour l'archivage de projets.

#### 🛠️ **Solutions Alternatives**

##### Solution 1: Suppression Complète
```typescript
// Au lieu d'archiver, supprimer complètement
async archiveProject(projectId: string): Promise<any> {
  try {
    // Supprimer le projet au lieu de l'archiver
    const result = await this.makeRequest(
      `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/`,
      {
        method: 'DELETE',
      }
    );
    return result;
  } catch (error) {
    throw error;
  }
}
```

##### Solution 2: Champ Personnalisé
```typescript
// Utiliser un champ personnalisé pour marquer comme archivé
async archiveProject(projectId: string): Promise<any> {
  try {
    const result = await this.makeRequest(
      `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          // Utiliser un champ personnalisé si disponible
          custom_fields: {
            archived: true,
            archived_at: new Date().toISOString()
          }
        }),
      }
    );
    return result;
  } catch (error) {
    throw error;
  }
}
```

##### Solution 3: Projet "Archivé"
```typescript
// Déplacer vers un projet "Archivé" dédié
async archiveProject(projectId: string): Promise<any> {
  try {
    // Créer ou récupérer le projet "Archivé"
    const archiveProject = await this.getOrCreateArchiveProject();
    
    // Déplacer toutes les issues vers le projet archivé
    const issues = await this.getProjectIssues(projectId);
    for (const issue of issues) {
      await this.moveIssueToProject(issue.id, archiveProject.id);
    }
    
    // Supprimer le projet original
    await this.makeRequest(
      `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/`,
      { method: 'DELETE' }
    );
    
    return { success: true, archived_to: archiveProject.id };
  } catch (error) {
    throw error;
  }
}
```

### 2. 🔗 **Sous-tâches (Sub-Issues)**

#### ❌ **Problème**
Le champ `parent` pourrait ne pas être supporté dans l'API Plane.so.

#### 🛠️ **Solutions Alternatives**

##### Solution 1: Issues Liées
```typescript
// Utiliser le système de "linked issues" de Plane.so
async createSubIssue(projectId: string, parentIssueId: string, name: string, description: string = ''): Promise<any> {
  try {
    // Créer l'issue normalement
    const issue = await this.makeRequest(
      `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/issues/`,
      {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          description_html: description ? `<p>${description}</p>` : '',
        }),
      }
    );
    
    // Lier l'issue à la tâche parent (si l'API le supporte)
    try {
      await this.makeRequest(
        `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/issues/${issue.id}/`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            // Essayer différents champs possibles
            linked_issues: [parentIssueId],
            // ou
            relates_to: [parentIssueId],
            // ou
            blocks: [parentIssueId]
          }),
        }
      );
    } catch (linkError) {
      console.warn('Impossible de lier les issues:', linkError);
    }
    
    return issue;
  } catch (error) {
    throw error;
  }
}
```

##### Solution 2: Labels et Préfixes
```typescript
// Utiliser des labels pour identifier les sous-tâches
async createSubIssue(projectId: string, parentIssueId: string, name: string, description: string = ''): Promise<any> {
  try {
    const issue = await this.makeRequest(
      `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/issues/`,
      {
        method: 'POST',
        body: JSON.stringify({
          name: `[Sous-tâche] ${name}`, // Préfixe pour identifier
          description: `Sous-tâche de: ${parentIssueId}\n\n${description}`,
          description_html: `<p><strong>Sous-tâche de:</strong> ${parentIssueId}</p><p>${description}</p>`,
          labels: ['sub-task', `parent-${parentIssueId}`], // Labels pour identification
        }),
      }
    );
    
    return issue;
  } catch (error) {
    throw error;
  }
}
```

##### Solution 3: Modules Séparés
```typescript
// Créer des modules pour les sous-tâches
async createSubIssue(projectId: string, parentIssueId: string, name: string, description: string = ''): Promise<any> {
  try {
    // Créer un module pour les sous-tâches de cette tâche
    const moduleName = `Sous-tâches de ${parentIssueId}`;
    const module = await this.createModule(projectId, moduleName, `Sous-tâches de la tâche ${parentIssueId}`);
    
    // Créer l'issue dans ce module
    const issue = await this.createIssue(projectId, name, description, module.id);
    
    return issue;
  } catch (error) {
    throw error;
  }
}
```

### 3. 📋 **Association Issues-Modules**

#### ❌ **Problème**
L'endpoint `module-issues` pourrait ne pas exister.

#### 🛠️ **Solutions Alternatives**

##### Solution 1: Champ Module Direct
```typescript
// Utiliser un champ module dans l'issue
async addIssueToModule(projectId: string, moduleId: string, issueId: string): Promise<any> {
  try {
    const result = await this.makeRequest(
      `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/issues/${issueId}/`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          module: moduleId, // Champ module direct
        }),
      }
    );
    return result;
  } catch (error) {
    throw error;
  }
}
```

##### Solution 2: Labels pour Modules
```typescript
// Utiliser des labels pour associer aux modules
async addIssueToModule(projectId: string, moduleId: string, issueId: string): Promise<any> {
  try {
    // Récupérer le nom du module
    const module = await this.makeRequest(
      `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/modules/${moduleId}/`
    );
    
    const result = await this.makeRequest(
      `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/issues/${issueId}/`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          labels: [`module-${module.name}`, `module-id-${moduleId}`],
        }),
      }
    );
    return result;
  } catch (error) {
    throw error;
  }
}
```

##### Solution 3: Projets Séparés par Module
```typescript
// Créer des projets séparés pour chaque module
async createModule(projectId: string, name: string, description: string = ''): Promise<any> {
  try {
    // Au lieu de créer un module, créer un projet séparé
    const moduleProject = await this.makeRequest(
      `/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/`,
      {
        method: 'POST',
        body: JSON.stringify({
          name: `[Module] ${name}`,
          identifier: `module-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          description: `Module: ${description}`,
        }),
      }
    );
    
    return moduleProject;
  } catch (error) {
    throw error;
  }
}
```

## 🔧 **Implémentation des Solutions**

### 1. Service API Adaptatif
```typescript
class AdaptivePlaneApiService extends PlaneApiService {
  private fallbackMode = false;
  
  async archiveProject(projectId: string): Promise<any> {
    try {
      // Essayer l'archivage standard
      return await super.archiveProject(projectId);
    } catch (error) {
      console.warn('Archivage standard échoué, utilisation du fallback');
      this.fallbackMode = true;
      
      // Utiliser la solution alternative
      return await this.archiveProjectFallback(projectId);
    }
  }
  
  private async archiveProjectFallback(projectId: string): Promise<any> {
    // Implémentation de la solution alternative
    // (suppression, champ personnalisé, ou déplacement)
  }
}
```

### 2. Détection Automatique des Capacités
```typescript
class CapabilityDetector {
  private capabilities: Map<string, boolean> = new Map();
  
  async detectCapabilities(): Promise<void> {
    // Tester chaque fonctionnalité
    this.capabilities.set('project_archiving', await this.testProjectArchiving());
    this.capabilities.set('sub_issues', await this.testSubIssues());
    this.capabilities.set('module_issues', await this.testModuleIssues());
  }
  
  hasCapability(capability: string): boolean {
    return this.capabilities.get(capability) || false;
  }
}
```

### 3. Interface Utilisateur Adaptative
```typescript
// Dans les composants React
const usePlaneCapabilities = () => {
  const [capabilities, setCapabilities] = useState<Map<string, boolean>>(new Map());
  
  useEffect(() => {
    // Détecter les capacités au chargement
    detectCapabilities().then(setCapabilities);
  }, []);
  
  return {
    canArchiveProjects: capabilities.get('project_archiving') || false,
    canCreateSubTasks: capabilities.get('sub_issues') || false,
    canAssociateModules: capabilities.get('module_issues') || false,
  };
};
```

## 📋 **Plan de Migration Graduelle**

### Phase 1: Tests et Détection
1. ✅ Exécuter les tests de limitations
2. ✅ Identifier les fonctionnalités non supportées
3. ✅ Implémenter la détection automatique

### Phase 2: Solutions Alternatives
1. 🔄 Implémenter les fallbacks pour l'archivage
2. 🔄 Adapter la gestion des sous-tâches
3. 🔄 Corriger l'association modules-issues

### Phase 3: Interface Adaptative
1. 🔄 Masquer les fonctionnalités non supportées
2. 🔄 Adapter l'UX selon les capacités
3. 🔄 Informer l'utilisateur des limitations

### Phase 4: Optimisation
1. 🔄 Optimiser les performances
2. 🔄 Améliorer la gestion d'erreurs
3. 🔄 Documenter les solutions

## 🎯 **Recommandations Immédiates**

1. **Exécuter les tests** : `node test-api-limitations.js`
2. **Analyser les résultats** : Identifier les fonctionnalités problématiques
3. **Implémenter les fallbacks** : Pour chaque fonctionnalité échouée
4. **Tester en conditions réelles** : Avec votre instance Plane.so
5. **Adapter l'interface** : Selon les capacités détectées

---

**⚠️ IMPORTANT** : Ces solutions sont des alternatives qui nécessitent des tests approfondis avec votre instance Plane.so spécifique.
