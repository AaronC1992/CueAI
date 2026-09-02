'use client';

/**
 * Back affordance for full screen sections. The engine wires clicks via the
 * `data-nav-back` attribute, so this stays a plain markup component.
 */
export default function SectionBackButton({ label = 'Back' }) {
  return (
    <button type="button" className="section-back-btn" data-nav-back aria-label={label}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      <span>{label}</span>
    </button>
  );
}
