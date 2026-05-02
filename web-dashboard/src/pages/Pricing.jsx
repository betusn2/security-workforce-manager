import React, { useState } from 'react';
import { FiZap, FiShield, FiCheck, FiStar, FiCreditCard, FiUsers, FiMapPin, FiCamera, FiDatabase, FiBell, FiFileText, FiActivity, FiCalendar } from 'react-icons/fi';
import { toast } from 'react-toastify';

/**
 * Page Tarifs & Abonnements
 * Plans de souscription incluant Copilot Pro
 */
const Pricing = () => {
  const [billingCycle, setBillingCycle] = useState('monthly');

  const plans = [
    {
      id: 'free',
      name: 'Gratuit',
      price: { monthly: 0, yearly: 0 },
      description: 'Idéal pour découvrir la plateforme',
      color: 'from-gray-500 to-gray-600',
      badgeColor: 'bg-gray-100 text-gray-700',
      buttonStyle: 'border-2 border-gray-300 text-gray-700 hover:bg-gray-50',
      features: [
        { icon: FiUsers, text: 'Jusqu\'à 5 agents' },
        { icon: FiCalendar, text: '1 événement actif' },
        { icon: FiMapPin, text: 'Suivi GPS de base' },
        { icon: FiBell, text: 'Notifications email' },
      ],
      notIncluded: [
        'Reconnaissance faciale',
        'Rapports avancés',
        'Assistance prioritaire',
        'Copilot IA',
      ]
    },
    {
      id: 'copilot_pro',
      name: 'Copilot Pro',
      price: { monthly: 10, yearly: 96 },
      description: 'La solution complète pour les équipes professionnelles',
      color: 'from-blue-600 via-purple-600 to-pink-600',
      badgeColor: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white',
      buttonStyle: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg',
      popular: true,
      features: [
        { icon: FiUsers, text: 'Agents illimités' },
        { icon: FiCalendar, text: 'Événements illimités' },
        { icon: FiCamera, text: 'Reconnaissance faciale avancée' },
        { icon: FiMapPin, text: 'Tracking GPS temps réel' },
        { icon: FiActivity, text: 'Tableau de bord enrichi' },
        { icon: FiFileText, text: 'Rapports PDF & Excel' },
        { icon: FiBell, text: 'Notifications SMS & WhatsApp' },
        { icon: FiDatabase, text: 'Sauvegarde automatique' },
        { icon: FiShield, text: 'Sécurité avancée (AES-256)' },
        { icon: FiZap, text: 'Copilot IA intégré' },
      ],
      notIncluded: []
    },
    {
      id: 'enterprise',
      name: 'Entreprise',
      price: { monthly: null, yearly: null },
      description: 'Pour les grandes organisations avec des besoins sur mesure',
      color: 'from-amber-500 to-orange-600',
      badgeColor: 'bg-amber-100 text-amber-700',
      buttonStyle: 'border-2 border-amber-500 text-amber-600 hover:bg-amber-50',
      features: [
        { icon: FiUsers, text: 'Tout de Copilot Pro' },
        { icon: FiShield, text: 'SLA garanti 99,9%' },
        { icon: FiDatabase, text: 'Infrastructure dédiée' },
        { icon: FiZap, text: 'Intégrations sur mesure' },
        { icon: FiActivity, text: 'Support 24/7 dédié' },
      ],
      notIncluded: []
    }
  ];

  const handleSubscribe = (planId) => {
    if (planId === 'free') {
      toast.info('Vous êtes déjà sur le plan Gratuit.');
    } else if (planId === 'copilot_pro') {
      toast.success('Redirection vers le paiement sécurisé — Copilot Pro à 10 $/mois');
    } else {
      toast.info('Contactez notre équipe commerciale pour un devis personnalisé.');
    }
  };

  const getPrice = (plan) => {
    if (plan.price.monthly === null) return 'Sur devis';
    if (plan.price.monthly === 0) return 'Gratuit';
    const price = billingCycle === 'monthly' ? plan.price.monthly : Math.round(plan.price.yearly / 12);
    return `$${price}`;
  };

  const getPeriod = (plan) => {
    if (plan.price.monthly === null || plan.price.monthly === 0) return '';
    return billingCycle === 'monthly' ? '/ mois' : '/ mois (facturé annuellement)';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white py-20 px-4">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-lg rounded-3xl mb-8 shadow-2xl">
            <FiCreditCard size={40} />
          </div>
          <h1 className="text-5xl md:text-6xl font-black mb-6">Tarifs & Abonnements</h1>
          <p className="text-xl text-white/90 max-w-2xl mx-auto mb-10">
            Choisissez le plan adapté à votre organisation. Passez au niveau supérieur avec <strong>Copilot Pro</strong> à seulement <strong>$10/mois</strong>.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center bg-white/20 backdrop-blur-lg rounded-2xl p-1">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2.5 rounded-xl font-semibold transition-all duration-300 ${
                billingCycle === 'monthly' ? 'bg-white text-purple-700 shadow-md' : 'text-white hover:bg-white/10'
              }`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2.5 rounded-xl font-semibold transition-all duration-300 ${
                billingCycle === 'yearly' ? 'bg-white text-purple-700 shadow-md' : 'text-white hover:bg-white/10'
              }`}
            >
              Annuel <span className="text-xs ml-1 opacity-80">(-20%)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Plans */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${
                plan.popular ? 'ring-4 ring-purple-500 ring-offset-4' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0 flex justify-center">
                  <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold px-6 py-1.5 rounded-b-xl shadow-lg flex items-center gap-1.5">
                    <FiStar size={12} />
                    PLUS POPULAIRE
                  </div>
                </div>
              )}

              {/* Header */}
              <div className={`bg-gradient-to-br ${plan.color} p-8 text-white ${plan.popular ? 'pt-10' : ''}`}>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 ${plan.badgeColor}`}>
                  {plan.name}
                </span>
                <div className="mb-2">
                  <span className="text-5xl font-black">{getPrice(plan)}</span>
                  {getPeriod(plan) && (
                    <span className="text-white/80 text-sm ml-2">{getPeriod(plan)}</span>
                  )}
                </div>
                <p className="text-white/80 text-sm">{plan.description}</p>
              </div>

              {/* Features */}
              <div className="p-8 flex flex-col flex-1">
                <ul className="space-y-3 mb-6 flex-1">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-gray-700">
                      <div className={`flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br ${plan.color} flex items-center justify-center text-white`}>
                        <feature.icon size={14} />
                      </div>
                      <span className="text-sm font-medium">{feature.text}</span>
                    </li>
                  ))}
                  {plan.notIncluded.map((item, idx) => (
                    <li key={`no-${idx}`} className="flex items-center gap-3 text-gray-400 line-through">
                      <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                        <FiCheck size={14} />
                      </div>
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.id)}
                  className={`w-full py-3.5 px-6 rounded-2xl font-bold transition-all duration-300 ${plan.buttonStyle}`}
                >
                  {plan.id === 'free' && 'Plan actuel'}
                  {plan.id === 'copilot_pro' && 'Souscrire — $10/mois'}
                  {plan.id === 'enterprise' && 'Nous contacter'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Copilot Pro highlight */}
        <div className="mt-16 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-3xl shadow-2xl overflow-hidden">
          <div className="p-8 md:p-12 text-white">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-shrink-0">
                <div className="w-24 h-24 bg-white/20 backdrop-blur-lg rounded-3xl flex items-center justify-center shadow-xl">
                  <FiZap size={48} />
                </div>
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-3xl font-black mb-3">Copilot Pro — Tout ce dont vous avez besoin</h2>
                <p className="text-white/80 text-lg mb-6">
                  Accédez à la reconnaissance faciale avancée, au suivi GPS temps réel, aux rapports automatisés et à l'assistant IA Copilot — pour seulement <strong className="text-white">$10/mois</strong>.
                </p>
                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                  {['Agents illimités', 'Copilot IA', 'GPS Temps Réel', 'Biométrie', 'Rapports', 'WhatsApp'].map((tag) => (
                    <span key={tag} className="px-4 py-2 bg-white/20 backdrop-blur-lg rounded-xl text-sm font-semibold">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0">
                <button
                  onClick={() => handleSubscribe('copilot_pro')}
                  className="px-10 py-4 bg-white text-purple-700 rounded-2xl font-black text-lg hover:bg-gray-100 transition-all duration-300 shadow-xl hover:shadow-2xl"
                >
                  $10 / mois
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16">
          <h2 className="text-3xl font-black text-gray-900 text-center mb-10">Questions fréquentes</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                q: 'Puis-je annuler à tout moment ?',
                a: 'Oui, vous pouvez annuler votre abonnement à tout moment sans frais de résiliation. L\'accès reste actif jusqu\'à la fin de la période facturée.'
              },
              {
                q: 'Comment fonctionne la facturation ?',
                a: 'La facturation est mensuelle ou annuelle selon votre choix. Vous recevez une facture par email à chaque renouvellement.'
              },
              {
                q: 'Le plan Copilot Pro est-il sécurisé ?',
                a: 'Absolument. Toutes les données sont chiffrées avec AES-256 et les paiements sont traités par des prestataires certifiés PCI-DSS.'
              },
              {
                q: 'Y a-t-il une période d\'essai ?',
                a: 'Le plan Gratuit vous permet de découvrir la plateforme sans engagement. Passez à Copilot Pro à tout moment pour débloquer toutes les fonctionnalités.'
              }
            ].map((item, idx) => (
              <div key={idx} className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="font-bold text-gray-900 mb-2">{item.q}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Back button */}
        <div className="mt-12 text-center">
          <button
            onClick={() => window.history.back()}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg"
          >
            Retour
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gradient-to-r from-gray-900 to-black text-white py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <FiShield size={24} />
            <span className="text-xl font-bold">Security Guard Management System</span>
          </div>
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} Tous droits réservés — Paiements sécurisés SSL
          </p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
