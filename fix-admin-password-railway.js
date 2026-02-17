const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function fixAdminUser() {
  const connection = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net',
    port: 20601,
    user: 'root',
    password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
    database: 'railway'
  });

  console.log('✅ Connecté à Railway MySQL');

  try {
    // Check if admin user exists by email
    const [usersByEmail] = await connection.execute(
      'SELECT id, employee_id, email, first_name, last_name, role, status FROM users WHERE email = ?',
      ['admin@security.com']
    );

    // Check if user exists by employee_id
    const [usersByEmployeeId] = await connection.execute(
      'SELECT id, employee_id, email, first_name, last_name, role, status FROM users WHERE employee_id = ?',
      ['ADMIN001']
    );

    const password = 'Admin123!';
    const hashedPassword = await bcrypt.hash(password, 12);

    if (usersByEmployeeId.length > 0) {
      console.log('✅ User with ADMIN001 found:', usersByEmployeeId[0]);
      
      // Update the user with correct email and password
      await connection.execute(`
        UPDATE users SET 
          email = ?,
          password = ?,
          first_name = ?,
          last_name = ?,
          role = ?,
          status = ?,
          updated_at = NOW()
        WHERE employee_id = ?
      `, [
        'admin@security.com',
        hashedPassword,
        'Administrateur',
        'Principal',
        'admin',
        'active',
        'ADMIN001'
      ]);

      console.log('✅ Admin user updated successfully!');
      console.log('📧 Email: admin@security.com');
      console.log('🔑 Password: Admin123!');
      console.log('🔐 Hash:', hashedPassword);
      
    } else if (usersByEmail.length > 0) {
      console.log('✅ Admin user found by email:', usersByEmail[0]);
      
      // Update password
      await connection.execute(
        'UPDATE users SET password = ?, status = ?, updated_at = NOW() WHERE email = ?',
        [hashedPassword, 'active', 'admin@security.com']
      );

      console.log('✅ Admin password updated successfully!');
      console.log('🔑 New Password: Admin123!');
      
    } else {
      console.log('❌ No admin user found. Creating new one...');
      
      const adminId = generateUUID();
      await connection.execute(`
        INSERT INTO users (
          id, employee_id, first_name, last_name, email, password, 
          role, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        adminId,
        'ADMIN001',
        'Administrateur',
        'Principal',
        'admin@security.com',
        hashedPassword,
        'admin',
        'active'
      ]);

      console.log('✅ Admin user created successfully!');
      console.log('🆔 UUID:', adminId);
    }

    console.log('📧 Email: admin@security.com');
    console.log('🔑 Password: Admin123!');

    // Verify the update
    const [updatedUser] = await connection.execute(
      'SELECT id, employee_id, email, first_name, last_name, role, status, LENGTH(password) as password_length FROM users WHERE email = ?',
      ['admin@security.com']
    );

    console.log('\n✅ Verification:', updatedUser[0]);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

fixAdminUser();
