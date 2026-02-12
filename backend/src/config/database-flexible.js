require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'security_guard_db',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: process.env.DB_DIALECT || 'mysql',
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
    port: process.env.DB_PORT || 3306,
    dialect: process.env.DB_DIALECT || 'mysql',
    logging: false
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: process.env.DB_DIALECT || 'postgres',
    logging: false,
    dialectOptions: process.env.DB_DIALECT === 'postgres' ? {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    } : {
      ssl: process.env.DB_SSL !== 'false' ? {
        require: true,
        rejectUnauthorized: false
      } : false,
      connectTimeout: 60000
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 60000,
      idle: 10000,
      evict: 10000,
      handleDisconnects: true
    },
    retry: {
      max: 3,
      timeout: 10000
    }
  }
};
