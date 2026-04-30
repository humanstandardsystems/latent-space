import { useState } from 'react';

export function AuthPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/auth/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('failed');
      setSent(true);
    } catch {
      setError('something went wrong. try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 24 }}>
      <h1 style={{ fontSize: 32, letterSpacing: 4, color: '#c084fc' }}>latent space</h1>
      {sent ? (
        <p style={{ color: '#a0a0c0' }}>check your email for a link to enter the room</p>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 280 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your email"
            required
            style={{
              background: '#1a0030',
              border: '1px solid #6d28d9',
              borderRadius: 4,
              color: '#e0d0ff',
              padding: '10px 14px',
              fontFamily: 'monospace',
              fontSize: 14,
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              background: '#7c3aed',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '10px 14px',
              fontFamily: 'monospace',
              fontSize: 14,
              cursor: 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'sending...' : 'get link'}
          </button>
          {error && <p style={{ color: '#f87171', fontSize: 12 }}>{error}</p>}
        </form>
      )}
      <p style={{ color: '#4a3060', fontSize: 12 }}>no password. just vibes.</p>
    </div>
  );
}
