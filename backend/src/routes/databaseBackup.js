const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { sequelize, ActivityLog, ScheduledBackup } = require('../models');

// Cache mémoire pour les backups (système de fichiers éphémère sur Render)
const backupCache = new Map(); // filename → { sql, createdAt, size, type }
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 heures

/**
 * Après chaque restauration: recréer l'admin si absent
 * (la restauration peut écraser la table users)
 */
const ensureAdminUser = async () => {
  try {
    const [users] = await sequelize.query(
      `SELECT id FROM users WHERE email = 'admin@security.com' AND deleted_at IS NULL LIMIT 1`
    );
    if (users.length > 0) {
      console.log('✅ Admin user already exists after restore');
      return;
    }
    // Admin absent → le recréer
    const hashedPassword = await bcrypt.hash('Admin123!', 12);
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    await sequelize.query(`
      INSERT INTO users (id, employee_id, first_name, last_name, email, password, phone, role, status, created_at, updated_at)
      VALUES (?, 'ADMIN001', 'Administrateur', 'Principal', 'admin@security.com', ?, '+33600000000', 'admin', 'active', NOW(), NOW())
      ON DUPLICATE KEY UPDATE email = 'admin@security.com', password = ?, role = 'admin', status = 'active', updated_at = NOW()
    `, { replacements: [uuid, hashedPassword, hashedPassword] });
    console.log('✅ Admin user recréé après restauration (admin@security.com / Admin123!)');
  } catch (err) {
    console.error('⚠️ ensureAdminUser error:', err.message);
  }
};

/**
 * Après chaque restauration: remettre deleted_at=NULL pour tous les enregistrements
 * (le backup peut contenir des soft-deletes qui cachent les données dans l'API)
 */
const fixSoftDeletes = async () => {
  const tables = ['users','events','incidents','zones','assignments','notifications','badges','activity_logs','permissions'];
  for (const t of tables) {
    try {
      const [r] = await sequelize.query(`UPDATE \`${t}\` SET deleted_at=NULL WHERE deleted_at IS NOT NULL`);
      if (r.affectedRows > 0) console.log(`🔓 ${t}: ${r.affectedRows} enregistrement(s) restauré(s)`);
    } catch (_) { /* table sans deleted_at, ignorer */ }
  }
};

// Répertoire de sauvegarde : /tmp en production (Render), local en développement
const BACKUP_DIR = process.env.NODE_ENV === 'production'
  ? path.join(os.tmpdir(), 'security-guard-backups')
  : path.join(__dirname, '../../backups');
const UPLOADS_DIR = path.join(BACKUP_DIR, 'uploads');

// Multer config
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/sql' || file.originalname.endsWith('.sql')) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers .sql sont autorisés'), false);
    }
  }
});

const ensureDirectories = async () => {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  } catch (_) {}
};

const formatDate = () => {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
};

const getDatabaseConfig = () => {
  const config = require('../config/database');
  const env = process.env.NODE_ENV || 'development';
  return config[env];
};

const getFileSize = async (filePath) => {
  try { return (await fs.stat(filePath)).size; } catch { return 0; }
};

const logActivity = async (req, action, description, status = 'success', metadata = {}) => {
  try {
    await ActivityLog.create({
      userId: req.user?.id || null,
      action,
      description,
      entityType: 'database',
      entityId: null,
      status,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
      newValues: JSON.stringify(metadata)
    });
  } catch (error) {
    console.error('Erreur log activité:', error.message);
  }
};

