import React from 'react';

/**
 * Premium glass‑morphism card component.
 * Props:
 *   - children: content inside the card
 *   - className: optional additional Tailwind classes
 */
export default function Card({ children, className = '' }) {
  return (
    <div
      className={`rounded-xl bg-surface dark:bg-surface-dark backdrop-blur-md p-6 shadow-lg transition-transform hover:scale-105 ${className}`}
    >
      {children}
    </div>
  );
}
