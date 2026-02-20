import React, { useState, useEffect, useRef } from 'react';
import {
  FiAlertTriangle, FiPlus, FiSearch, FiFilter, FiEye,
  FiEdit2, FiCamera, FiMapPin, FiClock, FiUser,
  FiX, FiCheck, FiAlertCircle, FiShield, FiPhone, FiTrash2
} from 'react-icons/fi';
import { incidentsAPI, eventsAPI } from '../services/api';
import { toast } from 'react-toastify';
import { useSync, useSyncEvent } from '../hooks/useSync';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import AddressAutocomplete from '../components/AddressAutocomplete';
import MiniMap from '../components/MiniMap';

const incidentTypes = {
  security_breach: { label: 'Brèche de sécurité', icon: '🔓', color: 'red' },
  medical_emergency: { label: 'Urgence médicale', icon: '🏥', color: 'red' },
  fire_alarm: { label: 'Alarme incendie', icon: '🔥', color: 'orange' },
  theft: { label: 'Vol', icon: '💰', color: 'red' },
  vandalism: { label: 'Vandalisme', icon: '🔨', color: 'orange' },
  trespassing: { label: 'Intrusion', icon: '🚷', color: 'yellow' },
  suspicious_activity: { label: 'Activité suspecte', icon: '👁️', color: 'yellow' },
  equipment_failure: { label: 'Panne équipement', icon: '⚙️', color: 'blue' },
  access_issue: { label: 'Problème d\'accès', icon: '🚪', color: 'blue' },
  violence: { label: 'Violence', icon: '⚠️', color: 'red' },
  other: { label: 'Autre', icon: '📋', color: 'gray' }
};

const severityConfig = {
  low: { label: 'Faible', color: 'bg-blue-100 text-blue-800', priority: 1 },
  medium: { label: 'Moyen', color: 'bg-yellow-100 text-yellow-800', priority: 2 },
  high: { label: 'Élevé', color: 'bg-orange-100 text-orange-800', priority: 3 },
  critical: { label: 'Critique', color: 'bg-red-100 text-red-800', priority: 4 }
};

const statusConfig = {
  reported: { label: 'Signalé', color: 'badge-warning' },
  investigating: { label: 'En cours', color: 'badge-info' },
  resolved: { label: 'Résolu', color: 'badge-success' },
  escalated: { label: 'Escaladé', color: 'badge-danger' },
  closed: { label: 'Clôturé', color: 'bg-gray-100 text-gray-800' }
};

