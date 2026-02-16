/**
 * Script de diagnostic et correction des erreurs API
 * Vérifie la structure de la base de données et corrige les problèmes courants
 */

require('dotenv').config();
const { sequelize, User, Event, Attendance, Assignment, Zone } = require('./backend/src/models');

async function diagnoseAndFix() {
  try {
    console.log('🔍 Diagnostic des erreurs API...\n');

    // Test de connexion
    await sequelize.authenticate();
    console.log('✅ Connexion à la base de données réussie\n');

    // Vérifier les tables
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
    `);
    
    console.log(`📊 Tables trouvées: ${tables.length}`);
    tables.forEach(t => console.log(`  - ${t.TABLE_NAME || t.table_name}`));
    console.log('');

    // Vérifier la structure de la table attendances
    console.log('🔍 Vérification de la table attendances...');
    const [attendanceColumns] = await sequelize.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'attendances'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log(`  Colonnes: ${attendanceColumns.length}`);
    attendanceColumns.forEach(col => {
      console.log(`    - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (nullable: ${col.IS_NULLABLE})`);
    });
    console.log('');

    // Tester une requête attendance simple
    console.log('🧪 Test requête attendances...');
    try {
      const attendanceCount = await Attendance.count();
      console.log(`✅ ${attendanceCount} attendance(s) trouvé(e)(s)\n`);
    } catch (error) {
      console.error('❌ Erreur requête attendances:', error.message);
      console.log('');
    }

    // Tester une requête attendance avec associations
    console.log('🧪 Test requête attendances avec associations...');
    try {
      const attendances = await Attendance.findAll({
        limit: 1,
        include: [
          {
            model: User,
            as: 'agent',
            attributes: ['id', 'firstName', 'lastName']
          },
          {
            model: Event,
            as: 'event',
            attributes: ['id', 'name', 'location']
          }
        ]
      });
      console.log(`✅ Requête avec associations réussie: ${attendances.length} résultat(s)\n`);
    } catch (error) {
      console.error('❌ Erreur requête avec associations:', error.message);
      console.log('');
    }

    // Vérifier la structure de la table assignments
    console.log('🔍 Vérification de la table assignments...');
    const [assignmentColumns] = await sequelize.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'assignments'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log(`  Colonnes: ${assignmentColumns.length}`);
    const hasZoneId = assignmentColumns.some(col => col.COLUMN_NAME === 'zone_id');
    console.log(`  zone_id présent: ${hasZoneId ? '✅' : '❌'}`);
    
    if (!hasZoneId) {
      console.log('\n🔧 Ajout de la colonne zone_id...');
      try {
        await sequelize.query(`
          ALTER TABLE assignments 
          ADD COLUMN zone_id CHAR(36) NULL,
          ADD INDEX idx_assignments_zone_id (zone_id),
          ADD CONSTRAINT fk_assignments_zone 
            FOREIGN KEY (zone_id) REFERENCES zones(id) 
            ON DELETE SET NULL ON UPDATE CASCADE
        `);
        console.log('✅ Colonne zone_id ajoutée avec succès\n');
      } catch (error) {
        if (error.message.includes('Duplicate column')) {
          console.log('⚠️ Colonne zone_id existe déjà\n');
        } else {
          console.error('❌ Erreur ajout zone_id:', error.message, '\n');
        }
      }
    }
    console.log('');

    // Vérifier un utilisateur avec facialVector
    console.log('🔍 Vérification des vecteurs faciaux...');
    const usersWithFacial = await User.count({
      where: {
        facialVector: { [require('sequelize').Op.ne]: null }
      }
    });
    console.log(`  Utilisateurs avec vecteur facial: ${usersWithFacial}\n`);

    // Test des routes critiques
    console.log('📋 Résumé des problèmes potentiels:');
    
    const issues = [];
    
    if (attendanceCount === 0) {
      issues.push('⚠️ Aucune attendance dans la base de données');
    }
    
    if (!hasZoneId) {
      issues.push('❌ Colonne zone_id manquante dans assignments (devrait être corrigée ci-dessus)');
    }
    
    if (usersWithFacial === 0) {
      issues.push('⚠️ Aucun utilisateur n\'a de vecteur facial enregistré');
    }

    if (issues.length === 0) {
      console.log('✅ Aucun problème majeur détecté\n');
    } else {
      issues.forEach(issue => console.log(`  ${issue}`));
      console.log('');
    }

    console.log('✅ Diagnostic terminé!\n');
    console.log('📝 Actions recommandées:');
    console.log('  1. Redémarrer le serveur backend');
    console.log('  2. Vérifier les logs du serveur pour les erreurs détaillées');
    console.log('  3. Tester les endpoints API:\n');
    console.log('     GET /api/attendance');
    console.log('     GET /api/attendance/today-status');
    console.log('     GET /api/auth/facial-vector-checkin');
    console.log('     GET /api/users/search/cin/:cin\n');

  } catch (error) {
    console.error('❌ Erreur lors du diagnostic:', error);
  } finally {
    await sequelize.close();
  }
}

diagnoseAndFix();
