#!/usr/bin/env node
/**
 * Script pour créer le premier utilisateur admin
 * À exécuter via Render Shell après le premier déploiement
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

async function createAdmin() {
  console.log('🚀 Création du compte administrateur...\n');

  try {
    // Connexion à la base de données
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('✅ Connexion à la base de données réussie\n');

    // Hash du mot de passe
    const hashedPassword = await bcrypt.hash('Admin123!', 10);
    
    // Insertion de l'admin
    const [result] = await connection.execute(`
      INSERT INTO users (cin, name, email, password, role, phone, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      'ADMIN001',
      'Administrateur Principal',
      'admin@security.com',
      hashedPassword,
      'admin',
      '+212600000000',
      'active'
    ]);

    console.log('✅ Compte administrateur créé avec succès!\n');
    console.log('═══════════════════════════════════════════');
    console.log('📧 Email     : admin@security.com');
    console.log('🔑 Password  : Admin123!');
    console.log('👤 CIN       : ADMIN001');
    console.log('📱 Phone     : +212600000000');
    console.log('═══════════════════════════════════════════\n');
    console.log('⚠️  IMPORTANT: Changez ce mot de passe après la première connexion!\n');
    
    await connection.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'admin:', error.message);
    
    if (error.code === 'ER_DUP_ENTRY') {
      console.log('\n💡 L\'admin existe déjà. Utilisez les identifiants existants.');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Impossible de se connecter à la base de données.');
      console.log('   Vérifiez vos variables d\'environnement.');
    } else if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log('\n💡 La table users n\'existe pas.');
      console.log('   Exécutez d\'abord: npm run migrate');
    }
    
    process.exit(1);
  }
}

// Vérifier les variables d'environnement
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD) {
  console.error('❌ Variables d\'environnement manquantes!');
  console.log('\nAssurez-vous que ces variables sont définies:');
  console.log('  - DB_HOST');
  console.log('  - DB_USER');
  console.log('  - DB_PASSWORD');
  console.log('  - DB_NAME\n');
  process.exit(1);
}

// Exécuter
createAdmin();
