import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiMapPin,
  FiClock, FiUsers, FiCalendar, FiCheck, FiCopy,
  FiAlertTriangle, FiRepeat, FiEye, FiX, FiFilter,
  FiChevronDown, FiChevronUp, FiActivity, FiTrendingUp,
  FiAlertCircle, FiCheckCircle, FiInfo, FiFlag, FiLayers,
  FiRefreshCw, FiGrid, FiList, FiBarChart2, FiShield,
  FiUser, FiMail, FiPhone, FiZap, FiMaximize2,
  FiStar, FiNavigation, FiBookmark
} from 'react-icons/fi';
import { eventsAPI, usersAPI, zonesAPI } from '../services/api';
import { toast } from 'react-toastify';
import {
  format, formatDistanceToNow, isToday, isTomorrow, isPast, isFuture,
  differenceInDays, startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, addDays
} from 'date-fns';
import { fr } from 'date-fns/locale';
import AddressAutocomplete from '../components/AddressAutocomplete';
import MiniMap from '../components/MiniMap';
import ZoneManager from '../components/ZoneManager';

// ─── Constants ───────────────────────────────────────────────────────────────

const EVENT_COLORS = [
  { name: 'Bleu',   value: '#3B82F6' },
  { name: 'Vert',   value: '#10B981' },
  { name: 'Rouge',  value: '#EF4444' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Violet', value: '#8B5CF6' },
  { name: 'Rose',   value: '#EC4899' },
  { name: 'Jaune',  value: '#EAB308' },
  { name: 'Cyan',   value: '#06B6D4' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Teal',   value: '#14B8A6' },
];

const PRIORITY_OPTIONS = [
  { value: 'low',      label: 'Basse',    color: 'text-gray-500',   bg: 'bg-gray-100',   dot: 'bg-gray-400' },
  { value: 'medium',   label: 'Moyenne',  color: 'text-blue-600',   bg: 'bg-blue-100',   dot: 'bg-blue-400' },
  { value: 'high',     label: 'Haute',    color: 'text-orange-600', bg: 'bg-orange-100', dot: 'bg-orange-400' },
  { value: 'critical', label: 'Critique', color: 'text-red-600',    bg: 'bg-red-100',    dot: 'bg-red-500' },
];

const STATUS_CONFIG = {
  draft:     { label: 'Brouillon',  class: 'bg-gray-100 text-gray-700',   dot: 'bg-gray-400' },
  scheduled: { label: 'Planifié',   class: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  active:    { label: 'Actif',      class: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  completed: { label: 'Terminé',    class: 'bg-purple-100 text-purple-700', dot: 'bg-purple-400' },
  cancelled: { label: 'Annulé',     class: 'bg-red-100 text-red-700',     dot: 'bg-red-400' },
};

const RECURRENCE_OPTIONS = [
  { value: 'none',      label: 'Aucune' },
  { value: 'daily',     label: 'Quotidien' },
  { value: 'weekly',    label: 'Hebdomadaire' },
  { value: 'biweekly',  label: 'Toutes les 2 semaines' },
  { value: 'monthly',   label: 'Mensuel' },
];

const TYPE_OPTIONS = [
  { value: 'regular',   label: 'Régulier',  icon: '🏢' },
  { value: 'special',   label: 'Spécial',   icon: '⭐' },
  { value: 'emergency', label: 'Urgence',   icon: '🚨' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getPriorityInfo = (priority) =>
  PRIORITY_OPTIONS.find(p => p.value === priority) || PRIORITY_OPTIONS[1];

const getStatusConfig = (status) =>
  STATUS_CONFIG[status] || STATUS_CONFIG.draft;

const computePhase = (event) => {
  if (!event) return null;
  const now = new Date();
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  if (isPast(end))       return { label: 'Terminé',       color: 'bg-gray-100 text-gray-600',   icon: '✅', bar: 'bg-gray-400' };
  if (event.status === 'cancelled') return { label: 'Annulé', color: 'bg-red-100 text-red-600', icon: '❌', bar: 'bg-red-400' };
  if (isFuture(start)) {
    const days = differenceInDays(start, now);
    if (days > 1)        return { label: `Dans ${days}j`,   color: 'bg-gray-100 text-gray-500',   icon: '🕐', bar: 'bg-gray-300' };
    return               { label: 'Demain',                color: 'bg-blue-100 text-blue-700',   icon: '⏰', bar: 'bg-blue-400' };
  }
  if (event.status === 'active') {
    const [ciH, ciM] = (event.checkInTime || '08:00').split(':').map(Number);
    const [coH, coM] = (event.checkOutTime || '18:00').split(':').map(Number);
    const checkIn  = new Date(start); checkIn.setHours(ciH, ciM, 0);
    const checkOut = new Date(start); checkOut.setHours(coH, coM, 0);
    const prep     = addDays(start, -1);
    if (now < prep) return { label: 'Préparation',      color: 'bg-blue-100 text-blue-700',   icon: '🛠️', bar: 'bg-blue-500' };
    if (now < checkIn) return { label: 'Mise en place', color: 'bg-yellow-100 text-yellow-700',icon: '📦', bar: 'bg-yellow-500' };
    if (now <= checkOut)return{ label: 'Pointage',      color: 'bg-green-100 text-green-700', icon: '📍', bar: 'bg-green-500' };
    return               { label: 'Clôture',            color: 'bg-purple-100 text-purple-700',icon: '🔒', bar: 'bg-purple-500' };
  }
  return { label: isToday(start) ? "Aujourd'hui" : 'En attente', color: 'bg-orange-100 text-orange-700', icon: '⏳', bar: 'bg-orange-400' };
};

const getTimeIndicator = (event) => {
  const start = new Date(event.startDate);
  const end   = new Date(event.endDate);
  if (isToday(start))    return { label: "Aujourd'hui", class: 'bg-emerald-100 text-emerald-700 font-semibold' };
  if (isTomorrow(start)) return { label: 'Demain',       class: 'bg-blue-100 text-blue-700' };
  if (isPast(end))       return { label: 'Passé',        class: 'bg-gray-100 text-gray-500' };
  const days = differenceInDays(start, new Date());
  if (days <= 7)         return { label: `Dans ${days}j`, class: 'bg-orange-100 text-orange-700' };
  return null;
};

const agentCompleteness = (event) => {
  const assigned = event.assignedAgentsCount || 0;
  const required = event.requiredAgents || 1;
  const pct = Math.min(100, Math.round((assigned / required) * 100));
  if (pct >= 100) return { pct, icon: '✅', color: 'text-green-600', bar: 'bg-green-500', label: 'Complet' };
  if (pct >= 70)  return { pct, icon: '⚠️', color: 'text-orange-600', bar: 'bg-orange-400', label: 'Partiel' };
  return              { pct, icon: '🚨', color: 'text-red-600', bar: 'bg-red-500', label: 'Incomplet' };
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const PhaseBadge = ({ event }) => {
  const phase = computePhase(event);
  if (!phase) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${phase.color}`}>
      <span>{phase.icon}</span> {phase.label}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const cfg = getStatusConfig(status);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.class}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

const PriorityBadge = ({ priority }) => {
  const info = getPriorityInfo(priority);
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${info.bg} ${info.color} font-medium`}>
      <FiFlag size={10} />
      {info.label}
    </span>
  );
};

// ─── Stats Row ────────────────────────────────────────────────────────────────

const StatsRow = ({ events, loading, onRefresh, lastRefresh }) => {
  const stats = useMemo(() => {
    const total     = events.length;
    const active    = events.filter(e => e.status === 'active').length;
    const scheduled = events.filter(e => e.status === 'scheduled').length;
    const today     = events.filter(e => isToday(new Date(e.startDate))).length;
    const missing   = events.filter(e => (e.assignedAgentsCount || 0) < e.requiredAgents).length;
    const prep      = events.filter(e => {
      const p = computePhase(e);
      return p?.label === 'Préparation';
    }).length;
    const setup     = events.filter(e => {
      const p = computePhase(e);
      return p?.label === 'Mise en place';
    }).length;
    const checkin   = events.filter(e => {
      const p = computePhase(e);
      return p?.label === 'Pointage';
    }).length;
    return { total, active, scheduled, today, missing, prep, setup, checkin };
  }, [events]);

  const cards = [
    { label: 'Total',          value: stats.total,     icon: FiBarChart2,   color: 'text-gray-700',   bg: 'bg-gray-100',    border: 'border-gray-200' },
    { label: 'Actifs',         value: stats.active,    icon: FiActivity,    color: 'text-green-600',  bg: 'bg-green-50',    border: 'border-green-200' },
    { label: 'Planifiés',      value: stats.scheduled, icon: FiCalendar,    color: 'text-blue-600',   bg: 'bg-blue-50',     border: 'border-blue-200' },
    { label: "Aujourd'hui",    value: stats.today,     icon: FiStar,        color: 'text-emerald-600',bg: 'bg-emerald-50',  border: 'border-emerald-200' },
    { label: 'Agents manquants', value: stats.missing, icon: FiAlertTriangle, color: 'text-red-600',  bg: 'bg-red-50',      border: 'border-red-200', urgent: stats.missing > 0 },
    { label: 'Préparation',    value: stats.prep,      icon: FiZap,         color: 'text-blue-500',   bg: 'bg-blue-50',     border: 'border-blue-100' },
    { label: 'Mise en place',  value: stats.setup,     icon: FiLayers,      color: 'text-yellow-600', bg: 'bg-yellow-50',   border: 'border-yellow-200' },
    { label: 'Pointage',       value: stats.checkin,   icon: FiCheckCircle, color: 'text-green-500',  bg: 'bg-green-50',    border: 'border-green-100' },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tableau de bord temps réel</h2>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {lastRefresh && <span>Mis à jour {formatDistanceToNow(lastRefresh, { locale: fr, addSuffix: true })}</span>}
          <button onClick={onRefresh} disabled={loading}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Actualiser">
            <FiRefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {cards.map(({ label, value, icon: Icon, color, bg, border, urgent }) => (
          <div key={label}
            className={`relative rounded-xl border p-3 flex flex-col gap-1 transition-shadow hover:shadow-md ${bg} ${border} ${urgent ? 'ring-2 ring-red-300 animate-pulse' : ''}`}>
            <div className="flex items-center justify-between">
              <Icon size={16} className={color} />
              {urgent && <span className="w-2 h-2 rounded-full bg-red-500" />}
            </div>
            <p className={`text-2xl font-extrabold ${color}`}>
              {loading ? <span className="inline-block w-6 h-5 bg-gray-200 rounded animate-pulse" /> : value}
            </p>
            <p className="text-xs text-gray-500 leading-tight">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Event Card ───────────────────────────────────────────────────────────────

const EventCard = ({ event, onView, onEdit, onDelete, onDuplicate, onChronology }) => {
  const timeInd  = getTimeIndicator(event);
  const agents   = agentCompleteness(event);
  const phase    = computePhase(event);

  return (
    <div
      className={`group relative bg-white rounded-2xl border overflow-hidden cursor-pointer
        transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5
        ${agents.label === 'Incomplet' && event.status === 'active' ? 'border-red-300 shadow-red-100 shadow-md' : 'border-gray-100 shadow-sm'}`}
      onClick={() => onView(event)}
    >
      {/* Color top bar */}
      <div className="h-1.5" style={{ backgroundColor: event.color || '#3B82F6' }} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              {timeInd && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${timeInd.class}`}>
                  {timeInd.label}
                </span>
              )}
              <PhaseBadge event={event} />
            </div>
            <h3 className="font-bold text-gray-900 text-base leading-tight truncate">{event.name}</h3>
          </div>
          <StatusBadge status={event.status} />
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
            {TYPE_OPTIONS.find(t => t.value === event.type)?.icon} {TYPE_OPTIONS.find(t => t.value === event.type)?.label || event.type}
          </span>
          <PriorityBadge priority={event.priority} />
        </div>

        {/* Location */}
        <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-2">
          <FiMapPin size={13} className={event.latitude && event.longitude ? 'text-green-500' : 'text-gray-400'} />
          <span className="truncate">{event.location}</span>
          {event.latitude && event.longitude
            ? <span className="ml-auto flex-shrink-0 text-xs px-1.5 py-0.5 bg-green-100 text-green-600 rounded font-medium">GPS ✓</span>
            : <span className="ml-auto flex-shrink-0 text-xs px-1.5 py-0.5 bg-red-50 text-red-400 rounded font-medium">GPS ✕</span>
          }
        </div>

        {/* Dates */}
        <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-2">
          <FiCalendar size={13} className="text-gray-400" />
          <span>{format(new Date(event.startDate), 'dd MMM', { locale: fr })}</span>
          {event.startDate !== event.endDate && (
            <>
              <span className="text-gray-300">→</span>
              <span>{format(new Date(event.endDate), 'dd MMM yyyy', { locale: fr })}</span>
            </>
          )}
        </div>

        {/* Horaires */}
        <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-3">
          <FiClock size={13} className="text-gray-400" />
          <span>{event.checkInTime} — {event.checkOutTime}</span>
        </div>

        {/* Agents progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-sm mb-1">
            <div className="flex items-center gap-1.5">
              <FiUsers size={13} className="text-gray-400" />
              <span className={`font-semibold ${agents.color}`}>{event.assignedAgentsCount || 0}</span>
              <span className="text-gray-400">/</span>
              <span className="text-gray-600 font-medium">{event.requiredAgents}</span>
              <span className="text-gray-400 text-xs">agents</span>
            </div>
            <span className={`text-xs font-semibold ${agents.color}`}>{agents.icon} {agents.label}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full transition-all ${agents.bar}`} style={{ width: `${agents.pct}%` }} />
          </div>
        </div>

        {/* Zones */}
        {(event.totalZones != null) && (
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
            <FiLayers size={12} />
            <span>
              <span className="font-semibold text-gray-700">{event.completedZones || 0}</span>/{event.totalZones} zones complètes
            </span>
            {event.totalZones > 0 && (event.completedZones || 0) < event.totalZones && (
              <span className="text-orange-500 font-medium">·  {event.totalZones - (event.completedZones || 0)} incomplète(s)</span>
            )}
          </div>
        )}

        {/* Director */}
        {event.directorName && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
              {event.directorName[0]?.toUpperCase()}
            </div>
            <span className="truncate">{event.directorName}</span>
          </div>
        )}

        {/* Recurrence */}
        {event.recurrenceType && event.recurrenceType !== 'none' && (
          <div className="flex items-center gap-1.5 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-lg mb-3">
            <FiRepeat size={11} />
            {RECURRENCE_OPTIONS.find(r => r.value === event.recurrenceType)?.label}
          </div>
        )}

        {/* Phase progress bar (active only) */}
        {event.status === 'active' && phase && (
          <div className="mt-1">
            <div className={`h-1 rounded-full ${phase.bar} opacity-60`} />
          </div>
        )}
      </div>

      {/* Hover action overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-white border-t border-gray-100 px-3 py-2
        flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-2 group-hover:translate-y-0">
        <button onClick={e => { e.stopPropagation(); onView(event); }}
          className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Voir">
          <FiEye size={15} />
        </button>
        <button onClick={e => { e.stopPropagation(); onEdit(event); }}
          className="p-1.5 rounded-lg text-gray-500 hover:text-primary-600 hover:bg-primary-50 transition-colors" title="Modifier">
          <FiEdit2 size={15} />
        </button>
        <button onClick={e => { e.stopPropagation(); onDuplicate(event); }}
          className="p-1.5 rounded-lg text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition-colors" title="Dupliquer">
          <FiCopy size={15} />
        </button>
        <button onClick={e => { e.stopPropagation(); onChronology(event); }}
          className="p-1.5 rounded-lg text-gray-500 hover:text-orange-600 hover:bg-orange-50 transition-colors" title="Chronologie">
          <FiBarChart2 size={15} />
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete(event.id); }}
          className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors" title="Supprimer">
          <FiTrash2 size={15} />
        </button>
      </div>
    </div>
  );
};

// ─── Details Modal ────────────────────────────────────────────────────────────

const EventDetailsModal = ({ isOpen, onClose, event, onEdit, onDelete, onDuplicate, onChronology }) => {
  const [zones, setZones]       = useState([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [showZoneManager, setShowZoneManager] = useState(false);

  useEffect(() => {
    if (isOpen && event?.id) {
      setZonesLoading(true);
      zonesAPI.getByEvent(event.id)
        .then(r => setZones(r?.data?.data?.zones || []))
        .catch(() => setZones([]))
        .finally(() => setZonesLoading(false));
    }
  }, [isOpen, event?.id]);

  if (!isOpen || !event) return null;

  const priority = getPriorityInfo(event.priority);
  const agents   = agentCompleteness(event);
  const phase    = computePhase(event);
  const timeInd  = getTimeIndicator(event);

  const SUGGESTED_ZONES = ['Entrée principale', 'Sortie secours', 'Zone VIP', 'Parking'];

  if (showZoneManager) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-bold text-gray-800">Gestion des Zones — {event.name}</h3>
            <button onClick={() => setShowZoneManager(false)} className="p-2 hover:bg-gray-100 rounded-full">
              <FiX />
            </button>
          </div>
          <ZoneManager eventId={event.id} eventName={event.name} onClose={() => setShowZoneManager(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="relative p-6 text-white rounded-t-2xl overflow-hidden"
          style={{ backgroundColor: event.color || '#3B82F6' }}>
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)', backgroundSize: '12px 12px' }} />
          <div className="relative flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="px-2.5 py-1 bg-white bg-opacity-20 rounded-full text-sm font-medium">
                  {TYPE_OPTIONS.find(t => t.value === event.type)?.icon} {TYPE_OPTIONS.find(t => t.value === event.type)?.label}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-sm font-medium bg-white bg-opacity-20`}>
                  <FiFlag className="inline mr-1" size={11} />{priority.label}
                </span>
                {timeInd && (
                  <span className="px-2.5 py-1 bg-white bg-opacity-30 rounded-full text-sm font-bold">{timeInd.label}</span>
                )}
              </div>
              <h2 className="text-2xl font-extrabold leading-tight">{event.name}</h2>
              {phase && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm opacity-90">{phase.icon} Phase : <strong>{phase.label}</strong></span>
                </div>
              )}
            </div>
            <button onClick={onClose} className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full flex-shrink-0 transition-colors">
              <FiX size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">

          {/* Status row */}
          <div className="flex flex-wrap gap-2 items-center">
            <StatusBadge status={event.status} />
            {event.recurrenceType && event.recurrenceType !== 'none' && (
              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
                <FiRepeat size={11} />
                {RECURRENCE_OPTIONS.find(r => r.value === event.recurrenceType)?.label}
              </span>
            )}
          </div>

          {/* Description */}
          {event.description && (
            <div className="p-4 bg-gray-50 rounded-xl border-l-4 border-gray-300">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          {/* Key info grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: FiCalendar, label: 'Début',    val: format(new Date(event.startDate), 'dd MMM yyyy', { locale: fr }), bg: 'bg-blue-50', color: 'text-blue-500' },
              { icon: FiCalendar, label: 'Fin',      val: format(new Date(event.endDate),   'dd MMM yyyy', { locale: fr }), bg: 'bg-blue-50', color: 'text-blue-500' },
              { icon: FiClock,    label: 'Check-in', val: event.checkInTime, bg: 'bg-green-50',  color: 'text-green-500' },
              { icon: FiClock,    label: 'Check-out',val: event.checkOutTime, bg: 'bg-orange-50', color: 'text-orange-500' },
            ].map(({ icon: Icon, label, val, bg, color }) => (
              <div key={label} className={`${bg} p-3.5 rounded-xl text-center`}>
                <Icon className={`mx-auto mb-1.5 ${color}`} size={20} />
                <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                <p className="font-bold text-gray-800 text-sm">{val}</p>
              </div>
            ))}
          </div>

          {/* Location */}
          <div className="rounded-xl border overflow-hidden">
            <div className="flex items-center gap-2 p-3 bg-gray-50 border-b">
              <FiMapPin className="text-gray-500" size={16} />
              <span className="font-semibold text-gray-700 text-sm">Localisation</span>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-gray-700">{event.location}</p>
              {event.latitude && event.longitude && (
                <div className="rounded-xl overflow-hidden border">
                  <MiniMap latitude={event.latitude} longitude={event.longitude}
                    geoRadius={event.geoRadius} height="180px" draggable={false} />
                </div>
              )}
              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                {event.latitude && event.longitude
                  ? <span className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-lg font-medium">
                      <FiNavigation size={11} /> GPS: {parseFloat(event.latitude).toFixed(4)}, {parseFloat(event.longitude).toFixed(4)}
                    </span>
                  : <span className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded-lg">
                      <FiAlertCircle size={11} /> Coordonnées GPS manquantes
                    </span>
                }
                <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg">Rayon: {event.geoRadius || 100}m</span>
              </div>
            </div>
          </div>

          {/* Agents */}
          <div className="rounded-xl border overflow-hidden">
            <div className="flex items-center gap-2 p-3 bg-gray-50 border-b">
              <FiUsers className="text-gray-500" size={16} />
              <span className="font-semibold text-gray-700 text-sm">Agents</span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-gray-50 p-3 rounded-xl text-center">
                  <p className="text-2xl font-extrabold text-gray-700">{event.requiredAgents}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Requis</p>
                </div>
                <div className="bg-green-50 p-3 rounded-xl text-center">
                  <p className="text-2xl font-extrabold text-green-600">{event.assignedAgentsCount || 0}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Assignés</p>
                </div>
                <div className={`p-3 rounded-xl text-center ${agents.label === 'Complet' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <p className={`text-2xl font-extrabold ${agents.color}`}>
                    {(event.assignedAgentsCount || 0) - event.requiredAgents}
                  </p>
                  <p className={`text-xs mt-0.5 font-semibold ${agents.color}`}>{agents.label}</p>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className={`h-2 rounded-full transition-all ${agents.bar}`} style={{ width: `${agents.pct}%` }} />
              </div>
              <p className={`text-xs mt-1.5 font-medium ${agents.color}`}>{agents.pct}% — {agents.icon} {agents.label}</p>
            </div>
          </div>

          {/* Zones */}
          <div className="rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
              <div className="flex items-center gap-2">
                <FiLayers className="text-gray-500" size={16} />
                <span className="font-semibold text-gray-700 text-sm">Zones</span>
                {zones.length > 0 && (
                  <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-2">{zones.length}</span>
                )}
              </div>
              <button onClick={() => setShowZoneManager(true)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                <FiMaximize2 size={12} /> Gérer les zones
              </button>
            </div>
            <div className="p-4">
              {zonesLoading ? (
                <div className="flex justify-center py-4">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : zones.length === 0 ? (
                <div className="text-center py-4">
                  <FiLayers className="mx-auto text-gray-300 mb-2" size={32} />
                  <p className="text-sm text-gray-500 mb-3">Aucune zone configurée</p>
                  <p className="text-xs text-gray-400 mb-3">Zones suggérées :</p>
                  <div className="flex flex-wrap gap-2 justify-center mb-3">
                    {SUGGESTED_ZONES.map(z => (
                      <span key={z} className="text-xs px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-200">{z}</span>
                    ))}
                  </div>
                  <button onClick={() => setShowZoneManager(true)}
                    className="btn-primary text-sm flex items-center gap-1.5 mx-auto">
                    <FiPlus size={14} /> Créer des zones
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {zones.slice(0, 4).map(zone => (
                    <div key={zone.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-sm font-medium text-gray-700">{zone.name}</span>
                        <span className="text-xs text-gray-400">{zone.requiredAgents || 0} agents</span>
                      </div>
                      <StatusBadge status={zone.status || 'scheduled'} />
                    </div>
                  ))}
                  {zones.length > 4 && (
                    <button onClick={() => setShowZoneManager(true)}
                      className="w-full text-xs text-blue-600 hover:text-blue-800 py-2 text-center">
                      Voir {zones.length - 4} zones de plus →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Director */}
          {event.directorName && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                {event.directorName[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500">Directeur événement</p>
                <p className="font-semibold text-gray-800 truncate">{event.directorName}</p>
                {event.directorEmail && (
                  <p className="text-xs text-gray-400 flex items-center gap-1 truncate">
                    <FiMail size={10} /> {event.directorEmail}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Contact */}
          {(event.contactName || event.contactPhone) && (
            <div className="p-3 bg-blue-50 rounded-xl flex items-center gap-3">
              <FiPhone className="text-blue-500" />
              <div>
                <p className="text-xs text-blue-600 font-medium">Contact sur site</p>
                {event.contactName && <p className="text-sm font-semibold text-gray-800">{event.contactName}</p>}
                {event.contactPhone && <p className="text-sm text-gray-600">{event.contactPhone}</p>}
              </div>
            </div>
          )}

          {/* Notes */}
          {event.notes && (
            <div className="p-4 bg-yellow-50 rounded-xl border-l-4 border-yellow-400">
              <p className="text-xs font-semibold text-yellow-700 mb-1 uppercase tracking-wide">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{event.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t gap-3 flex-wrap">
            <div className="flex gap-2">
              <button onClick={() => { onClose(); onDuplicate(event); }}
                className="btn-secondary text-sm flex items-center gap-1.5">
                <FiCopy size={14} /> Dupliquer
              </button>
              <button onClick={() => { onClose(); onChronology(event); }}
                className="btn-secondary text-sm flex items-center gap-1.5">
                <FiBarChart2 size={14} /> Chronologie
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { onClose(); onDelete(event.id); }}
                className="btn-danger text-sm flex items-center gap-1.5">
                <FiTrash2 size={14} /> Supprimer
              </button>
              <button onClick={() => { onClose(); onEdit(event); }}
                className="btn-primary text-sm flex items-center gap-1.5">
                <FiEdit2 size={14} /> Modifier
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Create / Edit Modal ──────────────────────────────────────────────────────

const EventModal = ({ isOpen, onClose, event, onSave }) => {
  const today = new Date().toISOString().split('T')[0];
  const emptyForm = {
    name: '', description: '', type: 'regular', priority: 'medium',
    color: '#3B82F6', location: '', latitude: '', longitude: '', geoRadius: 100,
    startDate: today, endDate: today,
    checkInTime: '08:00', checkOutTime: '18:00',
    lateThreshold: 15, requiredAgents: 1,
    recurrenceType: 'none', recurrenceEndDate: '',
    notes: '', contactPhone: '', contactName: '',
    directorId: '', directorName: '', directorEmail: '',
    phase1Enabled: false, phase1StartDate: '', phase1EndDate: '',
    phase1StartTime: '', phase1EndTime: '', phase1ResponsibleId: '', phase1Instructions: '',
    phase2Enabled: false, phase2StartDate: '', phase2EndDate: '',
    phase2StartTime: '', phase2EndTime: '', phase2ResponsibleId: '', phase2Instructions: '', phase2ZoneIds: [],
  };

  const [formData, setFormData] = useState(emptyForm);
  const [loading,  setLoading]  = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [responsibleUsers, setResponsibleUsers] = useState([]);
  const [eventZones, setEventZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const normalizeUsers = useCallback((payload) => {
    const rawUsers =
      payload?.data?.data?.users ||
      (Array.isArray(payload?.data?.data) ? payload.data.data : null) ||
      payload?.data?.users ||
      (Array.isArray(payload?.data) ? payload.data : null) ||
      [];
    if (!Array.isArray(rawUsers)) return [];

    return rawUsers
      .filter(user => user && user.id)
      .sort((left, right) => {
        const leftName = `${left.firstName || ''} ${left.lastName || ''}`.trim();
        const rightName = `${right.firstName || ''} ${right.lastName || ''}`.trim();
        return leftName.localeCompare(rightName, 'fr', { sensitivity: 'base' });
      });
  }, []);

  const normalizeZones = useCallback((payload) => {
    const rawZones = payload?.data?.data?.zones || payload?.data?.data || payload?.data?.zones || [];
    return Array.isArray(rawZones) ? rawZones.filter(zone => zone && zone.id) : [];
  }, []);

  useEffect(() => {
    if (isOpen) {
      usersAPI.getAll({ limit: 9999 })
        .then(response => {
          const users = normalizeUsers(response);
          setResponsibleUsers(users);
        })
        .catch(err => {
          console.error('Erreur chargement utilisateurs pour le directeur:', err);
          setResponsibleUsers([]);
        });
    }
  }, [isOpen, normalizeUsers]);

  useEffect(() => {
    if (!isOpen) return;

    if (!event?.id) {
      setEventZones([]);
      return;
    }

    let cancelled = false;

    const loadEventDetails = async () => {
      setZonesLoading(true);
      try {
        const [eventResponse, zonesResponse] = await Promise.all([
          eventsAPI.getById(event.id),
          zonesAPI.getByEvent(event.id),
        ]);

        if (cancelled) return;

        const fullEvent = eventResponse?.data?.data || event;
        const selectedZoneIds = Array.isArray(fullEvent?.setupZonesConfirmed)
          ? fullEvent.setupZonesConfirmed.map(String)
          : [];

        setEventZones(normalizeZones(zonesResponse));
        setFormData(previous => ({
          ...previous,
          ...fullEvent,
          startDate: fullEvent.startDate?.split('T')[0] || today,
          endDate: fullEvent.endDate?.split('T')[0] || today,
          priority: fullEvent.priority || 'medium',
          color: fullEvent.color || '#3B82F6',
          recurrenceType: fullEvent.recurrenceType || 'none',
          recurrenceEndDate: fullEvent.recurrenceEndDate?.split('T')[0] || '',
          contactPhone: fullEvent.contactPhone || '',
          contactName: fullEvent.contactName || '',
          directorId: fullEvent.supervisorId || fullEvent.directorId || '',
          directorName: fullEvent.supervisor
            ? `${fullEvent.supervisor.firstName || ''} ${fullEvent.supervisor.lastName || ''}`.trim()
            : fullEvent.directorName || '',
          directorEmail: fullEvent.supervisor?.email || fullEvent.directorEmail || '',
          phase1Enabled: Boolean(
            fullEvent.preparationStartDate || fullEvent.preparationEndDate ||
            fullEvent.preparationStartTime || fullEvent.preparationEndTime ||
            fullEvent.preparationResponsableId || fullEvent.preparationObservations
          ),
          phase1StartDate: fullEvent.preparationStartDate || '',
          phase1EndDate: fullEvent.preparationEndDate || '',
          phase1StartTime: fullEvent.preparationStartTime || '',
          phase1EndTime: fullEvent.preparationEndTime || '',
          phase1ResponsibleId: fullEvent.preparationResponsableId || '',
          phase1Instructions: fullEvent.preparationObservations || '',
          phase2Enabled: Boolean(
            fullEvent.setupStartDate || fullEvent.setupEndDate ||
            fullEvent.setupStartTime || fullEvent.setupEndTime ||
            fullEvent.setupResponsableId || fullEvent.setupObservations || selectedZoneIds.length
          ),
          phase2StartDate: fullEvent.setupStartDate || '',
          phase2EndDate: fullEvent.setupEndDate || '',
          phase2StartTime: fullEvent.setupStartTime || '',
          phase2EndTime: fullEvent.setupEndTime || '',
          phase2ResponsibleId: fullEvent.setupResponsableId || '',
          phase2Instructions: fullEvent.setupObservations || '',
          phase2ZoneIds: selectedZoneIds,
        }));
      } catch {
        if (!cancelled) {
          setEventZones([]);
        }
      } finally {
        if (!cancelled) {
          setZonesLoading(false);
        }
      }
    };

    loadEventDetails();

    return () => {
      cancelled = true;
    };
  }, [event, isOpen, normalizeZones, today]);

  useEffect(() => {
    if (event) {
      setFormData({
        ...emptyForm,
        ...event,
        startDate:        event.startDate?.split('T')[0] || today,
        endDate:          event.endDate?.split('T')[0]   || today,
        priority:         event.priority || 'medium',
        color:            event.color || '#3B82F6',
        recurrenceType:   event.recurrenceType || 'none',
        recurrenceEndDate: event.recurrenceEndDate?.split('T')[0] || '',
        contactPhone:     event.contactPhone || '',
        contactName:      event.contactName  || '',
        directorId:       event.supervisorId || event.directorId || '',
        directorName:     event.supervisor ? `${event.supervisor.firstName || ''} ${event.supervisor.lastName || ''}`.trim() : (event.directorName || ''),
        directorEmail:    event.supervisor?.email || event.directorEmail || '',
        phase1Enabled: Boolean(
          event.preparationStartDate || event.preparationEndDate ||
          event.preparationStartTime || event.preparationEndTime ||
          event.preparationResponsableId || event.preparationObservations
        ),
        phase1StartDate: event.preparationStartDate || '',
        phase1EndDate: event.preparationEndDate || '',
        phase1StartTime: event.preparationStartTime || '',
        phase1EndTime: event.preparationEndTime || '',
        phase1ResponsibleId: event.preparationResponsableId || '',
        phase1Instructions: event.preparationObservations || '',
        phase2Enabled: Boolean(
          event.setupStartDate || event.setupEndDate ||
          event.setupStartTime || event.setupEndTime ||
          event.setupResponsableId || event.setupObservations || event.setupZonesConfirmed?.length
        ),
        phase2StartDate: event.setupStartDate || '',
        phase2EndDate: event.setupEndDate || '',
        phase2StartTime: event.setupStartTime || '',
        phase2EndTime: event.setupEndTime || '',
        phase2ResponsibleId: event.setupResponsableId || '',
        phase2Instructions: event.setupObservations || '',
        phase2ZoneIds: Array.isArray(event.setupZonesConfirmed) ? event.setupZonesConfirmed.map(String) : [],
      });
    } else {
      setFormData(emptyForm);
      setEventZones([]);
    }
    setActiveTab('basic');
    setErrors({});
  }, [event, isOpen]);

  const set = (key, val) => setFormData(p => ({ ...p, [key]: val }));

  const validate = () => {
    const e = {};
    if (!formData.name.trim())     e.name = 'Le nom est requis';
    if (!formData.location.trim()) e.location = "L'adresse est requise";
    if (!formData.startDate)       e.startDate = 'La date de début est requise';
    if (!formData.endDate)         e.endDate = 'La date de fin est requise';
    if (formData.endDate < formData.startDate) e.endDate = 'La date de fin doit être après le début';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) { setActiveTab('basic'); return; }
    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        priority: formData.priority,
        color: formData.color,
        location: formData.location,
        latitude: formData.latitude || null,
        longitude: formData.longitude || null,
        geoRadius: formData.geoRadius,
        startDate: formData.startDate,
        endDate: formData.endDate,
        checkInTime: formData.checkInTime,
        checkOutTime: formData.checkOutTime,
        lateThreshold: formData.lateThreshold,
        requiredAgents: formData.requiredAgents,
        recurrenceType: formData.recurrenceType,
        recurrenceEndDate: formData.recurrenceType !== 'none' ? (formData.recurrenceEndDate || null) : null,
        notes: formData.notes,
        contactPhone: formData.contactPhone,
        contactName: formData.contactName,
        supervisorId: formData.directorId || null,
        preparationStartDate: formData.phase1Enabled ? (formData.phase1StartDate || null) : null,
        preparationEndDate: formData.phase1Enabled ? (formData.phase1EndDate || null) : null,
        preparationStartTime: formData.phase1Enabled ? (formData.phase1StartTime || null) : null,
        preparationEndTime: formData.phase1Enabled ? (formData.phase1EndTime || null) : null,
        preparationResponsableId: formData.phase1Enabled ? (formData.phase1ResponsibleId || null) : null,
        preparationObservations: formData.phase1Enabled ? (formData.phase1Instructions || null) : null,
        setupStartDate: formData.phase2Enabled ? (formData.phase2StartDate || null) : null,
        setupEndDate: formData.phase2Enabled ? (formData.phase2EndDate || null) : null,
        setupStartTime: formData.phase2Enabled ? (formData.phase2StartTime || null) : null,
        setupEndTime: formData.phase2Enabled ? (formData.phase2EndTime || null) : null,
        setupResponsableId: formData.phase2Enabled ? (formData.phase2ResponsibleId || null) : null,
        setupObservations: formData.phase2Enabled ? (formData.phase2Instructions || null) : null,
        setupZonesConfirmed: formData.phase2Enabled ? formData.phase2ZoneIds : [],
      };

      if (event) {
        await eventsAPI.update(event.id, payload);
        toast.success('Événement mis à jour ✓');
      } else {
        await eventsAPI.create(payload);
        toast.success('Événement créé ✓');
      }
      onSave();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const TABS = [
    { id: 'basic',    label: 'Infos de base',   icon: FiInfo },
    { id: 'location', label: 'Localisation',    icon: FiMapPin },
    { id: 'schedule', label: 'Dates & Horaires',icon: FiCalendar },
    { id: 'phases',   label: 'Phases',          icon: FiActivity },
    { id: 'advanced', label: 'Avancé',          icon: FiZap },
  ];

  const selectedDirector = responsibleUsers.find(user => String(user.id) === String(formData.directorId));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[94vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between flex-shrink-0 rounded-t-2xl"
          style={{ backgroundColor: formData.color + '15', borderColor: formData.color + '30' }}>
          <div className="flex items-center gap-3">
            <div className="w-1 h-12 rounded-full" style={{ backgroundColor: formData.color }} />
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                {event ? 'Modifier l\'événement' : 'Nouvel événement'}
              </h2>
              <p className="text-sm text-gray-500">{event ? event.name : 'Remplissez les informations ci-dessous'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <FiX size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50 flex-shrink-0 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                ${activeTab === id
                  ? 'border-current text-blue-600 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
              style={activeTab === id ? { borderBottomColor: formData.color } : {}}>
              <Icon size={14} /> {label}
              {(id === 'basic' && (errors.name)) ||
               (id === 'location' && errors.location) ||
               (id === 'schedule' && (errors.startDate || errors.endDate))
                ? <span className="w-2 h-2 rounded-full bg-red-500" /> : null}
            </button>
          ))}
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">

            {/* TAB: Infos de base */}
            {activeTab === 'basic' && (
              <>
                <div>
                  <label className="label">Nom de l'événement *</label>
                  <input value={formData.name} onChange={e => set('name', e.target.value)}
                    className={`input text-lg font-medium ${errors.name ? 'border-red-400' : ''}`}
                    placeholder="Ex: Surveillance Centre Commercial" />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="label">Description</label>
                  <textarea value={formData.description} onChange={e => set('description', e.target.value)}
                    className="input resize-none" rows="3"
                    placeholder="Décrivez l'événement, consignes spéciales..." />
                  <p className="text-xs text-gray-400 mt-1">{(formData.description || '').length}/500</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label">Type *</label>
                    <select value={formData.type} onChange={e => set('type', e.target.value)} className="input">
                      {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Priorité</label>
                    <select value={formData.priority} onChange={e => set('priority', e.target.value)}
                      className={`input font-medium ${getPriorityInfo(formData.priority).color}`}>
                      {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Couleur</label>
                    <div className="flex gap-2 flex-wrap pt-1">
                      {EVENT_COLORS.map(c => (
                        <button key={c.value} type="button" onClick={() => set('color', c.value)}
                          className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${formData.color === c.value ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                          style={{ backgroundColor: c.value }} title={c.name} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Director */}
                <div>
                  <label className="label flex items-center gap-1.5"><FiShield size={13} /> Directeur événement</label>
                  <select value={formData.directorId} onChange={e => {
                    const a = responsibleUsers.find(user => String(user.id) === String(e.target.value));
                    setFormData(p => ({ ...p, directorId: e.target.value, directorName: a ? `${a.firstName} ${a.lastName}` : '', directorEmail: a?.email || '' }));
                  }} className="input">
                    <option value="">— Sélectionner un responsable —</option>
                    {responsibleUsers.map(user => (
                      <option key={user.id} value={user.id}>{user.firstName} {user.lastName} ({user.role})</option>
                    ))}
                  </select>
                  {selectedDirector && (
                    <div className="mt-2 flex items-center gap-3 p-2.5 bg-blue-50 rounded-xl">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                        {selectedDirector.firstName?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{selectedDirector.firstName} {selectedDirector.lastName}</p>
                        <p className="text-xs text-gray-500">{selectedDirector.email}</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* TAB: Localisation */}
            {activeTab === 'location' && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <AddressAutocomplete
                      value={formData.location}
                      onChange={val => set('location', val)}
                      onCoordinatesChange={coords => {
                        if (coords) {
                          setFormData(p => ({ ...p, latitude: coords.latitude, longitude: coords.longitude }));
                          toast.success('Coordonnées GPS détectées ✓');
                        }
                      }}
                      label="Adresse *"
                      placeholder="Rechercher une adresse..."
                      required
                      initialCoordinates={formData.latitude && formData.longitude
                        ? { lat: parseFloat(formData.latitude), lng: parseFloat(formData.longitude) }
                        : null}
                    />
                    {errors.location && <p className="text-red-500 text-xs">{errors.location}</p>}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="label text-xs">Latitude {formData.latitude && <FiCheck className="inline text-green-500" size={10} />}</label>
                        <input value={formData.latitude} onChange={e => set('latitude', e.target.value)}
                          className={`input text-sm ${formData.latitude ? 'bg-green-50 border-green-300' : ''}`} placeholder="Auto" />
                      </div>
                      <div>
                        <label className="label text-xs">Longitude {formData.longitude && <FiCheck className="inline text-green-500" size={10} />}</label>
                        <input value={formData.longitude} onChange={e => set('longitude', e.target.value)}
                          className={`input text-sm ${formData.longitude ? 'bg-green-50 border-green-300' : ''}`} placeholder="Auto" />
                      </div>
                      <div>
                        <label className="label text-xs">Rayon (m)</label>
                        <input type="number" value={formData.geoRadius}
                          onChange={e => set('geoRadius', parseInt(e.target.value) || 100)}
                          className="input text-sm" min="10" max="2000" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <MiniMap latitude={formData.latitude} longitude={formData.longitude}
                      geoRadius={formData.geoRadius} height="220px" draggable={true}
                      onPositionChange={coords => setFormData(p => ({
                        ...p,
                        latitude: coords.latitude.toFixed(6),
                        longitude: coords.longitude.toFixed(6),
                      }))} />
                  </div>
                </div>
              </>
            )}

            {/* TAB: Dates & Horaires */}
            {activeTab === 'schedule' && (
              <>
                <div className="p-4 bg-blue-50 rounded-xl space-y-4 border border-blue-100">
                  <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2">
                    <FiCalendar /> Phase 3 — Pointage (obligatoire)
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="label">Date début *</label>
                      <input type="date" value={formData.startDate}
                        onChange={e => set('startDate', e.target.value)}
                        className={`input ${errors.startDate ? 'border-red-400' : ''}`} required />
                      {errors.startDate && <p className="text-red-400 text-xs mt-1">{errors.startDate}</p>}
                    </div>
                    <div>
                      <label className="label">Date fin *</label>
                      <input type="date" value={formData.endDate}
                        onChange={e => set('endDate', e.target.value)}
                        className={`input ${errors.endDate ? 'border-red-400' : ''}`}
                        min={formData.startDate} required />
                      {errors.endDate && <p className="text-red-400 text-xs mt-1">{errors.endDate}</p>}
                    </div>
                    <div>
                      <label className="label">Heure arrivée *</label>
                      <input type="time" value={formData.checkInTime}
                        onChange={e => set('checkInTime', e.target.value)} className="input" required />
                    </div>
                    <div>
                      <label className="label">Heure départ *</label>
                      <input type="time" value={formData.checkOutTime}
                        onChange={e => set('checkOutTime', e.target.value)} className="input" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Tolérance retard (min)</label>
                      <div className="flex items-center gap-3">
                        <input type="range" min="0" max="60" value={formData.lateThreshold}
                          onChange={e => set('lateThreshold', parseInt(e.target.value))} className="flex-1" />
                        <span className="w-12 text-center font-bold text-gray-700 bg-gray-100 rounded py-1 text-sm">
                          {formData.lateThreshold}m
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="label">Fenêtre check-in (min avant)</label>
                      <div className="flex items-center gap-3">
                        <input type="range" min="0" max="60" value={formData.checkInWindow || 30}
                          onChange={e => set('checkInWindow', parseInt(e.target.value))} className="flex-1" />
                        <span className="w-12 text-center font-bold text-gray-700 bg-gray-100 rounded py-1 text-sm">
                          {formData.checkInWindow || 30}m
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="label">Agents requis *</label>
                    <div className="flex items-center gap-3">
                      <button type="button"
                        onClick={() => set('requiredAgents', Math.max(1, formData.requiredAgents - 1))}
                        className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-300 font-bold">−</button>
                      <span className="text-2xl font-extrabold text-gray-800 w-12 text-center">{formData.requiredAgents}</span>
                      <button type="button"
                        onClick={() => set('requiredAgents', formData.requiredAgents + 1)}
                        className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white hover:bg-blue-600 font-bold">+</button>
                      <FiUsers className="text-gray-400" />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* TAB: Phases */}
            {activeTab === 'phases' && (
              <>
                {/* Phase 1 */}
                <div className="border rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between p-3 bg-blue-50 border-b border-blue-100">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600">🛠️</span>
                      <span className="font-semibold text-blue-800 text-sm">Phase 1 — Préparation</span>
                      <span className="text-xs text-blue-500 bg-blue-100 px-2 py-0.5 rounded-full">Optionnel</span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div className={`w-10 h-5 rounded-full transition-colors relative ${formData.phase1Enabled ? 'bg-blue-500' : 'bg-gray-300'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${formData.phase1Enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </div>
                      <input type="checkbox" checked={formData.phase1Enabled}
                        onChange={e => set('phase1Enabled', e.target.checked)} className="sr-only" />
                    </label>
                  </div>
                  {formData.phase1Enabled && (
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div><label className="label text-xs">Date début</label>
                          <input type="date" value={formData.phase1StartDate} onChange={e => set('phase1StartDate', e.target.value)} className="input text-sm" /></div>
                        <div><label className="label text-xs">Date fin</label>
                          <input type="date" value={formData.phase1EndDate} onChange={e => set('phase1EndDate', e.target.value)} className="input text-sm" /></div>
                        <div><label className="label text-xs">Heure début</label>
                          <input type="time" value={formData.phase1StartTime} onChange={e => set('phase1StartTime', e.target.value)} className="input text-sm" /></div>
                        <div><label className="label text-xs">Heure fin</label>
                          <input type="time" value={formData.phase1EndTime} onChange={e => set('phase1EndTime', e.target.value)} className="input text-sm" /></div>
                      </div>
                      <div>
                        <label className="label text-xs">Responsable</label>
                        <select value={formData.phase1ResponsibleId} onChange={e => set('phase1ResponsibleId', e.target.value)} className="input text-sm">
                          <option value="">— Sélectionner —</option>
                          {responsibleUsers.map(user => <option key={user.id} value={user.id}>{user.firstName} {user.lastName} ({user.role})</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label text-xs">Instructions</label>
                        <textarea value={formData.phase1Instructions} onChange={e => set('phase1Instructions', e.target.value)}
                          className="input text-sm resize-none" rows="2" placeholder="Instructions phase préparation..." />
                      </div>
                    </div>
                  )}
                </div>

                {/* Phase 2 */}
                <div className="border rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between p-3 bg-yellow-50 border-b border-yellow-100">
                    <div className="flex items-center gap-2">
                      <span>📦</span>
                      <span className="font-semibold text-yellow-800 text-sm">Phase 2 — Mise en place</span>
                      <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full">Optionnel</span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div className={`w-10 h-5 rounded-full transition-colors relative ${formData.phase2Enabled ? 'bg-yellow-500' : 'bg-gray-300'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${formData.phase2Enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </div>
                      <input type="checkbox" checked={formData.phase2Enabled}
                        onChange={e => set('phase2Enabled', e.target.checked)} className="sr-only" />
                    </label>
                  </div>
                  {formData.phase2Enabled && (
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div><label className="label text-xs">Date début</label>
                          <input type="date" value={formData.phase2StartDate} onChange={e => set('phase2StartDate', e.target.value)} className="input text-sm" /></div>
                        <div><label className="label text-xs">Date fin</label>
                          <input type="date" value={formData.phase2EndDate} onChange={e => set('phase2EndDate', e.target.value)} className="input text-sm" /></div>
                        <div><label className="label text-xs">Heure début</label>
                          <input type="time" value={formData.phase2StartTime} onChange={e => set('phase2StartTime', e.target.value)} className="input text-sm" /></div>
                        <div><label className="label text-xs">Heure fin</label>
                          <input type="time" value={formData.phase2EndTime} onChange={e => set('phase2EndTime', e.target.value)} className="input text-sm" /></div>
                      </div>
                      <div>
                        <label className="label text-xs">Responsable principal</label>
                        <select value={formData.phase2ResponsibleId} onChange={e => set('phase2ResponsibleId', e.target.value)} className="input text-sm">
                          <option value="">— Sélectionner —</option>
                          {responsibleUsers.map(user => <option key={user.id} value={user.id}>{user.firstName} {user.lastName} ({user.role})</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <label className="label text-xs mb-0">Zones concernées</label>
                          {formData.phase2ZoneIds.length > 0 && (
                            <span className="text-[11px] text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
                              {formData.phase2ZoneIds.length} zone(s) sélectionnée(s)
                            </span>
                          )}
                        </div>
                        {!event?.id ? (
                          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                            Créez d'abord l'événement, puis rouvrez-le pour sélectionner plusieurs zones de mise en place.
                          </div>
                        ) : zonesLoading ? (
                          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                            Chargement des zones de l'événement...
                          </div>
                        ) : eventZones.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
                            Aucune zone liée à cet événement pour le moment.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {eventZones.map(zone => {
                              const checked = formData.phase2ZoneIds.includes(String(zone.id));
                              return (
                                <label key={zone.id} className={`flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${checked ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const zoneId = String(zone.id);
                                      setFormData(previous => ({
                                        ...previous,
                                        phase2ZoneIds: e.target.checked
                                          ? [...previous.phase2ZoneIds, zoneId]
                                          : previous.phase2ZoneIds.filter(id => id !== zoneId),
                                      }));
                                    }}
                                    className="mt-0.5"
                                  />
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">{zone.name}</p>
                                    {zone.description && <p className="text-xs text-gray-500 truncate">{zone.description}</p>}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="label text-xs">Instructions</label>
                        <textarea value={formData.phase2Instructions} onChange={e => set('phase2Instructions', e.target.value)}
                          className="input text-sm resize-none" rows="2" placeholder="Instructions phase mise en place..." />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* TAB: Avancé */}
            {activeTab === 'advanced' && (
              <>
                {/* Récurrence */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><FiRepeat size={14} /> Récurrence</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label text-xs">Type</label>
                      <select value={formData.recurrenceType} onChange={e => set('recurrenceType', e.target.value)} className="input">
                        {RECURRENCE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>
                    {formData.recurrenceType !== 'none' && (
                      <div>
                        <label className="label text-xs">Fin de récurrence</label>
                        <input type="date" value={formData.recurrenceEndDate}
                          onChange={e => set('recurrenceEndDate', e.target.value)}
                          className="input" min={formData.endDate} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Contact sur site */}
                <div className="space-y-3 border-t pt-4">
                  <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><FiPhone size={14} /> Contact sur site</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label text-xs">Nom du contact</label>
                      <input value={formData.contactName} onChange={e => set('contactName', e.target.value)}
                        className="input" placeholder="M. Dupont" />
                    </div>
                    <div>
                      <label className="label text-xs">Téléphone</label>
                      <input type="tel" value={formData.contactPhone} onChange={e => set('contactPhone', e.target.value)}
                        className="input" placeholder="06 12 34 56 78" />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2 border-t pt-4">
                  <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><FiBookmark size={14} /> Notes & Instructions</h3>
                  <textarea value={formData.notes} onChange={e => set('notes', e.target.value)}
                    className="input resize-none" rows="4"
                    placeholder="Instructions spéciales, codes d'accès, consignes de sécurité..." />
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex justify-between items-center gap-3 border-t pt-4 flex-shrink-0">
            <div className="flex gap-2">
              {TABS.findIndex(t => t.id === activeTab) > 0 && (
                <button type="button"
                  onClick={() => setActiveTab(TABS[TABS.findIndex(t => t.id === activeTab) - 1].id)}
                  className="btn-secondary text-sm">← Précédent</button>
              )}
              {TABS.findIndex(t => t.id === activeTab) < TABS.length - 1 && (
                <button type="button"
                  onClick={() => setActiveTab(TABS[TABS.findIndex(t => t.id === activeTab) + 1].id)}
                  className="btn-secondary text-sm">Suivant →</button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
              <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enregistrement...</>
                  : <><FiCheck /> {event ? 'Mettre à jour' : 'Créer l\'événement'}</>
                }
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Filters Panel ────────────────────────────────────────────────────────────

const FiltersPanel = ({ filters, onChange, onClear, onApply, onClose }) => {
  const [local, setLocal] = useState(filters);
  const set = (k, v) => setLocal(p => ({ ...p, [k]: v }));

  return (
    <div className="bg-white rounded-2xl border shadow-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800 flex items-center gap-2"><FiFilter size={15} /> Filtres avancés</h3>
        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full"><FiX size={16} /></button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <label className="label text-xs">Statut</label>
          <select value={local.status} onChange={e => set('status', e.target.value)} className="input">
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-xs">Type</label>
          <select value={local.type} onChange={e => set('type', e.target.value)} className="input">
            <option value="">Tous les types</option>
            {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-xs">Priorité</label>
          <select value={local.priority} onChange={e => set('priority', e.target.value)} className="input">
            <option value="">Toutes priorités</option>
            {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-xs">Période</label>
          <select value={local.dateRange} onChange={e => set('dateRange', e.target.value)} className="input">
            <option value="">Toutes les dates</option>
            <option value="today">Aujourd'hui</option>
            <option value="tomorrow">Demain</option>
            <option value="week">Cette semaine</option>
            <option value="month">Ce mois</option>
            <option value="custom">Personnalisé</option>
          </select>
        </div>
        {local.dateRange === 'custom' && (
          <>
            <div>
              <label className="label text-xs">Date début</label>
              <input type="date" value={local.customStart} onChange={e => set('customStart', e.target.value)} className="input" />
            </div>
            <div>
              <label className="label text-xs">Date fin</label>
              <input type="date" value={local.customEnd} onChange={e => set('customEnd', e.target.value)} className="input" />
            </div>
          </>
        )}
        <div>
          <label className="label text-xs">Agents manquants</label>
          <select value={local.missingAgents} onChange={e => set('missingAgents', e.target.value)} className="input">
            <option value="">Tous</option>
            <option value="yes">Avec agents manquants</option>
            <option value="no">Complets uniquement</option>
          </select>
        </div>
      </div>

      <div className="flex justify-between items-center pt-2 border-t">
        <button onClick={() => { setLocal({ status: '', type: '', priority: '', dateRange: '', customStart: '', customEnd: '', missingAgents: '' }); onClear(); }}
          className="text-sm text-gray-500 hover:text-red-600 flex items-center gap-1">
          <FiX size={13} /> Effacer tout
        </button>
        <button onClick={() => { onApply(local); onClose(); }}
          className="btn-primary text-sm flex items-center gap-1.5">
          <FiCheck size={13} /> Appliquer
        </button>
      </div>
    </div>
  );
};

// ─── List View ────────────────────────────────────────────────────────────────

const EventListRow = ({ event, onView, onEdit, onDelete, onDuplicate }) => {
  const agents = agentCompleteness(event);
  const phase  = computePhase(event);

  return (
    <tr className="hover:bg-gray-50 cursor-pointer group transition-colors" onClick={() => onView(event)}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: event.color || '#3B82F6' }} />
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{event.name}</p>
            <p className="text-xs text-gray-500 truncate">{TYPE_OPTIONS.find(t => t.value === event.type)?.icon} {event.type}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <div className="flex items-center gap-1.5 text-sm text-gray-600 max-w-[180px]">
          <FiMapPin size={12} className={event.latitude && event.longitude ? 'text-green-500' : 'text-gray-300'} />
          <span className="truncate">{event.location}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
        {format(new Date(event.startDate), 'dd MMM yyyy', { locale: fr })}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell whitespace-nowrap">
        {event.checkInTime} — {event.checkOutTime}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-bold ${agents.color}`}>{event.assignedAgentsCount || 0}/{event.requiredAgents}</span>
          <span className="text-sm">{agents.icon}</span>
        </div>
      </td>
      <td className="px-4 py-3 hidden xl:table-cell">
        {phase && <PhaseBadge event={event} />}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={event.status} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={e => { e.stopPropagation(); onView(event); }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50" title="Voir">
            <FiEye size={14} />
          </button>
          <button onClick={e => { e.stopPropagation(); onEdit(event); }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50" title="Modifier">
            <FiEdit2 size={14} />
          </button>
          <button onClick={e => { e.stopPropagation(); onDuplicate(event); }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50" title="Dupliquer">
            <FiCopy size={14} />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(event.id); }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50" title="Supprimer">
            <FiTrash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
};

// ─── Main Events Page ─────────────────────────────────────────────────────────

const Events = () => {
  const navigate = useNavigate();
  const [events,         setEvents]         = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState('');
  const [filters,        setFilters]        = useState({
    status: '', type: '', priority: '', dateRange: '',
    customStart: '', customEnd: '', missingAgents: '',
  });
  const [showFilters,    setShowFilters]    = useState(false);
  const [viewMode,       setViewMode]       = useState('grid');
  const [modalOpen,      setModalOpen]      = useState(false);
  const [detailsOpen,    setDetailsOpen]    = useState(false);
  const [selectedEvent,  setSelectedEvent]  = useState(null);
  const [lastRefresh,    setLastRefresh]    = useState(null);

  const searchDebounce = useRef(null);
  const autoRefresh    = useRef(null);

  // ── Fetch ──

  const buildParams = useCallback((currentSearch, currentFilters) => {
    const params = {};
    if (currentSearch)         params.search   = currentSearch;
    if (currentFilters.status) params.status   = currentFilters.status;
    if (currentFilters.type)   params.type     = currentFilters.type;
    if (currentFilters.priority) params.priority = currentFilters.priority;

    const now   = new Date();
    switch (currentFilters.dateRange) {
      case 'today':
        params.startDate = format(startOfDay(now), 'yyyy-MM-dd');
        params.endDate   = format(endOfDay(now),   'yyyy-MM-dd');
        break;
      case 'tomorrow': {
        const tom = addDays(now, 1);
        params.startDate = format(startOfDay(tom), 'yyyy-MM-dd');
        params.endDate   = format(endOfDay(tom),   'yyyy-MM-dd');
        break;
      }
      case 'week':
        params.startDate = format(startOfWeek(now, { locale: fr }), 'yyyy-MM-dd');
        params.endDate   = format(endOfWeek(now,   { locale: fr }), 'yyyy-MM-dd');
        break;
      case 'month':
        params.startDate = format(startOfMonth(now), 'yyyy-MM-dd');
        params.endDate   = format(endOfMonth(now),   'yyyy-MM-dd');
        break;
      case 'custom':
        if (currentFilters.customStart) params.startDate = currentFilters.customStart;
        if (currentFilters.customEnd)   params.endDate   = currentFilters.customEnd;
        break;
      default: break;
    }
    return params;
  }, []);

  const fetchEvents = useCallback(async (s = search, f = filters) => {
    try {
      setLoading(true);
      const params = buildParams(s, f);
      const res    = await eventsAPI.getAll(params);
      let data     = res?.data?.data?.events || [];

      // Client-side filter: missing agents
      if (f.missingAgents === 'yes') data = data.filter(e => (e.assignedAgentsCount || 0) < e.requiredAgents);
      if (f.missingAgents === 'no')  data = data.filter(e => (e.assignedAgentsCount || 0) >= e.requiredAgents);

      setEvents(data);
      setLastRefresh(new Date());
    } catch {
      toast.error('Erreur lors du chargement des événements');
    } finally {
      setLoading(false);
    }
  }, [search, filters, buildParams]);

  // Debounced search
  const handleSearchChange = (val) => {
    setSearch(val);
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => fetchEvents(val, filters), 300);
  };

  // Auto-refresh every 30s
  useEffect(() => {
    fetchEvents();
    autoRefresh.current = setInterval(() => fetchEvents(), 30000);
    return () => {
      clearInterval(autoRefresh.current);
      clearTimeout(searchDebounce.current);
    };
  }, []);

  useEffect(() => {
    fetchEvents(search, filters);
  }, [filters]);

  // ── Actions ──

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cet événement ? Cette action est irréversible.')) return;
    try {
      await eventsAPI.delete(id);
      toast.success('Événement supprimé');
      fetchEvents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const handleDuplicate = (event) => {
    setSelectedEvent({
      ...event,
      id: undefined,
      name: `${event.name} (copie)`,
      status: 'draft',
      startDate: new Date().toISOString().split('T')[0],
      endDate:   new Date().toISOString().split('T')[0],
    });
    setModalOpen(true);
  };

  const handleChronology = (event) => {
    navigate(`/events/${event.id}/chronology`);
  };

  const clearFilters = () => {
    const empty = { status: '', type: '', priority: '', dateRange: '', customStart: '', customEnd: '', missingAgents: '' };
    setFilters(empty);
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const hasActiveFilters   = activeFilterCount > 0 || search;

  // ── Render ──

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <FiShield className="text-blue-600" /> Événements & Missions
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Visualisez, planifiez et supervisez toutes vos missions de sécurité
          </p>
        </div>
        <button
          onClick={() => { setSelectedEvent(null); setModalOpen(true); }}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto whitespace-nowrap">
          <FiPlus size={16} /> Nouvel événement
        </button>
      </div>

      {/* Stats */}
      <StatsRow events={events} loading={loading} onRefresh={() => fetchEvents()} lastRefresh={lastRefresh} />

      {/* Search & Filters bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="flex-1 min-w-[220px]">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Rechercher par nom, lieu, responsable..."
                value={search}
                onChange={e => handleSearchChange(e.target.value)}
                className="input pl-10 pr-10"
              />
              {search && (
                <button onClick={() => handleSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <FiX size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(p => !p)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-medium text-sm transition-all
              ${showFilters || activeFilterCount > 0
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <FiFilter size={15} />
            Filtres
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Clear */}
          {hasActiveFilters && (
            <button onClick={() => { clearFilters(); setSearch(''); }}
              className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors">
              <FiX size={13} /> Effacer
            </button>
          )}

          {/* View toggle */}
          <div className="flex rounded-xl border border-gray-200 overflow-hidden ml-auto">
            <button onClick={() => setViewMode('grid')}
              className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              title="Vue grille">
              <FiGrid size={16} />
            </button>
            <button onClick={() => setViewMode('list')}
              className={`p-2.5 transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              title="Vue liste">
              <FiList size={16} />
            </button>
          </div>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="border-t pt-3">
            <FiltersPanel
              filters={filters}
              onChange={setFilters}
              onClear={clearFilters}
              onApply={setFilters}
              onClose={() => setShowFilters(false)}
            />
          </div>
        )}

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {filters.status && (
              <span className="flex items-center gap-1 text-xs px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full">
                Statut: {STATUS_CONFIG[filters.status]?.label}
                <button onClick={() => setFilters(p => ({ ...p, status: '' }))}><FiX size={11} /></button>
              </span>
            )}
            {filters.type && (
              <span className="flex items-center gap-1 text-xs px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full">
                Type: {TYPE_OPTIONS.find(t => t.value === filters.type)?.label}
                <button onClick={() => setFilters(p => ({ ...p, type: '' }))}><FiX size={11} /></button>
              </span>
            )}
            {filters.priority && (
              <span className="flex items-center gap-1 text-xs px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full">
                Priorité: {getPriorityInfo(filters.priority).label}
                <button onClick={() => setFilters(p => ({ ...p, priority: '' }))}><FiX size={11} /></button>
              </span>
            )}
            {filters.dateRange && (
              <span className="flex items-center gap-1 text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-full">
                Période: {filters.dateRange}
                <button onClick={() => setFilters(p => ({ ...p, dateRange: '' }))}><FiX size={11} /></button>
              </span>
            )}
            {filters.missingAgents && (
              <span className="flex items-center gap-1 text-xs px-2.5 py-1 bg-red-100 text-red-700 rounded-full">
                {filters.missingAgents === 'yes' ? '⚠️ Agents manquants' : '✅ Complets'}
                <button onClick={() => setFilters(p => ({ ...p, missingAgents: '' }))}><FiX size={11} /></button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Results summary */}
      {!loading && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            <strong className="text-gray-800">{events.length}</strong> événement{events.length !== 1 ? 's' : ''}
            {hasActiveFilters ? ' trouvé(s)' : ' au total'}
          </span>
          {viewMode === 'grid' && events.length > 0 && (
            <span>{Math.ceil(events.length / 3)} page{Math.ceil(events.length / 3) > 1 ? 's' : ''} estimée{Math.ceil(events.length / 3) > 1 ? 's' : ''}</span>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 animate-pulse">
              <div className="h-1.5 bg-gray-200 rounded-full" />
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
              <div className="h-2 bg-gray-100 rounded-full mt-4" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16 px-6">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FiCalendar className="text-gray-400" size={28} />
          </div>
          <h3 className="text-lg font-bold text-gray-700 mb-2">Aucun événement trouvé</h3>
          <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
            {hasActiveFilters
              ? 'Modifiez vos filtres ou votre recherche pour afficher plus de résultats.'
              : 'Commencez par créer votre première mission de sécurité.'}
          </p>
          {hasActiveFilters ? (
            <button onClick={() => { clearFilters(); setSearch(''); }}
              className="btn-secondary flex items-center gap-2 mx-auto">
              <FiX /> Effacer les filtres
            </button>
          ) : (
            <button onClick={() => { setSelectedEvent(null); setModalOpen(true); }}
              className="btn-primary flex items-center gap-2 mx-auto">
              <FiPlus /> Créer un événement
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {events.map(event => (
            <EventCard
              key={event.id}
              event={event}
              onView={e => { setSelectedEvent(e); setDetailsOpen(true); }}
              onEdit={e => { setSelectedEvent(e); setModalOpen(true); }}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onChronology={handleChronology}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Événement', 'Lieu', 'Date', 'Horaires', 'Agents', 'Phase', 'Statut', ''].map(h => (
                    <th key={h} className={`px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider
                      ${h === 'Lieu' ? 'hidden md:table-cell' : ''}
                      ${h === 'Horaires' ? 'hidden lg:table-cell' : ''}
                      ${h === 'Phase' ? 'hidden xl:table-cell' : ''}
                      ${h === '' ? 'text-right' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {events.map(event => (
                  <EventListRow
                    key={event.id}
                    event={event}
                    onView={e => { setSelectedEvent(e); setDetailsOpen(true); }}
                    onEdit={e => { setSelectedEvent(e); setModalOpen(true); }}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <EventModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedEvent(null); }}
        event={selectedEvent?.id ? selectedEvent : null}
        onSave={fetchEvents}
      />

      <EventDetailsModal
        isOpen={detailsOpen}
        onClose={() => { setDetailsOpen(false); setSelectedEvent(null); }}
        event={selectedEvent}
        onEdit={e => { setDetailsOpen(false); setSelectedEvent(e); setModalOpen(true); }}
        onDelete={id => { setDetailsOpen(false); handleDelete(id); }}
        onDuplicate={e => { setDetailsOpen(false); handleDuplicate(e); }}
        onChronology={e => { setDetailsOpen(false); handleChronology(e); }}
      />
    </div>
  );
};

export default Events;
