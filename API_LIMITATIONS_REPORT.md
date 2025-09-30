# Rapport des Limitations API Plane.so

## 🚨 Fonctionnalités Potentiellement Non Disponibles

Après analyse de la migration et recherche de la documentation Plane.so, voici les fonctionnalités qui pourraient poser problème :

### 1. 📦 **Archivage de Projets**

#### ❌ **Problème Identifié**
```typescript
// Dans planeApi.ts - ligne 436
body: JSON.stringify({
  archived_at: new Date().toISOString(),
}),
```

#### 🔍 **Analyse**
- **Statut** : ⚠️ **NON CONFIRMÉ**
- **Raison** : La documentation Plane.so ne mentionne pas explicitement le champ `archived_at`
- **Impact** : L'archivage de projets pourrait ne pas fonctionner

#### 🛠️ **Solutions Alternatives**
1. **Suppression complète** : Utiliser `DELETE` au lieu de `PATCH`
2. **Champ personnalisé** : Utiliser un champ custom pour marquer comme archivé
3. **Déplacement** : Déplacer vers un projet "Archivé"

### 2. 🔗 **Sous-tâches (Sub-Issues)**

#### ❌ **Problème Identifié**
```typescript
// Dans planeApi.ts - ligne 235
parent: parentIssueId, // Lier à l'issue parent
```

#### 🔍 **Analyse**
- **Statut** : ⚠️ **NON CONFIRMÉ**
- **Raison** : La documentation ne confirme pas le champ `parent` dans les issues
- **Impact** : Les sous-tâches pourraient ne pas être liées correctement

#### 🛠️ **Solutions Alternatives**
1. **Issues liées** : Utiliser le système de "linked issues" de Plane.so
2. **Labels** : Utiliser des labels pour identifier les sous-tâches
3. **Modules séparés** : Créer des modules pour les sous-tâches

### 3. 📋 **Association Issues-Modules**

#### ❌ **Problème Identifié**
```typescript
// Dans planeApi.ts - ligne 204
`/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}/projects/${projectId}/modules/${moduleId}/module-issues/`
```

#### 🔍 **Analyse**
- **Statut** : ⚠️ **NON CONFIRMÉ**
- **Raison** : L'endpoint `module-issues` n'est pas documenté
- **Impact** : Les issues pourraient ne pas être associées aux modules

#### 🛠️ **Solutions Alternatives**
1. **Champ module** : Utiliser un champ `module` dans l'issue
2. **Labels** : Utiliser des labels pour associer aux modules
3. **Projets séparés** : Créer des projets par module

## 🔧 **Fonctionnalités Confirmées Disponibles**

### ✅ **Projets**
- Création : `POST /api/v1/workspaces/{slug}/projects/`
- Récupération : `GET /api/v1/workspaces/{slug}/projects/`
- Mise à jour : `PATCH /api/v1/workspaces/{slug}/projects/{id}/`
- Suppression : `DELETE /api/v1/workspaces/{slug}/projects/{id}/`

### ✅ **Modules**
- Création : `POST /api/v1/workspaces/{slug}/projects/{id}/modules/`
- Récupération : `GET /api/v1/workspaces/{slug}/projects/{id}/modules/`
- Suppression : `DELETE /api/v1/workspaces/{slug}/projects/{id}/modules/{id}/`

### ✅ **Issues**
- Création : `POST /api/v1/workspaces/{slug}/projects/{id}/issues/`
- Récupération : `GET /api/v1/workspaces/{slug}/projects/{id}/issues/`
- Mise à jour : `PATCH /api/v1/workspaces/{slug}/projects/{id}/issues/{id}/`
- Suppression : `DELETE /api/v1/workspaces/{slug}/projects/{id}/issues/{id}/`

## 🧪 **Tests Recommandés**

### 1. Test d'Archivage
```bash
# Tester l'archivage d'un projet
curl -X PATCH "https://plane.provect.io/api/v1/workspaces/{slug}/projects/{id}/" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"archived_at": "2024-01-01T00:00:00Z"}'
```

### 2. Test de Sous-tâches
```bash
# Tester la création d'une sous-tâche
curl -X POST "https://plane.provect.io/api/v1/workspaces/{slug}/projects/{id}/issues/" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Sub-task", "parent": "parent-issue-id"}'
```

### 3. Test d'Association Module-Issue
```bash
# Tester l'association d'une issue à un module
curl -X POST "https://plane.provect.io/api/v1/workspaces/{slug}/projects/{id}/modules/{module-id}/module-issues/" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"issues": ["issue-id"]}'
```

## 🚨 **Actions Immédiates Requises**

### 1. **Tester les API Critiques**
- [ ] Vérifier l'archivage de projets
- [ ] Tester la création de sous-tâches
- [ ] Valider l'association issues-modules

### 2. **Implémenter des Fallbacks**
- [ ] Gestion d'erreur pour l'archivage
- [ ] Alternative pour les sous-tâches
- [ ] Solution de secours pour les modules

### 3. **Documenter les Limitations**
- [ ] Mettre à jour la documentation
- [ ] Informer les utilisateurs
- [ ] Créer des guides de contournement

## 📞 **Support Plane.so**

### Contacts Recommandés
- **Documentation** : https://developers.plane.so
- **Support** : Via leur plateforme officielle
- **Communauté** : Forums et Discord Plane.so

### Questions à Poser
1. Le champ `archived_at` est-il supporté pour les projets ?
2. Comment créer des sous-tâches avec l'API ?
3. L'endpoint `module-issues` est-il disponible ?
4. Quels sont les champs disponibles pour les issues ?

## 🎯 **Recommandations**

### Court Terme
1. **Tester immédiatement** les fonctionnalités critiques
2. **Implémenter des fallbacks** pour les cas d'échec
3. **Contacter le support** Plane.so pour clarification

### Moyen Terme
1. **Adapter l'interface** selon les limitations réelles
2. **Optimiser l'UX** avec les fonctionnalités disponibles
3. **Documenter** les différences avec Monday.com

### Long Terme
1. **Suivre les mises à jour** de l'API Plane.so
2. **Implémenter** les nouvelles fonctionnalités
3. **Migrer** vers les meilleures pratiques Plane.so

---

**⚠️ IMPORTANT** : Ce rapport est basé sur l'analyse de la documentation disponible. Des tests réels avec l'API Plane.so sont nécessaires pour confirmer ces limitations.
