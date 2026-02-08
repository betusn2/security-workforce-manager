import React, { useEffect, useState, useMemo } from 'react';
import {
  FiUsers, FiCalendar, FiClock, FiAlertCircle,
  FiCheckCircle, FiTrendingUp, FiMapPin, FiRefreshCw,
  FiShield, FiActivity, FiAward, FiZap,
  FiEye, FiUserCheck, FiArrowUp, FiArrowDown,
  FiBarChart2, FiStar, FiMenu, FiX, FiBell,
  FiTarget, FiTrendingDown, FiPercent, FiNavigation
} from 'react-icons/fi';
import { eventsAPI, usersAPI } from '../services/api';
import { toast } from 'react-toastify';
import { format, differenceInHours, isToday, isTomorrow, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';

const DashboardEnhanced = () => {
  // États
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalAgents: 0,
    activeAgents: 0,
    totalEvents: 0,
    todayEvents: 0,
    inProgressEvents: 0,
    upcomingEvents: 0,
    completedEvents: 0,
    attendanceRate: 0,
    avgScore: 0
  });
  const [events, setEvents] = useState([]);
  const [agents, setAgents] = useState([]);
  const [todayEvents, setTodayEvents] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [pullStartY, setPullStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  // Charger les données
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Dashboard - Chargement des données...');
      
      const [eventsRes, usersRes] = await Promise.all([
        eventsAPI.getAll(),
        usersAPI.getAll()
      ]);

      console.log('📦 Events Response:', eventsRes);
      console.log('📦 Users Response:', usersRes);
      console.log('📦 eventsRes.data:', eventsRes.data);
      console.log('📦 usersRes.data:', usersRes.data);

      // CORRECTION: API retourne {data: {events/users: [...], pagination}}
      const eventsData = eventsRes.data?.data?.events || eventsRes.data?.events || eventsRes.data?.data || [];
      const usersData = usersRes.data?.data?.users || usersRes.data?.users || usersRes.data?.data || [];

      // S'assurer que les données sont des tableaux
      const eventsArray = Array.isArray(eventsData) ? eventsData : [];
      const usersArray = Array.isArray(usersData) ? usersData : [];
      
      console.log('✅ Dashboard - Événements chargés:', eventsArray.length);
      console.log('✅ Dashboard - Utilisateurs chargés:', usersArray.length);
      
      if (eventsArray.length > 0) {
        console.log('📅 Premier événement:', eventsArray[0]);
      }
      if (usersArray.length > 0) {
        console.log('👤 Premier utilisateur:', usersArray[0]);
      }

      setEvents(eventsArray);
      setAgents(usersArray);

      // Calculer les stats
      const now = new Date();
      const todayEvts = eventsArray.filter(e => isToday(new Date(e.startDate)));
      
      // Événements EN COURS (status = 'active')
      const inProgressEvents = eventsArray.filter(e => e.status === 'active');
      console.log('📊 Dashboard - Événements EN COURS:', inProgressEvents.length, inProgressEvents);
      
      const upcoming = eventsArray.filter(e => {
        const start = new Date(e.startDate);
        return start > now && !isToday(start);
      }).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
      
      const completed = eventsArray.filter(e => isPast(new Date(e.endDate || e.startDate)));
      const activeAgents = usersArray.filter(u => u.role === 'agent' && u.status === 'active');
      const allAgents = usersArray.filter(u => u.role === 'agent');
      const avgScore = activeAgents.length > 0
        ? Math.round(activeAgents.reduce((sum, a) => sum + (a.overallScore || 0), 0) / activeAgents.length)
        : 0;

      // Calculer le taux de présence approximatif
      const attendanceRate = allAgents.length > 0
        ? Math.round((activeAgents.length / allAgents.length) * 100)
        : 0;

      setTodayEvents(todayEvts);
      setUpcomingEvents(upcoming);

      setStats({
        totalAgents: allAgents.length,
        activeAgents: activeAgents.length,
        totalEvents: eventsArray.length,
        todayEvents: todayEvts.length,
        inProgressEvents: inProgressEvents.length,
        upcomingEvents: upcoming.length,
        completedEvents: completed.length,
        attendanceRate: attendanceRate,
        avgScore: avgScore
      });

    } catch (error) {
      console.error('❌ Erreur chargement dashboard:', error);
      console.error('❌ Error response:', error.response);
      console.error('❌ Error message:', error.message);
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error('Non autorisé: Vous devez être connecté en tant qu\'admin ou superviseur');
      } else {
        toast.error(`Erreur: ${error.response?.data?.message || error.message || 'Erreur lors du chargement des données'}`);
      }
      
      // S'assurer que les états sont des tableaux même en cas d'erreur
      setEvents([]);
      setAgents([]);
      setTodayEvents([]);
      setUpcomingEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    toast.success('Dashboard actualisé');
  };

  // Pull to refresh
  const handleTouchStart = (e) => {
    if (window.scrollY === 0) {
      setPullStartY(e.touches[0].clientY);
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e) => {
    if (!isPulling) return;
    const currentY = e.touches[0].clientY;
    const distance = currentY - pullStartY;
    if (distance > 0 && distance < 100) {
      setPullDistance(distance);
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 60) {
      handleRefresh();
    }
    setPullDistance(0);
    setIsPulling(false);
  };

  // Stat Card Component
  const StatCard = ({ title, value, icon: Icon, gradient, trend, suffix = '', loading }) => (
    <div
      className="relative overflow-hidden rounded-2xl p-5 text-white transform transition-all duration-300 hover:scale-105 shadow-lg"
      style={{ background: gradient }}
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
            <Icon size={24} />
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold backdrop-blur-sm ${
              trend > 0 ? 'bg-green-400/30' : trend < 0 ? 'bg-red-400/30' : 'bg-white/20'
            }`}>
              {trend > 0 ? <FiArrowUp size={12} /> : trend < 0 ? <FiArrowDown size={12} /> : null}
              {Math.abs(trend)}%
            </div>
          )}
        </div>

        {loading ? (
          <div className="animate-pulse">
            <div className="h-8 bg-white/20 rounded w-16 mb-2" />
            <div className="h-4 bg-white/10 rounded w-24" />
          </div>
        ) : (
          <>
            <p className="text-3xl font-black mb-1">{value}{suffix}</p>
            <p className="text-white/90 text-sm font-medium">{title}</p>
          </>
        )}
      </div>
    </div>
  );

  // Event Card Component
  const EventCard = ({ event }) => {
    const start = new Date(event.startDate);
    const hoursUntil = differenceInHours(start, new Date());
    const isImminentToday = isToday(start);
    const isEventTomorrow = isTomorrow(start);

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-all duration-300">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 truncate mb-1">{event.name}</h3>
            <div className="flex items-center text-xs text-gray-600 mb-2">
              <FiMapPin className="mr-1 flex-shrink-0" size={12} />
              <span className="truncate">{event.location}</span>
            </div>
          </div>
          {isImminentToday && (
            <span className="flex-shrink-0 ml-2 px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold flex items-center">
              <FiZap className="mr-1" size={12} />
              Aujourd'hui
            </span>
          )}
          {isEventTomorrow && (
            <span className="flex-shrink-0 ml-2 px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-bold">
              Demain
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center text-gray-600">
            <FiClock className="mr-1" size={14} />
            <span>{format(start, 'HH:mm', { locale: fr })}</span>
          </div>
          {event.assignedAgents?.length > 0 && (
            <div className="flex items-center text-gray-600">
              <FiUsers className="mr-1" size={14} />
              <span>{event.assignedAgents.length} agents</span>
            </div>
          )}
        </div>

        {hoursUntil > 0 && hoursUntil < 24 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>Début dans {hoursUntil}h</span>
              <span>{Math.round((24 - hoursUntil) / 24 * 100)}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.round((24 - hoursUntil) / 24 * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  // Quick Action Card
  const QuickAction = ({ title, icon: Icon, color, onClick, count }) => (
    <button
      onClick={onClick}
      className={`relative overflow-hidden ${color} rounded-2xl p-5 text-white text-left transform transition-all duration-300 hover:scale-105 shadow-lg active:scale-95`}
    >
      <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <Icon size={28} />
          {count !== undefined && (
            <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-bold backdrop-blur-sm">
              {count}
            </span>
          )}
        </div>
        <p className="font-bold text-base">{title}</p>
      </div>
    </button>
  );

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-20 lg:pb-8"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to Refresh Indicator */}
      {isPulling && pullDistance > 0 && (
        <div 
          className="fixed top-0 left-0 right-0 flex items-center justify-center z-50 transition-all duration-200"
          style={{ transform: `translateY(${Math.min(pullDistance, 60)}px)` }}
        >
          <div className="bg-white rounded-full p-3 shadow-xl">
            <FiRefreshCw 
              className={`text-primary-600 ${pullDistance > 60 ? 'animate-spin' : ''}`}
              size={24}
              style={{ transform: `rotate(${pullDistance * 6}deg)` }}
            />
          </div>
        </div>
      )}

      {/* Header - Sticky */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="px-4 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-gray-900 mb-1">Dashboard</h1>
              <p className="text-sm text-gray-600">
                {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-3 bg-primary-50 text-primary-600 rounded-xl hover:bg-primary-100 transition-colors disabled:opacity-50"
            >
              <FiRefreshCw className={refreshing ? 'animate-spin' : ''} size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Stats Grid - Horizontal Scroll on Mobile */}
        <div className="overflow-x-auto hide-scrollbar -mx-4 px-4">
          <div className="flex gap-4 min-w-max lg:grid lg:grid-cols-4 lg:min-w-0">
            <div className="min-w-[160px] lg:min-w-0">
              <StatCard
                title="Agents actifs"
                value={stats.activeAgents}
                icon={FiShield}
                gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                trend={12}
                loading={loading}
              />
            </div>
            <div className="min-w-[160px] lg:min-w-0">
              <StatCard
                title="Événements"
                value={stats.todayEvents}
                icon={FiCalendar}
                gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
                suffix=" aujourd'hui"
                loading={loading}
              />
            </div>
            <div className="min-w-[160px] lg:min-w-0">
              <StatCard
                title="Score moyen"
                value={stats.avgScore}
                icon={FiStar}
                gradient="linear-gradient(135deg, #fa709a 0%, #fee140 100%)"
                suffix="/100"
                trend={5}
                loading={loading}
              />
            </div>
            <div className="min-w-[160px] lg:min-w-0">
              <StatCard
                title="Taux présence"
                value={stats.attendanceRate}
                icon={FiCheckCircle}
                gradient="linear-gradient(135deg, #30cfd0 0%, #330867 100%)"
                suffix="%"
                trend={8}
                loading={loading}
              />
            </div>
          </div>
        </div>

        {/* Quick Actions - Mobile Optimized */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Actions rapides</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <QuickAction
              title="Voir événements"
              icon={FiCalendar}
              color="bg-gradient-to-br from-blue-500 to-blue-600"
              count={stats.totalEvents}
              onClick={() => window.location.href = '/events'}
            />
            <QuickAction
              title="Gérer agents"
              icon={FiUsers}
              color="bg-gradient-to-br from-green-500 to-green-600"
              count={stats.totalAgents}
              onClick={() => window.location.href = '/users'}
            />
            <QuickAction
              title="Présences"
              icon={FiUserCheck}
              color="bg-gradient-to-br from-purple-500 to-purple-600"
              onClick={() => window.location.href = '/attendance'}
            />
            <QuickAction
              title="Carte live"
              icon={FiMapPin}
              color="bg-gradient-to-br from-red-500 to-red-600"
              onClick={() => window.location.href = '/tracking'}
            />
          </div>
        </div>

        {/* Événements EN COURS */}
        {stats.inProgressEvents > 0 && (
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl shadow-lg border-2 border-green-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                  <FiActivity className="text-white animate-pulse" size={20} />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 flex items-center gap-2">
                    En cours maintenant
                    <span className="flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600"></span>
                    </span>
                  </h2>
                  <p className="text-xs text-green-700 font-medium">{stats.inProgressEvents} événement{stats.inProgressEvents > 1 ? 's' : ''} actif{stats.inProgressEvents > 1 ? 's' : ''}</p>
                </div>
              </div>
              <a
                href="/tracking"
                className="text-sm text-green-700 font-bold hover:text-green-800 flex items-center gap-1 bg-white/80 px-3 py-1.5 rounded-lg shadow-sm"
              >
                Tracking live
                <FiNavigation size={14} />
              </a>
            </div>
            <div className="space-y-3">
              {events.filter(e => e.status === 'active').slice(0, 3).map(event => (
                <div 
                  key={event.id}
                  className="bg-white rounded-xl p-4 shadow-md border-l-4 border-green-500 hover:shadow-lg transition-all cursor-pointer"
                  onClick={() => window.location.href = `/events/${event.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                        {event.name}
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                          LIVE
                        </span>
                      </h3>
                      {event.location && (
                        <div className="flex items-center text-sm text-gray-600 mb-2">
                          <FiMapPin className="mr-1 flex-shrink-0" size={14} />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <div className="flex items-center">
                          <FiClock className="mr-1" size={12} />
                          {format(new Date(event.startDate), 'HH:mm', { locale: fr })} - {format(new Date(event.endDate), 'HH:mm', { locale: fr })}
                        </div>
                        {event.assignedAgents?.length > 0 && (
                          <div className="flex items-center">
                            <FiUsers className="mr-1" size={12} />
                            {event.assignedAgents.length} agents
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Aujourd'hui */}
        {todayEvents.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                  <FiZap className="text-white" size={20} />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">Aujourd'hui</h2>
                  <p className="text-xs text-gray-600">{todayEvents.length} événement{todayEvents.length > 1 ? 's' : ''}</p>
                </div>
              </div>
              <span className="flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            </div>
            <div className="space-y-3">
              {todayEvents.slice(0, 3).map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        )}

        {/* Prochains événements */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                <FiClock className="text-white" size={20} />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">À venir</h2>
                <p className="text-xs text-gray-600">{upcomingEvents.length} événement{upcomingEvents.length > 1 ? 's' : ''}</p>
              </div>
            </div>
            <a
              href="/events"
              className="text-sm text-primary-600 font-medium hover:text-primary-700"
            >
              Voir tout
            </a>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <FiCalendar size={28} className="text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm">Aucun événement à venir</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {upcomingEvents.slice(0, 6).map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>

        {/* Performance Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <FiTarget className="text-blue-600" size={20} />
              </div>
              <FiTrendingUp className="text-green-600" size={16} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.totalEvents}</p>
            <p className="text-xs text-gray-600 font-medium">Total événements</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-green-50 rounded-lg">
                <FiCheckCircle className="text-green-600" size={20} />
              </div>
              <FiTrendingUp className="text-green-600" size={16} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.completedEvents}</p>
            <p className="text-xs text-gray-600 font-medium">Terminés</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-purple-50 rounded-lg">
                <FiActivity className="text-purple-600" size={20} />
              </div>
              <FiArrowUp className="text-green-600" size={16} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.activeAgents}</p>
            <p className="text-xs text-gray-600 font-medium">En service</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-orange-50 rounded-lg">
                <FiPercent className="text-orange-600" size={20} />
              </div>
              <FiTrendingUp className="text-green-600" size={16} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.attendanceRate}%</p>
            <p className="text-xs text-gray-600 font-medium">Présence</p>
          </div>
        </div>

        {/* Agents Performance - Top 5 */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center">
                <FiAward className="text-white" size={20} />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Top Agents</h2>
                <p className="text-xs text-gray-600">Meilleurs scores</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {Array.isArray(agents) && agents.length > 0 ? (
              agents
                .filter(a => a.role === 'agent')
                .sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0))
                .slice(0, 5)
                .map((agent, index) => (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-yellow-400 text-white' :
                        index === 1 ? 'bg-gray-300 text-gray-700' :
                        index === 2 ? 'bg-orange-400 text-white' :
                        'bg-gray-200 text-gray-600'
                      }`}>
                        {index + 1}
                      </div>
                      {agent.profilePhoto ? (
                        <img
                          src={agent.profilePhoto}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold">
                          {agent.firstName?.[0]}{agent.lastName?.[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {agent.firstName} {agent.lastName}
                        </p>
                        <p className="text-xs text-gray-600">{agent.cin}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <FiStar className="text-yellow-500" size={16} />
                      <span className="font-bold text-gray-900">{agent.overallScore || 0}</span>
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                Aucun agent disponible
              </div>
            )}
          </div>
        </div>
      </div>

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

export default DashboardEnhanced;
