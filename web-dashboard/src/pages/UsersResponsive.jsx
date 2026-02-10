import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiUser, FiMail, FiPhone, FiEye,
  FiUserCheck, FiShield, FiStar, FiX, FiRefreshCw, FiAlertCircle,
  FiGrid, FiList, FiUsers, FiChevronDown, FiFilter, FiCheck
} from 'react-icons/fi';
import { usersAPI } from '../services/api';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { UserModal } from './Users';

// 🎨 Badge de statut
const StatusBadge = ({ status }) => {
  const variants = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-700',
    suspended: 'bg-red-100 text-red-700'
  };
  const labels = {
    active: 'Actif',
    inactive: 'Inactif',
    suspended: 'Suspendu'
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[status] || variants.inactive}`}>
      {labels[status] || status}
    </span>
  );
};

// 🎨 Badge de rôle
const RoleBadge = ({ role }) => {
  const variants = {
    admin: 'bg-red-100 text-red-700',
    supervisor: 'bg-orange-100 text-orange-700',
    agent: 'bg-blue-100 text-blue-700',
    user: 'bg-purple-100 text-purple-700'
  };
  const icons = {
    admin: FiShield,
    supervisor: FiUserCheck,
    agent: FiUser,
    user: FiUser
  };
  const labels = {
    admin: 'Admin',
    supervisor: 'Superviseur',
    agent: 'Agent',
    user: 'Utilisateur'
  };
  const Icon = icons[role] || FiUser;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[role] || variants.user}`}>
      <Icon size={10} className="mr-1" />
      {labels[role] || role}
    </span>
  );
};

