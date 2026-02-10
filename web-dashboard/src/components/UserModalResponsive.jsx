import React, { useState, useEffect, useRef } from 'react';
import {
  FiX, FiCheck, FiArrowLeft, FiArrowRight, FiUser, FiBriefcase,
  FiActivity, FiFileText, FiLock, FiCamera, FiCreditCard,
  FiMail, FiPhone, FiMapPin, FiCalendar, FiShield, FiAlertCircle,
  FiCheckCircle, FiInfo, FiUpload
} from 'react-icons/fi';
import { toast } from 'react-toastify';

// 🎨 Composant Step Indicator moderne
const StepIndicator = ({ steps, currentStep, completedSteps }) => (
  <div className="relative px-4 sm:px-6">
    {/* Progress bar */}
    <div className="absolute top-5 left-0 right-0 h-1 bg-white/20">
      <div
        className="h-full bg-gradient-to-r from-white to-green-300 transition-all duration-500"
        style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
      />
    </div>

    {/* Steps */}
    <div className="relative flex justify-between">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.has(index);
        const isCurrent = index === currentStep;
        const isPast = index < currentStep;

        return (
          <div key={step.id} className="flex flex-col items-center">
            {/* Circle */}
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
              transition-all duration-300 shadow-lg z-10
              ${isCompleted ? 'bg-green-400 text-green-900 scale-110' :
                isCurrent ? 'bg-white text-primary-600 ring-4 ring-white/30 scale-110' :
                isPast ? 'bg-white/60 text-primary-700' :
                'bg-white/20 text-white/60'}
            `}>
              {isCompleted ? <FiCheck size={18} /> : 
               isPast ? <FiCheck size={18} className="opacity-50" /> :
               <step.icon size={16} />}
            </div>

            {/* Label - caché sur mobile */}
            <span className={`
              hidden sm:block text-xs mt-2 font-medium transition-all
              ${isCurrent ? 'text-white' : 'text-white/60'}
            `}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  </div>
);

// 🎨 Composant InputField réutilisable
const InputField = ({ label, icon: Icon, error, success, required, helpText, children, ...props }) => (
  <div className="space-y-1.5">
    <label className="flex items-center text-sm font-medium text-gray-700">
      {Icon && <Icon size={14} className="mr-1.5 text-primary-600" />}
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    
    <div className="relative">
      {children || (
        <input
          {...props}
          className={`
            w-full px-3 py-2.5 sm:px-4 sm:py-3 border rounded-xl
            focus:ring-2 focus:ring-primary-500 focus:border-transparent
            transition-all text-sm sm:text-base
            ${error ? 'border-red-500 bg-red-50' :
              success ? 'border-green-500 bg-green-50' :
              'border-gray-300 bg-white hover:border-gray-400'}
          `}
        />
      )}
      
      {/* Validation icons */}
      {(error || success) && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {error && <FiAlertCircle className="text-red-500" size={18} />}
          {success && <FiCheckCircle className="text-green-500" size={18} />}
        </div>
      )}
    </div>

    {/* Help text or error */}
    {(helpText || error) && (
      <p className={`text-xs flex items-center gap-1 ${error ? 'text-red-600' : 'text-gray-500'}`}>
        {error ? <FiAlertCircle size={12} /> : <FiInfo size={12} />}
        {error || helpText}
      </p>
    )}
  </div>
);

// 📱 Modal Principal Responsive
const UserModalResponsive = ({ isOpen, onClose, user, onSave, supervisors = [] }) => {
  // États du formulaire
  const [formData, setFormData] = useState({
    // Basic
    cin: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    whatsappNumber: '',
    role: 'agent',
    supervisorId: '',
    
    // Professional
    hireDate: '',
    diploma: '',
    securityCard: '',
    securityCardExpiry: '',
    specializations: [],
    
    // Physical
    height: '',
    weight: '',
    dateOfBirth: '',
    address: '',
    
    // Documents
    documents: [],
    
    // Permissions
    permissions: [],
    
    // Facial
    facialPhoto: null,
    facialDescriptor: null
  });

  // États de navigation
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [validationErrors, setValidationErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Définition des étapes
  const steps = [
    {
      id: 'basic',
      label: 'Informations',
      icon: FiUser,
      required: true,
      description: 'Informations de base'
    },
    {
      id: 'professional',
      label: 'Professionnel',
      icon: FiBriefcase,
      required: false,
      description: 'Qualifications et expérience'
    },
    {
      id: 'physical',
      label: 'Physique',
      icon: FiActivity,
      required: false,
      description: 'Caractéristiques physiques'
    },
    {
      id: 'documents',
      label: 'Documents',
      icon: FiFileText,
      required: false,
      description: 'Pièces justificatives'
    },
    {
      id: 'permissions',
      label: 'Permissions',
      icon: FiLock,
      required: false,
      description: 'Droits d\'accès'
    }
  ];

  // Ajouter étape reconnaissance si agent/supervisor
  const allSteps = ['agent', 'supervisor'].includes(formData.role)
    ? [...steps, {
        id: 'facial',
        label: 'Reconnaissance',
        icon: FiCamera,
        required: true,
        description: 'Capture du visage'
      }]
    : steps;

  // Initialiser avec user existant
  useEffect(() => {
    if (user) {
      setFormData(prev => ({ ...prev, ...user }));
    }
  }, [user]);

  // Validation par étape
  const validateStep = (stepId) => {
    const errors = {};

    switch (stepId) {
      case 'basic':
        if (!formData.firstName?.trim()) errors.firstName = 'Prénom requis';
        if (!formData.lastName?.trim()) errors.lastName = 'Nom requis';
        if (!formData.email?.trim()) errors.email = 'Email requis';
        if (!formData.cin?.trim() && formData.role !== 'admin') errors.cin = 'CIN requis';
        if (formData.role === 'agent' && !formData.supervisorId) errors.supervisorId = 'Responsable requis';
        break;

      case 'facial':
        if (!formData.facialDescriptor) errors.facial = 'Capture du visage requise';
        break;

      default:
        break;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Navigation
  const handleNext = () => {
    if (!validateStep(allSteps[currentStep].id)) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }

    setCompletedSteps(prev => new Set([...prev, currentStep]));
    
    if (currentStep < allSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateStep(allSteps[currentStep].id)) {
      toast.error('Veuillez corriger les erreurs');
      return;
    }

    setLoading(true);
    try {
      await onSave(formData);
      toast.success(user ? 'Utilisateur modifié' : 'Utilisateur créé');
      onClose();
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4">
      {/* Modal Container - fullscreen mobile, centered desktop */}
      <div className="bg-white w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[90vh] sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        
        {/* Header avec gradient */}
        <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-white">
          {/* Top bar */}
          <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-bold">
                {user ? 'Modifier' : 'Nouvel'} utilisateur
              </h2>
              <p className="text-primary-100 text-xs sm:text-sm mt-0.5">
                {formData.role === 'agent' ? '👮 Agent' :
                 formData.role === 'supervisor' ? '👨‍💼 Responsable' :
                 '👑 Administrateur'}
                {formData.firstName && ` • ${formData.firstName} ${formData.lastName}`}
              </p>
            </div>
            
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <FiX size={24} />
            </button>
          </div>

          {/* Step Indicator */}
          <div className="pb-6">
            <StepIndicator
              steps={allSteps}
              currentStep={currentStep}
              completedSteps={completedSteps}
            />
          </div>
        </div>

        {/* Mobile step info */}
        <div className="sm:hidden bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {allSteps[currentStep].label}
              </p>
              <p className="text-xs text-gray-600">
                {allSteps[currentStep].description}
              </p>
            </div>
            <span className="text-xs font-medium text-primary-600 bg-primary-50 px-3 py-1 rounded-full">
              {currentStep + 1}/{allSteps.length}
            </span>
          </div>
        </div>

        {/* Form Content - scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            
            {/* ÉTAPE 1 : Informations de base */}
            {currentStep === 0 && (
              <div className="space-y-4">
                {/* Header de section - caché sur mobile */}
                <div className="hidden sm:block mb-6">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <FiUser className="text-primary-600" />
                    Informations de base
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Les informations essentielles de l'utilisateur
                  </p>
                </div>

                {/* Grid responsive */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="Prénom"
                    icon={FiUser}
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    error={validationErrors.firstName}
                    placeholder="Mohamed"
                  />

                  <InputField
                    label="Nom"
                    icon={FiUser}
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    error={validationErrors.lastName}
                    placeholder="El Amrani"
                  />
                </div>

                <InputField
                  label="Email"
                  icon={FiMail}
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  error={validationErrors.email}
                  placeholder="mohamed@example.com"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="CIN"
                    icon={FiCreditCard}
                    required={formData.role !== 'admin'}
                    value={formData.cin}
                    onChange={(e) => setFormData({ ...formData, cin: e.target.value.toUpperCase() })}
                    error={validationErrors.cin}
                    helpText="Le mot de passe sera le CIN"
                    placeholder="AB123456"
                  />

                  <InputField
                    label="Téléphone"
                    icon={FiPhone}
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+212 600 000 000"
                  />
                </div>

                <InputField
                  label="Rôle"
                  icon={FiShield}
                  required
                >
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="agent">👮 Agent de sécurité</option>
                    <option value="supervisor">👨‍💼 Responsable</option>
                    <option value="admin">👑 Administrateur</option>
                  </select>
                </InputField>

                {formData.role === 'agent' && (
                  <InputField
                    label="Responsable"
                    icon={FiShield}
                    required
                    error={validationErrors.supervisorId}
                  >
                    <select
                      value={formData.supervisorId}
                      onChange={(e) => setFormData({ ...formData, supervisorId: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Sélectionner un responsable</option>
                      {supervisors.map(sup => (
                        <option key={sup.id} value={sup.id}>
                          {sup.firstName} {sup.lastName} ({sup.employeeId})
                        </option>
                      ))}
                    </select>
                  </InputField>
                )}
              </div>
            )}

            {/* ÉTAPE 2 : Professionnel */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="hidden sm:block mb-6">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <FiBriefcase className="text-primary-600" />
                    Informations professionnelles
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Qualifications et expérience
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="Date d'embauche"
                    icon={FiCalendar}
                    type="date"
                    value={formData.hireDate}
                    onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                  />

                  <InputField
                    label="Diplôme"
                    icon={FiFileText}
                    value={formData.diploma}
                    onChange={(e) => setFormData({ ...formData, diploma: e.target.value })}
                    placeholder="Baccalauréat, Licence..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="Carte de sécurité"
                    icon={FiCreditCard}
                    value={formData.securityCard}
                    onChange={(e) => setFormData({ ...formData, securityCard: e.target.value })}
                    placeholder="Numéro de carte"
                  />

                  <InputField
                    label="Expiration"
                    icon={FiCalendar}
                    type="date"
                    value={formData.securityCardExpiry}
                    onChange={(e) => setFormData({ ...formData, securityCardExpiry: e.target.value })}
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <FiInfo className="text-blue-600 mt-1" size={20} />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Informations optionnelles</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Ces informations peuvent être complétées plus tard
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ÉTAPE 3 : Physique */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="hidden sm:block mb-6">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <FiActivity className="text-primary-600" />
                    Caractéristiques physiques
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <InputField
                    label="Taille (cm)"
                    icon={FiActivity}
                    type="number"
                    value={formData.height}
                    onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                    placeholder="175"
                  />

                  <InputField
                    label="Poids (kg)"
                    icon={FiActivity}
                    type="number"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    placeholder="70"
                  />

                  <InputField
                    label="Date de naissance"
                    icon={FiCalendar}
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  />
                </div>

                <InputField
                  label="Adresse"
                  icon={FiMapPin}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="123 Rue Mohammed V, Casablanca"
                />
              </div>
            )}

            {/* ÉTAPE 4 : Documents */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="hidden sm:block mb-6">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <FiFileText className="text-primary-600" />
                    Pièces justificatives
                  </h3>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary-400 hover:bg-primary-50/50 transition-all cursor-pointer">
                  <FiUpload className="mx-auto text-gray-400 mb-3" size={48} />
                  <p className="text-sm text-gray-600 mb-2">
                    Glissez vos documents ici ou cliquez pour parcourir
                  </p>
                  <p className="text-xs text-gray-500">
                    PDF, JPG, PNG jusqu'à 10 MB
                  </p>
                </div>
              </div>
            )}

            {/* ÉTAPE 5 : Permissions */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="hidden sm:block mb-6">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <FiLock className="text-primary-600" />
                    Droits d'accès
                  </h3>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <FiInfo className="text-yellow-600 mt-1" size={20} />
                    <div>
                      <p className="text-sm font-medium text-yellow-900">Permissions par défaut</p>
                      <p className="text-xs text-yellow-700 mt-1">
                        Les permissions sont automatiquement attribuées selon le rôle
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ÉTAPE 6 : Reconnaissance faciale */}
            {currentStep === 5 && ['agent', 'supervisor'].includes(formData.role) && (
              <div className="space-y-4">
                <div className="hidden sm:block mb-6">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <FiCamera className="text-primary-600" />
                    Reconnaissance faciale
                  </h3>
                </div>

                <div className="border-2 border-dashed border-primary-300 rounded-xl p-8 text-center bg-gradient-to-br from-primary-50 to-white">
                  <FiCamera className="mx-auto text-primary-600 mb-3" size={64} />
                  <p className="text-sm text-gray-900 font-medium mb-2">
                    Capture du visage requise
                  </p>
                  <p className="text-xs text-gray-600 mb-4">
                    Positionnez votre visage face à la caméra
                  </p>
                  
                  <button
                    type="button"
                    className="px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <FiCamera size={18} />
                      Activer la caméra
                    </div>
                  </button>
                </div>

                {validationErrors.facial && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <FiAlertCircle className="text-red-600 mt-1" size={20} />
                      <div>
                        <p className="text-sm font-medium text-red-900">Capture requise</p>
                        <p className="text-xs text-red-700 mt-1">
                          Vous devez capturer votre visage pour continuer
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </form>

        {/* Footer avec navigation */}
        <div className="border-t bg-gray-50 px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            {/* Previous Button */}
            <button
              type="button"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="px-4 sm:px-6 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2 text-sm sm:text-base"
            >
              <FiArrowLeft size={18} />
              <span className="hidden sm:inline">Précédent</span>
              <span className="sm:hidden">Préc.</span>
            </button>

            {/* Progress indicator mobile */}
            <div className="flex-1 text-center sm:hidden">
              <p className="text-xs text-gray-600">
                {currentStep + 1} / {allSteps.length}
              </p>
            </div>

            {/* Next/Submit Button */}
            {currentStep < allSteps.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-medium hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg shadow-primary-500/30 flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <span>Suivant</span>
                <FiArrowRight size={18} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-medium hover:from-green-700 hover:to-green-800 transition-all shadow-lg shadow-green-500/30 flex items-center justify-center gap-2 disabled:opacity-50 text-sm sm:text-base"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <>
                    <FiCheck size={18} />
                    <span>Enregistrer</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserModalResponsive;
