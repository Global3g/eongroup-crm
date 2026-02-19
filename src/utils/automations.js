// Automation rules engine for EON Group CRM

// Check deals without activity in X days
export const detectDealsEstancados = (pipeline, actividades, dias = 7) => {
  const ahora = new Date();
  const alertas = [];
  pipeline.forEach(deal => {
    if (deal.etapa === 'cerrado' || deal.etapa === 'perdido') return;
    // Find last activity for this deal
    const actsDeal = actividades.filter(a => a.pipelineId === deal.id || a.cuentaId === deal.cuentaId || a.clienteId === deal.clienteId);
    const lastAct = actsDeal.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0];
    const lastDate = lastAct ? new Date(lastAct.fecha) : new Date(deal.fechaCreacion);
    const diffDays = Math.floor((ahora - lastDate) / 86400000);
    if (diffDays >= dias) {
      alertas.push({
        tipo: 'deal_estancado',
        dealId: deal.id,
        dealNombre: deal.empresa || deal.nombre,
        etapa: deal.etapa,
        diasSinActividad: diffDays,
        asignadoA: deal.asignadoA,
        mensaje: `"${deal.empresa || deal.nombre}" lleva ${diffDays} dias sin actividad en ${deal.etapa}`
      });
    }
  });
  return alertas;
};

// Check overdue reminders
export const detectRecordatoriosVencidos = (recordatorios) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return recordatorios
    .filter(r => !r.completado && new Date(r.fecha) < hoy)
    .map(r => ({
      tipo: 'recordatorio_vencido',
      recordatorioId: r.id,
      titulo: r.titulo,
      fecha: r.fecha,
      responsableId: r.responsableId || r.usuarioId,
      mensaje: `Recordatorio vencido: "${r.titulo}" (${r.fecha})`
    }));
};

// Check overdue tasks
export const detectTareasVencidas = (tareas) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return tareas
    .filter(t => !t.completada && t.fechaCompromiso && new Date(t.fechaCompromiso) < hoy)
    .map(t => ({
      tipo: 'tarea_vencida',
      tareaId: t.id,
      descripcion: t.descripcion,
      fecha: t.fechaCompromiso,
      responsableId: t.responsableId,
      mensaje: `Tarea vencida: "${t.descripcion}" (${t.fechaCompromiso})`
    }));
};

// Check deals in same stage for too long
export const detectDealsEnMismaEtapa = (pipeline, dias = 14) => {
  const ahora = new Date();
  const alertas = [];
  pipeline.forEach(deal => {
    if (deal.etapa === 'cerrado' || deal.etapa === 'perdido') return;
    const historial = deal.historialEtapas || [];
    const lastChange = historial.length > 0
      ? new Date(historial[historial.length - 1].fecha)
      : new Date(deal.fechaCreacion);
    const diffDays = Math.floor((ahora - lastChange) / 86400000);
    if (diffDays >= dias) {
      alertas.push({
        tipo: 'deal_mismo_etapa',
        dealId: deal.id,
        dealNombre: deal.empresa || deal.nombre,
        etapa: deal.etapa,
        diasEnEtapa: diffDays,
        asignadoA: deal.asignadoA,
        mensaje: `"${deal.empresa || deal.nombre}" lleva ${diffDays} dias en etapa "${deal.etapa}"`
      });
    }
  });
  return alertas;
};

// Generate daily summary for a user
export const generarResumenDiario = (userId, pipeline, tareas, recordatorios, actividades) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);

  const misPipeline = pipeline.filter(p => p.asignadoA === userId && p.etapa !== 'cerrado' && p.etapa !== 'perdido');
  const misTareasHoy = tareas.filter(t => t.responsableId === userId && !t.completada && t.fechaCompromiso && new Date(t.fechaCompromiso) <= manana);
  const misRecordatoriosHoy = recordatorios.filter(r => (r.responsableId === userId || r.usuarioId === userId) && !r.completado && r.fecha && new Date(r.fecha) <= manana);
  const misActividadesHoy = actividades.filter(a => (a.responsableId === userId || a.creadoPor === userId) && a.fecha === hoy.toISOString().split('T')[0]);

  return {
    dealsActivos: misPipeline.length,
    tareasHoy: misTareasHoy.length,
    tareasVencidas: misTareasHoy.filter(t => new Date(t.fechaCompromiso) < hoy).length,
    recordatoriosHoy: misRecordatoriosHoy.length,
    recordatoriosVencidos: misRecordatoriosHoy.filter(r => new Date(r.fecha) < hoy).length,
    actividadesHoy: misActividadesHoy.length
  };
};

