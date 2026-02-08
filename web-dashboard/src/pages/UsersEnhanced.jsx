import React, { useState, useEffect, useMemo } from 'react';
import {
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiFilter,
  FiUser, FiMail, FiPhone, FiEye, FiX,
  FiUserCheck, FiAlertCircle, FiCheck, FiChevronDown,
  FiList, FiGrid, FiUsers, FiShield, FiStar,
  FiDownload, FiRefreshCw, FiMenu, FiMoreVertical,
  FiCalendar, FiMapPin, FiAward, FiTrendingUp
} from 'react-icons/fi';
import { usersAPI } from '../services/api';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { UserModal } from './Users';

const UsersEnhanced = () => {
  // États
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid', 'list', 'cards'
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('firstName');
  const [sortOrder, setSortOrder] = useState('asc');
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAgents: 0,
    totalSupervisors: 0,
    totalAdmins: 0,
    activeUsers: 0,
    unassignedAgents: 0
  });

  // Modal états
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Charger les utilisateurs
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      console.log('🔄 Chargement des utilisateurs...');
      const response = await usersAPI.getAll();
      console.log('✅ API Response complète:', response);
      console.log('📦 response.data:', response.data);
      
      // CORRECTION: L'API retourne {success: true, data: {users: [...], pagination: {...}}}
      const userData = response.data?.data?.users || response.data?.users || response.data?.data || response.data || [];
      console.log('👥 User Data extrait:', userData);
      console.log('📊 Type de userData:', Array.isArray(userData) ? 'Array' : typeof userData);
      
      // S'assurer que userData est un tableau
      const usersArray = Array.isArray(userData) ? userData : [];
      console.log('✅ Users Array final:', usersArray.length, 'utilisateurs');
      
      if (usersArray.length > 0) {
        console.log('👤 Premier utilisateur:', usersArray[0]);
      }
      
      setUsers(usersArray);
      
      // Calculer les stats
      setStats({
        totalUsers: usersArray.length,
        totalAgents: usersArray.filter(u => u.role === 'agent').length,
        totalSupervisors: usersArray.filter(u => u.role === 'supervisor').length,
        totalAdmins: usersArray.filter(u => u.role === 'admin').length,
        activeUsers: usersArray.filter(u => u.status === 'active').length,
        unassignedAgents: usersArray.filter(u => u.role === 'agent' && !u.supervisorId).length
      });
    } catch (error) {
      console.error('❌ Erreur chargement utilisateurs:', error);
      console.error('❌ Error response:', error.response);
      console.error('❌ Error message:', error.message);
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error('Non autorisé: Vous devez être connecté en tant qu\'admin ou superviseur');
      } else {
        toast.error(`Erreur: ${error.response?.data?.message || error.message || 'Erreur lors du chargement des utilisateurs'}`);
      }
      setUsers([]); // S'assurer que users est toujours un tableau
    } finally {
      setLoading(false);
    }
  };

  // Fonctions pour gérer les modals
  const openCreateModal = () => {
    setSelectedUser(null);
    setShowCreateModal(true);
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleDelete = async (userId) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      try {
        await usersAPI.delete(userId);
        toast.success('Utilisateur supprimé avec succès');
        fetchUsers();
      } catch (error) {
        console.error('Erreur suppression utilisateur:', error);
        toast.error('Erreur lors de la suppression');
      }
    }
  };

  const handleSaveUser = () => {
    fetchUsers();
    setShowCreateModal(false);
    setShowEditModal(false);
  };

  // Filtrer et trier les utilisateurs
  const filteredUsers = useMemo(() => {
    // S'assurer que users est un tableau
    if (!Array.isArray(users)) {
      return [];
    }
    
    let filtered = [...users];

    // Recherche
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(u => 
        u.firstName?.toLowerCase().includes(searchLower) ||
        u.lastName?.toLowerCase().includes(searchLower) ||
        u.email?.toLowerCase().includes(searchLower) ||
        u.cin?.toLowerCase().includes(searchLower) ||
        u.phone?.includes(searchLower)
      );
    }

    // Filtre par rôle
    if (roleFilter) {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    // Filtre par statut
    if (statusFilter) {
      filtered = filtered.filter(u => u.status === statusFilter);
    }

    // Tri
    filtered.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  }, [users, search, roleFilter, statusFilter, sortBy, sortOrder]);

  // Fonction pour obtenir le badge de rôle
  const getRoleBadge = (role) => {
    const badges = {
      admin: { bg: 'bg-red-100', text: 'text-red-800', icon: FiShield, label: 'Admin' },
      supervisor: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: FiUserCheck, label: 'Superviseur' },
      agent: { bg: 'bg-blue-100', text: 'text-blue-800', icon: FiUser, label: 'Agent' },
      user: { bg: 'bg-purple-100', text: 'text-purple-800', icon: FiUsers, label: 'Utilisateur' }
    };
    const badge = badges[role] || badges.user;
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        <Icon className="mr-1" size={12} />
        {badge.label}
      </span>
    );
  };

  // Fonction pour obtenir le badge de statut
  const getStatusBadge = (status) => {
    const badges = {
      active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Actif' },
      inactive: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Inactif' },
      suspended: { bg: 'bg-red-100', text: 'text-red-800', label: 'Suspendu' }
    };
    const badge = badges[status] || badges.inactive;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  // Fonction pour obtenir la couleur du score
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Mobile Bottom Sheet Filters
  const MobileFilters = () => (
    <div className={`fixed inset-0 z-50 transition-all duration-300 ${showFilters ? 'visible' : 'invisible'}`}>
      {/* Overlay */}
      <div 
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${showFilters ? 'opacity-50' : 'opacity-0'}`}
        onClick={() => setShowFilters(false)}
      />
      
      {/* Bottom Sheet */}
      <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ${showFilters ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b">
            <h3 className="text-lg font-bold text-gray-900">Filtres</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <FiX size={24} />
            </button>
          </div>

          {/* Recherche */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rechercher</label>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Nom, email, CIN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Rôle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rôle</label>
            <div className="grid grid-cols-2 gap-2">
              {['', 'agent', 'supervisor', 'admin'].map((role) => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className={`py-3 px-4 rounded-xl font-medium text-sm transition-all ${
                    roleFilter === role
                      ? 'bg-primary-600 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {role === '' ? 'Tous' : role === 'agent' ? 'Agents' : role === 'supervisor' ? 'Superviseurs' : 'Admins'}
                </button>
              ))}
            </div>
          </div>

          {/* Statut */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
            <div className="grid grid-cols-2 gap-2">
              {['', 'active', 'inactive', 'suspended'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`py-3 px-4 rounded-xl font-medium text-sm transition-all ${
                    statusFilter === status
                      ? 'bg-primary-600 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status === '' ? 'Tous' : status === 'active' ? 'Actif' : status === 'inactive' ? 'Inactif' : 'Suspendu'}
                </button>
              ))}
            </div>
          </div>

          {/* Tri */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Trier par</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full py-3 px-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="firstName">Nom</option>
              <option value="role">Rôle</option>
              <option value="status">Statut</option>
              <option value="overallScore">Score</option>
              <option value="createdAt">Date création</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setSearch('');
                setRoleFilter('');
                setStatusFilter('');
                setSortBy('firstName');
                setSortOrder('asc');
              }}
              className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              Réinitialiser
            </button>
            <button
              onClick={() => setShowFilters(false)}
              className="flex-1 py-3 px-4 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
            >
              Appliquer
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Card View Component
  const UserCard = ({ user }) => (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-primary-200 transform hover:-translate-y-1">
      {/* Header avec photo */}
      <div className="relative h-24 bg-gradient-to-br from-primary-400 to-primary-600">
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
          {user.profilePhoto ? (
            <img
              src={user.profilePhoto}
              alt={`${user.firstName} ${user.lastName}`}
              className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-white border-4 border-white shadow-lg flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-600">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </span>
            </div>
          )}
          {/* Badge de statut en ligne */}
          {user.status === 'active' && (
            <div className="absolute bottom-2 right-2 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
          )}
        </div>
      </div>

      {/* Contenu */}
      <div className="pt-14 px-5 pb-5">
        {/* Nom et badges */}
        <div className="text-center mb-4">
          <h3 className="font-bold text-lg text-gray-900 mb-1">
            {user.firstName} {user.lastName}
          </h3>
          <div className="flex items-center justify-center gap-2 mb-2">
            {getRoleBadge(user.role)}
            {getStatusBadge(user.status)}
          </div>
          {user.cin && (
            <p className="text-xs text-gray-500 font-mono">{user.cin}</p>
          )}
        </div>

        {/* Informations de contact */}
        <div className="space-y-2 mb-4">
          {user.email && (
            <div className="flex items-center text-sm text-gray-600">
              <FiMail className="mr-2 text-gray-400 flex-shrink-0" size={16} />
              <span className="truncate">{user.email}</span>
            </div>
          )}
          {user.phone && (
            <div className="flex items-center text-sm text-gray-600">
              <FiPhone className="mr-2 text-gray-400 flex-shrink-0" size={16} />
              <span>{user.phone}</span>
            </div>
          )}
        </div>

        {/* Score et stats */}
        {user.role === 'agent' && (
          <div className="bg-gray-50 rounded-xl p-3 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600 font-medium">Score global</span>
              <div className="flex items-center">
                <FiStar className={`mr-1 ${getScoreColor(user.overallScore || 0)}`} size={14} />
                <span className={`font-bold text-sm ${getScoreColor(user.overallScore || 0)}`}>
                  {user.overallScore || 0}
                </span>
              </div>
            </div>
            <div className="flex gap-2 text-xs">
              <div className="flex-1 text-center">
                <div className="text-gray-500">Ponctualité</div>
                <div className="font-semibold text-gray-900">{user.punctualityScore || 0}</div>
              </div>
              <div className="flex-1 text-center border-x border-gray-200">
                <div className="text-gray-500">Fiabilité</div>
                <div className="font-semibold text-gray-900">{user.reliabilityScore || 0}</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-gray-500">Profession.</div>
                <div className="font-semibold text-gray-900">{user.professionalismScore || 0}</div>
              </div>
            </div>
          </div>
        )}

        {/* Superviseur */}
        {user.role === 'agent' && user.supervisor && (
          <div className="flex items-center text-xs text-gray-600 mb-4 bg-purple-50 rounded-lg p-2">
            <FiUsers className="mr-2 text-purple-600" size={14} />
            <span className="text-purple-700 font-medium">
              {user.supervisor.firstName} {user.supervisor.lastName}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => openEditModal(user)}
            className="flex-1 py-2 px-3 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors flex items-center justify-center text-sm font-medium"
          >
            <FiEye className="mr-1" size={16} />
            Voir
          </button>
          <button
            onClick={() => openEditModal(user)}
            className="flex-1 py-2 px-3 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center text-sm font-medium"
          >
            <FiEdit2 className="mr-1" size={16} />
            Modifier
          </button>
          <button
            onClick={() => handleDelete(user.id)}
            className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
          >
            <FiTrash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  // List View Component (Mobile optimized)
  const UserListItem = ({ user }) => (
    <div className="bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors p-4">
      <div className="flex items-center justify-between">
        {/* Photo et info */}
        <div className="flex items-center flex-1 min-w-0 mr-3">
          {user.profilePhoto ? (
            <img
              src={user.profilePhoto}
              alt=""
              className="w-12 h-12 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-medium flex-shrink-0">
              {user.firstName?.[0]}{user.lastName?.[0]}
            </div>
          )}
          
          <div className="ml-3 flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-gray-900 truncate">
                {user.firstName} {user.lastName}
              </h4>
              {user.status === 'active' && (
                <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {getRoleBadge(user.role)}
              {user.overallScore !== undefined && user.role === 'agent' && (
                <span className="flex items-center text-xs text-gray-600">
                  <FiStar className={`mr-1 ${getScoreColor(user.overallScore)}`} size={12} />
                  <span className="font-medium">{user.overallScore}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Menu actions */}
        <div className="relative group flex-shrink-0">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <FiMoreVertical size={18} className="text-gray-400" />
          </button>
          <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-200 hidden group-hover:block z-10">
            <button 
              onClick={() => openEditModal(user)}
              className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center"
            >
              <FiEye className="mr-3 text-blue-600" size={16} />
              Voir détails
            </button>
            <button 
              onClick={() => openEditModal(user)}
              className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center border-t"
            >
              <FiEdit2 className="mr-3 text-green-600" size={16} />
              Modifier
            </button>
            <button 
              onClick={() => handleDelete(user.id)}
              className="w-full px-4 py-3 text-left text-sm hover:bg-red-50 flex items-center text-red-600 border-t"
            >
              <FiTrash2 className="mr-3" size={16} />
              Supprimer
            </button>
          </div>
        </div>
      </div>

      {/* Info supplémentaires sur mobile */}
      <div className="mt-3 space-y-1.5 text-xs text-gray-600">
        {user.email && (
          <div className="flex items-center">
            <FiMail className="mr-2 text-gray-400" size={14} />
            <span className="truncate">{user.email}</span>
          </div>
        )}
        {user.phone && (
          <div className="flex items-center">
            <FiPhone className="mr-2 text-gray-400" size={14} />
            <span>{user.phone}</span>
          </div>
        )}
        {user.role === 'agent' && user.supervisor && (
          <div className="flex items-center text-purple-600">
            <FiUsers className="mr-2" size={14} />
            <span>{user.supervisor.firstName} {user.supervisor.lastName}</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-8">
      {/* Mobile Filters */}
      <MobileFilters />

      {/* Header - Mobile Optimized */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>
              <p className="text-sm text-gray-600 mt-1">
                {filteredUsers.length} utilisateur{filteredUsers.length > 1 ? 's' : ''}
              </p>
            </div>
            <button 
              onClick={openCreateModal}
              className="lg:hidden p-3 bg-primary-600 text-white rounded-xl shadow-lg hover:bg-primary-700 transition-colors"
            >
              <FiPlus size={20} />
            </button>
          </div>

          {/* Search Bar - Mobile First */}
          <div className="relative mb-3">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <FiX size={18} />
              </button>
            )}
          </div>

          {/* Quick Actions - Mobile */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(true)}
              className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center ${
                roleFilter || statusFilter ? 'bg-primary-600 text-white shadow-lg' : 'bg-gray-100 text-gray-700'
              }`}
            >
              <FiFilter className="mr-2" size={16} />
              Filtres
              {(roleFilter || statusFilter) && (
                <span className="ml-2 bg-white text-primary-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                  {(roleFilter ? 1 : 0) + (statusFilter ? 1 : 0)}
                </span>
              )}
            </button>

            {/* View Toggle */}
            <div className="flex bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'grid' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500'
                }`}
              >
                <FiGrid size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'list' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500'
                }`}
              >
                <FiList size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats - Horizontal Scroll on Mobile */}
      <div className="overflow-x-auto hide-scrollbar bg-white border-b border-gray-200">
        <div className="flex gap-3 px-4 py-4 min-w-max lg:grid lg:grid-cols-6 lg:min-w-0">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 min-w-[140px] lg:min-w-0 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <FiUser size={24} className="opacity-80" />
              <div className="bg-white bg-opacity-20 rounded-lg px-2 py-1">
                <FiTrendingUp size={14} />
              </div>
            </div>
            <div className="text-2xl font-bold">{stats.totalAgents}</div>
            <div className="text-xs opacity-90 font-medium mt-1">Agents</div>
          </div>

          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl p-4 min-w-[140px] lg:min-w-0 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <FiUserCheck size={24} className="opacity-80" />
              <div className="bg-white bg-opacity-20 rounded-lg px-2 py-1">
                <FiAward size={14} />
              </div>
            </div>
            <div className="text-2xl font-bold">{stats.totalSupervisors}</div>
            <div className="text-xs opacity-90 font-medium mt-1">Superviseurs</div>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-4 min-w-[140px] lg:min-w-0 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <FiShield size={24} className="opacity-80" />
              <div className="bg-white bg-opacity-20 rounded-lg px-2 py-1">
                <FiStar size={14} />
              </div>
            </div>
            <div className="text-2xl font-bold">{stats.totalAdmins}</div>
            <div className="text-xs opacity-90 font-medium mt-1">Admins</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-4 min-w-[140px] lg:min-w-0 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <FiUsers size={24} className="opacity-80" />
              <div className="bg-white bg-opacity-20 rounded-lg px-2 py-1">
                <FiCalendar size={14} />
              </div>
            </div>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <div className="text-xs opacity-90 font-medium mt-1">Utilisateurs</div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-4 min-w-[140px] lg:min-w-0 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <FiCheck size={24} className="opacity-80" />
              <div className="bg-white bg-opacity-20 rounded-lg px-2 py-1">
                <FiTrendingUp size={14} />
              </div>
            </div>
            <div className="text-2xl font-bold">{stats.activeUsers}</div>
            <div className="text-xs opacity-90 font-medium mt-1">Actifs</div>
          </div>

          <div className={`rounded-2xl p-4 min-w-[140px] lg:min-w-0 text-white shadow-lg ${
            stats.unassignedAgents > 0 
              ? 'bg-gradient-to-br from-orange-500 to-orange-600' 
              : 'bg-gradient-to-br from-gray-400 to-gray-500'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <FiAlertCircle size={24} className="opacity-80" />
              {stats.unassignedAgents > 0 && (
                <div className="bg-white bg-opacity-20 rounded-lg px-2 py-1 animate-pulse">
                  <FiAlertCircle size={14} />
                </div>
              )}
            </div>
            <div className="text-2xl font-bold">{stats.unassignedAgents}</div>
            <div className="text-xs opacity-90 font-medium mt-1">Non assignés</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-500">Chargement des utilisateurs...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <FiUsers className="mx-auto text-gray-300 mb-4" size={64} />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun utilisateur trouvé</h3>
            <p className="text-gray-600">Essayez de modifier vos filtres de recherche</p>
          </div>
        ) : (
          <>
            {/* Grid View */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
                {filteredUsers.map(user => (
                  <UserCard key={user.id} user={user} />
                ))}
              </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {filteredUsers.map(user => (
                  <UserListItem key={user.id} user={user} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Action Button - Mobile */}
      <button 
        onClick={openCreateModal}
        className="lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-primary-600 text-white rounded-full shadow-2xl hover:bg-primary-700 transition-all flex items-center justify-center z-50 hover:scale-110"
      >
        <FiPlus size={24} />
      </button>

      {/* Desktop Add Button */}
      <button 
        onClick={openCreateModal}
        className="hidden lg:flex fixed bottom-8 right-8 px-6 py-3 bg-primary-600 text-white rounded-xl shadow-xl hover:bg-primary-700 transition-all items-center z-50 hover:scale-105"
      >
        <FiPlus className="mr-2" size={20} />
        Nouvel utilisateur
      </button>

      {/* UserModal - Modal complet avec tous les onglets */}
      <UserModal
        isOpen={showCreateModal || showEditModal}
        onClose={() => {
          setShowCreateModal(false);
          setShowEditModal(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        onSave={handleSaveUser}
      />

      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default UsersEnhanced;