// 📱 Card pour mobile
const UserCard = ({ user, onEdit, onDelete, onView, isSelected, onSelect }) => (
  <div className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden hover:shadow-md transition-all ${
    isSelected ? 'border-primary-500 ring-2 ring-primary-200' : 'border-gray-200'
  }`}>
    {/* Header */}
    <div className="p-4 bg-gradient-to-r from-primary-50 to-primary-100 border-b border-primary-200">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-3 flex-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(user.id)}
            className="mt-0.5 w-5 h-5 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
          />
          <div className="flex-1">
            {user.profilePhoto ? (
              <img
                src={user.profilePhoto}
                alt=""
                className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm mb-2"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-lg mb-2 shadow-sm">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </div>
            )}
            <h3 className="font-semibold text-gray-900 text-sm">
              {user.firstName} {user.lastName}
            </h3>
            <p className="text-xs text-gray-600 font-mono">{user.employeeId || user.cin}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={user.status} />
          <RoleBadge role={user.role} />
        </div>
      </div>
    </div>

    {/* Body */}
    <div className="p-4 space-y-3">
      {/* Contact */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <FiMail size={14} className="text-gray-400" />
          <span className="truncate">{user.email}</span>
        </div>
        {user.phone && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FiPhone size={14} className="text-gray-400" />
            <span>{user.phone}</span>
          </div>
        )}
      </div>

      {/* Superviseur */}
      {user.role === 'agent' && (
        <div className="pt-3 border-t border-gray-100">
          {user.supervisor ? (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-xs font-semibold">
                {user.supervisor.firstName?.[0]}{user.supervisor.lastName?.[0]}
              </div>
              <div>
                <p className="text-xs text-gray-500">Superviseur</p>
                <p className="text-sm font-medium text-gray-700">
                  {user.supervisor.firstName} {user.supervisor.lastName}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-red-500">
              <FiAlertCircle size={14} />
              <span>Non assigné</span>
            </div>
          )}
        </div>
      )}

      {/* Score */}
      {user.overallScore !== undefined && (
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          <FiStar className="text-yellow-500" size={14} />
          <span className="text-sm font-semibold text-gray-700">{user.overallScore || 0}</span>
          <span className="text-xs text-gray-500">points</span>
        </div>
      )}
    </div>

    {/* Actions */}
    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
      <button
        onClick={() => onView(user)}
        className="flex-1 px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors flex items-center justify-center gap-1.5"
      >
        <FiEye size={14} />
        <span className="hidden sm:inline">Détails</span>
      </button>
      
      <button
        onClick={() => onEdit(user)}
        className="px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        title="Modifier"
      >
        <FiEdit2 size={16} />
      </button>
      
      <button
        onClick={() => onDelete(user.id)}
        className="px-3 py-2 text-sm font-medium text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        title="Supprimer"
      >
        <FiTrash2 size={16} />
      </button>
    </div>
  </div>
);

// 🖥️ Row pour desktop
const UserRow = ({ user, onEdit, onDelete, onView, isSelected, onSelect }) => (
  <tr className={`transition-colors ${
    isSelected ? 'bg-primary-50 hover:bg-primary-100' : 'hover:bg-gray-50'
  }`}>
    {/* Checkbox */}
    <td className="px-6 py-4 w-12">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onSelect(user.id)}
        className="w-5 h-5 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
      />
    </td>
    
    {/* Utilisateur */}
    <td className="px-6 py-4">
      <div className="flex items-center gap-3">
        {user.profilePhoto ? (
          <img
            src={user.profilePhoto}
            alt=""
            className="w-10 h-10 rounded-full object-cover border-2 border-gray-100"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold shadow-sm">
            {user.firstName?.[0]}{user.lastName?.[0]}
          </div>
        )}
        <div>
          <p className="font-medium text-gray-900 text-sm">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-xs text-gray-500 font-mono">{user.employeeId || user.cin}</p>
        </div>
      </div>
    </td>

    {/* Contact */}
    <td className="px-6 py-4">
      <div className="text-sm text-gray-600">
        <div className="flex items-center gap-1 mb-1">
          <FiMail size={12} className="text-gray-400" />
          <span>{user.email}</span>
        </div>
        {user.phone && (
          <div className="flex items-center gap-1">
            <FiPhone size={12} className="text-gray-400" />
            <span>{user.phone}</span>
          </div>
        )}
      </div>
    </td>

    {/* Rôle */}
    <td className="px-6 py-4">
      <RoleBadge role={user.role} />
    </td>

    {/* Superviseur */}
    <td className="px-6 py-4">
      {user.role === 'agent' ? (
        user.supervisor ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-xs font-semibold">
              {user.supervisor.firstName?.[0]}{user.supervisor.lastName?.[0]}
            </div>
            <span className="text-sm text-gray-700">
              {user.supervisor.firstName} {user.supervisor.lastName}
            </span>
          </div>
        ) : (
          <span className="text-xs text-red-500 flex items-center gap-1">
            <FiAlertCircle size={12} /> Non assigné
          </span>
        )
      ) : (
        <span className="text-xs text-gray-400">-</span>
      )}
    </td>

    {/* Score */}
    <td className="px-6 py-4">
      <div className="flex items-center gap-1">
        <FiStar className="text-yellow-500" size={14} />
        <span className="font-medium text-sm">{user.overallScore || 0}</span>
      </div>
    </td>

    {/* Statut */}
    <td className="px-6 py-4">
      <StatusBadge status={user.status} />
    </td>

    {/* Actions */}
    <td className="px-6 py-4">
      <div className="flex items-center justify-end gap-1">
        <button
          onClick={() => onView(user)}
          className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          title="Voir détails"
        >
          <FiEye size={16} />
        </button>
        <button
          onClick={() => onEdit(user)}
          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title="Modifier"
        >
          <FiEdit2 size={16} />
        </button>
        <button
          onClick={() => onDelete(user.id)}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Supprimer"
        >
          <FiTrash2 size={16} />
        </button>
      </div>
    </td>
  </tr>
);

// 📊 Composant principal
const UsersResponsive = () => {
  const navigate = useNavigate();

  // États
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' ou 'list'
  
  // Filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Sélection
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Charger les données
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await usersAPI.getAll();
      
      // Gestion de différentes structures de réponse API
      const userData = response.data?.data?.users || response.data?.users || response.data?.data || response.data || [];
      
      // S'assurer que ce sont bien des tableaux
      setUsers(Array.isArray(userData) ? userData : []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erreur lors du chargement des utilisateurs');
      setUsers([]); // Toujours initialiser comme tableau vide en cas d'erreur
    } finally {
      setLoading(false);
    }
  };

  // Actions
  const handleEdit = (user) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleView = (user) => {
    setSelectedUser(user);
    // Ouvrir en mode lecture seule ou naviguer vers page détails
    setShowEditModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) return;
    
    try {
      await usersAPI.delete(id);
      toast.success('Utilisateur supprimé');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleCreateNew = () => {
    setSelectedUser(null);
    setShowCreateModal(true);
  };

  const handleSaveUser = () => {
    fetchData();
    setShowCreateModal(false);
    setShowEditModal(false);
  };

  // Sélection
  const handleSelectOne = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredUsers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredUsers.map(u => u.id));
    }
  };

  // Filtrage
  const filteredUsers = useMemo(() => {
    // S'assurer que users est un tableau
    if (!Array.isArray(users)) {
      return [];
    }

    return users.filter(user => {
      // Recherche
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        const matchesName = 
          user.firstName?.toLowerCase().includes(search) ||
          user.lastName?.toLowerCase().includes(search);
        const matchesEmail = user.email?.toLowerCase().includes(search);
        const matchesCIN = user.cin?.toLowerCase().includes(search);
        const matchesPhone = user.phone?.includes(search);
        const matchesEmployeeId = user.employeeId?.toLowerCase().includes(search);
        
        if (!matchesName && !matchesEmail && !matchesCIN && !matchesPhone && !matchesEmployeeId) {
          return false;
        }
      }

      // Filtre rôle
      if (roleFilter !== 'all' && user.role !== roleFilter) return false;

      // Filtre statut
      if (statusFilter !== 'all' && user.status !== statusFilter) return false;

      return true;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    // S'assurer que users est un tableau
    if (!Array.isArray(users)) {
      return { total: 0, agents: 0, supervisors: 0, admins: 0, active: 0, unassigned: 0 };
    }

    return {
      total: users.length,
      agents: users.filter(u => u.role === 'agent').length,
      supervisors: users.filter(u => u.role === 'supervisor').length,
      admins: users.filter(u => u.role === 'admin').length,
      active: users.filter(u => u.status === 'active').length,
      unassigned: users.filter(u => u.role === 'agent' && !u.supervisorId).length
    };
  }, [users]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header mobile/desktop responsive */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Titre et action principale */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
                <FiUsers className="text-primary-600" />
                Utilisateurs
              </h1>
              <p className="text-sm text-gray-600 mt-1">Gestion des agents et responsables</p>
            </div>
            <button
              onClick={handleCreateNew}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-medium hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg shadow-primary-500/30 flex items-center justify-center gap-2"
            >
              <FiPlus size={18} />
              Nouvel utilisateur
            </button>
          </div>

          {/* Stats cards - responsive grid */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4 mb-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 sm:p-4 border border-blue-200">
              <p className="text-xs sm:text-sm text-blue-600 font-medium">Total</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-900 mt-1">{stats.total}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-3 sm:p-4 border border-purple-200">
              <p className="text-xs sm:text-sm text-purple-600 font-medium">Agents</p>
              <p className="text-xl sm:text-2xl font-bold text-purple-900 mt-1">{stats.agents}</p>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-3 sm:p-4 border border-orange-200">
              <p className="text-xs sm:text-sm text-orange-600 font-medium">Superviseurs</p>
              <p className="text-xl sm:text-2xl font-bold text-orange-900 mt-1">{stats.supervisors}</p>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-3 sm:p-4 border border-red-200">
              <p className="text-xs sm:text-sm text-red-600 font-medium">Admins</p>
              <p className="text-xl sm:text-2xl font-bold text-red-900 mt-1">{stats.admins}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-3 sm:p-4 border border-green-200">
              <p className="text-xs sm:text-sm text-green-600 font-medium">Actifs</p>
              <p className="text-xl sm:text-2xl font-bold text-green-900 mt-1">{stats.active}</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-3 sm:p-4 border border-yellow-200">
              <p className="text-xs sm:text-sm text-yellow-600 font-medium">Non assignés</p>
              <p className="text-xl sm:text-2xl font-bold text-yellow-900 mt-1">{stats.unassigned}</p>
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
                  placeholder="Rechercher un utilisateur..."
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              >
                <option value="all">Tous les rôles</option>
                <option value="agent">Agents</option>
                <option value="supervisor">Superviseurs</option>
                <option value="admin">Admins</option>
                <option value="user">Utilisateurs</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              >
                <option value="all">Tous les statuts</option>
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
                <option value="suspended">Suspendu</option>
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
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <FiAlertCircle className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun utilisateur trouvé</h3>
            <p className="text-gray-600">Modifiez vos filtres ou créez un nouvel utilisateur</p>
          </div>
        ) : (
          <>
            {/* Vue Cards (mobile) ou Grid (desktop) */}
            <div className="mb-6">
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredUsers.map(user => (
                    <UserCard
                      key={user.id}
                      user={user}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onView={handleView}
                      isSelected={selectedIds.includes(user.id)}
                      onSelect={handleSelectOne}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 w-12">
                            <input
                              type="checkbox"
                              checked={selectedIds.length > 0 && selectedIds.length === filteredUsers.length}
                              onChange={handleSelectAll}
                              className="w-5 h-5 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                            />
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utilisateur</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rôle</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Superviseur</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredUsers.map(user => (
                          <UserRow
                            key={user.id}
                            user={user}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onView={handleView}
                            isSelected={selectedIds.includes(user.id)}
                            onSelect={handleSelectOne}
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
        {!loading && filteredUsers.length > 0 && (
          <div className="mt-6 text-center text-sm text-gray-600">
            Affichage de <span className="font-semibold text-gray-900">{filteredUsers.length}</span> utilisateur(s)
            {filteredUsers.length !== users.length && (
              <> sur <span className="font-semibold text-gray-900">{users.length}</span> au total</>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <UserModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          user={null}
          onSave={handleSaveUser}
        />
      )}

      {showEditModal && selectedUser && (
        <UserModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          user={selectedUser}
          onSave={handleSaveUser}
        />
      )}
    </div>
  );
};

export default UsersResponsive;
