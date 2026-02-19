import React, { useState } from 'react';
import { Phone, Mail, Video, FileText, Paperclip, ChevronDown, ChevronUp, MessageSquare, Users, Send } from 'lucide-react';

const TIPO_CONFIG = {
  llamada: { icon: Phone, color: 'bg-emerald-500', dotColor: 'border-emerald-500', textColor: 'text-emerald-400', label: 'Llamada' },
  whatsapp: { icon: MessageSquare, color: 'bg-green-500', dotColor: 'border-green-500', textColor: 'text-green-400', label: 'WhatsApp' },
  email: { icon: Send, color: 'bg-cyan-500', dotColor: 'border-cyan-500', textColor: 'text-cyan-400', label: 'Email' },
  reunion: { icon: Video, color: 'bg-amber-500', dotColor: 'border-amber-500', textColor: 'text-amber-400', label: 'Reunion' },
  presencial: { icon: Users, color: 'bg-violet-500', dotColor: 'border-violet-500', textColor: 'text-violet-400', label: 'Presencial' },
  nota: { icon: FileText, color: 'bg-slate-500', dotColor: 'border-slate-500', textColor: 'text-slate-400', label: 'Nota' },
};

const tiempoRelativo = (fecha) => {
  if (!fecha) return '';
  const ahora = new Date();
  const entonces = new Date(fecha);
  const diffMs = ahora - entonces;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHoras = Math.floor(diffMs / 3600000);
  const diffDias = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Ahora mismo';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHoras < 24) return `Hace ${diffHoras}h`;
  if (diffDias === 1) return 'Ayer';
  if (diffDias < 7) return `Hace ${diffDias} dias`;
  if (diffDias < 30) return `Hace ${Math.floor(diffDias / 7)} semanas`;
  return entonces.toLocaleDateString('es-MX');
};

// Color based on user name (matches App.js logic)
const getColorUsuario = (nombre) => {
  if (!nombre) return 'text-slate-400';
  const n = nombre.toLowerCase();
  if (n.includes('gustavo')) return 'text-cyan-400';
  if (n.includes('marcos')) return 'text-emerald-400';
  if (n.includes('juan carlos')) return 'text-amber-400';
  if (n.includes('juan pablo')) return 'text-violet-400';
  if (n.includes('francia')) return 'text-pink-400';
  return 'text-violet-400';
};

const TimelineItem = ({ actividad }) => {
  const [expanded, setExpanded] = useState(false);
  const config = TIPO_CONFIG[actividad.tipo] || TIPO_CONFIG.nota;
  const Icon = config.icon;

  return (
    <div className="relative flex gap-4 pb-6 last:pb-0 group">
      {/* Vertical line */}
      <div className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-700 group-last:hidden" />

      {/* Dot with icon */}
      <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full ${config.color} flex items-center justify-center shadow-lg shadow-${config.color}/20`}>
        <Icon className="w-4 h-4 text-white" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold uppercase tracking-wider ${config.textColor}`}>
                {config.label}
              </span>
              {(actividad.tipo === 'whatsapp' || actividad.subtipo === 'whatsapp') && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <MessageSquare className="w-3 h-3" /> WA
                </span>
              )}
              {(actividad.tipo === 'email' || actividad.subtipo === 'email') && actividad.tipo !== 'email' && (
                <span className="flex items-center gap-1 text-xs text-cyan-400">
                  <Mail className="w-3 h-3" /> Email
                </span>
              )}
              {actividad.archivo && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Paperclip className="w-3 h-3" />
                  Archivo adjunto
                </span>
              )}
            </div>
            <h4 className="text-sm font-medium text-white mt-0.5">{actividad.titulo}</h4>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xs text-slate-500">{tiempoRelativo(actividad.fecha)}</div>
            {actividad.hora && <div className="text-xs text-slate-600">{actividad.hora}</div>}
          </div>
        </div>

        {/* User */}
        {actividad.usuario && (
          <span className={`text-xs font-medium ${getColorUsuario(actividad.usuario)}`}>
            {actividad.usuario}
          </span>
        )}

        {/* Description */}
        {actividad.descripcion && (
          <div className="mt-1.5">
            {actividad.descripcion.length > 120 ? (
              <>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {expanded ? actividad.descripcion : actividad.descripcion.slice(0, 120) + '...'}
                </p>
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-0.5 mt-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  {expanded ? (
                    <>Menos <ChevronUp className="w-3 h-3" /></>
                  ) : (
                    <>Mas <ChevronDown className="w-3 h-3" /></>
                  )}
                </button>
              </>
            ) : (
              <p className="text-xs text-slate-400 leading-relaxed">{actividad.descripcion}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const Timeline = ({ activities = [] }) => {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="w-10 h-10 text-slate-600 mb-3" />
        <p className="text-sm text-slate-500">No hay actividades registradas</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {activities.map((act, idx) => (
        <TimelineItem key={act.id || idx} actividad={act} />
      ))}
    </div>
  );
};

export default Timeline;
