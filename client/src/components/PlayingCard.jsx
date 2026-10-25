/**
 * PlayingCard.jsx — Viewport-relative poker cards.
 * Sizes are defined in vw so cards are always large regardless of screen resolution.
 *
 * Card anatomy (real deck):
 *  - Rank + suit symbol in top-left & bottom-right corners
 *  - Number cards: classic pip arrangement
 *  - Ace: large centred suit symbol
 *  - Face cards (J/Q/K): illustrated panel with gradient + letter art
 *  - Back: cross-hatch pattern
 */

const SUIT_SYMBOL = { h: '♥', d: '♦', c: '♣', s: '♠' };
const SUIT_COLOR  = { h: '#e02020', d: '#e02020', c: '#111', s: '#111' };
const RANK_LABEL  = { T: '10', J: 'J', Q: 'Q', K: 'K', A: 'A' };

// ── Pip positions [x%, y%] within the pip area for each rank ──────────────────
const PIP_LAYOUTS = {
  '2': [[50,22],[50,78]],
  '3': [[50,18],[50,50],[50,82]],
  '4': [[25,22],[75,22],[25,78],[75,78]],
  '5': [[25,18],[75,18],[50,50],[25,82],[75,82]],
  '6': [[25,18],[75,18],[25,50],[75,50],[25,82],[75,82]],
  '7': [[25,16],[75,16],[50,35],[25,55],[75,55],[25,84],[75,84]],
  '8': [[25,14],[75,14],[50,32],[25,50],[75,50],[50,68],[25,86],[75,86]],
  '9': [[25,14],[75,14],[25,36],[75,36],[50,50],[25,64],[75,64],[25,86],[75,86]],
  'T': [[25,12],[75,12],[25,30],[75,30],[25,50],[75,50],[25,68],[75,68],[25,88],[75,88]],
};

// Pips below this y% are rotated 180°
const FLIP_Y = 51;

// ── Sub-components ────────────────────────────────────────────────────────────

function Corner({ label, sym, color, flip = false }) {
  return (
    <div style={{
      position:  'absolute',
      ...(flip ? { bottom: '3%', right: '6%', transform: 'rotate(180deg)' }
               : { top: '3%',   left: '6%' }),
      color,
      lineHeight: 1,
      display:   'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <span style={{ fontSize: '19%', fontWeight: 900, lineHeight: 1 }}>{label}</span>
      <span style={{ fontSize: '17%', lineHeight: 1.1 }}>{sym}</span>
    </div>
  );
}

function PipCard({ rank, suit }) {
  const sym   = SUIT_SYMBOL[suit];
  const color = SUIT_COLOR[suit];
  const label = RANK_LABEL[rank] ?? rank;
  const pips  = PIP_LAYOUTS[rank] ?? [];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative',
                  background: 'white', borderRadius: 'inherit', overflow: 'hidden' }}>
      <Corner label={label} sym={sym} color={color} />
      <Corner label={label} sym={sym} color={color} flip />
      {/* Pip area */}
      <div style={{ position: 'absolute', inset: '14% 10% 14% 10%' }}>
        {pips.map(([x, y], i) => (
          <span key={i} style={{
            position:  'absolute',
            left:      `${x}%`,
            top:       `${y}%`,
            transform: `translate(-50%,-50%) ${y > FLIP_Y ? 'rotate(180deg)' : ''}`,
            color,
            fontSize:  '23%',
            lineHeight: 1,
            userSelect: 'none',
          }}>{sym}</span>
        ))}
      </div>
    </div>
  );
}

function AceCard({ suit }) {
  const sym   = SUIT_SYMBOL[suit];
  const color = SUIT_COLOR[suit];
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative',
                  background: 'white', borderRadius: 'inherit', overflow: 'hidden' }}>
      <Corner label="A" sym={sym} color={color} />
      <Corner label="A" sym={sym} color={color} flip />
      {/* Big centre suit */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: '42%', color, fontWeight: 900, lineHeight: 1, userSelect: 'none' }}>
          {sym}
        </span>
      </div>
    </div>
  );
}

