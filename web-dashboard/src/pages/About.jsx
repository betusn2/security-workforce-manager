import React from 'react';
import { FiShield, FiUsers, FiMapPin, FiCamera, FiClock, FiZap, FiCheckCircle, FiTrendingUp, FiLock, FiSmartphone, FiMonitor, FiDatabase, FiGlobe, FiAward, FiTarget } from 'react-icons/fi';

/**
 * Page À Propos
 * Présentation du système Security Guard Management
 */
const About = () => {
  const features = [
    {
      icon: FiCamera,
      title: 'Reconnaissance Faciale',
      description: 'Pointage biométrique ultra-précis avec vérification faciale en temps réel',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: FiMapPin,
      title: 'Géolocalisation GPS',
      description: 'Suivi en temps réel des agents avec tracking GPS automatique pendant les événements',
      color: 'from-green-500 to-emerald-500'
    },
    {
      icon: FiClock,
      title: 'Gestion Automatisée',
      description: 'Pointage automatique, détection de retards et notifications instantanées',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: FiUsers,
      title: 'Multi-Utilisateurs',
      description: 'Gestion des agents, superviseurs et administrateurs avec contrôle d\'accès par rôle',
      color: 'from-orange-500 to-red-500'
    },
    {
      icon: FiLock,
      title: 'Sécurité Avancée',
      description: 'Cryptage AES-256, authentification JWT, détection de fraude et logs d\'audit',
      color: 'from-red-500 to-rose-500'
    },
    {
      icon: FiZap,
      title: 'Temps Réel',
      description: 'Socket.IO pour notifications instantanées et mise à jour en direct des positions',
      color: 'from-yellow-500 to-amber-500'
    }
  ];

  const stats = [
    { icon: FiUsers, label: 'Agents Gérés', value: '1000+', color: 'text-blue-600' },
    { icon: FiCheckCircle, label: 'Pointages/Jour', value: '5000+', color: 'text-green-600' },
    { icon: FiMapPin, label: 'Événements/Mois', value: '500+', color: 'text-purple-600' },
    { icon: FiTrendingUp, label: 'Précision Faciale', value: '98%', color: 'text-orange-600' }
  ];

  const techStack = [
    {
      category: 'Frontend',
      icon: FiMonitor,
      color: 'from-blue-500 to-indigo-500',
      technologies: [
        { name: 'React 18', description: 'Interface utilisateur moderne et réactive' },
        { name: 'Tailwind CSS', description: 'Design responsive et mobile-first' },
        { name: 'Socket.IO Client', description: 'Communication temps réel' },
        { name: 'face-api.js', description: 'Reconnaissance faciale dans le navigateur' },
        { name: 'Leaflet Maps', description: 'Cartes interactives et géolocalisation' },
        { name: 'Chart.js', description: 'Graphiques et visualisations' }
      ]
    },
    {
      category: 'Backend',
      icon: FiDatabase,
      color: 'from-green-500 to-teal-500',
      technologies: [
        { name: 'Node.js + Express', description: 'API REST performante et scalable' },
        { name: 'MySQL + Sequelize', description: 'Base de données relationnelle' },
        { name: 'Socket.IO', description: 'WebSocket pour temps réel' },
        { name: 'JWT + bcrypt', description: 'Authentification sécurisée' },
        { name: 'Twilio', description: 'Notifications SMS et WhatsApp' },
        { name: 'Sharp + Multer', description: 'Traitement d\'images optimisé' }
      ]
    },
    {
      category: 'Mobile',
      icon: FiSmartphone,
      color: 'from-purple-500 to-pink-500',
      technologies: [
        { name: 'React Native', description: 'Application mobile native' },
        { name: 'Expo', description: 'Développement et déploiement rapide' },
        { name: 'Geolocation API', description: 'Tracking GPS haute précision' },
        { name: 'Camera API', description: 'Capture photo pour reconnaissance faciale' },
        { name: 'Push Notifications', description: 'Alertes en temps réel' }
      ]
    },
    {
      category: 'Infrastructure',
      icon: FiGlobe,
      color: 'from-orange-500 to-red-500',
      technologies: [
        { name: 'Render.com', description: 'Hébergement backend avec auto-deploy' },
        { name: 'Railway', description: 'Base de données MySQL managée' },
        { name: 'GitHub Actions', description: 'CI/CD automatisé' },
        { name: 'SSL/HTTPS', description: 'Sécurisation des communications' }
      ]
    }
  ];

  const useCases = [
    {
      icon: FiTarget,
      title: 'Événements Sportifs',
      description: 'Gestion de la sécurité pour stades, matchs et compétitions avec suivi GPS en direct',
      benefits: ['Affectation par zones', 'Tracking en temps réel', 'Alertes SOS']
    },
    {
      icon: FiShield,
      title: 'Sites Industriels',
      description: 'Contrôle d\'accès biométrique et pointage automatisé pour grandes installations',
      benefits: ['Pointage facial', 'Rapports de présence', 'Historique détaillé']
    },
    {
      icon: FiUsers,
      title: 'Événements Culturels',
      description: 'Coordination d\'équipes de sécurité pour concerts, festivals et manifestations',
      benefits: ['Multi-superviseurs', 'Notifications WhatsApp', 'Dashboard temps réel']
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white py-20 px-4">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 backdrop-blur-lg rounded-3xl mb-8 shadow-2xl">
            <FiShield size={48} />
          </div>
          <h1 className="text-5xl md:text-6xl font-black mb-6">
            Security Guard Management System
          </h1>
          <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto mb-8">
            Solution complète de gestion et pointage des agents de sécurité avec reconnaissance faciale et géolocalisation en temps réel
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <div className="px-6 py-3 bg-white/20 backdrop-blur-lg rounded-2xl">
              <span className="text-sm uppercase tracking-wider font-bold">Biométrie Avancée</span>
            </div>
            <div className="px-6 py-3 bg-white/20 backdrop-blur-lg rounded-2xl">
              <span className="text-sm uppercase tracking-wider font-bold">Temps Réel</span>
            </div>
            <div className="px-6 py-3 bg-white/20 backdrop-blur-lg rounded-2xl">
              <span className="text-sm uppercase tracking-wider font-bold">Sécurisé</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="max-w-6xl mx-auto px-4 -mt-12 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <div key={index} className="bg-white rounded-2xl shadow-xl p-6 text-center transform hover:scale-105 transition-all duration-300">
              <stat.icon className={`mx-auto mb-3 ${stat.color}`} size={32} />
              <p className="text-3xl font-black text-gray-900 mb-1">{stat.value}</p>
              <p className="text-sm text-gray-600 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-16 space-y-20">
        
        {/* À Propos */}
        <section>
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black text-gray-900 mb-4">À Propos du Système</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Une plateforme innovante qui révolutionne la gestion des agents de sécurité grâce à l'intelligence artificielle et l'automatisation
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12">
            <div className="prose prose-lg max-w-none">
              <p className="text-gray-700 leading-relaxed mb-6">
                Le <strong>Security Guard Management System</strong> est né d'un constat simple : la gestion traditionnelle des équipes de sécurité 
                est chronophage, sujette aux erreurs et manque de traçabilité. Notre solution apporte une réponse technologique complète à ces défis.
              </p>
              
              <div className="grid md:grid-cols-2 gap-8 my-8">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                    <FiTarget className="mr-3 text-blue-600" size={24} />
                    Notre Mission
                  </h3>
                  <p className="text-gray-700">
                    Simplifier et sécuriser la gestion des agents de sécurité grâce à des technologies de pointe : 
                    reconnaissance faciale, géolocalisation GPS, notifications automatiques et tableaux de bord intelligents.
                  </p>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-200">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                    <FiAward className="mr-3 text-purple-600" size={24} />
                    Notre Vision
                  </h3>
                  <p className="text-gray-700">
                    Devenir la référence en matière de gestion intelligente de la sécurité, en combinant innovation technologique, 
                    simplicité d'utilisation et respect absolu de la vie privée.
                  </p>
                </div>
              </div>

              <p className="text-gray-700 leading-relaxed">
                Développé avec les dernières technologies web et mobiles, le système offre une <strong>expérience fluide sur tous les appareils</strong> : 
                ordinateurs, tablettes et smartphones (Android et iOS). Que vous soyez administrateur, superviseur ou agent, 
                chaque interface est optimisée pour votre rôle et vos besoins spécifiques.
              </p>
            </div>
          </div>
        </section>

        {/* Fonctionnalités Principales */}
        <section>
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black text-gray-900 mb-4">Fonctionnalités Principales</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Une suite complète d'outils pour une gestion efficace et sécurisée
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden transform hover:-translate-y-2">
                <div className={`h-2 bg-gradient-to-r ${feature.color}`}></div>
                <div className="p-6">
                  <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} mb-4 text-white shadow-lg`}>
                    <feature.icon size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Stack Technologique */}
        <section>
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black text-gray-900 mb-4">Technologies Utilisées</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Un écosystème moderne et performant pour une fiabilité maximale
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {techStack.map((stack, index) => (
              <div key={index} className="bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className={`bg-gradient-to-r ${stack.color} p-6 text-white`}>
                  <div className="flex items-center gap-4">
                    <div className="bg-white/20 backdrop-blur-lg rounded-xl p-3">
                      <stack.icon size={32} />
                    </div>
                    <h3 className="text-2xl font-bold">{stack.category}</h3>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  {stack.technologies.map((tech, techIndex) => (
                    <div key={techIndex} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${stack.color} mt-2 flex-shrink-0`}></div>
                      <div>
                        <p className="font-bold text-gray-900">{tech.name}</p>
                        <p className="text-sm text-gray-600">{tech.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Cas d'Usage */}
        <section>
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black text-gray-900 mb-4">Cas d'Usage</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Adapté à tous types d'événements et de sites nécessitant une sécurité professionnelle
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {useCases.map((useCase, index) => (
              <div key={index} className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 text-white">
                  <useCase.icon className="mb-4" size={40} />
                  <h3 className="text-xl font-bold mb-2">{useCase.title}</h3>
                  <p className="text-gray-300 text-sm">{useCase.description}</p>
                </div>
                <div className="p-6">
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Avantages clés</p>
                  <ul className="space-y-2">
                    {useCase.benefits.map((benefit, benefitIndex) => (
                      <li key={benefitIndex} className="flex items-center gap-2 text-gray-700">
                        <FiCheckCircle className="text-green-600 flex-shrink-0" size={18} />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Workflow */}
        <section>
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black text-gray-900 mb-4">Comment ça marche ?</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Un processus simple et fluide de l'inscription au rapport final
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12">
            <div className="grid md:grid-cols-5 gap-6">
              {[
                { step: '1', title: 'Inscription Agent', desc: 'Enregistrement avec photo faciale et CIN', icon: FiUser, color: 'from-blue-500 to-cyan-500' },
                { step: '2', title: 'Affectation', desc: 'Attribution aux zones et événements', icon: FiMapPin, color: 'from-green-500 to-emerald-500' },
                { step: '3', title: 'Pointage Facial', desc: 'Check-in automatique avec reconnaissance', icon: FiCamera, color: 'from-purple-500 to-pink-500' },
                { step: '4', title: 'Tracking GPS', desc: 'Suivi en temps réel pendant l\'événement', icon: FiMapPin, color: 'from-orange-500 to-red-500' },
                { step: '5', title: 'Rapport', desc: 'Statistiques et exports PDF/Excel', icon: FiCheckCircle, color: 'from-teal-500 to-cyan-500' }
              ].map((item, index) => (
                <div key={index} className="relative">
                  <div className="text-center">
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${item.color} text-white font-black text-xl mb-4 shadow-lg`}>
                      {item.step}
                    </div>
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} text-white mb-3 -mt-2`}>
                      <item.icon size={24} />
                    </div>
                    <h4 className="font-bold text-gray-900 mb-2">{item.title}</h4>
                    <p className="text-sm text-gray-600">{item.desc}</p>
                  </div>
                  {index < 4 && (
                    <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-gray-300 to-gray-200 -z-10"></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sécurité et Confidentialité */}
        <section>
          <div className="bg-gradient-to-r from-red-600 to-pink-600 rounded-3xl shadow-2xl overflow-hidden text-white">
            <div className="p-8 md:p-12">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-4">
                  <FiLock size={40} />
                </div>
                <div>
                  <h2 className="text-3xl font-black mb-2">Sécurité & Confidentialité</h2>
                  <p className="text-white/80">Protection maximale de vos données</p>
                </div>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
                  <h4 className="font-bold text-lg mb-3">🔐 Cryptage AES-256</h4>
                  <p className="text-white/80 text-sm">
                    Tous les vecteurs faciaux sont cryptés avec l'algorithme AES-256, standard militaire
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
                  <h4 className="font-bold text-lg mb-3">🛡️ Conformité RGPD</h4>
                  <p className="text-white/80 text-sm">
                    Respect des réglementations sur la protection des données personnelles et biométriques
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
                  <h4 className="font-bold text-lg mb-3">📋 Logs d'Audit</h4>
                  <p className="text-white/80 text-sm">
                    Traçabilité complète de toutes les actions sensibles dans le système
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Version et Contact */}
        <section>
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl shadow-2xl p-8 md:p-12 text-white text-center">
            <h2 className="text-3xl font-black mb-6">Informations Système</h2>
            <div className="grid md:grid-cols-3 gap-8 mb-8">
              <div>
                <p className="text-gray-400 text-sm mb-2">Version</p>
                <p className="text-2xl font-bold">1.0.0</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-2">Dernière mise à jour</p>
                <p className="text-2xl font-bold">{new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-2">Type de licence</p>
                <p className="text-2xl font-bold">Propriétaire</p>
              </div>
            </div>
            
            <div className="border-t border-white/20 pt-8">
              <p className="text-gray-300 mb-4">
                Pour plus d'informations, contactez votre administrateur système
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <button
                  onClick={() => window.location.href = '/privacy'}
                  className="px-6 py-3 bg-white/20 backdrop-blur-lg rounded-xl hover:bg-white/30 transition-all duration-300 font-semibold"
                >
                  Politique de Confidentialité
                </button>
                <button
                  onClick={() => window.history.back()}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 font-semibold shadow-lg"
                >
                  Retour
                </button>
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* Footer */}
      <div className="bg-gradient-to-r from-gray-900 to-black text-white py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <FiShield size={24} />
            <span className="text-xl font-bold">Security Guard Management System</span>
          </div>
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} Tous droits réservés - Développé avec ❤️ pour la sécurité professionnelle
          </p>
        </div>
      </div>
    </div>
  );
};

export default About;
