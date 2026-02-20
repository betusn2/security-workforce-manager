import React, { useState, useEffect } from 'react';
import {
  FiActivity, FiTrash2, FiDownload, FiFilter, FiRefreshCw,
  FiAlertCircle, FiCheckCircle, FiClock, FiUser, FiDatabase,
  FiPlus, FiEdit2, FiX, FiLogIn, FiLogOut, FiMapPin, FiShield,
  FiChevronDown, FiChevronRight
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';

const AdminLogs = () => {
  const [activeTab, setActiveTab] = useState('logs'); // logs, stats
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [actionTypes, setActionTypes] = useState({ actions: [], entityTypes: [] });
  
  // Filtres
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    action: '',
    entityType: '',
    status: '',
    userId: '',
    startDate: '',
    endDate: '',
    search: ''
  });

  // Formulaire de purge
  const [purgeForm, setPurgeForm] = useState({
    beforeDate: '',
    action: '',
    entityType: '',
    status: ''
  });

  useEffect(() => {
    loadActionTypes();
    loadStats();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs();
    }
  }, [activeTab, filters]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key]) params.append(key, filters[key]);
      });

      const response = await api.get(`/audit?${params}`);
      setLogs(response.data.data.logs);
      setPagination(response.data.data.pagination);
    } catch (error) {
      toast.error('Erreur de chargement des logs');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/audit/stats');
      setStats(response.data.data);
    } catch (error) {
      toast.error('Erreur de chargement des statistiques');
    }
  };

  const loadActionTypes = async () => {
    try {
      const response = await api.get('/audit/types');
      setActionTypes(response.data.data);
    } catch (error) {
      console.error('Error loading types:', error);
    }
  };

  const handlePurge = async (e) => {
    e.preventDefault();

    if (!purgeForm.beforeDate) {
      toast.error('La date de purge est requise');
      return;
    }

    const confirmMsg = `Êtes-vous sûr de vouloir supprimer tous les logs avant le ${new Date(purgeForm.beforeDate).toLocaleDateString('fr-FR')} ?`;
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const response = await api.post('/audit/purge', purgeForm);
      toast.success(response.data.message);
      setPurgeForm({ beforeDate: '', action: '', entityType: '', status: '' });
      loadLogs();
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur de purge');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key] && key !== 'page' && key !== 'limit') {
          params.append(key, filters[key]);
        }
      });

      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_URL}/audit/export?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors de l\'export');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Export terminé');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Erreur lors de l\'export');
    }
  };

  const [expandedRows, setExpandedRows] = useState({});
  const toggleRow = (id) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

  const getStatusColor = (status) => {
    const colors = {
      success: 'bg-green-100 text-green-800',
      failure: 'bg-red-100 text-red-800',
      warning: 'bg-yellow-100 text-yellow-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status) => {
    const icons = {
      success: <FiCheckCircle className="text-green-600" />,
      failure: <FiAlertCircle className="text-red-600" />,
      warning: <FiAlertCircle className="text-yellow-600" />
    };
    return icons[status] || <FiActivity />;
  };

  const getActionBadge = (action) => {
    const cfg = {
      CREATE:    { color: 'bg-green-100 text-green-800 border border-green-200',  icon: <FiPlus size={11}/>,    label: 'Création' },
      UPDATE:    { color: 'bg-blue-100 text-blue-800 border border-blue-200',     icon: <FiEdit2 size={11}/>,   label: 'Modif.' },
      DELETE:    { color: 'bg-red-100 text-red-800 border border-red-200',        icon: <FiX size={11}/>,       label: 'Suppression' },
      LOGIN:     { color: 'bg-purple-100 text-purple-800 border border-purple-200', icon: <FiLogIn size={11}/>, label: 'Connexion' },
      LOGOUT:    { color: 'bg-gray-100 text-gray-700 border border-gray-200',     icon: <FiLogOut size={11}/>,  label: 'Déco.' },
      REGISTER:  { color: 'bg-teal-100 text-teal-800 border border-teal-200',     icon: <FiUser size={11}/>,    label: 'Inscription' },
      CHECK_IN:  { color: 'bg-emerald-100 text-emerald-800 border border-emerald-200', icon: <FiCheckCircle size={11}/>, label: 'Check-in' },
      CHECK_OUT: { color: 'bg-orange-100 text-orange-800 border border-orange-200', icon: <FiLogOut size={11}/>, label: 'Check-out' },
      SOS_ALERT: { color: 'bg-red-200 text-red-900 border border-red-400 font-bold', icon: '🆘',                label: 'SOS' },
      INCIDENT_REPORTED: { color: 'bg-yellow-100 text-yellow-800 border border-yellow-200', icon: '⚠️', label: 'Incident' },
      INCIDENT_DELETED:  { color: 'bg-red-100 text-red-700 border border-red-200', icon: <FiTrash2 size={11}/>, label: 'Incident Suppr.' },
    };
    const c = cfg[action] || { color: 'bg-gray-100 text-gray-600 border border-gray-200', icon: <FiActivity size={11}/>, label: action };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>
        {c.icon} {c.label}
      </span>
    );
  };

  const getEntityBadge = (entityType) => {
    const cfg = {
      user:         { color: 'bg-indigo-50 text-indigo-700', icon: '👤' },
      event:        { color: 'bg-blue-50 text-blue-700',    icon: '📅' },
      assignment:   { color: 'bg-cyan-50 text-cyan-700',    icon: '📋' },
      attendance:   { color: 'bg-green-50 text-green-700',  icon: '✅' },
      incident:     { color: 'bg-red-50 text-red-700',      icon: '🚨' },
      zone:         { color: 'bg-yellow-50 text-yellow-700',icon: '📍' },
      auth:         { color: 'bg-purple-50 text-purple-700',icon: '🔐' },
      sos:          { color: 'bg-red-100 text-red-800',     icon: '🆘' },
      badge:        { color: 'bg-amber-50 text-amber-700',  icon: '🏅' },
      report:       { color: 'bg-gray-50 text-gray-700',    icon: '📊' },
      tracking:     { color: 'bg-teal-50 text-teal-700',   icon: '📡' },
    };
    const c = cfg[entityType] || { color: 'bg-gray-50 text-gray-600', icon: '⚙️' };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${c.color}`}>
        {c.icon} {entityType}
      </span>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <FiActivity className="text-3xl text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Logs & Audit Trail</h1>
        </div>
        <p className="text-gray-600">
          Historique complet des actions et événements du système
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-3 px-2 border-b-2 font-medium transition-colors ${
              activeTab === 'logs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <FiDatabase />
              Logs
            </div>
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`pb-3 px-2 border-b-2 font-medium transition-colors ${
              activeTab === 'stats'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <FiActivity />
              Statistiques
            </div>
          </button>
        </nav>
      </div>

      {/* Stats Tab */}
      {activeTab === 'stats' && stats && (
        <div className="space-y-6">
          {/* Cartes de statistiques */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Logs</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total.toLocaleString()}</p>
                </div>
                <FiDatabase className="text-3xl text-blue-600" />
              </div>
            </div>

            {stats.byStatus.map(stat => (
              <div key={stat.status} className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 capitalize">{stat.status}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.count}</p>
                  </div>
                  {getStatusIcon(stat.status)}
                </div>
              </div>
            ))}
          </div>

          {/* Top Actions */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4">Actions les plus fréquentes</h3>
            <div className="space-y-3">
              {stats.byAction.map((action, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{action.action}</span>
                  <span className="text-sm text-gray-500">{action.count} fois</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Users */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4">Utilisateurs les plus actifs</h3>
            <div className="space-y-3">
              {stats.topUsers.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FiUser className="text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">
                      {item.user ? `${item.user.firstName} ${item.user.lastName}` : 'Système'}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">{item.count} actions</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          {/* Filtres et Actions */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
              <input
                type="text"
                placeholder="Rechercher..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              
              <select
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Toutes les actions</option>
                {actionTypes.actions.map(action => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>

              <select
                value={filters.entityType}
                onChange={(e) => setFilters({ ...filters, entityType: e.target.value, page: 1 })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Tous les types</option>
                {actionTypes.entityTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>

              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Tous les statuts</option>
                <option value="success">Succès</option>
                <option value="failure">Échec</option>
                <option value="warning">Avertissement</option>
              </select>

              <div className="flex gap-2">
                <button
                  onClick={loadLogs}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm"
                >
                  <FiRefreshCw /> Actualiser
                </button>
                <button
                  onClick={handleExport}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm"
                >
                  <FiDownload /> Export
                </button>
              </div>
            </div>

            {/* Filtres par date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Date début</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value, page: 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Date fin</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value, page: 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          {/* Formulaire de purge */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-red-900 mb-3 flex items-center gap-2">
              <FiTrash2 /> Purge des logs
            </h3>
            <form onSubmit={handlePurge} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-red-900 mb-1">Supprimer avant le *</label>
                  <input
                    type="date"
                    value={purgeForm.beforeDate}
                    onChange={(e) => setPurgeForm({ ...purgeForm, beforeDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm"
                  />
                </div>
                <select
                  value={purgeForm.action}
                  onChange={(e) => setPurgeForm({ ...purgeForm, action: e.target.value })}
                  className="px-3 py-2 border border-red-300 rounded-lg text-sm"
                >
                  <option value="">Toutes les actions</option>
                  {actionTypes.actions.map(action => (
                    <option key={action} value={action}>{action}</option>
                  ))}
                </select>
                <select
                  value={purgeForm.entityType}
                  onChange={(e) => setPurgeForm({ ...purgeForm, entityType: e.target.value })}
                  className="px-3 py-2 border border-red-300 rounded-lg text-sm"
                >
                  <option value="">Tous les types</option>
                  {actionTypes.entityTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <FiTrash2 /> Purger
                </button>
              </div>
              <p className="text-xs text-red-700">
                ⚠️ Cette action est irréversible. Les logs supprimés ne pourront pas être récupérés.
              </p>
            </form>
          </div>

          {/* Table des logs */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilisateur</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entité</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description / Détails</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                        Chargement...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                        Aucun log trouvé
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <React.Fragment key={log.id}>
                        <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleRow(log.id)}>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <FiClock className="text-gray-400" size={12} />
                              <div>
                                <div className="font-medium text-gray-800">{new Date(log.createdAt).toLocaleDateString('fr-FR')}</div>
                                <div>{new Date(log.createdAt).toLocaleTimeString('fr-FR')}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {log.user ? (
                              <div>
                                <div className="font-medium text-gray-900">{log.user.firstName} {log.user.lastName}</div>
                                <div className="text-xs text-gray-400">{log.user.role}</div>
                              </div>
                            ) : <span className="text-gray-400 text-xs">Système</span>}
                          </td>
                          <td className="px-4 py-3">{getActionBadge(log.action)}</td>
                          <td className="px-4 py-3">{getEntityBadge(log.entityType)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(log.status)}`}>
                              {getStatusIcon(log.status)}
                              {log.status === 'success' ? 'OK' : log.status === 'failure' ? 'Échec' : log.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 font-mono">{log.ipAddress || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              {log.newValues && (
                                expandedRows[log.id] ? <FiChevronDown size={14} className="text-gray-400 flex-shrink-0" /> : <FiChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                              )}
                              <span className="truncate max-w-xs">{log.description || '-'}</span>
                            </div>
                          </td>
                        </tr>
                        {expandedRows[log.id] && log.newValues && (
                          <tr className="bg-blue-50">
                            <td colSpan="7" className="px-8 py-3">
                              <div className="text-xs font-medium text-blue-700 mb-2">Données modifiées :</div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {Object.entries(typeof log.newValues === 'string' ? JSON.parse(log.newValues) : log.newValues)
                                  .filter(([k]) => !['password','token','refreshToken'].includes(k))
                                  .map(([k, v]) => (
                                    <div key={k} className="bg-white rounded p-2 border border-blue-100">
                                      <div className="text-xs text-gray-400 uppercase">{k}</div>
                                      <div className="text-xs text-gray-800 font-medium truncate">{String(v ?? '-')}</div>
                                    </div>
                                  ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Page {pagination.page} sur {pagination.totalPages} ({pagination.total} logs)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                    disabled={filters.page === 1}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Précédent
                  </button>
                  <button
                    onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                    disabled={filters.page >= pagination.totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLogs;
