import React, { useState } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// ─── Status badge colours ────────────────────────────────────────────────────
const STATUS = {
  idle:      { bg: '#f3f4f6', color: '#6b7280', label: '' },
  scraping:  { bg: '#eff6ff', color: '#1d4ed8', label: 'Scanning website…' },
  embedding: { bg: '#faf5ff', color: '#7c3aed', label: 'Building AI knowledge…' },
  done:      { bg: '#f0fdf4', color: '#15803d', label: 'Training complete!' },
  error:     { bg: '#fef2f2', color: '#dc2626', label: 'Scraping failed' },
  pasting:   { bg: '#fff7ed', color: '#c2410c', label: 'Using manual content' },
  saving:    { bg: '#faf5ff', color: '#7c3aed', label: 'Building AI knowledge…' },
  saved:     { bg: '#f0fdf4', color: '#15803d', label: 'Training complete!' },
};

// ─── Tiny step indicator ─────────────────────────────────────────────────────
function Steps({ active }) {
  const steps = [
    { key: 'url',   label: 'Enter URL'   },
    { key: 'train', label: 'AI training' },
    { key: 'done',  label: 'Ready'       },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
      {steps.map((s, i) => {
        const isDone    = steps.findIndex(x => x.key === active) > i;
        const isActive  = s.key === active;
        return (
          <React.Fragment key={s.key}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', fontSize: 12, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isDone ? '#4ade80' : isActive ? '#4f46e5' : '#e5e7eb',
                color: isDone || isActive ? 'white' : '#9ca3af',
                transition: 'all .3s',
              }}>
                {isDone ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 11, color: isActive ? '#4f46e5' : '#9ca3af', whiteSpace: 'nowrap' }}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                height: 2, flex: 1, margin: '0 6px 14px',
                background: isDone ? '#4ade80' : '#e5e7eb',
                transition: 'background .3s',
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function TrainPage({ botId, onTrainSuccess }) {
  const [url, setUrl]             = useState('');
  const [status, setStatus]       = useState('idle');
  const [result, setResult]       = useState(null);
  const [errorMsg, setErrorMsg]   = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteLabel, setPasteLabel] = useState('');
  const [charCount, setCharCount] = useState(0);

  // ── Which step are we on ────────────────────────────────────────────────────
  const stepKey =
    ['done', 'saved'].includes(status)    ? 'done'  :
    ['scraping', 'embedding',
     'pasting', 'saving'].includes(status) ? 'train' : 'url';

  // ── Try scraping the URL ───────────────────────────────────────────────────
  async function handleScrape() {
    if (!url.trim()) return;
    setStatus('scraping');
    setErrorMsg('');
    setResult(null);
    setShowPaste(false);

    const embeddingTimer = setTimeout(() => setStatus('embedding'), 4000);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/training/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: url.trim(), botId }),
      });

      clearTimeout(embeddingTimer);
      const data = await res.json();

      // ── Scraping succeeded ─────────────────────────────────────────────────
      if (res.ok && data.chunksEmbedded > 0) {
        setResult(data);
        setStatus('done');
        if (onTrainSuccess) onTrainSuccess(data);
        return;
      }

      // ── Scraping returned 0 chunks (blocked / empty) ───────────────────────
      if (res.ok && data.chunksEmbedded === 0) {
        setStatus('error');
        setErrorMsg('scrape_blocked');
        setShowPaste(true);
        return;
      }

      // ── Server returned an error ───────────────────────────────────────────
      throw new Error(data.error || 'Scraping failed');

    } catch (err) {
      clearTimeout(embeddingTimer);
      setStatus('error');
      setErrorMsg(err.message || 'Could not reach the server');
      // Show paste fallback for network / scrape errors too
      setShowPaste(true);
    }
  }

  // ── Submit manually pasted content ─────────────────────────────────────────
  async function handlePasteSubmit() {
    const text = pasteText.trim();
    if (text.length < 100) return;

    setStatus('saving');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/training/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          botId,
          text,
          label: pasteLabel.trim() || 'Manual content',
          sourceUrl: url.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Training failed');

      setResult(data);
      setStatus('saved');
      setShowPaste(false);
      if (onTrainSuccess) onTrainSuccess(data);

    } catch (err) {
      setStatus('pasting');
      setErrorMsg(err.message || 'Could not save content');
    }
  }

  function handlePasteChange(e) {
    setPasteText(e.target.value);
    setCharCount(e.target.value.length);
  }

  function resetAll() {
    setStatus('idle');
    setResult(null);
    setErrorMsg('');
    setShowPaste(false);
    setPasteText('');
    setPasteLabel('');
    setCharCount(0);
  }

  const s = STATUS[status];
  const isBusy = ['scraping', 'embedding', 'saving'].includes(status);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      <Steps active={stepKey} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <h2 style={{ fontSize: 20, fontWeight: 600, color: '#1f2937', marginBottom: 6 }}>
        Train your bot
      </h2>
      <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24, lineHeight: 1.6 }}>
        Enter your real estate website URL. PropAgent will scan your pages and learn your listings, pricing, and FAQs automatically.
      </p>

      {/* ── URL input row ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !isBusy && handleScrape()}
          placeholder="https://yourrealty.in"
          disabled={isBusy || status === 'done' || status === 'saved'}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 10,
            border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none',
            background: isBusy ? '#f9fafb' : 'white',
            opacity: status === 'done' || status === 'saved' ? 0.6 : 1,
          }}
        />
        <button
          onClick={handleScrape}
          disabled={!url.trim() || isBusy || status === 'done' || status === 'saved'}
          style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: url.trim() && !isBusy && !['done','saved'].includes(status) ? '#4f46e5' : '#e5e7eb',
            color: url.trim() && !isBusy && !['done','saved'].includes(status) ? 'white' : '#9ca3af',
            fontSize: 14, fontWeight: 600,
            cursor: url.trim() && !isBusy ? 'pointer' : 'default',
            whiteSpace: 'nowrap', minWidth: 110,
          }}
        >
          {isBusy ? 'Training…' : 'Train bot'}
        </button>
      </div>

      {/* ── Status bar ─────────────────────────────────────────────────────── */}
      {status !== 'idle' && (
        <div style={{
          background: s.bg, borderRadius: 10, padding: '12px 16px',
          marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {isBusy && (
            <div style={{
              width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
              border: `2px solid ${s.color}`, borderTopColor: 'transparent',
              animation: 'spin 0.8s linear infinite',
            }} />
          )}
          <span style={{ fontSize: 13, fontWeight: 500, color: s.color, flex: 1 }}>
            {s.label}
          </span>

          {/* Progress detail */}
          {status === 'scraping'  && <span style={{ fontSize: 12, color: s.color, opacity: 0.8 }}>Scanning up to 10 pages…</span>}
          {status === 'embedding' && <span style={{ fontSize: 12, color: s.color, opacity: 0.8 }}>Creating AI embeddings…</span>}

          {/* Success result */}
          {(status === 'done' || status === 'saved') && result && (
            <span style={{ fontSize: 12, color: s.color }}>
              {result.pagesScraped
                ? `${result.pagesScraped} pages · ${result.chunksEmbedded} chunks`
                : `${result.chunksEmbedded || result.chunks || '—'} chunks saved`}
            </span>
          )}

          {/* Retrain button */}
          {(status === 'done' || status === 'saved') && (
            <button onClick={resetAll} style={{
              fontSize: 12, color: s.color, background: 'none',
              border: `1px solid ${s.color}40`, borderRadius: 6,
              padding: '3px 10px', cursor: 'pointer',
            }}>
              Retrain
            </button>
          )}
        </div>
      )}

      {/* ── Scraping blocked error + fallback trigger ────────────────────────
           Shown when scraping returned 0 chunks OR threw a network error      */}
      {status === 'error' && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 10, padding: '14px 16px', marginBottom: 16,
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 6 }}>
            {errorMsg === 'scrape_blocked'
              ? "We couldn't read your website automatically"
              : `Scraping error: ${errorMsg}`}
          </p>
          <p style={{ fontSize: 12, color: '#7f1d1d', lineHeight: 1.6, marginBottom: 10 }}>
            {errorMsg === 'scrape_blocked'
              ? 'Many real estate sites (Wix, Squarespace, MagicBricks) block automated scanners. No problem — paste your listings and FAQs below instead. It takes 2 minutes and works just as well.'
              : 'You can still train the bot manually by pasting your content below.'}
          </p>
          <button
            onClick={() => setShowPaste(true)}
            style={{
              padding: '8px 16px', background: '#dc2626', color: 'white',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Paste content manually instead →
          </button>
        </div>
      )}

      {/* ── Paste fallback panel ─────────────────────────────────────────────
           Shown when: error state + user clicked "Paste manually"             */}
      {showPaste && (
        <div style={{
          background: 'white', border: '1.5px solid #f59e0b',
          borderRadius: 12, padding: 20, marginBottom: 16,
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: '#fef3c7', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 14, flexShrink: 0,
            }}>✏️</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#92400e' }}>
                Manual content entry
              </div>
              <div style={{ fontSize: 12, color: '#b45309' }}>
                Paste anything — listings, FAQs, pricing, about page copy
              </div>
            </div>
          </div>

          {/* What to paste — guidance chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {[
              'Your property listings',
              'Pricing & availability',
              'FAQs from your site',
              'About your agency',
              'Location & neighbourhood info',
            ].map(hint => (
              <div key={hint} style={{
                fontSize: 11, padding: '3px 10px',
                background: '#fffbeb', border: '1px solid #fde68a',
                borderRadius: 20, color: '#92400e',
              }}>
                {hint}
              </div>
            ))}
          </div>

          {/* Optional label */}
          <input
            value={pasteLabel}
            onChange={e => setPasteLabel(e.target.value)}
            placeholder="Label (optional) — e.g. 'Listings April 2025'"
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8,
              border: '1px solid #e5e7eb', fontSize: 13,
              marginBottom: 10, boxSizing: 'border-box', outline: 'none',
            }}
          />

          {/* Main textarea */}
          <textarea
            value={pasteText}
            onChange={handlePasteChange}
            placeholder={`Paste your content here. Examples:\n\n• 3BHK flat in Jubilee Hills, 1800 sqft, ₹1.2Cr, 3rd floor, west facing, available immediately\n• 2BHK in Gachibowli, 1200 sqft, ₹65L, gated community, swimming pool, gym\n• We are a RERA-registered agency with 12 years experience in Hyderabad's premium residential market\n• Common question: Do you handle NRI purchases? Yes, we specialize in NRI clients...`}
            rows={10}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: `1.5px solid ${charCount < 100 ? '#e5e7eb' : charCount < 500 ? '#f59e0b' : '#22c55e'}`,
              fontSize: 13, lineHeight: 1.6, resize: 'vertical',
              outline: 'none', boxSizing: 'border-box',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              transition: 'border-color .2s',
            }}
          />

          {/* Character counter + quality indicator */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{
                fontSize: 11,
                color: charCount < 100 ? '#9ca3af' : charCount < 500 ? '#f59e0b' : '#22c55e',
              }}>
                {charCount < 100
                  ? `${charCount} chars — need at least 100 to train`
                  : charCount < 500
                  ? `${charCount} chars — more content = better answers`
                  : `${charCount} chars — great amount of content`}
              </span>
            </div>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>
              {Math.round(charCount / 4)} tokens ≈ ₹{((charCount / 4) * 0.00002).toFixed(4)} OpenAI cost
            </span>
          </div>

          {/* Paste submit / cancel */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handlePasteSubmit}
              disabled={pasteText.trim().length < 100 || status === 'saving'}
              style={{
                flex: 1, padding: '11px', borderRadius: 10, border: 'none',
                background: pasteText.trim().length >= 100 && status !== 'saving' ? '#4f46e5' : '#e5e7eb',
                color: pasteText.trim().length >= 100 && status !== 'saving' ? 'white' : '#9ca3af',
                fontSize: 14, fontWeight: 600,
                cursor: pasteText.trim().length >= 100 ? 'pointer' : 'default',
              }}
            >
              {status === 'saving' ? 'Training…' : 'Train bot with this content'}
            </button>
            <button
              onClick={() => setShowPaste(false)}
              style={{
                padding: '11px 16px', borderRadius: 10,
                background: 'white', border: '1.5px solid #e5e7eb',
                color: '#6b7280', fontSize: 14, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>

          {/* Paste error inline */}
          {status === 'pasting' && errorMsg && (
            <div style={{
              marginTop: 10, padding: '8px 12px', background: '#fef2f2',
              border: '1px solid #fecaca', borderRadius: 8,
              fontSize: 12, color: '#dc2626',
            }}>
              {errorMsg}
            </div>
          )}
        </div>
      )}

      {/* ── Success state ────────────────────────────────────────────────────── */}
      {(status === 'done' || status === 'saved') && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: 12, padding: '16px 18px',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#15803d', marginBottom: 6 }}>
            Your bot is trained and ready
          </div>
          <div style={{ fontSize: 13, color: '#166534', lineHeight: 1.6 }}>
            {status === 'done'
              ? `Scanned ${result?.pagesScraped || 0} pages and learned ${result?.chunksEmbedded || 0} content blocks from your website.`
              : `Learned ${result?.chunksEmbedded || result?.chunks || 0} content blocks from your pasted content.`}
            {' '}Go to the <strong style={{ fontWeight: 600 }}>Customise</strong> tab to set your bot's name and colours, then get your embed code.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={resetAll}
              style={{
                padding: '8px 16px', background: 'white',
                border: '1px solid #bbf7d0', borderRadius: 8,
                fontSize: 13, color: '#15803d', cursor: 'pointer',
              }}
            >
              Add more content
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}