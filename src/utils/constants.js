import {
  LayoutDashboard, Users, GitBranch, UserPlus, FolderOpen,
  Building, CheckCircle, Calendar, BarChart3, History,
  PhoneCall, MessageSquare, Video, Send, FileText,
  Shield, Eye
} from 'lucide-react';

// ============== TIPOS DE NOTIFICACION ==============
export const TIPOS_NOTIFICACION = {
  tarea: { color: 'bg-violet-500', colorText: 'text-violet-400', nombre: 'Tarea' },
  recordatorio: { color: 'bg-amber-500', colorText: 'text-amber-400', nombre: 'Recordatorio' },
  lead: { color: 'bg-cyan-500', colorText: 'text-cyan-400', nombre: 'Lead' },
  pipeline: { color: 'bg-emerald-500', colorText: 'text-emerald-400', nombre: 'Pipeline' },
  alerta: { color: 'bg-red-500', colorText: 'text-red-400', nombre: 'Alerta' },
  info: { color: 'bg-blue-500', colorText: 'text-blue-400', nombre: 'Info' }
};

// ============== DATOS INICIALES ==============
export const INITIAL_DATA = {
  cuentas: [],
  contactos: [],
  leads: [],
  pipeline: [],
  archivos: [],
  actividades: [],
  recordatorios: [],
  tareas: [],
  usuarios: [],
  notificaciones: [],
  industrias: [],
  servicios: [],
  auditLog: []
};

// ============== ROLES DE USUARIO ==============
export const ROLES = [
  { id: 'admin', name: 'Administrador', color: 'bg-violet-500' },
  { id: 'gerente', name: 'Gerente', color: 'bg-cyan-500' },
  { id: 'vendedor', name: 'Vendedor', color: 'bg-emerald-500' }
];

// ============== PERMISOS POR DEFECTO ==============
// Valores posibles para ver/editar/eliminar: 'todos', 'propios', false (no puede)
// Valores posibles para crear/subir: true, false

export const PERMISOS_ADMIN = {
  modulos: {
    dashboard: true,
    cuentas: true,
    pipeline: true,
    leads: true,
    calendario: true,
    tareas: true,
    reportes: true,
    archivos: true,
    auditlog: true,
    equipo: true
  },
  cuentas: { ver: 'todos', crear: true, editar: 'todos', eliminar: 'todos' },
  contactos: { ver: 'todos', crear: true, editar: 'todos', eliminar: 'todos' },
  pipeline: { ver: 'todos', crear: true, editar: 'todos', eliminar: 'todos' },
  leads: { ver: 'todos', crear: true, editar: 'todos', eliminar: 'todos' },
  actividades: { ver: 'todos', crear: true, editar: 'todos', eliminar: 'todos' },
  tareas: { ver: 'todos', crear: true, editar: 'todos', eliminar: 'todos' },
  recordatorios: { ver: 'todos', crear: true, editar: 'todos', eliminar: 'todos' },
  archivos: { ver: 'todos', subir: true, eliminar: 'todos' }
};

export const PERMISOS_BASICOS = {
  modulos: {
    dashboard: true,
    cuentas: true,
    pipeline: true,
    leads: true,
    calendario: true,
    tareas: true,
    reportes: false,
    archivos: true,
    auditlog: false,
    equipo: false
  },
  cuentas: { ver: 'todos', crear: true, editar: 'propios', eliminar: false },
  contactos: { ver: 'todos', crear: true, editar: 'propios', eliminar: false },
  pipeline: { ver: 'todos', crear: true, editar: 'propios', eliminar: false },
  leads: { ver: 'todos', crear: true, editar: 'propios', eliminar: false },
  actividades: { ver: 'propios', crear: true, editar: 'propios', eliminar: false },
  tareas: { ver: 'propios', crear: true, editar: 'propios', eliminar: 'propios' },
  recordatorios: { ver: 'propios', crear: true, editar: 'propios', eliminar: 'propios' },
  archivos: { ver: 'todos', subir: true, eliminar: false }
};

