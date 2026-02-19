import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const StatCard = ({ icon: Icon, title, value, trend = 'neutral', change, color = 'cyan' }) => {
  const colorMap = {
    cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'hover:border-cyan-500/30' },
    violet: { bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'hover:border-violet-500/30' },
    amber: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'hover:border-amber-500/30' },
    emerald: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'hover:border-emerald-500/30' },
    rose: { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'hover:border-rose-500/30' },
    blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'hover:border-blue-500/30' },
  };

  const c = colorMap[color] || colorMap.cyan;

  const trendConfig = {
    up: { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    down: { icon: TrendingDown, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    neutral: { icon: Minus, color: 'text-slate-400', bg: 'bg-slate-500/10' },
  };

  const t = trendConfig[trend] || trendConfig.neutral;
  const TrendIcon = t.icon;

  return (
    <div className={`bg-slate-800/40 backdrop-blur-md rounded-2xl border border-white/[0.06] ${c.border} p-7 shadow-lg shadow-slate-950/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-cyan-500/20 group`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-300 truncate">{title}</p>
          <p className="text-3xl font-bold text-white mt-2.5">{value}</p>
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${c.bg} group-hover:scale-110 transition-transform duration-300`}>
            <Icon className={`w-5 h-5 ${c.text}`} />
          </div>
        )}
      </div>

      {change !== undefined && change !== null && (
        <div className="flex items-center gap-1.5 mt-3">
          <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md ${t.bg}`}>
            <TrendIcon className={`w-3.5 h-3.5 ${t.color}`} />
            <span className={`text-xs font-semibold ${t.color}`}>{Math.abs(change)}%</span>
          </div>
          <span className="text-xs text-slate-500">vs mes anterior</span>
        </div>
      )}
    </div>
  );
};

export default StatCard;