const IncidentModal = ({ isOpen, onClose, onSave, events }) => {
  const [formData, setFormData] = useState({
    type: 'suspicious_activity',
    severity: 'medium',
    title: '',
    description: '',
    eventId: '',
    location: '',
    latitude: null,
    longitude: null,
    photos: [],
    witnesses: [],
    address: ''
  });
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Assign stream to video element after it renders
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      setCameraActive(true); // triggers useEffect to assign srcObject after render
    } catch (error) {
      toast.error('Impossible d\'accéder à la caméra');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    const photoData = canvas.toDataURL('image/jpeg', 0.8);
    setFormData(prev => ({
      ...prev,
      photos: [...prev.photos, photoData]
    }));
    stopCamera();
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }));
          toast.success('Position GPS obtenue');
        },
        () => toast.error('Impossible d\'obtenir la position')
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.description) {
      toast.error('Titre et description requis');
      return;
    }

    setLoading(true);
    try {
      await incidentsAPI.create(formData);
      toast.success('Incident signalé avec succès');
      onSave();
      onClose();
      setFormData({
        type: 'suspicious_activity',
        severity: 'medium',
        title: '',
        description: '',
        eventId: '',
        location: '',
        latitude: null,
        longitude: null,
        photos: [],
        witnesses: []
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between bg-red-50">
          <h2 className="text-xl font-semibold text-red-800 flex items-center">
            <FiAlertTriangle className="mr-2" />
            Signaler un incident
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FiX size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type & Severity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type d'incident *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="input"
                required
              >
                {Object.entries(incidentTypes).map(([key, { label, icon }]) => (
                  <option key={key} value={key}>{icon} {label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Gravité *</label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                className="input"
                required
              >
                {Object.entries(severityConfig).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="label">Titre *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="input"
              placeholder="Résumé court de l'incident"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="label">Description détaillée *</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input"
              rows={4}
              placeholder="Décrivez l'incident en détail: ce qui s'est passé, quand, qui était impliqué..."
              required
            />
          </div>

          {/* Event & Localization */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Événement lié</label>
                <select
                  value={formData.eventId}
                  onChange={(e) => setFormData({ ...formData, eventId: e.target.value })}
                  className="input"
                >
                  <option value="">Aucun événement</option>
                  {events.map(event => (
                    <option key={event.id} value={event.id}>{event.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Lieu (ex: Hall, Parking...)</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="input"
                  placeholder="Lieu précis sur le site"
                />
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl space-y-4 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                <span className="flex items-center">
                  <FiMapPin className="mr-2 text-red-600" />
                  Géolocalisation de l'incident
                </span>
                <button
                  type="button"
                  onClick={getLocation}
                  className="text-xs bg-white border px-2 py-1 rounded-md hover:bg-gray-100 flex items-center gap-1"
                >
                  <FiMapPin size={10} /> Ma position
                </button>
              </h3>

              <AddressAutocomplete
                value={formData.address}
                onChange={(address) => setFormData({ ...formData, address })}
                onCoordinatesChange={(coords) => {
                  if (coords) {
                    setFormData(prev => ({
                      ...prev,
                      address: coords.address || prev.address,
                      latitude: coords.latitude,
                      longitude: coords.longitude
                    }));
                  }
                }}
                label="Rechercher une adresse"
                placeholder="Tapez pour rechercher le lieu..."
                initialCoordinates={
                  formData.latitude && formData.longitude
                    ? { lat: formData.latitude, lng: formData.longitude }
                    : null
                }
              />

              <div className="h-[180px] rounded-lg overflow-hidden border border-gray-200">
                <MiniMap
                  latitude={formData.latitude}
                  longitude={formData.longitude}
                  geoRadius={0}
                  height="180px"
                  draggable={true}
                  onPositionChange={(pos) => {
                    setFormData(prev => ({
                      ...prev,
                      latitude: pos.latitude,
                      longitude: pos.longitude
                    }));
                  }}
                />
              </div>

              {formData.latitude && (
                <p className="text-[10px] text-gray-500 font-mono text-center">
                  GPS: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                </p>
              )}
            </div>
          </div>

          {/* Photos */}
          <div>
            <label className="label">Photos</label>
            <div className="flex flex-wrap gap-3 mb-3">
              {formData.photos.map((photo, index) => (
                <div key={index} className="relative">
                  <img
                    src={photo}
                    alt={`Photo ${index + 1}`}
                    className="w-24 h-24 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      photos: prev.photos.filter((_, i) => i !== index)
                    }))}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                  >
                    <FiX size={14} />
                  </button>
                </div>
              ))}
            </div>

            {cameraActive ? (
              <div className="space-y-3">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full max-h-48 rounded-lg bg-gray-900"
                />
                <canvas ref={canvasRef} className="hidden" />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="btn-success flex-1"
                  >
                    <FiCamera className="mr-2" /> Capturer
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="btn-secondary"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={startCamera}
                className="btn-secondary flex items-center"
              >
                <FiCamera className="mr-2" /> Prendre une photo
              </button>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="btn-secondary">
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary bg-red-600 hover:bg-red-700"
            >
              {loading ? 'Envoi...' : 'Signaler l\'incident'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const IncidentDetailModal = ({ isOpen, onClose, incident, onUpdate }) => {
  const [status, setStatus] = useState(incident?.status || 'reported');
  const [resolution, setResolution] = useState(incident?.resolution || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (incident) {
      setStatus(incident.status);
      setResolution(incident.resolution || '');
    }
  }, [incident]);

  const handleUpdateStatus = async () => {
    setLoading(true);
    try {
      await incidentsAPI.update(incident.id, { status, resolution });
      toast.success('Incident mis à jour');
      onUpdate();
      onClose();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !incident) return null;

  const typeInfo = incidentTypes[incident.type] || incidentTypes.other;
  const severityInfo = severityConfig[incident.severity];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className={`p-6 border-b ${
          incident.severity === 'critical' ? 'bg-red-50' :
          incident.severity === 'high' ? 'bg-orange-50' : 'bg-gray-50'
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{typeInfo.icon}</span>
                <span className={`badge ${severityInfo.color}`}>{severityInfo.label}</span>
                <span className={`badge ${statusConfig[incident.status].color}`}>
                  {statusConfig[incident.status].label}
                </span>
              </div>
              <h2 className="text-xl font-semibold">{incident.title}</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <FiX size={24} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Details */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-700 mb-3">Informations</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center text-gray-600">
                  <FiClock className="mr-2" />
                  {format(new Date(incident.createdAt), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                </div>
                <div className="flex items-center text-gray-600">
                  <FiUser className="mr-2" />
                  Signalé par: {incident.reporter?.firstName} {incident.reporter?.lastName}
                </div>
                {incident.location && (
                  <div className="flex items-center text-gray-600">
                    <FiMapPin className="mr-2" />
                    {incident.location}
                  </div>
                )}
                {incident.event && (
                  <div className="flex items-center text-gray-600">
                    <FiShield className="mr-2" />
                    Événement: {incident.event.name}
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-700 mb-3">Contact rapide</h4>
              {incident.reporter?.phone && (
                <a
                  href={`tel:${incident.reporter.phone}`}
                  className="flex items-center p-3 bg-green-50 rounded-lg text-green-700 hover:bg-green-100"
                >
                  <FiPhone className="mr-2" />
                  Appeler {incident.reporter.firstName}
                </a>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-2">Description</h4>
            <p className="text-gray-600 bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">
              {incident.description}
            </p>
          </div>

          {/* Photos */}
          {incident.photos && incident.photos.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Photos</h4>
              <div className="flex flex-wrap gap-3">
                {incident.photos.map((photo, index) => (
                  <img
                    key={index}
                    src={photo}
                    alt={`Evidence ${index + 1}`}
                    className="w-32 h-32 object-cover rounded-lg cursor-pointer hover:opacity-80"
                    onClick={() => window.open(photo, '_blank')}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Actions taken */}
          {incident.actionsTaken && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Actions entreprises</h4>
              <p className="text-gray-600 bg-blue-50 p-4 rounded-lg">
                {incident.actionsTaken}
              </p>
            </div>
          )}

          {/* Update Status */}
          <div className="border-t pt-6">
            <h4 className="font-semibold text-gray-700 mb-3">Mettre à jour le statut</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Nouveau statut</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="input"
                >
                  <option value="reported">Signalé</option>
                  <option value="investigating">En cours d'investigation</option>
                  <option value="escalated">Escaladé</option>
                  <option value="resolved">Résolu</option>
                  <option value="closed">Clôturé</option>
                </select>
              </div>
              <div>
                <label className="label">Résolution / Notes</label>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="input"
                  rows={2}
                  placeholder="Décrivez la résolution..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">
            Fermer
          </button>
          <button
            onClick={handleUpdateStatus}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Mise à jour...' : 'Mettre à jour'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Incidents = () => {
  const [incidents, setIncidents] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    severity: '',
    type: '',
    search: ''
  });

  // 🔄 WEBSOCKET - Synchronisation temps réel
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const { isConnected } = useSync(user?.id, ['incident:all', user.role === 'supervisor' ? 'supervisor' : 'agent']);

  // Notification de connexion
  useEffect(() => {
    if (isConnected) {
      toast.success('🔄 Incidents temps réel activés', { autoClose: 2000 });
    }
  }, [isConnected]);

  // Événement: Nouvel incident créé
  useSyncEvent('incident:created', (incident) => {
    const audio = new Audio('/notification.mp3');
    audio.play().catch(() => {});
    
    const severity = incident.severity === 'critical' ? '🚨' : incident.severity === 'high' ? '⚠️' : 'ℹ️';
    toast.warning(`${severity} Nouvel incident: ${incident.title}`, {
      position: 'top-center',
      autoClose: 6000
    });
    fetchData();
  });

  // Événement: Incident mis à jour
  useSyncEvent('incident:updated', (incident) => {
    setIncidents(prev => prev.map(i => i.id === incident.id ? incident : i));
    toast.info(`📝 Incident mis à jour: ${incident.title}`);
  });

  // Événement: Incident urgent
  useSyncEvent('incident:urgent', (incident) => {
    toast.error(`🚨 INCIDENT URGENT: ${incident.title}`, {
      position: 'top-center',
      autoClose: false
    });
  });

  // Événement: Alerte SOS
  useSyncEvent('sos:urgent', (alert) => {
    const audio = new Audio('/alert.mp3');
    audio.play().catch(() => {});
    
    toast.error(`🆘 ALERTE SOS: ${alert.message || 'Urgence détectée'}`, {
      position: 'top-center',
      autoClose: false
    });
    fetchData();
  });

  useEffect(() => {
    fetchData();
  }, [filters.status, filters.severity, filters.type]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [incidentsResult, eventsResult] = await Promise.allSettled([
        incidentsAPI.getAll({
          status: filters.status || undefined,
          severity: filters.severity || undefined,
          type: filters.type || undefined,
          limit: 100
        }),
        eventsAPI.getAll({ limit: 100 })
      ]);

      if (incidentsResult.status === 'fulfilled') {
        const d = incidentsResult.value?.data;
        setIncidents(d?.data?.incidents || d?.incidents || []);
      } else {
        console.error('Incidents load error:', incidentsResult.reason);
      }

      if (eventsResult.status === 'fulfilled') {
        const d = eventsResult.value?.data;
        setEvents(d?.data?.events || d?.events || []);
      } else {
        console.error('Events load error:', eventsResult.reason);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e, incidentId) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer cet incident ? Cette action est irréversible.')) return;
    try {
      await incidentsAPI.delete(incidentId);
      setIncidents(prev => prev.filter(i => i.id !== incidentId));
      toast.success('Incident supprimé');
    } catch (err) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const filteredIncidents = incidents.filter(incident => {
    if (!filters.search) return true;
    const search = filters.search.toLowerCase();
    return (
      incident.title?.toLowerCase().includes(search) ||
      incident.description?.toLowerCase().includes(search) ||
      incident.reporter?.firstName?.toLowerCase().includes(search) ||
      incident.reporter?.lastName?.toLowerCase().includes(search)
    );
  });

  // Grouper les incidents par événement et trier par date
  const groupedIncidents = filteredIncidents.reduce((groups, incident) => {
    const eventName = incident.event?.name || 'Sans événement';
    if (!groups[eventName]) {
      groups[eventName] = [];
    }
    groups[eventName].push(incident);
    return groups;
  }, {});

  // Trier les incidents dans chaque groupe par date (plus récent en premier)
  Object.keys(groupedIncidents).forEach(eventName => {
    groupedIncidents[eventName].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  });

  // Déterminer le statut basé sur resolvedAt
  const getIncidentStatus = (incident) => {
    if (incident.resolvedAt) {
      return { label: 'Résolu', color: 'bg-green-100 text-green-800', icon: FiCheck };
    }
    return { label: 'En cours', color: 'bg-yellow-100 text-yellow-800', icon: FiAlertCircle };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <FiAlertTriangle className="mr-3 text-red-500" />
            Incidents
          </h1>
          <p className="text-gray-500">Gestion des incidents et rapports</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="btn-primary bg-red-600 hover:bg-red-700 flex items-center"
        >
          <FiPlus className="mr-2" /> Signaler un incident
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: incidents.length, color: 'bg-gray-100 text-gray-800' },
          { label: 'En cours', value: incidents.filter(i => !i.resolvedAt).length, color: 'bg-blue-100 text-blue-800' },
          { label: 'Critiques', value: incidents.filter(i => i.severity === 'critical').length, color: 'bg-red-100 text-red-800' },
          { label: 'Résolus', value: incidents.filter(i => i.resolvedAt).length, color: 'bg-green-100 text-green-800' }
        ].map(stat => (
          <div key={stat.label} className="card">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">{stat.label}</span>
              <span className={`text-2xl font-bold px-3 py-1 rounded-lg ${stat.color}`}>
                {stat.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="input pl-10"
              />
            </div>
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="input w-40"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(statusConfig).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select
            value={filters.severity}
            onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
            className="input w-40"
          >
            <option value="">Toutes gravités</option>
            {Object.entries(severityConfig).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="input w-48"
          >
            <option value="">Tous les types</option>
            {Object.entries(incidentTypes).map(([key, { label, icon }]) => (
              <option key={key} value={key}>{icon} {label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Incidents List - Grouped by Event */}
      <div className="space-y-6">
        {loading ? (
          <div className="card flex items-center justify-center py-12">
            <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="card text-center py-12 text-gray-500">
            <FiAlertTriangle size={48} className="mx-auto mb-4 opacity-30" />
            <p>Aucun incident trouvé</p>
          </div>
        ) : (
          Object.entries(groupedIncidents).map(([eventName, eventIncidents]) => (
            <div key={eventName} className="space-y-3">
              {/* Event Header */}
              <div className="bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
                      <FiShield className="text-white" size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{eventName}</h3>
                      <p className="text-sm text-gray-500">{eventIncidents.length} incident(s)</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Incidents in this event */}
              <div className="space-y-3 pl-4">
                {eventIncidents.map(incident => {
                  const typeInfo = incidentTypes[incident.type] || incidentTypes.other;
                  const severityInfo = severityConfig[incident.severity];
                  const dynamicStatus = getIncidentStatus(incident);
                  const StatusIcon = dynamicStatus.icon;

                  return (
                    <div
                      key={incident.id}
                      className={`card border-l-4 cursor-pointer hover:shadow-md transition-shadow ${
                        incident.severity === 'critical' ? 'border-l-red-500 bg-red-50/30' :
                        incident.severity === 'high' ? 'border-l-orange-500' :
                        incident.severity === 'medium' ? 'border-l-yellow-500' :
                        'border-l-blue-500'
                      }`}
                      onClick={() => {
                        setSelectedIncident(incident);
                        setDetailModalOpen(true);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4 flex-1">
                          <div className="text-3xl">{typeInfo.icon}</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-semibold text-gray-900">{incident.title}</h3>
                              <span className={`badge ${severityInfo.color}`}>{severityInfo.label}</span>
                              <span className={`badge ${dynamicStatus.color} flex items-center gap-1`}>
                                <StatusIcon size={14} />
                                {dynamicStatus.label}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 mb-2">{typeInfo.label}</p>
                            <p className="text-sm text-gray-600 line-clamp-2 mb-3">{incident.description}</p>
                            
                            {/* Info Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-600">
                              <div className="flex items-center gap-1">
                                <FiClock className="text-gray-400" />
                                <span>{format(new Date(incident.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr })}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <FiUser className="text-gray-400" />
                                <span>{incident.reporter?.firstName} {incident.reporter?.lastName}</span>
                              </div>
                              {incident.location && (
                                <div className="flex items-center gap-1">
                                  <FiMapPin className="text-gray-400" />
                                  <span>{incident.location}</span>
                                </div>
                              )}
                              {incident.resolvedAt && (
                                <div className="flex items-center gap-1 text-green-600 font-medium">
                                  <FiCheck className="text-green-500" />
                                  <span>Résolu le {format(new Date(incident.resolvedAt), 'dd/MM/yyyy', { locale: fr })}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                            title="Voir les détails"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedIncident(incident);
                              setDetailModalOpen(true);
                            }}
                          >
                            <FiEye />
                          </button>
                          <button
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="Supprimer l'incident"
                            onClick={(e) => handleDelete(e, incident.id)}
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <IncidentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={fetchData}
        events={events}
      />

      <IncidentDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        incident={selectedIncident}
        onUpdate={fetchData}
      />
    </div>
  );
};

export default Incidents;