// ============== ROLES PREDEFINIDOS ==============
export const ROLES_PREDEFINIDOS = [
  {
    id: 'admin',
    nombre: 'Administrador',
    descripcion: 'Acceso total al sistema',
    color: 'from-violet-500 to-purple-600',
    icon: Shield,
    permisos: {
      modulos: { dashboard: true, cuentas: true, pipeline: true, leads: true, calendario: true, tareas: true, reportes: true, archivos: true, auditlog: true, equipo: true },
      cuentas: { ver: 'todos', crear: true, editar: 'todos', eliminar: 'todos' },
      contactos: { ver: 'todos', crear: true, editar: 'todos', eliminar: 'todos' },
      pipeline: { ver: 'todos', crear: true, editar: 'todos', eliminar: 'todos' },
      leads: { ver: 'todos', crear: true, editar: 'todos', eliminar: 'todos' },
      actividades: { ver: 'todos', crear: true, editar: 'todos', eliminar: 'todos' },
      tareas: { ver: 'todos', crear: true, editar: 'todos', eliminar: 'todos' },
      recordatorios: { ver: 'todos', crear: true, editar: 'todos', eliminar: 'todos' },
      archivos: { ver: 'todos', subir: true, eliminar: 'todos' }
    }
  },
  {
    id: 'gerente',
    nombre: 'Gerente',
    descripcion: 'Ve todo, edita solo lo suyo',
    color: 'from-cyan-500 to-blue-600',
    icon: Users,
    permisos: {
      modulos: { dashboard: true, cuentas: true, pipeline: true, leads: true, calendario: true, tareas: true, reportes: true, archivos: true, auditlog: true, equipo: false },
      cuentas: { ver: 'todos', crear: true, editar: 'todos', eliminar: false },
      contactos: { ver: 'todos', crear: true, editar: 'todos', eliminar: false },
      pipeline: { ver: 'todos', crear: true, editar: 'todos', eliminar: false },
      leads: { ver: 'todos', crear: true, editar: 'todos', eliminar: false },
      actividades: { ver: 'todos', crear: true, editar: 'propios', eliminar: false },
      tareas: { ver: 'todos', crear: true, editar: 'propios', eliminar: 'propios' },
      recordatorios: { ver: 'todos', crear: true, editar: 'propios', eliminar: 'propios' },
      archivos: { ver: 'todos', subir: true, eliminar: false }
    }
  },
  {
    id: 'vendedor',
    nombre: 'Vendedor',
    descripcion: 'Ve cuentas/pipeline, edita solo lo suyo',
    color: 'from-emerald-500 to-green-600',
    icon: UserPlus,
    permisos: {
      modulos: { dashboard: true, cuentas: true, pipeline: true, leads: true, calendario: true, tareas: true, reportes: false, archivos: true, auditlog: false, equipo: false },
      cuentas: { ver: 'todos', crear: true, editar: 'propios', eliminar: false },
      contactos: { ver: 'todos', crear: true, editar: 'propios', eliminar: false },
      pipeline: { ver: 'todos', crear: true, editar: 'propios', eliminar: false },
      leads: { ver: 'todos', crear: true, editar: 'propios', eliminar: false },
      actividades: { ver: 'propios', crear: true, editar: 'propios', eliminar: false },
      tareas: { ver: 'propios', crear: true, editar: 'propios', eliminar: 'propios' },
      recordatorios: { ver: 'propios', crear: true, editar: 'propios', eliminar: 'propios' },
      archivos: { ver: 'todos', subir: true, eliminar: false }
    }
  },
  {
    id: 'soporte',
    nombre: 'Soporte',
    descripcion: 'Atiende cuentas existentes',
    color: 'from-amber-500 to-orange-600',
    icon: MessageSquare,
    permisos: {
      modulos: { dashboard: true, cuentas: true, pipeline: false, leads: false, calendario: true, tareas: true, reportes: false, archivos: true, auditlog: false, equipo: false },
      cuentas: { ver: 'todos', crear: false, editar: 'propios', eliminar: false },
      contactos: { ver: 'todos', crear: false, editar: 'propios', eliminar: false },
      pipeline: { ver: false, crear: false, editar: false, eliminar: false },
      leads: { ver: false, crear: false, editar: false, eliminar: false },
      actividades: { ver: 'propios', crear: true, editar: 'propios', eliminar: false },
      tareas: { ver: 'propios', crear: true, editar: 'propios', eliminar: 'propios' },
      recordatorios: { ver: 'propios', crear: true, editar: 'propios', eliminar: 'propios' },
      archivos: { ver: 'todos', subir: true, eliminar: false }
    }
  },
  {
    id: 'lectura',
    nombre: 'Solo Lectura',
    descripcion: 'Solo puede ver información',
    color: 'from-slate-500 to-slate-600',
    icon: Eye,
    permisos: {
      modulos: { dashboard: true, cuentas: true, pipeline: true, leads: true, calendario: true, tareas: true, reportes: true, archivos: true, auditlog: false, equipo: false },
      cuentas: { ver: 'todos', crear: false, editar: false, eliminar: false },
      contactos: { ver: 'todos', crear: false, editar: false, eliminar: false },
      pipeline: { ver: 'todos', crear: false, editar: false, eliminar: false },
      leads: { ver: 'todos', crear: false, editar: false, eliminar: false },
      actividades: { ver: 'todos', crear: false, editar: false, eliminar: false },
      tareas: { ver: 'todos', crear: false, editar: false, eliminar: false },
      recordatorios: { ver: 'todos', crear: false, editar: false, eliminar: false },
      archivos: { ver: 'todos', subir: false, eliminar: false }
    }
  }
];