const FACE_COLORS = {
  J: { bg: 'linear-gradient(150deg,#fef08a,#f59e0b)', text: '#78350f' },
  Q: { bg: 'linear-gradient(150deg,#fbcfe8,#ec4899)', text: '#831843' },
  K: { bg: 'linear-gradient(150deg,#c7d2fe,#6366f1)', text: '#1e1b4b' },
};

function FaceCard({ rank, suit }) {
  const sym   = SUIT_SYMBOL[suit];
  const color = SUIT_COLOR[suit];
  const label = RANK_LABEL[rank];
  const fc    = FACE_COLORS[rank];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative',
                  background: 'white', borderRadius: 'inherit', overflow: 'hidden' }}>
      <Corner label={label} sym={sym} color={color} />
      <Corner label={label} sym={sym} color={color} flip />
      {/* Art panel */}
      <div style={{
        position: 'absolute', inset: '12% 9%',
        background: fc.bg,
        borderRadius: '8%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '4%',
        boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.4)',
        overflow: 'hidden',
      }}>
        {/* Inner border */}
        <div style={{
          position: 'absolute', inset: '4%',
          border: `2px solid rgba(255,255,255,0.35)`,
          borderRadius: '6%',
        }} />
        <span style={{ fontSize: '42%', fontWeight: 900, color: fc.text, lineHeight: 1, userSelect: 'none',
                       textShadow: '0 2px 4px rgba(0,0,0,0.15)' }}>{label}</span>
        <span style={{ fontSize: '28%', color: fc.text, lineHeight: 1, opacity: 0.85, userSelect: 'none' }}>{sym}</span>
      </div>
    </div>
  );
}

function CardBack() {
  return (
    <div style={{
      width: '100%', height: '100%',
      borderRadius: 'inherit', overflow: 'hidden',
      background: '#1e40af',
      position: 'relative',
    }}>
      {/* Outer frame */}
      <div style={{ position: 'absolute', inset: '5%', borderRadius: '8%',
                    border: '2px solid rgba(147,197,253,0.35)' }} />
      {/* Cross-hatch */}
      <div style={{
        position: 'absolute', inset: '8%', borderRadius: '6%', overflow: 'hidden',
        backgroundImage: `
          repeating-linear-gradient(45deg,  transparent, transparent 5px, rgba(99,179,237,0.18) 5px, rgba(99,179,237,0.18) 6px),
          repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(99,179,237,0.18) 5px, rgba(99,179,237,0.18) 6px)
        `,
        backgroundColor: '#1d4ed8',
      }} />
      {/* Centre diamond */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: '24%', height: '24%',
          background: '#3b82f6',
          transform: 'rotate(45deg)',
          border: '2px solid rgba(147,197,253,0.5)',
        }} />
      </div>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────
/**
 * @param {string}  card     'Ah','Td','BACK', null
 * @param {string}  width    CSS width string, e.g. '13vw', '80px' — height auto at 1.4 ratio
 * @param {boolean} faceDown force card back
 */
export default function PlayingCard({ card, width = '13vw', faceDown = false }) {
  const style = {
    width,
    // Classic card ratio 2.5 : 3.5 = 1 : 1.4
    aspectRatio: '5 / 7',
    borderRadius: `calc(${width} * 0.08)`,
    flexShrink: 0,
    boxShadow: '2px 4px 14px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.4)',
    position: 'relative',
    // fontSize drives ALL internal % sizes — set to width value
    fontSize: width,
  };

  const inner = (() => {
    if (!card || card === 'BACK' || faceDown) return <CardBack />;
    const rank = card.slice(0, -1);
    const suit = card.slice(-1);
    if (rank === 'A')                 return <AceCard  rank={rank} suit={suit} />;
    if (['J','Q','K'].includes(rank)) return <FaceCard rank={rank} suit={suit} />;
    return <PipCard rank={rank} suit={suit} />;
  })();

  return <div style={style}>{inner}</div>;
}
