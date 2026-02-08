import React from 'react';
import { FiShield, FiLock, FiDatabase, FiEye, FiMapPin, FiCamera, FiPhone, FiMail, FiUser, FiClock, FiAlertTriangle } from 'react-icons/fi';

/**
 * Page Politique de Confidentialité
 * Détaille la collecte, utilisation et protection des données
 */
const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mb-6 shadow-xl">
            <FiShield className="text-white" size={40} />
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-4">
            Politique de Confidentialité
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Security Guard Management System - Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="p-8 md:p-12 space-y-10">
            
            {/* Introduction */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <FiEye className="mr-3 text-blue-600" size={28} />
                Introduction
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Nous accordons une grande importance à la protection de vos données personnelles. Cette politique de confidentialité explique 
                comment nous collectons, utilisons, stockons et protégeons les informations des agents de sécurité, superviseurs et administrateurs 
                utilisant notre système de gestion et de pointage.
              </p>
            </section>

            {/* Données collectées */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <FiDatabase className="mr-3 text-purple-600" size={28} />
                Données Collectées
              </h2>
              
              <div className="space-y-6">
                {/* Données personnelles */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <FiUser className="mr-2 text-blue-600" size={20} />
                    1. Données d'Identification
                  </h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span><strong>Informations personnelles :</strong> Nom, prénom, date de naissance, CIN (Carte d'Identité Nationale)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span><strong>Coordonnées :</strong> Adresse, numéro de téléphone, adresse e-mail, numéro WhatsApp</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span><strong>Documents :</strong> Photo de la CIN, documents justificatifs</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span><strong>Identifiant employé :</strong> Numéro d'employé unique</span>
                    </li>
                  </ul>
                </div>

                {/* Données biométriques */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <FiCamera className="mr-2 text-green-600" size={20} />
                    2. Données Biométriques
                  </h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">•</span>
                      <span><strong>Reconnaissance faciale :</strong> Vecteurs faciaux (descripteurs numériques de 128 ou 512 dimensions) générés à partir de photos de profil</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">•</span>
                      <span><strong>Photos de pointage :</strong> Photos prises lors du check-in et check-out avec timestamp</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">•</span>
                      <span><strong>Score de correspondance :</strong> Pourcentage de ressemblance calculé lors des vérifications faciales</span>
                    </li>
                  </ul>
                  <div className="mt-4 bg-white/60 backdrop-blur rounded-lg p-4">
                    <p className="text-sm text-gray-600">
                      <FiLock className="inline mr-2 text-green-600" size={16} />
                      <strong>Protection :</strong> Les vecteurs faciaux sont cryptés avec AES-256 et stockés de manière sécurisée. 
                      Ils ne peuvent pas être reconvertis en images.
                    </p>
                  </div>
                </div>

                {/* Données de géolocalisation */}
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-6 border border-orange-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <FiMapPin className="mr-2 text-orange-600" size={20} />
                    3. Données de Géolocalisation
                  </h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-orange-600 mr-2">•</span>
                      <span><strong>Position GPS :</strong> Latitude, longitude, précision (en mètres)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-orange-600 mr-2">•</span>
                      <span><strong>Tracking en temps réel :</strong> Positions GPS enregistrées toutes les 30 secondes pendant les événements</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-orange-600 mr-2">•</span>
                      <span><strong>Données de déplacement :</strong> Vitesse, altitude, direction, type de réseau</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-orange-600 mr-2">•</span>
                      <span><strong>Niveau de batterie :</strong> Pourcentage de batterie de l'appareil mobile</span>
                    </li>
                  </ul>
                  <div className="mt-4 bg-white/60 backdrop-blur rounded-lg p-4">
                    <p className="text-sm text-gray-600">
                      <FiClock className="inline mr-2 text-orange-600" size={16} />
                      <strong>Durée :</strong> Les données GPS sont collectées uniquement pendant les événements actifs, 
                      de 2 heures avant le début jusqu'à la fin de l'événement.
                    </p>
                  </div>
                </div>

                {/* Données d'activité */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <FiClock className="mr-2 text-purple-600" size={20} />
                    4. Données d'Activité et de Pointage
                  </h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span><strong>Présences :</strong> Date et heure de check-in et check-out</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span><strong>Statut :</strong> Présent, en retard, absent, excusé</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span><strong>Méthode de pointage :</strong> Facial, QR Code, ou manuel</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span><strong>Affectations :</strong> Événements, zones de patrouille, superviseur assigné</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span><strong>Logs d'activité :</strong> Actions effectuées dans le système (connexion, modifications, etc.)</span>
                    </li>
                  </ul>
                </div>

                {/* Données techniques */}
                <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-2xl p-6 border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <FiPhone className="mr-2 text-gray-600" size={20} />
                    5. Données Techniques
                  </h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-gray-600 mr-2">•</span>
                      <span><strong>Appareil :</strong> Type d'appareil, système d'exploitation, version</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gray-600 mr-2">•</span>
                      <span><strong>Connexion :</strong> Adresse IP, token JWT pour l'authentification</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gray-600 mr-2">•</span>
                      <span><strong>Navigateur :</strong> Type et version du navigateur web</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Utilisation des données */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <FiDatabase className="mr-3 text-indigo-600" size={28} />
                Utilisation des Données
              </h2>
              
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl p-6 border border-indigo-200">
                <p className="text-gray-700 mb-4">
                  Les données collectées sont utilisées exclusivement dans le cadre de la gestion des agents de sécurité :
                </p>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-indigo-600 mr-2 font-bold">✓</span>
                    <span><strong>Authentification :</strong> Vérification de l'identité des agents via reconnaissance faciale</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-600 mr-2 font-bold">✓</span>
                    <span><strong>Pointage :</strong> Enregistrement des présences et heures de travail</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-600 mr-2 font-bold">✓</span>
                    <span><strong>Suivi en temps réel :</strong> Localisation des agents pendant les événements pour leur sécurité</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-600 mr-2 font-bold">✓</span>
                    <span><strong>Gestion des affectations :</strong> Attribution des agents aux zones et événements</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-600 mr-2 font-bold">✓</span>
                    <span><strong>Notifications :</strong> Envoi de messages WhatsApp/SMS pour rappels et alertes</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-600 mr-2 font-bold">✓</span>
                    <span><strong>Rapports :</strong> Génération de statistiques et rapports de présence</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-600 mr-2 font-bold">✓</span>
                    <span><strong>Détection de fraude :</strong> Identification des tentatives de pointage frauduleux (photos, fake GPS)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-600 mr-2 font-bold">✓</span>
                    <span><strong>Amélioration du service :</strong> Analyse des performances et optimisation du système</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* Sécurité des données */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <FiLock className="mr-3 text-red-600" size={28} />
                Sécurité et Protection
              </h2>
              
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-red-50 to-rose-50 rounded-2xl p-6 border border-red-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Mesures de Sécurité</h3>
                  <ul className="space-y-3 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-red-600 mr-2">🔒</span>
                      <span><strong>Cryptage AES-256 :</strong> Tous les vecteurs faciaux sont cryptés avant stockage</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-red-600 mr-2">🔒</span>
                      <span><strong>Hashing bcrypt :</strong> Mots de passe hashés avec 12 rounds de salage</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-red-600 mr-2">🔒</span>
                      <span><strong>Authentification JWT :</strong> Tokens sécurisés avec expiration (7 jours)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-red-600 mr-2">🔒</span>
                      <span><strong>HTTPS/SSL :</strong> Toutes les communications sont chiffrées en transit</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-red-600 mr-2">🔒</span>
                      <span><strong>Rate Limiting :</strong> Protection contre les attaques par force brute</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-red-600 mr-2">🔒</span>
                      <span><strong>Helmet Security Headers :</strong> Protection contre les vulnérabilités web courantes</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-red-600 mr-2">🔒</span>
                      <span><strong>Logs d'audit :</strong> Enregistrement de toutes les actions sensibles</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-red-600 mr-2">🔒</span>
                      <span><strong>Contrôle d'accès :</strong> Système de rôles et permissions (admin, supervisor, agent)</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-6 border border-yellow-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Stockage des Données</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-yellow-600 mr-2">📦</span>
                      <span><strong>Base de données MySQL :</strong> Hébergée sur Railway (infrastructure sécurisée)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-yellow-600 mr-2">📦</span>
                      <span><strong>Backend API :</strong> Déployé sur Render.com avec certificats SSL automatiques</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-yellow-600 mr-2">📦</span>
                      <span><strong>Photos et documents :</strong> Stockés localement sur le serveur avec accès restreint</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-yellow-600 mr-2">📦</span>
                      <span><strong>Sauvegardes :</strong> Backups automatiques de la base de données</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Partage des données */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <FiAlertTriangle className="mr-3 text-amber-600" size={28} />
                Partage et Divulgation
              </h2>
              
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl p-6 border border-amber-200">
                <p className="text-gray-700 mb-4 font-semibold">
                  Nous ne vendons, ne louons ni ne partageons vos données personnelles avec des tiers, sauf dans les cas suivants :
                </p>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-amber-600 mr-2">•</span>
                    <span><strong>Superviseurs et administrateurs :</strong> Accès aux données des agents sous leur responsabilité pour gestion opérationnelle</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-amber-600 mr-2">•</span>
                    <span><strong>Obligations légales :</strong> Si requis par la loi ou par décision de justice</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-amber-600 mr-2">•</span>
                    <span><strong>Services tiers techniques :</strong> Twilio (SMS/WhatsApp), Railway (hébergement base de données), Render (hébergement backend)</span>
                  </li>
                </ul>
                <div className="mt-4 bg-white/60 backdrop-blur rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    <FiShield className="inline mr-2 text-amber-600" size={16} />
                    <strong>Note :</strong> Les services tiers sont sélectionnés pour leur conformité aux normes de sécurité et ne reçoivent que les données strictement nécessaires.
                  </p>
                </div>
              </div>
            </section>

            {/* Droits des utilisateurs */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <FiUser className="mr-3 text-blue-600" size={28} />
                Vos Droits
              </h2>
              
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl p-6 border border-blue-200">
                <p className="text-gray-700 mb-4">
                  En vertu des lois sur la protection des données, vous disposez des droits suivants :
                </p>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2 font-bold">➤</span>
                    <span><strong>Droit d'accès :</strong> Consulter vos données personnelles stockées dans le système</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2 font-bold">➤</span>
                    <span><strong>Droit de rectification :</strong> Demander la correction de données inexactes ou incomplètes</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2 font-bold">➤</span>
                    <span><strong>Droit à l'effacement :</strong> Demander la suppression de vos données (sous réserve d'obligations légales)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2 font-bold">➤</span>
                    <span><strong>Droit d'opposition :</strong> Vous opposer au traitement de certaines données</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2 font-bold">➤</span>
                    <span><strong>Droit à la portabilité :</strong> Recevoir vos données dans un format structuré et lisible</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2 font-bold">➤</span>
                    <span><strong>Droit de limitation :</strong> Demander la limitation du traitement de vos données</span>
                  </li>
                </ul>
                <div className="mt-6 bg-white/60 backdrop-blur rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    <FiMail className="inline mr-2 text-blue-600" size={16} />
                    <strong>Pour exercer vos droits :</strong> Contactez votre administrateur système ou envoyez un e-mail à l'adresse indiquée par votre entreprise.
                  </p>
                </div>
              </div>
            </section>

            {/* Conservation des données */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <FiClock className="mr-3 text-purple-600" size={28} />
                Conservation des Données
              </h2>
              
              <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-2xl p-6 border border-purple-200">
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2">⏱️</span>
                    <span><strong>Données d'identification et biométriques :</strong> Conservées pendant toute la durée de votre emploi + délai légal de conservation des archives RH</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2">⏱️</span>
                    <span><strong>Données de pointage :</strong> Conservées pendant 5 ans (durée légale de conservation des registres de présence)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2">⏱️</span>
                    <span><strong>Données GPS :</strong> Conservées pendant 3 mois après la fin de l'événement</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2">⏱️</span>
                    <span><strong>Logs d'activité :</strong> Conservés pendant 1 an pour des raisons de sécurité et d'audit</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2">⏱️</span>
                    <span><strong>Photos de pointage :</strong> Conservées pendant 6 mois</span>
                  </li>
                </ul>
                <div className="mt-4 bg-white/60 backdrop-blur rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    <FiDatabase className="inline mr-2 text-purple-600" size={16} />
                    À l'expiration de ces délais, les données sont automatiquement archivées ou supprimées conformément aux obligations légales.
                  </p>
                </div>
              </div>
            </section>

            {/* Technologies utilisées */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <FiDatabase className="mr-3 text-teal-600" size={28} />
                Technologies et Services Tiers
              </h2>
              
              <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-2xl p-6 border border-teal-200">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-bold text-gray-900 mb-2">Backend & Base de données</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Node.js + Express.js</li>
                      <li>• MySQL (Railway)</li>
                      <li>• Sequelize ORM</li>
                      <li>• Socket.IO (temps réel)</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-2">Sécurité</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• JWT (jsonwebtoken)</li>
                      <li>• bcrypt (hashing)</li>
                      <li>• crypto-js (AES-256)</li>
                      <li>• Helmet (headers)</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-2">Reconnaissance faciale</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• face-api.js</li>
                      <li>• TensorFlow.js</li>
                      <li>• Modèles TinyFaceDetector</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-2">Notifications</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Twilio (SMS/WhatsApp)</li>
                      <li>• Nodemailer (e-mails)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* Modifications */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <FiAlertTriangle className="mr-3 text-orange-600" size={28} />
                Modifications de cette Politique
              </h2>
              
              <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-2xl p-6 border border-orange-200">
                <p className="text-gray-700">
                  Nous nous réservons le droit de modifier cette politique de confidentialité à tout moment. 
                  Les modifications seront publiées sur cette page avec une date de mise à jour. Nous vous encourageons 
                  à consulter régulièrement cette politique pour rester informé de la manière dont nous protégeons vos données.
                </p>
                <div className="mt-4 bg-white/60 backdrop-blur rounded-lg p-4">
                  <p className="text-sm text-gray-600 font-semibold">
                    En cas de modification substantielle, vous serez informé via notification dans l'application.
                  </p>
                </div>
              </div>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <FiMail className="mr-3 text-green-600" size={28} />
                Contact
              </h2>
              
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
                <p className="text-gray-700 mb-4">
                  Pour toute question concernant cette politique de confidentialité, la protection de vos données 
                  ou pour exercer vos droits, veuillez contacter :
                </p>
                <div className="bg-white/60 backdrop-blur rounded-lg p-6 space-y-2">
                  <p className="text-gray-900 font-semibold">Responsable de la Protection des Données</p>
                  <p className="text-gray-700">Security Guard Management System</p>
                  <p className="text-gray-600 text-sm">
                    📧 E-mail : <span className="font-medium">privacy@security-guard-system.com</span>
                  </p>
                  <p className="text-gray-600 text-sm">
                    🏢 Adresse : Contactez votre administrateur système
                  </p>
                </div>
              </div>
            </section>

          </div>

          {/* Footer */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-8 py-6">
            <p className="text-center text-gray-300 text-sm">
              © {new Date().getFullYear()} Security Guard Management System - Tous droits réservés
            </p>
            <p className="text-center text-gray-400 text-xs mt-2">
              Version 1.0.0 - Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>

        {/* Back button */}
        <div className="text-center mt-8">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            ← Retour
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
