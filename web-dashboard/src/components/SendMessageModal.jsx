/**
 * 💬 SEND MESSAGE MODAL
 * Permet à un admin/superviseur d'envoyer un popup/alerte
 * directement depuis le dashboard vers les mobiles des agents.
 *
 * Props :
 *   target      — { type: 'agent', agentId, agentName } | { type: 'event', eventId, eventName }
 *   socketRef   — ref vers le socket.io client
 *   senderName  — nom de l'expéditeur
 *   onClose     — callback fermeture
 */

import React, { useState, useRef, useEffect } from 'react';
import { FiX, FiSend, FiBell, FiAlertTriangle, FiInfo, FiMessageSquare, FiRadio } from 'react-icons/fi';
import { toast } from 'react-toastify';

const PRIORITY_OPTIONS = [
  {
    value: 'normal',
    label: 'Normal',
    description: 'Message standard',
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    activeBg: 'bg-blue-600',
    icon: FiMessageSquare,
  },
  {
    value: 'high',
    label: 'Haute',
    description: 'Requiert attention',
    color: 'text-orange-600',
    bg: 'bg-orange-50 border-orange-200',
    activeBg: 'bg-orange-500',
    icon: FiBell,
  },
  {
    value: 'urgent',
    label: 'Urgente',
    description: 'Vibration + alerte maximale',
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
    activeBg: 'bg-red-600',
    icon: FiAlertTriangle,
  },
];

const MAX_CHARS = 500;

export default function SendMessageModal({ target, socketRef, senderName, onClose }) {
  const [title, setTitle]       = useState('');
  const [message, setMessage]   = useState('');
  const [priority, setPriority] = useState('normal');
  const [sending, setSending]   = useState(false);
  const msgRef = useRef(null);

  useEffect(() => {
    msgRef.current?.focus();
  }, []);

  const selectedPriority = PRIORITY_OPTIONS.find(p => p.value === priority);
  const isEvent = target?.type === 'event';

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed) {
      toast.warning('Saisissez un message avant d\'envoyer');
      return;
    }
    if (!socketRef?.current?.connected) {
      toast.error('Socket.IO non connecté — impossible d\'envoyer');
      return;
    }

    setSending(true);

    try {
      if (isEvent) {
        socketRef.current.emit('admin:send_event_popup', {
          eventId:    target.eventId,
          title:      title.trim() || (priority === 'urgent' ? '🚨 Alerte urgente' : '📢 Message diffusé'),
          message:    trimmed,
          priority,
          senderName: senderName || 'Responsable',
        });
        toast.success(`📢 Message diffusé à tous les agents de l'événement`);
      } else {
        socketRef.current.emit('admin:send_popup', {
          recipientId: target.agentId,
          title:       title.trim() || (priority === 'urgent' ? '🚨 Alerte urgente' : '💬 Message du responsable'),
          message:     trimmed,
          priority,
          senderName:  senderName || 'Responsable',
        });
        toast.success(`✅ Message envoyé à ${target.agentName}`);
      }
    } catch (err) {
      toast.error('Erreur lors de l\'envoi');
      console.error(err);
    } finally {
      setSending(false);
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSend();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between ${
          priority === 'urgent' ? 'bg-red-600' :
          priority === 'high'   ? 'bg-orange-500' :
                                  'bg-blue-600'
        }`}>
          <div className="flex items-center gap-3 text-white">
            {isEvent
              ? <FiRadio size={22} />
              : <FiMessageSquare size={22} />
            }
            <div>
              <p className="font-bold text-base leading-tight">
                {isEvent ? 'Diffusion — tous les agents' : `Message à ${target?.agentName}`}
              </p>
              <p className="text-xs opacity-80">
                {isEvent
                  ? `Événement : ${target?.eventName}`
                  : 'Popup temps réel sur mobile'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white opacity-70 hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-white/20"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Titre (optionnel) */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Titre <span className="text-gray-400 normal-case font-normal">(optionnel)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ex: Consigne de sécurité"
              maxLength={80}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              ref={msgRef}
              value={message}
              onChange={e => setMessage(e.target.value.slice(0, MAX_CHARS))}
              onKeyDown={handleKeyDown}
              placeholder="Saisissez votre message..."
              rows={4}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex justify-end mt-1">
              <span className={`text-xs ${message.length > MAX_CHARS * 0.9 ? 'text-orange-500' : 'text-gray-400'}`}>
                {message.length}/{MAX_CHARS}
              </span>
            </div>
          </div>

          {/* Priorité */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Priorité
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PRIORITY_OPTIONS.map(opt => {
                const Icon = opt.icon;
                const isSelected = priority === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setPriority(opt.value)}
                    className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 transition-all ${
                      isSelected
                        ? `${opt.activeBg} border-transparent text-white shadow-md`
                        : `${opt.bg} border hover:shadow-sm`
                    }`}
                  >
                    <Icon size={18} className={isSelected ? 'text-white' : opt.color} />
                    <span className={`text-xs font-bold ${isSelected ? 'text-white' : opt.color}`}>
                      {opt.label}
                    </span>
                    <span className={`text-xs leading-tight text-center ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                      {opt.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Aperçu */}
          {message.trim() && (
            <div className={`rounded-xl border-l-4 p-3 text-sm ${
              priority === 'urgent' ? 'bg-red-50 border-red-500 text-red-800' :
              priority === 'high'   ? 'bg-orange-50 border-orange-500 text-orange-800' :
                                      'bg-blue-50 border-blue-500 text-blue-800'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <FiInfo size={13} />
                <span className="font-semibold text-xs uppercase tracking-wide">Aperçu mobile</span>
              </div>
              <p className="font-semibold">{title.trim() || (priority === 'urgent' ? '🚨 Alerte urgente' : '💬 Message du responsable')}</p>
              <p className="mt-0.5 opacity-90">{message.trim()}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <span>Ctrl+Entrée pour envoyer</span>
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              className={`px-5 py-2 rounded-xl text-sm font-bold text-white flex items-center gap-2 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                priority === 'urgent' ? 'bg-red-600 hover:bg-red-700' :
                priority === 'high'   ? 'bg-orange-500 hover:bg-orange-600' :
                                        'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <FiSend size={15} />
              {sending ? 'Envoi...' : (isEvent ? 'Diffuser' : 'Envoyer')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
