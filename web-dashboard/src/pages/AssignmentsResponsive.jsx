import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiPlus, FiSearch, FiUser, FiCalendar, FiMapPin, FiFilter,
  FiGrid, FiList, FiUserCheck, FiShield, FiChevronDown,
  FiCheck, FiX, FiAlertCircle, FiRefreshCw, FiEye
} from 'react-icons/fi';
import { assignmentsAPI, eventsAPI, usersAPI } from '../services/api';
import { toast } from 'react-toastify';
import {format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import useAuthStore from '../hooks/useAuth';

// 🎨 Composants réutilisables
const StatusBadge = ({ status }) => {
  const variants = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-700'
  };
  const labels = {
    pending: 'En attente',
    confirmed: 'Confirmé',
    declined: 'Refusé',
    cancelled: 'Annulé'
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[status] || variants.pending}`}>
      {labels[status] || status}
    </span>
  );
};

const RoleBadge = ({ role }) => {
  const variants = {
    agent: 'bg-blue-100 text-blue-700',
    supervisor: 'bg-orange-100 text-orange-700',
    primary: 'bg-blue-100 text-blue-700',
    backup: 'bg-purple-100 text-purple-700'
  };
  const labels = {
    agent: 'Agent',
    supervisor: 'Responsable',
    primary: 'Agent',
    backup: 'Remplaçant'
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[role] || variants.agent}`}>
      {role === 'supervisor' ? <FiShield size={10} className="mr-1" /> : <FiUser size={10} className="mr-1" />}
      {labels[role] || role}
    </span>
  );
};

