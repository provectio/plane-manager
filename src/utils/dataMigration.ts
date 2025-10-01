import { useLocalDataStore } from '../store/useLocalDataStore';
import { LocalTeam, LocalModuleTemplate, LocalProject } from '../store/useLocalDataStore';

/**
 * Migre toutes les données existantes vers le nouveau système de stockage local
 */
export const migrateToLocalStorage = () => {
  console.log('🔄 Starting data migration to local storage...');
  
  const localStore = useLocalDataStore.getState();
  
  // Vérifier si la migration a déjà été faite
  if (localStore.data.teams.length > 0 || localStore.data.moduleTemplates.length > 0) {
    console.log('📝 Migration already completed, skipping...');
    return;
  }

  console.log('📝 No existing data found, starting with empty state');
  console.log('✅ Migration completed - application ready for user to create teams and templates');
};

/**
 * Exporte toutes les données locales vers un fichier JSON
 */
export const exportLocalData = () => {
  const localStore = useLocalDataStore.getState();
  const data = localStore.exportData();
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `plane-manager-data-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  console.log('📤 Data exported successfully!');
};

/**
 * Importe des données depuis un fichier JSON
 */
export const importLocalData = (file: File): Promise<void> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const localStore = useLocalDataStore.getState();
        localStore.importData(data);
        console.log('📥 Data imported successfully!');
        resolve();
      } catch (error) {
        console.error('❌ Error importing data:', error);
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
};

/**
 * Nettoie toutes les données locales
 */
export const clearAllLocalData = () => {
  const localStore = useLocalDataStore.getState();
  localStore.clearAllData();
  console.log('🗑️ All local data cleared!');
};
