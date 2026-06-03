export function Dash({ size = 16, color = "#B5B0BF" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M4 8H12" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
