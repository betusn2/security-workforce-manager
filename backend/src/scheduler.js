/**
 * Scheduler pour les tâches automatiques
 * - Mise à jour des statuts d'événements toutes les 5 minutes
 * - Vérification des fenêtres de temps pour le temps réel (Socket.IO)
 * - Garantit que les statuts sont toujours à jour en temps réel
 */

const cron = require('node-cron');
const { Event } = require('./models');
const { Op } = require('sequelize');
const { computeEventStatus, combineDateAndTime } = require('./utils/eventHelpers');
const { getEventTimeStatus } = require('./utils/eventTimeWindows');

/**
 * Met à jour automatiquement les statuts des événements
 */
const updateEventStatuses = async () => {
  try {
    console.log('🔄 [CRON] Mise à jour automatique des statuts d\'événements...');

    const events = await Event.findAll({
      where: {
        deletedAt: null,
        status: {
          [Op.notIn]: ['cancelled', 'terminated']
        }
      }
    });

    let completed = 0;
    let activated = 0;

    for (const event of events) {
      const newStatus = computeEventStatus(event);

      // Mettre à jour si le statut a changé (completed, active, ou scheduled)
      if (newStatus !== event.status) {
        await event.update({ status: newStatus });
        console.log(`   ✅ "${event.name}" → ${newStatus}`);
        
        if (newStatus === 'completed') completed++;
        if (newStatus === 'active') activated++;
      }
    }

    console.log(`✅ [CRON] Terminé: ${completed} complétés, ${activated} activés`);
  } catch (error) {
    console.error('❌ [CRON] Erreur lors de la mise à jour des statuts:', error);
  }
};

/**
 * Vérifie les fenêtres de temps et déconnecte les utilisateurs hors période autorisée
 * @param {Object} io - Instance Socket.IO
 */
const checkTimeWindowsAndDisconnect = async (io) => {
  try {
    if (!io) {
      console.warn('⚠️ [CRON] Socket.IO non initialisé, skip vérification fenêtres de temps');
      return;
    }

    console.log('🔄 [CRON] Vérification des fenêtres de temps pour Socket.IO...');

    const events = await Event.findAll({
      where: {
        deletedAt: null,
        status: {
          [Op.notIn]: ['cancelled', 'terminated']
        }
      }
    });

    let disconnectedCount = 0;

    for (const event of events) {
      const timeStatus = getEventTimeStatus(event);
      
      // Si l'événement n'est pas dans la fenêtre de temps réel (2h avant → fin)
      if (!timeStatus.canTrackGPS) {
        // Parcourir tous les sockets connectés
        const sockets = await io.fetchSockets();
        
        for (const socket of sockets) {
          const connection = socket.data; // Données de connexion stockées
          
          // Si le socket est lié à cet événement
          if (connection && connection.eventId === event.id) {
            let reason = '';
            
            if (timeStatus.isBeforeWindow) {
              const eventStart = new Date(event.startDate);
              const twoHoursBefore = new Date(eventStart.getTime() - 2 * 60 * 60 * 1000);
              reason = `Le temps réel sera activé 2h avant le début (${twoHoursBefore.toLocaleTimeString('fr-FR')})`;
            } else if (timeStatus.isAfterEvent) {
              reason = 'Événement terminé - Temps réel désactivé';
            }
            
            console.log(`   ⏸️ Déconnexion ${connection.userId} de l'événement "${event.name}": ${reason}`);
            
            // Émettre un événement de désactivation
            socket.emit('tracking:auto_disabled', {
              message: 'Temps réel désactivé automatiquement',
              reason,
              eventId: event.id,
              eventName: event.name,
              timeStatus
            });
            
            // Déconnecter le socket
            socket.disconnect(true);
            disconnectedCount++;
          }
        }
      }
    }

    if (disconnectedCount > 0) {
      console.log(`✅ [CRON] ${disconnectedCount} connexion(s) Socket.IO désactivée(s) (hors fenêtre de temps)`);
    } else {
      console.log(`✅ [CRON] Toutes les connexions Socket.IO sont dans les fenêtres de temps autorisées`);
    }
  } catch (error) {
    console.error('❌ [CRON] Erreur lors de la vérification des fenêtres de temps:', error);
  }
};

/**
 * Démarre le scheduler
 * @param {Object} io - Instance Socket.IO (optionnel)
 */
const startScheduler = (io = null) => {
  // Exécution toutes les 5 minutes pour maintenir les statuts à jour
  cron.schedule('*/5 * * * *', async () => {
    await updateEventStatuses();
  });

  console.log('⏰ Scheduler démarré: mise à jour des statuts d\'événements toutes les 5 minutes');

  // Vérification des fenêtres de temps toutes les 10 minutes
  if (io) {
    cron.schedule('*/10 * * * *', async () => {
      await checkTimeWindowsAndDisconnect(io);
    });
    console.log('⏰ Scheduler démarré: vérification fenêtres de temps Socket.IO toutes les 10 minutes');
  }

  // Purge automatique des données GPS > 60 jours (tous les jours à 3h du matin)
  cron.schedule('0 3 * * *', async () => {
    try {
      const { GeoTracking } = require('./models');
      const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const deleted = await GeoTracking.destroy({
        where: { recordedAt: { [Op.lt]: cutoff } },
        force: true // bypass paranoid
      });
      console.log(`🗑️ [CRON] Purge GPS: ${deleted} enregistrements supprimés (> 60 jours)`);
    } catch (err) {
      console.error('❌ [CRON] Erreur purge GPS:', err.message);
    }
  });
  console.log('⏰ Scheduler démarré: purge GPS automatique (> 60 jours) tous les jours à 3h');

  // Exécution immédiate au démarrage du serveur
  updateEventStatuses();
};

module.exports = { startScheduler, updateEventStatuses, checkTimeWindowsAndDisconnect };
