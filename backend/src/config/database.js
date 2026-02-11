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

module.exports = {
  development: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'security_guard_db',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || (isPostgres ? 5432 : 3306),
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
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME + '_test' || 'security_guard_db_test',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || (isPostgres ? 5432 : 3306),
    dialect: dialect,
    logging: false
  },
  production: {
    use_env_variable: process.env.DATABASE_URL ? 'DATABASE_URL' : null,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || (isPostgres ? 5432 : 3306),
    dialect: dialect,
    logging: console.log, // Enable logging to debug connection issues
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
