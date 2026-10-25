/**
 * PlayingCard.jsx
 * Full poker-quality playing cards rendered entirely in JSX/CSS.
 * - Number cards: classic pip arrangement (suit symbols counted & positioned)
 * - Face cards: stylised letter art (J/Q/K) with decorative inner border
 * - Ace: large centred suit with ornate frame
 * - Card back: diamond cross-hatch pattern
 */

const SUIT_SYMBOL = { h: '♥', d: '♦', c: '♣', s: '♠' };
const SUIT_COLOR  = { h: '#dc2626', d: '#dc2626', c: '#1a1a1a', s: '#1a1a1a' };
const RANK_LABEL  = { T: '10', J: 'J', Q: 'Q', K: 'K', A: 'A' };

// ── Pip grid positions (% from top-left) for each rank ────────────────────────
// Each entry is [x%, y%] within the pip area (excludes corner labels)
const PIP_LAYOUTS = {
  '2': [[50,25],[50,75]],
  '3': [[50,20],[50,50],[50,80]],
  '4': [[25,25],[75,25],[25,75],[75,75]],
  '5': [[25,20],[75,20],[50,50],[25,80],[75,80]],
  '6': [[25,20],[75,20],[25,50],[75,50],[25,80],[75,80]],
  '7': [[25,18],[75,18],[50,37],[25,55],[75,55],[25,78],[75,78]],
  '8': [[25,16],[75,16],[50,33],[25,50],[75,50],[50,67],[25,84],[75,84]],
  '9': [[25,16],[75,16],[25,38],[75,38],[50,50],[25,62],[75,62],[25,84],[75,84]],
  'T': [[25,14],[75,14],[25,32],[75,32],[25,50],[75,50],[25,68],[75,68],[25,86],[75,86]],
};

// Pips in the bottom half are flipped 180°
const FLIP_THRESHOLD = 52; // y% above this = top half, below = flip

function PipCard({ rank, suit }) {
  const sym   = SUIT_SYMBOL[suit];
  const color = SUIT_COLOR[suit];
  const pips  = PIP_LAYOUTS[rank] ?? [];
  const label = RANK_LABEL[rank] ?? rank;

  return (
    <div className="w-full h-full relative bg-white rounded-[inherit] overflow-hidden select-none">
      {/* Top-left corner */}
      <div className="absolute top-[4%] left-[7%] flex flex-col items-center leading-none"
           style={{ color }}>
        <span className="font-black" style={{ fontSize: '18%', lineHeight: 1 }}>{label}</span>
        <span style={{ fontSize: '16%', lineHeight: 1.1 }}>{sym}</span>
      </div>
      {/* Bottom-right corner (rotated) */}
      <div className="absolute bottom-[4%] right-[7%] flex flex-col items-center leading-none rotate-180"
           style={{ color }}>
        <span className="font-black" style={{ fontSize: '18%', lineHeight: 1 }}>{label}</span>
        <span style={{ fontSize: '16%', lineHeight: 1.1 }}>{sym}</span>
      </div>

      {/* Pip area */}
      <div className="absolute inset-[12%] inset-x-[10%]">
        {pips.map(([x, y], i) => (
          <span
            key={i}
            className="absolute"
            style={{
              left:      `${x}%`,
              top:       `${y}%`,
              transform: `translate(-50%, -50%) ${y > FLIP_THRESHOLD ? 'rotate(180deg)' : ''}`,
              color,
              fontSize:  '22%',
              lineHeight: 1,
            }}
          >
            {sym}
          </span>
        ))}
      </div>
    </div>
  );
}

