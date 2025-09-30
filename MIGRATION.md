# Migration de Monday.com vers Plane.so

## Résumé de la migration

Ce projet a été migré de Monday.com vers Plane.so pour la gestion des projets, modules, tâches et sous-tâches.

## Changements principaux

### 1. API Service
- **Ancien** : `src/services/mondayApi.ts` (GraphQL)
- **Nouveau** : `src/services/planeApi.ts` (REST API)

### 2. Types mis à jour
- `mondayBoardId` → `planeProjectId`
- `mondayGroupId` → `planeModuleId`
- `mondayItemId` → `planeIssueId`
- `mondaySubItemId` → `planeSubIssueId`

### 3. Configuration d'environnement
- **Ancien** :
  ```
  VITE_MONDAY_API_TOKEN=...
  VITE_MONDAY_WORKSPACE_ID=...
  ```
- **Nouveau** :
  ```
  VITE_PLANE_API_KEY=...
  VITE_PLANE_WORKSPACE_SLUG=...
  VITE_PLANE_API_ENDPOINT=https://plane.provect.io
  ```

### 4. Structure des données

#### Monday.com (ancien)
```
Workspace → Boards → Groups → Items → SubItems
```

#### Plane.so (nouveau)
```
Workspace → Projects → Modules → Issues → Sub-Issues
```

## Fonctionnalités migrées

### ✅ Projets
- Création de projets
- Récupération de la liste des projets
- Archivage de projets
- Synchronisation en arrière-plan

### ✅ Modules
- Création de modules dans un projet
- Suppression de modules
- Association des modules aux équipes

### ✅ Tâches (Issues)
- Création de tâches dans un module
- Mise à jour des tâches
- Suppression de tâches
- Gestion des statuts

### ✅ Sous-tâches (Sub-Issues)
- Création de sous-tâches liées à une tâche parent
- Mise à jour des sous-tâches
- Suppression de sous-tâches
- Gestion de la hiérarchie parent-enfant

## Gestion des sous-tâches avec Plane.so

Plane.so gère les sous-tâches via des "sub-issues" qui sont des issues normales avec un champ `parent` qui référence l'issue parent. Cette approche est différente de Monday.com qui utilisait des "sub-items" dédiés.

### Implémentation
```typescript
// Création d'une sous-tâche
const subIssue = await planeApi.createSubIssue(
  projectId,
  parentIssueId,
  subTaskName,
  subTaskDescription
);
```

## Configuration requise

1. **Token API Plane.so** : Obtenez votre token dans les paramètres de votre compte Plane.so
2. **Workspace Slug** : Le slug de votre workspace (visible dans l'URL)
3. **Endpoint API** : URL de votre instance Plane.so

## Tests recommandés

1. **Connexion API** : Vérifiez que la connexion à Plane.so fonctionne
2. **Création de projet** : Testez la création d'un nouveau projet
3. **Ajout de modules** : Vérifiez l'ajout de modules à un projet
4. **Gestion des tâches** : Testez la création/modification de tâches
5. **Sous-tâches** : Vérifiez la création et gestion des sous-tâches
6. **Synchronisation** : Testez la synchronisation en arrière-plan

## Notes importantes

- Les données existantes de Monday.com ne sont pas automatiquement migrées
- Il est recommandé de tester avec un workspace Plane.so dédié
- La gestion des couleurs et équipes reste identique
- Les templates de modules sont conservés

## Support

En cas de problème, vérifiez :
1. La configuration des variables d'environnement
2. Les permissions de votre token API
3. La connectivité réseau vers votre instance Plane.so
4. Les logs de la console pour les erreurs détaillées
