/**
 * Utilitaires backend pour gérer les fenêtres temporelles des événements
 * 
 * Règles métier:
 * - Temps réel activé depuis (checkInTime - agentCreationBuffer) jusqu'à (endDate + checkOutTime + 2h)
 * - Check-in autorisé depuis (checkInTime - agentCreationBuffer) jusqu'à (checkInTime + lateThreshold)
 * - Check-out autorisé depuis (checkOutTime - earlyTolerance) jusqu'à (checkOutTime + lateTolerance)
 * 
 * IMPORTANT: checkInTime et checkOutTime sont les vraies heures de pointage (ex: "08:00", "18:00")
 * startDate et endDate contiennent seulement la DATE (heure souvent à minuit)
 * 
 * MODE TEST: Définir BYPASS_TIME_WINDOWS=true pour désactiver les validations temporelles
 */

// Mode bypass pour tests/développement
const BYPASS_TIME_WINDOWS = process.env.BYPASS_TIME_WINDOWS === 'true';

if (BYPASS_TIME_WINDOWS) {
  console.log('⚠️ MODE TEST ACTIVÉ - Validation fenêtres de temps DÉSACTIVÉE');
}

/**
 * Combine une date (startDate/endDate) avec une heure (checkInTime/checkOutTime "HH:MM")
 * Retourne un objet Date avec la date + l'heure exacte
 */
const combineDateAndTime = (dateStr, timeStr) => {
  const date = new Date(dateStr);
  if (!timeStr) return date;
  
  // Extraire HH et MM depuis "HH:MM" ou "HH:MM:SS"
  const parts = String(timeStr).split(':');
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
};

/**
 * Vérifie si le tracking GPS doit être actif pour un événement
 * @param {Object} event - L'événement avec startDate, endDate, checkInTime, checkOutTime
 * @returns {boolean} True si le tracking doit être actif
 */
const isTrackingAllowed = (event) => {
  // MODE TEST: Toujours autoriser
  if (BYPASS_TIME_WINDOWS) {
    return true;
  }

  if (!event || !event.startDate || !event.endDate) {
    return false;
  }

  const now = new Date();

  // Utiliser checkInTime si disponible, sinon startDate directement
  const checkInDateTime = event.checkInTime
    ? combineDateAndTime(event.startDate, event.checkInTime)
    : new Date(event.startDate);

  // Utiliser checkOutTime si disponible, sinon endDate directement
  const checkOutDateTime = event.checkOutTime
    ? combineDateAndTime(event.endDate, event.checkOutTime)
    : new Date(event.endDate);

  const agentBuffer = event.agentCreationBuffer || 120;
  // Tracking commence agentBuffer minutes avant le check-in
  const trackingStart = new Date(checkInDateTime.getTime() - agentBuffer * 60 * 1000);
  // Tracking se termine 2h après le check-out
  const trackingEnd = new Date(checkOutDateTime.getTime() + 2 * 60 * 60 * 1000);

  return now >= trackingStart && now <= trackingEnd;
};

/**
 * Vérifie si le check-in est autorisé
 * @param {Object} event - L'événement
 * @returns {boolean} True si le check-in est autorisé
 */
const isCheckInAllowed = (event) => {
  // MODE TEST: Toujours autoriser
  if (BYPASS_TIME_WINDOWS) {
    return true;
  }

  if (!event || !event.startDate || !event.endDate) {
    return false;
  }

  const now = new Date();

  // Heure réelle de check-in (startDate + checkInTime)
  const checkInDateTime = event.checkInTime
    ? combineDateAndTime(event.startDate, event.checkInTime)
    : new Date(event.startDate);

  // Fenêtre ouvre agentCreationBuffer minutes avant le check-in (défaut 120min)
  const agentBuffer = event.agentCreationBuffer || 120;
  const preWindowStart = new Date(checkInDateTime.getTime() - agentBuffer * 60 * 1000);

  // Fenêtre ferme lateThreshold minutes après l'heure de check-in (défaut 15min)
  const lateThreshold = event.lateThreshold || 15;
  const checkInEnd = new Date(checkInDateTime.getTime() + lateThreshold * 60 * 1000);

  return now >= preWindowStart && now <= checkInEnd;
};

/**
 * Vérifie si le check-out est autorisé
 * @param {Object} event - L'événement
 * @returns {boolean} True si le check-out est autorisé
 */
