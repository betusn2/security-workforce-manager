import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiPlus, FiSearch, FiUser, FiCalendar, FiMapPin, FiFilter,
  FiGrid, FiList, FiUserCheck, FiShield, FiChevronDown,
  FiCheck, FiX, FiAlertCircle, FiRefreshCw, FiEye, FiArrowLeft
} from 'react-icons/fi';
import { assignmentsAPI, eventsAPI, usersAPI, zonesAPI } from '../services/api';
import { toast } from 'react-toastify';
import { format, parseISO, isBefore, isToday } from 'date-fns';
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

// Modal de création d'affectation
const AssignmentModal = ({ isOpen, onClose, onSave, events, agents, supervisors }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    eventId: '',
    selectedAgents: [], // [{agent, zoneId}]
    selectedSupervisor: '',
    supervisorZoneIds: [],
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [searchAgent, setSearchAgent] = useState('');
  const [searchEvent, setSearchEvent] = useState('');
  const [searchSupervisor, setSearchSupervisor] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [zones, setZones] = useState([]);
  const [loadingZones, setLoadingZones] = useState(false);
  
  // États pour la proximité
  const [proximityRadius, setProximityRadius] = useState(5000); // 5km par défaut
  const [showProximityFilter, setShowProximityFilter] = useState(false);
  const [showSupervisorProximityFilter, setShowSupervisorProximityFilter] = useState(false);
  const [sortBy, setSortBy] = useState('proximity'); // 'proximity', 'name', 'score'

  useEffect(() => {
    if (!isOpen) {
      setFormData({ eventId: '', selectedAgents: [], selectedSupervisor: '', supervisorZoneIds: [], notes: '' });
      setSelectedEvent(null);
      setZones([]);
      setStep(1);
    }
  }, [isOpen]);

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
    const existingIndex = formData.selectedAgents.findIndex(a => 
      (a.agent?.id || a.id) === agent.id
    );
    
    if (existingIndex >= 0) {
      // Agent déjà sélectionné, le retirer
      setFormData({
        ...formData,
        selectedAgents: formData.selectedAgents.filter((_, idx) => idx !== existingIndex)
      });
    } else {
      // Ajouter l'agent avec sa zone
      setFormData({
        ...formData,
        selectedAgents: [...formData.selectedAgents, { agent, zoneId }]
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

  const handleSubmit = async () => {
    if (!formData.eventId) {
      toast.error('Sélectionnez un événement');
      return;
    }
    if (formData.selectedAgents.length === 0 && !formData.selectedSupervisor) {
      toast.error('Sélectionnez au moins un agent ou un responsable');
      return;
    }

    setLoading(true);
    try {
      const promises = [];

      // Créer les affectations pour les agents (groupées par zone)
      if (formData.selectedAgents.length > 0) {
        const agentsByZone = {};
        formData.selectedAgents.forEach(item => {
          const agent = item.agent || item;
          const zoneId = item.zoneId || null;
          const zoneKey = zoneId || 'no-zone';
          if (!agentsByZone[zoneKey]) agentsByZone[zoneKey] = [];
          agentsByZone[zoneKey].push(agent.id);
        });

        // Créer les affectations pour chaque groupe de zone
        for (const [zoneKey, agentIds] of Object.entries(agentsByZone)) {
          const zoneId = zoneKey === 'no-zone' ? null : zoneKey;
          if (agentIds.length === 1) {
            promises.push(assignmentsAPI.create({
              eventId: formData.eventId,
              agentId: agentIds[0],
              zoneId,
              role: 'primary',
              notes: formData.notes
            }));
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

      // Créer les affectations pour le superviseur
      if (formData.selectedSupervisor) {
        if (formData.supervisorZoneIds.length > 0) {
          // Créer une affectation pour chaque zone sélectionnée
          for (const zoneId of formData.supervisorZoneIds) {
            promises.push(assignmentsAPI.create({
              eventId: formData.eventId,
              agentId: formData.selectedSupervisor,
              zoneId,
              role: 'supervisor',
              notes: formData.notes
            }));
          }
        } else {
          // Si aucune zone sélectionnée, créer une affectation sans zone
          promises.push(assignmentsAPI.create({
            eventId: formData.eventId,
            agentId: formData.selectedSupervisor,
            zoneId: null,
            role: 'supervisor',
            notes: formData.notes
          }));
        }
      }

      await Promise.all(promises);
      toast.success('Affectation(s) créée(s) avec succès');
      onSave();
      onClose();
    } catch (error) {
      console.error('Assignment creation error:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la création');
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
      const agentsWithCoords = result.filter(a => a.distance !== null).length;
      
      if (agentsWithCoords === 0) {
        console.warn('⚠️ Aucun agent avec coordonnées GPS - filtre de proximité ignoré');
      } else {
        result = result.filter(agent => {
          if (agent.distance === null) return false;
          return agent.distance <= proximityRadius;
        });
      }
    }

    // Trier selon le critère sélectionné
    result.sort((a, b) => {
      if (sortBy === 'proximity') {
        if (a.distance === null && b.distance === null) return 0;
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      } else if (sortBy === 'name') {
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      } else if (sortBy === 'score') {
        return (b.overallScore || 0) - (a.overallScore || 0);
      }
      return 0;
    });

    return result;
  }, [agents, searchAgent, selectedEvent, showProximityFilter, proximityRadius, sortBy]);

  // Superviseurs avec distance calculée et filtrés/triés
  const filteredSupervisors = useMemo(() => {
    let result = supervisors.map(supervisor => {
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

  // Stats de proximité
  const proximityStats = useMemo(() => {
    if (!selectedEvent?.latitude || !selectedEvent?.longitude) return null;
    
    const agentsWithDistance = agents.filter(a => {
      const agentLat = a.currentLatitude || a.latitude || a.lat;
      const agentLon = a.currentLongitude || a.longitude || a.lon || a.lng;
      return agentLat && agentLon;
    });
    
    const within5km = agentsWithDistance.filter(a => {
      const agentLat = a.currentLatitude || a.latitude || a.lat;
      const agentLon = a.currentLongitude || a.longitude || a.lon || a.lng;
      const dist = calculateDistance(
        parseFloat(selectedEvent.latitude),
        parseFloat(selectedEvent.longitude),
        parseFloat(agentLat),
        parseFloat(agentLon)
      );
      return dist <= 5000;
    }).length;
    
    const within50km = agentsWithDistance.filter(a => {
      const agentLat = a.currentLatitude || a.latitude || a.lat;
      const agentLon = a.currentLongitude || a.longitude || a.lon || a.lng;
      const dist = calculateDistance(
        parseFloat(selectedEvent.latitude),
        parseFloat(selectedEvent.longitude),
        parseFloat(agentLat),
        parseFloat(agentLon)
      );
      return dist <= 50000;
    }).length;

    return {
      total: agentsWithDistance.length,
      within5km,
      within50km,
      withinRadius: agentsWithDistance.filter(a => {
        const agentLat = a.currentLatitude || a.latitude || a.lat;
        const agentLon = a.currentLongitude || a.longitude || a.lon || a.lng;
        const dist = calculateDistance(
          parseFloat(selectedEvent.latitude),
          parseFloat(selectedEvent.longitude),
          parseFloat(agentLat),
          parseFloat(agentLon)
        );
        return dist <= proximityRadius;
      }).length
    };
  }, [agents, selectedEvent, proximityRadius]);

  const filteredEvents = events.filter(event => {
    if (!searchEvent) return true;
    const search = searchEvent.toLowerCase();
    return event.name?.toLowerCase().includes(search) ||
           event.location?.toLowerCase().includes(search);
  });

  // Helper pour formater la distance
  const formatDistance = (distance) => {
    if (distance === null) return null;
    if (distance < 1000) {
      return `${Math.round(distance)}m`;
    } else {
      return `${(distance / 1000).toFixed(1)}km`;
    }
  };

  // Badge de distance
  const DistanceBadge = ({ distance }) => {
    if (distance === null) return null;
    
    let color = 'bg-gray-100 text-gray-600';
    if (distance <= 1000) color = 'bg-green-100 text-green-700';
    else if (distance <= 5000) color = 'bg-blue-100 text-blue-700';
    else if (distance <= 10000) color = 'bg-yellow-100 text-yellow-700';
    else color = 'bg-red-100 text-red-700';
    
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
        📍 {formatDistance(distance)}
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-primary-50 to-blue-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Nouvelle Affectation</h2>
              <p className="text-sm text-gray-500 mt-1">
                {step === 1 ? 'Étape 1: Sélectionnez un événement' : 'Étape 2: Sélectionnez les agents'}
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
          {/* Step 1: Sélection de l'événement */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un événement..."
                  value={searchEvent}
                  onChange={(e) => setSearchEvent(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="grid gap-3 max-h-96 overflow-y-auto">
                {filteredEvents.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">Aucun événement trouvé</p>
                ) : (
                  filteredEvents.map(event => (
                    <div
                      key={event.id}
                      onClick={() => handleEventSelect(event)}
                      className="p-4 border rounded-xl hover:border-primary-500 hover:bg-primary-50 cursor-pointer transition-all"
                    >
                      <h3 className="font-semibold text-gray-900">{event.name}</h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <FiCalendar size={14} />
                          {event.startDate ? format(parseISO(event.startDate), 'dd MMM yyyy', { locale: fr }) : 'N/A'}
                        </span>
                        <span className="flex items-center gap-1">
                          <FiMapPin size={14} />
                          {event.location}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Step 2: Sélection des agents et superviseurs */}
          {step === 2 && selectedEvent && (
            <div className="space-y-6">
              {/* Résumé de l'événement */}
              <div className="p-4 bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl border border-primary-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-primary-600 font-medium mb-1">Événement sélectionné</p>
                    <h3 className="font-bold text-gray-900">{selectedEvent.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                      <span className="flex items-center gap-1">
                        <FiCalendar size={12} />
                        {selectedEvent.startDate ? format(parseISO(selectedEvent.startDate), 'dd MMMM yyyy', { locale: fr }) : 'N/A'}
                      </span>
                      <span className="flex items-center gap-1">
                        <FiMapPin size={12} />
                        {selectedEvent.location}
                      </span>
                    </div>
                    {/* Stats de proximité */}
                    {proximityStats && (
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                        <span>📍 {proximityStats.within5km} agents à -5km</span>
                        <span>🚗 {proximityStats.within50km} agents à -50km</span>
                        <span>📊 {proximityStats.total} agents avec GPS</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setStep(1)}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Changer
                  </button>
                </div>
              </div>

              {/* Zones disponibles */}
              {zones.length > 0 && (
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-100 overflow-hidden">
                  <div className="p-4 border-b border-purple-100 bg-white/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-200">
                          <FiMapPin className="text-white" size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800">Zones de l'événement</h4>
                          <p className="text-xs text-gray-500">{zones.length} zone(s) disponible(s)</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          {zones.reduce((sum, z) => sum + (z.requiredAgents || 1), 0)} agents requis
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {zones.map(zone => (
                        <div
                          key={zone.id}
                          className="bg-white rounded-xl p-3 shadow-sm border-l-4 hover:shadow-md transition-shadow"
                          style={{ borderLeftColor: zone.color || '#3B82F6' }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                              style={{ backgroundColor: zone.color || '#3B82F6' }}
                            >
                              {zone.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h5 className="font-semibold text-gray-800 text-sm">{zone.name}</h5>
                              <span className="text-xs text-gray-500">
                                {zone.priority === 'high' && '🔥 '}
                                {zone.priority === 'critical' && '🚨 '}
                                {zone.requiredAgents || 1} agent(s) requis
                              </span>
                            </div>
                          </div>
                          {zone.description && (
                            <p className="text-xs text-gray-600 mt-1">{zone.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Alertes GPS */}
              {(!selectedEvent?.latitude || !selectedEvent?.longitude) && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                  <FiAlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={16} />
                  <div className="text-xs text-yellow-800">
                    <p className="font-medium">Localisation GPS non définie pour l'événement</p>
                    <p className="text-yellow-700">Le filtre de proximité n'est pas disponible.</p>
                  </div>
                </div>
              )}

              {selectedEvent?.latitude && selectedEvent?.longitude && proximityStats && proximityStats.total === 0 && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-2">
                  <FiAlertCircle className="text-orange-600 flex-shrink-0 mt-0.5" size={16} />
                  <div className="text-xs text-orange-800">
                    <p className="font-medium">Aucun agent avec localisation GPS</p>
                    <p className="text-orange-700">Le filtre de proximité ne peut pas fonctionner.</p>
                  </div>
                </div>
              )}

              {/* Sélection des superviseurs */}
              <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-100">
                <div className="p-4 border-b border-orange-100 bg-white/50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-200">
                        <FiShield className="text-white" size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800">Responsable</h4>
                        <p className="text-xs text-gray-500">
                          {formData.selectedSupervisor ? '1 sélectionné' : 'Aucun responsable sélectionné'}
                        </p>
                      </div>
                    </div>
                    {/* Contrôles de proximité pour superviseurs */}
                    {selectedEvent?.latitude && selectedEvent?.longitude && (
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showSupervisorProximityFilter}
                            onChange={(e) => setShowSupervisorProximityFilter(e.target.checked)}
                            className="w-3 h-3 text-orange-500 rounded focus:ring-orange-500"
                          />
                          <span className="text-gray-600">Proximité</span>
                        </label>
                        {showSupervisorProximityFilter && (
                          <select
                            value={proximityRadius}
                            onChange={(e) => setProximityRadius(parseInt(e.target.value))}
                            className="text-xs border rounded px-2 py-1"
                          >
                            <option value="1000">1km</option>
                            <option value="5000">5km</option>
                            <option value="10000">10km</option>
                            <option value="25000">25km</option>
                          </select>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="relative mb-3">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      placeholder="Rechercher un responsable..."
                      value={searchSupervisor}
                      onChange={(e) => setSearchSupervisor(e.target.value)}
                      className="w-full pl-8 pr-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="p-4">
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {filteredSupervisors.length === 0 ? (
                      <p className="text-center text-gray-500 py-4 text-sm">Aucun responsable trouvé</p>
                    ) : (
                      filteredSupervisors.map(supervisor => {
                        const isSelected = formData.selectedSupervisor === supervisor.id;
                        return (
                          <div
                            key={supervisor.id}
                            onClick={() => setFormData({ 
                              ...formData, 
                              selectedSupervisor: isSelected ? '' : supervisor.id,
                              supervisorZoneIds: []
                            })}
                            className={`p-3 border rounded-lg cursor-pointer transition-all ${
                              isSelected ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                isSelected ? 'bg-orange-500 border-orange-500' : 'border-gray-300'
                              }`}>
                                {isSelected && <FiCheck size={12} className="text-white" />}
                              </div>
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900 text-sm">
                                  {supervisor.firstName} {supervisor.lastName}
                                </h4>
                                <p className="text-xs text-gray-600">{supervisor.employeeId}</p>
                              </div>
                              <DistanceBadge distance={supervisor.distance} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Sélection des zones pour le superviseur */}
                  {formData.selectedSupervisor && zones.length > 0 && (
                    <div className="mt-4 p-3 bg-white rounded-lg border border-orange-200">
                      <label className="block text-xs font-medium text-gray-600 mb-2">
                        Affecter aux zones (optionnel - plusieurs possibles)
                      </label>
                      <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                        {zones.map(zone => {
                          const isSelected = formData.supervisorZoneIds.includes(zone.id);
                          return (
                            <label
                              key={zone.id}
                              className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                                isSelected ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 border-gray-200 hover:border-orange-200'
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
                                className="w-3 h-3 text-orange-500 rounded focus:ring-orange-500"
                              />
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: zone.color || '#F97316' }}
                              />
                              <span className="text-xs text-gray-700 truncate">{zone.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Sélection des agents */}
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
                <div className="p-4 border-b border-blue-100 bg-white/50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                        <FiUser className="text-white" size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800">Agents</h4>
                        <p className="text-xs text-gray-500">
                          {formData.selectedAgents.length} sélectionné(s) sur {selectedEvent.requiredAgents || 1} requis
                        </p>
                      </div>
                    </div>

                    {/* Contrôles de proximité et tri pour agents */}
                    {selectedEvent?.latitude && selectedEvent?.longitude && proximityStats && proximityStats.total > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showProximityFilter}
                            onChange={(e) => setShowProximityFilter(e.target.checked)}
                            className="w-3 h-3 text-blue-500 rounded focus:ring-blue-500"
                          />
                          <span className="text-gray-600">Proximité</span>
                        </label>
                        {showProximityFilter && (
                          <select
                            value={proximityRadius}
                            onChange={(e) => setProximityRadius(parseInt(e.target.value))}
                            className="border rounded px-2 py-1"
                          >
                            <option value="1000">1km</option>
                            <option value="5000">5km</option>
                            <option value="10000">10km</option>
                            <option value="25000">25km</option>
                          </select>
                        )}
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          className="border rounded px-2 py-1"
                        >
                          <option value="proximity">Par distance</option>
                          <option value="name">Par nom</option>
                          <option value="score">Par score</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      placeholder="Rechercher un agent..."
                      value={searchAgent}
                      onChange={(e) => setSearchAgent(e.target.value)}
                      className="w-full pl-8 pr-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="p-4">
                  <div className="grid gap-3 max-h-96 overflow-y-auto">
                    {filteredAgents.length === 0 ? (
                      <p className="text-center text-gray-500 py-8 text-sm">Aucun agent trouvé</p>
                    ) : (
                      filteredAgents.map(agent => {
                        const isSelected = formData.selectedAgents.some(a => (a.agent?.id || a.id) === agent.id);
                        return (
                          <div
                            key={agent.id}
                            className={`p-4 border rounded-xl transition-all ${
                              isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                            }`}
                          >
                            <div 
                              className="flex items-center gap-3 cursor-pointer"
                              onClick={() => toggleAgent(agent)}
                            >
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                              }`}>
                                {isSelected && <FiCheck size={12} className="text-white" />}
                              </div>
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900 text-sm">
                                  {agent.firstName} {agent.lastName}
                                </h4>
                                <p className="text-xs text-gray-600">{agent.employeeId}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <DistanceBadge distance={agent.distance} />
                                {agent.overallScore && (
                                  <span className="text-xs text-gray-500">
                                    ⭐ {agent.overallScore}/100
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Sélection de zone pour l'agent */}
                            {isSelected && zones.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <label className="block text-xs font-medium text-gray-600 mb-2">
                                  Affecter à une zone (optionnel)
                                </label>
                                <select
                                  value={formData.selectedAgents.find(a => (a.agent?.id || a.id) === agent.id)?.zoneId || ''}
                                  onChange={(e) => updateAgentZone(agent.id, e.target.value || null)}
                                  className="w-full text-xs border rounded px-2 py-1.5"
                                >
                                  <option value="">Aucune zone spécifique</option>
                                  {zones.map(zone => (
                                    <option key={zone.id} value={zone.id}>{zone.name}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (optionnel)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows="3"
                  placeholder="Ajouter des notes..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer*/}
        <div className="p-6 border-t bg-gray-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-100 transition-colors"
          >
            Annuler
          </button>
          {step === 2 && (
            <button
              onClick={handleSubmit}
              disabled={loading || (formData.selectedAgents.length === 0 && !formData.selectedSupervisor)}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Création...' : 'Créer l\'affectation'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// 📱 Card pour mobile
const AssignmentCard = ({ assignment, onViewDetails, onConfirm, onDecline, onRemove, isSelected, onSelect }) => (
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
            onChange={() => onSelect(assignment.id)}
            className="mt-0.5 w-5 h-5 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
          />
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{assignment.event?.name || 'Événement'}</h3>
            <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
              <FiCalendar size={10} />
              {assignment.event?.startTime ? format(parseISO(assignment.event.startTime), 'dd MMM yyyy', { locale: fr }) : 'N/A'}
            </p>
          </div>
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
const AssignmentRow = ({ assignment, onViewDetails, onConfirm, onDecline, onRemove, isSelected, onSelect }) => (
  <tr className={`transition-colors ${
    isSelected ? 'bg-primary-50 hover:bg-primary-100' : 'hover:bg-gray-50'
  }`}>
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
  const [agents, setAgents] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' ou 'list'
  
  // Modal
  const [showModal, setShowModal] = useState(false);
  
  // Filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  
  // Sélection en masse
  const [selectedIds, setSelectedIds] = useState([]);

  // Charger les données
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [assignmentsRes, eventsRes, usersRes] = await Promise.all([
        assignmentsAPI.getAll(),
        eventsAPI.getAll(),
        usersAPI.getAll()
      ]);
      
      // Gestion de différentes structures de réponse API
      const assignmentsData = assignmentsRes.data?.data?.assignments || assignmentsRes.data?.assignments || assignmentsRes.data?.data || assignmentsRes.data || [];
      const eventsData = eventsRes.data?.data?.events || eventsRes.data?.events || eventsRes.data?.data || eventsRes.data || [];
      const usersData = usersRes.data?.data?.users || usersRes.data?.users || usersRes.data?.data || usersRes.data || [];
      
      // S'assurer que ce sont bien des tableaux
      setAssignments(Array.isArray(assignmentsData) ? assignmentsData : []);
      setEvents(Array.isArray(eventsData) ? eventsData : []);
      
      // Séparer agents et superviseurs
      if (Array.isArray(usersData)) {
        setAgents(usersData.filter(u => u.role === 'agent'));
        setSupervisors(usersData.filter(u => u.role === 'supervisor'));
      }
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

  // Sélection en masse
  const handleSelectOne = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredAssignments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAssignments.map(a => a.id));
    }
  };

  const handleSelectByEvent = (eventId) => {
    const eventAssignments = filteredAssignments.filter(a => a.eventId === eventId);
    const eventIds = eventAssignments.map(a => a.id);
    const allSelected = eventIds.every(id => selectedIds.includes(id));
    
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !eventIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...eventIds])]);
    }
  };

  // Actions en masse
  const handleBulkConfirm = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Confirmer ${selectedIds.length} affectation(s) ?`)) return;
    
    try {
      await Promise.all(
        selectedIds.map(id => assignmentsAPI.update(id, { status: 'confirmed' }))
      );
      toast.success(`${selectedIds.length} affectation(s) confirmée(s)`);
      setSelectedIds([]);
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la confirmation en masse');
    }
  };

  const handleBulkCancelConfirmation = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Annuler la confirmation de ${selectedIds.length} affectation(s) ?`)) return;
    
    try {
      await Promise.all(
        selectedIds.map(id => assignmentsAPI.update(id, { status: 'pending' }))
      );
      toast.success(`Confirmation annulée pour ${selectedIds.length} affectation(s)`);
      setSelectedIds([]);
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de l\'annulation');
    }
  };

  const handleBulkDecline = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Refuser ${selectedIds.length} affectation(s) ?`)) return;
    
    try {
      await Promise.all(
        selectedIds.map(id => assignmentsAPI.update(id, { status: 'declined' }))
      );
      toast.success(`${selectedIds.length} affectation(s) refusée(s)`);
      setSelectedIds([]);
      fetchData();
    } catch (error) {
      toast.error('Erreur lors du refus en masse');
    }
  };

  const handleBulkRemove = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Supprimer ${selectedIds.length} affectation(s) ? Cette action est irréversible.`)) return;
    
    try {
      await Promise.all(
        selectedIds.map(id => assignmentsAPI.delete(id))
      );
      toast.success(`${selectedIds.length} affectation(s) supprimée(s)`);
      setSelectedIds([]);
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la suppression en masse');
    }
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
              onClick={() => setShowModal(true)}
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

            {/* Actions de sélection rapide */}
            {eventFilter !== 'all' && filteredAssignments.length > 0 && (
              <div className="mt-3 flex items-center gap-2 p-3 bg-primary-50 border border-primary-200 rounded-xl">
                <FiUserCheck className="text-primary-600" size={18} />
                <span className="text-sm text-primary-800 font-medium">
                  Sélection rapide pour cet événement:
                </span>
                <button
                  onClick={() => handleSelectByEvent(eventFilter)}
                  className="ml-auto px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <FiCheck size={14} />
                  {filteredAssignments.filter(a => a.eventId === eventFilter).every(a => selectedIds.includes(a.id))
                    ? 'Tout désélectionner'
                    : `Sélectionner tout (${filteredAssignments.filter(a => a.eventId === eventFilter).length})`
                  }
                </button>
              </div>
            )}
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
                  isSelected={selectedIds.includes(assignment.id)}
                  onSelect={handleSelectOne}
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
                      isSelected={selectedIds.includes(assignment.id)}
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
                              checked={selectedIds.length > 0 && selectedIds.length === filteredAssignments.length}
                              onChange={handleSelectAll}
                              className="w-5 h-5 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                            />
                          </th>
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
                            isSelected={selectedIds.includes(assignment.id)}
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
        {!loading && filteredAssignments.length > 0 && (
          <div className="mt-6 text-center text-sm text-gray-600">
            Affichage de <span className="font-semibold text-gray-900">{filteredAssignments.length}</span> affectation(s)
            {filteredAssignments.length !== assignments.length && (
              <> sur <span className="font-semibold text-gray-900">{assignments.length}</span> au total</>
            )}
          </div>
        )}
      </div>

      {/* Barre d'actions flottante - sélection en masse */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="bg-gray-900 text-white rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center font-bold">
                {selectedIds.length}
              </div>
              <span className="font-medium hidden sm:inline">sélectionné(s)</span>
            </div>
            
            <div className="h-6 w-px bg-gray-700"></div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkConfirm}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg font-medium transition-colors flex items-center gap-2"
                title="Confirmer la sélection"
              >
                <FiCheck size={16} />
                <span className="hidden sm:inline">Confirmer</span>
              </button>
              
              <button
                onClick={handleBulkCancelConfirmation}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 rounded-lg font-medium transition-colors flex items-center gap-2"
                title="Annuler confirmation"
              >
                <FiRefreshCw size={16} />
                <span className="hidden sm:inline">Annuler</span>
              </button>
              
              <button
                onClick={handleBulkDecline}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-medium transition-colors flex items-center gap-2"
                title="Refuser la sélection"
              >
                <FiAlertCircle size={16} />
                <span className="hidden sm:inline">Refuser</span>
              </button>
              
              <button
                onClick={handleBulkRemove}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg font-medium transition-colors flex items-center gap-2"
                title="Supprimer la sélection"
              >
                <FiX size={16} />
                <span className="hidden sm:inline">Supprimer</span>
              </button>
            </div>
            
            <div className="h-6 w-px bg-gray-700"></div>
            
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-2 hover:bg-gray-800 rounded-lg transition-colors"
              title="Tout désélectionner"
            >
              <FiX size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Modal d'affectation */}
      <AssignmentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={fetchData}
        events={events}
        agents={agents}
        supervisors={supervisors}
      />
    </div>
  );
};

export default AssignmentsResponsive;
