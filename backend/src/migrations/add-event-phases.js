/**
 * Migration: Add event phases (Préparation + Mise en place) to events table
 * Automatically run by server.js on startup.
 */

const db = require('../models');

async function columnExists(tableName, columnName) {
  try {
    const [rows] = await db.sequelize.query(
      `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      { replacements: [tableName, columnName] }
    );
    return rows[0] && rows[0].cnt > 0;
  } catch {
    return false;
  }
}

const columnsToAdd = [
  // Phase 1 – Préparation
  { name: 'preparation_start_date',       sql: 'DATE NULL' },
  { name: 'preparation_end_date',         sql: 'DATE NULL' },
  { name: 'preparation_start_time',       sql: 'TIME NULL' },
  { name: 'preparation_end_time',         sql: 'TIME NULL' },
  { name: 'preparation_tolerance',        sql: 'INT NULL DEFAULT 15' },
  { name: 'preparation_agents_count',     sql: 'INT NULL DEFAULT 0' },
  { name: 'preparation_responsable_id',   sql: 'CHAR(36) NULL' },
  { name: 'preparation_observations',     sql: 'TEXT NULL' },
  // Phase 2 – Mise en place
  { name: 'setup_start_date',             sql: 'DATE NULL' },
  { name: 'setup_end_date',               sql: 'DATE NULL' },
  { name: 'setup_start_time',             sql: 'TIME NULL' },
  { name: 'setup_end_time',               sql: 'TIME NULL' },
  { name: 'setup_tolerance',              sql: 'INT NULL DEFAULT 15' },
  { name: 'setup_agents_count',           sql: 'INT NULL DEFAULT 0' },
  { name: 'setup_responsable_id',         sql: 'CHAR(36) NULL' },
  { name: 'setup_observations',           sql: 'TEXT NULL' },
  // Agent creation buffer unit
  { name: 'agent_creation_unit',          sql: "ENUM('minutes','hours','days','weeks') NULL DEFAULT 'hours'" },
];

async function migrateAddEventPhases() {
  for (const col of columnsToAdd) {
    const exists = await columnExists('events', col.name);
    if (exists) continue;
    try {
      await db.sequelize.query(`ALTER TABLE events ADD COLUMN \`${col.name}\` ${col.sql}`);
      console.log(`✅ Migration phases: added ${col.name}`);
    } catch (err) {
      console.warn(`⚠️ Migration phases: could not add ${col.name}: ${err.message}`);
    }
  }
}

module.exports = migrateAddEventPhases;

// Allow direct execution
if (require.main === module) {
  db.sequelize.authenticate()
    .then(() => migrateAddEventPhases())
    .then(() => { console.log('✅ Done'); process.exit(0); })
    .catch((err) => { console.error(err); process.exit(1); });
}
