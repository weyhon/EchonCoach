import React from 'react';

interface NebulaLogoProps {
  size?: number;
  className?: string;
}

/**
 * Nebula logo — abstract sound wave ripple forming an "N" silhouette.
 * Rose-tinted gradient on light backgrounds, clean geometric aesthetic.
 */
export const NebulaLogo: React.FC<NebulaLogoProps> = ({ size = 36, className = '' }) => {
  const id = React.useId().replace(/:/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Main gradient — warm rose to coral */}
        <linearGradient id={`${id}-main`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E8587A" />
          <stop offset="50%" stopColor="#F06292" />
          <stop offset="100%" stopColor="#FF8A65" />
        </linearGradient>

        {/* Subtle inner glow */}
        <radialGradient id={`${id}-glow`} cx="35%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>

        {/* Rounded square clip */}
        <clipPath id={`${id}-clip`}>
          <rect x="4" y="4" width="92" height="92" rx="22" />
        </clipPath>
      </defs>

      {/* Background shape — squircle */}
      <rect x="4" y="4" width="92" height="92" rx="22" fill={`url(#${id}-main)`} />

      {/* Inner glow overlay */}
      <rect x="4" y="4" width="92" height="92" rx="22" fill={`url(#${id}-glow)`} />

      {/* Sound wave ripples — three concentric arcs radiating from center-left */}
      <g clipPath={`url(#${id}-clip)`} opacity="0.18" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round">
        <path d="M 30 50 Q 50 20, 70 50 Q 50 80, 30 50" />
        <path d="M 22 50 Q 50 10, 78 50 Q 50 90, 22 50" />
        <path d="M 14 50 Q 50 0, 86 50 Q 50 100, 14 50" />
      </g>

      {/* "N" lettermark — geometric sans, centered, white */}
      <text
        x="50" y="62"
        fontFamily="'Inter', -apple-system, sans-serif"
        fontSize="42"
        fontWeight="800"
        textAnchor="middle"
        fill="#fff"
        letterSpacing="-0.04em"
      >
        N
      </text>
    </svg>
  );
};
