import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCalendar, FiClock, FiAlertCircle, FiLogOut, FiRefreshCw } from 'react-icons/fi';

/**
 * Page affichée quand un agent/responsable n'a aucun événement actif ou à venir
 * L'utilisateur est bloqué au niveau du login et redirigé ici
 */
const NoActiveEvents = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Nettoyer les tokens
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('checkInToken');
    localStorage.removeItem('checkInUser');
    localStorage.removeItem('token');

    // Rediriger vers login
    navigate('/login');
  };

  const handleRetry = () => {
    // Recharger la page de login pour réessayer
    navigate('/login');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      </div>

      {/* Content Card */}
      <div className="relative z-10 max-w-2xl w-full">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
          {/* Header avec icône */}
          <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 border-b border-white/10 p-8 text-center">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center shadow-2xl shadow-orange-500/30 animate-pulse mb-4">
              <FiCalendar className="text-white" size={48} />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              Aucun événement actif
            </h1>
            <p className="text-white/70 text-lg">
              Vous n'avez pas d'événement en cours ou à venir
            </p>
          </div>

          {/* Message principal */}
          <div className="p-8 space-y-6">
            {/* Explication */}
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <FiAlertCircle className="text-blue-400" size={24} />
                </div>
                <div className="flex-1">
                  <h2 className="text-white font-semibold text-xl mb-3">
                    Pourquoi suis-je bloqué ?
                  </h2>
                  <p className="text-white/70 text-sm md:text-base leading-relaxed mb-4">
                    L'accès à la page de pointage est réservé aux agents et responsables ayant au moins un événement actif ou planifié.
                  </p>
                  <p className="text-white/70 text-sm md:text-base leading-relaxed">
                    Actuellement, tous vos événements assignés sont soit:
                  </p>
                  <ul className="mt-3 space-y-2 text-white/60 text-sm md:text-base">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-white/40 rounded-full"></div>
                      <span>Terminés (plus de 2h après la fin)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-white/40 rounded-full"></div>
                      <span>Annulés par un administrateur</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-white/40 rounded-full"></div>
                      <span>Clos manuellement</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl p-6 border border-green-500/20">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <FiClock className="text-green-400" size={24} />
                </div>
                <div className="flex-1">
                  <h2 className="text-white font-semibold text-xl mb-3">
                    Que faire maintenant ?
                  </h2>
                  <div className="space-y-3 text-white/70 text-sm md:text-base">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-green-500/20 rounded-full text-green-400 font-bold text-xs flex-shrink-0 mt-0.5">
                        1
                      </span>
                      <p>
                        <strong className="text-white">Contactez votre superviseur</strong> pour qu'il vous assigne à un nouvel événement
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-green-500/20 rounded-full text-green-400 font-bold text-xs flex-shrink-0 mt-0.5">
                        2
                      </span>
                      <p>
                        <strong className="text-white">Attendez qu'un nouvel événement soit créé</strong> et qu'on vous y affecte
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-green-500/20 rounded-full text-green-400 font-bold text-xs flex-shrink-0 mt-0.5">
                        3
                      </span>
                      <p>
                        Une fois assigné, <strong className="text-white">reconnectez-vous</strong> pour accéder au pointage
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Info supplémentaire */}
            <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20">
              <p className="text-white/60 text-xs md:text-sm text-center">
                💡 <strong className="text-white">Astuce:</strong> Un événement devient accessible 2h avant son heure de début (checkInTime) et reste accessible jusqu'à 2h après sa fin.
              </p>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <button
                onClick={handleRetry}
                className="group relative overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-300 hover:shadow-xl hover:scale-105 flex items-center justify-center gap-3"
              >
                <FiRefreshCw className="text-xl" />
                <span>Réessayer</span>
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </button>

              <button
                onClick={handleLogout}
                className="bg-white/10 hover:bg-white/20 text-white font-semibold py-4 px-6 rounded-xl border border-white/20 transition-all hover:shadow-lg flex items-center justify-center gap-3"
              >
                <FiLogOut className="text-xl" />
                <span>Se déconnecter</span>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-white/5 border-t border-white/10 p-4 text-center">
            <p className="text-white/40 text-xs">
              © {new Date().getFullYear()} SGM – Security Guard | Système de gestion
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoActiveEvents;
