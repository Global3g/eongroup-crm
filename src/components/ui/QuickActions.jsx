import React, { useState } from 'react';
import { Plus, X, Target, Phone, FileText, MessageCircle } from 'lucide-react';

const actions = [
  { key: 'tarea', label: 'Nueva Tarea', icon: Target, bg: 'bg-cyan-500', action: 'onNewTarea' },
  { key: 'llamada', label: 'Registrar Llamada', icon: Phone, bg: 'bg-emerald-500', action: 'onNewLlamada' },
  { key: 'nota', label: 'Agregar Nota', icon: FileText, bg: 'bg-amber-500', action: 'onNewNota' },
  { key: 'chat', label: 'Chatbot', icon: MessageCircle, bg: 'bg-violet-500', action: 'onOpenChat' },
];

export default function QuickActions({ onNewTarea, onNewLlamada, onNewNota, onOpenChat }) {
  const [open, setOpen] = useState(false);

  const callbacks = { onNewTarea, onNewLlamada, onNewNota, onOpenChat };

  const handleAction = (actionKey) => {
    const cb = callbacks[actionKey];
    if (cb) cb();
    setOpen(false);
  };

  return (
    <div className="fixed bottom-24 right-6 z-40 flex flex-col items-end gap-3">
      {/* Mini action buttons */}
      {open && actions.map((item, index) => {
        const Icon = item.icon;
        return (
          <div
            key={item.key}
            className="flex items-center gap-2 animate-fade-in-up"
            style={{
              animation: `fadeSlideUp 0.25s ease-out ${index * 0.06}s both`,
            }}
          >
            {/* Label */}
            <span className="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg shadow-lg border border-slate-700 whitespace-nowrap">
              {item.label}
            </span>
            {/* Button */}
            <button
              onClick={() => handleAction(item.action)}
              className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white ${item.bg} hover:scale-110 transition-transform`}
            >
              <Icon size={20} />
            </button>
          </div>
        );
      })}

      {/* Main FAB */}
      <button
        onClick={() => setOpen(!open)}
        className={`w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-violet-500 shadow-xl flex items-center justify-center text-white hover:shadow-2xl hover:scale-105 transition-all ${open ? 'rotate-45' : 'animate-soft-pulse'}`}
        style={{ transition: 'transform 0.25s ease, box-shadow 0.25s ease' }}
      >
        {open ? <X size={26} /> : <Plus size={26} />}
      </button>

      {/* Inline keyframes */}
      <style>{`
        @keyframes fadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