function AceCard({ suit }) {
  const sym   = SUIT_SYMBOL[suit];
  const color = SUIT_COLOR[suit];
  const label = 'A';

  return (
    <div className="w-full h-full relative bg-white rounded-[inherit] overflow-hidden select-none">
      {/* Corners */}
      <div className="absolute top-[4%] left-[7%] flex flex-col items-center leading-none" style={{ color }}>
        <span className="font-black" style={{ fontSize: '18%', lineHeight: 1 }}>{label}</span>
        <span style={{ fontSize: '16%', lineHeight: 1.1 }}>{sym}</span>
      </div>
      <div className="absolute bottom-[4%] right-[7%] flex flex-col items-center leading-none rotate-180" style={{ color }}>
        <span className="font-black" style={{ fontSize: '18%', lineHeight: 1 }}>{label}</span>
        <span style={{ fontSize: '16%', lineHeight: 1.1 }}>{sym}</span>
      </div>

      {/* Large centre suit with ornate ring */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative flex items-center justify-center rounded-full"
             style={{
               width: '52%', height: '52%',
               border: `2px solid ${color}22`,
             }}>
          <span className="font-black" style={{ fontSize: '38%', color, lineHeight: 1 }}>{sym}</span>
        </div>
      </div>
    </div>
  );
}

// Face card inner art — large letter + decorative elements
const FACE_GRADIENTS = {
  J: { top: '#fbbf24', bot: '#f59e0b' },
  Q: { top: '#ec4899', bot: '#be185d' },
  K: { top: '#6366f1', bot: '#4338ca' },
};

function FaceCard({ rank, suit }) {
  const sym    = SUIT_SYMBOL[suit];
  const color  = SUIT_COLOR[suit];
  const label  = RANK_LABEL[rank];
  const grad   = FACE_GRADIENTS[rank];

  return (
    <div className="w-full h-full relative bg-white rounded-[inherit] overflow-hidden select-none">
      {/* Corners */}
      <div className="absolute top-[4%] left-[7%] flex flex-col items-center leading-none" style={{ color }}>
        <span className="font-black" style={{ fontSize: '18%', lineHeight: 1 }}>{label}</span>
        <span style={{ fontSize: '16%', lineHeight: 1.1 }}>{sym}</span>
      </div>
      <div className="absolute bottom-[4%] right-[7%] flex flex-col items-center leading-none rotate-180" style={{ color }}>
        <span className="font-black" style={{ fontSize: '18%', lineHeight: 1 }}>{label}</span>
        <span style={{ fontSize: '16%', lineHeight: 1.1 }}>{sym}</span>
      </div>

      {/* Face art area */}
      <div className="absolute inset-[10%] rounded-lg overflow-hidden flex flex-col items-center justify-center gap-1"
           style={{ background: `linear-gradient(160deg, ${grad.top}, ${grad.bot})` }}>
        {/* Decorative border */}
        <div className="absolute inset-[4%] rounded border border-white/30" />

        {/* Big rank letter */}
        <span className="font-black text-white drop-shadow-md" style={{ fontSize: '36%', lineHeight: 1 }}>
          {label}
        </span>
        {/* Suit symbol below */}
        <span className="font-bold drop-shadow" style={{ fontSize: '24%', color: 'rgba(255,255,255,0.85)', lineHeight: 1 }}>
          {sym}
        </span>
      </div>
    </div>
  );
}

function CardBack() {
  return (
    <div className="w-full h-full relative rounded-[inherit] overflow-hidden select-none"
         style={{ background: '#1e3a8a' }}>
      {/* Border frame */}
      <div className="absolute inset-[5%] rounded border border-blue-400/40" />
      {/* Cross-hatch pattern via repeating gradient */}
      <div className="absolute inset-[7%] rounded overflow-hidden"
           style={{
             backgroundImage: `
               repeating-linear-gradient(45deg,  transparent, transparent 4px, rgba(99,179,237,0.15) 4px, rgba(99,179,237,0.15) 5px),
               repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(99,179,237,0.15) 4px, rgba(99,179,237,0.15) 5px)
             `,
             backgroundColor: '#1e40af',
           }} />
      {/* Centre diamond */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div style={{
          width: '22%', height: '22%',
          background: '#3b82f6',
          transform: 'rotate(45deg)',
          border: '2px solid rgba(147,197,253,0.4)',
        }} />
      </div>
    </div>
  );
}

// ── Public <PlayingCard> component ─────────────────────────────────────────────
/**
 * @param {string}  card   — e.g. 'Ah', 'Td', 'Ks', 'BACK', or null/undefined
 * @param {'sm'|'md'|'lg'|'xl'} size
 * @param {boolean} faceDown
 */
export default function PlayingCard({ card, size = 'md', faceDown = false }) {
  // Dimensions — width × height, keeping ~1:1.4 ratio
  const dims = {
    sm:  { w: 44,  h: 62  },
    md:  { w: 58,  h: 82  },
    lg:  { w: 72,  h: 102 },
    xl:  { w: 90,  h: 126 },
  }[size] ?? { w: 58, h: 82 };

  const wrapStyle = {
    width:        dims.w,
    height:       dims.h,
    borderRadius: dims.w * 0.09,
    flexShrink:   0,
    boxShadow:    '2px 3px 10px rgba(0,0,0,0.55)',
    fontSize:     dims.w,   // all internal sizes are % of this → scales perfectly
    position:     'relative',
  };

  const inner = (() => {
    if (!card || card === 'BACK' || faceDown) return <CardBack />;
    const rank = card.slice(0, -1);
    const suit = card.slice(-1);
    if (rank === 'A')                    return <AceCard  rank={rank} suit={suit} />;
    if (['J','Q','K'].includes(rank))    return <FaceCard rank={rank} suit={suit} />;
    return <PipCard rank={rank} suit={suit} />;
  })();

  return <div style={wrapStyle}>{inner}</div>;
}