// Auto-sync ScheduledBackup table si elle n'existe pas
const ensureScheduledBackupTable = async () => {
  try {
    await ScheduledBackup.sync({ force: false });
    // Ajouter les colonnes timestamps si manquantes (table créée sans underscored)
    const cols = [
      ['created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP'],
      ['updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
      ['deleted_at', 'DATETIME NULL DEFAULT NULL']
    ];
    for (const [col, def] of cols) {
      try {
        const [rows] = await sequelize.query(
          `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'scheduled_backups' AND COLUMN_NAME = ?`,
          { replacements: [col] }
        );
        if (rows[0].cnt === 0) {
          await sequelize.query(`ALTER TABLE \`scheduled_backups\` ADD COLUMN \`${col}\` ${def}`);
          console.log(`📝 scheduled_backups.${col} ajoutée`);
        }
      } catch (_) {}
    }
  } catch (err) {
    console.error('Erreur sync ScheduledBackup:', err.message);
  }
};

// Génération SQL pure JS - remplace mysqldump (fonctionne sur tout environnement)
const generateSQLContent = async (type) => {
  const dbConfig = getDatabaseConfig();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  let sql = `-- ============================================================\n`;
  sql += `-- Security Guard Manager - Database Backup\n`;
  sql += `-- Generated : ${now}\n`;
  sql += `-- Type      : ${type}\n`;
  sql += `-- Database  : ${dbConfig.database}\n`;
  sql += `-- ============================================================\n\n`;
  sql += `SET FOREIGN_KEY_CHECKS=0;\n`;
  sql += `SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';\n`;
  sql += `SET NAMES utf8mb4;\n\n`;

  // Liste des tables
  const [tablesRaw] = await sequelize.query('SHOW TABLES');
  const tableKey = `Tables_in_${dbConfig.database}`;
  const tables = tablesRaw.map(t => t[tableKey] || Object.values(t)[0]);
  console.log(`📋 Génération SQL pour ${tables.length} tables (type: ${type})`);

  for (const tableName of tables) {
    try {
      sql += `\n-- ----------------------------\n`;
      sql += `-- Table: \`${tableName}\`\n`;
      sql += `-- ----------------------------\n`;
      sql += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;

      // Schéma
      const [[createResult]] = await sequelize.query(`SHOW CREATE TABLE \`${tableName}\``);
      sql += (createResult['Create Table'] || createResult[`Create Table`]) + ';\n';

      if (type === 'full') {
        const [rows] = await sequelize.query(`SELECT * FROM \`${tableName}\``);
        if (rows.length > 0) {
          const cols = Object.keys(rows[0]).map(c => `\`${c}\``).join(', ');
          sql += `\nLOCK TABLES \`${tableName}\` WRITE;\n`;

          const batchSize = 200;
          for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            const valuesStr = batch.map(row => {
              const vals = Object.values(row).map(v => {
                if (v === null || v === undefined) return 'NULL';
                if (typeof v === 'boolean')  return v ? 1 : 0;
                if (typeof v === 'number')   return v;
                if (v instanceof Date)       return `'${v.toISOString().slice(0,19).replace('T',' ')}'`;
                if (v instanceof Buffer)     return `X'${v.toString('hex')}'`;
                const hex = Buffer.from(String(v), 'utf8').toString('hex');
                return hex.length > 0 ? `X'${hex}'` : "''";
              }).join(', ');
              return `(${vals})`;
            }).join(',\n');
            sql += `INSERT INTO \`${tableName}\` (${cols}) VALUES\n${valuesStr};\n`;
          }
          sql += `UNLOCK TABLES;\n`;
        }
      }
    } catch (tableErr) {
      console.warn(`⚠️ Table ${tableName} ignorée: ${tableErr.message}`);
      sql += `-- ERREUR table ${tableName}: ${tableErr.message}\n`;
    }
  }

  sql += `\nSET FOREIGN_KEY_CHECKS=1;\n`;
  sql += `\n-- Backup terminé : ${new Date().toISOString()}\n`;
  return sql;
};

// Nettoyage cache expiré
const cleanExpiredCache = () => {
  const now = Date.now();
  for (const [key, val] of backupCache.entries()) {
    if (now - val.createdAt > CACHE_TTL) backupCache.delete(key);
  }
};

const cleanupOldBackups = async (retentionCount = 3) => {
  try {
    await ensureDirectories();
    const files = await fs.readdir(BACKUP_DIR);
    const sqlFiles = files.filter(f => f.endsWith('.sql'));
    if (sqlFiles.length <= retentionCount) return { deleted: 0, kept: sqlFiles.length };
    const withStats = await Promise.all(sqlFiles.map(async filename => {
      const fp = path.join(BACKUP_DIR, filename);
      const stats = await fs.stat(fp);
      return { filename, filePath: fp, mtime: stats.mtime };
    }));
    withStats.sort((a, b) => b.mtime - a.mtime);
    const toDelete = withStats.slice(retentionCount);
    for (const f of toDelete) await fs.unlink(f.filePath).catch(() => {});
    return { deleted: toDelete.length, kept: retentionCount };
  } catch (err) {
    console.error('Erreur cleanupOldBackups:', err);
    return { deleted: 0, kept: 0 };
  }
};

