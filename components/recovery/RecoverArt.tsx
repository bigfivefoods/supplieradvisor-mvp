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

export function QueueArt() {
  return (
    <Frame id="recover-art-queue" label="Illustration of an empty work queue">
      <rect x="36" y="36" width="208" height="36" rx="14" fill="white" stroke="#e2e8f0" />
      <circle cx="58" cy="54" r="8" fill="#00b4d8" />
      <rect x="76" y="48" width="92" height="8" rx="4" fill="#0f172a" opacity="0.85" />
      <rect x="36" y="84" width="208" height="36" rx="14" fill="white" stroke="#e2e8f0" />
      <circle cx="58" cy="102" r="8" fill="#0077b6" />
      <rect x="76" y="96" width="120" height="8" rx="4" fill="#cbd5e1" />
      <rect x="36" y="132" width="208" height="36" rx="14" fill="white" stroke="#e2e8f0" />
      <circle cx="58" cy="150" r="8" fill="#e2e8f0" />
      <rect x="76" y="144" width="72" height="8" rx="4" fill="#cbd5e1" />
      <rect x="176" y="46" width="52" height="16" rx="8" fill="#ecfeff" stroke="#a5f3fc" />
    </Frame>
  );
}

export function CreditorArt() {
  return (
    <Frame id="recover-art-creditor" label="Illustration of a creditor book">
      <rect x="78" y="40" width="124" height="148" rx="18" fill="white" stroke="#e2e8f0" />
      <rect x="96" y="58" width="88" height="10" rx="5" fill="#0f172a" />
      <rect x="96" y="80" width="64" height="8" rx="4" fill="#cbd5e1" />
      <rect x="96" y="100" width="88" height="28" rx="10" fill="#ecfeff" />
      <rect x="96" y="140" width="40" height="24" rx="8" fill="#00b4d8" />
      <circle cx="188" cy="64" r="22" fill="#0077b6" />
      <path d="M180 64h16M188 56v16" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
    </Frame>
  );
}

export function MandateArt() {
  return (
    <Frame id="recover-art-mandate" label="Illustration of a mandate">
      <path d="M92 48h72l28 28v96a16 16 0 0 1-16 16H92a16 16 0 0 1-16-16V64a16 16 0 0 1 16-16z" fill="white" stroke="#e2e8f0" />
      <path d="M164 48v28h28" fill="#e0f7fb" stroke="#e2e8f0" />
      <rect x="96" y="96" width="72" height="8" rx="4" fill="#0f172a" />
      <rect x="96" y="114" width="56" height="8" rx="4" fill="#cbd5e1" />
      <rect x="96" y="140" width="36" height="22" rx="8" fill="#00b4d8" />
      <circle cx="196" cy="150" r="26" fill="#0077b6" />
      <path d="M186 150l7 7 14-16" fill="none" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function AgentArt() {
  return (
    <Frame id="recover-art-agent" label="Illustration of an agent desk">
      <rect x="40" y="46" width="128" height="128" rx="28" fill="white" stroke="#e2e8f0" />
      <circle cx="104" cy="92" r="22" fill="#e0f7fb" />
      <path d="M78 150c8-22 44-22 52 0" fill="none" stroke="#0077b6" strokeWidth="6" strokeLinecap="round" />
      <rect x="178" y="58" width="64" height="18" rx="9" fill="#00b4d8" />
      <rect x="178" y="86" width="52" height="12" rx="6" fill="#cbd5e1" />
      <rect x="178" y="108" width="64" height="12" rx="6" fill="#e2e8f0" />
      <rect x="178" y="130" width="40" height="12" rx="6" fill="#e2e8f0" />
    </Frame>
  );
}

export function PendingArt() {
  return (
    <Frame id="recover-art-pending" label="Illustration of a desk waiting for database setup">
      <rect x="70" y="54" width="140" height="112" rx="24" fill="white" stroke="#e2e8f0" />
      <rect x="92" y="76" width="96" height="10" rx="5" fill="#cbd5e1" />
      <rect x="92" y="98" width="72" height="10" rx="5" fill="#e2e8f0" />
      <circle cx="186" cy="146" r="28" fill="#00b4d8" />
      <path d="M186 134v14l8 6" fill="none" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
    </Frame>
  );
}

export function DeskArt() {
  return (
    <Frame
      id="recover-art-desk"
      label="Illustration of a collections desk with a ledger, a cheque, a phone, and a handshake"
    >
      <rect x="24" y="40" width="88" height="128" rx="16" fill="white" stroke="#e2e8f0" />
      <rect x="36" y="56" width="64" height="8" rx="4" fill="#0f172a" />
      <rect x="36" y="74" width="48" height="6" rx="3" fill="#cbd5e1" />
      <rect x="36" y="88" width="56" height="6" rx="3" fill="#e2e8f0" />
      <rect x="36" y="102" width="40" height="6" rx="3" fill="#e2e8f0" />
      <rect x="36" y="128" width="40" height="18" rx="8" fill="#00b4d8" />
      <rect x="124" y="36" width="132" height="62" rx="12" fill="white" stroke="#e2e8f0" />
      <rect x="138" y="50" width="46" height="7" rx="3" fill="#0077b6" />
      <rect x="138" y="66" width="96" height="6" rx="3" fill="#cbd5e1" />
      <path
        d="M138 84c14 5 22-7 36-2 12 4 18-5 32-1"
        fill="none"
        stroke="#0f172a"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect x="132" y="116" width="34" height="62" rx="10" fill="white" stroke="#e2e8f0" />
      <rect x="138" y="126" width="22" height="32" rx="4" fill="#e0f7fb" />
      <circle cx="149" cy="168" r="3" fill="#0077b6" />
      <circle cx="214" cy="148" r="30" fill="#00b4d8" />
      <path
        d="M198 150c8-12 18-12 24-2 5 7 12 9 20 2"
        fill="none"
        stroke="#0f172a"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M200 160c12 2 18 8 32 6"
        fill="none"
        stroke="#0f172a"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </Frame>
  );
}

export function PortalArt() {
  return (
    <Frame id="recover-art-portal" label="Illustration of a closed portal door">
      <rect x="96" y="40" width="88" height="140" rx="18" fill="white" stroke="#e2e8f0" />
      <circle cx="140" cy="110" r="16" fill="#e0f7fb" stroke="#0077b6" />
      <rect x="136" y="110" width="8" height="22" rx="3" fill="#0f172a" />
      <rect x="118" y="154" width="44" height="8" rx="4" fill="#cbd5e1" />
    </Frame>
  );
}
