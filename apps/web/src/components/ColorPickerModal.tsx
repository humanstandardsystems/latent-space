import { useState } from 'react';

const PALETTE: string[] = [
  '#ff4d6d', '#ff9500', '#ffe600', '#7fff00',
  '#00e5ff', '#00ff9f', '#c084fc', '#f472b6',
  '#818cf8', '#4ade80', '#fb923c', '#e879f9',
];

interface ColorPickerModalProps {
  onColorPicked: (color: string) => void;
}

export function ColorPickerModal({ onColorPicked }: ColorPickerModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [hovered, setHovered] = useState<string | null>(null);

  async function pick(color: string) {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/blobs/me/color', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ color }),
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'failed' }));
        throw new Error(body.error || 'failed');
      }
      onColorPicked(color);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
      setSubmitting(false);
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <h2 style={titleStyle}>pick your color</h2>
        <p style={subtitleStyle}>this is your blob forever. choose wisely.</p>

        <div style={gridStyle}>
          {PALETTE.map((color) => (
            <button
              key={color}
              onClick={() => pick(color)}
              onMouseEnter={() => setHovered(color)}
              onMouseLeave={() => setHovered(null)}
              disabled={submitting}
              style={{
                ...swatchStyle,
                background: color,
                transform: hovered === color ? 'scale(1.15)' : 'scale(1)',
                boxShadow: hovered === color ? `0 0 24px ${color}` : 'none',
                cursor: submitting ? 'wait' : 'pointer',
                opacity: submitting && hovered !== color ? 0.5 : 1,
              }}
              aria-label={`pick ${color}`}
            />
          ))}
        </div>

        {error && <p style={errorStyle}>{error}</p>}
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  fontFamily: 'monospace',
};

const cardStyle: React.CSSProperties = {
  background: '#1a0030',
  border: '1px solid #6d28d9',
  borderRadius: 8,
  padding: '32px 40px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 20,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  letterSpacing: 3,
  color: '#c084fc',
  fontWeight: 'normal',
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: '#a0a0c0',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 14,
  padding: '8px 0',
};

const swatchStyle: React.CSSProperties = {
  width: 56,
  height: 56,
  border: 'none',
  borderRadius: 6,
  transition: 'transform 120ms ease, box-shadow 120ms ease',
};

const errorStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: '#f87171',
};