// Routes

/**
 * GET /admin/database/info
 * Informations sur la base de données
 */
router.get('/info', async (req, res) => {
  try {
    const dbConfig = getDatabaseConfig();
    
    // Requêtes spécifiques selon le type de DB
    let dbInfo = {
      type: dbConfig.dialect,
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database
    };

    if (dbConfig.dialect === 'mysql') {
      // Informations MySQL
      const [results] = await sequelize.query('SELECT VERSION() as version');
      const [sizeResult] = await sequelize.query(`
        SELECT 
          ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as size_mb
        FROM information_schema.tables 
        WHERE table_schema = ?
      `, { replacements: [dbConfig.database] });
      
      const [tablesResult] = await sequelize.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = ?
      `, { replacements: [dbConfig.database] });

      dbInfo.version = results[0].version;
      dbInfo.size = (sizeResult[0].size_mb || 0) * 1024 * 1024; // Convert to bytes
      dbInfo.tables_count = tablesResult[0].count;

    } else if (dbConfig.dialect === 'postgres') {
      // Informations PostgreSQL
      const [results] = await sequelize.query('SELECT version()');
      const [sizeResult] = await sequelize.query(`
        SELECT pg_size_pretty(pg_database_size(?)) as size, 
               pg_database_size(?) as size_bytes
      `, { replacements: [dbConfig.database, dbConfig.database] });
      
      const [tablesResult] = await sequelize.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);

      dbInfo.version = results[0][0].version.split(' ')[1];
      dbInfo.size = parseInt(sizeResult[0][0].size_bytes) || 0;
      dbInfo.tables_count = tablesResult[0][0].count;
    }

    res.json(dbInfo);
  } catch (error) {
    console.error('Erreur info DB:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération des informations de base' 
    });
  }
});

/**
 * POST /admin/database/validate
 * Valider la structure de la base
 */
router.post('/validate', async (req, res) => {
  try {
    // Test de connexion
    await sequelize.authenticate();
    
    // Vérifier quelques tables critiques
    const [results] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = ? AND table_name IN ('users', 'events', 'assignments')
    `, { 
      replacements: [getDatabaseConfig().database] 
    });

    if (results.length < 3) {
      throw new Error('Tables critiques manquantes');
    }

    res.json({ success: true, message: 'Base de données valide' });
  } catch (error) {
    console.error('Erreur validation:', error);
    res.status(400).json({ 
      success: false, 
      message: `Erreur validation: ${error.message}` 
    });
  }
});

/**
 * POST /admin/database/backup
 * Créer une sauvegarde (pure JS - pas de mysqldump requis)
 */
router.post('/backup', async (req, res) => {
  await ensureDirectories();
  const { type = 'full' } = req.body;

  try {
    const dbConfig = getDatabaseConfig();
    const timestamp = formatDate();
    const filename = `backup_${dbConfig.database}_${timestamp}_${type}.sql`;
    const filePath = path.join(BACKUP_DIR, filename);

    console.log(`🔧 Démarrage sauvegarde pure JS (type: ${type})`);

    // Générer le SQL en mémoire
    const sqlContent = await generateSQLContent(type);
    const size = Buffer.byteLength(sqlContent, 'utf8');

    // Stocker en cache mémoire (toujours disponible)
    cleanExpiredCache();
    backupCache.set(filename, { sql: sqlContent, createdAt: Date.now(), size, type });
    console.log(`💾 Cache: ${filename} ajouté (${size} octets)`);

    // Essayer aussi d'écrire sur disque
    try {
      await fs.writeFile(filePath, sqlContent, 'utf8');
      console.log(`💾 Disque: ${filename} écrit (${size} octets)`);
    } catch (fsErr) {
      console.warn(`⚠️ Impossible d'écrire sur disque (normal sur Render): ${fsErr.message}`);
    }

    await logActivity(req, 'database_backup_created', `Sauvegarde ${type} créée: ${filename}`, 'success', {
      filename, type, size, database: dbConfig.database
    });

    res.json({
      success: true,
      filename,
      size,
      type,
      content: sqlContent,
      message: `Sauvegarde ${type} créée avec succès (${(size / 1024).toFixed(1)} KB)`
    });

  } catch (error) {
    console.error('❌ Erreur sauvegarde:', error);
    await logActivity(req, 'database_backup_failed', `Échec sauvegarde: ${error.message}`, 'error', {
      error: error.message, type
    });
    res.status(500).json({
      success: false,
      message: `Erreur lors de la sauvegarde: ${error.message}`
    });
  }
});

