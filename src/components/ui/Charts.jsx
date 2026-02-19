import React, { useEffect, useState, useId } from 'react';

// ---------------------------------------------------------------------------
// Color helper -- resolves Tailwind-style color names to hex values so they
// can be used inside SVG attributes (fill, stroke, stop-color, etc.).
// ---------------------------------------------------------------------------
const COLOR_MAP = {
  'cyan-400': '#22d3ee',
  'cyan-500': '#06b6d4',
  'cyan-600': '#0891b2',
  'emerald-400': '#34d399',
  'emerald-500': '#10b981',
  'emerald-600': '#059669',
  'violet-400': '#a78bfa',
  'violet-500': '#8b5cf6',
  'violet-600': '#7c3aed',
  'amber-400': '#fbbf24',
  'amber-500': '#f59e0b',
  'amber-600': '#d97706',
  'rose-400': '#fb7185',
  'rose-500': '#f43f5e',
  'rose-600': '#e11d48',
  'blue-400': '#60a5fa',
  'blue-500': '#3b82f6',
  'blue-600': '#2563eb',
  'indigo-400': '#818cf8',
  'indigo-500': '#6366f1',
  'indigo-600': '#4f46e5',
  'teal-400': '#2dd4bf',
  'teal-500': '#14b8a6',
  'teal-600': '#0d9488',
  'pink-400': '#f472b6',
  'pink-500': '#ec4899',
  'pink-600': '#db2777',
  'purple-400': '#c084fc',
  'purple-500': '#a855f7',
  'purple-600': '#9333ea',
  'red-400': '#f87171',
  'red-500': '#ef4444',
  'red-600': '#dc2626',
  'green-400': '#4ade80',
  'green-500': '#22c55e',
  'green-600': '#16a34a',
  'yellow-400': '#facc15',
  'yellow-500': '#eab308',
  'orange-400': '#fb923c',
  'orange-500': '#f97316',
  'slate-400': '#94a3b8',
  'slate-500': '#64748b',
  'slate-600': '#475569',
  'slate-700': '#334155',
  cyan: '#06b6d4',
  emerald: '#10b981',
  violet: '#8b5cf6',
  amber: '#f59e0b',
  rose: '#f43f5e',
  blue: '#3b82f6',
  indigo: '#6366f1',
  teal: '#14b8a6',
  pink: '#ec4899',
  purple: '#a855f7',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
};

function resolveColor(color) {
  if (!color) return '#06b6d4';
  if (color.startsWith('#') || color.startsWith('rgb')) return color;
  return COLOR_MAP[color] || COLOR_MAP[`${color}-500`] || '#06b6d4';
}

