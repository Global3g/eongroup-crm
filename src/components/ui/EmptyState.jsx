import React from 'react';
import { Inbox } from 'lucide-react';

const EmptyState = ({ icon: Icon = Inbox, title = 'Sin datos', description, actionLabel, onAction }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center animate-fade-in">
      <div className="p-4 sm:p-6 md:p-8 rounded-3xl bg-gradient-to-br from-slate-700/70 to-slate-800/70 mb-5 shadow-lg shadow-slate-800/40">
        <Icon className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 text-slate-400" />
      </div>
      <h3 className="text-xl font-bold text-white mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-slate-400 max-w-sm mb-2">{description}</p>
      )}
      <p className="text-xs text-slate-500 max-w-xs mb-6">Comienza ahora y lleva tu gestion al siguiente nivel</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-violet-500 rounded-2xl hover:opacity-90 transition-opacity shadow-lg shadow-cyan-500/25"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
