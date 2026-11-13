import { useState } from 'react';
import '../styles/socialAuth.css';

export default function SocialAuthButtons() {
  const [loading, setLoading] = useState('');

  function start(provider) {
    if (loading) return;
    setLoading(provider);
    window.location.assign(`/api/auth/${provider}/start`);
  }

  return (
    <div className="social-auth" aria-label="Social sign-in">
      <button type="button" disabled={Boolean(loading)} aria-busy={loading === 'google'} onClick={() => start('google')}>
        {loading === 'google' ? 'Connecting to Google...' : 'Continue with Google'}
      </button>
      <button type="button" disabled={Boolean(loading)} aria-busy={loading === 'apple'} onClick={() => start('apple')}>
        {loading === 'apple' ? 'Connecting to Apple...' : 'Continue with Apple'}
      </button>
    </div>
  );
}
