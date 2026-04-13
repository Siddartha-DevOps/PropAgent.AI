const sizes = {
  sm:  { icon: 28, wordmark: 16, tagline: false },
  md:  { icon: 36, wordmark: 20, tagline: false },
  lg:  { icon: 48, wordmark: 26, tagline: true  },
  xl:  { icon: 64, wordmark: 32, tagline: true  },
};

export default function PropAgentLogo({ size = "md", iconOnly = false, className = "" }) {
  const s = sizes[size] || sizes.md;
  const icon = (
    <svg width={s.icon} height={s.icon} viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M 10,72 Q 10,92 28,92 L 36,108 L 46,92 L 88,92 Q 108,92 108,72 L 108,48 L 60,8 L 10,48 Z" fill="#1E40AF"/>
      <path d="M 10,48 L 60,8 L 108,48 L 98,48 L 60,16 L 20,48 Z" fill="#17318A"/>
      <path d="M 10,74 Q 28,60 60,68 Q 86,76 108,64 L 108,72 Q 108,92 88,92 L 46,92 L 36,108 L 28,92 Q 10,92 10,72 Z" fill="#10B981"/>
      <rect x="44" y="34" width="32" height="26" rx="3" fill="white" opacity="0.92"/>
      <rect x="46" y="36" width="13" height="10" rx="2" fill="#3B82F6"/>
      <rect x="61" y="36" width="13" height="10" rx="2" fill="#3B82F6"/>
      <rect x="46" y="48" width="13" height="10" rx="2" fill="#3B82F6"/>
      <rect x="61" y="48" width="13" height="10" rx="2" fill="#3B82F6"/>
      <circle cx="94" cy="18" r="5" fill="#34D399"/>
      <circle cx="103" cy="10" r="3" fill="#34D399" opacity="0.7"/>
      <circle cx="106" cy="22" r="2" fill="#34D399" opacity="0.5"/>
    </svg>
  );
  if (iconOnly) return <span className={className}>{icon}</span>;
  return (
    <div className={className} style={{ display: "inline-flex", alignItems: "center", gap: s.icon * 0.28 + "px" }}>
      {icon}
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <span style={{ fontSize: s.wordmark, fontWeight: 700, letterSpacing: "-0.3px", lineHeight: 1 }}>
          <span style={{ color: "#1E3A8A" }}>Prop</span>
          <span style={{ color: "#059669" }}>Agent</span>
          <span style={{ color: "#1E3A8A" }}>.AI</span>
        </span>
        {s.tagline && (
          <span style={{ fontSize: s.wordmark * 0.45, fontWeight: 400, color: "#64748B", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 3 }}>
            AI for Real Estate Sales
          </span>
        )}
      </div>
    </div>
  );
}