// ============== MODULOS DE NAVEGACION ==============
export const MODULES = [
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
  { id: 'cuentas', name: 'Cuentas', icon: Building },
  { id: 'pipeline', name: 'Pipeline', icon: GitBranch },
  { id: 'leads', name: 'Leads', icon: UserPlus },
  { id: 'calendario', name: 'Calendario', icon: Calendar },
  { id: 'tareas', name: 'Tareas', icon: CheckCircle },
  { id: 'reportes', name: 'Reportes', icon: BarChart3 },
  { id: 'archivos', name: 'Archivos', icon: FolderOpen },
  { id: 'auditlog', name: 'Historial', icon: History },
  { id: 'equipo', name: 'Equipo', icon: Users }
];

// ============== TIPOS DE ACTIVIDAD ==============
export const TIPOS_ACTIVIDAD = [
  { id: 'llamada', name: 'Llamada', icon: PhoneCall, color: 'bg-emerald-500' },
  { id: 'whatsapp', name: 'WhatsApp', icon: MessageSquare, color: 'bg-green-500' },
  { id: 'zoom', name: 'Zoom', icon: Video, color: 'bg-blue-500' },
  { id: 'presencial', name: 'Reunión Presencial', icon: Users, color: 'bg-violet-500' },
  { id: 'email', name: 'Email', icon: Send, color: 'bg-cyan-500' },
  { id: 'nota', name: 'Nota', icon: FileText, color: 'bg-amber-500' }
];

// ============== TAGS DISPONIBLES ==============
export const TAGS_DISPONIBLES = [
  { id: 'vip', name: 'VIP', color: 'bg-amber-500' },
  { id: 'nuevo', name: 'Nuevo', color: 'bg-emerald-500' },
  { id: 'seguimiento', name: 'Seguimiento', color: 'bg-cyan-500' },
  { id: 'en-riesgo', name: 'En Riesgo', color: 'bg-red-500' },
  { id: 'referido', name: 'Referido', color: 'bg-violet-500' },
  { id: 'grande', name: 'Cuenta Grande', color: 'bg-blue-500' }
];

// ============== FUENTES DE LEADS/CLIENTES ==============
export const FUENTES = ['Referido', 'LinkedIn', 'Sitio Web', 'Evento', 'Cold Call', 'Email', 'Publicidad', 'Otro'];

// ============== ETAPAS DEL PIPELINE ==============
export const PIPELINE_STAGES = [
  { id: 'prospecto', name: 'Prospecto', color: 'from-slate-500 to-slate-600', bg: 'bg-slate-500' },
  { id: 'contacto', name: 'Contacto Inicial', color: 'from-blue-500 to-blue-600', bg: 'bg-blue-500' },
  { id: 'diagnostico', name: 'Diagnóstico Enviado', color: 'from-cyan-500 to-cyan-600', bg: 'bg-cyan-500' },
  { id: 'piloto', name: 'Piloto en Curso', color: 'from-violet-500 to-violet-600', bg: 'bg-violet-500' },
  { id: 'negociacion', name: 'Negociación', color: 'from-amber-500 to-amber-600', bg: 'bg-amber-500' },
  { id: 'cerrado', name: 'Cerrado Ganado', color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-500' },
  { id: 'perdido', name: 'Perdido', color: 'from-red-500 to-red-600', bg: 'bg-red-500' }
];

// ============== INDUSTRIAS ==============
export const INDUSTRIAS = [
  'E-commerce / Retail',
  'SaaS / Software',
  'Fintech',
  'Gobierno',
  'Salud',
  'Educación',
  'Manufactura',
  'Logística',
  'Otro'
];

// ============== SERVICIOS ==============
export const SERVICIOS = [
  'Alicloud',
  'Ple.ad',
  'Supercompany'
];

// ============== FIREBASE CONFIG ==============
export const COLLECTION_NAME = 'eongroup-crm';
export const DOC_ID = 'main-data';
