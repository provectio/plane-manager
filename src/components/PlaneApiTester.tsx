import React, { useState } from 'react';
import { planeApi } from '../services/planeApi';
import { PlaneState, PlaneUser, PlanePriority, PlaneLabel, PlaneIssue } from '../types';

interface PlaneApiTesterProps {
  projectId: string;
}

export const PlaneApiTester: React.FC<PlaneApiTesterProps> = ({ projectId }) => {
  const [states, setStates] = useState<PlaneState[]>([]);
  const [users, setUsers] = useState<PlaneUser[]>([]);
  const [priorities, setPriorities] = useState<PlanePriority[]>([]);
  const [labels, setLabels] = useState<PlaneLabel[]>([]);
  const [issues, setIssues] = useState<PlaneIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTestStates = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await planeApi.getProjectStates(projectId);
      setStates(result);
      console.log('✅ States récupérés:', result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      console.error('❌ Erreur lors de la récupération des states:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await planeApi.getWorkspaceUsers();
      setUsers(result);
      console.log('✅ Utilisateurs récupérés:', result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      console.error('❌ Erreur lors de la récupération des utilisateurs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestPriorities = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await planeApi.getProjectPriorities(projectId);
      setPriorities(result);
      console.log('✅ Priorités récupérées:', result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      console.error('❌ Erreur lors de la récupération des priorités:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestLabels = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await planeApi.getLabels(projectId);
      setLabels(result);
      console.log('✅ Labels récupérés:', result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      console.error('❌ Erreur lors de la récupération des labels:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestIssues = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await planeApi.getProjectIssues(projectId);
      setIssues(result);
      console.log('✅ Issues récupérées:', result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      console.error('❌ Erreur lors de la récupération des issues:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestCompleteSync = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await planeApi.syncProjectComplete(projectId);
      console.log('✅ Synchronisation complète réussie:', result);
      
      // Mettre à jour tous les états
      setStates(result.states || []);
      setUsers(result.users || []);
      setPriorities(result.priorities || []);
      setLabels(result.labels || []);
      setIssues(result.issues || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      console.error('❌ Erreur lors de la synchronisation complète:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTestIssue = async () => {
    if (!states.length) {
      setError('Aucun state disponible. Récupérez d\'abord les states.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const firstState = states[0];
      const result = await planeApi.createCompleteIssue(
        projectId,
        'Test Issue - ' + new Date().toLocaleTimeString(),
        'Issue de test créée via l\'API améliorée',
        firstState.id,
        users.length > 0 ? [users[0].id] : undefined,
        undefined, // startDate
        undefined, // targetDate
        'medium', // priority
        labels.length > 0 ? [labels[0].id] : undefined
      );
      console.log('✅ Issue de test créée:', result);
      
      // Recharger les issues
      await handleTestIssues();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      console.error('❌ Erreur lors de la création de l\'issue de test:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        🧪 Testeur API Plane.so Améliorée
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <button
          onClick={handleTestStates}
          disabled={loading}
          className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 text-sm"
        >
          {loading ? '⏳' : '🔍'} States
        </button>
        
        <button
          onClick={handleTestUsers}
          disabled={loading}
          className="px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 text-sm"
        >
          {loading ? '⏳' : '👥'} Utilisateurs
        </button>
        
        <button
          onClick={handleTestPriorities}
          disabled={loading}
          className="px-3 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 disabled:opacity-50 text-sm"
        >
          {loading ? '⏳' : '⚡'} Priorités
        </button>
        
        <button
          onClick={handleTestLabels}
          disabled={loading}
          className="px-3 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 disabled:opacity-50 text-sm"
        >
          {loading ? '⏳' : '🏷️'} Labels
        </button>
        
        <button
          onClick={handleTestIssues}
          disabled={loading}
          className="px-3 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 disabled:opacity-50 text-sm"
        >
          {loading ? '⏳' : '📋'} Issues
        </button>
        
        <button
          onClick={handleTestCompleteSync}
          disabled={loading}
          className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:opacity-50 text-sm"
        >
          {loading ? '⏳' : '🔄'} Sync Complète
        </button>
      </div>

      <div className="mb-4">
        <button
          onClick={handleCreateTestIssue}
          disabled={loading || !states.length}
          className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50"
        >
          {loading ? '⏳' : '➕'} Créer Issue Test
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-md">
          <p className="text-red-700 dark:text-red-300 text-sm">❌ {error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* States */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
            States ({states.length})
          </h4>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {states.map((state) => (
              <div key={state.id} className="flex items-center space-x-2 text-sm">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: state.color }}
                />
                <span className="text-gray-700 dark:text-gray-300">{state.name}</span>
                <span className="text-gray-500 text-xs">({state.id.slice(0, 8)}...)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Users */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
            Utilisateurs ({users.length})
          </h4>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {users.map((user) => (
              <div key={user.id} className="text-sm">
                <span className="text-gray-700 dark:text-gray-300">
                  {user.display_name || user.email}
                </span>
                <span className="text-gray-500 text-xs ml-2">({user.id.slice(0, 8)}...)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Priorities */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
            Priorités ({priorities.length})
          </h4>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {priorities.map((priority) => (
              <div key={priority.id} className="flex items-center space-x-2 text-sm">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: priority.color }}
                />
                <span className="text-gray-700 dark:text-gray-300">{priority.name}</span>
                <span className="text-gray-500 text-xs">({priority.id.slice(0, 8)}...)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Labels */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
            Labels ({labels.length})
          </h4>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {labels.map((label) => (
              <div key={label.id} className="flex items-center space-x-2 text-sm">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: label.color }}
                />
                <span className="text-gray-700 dark:text-gray-300">{label.name}</span>
                <span className="text-gray-500 text-xs">({label.id.slice(0, 8)}...)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Issues */}
      <div className="mt-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-2">
          Issues ({issues.length})
        </h4>
        <div className="max-h-40 overflow-y-auto space-y-1">
          {issues.slice(0, 10).map((issue) => (
            <div key={issue.id} className="text-sm p-2 bg-gray-50 dark:bg-gray-700 rounded">
              <div className="flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-300 font-medium">
                  {issue.name}
                </span>
                <span className="text-gray-500 text-xs">
                  {issue.priority} | {issue.state ? issue.state.slice(0, 8) + '...' : 'No state'}
                </span>
              </div>
              {issue.assignees.length > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  Assignés: {issue.assignees.length}
                </div>
              )}
            </div>
          ))}
          {issues.length > 10 && (
            <div className="text-xs text-gray-500 text-center py-2">
              ... et {issues.length - 10} autres issues
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