/**
 * GET /admin/database/verify/:filename
 */
router.get('/verify/:filename', async (req, res) => {
  const { filename } = req.params;
  try {
    // Vérifier d'abord dans le cache mémoire
    const cached = backupCache.get(filename);
    if (cached) {
      return res.json({
        valid: cached.size > 100,
        size: cached.size,
        source: 'cache',
        checks: { has_content: cached.size > 100 }
      });
    }
    // Puis sur disque
    const filePath = path.join(BACKUP_DIR, filename);
    await fs.access(filePath);
    const stats = await fs.stat(filePath);
    res.json({ valid: stats.size > 100, size: stats.size, source: 'disk', checks: { has_content: stats.size > 100 } });
  } catch {
    res.status(404).json({ valid: false, message: 'Fichier non trouvé' });
  }
});

/**
 * GET /admin/database/backups
 * Lister les sauvegardes (disque + cache mémoire)
 */
router.get('/backups', async (req, res) => {
  await ensureDirectories();
  try {
    const backups = [];

    // Fichiers sur disque
    try {
      const files = (await fs.readdir(BACKUP_DIR)).filter(f => f.endsWith('.sql'));
      for (const filename of files) {
        const fp = path.join(BACKUP_DIR, filename);
        const stats = await fs.stat(fp);
        backups.push({
          filename,
          size: stats.size,
          created_at: stats.mtime,
          type: filename.includes('_full') ? 'full' : 'structure',
          source: 'disk'
        });
      }
    } catch (_) {}

    // Cache mémoire (ajout si absent du disque)
    cleanExpiredCache();
    for (const [filename, cached] of backupCache.entries()) {
      if (!backups.find(b => b.filename === filename)) {
        backups.push({
          filename,
          size: cached.size,
          created_at: new Date(cached.createdAt),
          type: cached.type || 'full',
          source: 'cache'
        });
      }
    }

    backups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ success: true, backups });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur récupération sauvegardes' });
  }
});

/**
 * GET /admin/database/download/:filename
 * Télécharger une sauvegarde (cache d'abord, puis disque)
 */
router.get('/download/:filename', async (req, res) => {
  const { filename } = req.params;
  if (!filename.endsWith('.sql') || filename.includes('..')) {
    return res.status(400).json({ message: 'Nom de fichier invalide' });
  }
  try {
    // 1) Cache mémoire
    const cached = backupCache.get(filename);
    if (cached) {
      await logActivity(req, 'database_backup_downloaded', `Téléchargement (cache): ${filename}`, 'success', { filename, size: cached.size });
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/sql');
      return res.send(cached.sql);
    }
    // 2) Disque
    const filePath = path.join(BACKUP_DIR, filename);
    await fs.access(filePath);
    const stats = await fs.stat(filePath);
    await logActivity(req, 'database_backup_downloaded', `Téléchargement (disque): ${filename}`, 'success', { filename, fileSize: stats.size });
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/sql');
    res.sendFile(filePath);
  } catch {
    res.status(404).json({ message: 'Fichier non trouvé (cache expiré ou serveur redémarré - créez un nouveau backup)' });
  }
});

/**
 * DELETE /admin/database/delete/:filename
 */
