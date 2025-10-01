import { useState } from 'react';
import { useLocalDataStore } from '../store/useLocalDataStore';
import { exportLocalData, importLocalData } from '../utils/dataMigration';
import { 
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  CircleStackIcon
} from '@heroicons/react/24/outline';

export default function DataManagement() {
  const { data } = useLocalDataStore();
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      await importLocalData(file);
      alert('Données importées avec succès !');
    } catch (error) {
      alert('Erreur lors de l\'importation des données');
      console.error(error);
    } finally {
      setIsImporting(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleExport = () => {
    exportLocalData();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Gestion des données
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Gérez le stockage local de vos données (équipes, modules, projets)
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center">
            <CircleStackIcon className="w-8 h-8 text-blue-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Équipes</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.teams.length}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <CircleStackIcon className="w-8 h-8 text-green-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Templates</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.moduleTemplates.length}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <CircleStackIcon className="w-8 h-8 text-purple-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Projets</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.projects.length}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <CircleStackIcon className="w-8 h-8 text-orange-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Dernière sync</p>
              <p className="text-sm text-gray-900 dark:text-white">
                {data.lastSync ? new Date(data.lastSync).toLocaleString() : 'Jamais'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Export des données
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Téléchargez toutes vos données locales dans un fichier JSON.
          </p>
          <button
            onClick={handleExport}
            className="btn-secondary flex items-center space-x-2"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            <span>Exporter les données</span>
          </button>
        </div>

        {/* Import */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Import des données
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Importez des données depuis un fichier JSON exporté.
          </p>
          <label className="btn-secondary flex items-center space-x-2 cursor-pointer">
            <ArrowUpTrayIcon className="w-5 h-5" />
            <span>{isImporting ? 'Importation...' : 'Importer des données'}</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              disabled={isImporting}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Backend Storage Info */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Stockage backend
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Les données sont automatiquement sauvegardées dans les fichiers JSON du répertoire <code>data/</code> 
          via le serveur backend Express.js. Chaque modification est immédiatement persistée.
        </p>
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">
            ✅ Stockage automatique activé
          </h4>
          <p className="text-sm text-green-800 dark:text-green-200">
            Toutes vos données (équipes, templates, projets) sont automatiquement sauvegardées 
            dans les fichiers JSON du serveur backend. Aucune action manuelle requise.
          </p>
        </div>
      </div>
    </div>
  );
}
