import React, { useState, useEffect, useCallback } from 'react';
import {
  FiCheckCircle, FiCircle, FiUsers, FiMapPin, FiClock,
  FiLoader, FiRefreshCw, FiCheck, FiAlertCircle, FiShield,
} from 'react-icons/fi';
import { phaseAPI } from '../services/api';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDateTime = (d) => {
  if (!d) return '—';
  try { return format(new Date(d), 'dd MMM yyyy HH:mm', { locale: fr }); }
  catch { return d; }
};

const PHASE_META = {
  preparation: {
    label: 'Phase 1 — Préparation',
    icon: '🛠️',
    color: 'blue',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    headerBg: 'bg-blue-600',
    defaultChecklist: { phaseStarted: false, agentsPresent: false, zonesVerified: false, phaseDone: false },
    checklistLabels: [
      { key: 'phaseStarted',  label: 'Phase commencée' },
      { key: 'agentsPresent', label: 'Agents présents' },
      { key: 'zonesVerified', label: 'Zones vérifiées' },
      { key: 'phaseDone',     label: 'Phase terminée' },
    ],
  },
  setup: {
    label: 'Phase 2 — Mise en place',
    icon: '📦',
    color: 'yellow',
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    headerBg: 'bg-yellow-500',
    defaultChecklist: { phaseStarted: false, agentsPresent: false, zonesVerified: false, phaseDone: false },
    checklistLabels: [
      { key: 'phaseStarted',  label: 'Phase commencée' },
      { key: 'agentsPresent', label: 'Agents positionnés' },
      { key: 'zonesVerified', label: 'Zones affectées couvertes' },
      { key: 'phaseDone',     label: 'Phase terminée' },
    ],
  },
  execution: {
    label: 'Phase 3 — Pointage / Exécution',
    icon: '📍',
    color: 'green',
    bg: 'bg-green-50',
    border: 'border-green-300',
    headerBg: 'bg-green-600',
    defaultChecklist: { phaseStarted: false, agentsPresent: false, zonesVerified: false, phaseDone: false },
    checklistLabels: [
      { key: 'phaseStarted',  label: 'Phase commencée' },
      { key: 'agentsPresent', label: 'Agents au poste' },
      { key: 'zonesVerified', label: 'Zones sécurisées' },
      { key: 'phaseDone',     label: 'Phase terminée' },
    ],
  },
};

