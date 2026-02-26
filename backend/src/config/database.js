require('dotenv').config();

// Auto-detect dialect from environment or host
const getDialect = () => {
  if (process.env.DB_DIALECT) return process.env.DB_DIALECT;
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres')) return 'postgres';
  if (process.env.DB_HOST && process.env.DB_HOST.includes('postgres')) return 'postgres';
  return 'mysql';
};

const dialect = getDialect();
const isPostgres = dialect === 'postgres';

// Support Railway MySQL variables (MYSQLHOST, MYSQLPORT, etc.)
// Priority: DB_* vars > MYSQL* vars > hardcoded Railway nozomi defaults
const dbUser     = process.env.DB_USER     || process.env.MYSQLUSER          || 'root';
const dbPassword = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD       || process.env.MYSQL_ROOT_PASSWORD || 'uRpoqGKauYDRIYymcsApwnBblZJDnykx';
const dbName     = process.env.DB_NAME     || process.env.MYSQLDATABASE       || process.env.MYSQL_DATABASE      || 'railway';
const dbHost     = process.env.DB_HOST     || process.env.MYSQLHOST           || 'nozomi.proxy.rlwy.net';
const dbPort     = parseInt(process.env.DB_PORT || process.env.MYSQLPORT      || '23833');

module.exports = {
  development: {
    username: dbUser,
    password: dbPassword,
    database: dbName,
    host: dbHost,
    port: dbPort,
    dialect: dialect,
    logging: console.log,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    timezone: '+00:00'
  },
  test: {
    username: dbUser,
    password: dbPassword,
    database: dbName + '_test',
    host: dbHost,
    port: dbPort,
    dialect: dialect,
    logging: false
  },
  production: {
    username: dbUser,
    password: dbPassword,
    database: dbName,
    host: dbHost,
    port: dbPort,
    dialect: dialect,
    logging: console.log, // E nable logging to debug connection issues
    dialectOptions: isPostgres ? {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    } : {
      ssl: {
        require: false,
        rejectUnauthorized: false
      },
      connectTimeout: 60000,
      flags: '+FOUND_ROWS',
      charset: 'utf8mb4',
      timezone: '+00:00'
    },
    pool: {
      max: 3,
      min: 0,
      acquire: 90000,
      idle: 30000,
      evict: 30000,
      handleDisconnects: true
    },
    retry: {
      max: 10,
      timeout: 15000
    }
  }
};
