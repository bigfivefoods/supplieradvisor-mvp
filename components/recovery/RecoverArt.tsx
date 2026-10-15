/** Decorative artwork for empty RecoverAdvisor® screens. Not data. */

function Frame({ children, label, id }: { children: React.ReactNode; label: string; id: string }) {
  return (
    <svg viewBox="0 0 280 220" role="img" aria-label={label} className="h-auto w-full max-w-[280px]">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e0f7fb" />
          <stop offset="1" stopColor="white" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="264" height="204" rx="36" fill={`url(#${id})`} />
      <rect x="8" y="8" width="264" height="204" rx="36" fill="none" stroke="#e2e8f0" />
      {children}
    </svg>
  );
}

function Statement({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width="92" height="124" rx="14" fill="white" stroke="#e2e8f0" />
      <rect x={x} y={y} width="92" height="22" rx="14" fill="#00b4d8" />
      <rect x={x} y={y + 12} width="92" height="12" fill="#00b4d8" />
      <text x={x + 12} y={y + 15} fill="#0f172a" fontSize="9" fontWeight="700">
        Statement
      </text>
      <rect x={x + 12} y={y + 34} width="52" height="5" rx="2" fill="#0f172a" />
      <rect x={x + 12} y={y + 46} width="68" height="4" rx="2" fill="#cbd5e1" />
      <rect x={x + 12} y={y + 56} width="60" height="4" rx="2" fill="#cbd5e1" />
      <rect x={x + 12} y={y + 66} width="48" height="4" rx="2" fill="#e2e8f0" />
      <rect x={x + 12} y={y + 84} width="68" height="22" rx="8" fill="#e0f7fb" />
      <text x={x + 18} y={y + 99} fill="#0f172a" fontSize="10" fontWeight="700">
        R 18 450
      </text>
    </g>
  );
}

function Phone({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width="46" height="78" rx="12" fill="white" stroke="#e2e8f0" />
      <rect x={x + 6} y={y + 10} width="34" height="46" rx="6" fill="#e0f7fb" />
      <circle cx={x + 23} cy={y + 28} r="8" fill="#00b4d8" />
      <path
        d={`M${x + 19} ${y + 28}c2-4 6-4 8 0`}
        fill="none"
        stroke="#0f172a"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect x={x + 16} y={y + 64} width="14" height="3" rx="1.5" fill="#cbd5e1" />
    </g>
  );
}

function Receipt({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path
        d={`M${x} ${y}h70v78l-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-6 6V${y}z`}
        fill="white"
        stroke="#e2e8f0"
      />
      <text x={x + 10} y={y + 16} fill="#0077b6" fontSize="8" fontWeight="700">
        Receipt
      </text>
      <rect x={x + 10} y={y + 24} width="40" height="4" rx="2" fill="#cbd5e1" />
      <rect x={x + 10} y={y + 34} width="32" height="4" rx="2" fill="#e2e8f0" />
      <rect x={x + 8} y={y + 48} width="54" height="18" rx="6" fill="#00b4d8" />
      <text x={x + 14} y={y + 61} fill="#0f172a" fontSize="9" fontWeight="700">
        R 1 500
      </text>
    </g>
  );
}

function Handshake({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x + 28} cy={y + 28} r="28" fill="#00b4d8" />
      <path
        d={`M${x + 10} ${y + 30}c6-10 14-10 18 0 4 6 10 8 16 2`}
        fill="none"
        stroke="#0f172a"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d={`M${x + 12} ${y + 36}c8 2 14 6 24 4`}
        fill="none"
        stroke="#0f172a"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </g>
  );
}

export function QueueArt() {
  return (
    <Frame id="recover-art-queue" label="Illustration of a statement beside a phone">
      <Statement x={36} y={40} />
      <Phone x={168} y={62} />
      <rect x={156} y={48} width="78" height="22" rx="11" fill="#00b4d8" />
      <text x={168} y={63} fill="#0f172a" fontSize="10" fontWeight="700">
        Call next
      </text>
    </Frame>
  );
}

export function CreditorArt() {
  return (
    <Frame id="recover-art-creditor" label="Illustration of a creditor statement">
      <Statement x={94} y={40} />
      <circle cx={196} cy={58} r="18" fill="#0077b6" />
      <path d="M188 58h16M196 50v16" stroke="#0f172a" strokeWidth="2.4" strokeLinecap="round" />
    </Frame>
  );
}

export function MandateArt() {
  return (
    <Frame id="recover-art-mandate" label="Illustration of a payment-arrangement timeline">
      <path d="M78 58h124" stroke="#00b4d8" strokeWidth="4" strokeLinecap="round" />
      <circle cx="78" cy="58" r="10" fill="#00b4d8" />
      <circle cx="140" cy="58" r="10" fill="#00b4d8" />
      <circle cx="202" cy="58" r="10" fill="#00b4d8" />
      <text x="66" y="84" fill="#0f172a" fontSize="9" fontWeight="700">
        Placed
      </text>
      <text x="118" y="84" fill="#0f172a" fontSize="9" fontWeight="700">
        Arrange
      </text>
      <text x="184" y="84" fill="#0f172a" fontSize="9" fontWeight="700">
        Receipt
      </text>
      <Receipt x={104} y={100} />
    </Frame>
  );
}

export function AgentArt() {
  return (
    <Frame id="recover-art-agent" label="Illustration of a collections phone">
      <Phone x={70} y={48} />
      <rect x={140} y={70} width="92" height="64" rx="16" fill="white" stroke="#e2e8f0" />
      <text x="154" y="94" fill="#0f172a" fontSize="11" fontWeight="700">
        Call booked
      </text>
      <text x="154" y="112" fill="#0077b6" fontSize="10" fontWeight="700">
        09:30
      </text>
    </Frame>
  );
}

export function PendingArt() {
  return (
    <Frame id="recover-art-pending" label="Illustration of a statement waiting to be opened">
      <Statement x={94} y={46} />
    </Frame>
  );
}

export function DeskArt() {
  return (
    <Frame
      id="recover-art-desk"
      label="Illustration of a statement, a phone, a payment arrangement, and a receipt"
    >
      <Statement x={22} y={46} />
      <Phone x={128} y={36} />
      <Handshake x={186} y={28} />
      <Receipt x={150} y={118} />
    </Frame>
  );
}

export function PortalArt() {
  return (
    <Frame id="recover-art-portal" label="Illustration of a handshake and a receipt">
      <Handshake x={48} y={70} />
      <Receipt x={140} y={58} />
    </Frame>
  );
}
