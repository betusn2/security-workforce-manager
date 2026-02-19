/**
 * Utilitaires pour la gestion des événements
 */

/**
 * Combine une date et une heure en un objet Date complet
 * @param {Date|string} date - La date de l'événement
 * @param {string} time - L'heure au format "HH:MM" (ex: "08:00")
 * @returns {Date} - Date complète avec l'heure
 */
const combineDateAndTime = (date, time) => {
  const eventDate = new Date(date);
  
  if (!time) {
    return eventDate;
  }
  
  const [hours, minutes] = time.split(':').map(Number);
  eventDate.setHours(hours || 0, minutes || 0, 0, 0);
  
  return eventDate;
};

/**
 * Calcule la datetime de fin d'un événement en gérant les événements de nuit
 * Si checkOutTime est 00:00 (minuit), c'est la fin du jour suivant
 * Si checkOutTime < checkInTime (ex: 22:00 -> 00:30), c'est le lendemain
 * @param {Date|string} endDate
 * @param {string} checkOutTime - ex: "00:00", "18:00"
 * @param {string} checkInTime - ex: "22:00", "08:00" (pour détecter les événements de nuit)
 * @returns {Date}
 */
const getEventEndDateTime = (endDate, checkOutTime, checkInTime) => {
  const checkOut = checkOutTime || '23:59';
  const eventEnd = combineDateAndTime(endDate, checkOut);
  
  const [outH, outM] = checkOut.split(':').map(Number);
  const [inH, inM] = (checkInTime || '00:00').split(':').map(Number);
  
  // Événement de nuit : si checkout <= 06:00 ou checkout < checkin
  // Ex: checkin=22:00, checkout=00:00 → fin le lendemain
  // Ex: checkin=22:00, checkout=02:30 → fin le lendemain
  const outMins = outH * 60 + outM;
  const inMins = inH * 60 + inM;
  
  const isOvernightByMidnight = outH === 0 && outM === 0; // minuit exact
  const isOvernightByCrossing = checkInTime && outMins < inMins && outMins <= 360; // checkout avant checkin et avant 6h
  
  if (isOvernightByMidnight || isOvernightByCrossing) {
    eventEnd.setDate(eventEnd.getDate() + 1);
  }
  
  return eventEnd;
};

/**
 * Calcule l'heure de début de check-in autorisée
 * Les agents peuvent pointer dès l'ouverture de la fenêtre de création
 * (agentCreationBuffer minutes avant l'heure d'arrivée)
 * @param {Date|string} startDate - Date de début
 * @param {string} checkInTime - Heure d'arrivée (ex: "08:00")
 * @param {number} agentCreationBuffer - Buffer en MINUTES (ex: 120 = 2h)
 * @returns {Date}
 */
const getCheckInStartTime = (startDate, checkInTime, agentCreationBuffer = 120) => {
  const checkInDateTime = combineDateAndTime(startDate, checkInTime || '00:00');
  
  // Convertir minutes en heures et soustraire le buffer
  const bufferHours = (agentCreationBuffer || 120) / 60;
  checkInDateTime.setHours(checkInDateTime.getHours() - bufferHours);
  
  return checkInDateTime;
};

/**
 * Calcule le statut d'un événement basé sur ses dates/heures
 * @param {Object} event - L'événement
 * @param {Date|string} event.startDate - Date de début
 * @param {Date|string} event.endDate - Date de fin
 * @param {string} event.checkInTime - Heure d'arrivée (ex: "08:00")
 * @param {string} event.checkOutTime - Heure de départ (ex: "18:00")
 * @param {number} event.agentCreationBuffer - Buffer création agent en MINUTES (ex: 120)
 * @param {string} event.status - Statut actuel
 * @returns {string} - Le statut calculé: 'scheduled', 'active', 'completed'
 */
const computeEventStatus = (event) => {
  const now = new Date();
  
  // Ne pas modifier les événements annulés ou terminés manuellement
  if (['cancelled', 'terminated'].includes(event.status)) {
    return event.status;
  }
  
  // L'événement devient "active" dès l'ouverture de la fenêtre de check-in
  // (agentCreationBuffer minutes avant checkInTime)
  const eventStart = getCheckInStartTime(
    event.startDate, 
    event.checkInTime, 
    event.agentCreationBuffer || 120
  );
  const eventEnd = getEventEndDateTime(event.endDate, event.checkOutTime, event.checkInTime);
  
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
const isEventActive = (event) => {
  return computeEventStatus(event) === 'active';
};

/**
 * Vérifie si un événement est terminé
 * @param {Object} event - L'événement
 * @returns {boolean}
 */
const isEventCompleted = (event) => {
  return computeEventStatus(event) === 'completed';
};

/**
 * Vérifie si un événement est à venir
 * @param {Object} event - L'événement
 * @returns {boolean}
 */
const isEventScheduled = (event) => {
  return computeEventStatus(event) === 'scheduled';
};

/**
 * Vérifie si un événement doit être affiché (non terminé, non annulé)
 * Les événements restent affichés 2h après leur fin pour permettre les check-out en retard
 * @param {Object} event - L'événement
 * @returns {boolean}
 */
const shouldDisplayEvent = (event) => {
  const now = new Date();
  
  // Toujours cacher les événements annulés ou terminés manuellement
  if (['cancelled', 'terminated'].includes(event.status?.toLowerCase())) {
    return false;
  }
  
  // Calculer l'heure de fin de l'événement + buffer de 2h
  const eventEnd = getEventEndDateTime(event.endDate, event.checkOutTime, event.checkInTime);
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
 * Formate une date pour l'affichage
 * @param {Date|string} date
 * @param {string} time
 * @returns {string}
 */
const formatEventDateTime = (date, time) => {
  const dt = combineDateAndTime(date, time);
  return dt.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

module.exports = {
  combineDateAndTime,
  getEventEndDateTime,
  getCheckInStartTime,
  computeEventStatus,
  isEventActive,
  isEventCompleted,
  isEventScheduled,
  shouldDisplayEvent,
  formatEventDateTime
};
