const bcrypt = require('bcryptjs');
const CryptoJS = require('crypto-js');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    employeeId: {
      type: DataTypes.STRING(20),
      unique: 'unique_employeeId',
      allowNull: false
    },
    cin: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Carte d\'Identité Nationale - utilisé pour login agents/superviseurs',
      index: true
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(255),
      unique: 'unique_email',
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Téléphone principal'
    },
    whatsappNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Numéro WhatsApp/secondaire - peut être partagé'
    },
    role: {
      type: DataTypes.ENUM('agent', 'supervisor', 'admin', 'user'),
      defaultValue: 'agent',
      allowNull: false
    },
    profilePhoto: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      comment: 'Photo de profil base64 - LONGTEXT pour images haute résolution'
    },
    facialVector: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      comment: 'Encrypted facial recognition vector - LONGTEXT'
    },
    facialDescriptor: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      comment: 'Facial descriptor JSON array for face-api.js recognition - LONGTEXT'
    },
    facialVectorUpdatedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    hireDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'suspended'),
      defaultValue: 'active'
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notificationPreferences: {
      type: DataTypes.JSON,
      allowNull: true
    },
    refreshToken: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Informations physiques pour gardiennage
    height: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Taille en cm'
    },
    weight: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Poids en kg'
    },
    // Informations professionnelles
    diploma: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Diplôme/Certification'
    },
    diplomaLevel: {
      type: DataTypes.ENUM('cap', 'bac', 'bac+2', 'bac+3', 'bac+5', 'autre'),
      allowNull: true
    },
    securityCard: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Numéro carte professionnelle'
    },
    securityCardExpiry: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    experienceYears: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Années d\'expérience'
    },
    specializations: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Spécialisations: incendie, secourisme, cynophile, etc.'
    },
    languages: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Langues parlées'
    },
    // Localisation en temps réel
    currentLatitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true
    },
    currentLongitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true
    },
    lastLocationUpdate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // Système de notation
    rating: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0,
      comment: 'Note moyenne sur 5'
    },
    totalRatings: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    punctualityScore: {
      type: DataTypes.INTEGER,
      defaultValue: 100,
      comment: 'Score de ponctualité sur 100'
    },
    reliabilityScore: {
      type: DataTypes.INTEGER,
      defaultValue: 100,
      comment: 'Score de fiabilité sur 100'
    },
    professionalismScore: {
      type: DataTypes.INTEGER,
      defaultValue: 100,
      comment: 'Score de professionnalisme sur 100'
    },
    overallScore: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Score global calculé'
    },
    // Contact d'urgence
    emergencyContact: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    emergencyPhone: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    // Documents
    idCardNumber: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    socialSecurityNumber: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    bankDetails: {
      type: DataTypes.JSON,
      allowNull: true
    },
    // Relation superviseur-agent
    supervisorId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID du responsable/superviseur de cet agent'
    },
    // Appareils autorisés pour le pointage
    authorizedDevices: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Liste des appareils autorisés [{fingerprint, name, addedAt}]'
    },
    // Dernière position de pointage
    lastCheckInLocation: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: '{latitude, longitude, accuracy, timestamp}'
    },
    // V2 - Champs pour systeme intelligent
    createdByType: {
      type: DataTypes.ENUM('admin', 'supervisor', 'self_registration'),
      defaultValue: 'admin',
      comment: 'Qui a cree cet utilisateur'
    },
    createdByUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID de l\'utilisateur qui a cree ce compte'
    },
    isTemporary: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Agent temporaire en attente de validation'
    },
    validatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Admin qui a valide cet agent'
    },
    validatedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    lastLivenessCheck: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Derniere verification liveness reussie'
    },
    fraudScore: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Score de risque fraude (plus eleve = plus suspect)'
    },
    deviceFingerprints: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Empreintes des appareils utilises'
    }
  }, {
    tableName: 'users',
    timestamps: true,
    paranoid: true, // Soft deletes
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(12);
          user.password = await bcrypt.hash(user.password, salt);
        }
        // Facial vector encryption - only encrypt if it's a plain array
        if (user.facialVector && typeof user.facialVector !== 'string') {
          const encryptionKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
          if (encryptionKey) {
            try {
              user.facialVector = CryptoJS.AES.encrypt(
                JSON.stringify(user.facialVector),
                encryptionKey
              ).toString();
            } catch (error) {
              console.error('❌ Erreur chiffrement facial vector (beforeCreate):', error);
              user.facialVector = JSON.stringify(user.facialVector);
            }
          } else {
            console.warn('⚠️ ENCRYPTION_KEY non définie - Stockage facialVector non chiffré');
            user.facialVector = JSON.stringify(user.facialVector);
          }
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(12);
          user.password = await bcrypt.hash(user.password, salt);
        }
        // Facial vector encryption - check if plain array or different encrypted string
        if (user.changed('facialVector')) {
          if (typeof user.facialVector !== 'string' || !user.facialVector.startsWith('U2Fsd')) {
            // Need to encrypt
            const encryptionKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
            if (encryptionKey) {
              try {
                user.facialVector = CryptoJS.AES.encrypt(
                  JSON.stringify(user.facialVector),
                  encryptionKey
                ).toString();
              } catch (error) {
                console.error('❌ Erreur chiffrement facial vector (beforeUpdate):', error);
                user.facialVector = JSON.stringify(user.facialVector);
              }
            } else {
              console.warn('⚠️ ENCRYPTION_KEY non définie - Stockage facialVector non chiffré');
              user.facialVector = JSON.stringify(user.facialVector);
            }
          }
          // Else: already encrypted string, keep as is
        }
      }
    }
  });

  // Instance Methods
  User.prototype.validatePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
  };

  User.prototype.toJSON = function() {
    const values = { ...this.get() };
    delete values.password;
    delete values.refreshToken;
    delete values.facialVector;
    return values;
  };

  // Encrypt facial vector before saving
  User.prototype.setEncryptedFacialVector = function(vector) {
    const encryptionKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
    
    // Vérifier que la clé existe
    if (!encryptionKey) {
      console.warn('⚠️ ENCRYPTION_KEY/JWT_SECRET non définie - Stockage du vecteur non chiffré');
      this.facialVector = JSON.stringify(vector);
      this.facialVectorUpdatedAt = new Date();
      return;
    }
    
    // Check if already encrypted
    if (typeof vector === "string" && vector.startsWith("U2Fsd")) {
      // Already encrypted, just set it
      this.facialVector = vector;
    } else {
      // Plain array, encrypt it
      try {
        this.facialVector = CryptoJS.AES.encrypt(
          JSON.stringify(vector),
          encryptionKey
        ).toString();
      } catch (error) {
        console.error('❌ Erreur chiffrement vecteur facial:', error);
        // Fallback: stocker sans chiffrement
        this.facialVector = JSON.stringify(vector);
      }
    }
    this.facialVectorUpdatedAt = new Date();
  };

  // Decrypt facial vector
  User.prototype.getDecryptedFacialVector = function() {
    if (!this.facialVector) return null;
    
    const encryptionKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
    
    // Si pas de clé, essayer de parser en JSON (non chiffré)
    if (!encryptionKey) {
      try {
        return JSON.parse(this.facialVector);
      } catch (error) {
        console.error('❌ Erreur parsing vecteur facial:', error);
        return null;
      }
    }
    
    // Essayer de déchiffrer
    try {
      const bytes = CryptoJS.AES.decrypt(this.facialVector, encryptionKey);
      return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch (error) {
      // Fallback: essayer de parser en JSON (non chiffré)
      try {
        return JSON.parse(this.facialVector);
      } catch (parseError) {
        console.error('❌ Erreur déchiffrement vecteur facial:', error);
        return null;
      }
    }
  };

  // Calculer le score global
  User.prototype.calculateOverallScore = function() {
    let score = 0;
    let factors = 0;

    // Score de ponctualité (30%)
    score += (this.punctualityScore || 0) * 0.30;
    factors += 30;

    // Score de fiabilité (25%)
    score += (this.reliabilityScore || 0) * 0.25;
    factors += 25;

    // Score de professionnalisme (20%)
    score += (this.professionalismScore || 0) * 0.20;
    factors += 20;

    // Expérience (10%) - max 10 ans = 100%
    const expScore = Math.min((this.experienceYears || 0) * 10, 100);
    score += expScore * 0.10;
    factors += 10;

    // Diplôme (10%)
    const diplomaScores = { 'cap': 40, 'bac': 60, 'bac+2': 75, 'bac+3': 85, 'bac+5': 100, 'autre': 50 };
    score += (diplomaScores[this.diplomaLevel] || 0) * 0.10;
    factors += 10;

    // Condition physique (5%) - IMC idéal entre 20-25
    if (this.height && this.weight) {
      const heightM = this.height / 100;
      const bmi = this.weight / (heightM * heightM);
      let physicalScore = 100;
      if (bmi < 18.5 || bmi > 30) physicalScore = 60;
      else if (bmi < 20 || bmi > 27) physicalScore = 80;
      score += physicalScore * 0.05;
    }
    factors += 5;

    return Math.round(score);
  };

  // Mettre à jour la localisation
  User.prototype.updateLocation = async function(latitude, longitude) {
    this.currentLatitude = latitude;
    this.currentLongitude = longitude;
    this.lastLocationUpdate = new Date();
    await this.save();
  };

  return User;
};
