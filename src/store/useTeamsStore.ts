import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Team, TeamType } from '../types';

interface TeamsStore {
  teams: Team[];
  addTeam: (team: Omit<Team, 'id'>) => void;
  updateTeam: (id: string, updates: Partial<Team>) => void;
  deleteTeam: (id: string) => void;
  resetTeams: () => void;
  validateTrigramme: (trigramme: string, excludeId?: string) => boolean;
  generateTrigramme: (name: string) => string;
}

const DEFAULT_TEAMS: Team[] = [
  {
    id: 'infrastructure',
    name: 'Infrastructure',
    description: 'Gestion des infrastructures IT, serveurs, réseaux et équipements',
    color: '#579bfc',
    icon: '🏗️',
    trigramme: 'INF'
  },
  {
    id: 'cybersecurite',
    name: 'Cybersécurité',
    description: 'Sécurité informatique, protection des données et conformité',
    color: '#e2445c',
    icon: '🔒',
    trigramme: 'CYS'
  },
  {
    id: 'telecom',
    name: 'Télécom',
    description: 'Télécommunications, connectivité et services de communication',
    color: '#00c875',
    icon: '📡',
    trigramme: 'TEL'
  },
  {
    id: 'cloud',
    name: 'Cloud',
    description: 'Services cloud, virtualisation et solutions hébergées',
    color: '#784bd1',
    icon: '☁️',
    trigramme: 'CLD'
  },
  {
    id: 'infogerance',
    name: 'Infogérance',
    description: 'Gestion et maintenance des systèmes informatiques',
    color: '#ff642e',
    icon: '⚙️',
    trigramme: 'IFG'
  },
  {
    id: 'conformite-qualite',
    name: 'Conformité & Qualité',
    description: 'Conformité réglementaire, normes et assurance qualité',
    color: '#9c27b0',
    icon: '📋',
    trigramme: 'CQ'
  },
  {
    id: 'gouvernance',
    name: 'Gouvernance',
    description: 'Gouvernance IT, stratégie et pilotage des projets',
    color: '#607d8b',
    icon: '🎯',
    trigramme: 'GOV'
  }
];

export const useTeamsStore = create<TeamsStore>()(
  persist(
    (set, get) => ({
      teams: DEFAULT_TEAMS,

      addTeam: (team) => {
        const newTeam: Team = {
          ...team,
          id: `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
        set((state) => ({
          teams: [...state.teams, newTeam],
        }));
      },

      updateTeam: (id, updates) => {
        set((state) => ({
          teams: state.teams.map((team) =>
            team.id === id ? { ...team, ...updates } : team
          ),
        }));
      },

      deleteTeam: (id) => {
        set((state) => ({
          teams: state.teams.filter((team) => team.id !== id),
        }));
      },

      resetTeams: () => {
        set({ teams: DEFAULT_TEAMS });
      },

      validateTrigramme: (trigramme: string, excludeId?: string) => {
        const state = get();
        // Vérifier que le trigramme fait exactement 3 caractères et contient seulement des lettres
        if (!/^[A-Z]{3}$/.test(trigramme)) {
          return false;
        }
        // Vérifier l'unicité
        return !state.teams.some(team => 
          team.trigramme === trigramme && team.id !== excludeId
        );
      },

      generateTrigramme: (name: string) => {
        // Nettoyer le nom et prendre les 3 premières lettres
        const cleanName = name
          .replace(/[^a-zA-ZÀ-ÿ\s]/g, '') // Garder seulement les lettres et espaces
          .replace(/\s+/g, ' ') // Normaliser les espaces
          .trim();
        
        const words = cleanName.split(' ');
        let trigramme = '';
        
        if (words.length === 1) {
          // Un seul mot : prendre les 3 premières lettres
          trigramme = words[0].substring(0, 3).toUpperCase();
        } else if (words.length === 2) {
          // Deux mots : première lettre de chaque + première lettre du premier mot
          trigramme = (words[0][0] + words[1][0] + words[0][1] || words[0][0]).toUpperCase();
        } else {
          // Plus de deux mots : première lettre de chaque mot
          trigramme = words.slice(0, 3).map(word => word[0]).join('').toUpperCase();
        }
        
        // S'assurer que le trigramme fait exactement 3 caractères
        if (trigramme.length < 3) {
          trigramme = trigramme.padEnd(3, 'X');
        }
        
        return trigramme;
      }
    }),
    {
      name: 'teams-storage',
      storage: {
        getItem: (name) => localStorage.getItem(name),
        setItem: (name, value) => localStorage.setItem(name, value),
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
