const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');
const { userValidation, validate } = require('../middlewares/validator');
const bcrypt = require('bcryptjs');

// Route pour créer/réinitialiser l'admin - utiliser uniquement lors du premier déploiement
router.get('/setup-admin', async (req, res) => {
  try {
    const { User } = require('../models');

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('Admin123!', salt);

    // Supprimer tous les anciens admins (évite les conflits de contraintes unique)
    await User.destroy({
      where: { role: 'admin' },
      force: true
    });

    // Créer l'admin avec les bonnes credentials
    await User.create({
      employeeId: 'ADMIN001',
      firstName: 'Admin',
      lastName: 'System',
      cin: null,
      email: 'admin@security.com',
      password: hashedPassword,
      phone: '+212600000000',
      role: 'admin',
      status: 'active'
    }, { hooks: false });

    res.json({
      success: true,
      message: 'Admin créé avec succès!',
      credentials: { email: 'admin@security.com', password: 'Admin123!' }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Public routes
router.post('/register', userValidation.create, validate, authController.register);
router.post('/login', userValidation.login, validate, authController.login);
router.post('/refresh-token', authController.refreshToken);

// Routes Login par CIN (Agents & Responsables - pour pointage)
router.post('/login-cin', authController.loginByCin);
router.post('/verify-cin', authController.verifyCin);

// Routes pour le pointage (accessible avec JWT token)
// Cette route est utilisée immédiatement après login-cin/login
router.get('/facial-vector-checkin', authenticate, authController.getFacialVectorForCheckIn);

// Protected routes (nécessitent JWT)
router.use(authenticate);
router.post('/logout', authController.logout);
router.get('/profile', authController.getProfile);
router.put('/profile', authController.updateProfile);
router.put('/change-password', authController.changePassword);
router.get('/facial-vector', authController.getFacialVectorForCheckIn); // GET pour récupérer
router.put('/facial-vector', authController.updateFacialVector); // PUT pour mettre à jour

// Gestion des appareils autorisés
router.get('/devices', authController.getAuthorizedDevices);
router.get('/devices/:userId', authController.getAuthorizedDevices);
router.post('/devices/add', authController.addAuthorizedDevice);
router.post('/devices/remove', authController.removeAuthorizedDevice);
router.post('/devices/check', authController.checkDeviceAuthorization);

module.exports = router;
