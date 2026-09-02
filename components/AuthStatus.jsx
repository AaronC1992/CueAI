'use client';

import { useState } from 'react';

export default function AuthStatus({ user }) {
  const [busy, setBusy] = useState(false);
  const accountName = user?.username || user?.email || 'tester';

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.assign('/dashboard');
    }
  }

  return (
    <div className="sidebar-account">
      <div className="sidebar-account-label">Free Tester</div>
      <div className="sidebar-account-email" title={accountName}>{accountName}</div>
      <button type="button" className="sidebar-logout-btn" onClick={handleLogout} disabled={busy}>
        {busy ? 'Signing out...' : 'Sign out'}
      </button>
    </div>
  );
}
