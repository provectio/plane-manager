export interface Project {
  id: string;
  name: string;
  salesforceNumber: string;
  boardId: string;
  planeProjectId: string;
  identifier: string;
  description: string;
  modules: Module[];
  status: ProjectStatus;
  progress: number; // Progress percentage (0-100)
  createdAt: string;
  updatedAt: string;
  syncStatus?: 'syncing' | 'synced' | 'error';
  syncError?: string;
  isDeleting?: boolean; // Indicates if project is being deleted
}

export interface Module {
  id: string;
  name: string;
  type: ModuleType;
  team: TeamType;
  planeModuleId: string;
  tasks: Task[];
  status: ModuleStatus;
}

export interface Task {
  id: string;
  name: string;
  itemId: string;
  planeIssueId: string | null;
  status: TaskStatus;
  description?: string;
  subTasks: SubTask[];
  // Nouvelles propriétés basées sur l'API Plane.so
  state?: string; // UUID du state
  assignees?: string[]; // UUIDs des assignés
  startDate?: string; // Date de début (format ISO)
  targetDate?: string; // Date cible (format ISO)
  priority?: string; // Priorité de l'issue
  labels?: string[]; // UUIDs des labels
  parent?: string; // UUID du parent pour les sous-tâches
  sequenceId?: number; // ID de séquence Plane.so
  sortOrder?: number; // Ordre de tri
  completedAt?: string | null; // Date de completion
  archivedAt?: string | null; // Date d'archivage
  isDraft?: boolean; // Si c'est un brouillon
  createdBy?: string; // UUID du créateur
  updatedBy?: string; // UUID du dernier modificateur
  estimatePoint?: number | null; // Points d'estimation
}

export interface SubTask {
  id: string;
  name: string;
  planeSubIssueId: string | null;
  status: TaskStatus;
  // Nouvelles propriétés basées sur l'API Plane.so
  state?: string; // UUID du state
  assignees?: string[]; // UUIDs des assignés
  startDate?: string; // Date de début (format ISO)
  targetDate?: string; // Date cible (format ISO)
  priority?: string; // Priorité de l'issue
  labels?: string[]; // UUIDs des labels
  parent?: string; // UUID du parent
  sequenceId?: number; // ID de séquence Plane.so
  sortOrder?: number; // Ordre de tri
  completedAt?: string | null; // Date de completion
  archivedAt?: string | null; // Date d'archivage
  isDraft?: boolean; // Si c'est un brouillon
  createdBy?: string; // UUID du créateur
  updatedBy?: string; // UUID du dernier modificateur
  estimatePoint?: number | null; // Points d'estimation
}

export type ModuleType = 'Infrastructure' | 'Telecom' | 'Cloud' | 'Cybersécurité' | 'Infogérance' | 'Conformité';

export type TeamType = 'Infrastructure' | 'Cybersécurité' | 'Télécom' | 'Cloud' | 'Infogérance' | 'Conformité & Qualité' | 'Gouvernance';

export interface Team {
  id: string;
  name: TeamType;
  description: string;
  color: string;
  icon: string;
  trigramme: string; // 3 lettres majuscules pour identifier l'équipe
}

export type ModuleStatus = 'not_started' | 'in_progress' | 'completed' | 'on_hold';

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export type ProjectStatus = 'not_started' | 'in_progress' | 'completed' | 'on_hold' | 'archived';

export interface ApiStatus {
  isConnected: boolean;
  lastChecked: string;
  error?: string;
}

export interface Theme {
  mode: 'light' | 'dark';
}

export interface AppState {
  projects: Project[];
  apiStatus: ApiStatus;
  theme: Theme;
  isLoading: boolean;
  error?: string;
}

// ===== NOUVEAUX TYPES POUR L'API PLANE.SO =====

// State personnalisé d'un projet
export interface PlaneState {
  id: string; // UUID du state
  name: string; // Nom du state (ex: "En cours", "Terminé")
  color: string; // Couleur hexadécimale
  description?: string; // Description du state
  sequence?: number; // Ordre d'affichage
  group?: string; // Groupe du state (ex: "backlog", "unstarted", "started", "completed", "cancelled")
  project?: string; // UUID du projet
  created_at?: string; // Date de création
  updated_at?: string; // Date de mise à jour
}

// Utilisateur du workspace
export interface PlaneUser {
  id: string; // UUID de l'utilisateur
  email: string; // Email de l'utilisateur
  first_name?: string; // Prénom
  last_name?: string; // Nom
  display_name?: string; // Nom d'affichage
  avatar?: string; // URL de l'avatar
  is_active?: boolean; // Si l'utilisateur est actif
  is_bot?: boolean; // Si c'est un bot
  created_at?: string; // Date de création
  updated_at?: string; // Date de mise à jour
}

// Priorité d'un projet
export interface PlanePriority {
  id: string; // UUID de la priorité
  name: string; // Nom de la priorité (ex: "Urgent", "Haute", "Moyenne", "Basse")
  color: string; // Couleur hexadécimale
  description?: string; // Description de la priorité
  sequence?: number; // Ordre d'affichage
  project?: string; // UUID du projet
  created_at?: string; // Date de création
  updated_at?: string; // Date de mise à jour
}

// Label d'un projet
export interface PlaneLabel {
  id: string; // UUID du label
  name: string; // Nom du label
  color: string; // Couleur hexadécimale
  description?: string; // Description du label
  project?: string; // UUID du projet
  created_at?: string; // Date de création
  updated_at?: string; // Date de mise à jour
}

// Issue complète de Plane.so (basée sur votre exemple)
export interface PlaneIssue {
  id: string; // UUID de l'issue
  created_at: string; // Date de création
  updated_at: string; // Date de mise à jour
  estimate_point?: number | null; // Points d'estimation
  name: string; // Nom de l'issue
  description_html?: string; // Description en HTML
  description_stripped?: string; // Description en texte brut
  priority: string; // Priorité (ex: "urgent", "high", "medium", "low", "none")
  start_date?: string; // Date de début (format ISO)
  target_date?: string; // Date cible (format ISO)
  sequence_id: number; // ID de séquence
  sort_order: number; // Ordre de tri
  completed_at?: string | null; // Date de completion
  archived_at?: string | null; // Date d'archivage
  is_draft: boolean; // Si c'est un brouillon
  created_by: string; // UUID du créateur
  updated_by: string; // UUID du dernier modificateur
  project: string; // UUID du projet
  workspace: string; // UUID du workspace
  parent?: string | null; // UUID du parent pour les sous-tâches
  state: string; // UUID du state
  assignees: string[]; // UUIDs des assignés
  labels: string[]; // UUIDs des labels
  module?: string; // UUID du module (si assigné à un module)
}

// Projet complet avec toutes ses données
export interface CompleteProject extends Project {
  states?: PlaneState[]; // States du projet
  priorities?: PlanePriority[]; // Priorités du projet
  users?: PlaneUser[]; // Utilisateurs du workspace
  labels?: PlaneLabel[]; // Labels du projet
  issues?: PlaneIssue[]; // Issues du projet
}

// Options pour créer une issue complète
export interface CreateIssueOptions {
  name: string;
  description?: string;
  stateId?: string;
  assigneeIds?: string[];
  startDate?: string;
  targetDate?: string;
  priority?: string;
  labels?: string[];
  parentId?: string; // Pour les sous-tâches
}

// Options pour créer une sous-tâche
export interface CreateSubIssueOptions extends CreateIssueOptions {
  parentId: string; // Obligatoire pour les sous-tâches
}

