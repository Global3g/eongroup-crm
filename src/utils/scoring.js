/**
 * Utilidades de scoring, sugerencias y deteccion de patrones para el CRM
 * Funciones de analisis inteligente para leads, deals y cuentas
 */

// ============== CONSTANTES ==============

const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const MS_POR_DIA = 86400000;

const NOMBRES_ETAPA = {
  prospecto: 'Prospecto',
  contacto: 'Contacto Inicial',
  diagnostico: 'Diagnostico Enviado',
  piloto: 'Piloto en Curso',
  negociacion: 'Negociacion',
  cerrado: 'Cerrado Ganado',
  perdido: 'Perdido'
};

// ============== HELPERS INTERNOS ==============

/**
 * Calcula los dias transcurridos desde una fecha dada
 */
function diasDesde(fecha) {
  if (!fecha) return Infinity;
  const ahora = new Date();
  const entonces = new Date(fecha);
  return Math.floor((ahora - entonces) / MS_POR_DIA);
}

/**
 * Formatea un numero como moneda
 */
function formatMoney(valor) {
  if (!valor && valor !== 0) return '$0';
  return '$' + Number(valor).toLocaleString('es-MX');
}

/**
 * Formatea una fecha como DD/MM/YYYY
 */
function formatFecha(fecha) {
  if (!fecha) return 'N/A';
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return 'N/A';
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

// ============== 1. CALCULAR LEAD SCORE ==============

/**
 * Calcula un puntaje de calidad para un lead (0-100)
 * @param {Object} lead - Objeto lead del CRM
 * @param {Array} actividades - Lista de actividades del CRM
 * @param {Array} pipeline - Lista de deals del pipeline
 * @returns {{ score: number, nivel: string, color: string, colorBg: string, detalles: string[] }}
 */
export function calcularLeadScore(lead, actividades = [], pipeline = []) {
  if (!lead) return { score: 0, nivel: 'Nuevo', color: 'text-slate-400', colorBg: 'bg-slate-500', detalles: [] };

  let score = 0;
  const detalles = [];

  // --- Completitud de datos (max 20 pts) ---
  let ptsCompleto = 0;
  if (lead.email) ptsCompleto += 5;
  if (lead.telefono) ptsCompleto += 5;
  if (lead.empresa) ptsCompleto += 5;
  if (lead.industria) ptsCompleto += 5;
  score += ptsCompleto;
  detalles.push(`Datos completos: +${ptsCompleto}`);

  // --- Prioridad (max 15 pts) ---
  let ptsPrioridad = 0;
  const prioridad = (lead.prioridad || '').toLowerCase();
  if (prioridad === 'alta') ptsPrioridad = 15;
  else if (prioridad === 'media') ptsPrioridad = 10;
  else if (prioridad === 'baja') ptsPrioridad = 5;
  score += ptsPrioridad;
  detalles.push(`Prioridad ${lead.prioridad || 'sin definir'}: +${ptsPrioridad}`);

  // --- Actividad reciente (max 25 pts) ---
  const actsLead = actividades.filter(a => a.leadId === lead.id);
  let ptsActReciente = 0;
  if (actsLead.length > 0) {
    const sorted = [...actsLead].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const diasUltima = diasDesde(sorted[0].fecha);
    if (diasUltima < 3) ptsActReciente = 25;
    else if (diasUltima < 7) ptsActReciente = 20;
    else if (diasUltima < 14) ptsActReciente = 15;
    else if (diasUltima < 30) ptsActReciente = 10;
    else ptsActReciente = 5;
  }
  score += ptsActReciente;
  detalles.push(`Actividad reciente: +${ptsActReciente}`);

  // --- Numero de actividades (max 15 pts) ---
  let ptsNumActs = 0;
  const numActs = actsLead.length;
  if (numActs >= 5) ptsNumActs = 15;
  else if (numActs >= 3) ptsNumActs = 10;
  else if (numActs >= 1) ptsNumActs = 5;
  score += ptsNumActs;
  detalles.push(`Actividades (${numActs}): +${ptsNumActs}`);

  // --- En pipeline (max 15 pts) ---
  let ptsPipeline = 0;
  const enPipeline = pipeline.some(p => p.leadId === lead.id);
  if (enPipeline) ptsPipeline = 15;
  score += ptsPipeline;
  detalles.push(`En pipeline: +${ptsPipeline}`);

  // --- Fuente (max 10 pts) ---
  let ptsFuente = 4;
  const fuente = lead.fuente || '';
  if (fuente === 'Referido') ptsFuente = 10;
  else if (fuente === 'LinkedIn') ptsFuente = 8;
  else if (fuente === 'Sitio Web') ptsFuente = 7;
  else if (fuente === 'Evento') ptsFuente = 6;
  score += ptsFuente;
  detalles.push(`Fuente ${fuente || 'desconocida'}: +${ptsFuente}`);

  // --- Nivel y colores ---
  let nivel, color, colorBg;
  if (score >= 75) {
    nivel = 'Caliente';
    color = 'text-red-400';
    colorBg = 'bg-red-500';
  } else if (score >= 50) {
    nivel = 'Tibio';
    color = 'text-amber-400';
    colorBg = 'bg-amber-500';
  } else if (score >= 25) {
    nivel = 'Frio';
    color = 'text-blue-400';
    colorBg = 'bg-blue-500';
  } else {
    nivel = 'Nuevo';
    color = 'text-slate-400';
    colorBg = 'bg-slate-500';
  }

  return { score, nivel, color, colorBg, detalles };
}

// ============== 2. CALCULAR DEAL SCORE ==============

/**
 * Calcula un puntaje de calidad para un deal del pipeline (0-100)
 * @param {Object} deal - Objeto deal del pipeline
 * @param {Array} actividades - Lista de actividades del CRM
 * @returns {{ score: number, nivel: string, color: string, colorBg: string }}
 */
export function calcularDealScore(deal, actividades = []) {
  if (!deal) return { score: 0, nivel: 'Nuevo', color: 'text-slate-400', colorBg: 'bg-slate-500' };

  let score = 0;

  // --- Valor estimado (max 25 pts) ---
  const valor = Number(deal.valorEstimado) || 0;
  if (valor >= 100000) score += 25;
  else if (valor >= 50000) score += 20;
  else if (valor >= 20000) score += 15;
  else if (valor >= 5000) score += 10;
  else score += 5;

  // --- Etapa avanzada (max 25 pts) ---
  const etapa = deal.etapa || '';
  const ptsEtapa = {
    cerrado: 25,
    negociacion: 20,
    piloto: 15,
    diagnostico: 10,
    contacto: 5,
    prospecto: 2
  };
  score += ptsEtapa[etapa] || 0;

  // --- Actividad reciente (max 25 pts) ---
  const actsDeal = actividades.filter(a => a.pipelineId === deal.id);
  if (actsDeal.length > 0) {
    const sorted = [...actsDeal].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const diasUltima = diasDesde(sorted[0].fecha);
    if (diasUltima < 3) score += 25;
    else if (diasUltima < 7) score += 20;
    else if (diasUltima < 14) score += 15;
    else if (diasUltima < 30) score += 10;
    else score += 5;
  }

  // --- Numero de actividades (max 15 pts) ---
  const numActs = actsDeal.length;
  if (numActs >= 5) score += 15;
  else if (numActs >= 3) score += 10;
  else if (numActs >= 1) score += 5;

  // --- Tiene fecha seguimiento (max 10 pts) ---
  if (deal.fechaSeguimiento) {
    const diasSeguimiento = diasDesde(deal.fechaSeguimiento);
    if (diasSeguimiento < 0) {
      // Fecha en el futuro
      score += 10;
    } else {
      // Fecha en el pasado
      score += 5;
    }
  }

  // --- Nivel y colores ---
  let nivel, color, colorBg;
  if (score >= 75) {
    nivel = 'Caliente';
    color = 'text-red-400';
    colorBg = 'bg-red-500';
  } else if (score >= 50) {
    nivel = 'Tibio';
    color = 'text-amber-400';
    colorBg = 'bg-amber-500';
  } else if (score >= 25) {
    nivel = 'Frio';
    color = 'text-blue-400';
    colorBg = 'bg-blue-500';
  } else {
    nivel = 'Nuevo';
    color = 'text-slate-400';
    colorBg = 'bg-slate-500';
  }

  return { score, nivel, color, colorBg };
}

// ============== 3. GET SUGERENCIA ACCION ==============

/**
 * Sugiere la siguiente accion para un deal del pipeline
 * @param {Object} deal - Objeto deal del pipeline
 * @param {Array} actividades - Lista de actividades del CRM
 * @param {Array} tareas - Lista de tareas del CRM
 * @returns {{ accion: string, descripcion: string, icono: string, urgencia: string, color: string }}
 */
export function getSugerenciaAccion(deal, actividades = [], tareas = []) {
  if (!deal) {
    return {
      accion: 'Sin informacion',
      descripcion: 'No hay datos del deal',
      icono: 'AlertCircle',
      urgencia: 'baja',
      color: 'text-emerald-400'
    };
  }

  const actsDeal = actividades.filter(a => a.pipelineId === deal.id);
  const tareasDeal = tareas.filter(t =>
    (t.pipelineId === deal.id || t.cuentaId === deal.cuentaId) && !t.completada
  );

  // Calcular dias desde ultima actividad
  let diasSinActividad = Infinity;
  if (actsDeal.length > 0) {
    const sorted = [...actsDeal].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    diasSinActividad = diasDesde(sorted[0].fecha);
  }

  // Verificar tareas vencidas
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const tareasVencidas = tareasDeal.filter(t =>
    t.fechaCompromiso && new Date(t.fechaCompromiso) < hoy
  );

  // --- Prioridad 1: Tareas vencidas ---
  if (tareasVencidas.length > 0) {
    return {
      accion: 'Completar tareas pendientes',
      descripcion: `Hay ${tareasVencidas.length} tarea(s) vencida(s) que requieren atencion inmediata`,
      icono: 'CheckCircle',
      urgencia: 'alta',
      color: 'text-red-400'
    };
  }

  // --- Prioridad 2: Seguimiento urgente (> 7 dias sin actividad) ---
  if (diasSinActividad > 7) {
    return {
      accion: 'Dar seguimiento urgente',
      descripcion: `Llevas ${diasSinActividad === Infinity ? 'mucho tiempo' : diasSinActividad + ' dias'} sin actividad en este deal`,
      icono: 'AlertCircle',
      urgencia: 'alta',
      color: 'text-red-400'
    };
  }

  // --- Prioridad 3: Contactar pronto (> 3 dias sin actividad) ---
  if (diasSinActividad > 3) {
    return {
      accion: 'Contactar pronto',
      descripcion: `Han pasado ${diasSinActividad} dias desde la ultima actividad`,
      icono: 'PhoneCall',
      urgencia: 'media',
      color: 'text-amber-400'
    };
  }

  // --- Prioridad 4: Sugerencias por etapa ---
  const etapa = deal.etapa || '';

  if (etapa === 'prospecto' && actsDeal.length === 0) {
    return {
      accion: 'Hacer primer contacto',
      descripcion: 'Este prospecto no tiene actividades registradas. Inicia el primer contacto',
      icono: 'PhoneCall',
      urgencia: 'alta',
      color: 'text-red-400'
    };
  }

  if (etapa === 'prospecto' && actsDeal.length > 0) {
    return {
      accion: 'Enviar diagnostico',
      descripcion: 'Ya tienes contacto con el prospecto. Avanza enviando un diagnostico',
      icono: 'Send',
      urgencia: 'media',
      color: 'text-amber-400'
    };
  }

  if (etapa === 'contacto') {
    return {
      accion: 'Agendar reunion de diagnostico',
      descripcion: 'Programa una reunion para realizar el diagnostico del cliente',
      icono: 'Calendar',
      urgencia: 'media',
      color: 'text-amber-400'
    };
  }

  if (etapa === 'diagnostico') {
    return {
      accion: 'Dar seguimiento al diagnostico enviado',
      descripcion: 'Contacta al cliente para conocer su feedback sobre el diagnostico',
      icono: 'FileText',
      urgencia: 'media',
      color: 'text-amber-400'
    };
  }

  if (etapa === 'piloto') {
    return {
      accion: 'Revisar avance del piloto',
      descripcion: 'Verifica el progreso del piloto y agenda seguimiento con el cliente',
      icono: 'FileText',
      urgencia: 'media',
      color: 'text-amber-400'
    };
  }

  if (etapa === 'negociacion') {
    return {
      accion: 'Enviar propuesta final',
      descripcion: 'Prepara y envia la propuesta final para cerrar el deal',
      icono: 'Send',
      urgencia: 'media',
      color: 'text-amber-400'
    };
  }

  // Default para etapas cerrado/perdido u otras
  return {
    accion: 'Sin accion requerida',
    descripcion: 'Este deal no requiere accion inmediata',
    icono: 'CheckCircle',
    urgencia: 'baja',
    color: 'text-emerald-400'
  };
}

// ============== 4. GENERAR RESUMEN CUENTA ==============

/**
 * Genera un resumen de texto para una cuenta
 * @param {Object} cuenta - Objeto cuenta del CRM
 * @param {Array} contactos - Contactos de la cuenta
 * @param {Array} pipeline - Deals del pipeline
 * @param {Array} actividades - Actividades registradas
 * @param {Array} tareas - Tareas del CRM
 * @param {Array} recordatorios - Recordatorios del CRM
 * @returns {string} Resumen formateado
 */
export function generarResumenCuenta(cuenta, contactos = [], pipeline = [], actividades = [], tareas = [], recordatorios = []) {
  if (!cuenta) return 'Sin informacion de cuenta';

  // Filtrar datos de esta cuenta
  const contactosCuenta = contactos.filter(c => c.cuentaId === cuenta.id);
  const dealsCuenta = pipeline.filter(p => p.cuentaId === cuenta.id || p.clienteId === cuenta.id);
  const actsCuenta = actividades.filter(a => a.cuentaId === cuenta.id || a.clienteId === cuenta.id);
  const tareasCuenta = tareas.filter(t => t.cuentaId === cuenta.id && !t.completada);
  const recordatoriosCuenta = recordatorios.filter(r =>
    (r.cuentaId === cuenta.id) && !r.completado
  );

  // Metricas
  const dealsGanados = dealsCuenta.filter(d => d.etapa === 'cerrado');
  const valorTotalPipeline = dealsCuenta
    .filter(d => d.etapa !== 'perdido')
    .reduce((sum, d) => sum + (Number(d.valorEstimado) || 0), 0);
  const valorGanados = dealsGanados.reduce((sum, d) => sum + (Number(d.valorEstimado) || 0), 0);

  // Ultima actividad
  const actsSorted = [...actsCuenta].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const ultimaActividad = actsSorted.length > 0 ? formatFecha(actsSorted[0].fecha) : 'N/A';

  // Ultimas 5 actividades
  const ultimas5 = actsSorted.slice(0, 5);

  // Construir resumen
  let resumen = '';

  resumen += `\u{1F4CA} RESUMEN: ${cuenta.empresa || cuenta.nombre || 'Sin nombre'}\n`;
  resumen += `Industria: ${cuenta.industria || 'N/A'} | Servicio: ${cuenta.servicio || 'N/A'}\n`;
  resumen += `Creada: ${formatFecha(cuenta.fechaCreacion)}\n`;
  resumen += '\n';

  // Contactos
  resumen += `\u{1F465} CONTACTOS (${contactosCuenta.length}):\n`;
  if (contactosCuenta.length > 0) {
    contactosCuenta.forEach(c => {
      const partes = [
        c.nombre || 'Sin nombre',
        c.cargo || '',
        c.email || '',
        c.telefono || ''
      ].filter(Boolean);
      resumen += `\u2022 ${partes.join(' - ')}\n`;
    });
  } else {
    resumen += '\u2022 Sin contactos registrados\n';
  }
  resumen += '\n';

  // Deals
  resumen += `\u{1F4BC} DEALS (${dealsCuenta.length}):\n`;
  if (dealsCuenta.length > 0) {
    dealsCuenta.forEach(d => {
      resumen += `\u2022 ${d.nombre || d.empresa || 'Sin nombre'} - Etapa: ${d.etapa || 'N/A'} - Valor: ${formatMoney(d.valorEstimado)}\n`;
    });
  } else {
    resumen += '\u2022 Sin deals registrados\n';
  }
  resumen += '\n';

  // Metricas
  resumen += `\u{1F4C8} METRICAS:\n`;
  resumen += `\u2022 Valor total en pipeline: ${formatMoney(valorTotalPipeline)}\n`;
  resumen += `\u2022 Deals ganados: ${dealsGanados.length} (${formatMoney(valorGanados)})\n`;
  resumen += `\u2022 Actividades registradas: ${actsCuenta.length}\n`;
  resumen += `\u2022 Ultima actividad: ${ultimaActividad}\n`;
  resumen += `\u2022 Tareas pendientes: ${tareasCuenta.length}\n`;
  resumen += `\u2022 Recordatorios pendientes: ${recordatoriosCuenta.length}\n`;
  resumen += '\n';

  // Actividades recientes
  resumen += `\u{1F4DD} ACTIVIDADES RECIENTES (ultimas 5):\n`;
  if (ultimas5.length > 0) {
    ultimas5.forEach(a => {
      resumen += `\u2022 ${formatFecha(a.fecha)} - ${a.tipo || 'N/A'}: ${a.descripcion || a.notas || 'Sin descripcion'}\n`;
    });
  } else {
    resumen += '\u2022 Sin actividades registradas\n';
  }

  return resumen;
}

// ============== 5. DETECTAR PATRONES ==============

/**
 * Analiza datos del CRM para detectar patrones de conversion, rentabilidad y eficiencia
 * @param {Array} cuentas - Lista de cuentas
 * @param {Array} leads - Lista de leads
 * @param {Array} pipeline - Lista de deals
 * @param {Array} actividades - Lista de actividades
 * @returns {{ industriasMasConversion: Array, serviciosMasRentables: Array, fuentesMasEfectivas: Array, etapasCuelloBotella: Array, mejorMes: Object }}
 */
export function detectarPatrones(cuentas = [], leads = [], pipeline = [], actividades = []) {
  // --- Industrias con mas conversion ---
  const industriasMasConversion = calcularConversionPorIndustria(cuentas, pipeline);

  // --- Servicios mas rentables ---
  const serviciosMasRentables = calcularRentabilidadPorServicio(pipeline);

  // --- Fuentes mas efectivas ---
  const fuentesMasEfectivas = calcularEfectividadPorFuente(leads, pipeline);

  // --- Etapas cuello de botella ---
  const etapasCuelloBotella = calcularCuellosBotella(pipeline);

  // --- Mejor mes ---
  const mejorMes = calcularMejorMes(pipeline);

  return {
    industriasMasConversion,
    serviciosMasRentables,
    fuentesMasEfectivas,
    etapasCuelloBotella,
    mejorMes
  };
}

/**
 * Calcula la tasa de conversion agrupada por industria
 */
function calcularConversionPorIndustria(cuentas, pipeline) {
  // Crear mapa de cuentaId -> industria
  const industriaPorCuenta = {};
  cuentas.forEach(c => {
    if (c.id && c.industria) {
      industriaPorCuenta[c.id] = c.industria;
    }
  });

  // Agrupar deals por industria
  const grupos = {};
  pipeline.forEach(deal => {
    const cuentaId = deal.cuentaId || deal.clienteId;
    const industria = industriaPorCuenta[cuentaId] || deal.industria || 'Sin industria';
    if (!grupos[industria]) {
      grupos[industria] = { industria, total: 0, ganados: 0, valor: 0 };
    }
    grupos[industria].total++;
    if (deal.etapa === 'cerrado') {
      grupos[industria].ganados++;
      grupos[industria].valor += Number(deal.valorEstimado) || 0;
    }
  });

  return Object.values(grupos)
    .map(g => ({
      ...g,
      tasa: g.total > 0 ? Math.round((g.ganados / g.total) * 100) : 0
    }))
    .sort((a, b) => b.tasa - a.tasa);
}

/**
 * Calcula la rentabilidad agrupada por servicio
 */
function calcularRentabilidadPorServicio(pipeline) {
  const grupos = {};
  pipeline.forEach(deal => {
    const servicio = deal.servicio || 'Sin servicio';
    if (!grupos[servicio]) {
      grupos[servicio] = { servicio, deals: 0, valorTotal: 0 };
    }
    grupos[servicio].deals++;
    grupos[servicio].valorTotal += Number(deal.valorEstimado) || 0;
  });

  return Object.values(grupos)
    .map(g => ({
      ...g,
      ticketPromedio: g.deals > 0 ? Math.round(g.valorTotal / g.deals) : 0
    }))
    .sort((a, b) => b.valorTotal - a.valorTotal);
}

/**
 * Calcula la efectividad de cada fuente de leads
 */
function calcularEfectividadPorFuente(leads, pipeline) {
  // Obtener leadIds que estan en el pipeline
  const leadsEnPipeline = new Set(
    pipeline.filter(p => p.leadId).map(p => p.leadId)
  );

  // Agrupar leads por fuente
  const grupos = {};
  leads.forEach(lead => {
    const fuente = lead.fuente || 'Sin fuente';
    if (!grupos[fuente]) {
      grupos[fuente] = { fuente, totalLeads: 0, convertidos: 0 };
    }
    grupos[fuente].totalLeads++;
    if (leadsEnPipeline.has(lead.id)) {
      grupos[fuente].convertidos++;
    }
  });

  return Object.values(grupos)
    .map(g => ({
      ...g,
      tasaConversion: g.totalLeads > 0 ? Math.round((g.convertidos / g.totalLeads) * 100) : 0
    }))
    .sort((a, b) => b.tasaConversion - a.tasaConversion);
}

/**
 * Detecta las etapas donde los deals se quedan mas tiempo (cuellos de botella)
 */
function calcularCuellosBotella(pipeline) {
  const ahora = new Date();
  const grupos = {};

  pipeline.forEach(deal => {
    // Solo deals activos (no cerrados ni perdidos)
    if (deal.etapa === 'cerrado' || deal.etapa === 'perdido') return;

    const etapa = deal.etapa || 'prospecto';

    // Calcular dias en la etapa actual
    const historial = deal.historialEtapas || [];
    let fechaEntradaEtapa;
    if (historial.length > 0) {
      // Ultima entrada del historial es el cambio mas reciente
      fechaEntradaEtapa = new Date(historial[historial.length - 1].fecha);
    } else {
      fechaEntradaEtapa = new Date(deal.fechaCreacion);
    }

    const diasEnEtapa = Math.floor((ahora - fechaEntradaEtapa) / MS_POR_DIA);

    if (!grupos[etapa]) {
      grupos[etapa] = { etapa, nombre: NOMBRES_ETAPA[etapa] || etapa, totalDias: 0, count: 0 };
    }
    grupos[etapa].totalDias += diasEnEtapa;
    grupos[etapa].count++;
  });

  return Object.values(grupos)
    .map(g => ({
      etapa: g.etapa,
      nombre: g.nombre,
      promedioDias: g.count > 0 ? Math.round(g.totalDias / g.count) : 0,
      count: g.count
    }))
    .sort((a, b) => b.promedioDias - a.promedioDias);
}

/**
 * Encuentra el mes con mayor valor en deals cerrados
 */
function calcularMejorMes(pipeline) {
  const cerrados = pipeline.filter(d => d.etapa === 'cerrado');

  if (cerrados.length === 0) {
    return { mes: null, label: 'N/A', valor: 0, deals: 0 };
  }

  // Agrupar por mes (YYYY-MM)
  const meses = {};
  cerrados.forEach(deal => {
    const fecha = deal.fechaCierre || deal.fechaCreacion;
    if (!fecha) return;
    const d = new Date(fecha);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!meses[key]) {
      meses[key] = { mes: key, mesIdx: d.getMonth(), anio: d.getFullYear(), valor: 0, deals: 0 };
    }
    meses[key].valor += Number(deal.valorEstimado) || 0;
    meses[key].deals++;
  });

  // Encontrar el mejor
  const mejor = Object.values(meses).sort((a, b) => b.valor - a.valor)[0];

  if (!mejor) {
    return { mes: null, label: 'N/A', valor: 0, deals: 0 };
  }

  return {
    mes: mejor.mes,
    label: `${MESES_ES[mejor.mesIdx]} ${mejor.anio}`,
    valor: mejor.valor,
    deals: mejor.deals
  };
}

// ============== EXPORTAR CONSTANTES ==============

export { MESES_ES, NOMBRES_ETAPA };
