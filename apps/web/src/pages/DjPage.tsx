import { useState, useRef, useCallback } from 'react';

const GENRES = ['dubstep', 'dnb', 'riddim', 'trap', 'ambient', 'psychedelic', 'deep', 'house', 'techno'];

export function DjPage() {
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('dubstep');
  const [twitchChannel, setTwitchChannel] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [bpm, setBpm] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [dropActive, setDropActive] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function api(path: string, method = 'GET', body?: unknown) {
    const res = await fetch(path, {
      method,
      credentials: 'include',
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? res.statusText);
    }
    return res.json();
  }

  async function startSet() {
    const data = await api('/api/sets/start', 'POST', { genre, twitchChannel: twitchChannel || undefined });
    setActiveSetId(data.setId);
  }

  async function endSet() {
    await api('/api/sets/end', 'POST');
    setActiveSetId(null);
  }

  async function updateNowPlaying() {
    await api('/api/sets/now-playing', 'PATCH', { artist, title, genre });
  }

  async function triggerDrop() {
    await api('/api/sets/drop', 'POST');
  }

  async function startAudio() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false } as MediaTrackConstraints,
    });
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(analyser);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
    setAnalyzing(true);

    const timeData = new Float32Array(analyser.fftSize);
    const freqData = new Float32Array(analyser.frequencyBinCount);
    let lastDropActive = false;
    let bpmBuffer: number[] = [];
    let lastPeak = 0;

    loopRef.current = setInterval(async () => {
      analyser.getFloatTimeDomainData(timeData);
      analyser.getFloatFrequencyData(freqData);

      // simple peak BPM
      const now = Date.now();
      const rms = Math.sqrt(timeData.reduce((s, v) => s + v * v, 0) / timeData.length);
      if (rms > 0.2 && now - lastPeak > 300) {
        const interval = now - lastPeak;
        if (lastPeak > 0 && interval < 1000) {
          bpmBuffer.push(60000 / interval);
          if (bpmBuffer.length > 8) bpmBuffer.shift();
        }
        lastPeak = now;
      }
      const avgBpm = bpmBuffer.length ? Math.round(bpmBuffer.reduce((a, b) => a + b) / bpmBuffer.length) : 0;
      setBpm(avgBpm);

      // sub-bass energy (20-80Hz)
      const binHz = ctx.sampleRate / analyser.fftSize;
      const lowBin = Math.floor(20 / binHz);
      const highBin = Math.floor(80 / binHz);
      const subBassSlice = freqData.slice(lowBin, highBin);
      const rawEnergy = subBassSlice.reduce((s, v) => s + (v + 100) / 100, 0) / subBassSlice.length;
      const normalizedEnergy = Math.max(0, Math.min(1, rawEnergy));
      setEnergy(normalizedEnergy);

      // drop detection: sub-bass spike
      const drop = normalizedEnergy > 0.85 && !lastDropActive;
      if (drop !== lastDropActive) {
        setDropActive(drop);
        lastDropActive = drop;
      }

      await api('/api/sets/audio-state', 'PATCH', {
        bpm: avgBpm,
        subBassEnergy: normalizedEnergy,
        dropActive: drop,
      }).catch(() => {});
    }, 100);
  }

  function stopAudio() {
    clearInterval(loopRef.current ?? undefined);
    audioCtxRef.current?.close();
    setAnalyzing(false);
    setBpm(0);
    setEnergy(0);
  }

  const inputStyle = {
    background: '#1a0030',
    border: '1px solid #6d28d9',
    borderRadius: 4,
    color: '#e0d0ff',
    padding: '8px 12px',
    fontFamily: 'monospace',
    fontSize: 13,
    outline: 'none',
    width: '100%',
  };

  const btnStyle = (color = '#7c3aed', disabled = false) => ({
    background: color,
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '8px 16px',
    fontFamily: 'monospace',
    fontSize: 13,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  });

  return (
    <div style={{ padding: 32, maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h1 style={{ color: '#c084fc', letterSpacing: 4, fontSize: 20 }}>dj dashboard</h1>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ color: '#9d6fc2', fontSize: 14 }}>set control</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...inputStyle, width: 200 }} placeholder="twitch channel" value={twitchChannel} onChange={e => setTwitchChannel(e.target.value)} />
          <select style={inputStyle} value={genre} onChange={e => setGenre(e.target.value)}>
            {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btnStyle('#15803d', !!activeSetId)} disabled={!!activeSetId} onClick={startSet}>start set</button>
          <button style={btnStyle('#b91c1c', !activeSetId)} disabled={!activeSetId} onClick={endSet}>end set</button>
        </div>
        {activeSetId && <p style={{ color: '#4ade80', fontSize: 11 }}>set active: {activeSetId}</p>}
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ color: '#9d6fc2', fontSize: 14 }}>now playing</h2>
        <input style={inputStyle} placeholder="artist" value={artist} onChange={e => setArtist(e.target.value)} />
        <input style={inputStyle} placeholder="title" value={title} onChange={e => setTitle(e.target.value)} />
        <select style={inputStyle} value={genre} onChange={e => setGenre(e.target.value)}>
          {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <button style={btnStyle('#7c3aed', !activeSetId)} disabled={!activeSetId} onClick={updateNowPlaying}>
          update track
        </button>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ color: '#9d6fc2', fontSize: 14 }}>audio analysis</h2>
        {!analyzing ? (
          <button style={btnStyle()} onClick={startAudio}>start audio analysis</button>
        ) : (
          <button style={btnStyle('#92400e')} onClick={stopAudio}>stop analysis</button>
        )}
        {analyzing && (
          <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
            <span>bpm: <strong style={{ color: '#c084fc' }}>{bpm}</strong></span>
            <span>sub-bass: <strong style={{ color: '#c084fc' }}>{(energy * 100).toFixed(0)}%</strong></span>
            <span style={{ color: dropActive ? '#f87171' : '#4a3060' }}>
              {dropActive ? '🔥 DROP' : '· no drop'}
            </span>
          </div>
        )}
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ color: '#9d6fc2', fontSize: 14 }}>manual drop</h2>
        <button
          style={btnStyle('#be185d', !activeSetId)}
          disabled={!activeSetId}
          onClick={triggerDrop}
        >
          🔥 trigger drop
        </button>
      </section>

      <div style={{ paddingTop: 16, borderTop: '1px solid #1a0030' }}>
        <a href="/" style={{ color: '#7c3aed', fontSize: 12 }}>← back to club</a>
      </div>
    </div>
  );
}
