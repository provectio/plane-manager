// Debug utility to inspect localStorage data
export const debugLocalStorage = () => {
  console.log('🔍 === LOCAL STORAGE DEBUG ===');
  
  // Check all localStorage keys
  const allKeys = Object.keys(localStorage);
  console.log('📋 All localStorage keys:', allKeys);
  
  // Check main data storage
  const localDataStorage = localStorage.getItem('local-data-storage');
  console.log('📦 local-data-storage:', localDataStorage ? (typeof localDataStorage === 'string' ? JSON.parse(localDataStorage) : localDataStorage) : 'null');
  
  // Check module templates storage
  const moduleTemplatesStorage = localStorage.getItem('module-templates-storage');
  console.log('📦 module-templates-storage:', moduleTemplatesStorage ? (typeof moduleTemplatesStorage === 'string' ? JSON.parse(moduleTemplatesStorage) : moduleTemplatesStorage) : 'null');
  
  // Check teams storage
  const teamsStorage = localStorage.getItem('teams-storage');
  console.log('📦 teams-storage:', teamsStorage ? (typeof teamsStorage === 'string' ? JSON.parse(teamsStorage) : teamsStorage) : 'null');
  
  // Check other possible keys
  allKeys.forEach(key => {
    if (!['local-data-storage', 'module-templates-storage', 'teams-storage'].includes(key)) {
      const value = localStorage.getItem(key);
      console.log(`📦 ${key}:`, value ? (typeof value === 'string' ? JSON.parse(value) : value) : 'null');
    }
  });
  
  console.log('🔍 === END DEBUG ===');
};

// Function to clear all data and start fresh
export const clearAllData = () => {
  console.log('🗑️ Clearing all localStorage data...');
  
  // Clear all relevant keys
  localStorage.removeItem('local-data-storage');
  localStorage.removeItem('module-templates-storage');
  localStorage.removeItem('teams-storage');
  
  // Clear Monday.com and Snaic related keys
  localStorage.removeItem('monday-app-storage');
  localStorage.removeItem('snaic-theme');
  localStorage.removeItem('plane-app-storage');
  
  // Clear any other keys that might exist
  Object.keys(localStorage).forEach(key => {
    if (key.includes('storage') || key.includes('data') || key.includes('monday') || key.includes('snaic')) {
      localStorage.removeItem(key);
    }
  });
  
  console.log('✅ All data cleared');
  console.log('🔄 Please refresh the page to start fresh');
};

// Function to clean up Monday.com and Snaic data only
export const cleanupUnwantedData = () => {
  console.log('🧹 Cleaning up Monday.com and Snaic data...');
  
  // Clear Monday.com and Snaic related keys
  localStorage.removeItem('monday-app-storage');
  localStorage.removeItem('snaic-theme');
  localStorage.removeItem('plane-app-storage');
  
  // Clear any other unwanted keys
  Object.keys(localStorage).forEach(key => {
    if (key.includes('monday') || key.includes('snaic')) {
      localStorage.removeItem(key);
      console.log(`🗑️ Removed: ${key}`);
    }
  });
  
  console.log('✅ Cleanup completed - only Plane.so data remains');
};

// Function to clean up duplicate storage keys
export const cleanupDuplicateStorage = () => {
  console.log('🧹 Cleaning up duplicate storage keys...');
  
  // Keep only local-data-storage, remove duplicates
  localStorage.removeItem('teams-storage');
  localStorage.removeItem('module-templates-storage');
  
  console.log('✅ Duplicate storage cleaned - only local-data-storage remains');
};

// Function to export current data
export const exportCurrentData = () => {
  const data = {
    'local-data-storage': localStorage.getItem('local-data-storage'),
    'module-templates-storage': localStorage.getItem('module-templates-storage'),
    'teams-storage': localStorage.getItem('teams-storage')
  };
  
  console.log('📤 Current data export:', data);
  
  // Create downloadable file
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `plane-manager-data-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  console.log('✅ Data exported to file');
};

// Make functions available globally for console access
if (typeof window !== 'undefined') {
  (window as any).debugLocalStorage = debugLocalStorage;
  (window as any).clearAllData = clearAllData;
  (window as any).cleanupUnwantedData = cleanupUnwantedData;
  (window as any).cleanupDuplicateStorage = cleanupDuplicateStorage;
  (window as any).exportCurrentData = exportCurrentData;
}