// ─── Checklist Item ───────────────────────────────────────────────────────────
const ChecklistItem = ({ label, checked, onChange, disabled }) => (
  <label className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${checked ? 'bg-white' : 'hover:bg-white hover:bg-opacity-60'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-green-500 border-green-500 text-white' : 'border-gray-400 bg-white'}`}
      disabled={disabled}
    >
      {checked && <FiCheck size={12} strokeWidth={3} />}
    </button>
    <span className={`text-sm ${checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>{label}</span>
  </label>
);

// ─── Phase Confirmation Card ──────────────────────────────────────────────────
const PhaseConfirmCard = ({ phase, phaseData, onConfirm, loading }) => {
  const meta = PHASE_META[phase];
  const [checklist, setChecklist] = useState(
    phaseData?.checklist || meta.defaultChecklist
  );

  // Sync when phaseData changes
  useEffect(() => {
    if (phaseData?.checklist) setChecklist(phaseData.checklist);
  }, [phaseData?.checklist]);

  const allChecked = Object.values(checklist).every(Boolean);
  const confirmedAlready = phaseData?.confirmed;

  const handleToggle = (key, value) => {
    setChecklist(prev => ({ ...prev, [key]: value }));
  };

  const handleConfirm = () => {
    if (!allChecked) {
      toast.warn('Cochez toutes les cases avant de confirmer');
      return;
    }
    onConfirm(phase, checklist);
  };

  return (
    <div className={`rounded-xl border-2 ${meta.border} ${meta.bg} overflow-hidden shadow-sm`}>
      {/* Header */}
      <div className={`${meta.headerBg} text-white px-5 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className="text-xl">{meta.icon}</span>
          <h3 className="font-bold">{meta.label}</h3>
        </div>
        {confirmedAlready && (
          <span className="flex items-center gap-1 text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full font-medium">
            <FiCheckCircle size={12} /> Confirmé
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* If already confirmed: show summary */}
        {confirmedAlready ? (
          <div className="bg-white rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-2 text-green-600 font-semibold mb-2">
              <FiCheckCircle size={18} /> Phase confirmée
            </div>
            <p className="text-sm text-gray-600">
              Le <span className="font-medium">{fmtDateTime(phaseData.confirmedAt)}</span>
            </p>
            {/* Show checklist readonly */}
            <div className="mt-3 space-y-1">
              {meta.checklistLabels.map(item => (
                <div key={item.key} className="flex items-center gap-2 text-sm text-gray-500">
                  <FiCheckCircle size={14} className="text-green-500 flex-shrink-0" />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Checklist */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Checklist confirmation</p>
              <div className="space-y-1">
                {meta.checklistLabels.map(item => (
                  <ChecklistItem
                    key={item.key}
                    label={item.label}
                    checked={!!checklist[item.key]}
                    onChange={(val) => handleToggle(item.key, val)}
                    disabled={false}
                  />
                ))}
              </div>
            </div>

            {/* Confirm button */}
            <button
              onClick={handleConfirm}
              disabled={loading || !allChecked}
              className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2
                ${allChecked
                  ? `bg-${meta.color}-600 text-white hover:bg-${meta.color}-700 shadow-sm`
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
              style={allChecked ? { backgroundColor: meta.color === 'yellow' ? '#d97706' : meta.color === 'blue' ? '#2563eb' : '#16a34a' } : {}}
            >
              {loading ? <FiLoader className="animate-spin" size={16} /> : <FiCheck size={16} />}
              Confirmer {meta.label}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Zone Confirmation Card (Phase 2 only) ─────────────────────────────────────
const ZoneConfirmCard = ({ zones, zonesConfirmed, onConfirmZones, loading }) => {
  const [selected, setSelected] = useState(zonesConfirmed || []);

  useEffect(() => { setSelected(zonesConfirmed || []); }, [zonesConfirmed]);

  const toggle = (zoneId) => {
    setSelected(prev =>
      prev.includes(zoneId) ? prev.filter(id => id !== zoneId) : [...prev, zoneId]
    );
  };

  if (!zones || zones.length === 0) {
    return (
      <div className="rounded-xl border-2 border-yellow-300 bg-yellow-50 p-5 text-center text-sm text-gray-500">
        Aucune zone définie pour cet événement.
        <a href="/zones" className="text-blue-600 underline ml-1">Créer des zones →</a>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-yellow-300 bg-yellow-50 overflow-hidden shadow-sm">
      <div className="bg-yellow-500 text-white px-5 py-3 flex items-center gap-2">
        <FiMapPin size={18} />
        <h3 className="font-bold">Zones de mise en place</h3>
        <span className="ml-auto text-xs bg-white bg-opacity-20 px-2 py-0.5 rounded-full">
          {selected.length}/{zones.length} confirmées
        </span>
      </div>

      <div className="p-5 space-y-3">
        <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Responsable confirme zones</p>
        <div className="space-y-2">
          {zones.map(zone => {
            const isSelected = selected.includes(zone.id);
            const wasConfirmed = zone.setupConfirmed;
            return (
              <label
                key={zone.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                  ${isSelected ? 'border-yellow-400 bg-white shadow-sm' : 'border-transparent bg-white bg-opacity-50 hover:bg-opacity-80'}`}
              >
                <button
                  type="button"
                  onClick={() => toggle(zone.id)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                    ${isSelected ? 'bg-yellow-500 border-yellow-500 text-white' : 'border-gray-400 bg-white'}`}
                >
                  {isSelected && <FiCheck size={12} strokeWidth={3} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: zone.color || '#3B82F6' }}
                    />
                    <span className="font-medium text-sm text-gray-800 truncate">{zone.name}</span>
                    {wasConfirmed && (
                      <span className="text-xs text-green-600 flex items-center gap-1 flex-shrink-0">
                        <FiCheckCircle size={11} /> Mise en place
                      </span>
                    )}
                  </div>
                  {zone.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{zone.description}</p>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        <button
          onClick={() => onConfirmZones(selected)}
          disabled={loading || selected.length === 0}
          className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2
            ${selected.length > 0 ? 'bg-yellow-500 hover:bg-yellow-600 text-white shadow-sm' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
        >
          {loading ? <FiLoader className="animate-spin" size={16} /> : <FiMapPin size={16} />}
          Confirmer {selected.length} zone{selected.length !== 1 ? 's' : ''} mise{selected.length !== 1 ? 's' : ''} en place
        </button>
      </div>
    </div>
  );
};

// ─── Supervised Agents Card ───────────────────────────────────────────────────
const AgentsCard = ({ agents, loadingAgents, onRefresh }) => {
  const presentCount = agents.filter(a => a.isPresent).length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 bg-gray-50">
        <FiUsers className="text-blue-500" size={18} />
        <h3 className="font-bold text-gray-800">Agents supervisés</h3>
        <span className="ml-auto flex items-center gap-2">
          <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
            {presentCount}/{agents.length} présents
          </span>
          <button onClick={onRefresh} disabled={loadingAgents} className="p-1 hover:bg-gray-200 rounded transition-colors">
            <FiRefreshCw size={14} className={loadingAgents ? 'animate-spin text-gray-400' : 'text-gray-500'} />
          </button>
        </span>
      </div>

      {loadingAgents ? (
        <div className="p-8 text-center text-gray-400">
          <FiLoader className="animate-spin mx-auto mb-2" size={24} />
          Chargement agents…
        </div>
      ) : agents.length === 0 ? (
        <div className="p-8 text-center text-gray-400">
          <FiUsers className="mx-auto mb-2 opacity-30" size={32} />
          <p className="text-sm">Aucun agent supervisé assigné à cet événement</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {agents.map((item) => (
            <div key={item.assignmentId} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
              {item.agent.profilePhoto ? (
                <img src={item.agent.profilePhoto} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-bold flex-shrink-0">
                  {item.agent.firstName?.[0]}{item.agent.lastName?.[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-800 truncate">
                  {item.agent.firstName} {item.agent.lastName}
                </p>
                <p className="text-xs text-gray-500">{item.agent.employeeId}</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  item.isPresent ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  {item.isPresent ? '✅ Présent' : '❌ Absent'}
                </span>
                {item.attendance?.checkInTime && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <FiClock size={10} />
                    {format(new Date(item.attendance.checkInTime), 'HH:mm')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main PhaseManager Component ──────────────────────────────────────────────
const PhaseManager = ({ eventId }) => {
  const [phases, setPhases] = useState(null);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmingZones, setConfirmingZones] = useState(false);

  const loadPhases = useCallback(async () => {
    try {
      setLoading(true);
      const res = await phaseAPI.getStatus(eventId);
      setPhases(res?.data?.data || null);
    } catch {
      toast.error('Impossible de charger les phases');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const loadAgents = useCallback(async () => {
    try {
      setLoadingAgents(true);
      const res = await phaseAPI.getSupervisedAgents(eventId);
      setAgents(res?.data?.data || []);
    } catch {
      // silently fail
    } finally {
      setLoadingAgents(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadPhases();
    loadAgents();
  }, [loadPhases, loadAgents]);

  const handleConfirmPhase = async (phase, checklist) => {
    try {
      setConfirming(true);
      await phaseAPI.confirmPhase(eventId, phase, checklist);
      toast.success(`Phase ${phase === 'preparation' ? 'Préparation' : phase === 'setup' ? 'Mise en place' : 'Exécution'} confirmée !`);
      await loadPhases();
    } catch {
      toast.error('Erreur lors de la confirmation');
    } finally {
      setConfirming(false);
    }
  };

  const handleConfirmZones = async (zoneIds) => {
    if (zoneIds.length === 0) return;
    try {
      setConfirmingZones(true);
      await phaseAPI.confirmSetupZones(eventId, zoneIds);
      toast.success(`${zoneIds.length} zone(s) confirmée(s) pour la mise en place !`);
      await loadPhases();
    } catch {
      toast.error('Erreur confirmation zones');
    } finally {
      setConfirmingZones(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Chargement gestion phases…</p>
        </div>
      </div>
    );
  }

  if (!phases) {
    return (
      <div className="flex items-center justify-center py-12 text-center text-gray-500">
        <div>
          <FiAlertCircle className="mx-auto mb-2 text-red-400" size={36} />
          <p>Impossible de charger les phases.</p>
          <button onClick={loadPhases} className="mt-3 text-blue-600 text-sm underline">Réessayer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FiShield className="text-blue-500" size={20} />
          <h2 className="text-lg font-bold text-gray-800">Gestion des phases — Responsable</h2>
        </div>
        <button
          onClick={() => { loadPhases(); loadAgents(); }}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <FiRefreshCw size={14} /> Actualiser
        </button>
      </div>

      {/* Phase confirmation cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PhaseConfirmCard
          phase="preparation"
          phaseData={phases.phases?.preparation}
          onConfirm={handleConfirmPhase}
          loading={confirming}
        />
        <PhaseConfirmCard
          phase="setup"
          phaseData={phases.phases?.setup}
          onConfirm={handleConfirmPhase}
          loading={confirming}
        />
        <PhaseConfirmCard
          phase="execution"
          phaseData={phases.phases?.execution}
          onConfirm={handleConfirmPhase}
          loading={confirming}
        />
      </div>

      {/* Zone confirmation (Phase 2) */}
      <ZoneConfirmCard
        zones={phases.phases?.setup?.zones || []}
        zonesConfirmed={phases.phases?.setup?.zonesConfirmed || []}
        onConfirmZones={handleConfirmZones}
        loading={confirmingZones}
      />

      {/* Supervised agents */}
      <AgentsCard
        agents={agents}
        loadingAgents={loadingAgents}
        onRefresh={loadAgents}
      />
    </div>
  );
};

export default PhaseManager;