// Blueprint validation: check required fields before stage transition
export const BLUEPRINT_RULES = {
  // To move to "contacto" stage, need at least contacto name or email
  contacto: {
    camposRequeridos: ['contacto||email'],
    mensaje: 'Para avanzar a "Contacto Inicial" se necesita nombre de contacto o email'
  },
  // To move to "diagnostico", need servicio
  diagnostico: {
    camposRequeridos: ['servicio'],
    mensaje: 'Para avanzar a "Diagnostico Enviado" se necesita el servicio'
  },
  // To move to "piloto", need servicio
  piloto: {
    camposRequeridos: ['servicio'],
    mensaje: 'Para avanzar a "Piloto en Curso" se necesita el servicio'
  },
  // To move to "negociacion", need valorEstimado and servicio
  negociacion: {
    camposRequeridos: ['valorEstimado', 'servicio'],
    mensaje: 'Para avanzar a "Negociacion" se necesita valor estimado y servicio'
  },
  // To close as won, need valorEstimado, servicio, and at least 1 activity
  cerrado: {
    camposRequeridos: ['valorEstimado', 'servicio', 'contacto||email'],
    requiereActividad: true,
    mensaje: 'Para cerrar como ganado se necesita valor estimado, servicio, contacto y al menos 1 actividad'
  }
};

// Validate if a deal can move to a target stage
export const validarTransicionEtapa = (deal, etapaDestino, actividades = []) => {
  const regla = BLUEPRINT_RULES[etapaDestino];
  if (!regla) return { valido: true }; // No rules for this stage (e.g., prospecto, perdido)

  const errores = [];

  if (regla.camposRequeridos) {
    regla.camposRequeridos.forEach(campo => {
      if (campo.includes('||')) {
        // OR condition: at least one must be filled
        const campos = campo.split('||');
        const alguno = campos.some(c => deal[c] && String(deal[c]).trim() !== '');
        if (!alguno) {
          errores.push(`Falta: ${campos.join(' o ')}`);
        }
      } else {
        if (!deal[campo] || String(deal[campo]).trim() === '') {
          errores.push(`Falta: ${campo}`);
        }
      }
    });
  }

  if (regla.requiereActividad) {
    const actsDeal = actividades.filter(a => a.pipelineId === deal.id);
    if (actsDeal.length === 0) {
      errores.push('Se requiere al menos 1 actividad registrada');
    }
  }

  return {
    valido: errores.length === 0,
    errores,
    mensaje: regla.mensaje
  };
};

// Define allowed stage transitions (no skipping)
const TRANSICIONES_PERMITIDAS = {
  prospecto: ['contacto', 'perdido'],
  contacto: ['diagnostico', 'prospecto', 'perdido'],
  diagnostico: ['piloto', 'negociacion', 'contacto', 'perdido'],
  piloto: ['negociacion', 'diagnostico', 'perdido'],
  negociacion: ['cerrado', 'piloto', 'perdido'],
  cerrado: ['negociacion'], // Can revert
  perdido: ['prospecto', 'contacto'] // Can recover
};

export const esTransicionPermitida = (etapaActual, etapaDestino) => {
  const permitidas = TRANSICIONES_PERMITIDAS[etapaActual];
  if (!permitidas) return true; // Unknown stage, allow
  return permitidas.includes(etapaDestino);
};

// Workflow: auto-create follow-up task when deal changes stage
export const generarTareaSeguimiento = (deal, nuevaEtapa, userId) => {
  const TAREAS_POR_ETAPA = {
    contacto: { descripcion: `Hacer contacto inicial con ${deal.empresa || deal.nombre}`, dias: 2 },
    diagnostico: { descripcion: `Enviar diagnostico a ${deal.empresa || deal.nombre}`, dias: 5 },
    piloto: { descripcion: `Dar seguimiento al piloto de ${deal.empresa || deal.nombre}`, dias: 7 },
    negociacion: { descripcion: `Preparar propuesta para ${deal.empresa || deal.nombre}`, dias: 3 },
  };

  const config = TAREAS_POR_ETAPA[nuevaEtapa];
  if (!config) return null;

  const fecha = new Date();
  fecha.setDate(fecha.getDate() + config.dias);
  const fechaStr = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;

  return {
    descripcion: config.descripcion,
    fechaCompromiso: fechaStr,
    hora: '',
    prioridad: nuevaEtapa === 'negociacion' ? 'alta' : 'media',
    responsableId: deal.asignadoA || userId,
    pipelineId: deal.id,
    cuentaId: deal.cuentaId || deal.clienteId || '',
    completada: false,
    origen: 'automatico'
  };
};