// Hex to rgba helper for gradient stops
function hexToRgba(hex, alpha) {
  const c = resolveColor(hex);
  const r = parseInt(c.slice(1, 3), 16);
  const g = parseInt(c.slice(3, 5), 16);
  const b = parseInt(c.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Format large numbers
function formatNumber(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ===========================================================================
// 1. FunnelChart
// ===========================================================================
function FunnelChart({ stages = [] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  if (!stages.length) return null;

  const maxCount = Math.max(...stages.map((s) => s.count || 0), 1);
  const barHeight = 44;
  const gap = 8;
  const arrowHeight = 24;
  const totalHeight =
    stages.length * barHeight +
    (stages.length - 1) * (gap + arrowHeight) +
    gap * 2;

  return (
    <div className="w-full">
      <div className="space-y-0" style={{ minHeight: totalHeight }}>
        {stages.map((stage, i) => {
          const widthPct = Math.max(((stage.count || 0) / maxCount) * 100, 12);
          const hex = resolveColor(stage.color);
          const prevStage = i > 0 ? stages[i - 1] : null;
          const conversion =
            prevStage && prevStage.count
              ? ((stage.count / prevStage.count) * 100).toFixed(1)
              : null;

          return (
            <React.Fragment key={stage.name || i}>
              {/* Conversion arrow between stages */}
              {conversion !== null && (
                <div className="flex items-center justify-center py-1">
                  <div className="flex flex-col items-center">
                    <svg width="16" height="12" viewBox="0 0 16 12">
                      <path
                        d="M8 0 L14 8 L10 8 L10 12 L6 12 L6 8 L2 8 Z"
                        fill="#475569"
                      />
                    </svg>
                    <span className="text-xs text-slate-400 mt-0.5">
                      {conversion}% conversion
                    </span>
                  </div>
                </div>
              )}

              {/* Funnel bar */}
              <div className="flex items-center gap-3 w-full px-1">
                {/* Label */}
                <div className="w-28 flex-shrink-0 text-right">
                  <span className="text-sm font-medium text-slate-300 truncate block">
                    {stage.name}
                  </span>
                </div>

                {/* Bar */}
                <div className="flex-1 relative">
                  <div
                    className="h-10 rounded-lg flex items-center justify-end pr-3 transition-all duration-700 ease-out"
                    style={{
                      width: mounted ? `${widthPct}%` : '0%',
                      backgroundColor: hex,
                      minWidth: '3rem',
                    }}
                  >
                    <span className="text-sm font-bold text-white drop-shadow">
                      {formatNumber(stage.count)}
                    </span>
                  </div>
                </div>

                {/* Value */}
                <div className="w-24 flex-shrink-0 text-right">
                  {stage.value !== undefined && (
                    <span className="text-xs text-slate-400">
                      ${formatNumber(stage.value)}
                    </span>
                  )}
                  {stage.percentage !== undefined && (
                    <span className="text-xs text-slate-500 ml-1">
                      ({stage.percentage}%)
                    </span>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// 2. SimpleLineChart
// ===========================================================================
function SimpleLineChart({ data = [], color = 'cyan', height = 200 }) {
  const uid = useId();
  const gradId = `line-grad-${uid.replace(/:/g, '')}`;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  if (!data.length) return null;

  const hex = resolveColor(color);
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const viewW = 600;
  const viewH = height;
  const chartW = viewW - padding.left - padding.right;
  const chartH = viewH - padding.top - padding.bottom;

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  // Create points
  const points = data.map((d, i) => ({
    x: padding.left + (i / Math.max(data.length - 1, 1)) * chartW,
    y: padding.top + chartH - ((d.value - minVal) / range) * chartH,
    label: d.label,
    value: d.value,
  }));

  // Build smooth quadratic bezier path
  function buildSmoothPath(pts) {
    if (pts.length < 2) return `M${pts[0].x},${pts[0].y}`;
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const curr = pts[i];
      const next = pts[i + 1];
      const cpx = (curr.x + next.x) / 2;
      d += ` Q${curr.x},${curr.y} ${cpx},${(curr.y + next.y) / 2}`;
    }
    const last = pts[pts.length - 1];
    d += ` T${last.x},${last.y}`;
    return d;
  }

  const linePath = buildSmoothPath(points);
  const areaPath =
    linePath +
    ` L${points[points.length - 1].x},${padding.top + chartH} L${points[0].x},${padding.top + chartH} Z`;

  // Y-axis ticks
  const tickCount = 5;
  const yTicks = Array.from({ length: tickCount }, (_, i) => {
    const val = minVal + (range * i) / (tickCount - 1);
    const y = padding.top + chartH - ((val - minVal) / range) * chartH;
    return { val, y };
  });

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={hexToRgba(hex, 0.3)} />
            <stop offset="100%" stopColor={hexToRgba(hex, 0.02)} />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={tick.y}
              x2={viewW - padding.right}
              y2={tick.y}
              stroke="#334155"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 8}
              y={tick.y + 4}
              textAnchor="end"
              fill="#94a3b8"
              fontSize="11"
            >
              {formatNumber(Math.round(tick.val))}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path
          d={areaPath}
          fill={`url(#${gradId})`}
          opacity={mounted ? 1 : 0}
          style={{ transition: 'opacity 0.8s ease-out' }}
        />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={hex}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={mounted ? 'none' : '2000'}
          strokeDashoffset={mounted ? '0' : '2000'}
          style={{ transition: 'stroke-dashoffset 1.2s ease-out' }}
        />

        {/* Data points and labels */}
        {points.map((p, i) => (
          <g key={i}>
            {/* Dot */}
            <circle
              cx={p.x}
              cy={p.y}
              r={mounted ? 4 : 0}
              fill="#1e293b"
              stroke={hex}
              strokeWidth="2"
              style={{ transition: 'r 0.4s ease-out' }}
            />
            {/* Value tooltip on hover area */}
            <title>
              {p.label}: {p.value}
            </title>
            {/* X-axis label */}
            <text
              x={p.x}
              y={viewH - 8}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="10"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ===========================================================================
// 3. DonutChart
// ===========================================================================
function DonutChart({
  segments = [],
  size = 200,
  label = '',
  centerValue = '',
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  if (!segments.length) return null;

  const total = segments.reduce((sum, s) => sum + (s.value || 0), 0);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 8;
  const innerR = outerR * 0.62;
  const strokeWidth = outerR - innerR;
  const pathR = (outerR + innerR) / 2;
  const circumference = 2 * Math.PI * pathR;

  // Calculate each segment's dash values
  let accumulated = 0;
  const arcs = segments.map((seg) => {
    const fraction = total ? seg.value / total : 0;
    const dashLen = fraction * circumference;
    const dashOffset = -accumulated;
    accumulated += dashLen;
    return {
      ...seg,
      fraction,
      dashLen,
      dashOffset,
      hex: resolveColor(seg.color),
    };
  });

  return (
    <div className="flex flex-col items-center w-full">
      {/* SVG Donut */}
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="block"
      >
        {/* Background ring */}
        <circle
          cx={cx}
          cy={cy}
          r={pathR}
          fill="none"
          stroke="#1e293b"
          strokeWidth={strokeWidth}
        />

        {/* Segments */}
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={pathR}
            fill="none"
            stroke={arc.hex}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arc.dashLen} ${circumference - arc.dashLen}`}
            strokeDashoffset={
              mounted
                ? arc.dashOffset + circumference * 0.25
                : circumference + circumference * 0.25
            }
            strokeLinecap="butt"
            style={{
              transition: 'stroke-dashoffset 1s ease-out',
              transitionDelay: `${i * 120}ms`,
            }}
          >
            <title>
              {arc.label}: {arc.value}
            </title>
          </circle>
        ))}

        {/* Center text */}
        {centerValue && (
          <text
            x={cx}
            y={label ? cy - 6 : cy + 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize={size * 0.14}
            fontWeight="bold"
          >
            {centerValue}
          </text>
        )}
        {label && (
          <text
            x={cx}
            y={cy + size * 0.1}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#94a3b8"
            fontSize={size * 0.07}
          >
            {label}
          </text>
        )}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
        {arcs.map((arc, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: arc.hex }}
            />
            <span className="text-xs text-slate-400">{arc.label}</span>
            <span className="text-xs font-semibold text-white">
              {formatNumber(arc.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===========================================================================
// 4. HorizontalBarChart
// ===========================================================================
function HorizontalBarChart({ data = [], height = 'auto' }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  if (!data.length) return null;

  const globalMax = Math.max(
    ...data.map((d) => d.maxValue || d.value || 0),
    1
  );

  return (
    <div className="w-full space-y-3" style={{ height }}>
      {data.map((item, i) => {
        const max = item.maxValue || globalMax;
        const pct = Math.min((item.value / max) * 100, 100);
        const hex = resolveColor(item.color);

        return (
          <div key={item.label || i}>
            {/* Label row */}
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-sm text-slate-300 truncate mr-2">
                {item.label}
              </span>
              <span className="text-sm font-semibold text-white whitespace-nowrap">
                {formatNumber(item.value)}
                {item.suffix || ''}
              </span>
            </div>

            {/* Bar track */}
            <div className="w-full h-3 rounded-full bg-slate-700/60 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: mounted ? `${pct}%` : '0%',
                  backgroundColor: hex,
                  transitionDelay: `${i * 80}ms`,
                }}
              />
            </div>

            {/* Percentage label */}
            <div className="text-right mt-0.5">
              <span className="text-[10px] text-slate-500">
                {pct.toFixed(0)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ===========================================================================
// 5. SimpleAreaChart
// ===========================================================================
function SimpleAreaChart({
  data = [],
  color = 'cyan',
  height = 180,
  showDots = true,
}) {
  const uid = useId();
  const gradId = `area-grad-${uid.replace(/:/g, '')}`;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  if (!data.length) return null;

  const hex = resolveColor(color);
  const padding = { top: 16, right: 16, bottom: 36, left: 46 };
  const viewW = 600;
  const viewH = height;
  const chartW = viewW - padding.left - padding.right;
  const chartH = viewH - padding.top - padding.bottom;

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => ({
    x: padding.left + (i / Math.max(data.length - 1, 1)) * chartW,
    y: padding.top + chartH - ((d.value - minVal) / range) * chartH,
    label: d.label,
    value: d.value,
  }));

  // Smooth curve via cubic bezier (Catmull-Rom to Bezier)
  function buildSmoothCurve(pts) {
    if (pts.length < 2) return `M${pts[0].x},${pts[0].y}`;
    if (pts.length === 2)
      return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;

    let path = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(i + 2, pts.length - 1)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return path;
  }

  const curvePath = buildSmoothCurve(points);
  const areaPath =
    curvePath +
    ` L${points[points.length - 1].x},${padding.top + chartH} L${points[0].x},${padding.top + chartH} Z`;

  // Y-axis ticks
  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount }, (_, i) => {
    const val = minVal + (range * i) / (tickCount - 1);
    const y = padding.top + chartH - ((val - minVal) / range) * chartH;
    return { val, y };
  });

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={hexToRgba(hex, 0.35)} />
            <stop offset="100%" stopColor={hexToRgba(hex, 0)} />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={tick.y}
              x2={viewW - padding.right}
              y2={tick.y}
              stroke="#334155"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 8}
              y={tick.y + 4}
              textAnchor="end"
              fill="#94a3b8"
              fontSize="11"
            >
              {formatNumber(Math.round(tick.val))}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path
          d={areaPath}
          fill={`url(#${gradId})`}
          opacity={mounted ? 1 : 0}
          style={{ transition: 'opacity 0.8s ease-out' }}
        />

        {/* Line */}
        <path
          d={curvePath}
          fill="none"
          stroke={hex}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={mounted ? 1 : 0}
          style={{ transition: 'opacity 0.6s ease-out' }}
        />

        {/* Dots + labels */}
        {points.map((p, i) => (
          <g key={i}>
            {showDots && (
              <circle
                cx={p.x}
                cy={p.y}
                r={mounted ? 3.5 : 0}
                fill="#1e293b"
                stroke={hex}
                strokeWidth="2"
                style={{
                  transition: 'r 0.4s ease-out',
                  transitionDelay: `${i * 60}ms`,
                }}
              />
            )}
            <title>
              {p.label}: {p.value}
            </title>
            <text
              x={p.x}
              y={viewH - 8}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="10"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ===========================================================================
// Named exports
// ===========================================================================
export {
  FunnelChart,
  SimpleLineChart,
  DonutChart,
  HorizontalBarChart,
  SimpleAreaChart,
};