router.delete('/delete/:filename', async (req, res) => {
  const { filename } = req.params;
  if (!filename.endsWith('.sql') || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ success: false, message: 'Nom de fichier invalide' });
  }
  try {
    let deleted = false;
    // Supprimer du cache
    if (backupCache.has(filename)) { backupCache.delete(filename); deleted = true; }
    // Supprimer du disque
    const filePath = path.join(BACKUP_DIR, filename);
    try {
      const stats = await fs.stat(filePath);
      await fs.unlink(filePath);
      deleted = true;
      await logActivity(req, 'database_backup_deleted', `Sauvegarde supprimée: ${filename}`, 'success', { filename, fileSize: stats.size });
    } catch (_) {}
    if (!deleted) return res.status(404).json({ success: false, message: 'Sauvegarde non trouvée' });
    res.json({ success: true, message: `Sauvegarde "${filename}" supprimée` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Utilitaire : exécuter un script SQL via Sequelize (ligne par ligne)
const executeSQLScript = async (sqlContent) => {
  const config = getDatabaseConfig();
  // Utiliser mysql2 directement avec multipleStatements:true
  // → évite le split naïf sur ';' qui coupe les valeurs avec des ';' intégrés
  const mysql = require('mysql2/promise');
  const conn = await mysql.createConnection({
    host: config.host || process.env.DB_HOST,
    port: parseInt(config.port || process.env.DB_PORT || 3306),
    user: config.username || process.env.DB_USER,
    password: config.password || process.env.DB_PASSWORD,
    database: config.database || process.env.DB_NAME,
    multipleStatements: true,  // ← clé: exécuter tout le script en une seule fois
    ssl: false
  });

  let executed = 0;
  let errors = [];
  try {
    // Exécuter le script complet en une seule requête → aucun risque de split incorrect
    await conn.query('SET FOREIGN_KEY_CHECKS=0');
    await conn.query(sqlContent);
    await conn.query('SET FOREIGN_KEY_CHECKS=1');
    // Compter le nombre d'instructions pour le reporting
    executed = (sqlContent.match(/;\s*(\n|$)/g) || []).length;
    console.log(`✅ Restauration complète: ~${executed} instructions exécutées`);
  } catch (err) {
    console.error('❌ Erreur exécution SQL:', err.message);
    errors.push(err.message.substring(0, 200));
    // Tenter instruction par instruction en fallback
    console.log('🔄 Fallback: exécution instruction par instruction...');
    await conn.query('SET FOREIGN_KEY_CHECKS=0').catch(() => {});
    const stmts = sqlContent
      .replace(/--[^\n]*/g, '')         // supprimer commentaires ligne
      .replace(/\/\*[\s\S]*?\*\//g, '') // supprimer commentaires bloc
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 5);
    for (const stmt of stmts) {
      try {
        await conn.query(stmt);
        executed++;
      } catch (e) {
        errors.push(e.message.substring(0, 100));
      }
    }
    await conn.query('SET FOREIGN_KEY_CHECKS=1').catch(() => {});
  } finally {
    await conn.end().catch(() => {});
  }
  return { executed, errors: errors.slice(0, 10), total: executed + errors.length };
};

/**
 * POST /admin/database/restore
 * Restaurer depuis sauvegarde locale (cache ou disque)
 */
router.post('/restore', async (req, res) => {
  const { filename } = req.body;
  try {
    let sqlContent = null;
    // 1) Cache mémoire
    const cached = backupCache.get(filename);
    if (cached) sqlContent = cached.sql;
    // 2) Disque
    if (!sqlContent) {
      const filePath = path.join(BACKUP_DIR, filename);
      await fs.access(filePath);
      sqlContent = await fs.readFile(filePath, 'utf8');
    }
    if (!sqlContent) throw new Error('Fichier non trouvé (cache expiré - recréez un backup)');

    console.log(`🔄 Restauration via Sequelize: ${filename}`);
    const result = await executeSQLScript(sqlContent);
    console.log(`✅ Restauration: ${result.executed}/${result.total} instructions exécutées`);

    await logActivity(req, 'database_restored', `BD restaurée depuis: ${filename}`, 'success', { filename, ...result });
    // Recréer admin si absent après restauration
    await ensureAdminUser();
    res.json({
      success: true,
      message: `Base restaurée avec succès: ${result.executed} instructions exécutées`,
      restored_from: filename, ...result
    });
  } catch (error) {
    await logActivity(req, 'database_restore_failed', `Échec restauration: ${error.message}`, 'error', { filename });
    res.status(500).json({ success: false, message: `Erreur restauration: ${error.message}` });
  }
});

/**
 * POST /admin/database/restore/upload
 * Restaurer depuis fichier uploadé
 */
router.post('/restore/upload', upload.single('backup'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Aucun fichier fourni' });
  try {
    const sqlContent = await fs.readFile(req.file.path, 'utf8');
    await fs.unlink(req.file.path).catch(() => {});

    console.log(`🔄 Restauration upload via Sequelize: ${req.file.originalname}`);
    const result = await executeSQLScript(sqlContent);

    await logActivity(req, 'database_restored_upload', `BD restaurée depuis upload: ${req.file.originalname}`, 'success', {
      originalName: req.file.originalname, fileSize: req.file.size, ...result
    });
    // Recréer admin si absent après restauration
    await ensureAdminUser();
    res.json({
      success: true,
      message: `Base restaurée avec succès: ${result.executed} instructions exécutées`,
      restored_from: req.file.originalname, ...result
    });
  } catch (error) {
    if (req.file) await fs.unlink(req.file.path).catch(() => {});
    await logActivity(req, 'database_restore_upload_failed', `Échec restauration upload: ${error.message}`, 'error', { originalName: req.file?.originalname });
    res.status(500).json({ success: false, message: `Erreur restauration: ${error.message}` });
  }
});

/**
 * GET /admin/database/scheduled
 */
router.get('/scheduled', async (req, res) => {
  try {
    await ensureScheduledBackupTable();
    const config = await ScheduledBackup.findOne({ order: [['createdAt', 'DESC']] });
    if (!config) {
      return res.json({
        success: true,
        config: { enabled: false, intervalDays: 7, backupType: 'full', retentionCount: 3, lastRunAt: null, nextRunAt: null }
      });
    }
    res.json({
      success: true,
      config: {
        id: config.id, enabled: config.enabled, intervalDays: config.intervalDays,
        backupType: config.backupType, retentionCount: config.retentionCount,
        lastRunAt: config.lastRunAt, nextRunAt: config.nextRunAt,
        createdAt: config.createdAt, updatedAt: config.updatedAt
      }
    });
  } catch (error) {
    console.error('Erreur récupération config scheduled:', error.message);
    // Retourner config par défaut plutôt qu'un 500
    res.json({
      success: true,
      config: { enabled: false, intervalDays: 7, backupType: 'full', retentionCount: 3, lastRunAt: null, nextRunAt: null },
      warning: 'Table de configuration non disponible, valeurs par défaut utilisées'
    });
  }
});

/**
 * POST /admin/database/scheduled
 */
router.post('/scheduled', async (req, res) => {
  try {
    await ensureScheduledBackupTable();
    const { enabled, intervalDays, backupType, retentionCount } = req.body;
    if (intervalDays && (intervalDays < 1 || intervalDays > 365)) {
      return res.status(400).json({ success: false, message: 'L\'intervalle doit être entre 1 et 365 jours' });
    }
    let config = await ScheduledBackup.findOne({ order: [['createdAt', 'DESC']] });
    const now = new Date();
    const daysInterval = intervalDays || config?.intervalDays || 7;
    const nextRun = new Date(now.getTime() + daysInterval * 24 * 60 * 60 * 1000);
    if (config) {
      await config.update({
        enabled: enabled !== undefined ? enabled : config.enabled,
        intervalDays: intervalDays || config.intervalDays,
        backupType: backupType || config.backupType,
        retentionCount: retentionCount || config.retentionCount,
        nextRunAt: enabled === false ? null : nextRun
      });
    } else {
      config = await ScheduledBackup.create({
        enabled: enabled !== undefined ? enabled : true,
        intervalDays: intervalDays || 7,
        backupType: backupType || 'full',
        retentionCount: retentionCount || 3,
        nextRunAt: enabled !== false ? nextRun : null,
        createdBy: req.user?.id || null
      });
    }
    await logActivity(req, 'scheduled_backup_configured', `Config planifiée: ${enabled ? 'activée' : 'désactivée'}`, 'success', {
      intervalDays: config.intervalDays, backupType: config.backupType, retentionCount: config.retentionCount
    });
    res.json({
      success: true,
      message: 'Configuration enregistrée',
      config: { id: config.id, enabled: config.enabled, intervalDays: config.intervalDays, backupType: config.backupType, retentionCount: config.retentionCount, lastRunAt: config.lastRunAt, nextRunAt: config.nextRunAt }
    });
  } catch (error) {
    console.error('Erreur config scheduled backup:', error);
    res.status(500).json({ success: false, message: `Erreur: ${error.message}` });
  }
});

/**
 * POST /admin/database/cleanup
 * Nettoyer les anciennes sauvegardes manuellement
 */
router.post('/cleanup', async (req, res) => {
  try {
    const { retentionCount } = req.body;
    const count = retentionCount || 3;
    
    const result = await cleanupOldBackups(count);
    
    await logActivity(req, 'backup_cleanup', 
      `Nettoyage sauvegardes: ${result.deleted} supprimées, ${result.kept} conservées`, 
      'success', 
      result
    );
    
    res.json({
      success: true,
      message: `Nettoyage effectué: ${result.deleted} sauvegardes supprimées, ${result.kept} conservées`,
      deleted: result.deleted,
      kept: result.kept
    });
  } catch (error) {
    console.error('Erreur cleanup:', error);
    await logActivity(req, 'backup_cleanup_failed', 
      `Échec nettoyage sauvegardes: ${error.message}`, 
      'error'
    );
    res.status(500).json({
      success: false,
      message: `Erreur lors du nettoyage: ${error.message}`
    });
  }
});

/**
 * POST /admin/database/run-scheduled
 * Exécuter une sauvegarde planifiée manuellement
 */
router.post('/run-scheduled', async (req, res) => {
  try {
    const config = await ScheduledBackup.findOne({
      where: { enabled: true },
      order: [['createdAt', 'DESC']]
    });
    
    if (!config) {
      return res.status(400).json({
        success: false,
        message: 'Aucune configuration de sauvegarde planifiée active'
      });
    }
    
    // Créer la sauvegarde
    const dbConfig = getDatabaseConfig();
    const timestamp = formatDate();
    const filename = `backup_${dbConfig.database}_${timestamp}_${config.backupType}_scheduled.sql`;
    const filePath = path.join(BACKUP_DIR, filename);
    
    await ensureDirectories();
    
    let command;
    if (dbConfig.dialect === 'mysql') {
      const mysqlPath = getMySQLPath();
      const mysqldumpPath = mysqlPath ? path.join(mysqlPath, 'mysqldump.exe') : 'mysqldump';
      
      const args = [
        `-h${dbConfig.host}`,
        `-P${dbConfig.port}`,
        `-u${dbConfig.username}`
      ];
      
      if (dbConfig.password) {
        args.push(`-p${dbConfig.password}`);
      }
      
      if (config.backupType === 'full') {
        args.push('--single-transaction', '--routines', '--triggers');
      } else {
        args.push('--no-data', '--routines');
      }
      
      args.push(dbConfig.database);
      
      await new Promise((resolve, reject) => {
        const mysqldump = spawn(mysqldumpPath, args, {
          stdio: ['ignore', 'pipe', 'pipe']
        });
        
        const writeStream = require('fs').createWriteStream(filePath);
        mysqldump.stdout.pipe(writeStream);
        
        let stderr = '';
        mysqldump.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        mysqldump.on('close', (code) => {
          writeStream.end();
          if (code !== 0) {
            reject(new Error(`mysqldump failed with exit code ${code}: ${stderr}`));
          } else {
            resolve();
          }
        });
        
        mysqldump.on('error', (error) => {
          reject(new Error(`Failed to start mysqldump: ${error.message}`));
        });
      });
    }
    
    const fileSize = await getFileSize(filePath);
    
    if (fileSize === 0) {
      throw new Error('Fichier de sauvegarde vide');
    }
    
    // Nettoyer les anciennes sauvegardes
    await cleanupOldBackups(config.retentionCount);
    
    // Mettre à jour la configuration
    const now = new Date();
    const nextRun = new Date(now.getTime() + config.intervalDays * 24 * 60 * 60 * 1000);
    
    await config.update({
      lastRunAt: now,
      nextRunAt: nextRun
    });
    
    await logActivity(req, 'scheduled_backup_executed', 
      `Sauvegarde planifiée exécutée: ${filename}`, 
      'success', 
      {
        filename,
        fileSize,
        type: config.backupType,
        intervalDays: config.intervalDays
      }
    );
    
    res.json({
      success: true,
      message: 'Sauvegarde planifiée exécutée avec succès',
      filename,
      size: fileSize,
      nextRunAt: nextRun
    });
  } catch (error) {
    console.error('Erreur exécution sauvegarde planifiée:', error);
    await logActivity(req, 'scheduled_backup_failed', 
      `Échec sauvegarde planifiée: ${error.message}`, 
      'error'
    );
    res.status(500).json({
      success: false,
      message: `Erreur lors de l'exécution de la sauvegarde planifiée: ${error.message}`
    });
  }
});

module.exports = router;