const isCheckOutAllowed = (event) => {
  // MODE TEST: Toujours autoriser
  if (BYPASS_TIME_WINDOWS) {
    return true;
  }

  if (!event || !event.endDate) {
    return false;
  }

  const now = new Date();

  // Heure réelle de check-out (endDate + checkOutTime)
  const checkOutDateTime = event.checkOutTime
    ? combineDateAndTime(event.endDate, event.checkOutTime)
    : new Date(event.endDate);

  // Tolérance départ anticipé (par défaut 30 minutes avant la fin)
  const earlyCheckoutTolerance = event.earlyCheckoutTolerance || 30;
  const checkOutStart = new Date(checkOutDateTime.getTime() - earlyCheckoutTolerance * 60 * 1000);

  // Tolérance départ tardif (par défaut 2h après la fin pour flexibilité)
  const lateCheckoutTolerance = event.lateCheckoutTolerance || 120;
  const checkOutEnd = new Date(checkOutDateTime.getTime() + lateCheckoutTolerance * 60 * 1000);

  return now >= checkOutStart && now <= checkOutEnd;
};

/**
 * Obtient le statut temporel d'un événement
 * @param {Object} event - L'événement
 * @returns {Object} Statut avec les flags
 */
const getEventTimeStatus = (event) => {
  if (!event || !event.startDate || !event.endDate) {
    return {
      isBeforeWindow: true,
      isInPreWindow: false,
      isDuringEvent: false,
      isNearEnd: false,
      isAfterEvent: false,
      canCheckIn: false,
      canCheckOut: false,
      canTrackGPS: false
    };
  }

  const now = new Date();

  // Combiner date + heure réelle de check-in / check-out
  const checkInDateTime = event.checkInTime
    ? combineDateAndTime(event.startDate, event.checkInTime)
    : new Date(event.startDate);

  const checkOutDateTime = event.checkOutTime
    ? combineDateAndTime(event.endDate, event.checkOutTime)
    : new Date(event.endDate);

  // Fenêtre check-in
  const agentBuffer = event.agentCreationBuffer || 120;
  const preWindowStart = new Date(checkInDateTime.getTime() - agentBuffer * 60 * 1000);
  const lateThreshold = event.lateThreshold || 15;
  const checkInEnd = new Date(checkInDateTime.getTime() + lateThreshold * 60 * 1000);

  // Fenêtre check-out
  const earlyCheckoutTolerance = event.earlyCheckoutTolerance || 30;
  const lateCheckoutTolerance = event.lateCheckoutTolerance || 120;
  const checkOutStart = new Date(checkOutDateTime.getTime() - earlyCheckoutTolerance * 60 * 1000);
  const checkOutEnd = new Date(checkOutDateTime.getTime() + lateCheckoutTolerance * 60 * 1000);

  const isBeforeWindow = now < preWindowStart;
  const isInPreWindow = now >= preWindowStart && now < checkInDateTime;
  const isDuringEvent = now >= checkInDateTime && now <= checkOutDateTime;
  const isAfterCheckInWindow = now > checkInEnd;
  const isInCheckOutWindow = now >= checkOutStart && now <= checkOutEnd;
  const isAfterCheckOutWindow = now > checkOutEnd;
  const isNearEnd = now >= checkOutStart && now <= checkOutDateTime;
  const isAfterEvent = now > checkOutDateTime;

  return {
    isBeforeWindow,
    isInPreWindow,
    isDuringEvent,
    isAfterCheckInWindow,
    isInCheckOutWindow,
    isAfterCheckOutWindow,
    isNearEnd,
    isAfterEvent,
    canCheckIn: isCheckInAllowed(event),
    canCheckOut: isCheckOutAllowed(event),
    canTrackGPS: isTrackingAllowed(event)
  };
};

/**
 * Filtre les événements pour ne garder que ceux en fenêtre de tracking
 * @param {Array} events - Liste d'événements
 * @returns {Array} Événements actifs pour le tracking
 */
const getActiveTrackingEvents = (events) => {
  if (!Array.isArray(events)) {
    return [];
  }

  return events.filter(event => {
    const timeStatus = getEventTimeStatus(event);
    return timeStatus.canTrackGPS;
  });
};

module.exports = {
  isTrackingAllowed,
  isCheckInAllowed,
  isCheckOutAllowed,
  getEventTimeStatus,
  getActiveTrackingEvents
};
