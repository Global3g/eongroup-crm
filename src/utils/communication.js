/**
 * Utilidades para comunicacion omnicanal del CRM
 * Funciones para WhatsApp, llamadas, seguimiento de contacto y plantillas
 */

// --- Helpers internos ---

function cleanPhone(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-()]/g, '');
  if (!cleaned.startsWith('+')) {
    cleaned = '+52' + cleaned;
  }
  return cleaned;
}

function daysBetween(dateStr) {
  if (!dateStr) return Infinity;
  const date = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.floor((now - date) / (1000 * 60 * 60 * 24));
}

// --- Funciones exportadas ---

/**
 * Genera un link de WhatsApp Web/App
 * @param {string} phone - Numero de telefono
 * @param {string} [message] - Mensaje opcional pre-cargado
 * @returns {string} URL de WhatsApp
 */
export function getWhatsAppLink(phone, message) {
  const cleaned = cleanPhone(phone);
  const text = encodeURIComponent(message || '');
  return `https://wa.me/${cleaned}?text=${text}`;
}

/**
 * Genera un link tel: para iniciar llamada
 * @param {string} phone - Numero de telefono
 * @returns {string} URL tel:
 */
export function getCallLink(phone) {
  const cleaned = cleanPhone(phone);
  return `tel:${cleaned}`;
}

/**
 * Obtiene informacion del ultimo contacto con una entidad
 * @param {string} entityId - ID de la cuenta o cliente
 * @param {Array} actividades - Lista de actividades del CRM
 * @param {string} [fieldName='cuentaId'] - Campo a buscar en las actividades
 * @returns {{ fecha: string|null, diasSinContacto: number, texto: string, color: string }}
 */
export function getLastContactInfo(entityId, actividades, fieldName = 'cuentaId') {
  if (!actividades || !Array.isArray(actividades) || !entityId) {
    return {
      fecha: null,
      diasSinContacto: Infinity,
      texto: 'sin contacto',
      color: 'text-slate-500',
    };
  }

  // Filtrar actividades que pertenecen a esta entidad
  const related = actividades.filter(
    (a) => a[fieldName] === entityId || a.clienteId === entityId
  );

  if (related.length === 0) {
    return {
      fecha: null,
      diasSinContacto: Infinity,
      texto: 'sin contacto',
      color: 'text-slate-500',
    };
  }

  // Ordenar por fecha descendente y tomar la mas reciente
  const sorted = [...related].sort((a, b) => {
    const dateA = new Date(a.fecha || a.createdAt || 0);
    const dateB = new Date(b.fecha || b.createdAt || 0);
    return dateB - dateA;
  });

  const latest = sorted[0];
  const fecha = latest.fecha || latest.createdAt || null;
  const dias = daysBetween(fecha);

  // Texto legible
  let texto;
  if (dias === 0) {
    texto = 'hoy';
  } else if (dias === 1) {
    texto = 'ayer';
  } else if (dias <= 6) {
    texto = `hace ${dias} dias`;
  } else if (dias <= 13) {
    texto = 'hace 1 semana';
  } else if (dias <= 29) {
    const semanas = Math.floor(dias / 7);
    texto = `hace ${semanas} semanas`;
  } else if (dias <= 59) {
    texto = 'hace 1 mes';
  } else {
    const meses = Math.floor(dias / 30);
    texto = `hace ${meses} meses`;
  }

  // Color segun urgencia
  let color;
  if (dias <= 3) {
    color = 'text-emerald-400';
  } else if (dias <= 7) {
    color = 'text-amber-400';
  } else if (dias <= 14) {
    color = 'text-orange-400';
  } else {
    color = 'text-red-400';
  }

  return { fecha, diasSinContacto: dias, texto, color };
}

// --- Constantes ---

/**
 * Mapeo de etapas del pipeline a plantillas de email sugeridas
 */
export const PLANTILLAS_POR_ETAPA = {
  prospecto: 'seguimiento',
  contacto: 'seguimiento',
  diagnostico: 'propuesta',
  piloto: 'seguimiento',
  negociacion: 'propuesta',
  cerrado: 'agradecimiento',
  perdido: 'seguimiento',
};

/**
 * Tipos de comunicacion rapida disponibles en el CRM
 */
export const QUICK_COMM_TYPES = [
  { id: 'llamada', label: 'Llamada', icon: 'PhoneCall', color: 'bg-emerald-500' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'MessageSquare', color: 'bg-green-500' },
  { id: 'email', label: 'Email', icon: 'Send', color: 'bg-cyan-500' },
  { id: 'nota', label: 'Nota', icon: 'FileText', color: 'bg-amber-500' },
  { id: 'presencial', label: 'Reunion', icon: 'Users', color: 'bg-violet-500' },
];
