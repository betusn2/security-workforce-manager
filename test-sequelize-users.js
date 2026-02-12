const { User, UserDocument } = require('./backend/src/models');

async function testUsersQuery() {
  console.log('🔍 Test progressif des includes Sequelize...\n');

  try {
    // Test 1: Requête de base sans includes
    console.log('📡 Test 1: Users sans includes');
    const users1 = await User.findAll({
      where: {},
      limit: 5,
      attributes: { exclude: ['password', 'refreshToken', 'facialVector'] }
    });
    console.log(`   ✅ Succès: ${users1.length} utilisateurs trouvés\n`);

    // Test 2: Avec include supervisor
    console.log('📡 Test 2: Users avec include supervisor');
    const users2 = await User.findAll({
      where: {},
      limit: 5,
      attributes: { exclude: ['password', 'refreshToken', 'facialVector'] },
      include: [
        {
          model: User,
          as: 'supervisor',
          attributes: ['id', 'firstName', 'lastName', 'employeeId', 'profilePhoto', 'role']
        }
      ]
    });
    console.log(`   ✅ Succès avec supervisor: ${users2.length} utilisateurs trouvés\n`);

    // Test 3: Avec include creator (potentiellement problématique)
    console.log('📡 Test 3: Users avec include creator');
    const users3 = await User.findAll({
      where: {},
      limit: 5,
      attributes: { exclude: ['password', 'refreshToken', 'facialVector'] },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'firstName', 'lastName', 'employeeId', 'role'],
          required: false
        }
      ]
    });
    console.log(`   ✅ Succès avec creator: ${users3.length} utilisateurs trouvés\n`);

    // Test 4: Avec include documents
    console.log('📡 Test 4: Users avec include documents');
    const users4 = await User.findAll({
      where: {},
      limit: 5,
      attributes: { exclude: ['password', 'refreshToken', 'facialVector'] },
      include: [
        {
          model: UserDocument,
          as: 'documents',
          attributes: ['id', 'documentType', 'customName', 'expiryDate', 'status'],
          required: false
        }
      ]
    });
    console.log(`   ✅ Succès avec documents: ${users4.length} utilisateurs trouvés\n`);

    // Test 5: Tous les includes ensemble (reproduire l'erreur)
    console.log('📡 Test 5: Users avec TOUS les includes (reproduire le problème)');
    const users5 = await User.findAll({
      where: {},
      limit: 5,
      attributes: { exclude: ['password', 'refreshToken', 'facialVector'] },
      include: [
        {
          model: User,
          as: 'supervisor',
          attributes: ['id', 'firstName', 'lastName', 'employeeId', 'profilePhoto', 'role']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'firstName', 'lastName', 'employeeId', 'role'],
          required: false
        },
        {
          model: UserDocument,
          as: 'documents',
          attributes: ['id', 'documentType', 'customName', 'expiryDate', 'status'],
          required: false
        }
      ]
    });
    console.log(`   ✅ Succès avec TOUS les includes: ${users5.length} utilisateurs trouvés`);
    console.log(`   📋 Exemple de données:`, JSON.stringify(users5[0], null, 2));

  } catch (error) {
    console.error('❌ Erreur Sequelize:', error.message);
    console.error('   Stack:', error.stack);
  }

  process.exit(0);
}

testUsersQuery();