const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'nozomi.proxy.rlwy.net',
    port: 23833,
    user: 'root',
    password: 'uRpoqGKauYDRIYymcsApwnBblZJDnykx',
    database: 'railway'
  });

  // Check CIN lookup exactly as Sequelize would (camelCase deletedAt)
  try {
    const [r1] = await conn.execute("SELECT id, cin, role FROM users WHERE cin = 'A303730' AND deletedAt IS NULL");
    console.log('camelCase deletedAt:', r1.length, 'users');
  } catch(e) {
    console.log('camelCase deletedAt FAILED:', e.message);
  }

  // With snake_case
  try {
    const [r2] = await conn.execute("SELECT id, cin, role FROM users WHERE cin = 'A303730' AND deleted_at IS NULL");
    console.log('snake_case deleted_at:', r2.length, 'users', r2[0] ? r2[0].role : '');
  } catch(e) {
    console.log('snake_case deleted_at FAILED:', e.message);
  }

  // Raw - does the user exist at ALL?
  const [r3] = await conn.execute("SELECT id, cin, role, deleted_at FROM users WHERE cin = 'A303730'");
  console.log('Raw (no filter):', r3.length, 'users');
  r3.forEach(u => console.log('  user:', u.cin, u.role, 'deleted_at:', u.deleted_at));

  // Check isActive column name
  try {
    const [r4] = await conn.execute("SELECT isActive FROM users LIMIT 1");
    console.log('isActive column exists:', r4[0]);
  } catch(e) {
    console.log('isActive column MISSING:', e.message);
    const [r4b] = await conn.execute("SELECT is_active FROM users LIMIT 1");
    console.log('is_active column value:', r4b[0]);
  }

  await conn.end();
}

main().catch(e => console.error('FATAL:', e.message));
