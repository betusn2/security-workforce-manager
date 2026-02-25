const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');
const { userValidation, validate } = require('../middlewares/validator');
const bcrypt = require('bcryptjs');

// Route pour créer/réinitialiser l'admin - utiliser uniquement lors du premier déploiement
router.get('/setup-admin', async (req, res) => {
  try {
    const { sequelize } = require('../models');
    const { v4: uuidv4 } = require('uuid');

    const id = uuidv4();
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('Admin123!', salt);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // ── 1. Réinitialiser le mot de passe si l'admin existe déjà ───────────
    const [existingRows] = await sequelize.query(
      "SELECT id FROM users WHERE email = 'admin@security.com' AND deleted_at IS NULL LIMIT 1"
    );

    if (existingRows.length > 0) {
      await sequelize.query(
        "UPDATE users SET password = ?, status = 'active', updated_at = ? WHERE email = 'admin@security.com'",
        { replacements: [hashedPassword, now] }
      );
      return res.json({
        success: true,
        message: 'Mot de passe admin réinitialisé!',
        credentials: { email: 'admin@security.com', password: 'Admin123!' }
      });
    }

    // ── 2. Nettoyer d'anciens enregistrements qui bloqueraient unique ──────
    await sequelize.query(
      "DELETE FROM users WHERE (email = 'admin@securityguard.com' OR employee_id = 'ADMIN001') AND role = 'admin'"
    );

    // ── 3. Créer l'admin via SQL brut (contourne les hooks + validations) ──
    await sequelize.query(
      `INSERT INTO users (id, employee_id, first_name, last_name, email, password, phone, role, status, created_at, updated_at)
       VALUES (?, 'ADMIN001', 'Admin', 'System', 'admin@security.com', ?, '+212600000000', 'admin', 'active', ?, ?)`,
      { replacements: [id, hashedPassword, now, now] }
    );

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
