const mysql = require('mysql2/promise');

async function fixTablesStructure() {
  const connection = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net',
    port: 20601,
    user: 'root',
    password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
    database: 'railway'
  });

  console.log('✅ Connecté à Railway MySQL\n');
  console.log('🔧 CORRECTION DES STRUCTURES DE TABLES\n');

  try {
    // 1. Fix permissions table - add category column
    console.log('📋 1. Ajout colonne category à permissions...');
    try {
      await connection.execute(`
        ALTER TABLE permissions 
        ADD COLUMN category VARCHAR(50) NULL
      `);
      console.log('   ✅ Colonne category ajoutée\n');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('   ⏭️  Colonne category existe déjà\n');
      } else {
        console.log(`   ❌ ${error.message}\n`);
      }
    }

    // 2. Check badges table structure
    console.log('🏆 2. Vérification structure de badges...');
    const [badgeColumns] = await connection.execute(`
      SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = 'badges'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('   Colonnes actuelles:');
    badgeColumns.forEach(col => {
      console.log(`      ${col.COLUMN_NAME.padEnd(20)} | Nullable: ${col.IS_NULLABLE} | Default: ${col.COLUMN_DEFAULT || 'NULL'}`);
    });

    // Check if user_id exists in badges (it shouldn't)
    const hasUserId = badgeColumns.some(c => c.COLUMN_NAME === 'user_id');
    if (hasUserId) {
      console.log('\n   ⚠️  PROBLÈME: badges a une colonne user_id (ne devrait pas)');
      console.log('   🔧 Suppression de la colonne user_id...');
      try {
        await connection.execute(`ALTER TABLE badges DROP COLUMN user_id`);
        console.log('   ✅ Colonne user_id supprimée de badges\n');
      } catch (error) {
        console.log(`   ❌ ${error.message}\n`);
      }
    } else {
      console.log('   ✅ Structure badges correcte (pas de user_id)\n');
    }

    // 3. Verify permissions structure
    console.log('📋 3. Vérification structure de permissions...');
    const [permColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = 'permissions'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('   Colonnes:');
    permColumns.forEach(col => {
      console.log(`      ${col.COLUMN_NAME.padEnd(20)} (${col.DATA_TYPE})`);
    });

    const hasCategory = permColumns.some(c => c.COLUMN_NAME === 'category');
    if (hasCategory) {
      console.log('   ✅ Structure permissions correcte\n');
    } else {
      console.log('   ❌ Colonne category manquante!\n');
    }

    console.log('═'.repeat(70));
    console.log('✅ CORRECTIONS TERMINÉES');
    console.log('═'.repeat(70) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

fixTablesStructure();
