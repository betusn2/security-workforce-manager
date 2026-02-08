import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FiHome, FiUsers, FiCalendar, FiClipboard, FiClock,
  FiBell, FiFileText, FiSettings, FiLogOut, FiMenu, FiX,
  FiAward, FiMapPin, FiAlertTriangle, FiGrid, FiStar, FiShield, FiLock, FiLayers, FiUserPlus, FiList, FiChevronDown, FiChevronRight, FiActivity, FiDatabase, FiInfo, FiBook
} from 'react-icons/fi';
import useAuthStore from '../hooks/useAuth';

const menuStructure = [
  {
    label: 'Tableau de bord',
    path: '/dashboard',
    icon: FiHome,
    single: true
  },
  {
    label: 'Planification',
    icon: FiGrid,
    items: [
      { path: '/planning', icon: FiGrid, label: 'Planning' },
      { path: '/events', icon: FiCalendar, label: 'Événements' },
    ]
  },
  {
    label: 'Gestion',
    icon: FiUsers,
    items: [
      { path: '/users', icon: FiUsers, label: 'Utilisateurs', roles: ['admin', 'supervisor'] },
      { path: '/zones', icon: FiLayers, label: 'Zones', roles: ['admin', 'supervisor'] },
      { path: '/assignments', icon: FiClipboard, label: 'Affectations', roles: ['admin', 'supervisor'] },
    ]
  },
  {
    label: 'Présence & Pointage',
    icon: FiClock,
    items: [
      { path: '/attendance', icon: FiClock, label: 'Présences' },
      { path: '/attendance-verification', icon: FiShield, label: 'Vérification', roles: ['admin', 'supervisor'] },
      { path: '/checkinout', icon: FiMapPin, label: 'Pointage' },
    ]
  },
  {
    label: 'Supervision',
    icon: FiUserPlus,
    roles: ['admin', 'supervisor', 'responsable'],
    items: [
      { path: '/supervisor/agents', icon: FiUserPlus, label: 'Mes Agents Recrutés', roles: ['responsable'] },
      { path: '/creation-history', icon: FiList, label: 'Historique Créations', roles: ['admin', 'responsable', 'supervisor'] },
    ]
  },
  {
    label: 'Sécurité & Suivi',
    icon: FiAlertTriangle,
    items: [
      { path: '/tracking', icon: FiMapPin, label: 'Suivi GPS', roles: ['admin', 'supervisor'] },
      { path: '/incidents', icon: FiAlertTriangle, label: 'Incidents' },
      { path: '/badges', icon: FiStar, label: 'Badges' },
      { path: '/rankings', icon: FiAward, label: 'Classement' },
    ]
  },
  {
    label: 'Notifications',
    path: '/notifications',
    icon: FiBell,
    single: true
  },
  {
    label: 'Administration',
    icon: FiSettings,
    roles: ['admin', 'supervisor'],
    items: [
      { path: '/reports', icon: FiFileText, label: 'Rapports', roles: ['admin', 'supervisor'] },
      { path: '/admin/notifications', icon: FiBell, label: 'Notifications Avancées', roles: ['admin'] },
      { path: '/admin/logs', icon: FiActivity, label: 'Logs & Audit Trail', roles: ['admin'] },
      { path: '/admin/database', icon: FiDatabase, label: 'Sauvegarde DB', roles: ['admin'] },
      { path: '/permissions', icon: FiLock, label: 'Permissions', roles: ['admin'] },
      { path: '/settings', icon: FiSettings, label: 'Paramètres' },
    ]
  },
  {
    label: 'Informations',
    icon: FiInfo,
    items: [
      { path: '/about', icon: FiInfo, label: 'À Propos' },
      { path: '/privacy', icon: FiBook, label: 'Confidentialité' },
    ]
  },
];

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasRole } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleSection = (label) => {
    setExpandedSections(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  const filterMenuItems = (items) => {
    return items.filter(item => !item.roles || hasRole(item.roles));
  };

  const filterSections = (sections) => {
    return sections.filter(section => {
      if (section.roles && !hasRole(section.roles)) return false;
      if (section.items) {
        const visibleItems = filterMenuItems(section.items);
        return visibleItems.length > 0;
      }
      return true;
    });
  };

  const filteredSections = filterSections(menuStructure);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-30 h-full w-64 bg-secondary-800 transform transition-transform duration-300 lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 bg-secondary-900">
            <span className="text-xl font-bold text-white">
              SGM
            </span>
            <button
              className="lg:hidden text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <FiX size={24} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {filteredSections.map((section) => {
              const SectionIcon = section.icon;
              
              // Single item without grouping
              if (section.single && section.path) {
                const isActive = location.pathname === section.path;
                return (
                  <Link
                    key={section.path}
                    to={section.path}
                    className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-300 hover:bg-secondary-700'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <SectionIcon className="w-5 h-5 mr-3" />
                    {section.label}
                  </Link>
                );
              }

              // Grouped items
              const isExpanded = expandedSections[section.label];
              const visibleItems = filterMenuItems(section.items);
              const hasActiveItem = visibleItems.some(item => location.pathname === item.path);

              return (
                <div key={section.label} className="mb-1">
                  <button
                    onClick={() => toggleSection(section.label)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                      hasActiveItem
                        ? 'bg-secondary-700 text-white'
                        : 'text-gray-300 hover:bg-secondary-700'
                    }`}
                  >
                    <div className="flex items-center">
                      <SectionIcon className="w-5 h-5 mr-3" />
                      <span className="font-medium text-sm">{section.label}</span>
                    </div>
                    {isExpanded ? (
                      <FiChevronDown className="w-4 h-4" />
                    ) : (
                      <FiChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  
                  {isExpanded && (
                    <div className="mt-1 ml-4 space-y-1">
                      {visibleItems.map((item) => {
                        const ItemIcon = item.icon;
                        const isActive = location.pathname === item.path;

                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center px-4 py-2 rounded-lg transition-colors text-sm ${
                              isActive
                                ? 'bg-primary-600 text-white'
                                : 'text-gray-400 hover:bg-secondary-700 hover:text-white'
                            }`}
                            onClick={() => setSidebarOpen(false)}
                          >
                            <ItemIcon className="w-4 h-4 mr-3" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-secondary-700">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-medium">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div className="ml-3">
                <p className="text-white font-medium text-sm">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-gray-400 text-xs capitalize">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-2 text-gray-300 rounded-lg hover:bg-secondary-700 transition-colors"
            >
              <FiLogOut className="w-5 h-5 mr-3" />
              Déconnexion
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-10 h-16 bg-white shadow-sm flex items-center px-4 lg:px-8">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            onClick={() => setSidebarOpen(true)}
          >
            <FiMenu size={24} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center space-x-4">
            <Link to="/notifications" className="relative p-2 rounded-lg hover:bg-gray-100">
              <FiBell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 bg-white py-4 px-8">
          <p className="text-center text-gray-600 text-sm">
            © {new Date().getFullYear()} SGM – Security Guard | Système de gestion
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Layout;
