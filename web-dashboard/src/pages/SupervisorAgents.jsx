import React, { useState, useEffect } from 'react';
import { FiUsers, FiPhone, FiMail, FiMapPin, FiCalendar, FiClock, FiCheck, FiX, FiLoader, FiUserCheck, FiAlertCircle, FiRefreshCw, FiEye } from 'react-icons/fi';
import { toast } from 'react-toastify';
import AgentAvatar from '../components/AgentAvatar';

const SupervisorAgents = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Fetch agents created by supervisor
  const fetchAgents = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/supervisor/agents', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setAgents(data.agents || []);
      } else {
        setError(data.message || 'Erreur lors du chargement des agents');
        toast.error(data.message);
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
      setError('Erreur réseau. Veuillez réessayer.');
      toast.error('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  // View agent details
  const viewAgentDetails = async (agentId) => {
    try {
      const response = await fetch(`/api/supervisor/agents/${agentId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setSelectedAgent(data.agent);
        setShowDetailModal(true);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error('Error fetching agent details:', error);
      toast.error('Erreur lors du chargement des détails');
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status badge
  const getStatusBadge = (agent) => {
    if (agent.isActive) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-semibold">
          <FiCheck size={14} />
          Actif
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-500/20 text-gray-400 rounded-full text-xs font-semibold">
          <FiX size={14} />
          Inactif
        </span>
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <FiLoader className="mx-auto text-white animate-spin mb-4" size={48} />
          <p className="text-white text-lg">Chargement des agents...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-red-500/20 border border-red-500/50 rounded-2xl p-8 max-w-md w-full text-center">
          <FiAlertCircle className="mx-auto text-red-400 mb-4" size={48} />
          <h2 className="text-white text-xl font-bold mb-2">Erreur</h2>
          <p className="text-red-300 mb-4">{error}</p>
          <button
            onClick={fetchAgents}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors flex items-center gap-2 mx-auto"
          >
            <FiRefreshCw size={20} />
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 p-4 md:p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30">
                <FiUsers className="text-white" size={32} />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                  Mes Agents Recrutés
                </h1>
                <p className="text-white/70">
                  Agents créés sur le terrain
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-primary-500/20 border border-primary-500/50 rounded-xl px-4 py-2">
                <p className="text-primary-300 text-sm font-medium">Total</p>
                <p className="text-white text-2xl font-bold">{agents.length}</p>
              </div>
              <button
                onClick={fetchAgents}
                className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center text-white transition-colors"
                title="Actualiser"
              >
                <FiRefreshCw size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Agents List */}
      <div className="max-w-7xl mx-auto">
        {agents.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 border border-white/10 text-center">
            <FiUsers className="mx-auto text-white/30 mb-4" size={64} />
            <h3 className="text-white text-xl font-bold mb-2">
              Aucun agent créé
            </h3>
            <p className="text-white/60 mb-6">
              Les agents que vous créez sur le terrain apparaîtront ici
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/10 hover:bg-white/15 transition-all group"
              >
                {/* Agent Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <AgentAvatar
                      photo={agent.profilePhoto}
                      firstName={agent.firstName}
                      lastName={agent.lastName}
                      size="lg"
                      className="rounded-xl border-2 border-white/20"
                    />
                    <div>
                      <h3 className="text-white font-bold text-lg">
                        {agent.firstName} {agent.lastName}
                      </h3>
                      <p className="text-white/60 text-sm">Agent de sécurité</p>
                    </div>
                  </div>
                  {getStatusBadge(agent)}
                </div>

                {/* Agent Info */}
                <div className="space-y-2 mb-4">
                  {agent.phone && (
                    <div className="flex items-center gap-2 text-white/80 text-sm">
                      <FiPhone size={16} className="text-primary-400" />
                      <span>{agent.phone}</span>
                    </div>
                  )}
                  {agent.email && (
                    <div className="flex items-center gap-2 text-white/80 text-sm">
                      <FiMail size={16} className="text-primary-400" />
                      <span className="truncate">{agent.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-white/60 text-xs">
                    <FiCalendar size={14} className="text-white/40" />
                    <span>Créé le {formatDate(agent.createdAt)}</span>
                  </div>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => viewAgentDetails(agent.id)}
                  className="w-full py-2.5 bg-primary-500/20 hover:bg-primary-500/30 border border-primary-500/50 text-primary-300 hover:text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <FiEye size={18} />
                  Voir détails
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agent Detail Modal */}
      {showDetailModal && selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/10">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-primary-600 to-primary-700 p-6 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-4">
                <AgentAvatar
                  photo={selectedAgent.profilePhoto}
                  firstName={selectedAgent.firstName}
                  lastName={selectedAgent.lastName}
                  size="xl"
                  className="rounded-xl border-2 border-white/30"
                />
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {selectedAgent.firstName} {selectedAgent.lastName}
                  </h2>
                  <p className="text-white/70">Détails de l'agent</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <FiX size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-white/70">Statut</span>
                {getStatusBadge(selectedAgent)}
              </div>

              {/* Contact Info */}
              <div className="bg-white/5 rounded-xl p-4 space-y-3">
                <h3 className="text-white font-semibold text-lg mb-3">Informations de contact</h3>
                {selectedAgent.phone && (
                  <div className="flex items-center gap-3">
                    <FiPhone className="text-primary-400" size={20} />
                    <div>
                      <p className="text-white/60 text-xs">Téléphone</p>
                      <p className="text-white font-medium">{selectedAgent.phone}</p>
                    </div>
                  </div>
                )}
                {selectedAgent.email && (
                  <div className="flex items-center gap-3">
                    <FiMail className="text-primary-400" size={20} />
                    <div>
                      <p className="text-white/60 text-xs">Email</p>
                      <p className="text-white font-medium">{selectedAgent.email}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Address Info */}
              {(selectedAgent.adresse || selectedAgent.ville) && (
                <div className="bg-white/5 rounded-xl p-4 space-y-3">
                  <h3 className="text-white font-semibold text-lg mb-3">Adresse</h3>
                  <div className="flex items-start gap-3">
                    <FiMapPin className="text-primary-400 flex-shrink-0 mt-1" size={20} />
                    <div>
                      {selectedAgent.adresse && (
                        <p className="text-white font-medium">{selectedAgent.adresse}</p>
                      )}
                      {selectedAgent.ville && (
                        <p className="text-white/60 text-sm">{selectedAgent.ville} {selectedAgent.codePostal}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* CIN Photo - Remove if not available */}
              {selectedAgent.cinPhoto && (
                <div className="bg-white/5 rounded-xl p-4">
                  <h3 className="text-white font-semibold text-lg mb-3">Photo CIN</h3>
                  <img
                    src={`/uploads/cin/${selectedAgent.cinPhoto}`}
                    alt="CIN"
                    className="w-full rounded-lg border border-white/20"
                  />
                </div>
              )}

              {/* Dates */}
              <div className="bg-white/5 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">Créé le</span>
                  <span className="text-white font-medium">{formatDate(selectedAgent.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">Dernière mise à jour</span>
                  <span className="text-white font-medium">{formatDate(selectedAgent.updatedAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupervisorAgents;
