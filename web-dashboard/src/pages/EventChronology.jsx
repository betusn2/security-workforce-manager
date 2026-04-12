import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiArrowLeft, FiCalendar, FiClock, FiUsers, FiCheck, FiAlertTriangle,
  FiDownload, FiRefreshCw, FiMapPin, FiActivity, FiCheckCircle,
  FiAlertCircle, FiUser, FiShield
} from 'react-icons/fi';
import { eventsAPI } from '../services/api';
import PhaseManager from '../components/PhaseManager';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return '—';
  try { return format(new Date(d), 'dd MMM yyyy', { locale: fr }); }
  catch { return d; }
};
const fmtTime = (t) => (t ? t.substring(0, 5) : '—');

const PHASE_CONFIG = [
  {
    phase: 'preparation',
    label: 'Préparation',
    icon: '🛠️',
    color: 'blue',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    header: 'bg-blue-600',
    step: 1,
  },
  {
    phase: 'setup',
    label: 'Mise en place',
    icon: '📦',
    color: 'yellow',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    header: 'bg-yellow-500',
    step: 2,
  },
  {
    phase: 'execution',
    label: 'Pointage / Exécution',
    icon: '📍',
    color: 'green',
    bg: 'bg-green-50',
    border: 'border-green-200',
    header: 'bg-green-600',
    step: 3,
  },
];

const PRIORITY_LABELS = {
  low: { label: 'Basse', cls: 'bg-gray-100 text-gray-700' },
  medium: { label: 'Moyenne', cls: 'bg-blue-100 text-blue-700' },
  high: { label: 'Haute', cls: 'bg-orange-100 text-orange-700' },
  critical: { label: 'Critique', cls: 'bg-red-100 text-red-700' },
};