// 📱 Card pour mobile
const AssignmentCard = ({ assignment, onViewDetails, onConfirm, onDecline, onRemove }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
    {/* Header */}
    <div className="p-4 bg-gradient-to-r from-primary-50 to-primary-100 border-b border-primary-200">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{assignment.event?.name || 'Événement'}</h3>
          <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
            <FiCalendar size={10} />
            {assignment.event?.startTime ? format(parseISO(assignment.event.startTime), 'dd MMM yyyy', { locale: fr }) : 'N/A'}
          </p>
        </div>
        <StatusBadge status={assignment.status} />
      </div>
    </div>

    {/* Body */}
    <div className="p-4 space-y-3">
      {/* Agent */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
          {assignment.agent?.firstName?.[0]}{assignment.agent?.lastName?.[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm truncate">
            {assignment.agent?.firstName} {assignment.agent?.lastName}
          </p>
          <p className="text-xs text-gray-500 truncate">{assignment.agent?.employeeId}</p>
        </div>
        <RoleBadge role={assignment.role} />
      </div>

      {/* Zone */}
      {assignment.zone && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <FiMapPin size={14} className="text-gray-400" />
          <span className="truncate">{assignment.zone.name}</span>
        </div>
      )}
    </div>

    {/* Actions */}
    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
      <button
        onClick={() => onViewDetails(assignment)}
        className="flex-1 px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors flex items-center justify-center gap-1.5"
      >
        <FiEye size={14} />
        <span className="hidden sm:inline">Détails</span>
      </button>
      
      {assignment.status === 'pending' && (
        <>
          <button
            onClick={() => onConfirm(assignment.id)}
            className="px-3 py-2 text-sm font-medium text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            title="Confirmer"
          >
            <FiCheck size={16} />
          </button>
          <button
            onClick={() => onDecline(assignment.id)}
            className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Refuser"
          >
            <FiX size={16} />
          </button>
        </>
      )}
      
      <button
        onClick={() => onRemove(assignment.id)}
        className="px-3 py-2 text-sm font-medium text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        title="Retirer"
      >
        <FiX size={16} />
      </button>
    </div>
  </div>
);

// 🖥️ Row pour desktop
const AssignmentRow = ({ assignment, onViewDetails, onConfirm, onDecline, onRemove }) => (
  <tr className="hover:bg-gray-50 transition-colors">
    {/* Event */}
    <td className="px-6 py-4">
      <div>
        <p className="font-medium text-gray-900 text-sm">{assignment.event?.name || 'N/A'}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {assignment.event?.startTime ? format(parseISO(assignment.event.startTime), 'dd MMM yyyy', { locale: fr }) : 'N/A'}
        </p>
      </div>
    </td>

    {/* Agent */}
    <td className="px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold shadow-sm">
          {assignment.agent?.firstName?.[0]}{assignment.agent?.lastName?.[0]}
        </div>
        <div>
          <p className="font-medium text-gray-900 text-sm">
            {assignment.agent?.firstName} {assignment.agent?.lastName}
          </p>
          <p className="text-xs text-gray-500">{assignment.agent?.employeeId}</p>
        </div>
      </div>
    </td>

    {/* Zone */}
    <td className="px-6 py-4">
      {assignment.zone ? (
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: assignment.zone.color || '#3B82F6' }}
          />
          <span className="text-sm text-gray-700">{assignment.zone.name}</span>
        </div>
      ) : (
        <span className="text-xs text-gray-400 italic">Non assigné</span>
      )}
    </td>

    {/* Role */}
    <td className="px-6 py-4">
      <RoleBadge role={assignment.role} />
    </td>

    {/* Status */}
    <td className="px-6 py-4">
      <StatusBadge status={assignment.status} />
    </td>

    {/* Actions */}
    <td className="px-6 py-4">
      <div className="flex items-center justify-end gap-1">
        <button
          onClick={() => onViewDetails(assignment)}
          className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          title="Voir détails"
        >
          <FiEye size={16} />
        </button>
        
        {assignment.status === 'pending' && (
          <>
            <button
              onClick={() => onConfirm(assignment.id)}
              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Confirmer"
            >
              <FiCheck size={16} />
            </button>
            <button
              onClick={() => onDecline(assignment.id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Refuser"
            >
              <FiX size={16} />
            </button>
          </>
        )}
        
        <button
          onClick={() => onRemove(assignment.id)}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Retirer"
        >
          <FiX size={16} />
        </button>
      </div>
    </td>
  </tr>
);

// 🎯 Composant principal
const AssignmentsResponsive = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // États
  const [assignments, setAssignments] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' ou 'list'
  
  // Filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');

  // Charger les données
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [assignmentsRes, eventsRes] = await Promise.all([
        assignmentsAPI.getAll(),
        eventsAPI.getAll()
      ]);
      
      setAssignments(assignmentsRes.data.data || []);
      setEvents(eventsRes.data.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // Actions
  const handleConfirm = async (id) => {
    try {
      await assignmentsAPI.update(id, { status: 'confirmed' });
      toast.success('Affectation confirmée');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la confirmation');
    }
  };

  const handleDecline = async (id) => {
    try {
      await assignmentsAPI.update(id, { status: 'declined' });
      toast.success('Affectation refusée');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors du refus');
    }
  };

  const handleRemove = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir retirer cette affectation ?')) return;
    
    try {
      await assignmentsAPI.delete(id);
      toast.success('Affectation retirée');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleViewDetails = (assignment) => {
    navigate(`/events/${assignment.eventId}`);
  };

  // Filtrage
  const filteredAssignments = assignments.filter(assignment => {
    // Recherche
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      const matchesAgent = 
        assignment.agent?.firstName?.toLowerCase().includes(search) ||
        assignment.agent?.lastName?.toLowerCase().includes(search) ||
        assignment.agent?.employeeId?.toLowerCase().includes(search);
      const matchesEvent = assignment.event?.name?.toLowerCase().includes(search);
      if (!matchesAgent && !matchesEvent) return false;
    }

    // Filtre statut
    if (statusFilter !== 'all' && assignment.status !== statusFilter) return false;

    // Filtre événement
    if (eventFilter !== 'all' && assignment.eventId !== eventFilter) return false;

    // Filtre rôle
    if (roleFilter !== 'all' && assignment.role !== roleFilter) return false;

    return true;
  });

  // Statistiques
  const stats = {
    total: assignments.length,
    pending: assignments.filter(a => a.status === 'pending').length,
    confirmed: assignments.filter(a => a.status === 'confirmed').length,
    agents: new Set(assignments.map(a => a.agentId)).size
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Header mobile/desktop responsive */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Titre et action principale */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
                <FiUserCheck className="text-primary-600" />
                Affectations
              </h1>
              <p className="text-sm text-gray-600 mt-1">Gérez les affectations d'agents aux événements</p>
            </div>
            <button
              onClick={() => navigate('/events')}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-medium hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg shadow-primary-500/30 flex items-center justify-center gap-2"
            >
              <FiPlus size={18} />
              Nouvelle affectation
            </button>
          </div>

          {/* Stats cards - responsive grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 sm:p-4 border border-blue-200">
              <p className="text-xs sm:text-sm text-blue-600 font-medium">Total</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-900 mt-1">{stats.total}</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-3 sm:p-4 border border-yellow-200">
              <p className="text-xs sm:text-sm text-yellow-600 font-medium">En attente</p>
              <p className="text-xl sm:text-2xl font-bold text-yellow-900 mt-1">{stats.pending}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-3 sm:p-4 border border-green-200">
              <p className="text-xs sm:text-sm text-green-600 font-medium">Confirmés</p>
              <p className="text-xl sm:text-2xl font-bold text-green-900 mt-1">{stats.confirmed}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-3 sm:p-4 border border-purple-200">
              <p className="text-xs sm:text-sm text-purple-600 font-medium">Agents</p>
              <p className="text-xl sm:text-2xl font-bold text-purple-900 mt-1">{stats.agents}</p>
            </div>
          </div>

          {/* Barre de recherche et filtres - responsive */}
          <div className="space-y-3">
            {/* Recherche + Vue switcher */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher un agent ou événement..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              
              {/* View mode switcher - caché sur mobile */}
              <div className="hidden md:flex items-center gap-2 bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-4 py-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  <FiGrid size={18} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  <FiList size={18} />
                </button>
              </div>
            </div>

            {/* Filtres - responsive */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              >
                <option value="all">Tous les statuts</option>
                <option value="pending">En attente</option>
                <option value="confirmed">Confirmé</option>
                <option value="declined">Refusé</option>
                <option value="cancelled">Annulé</option>
              </select>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              >
                <option value="all">Tous les rôles</option>
                <option value="primary">Agents</option>
                <option value="supervisor">Responsables</option>
                <option value="backup">Remplaçants</option>
              </select>

              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              >
                <option value="all">Tous les événements</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>{event.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <FiRefreshCw className="animate-spin text-primary-600" size={32} />
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="text-center py-12">
            <FiAlertCircle className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune affectation trouvée</h3>
            <p className="text-gray-600">Modifiez vos filtres ou créez une nouvelle affectation</p>
          </div>
        ) : (
          <>
            {/* Vue Mobile (Cards) - toujours sur mobile */}
            <div className="block md:hidden space-y-4">
              {filteredAssignments.map(assignment => (
                <AssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  onViewDetails={handleViewDetails}
                  onConfirm={handleConfirm}
                  onDecline={handleDecline}
                  onRemove={handleRemove}
                />
              ))}
            </div>

            {/* Vue Desktop - Grid ou List */}
            <div className="hidden md:block">
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredAssignments.map(assignment => (
                    <AssignmentCard
                      key={assignment.id}
                      assignment={assignment}
                      onViewDetails={handleViewDetails}
                      onConfirm={handleConfirm}
                      onDecline={handleDecline}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Événement</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zone</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rôle</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredAssignments.map(assignment => (
                          <AssignmentRow
                            key={assignment.id}
                            assignment={assignment}
                            onViewDetails={handleViewDetails}
                            onConfirm={handleConfirm}
                            onDecline={handleDecline}
                            onRemove={handleRemove}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Résultats count */}
        {!loading && filteredAssignments.length > 0 && (
          <div className="mt-6 text-center text-sm text-gray-600">
            Affichage de <span className="font-semibold text-gray-900">{filteredAssignments.length}</span> affectation(s)
            {filteredAssignments.length !== assignments.length && (
              <> sur <span className="font-semibold text-gray-900">{assignments.length}</span> au total</>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignmentsResponsive;
