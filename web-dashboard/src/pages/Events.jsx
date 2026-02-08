import React, { useState, useEffect } from 'react';
import {
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiMapPin,
  FiClock, FiUsers, FiCalendar, FiCheck, FiCopy,
  FiAlertTriangle, FiRepeat, FiEye, FiX, FiFilter,
  FiChevronDown, FiChevronUp, FiActivity, FiTrendingUp,
  FiUserCheck, FiUserX, FiAlertCircle, FiCheckCircle,
  FiInfo, FiFlag, FiLayers, FiShield
} from 'react-icons/fi';
import { eventsAPI, zonesAPI, usersAPI } from '../services/api';
import { toast } from 'react-toastify';
import { format, formatDistanceToNow, isToday, isTomorrow, isPast, isFuture, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import AddressAutocomplete from '../components/AddressAutocomplete';
import MiniMap from '../components/MiniMap';
import ZoneManager from '../components/ZoneManager';

// Couleurs prédéfinies pour les événements
const EVENT_COLORS = [
  { name: 'Bleu', value: '#3B82F6', bg: 'bg-blue-500' },
  { name: 'Vert', value: '#10B981', bg: 'bg-green-500' },
  { name: 'Rouge', value: '#EF4444', bg: 'bg-red-500' },
  { name: 'Orange', value: '#F97316', bg: 'bg-orange-500' },
  { name: 'Violet', value: '#8B5CF6', bg: 'bg-purple-500' },
  { name: 'Rose', value: '#EC4899', bg: 'bg-pink-500' },
  { name: 'Jaune', value: '#EAB308', bg: 'bg-yellow-500' },
  { name: 'Cyan', value: '#06B6D4', bg: 'bg-cyan-500' },
];

// Options de priorité
const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Basse', color: 'text-gray-500', bg: 'bg-gray-100', icon: FiFlag },
  { value: 'medium', label: 'Moyenne', color: 'text-blue-500', bg: 'bg-blue-100', icon: FiFlag },
  { value: 'high', label: 'Haute', color: 'text-orange-500', bg: 'bg-orange-100', icon: FiAlertTriangle },
  { value: 'critical', label: 'Critique', color: 'text-red-500', bg: 'bg-red-100', icon: FiAlertCircle },
];

// Options de récurrence
const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Aucune' },
  { value: 'daily', label: 'Quotidien' },
  { value: 'weekly', label: 'Hebdomadaire' },
  { value: 'biweekly', label: 'Toutes les 2 semaines' },
  { value: 'monthly', label: 'Mensuel' },
];

