/**
 * 🔄 MIGRATION - Ajouter colonnes enrichies à GeoTracking
 * 
 * Ajoute toutes les nouvelles colonnes pour :
 * - Batterie complète
 * - Réseau détaillé
 * - Informations appareil
 * 
 * USAGE:
 * node backend/src/migrations/add-enriched-tracking-columns.js
 */

const db = require('../models');
const { QueryInterface } = require('sequelize');

async function migrate() {
  console.log('🚀 Démarrage migration - Ajout colonnes enrichies GeoTracking...\n');

  try {
    const queryInterface = db.sequelize.getQueryInterface();

    // Vérifier si les colonnes existent déjà
    const tableDescription = await queryInterface.describeTable('geo_tracking');
    
    const columnsToAdd = [];

    // 🔋 BATTERIE
    if (!tableDescription.battery_charging) {
      columnsToAdd.push({
        name: 'battery_charging',
        type: db.Sequelize.BOOLEAN,
        allowNull: true,
        comment: 'Appareil en charge ?'
      });
    }

    if (!tableDescription.battery_charging_time) {
      columnsToAdd.push({
        name: 'battery_charging_time',
        type: db.Sequelize.INTEGER,
        allowNull: true,
        comment: 'Secondes jusqu\'à charge complète'
      });
    }

    if (!tableDescription.battery_discharging_time) {
      columnsToAdd.push({
        name: 'battery_discharging_time',
        type: db.Sequelize.INTEGER,
        allowNull: true,
        comment: 'Secondes batterie restantes'
      });
    }

    if (!tableDescription.battery_status) {
      columnsToAdd.push({
        name: 'battery_status',
        type: db.Sequelize.STRING(20),
        allowNull: true,
        comment: 'charging, critical, low, medium, good'
      });
    }

    if (!tableDescription.battery_estimated_time) {
      columnsToAdd.push({
        name: 'battery_estimated_time',
        type: db.Sequelize.STRING(50),
        allowNull: true,
        comment: 'Temps restant lisible'
      });
    }

    // 📶 RÉSEAU
    if (!tableDescription.network_downlink) {
      columnsToAdd.push({
        name: 'network_downlink',
        type: db.Sequelize.DECIMAL(8, 2),
        allowNull: true,
        comment: 'Vitesse téléchargement Mbps'
      });
    }

    if (!tableDescription.network_rtt) {
      columnsToAdd.push({
        name: 'network_rtt',
        type: db.Sequelize.INTEGER,
        allowNull: true,
        comment: 'Latence réseau en ms'
      });
    }

    if (!tableDescription.network_save_data) {
      columnsToAdd.push({
        name: 'network_save_data',
        type: db.Sequelize.BOOLEAN,
        allowNull: true,
        comment: 'Mode économie données activé ?'
      });
    }

    if (!tableDescription.network_online) {
      columnsToAdd.push({
        name: 'network_online',
        type: db.Sequelize.BOOLEAN,
        allowNull: true,
        comment: 'Appareil connecté à internet ?'
      });
    }

    if (!tableDescription.network_status) {
      columnsToAdd.push({
        name: 'network_status',
        type: db.Sequelize.STRING(20),
        allowNull: true,
        comment: 'online, offline, slow, moderate, fast, excellent'
      });
    }

    // 📱 APPAREIL
    if (!tableDescription.device_os) {
      columnsToAdd.push({
        name: 'device_os',
        type: db.Sequelize.STRING(50),
        allowNull: true,
        comment: 'Windows, macOS, Linux, Android, iOS'
      });
    }

    if (!tableDescription.device_browser) {
      columnsToAdd.push({
        name: 'device_browser',
        type: db.Sequelize.STRING(50),
        allowNull: true,
        comment: 'Chrome, Firefox, Safari, Edge, Opera'
      });
    }

    if (!tableDescription.device_type) {
      columnsToAdd.push({
        name: 'device_type',
        type: db.Sequelize.STRING(20),
        allowNull: true,
        comment: 'mobile, tablet, desktop'
      });
    }

    if (!tableDescription.device_platform) {
      columnsToAdd.push({
        name: 'device_platform',
        type: db.Sequelize.STRING(50),
        allowNull: true,
        comment: 'Win32, MacIntel, iPhone, Android, etc.'
      });
    }

    if (!tableDescription.device_language) {
      columnsToAdd.push({
        name: 'device_language',
        type: db.Sequelize.STRING(10),
        allowNull: true,
        comment: 'Langue appareil'
      });
    }

    if (!tableDescription.device_cpu_cores) {
      columnsToAdd.push({
        name: 'device_cpu_cores',
        type: db.Sequelize.INTEGER,
        allowNull: true,
        comment: 'Nombre de cœurs CPU'
      });
    }

    if (!tableDescription.device_memory) {
      columnsToAdd.push({
        name: 'device_memory',
        type: db.Sequelize.INTEGER,
        allowNull: true,
        comment: 'RAM en GB'
      });
    }

    if (!tableDescription.device_screen_resolution) {
      columnsToAdd.push({
        name: 'device_screen_resolution',
        type: db.Sequelize.STRING(20),
        allowNull: true,
        comment: 'Résolution écran'
      });
    }

    if (!tableDescription.device_screen_on) {
      columnsToAdd.push({
        name: 'device_screen_on',
        type: db.Sequelize.BOOLEAN,
        allowNull: true,
        comment: 'Écran allumé ou éteint ?'
      });
    }

    // 📍 GPS étendu
    if (!tableDescription.is_moving) {
      columnsToAdd.push({
        name: 'is_moving',
        type: db.Sequelize.BOOLEAN,
        allowNull: true,
        comment: 'Agent en mouvement ?'
      });
    }

    // Ajouter les colonnes
    if (columnsToAdd.length > 0) {
      console.log(`📝 Ajout de ${columnsToAdd.length} nouvelles colonnes...\n`);

      for (const column of columnsToAdd) {
        console.log(`   ➕ Ajout colonne: ${column.name}`);
        await queryInterface.addColumn('geo_tracking', column.name, {
          type: column.type,
          allowNull: column.allowNull,
          comment: column.comment
        });
      }

      console.log('\n✅ Toutes les colonnes ont été ajoutées avec succès!');
    } else {
      console.log('ℹ️  Aucune colonne à ajouter, la table est déjà à jour!');
    }

    console.log('\n🎉 Migration terminée avec succès!');
    return true;

  } catch (error) {
    console.error('\n❌ Erreur migration:', error);
    console.error(error.stack);
    throw error;
  }
}

// Exécuter la migration si appelé directement
if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

// Exporter pour utilisation dans server.js
module.exports = migrate;
