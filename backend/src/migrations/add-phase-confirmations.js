/**
 * Migration: Add phase confirmation columns to events + zones tables.
 * Stores responsable confirmation state (checklist, confirmed_at, confirmed_by)
 * and zone setup confirmation, per phase.
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
  // ── Phase 1 confirmation ───────────────────────────────────────────────────
  { table: 'events', name: 'preparation_confirmed',    sql: 'BOOLEAN NOT NULL DEFAULT FALSE' },
  { table: 'events', name: 'preparation_confirmed_at', sql: 'DATETIME NULL' },
  { table: 'events', name: 'preparation_confirmed_by', sql: 'CHAR(36) NULL' },
  { table: 'events', name: 'preparation_checklist',    sql: 'JSON NULL COMMENT "{ phaseStarted, agentsPresent, zonesVerified, phaseDone }"' },

  // ── Phase 2 confirmation ───────────────────────────────────────────────────
  { table: 'events', name: 'setup_confirmed',          sql: 'BOOLEAN NOT NULL DEFAULT FALSE' },
  { table: 'events', name: 'setup_confirmed_at',       sql: 'DATETIME NULL' },
  { table: 'events', name: 'setup_confirmed_by',       sql: 'CHAR(36) NULL' },
  { table: 'events', name: 'setup_checklist',          sql: 'JSON NULL COMMENT "{ phaseStarted, agentsPresent, zonesVerified, phaseDone }"' },
  { table: 'events', name: 'setup_zones_confirmed',    sql: 'JSON NULL COMMENT "Array of zone IDs confirmed by responsable"' },

  // ── Phase 3 confirmation ───────────────────────────────────────────────────
  { table: 'events', name: 'execution_confirmed',      sql: 'BOOLEAN NOT NULL DEFAULT FALSE' },
  { table: 'events', name: 'execution_confirmed_at',   sql: 'DATETIME NULL' },
  { table: 'events', name: 'execution_confirmed_by',   sql: 'CHAR(36) NULL' },
  { table: 'events', name: 'execution_checklist',      sql: 'JSON NULL COMMENT "{ phaseStarted, agentsPresent, zonesVerified, phaseDone }"' },

  // ── Zone setup confirmation ────────────────────────────────────────────────
  { table: 'zones', name: 'setup_confirmed',           sql: 'BOOLEAN NOT NULL DEFAULT FALSE' },
  { table: 'zones', name: 'setup_confirmed_at',        sql: 'DATETIME NULL' },
  { table: 'zones', name: 'setup_confirmed_by',        sql: 'CHAR(36) NULL' },
];

async function migrateAddPhaseConfirmations() {
  for (const col of columnsToAdd) {
    const exists = await columnExists(col.table, col.name);
    if (exists) continue;
    try {
      await db.sequelize.query(
        `ALTER TABLE \`${col.table}\` ADD COLUMN \`${col.name}\` ${col.sql}`
      );
      console.log(`✅ PhaseConfirmation migration: added ${col.table}.${col.name}`);
    } catch (err) {
      console.warn(`⚠️ PhaseConfirmation migration: could not add ${col.table}.${col.name}: ${err.message}`);
    }
  }
}

module.exports = migrateAddPhaseConfirmations;

if (require.main === module) {
  db.sequelize.authenticate()
    .then(() => migrateAddPhaseConfirmations())
    .then(() => { console.log('✅ Done'); process.exit(0); })
    .catch((err) => { console.error(err); process.exit(1); });
}