// Modal de détails de l'événement
const EventDetailsModal = ({ isOpen, onClose, event, onEdit, onDelete, onDuplicate }) => {
  const [zones, setZones] = useState([]);
  const [loadingZones, setLoadingZones] = useState(false);
  const [zoneManagerOpen, setZoneManagerOpen] = useState(false);

  useEffect(() => {
    if (isOpen && event?.id) {
      fetchZones();
    } else {
      setZones([]);
    }
  }, [isOpen, event?.id]);

  const fetchZones = async () => {
    if (!event?.id) return;
    setLoadingZones(true);
    try {
      const res = await zonesAPI.getByEvent(event.id);
      setZones(res.data.data || []);
    } catch (error) {
      console.error('Error fetching zones:', error);
      setZones([]);
    } finally {
      setLoadingZones(false);
    }
  };

  if (!isOpen || !event) return null;

  const getPriorityInfo = (priority) => {
    return PRIORITY_OPTIONS.find(p => p.value === priority) || PRIORITY_OPTIONS[1];
  };

  const priorityInfo = getPriorityInfo(event.priority);
  const PriorityIcon = priorityInfo.icon;

  const getTimeStatus = () => {
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    const now = new Date();

    if (isPast(endDate)) {
      return { label: 'Terminé', class: 'text-gray-500' };
    }
    if (isToday(startDate)) {
      return { label: "Aujourd'hui", class: 'text-green-600 font-semibold' };
    }
    if (isTomorrow(startDate)) {
      return { label: 'Demain', class: 'text-blue-600' };
    }
    if (isFuture(startDate)) {
      const days = differenceInDays(startDate, now);
      return { label: `Dans ${days} jours`, class: 'text-gray-600' };
    }
    return { label: 'En cours', class: 'text-green-600' };
  };

  const timeStatus = getTimeStatus();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header avec couleur */}
        <div
          className="p-6 text-white rounded-t-xl"
          style={{ backgroundColor: event.color || '#3B82F6' }}
        >
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-1 bg-white bg-opacity-20 rounded text-sm">
                  {event.type === 'regular' ? 'Régulier' : event.type === 'special' ? 'Spécial' : 'Urgence'}
                </span>
                <span className={`px-2 py-1 rounded text-sm flex items-center gap-1 ${priorityInfo.bg} ${priorityInfo.color}`}>
                  <PriorityIcon size={12} />
                  {priorityInfo.label}
                </span>
              </div>
              <h2 className="text-2xl font-bold">{event.name}</h2>
              <p className={`mt-1 ${timeStatus.class} bg-white bg-opacity-20 inline-block px-2 py-1 rounded`}>
                {timeStatus.label}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full">
              <FiX size={24} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Description */}
          {event.description && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-2 flex items-center">
                <FiInfo className="mr-2" /> Description
              </h3>
              <p className="text-gray-600 bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}

          {/* Informations principales en grille */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <FiCalendar className="mx-auto text-blue-500 mb-2" size={24} />
              <p className="text-sm text-gray-500">Date début</p>
              <p className="font-semibold">{format(new Date(event.startDate), 'dd MMM yyyy', { locale: fr })}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <FiCalendar className="mx-auto text-blue-500 mb-2" size={24} />
              <p className="text-sm text-gray-500">Date fin</p>
              <p className="font-semibold">{format(new Date(event.endDate), 'dd MMM yyyy', { locale: fr })}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <FiClock className="mx-auto text-green-500 mb-2" size={24} />
              <p className="text-sm text-gray-500">Check-in</p>
              <p className="font-semibold">{event.checkInTime}</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg text-center">
              <FiClock className="mx-auto text-orange-500 mb-2" size={24} />
              <p className="text-sm text-gray-500">Check-out</p>
              <p className="font-semibold">{event.checkOutTime}</p>
            </div>
          </div>

          {/* Localisation avec carte */}
          <div>
            <h3 className="font-semibold text-gray-700 mb-2 flex items-center">
              <FiMapPin className="mr-2" /> Localisation
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-700 mb-3">{event.location}</p>
              {event.latitude && event.longitude && (
                <div className="h-48 rounded-lg overflow-hidden">
                  <MiniMap
                    latitude={event.latitude}
                    longitude={event.longitude}
                    geoRadius={event.geoRadius}
                    height="192px"
                    draggable={false}
                  />
                </div>
              )}
              <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                {event.latitude && event.longitude && (
                  <span>GPS: {event.latitude}, {event.longitude}</span>
                )}
                <span>Rayon: {event.geoRadius}m</span>
              </div>
            </div>
          </div>

          {/* Agents */}
          <div>
            <h3 className="font-semibold text-gray-700 mb-2 flex items-center">
              <FiUsers className="mr-2" /> Agents
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-3xl font-bold text-gray-700">{event.requiredAgents}</p>
                <p className="text-sm text-gray-500">Requis</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <p className="text-3xl font-bold text-green-600">{event.assignedAgentsCount || 0}</p>
                <p className="text-sm text-gray-500">Assignés</p>
              </div>
              <div className={`p-4 rounded-lg text-center ${(event.assignedAgentsCount || 0) >= event.requiredAgents ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className={`text-3xl font-bold ${(event.assignedAgentsCount || 0) >= event.requiredAgents ? 'text-green-600' : 'text-red-600'}`}>
                  {(event.assignedAgentsCount || 0) - event.requiredAgents}
                </p>
                <p className="text-sm text-gray-500">
                  {(event.assignedAgentsCount || 0) >= event.requiredAgents ? 'Complet' : 'Manquants'}
                </p>
              </div>
            </div>
          </div>

          {/* Zones */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-5 border border-purple-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-200">
                  <FiLayers className="text-white" size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">Zones de l'evenement</h3>
                  <p className="text-sm text-gray-500">
                    {zones.length === 0 ? 'Aucune zone configuree' : `${zones.length} zone(s) configuree(s)`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setZoneManagerOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all shadow-md hover:shadow-lg font-medium text-sm"
              >
                <FiPlus size={16} />
                {zones.length === 0 ? 'Creer des zones' : 'Gerer les zones'}
              </button>
            </div>

            {loadingZones ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : zones.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center border-2 border-dashed border-purple-200">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiLayers className="text-purple-400" size={32} />
                </div>
                <h4 className="font-semibold text-gray-700 mb-2">Organisez votre evenement</h4>
                <p className="text-gray-500 text-sm mb-4 max-w-sm mx-auto">
                  Creez des zones pour mieux repartir vos agents et superviseurs sur le terrain
                </p>
                <div className="flex flex-wrap justify-center gap-2 mb-4">
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Entree principale</span>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Sortie secours</span>
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">Zone VIP</span>
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">Parking</span>
                </div>
                <button
                  onClick={() => setZoneManagerOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all font-medium"
                >
                  <FiPlus size={18} />
                  Commencer a creer des zones
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Stats resumees */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                    <p className="text-2xl font-bold text-purple-600">{zones.length}</p>
                    <p className="text-xs text-gray-500">Zones</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                    <p className="text-2xl font-bold text-blue-600">
                      {zones.reduce((sum, z) => sum + (z.requiredAgents || 1), 0)}
                    </p>
                    <p className="text-xs text-gray-500">Agents requis</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                    <p className="text-2xl font-bold text-orange-600">
                      {zones.reduce((sum, z) => sum + (z.requiredSupervisors || 0), 0)}
                    </p>
                    <p className="text-xs text-gray-500">Superviseurs</p>
                  </div>
                </div>

                {/* Liste des zones */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {zones.map(zone => {
                    const stats = zone.stats || {};
                    const agentsFilled = (stats.assignedAgents || 0) >= (zone.requiredAgents || 1);
                    const supervisorsFilled = (stats.assignedSupervisors || 0) >= (zone.requiredSupervisors || 0);

                    return (
                      <div
                        key={zone.id}
                        className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow border-l-4"
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
                              <h4 className="font-semibold text-gray-800">{zone.name}</h4>
                              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
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
                            <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                              Haute priorite
                            </span>
                          )}
                          {zone.priority === 'critical' && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                              Critique
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1.5">
                            <FiUsers className={agentsFilled ? 'text-green-500' : 'text-gray-400'} size={14} />
                            <span className={agentsFilled ? 'text-green-600 font-medium' : 'text-gray-600'}>
                              {stats.assignedAgents || 0}/{zone.requiredAgents || 1}
                            </span>
                            <span className="text-gray-400 text-xs">agents</span>
                            {agentsFilled && <FiCheck className="text-green-500" size={12} />}
                          </div>

                          {zone.requiredSupervisors > 0 && (
                            <div className="flex items-center gap-1.5">
                              <FiShield className={supervisorsFilled ? 'text-green-500' : 'text-gray-400'} size={14} />
                              <span className={supervisorsFilled ? 'text-green-600 font-medium' : 'text-gray-600'}>
                                {stats.assignedSupervisors || 0}/{zone.requiredSupervisors}
                              </span>
                              <span className="text-gray-400 text-xs">resp.</span>
                              {supervisorsFilled && <FiCheck className="text-green-500" size={12} />}
                            </div>
                          )}
                        </div>

                        {zone.instructions && (
                          <p className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg line-clamp-2">
                            {zone.instructions}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Récurrence */}
          {event.recurrenceType && event.recurrenceType !== 'none' && (
            <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
              <FiRepeat className="text-purple-500" />
              <span className="text-purple-700">
                Récurrence: {RECURRENCE_OPTIONS.find(r => r.value === event.recurrenceType)?.label || event.recurrenceType}
              </span>
            </div>
          )}

          {/* Notes */}
          {event.notes && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Notes</h3>
              <p className="text-gray-600 bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
                {event.notes}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t">
            <button
              onClick={() => { onClose(); onDuplicate(event); }}
              className="btn-secondary flex items-center gap-2"
            >
              <FiCopy /> Dupliquer
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => { onClose(); onDelete(event.id); }}
                className="btn-danger flex items-center gap-2"
              >
                <FiTrash2 /> Supprimer
              </button>
              <button
                onClick={() => { onClose(); onEdit(event); }}
                className="btn-primary flex items-center gap-2"
              >
                <FiEdit2 /> Modifier
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Zone Manager Modal */}
      {zoneManagerOpen && (
        <ZoneManager
          isOpen={zoneManagerOpen}
          onClose={() => {
            setZoneManagerOpen(false);
            fetchZones();
          }}
          eventId={event.id}
        />
      )}
    </div>
  );
};

const EventModal = ({ isOpen, onClose, event, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'regular',
    priority: 'medium',
    color: '#3B82F6',
    location: '',
    latitude: '',
    longitude: '',
    geoRadius: 100,
    startDate: '',
    endDate: '',
    checkInTime: '08:00',
    checkOutTime: '18:00',
    lateThreshold: 15,
    agentCreationBuffer: 120,
    requiredAgents: 1,
    recurrenceType: 'none',
    recurrenceEndDate: '',
    notes: '',
    contactPhone: '',
    contactName: '',
    supervisorId: '',
  });
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [supervisors, setSupervisors] = useState([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);

  // Charger les superviseurs disponibles
  useEffect(() => {
    if (isOpen) {
      loadSupervisors();
    }
  }, [isOpen]);

  const loadSupervisors = async () => {
    setLoadingSupervisors(true);
    try {
      const response = await usersAPI.getSupervisors();
      setSupervisors(response.data?.data || []);
    } catch (error) {
      console.error('Error loading supervisors:', error);
    } finally {
      setLoadingSupervisors(false);
    }
  };

  useEffect(() => {
    if (event) {
      setFormData({
        name: event.name || '',
        description: event.description || '',
        type: event.type || 'regular',
        location: event.location || '',
        latitude: event.latitude || '',
        longitude: event.longitude || '',
        geoRadius: event.geoRadius || 100,
        startDate: event.startDate?.split('T')[0] || '',
        endDate: event.endDate?.split('T')[0] || '',
        checkInTime: event.checkInTime?.substring(0, 5) || '08:00',
        checkOutTime: event.checkOutTime?.substring(0, 5) || '18:00',
        lateThreshold: event.lateThreshold || 15,
        requiredAgents: event.requiredAgents || 1,
        priority: event.priority || 'medium',
        color: event.color || '#3B82F6',
        recurrenceType: event.recurrenceType || 'none',
        recurrenceEndDate: event.recurrenceEndDate?.split('T')[0] || '',
        notes: event.notes || '',
        contactPhone: event.contactPhone || '',
        contactName: event.contactName || '',
        supervisorId: event.supervisorId || '',
        status: event.status || 'scheduled',
      });
    } else {
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        name: '',
        description: '',
        type: 'regular',
        priority: 'medium',
        color: '#3B82F6',
        location: '',
        latitude: '',
        longitude: '',
        geoRadius: 100,
        startDate: today,
        endDate: today,
        checkInTime: '08:00',
        checkOutTime: '18:00',
        lateThreshold: 15,
        agentCreationBuffer: 120,
        requiredAgents: 1,
        recurrenceType: 'none',
        recurrenceEndDate: '',
        notes: '',
        contactPhone: '',
        contactName: '',
        supervisorId: '',
      });
    }
  }, [event]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validation
      if (new Date(formData.endDate) < new Date(formData.startDate)) {
        toast.error('La date de fin doit être après la date de début');
        setLoading(false);
        return;
      }

      // Préparer les données à envoyer - uniquement les champs nécessaires
      const dataToSend = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        location: formData.location,
        latitude: formData.latitude,
        longitude: formData.longitude,
        geoRadius: formData.geoRadius,
        startDate: formData.startDate,
        endDate: formData.endDate,
        checkInTime: formData.checkInTime?.substring(0, 5) || '08:00',
        checkOutTime: formData.checkOutTime?.substring(0, 5) || '18:00',
        lateThreshold: formData.lateThreshold,
        requiredAgents: formData.requiredAgents,
        priority: formData.priority,
        color: formData.color,
        recurrenceType: formData.recurrenceType,
        recurrenceEndDate: formData.recurrenceEndDate || null,
        notes: formData.notes,
        contactPhone: formData.contactPhone,
        contactName: formData.contactName,
        supervisorId: formData.supervisorId || null,
        status: formData.status,
      };

      console.log('📤 Données envoyées:', dataToSend);

      if (event && event.id) {
        const response = await eventsAPI.update(event.id, dataToSend);
        console.log('✅ Réponse du serveur:', response.data);
        toast.success('Événement mis à jour avec succès');
      } else {
        await eventsAPI.create(dataToSend);
        toast.success('Événement créé avec succès');
      }
      onSave();
      onClose();
    } catch (error) {
      console.error('❌ Erreur:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityInfo = (priority) => {
    return PRIORITY_OPTIONS.find(p => p.value === priority) || PRIORITY_OPTIONS[1];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header avec couleur sélectionnée */}
        <div
          className="p-6 border-b transition-colors duration-300"
          style={{ backgroundColor: formData.color + '20' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-12 rounded"
                style={{ backgroundColor: formData.color }}
              />
              <div>
                <h2 className="text-xl font-semibold text-gray-800">
                  {event ? 'Modifier l\'événement' : 'Nouvel événement'}
                </h2>
                <p className="text-sm text-gray-500">
                  {event ? 'Modifiez les détails ci-dessous' : 'Remplissez les informations pour créer un nouvel événement'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
              <FiX size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Nom et Description */}
          <div className="space-y-4">
            <div>
              <label className="label">Nom de l'événement *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input text-lg font-medium"
                placeholder="Ex: Surveillance Centre Commercial"
                required
              />
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input resize-none"
                rows="3"
                placeholder="Décrivez l'événement, les objectifs, les consignes spéciales..."
              />
              <p className="text-xs text-gray-400 mt-1">{formData.description?.length || 0}/500 caractères</p>
            </div>
          </div>

          {/* Type, Priorité, Couleur */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Type *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="input"
              >
                <option value="regular">Régulier</option>
                <option value="special">Spécial</option>
                <option value="emergency">Urgence</option>
              </select>
            </div>

            <div>
              <label className="label">Priorité</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className={`input ${getPriorityInfo(formData.priority).color}`}
              >
                {PRIORITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Couleur</label>
              <div className="flex gap-2 flex-wrap">
                {EVENT_COLORS.map(color => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: color.value })}
                    className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                      formData.color === color.value ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Section Localisation */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <FiMapPin className="mr-2 text-primary-600" />
              Localisation de l'événement
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-4">
                <AddressAutocomplete
                  value={formData.location}
                  onChange={(address) => setFormData({ ...formData, location: address })}
                  onCoordinatesChange={(coords) => {
                    if (coords) {
                      setFormData(prev => ({
                        ...prev,
                        location: coords.address || prev.location,
                        latitude: coords.latitude.toFixed(6),
                        longitude: coords.longitude.toFixed(6)
                      }));
                      toast.success('Position GPS mise à jour');
                    }
                  }}
                  label="Adresse *"
                  placeholder="Rechercher une adresse sur la carte..."
                  required
                  initialCoordinates={
                    formData.latitude && formData.longitude
                      ? { lat: parseFloat(formData.latitude), lng: parseFloat(formData.longitude) }
                      : null
                  }
                />

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="label text-xs">
                      Latitude
                      {formData.latitude && <FiCheckCircle className="inline ml-1 text-green-500" size={10} />}
                    </label>
                    <input
                      type="text"
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                      className={`input text-sm font-mono ${formData.latitude ? 'bg-green-50 border-green-300' : ''}`}
                      placeholder="Latitude"
                    />
                  </div>
                  <div>
                    <label className="label text-xs">
                      Longitude
                      {formData.longitude && <FiCheckCircle className="inline ml-1 text-green-500" size={10} />}
                    </label>
                    <input
                      type="text"
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                      className={`input text-sm font-mono ${formData.longitude ? 'bg-green-50 border-green-300' : ''}`}
                      placeholder="Longitude"
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Rayon (m)</label>
                    <input
                      type="number"
                      value={formData.geoRadius}
                      onChange={(e) => setFormData({ ...formData, geoRadius: parseInt(e.target.value) || 100 })}
                      className="input text-sm"
                      min="10"
                      max="1000"
                    />
                  </div>
                </div>
              </div>

              <div>
                <MiniMap
                  latitude={formData.latitude}
                  longitude={formData.longitude}
                  geoRadius={formData.geoRadius}
                  height="180px"
                  draggable={true}
                  onPositionChange={(coords) => {
                    setFormData(prev => ({
                      ...prev,
                      latitude: coords.latitude.toFixed(6),
                      longitude: coords.longitude.toFixed(6)
                    }));
                  }}
                />
              </div>
            </div>
          </div>

          {/* Dates et Horaires */}
          <div className="border rounded-lg p-4 bg-blue-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <FiCalendar className="mr-2 text-blue-600" />
              Dates et Horaires
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="label">Date début *</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Date fin *</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="input"
                  min={formData.startDate}
                  required
                />
              </div>
              <div>
                <label className="label">Heure d'arrivée *</label>
                <input
                  type="time"
                  value={formData.checkInTime}
                  onChange={(e) => setFormData({ ...formData, checkInTime: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Heure de départ *</label>
                <input
                  type="time"
                  value={formData.checkOutTime}
                  onChange={(e) => setFormData({ ...formData, checkOutTime: e.target.value })}
                  className="input"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="label">Tolérance retard (min)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="60"
                    value={formData.lateThreshold}
                    onChange={(e) => setFormData({ ...formData, lateThreshold: parseInt(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="w-12 text-center font-medium text-gray-700">{formData.lateThreshold} min</span>
                </div>
              </div>
              
              <div>
                <label className="label">Création agent autorisée</label>
                <select
                  value={formData.agentCreationBuffer || 120}
                  onChange={(e) => setFormData({ ...formData, agentCreationBuffer: parseInt(e.target.value) })}
                  className="input"
                  title="Délai avant le début de l'événement pendant lequel la création d'agents est autorisée"
                >
                  <option value={30}>30 min avant</option>
                  <option value={60}>1h avant</option>
                  <option value={90}>1h30 avant</option>
                  <option value={120}>2h avant</option>
                </select>
              </div>
              
              <div>
                <label className="label">Agents requis *</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, requiredAgents: Math.max(1, formData.requiredAgents - 1) })}
                    className="p-2 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={formData.requiredAgents}
                    onChange={(e) => setFormData({ ...formData, requiredAgents: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="input text-center w-20"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, requiredAgents: formData.requiredAgents + 1 })}
                    className="p-2 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    +
                  </button>
                  <FiUsers className="text-gray-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Responsable / Superviseur */}
          <div className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
            <h3 className="text-sm font-semibold text-yellow-800 mb-3 flex items-center">
              <FiShield className="mr-2" />
              Responsable / Superviseur
            </h3>
            <p className="text-xs text-yellow-700 mb-3">
              Sélectionnez un responsable pour superviser cet événement. Un responsable peut avoir plusieurs zones, mais un agent ne peut avoir qu'une seule zone.
            </p>
            <div>
              <label className="label">Choisir le responsable</label>
              <select
                value={formData.supervisorId}
                onChange={(e) => setFormData({ ...formData, supervisorId: e.target.value })}
                className="input"
                disabled={loadingSupervisors}
              >
                <option value="">-- Aucun responsable --</option>
                {supervisors.map(sup => (
                  <option key={sup.id} value={sup.id}>
                    {sup.firstName} {sup.lastName} - {sup.employeeId}
                  </option>
                ))}
              </select>
              {loadingSupervisors && (
                <p className="text-xs text-gray-500 mt-1">Chargement des superviseurs...</p>
              )}
              {formData.supervisorId && (
                <div className="mt-3 p-3 bg-white rounded-lg border border-yellow-300">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const selectedSup = supervisors.find(s => s.id === formData.supervisorId);
                      if (!selectedSup) return null;
                      return (
                        <>
                          {selectedSup.profilePhoto ? (
                            <img
                              src={selectedSup.profilePhoto}
                              alt=""
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 font-medium">
                              {selectedSup.firstName?.[0]}{selectedSup.lastName?.[0]}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-800">
                              {selectedSup.firstName} {selectedSup.lastName}
                            </p>
                            <p className="text-xs text-gray-500">{selectedSup.email}</p>
                          </div>
                          <span className="ml-auto px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">
                            Superviseur
                          </span>
                        </>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-yellow-600 mt-2">
                    Ce responsable pourra être affecté à plusieurs zones de cet événement.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Options avancées */}
          <div className="border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full p-4 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
            >
              <span className="font-medium text-gray-700 flex items-center">
                <FiActivity className="mr-2" /> Options avancées
              </span>
              {showAdvanced ? <FiChevronUp /> : <FiChevronDown />}
            </button>

            {showAdvanced && (
              <div className="p-4 space-y-4 border-t">
                {/* Récurrence */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label flex items-center">
                      <FiRepeat className="mr-2 text-purple-500" /> Récurrence
                    </label>
                    <select
                      value={formData.recurrenceType}
                      onChange={(e) => setFormData({ ...formData, recurrenceType: e.target.value })}
                      className="input"
                    >
                      {RECURRENCE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  {formData.recurrenceType !== 'none' && (
                    <div>
                      <label className="label">Fin de récurrence</label>
                      <input
                        type="date"
                        value={formData.recurrenceEndDate}
                        onChange={(e) => setFormData({ ...formData, recurrenceEndDate: e.target.value })}
                        className="input"
                        min={formData.endDate}
                      />
                    </div>
                  )}
                </div>

                {/* Contact sur site */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Nom du contact sur site</label>
                    <input
                      type="text"
                      value={formData.contactName}
                      onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                      className="input"
                      placeholder="Ex: M. Dupont"
                    />
                  </div>
                  <div>
                    <label className="label">Téléphone du contact</label>
                    <input
                      type="tel"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      className="input"
                      placeholder="Ex: 06 12 34 56 78"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="label">Notes et instructions</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="input resize-none"
                    rows="3"
                    placeholder="Instructions spéciales, codes d'accès, consignes de sécurité..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Boutons d'action */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="btn-secondary">
              Annuler
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <FiCheck /> {event ? 'Mettre à jour' : 'Créer l\'événement'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Events = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' ou 'list'
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, [search, statusFilter, typeFilter, priorityFilter, dateFilter]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params = {
        search: search || undefined,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        priority: priorityFilter || undefined,
      };

      // Filtre par date
      if (dateFilter === 'today') {
        params.startDate = new Date().toISOString().split('T')[0];
        params.endDate = new Date().toISOString().split('T')[0];
      } else if (dateFilter === 'week') {
        const today = new Date();
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        params.startDate = today.toISOString().split('T')[0];
        params.endDate = nextWeek.toISOString().split('T')[0];
      } else if (dateFilter === 'month') {
        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
        params.startDate = today.toISOString().split('T')[0];
        params.endDate = nextMonth.toISOString().split('T')[0];
      }

      const response = await eventsAPI.getAll(params);
      console.log('📅 Events - API Response:', response.data);
      
      // CORRECTION: API retourne {data: {events: [...], pagination}}
      const eventsData = response.data?.data?.events || response.data?.events || response.data?.data || [];
      const eventsArray = Array.isArray(eventsData) ? eventsData : [];
      
      console.log('📅 Events - Événements chargés:', eventsArray.length);
      setEvents(eventsArray);
    } catch (error) {
      console.error('❌ Erreur chargement événements:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error('Non autorisé: Vous devez être connecté');
      } else {
        toast.error(`Erreur: ${error.response?.data?.message || 'Erreur lors du chargement des événements'}`);
      }
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cet événement ? Cette action est irréversible.')) return;
    try {
      await eventsAPI.delete(id);
      toast.success('Événement supprimé avec succès');
      fetchEvents();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const handleDuplicate = (event) => {
    const duplicatedEvent = {
      ...event,
      id: undefined,
      name: `${event.name} (copie)`,
      status: 'draft',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
    };
    setSelectedEvent(duplicatedEvent);
    setModalOpen(true);
  };

  const handleEdit = (event) => {
    setSelectedEvent(event);
    setModalOpen(true);
  };

  const handleViewDetails = (event) => {
    setSelectedEvent(event);
    setDetailsModalOpen(true);
  };

  const getStatusBadge = (status) => {
    const config = {
      draft: { class: 'bg-gray-100 text-gray-700', label: 'Brouillon' },
      scheduled: { class: 'bg-blue-100 text-blue-700', label: 'Planifié' },
      active: { class: 'bg-green-100 text-green-700', label: 'Actif' },
      completed: { class: 'bg-gray-100 text-gray-600', label: 'Terminé' },
      cancelled: { class: 'bg-red-100 text-red-700', label: 'Annulé' }
    };
    const { class: className, label } = config[status] || config.draft;
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${className}`}>{label}</span>;
  };

  const getPriorityBadge = (priority) => {
    const info = PRIORITY_OPTIONS.find(p => p.value === priority) || PRIORITY_OPTIONS[1];
    const Icon = info.icon;
    return (
      <span className={`flex items-center gap-1 text-xs ${info.color}`}>
        <Icon size={12} />
        {info.label}
      </span>
    );
  };

  const getTimeIndicator = (event) => {
    const startDate = new Date(event.startDate);
    if (isToday(startDate)) {
      return <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Aujourd'hui</span>;
    }
    if (isTomorrow(startDate)) {
      return <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Demain</span>;
    }
    if (isPast(new Date(event.endDate))) {
      return <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">Passé</span>;
    }
    const days = differenceInDays(startDate, new Date());
    if (days <= 7) {
      return <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">Dans {days}j</span>;
    }
    return null;
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setTypeFilter('');
    setPriorityFilter('');
    setDateFilter('');
  };

  const hasActiveFilters = search || statusFilter || typeFilter || priorityFilter || dateFilter;

  // Stats rapides
  const inProgressEvents = events.filter(e => e.status === 'active');
  console.log('📅 Events - Événements EN COURS (status=active):', inProgressEvents.length, inProgressEvents);
  console.log('📅 Events - Tous les événements:', events.length);
  
  const stats = {
    total: events.length,
    active: inProgressEvents.length,
    scheduled: events.filter(e => e.status === 'scheduled').length,
    today: events.filter(e => isToday(new Date(e.startDate))).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Événements</h1>
          <p className="text-gray-500 text-sm mt-1">
            Gérez vos événements et missions de sécurité
          </p>
        </div>
        <button
          onClick={() => { setSelectedEvent(null); setModalOpen(true); }}
          className="btn-primary flex items-center gap-2 self-start md:self-auto"
        >
          <FiPlus /> Nouvel événement
        </button>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded-full">
              <FiCalendar className="text-gray-600" size={20} />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Actifs</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <FiActivity className="text-green-600" size={20} />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Planifiés</p>
              <p className="text-2xl font-bold text-blue-600">{stats.scheduled}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <FiClock className="text-blue-600" size={20} />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Aujourd'hui</p>
              <p className="text-2xl font-bold text-orange-600">{stats.today}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <FiTrendingUp className="text-orange-600" size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="card">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Recherche */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un événement..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>

          {/* Bouton filtres avancés */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center gap-2 ${hasActiveFilters ? 'ring-2 ring-primary-500' : ''}`}
          >
            <FiFilter />
            Filtres
            {hasActiveFilters && (
              <span className="w-5 h-5 bg-primary-500 text-white text-xs rounded-full flex items-center justify-center">
                {[statusFilter, typeFilter, priorityFilter, dateFilter].filter(Boolean).length}
              </span>
            )}
          </button>

          {/* Vue */}
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-primary-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
              title="Vue grille"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-primary-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
              title="Vue liste"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filtres avancés */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="label text-xs">Statut</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input"
              >
                <option value="">Tous</option>
                <option value="draft">Brouillon</option>
                <option value="scheduled">Planifié</option>
                <option value="active">Actif</option>
                <option value="completed">Terminé</option>
                <option value="cancelled">Annulé</option>
              </select>
            </div>
            <div>
              <label className="label text-xs">Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="input"
              >
                <option value="">Tous</option>
                <option value="regular">Régulier</option>
                <option value="special">Spécial</option>
                <option value="emergency">Urgence</option>
              </select>
            </div>
            <div>
              <label className="label text-xs">Priorité</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="input"
              >
                <option value="">Toutes</option>
                {PRIORITY_OPTIONS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-xs">Période</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="input"
              >
                <option value="">Toutes</option>
                <option value="today">Aujourd'hui</option>
                <option value="week">Cette semaine</option>
                <option value="month">Ce mois</option>
              </select>
            </div>
            {hasActiveFilters && (
              <div className="col-span-full">
                <button
                  onClick={clearFilters}
                  className="text-sm text-primary-600 hover:text-primary-800 flex items-center gap-1"
                >
                  <FiX size={14} /> Effacer tous les filtres
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Events Grid/List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="card text-center py-12">
          <FiCalendar className="mx-auto text-gray-300 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-700 mb-2">Aucun événement trouvé</h3>
          <p className="text-gray-500 mb-4">
            {hasActiveFilters ? 'Essayez de modifier vos filtres' : 'Créez votre premier événement'}
          </p>
          {!hasActiveFilters && (
            <button
              onClick={() => { setSelectedEvent(null); setModalOpen(true); }}
              className="btn-primary inline-flex items-center gap-2"
            >
              <FiPlus /> Créer un événement
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <div
              key={event.id}
              className="card hover:shadow-lg transition-all duration-200 overflow-hidden cursor-pointer group"
              onClick={() => handleViewDetails(event)}
            >
              {/* Barre de couleur */}
              <div
                className="h-2 -mx-6 -mt-6 mb-4"
                style={{ backgroundColor: event.color || '#3B82F6' }}
              />

              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg text-gray-900 truncate">{event.name}</h3>
                    {getTimeIndicator(event)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 capitalize">{event.type}</span>
                    {getPriorityBadge(event.priority)}
                  </div>
                </div>
                {getStatusBadge(event.status)}
              </div>

              {event.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{event.description}</p>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex items-center text-gray-600">
                  <FiMapPin className={`mr-2 flex-shrink-0 ${event.latitude && event.longitude ? 'text-green-500' : ''}`} />
                  <span className="truncate">{event.location}</span>
                  {event.latitude && event.longitude && (
                    <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                      GPS
                    </span>
                  )}
                </div>
                <div className="flex items-center text-gray-600">
                  <FiCalendar className="mr-2" />
                  {format(new Date(event.startDate), 'dd MMM yyyy', { locale: fr })}
                  {event.startDate !== event.endDate && (
                    <span className="text-gray-400 mx-1">→</span>
                  )}
                  {event.startDate !== event.endDate && format(new Date(event.endDate), 'dd MMM yyyy', { locale: fr })}
                </div>
                <div className="flex items-center text-gray-600">
                  <FiClock className="mr-2" />
                  {event.checkInTime} - {event.checkOutTime}
                </div>
                <div className="flex items-center">
                  <FiUsers className="mr-2 text-gray-400" />
                  <div className="flex items-center gap-1">
                    <span className={`font-medium ${(event.assignedAgentsCount || 0) >= event.requiredAgents ? 'text-green-600' : 'text-orange-600'}`}>
                      {event.assignedAgentsCount || 0}
                    </span>
                    <span className="text-gray-400">/</span>
                    <span className="text-gray-600">{event.requiredAgents}</span>
                    <span className="text-gray-500 text-xs ml-1">agents</span>
                  </div>
                  {(event.assignedAgentsCount || 0) >= event.requiredAgents ? (
                    <FiCheckCircle className="ml-2 text-green-500" size={14} />
                  ) : (
                    <FiAlertCircle className="ml-2 text-orange-500" size={14} />
                  )}
                </div>
              </div>

              {/* Récurrence indicator */}
              {event.recurrenceType && event.recurrenceType !== 'none' && (
                <div className="mt-3 flex items-center text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
                  <FiRepeat className="mr-1" size={12} />
                  {RECURRENCE_OPTIONS.find(r => r.value === event.recurrenceType)?.label}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-1 mt-4 pt-4 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); handleViewDetails(event); }}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  title="Voir les détails"
                >
                  <FiEye size={18} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDuplicate(event); }}
                  className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
                  title="Dupliquer"
                >
                  <FiCopy size={18} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleEdit(event); }}
                  className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                  title="Modifier"
                >
                  <FiEdit2 size={18} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(event.id); }}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  title="Supprimer"
                >
                  <FiTrash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Vue Liste */
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Événement</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Lieu</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Horaires</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agents</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.map((event) => (
                <tr
                  key={event.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleViewDetails(event)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-10 rounded-full flex-shrink-0"
                        style={{ backgroundColor: event.color || '#3B82F6' }}
                      />
                      <div>
                        <p className="font-medium text-gray-900">{event.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500">{event.type}</span>
                          {getPriorityBadge(event.priority)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-sm text-gray-600 truncate max-w-[200px] block">{event.location}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <p>{format(new Date(event.startDate), 'dd MMM', { locale: fr })}</p>
                      {getTimeIndicator(event)}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-sm text-gray-600">{event.checkInTime} - {event.checkOutTime}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-medium ${(event.assignedAgentsCount || 0) >= event.requiredAgents ? 'text-green-600' : 'text-orange-600'}`}>
                      {event.assignedAgentsCount || 0}/{event.requiredAgents}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(event.status)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(event); }}
                        className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded"
                      >
                        <FiEdit2 size={16} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(event.id); }}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <EventModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        event={selectedEvent}
        onSave={fetchEvents}
      />

      <EventDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        event={selectedEvent}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
      />
    </div>
  );
};

export default Events;
