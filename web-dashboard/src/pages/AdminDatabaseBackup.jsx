import React, { useState, useEffect } from 'react';
import { 
  FiDatabase, FiDownload, FiUpload, FiRefreshCw, FiCheck, 
  FiAlertTriangle, FiClock, FiServer, FiHardDrive, FiInfo, FiTrash2,
  FiCalendar, FiSettings, FiPlay
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';

const AdminDatabaseBackup = () => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dbInfo, setDbInfo] = useState(null);
  const [exportProgress, setExportProgress] = useState(null);
  const [scheduledConfig, setScheduledConfig] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    enabled: false,
    intervalDays: 7,
    backupType: 'full',
    retentionCount: 3
  });

  // Charger les informations de la base de données
  useEffect(() => {
    fetchDatabaseInfo();
    fetchBackups();
    fetchScheduledConfig();
  }, []);

  const fetchDatabaseInfo = async () => {
    try {
      const response = await api.get('/admin/database/info');
      setDbInfo(response.data);
    } catch (error) {
      console.error('Erreur info DB:', error);
    }
  };

  const fetchBackups = async () => {
    try {
      const response = await api.get('/admin/database/backups');
      setBackups(response.data.backups || []);
    } catch (error) {
      toast.error('Erreur lors du chargement des sauvegardes');
    }
  };

  const fetchScheduledConfig = async () => {
    try {
      const response = await api.get('/admin/database/scheduled');
      if (response.data.success && response.data.config) {
        setScheduledConfig(response.data.config);
        setScheduleForm({
          enabled: response.data.config.enabled || false,
          intervalDays: response.data.config.intervalDays || 7,
          backupType: response.data.config.backupType || 'full',
          retentionCount: response.data.config.retentionCount || 3
        });
      }
    } catch (error) {
      console.error('Erreur chargement config planifiée:', error);
    }
  };

  const createBackup = async (type = 'full') => {
    setLoading(true);
    setExportProgress({ step: 'init', message: 'Initialisation de la sauvegarde...' });
    
    try {
      // Étape 1: Validation de la base
      setExportProgress({ step: 'validate', message: 'Validation de la structure de base...' });
      await api.post('/admin/database/validate');
      
      // Étape 2: Export des données
      setExportProgress({ step: 'export', message: 'Export des données en cours...' });
      const response = await api.post('/admin/database/backup', { 
        type,
        timestamp: true 
      });
      
      if (response.data.success) {
        const { filename, size } = response.data;
        setExportProgress({
          step: 'success',
          message: `Sauvegarde créée: ${filename}`,
          filename,
          size
        });

        // Étape 3: Téléchargement automatique local depuis le contenu de la réponse (pas de 2ème requête)
        setTimeout(() => {
          try {
            setExportProgress(prev => ({ ...prev, message: '📥 Téléchargement local en cours...' }));
            const sqlContent = response.data.content;
            if (sqlContent) {
              const blob = new Blob([sqlContent], { type: 'application/sql' });
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.setAttribute('download', filename);
              document.body.appendChild(link);
              link.click();
              link.remove();
              window.URL.revokeObjectURL(url);
              toast.success(`✅ Sauvegarde créée et téléchargée localement: ${filename}`);
            } else {
              toast.success(`✅ Sauvegarde créée: ${filename}`);
            }
            fetchBackups();
          } catch (error) {
            toast.warning(`⚠️ Sauvegarde créée mais téléchargement auto échoué: ${error.message}`);
            fetchBackups();
          }
          setExportProgress(null);
        }, 500);
      } else {
        throw new Error(response.data.message || 'Erreur lors de la sauvegarde');
      }
    } catch (error) {
      setExportProgress(null);
      toast.error(`❌ Erreur sauvegarde: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadBackup = async (filename) => {
    try {
      toast.info('📥 Téléchargement en cours...');
      
      const response = await api.get(`/admin/database/download/${filename}`, {
        responseType: 'blob'
      });
      
      // Créer un lien de téléchargement
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`✅ ${filename} téléchargé avec succès`);
    } catch (error) {
      toast.error(`❌ Erreur téléchargement: ${error.message}`);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.name.endsWith('.sql')) {
      setSelectedFile(file);
      toast.info(`📁 Fichier sélectionné: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    } else {
      toast.error('❌ Veuillez sélectionner un fichier .sql valide');
    }
  };

  const restoreBackup = async (filename = null, uploadedFile = null) => {
    if (!filename && !uploadedFile) {
      toast.error('❌ Aucun fichier de restauration sélectionné');
      return;
    }

    const confirmRestore = window.confirm(
      `⚠️ ATTENTION: Cette action va remplacer toutes les données actuelles.\n\n` +
      `Fichier: ${filename || uploadedFile.name}\n` +
      `Êtes-vous absolument sûr de vouloir continuer?`
    );

    if (!confirmRestore) return;

    setRestoring(true);
    
    try {
      let response;
      
      if (uploadedFile) {
        // Restauration depuis fichier uploadé
        const formData = new FormData();
        formData.append('backup', uploadedFile);
        
        toast.info('📤 Upload du fichier de restauration...');
        response = await api.post('/admin/database/restore/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        // Restauration depuis fichier local
        toast.info('🔄 Restauration en cours...');
        response = await api.post('/admin/database/restore', { filename });
      }
      
      if (response.data.success) {
        toast.success(`✅ Base de données restaurée avec succès!`);
        toast.info('🔄 Actualisation des données...');
        
        // Attendre un peu puis recharger les infos
        setTimeout(() => {
          fetchDatabaseInfo();
          fetchBackups();
        }, 3000);
        
        // Suggestion de redémarrage
        setTimeout(() => {
          if (window.confirm('🔄 Redémarrage recommandé pour appliquer tous les changements.\nRedémarrer maintenant?')) {
            window.location.reload();
          }
        }, 5000);
        
      } else {
        throw new Error(response.data.message || 'Erreur lors de la restauration');
      }
    } catch (error) {
      toast.error(`❌ Erreur restauration: ${error.response?.data?.message || error.message}`);
    } finally {
      setRestoring(false);
      setSelectedFile(null);
    }
  };

  const deleteBackup = async (filename) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement la sauvegarde "${filename}" ?\n\nCette action est irréversible.`)) {
      return;
    }

    try {
      await api.delete(`/admin/database/delete/${filename}`);
      toast.success('Sauvegarde supprimée avec succès');
      fetchBackups(); // Recharger la liste
    } catch (error) {
      console.error('Erreur suppression:', error);
      toast.error('Erreur lors de la suppression de la sauvegarde');
    }
  };

  const saveScheduledConfig = async () => {
    try {
      const response = await api.post('/admin/database/scheduled', scheduleForm);
      
      if (response.data.success) {
        toast.success('Configuration de sauvegarde planifiée enregistrée');
        setScheduledConfig(response.data.config);
        setShowScheduleModal(false);
        fetchScheduledConfig();
      }
    } catch (error) {
      toast.error(`Erreur: ${error.response?.data?.message || error.message}`);
    }
  };

  const runScheduledBackup = async () => {
    if (!window.confirm('Exécuter la sauvegarde planifiée maintenant ?')) {
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.post('/admin/database/run-scheduled');
      
      if (response.data.success) {
        toast.success(`Sauvegarde planifiée exécutée: ${response.data.filename}`);
        fetchBackups();
        fetchScheduledConfig();
      }
    } catch (error) {
      toast.error(`Erreur: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const cleanupOldBackups = async () => {
    const retentionCount = scheduleForm.retentionCount || 3;
    
    if (!window.confirm(`Nettoyer les sauvegardes en gardant uniquement les ${retentionCount} plus récentes ?\n\nLes anciennes sauvegardes seront supprimées définitivement.`)) {
      return;
    }
    
    try {
      const response = await api.post('/admin/database/cleanup', { retentionCount });
      
      if (response.data.success) {
        toast.success(response.data.message);
        fetchBackups();
      }
    } catch (error) {
      toast.error(`Erreur nettoyage: ${error.response?.data?.message || error.message}`);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-500 rounded-lg">
              <FiDatabase className="text-white text-2xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Sauvegarde & Restauration</h1>
              <p className="text-gray-600">Gestion des sauvegardes de base de données</p>
            </div>
          </div>

          {/* Informations base de données */}
          {dbInfo && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <FiInfo className="text-blue-500" />
                Informations Base de Données
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Type:</span>
                  <span className="ml-2 font-medium">{dbInfo.type}</span>
                </div>
                <div>
                  <span className="text-gray-600">Version:</span>
                  <span className="ml-2 font-medium">{dbInfo.version}</span>
                </div>
                <div>
                  <span className="text-gray-600">Taille:</span>
                  <span className="ml-2 font-medium">{formatFileSize(dbInfo.size)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Tables:</span>
                  <span className="ml-2 font-medium">{dbInfo.tables_count}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section Sauvegarde Planifiée */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <FiCalendar className="text-purple-500" />
              Sauvegarde Planifiée
            </h2>
            <button
              onClick={() => setShowScheduleModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
            >
              <FiSettings />
              Configurer
            </button>
          </div>

          {scheduledConfig && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">État</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    scheduledConfig.enabled 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {scheduledConfig.enabled ? '✓ Activée' : '✗ Désactivée'}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Intervalle:</span>
                    <span className="font-medium">{scheduledConfig.intervalDays} jours</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-medium capitalize">{scheduledConfig.backupType === 'full' ? 'Complète' : 'Structure'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Rétention:</span>
                    <span className="font-medium">{scheduledConfig.retentionCount} sauvegardes</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Planification</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Dernière exécution:</span>
                    <span className="font-medium">
                      {scheduledConfig.lastRunAt 
                        ? formatDate(scheduledConfig.lastRunAt)
                        : 'Jamais'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Prochaine exécution:</span>
                    <span className="font-medium">
                      {scheduledConfig.nextRunAt && scheduledConfig.enabled
                        ? formatDate(scheduledConfig.nextRunAt)
                        : '-'}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={runScheduledBackup}
                    disabled={!scheduledConfig.enabled || loading}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white text-sm rounded-lg transition-colors"
                  >
                    <FiPlay className="text-xs" />
                    Exécuter maintenant
                  </button>
                  <button
                    onClick={cleanupOldBackups}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg transition-colors"
                  >
                    <FiTrash2 className="text-xs" />
                    Nettoyer
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section Création de Sauvegarde */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FiDownload className="text-green-500" />
              Créer une Sauvegarde
            </h2>

            {exportProgress && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FiRefreshCw className={`text-blue-500 ${exportProgress.step !== 'success' ? 'animate-spin' : ''}`} />
                  <span className="font-medium text-blue-800">
                    {exportProgress.step === 'success' ? 'Terminé' : 'En cours...'}
                  </span>
                </div>
                <p className="text-blue-700 text-sm">{exportProgress.message}</p>
                {exportProgress.filename && (
                  <div className="mt-2 text-xs text-blue-600">
                    📁 {exportProgress.filename} ({formatFileSize(exportProgress.size || 0)})
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <button
                onClick={() => createBackup('full')}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
              >
                {loading ? (
                  <>
                    <FiRefreshCw className="animate-spin" />
                    Sauvegarde en cours...
                  </>
                ) : (
                  <>
                    <FiDatabase />
                    Sauvegarde Complète
                  </>
                )}
              </button>

              <button
                onClick={() => createBackup('structure')}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
              >
                <FiHardDrive />
                Structure Seulement
              </button>

              <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
                <p><strong>Sauvegarde Complète:</strong> Structure + Données + Index</p>
                <p><strong>Structure Seulement:</strong> Schéma de base sans données</p>
                <p>📅 Horodatage automatique dans le nom de fichier</p>
              </div>
            </div>
          </div>

          {/* Section Restauration */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FiUpload className="text-orange-500" />
              Restaurer une Sauvegarde
            </h2>

            <div className="space-y-4">
              {/* Upload fichier externe */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fichier de Sauvegarde Externe
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                  <input
                    type="file"
                    accept=".sql"
                    onChange={handleFileUpload}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {selectedFile && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                      <p className="text-green-800">
                        📁 {selectedFile.name} ({formatFileSize(selectedFile.size)})
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => restoreBackup(null, selectedFile)}
                disabled={!selectedFile || restoring}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
              >
                {restoring ? (
                  <>
                    <FiRefreshCw className="animate-spin" />
                    Restauration...
                  </>
                ) : (
                  <>
                    <FiUpload />
                    Restaurer Fichier Externe
                  </>
                )}
              </button>

              <div className="text-xs text-red-600 bg-red-50 p-3 rounded border border-red-200">
                <FiAlertTriangle className="inline mr-1" />
                <strong>ATTENTION:</strong> La restauration remplacera toutes les données actuelles.
                Créez une sauvegarde avant de restaurer.
              </div>
            </div>
          </div>
        </div>

        {/* Liste des Sauvegardes */}
        <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <FiClock className="text-purple-500" />
              Historique des Sauvegardes
            </h2>
            <button
              onClick={fetchBackups}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <FiRefreshCw />
              Actualiser
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Fichier</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Taille</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-gray-500">
                      Aucune sauvegarde trouvée
                    </td>
                  </tr>
                ) : (
                  backups.map((backup, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <FiDatabase className="text-blue-500" />
                          <span className="font-medium">{backup.filename}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {formatDate(backup.created_at)}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {formatFileSize(backup.size)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          backup.type === 'full' 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {backup.type === 'full' ? 'Complète' : 'Structure'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => downloadBackup(backup.filename)}
                            className="flex items-center gap-1 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg transition-colors"
                          >
                            <FiDownload />
                            Télécharger
                          </button>
                          <button
                            onClick={() => restoreBackup(backup.filename)}
                            disabled={restoring}
                            className="flex items-center gap-1 px-3 py-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white text-xs rounded-lg transition-colors"
                          >
                            <FiUpload />
                            Restaurer
                          </button>
                          <button
                            onClick={() => deleteBackup(backup.filename)}
                            disabled={restoring}
                            className="flex items-center gap-1 px-3 py-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white text-xs rounded-lg transition-colors"
                            title="Supprimer cette sauvegarde"
                          >
                            <FiTrash2 />
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Configuration Planifiée */}
        {showScheduleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <FiSettings className="text-purple-500" />
                  Configuration Planifiée
                </h3>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Activer/Désactiver */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <label className="font-medium text-gray-700">Activer la sauvegarde planifiée</label>
                  <button
                    onClick={() => setScheduleForm({ ...scheduleForm, enabled: !scheduleForm.enabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      scheduleForm.enabled ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        scheduleForm.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Intervalle */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Intervalle (jours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={scheduleForm.intervalDays}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, intervalDays: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Fréquence d'exécution automatique (1-365 jours)
                  </p>
                </div>

                {/* Type de sauvegarde */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type de sauvegarde
                  </label>
                  <select
                    value={scheduleForm.backupType}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, backupType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="full">Complète (données + structure)</option>
                    <option value="structure">Structure seulement</option>
                  </select>
                </div>

                {/* Nombre de sauvegardes à conserver */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre de sauvegardes à conserver
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={scheduleForm.retentionCount}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, retentionCount: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Les sauvegardes plus anciennes seront supprimées automatiquement (1-100)
                  </p>
                </div>

                {/* Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <FiInfo className="inline mr-1" />
                    Les sauvegardes planifiées s'exécutent automatiquement selon l'intervalle défini.
                    Seules les <strong>{scheduleForm.retentionCount}</strong> sauvegardes les plus récentes seront conservées.
                  </p>
                </div>

                {/* Boutons */}
                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => setShowScheduleModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={saveScheduledConfig}
                    className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDatabaseBackup;