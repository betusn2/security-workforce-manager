import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiCheck, FiX,
  FiUser, FiCalendar, FiClock, FiMapPin, FiUsers, FiFilter,
  FiChevronDown, FiChevronUp, FiUserCheck, FiUserPlus,
  FiAlertCircle, FiCheckCircle, FiXCircle, FiRefreshCw,
  FiEye, FiStar, FiShield, FiPhone, FiMail, FiGrid, FiList,
  FiUserMinus, FiUserX
} from 'react-icons/fi';
import { assignmentsAPI, eventsAPI, usersAPI, zonesAPI } from '../services/api';
import { toast } from 'react-toastify';
import { format, isAfter, isBefore, isToday, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import useAuthStore from '../hooks/useAuth';
import { shouldDisplayEvent } from '../utils/eventHelpers';

// Modal de confirmation de suppression
const ConfirmRemoveModal = ({ isOpen, onClose, onConfirm, assignment, loading }) => {
  if (!isOpen || !assignment) return null;

  const isSuper = assignment.role === 'supervisor';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
        <div className={`p-6 border-b ${isSuper ? 'bg-orange-50' : 'bg-red-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-full ${isSuper ? 'bg-orange-100' : 'bg-red-100'}`}>
              <FiUserMinus className={isSuper ? 'text-orange-600' : 'text-red-600'} size={24} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">
                Retirer {isSuper ? 'le responsable' : "l'agent"}
              </h3>
              <p className="text-sm text-gray-600">Cette action est irreversible</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl mb-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${isSuper ? 'bg-orange-500' : 'bg-primary-500'}`}>
              {assignment.agent?.firstName?.[0]}{assignment.agent?.lastName?.[0]}
            </div>
            <div>
              <p className="font-semibold text-gray-900">
                {assignment.agent?.firstName} {assignment.agent?.lastName}
              </p>
              <p className="text-sm text-gray-500">{assignment.agent?.employeeId}</p>
            </div>
          </div>

          <p className="text-gray-600 text-sm">
            Voulez-vous vraiment retirer <strong>{assignment.agent?.firstName} {assignment.agent?.lastName}</strong> de
            l'evenement <strong>{assignment.event?.name}</strong> ?
          </p>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-100 font-medium"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2.5 text-white rounded-xl font-medium flex items-center gap-2 ${
              isSuper
                ? 'bg-orange-600 hover:bg-orange-700'
                : 'bg-red-600 hover:bg-red-700'
            } disabled:opacity-50`}
          >
            {loading ? (
              <>
                <FiRefreshCw className="animate-spin" size={16} />
                Retrait...
              </>
            ) : (
              <>
                <FiUserMinus size={16} />
                Retirer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Composant pour le badge de statut
const StatusBadge = ({ status }) => {
  const config = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: FiClock, label: 'En attente' },
    confirmed: { bg: 'bg-green-100', text: 'text-green-700', icon: FiCheckCircle, label: 'Confirme' },
    declined: { bg: 'bg-red-100', text: 'text-red-700', icon: FiXCircle, label: 'Refuse' },
    cancelled: { bg: 'bg-gray-100', text: 'text-gray-700', icon: FiX, label: 'Annule' }
  };
  const { bg, text, icon: Icon, label } = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      <Icon size={12} />
      {label}
    </span>
  );
};

// Composant pour le badge de role
const RoleBadge = ({ role }) => {
  const config = {
    primary: { bg: 'bg-blue-100', text: 'text-blue-700', icon: FiUser, label: 'Agent' },
    backup: { bg: 'bg-purple-100', text: 'text-purple-700', icon: FiUserPlus, label: 'Remplacant' },
    supervisor: { bg: 'bg-orange-100', text: 'text-orange-700', icon: FiShield, label: 'Responsable' }
  };
  const { bg, text, icon: Icon, label } = config[role] || config.primary;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      <Icon size={12} />
      {label}
    </span>
  );
};

// Modal d'affectation ameliore
const AssignmentModal = ({ isOpen, onClose, onSave, events, agents, supervisors, editData = null }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    eventId: '',
    selectedAgents: [], // [{agent, zoneId}]
    selectedSupervisor: '',
    supervisorZoneIds: [], // Plusieurs zones pour le superviseur
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [searchAgent, setSearchAgent] = useState('');
  const [searchSupervisor, setSearchSupervisor] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [zones, setZones] = useState([]);
  const [loadingZones, setLoadingZones] = useState(false);
  
  // États pour la proximité (partagés entre agents et superviseurs)
  const [proximityRadius, setProximityRadius] = useState(5000); // 5km par défaut
  const [showProximityFilter, setShowProximityFilter] = useState(false);
  const [showSupervisorProximityFilter, setShowSupervisorProximityFilter] = useState(false);
  const [sortBy, setSortBy] = useState('proximity'); // 'proximity', 'name', 'score'

  useEffect(() => {
    if (editData) {
      // Convertir les agentIds en structure { agent, zoneId } pour édition
      const convertedAgents = (editData.agentIds || []).map(agentId => {
        const agentObj = agents.find(a => a.id === agentId);
        return {
          agent: agentObj || { id: agentId },
          zoneId: null
        };
      });

      setFormData({
        eventId: editData.eventId || '',
        selectedAgents: convertedAgents,
        selectedSupervisor: editData.supervisorId || '',
        supervisorZoneIds: [],
        notes: editData.notes || ''
      });
      const event = events.find(e => e.id === editData.eventId);
      setSelectedEvent(event);
      if (event) fetchZones(event.id);
      setStep(2);
    } else {
      setFormData({ eventId: '', selectedAgents: [], selectedSupervisor: '', supervisorZoneIds: [], notes: '' });
      setSelectedEvent(null);
      setZones([]);
      setStep(1);
    }
  }, [editData, events, isOpen, agents]);

  const fetchZones = async (eventId) => {
    setLoadingZones(true);
    try {
      const res = await zonesAPI.getByEvent(eventId);
      setZones(res.data.data || []);
    } catch (error) {
      console.error('Error fetching zones:', error);
      setZones([]);
    } finally {
      setLoadingZones(false);
    }
  };

  const handleEventSelect = (event) => {
    setFormData({ ...formData, eventId: event.id, selectedAgents: [], selectedSupervisor: '', supervisorZoneIds: [] });
    setSelectedEvent(event);
    fetchZones(event.id);
    setStep(2);
  };

  const toggleAgent = (agent, zoneId = null) => {
    const existingIndex = formData.selectedAgents.findIndex(a => {
      const itemId = (a.agent?.id || a.id);
      return itemId === agent.id;
    });
    
    if (existingIndex >= 0) {
      // Agent deja selectionne, le retirer
      setFormData({
        ...formData,
        selectedAgents: formData.selectedAgents.filter((_, idx) => idx !== existingIndex)
      });
    } else {
      // Ajouter l'agent avec sa zone (structure normalisée)
      const newAgent = {
        agent: agent,
        zoneId: zoneId || null
      };
      setFormData({
        ...formData,
        selectedAgents: [...formData.selectedAgents, newAgent]
      });
    }
  };

  const updateAgentZone = (agentId, zoneId) => {
    setFormData({
      ...formData,
      selectedAgents: formData.selectedAgents.map(item =>
        (item.agent?.id || item.id) === agentId ? { agent: item.agent || item, zoneId } : item
      )
    });
  };

  const getAgentFromSelected = (item) => item.agent || item;
  const getZoneFromSelected = (item) => item.zoneId || null;

  const handleSubmit = async () => {
    if (!formData.eventId) {
      toast.error('Selectionnez un evenement');
      return;
    }
    if (formData.selectedAgents.length === 0 && !formData.selectedSupervisor) {
      toast.error('Selectionnez au moins un agent ou un responsable');
      return;
    }

    setLoading(true);
    try {
      const promises = [];

      // Creer les affectations pour les agents (groupes par zone)
      if (formData.selectedAgents.length > 0) {
        // Grouper par zoneId
        const agentsByZone = {};
        formData.selectedAgents.forEach(item => {
          const agent = getAgentFromSelected(item);
          const zoneId = getZoneFromSelected(item);
          const zoneKey = zoneId || 'no-zone';
          if (!agentsByZone[zoneKey]) agentsByZone[zoneKey] = [];
          agentsByZone[zoneKey].push(agent.id);
        });

        // Creer les affectations pour chaque groupe de zone
        for (const [zoneKey, agentIds] of Object.entries(agentsByZone)) {
          const zoneId = zoneKey === 'no-zone' ? null : zoneKey;
          if (agentIds.length === 1) {
            const payload = {
              eventId: formData.eventId,
              agentId: agentIds[0],
              zoneId,
              role: 'primary',
              notes: formData.notes
            };
            console.log('📤 Sending single agent assignment:', JSON.stringify(payload, null, 2));
            promises.push(assignmentsAPI.create(payload));
          } else {
            promises.push(assignmentsAPI.createBulk({
              eventId: formData.eventId,
              agentIds,
              zoneId,
              role: 'primary',
              notes: formData.notes
            }));
          }
        }
      }

      // Creer les affectations pour le superviseur/responsable (une par zone sélectionnée)
      if (formData.selectedSupervisor) {
        if (formData.supervisorZoneIds.length > 0) {
          // Créer une affectation pour chaque zone sélectionnée
          for (const zoneId of formData.supervisorZoneIds) {
            const payload = {
              eventId: formData.eventId,
              agentId: formData.selectedSupervisor,
              zoneId: zoneId,
              role: 'supervisor',
              notes: formData.notes
            };
            console.log('📤 Sending supervisor assignment (with zone):', JSON.stringify(payload, null, 2));
            promises.push(assignmentsAPI.create(payload));
          }
        } else {
          // Si aucune zone sélectionnée, créer une affectation sans zone
          const payload = {
            eventId: formData.eventId,
            agentId: formData.selectedSupervisor,
            zoneId: null,
            role: 'supervisor',
            notes: formData.notes
          };
          console.log('📤 Sending supervisor assignment (no zone):', JSON.stringify(payload, null, 2));
          promises.push(assignmentsAPI.create(payload));
        }
      }

      await Promise.all(promises);
      toast.success(`Affectation(s) creee(s) avec succes`);
      onSave();
      onClose();
    } catch (error) {
      console.error('❌ Assignment creation error:', {
        status: error.response?.status,
        message: error.response?.data?.message,
        errors: error.response?.data?.errors,
        fullResponse: error.response?.data
      });
      toast.error(error.response?.data?.message || 'Erreur lors de la creation');
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour calculer la distance (formule de Haversine)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371e3; // Rayon de la Terre en mètres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance en mètres
  };

  // Agents avec distance calculée et filtrés/triés
  const filteredAgents = useMemo(() => {
    let result = agents.map(agent => {
      // Calculer la distance si l'événement et l'agent ont des coordonnées
      let distance = null;
      if (selectedEvent?.latitude && selectedEvent?.longitude) {
        // Vérifier les différents champs possibles pour les coordonnées de l'agent
        const agentLat = agent.currentLatitude || agent.latitude || agent.lat;
        const agentLon = agent.currentLongitude || agent.longitude || agent.lon || agent.lng;
        
        if (agentLat && agentLon) {
          distance = calculateDistance(
            parseFloat(selectedEvent.latitude),
            parseFloat(selectedEvent.longitude),
            parseFloat(agentLat),
            parseFloat(agentLon)
          );
        }
      }
      return { ...agent, distance };
    });

    // Filtrer par recherche
    if (searchAgent) {
      const search = searchAgent.toLowerCase();
      result = result.filter(agent =>
        agent.firstName?.toLowerCase().includes(search) ||
        agent.lastName?.toLowerCase().includes(search) ||
        agent.employeeId?.toLowerCase().includes(search)
      );
    }

    // Filtrer par proximité si activé
    if (showProximityFilter && selectedEvent?.latitude && selectedEvent?.longitude) {
      // Compter combien d'agents ont des coordonnées
      const agentsWithCoords = result.filter(a => a.distance !== null).length;
      
      // Si aucun agent n'a de coordonnées, désactiver automatiquement le filtre
      if (agentsWithCoords === 0) {
        console.warn('⚠️ Aucun agent avec coordonnées GPS - filtre de proximité ignoré');
        // On ne filtre pas, on retourne tous les résultats
      } else {
        result = result.filter(agent => {
          if (agent.distance === null) return false; // Exclure ceux sans coordonnées
          return agent.distance <= proximityRadius;
        });
      }
    }

    // Trier selon le critère sélectionné
    result.sort((a, b) => {
      if (sortBy === 'proximity') {
        // Trier par distance (les plus proches en premier)
        if (a.distance === null && b.distance === null) return 0;
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      } else if (sortBy === 'name') {
        // Trier par nom
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      } else if (sortBy === 'score') {
        // Trier par score
        return (b.overallScore || 0) - (a.overallScore || 0);
      }
      return 0;
    });

    return result;
  }, [agents, searchAgent, selectedEvent, showProximityFilter, proximityRadius, sortBy]);

  // Stats de proximité
  const proximityStats = useMemo(() => {
    if (!selectedEvent?.latitude || !selectedEvent?.longitude) return null;
    
    // Filtrer les agents qui ont des coordonnées GPS
    const agentsWithDistance = agents.filter(a => {
      const agentLat = a.currentLatitude || a.latitude || a.lat;
      const agentLon = a.currentLongitude || a.longitude || a.lon || a.lng;
      return agentLat && agentLon;
    });
    
    const within100m = agentsWithDistance.filter(a => {
      const agentLat = a.currentLatitude || a.latitude || a.lat;
      const agentLon = a.currentLongitude || a.longitude || a.lon || a.lng;
      const dist = calculateDistance(
        parseFloat(selectedEvent.latitude),
        parseFloat(selectedEvent.longitude),
        parseFloat(agentLat),
        parseFloat(agentLon)
      );
      return dist <= 5000; // 5km
    }).length;
    
    const within500m = agentsWithDistance.filter(a => {
      const agentLat = a.currentLatitude || a.latitude || a.lat;
      const agentLon = a.currentLongitude || a.longitude || a.lon || a.lng;
      const dist = calculateDistance(
        parseFloat(selectedEvent.latitude),
        parseFloat(selectedEvent.longitude),
        parseFloat(agentLat),
        parseFloat(agentLon)
      );
      return dist <= 50000; // 50km
    }).length;
    
    const within1000m = agentsWithDistance.filter(a => {
      const agentLat = a.currentLatitude || a.latitude || a.lat;
      const agentLon = a.currentLongitude || a.longitude || a.lon || a.lng;
      const dist = calculateDistance(
        parseFloat(selectedEvent.latitude),
        parseFloat(selectedEvent.longitude),
        parseFloat(agentLat),
        parseFloat(agentLon)
      );
      return dist <= 100000; // 100km
    }).length;

    return {
      total: agentsWithDistance.length,
      within100m,
      within500m,
      within1000m,
      withinRadius: agentsWithDistance.filter(a => {
        const dist = calculateDistance(
          parseFloat(selectedEvent.latitude),
          parseFloat(selectedEvent.longitude),
          parseFloat(a.currentLatitude),
          parseFloat(a.currentLongitude)
        );
        return dist <= proximityRadius;
      }).length
    };
  }, [agents, selectedEvent, proximityRadius]);

  // Superviseurs avec distance calculée et filtrés/triés
  const filteredSupervisors = useMemo(() => {
    let result = supervisors.map(supervisor => {
      // Calculer la distance si l'événement et le superviseur ont des coordonnées
      let distance = null;
      if (selectedEvent?.latitude && selectedEvent?.longitude) {
        const supLat = supervisor.currentLatitude || supervisor.latitude || supervisor.lat;
        const supLon = supervisor.currentLongitude || supervisor.longitude || supervisor.lon || supervisor.lng;
        
        if (supLat && supLon) {
          distance = calculateDistance(
            parseFloat(selectedEvent.latitude),
            parseFloat(selectedEvent.longitude),
            parseFloat(supLat),
            parseFloat(supLon)
          );
        }
      }
      return { ...supervisor, distance };
    });

    // Filtrer par recherche
    if (searchSupervisor) {
      const search = searchSupervisor.toLowerCase();
      result = result.filter(supervisor =>
        supervisor.firstName?.toLowerCase().includes(search) ||
        supervisor.lastName?.toLowerCase().includes(search) ||
        supervisor.employeeId?.toLowerCase().includes(search)
      );
    }

    // Filtrer par proximité si activé
    if (showSupervisorProximityFilter && selectedEvent?.latitude && selectedEvent?.longitude) {
      const supervisorsWithCoords = result.filter(s => s.distance !== null).length;
      
      if (supervisorsWithCoords === 0) {
        console.warn('⚠️ Aucun superviseur avec coordonnées GPS - filtre de proximité ignoré');
      } else {
        result = result.filter(supervisor => {
          if (supervisor.distance === null) return false;
          return supervisor.distance <= proximityRadius;
        });
      }
    }

    // Trier par distance (les plus proches en premier)
    result.sort((a, b) => {
      if (a.distance === null && b.distance === null) return 0;
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });

    return result;
  }, [supervisors, selectedEvent, searchSupervisor, showSupervisorProximityFilter, proximityRadius]);

  const filteredAgentsOld = agents.filter(agent => {
    if (!searchAgent) return true;
    const search = searchAgent.toLowerCase();
    return (
      agent.firstName?.toLowerCase().includes(search) ||
      agent.lastName?.toLowerCase().includes(search) ||
      agent.employeeId?.toLowerCase().includes(search)
    );
  });

  const getEventStatus = (event) => {
    const now = new Date();
    const start = parseISO(event.startDate);
    if (isBefore(now, start)) return 'upcoming';
    if (isToday(start)) return 'today';
    return 'past';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-primary-50 to-blue-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {editData ? 'Modifier l\'affectation' : 'Nouvelle Affectation'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {step === 1 ? 'Etape 1: Selectionnez un evenement' : 'Etape 2: Selectionnez les agents et responsables'}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <FiX size={20} />
            </button>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2 mt-4">
            <div className={`flex-1 h-2 rounded-full ${step >= 1 ? 'bg-primary-500' : 'bg-gray-200'}`} />
            <div className={`flex-1 h-2 rounded-full ${step >= 2 ? 'bg-primary-500' : 'bg-gray-200'}`} />
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Step 1: Selection de l'evenement */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un evenement..."
                  className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="grid gap-3">
                {events.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <FiCalendar className="mx-auto mb-3 text-gray-300" size={48} />
                    <p className="font-medium">Aucun evenement disponible</p>
                    <p className="text-sm">Creez d'abord un evenement</p>
                  </div>
                ) : (
                  events.map(event => {
                    const status = getEventStatus(event);
                    return (
                      <div
                        key={event.id}
                        onClick={() => handleEventSelect(event)}
                        className={`p-4 border-2 rounded-xl cursor-pointer transition-all hover:shadow-md ${
                          formData.eventId === event.id
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-primary-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-gray-900">{event.name}</h3>
                              {status === 'today' && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                  Aujourd'hui
                                </span>
                              )}
                              {status === 'upcoming' && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                  A venir
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <FiMapPin size={14} />
                                {event.location?.substring(0, 40)}...
                              </span>
                              <span className="flex items-center gap-1">
                                <FiCalendar size={14} />
                                {format(parseISO(event.startDate), 'dd MMM yyyy', { locale: fr })}
                              </span>
                              <span className="flex items-center gap-1">
                                <FiClock size={14} />
                                {event.checkInTime} - {event.checkOutTime}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-sm">
                              <FiUsers size={14} className="text-gray-400" />
                              <span className="font-medium">{event.assignedAgentsCount || 0}</span>
                              <span className="text-gray-400">/ {event.requiredAgents || 1}</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">agents affectes</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Step 2: Selection des agents et responsable */}
          {step === 2 && selectedEvent && (
            <div className="space-y-6">
              {/* Resume de l'evenement */}
              <div className="p-4 bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl border border-primary-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-primary-600 font-medium mb-1">Evenement selectionne</p>
                    <h3 className="font-bold text-gray-900">{selectedEvent.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                      <span className="flex items-center gap-1">
                        <FiCalendar size={12} />
                        {format(parseISO(selectedEvent.startDate), 'dd MMMM yyyy', { locale: fr })}
                      </span>
                      <span className="flex items-center gap-1">
                        <FiClock size={12} />
                        {selectedEvent.checkInTime}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setStep(1)}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Changer
                  </button>
                </div>
              </div>

              {/* Zones disponibles - Affichage ameliore */}
              {zones.length > 0 && (
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-100 overflow-hidden">
                  <div className="p-4 border-b border-purple-100 bg-white/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-200">
                          <FiMapPin className="text-white" size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800">Zones de l'evenement</h4>
                          <p className="text-xs text-gray-500">{zones.length} zone(s) - Affectez les agents par zone</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          {zones.reduce((sum, z) => sum + (z.requiredAgents || 1), 0)} agents requis
                        </span>
                        <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                          {zones.reduce((sum, z) => sum + (z.requiredSupervisors || 0), 0)} resp. requis
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {zones.map(zone => {
                        const stats = zone.stats || {};
                        const agentsFilled = (stats.assignedAgents || 0) >= (zone.requiredAgents || 1);
                        const supervisorsFilled = (stats.assignedSupervisors || 0) >= (zone.requiredSupervisors || 0);
                        const selectedForZone = formData.selectedAgents.filter(item => {
                          const zoneId = item.zoneId || null;
                          return zoneId === zone.id;
                        });
                        const supervisorForZone = formData.supervisorZoneIds.includes(zone.id);

                        return (
                          <div
                            key={zone.id}
                            className="bg-white rounded-xl p-4 shadow-sm border-l-4 hover:shadow-md transition-shadow"
                            style={{ borderLeftColor: zone.color }}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                                  style={{ backgroundColor: zone.color }}
                                >
                                  {zone.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <h5 className="font-semibold text-gray-800">{zone.name}</h5>
                                  <span className="text-xs text-gray-500">
                                    {zone.type === 'entry' ? 'Entree' :
                                     zone.type === 'exit' ? 'Sortie' :
                                     zone.type === 'vip' ? 'VIP' :
                                     zone.type === 'parking' ? 'Parking' :
                                     zone.type === 'backstage' ? 'Backstage' :
                                     zone.type === 'security_post' ? 'Poste Securite' :
                                     'General'}
                                  </span>
                                </div>
                              </div>
                              {zone.priority === 'high' && (
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                                  Priorite haute
                                </span>
                              )}
                              {zone.priority === 'critical' && (
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                                  Critique
                                </span>
                              )}
                            </div>

                            {/* Stats de la zone */}
                            <div className="flex items-center gap-4 mb-3 text-sm">
                              <div className="flex items-center gap-1.5">
                                <FiUsers className={agentsFilled ? 'text-green-500' : 'text-blue-400'} size={14} />
                                <span className={`font-medium ${agentsFilled ? 'text-green-600' : 'text-gray-700'}`}>
                                  {stats.assignedAgents || 0}/{zone.requiredAgents || 1}
                                </span>
                                <span className="text-gray-400 text-xs">agents</span>
                                {agentsFilled && <FiCheck className="text-green-500" size={12} />}
                              </div>
                              {zone.requiredSupervisors > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <FiShield className={supervisorsFilled ? 'text-green-500' : 'text-orange-400'} size={14} />
                                  <span className={`font-medium ${supervisorsFilled ? 'text-green-600' : 'text-gray-700'}`}>
                                    {stats.assignedSupervisors || 0}/{zone.requiredSupervisors}
                                  </span>
                                  <span className="text-gray-400 text-xs">resp.</span>
                                </div>
                              )}
                            </div>

                            {/* Agents selectionnes pour cette zone */}
                            {selectedForZone.length > 0 && (
                              <div className="mb-2">
                                <div className="flex flex-wrap gap-1">
                                  {selectedForZone.map(item => {
                                    const agent = item.agent || item;
                                    return (
                                      <span
                                        key={agent.id}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs"
                                      >
                                        {agent.firstName} {agent.lastName?.[0]}.
                                        <button
                                          onClick={() => toggleAgent(agent)}
                                          className="hover:text-red-500"
                                        >
                                          <FiX size={10} />
                                        </button>
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Responsable pour cette zone */}
                            {supervisorForZone && formData.selectedSupervisor && (
                              <div className="mb-2">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                                  <FiShield size={10} />
                                  {supervisors.find(s => s.id === formData.selectedSupervisor)?.firstName}
                                </span>
                              </div>
                            )}

                            {zone.instructions && (
                              <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded mt-2 line-clamp-2">
                                {zone.instructions}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Message si aucune zone */}
              {zones.length === 0 && (
                <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
                      <FiAlertCircle className="text-yellow-600" size={20} />
                    </div>
                    <div>
                      <h4 className="font-medium text-yellow-800">Aucune zone configuree</h4>
                      <p className="text-sm text-yellow-600">
                        Les agents seront affectes a l'evenement sans zone specifique.
                        Vous pouvez creer des zones dans les details de l'evenement.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Contrôle global du rayon de recherche */}
              {selectedEvent?.latitude && selectedEvent?.longitude && (
                <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                  <div className="flex items-center gap-2 mb-3">
                    <FiMapPin className="text-purple-600" size={18} />
                    <span className="font-semibold text-gray-800">Rayon de Recherche (Agents & Responsables)</span>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">
                          Rayon: <span className="text-purple-600 font-bold">
                            {proximityRadius >= 1000 ? `${(proximityRadius / 1000).toFixed(1)}km` : `${proximityRadius}m`}
                          </span>
                        </label>
                        <button
                          onClick={() => setProximityRadius(5000)}
                          className="text-xs text-purple-600 hover:text-purple-700"
                        >
                          Réinitialiser (5km)
                        </button>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="200000"
                        step="1000"
                        value={proximityRadius}
                        onChange={(e) => setProximityRadius(parseInt(e.target.value))}
                        className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>0km</span>
                        <span>50km</span>
                        <span>100km</span>
                        <span>150km</span>
                        <span>200km</span>
                      </div>
                    </div>

                    {proximityStats && (
                      <div className="grid grid-cols-4 gap-2">
                        <div className="bg-white/80 rounded-lg p-2 text-center">
                          <div className="text-xs text-gray-500">Dans le rayon</div>
                          <div className="text-lg font-bold text-purple-600">{proximityStats.withinRadius}</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-2 text-center">
                          <div className="text-xs text-gray-500">≤ 5km</div>
                          <div className="text-lg font-bold text-green-600">{proximityStats.within100m}</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-2 text-center">
                          <div className="text-xs text-gray-500">≤ 50km</div>
                          <div className="text-lg font-bold text-blue-600">{proximityStats.within500m}</div>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-2 text-center">
                          <div className="text-xs text-gray-500">≤ 100km</div>
                          <div className="text-lg font-bold text-orange-600">{proximityStats.within1000m}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Selection du responsable */}
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-100 p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-200">
                    <FiShield className="text-white" size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800">Responsable / Superviseur</h4>
                    <p className="text-xs text-gray-500">Selectionnez un responsable pour superviser cet evenement</p>
                  </div>
                </div>

                {/* Contrôles de proximité pour superviseurs */}
                {selectedEvent?.latitude && selectedEvent?.longitude && (
                  <div className="mb-4 p-3 bg-purple-50/50 rounded-lg border border-purple-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showSupervisorProximityFilter}
                        onChange={(e) => setShowSupervisorProximityFilter(e.target.checked)}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <FiMapPin className="text-purple-600" size={16} />
                      <span className="text-sm font-medium text-gray-700">Filtrer par proximité</span>
                    </label>
                  </div>
                )}

                {/* Barre de recherche */}
                <div className="relative mb-3">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher un responsable..."
                    value={searchSupervisor}
                    onChange={(e) => setSearchSupervisor(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-orange-200 bg-white rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                {/* Liste des superviseurs */}
                <div className="border rounded-xl max-h-64 overflow-y-auto divide-y">
                  {filteredSupervisors.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                      <FiUser className="mx-auto mb-2 text-gray-300" size={32} />
                      <p>Aucun responsable trouvé</p>
                      {showSupervisorProximityFilter && (
                        <p className="text-xs mt-1">Essayez d'augmenter le rayon de recherche</p>
                      )}
                    </div>
                  ) : (
                    filteredSupervisors.map(supervisor => {
                      const isSelected = formData.selectedSupervisor === supervisor.id;
                      
                      // Badge de distance
                      let distanceBadge = null;
                      if (selectedEvent?.latitude && selectedEvent?.longitude && supervisor.distance !== null) {
                        const distanceInMeters = supervisor.distance;
                        const distanceText = distanceInMeters >= 1000 
                          ? `${(distanceInMeters / 1000).toFixed(1)}km` 
                          : `${Math.round(distanceInMeters)}m`;
                        
                        const distanceColor = distanceInMeters <= 5000
                          ? 'bg-green-100 text-green-700 border-green-200'
                          : distanceInMeters <= 25000
                          ? 'bg-blue-100 text-blue-700 border-blue-200'
                          : distanceInMeters <= 100000
                          ? 'bg-orange-100 text-orange-700 border-orange-200'
                          : 'bg-red-100 text-red-700 border-red-200';
                        
                        distanceBadge = (
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${distanceColor}`}>
                            <FiMapPin size={12} />
                            {distanceText}
                          </div>
                        );
                      }
                      
                      return (
                        <div
                          key={supervisor.id}
                          onClick={() => setFormData({ ...formData, selectedSupervisor: isSelected ? '' : supervisor.id, supervisorZoneIds: [] })}
                          className={`flex items-center p-3 cursor-pointer transition-colors ${
                            isSelected ? 'bg-orange-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-lg border-2 mr-3 flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-orange-600 border-orange-600'
                              : 'border-gray-300'
                          }`}>
                            {isSelected && <FiCheck className="text-white" size={14} />}
                          </div>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold mr-3 ${
                            isSelected
                              ? 'bg-orange-500 text-white'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {supervisor.firstName[0]}{supervisor.lastName[0]}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {supervisor.firstName} {supervisor.lastName}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span>{supervisor.employeeId}</span>
                              {supervisor.phone && (
                                <span className="flex items-center gap-1">
                                  <FiPhone size={10} />
                                  {supervisor.phone}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {distanceBadge}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {formData.selectedSupervisor && (
                  <div className="mt-3 p-3 bg-white rounded-lg border border-orange-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold">
                        {supervisors.find(s => s.id === formData.selectedSupervisor)?.firstName?.[0]}
                        {supervisors.find(s => s.id === formData.selectedSupervisor)?.lastName?.[0]}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">
                          {supervisors.find(s => s.id === formData.selectedSupervisor)?.firstName}{' '}
                          {supervisors.find(s => s.id === formData.selectedSupervisor)?.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formData.supervisorZoneIds.length > 0
                            ? `${formData.supervisorZoneIds.length} zone(s) selectionnee(s)`
                            : 'Aucune zone selectionnee (toutes les zones)'}
                        </p>
                      </div>
                      <button
                        onClick={() => setFormData({ ...formData, selectedSupervisor: '', supervisorZoneIds: [] })}
                        className="p-1.5 hover:bg-red-50 rounded-full text-gray-400 hover:text-red-500"
                      >
                        <FiX size={16} />
                      </button>
                    </div>

                    {/* Selection multiple des zones */}
                    {zones.length > 0 && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">
                          Affecter aux zones (plusieurs possibles)
                        </label>
                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                          {zones.map(zone => {
                            const isSelected = formData.supervisorZoneIds.includes(zone.id);
                            return (
                              <label
                                key={zone.id}
                                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-orange-50 border-orange-300'
                                    : 'bg-gray-50 border-gray-200 hover:border-orange-200'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFormData({
                                        ...formData,
                                        supervisorZoneIds: [...formData.supervisorZoneIds, zone.id]
                                      });
                                    } else {
                                      setFormData({
                                        ...formData,
                                        supervisorZoneIds: formData.supervisorZoneIds.filter(id => id !== zone.id)
                                      });
                                    }
                                  }}
                                  className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500"
                                />
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: zone.color || '#F97316' }}
                                />
                                <span className="text-sm text-gray-700 truncate">{zone.name}</span>
                              </label>
                            );
                          })}
                        </div>
                        {formData.supervisorZoneIds.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {formData.supervisorZoneIds.map(zoneId => {
                              const zone = zones.find(z => z.id === zoneId);
                              return (
                                <span
                                  key={zoneId}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                                  style={{ backgroundColor: `${zone?.color}20`, color: zone?.color }}
                                >
                                  {zone?.name}
                                  <button
                                    type="button"
                                    onClick={() => setFormData({
                                      ...formData,
                                      supervisorZoneIds: formData.supervisorZoneIds.filter(id => id !== zoneId)
                                    })}
                                    className="hover:bg-white/50 rounded-full p-0.5"
                                  >
                                    <FiX size={12} />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Selection des agents */}
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-100 p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                      <FiUsers className="text-white" size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800">Selection des Agents</h4>
                      <p className="text-xs text-gray-500">
                        {formData.selectedAgents.length} selectionne(s) sur {selectedEvent.requiredAgents || 1} requis
                      </p>
                    </div>
                  </div>
                  <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                    formData.selectedAgents.length >= (selectedEvent.requiredAgents || 1)
                      ? 'bg-green-100 text-green-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {formData.selectedAgents.length >= (selectedEvent.requiredAgents || 1) ? 'Complet' : `${(selectedEvent.requiredAgents || 1) - formData.selectedAgents.length} manquant(s)`}
                  </div>
                </div>

                {/* Alerte si pas de coordonnées GPS */}
                {(!selectedEvent?.latitude || !selectedEvent?.longitude) && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                    <FiAlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={16} />
                    <div className="text-xs text-yellow-800">
                      <p className="font-medium">Localisation GPS non définie pour l'événement</p>
                      <p className="text-yellow-700">Le filtre de proximité n'est pas disponible.</p>
                    </div>
                  </div>
                )}

                {/* Alerte si aucun agent n'a de coordonnées GPS */}
                {selectedEvent?.latitude && selectedEvent?.longitude && proximityStats && proximityStats.total === 0 && (
                  <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-2">
                    <FiAlertCircle className="text-orange-600 flex-shrink-0 mt-0.5" size={16} />
                    <div className="text-xs text-orange-800">
                      <p className="font-medium">Aucun agent avec localisation GPS</p>
                      <p className="text-orange-700">Les agents n'ont pas de coordonnées GPS enregistrées. Le filtre de proximité ne peut pas fonctionner.</p>
                      <p className="text-orange-700 mt-1">💡 <strong>Solution:</strong> Ajoutez des champs latitude/longitude lors de la création/modification des agents.</p>
                    </div>
                  </div>
                )}

                {/* Contrôles de proximité et tri */}
                {selectedEvent?.latitude && selectedEvent?.longitude && (
                  <div className="mb-4 p-3 bg-purple-50/50 rounded-lg border border-purple-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showProximityFilter}
                        onChange={(e) => setShowProximityFilter(e.target.checked)}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <FiMapPin className="text-purple-600" size={16} />
                      <span className="text-sm font-medium text-gray-700">Filtrer par proximité</span>
                    </label>
                  </div>
                )}

                {/* Barre de contrôles (recherche + tri) */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Rechercher..."
                      value={searchAgent}
                      onChange={(e) => setSearchAgent(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-blue-200 bg-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-4 py-2.5 border border-blue-200 bg-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="proximity">Trier par proximité</option>
                    <option value="name">Trier par nom</option>
                    <option value="score">Trier par score</option>
                  </select>
                </div>

                {/* Agents selectionnes avec zones */}
                {formData.selectedAgents.length > 0 && (
                  <div className="mb-3 p-3 bg-white rounded-xl border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-600">Agents selectionnes</span>
                      <button
                        onClick={() => setFormData({ ...formData, selectedAgents: [] })}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Tout retirer
                      </button>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {formData.selectedAgents.map(item => {
                        const agent = getAgentFromSelected(item);
                        const selectedZoneId = getZoneFromSelected(item);
                        const selectedZone = zones.find(z => z.id === selectedZoneId);
                        return (
                          <div
                            key={agent.id}
                            className="flex items-center gap-3 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200"
                          >
                            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-medium">
                              {agent.firstName?.[0]}{agent.lastName?.[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-gray-800">{agent.firstName} {agent.lastName}</span>
                              {selectedZone && (
                                <span
                                  className="ml-2 px-2 py-0.5 rounded text-xs font-medium"
                                  style={{ backgroundColor: `${selectedZone.color}20`, color: selectedZone.color }}
                                >
                                  {selectedZone.name}
                                </span>
                              )}
                            </div>
                            {zones.length > 0 && (
                              <select
                                value={selectedZoneId || ''}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateAgentZone(agent.id, e.target.value || null);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs px-2 py-1.5 border border-blue-200 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white"
                              >
                                <option value="">Choisir zone</option>
                                {zones.map(zone => (
                                  <option key={zone.id} value={zone.id}>{zone.name}</option>
                                ))}
                              </select>
                            )}
                            <button
                              onClick={() => toggleAgent(agent)}
                              className="p-1.5 hover:bg-red-100 rounded-full text-gray-400 hover:text-red-500"
                            >
                              <FiX size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Liste des agents */}
                <div className="border rounded-xl max-h-64 overflow-y-auto divide-y">
                  {filteredAgents.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                      <FiUser className="mx-auto mb-2 text-gray-300" size={32} />
                      <p>Aucun agent trouve</p>
                      {showProximityFilter && (
                        <p className="text-xs mt-1">Essayez d'augmenter le rayon de recherche</p>
                      )}
                    </div>
                  ) : (
                    filteredAgents.map(agent => {
                      const isSelected = formData.selectedAgents.some(a => (a.agent?.id || a.id) === agent.id);
                      
                      // Calcul du badge de distance
                      let distanceBadge = null;
                      if (selectedEvent?.latitude && selectedEvent?.longitude && agent.distance !== null && agent.distance !== undefined) {
                        const distanceInMeters = agent.distance;
                        let distanceText;
                        let distanceColor;
                        
                        if (distanceInMeters >= 1000) {
                          distanceText = `${(distanceInMeters / 1000).toFixed(1)}km`;
                        } else {
                          distanceText = `${Math.round(distanceInMeters)}m`;
                        }
                        
                        // Couleur basée sur la distance (adaptée pour 0-200km)
                        if (distanceInMeters <= 5000) {
                          distanceColor = 'bg-green-100 text-green-700 border-green-200';
                        } else if (distanceInMeters <= 25000) {
                          distanceColor = 'bg-blue-100 text-blue-700 border-blue-200';
                        } else if (distanceInMeters <= 100000) {
                          distanceColor = 'bg-orange-100 text-orange-700 border-orange-200';
                        } else {
                          distanceColor = 'bg-red-100 text-red-700 border-red-200';
                        }
                        
                        distanceBadge = (
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${distanceColor}`}>
                            <FiMapPin size={12} />
                            {distanceText}
                          </div>
                        );
                      } else if (selectedEvent?.latitude && selectedEvent?.longitude) {
                        distanceBadge = (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                            <FiMapPin size={12} />
                            Inconnu
                          </div>
                        );
                      }
                      
                      return (
                        <div
                          key={agent.id}
                          onClick={() => toggleAgent(agent)}
                          className={`flex items-center p-3 cursor-pointer transition-colors ${
                            isSelected ? 'bg-primary-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-lg border-2 mr-3 flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-primary-600 border-primary-600'
                              : 'border-gray-300'
                          }`}>
                            {isSelected && <FiCheck className="text-white" size={14} />}
                          </div>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold mr-3 ${
                            isSelected
                              ? 'bg-primary-500 text-white'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {agent.firstName[0]}{agent.lastName[0]}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {agent.firstName} {agent.lastName}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span>{agent.employeeId}</span>
                              {agent.phone && (
                                <span className="flex items-center gap-1">
                                  <FiPhone size={10} />
                                  {agent.phone}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {distanceBadge}
                            {agent.rating && (
                              <div className="flex items-center gap-1 text-yellow-500">
                                <FiStar size={14} />
                                <span className="text-sm font-medium">{agent.rating}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notes (optionnel)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Instructions speciales, remarques..."
                  rows={2}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex items-center justify-between">
          <div>
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <FiChevronUp className="rotate-[-90deg]" />
                Retour
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-100 font-medium"
            >
              Annuler
            </button>
            {step === 2 && (
              <button
                onClick={handleSubmit}
                disabled={loading || (formData.selectedAgents.length === 0 && !formData.selectedSupervisor)}
                className="px-5 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <FiRefreshCw className="animate-spin" />
                    Creation...
                  </>
                ) : (
                  <>
                    <FiCheck />
                    Creer l'affectation
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Modal de details d'un evenement avec ses affectations
const EventDetailModal = ({ isOpen, onClose, event, assignments, onRefresh }) => {
  const [removeModal, setRemoveModal] = useState({ open: false, assignment: null });
  const [removeLoading, setRemoveLoading] = useState(false);

  if (!isOpen || !event) return null;

  const eventAssignments = assignments.filter(a => a.event?.id === event.id || a.eventId === event.id);
  const supervisors = eventAssignments.filter(a => a.role === 'supervisor');
  const agents = eventAssignments.filter(a => a.role !== 'supervisor');

  const handleUpdateStatus = async (assignmentId, status) => {
    try {
      await assignmentsAPI.update(assignmentId, { status });
      toast.success('Statut mis a jour');
      onRefresh();
    } catch (error) {
      toast.error('Erreur lors de la mise a jour');
    }
  };

  const openRemoveModal = (assignment) => {
    // Ajouter l'info de l'evenement pour l'affichage
    setRemoveModal({
      open: true,
      assignment: { ...assignment, event }
    });
  };

  const handleRemove = async () => {
    if (!removeModal.assignment) return;

    setRemoveLoading(true);
    try {
      await assignmentsAPI.delete(removeModal.assignment.id);
      const isSuper = removeModal.assignment.role === 'supervisor';
      toast.success(`${isSuper ? 'Responsable' : 'Agent'} retire avec succes`);
      setRemoveModal({ open: false, assignment: null });
      onRefresh();
    } catch (error) {
      toast.error('Erreur lors du retrait');
    } finally {
      setRemoveLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
          <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{event.name}</h2>
                <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
                  <span className="flex items-center gap-1">
                    <FiMapPin size={14} />
                    {event.location?.substring(0, 30)}...
                  </span>
                  <span className="flex items-center gap-1">
                    <FiCalendar size={14} />
                    {format(parseISO(event.startDate), 'dd MMM yyyy', { locale: fr })}
                  </span>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-lg">
                <FiX size={20} />
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Responsables */}
            <div className="mb-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <FiShield className="text-orange-500" />
                Responsables ({supervisors.length})
              </h3>
              {supervisors.length === 0 ? (
                <p className="text-sm text-gray-500 italic">Aucun responsable affecte</p>
              ) : (
                <div className="space-y-2">
                  {supervisors.map(assignment => (
                    <div key={assignment.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-xl border border-orange-100 group hover:border-orange-300 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-semibold">
                          {assignment.agent?.firstName?.[0]}{assignment.agent?.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-medium">{assignment.agent?.firstName} {assignment.agent?.lastName}</p>
                          <p className="text-xs text-gray-500">{assignment.agent?.employeeId}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={assignment.status} />
                        <button
                          onClick={() => openRemoveModal(assignment)}
                          className="p-2 text-orange-400 hover:text-orange-600 hover:bg-orange-100 rounded-lg transition-colors"
                          title="Retirer le responsable"
                        >
                          <FiUserMinus size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Agents */}
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <FiUsers className="text-blue-500" />
                Agents ({agents.length} / {event.requiredAgents || 1})
              </h3>
              {agents.length === 0 ? (
                <p className="text-sm text-gray-500 italic">Aucun agent affecte</p>
              ) : (
                <div className="space-y-2">
                  {agents.map(assignment => (
                    <div key={assignment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border group hover:border-primary-300 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center font-semibold">
                          {assignment.agent?.firstName?.[0]}{assignment.agent?.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-medium">{assignment.agent?.firstName} {assignment.agent?.lastName}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{assignment.agent?.employeeId}</span>
                            <RoleBadge role={assignment.role} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={assignment.status} />
                        {assignment.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(assignment.id, 'confirmed')}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                              title="Confirmer"
                            >
                              <FiCheck size={14} />
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(assignment.id, 'cancelled')}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Annuler"
                            >
                              <FiX size={14} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => openRemoveModal(assignment)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Retirer l'agent"
                        >
                          <FiUserMinus size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t bg-gray-50 flex justify-end">
            <button onClick={onClose} className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 font-medium">
              Fermer
            </button>
          </div>
        </div>
      </div>

      {/* Modal de confirmation de retrait */}
      <ConfirmRemoveModal
        isOpen={removeModal.open}
        onClose={() => setRemoveModal({ open: false, assignment: null })}
        onConfirm={handleRemove}
        assignment={removeModal.assignment}
        loading={removeLoading}
      />
    </>
  );
};

// Composant principal
const Assignments = () => {
  const navigate = useNavigate();
  const { user, hasRole } = useAuthStore();
  const [assignments, setAssignments] = useState([]);
  const [events, setEvents] = useState([]);
  const [agents, setAgents] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModal, setDetailModal] = useState({ open: false, event: null });
  const [removeModal, setRemoveModal] = useState({ open: false, assignment: null });
  const [removeLoading, setRemoveLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [eventStatusFilter, setEventStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'events' ou 'list' - Mode liste par défaut
  const [expandedEvents, setExpandedEvents] = useState({});
  const [expandedSupervisors, setExpandedSupervisors] = useState({});

  // Toggle pour plier/déplier un événement
  const toggleEvent = (eventId) => {
    setExpandedEvents(prev => ({
      ...prev,
      [eventId]: !prev[eventId]
    }));
  };

  // Toggle pour plier/déplier un responsable
  const toggleSupervisor = (eventId, supervisorId) => {
    const key = `${eventId}-${supervisorId}`;
    setExpandedSupervisors(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Vérifier les permissions d'accès
  useEffect(() => {
    if (!hasRole(['admin', 'supervisor'])) {
      toast.error('Accès refusé. Cette page est réservée aux administrateurs et superviseurs.');
      navigate('/checkin');
    }
  }, [hasRole, navigate]);

  useEffect(() => {
    fetchData();
  }, [statusFilter, roleFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Construire les params proprement pour eviter les valeurs vides
      const assignmentParams = {};
      if (statusFilter) assignmentParams.status = statusFilter;
      if (roleFilter) assignmentParams.role = roleFilter;

      const [assignmentsRes, eventsRes, agentsRes, supervisorsRes] = await Promise.all([
        assignmentsAPI.getAll(assignmentParams),
        eventsAPI.getAll({}), // Pas de limite - charger tous les événements
        usersAPI.getAgents(),
        usersAPI.getSupervisors()
      ]);

      console.log('📋 Full API Responses:', {
        assignments: assignmentsRes,
        events: eventsRes,
        agents: agentsRes,
        supervisors: supervisorsRes
      });
      
      // Gestion correcte des réponses avec vérification d'erreurs
      const assignmentData = assignmentsRes?.data?.data?.assignments || assignmentsRes?.data?.data || [];
      const eventData = eventsRes?.data?.data?.events || eventsRes?.data?.data || [];
      const agentData = agentsRes?.data?.data || [];
      const supervisorData = supervisorsRes?.data?.data || [];
      
      console.log('📊 Parsed data:', {
        assignments: Array.isArray(assignmentData) ? assignmentData.length : 0,
        events: Array.isArray(eventData) ? eventData.length : 0,
        agents: Array.isArray(agentData) ? agentData.length : 0,
        supervisors: Array.isArray(supervisorData) ? supervisorData.length : 0
      });
      
      setAssignments(Array.isArray(assignmentData) ? assignmentData : []);
      setEvents(Array.isArray(eventData) ? eventData : []);
      setAgents(agentData);
      setSupervisors(supervisorData);
      
      if (eventData.length === 0) {
        console.warn('⚠️ Aucun événement chargé depuis l\'API');
        toast.warning('Aucun événement trouvé dans la base de données');
      }
    } catch (error) {
      console.error('❌ Error fetching data:', error);
      console.error('Error details:', error.response?.data || error.message);
      toast.error(`Erreur: ${error.response?.data?.message || error.message || 'Erreur lors du chargement'}`);
      
      // Définir des valeurs par défaut en cas d'erreur
      setAssignments([]);
      setEvents([]);
      setAgents([]);
      setSupervisors([]);
    } finally {
      setLoading(false);
    }
  };

  // Grouper les affectations par evenement
  const eventGroups = useMemo(() => {
    const groups = {};
    events.forEach(event => {
      const eventAssignments = assignments.filter(a =>
        a.event?.id === event.id || a.eventId === event.id
      );
      groups[event.id] = {
        event,
        assignments: eventAssignments,
        supervisorCount: eventAssignments.filter(a => a.role === 'supervisor').length,
        agentCount: eventAssignments.filter(a => a.role !== 'supervisor').length
      };
    });
    return groups;
  }, [events, assignments]);

  // Filtrer les evenements
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      // Filtrer par statut d'événement
      if (eventStatusFilter && event.status !== eventStatusFilter) {
        return false;
      }
      
      // Filtrer par recherche uniquement (afficher tous les événements y compris historiques)
      if (search) {
        return event.name?.toLowerCase().includes(search.toLowerCase()) ||
               event.location?.toLowerCase().includes(search.toLowerCase());
      }
      
      return true;
    }).sort((a, b) => new Date(b.startDate) - new Date(a.startDate)); // Trier par date décroissante (plus récents en premier)
  }, [events, search, eventStatusFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: assignments.length,
    pending: assignments.filter(a => a.status === 'pending').length,
    confirmed: assignments.filter(a => a.status === 'confirmed').length,
    eventsWithAssignments: Object.values(eventGroups).filter(g => g.assignments.length > 0).length
  }), [assignments, eventGroups]);

  // Fonction pour ouvrir le modal de retrait
  const openRemoveModal = (assignment) => {
    setRemoveModal({ open: true, assignment });
  };

  // Fonction pour retirer un agent/responsable
  const handleRemove = async () => {
    if (!removeModal.assignment) return;

    setRemoveLoading(true);
    try {
      await assignmentsAPI.delete(removeModal.assignment.id);
      const isSuper = removeModal.assignment.role === 'supervisor';
      toast.success(`${isSuper ? 'Responsable' : 'Agent'} retire avec succes`);
      setRemoveModal({ open: false, assignment: null });
      fetchData();
    } catch (error) {
      toast.error('Erreur lors du retrait');
    } finally {
      setRemoveLoading(false);
    }
  };

  // Fonction pour confirmer en masse par événement
  const handleBulkConfirm = async (eventId, confirmType = 'all') => {
    if (!eventId) return;

    const event = events.find(e => e.id === eventId);
    const eventAssignments = assignments.filter(a => 
      (a.event?.id === eventId || a.eventId === eventId) && a.status === 'pending'
    );

    if (eventAssignments.length === 0) {
      toast.info('Aucune affectation en attente pour cet événement');
      return;
    }

    const confirmAgents = confirmType === 'all' || confirmType === 'agents';
    const confirmSupervisors = confirmType === 'all' || confirmType === 'supervisors';

    const agentsCount = eventAssignments.filter(a => a.role !== 'supervisor').length;
    const supervisorsCount = eventAssignments.filter(a => a.role === 'supervisor').length;

    let message = '';
    if (confirmType === 'all') {
      message = `Confirmer ${agentsCount} agent(s) et ${supervisorsCount} responsable(s) pour "${event?.name}" ?`;
    } else if (confirmType === 'agents') {
      message = `Confirmer ${agentsCount} agent(s) pour "${event?.name}" ?`;
    } else if (confirmType === 'supervisors') {
      message = `Confirmer ${supervisorsCount} responsable(s) pour "${event?.name}" ?`;
    }

    if (!window.confirm(message)) return;

    try {
      const response = await assignmentsAPI.bulkConfirm({
        eventId,
        confirmAgents,
        confirmSupervisors
      });

      if (response.data?.success) {
        toast.success(response.data.message || 'Affectations confirmées avec succès');
        fetchData();
      }
    } catch (error) {
      console.error('Erreur lors de la confirmation en masse:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la confirmation en masse');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Affectations</h1>
          <p className="text-gray-500 mt-1">Gerez les affectations des agents aux evenements</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-medium shadow-lg shadow-primary-500/30"
        >
          <FiPlus />
          Nouvelle affectation
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <FiUsers className="text-blue-600" size={20} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">En attente</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-xl">
              <FiClock className="text-yellow-600" size={20} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Confirmees</p>
              <p className="text-2xl font-bold text-green-600">{stats.confirmed}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-xl">
              <FiCheckCircle className="text-green-600" size={20} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Evenements</p>
              <p className="text-2xl font-bold text-purple-600">{stats.eventsWithAssignments}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-xl">
              <FiCalendar className="text-purple-600" size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un evenement..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
          <select
            value={eventStatusFilter}
            onChange={(e) => setEventStatusFilter(e.target.value)}
            className="px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Tous les événements</option>
            <option value="active">Actifs</option>
            <option value="scheduled">Planifiés</option>
            <option value="completed">Terminés</option>
            <option value="cancelled">Annulés</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="confirmed">Confirme</option>
            <option value="declined">Refuse</option>
            <option value="cancelled">Annule</option>
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Tous les roles</option>
            <option value="primary">Agents</option>
            <option value="supervisor">Responsables</option>
            <option value="backup">Remplacants</option>
          </select>
          <div className="flex bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('events')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'events' ? 'bg-white shadow text-primary-600' : 'text-gray-600'
              }`}
            >
              <FiGrid className="inline mr-1" size={14} />
              Par evenement
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'list' ? 'bg-white shadow text-primary-600' : 'text-gray-600'
              }`}
            >
              <FiList className="inline mr-1" size={14} />
              Liste
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : viewMode === 'events' ? (
        /* Vue par evenement */
        <div className="grid gap-4">
          {filteredEvents.length === 0 ? (
            <div className="bg-white rounded-xl border p-12 text-center">
              <FiCalendar className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-gray-500 font-medium">Aucun evenement trouve</p>
            </div>
          ) : (
            filteredEvents.map(event => {
              const group = eventGroups[event.id] || { assignments: [], supervisorCount: 0, agentCount: 0 };
              const isComplete = group.agentCount >= (event.requiredAgents || 1);

              return (
                <div key={event.id} className="bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-gray-900 text-lg">{event.name}</h3>
                          {isComplete ? (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                              Complet
                            </span>
                          ) : group.agentCount > 0 ? (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">
                              Partiel
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                              Non affecte
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <FiMapPin size={14} />
                            {event.location?.substring(0, 40)}...
                          </span>
                          <span className="flex items-center gap-1">
                            <FiCalendar size={14} />
                            {format(parseISO(event.startDate), 'dd MMM yyyy', { locale: fr })}
                          </span>
                          <span className="flex items-center gap-1">
                            <FiClock size={14} />
                            {event.checkInTime} - {event.checkOutTime}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <div className="flex items-center gap-1">
                            <FiShield className="text-orange-500" size={16} />
                            <span className="text-xl font-bold text-gray-900">{group.supervisorCount}</span>
                          </div>
                          <p className="text-xs text-gray-500">Responsable</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center gap-1">
                            <FiUsers className="text-blue-500" size={16} />
                            <span className="text-xl font-bold text-gray-900">{group.agentCount}</span>
                            <span className="text-gray-400">/ {event.requiredAgents || 1}</span>
                          </div>
                          <p className="text-xs text-gray-500">Agents</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setDetailModal({ open: true, event })}
                            className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-xl"
                            title="Voir les details"
                          >
                            <FiEye size={18} />
                          </button>
                          <button
                            onClick={() => {
                              setModalOpen(true);
                            }}
                            className="p-2.5 bg-primary-100 text-primary-600 hover:bg-primary-200 rounded-xl"
                            title="Ajouter une affectation"
                          >
                            <FiUserPlus size={18} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Mini liste des affectes */}
                    {group.assignments.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex flex-wrap gap-2">
                          {group.assignments.slice(0, 6).map(assignment => (
                            <div
                              key={assignment.id}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                                assignment.role === 'supervisor'
                                  ? 'bg-orange-50 border border-orange-200'
                                  : 'bg-gray-50 border border-gray-200'
                              }`}
                            >
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                assignment.role === 'supervisor'
                                  ? 'bg-orange-500 text-white'
                                  : 'bg-primary-500 text-white'
                              }`}>
                                {assignment.agent?.firstName?.[0]}{assignment.agent?.lastName?.[0]}
                              </div>
                              <span className="font-medium">{assignment.agent?.firstName}</span>
                              <StatusBadge status={assignment.status} />
                            </div>
                          ))}
                          {group.assignments.length > 6 && (
                            <button
                              onClick={() => setDetailModal({ open: true, event })}
                              className="px-3 py-1.5 text-sm text-primary-600 font-medium"
                            >
                              +{group.assignments.length - 6} autres
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Vue liste avec regroupements */
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          {filteredEvents.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-500">
              <FiCalendar size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Aucun événement trouvé</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredEvents.map(event => {
                const group = eventGroups[event.id];
                const eventAssignments = group?.assignments || [];
                const supervisors = eventAssignments.filter(a => a.role === 'supervisor');
                const isEventExpanded = expandedEvents[event.id];

                return (
                  <div key={event.id} className="">
                    {/* En-tête de l'événement */}
                    <div
                      onClick={() => toggleEvent(event.id)}
                      className="px-6 py-4 bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 cursor-pointer transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <button className="p-2 hover:bg-white/50 rounded-lg transition-colors">
                            {isEventExpanded ? (
                              <FiChevronDown size={20} className="text-blue-600" />
                            ) : (
                              <FiChevronDown size={20} className="text-gray-400 transform -rotate-90" />
                            )}
                          </button>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h3 className="text-lg font-bold text-gray-900">{event.name}</h3>
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                {eventAssignments.length} affectation{eventAssignments.length > 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <FiMapPin size={14} />
                                {event.location?.substring(0, 40)}{event.location?.length > 40 ? '...' : ''}
                              </span>
                              <span className="flex items-center gap-1">
                                <FiCalendar size={14} />
                                {event.startDate && format(parseISO(event.startDate), 'dd MMM yyyy', { locale: fr })}
                              </span>
                              <span className="flex items-center gap-1">
                                <FiClock size={14} />
                                {event.checkInTime} - {event.checkOutTime}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">Responsables:</span>
                              <span className="font-bold text-orange-600">{supervisors.length}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">Agents:</span>
                              <span className="font-bold text-blue-600">{eventAssignments.length - supervisors.length}</span>
                            </div>
                          </div>

                          {/* Boutons de confirmation en masse */}
                          {eventAssignments.filter(a => a.status === 'pending').length > 0 && (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <div className="relative group">
                                <button
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors flex items-center gap-1.5"
                                  title="Confirmer en masse"
                                >
                                  <FiCheckCircle size={16} />
                                  <span className="text-xs font-medium">Confirmer</span>
                                  <FiChevronDown size={12} />
                                </button>
                                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border min-w-[200px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                  <div className="py-1">
                                    <button
                                      onClick={() => handleBulkConfirm(event.id, 'all')}
                                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                    >
                                      <FiUsers size={14} className="text-gray-500" />
                                      <span>Tous ({eventAssignments.filter(a => a.status === 'pending').length})</span>
                                    </button>
                                    {eventAssignments.filter(a => a.role !== 'supervisor' && a.status === 'pending').length > 0 && (
                                      <button
                                        onClick={() => handleBulkConfirm(event.id, 'agents')}
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                      >
                                        <FiUser size={14} className="text-blue-500" />
                                        <span>Agents ({eventAssignments.filter(a => a.role !== 'supervisor' && a.status === 'pending').length})</span>
                                      </button>
                                    )}
                                    {eventAssignments.filter(a => a.role === 'supervisor' && a.status === 'pending').length > 0 && (
                                      <button
                                        onClick={() => handleBulkConfirm(event.id, 'supervisors')}
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                      >
                                        <FiShield size={14} className="text-orange-500" />
                                        <span>Responsables ({eventAssignments.filter(a => a.role === 'supervisor' && a.status === 'pending').length})</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Contenu de l'événement */}
                    {isEventExpanded && (
                      <div className="bg-white">
                        {supervisors.length === 0 ? (
                          <div className="px-6 py-8 text-center text-gray-500">
                            <FiShield size={32} className="mx-auto mb-2 text-gray-300" />
                            <p>Aucun responsable affecté à cet événement</p>
                          </div>
                        ) : (
                          supervisors.map(supervisor => {
                            // Trouver les agents sous ce responsable
                            // On vérifie plusieurs critères possibles de liaison
                            const supervisorAgents = eventAssignments.filter(a => {
                              if (a.role === 'supervisor') return false;
                              
                              // Critère 1: via zone.supervisorId
                              if (a.zone?.supervisorId === supervisor.agent?.id) return true;
                              
                              // Critère 2: via agentId direct dans la zone
                              if (a.zone?.agentId === supervisor.agent?.id) return true;
                              
                              // Critère 3: via userId
                              if (a.zone?.userId === supervisor.agent?.id) return true;
                              
                              // Critère 4: via assignedTo
                              if (a.assignedTo === supervisor.agent?.id) return true;
                              
                              // Critère 5: via supervisorId direct dans l'assignment
                              if (a.supervisorId === supervisor.agent?.id) return true;
                              
                              // Critère 6: Si l'agent a une zone qui appartient aux zones du responsable
                              if (a.zoneId && supervisor.zones?.some(z => z.id === a.zoneId)) return true;
                              
                              // Critère 7: Si même zoneId
                              if (a.zoneId && supervisor.zoneId && a.zoneId === supervisor.zoneId) return true;
                              
                              // Critère 8: Si les zones du responsable contiennent cet agent
                              if (supervisor.zones?.some(z => 
                                z.assignments?.some(za => za.agentId === a.agentId || za.id === a.id)
                              )) return true;
                              
                              return false;
                            });
                            
                            console.log('🔍 Supervisor:', supervisor.agent?.firstName, {
                              supervisorId: supervisor.agent?.id,
                              agentId: supervisor.agentId,
                              zoneId: supervisor.zoneId,
                              zones: supervisor.zones,
                              agentsFound: supervisorAgents.length,
                              supervisorAssignment: supervisor,
                              allEventAssignments: eventAssignments.map(a => ({
                                id: a.id,
                                name: a.agent?.firstName,
                                agentId: a.agentId,
                                role: a.role,
                                zoneId: a.zoneId,
                                zone: a.zone,
                                supervisorId: a.supervisorId,
                                assignedTo: a.assignedTo
                              }))
                            });
                            
                            const key = `${event.id}-${supervisor.agent?.id}`;
                            const isSupervisorExpanded = expandedSupervisors[key];

                            return (
                              <div key={supervisor.id} className="border-b last:border-b-0">
                                {/* En-tête du responsable */}
                                <div
                                  onClick={() => toggleSupervisor(event.id, supervisor.agent?.id)}
                                  className="px-6 py-3 bg-orange-50/50 hover:bg-orange-100/50 cursor-pointer transition-colors"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1">
                                      <button className="p-1 hover:bg-white/50 rounded transition-colors">
                                        {isSupervisorExpanded ? (
                                          <FiChevronDown size={18} className="text-orange-600" />
                                        ) : (
                                          <FiChevronDown size={18} className="text-gray-400 transform -rotate-90" />
                                        )}
                                      </button>

                                      <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold">
                                        {supervisor.agent?.firstName?.[0]}{supervisor.agent?.lastName?.[0]}
                                      </div>

                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <p className="font-semibold text-gray-900">
                                            {supervisor.agent?.firstName} {supervisor.agent?.lastName}
                                          </p>
                                          <RoleBadge role="supervisor" />
                                          <StatusBadge status={supervisor.status} />
                                        </div>
                                        <p className="text-xs text-gray-500">{supervisor.agent?.employeeId}</p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                      <div className="text-sm text-gray-600">
                                        <span className="font-medium">{supervisorAgents.length}</span> agent{supervisorAgents.length > 1 ? 's' : ''} sous sa supervision
                                      </div>

                                      <div className="flex items-center gap-1">
                                        {supervisor.status === 'pending' && (
                                          <>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                assignmentsAPI.update(supervisor.id, { status: 'confirmed' });
                                                toast.success('Confirmé');
                                                fetchData();
                                              }}
                                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                                              title="Confirmer"
                                            >
                                              <FiCheck size={16} />
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                assignmentsAPI.update(supervisor.id, { status: 'cancelled' });
                                                toast.success('Annulé');
                                                fetchData();
                                              }}
                                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                                              title="Annuler"
                                            >
                                              <FiX size={16} />
                                            </button>
                                          </>
                                        )}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openRemoveModal(supervisor);
                                          }}
                                          className="p-1.5 text-orange-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                          title="Retirer le responsable"
                                        >
                                          <FiUserMinus size={16} />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Agents sous ce responsable */}
                                {isSupervisorExpanded && (
                                  <div className="bg-gray-50">
                                    {supervisorAgents.length === 0 ? (
                                      <div className="px-6 py-6 text-center text-gray-500">
                                        <FiUsers size={24} className="mx-auto mb-2 text-gray-300" />
                                        <p className="text-sm">Aucun agent affecté sous ce responsable</p>
                                      </div>
                                    ) : (
                                      <table className="w-full">
                                        <thead className="bg-gray-100 border-y">
                                          <tr>
                                            <th className="px-6 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Agent</th>
                                            <th className="px-6 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Zone</th>
                                            <th className="px-6 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Rôle</th>
                                            <th className="px-6 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Statut</th>
                                            <th className="px-6 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y bg-white">
                                          {supervisorAgents.map(agent => (
                                            <tr key={agent.id} className="hover:bg-blue-50/50 transition-colors">
                                              <td className="px-6 py-3">
                                                <div className="flex items-center gap-3">
                                                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-sm">
                                                    {agent.agent?.firstName?.[0]}{agent.agent?.lastName?.[0]}
                                                  </div>
                                                  <div>
                                                    <p className="font-medium text-gray-900 text-sm">
                                                      {agent.agent?.firstName} {agent.agent?.lastName}
                                                    </p>
                                                    <p className="text-xs text-gray-500">{agent.agent?.employeeId}</p>
                                                  </div>
                                                </div>
                                              </td>
                                              <td className="px-6 py-3">
                                                {agent.zone ? (
                                                  <div className="flex items-center gap-2">
                                                    <div
                                                      className="w-3 h-3 rounded-full"
                                                      style={{ backgroundColor: agent.zone.color || '#3B82F6' }}
                                                    />
                                                    <span className="text-sm font-medium text-gray-900">{agent.zone.name}</span>
                                                  </div>
                                                ) : (
                                                  <span className="text-xs text-gray-400 italic">Non assigné</span>
                                                )}
                                              </td>
                                              <td className="px-6 py-3">
                                                <RoleBadge role={agent.role} />
                                              </td>
                                              <td className="px-6 py-3">
                                                <StatusBadge status={agent.status} />
                                              </td>
                                              <td className="px-6 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                  {agent.status === 'pending' && (
                                                    <>
                                                      <button
                                                        onClick={async () => {
                                                          await assignmentsAPI.update(agent.id, { status: 'confirmed' });
                                                          toast.success('Confirmé');
                                                          fetchData();
                                                        }}
                                                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                                                        title="Confirmer"
                                                      >
                                                        <FiCheck size={16} />
                                                      </button>
                                                      <button
                                                        onClick={async () => {
                                                          await assignmentsAPI.update(agent.id, { status: 'cancelled' });
                                                          toast.success('Annulé');
                                                          fetchData();
                                                        }}
                                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                                                        title="Annuler"
                                                      >
                                                        <FiX size={16} />
                                                      </button>
                                                    </>
                                                  )}
                                                  <button
                                                    onClick={() => openRemoveModal(agent)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Retirer l'agent"
                                                  >
                                                    <FiUserMinus size={16} />
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}

                        {/* Agents sans responsable (orphelins) */}
                        {(() => {
                          // Filtrer les agents qui ne sont pas liés à un responsable
                          const orphanAgents = eventAssignments.filter(a => {
                            if (a.role === 'supervisor') return false;
                            
                            // Vérifier si l'agent est lié à au moins un responsable
                            const hasAnyConnection = supervisors.some(s => {
                              return a.zone?.supervisorId === s.agent?.id ||
                                     a.zone?.agentId === s.agent?.id ||
                                     a.zone?.userId === s.agent?.id ||
                                     a.assignedTo === s.agent?.id ||
                                     a.supervisorId === s.agent?.id ||
                                     (a.zoneId && s.zones?.some(z => z.id === a.zoneId)) ||
                                     (a.zoneId && s.zoneId && a.zoneId === s.zoneId) ||
                                     (s.zones?.some(z => z.assignments?.some(za => za.agentId === a.agentId || za.id === a.id)));
                            });
                            
                            return !hasAnyConnection;
                          });
                          
                          console.log('👥 Orphan agents:', orphanAgents.map(a => ({
                            id: a.id,
                            name: a.agent?.firstName,
                            agentId: a.agentId,
                            zoneId: a.zoneId,
                            zone: a.zone,
                            supervisorId: a.supervisorId,
                            assignedTo: a.assignedTo,
                            fullAssignment: a
                          })));
                          
                          if (orphanAgents.length === 0) return null;

                          return (
                            <div className="border-t bg-yellow-50/30">
                              <div className="px-6 py-3 bg-yellow-100/50">
                                <div className="flex items-center gap-2">
                                  <FiAlertCircle className="text-yellow-600" size={18} />
                                  <span className="font-semibold text-gray-900">Agents sans responsable</span>
                                  <span className="px-2 py-0.5 bg-yellow-200 text-yellow-700 rounded-full text-xs font-medium">
                                    {orphanAgents.length}
                                  </span>
                                </div>
                              </div>
                              <table className="w-full">
                                <tbody className="divide-y bg-white">
                                  {orphanAgents.map(agent => (
                                    <tr key={agent.id} className="hover:bg-yellow-50/50 transition-colors">
                                      <td className="px-6 py-3">
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-semibold text-sm">
                                            {agent.agent?.firstName?.[0]}{agent.agent?.lastName?.[0]}
                                          </div>
                                          <div>
                                            <p className="font-medium text-gray-900 text-sm">
                                              {agent.agent?.firstName} {agent.agent?.lastName}
                                            </p>
                                            <p className="text-xs text-gray-500">{agent.agent?.employeeId}</p>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-6 py-3">
                                        {agent.zone ? (
                                          <div className="flex items-center gap-2">
                                            <div
                                              className="w-3 h-3 rounded-full"
                                              style={{ backgroundColor: agent.zone.color || '#3B82F6' }}
                                            />
                                            <span className="text-sm font-medium text-gray-900">{agent.zone.name}</span>
                                          </div>
                                        ) : (
                                          <span className="text-xs text-gray-400 italic">Non assigné</span>
                                        )}
                                      </td>
                                      <td className="px-6 py-3">
                                        <RoleBadge role={agent.role} />
                                      </td>
                                      <td className="px-6 py-3">
                                        <StatusBadge status={agent.status} />
                                      </td>
                                      <td className="px-6 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          {agent.status === 'pending' && (
                                            <>
                                              <button
                                                onClick={async () => {
                                                  await assignmentsAPI.update(agent.id, { status: 'confirmed' });
                                                  toast.success('Confirmé');
                                                  fetchData();
                                                }}
                                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                                                title="Confirmer"
                                              >
                                                <FiCheck size={16} />
                                              </button>
                                              <button
                                                onClick={async () => {
                                                  await assignmentsAPI.update(agent.id, { status: 'cancelled' });
                                                  toast.success('Annulé');
                                                  fetchData();
                                                }}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                                                title="Annuler"
                                              >
                                                <FiX size={16} />
                                              </button>
                                            </>
                                          )}
                                          <button
                                            onClick={() => openRemoveModal(agent)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Retirer l'agent"
                                          >
                                            <FiUserMinus size={16} />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <AssignmentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={fetchData}
        events={events}
        agents={agents}
        supervisors={supervisors}
      />

      <EventDetailModal
        isOpen={detailModal.open}
        onClose={() => setDetailModal({ open: false, event: null })}
        event={detailModal.event}
        assignments={assignments}
        onRefresh={fetchData}
      />

      {/* Modal de confirmation de retrait */}
      <ConfirmRemoveModal
        isOpen={removeModal.open}
        onClose={() => setRemoveModal({ open: false, assignment: null })}
        onConfirm={handleRemove}
        assignment={removeModal.assignment}
        loading={removeLoading}
      />
    </div>
  );
};

export default Assignments;
