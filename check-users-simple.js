const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'nozomi.proxy.rlwy.net',
    port: 23833,
    user: 'root',
    password: 'uRpoqGKauYDRIYymcsApwnBblZJDnykx',
    database: 'railway'
  });

  // Check columns first
  const [cols] = await conn.execute('SHOW COLUMNS FROM users');
  const colNames = cols.map(c => c.Field);
  console.log('Columns:', colNames.filter(c => ['cin','role','status','isActive','firstName','first_name','deletedAt','deleted_at'].includes(c)).join(', '));

  // Get users with safe columns
  const [users] = await conn.execute('SELECT id, cin, role FROM users WHERE deletedAt IS NULL OR deletedAt = "0000-00-00 00:00:00"');
  console.log('Active users:', users.length);
  users.forEach(u => console.log(' -', u.role, '| cin:', u.cin));

  // Also check deleted
  const [all] = await conn.execute('SELECT id, cin, role FROM users');
  console.log('Total users:', all.length);
  all.forEach(u => console.log(' *', u.role, '| cin:', u.cin));

  await conn.end();
}

main().catch(e => {
  // Try with deletedAt as different column name
  console.error('ERR1:', e.message);
  mysql.createConnection({
    host: 'nozomi.proxy.rlwy.net', port: 23833,
    user: 'root', password: 'uRpoqGKauYDRIYymcsApwnBblZJDnykx', database: 'railway'
  }).then(async conn => {
    const [all] = await conn.execute('SELECT id, cin, role FROM users');
    console.log('Users:', all.length);
    all.forEach(u => console.log(u.role, u.cin));
    await conn.end();
  }).catch(e2 => console.error('ERR2:', e2.message));
});
