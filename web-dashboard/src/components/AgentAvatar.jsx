import React, { useState } from 'react';

const BACKEND_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'https://security-workforce-manager.onrender.com';

/**
 * Composant avatar réutilisable pour les agents.
 * Affiche la photo de profil (base64, URL complète ou chemin /uploads/)
 * avec fallback sur des initiales en dégradé.
 *
 * Props:
 *   photo      - URL, base64 ou chemin /uploads/... de la photo
 *   firstName  - Prénom de l'agent
 *   lastName   - Nom de l'agent
 *   size       - 'xs' | 'sm' | 'md' | 'lg' | 'xl'
 *   className  - Classes CSS supplémentaires
 *   online     - boolean : afficher pastille en ligne (option)
 */

const SIZES = {
  xs: { img: 'w-6 h-6',  text: 'text-xs',  dot: 'w-2 h-2' },
  sm: { img: 'w-8 h-8',  text: 'text-xs',  dot: 'w-2.5 h-2.5' },
  md: { img: 'w-10 h-10', text: 'text-sm', dot: 'w-3 h-3' },
  lg: { img: 'w-14 h-14', text: 'text-base', dot: 'w-3.5 h-3.5' },
  xl: { img: 'w-20 h-20', text: 'text-xl',  dot: 'w-4 h-4' },
};

const getInitials = (firstName, lastName) => {
  const a = firstName?.charAt(0)?.toUpperCase() || '';
  const b = lastName?.charAt(0)?.toUpperCase() || '';
  return (a + b) || '?';
};

const normalizePhotoSrc = (photo) => {
  if (!photo) return null;
  if (photo.startsWith('data:')) return photo;           // base64
  if (photo.startsWith('http://') || photo.startsWith('https://')) return photo; // full URL
  if (photo.startsWith('/')) return `${BACKEND_URL}${photo}`;  // /uploads/... or /api/...
  return photo;
};

const AgentAvatar = ({ photo, firstName, lastName, size = 'md', className = '', online = null }) => {
  const [imgError, setImgError] = useState(false);
  const src = normalizePhotoSrc(photo);
  const s = SIZES[size] || SIZES.md;
  const initials = getInitials(firstName, lastName);

  return (
    <div className={`relative flex-shrink-0 ${s.img} ${className}`}>
      {src && !imgError ? (
        <img
          src={src}
          alt={`${firstName || ''} ${lastName || ''}`}
          className={`${s.img} rounded-full object-cover`}
          onError={() => setImgError(true)}
        />
      ) : (
        <div className={`${s.img} rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold ${s.text}`}>
          {initials}
        </div>
      )}
      {online !== null && (
        <div className={`absolute -bottom-0.5 -right-0.5 ${s.dot} rounded-full border-2 border-white ${online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
      )}
    </div>
  );
};

export default AgentAvatar;