// ─── Phase Card ───────────────────────────────────────────────────────────────
const PhaseCard = ({ config, data, stepIndex, totalSteps, isLast }) => {
  const hasPlanned = data?.planned?.startDate || data?.planned?.startTime;
  const pct = data && data.agentsRequired > 0
    ? Math.min(100, Math.round((data.presentCount / data.agentsRequired) * 100))
    : 0;

  const statusColor = data
    ? pct >= 100 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'
    : 'text-gray-400';
  const barColor = pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="relative flex gap-4">
      {/* Timeline axis */}
      <div className="flex flex-col items-center">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md ${config.header}`}>
          <span className="text-xl">{config.icon}</span>
        </div>
        {!isLast && (
          <div className="w-0.5 bg-gray-200 flex-1 my-2 min-h-[2rem]" />
        )}
      </div>

      {/* Card */}
      <div className={`flex-1 mb-6 rounded-xl border-2 ${config.border} ${config.bg} overflow-hidden shadow-sm`}>
        {/* Card header */}
        <div className={`${config.header} text-white px-5 py-3 flex items-center justify-between`}>
          <div>
            <p className="text-xs font-medium opacity-80">Étape {config.step}</p>
            <h3 className="text-lg font-bold">{config.label}</h3>
          </div>
          {data && (
            <div className={`text-right ${statusColor}`}>
              <p className="text-2xl font-bold text-white">{data.presentCount}/{data.agentsRequired}</p>
              <p className="text-xs text-white opacity-80">agents présents</p>
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Planned schedule */}
          {hasPlanned ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data.planned?.startDate && (
                <div className="text-center bg-white rounded-lg p-2 shadow-sm">
                  <FiCalendar className="mx-auto text-gray-400 mb-1" size={16} />
                  <p className="text-xs text-gray-500">Début</p>
                  <p className="font-semibold text-sm">{fmtDate(data.planned.startDate)}</p>
                </div>
              )}
              {data.planned?.endDate && (
                <div className="text-center bg-white rounded-lg p-2 shadow-sm">
                  <FiCalendar className="mx-auto text-gray-400 mb-1" size={16} />
                  <p className="text-xs text-gray-500">Fin</p>
                  <p className="font-semibold text-sm">{fmtDate(data.planned.endDate)}</p>
                </div>
              )}
              {data.planned?.startTime && (
                <div className="text-center bg-white rounded-lg p-2 shadow-sm">
                  <FiClock className="mx-auto text-gray-400 mb-1" size={16} />
                  <p className="text-xs text-gray-500">Heure début</p>
                  <p className="font-semibold text-sm">{fmtTime(data.planned.startTime)}</p>
                </div>
              )}
              {data.planned?.endTime && (
                <div className="text-center bg-white rounded-lg p-2 shadow-sm">
                  <FiClock className="mx-auto text-gray-400 mb-1" size={16} />
                  <p className="text-xs text-gray-500">Heure fin</p>
                  <p className="font-semibold text-sm">{fmtTime(data.planned.endTime)}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic text-center py-2">
              Aucun horaire planifié pour cette phase
            </p>
          )}

          {/* Progress bar */}
          {data && data.agentsRequired > 0 && (
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Présence agents</span>
                <span className={`font-semibold ${statusColor}`}>{pct}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex gap-4 mt-2 text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <FiCheckCircle className="text-green-500" size={12} /> {data.presentCount} présents
                </span>
                <span className="flex items-center gap-1">
                  <FiAlertCircle className="text-red-500" size={12} /> {data.absentCount} absents
                </span>
                {data.lateCount > 0 && (
                  <span className="flex items-center gap-1">
                    <FiAlertTriangle className="text-yellow-500" size={12} /> {data.lateCount} retards
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Tolerance */}
          {data && (
            <div className="flex gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <FiClock size={14} className="text-gray-400" /> Tolérance : {data.tolerance} min
              </span>
              {data.observations && (
                <span className="flex items-center gap-1 text-gray-500 italic truncate">
                  💬 {data.observations.substring(0, 80)}{data.observations.length > 80 ? '…' : ''}
                </span>
              )}
            </div>
          )}

          {/* Attendances table */}
          {data && data.attendances && data.attendances.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-white">
                    <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">Agent</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">Arrivée</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">Départ</th>
                    <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.attendances.map((att, idx) => (
                    <tr key={idx} className="bg-white hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-800">
                        {att.agent ? `${att.agent.firstName} ${att.agent.lastName}` : att.userId || '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {att.checkInTime ? format(new Date(att.checkInTime), 'HH:mm') : '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {att.checkOutTime ? format(new Date(att.checkOutTime), 'HH:mm') : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          att.status === 'present' ? 'bg-green-100 text-green-700' :
                          att.status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {att.status === 'present' ? 'Présent' : att.status === 'late' ? 'En retard' : 'Absent'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const EventChronology = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('chronology');  // 'chronology' | 'phases'

  const fetchChronology = async () => {
    setLoading(true);
    try {
      const res = await eventsAPI.getChronology(id);
      setData(res.data?.data || null);
    } catch (err) {
      toast.error('Impossible de charger la chronologie');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchChronology(); }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500">Chargement de la chronologie…</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FiAlertCircle className="mx-auto text-red-400 mb-3" size={48} />
          <h2 className="text-xl font-semibold text-gray-700">Événement introuvable</h2>
          <button onClick={() => navigate('/events')} className="mt-4 btn-primary">
            Retour aux événements
          </button>
        </div>
      </div>
    );
  }

  const { event, chronology, assignments } = data;
  const priorityInfo = PRIORITY_LABELS[event?.priority] || PRIORITY_LABELS.medium;

  // Summary stats
  const totalAssigned = assignments?.filter(a => ['pending', 'confirmed'].includes(a.status)).length || 0;
  const totalPresent = (chronology || []).reduce((s, p) => s + (p.presentCount || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Header */}
      <div
        className="text-white px-6 py-5 print:py-3"
        style={{ backgroundColor: event?.color || '#3B82F6' }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-3 print:hidden">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
            >
              <FiArrowLeft size={20} />
            </button>
            <span className="text-sm opacity-80">Retour</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FiActivity size={20} />
                <span className="text-sm font-medium opacity-90">Chronologie événement</span>
              </div>
              <h1 className="text-3xl font-bold">{event?.name}</h1>
              <div className="flex items-center gap-3 mt-2 text-sm opacity-80">
                <span className="flex items-center gap-1"><FiMapPin size={14} /> {event?.location}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityInfo.cls}`}>
                  {priorityInfo.label}
                </span>
              </div>
            </div>

            <div className="flex gap-3 print:hidden">
              <button
                onClick={fetchChronology}
                className="flex items-center gap-2 px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg text-sm transition-colors"
              >
                <FiRefreshCw size={16} /> Actualiser
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg text-sm hover:bg-opacity-90 transition-colors font-medium shadow"
              >
                <FiDownload size={16} /> Imprimer / PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab selector */}
      <div className="max-w-4xl mx-auto px-6 mt-4 print:hidden">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab('chronology')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'chronology'
                ? 'bg-white shadow text-gray-800'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📅 Chronologie
          </button>
          <button
            onClick={() => setActiveTab('phases')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'phases'
                ? 'bg-white shadow text-gray-800'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🛡️ Gestion phases
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="max-w-4xl mx-auto px-6 -mt-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{totalAssigned}</p>
            <p className="text-xs text-gray-500 mt-1">Agents assignés</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{totalPresent}</p>
            <p className="text-xs text-gray-500 mt-1">Présences enregistrées</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-3xl font-bold text-gray-700">3</p>
            <p className="text-xs text-gray-500 mt-1">Phases</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
              event?.status === 'active' ? 'bg-green-100 text-green-700' :
              event?.status === 'completed' ? 'bg-gray-100 text-gray-700' :
              event?.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
              'bg-red-100 text-red-700'
            }`}>
              {event?.status === 'active' ? 'En cours' :
               event?.status === 'completed' ? 'Terminé' :
               event?.status === 'scheduled' ? 'Planifié' : event?.status}
            </span>
            <p className="text-xs text-gray-500 mt-1">Statut</p>
          </div>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'phases' && (
        <div className="max-w-4xl mx-auto px-6 pb-10 print:hidden">
          <PhaseManager eventId={id} />
        </div>
      )}

      {activeTab === 'chronology' && (
      <>
      {/* Timeline */}
      <div className="max-w-4xl mx-auto px-6 pb-10">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <FiActivity className="text-blue-500" /> Chronologie des phases
        </h2>

        <div className="relative">
          {PHASE_CONFIG.map((cfg, idx) => {
            const phaseData = (chronology || []).find(p => p.phase === cfg.phase);
            return (
              <PhaseCard
                key={cfg.phase}
                config={cfg}
                data={phaseData}
                stepIndex={idx}
                totalSteps={PHASE_CONFIG.length}
                isLast={idx === PHASE_CONFIG.length - 1}
              />
            );
          })}
        </div>

        {/* Assigned agents list */}
        {assignments && assignments.length > 0 && (
          <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <FiUsers className="text-blue-500" size={20} />
              <h3 className="font-bold text-gray-800">Agents assignés à l'événement</h3>
              <span className="ml-auto bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {assignments.filter(a => ['pending', 'confirmed'].includes(a.status)).length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs text-gray-500 font-medium">Agent</th>
                    <th className="px-5 py-3 text-left text-xs text-gray-500 font-medium">ID employé</th>
                    <th className="px-5 py-3 text-left text-xs text-gray-500 font-medium">Rôle</th>
                    <th className="px-5 py-3 text-left text-xs text-gray-500 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {assignments.map((asgn) => (
                    <tr key={asgn.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {asgn.agent?.profilePhoto ? (
                            <img src={asgn.agent.profilePhoto} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">
                              {asgn.agent?.firstName?.[0]}{asgn.agent?.lastName?.[0]}
                            </div>
                          )}
                          <span className="font-medium text-gray-800 text-sm">
                            {asgn.agent ? `${asgn.agent.firstName} ${asgn.agent.lastName}` : '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">{asgn.agent?.employeeId || '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          asgn.role === 'supervisor' ? 'bg-purple-100 text-purple-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {asgn.role === 'supervisor' ? 'Responsable' : 'Agent'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          asgn.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                          asgn.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {asgn.status === 'confirmed' ? 'Confirmé' :
                           asgn.status === 'pending' ? 'En attente' : asgn.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { font-size: 12px; }
        }
      `}</style>
    </>
    )}
    </div>
  );
};

export default EventChronology;
