// ============== UTILIDADES ==============

export const formatDate = (date) => {
  if (!date) return '';
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-');
    return `${d}/${m}/${y}`;
  }
  return new Date(date).toLocaleDateString('es-MX');
};

export const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// Obtener fecha local en formato YYYY-MM-DD (evita problemas de zona horaria con toISOString)
export const getFechaLocal = () => {
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
};

// Color por nombre de usuario
export const getColorUsuario = (nombre) => {
  if (!nombre) return 'text-slate-400';
  const n = nombre.toLowerCase();
  if (n.includes('gustavo')) return 'text-cyan-400';
  if (n.includes('marcos')) return 'text-emerald-400';
  if (n.includes('juan carlos')) return 'text-amber-400';
  if (n.includes('juan pablo')) return 'text-violet-400';
  if (n.includes('francia')) return 'text-pink-400';
  return 'text-violet-400';
};

// Limpiar valores undefined de objetos (Firestore no acepta undefined)
export const limpiarUndefined = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(item => limpiarUndefined(item));
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, limpiarUndefined(v)])
    );
  }
  return obj;
};

// Abrir Google Calendar con evento pre-llenado
export const abrirGoogleCalendar = ({ titulo, descripcion, fecha, hora, userEmail }) => {
  if (!fecha) return;
  let dates;
  if (hora) {
    // Evento con hora específica (1 hora de duración)
    const fechaFormateada = fecha.replace(/-/g, '');
    const horaFormateada = hora.replace(':', '') + '00';
    const inicio = `${fechaFormateada}T${horaFormateada}`;
    const [h, m] = hora.split(':').map(Number);
    const finH = String(h + 1).padStart(2, '0');
    const fin = `${fechaFormateada}T${finH}${String(m).padStart(2, '0')}00`;
    dates = `${inicio}/${fin}`;
  } else {
    // Evento de día completo
    const fechaFormateada = fecha.replace(/-/g, '');
    const d = new Date(fecha + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    const fechaFin = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    dates = `${fechaFormateada}/${fechaFin}`;
  }
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: titulo || 'Sin título',
    dates,
    details: descripcion ? `${descripcion}\n\n— EON Group CRM` : '— EON Group CRM',
  });
  if (userEmail) params.set('authuser', userEmail);
  window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank');
};

// Tiempo relativo (hace X minutos, etc)
export const tiempoRelativo = (fecha) => {
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
  if (diffDias < 7) return `Hace ${diffDias} días`;
  return formatDate(fecha);
};

// ============== RECURRENCIA DE TAREAS ==============

export const RECURRENCIA_OPTIONS = [
  { id: 'ninguna', label: 'Sin recurrencia' },
  { id: 'diario', label: 'Diario' },
  { id: 'semanal', label: 'Semanal' },
  { id: 'quincenal', label: 'Cada 2 semanas' },
  { id: 'mensual', label: 'Mensual' },
];

export function completarTareaConRecurrencia(tareas, tareaId, generateIdFn) {
  const tarea = tareas.find((t) => t.id === tareaId);
  if (!tarea) return { newTareas: tareas, nuevaTareaCreada: null };

  const estabaCompletada = tarea.completada;
  const tieneRecurrencia = tarea.recurrencia && tarea.recurrencia !== 'ninguna';

  // Si se está completando (no estaba completada) y tiene recurrencia, crear nueva tarea
  if (!estabaCompletada && tieneRecurrencia) {
    // Calcular la siguiente fecha
    const fechaBase = tarea.fechaCompromiso
      ? new Date(tarea.fechaCompromiso + 'T00:00:00')
      : new Date();

    switch (tarea.recurrencia) {
      case 'diario':
        fechaBase.setDate(fechaBase.getDate() + 1);
        break;
      case 'semanal':
        fechaBase.setDate(fechaBase.getDate() + 7);
        break;
      case 'quincenal':
        fechaBase.setDate(fechaBase.getDate() + 14);
        break;
      case 'mensual':
        fechaBase.setMonth(fechaBase.getMonth() + 1);
        break;
      default:
        break;
    }

    const año = fechaBase.getFullYear();
    const mes = String(fechaBase.getMonth() + 1).padStart(2, '0');
    const dia = String(fechaBase.getDate()).padStart(2, '0');
    const nuevaFecha = `${año}-${mes}-${dia}`;

    const nuevaTarea = {
      id: generateIdFn(),
      descripcion: tarea.descripcion,
      hora: tarea.hora,
      prioridad: tarea.prioridad,
      responsableId: tarea.responsableId,
      cuentaId: tarea.cuentaId,
      clienteId: tarea.clienteId,
      pipelineId: tarea.pipelineId,
      leadId: tarea.leadId,
      leadNombre: tarea.leadNombre,
      recurrencia: tarea.recurrencia,
      fechaCompromiso: nuevaFecha,
      completada: false,
      fechaCreacion: new Date().toISOString(),
    };

    const newTareas = tareas.map((t) =>
      t.id === tareaId ? { ...t, completada: true } : t
    );
    newTareas.push(nuevaTarea);

    return { newTareas, nuevaTareaCreada: nuevaTarea };
  }

  // Sin recurrencia o des-completando: solo toggle
  const newTareas = tareas.map((t) =>
    t.id === tareaId ? { ...t, completada: !t.completada } : t
  );

  return { newTareas, nuevaTareaCreada: null };
}
