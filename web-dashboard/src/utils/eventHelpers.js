/**
 * Utilitaires pour la gestion des événements côté frontend
 */

/**
 * Combine une date et une heure en un objet Date complet
 * @param {Date|string} date - La date de l'événement
 * @param {string} time - L'heure au format "HH:MM" (ex: "08:00")
 * @returns {Date} - Date complète avec l'heure
 */
export const combineDateAndTime = (date, time) => {
  const eventDate = new Date(date);
  
  if (!time) {
    return eventDate;
  }
  
  const [hours, minutes] = time.split(':').map(Number);
  eventDate.setHours(hours || 0, minutes || 0, 0, 0);
  
  return eventDate;
};

/**
 * Calcule l'heure de début de check-in autorisée
 * Les agents peuvent pointer dès l'ouverture de la fenêtre de création
 * @param {Date|string} startDate - Date de début
 * @param {string} checkInTime - Heure d'arrivée (ex: "08:00")
 * @param {number} agentCreationBuffer - Buffer en MINUTES (ex: 120 = 2h)
 * @returns {Date}
 */
export const getCheckInStartTime = (startDate, checkInTime, agentCreationBuffer = 120) => {
  const checkInDateTime = combineDateAndTime(startDate, checkInTime || '00:00');
  
  // Convertir minutes en heures et soustraire le buffer
  const bufferHours = (agentCreationBuffer || 120) / 60;
  checkInDateTime.setHours(checkInDateTime.getHours() - bufferHours);
  
  return checkInDateTime;
};

/**
 * Calcule le statut d'un événement basé sur ses dates/heures
 * @param {Object} event - L'événement
 * @returns {string} - Le statut calculé: 'scheduled', 'active', 'completed'
 */
export const computeEventStatus = (event) => {
  const now = new Date();
  
  // Ne pas modifier les événements annulés ou terminés manuellement
  if (['cancelled', 'terminated'].includes(event.status?.toLowerCase())) {
    return event.status;
  }
  
  // L'événement devient "active" dès l'ouverture de la fenêtre de check-in
  // (agentCreationBuffer minutes avant checkInTime)
  const eventStart = getCheckInStartTime(
    event.startDate, 
    event.checkInTime, 
    event.agentCreationBuffer || 120
  );
  const eventEnd = combineDateAndTime(event.endDate, event.checkOutTime || '23:59');
  
  // Événement terminé (après l'heure de check-out)
  if (now > eventEnd) {
    return 'completed';
  }
  
  // Événement en cours (dès l'ouverture de la fenêtre de check-in)
  if (now >= eventStart && now <= eventEnd) {
    return 'active';
  }
  
  // Événement futur (avant l'ouverture de la fenêtre)
  if (now < eventStart) {
    return 'scheduled';
  }
  
  return event.status || 'scheduled';
};

/**
 * Vérifie si un événement est actuellement actif
 * @param {Object} event - L'événement
 * @returns {boolean}
 */
export const isEventActive = (event) => {
  return computeEventStatus(event) === 'active';
};

/**
 * Vérifie si un événement est terminé
 * @param {Object} event - L'événement
 * @returns {boolean}
 */
export const isEventCompleted = (event) => {
  return computeEventStatus(event) === 'completed';
};

/**
 * Vérifie si un événement est à venir
 * @param {Object} event - L'événement
 * @returns {boolean}
 */
export const isEventScheduled = (event) => {
  return computeEventStatus(event) === 'scheduled';
};

/**
 * Vérifie si un événement doit être affiché (non terminé, non annulé)
 * Les événements restent affichés 2h après leur fin pour permettre les check-out en retard
 * @param {Object} event - L'événement
 * @returns {boolean}
 */
export const shouldDisplayEvent = (event) => {
  const now = new Date();
  
  // Toujours cacher les événements annulés ou terminés manuellement
  if (['cancelled', 'terminated'].includes(event.status?.toLowerCase())) {
    return false;
  }
  
  // Calculer l'heure de fin de l'événement + buffer de 2h
  const eventEnd = combineDateAndTime(event.endDate, event.checkOutTime || '23:59');
  const bufferEnd = new Date(eventEnd);
  bufferEnd.setHours(bufferEnd.getHours() + 2); // 2h de tolérance après la fin
  
  // Cacher l'événement si on a dépassé les 2h après la fin
  if (now > bufferEnd) {
    return false;
  }
  
  // Afficher tous les autres événements (scheduled, active, ou completed mais < 2h)
  return true;
};

/**
 * Formate une date et heure pour l'affichage
 * @param {Date|string} date
 * @param {string} time
 * @returns {string}
 */
export const formatEventDateTime = (date, time) => {
  const dt = combineDateAndTime(date, time);
  return dt.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Obtient le badge de statut avec couleur
 * @param {Object} event
 * @returns {Object} {text, className}
 */
export const getStatusBadge = (event) => {
  const status = event.computedStatus || computeEventStatus(event);

  const statusConfig = {
    active: {
      text: 'En cours',
      className: 'bg-green-500/20 text-green-300'
    },
    scheduled: {
      text: 'Planifié',
      className: 'bg-blue-500/20 text-blue-300'
    },
    pending: {
      text: 'En attente',
      className: 'bg-yellow-500/20 text-yellow-300'
    },
    completed: {
      text: 'Terminé',
      className: 'bg-gray-500/20 text-gray-300'
    },
    cancelled: {
      text: 'Annulé',
      className: 'bg-red-500/20 text-red-300'
    },
    terminated: {
      text: 'Clos',
      className: 'bg-red-500/20 text-red-300'
    }
  };

  return statusConfig[status] || statusConfig.scheduled;
};

/**
 * 🔥 Vérifie si un utilisateur a au moins un événement actif ou à venir
 * Utilisé pour bloquer l'accès au CheckIn si tous les événements sont terminés
 * @param {Array} events - Liste des événements de l'utilisateur
 * @returns {boolean} - true si au moins 1 événement actif/futur, false sinon
 */
export const hasActiveOrUpcomingEvents = (events) => {
  if (!events || events.length === 0) {
    return false;
  }

  // Filtrer les événements qui doivent être affichés (non terminés, non annulés)
  const validEvents = events.filter(event => shouldDisplayEvent(event));

  return validEvents.length > 0;
};
