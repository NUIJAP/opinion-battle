import { AXIS_KEYS, AXIS_LABEL_JP, type Axes8 } from "@/types";

interface PersonalityRadarProps {
  axes: Axes8;
  /** Max value of any axis (default 5). */
  maxValue?: number;
  /** Total SVG width/height (defaults sane for mobile). */
  size?: number;
  /** Optional second vector to overlay (e.g. AI character for affinity comparison). */
  overlay?: Axes8;
  overlayLabel?: string;
}

export default function PersonalityRadar({
  axes,
  maxValue = 5,
  size = 260,
  overlay,
  overlayLabel,
}: PersonalityRadarProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 30;
  const n = AXIS_KEYS.length;

  const point = (axisIdx: number, value: number) => {
    // Start at top (-90deg), go clockwise.
    const angle = (Math.PI * 2 * axisIdx) / n - Math.PI / 2;
    const r = (Math.max(0, Math.min(maxValue, value)) / maxValue) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  };

  const labelPoint = (axisIdx: number) => {
    const angle = (Math.PI * 2 * axisIdx) / n - Math.PI / 2;
    const r = radius + 16;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  };

  const polygonPoints = (vec: Axes8) =>
    AXIS_KEYS.map((k, i) => {
      const [x, y] = point(i, vec[k]);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

  const ringValues = [1, 2, 3, 4, 5].filter((v) => v <= maxValue);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full h-auto max-w-[300px] mx-auto"
      role="img"
      aria-label="性格8軸レーダー"
    >
      {/* Concentric rings */}
      {ringValues.map((v) => {
        const r = (v / maxValue) * radius;
        return (
          <circle
            key={v}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="#334155"
            strokeOpacity={v === maxValue ? 0.6 : 0.3}
            strokeWidth={1}
          />
        );
      })}

      {/* Radial spokes */}
      {AXIS_KEYS.map((_, i) => {
        const [x, y] = point(i, maxValue);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="#334155"
            strokeOpacity={0.3}
          />
        );
      })}

      {/* Overlay polygon (e.g., affinity AI) */}
      {overlay && (
        <polygon
          points={polygonPoints(overlay)}
          fill="rgba(251, 191, 36, 0.15)"
          stroke="#fbbf24"
          strokeOpacity={0.7}
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      )}

      {/* User polygon */}
      <polygon
        points={polygonPoints(axes)}
        fill="rgba(244, 63, 94, 0.30)"
        stroke="#f43f5e"
        strokeWidth={2}
      />

      {/* Axis labels */}
      {AXIS_KEYS.map((k, i) => {
        const [x, y] = labelPoint(i);
        return (
          <text
            key={k}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="11"
            fill="#cbd5e1"
            fontWeight={600}
          >
            {AXIS_LABEL_JP[k]}
          </text>
        );
      })}

      {/* Legend (only when overlay present) */}
      {overlay && overlayLabel && (
        <g transform={`translate(${cx - 70}, ${size - 6})`}>
          <rect width={10} height={10} fill="rgba(244,63,94,0.6)" />
          <text x={14} y={9} fontSize="10" fill="#cbd5e1">
            あなた
          </text>
          <rect x={66} width={10} height={10} fill="rgba(251,191,36,0.6)" />
          <text x={80} y={9} fontSize="10" fill="#cbd5e1">
            {overlayLabel}
          </text>
        </g>
      )}
    </svg>
  );
}
