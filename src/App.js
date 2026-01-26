import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, Users, GitBranch, UserPlus, FolderOpen,
  Menu, X, Plus, Trash2, Edit, Save, Search, Phone, Mail,
  Building, FileText, CheckCircle, Clock, XCircle, ChevronRight,
  Eye, Target, Loader, Upload, Download, File, Image, Globe,
  TrendingUp, DollarSign, Calendar, ArrowUpRight, Briefcase, Flag,
  BarChart3, Tag, MessageSquare, Bell, PhoneCall, Video,
  Send, History, AlertCircle, FileSpreadsheet, Filter,
  Lock, LogOut, User, UserCog, Shield, BellRing,
  Bot, Sparkles, Paperclip, Copy, RotateCcw, Maximize2, Minimize2
} from 'lucide-react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  verifyBeforeUpdateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { db, storage, auth, secondaryAuth } from './firebase';

// ============== UTILIDADES ==============
const formatDate = (date) => {
  if (!date) return '';
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-');
    return `${d}/${m}/${y}`;
  }
  return new Date(date).toLocaleDateString('es-MX');
};
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// Obtener fecha local en formato YYYY-MM-DD (evita problemas de zona horaria con toISOString)
const getFechaLocal = () => {
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
};

// Limpiar valores undefined de objetos (Firestore no acepta undefined)
const limpiarUndefined = (obj) => {
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

// Tiempo relativo (hace X minutos, etc)
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
  if (diffDias < 7) return `Hace ${diffDias} días`;
  return formatDate(fecha);
};

// Tipos de notificación con iconos y colores
const TIPOS_NOTIFICACION = {
  tarea: { color: 'bg-violet-500', colorText: 'text-violet-400', nombre: 'Tarea' },
  recordatorio: { color: 'bg-amber-500', colorText: 'text-amber-400', nombre: 'Recordatorio' },
  lead: { color: 'bg-cyan-500', colorText: 'text-cyan-400', nombre: 'Lead' },
  pipeline: { color: 'bg-emerald-500', colorText: 'text-emerald-400', nombre: 'Pipeline' },
  alerta: { color: 'bg-red-500', colorText: 'text-red-400', nombre: 'Alerta' },
  info: { color: 'bg-blue-500', colorText: 'text-blue-400', nombre: 'Info' }
};

// ============== DATOS INICIALES ==============
const INITIAL_DATA = {
  clientes: [],
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
const ROLES = [
  { id: 'admin', name: 'Administrador', color: 'bg-violet-500' },
  { id: 'gerente', name: 'Gerente', color: 'bg-cyan-500' },
  { id: 'vendedor', name: 'Vendedor', color: 'bg-emerald-500' }
];

// ============== PERMISOS POR DEFECTO ==============
// Valores posibles para ver/editar/eliminar: 'todos', 'propios', false (no puede)
// Valores posibles para crear/subir: true, false

const PERMISOS_ADMIN = {
  modulos: {
    dashboard: true,
    clientes: true,
    pipeline: true,
    leads: true,
    calendario: true,
    tareas: true,
    reportes: true,
    archivos: true,
    auditlog: true,
    equipo: true
  },
  clientes: { ver: 'todos', crear: true, editar: 'todos', eliminar: 'todos' },
  pipeline: { ver: 'todos', crear: true, editar: 'todos', eliminar: 'todos' },
  leads: { ver: 'todos', crear: true, editar: 'todos', eliminar: 'todos' },
  actividades: { ver: 'todos', crear: true, editar: 'todos', eliminar: 'todos' },
  tareas: { ver: 'todos', crear: true, editar: 'todos', eliminar: 'todos' },
  recordatorios: { ver: 'todos', crear: true, editar: 'todos', eliminar: 'todos' },
  archivos: { ver: 'todos', subir: true, eliminar: 'todos' }
};

const PERMISOS_BASICOS = {
  modulos: {
    dashboard: true,
    clientes: true,
    pipeline: true,
    leads: true,
    calendario: true,
    tareas: true,
    reportes: false,
    archivos: true,
    auditlog: false,
    equipo: false
  },
  clientes: { ver: 'todos', crear: true, editar: 'propios', eliminar: false },
  pipeline: { ver: 'todos', crear: true, editar: 'propios', eliminar: false },
  leads: { ver: 'todos', crear: true, editar: 'propios', eliminar: false },
  actividades: { ver: 'propios', crear: true, editar: 'propios', eliminar: false },
  tareas: { ver: 'propios', crear: true, editar: 'propios', eliminar: 'propios' },
  recordatorios: { ver: 'propios', crear: true, editar: 'propios', eliminar: 'propios' },
  archivos: { ver: 'todos', subir: true, eliminar: false }
};

// ============== ROLES PREDEFINIDOS ==============
const ROLES_PREDEFINIDOS = [
  {
    id: 'admin',
    nombre: 'Administrador',
    descripcion: 'Acceso total al sistema',
    color: 'from-violet-500 to-purple-600',
    icon: Shield,
    permisos: {
      modulos: { dashboard: true, clientes: true, pipeline: true, leads: true, calendario: true, tareas: true, reportes: true, archivos: true, auditlog: true, equipo: true },
      clientes: { ver: 'todos', crear: true, editar: 'todos', eliminar: 'todos' },
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
      modulos: { dashboard: true, clientes: true, pipeline: true, leads: true, calendario: true, tareas: true, reportes: true, archivos: true, auditlog: true, equipo: false },
      clientes: { ver: 'todos', crear: true, editar: 'todos', eliminar: false },
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
    descripcion: 'Ve clientes/pipeline, edita solo lo suyo',
    color: 'from-emerald-500 to-green-600',
    icon: UserPlus,
    permisos: {
      modulos: { dashboard: true, clientes: true, pipeline: true, leads: true, calendario: true, tareas: true, reportes: false, archivos: true, auditlog: false, equipo: false },
      clientes: { ver: 'todos', crear: true, editar: 'propios', eliminar: false },
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
    descripcion: 'Atiende clientes existentes',
    color: 'from-amber-500 to-orange-600',
    icon: MessageSquare,
    permisos: {
      modulos: { dashboard: true, clientes: true, pipeline: false, leads: false, calendario: true, tareas: true, reportes: false, archivos: true, auditlog: false, equipo: false },
      clientes: { ver: 'todos', crear: false, editar: 'propios', eliminar: false },
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
      modulos: { dashboard: true, clientes: true, pipeline: true, leads: true, calendario: true, tareas: true, reportes: true, archivos: true, auditlog: false, equipo: false },
      clientes: { ver: 'todos', crear: false, editar: false, eliminar: false },
      pipeline: { ver: 'todos', crear: false, editar: false, eliminar: false },
      leads: { ver: 'todos', crear: false, editar: false, eliminar: false },
      actividades: { ver: 'todos', crear: false, editar: false, eliminar: false },
      tareas: { ver: 'todos', crear: false, editar: false, eliminar: false },
      recordatorios: { ver: 'todos', crear: false, editar: false, eliminar: false },
      archivos: { ver: 'todos', subir: false, eliminar: false }
    }
  }
];

// ============== MÓDULOS DE NAVEGACIÓN ==============
const MODULES = [
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
  { id: 'clientes', name: 'Clientes', icon: Building },
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
const TIPOS_ACTIVIDAD = [
  { id: 'llamada', name: 'Llamada', icon: PhoneCall, color: 'bg-emerald-500' },
  { id: 'whatsapp', name: 'WhatsApp', icon: MessageSquare, color: 'bg-green-500' },
  { id: 'zoom', name: 'Zoom', icon: Video, color: 'bg-blue-500' },
  { id: 'presencial', name: 'Reunión Presencial', icon: Users, color: 'bg-violet-500' },
  { id: 'email', name: 'Email', icon: Send, color: 'bg-cyan-500' },
  { id: 'nota', name: 'Nota', icon: FileText, color: 'bg-amber-500' }
];

// ============== TAGS DISPONIBLES ==============
const TAGS_DISPONIBLES = [
  { id: 'vip', name: 'VIP', color: 'bg-amber-500' },
  { id: 'nuevo', name: 'Nuevo', color: 'bg-emerald-500' },
  { id: 'seguimiento', name: 'Seguimiento', color: 'bg-cyan-500' },
  { id: 'en-riesgo', name: 'En Riesgo', color: 'bg-red-500' },
  { id: 'referido', name: 'Referido', color: 'bg-violet-500' },
  { id: 'grande', name: 'Cuenta Grande', color: 'bg-blue-500' }
];

// ============== FUENTES DE LEADS/CLIENTES ==============
const FUENTES = ['Referido', 'LinkedIn', 'Sitio Web', 'Evento', 'Cold Call', 'Email', 'Publicidad', 'Otro'];

// ============== ETAPAS DEL PIPELINE ==============
const PIPELINE_STAGES = [
  { id: 'prospecto', name: 'Prospecto', color: 'from-slate-500 to-slate-600', bg: 'bg-slate-500' },
  { id: 'contacto', name: 'Contacto Inicial', color: 'from-blue-500 to-blue-600', bg: 'bg-blue-500' },
  { id: 'diagnostico', name: 'Diagnóstico Enviado', color: 'from-cyan-500 to-cyan-600', bg: 'bg-cyan-500' },
  { id: 'piloto', name: 'Piloto en Curso', color: 'from-violet-500 to-violet-600', bg: 'bg-violet-500' },
  { id: 'negociacion', name: 'Negociación', color: 'from-amber-500 to-amber-600', bg: 'bg-amber-500' },
  { id: 'cerrado', name: 'Cerrado Ganado', color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-500' },
  { id: 'perdido', name: 'Perdido', color: 'from-red-500 to-red-600', bg: 'bg-red-500' }
];

// ============== INDUSTRIAS ==============
const INDUSTRIAS = [
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
const SERVICIOS = [
  'Supercompany',
  'Alicloud'
];

// ============== FIREBASE CONFIG ==============
const COLLECTION_NAME = 'eongroup-crm';
const DOC_ID = 'main-data';

// ============== COMPONENTE PRINCIPAL ==============
export default function App() {
  const [currentModule, setCurrentModule] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados de autenticación
  const [authUser, setAuthUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);

  // Estados de datos
  const [clientes, setClientes] = useState([]);
  const [leads, setLeads] = useState([]);
  const [pipeline, setPipeline] = useState([]);
  const [archivos, setArchivos] = useState([]);
  const [actividades, setActividades] = useState([]);
  const [recordatorios, setRecordatorios] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);
  const [industrias, setIndustrias] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false); // Protección contra pérdida de datos

  // Estados para el modal de email
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailDestinatario, setEmailDestinatario] = useState(null);

  // Estado para toast de notificaciones
  const [toastNotificacion, setToastNotificacion] = useState(null);

  // Escuchar estado de autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Cargar datos de Firebase al iniciar (solo si hay usuario autenticado)
  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        console.log('Cargando datos desde Firebase...');
        const docRef = doc(db, COLLECTION_NAME, DOC_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setClientes(data.clientes || []);
          setLeads(data.leads || []);
          setPipeline(data.pipeline || []);
          setArchivos(data.archivos || []);
          setActividades(data.actividades || []);
          setRecordatorios(data.recordatorios || []);
          setTareas(data.tareas || []);
          setUsuarios(data.usuarios || []);
          setNotificaciones(data.notificaciones || []);
          setIndustrias(data.industrias || []);
          setServicios(data.servicios || []);
          setAuditLog(data.auditLog || []);

          // Buscar usuario actual en la lista de usuarios (por UID primero, luego por email)
          let foundUser = (data.usuarios || []).find(u => u.id === authUser.uid)
                       || (data.usuarios || []).find(u => u.email === authUser.email);

          // Si no hay usuarios en el sistema O es el admin principal sin registro, crear como admin
          if (!foundUser && (!data.usuarios || data.usuarios.length === 0 || authUser.email === 'gustavo@eongroup.com')) {
            foundUser = {
              id: authUser.uid,
              nombre: authUser.displayName || authUser.email.split('@')[0],
              email: authUser.email,
              password: '(creado externamente)',
              activo: true,
              rol: 'admin',
              permisos: { ...PERMISOS_ADMIN },
              fechaCreacion: new Date().toISOString()
            };
            // Agregar el admin a usuarios existentes
            const existingUsers = data.usuarios || [];
            setUsuarios([...existingUsers, foundUser]);
          }

          if (foundUser) {
            // Verificar si el usuario está activo
            if (!foundUser.activo) {
              alert('Tu cuenta ha sido desactivada. Contacta al administrador.');
              await signOut(auth);
              setLoading(false);
              return;
            }
            // Si no tiene permisos (usuario antiguo), asignar según rol
            if (!foundUser.permisos) {
              foundUser.permisos = foundUser.rol === 'admin' ? { ...PERMISOS_ADMIN } : { ...PERMISOS_BASICOS };
            }
            setCurrentUser(foundUser);
          } else {
            // Usuario no registrado en el sistema - no permitir acceso
            alert('No tienes acceso al sistema. Contacta al administrador para que te registre.');
            await signOut(auth);
            setLoading(false);
            return;
          }
          console.log('Datos cargados correctamente');
          setDataLoaded(true);
        } else {
          // No hay datos previos - el primer usuario que entre será admin
          console.log('No hay datos previos, creando usuario inicial como admin');
          setDataLoaded(true);
          const newUser = {
            id: generateId(),
            email: authUser.email,
            nombre: authUser.displayName || authUser.email.split('@')[0],
            rol: 'admin',
            activo: true,
            fechaCreacion: new Date().toISOString(),
            permisos: { ...PERMISOS_ADMIN }
          };
          setUsuarios([newUser]);
          setCurrentUser(newUser);
        }
      } catch (error) {
        console.error('Error cargando datos:', error);
      }
      setLoading(false);
    };
    loadData();
  }, [authUser, authLoading]);

  // Guardar datos en Firebase cuando cambien
  useEffect(() => {
    // IMPORTANTE: No guardar hasta que los datos hayan sido cargados primero
    if (loading || !authUser || !dataLoaded) return;

    const saveData = async () => {
      setSaving(true);
      try {
        const data = limpiarUndefined({ clientes, leads, pipeline, archivos, actividades, recordatorios, tareas, usuarios, notificaciones, industrias, servicios, auditLog });
        await setDoc(doc(db, COLLECTION_NAME, DOC_ID), data);
        console.log('Datos guardados exitosamente');
      } catch (error) {
        console.error('Error guardando datos:', error);
        alert('Error al guardar: ' + error.message);
      }
      setSaving(false);
    };

    const timeoutId = setTimeout(saveData, 500);
    return () => clearTimeout(timeoutId);
  }, [clientes, leads, pipeline, archivos, actividades, recordatorios, tareas, usuarios, notificaciones, industrias, servicios, auditLog, loading, authUser, dataLoaded]);

  // Función para cerrar sesión
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setCurrentModule('dashboard');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // Función para agregar notificación
  const addNotificacion = (userId, mensaje, tipo = 'info', link = null, entidadNombre = null) => {
    const newNotif = {
      id: generateId(),
      userId,
      mensaje,
      tipo,
      link,
      entidadNombre,
      leida: false,
      fecha: new Date().toISOString()
    };
    setNotificaciones(prev => [newNotif, ...prev]);

    // Mostrar toast si la notificación es para el usuario actual
    if (userId === currentUser?.id) {
      setToastNotificacion(newNotif);
      // Auto-ocultar después de 5 segundos
      setTimeout(() => setToastNotificacion(null), 5000);
    }
  };

  // Obtener notificaciones del usuario actual
  const misNotificaciones = notificaciones.filter(n => n.userId === currentUser?.id && !n.leida);
  const todasMisNotificaciones = notificaciones.filter(n => n.userId === currentUser?.id);

  // Marcar notificación como leída
  const marcarLeida = (notifId) => {
    setNotificaciones(prev => prev.map(n =>
      n.id === notifId ? { ...n, leida: true } : n
    ));
  };

  // Marcar todas como leídas
  const marcarTodasLeidas = () => {
    setNotificaciones(prev => prev.map(n =>
      n.userId === currentUser?.id ? { ...n, leida: true } : n
    ));
  };

  // Función para agregar entrada al audit log
  const addAuditLog = (accion, modulo, detalles, entidadId = null, entidadNombre = null) => {
    const newEntry = {
      id: generateId(),
      accion,
      modulo,
      detalles,
      entidadId,
      entidadNombre,
      usuarioId: currentUser?.id,
      usuarioNombre: currentUser?.nombre || currentUser?.email,
      fecha: new Date().toISOString()
    };
    setAuditLog(prev => [newEntry, ...prev]);
  };

  // Función para agregar nueva industria
  const addIndustria = (nombre) => {
    if (!nombre.trim()) return false;
    const existe = [...INDUSTRIAS, ...industrias].some(
      i => i.toLowerCase() === nombre.trim().toLowerCase()
    );
    if (existe) return false;
    setIndustrias(prev => [...prev, nombre.trim()]);
    addAuditLog('crear', 'industrias', `Nueva industria agregada: ${nombre.trim()}`);
    return true;
  };

  // Combinar industrias predefinidas con personalizadas
  const todasLasIndustrias = [...INDUSTRIAS, ...industrias];

  // Función para agregar nuevo servicio
  const addServicio = (nombre) => {
    if (!nombre.trim()) return false;
    const existe = [...SERVICIOS, ...servicios].some(
      s => s.toLowerCase() === nombre.trim().toLowerCase()
    );
    if (existe) return false;
    setServicios(prev => [...prev, nombre.trim()]);
    addAuditLog('crear', 'servicios', `Nuevo servicio agregado: ${nombre.trim()}`);
    return true;
  };

  // Combinar servicios predefinidos con personalizados
  const todosLosServicios = [...SERVICIOS, ...servicios];

  // Render del módulo actual
  const renderModule = () => {
    switch (currentModule) {
      case 'dashboard':
        return <Dashboard clientes={clientes} leads={leads} pipeline={pipeline} recordatorios={recordatorios} setRecordatorios={setRecordatorios} tareas={tareas} setTareas={setTareas} setCurrentModule={setCurrentModule} currentUser={currentUser} usuarios={usuarios} actividades={actividades} />;
      case 'clientes':
        return <Clientes clientes={clientes} setClientes={setClientes} pipeline={pipeline} actividades={actividades} setActividades={setActividades} recordatorios={recordatorios} setRecordatorios={setRecordatorios} tareas={tareas} setTareas={setTareas} usuarios={usuarios} currentUser={currentUser} addNotificacion={addNotificacion} setEmailDestinatario={setEmailDestinatario} setEmailModalOpen={setEmailModalOpen} todasLasIndustrias={todasLasIndustrias} addIndustria={addIndustria} todosLosServicios={todosLosServicios} addServicio={addServicio} addAuditLog={addAuditLog} />;
      case 'pipeline':
        return <Pipeline pipeline={pipeline} setPipeline={setPipeline} clientes={clientes} setClientes={setClientes} actividades={actividades} setActividades={setActividades} recordatorios={recordatorios} setRecordatorios={setRecordatorios} tareas={tareas} setTareas={setTareas} usuarios={usuarios} currentUser={currentUser} addNotificacion={addNotificacion} setEmailDestinatario={setEmailDestinatario} setEmailModalOpen={setEmailModalOpen} todosLosServicios={todosLosServicios} addServicio={addServicio} addAuditLog={addAuditLog} />;
      case 'leads':
        return <Leads leads={leads} setLeads={setLeads} setPipeline={setPipeline} todasLasIndustrias={todasLasIndustrias} addIndustria={addIndustria} todosLosServicios={todosLosServicios} addServicio={addServicio} addAuditLog={addAuditLog} recordatorios={recordatorios} setRecordatorios={setRecordatorios} tareas={tareas} setTareas={setTareas} actividades={actividades} setActividades={setActividades} usuarios={usuarios} currentUser={currentUser} addNotificacion={addNotificacion} setEmailDestinatario={setEmailDestinatario} setEmailModalOpen={setEmailModalOpen} />;
      case 'calendario':
        return <Calendario actividades={actividades} recordatorios={recordatorios} tareas={tareas} clientes={clientes} pipeline={pipeline} leads={leads} setCurrentModule={setCurrentModule} currentUser={currentUser} usuarios={usuarios} />;
      case 'tareas':
        return <Tareas tareas={tareas} setTareas={setTareas} clientes={clientes} pipeline={pipeline} leads={leads} actividades={actividades} usuarios={usuarios} currentUser={currentUser} addNotificacion={addNotificacion} />;
      case 'reportes':
        return <Reportes clientes={clientes} leads={leads} pipeline={pipeline} actividades={actividades} usuarios={usuarios} />;
      case 'archivos':
        return <Archivos archivos={archivos} setArchivos={setArchivos} clientes={clientes} />;
      case 'auditlog':
        return <AuditLogView auditLog={auditLog} usuarios={usuarios} />;
      case 'equipo':
        return <Equipo usuarios={usuarios} setUsuarios={setUsuarios} currentUser={currentUser} />;
      default:
        return <Dashboard clientes={clientes} leads={leads} pipeline={pipeline} recordatorios={recordatorios} setRecordatorios={setRecordatorios} setCurrentModule={setCurrentModule} currentUser={currentUser} usuarios={usuarios} actividades={actividades} />;
    }
  };

  // Mostrar pantalla de carga
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-cyan-500 animate-spin"></div>
          </div>
          <p className="text-slate-400 text-lg">Cargando Grupo EÖN CRM...</p>
        </div>
      </div>
    );
  }

  // Mostrar pantalla de login si no hay usuario autenticado
  if (!authUser) {
    return <LoginScreen />;
  }

  // Filtrar módulos según permisos del usuario
  const modulosVisibles = MODULES.filter(m => {
    // Si el usuario tiene permisos definidos, usar esos
    if (currentUser?.permisos?.modulos) {
      return currentUser.permisos.modulos[m.id] === true;
    }
    // Fallback para usuarios sin permisos definidos (compatibilidad)
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-800 flex">
      {/* Fondo animado */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Notifications Dropdown */}
      {showNotifications && (
        <div className="fixed top-16 right-4 z-50 w-96 bg-slate-900 border-2 border-slate-400 rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-900">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <BellRing size={18} className="text-cyan-400" />
              Notificaciones
              {misNotificaciones.length > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">{misNotificaciones.length}</span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              {misNotificaciones.length > 0 && (
                <button
                  onClick={marcarTodasLeidas}
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Marcar todas leídas
                </button>
              )}
              <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {todasMisNotificaciones.length > 0 ? (
              todasMisNotificaciones.slice(0, 20).map(notif => {
                const tipoInfo = TIPOS_NOTIFICACION[notif.tipo] || TIPOS_NOTIFICACION.info;
                return (
                  <div
                    key={notif.id}
                    className={`p-4 border-b border-slate-800/50 hover:bg-slate-800/50 cursor-pointer transition-all ${notif.leida ? 'opacity-50' : 'bg-slate-800/30'}`}
                    onClick={() => !notif.leida && marcarLeida(notif.id)}
                  >
                    <div className="flex gap-3">
                      <div className={`w-10 h-10 rounded-xl ${tipoInfo.color} flex items-center justify-center flex-shrink-0`}>
                        {notif.tipo === 'tarea' && <Target size={18} className="text-white" />}
                        {notif.tipo === 'recordatorio' && <Bell size={18} className="text-white" />}
                        {notif.tipo === 'lead' && <UserPlus size={18} className="text-white" />}
                        {notif.tipo === 'pipeline' && <GitBranch size={18} className="text-white" />}
                        {notif.tipo === 'alerta' && <AlertCircle size={18} className="text-white" />}
                        {notif.tipo === 'info' && <MessageSquare size={18} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded ${tipoInfo.color} bg-opacity-20 ${tipoInfo.colorText}`}>
                            {tipoInfo.nombre}
                          </span>
                          {!notif.leida && <span className="w-2 h-2 bg-cyan-400 rounded-full"></span>}
                        </div>
                        <p className="text-sm text-white">{notif.mensaje}</p>
                        {notif.entidadNombre && (
                          <p className="text-xs text-slate-400 mt-1">{notif.entidadNombre}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">{tiempoRelativo(notif.fecha)}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-500">
                <Bell size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No hay notificaciones</p>
                <p className="text-xs mt-1 text-slate-600">Te avisaremos cuando haya novedades</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast de notificación nueva */}
      {toastNotificacion && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div className="bg-slate-900 border-2 border-cyan-500/50 rounded-xl shadow-2xl p-4 max-w-sm">
            <div className="flex gap-3 items-start">
              <div className={`w-10 h-10 rounded-xl ${TIPOS_NOTIFICACION[toastNotificacion.tipo]?.color || 'bg-blue-500'} flex items-center justify-center flex-shrink-0`}>
                <BellRing size={18} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-cyan-400 font-medium mb-1">Nueva notificación</p>
                <p className="text-sm text-white">{toastNotificacion.mensaje}</p>
              </div>
              <button
                onClick={() => setToastNotificacion(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:relative z-40 h-screen transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'} bg-slate-950 border-r border-slate-700`}>
        <div className="p-4 h-full flex flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-6">
            <img src="/logo-eon.png" alt="Grupo EÖN" className="w-10 h-10 rounded-xl object-cover" />
            {sidebarOpen && (
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">Grupo EÖN</h1>
                <p className="text-xs text-slate-500">CRM Platform</p>
              </div>
            )}
          </div>

          {/* Toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="absolute -right-3 top-20 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
          >
            <ChevronRight size={14} className={`transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* User Info */}
          {currentUser && (
            <div className={`mb-6 p-3 bg-slate-800/50 rounded-xl ${sidebarOpen ? '' : 'text-center'}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm">
                  {currentUser.nombre?.charAt(0).toUpperCase()}
                </div>
                {sidebarOpen && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{currentUser.nombre}</p>
                    <p className="text-xs text-slate-400 truncate">{ROLES.find(r => r.id === currentUser.rol)?.name}</p>
                  </div>
                )}
              </div>
              {sidebarOpen && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-sm relative transition-all ${
                      misNotificaciones.length > 0
                        ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-white border border-cyan-500/30 hover:border-cyan-400'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Bell size={16} className={misNotificaciones.length > 0 ? 'animate-pulse text-cyan-400' : ''} />
                    <span className="hidden sm:inline">Alertas</span>
                    {misNotificaciones.length > 0 && (
                      <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold animate-bounce">
                        {misNotificaciones.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-slate-700/50 rounded-xl text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-all text-sm"
                  >
                    <LogOut size={16} />
                    Salir
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto">
            {modulosVisibles.map((module) => {
              const Icon = module.icon;
              const isActive = currentModule === module.id;
              return (
                <button
                  key={module.id}
                  onClick={() => setCurrentModule(module.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-white border border-cyan-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Icon size={20} className={isActive ? 'text-cyan-400' : ''} />
                  {sidebarOpen && <span className="font-medium">{module.name}</span>}
                </button>
              );
            })}
          </nav>

          {/* Status */}
          <div className={`mt-auto pt-4 border-t border-slate-800 ${sidebarOpen ? '' : 'text-center'}`}>
            {saving ? (
              <div className="flex items-center gap-2 text-amber-400">
                <Loader size={16} className="animate-spin" />
                {sidebarOpen && <span className="text-sm">Guardando...</span>}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle size={16} />
                {sidebarOpen && <span className="text-sm">Sincronizado</span>}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative z-10 overflow-auto">
        <div className="p-6 lg:p-8">
          {renderModule()}
        </div>
      </main>

      {/* Chatbot Gemini AI */}
      <GeminiChatbot
        clientes={clientes}
        pipeline={pipeline}
        actividades={actividades}
        tareas={tareas}
        recordatorios={recordatorios}
        currentUser={currentUser}
      />

      {/* Modal de Email Composer */}
      <EmailComposer
        isOpen={emailModalOpen}
        onClose={() => { setEmailModalOpen(false); setEmailDestinatario(null); }}
        destinatario={emailDestinatario}
        currentUser={currentUser}
        onEmailSent={(emailData) => {
          // Registrar actividad de email enviado con correo completo
          const nuevaActividad = {
            id: generateId(),
            tipo: 'email',
            titulo: `Email: ${emailData.subject}`,
            descripcion: emailData.body,
            fecha: getFechaLocal(),
            fechaCreacion: new Date().toISOString(),
            clienteId: emailDestinatario?.clienteId || '',
            pipelineId: emailDestinatario?.pipelineId || '',
            responsableId: currentUser?.id,
            creadoPor: currentUser?.id,
            emailDestinatario: emailData.to,
            emailAsunto: emailData.subject,
            emailCuerpo: emailData.body
          };
          setActividades(prev => [...prev, nuevaActividad]);
        }}
      />
    </div>
  );
}

// ============== LOGIN SCREEN ==============
function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error('Auth error:', err);
      switch (err.code) {
        case 'auth/invalid-email':
          setError('Email inválido');
          break;
        case 'auth/user-disabled':
          setError('Usuario deshabilitado');
          break;
        case 'auth/user-not-found':
          setError('Usuario no encontrado. Contacta al administrador.');
          break;
        case 'auth/wrong-password':
          setError('Contraseña incorrecta');
          break;
        case 'auth/invalid-credential':
          setError('Credenciales inválidas. Verifica tu email y contraseña');
          break;
        default:
          setError('Error de autenticación: ' + err.message);
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center p-4">
      {/* Fondo animado */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo-eon.png" alt="Grupo EÖN" className="w-16 h-16 mx-auto rounded-2xl object-cover mb-4" />
          <h1 className="text-3xl font-bold text-white">Grupo EÖN CRM</h1>
          <p className="text-slate-400 mt-2">Gestiona tu equipo de ventas</p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border-2 border-slate-400 p-8">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">
            Iniciar Sesión
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  placeholder="tu@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-violet-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader size={18} className="animate-spin" />
                  Procesando...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              ¿No tienes cuenta? Contacta al administrador
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============== AUDIT LOG VIEW ==============
function AuditLogView({ auditLog, usuarios }) {
  const [filtroModulo, setFiltroModulo] = useState('');
  const [filtroAccion, setFiltroAccion] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const MODULOS = ['clientes', 'leads', 'pipeline', 'tareas', 'recordatorios', 'actividades', 'industrias', 'archivos', 'equipo'];
  const ACCIONES = ['crear', 'editar', 'eliminar', 'mover', 'completar'];

  const getAccionColor = (accion) => {
    switch (accion) {
      case 'crear': return 'bg-emerald-500/20 text-emerald-400';
      case 'editar': return 'bg-amber-500/20 text-amber-400';
      case 'eliminar': return 'bg-red-500/20 text-red-400';
      case 'mover': return 'bg-blue-500/20 text-blue-400';
      case 'completar': return 'bg-cyan-500/20 text-cyan-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const getModuloIcon = (modulo) => {
    switch (modulo) {
      case 'clientes': return Building;
      case 'leads': return UserPlus;
      case 'pipeline': return GitBranch;
      case 'tareas': return CheckCircle;
      case 'recordatorios': return Bell;
      case 'actividades': return History;
      case 'industrias': return Tag;
      case 'archivos': return FolderOpen;
      case 'equipo': return Users;
      default: return FileText;
    }
  };

  const filteredLog = auditLog.filter(entry => {
    if (filtroModulo && entry.modulo !== filtroModulo) return false;
    if (filtroAccion && entry.accion !== filtroAccion) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        entry.detalles?.toLowerCase().includes(search) ||
        entry.usuarioNombre?.toLowerCase().includes(search) ||
        entry.entidadNombre?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-500/20 to-cyan-500/20 rounded-xl">
              <History size={24} className="text-violet-400" />
            </div>
            Historial de Cambios
          </h1>
          <p className="text-slate-400 mt-1">Registro de todas las acciones realizadas en el sistema</p>
        </div>
        <div className="text-slate-400 text-sm">
          {filteredLog.length} registro{filteredLog.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" size={20} />
          <input
            type="text"
            placeholder="Buscar en el historial..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border-2 border-slate-400 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50"
          />
        </div>
        <select
          value={filtroModulo}
          onChange={(e) => setFiltroModulo(e.target.value)}
          className="px-4 py-3 bg-slate-900/50 border-2 border-slate-400 rounded-xl text-white focus:border-cyan-500/50"
        >
          <option value="">Todos los módulos</option>
          {MODULOS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
        </select>
        <select
          value={filtroAccion}
          onChange={(e) => setFiltroAccion(e.target.value)}
          className="px-4 py-3 bg-slate-900/50 border-2 border-slate-400 rounded-xl text-white focus:border-cyan-500/50"
        >
          <option value="">Todas las acciones</option>
          {ACCIONES.map(a => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
        </select>
      </div>

      {/* Lista de registros */}
      <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border-2 border-slate-400 overflow-hidden">
        {filteredLog.length === 0 ? (
          <div className="p-12 text-center">
            <History size={48} className="mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400">No hay registros en el historial</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filteredLog.map(entry => {
              const ModuloIcon = getModuloIcon(entry.modulo);
              return (
                <div key={entry.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-slate-800 rounded-lg">
                      <ModuloIcon size={20} className="text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getAccionColor(entry.accion)}`}>
                          {entry.accion?.toUpperCase()}
                        </span>
                        <span className="text-slate-500 text-xs px-2 py-0.5 bg-slate-800 rounded">
                          {entry.modulo}
                        </span>
                      </div>
                      <p className="text-white mt-1">{entry.detalles}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <User size={14} />
                          {entry.usuarioNombre || 'Sistema'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {formatDate(entry.fecha)} {new Date(entry.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============== EQUIPO ==============
function Equipo({ usuarios, setUsuarios, currentUser }) {
  const [showModal, setShowModal] = useState(false);
  const [showPermisosModal, setShowPermisosModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showPasswords, setShowPasswords] = useState({});
  const [creatingInFirebase, setCreatingInFirebase] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    passwordActual: '',
    rol: 'vendedor',
    permisos: { ...PERMISOS_BASICOS }
  });

  // Crear nuevo usuario
  const handleCreateUser = async () => {
    if (!formData.nombre || !formData.email || !formData.password) {
      setError('Completa todos los campos');
      return;
    }
    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setCreatingInFirebase(true);
    setError('');

    try {
      // Crear usuario en Firebase Auth usando instancia secundaria (no afecta sesión actual)
      await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
      // Cerrar sesión en la instancia secundaria
      await signOut(secondaryAuth);

      // Agregar a la lista local
      const newUser = {
        id: generateId(),
        nombre: formData.nombre,
        email: formData.email,
        password: formData.password,
        activo: true,
        fechaCreacion: new Date().toISOString(),
        permisos: { ...formData.permisos }
      };
      setUsuarios(prev => [...prev, newUser]);

      setShowModal(false);
      setIsCreating(false);
      setFormData({ nombre: '', email: '', password: '', passwordActual: '', rol: 'vendedor', permisos: { ...PERMISOS_BASICOS } });
    } catch (err) {
      console.error('Error creando usuario:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este email ya está registrado');
      } else {
        setError('Error al crear usuario: ' + err.message);
      }
    }
    setCreatingInFirebase(false);
  };

  // Guardar cambios de usuario (nombre, rol)
  const handleSaveUser = async () => {
    if (!formData.nombre) return;
    if (!formData.email) {
      setError('El email es obligatorio');
      return;
    }

    if (editingUser) {
      const emailChanged = editingUser.email !== formData.email;

      // Si cambió el email y es el usuario actual, re-autenticar y enviar verificación
      if (emailChanged && editingUser.id === currentUser?.id && auth.currentUser) {
        if (!formData.passwordActual) {
          setError('Ingresa tu contraseña actual para cambiar el email');
          return;
        }
        try {
          setCreatingInFirebase(true);
          // Re-autenticar con la contraseña actual
          const credential = EmailAuthProvider.credential(auth.currentUser.email, formData.passwordActual);
          await reauthenticateWithCredential(auth.currentUser, credential);
          // Ahora sí enviar verificación al nuevo email
          await verifyBeforeUpdateEmail(auth.currentUser, formData.email);
          alert('Se ha enviado un enlace de verificación a ' + formData.email + '. Una vez verificado, tu email se actualizará automáticamente.');
          setCreatingInFirebase(false);
          setShowModal(false);
          setEditingUser(null);
          setFormData({ nombre: '', email: '', password: '', passwordActual: '', rol: 'vendedor', permisos: { ...PERMISOS_BASICOS } });
          return;
        } catch (err) {
          console.error('Error:', err);
          if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
            setError('Contraseña incorrecta');
          } else if (err.code === 'auth/email-already-in-use') {
            setError('Este email ya está en uso por otra cuenta');
          } else if (err.code === 'auth/invalid-email') {
            setError('El email ingresado no es válido');
          } else {
            setError('Error: ' + err.message);
          }
          setCreatingInFirebase(false);
          return;
        }
      }

      setUsuarios(prev => prev.map(u =>
        u.id === editingUser.id ? { ...u, nombre: formData.nombre, email: formData.email } : u
      ));
    }
    setShowModal(false);
    setEditingUser(null);
    setFormData({ nombre: '', email: '', password: '', passwordActual: '', rol: 'vendedor', permisos: { ...PERMISOS_BASICOS } });
  };

  // Guardar permisos
  const handleSavePermisos = () => {
    if (editingUser) {
      setUsuarios(prev => prev.map(u =>
        u.id === editingUser.id ? { ...u, permisos: { ...formData.permisos } } : u
      ));
    }
    setShowPermisosModal(false);
    setEditingUser(null);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setIsCreating(false);
    setFormData({
      nombre: user.nombre,
      email: user.email,
      password: user.password || '',
      rol: user.rol,
      permisos: user.permisos || { ...PERMISOS_BASICOS }
    });
    setShowModal(true);
    setError('');
  };

  const handleEditPermisos = (user) => {
    setEditingUser(user);
    setFormData({
      ...formData,
      permisos: user.permisos || { ...PERMISOS_BASICOS }
    });
    setShowPermisosModal(true);
  };

  const handleNewUser = () => {
    setEditingUser(null);
    setIsCreating(true);
    setFormData({ nombre: '', email: '', password: '', passwordActual: '', rol: 'vendedor', permisos: { ...PERMISOS_BASICOS } });
    setShowModal(true);
    setError('');
  };

  const handleToggleActive = (userId) => {
    setUsuarios(prev => prev.map(u =>
      u.id === userId ? { ...u, activo: !u.activo } : u
    ));
  };

  const handleDeleteUser = (userId, userName) => {
    if (window.confirm(`¿Eliminar a ${userName} permanentemente?`)) {
      setUsuarios(prev => prev.filter(u => u.id !== userId));
    }
  };

  const toggleShowPassword = (userId) => {
    setShowPasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const togglePermiso = (categoria, permiso) => {
    if (categoria === 'modulos') {
      setFormData(prev => ({
        ...prev,
        permisos: {
          ...prev.permisos,
          modulos: {
            ...prev.permisos.modulos,
            [permiso]: !prev.permisos.modulos[permiso]
          }
        }
      }));
    } else if (categoria === 'alcance') {
      setFormData(prev => ({
        ...prev,
        permisos: {
          ...prev.permisos,
          alcance: prev.permisos.alcance === 'todos' ? 'propios' : 'todos'
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        permisos: {
          ...prev.permisos,
          [categoria]: {
            ...prev.permisos[categoria],
            [permiso]: !prev.permisos[categoria][permiso]
          }
        }
      }));
    }
  };

  const getRolColor = (rol) => {
    const found = ROLES.find(r => r.id === rol);
    return found?.color || 'bg-slate-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-cyan-400" />
            Equipo
          </h2>
          <p className="text-slate-400 mt-1">Gestiona los miembros de tu equipo y sus permisos</p>
        </div>
        <button
          onClick={handleNewUser}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={18} />
          Nuevo Usuario
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl border-2 border-slate-400 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <Users className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{usuarios.length}</p>
              <p className="text-sm text-slate-400">Total usuarios</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl border-2 border-slate-400 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{usuarios.filter(u => u.activo !== false).length}</p>
              <p className="text-sm text-slate-400">Activos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border-2 border-slate-400 overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h3 className="font-semibold text-white">Miembros del equipo</h3>
        </div>
        <div className="divide-y divide-slate-800">
          {usuarios.map(user => (
            <div key={user.id} className="p-4 hover:bg-slate-800/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center text-white font-bold text-lg ${user.activo === false ? 'opacity-50' : ''}`}>
                    {user.nombre?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className={`font-medium text-white ${user.activo === false ? 'opacity-50' : ''}`}>{user.nombre}</p>
                      {user.id === currentUser?.id && (
                        <span className="text-xs text-cyan-400">(Tú)</span>
                      )}
                    </div>
                    <p className={`text-sm text-slate-400 ${user.activo === false ? 'opacity-50' : ''}`}>{user.email}</p>
                    {/* Mostrar contraseña si es admin y no es él mismo */}
                    {currentUser?.permisos?.modulos?.equipo && user.password && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500">Contraseña:</span>
                        <span className="text-xs text-slate-400 font-mono">
                          {showPasswords[user.id] ? user.password : '••••••••'}
                        </span>
                        <button
                          onClick={() => toggleShowPassword(user.id)}
                          className="text-slate-500 hover:text-cyan-400 transition-colors"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {user.activo === false && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                      Inactivo
                    </span>
                  )}
                  {/* Botón para editar mi propio perfil */}
                  {user.id === currentUser?.id && (
                    <button
                      onClick={() => handleEditUser(user)}
                      className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-lg text-xs font-medium hover:bg-cyan-500/30 transition-colors flex items-center gap-1"
                    >
                      <Edit size={14} /> Editar mi perfil
                    </button>
                  )}
                  {currentUser?.permisos?.modulos?.equipo && user.id !== currentUser.id && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="p-2 text-slate-400 hover:text-cyan-400 transition-colors"
                        title="Editar datos"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleEditPermisos(user)}
                        className="p-2 text-slate-400 hover:text-violet-400 transition-colors"
                        title="Editar permisos"
                      >
                        <Shield size={16} />
                      </button>
                      <button
                        onClick={() => handleToggleActive(user.id)}
                        className={`p-2 transition-colors ${user.activo !== false ? 'text-slate-400 hover:text-amber-400' : 'text-slate-400 hover:text-emerald-400'}`}
                        title={user.activo !== false ? 'Desactivar' : 'Activar'}
                      >
                        {user.activo !== false ? <XCircle size={16} /> : <CheckCircle size={16} />}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id, user.nombre)}
                        className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                        title="Eliminar usuario"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                {isCreating ? 'Nuevo Usuario' : 'Editar Usuario'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Nombre</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                  placeholder="Nombre completo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                  placeholder="correo@empresa.com"
                />
                {!isCreating && editingUser?.email !== formData.email && (
                  <p className="text-xs text-amber-400 mt-1">Al cambiar el email, se enviará un enlace de verificación al nuevo correo</p>
                )}
              </div>
              {!isCreating && editingUser?.id === currentUser?.id && editingUser?.email !== formData.email && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Contraseña Actual</label>
                  <input
                    type="password"
                    value={formData.passwordActual}
                    onChange={(e) => setFormData({ ...formData, passwordActual: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                    placeholder="Ingresa tu contraseña actual"
                  />
                  <p className="text-xs text-slate-500 mt-1">Requerida para verificar tu identidad</p>
                </div>
              )}
              {isCreating && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Contraseña</label>
                  <input
                    type="text"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500 font-mono"
                    placeholder="Mínimo 6 caracteres"
                  />
                  <p className="text-xs text-slate-500 mt-1">La contraseña será visible para ti como administrador</p>
                </div>
              )}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-800 flex gap-3">
              <button
                onClick={isCreating ? handleCreateUser : handleSaveUser}
                disabled={creatingInFirebase}
                className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-violet-500 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creatingInFirebase ? (
                  <>
                    <Loader size={18} className="animate-spin" />
                    Creando...
                  </>
                ) : (
                  isCreating ? 'Crear Usuario' : 'Guardar'
                )}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permisos Modal - Nueva versión con alcance por acción */}
      {showPermisosModal && editingUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowPermisosModal(false)}>
          <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-violet-400" />
                Permisos de {editingUser.nombre}
              </h3>
              <button onClick={() => setShowPermisosModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto max-h-[65vh]">

              {/* Módulos - Pills clickeables */}
              <div>
                <p className="text-white font-medium mb-3">Acceso a módulos</p>
                <div className="flex flex-wrap gap-2">
                  {MODULES.map(mod => {
                    const isActive = formData.permisos?.modulos?.[mod.id];
                    const Icon = mod.icon;
                    return (
                      <button
                        key={mod.id}
                        onClick={() => togglePermiso('modulos', mod.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${isActive ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50' : 'bg-slate-800 text-slate-500 border border-slate-700 hover:border-slate-600'}`}
                      >
                        <Icon size={16} />
                        {mod.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Leyenda */}
              <div className="bg-slate-800/30 rounded-xl p-4">
                <p className="text-sm text-slate-400 mb-2">Valores de permisos:</p>
                <div className="flex flex-wrap gap-4 text-xs">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500"></span> Todos = puede con registros de cualquier usuario</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500"></span> Propios = solo registros que creó o tiene asignados</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-600"></span> No = no tiene este permiso</span>
                </div>
              </div>

              {/* Permisos por módulo - Nueva tabla con dropdowns */}
              <div>
                <p className="text-white font-medium mb-3">Permisos detallados</p>
                <div className="bg-slate-800/30 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left p-3 text-slate-400 font-medium">Módulo</th>
                        <th className="text-center p-3 text-slate-400 font-medium">Ver</th>
                        <th className="text-center p-3 text-slate-400 font-medium">Crear</th>
                        <th className="text-center p-3 text-slate-400 font-medium">Editar</th>
                        <th className="text-center p-3 text-slate-400 font-medium">Eliminar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { id: 'clientes', name: 'Clientes' },
                        { id: 'pipeline', name: 'Pipeline' },
                        { id: 'leads', name: 'Leads' },
                        { id: 'actividades', name: 'Actividades' },
                        { id: 'tareas', name: 'Tareas' },
                        { id: 'recordatorios', name: 'Recordatorios' }
                      ].map(modulo => {
                        const permisos = formData.permisos?.[modulo.id] || {};
                        return (
                          <tr key={modulo.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                            <td className="p-3 text-white">{modulo.name}</td>
                            {/* Ver */}
                            <td className="text-center p-2">
                              <select
                                value={permisos.ver || false}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  permisos: {
                                    ...prev.permisos,
                                    [modulo.id]: { ...prev.permisos?.[modulo.id], ver: e.target.value === 'false' ? false : e.target.value }
                                  }
                                }))}
                                className={`px-2 py-1.5 rounded-lg text-xs font-medium border-0 cursor-pointer ${
                                  permisos.ver === 'todos' ? 'bg-emerald-500/20 text-emerald-400' :
                                  permisos.ver === 'propios' ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-slate-700 text-slate-400'
                                }`}
                              >
                                <option value="todos">Todos</option>
                                <option value="propios">Propios</option>
                                <option value="false">No</option>
                              </select>
                            </td>
                            {/* Crear */}
                            <td className="text-center p-2">
                              <button
                                onClick={() => setFormData(prev => ({
                                  ...prev,
                                  permisos: {
                                    ...prev.permisos,
                                    [modulo.id]: { ...prev.permisos?.[modulo.id], crear: !prev.permisos?.[modulo.id]?.crear }
                                  }
                                }))}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                  permisos.crear ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                                }`}
                              >
                                {permisos.crear ? 'Sí' : 'No'}
                              </button>
                            </td>
                            {/* Editar */}
                            <td className="text-center p-2">
                              <select
                                value={permisos.editar || false}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  permisos: {
                                    ...prev.permisos,
                                    [modulo.id]: { ...prev.permisos?.[modulo.id], editar: e.target.value === 'false' ? false : e.target.value }
                                  }
                                }))}
                                className={`px-2 py-1.5 rounded-lg text-xs font-medium border-0 cursor-pointer ${
                                  permisos.editar === 'todos' ? 'bg-emerald-500/20 text-emerald-400' :
                                  permisos.editar === 'propios' ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-slate-700 text-slate-400'
                                }`}
                              >
                                <option value="todos">Todos</option>
                                <option value="propios">Propios</option>
                                <option value="false">No</option>
                              </select>
                            </td>
                            {/* Eliminar */}
                            <td className="text-center p-2">
                              <select
                                value={permisos.eliminar || false}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  permisos: {
                                    ...prev.permisos,
                                    [modulo.id]: { ...prev.permisos?.[modulo.id], eliminar: e.target.value === 'false' ? false : e.target.value }
                                  }
                                }))}
                                className={`px-2 py-1.5 rounded-lg text-xs font-medium border-0 cursor-pointer ${
                                  permisos.eliminar === 'todos' ? 'bg-emerald-500/20 text-emerald-400' :
                                  permisos.eliminar === 'propios' ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-slate-700 text-slate-400'
                                }`}
                              >
                                <option value="todos">Todos</option>
                                <option value="propios">Propios</option>
                                <option value="false">No</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                      {/* Archivos - caso especial */}
                      <tr className="hover:bg-slate-800/50">
                        <td className="p-3 text-white">Archivos</td>
                        <td className="text-center p-2">
                          <select
                            value={formData.permisos?.archivos?.ver || false}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              permisos: {
                                ...prev.permisos,
                                archivos: { ...prev.permisos?.archivos, ver: e.target.value === 'false' ? false : e.target.value }
                              }
                            }))}
                            className={`px-2 py-1.5 rounded-lg text-xs font-medium border-0 cursor-pointer ${
                              formData.permisos?.archivos?.ver === 'todos' ? 'bg-emerald-500/20 text-emerald-400' :
                              formData.permisos?.archivos?.ver === 'propios' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-slate-700 text-slate-400'
                            }`}
                          >
                            <option value="todos">Todos</option>
                            <option value="propios">Propios</option>
                            <option value="false">No</option>
                          </select>
                        </td>
                        <td className="text-center p-2">
                          <button
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              permisos: {
                                ...prev.permisos,
                                archivos: { ...prev.permisos?.archivos, subir: !prev.permisos?.archivos?.subir }
                              }
                            }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              formData.permisos?.archivos?.subir ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                            }`}
                          >
                            {formData.permisos?.archivos?.subir ? 'Sí' : 'No'}
                          </button>
                        </td>
                        <td className="text-center p-2 text-slate-600">-</td>
                        <td className="text-center p-2">
                          <select
                            value={formData.permisos?.archivos?.eliminar || false}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              permisos: {
                                ...prev.permisos,
                                archivos: { ...prev.permisos?.archivos, eliminar: e.target.value === 'false' ? false : e.target.value }
                              }
                            }))}
                            className={`px-2 py-1.5 rounded-lg text-xs font-medium border-0 cursor-pointer ${
                              formData.permisos?.archivos?.eliminar === 'todos' ? 'bg-emerald-500/20 text-emerald-400' :
                              formData.permisos?.archivos?.eliminar === 'propios' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-slate-700 text-slate-400'
                            }`}
                          >
                            <option value="todos">Todos</option>
                            <option value="propios">Propios</option>
                            <option value="false">No</option>
                          </select>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Acciones rápidas */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setFormData({ ...formData, permisos: { ...PERMISOS_ADMIN } })}
                  className="px-3 py-2 bg-violet-500/20 text-violet-400 rounded-lg text-xs hover:bg-violet-500/30"
                >
                  Dar acceso total (Admin)
                </button>
                <button
                  onClick={() => setFormData({ ...formData, permisos: { ...PERMISOS_BASICOS } })}
                  className="px-3 py-2 bg-amber-500/20 text-amber-400 rounded-lg text-xs hover:bg-amber-500/30"
                >
                  Vendedor (ve todo, edita propios)
                </button>
                <button
                  onClick={() => setFormData({ ...formData, permisos: {
                    modulos: { dashboard: true, clientes: true, pipeline: true, leads: true, calendario: true, tareas: true, reportes: true, archivos: true, auditlog: false, equipo: false },
                    clientes: { ver: 'todos', crear: false, editar: false, eliminar: false },
                    pipeline: { ver: 'todos', crear: false, editar: false, eliminar: false },
                    leads: { ver: 'todos', crear: false, editar: false, eliminar: false },
                    actividades: { ver: 'todos', crear: false, editar: false, eliminar: false },
                    tareas: { ver: 'todos', crear: false, editar: false, eliminar: false },
                    recordatorios: { ver: 'todos', crear: false, editar: false, eliminar: false },
                    archivos: { ver: 'todos', subir: false, eliminar: false }
                  }})}
                  className="px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-xs hover:bg-slate-600"
                >
                  Solo lectura
                </button>
              </div>
            </div>
            <div className="p-6 border-t border-slate-800 flex gap-3">
              <button
                onClick={handleSavePermisos}
                className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-violet-500 text-white rounded-xl font-medium hover:opacity-90"
              >
                Guardar Permisos
              </button>
              <button
                onClick={() => setShowPermisosModal(false)}
                className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== DASHBOARD ==============
function Dashboard({ clientes, leads, pipeline, recordatorios, setRecordatorios, tareas, setTareas, setCurrentModule, currentUser, usuarios, actividades }) {
  const totalClientes = clientes.length;
  const totalLeads = leads.length;
  const enPipeline = pipeline.filter(p => !['cerrado', 'perdido'].includes(p.etapa)).length;
  const cerradosGanados = pipeline.filter(p => p.etapa === 'cerrado').length;
  const valorPotencial = pipeline
    .filter(p => !['cerrado', 'perdido'].includes(p.etapa))
    .reduce((sum, p) => sum + (parseFloat(p.valorEstimado) || 0), 0);

  const actividadReciente = [
    ...pipeline.slice(-5).map(p => ({ tipo: 'pipeline', data: p, fecha: p.fechaCreacion })),
    ...leads.slice(-5).map(l => ({ tipo: 'lead', data: l, fecha: l.fechaCreacion })),
    ...clientes.slice(-5).map(c => ({ tipo: 'cliente', data: c, fecha: c.fechaCreacion }))
  ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 8);

  // Recordatorios pendientes (hoy o anteriores) - solo los del usuario actual
  const hoy = getFechaLocal();
  const recordatoriosPendientes = recordatorios
    .filter(r => !r.completado && r.fecha <= hoy && (r.responsableId === currentUser?.id || r.creadoPor === currentUser?.id || r.usuarioId === currentUser?.id))
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  const marcarCompletado = (id) => {
    setRecordatorios(recordatorios.map(r => r.id === id ? { ...r, completado: true } : r));
  };

  // Mis tareas pendientes
  const misTareasPendientes = (tareas || [])
    .filter(t => t.responsableId === currentUser?.id && !t.completada)
    .sort((a, b) => new Date(a.fechaCompromiso) - new Date(b.fechaCompromiso))
    .slice(0, 5);

  const misRecordatoriosPendientes = recordatorios
    .filter(r => r.responsableId === currentUser?.id && !r.completado)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
    .slice(0, 5);

  const totalTareasPendientes = misTareasPendientes.length + misRecordatoriosPendientes.length;

  const marcarTareaCompletada = (id) => {
    if (setTareas) {
      setTareas(tareas.map(t => t.id === id ? { ...t, completada: true } : t));
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-slate-400">Resumen de tu actividad comercial</p>
      </div>

      {/* Alertas de Recordatorios */}
      {recordatoriosPendientes.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 to-red-500/10 rounded-2xl p-4 border border-amber-500/30">
          <div className="flex items-center gap-3 mb-3">
            <Bell className="w-5 h-5 text-amber-400" />
            <h3 className="text-white font-semibold">Recordatorios Pendientes ({recordatoriosPendientes.length})</h3>
          </div>
          <div className="space-y-2">
            {recordatoriosPendientes.slice(0, 3).map(rec => {
              const cliente = clientes.find(c => c.id === rec.clienteId);
              const lead = leads.find(l => l.id === rec.leadId);
              const pipelineItem = pipeline.find(p => p.id === rec.pipelineId);
              const entidadNombre = cliente?.empresa || lead?.empresa || pipelineItem?.empresa || rec.leadNombre || 'Sin asociar';
              const esLead = rec.leadId || rec.leadNombre;
              return (
                <div key={rec.id} className="flex items-center justify-between bg-slate-900/50 rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <div>
                      <p className="text-white text-sm">{rec.titulo}</p>
                      <p className="text-slate-500 text-xs">
                        {esLead && <span className="text-violet-400">[Lead] </span>}
                        {entidadNombre} · {formatDate(rec.fecha)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => marcarCompletado(rec.id)}
                    className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-lg text-emerald-400 transition-all"
                  >
                    <CheckCircle size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mis Tareas Pendientes */}
      {totalTareasPendientes > 0 && (
        <div className="bg-gradient-to-r from-violet-500/10 to-cyan-500/10 rounded-2xl p-6 border border-violet-500/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Mis Tareas Pendientes</h3>
              <p className="text-slate-400 text-sm">{totalTareasPendientes} tarea{totalTareasPendientes !== 1 ? 's' : ''} asignada{totalTareasPendientes !== 1 ? 's' : ''} a ti</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Tareas Pendientes */}
            {misTareasPendientes.length > 0 && (
              <div className="bg-slate-900/50 rounded-xl p-4">
                <h4 className="text-sm font-medium text-cyan-400 mb-3 flex items-center gap-2">
                  <Target size={14} />
                  Tareas ({misTareasPendientes.length})
                </h4>
                <div className="space-y-2">
                  {misTareasPendientes.map(tarea => {
                    const cliente = clientes.find(c => c.id === tarea.clienteId);
                    const pipelineItem = pipeline.find(p => p.id === tarea.pipelineId);
                    const lead = leads.find(l => l.id === tarea.leadId);
                    const entidadNombre = cliente?.empresa || pipelineItem?.empresa || lead?.empresa || tarea.leadNombre || 'Sin asociar';
                    const esLead = tarea.leadId || tarea.leadNombre;
                    const esHoy = tarea.fechaCompromiso === hoy;
                    const esPasado = tarea.fechaCompromiso < hoy;
                    return (
                      <div key={tarea.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-all">
                        <div className={`w-8 h-8 rounded-lg ${esPasado ? 'bg-red-500' : tarea.prioridad === 'alta' ? 'bg-red-500' : tarea.prioridad === 'media' ? 'bg-amber-500' : 'bg-blue-500'} flex items-center justify-center`}>
                          <Target size={14} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm truncate">{tarea.descripcion}</p>
                          <p className="text-slate-500 text-xs">
                            {esLead && <span className="text-violet-400">[Lead] </span>}
                            {entidadNombre} ·
                            <span className={esPasado ? ' text-red-400' : esHoy ? ' text-amber-400' : ''}>
                              {' '}Compromiso: {esHoy ? 'Hoy' : esPasado ? `Vencido (${formatDate(tarea.fechaCompromiso)})` : formatDate(tarea.fechaCompromiso)}
                            </span>
                          </p>
                          {tarea.fechaCreacion && (
                            <p className="text-slate-600 text-xs">Creada: {new Date(tarea.fechaCreacion).toLocaleDateString('es-MX')}</p>
                          )}
                        </div>
                        <button
                          onClick={() => marcarTareaCompletada(tarea.id)}
                          className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-lg text-emerald-400 transition-all"
                        >
                          <CheckCircle size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recordatorios Pendientes */}
            {misRecordatoriosPendientes.length > 0 && (
              <div className="bg-slate-900/50 rounded-xl p-4">
                <h4 className="text-sm font-medium text-amber-400 mb-3 flex items-center gap-2">
                  <Bell size={14} />
                  Recordatorios ({misRecordatoriosPendientes.length})
                </h4>
                <div className="space-y-2">
                  {misRecordatoriosPendientes.map(rec => {
                    const cliente = clientes.find(c => c.id === rec.clienteId);
                    const pipelineItem = pipeline.find(p => p.id === rec.pipelineId);
                    const lead = leads.find(l => l.id === rec.leadId);
                    const entidadNombre = cliente?.empresa || pipelineItem?.empresa || lead?.empresa || rec.leadNombre || 'Sin asociar';
                    const esLead = rec.leadId || rec.leadNombre;
                    const esHoy = rec.fecha === hoy;
                    const esPasado = rec.fecha < hoy;
                    return (
                      <div key={rec.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-all">
                        <div className={`w-8 h-8 rounded-lg ${esPasado ? 'bg-red-500' : esHoy ? 'bg-amber-500' : 'bg-slate-600'} flex items-center justify-center`}>
                          <Bell size={14} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm truncate">{rec.titulo}</p>
                          <p className="text-slate-500 text-xs">
                            {esLead && <span className="text-violet-400">[Lead] </span>}
                            {entidadNombre} ·
                            <span className={esPasado ? ' text-red-400' : esHoy ? ' text-amber-400' : ''}>
                              {esHoy ? ' Hoy' : esPasado ? ' Vencido' : ` ${formatDate(rec.fecha)}`}
                            </span>
                          </p>
                        </div>
                        <button
                          onClick={() => marcarCompletado(rec.id)}
                          className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-lg text-emerald-400 transition-all"
                        >
                          <CheckCircle size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="group relative bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400 hover:border-cyan-500/50 transition-all cursor-pointer" onClick={() => setCurrentModule('clientes')}>
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-4">
              <Building className="w-6 h-6 text-cyan-400" />
            </div>
            <p className="text-3xl font-bold text-white mb-1">{totalClientes}</p>
            <p className="text-slate-400 text-sm">Clientes Activos</p>
          </div>
        </div>

        <div className="group relative bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400 hover:border-violet-500/50 transition-all cursor-pointer" onClick={() => setCurrentModule('leads')}>
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center mb-4">
              <UserPlus className="w-6 h-6 text-violet-400" />
            </div>
            <p className="text-3xl font-bold text-white mb-1">{totalLeads}</p>
            <p className="text-slate-400 text-sm">Leads</p>
          </div>
        </div>

        <div className="group relative bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400 hover:border-amber-500/50 transition-all cursor-pointer" onClick={() => setCurrentModule('pipeline')}>
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4">
              <GitBranch className="w-6 h-6 text-amber-400" />
            </div>
            <p className="text-3xl font-bold text-white mb-1">{enPipeline}</p>
            <p className="text-slate-400 text-sm">En Pipeline</p>
          </div>
        </div>

        <div className="group relative bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400 hover:border-emerald-500/50 transition-all">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-3xl font-bold text-white mb-1">{cerradosGanados}</p>
            <p className="text-slate-400 text-sm">Cerrados Ganados</p>
          </div>
        </div>
      </div>

      {/* Valor Potencial */}
      {valorPotencial > 0 && (
        <div className="bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-cyan-500/10 rounded-2xl p-6 border border-cyan-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm mb-1">Valor potencial en pipeline</p>
              <p className="text-4xl font-bold text-white">
                ${valorPotencial.toLocaleString('es-MX')} <span className="text-lg text-slate-400">USD/año</span>
              </p>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center">
              <DollarSign className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline por Etapa */}
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
          <h3 className="text-lg font-semibold text-white mb-4">Pipeline por Etapa</h3>
          <div className="space-y-3">
            {PIPELINE_STAGES.filter(s => s.id !== 'perdido').map(stage => {
              const count = pipeline.filter(p => p.etapa === stage.id).length;
              const percentage = pipeline.length > 0 ? (count / pipeline.length) * 100 : 0;
              return (
                <div key={stage.id} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${stage.bg}`}></div>
                  <span className="text-slate-400 text-sm flex-1">{stage.name}</span>
                  <span className="text-white font-medium">{count}</span>
                  <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${stage.bg} transition-all`} style={{ width: `${percentage}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actividad Reciente */}
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
          <h3 className="text-lg font-semibold text-white mb-4">Actividad Reciente</h3>
          <div className="space-y-3">
            {actividadReciente.length === 0 ? (
              <p className="text-slate-500 text-center py-4">Sin actividad reciente</p>
            ) : (
              actividadReciente.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/50 transition-all">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    item.tipo === 'cliente' ? 'bg-cyan-500/20' :
                    item.tipo === 'lead' ? 'bg-violet-500/20' : 'bg-amber-500/20'
                  }`}>
                    {item.tipo === 'cliente' ? <Building size={18} className="text-cyan-400" /> :
                     item.tipo === 'lead' ? <UserPlus size={18} className="text-violet-400" /> :
                     <GitBranch size={18} className="text-amber-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {item.data.nombre || item.data.empresa}
                    </p>
                    <p className="text-slate-500 text-xs">
                      {item.tipo === 'cliente' ? 'Nuevo cliente' :
                       item.tipo === 'lead' ? 'Nuevo lead' : 'Pipeline actualizado'}
                    </p>
                  </div>
                  <span className="text-slate-500 text-xs">{formatDate(item.fecha)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============== CLIENTES ==============
function Clientes({ clientes, setClientes, pipeline, actividades, setActividades, recordatorios, setRecordatorios, tareas, setTareas, usuarios, currentUser, addNotificacion, setEmailDestinatario, setEmailModalOpen, todasLasIndustrias, addIndustria, todosLosServicios, addServicio, addAuditLog }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [showActividadForm, setShowActividadForm] = useState(false);
  const [showRecordatorioForm, setShowRecordatorioForm] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [form, setForm] = useState({
    empresa: '', contacto: '', cargo: '', email: '', telefono: '',
    industria: '', servicio: '', sitioWeb: '', direccion: '', notas: '', numeroEmpleados: '', tags: [], asignadoA: '',
    fuente: '', referidoPor: '', esComisionista: false
  });
  const [actividadForm, setActividadForm] = useState({
    tipo: 'llamada', titulo: '', descripcion: '', fecha: getFechaLocal(), responsableId: ''
  });
  const [actividadArchivo, setActividadArchivo] = useState(null);
  const [subiendoActividad, setSubiendoActividad] = useState(false);
  const [recordatorioForm, setRecordatorioForm] = useState({
    titulo: '', fecha: '', descripcion: '', responsableId: ''
  });
  // Estados para edición
  const [editingActividad, setEditingActividad] = useState(null);
  const [viewingActividad, setViewingActividad] = useState(null);
  const [editingRecordatorio, setEditingRecordatorio] = useState(null);
  // Estados para tareas
  const [showTareaForm, setShowTareaForm] = useState(false);
  const [editingTarea, setEditingTarea] = useState(null);
  const [tareaFormData, setTareaFormData] = useState({ descripcion: '', fechaCompromiso: '', prioridad: 'media', responsableId: '' });
  // Tareas y recordatorios derivados de actividad
  const [tareasNuevas, setTareasNuevas] = useState([]);
  const [recordatoriosNuevos, setRecordatoriosNuevos] = useState([]);
  const [mostrarFormTarea, setMostrarFormTarea] = useState(false);
  const [mostrarFormRecordatorioNuevo, setMostrarFormRecordatorioNuevo] = useState(false);
  const [tareaTemp, setTareaTemp] = useState({ descripcion: '', fechaCompromiso: '', prioridad: 'media', responsableId: '' });
  const [recordatorioTemp, setRecordatorioTemp] = useState({ titulo: '', fecha: '', descripcion: '', responsableId: '' });
  const [editandoTareaExistenteId, setEditandoTareaExistenteId] = useState(null);
  const [editandoRecordatorioExistenteId, setEditandoRecordatorioExistenteId] = useState(null);
  const [showNewIndustria, setShowNewIndustria] = useState(false);
  const [newIndustriaName, setNewIndustriaName] = useState('');
  const [showNewServicio, setShowNewServicio] = useState(false);
  const [newServicioName, setNewServicioName] = useState('');

  // Usuarios activos para asignar
  const usuariosActivos = (usuarios || []).filter(u => u.activo !== false);

  // Permisos del usuario actual para clientes (fallback a permisos básicos, no admin)
  // Nueva estructura: ver/editar/eliminar pueden ser 'todos', 'propios', o false
  const permisos = currentUser?.permisos?.clientes || { ver: 'todos', crear: true, editar: 'propios', eliminar: false };
  const permisosActividades = currentUser?.permisos?.actividades || { ver: 'todos', crear: true, editar: 'propios', eliminar: false };
  const permisosTareas = currentUser?.permisos?.tareas || { ver: 'todos', crear: true, editar: 'propios', eliminar: 'propios' };
  const permisosRecordatorios = currentUser?.permisos?.recordatorios || { ver: 'todos', crear: true, editar: 'propios', eliminar: 'propios' };

  const puedeCrear = permisos.crear === true;
  const esAdmin = currentUser?.permisos?.modulos?.equipo === true;

  // Función para verificar si puede editar un cliente específico
  const puedeEditarCliente = (cliente) => {
    if (!cliente) return false;
    // Admin siempre puede editar
    if (esAdmin) return true;
    // Permitir si tiene permisos de editar todos o legacy true
    if (permisos.editar === 'todos' || permisos.editar === true) return true;
    // Si es 'propios', verificar que el cliente sea suyo
    if (permisos.editar === 'propios') {
      return cliente.asignadoA === currentUser?.id || cliente.creadoPor === currentUser?.id;
    }
    // En cualquier otro caso (false, undefined, etc), no permitir
    return false;
  };

  // Función para verificar si puede eliminar un cliente específico
  const puedeEliminarCliente = (cliente) => {
    if (!cliente) return false;
    // Admin siempre puede eliminar
    if (esAdmin) return true;
    // Permitir si tiene permisos de eliminar todos o legacy true
    if (permisos.eliminar === 'todos' || permisos.eliminar === true) return true;
    // Si es 'propios', verificar que el cliente sea suyo
    if (permisos.eliminar === 'propios') {
      return cliente.asignadoA === currentUser?.id || cliente.creadoPor === currentUser?.id;
    }
    // En cualquier otro caso (false, undefined, etc), no permitir
    return false;
  };

  // Funciones para actividades
  const puedeVerActividad = (actividad) => {
    if (esAdmin) return true;
    if (permisosActividades.ver === 'todos' || permisosActividades.ver === true) return true;
    if (permisosActividades.ver === 'propios') {
      return actividad.creadoPor === currentUser?.id || actividad.responsableId === currentUser?.id;
    }
    return false;
  };

  const puedeEditarActividad = (actividad) => {
    if (!actividad) return false;
    if (esAdmin) return true;
    if (permisosActividades.editar === 'todos' || permisosActividades.editar === true) return true;
    if (permisosActividades.editar === 'propios') {
      return actividad.creadoPor === currentUser?.id || actividad.responsableId === currentUser?.id;
    }
    return false;
  };

  const puedeEliminarActividad = (actividad) => {
    if (!actividad) return false;
    if (esAdmin) return true;
    if (permisosActividades.eliminar === 'todos' || permisosActividades.eliminar === true) return true;
    if (permisosActividades.eliminar === 'propios') {
      return actividad.creadoPor === currentUser?.id || actividad.responsableId === currentUser?.id;
    }
    return false;
  };

  // Funciones para tareas
  const puedeVerTarea = (tarea) => {
    if (esAdmin) return true;
    if (permisosTareas.ver === 'todos' || permisosTareas.ver === true) return true;
    if (permisosTareas.ver === 'propios') {
      return tarea.creadoPor === currentUser?.id || tarea.responsableId === currentUser?.id;
    }
    return false;
  };

  const puedeEditarTarea = (tarea) => {
    if (!tarea) return false;
    if (esAdmin) return true;
    if (permisosTareas.editar === 'todos' || permisosTareas.editar === true) return true;
    if (permisosTareas.editar === 'propios') {
      return tarea.creadoPor === currentUser?.id || tarea.responsableId === currentUser?.id;
    }
    return false;
  };

  const puedeEliminarTarea = (tarea) => {
    if (!tarea) return false;
    if (esAdmin) return true;
    if (permisosTareas.eliminar === 'todos' || permisosTareas.eliminar === true) return true;
    if (permisosTareas.eliminar === 'propios') {
      return tarea.creadoPor === currentUser?.id || tarea.responsableId === currentUser?.id;
    }
    return false;
  };

  // Funciones para recordatorios
  const puedeVerRecordatorio = (recordatorio) => {
    if (esAdmin) return true;
    if (permisosRecordatorios.ver === 'todos' || permisosRecordatorios.ver === true) return true;
    if (permisosRecordatorios.ver === 'propios') {
      return recordatorio.creadoPor === currentUser?.id || recordatorio.responsableId === currentUser?.id;
    }
    return false;
  };

  const puedeEditarRecordatorio = (recordatorio) => {
    if (!recordatorio) return false;
    if (esAdmin) return true;
    if (permisosRecordatorios.editar === 'todos' || permisosRecordatorios.editar === true) return true;
    if (permisosRecordatorios.editar === 'propios') {
      return recordatorio.creadoPor === currentUser?.id || recordatorio.responsableId === currentUser?.id;
    }
    return false;
  };

  const puedeEliminarRecordatorio = (recordatorio) => {
    if (!recordatorio) return false;
    if (esAdmin) return true;
    if (permisosRecordatorios.eliminar === 'todos' || permisosRecordatorios.eliminar === true) return true;
    if (permisosRecordatorios.eliminar === 'propios') {
      return recordatorio.creadoPor === currentUser?.id || recordatorio.responsableId === currentUser?.id;
    }
    return false;
  };

  // Manejar agregar nueva industria
  const handleAddIndustria = () => {
    if (addIndustria(newIndustriaName)) {
      setForm({ ...form, industria: newIndustriaName.trim() });
      setNewIndustriaName('');
      setShowNewIndustria(false);
    }
  };

  // Manejar agregar nuevo servicio
  const handleAddServicio = () => {
    if (addServicio(newServicioName)) {
      setForm({ ...form, servicio: newServicioName.trim() });
      setNewServicioName('');
      setShowNewServicio(false);
    }
  };

  const resetForm = () => {
    setForm({ empresa: '', contacto: '', cargo: '', email: '', telefono: '', industria: '', servicio: '', sitioWeb: '', direccion: '', notas: '', numeroEmpleados: '', tags: [], fuente: '', referidoPor: '', esComisionista: false });
    setShowForm(false);
    setEditingId(null);
    setShowNewIndustria(false);
    setNewIndustriaName('');
    setShowNewServicio(false);
    setNewServicioName('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Asegurar que no haya valores undefined
    const cleanForm = {
      empresa: form.empresa || '',
      contacto: form.contacto || '',
      cargo: form.cargo || '',
      email: form.email || '',
      telefono: form.telefono || '',
      industria: form.industria || '',
      servicio: form.servicio || '',
      sitioWeb: form.sitioWeb || '',
      direccion: form.direccion || '',
      notas: form.notas || '',
      numeroEmpleados: form.numeroEmpleados || '',
      tags: form.tags || [],
      fuente: form.fuente || '',
      referidoPor: form.referidoPor || '',
      esComisionista: form.esComisionista || false
    };
    if (editingId) {
      setClientes(clientes.map(c => c.id === editingId ? { id: c.id, fechaCreacion: c.fechaCreacion || '', creadoPor: c.creadoPor, ...cleanForm, asignadoA: form.asignadoA || c.asignadoA || currentUser?.id } : c));
      addAuditLog('editar', 'clientes', `Cliente editado: ${cleanForm.empresa}`, editingId, cleanForm.empresa);
    } else {
      const nuevoCliente = { ...cleanForm, id: generateId(), fechaCreacion: getFechaLocal(), creadoPor: currentUser?.id, asignadoA: form.asignadoA || currentUser?.id };
      setClientes([...clientes, nuevoCliente]);
      addAuditLog('crear', 'clientes', `Nuevo cliente: ${cleanForm.empresa}`, nuevoCliente.id, cleanForm.empresa);
    }
    resetForm();
  };

  const handleEdit = (cliente) => {
    // Asegurar valores por defecto para campos que puedan no existir
    setForm({
      empresa: cliente.empresa || '',
      contacto: cliente.contacto || '',
      cargo: cliente.cargo || '',
      email: cliente.email || '',
      telefono: cliente.telefono || '',
      industria: cliente.industria || '',
      servicio: cliente.servicio || '',
      sitioWeb: cliente.sitioWeb || '',
      direccion: cliente.direccion || '',
      notas: cliente.notas || '',
      numeroEmpleados: cliente.numeroEmpleados || '',
      tags: cliente.tags || [],
      asignadoA: cliente.asignadoA || '',
      fuente: cliente.fuente || '',
      referidoPor: cliente.referidoPor || '',
      esComisionista: cliente.esComisionista || false
    });
    setEditingId(cliente.id);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('¿Eliminar este cliente?')) {
      setClientes(clientes.filter(c => c.id !== id));
    }
  };

  const toggleTag = (tagId) => {
    const currentTags = form.tags || [];
    if (currentTags.includes(tagId)) {
      setForm({ ...form, tags: currentTags.filter(t => t !== tagId) });
    } else {
      setForm({ ...form, tags: [...currentTags, tagId] });
    }
  };

  const handleAddActividad = async (e) => {
    e.preventDefault();
    setSubiendoActividad(true);

    try {
      let archivoData = null;

      // Subir archivo si existe
      if (actividadArchivo) {
        const timestamp = Date.now();
        const fileName = `actividades/${selectedCliente}/${timestamp}_${actividadArchivo.name}`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, actividadArchivo);
        const url = await getDownloadURL(storageRef);
        archivoData = {
          nombre: actividadArchivo.name,
          tipo: actividadArchivo.type,
          tamano: actividadArchivo.size,
          url
        };
      }

      const cliente = clientes.find(c => c.id === selectedCliente);
      const responsableId = actividadForm.responsableId || currentUser?.id;

      let actividadId;

      if (editingActividad) {
        // Modo edición
        actividadId = editingActividad.id;
        setActividades(actividades.map(a => a.id === editingActividad.id ? {
          ...a,
          ...actividadForm,
          responsableId,
          archivo: archivoData || a.archivo
        } : a));
        setEditingActividad(null);
      } else {
        // Nueva actividad
        actividadId = generateId();
        const nuevaActividad = {
          ...actividadForm,
          id: actividadId,
          clienteId: selectedCliente,
          responsableId,
          creadoPor: currentUser?.id,
          fechaCreacion: new Date().toISOString(),
          archivo: archivoData
        };
        setActividades([...actividades, nuevaActividad]);

        // Notificar al responsable si es diferente al usuario actual
        if (responsableId && responsableId !== currentUser?.id && addNotificacion) {
          addNotificacion(
            responsableId,
            `Nueva actividad asignada: ${actividadForm.descripcion || actividadForm.tipo} - Cliente: ${cliente?.empresa || 'Cliente'}`,
            'actividad'
          );
        }
      }

      // Crear tareas derivadas de la actividad
      if (tareasNuevas.length > 0) {
        const nuevasTareasCompletas = tareasNuevas.map(t => ({
          id: generateId(),
          descripcion: t.descripcion,
          fechaCompromiso: t.fechaCompromiso,
          prioridad: t.prioridad,
          responsableId: t.responsableId || currentUser?.id,
          clienteId: selectedCliente,
          actividadId: actividadId,
          completada: false,
          fechaCreacion: new Date().toISOString(),
          creadoPor: currentUser?.id
        }));
        setTareas(prev => [...prev, ...nuevasTareasCompletas]);

        nuevasTareasCompletas.forEach(tarea => {
          if (tarea.responsableId && tarea.responsableId !== currentUser?.id && addNotificacion) {
            addNotificacion(tarea.responsableId, `Nueva tarea asignada: ${tarea.descripcion}`, 'tarea');
          }
        });
      }

      // Crear recordatorios derivados de la actividad
      if (recordatoriosNuevos.length > 0) {
        const nuevosRecordatoriosCompletos = recordatoriosNuevos.map(r => ({
          id: generateId(),
          titulo: r.titulo,
          descripcion: r.descripcion,
          fecha: r.fecha,
          responsableId: r.responsableId || currentUser?.id,
          clienteId: selectedCliente,
          actividadId: actividadId,
          completado: false,
          fechaCreacion: new Date().toISOString(),
          creadoPor: currentUser?.id
        }));
        setRecordatorios(prev => [...prev, ...nuevosRecordatoriosCompletos]);

        nuevosRecordatoriosCompletos.forEach(rec => {
          if (rec.responsableId && rec.responsableId !== currentUser?.id && addNotificacion) {
            addNotificacion(rec.responsableId, `Nuevo recordatorio asignado: ${rec.titulo}`, 'recordatorio');
          }
        });
      }

      setActividadForm({ tipo: 'llamada', titulo: '', descripcion: '', fecha: getFechaLocal(), responsableId: '' });
      setActividadArchivo(null);
      setTareasNuevas([]);
      setRecordatoriosNuevos([]);
      setShowActividadForm(false);
    } catch (error) {
      console.error('Error al guardar actividad:', error);
      alert('Error al guardar: ' + error.message);
    }
    setSubiendoActividad(false);
  };

  const handleEditActividad = (actividad) => {
    setActividadForm({
      tipo: actividad.tipo,
      titulo: actividad.titulo,
      descripcion: actividad.descripcion || '',
      fecha: actividad.fecha,
      responsableId: actividad.responsableId || ''
    });
    setEditingActividad(actividad);
    setShowActividadForm(true);
  };

  const handleDeleteActividad = (id) => {
    const tareasVinculadas = (tareas || []).filter(t => t.actividadId === id);
    const recordatoriosVinculados = recordatorios.filter(r => r.actividadId === id);
    const tieneVinculados = tareasVinculadas.length > 0 || recordatoriosVinculados.length > 0;

    const mensaje = tieneVinculados
      ? `¿Eliminar esta actividad?\n\nTambién se eliminarán:\n- ${tareasVinculadas.length} tarea(s)\n- ${recordatoriosVinculados.length} recordatorio(s)\n\nvinculados a esta actividad.`
      : '¿Eliminar esta actividad?';

    if (window.confirm(mensaje)) {
      setActividades(actividades.filter(a => a.id !== id));
      if (tareasVinculadas.length > 0) {
        setTareas(tareas.filter(t => t.actividadId !== id));
      }
      if (recordatoriosVinculados.length > 0) {
        setRecordatorios(recordatorios.filter(r => r.actividadId !== id));
      }
    }
  };

  const handleAddRecordatorio = (e) => {
    e.preventDefault();
    const cliente = clientes.find(c => c.id === selectedCliente);
    const responsableId = recordatorioForm.responsableId || currentUser?.id;

    if (editingRecordatorio) {
      // Modo edición
      setRecordatorios(recordatorios.map(r => r.id === editingRecordatorio.id ? {
        ...r,
        ...recordatorioForm,
        responsableId
      } : r));
      setEditingRecordatorio(null);
    } else {
      // Nuevo recordatorio
      const nuevoRecordatorio = {
        ...recordatorioForm,
        id: generateId(),
        clienteId: selectedCliente,
        responsableId,
        creadoPor: currentUser?.id,
        completado: false,
        fechaCreacion: new Date().toISOString()
      };
      setRecordatorios([...recordatorios, nuevoRecordatorio]);

      // Notificar al responsable si es diferente al usuario actual
      if (responsableId && responsableId !== currentUser?.id && addNotificacion) {
        addNotificacion(
          responsableId,
          `Nuevo recordatorio asignado: ${recordatorioForm.titulo} - Cliente: ${cliente?.empresa || 'Cliente'} - Fecha: ${formatDate(recordatorioForm.fecha)}`,
          'recordatorio'
        );
      }
    }

    setRecordatorioForm({ titulo: '', fecha: '', descripcion: '', responsableId: '' });
    setShowRecordatorioForm(false);
  };

  const handleEditRecordatorio = (recordatorio) => {
    setRecordatorioForm({
      titulo: recordatorio.titulo,
      fecha: recordatorio.fecha,
      descripcion: recordatorio.descripcion || '',
      responsableId: recordatorio.responsableId || ''
    });
    setEditingRecordatorio(recordatorio);
    setShowRecordatorioForm(true);
  };

  const handleDeleteRecordatorio = (id) => {
    if (window.confirm('¿Eliminar este recordatorio?')) {
      setRecordatorios(recordatorios.filter(r => r.id !== id));
    }
  };

  // Funciones para tareas
  const handleEditTarea = (tarea) => {
    setTareaFormData({
      descripcion: tarea.descripcion,
      fechaCompromiso: tarea.fechaCompromiso,
      prioridad: tarea.prioridad || 'media',
      responsableId: tarea.responsableId || ''
    });
    setEditingTarea(tarea);
    setShowTareaForm(true);
  };

  const handleAddTareaForm = (e) => {
    e.preventDefault();
    const cliente = clientes.find(c => c.id === selectedCliente);
    const responsableId = tareaFormData.responsableId || currentUser?.id;

    if (editingTarea) {
      setTareas(tareas.map(t => t.id === editingTarea.id ? {
        ...t,
        ...tareaFormData,
        responsableId
      } : t));
      setEditingTarea(null);
    } else {
      const nuevaTarea = {
        ...tareaFormData,
        id: generateId(),
        clienteId: selectedCliente,
        responsableId,
        creadoPor: currentUser?.id,
        completada: false,
        fechaCreacion: new Date().toISOString()
      };
      setTareas([...tareas, nuevaTarea]);

      if (responsableId && responsableId !== currentUser?.id && addNotificacion) {
        addNotificacion(
          responsableId,
          `Nueva tarea asignada: ${tareaFormData.descripcion} - Cliente: ${cliente?.empresa || 'Cliente'}`,
          'tarea'
        );
      }
    }

    setTareaFormData({ descripcion: '', fechaCompromiso: '', prioridad: 'media', responsableId: '' });
    setShowTareaForm(false);
  };

  const handleDeleteTarea = (id) => {
    if (window.confirm('¿Eliminar esta tarea?')) {
      setTareas(tareas.filter(t => t.id !== id));
    }
  };

  // Funciones para tareas/recordatorios temporales (desde modal actividad)
  const agregarTareaTemp = () => {
    if (!tareaTemp.descripcion.trim() || !tareaTemp.fechaCompromiso) return;

    if (editandoTareaExistenteId) {
      // Editando una tarea existente
      setTareas(tareas.map(t => t.id === editandoTareaExistenteId ? {
        ...t,
        descripcion: tareaTemp.descripcion,
        fechaCompromiso: tareaTemp.fechaCompromiso,
        prioridad: tareaTemp.prioridad,
        responsableId: tareaTemp.responsableId || currentUser?.id
      } : t));
      setEditandoTareaExistenteId(null);
    } else {
      // Nueva tarea
      setTareasNuevas([...tareasNuevas, { ...tareaTemp, id: generateId() }]);
    }
    setTareaTemp({ descripcion: '', fechaCompromiso: '', prioridad: 'media', responsableId: '' });
    setMostrarFormTarea(false);
  };

  const editarTareaExistente = (tarea) => {
    setTareaTemp({
      descripcion: tarea.descripcion,
      fechaCompromiso: tarea.fechaCompromiso,
      prioridad: tarea.prioridad,
      responsableId: tarea.responsableId || ''
    });
    setEditandoTareaExistenteId(tarea.id);
    setMostrarFormTarea(true);
  };

  const eliminarTareaTemp = (id) => {
    setTareasNuevas(tareasNuevas.filter(t => t.id !== id));
  };

  const agregarRecordatorioTemp = () => {
    if (!recordatorioTemp.titulo.trim() || !recordatorioTemp.fecha) return;

    if (editandoRecordatorioExistenteId) {
      // Editando un recordatorio existente
      setRecordatorios(recordatorios.map(r => r.id === editandoRecordatorioExistenteId ? {
        ...r,
        titulo: recordatorioTemp.titulo,
        fecha: recordatorioTemp.fecha,
        descripcion: recordatorioTemp.descripcion,
        responsableId: recordatorioTemp.responsableId || currentUser?.id
      } : r));
      setEditandoRecordatorioExistenteId(null);
    } else {
      // Nuevo recordatorio
      setRecordatoriosNuevos([...recordatoriosNuevos, { ...recordatorioTemp, id: generateId() }]);
    }
    setRecordatorioTemp({ titulo: '', fecha: '', descripcion: '', responsableId: '' });
    setMostrarFormRecordatorioNuevo(false);
  };

  const editarRecordatorioExistente = (rec) => {
    setRecordatorioTemp({
      titulo: rec.titulo,
      fecha: rec.fecha,
      descripcion: rec.descripcion || '',
      responsableId: rec.responsableId || ''
    });
    setEditandoRecordatorioExistenteId(rec.id);
    setMostrarFormRecordatorioNuevo(true);
  };

  const eliminarRecordatorioTemp = (id) => {
    setRecordatoriosNuevos(recordatoriosNuevos.filter(r => r.id !== id));
  };

  // Obtener actividades del cliente seleccionado (todos pueden ver, solo filtrar por cliente)
  const actividadesCliente = actividades
    .filter(a => a.clienteId === selectedCliente)
    .sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));

  // Obtener recordatorios del cliente seleccionado (solo propios o si el cliente es suyo)
  const recordatoriosCliente = recordatorios
    .filter(r => r.clienteId === selectedCliente)
    .filter(r => esAdmin || r.creadoPor === currentUser?.id || r.responsableId === currentUser?.id)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  // Obtener tareas del cliente seleccionado (solo propias o si el cliente es suyo)
  const tareasCliente = (tareas || [])
    .filter(t => t.clienteId === selectedCliente)
    .filter(t => esAdmin || t.creadoPor === currentUser?.id || t.responsableId === currentUser?.id)
    .sort((a, b) => new Date(a.fechaCompromiso) - new Date(b.fechaCompromiso));

  // Timeline: combinar actividades y cambios de pipeline
  const getTimeline = (clienteId) => {
    const eventos = [];

    // Actividades
    actividades.filter(a => a.clienteId === clienteId).forEach(a => {
      eventos.push({
        tipo: 'actividad',
        subtipo: a.tipo,
        titulo: a.titulo,
        descripcion: a.descripcion,
        fecha: a.fechaCreacion
      });
    });

    // Proyectos en pipeline
    pipeline.filter(p => p.clienteId === clienteId).forEach(p => {
      eventos.push({
        tipo: 'pipeline',
        titulo: `Proyecto: ${p.nombre}`,
        descripcion: `Etapa: ${PIPELINE_STAGES.find(s => s.id === p.etapa)?.name}`,
        fecha: p.fechaCreacion
      });
    });

    return eventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  };

  // Filtrar por alcance de visualización
  const clientesPorAlcance = permisos.ver === 'propios'
    ? clientes.filter(c => c.asignadoA === currentUser?.id || c.creadoPor === currentUser?.id)
    : clientes;

  const filteredClientes = clientesPorAlcance.filter(c =>
    c.empresa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.contacto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.industria?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Vista de detalle
  if (selectedCliente) {
    const cliente = clientes.find(c => c.id === selectedCliente);
    const proyectosCliente = pipeline.filter(p => p.clienteId === selectedCliente);
    const timeline = getTimeline(selectedCliente);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => { setSelectedCliente(null); setActiveTab('info'); }} className="p-2 hover:bg-slate-800 rounded-xl transition-all">
              <X size={24} className="text-slate-400" />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-white">{cliente?.empresa}</h1>
                {(cliente?.tags || []).map(tagId => {
                  const tag = TAGS_DISPONIBLES.find(t => t.id === tagId);
                  return tag ? (
                    <span key={tagId} className={`px-2 py-0.5 rounded text-xs text-white ${tag.color}`}>
                      {tag.name}
                    </span>
                  ) : null;
                })}
              </div>
              <p className="text-slate-400">{cliente?.industria}</p>
            </div>
          </div>
          {puedeEditarCliente(cliente) && (
            <div className="flex gap-2">
              <button onClick={() => { setEditingActividad(null); setActividadForm({ tipo: 'llamada', titulo: '', descripcion: '', fecha: getFechaLocal(), responsableId: '' }); setTareasNuevas([]); setRecordatoriosNuevos([]); setShowActividadForm(true); }} className="flex items-center gap-2 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-400 px-4 py-2 rounded-xl transition-all">
                <Plus size={16} /> Actividad
              </button>
              <button onClick={() => { setEditingTarea(null); setTareaFormData({ descripcion: '', fechaCompromiso: getFechaLocal(), prioridad: 'media', responsableId: '' }); setShowTareaForm(true); }} className="flex items-center gap-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 px-4 py-2 rounded-xl transition-all">
                <Target size={16} /> Tarea
              </button>
              <button onClick={() => { setEditingRecordatorio(null); setRecordatorioForm({ titulo: '', fecha: '', descripcion: '', responsableId: '' }); setShowRecordatorioForm(true); }} className="flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 px-4 py-2 rounded-xl transition-all">
                <Bell size={16} /> Recordatorio
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
          {[
            { id: 'info', name: 'Información', icon: Building },
            { id: 'actividades', name: 'Actividades', icon: PhoneCall, count: actividadesCliente.length },
            { id: 'tareas', name: 'Tareas', icon: Target, count: tareasCliente.filter(t => !t.completada).length },
            { id: 'recordatorios', name: 'Recordatorios', icon: Bell, count: recordatoriosCliente.filter(r => !r.completado).length },
            { id: 'timeline', name: 'Timeline', icon: History, count: timeline.length }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${activeTab === tab.id ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
              >
                <Icon size={16} />
                {tab.name}
                {tab.count > 0 && <span className="bg-slate-700 text-xs px-2 py-0.5 rounded-full">{tab.count}</span>}
              </button>
            );
          })}
        </div>

        {/* Form Actividad */}
        {showActividadForm && (
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-violet-500/30">
            <h3 className="text-lg font-semibold text-white mb-4">{editingActividad ? 'Editar Actividad' : 'Nueva Actividad'}</h3>
            <form onSubmit={handleAddActividad} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select value={actividadForm.tipo} onChange={(e) => setActividadForm({ ...actividadForm, tipo: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white">
                  {TIPOS_ACTIVIDAD.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input type="date" value={actividadForm.fecha} onChange={(e) => setActividadForm({ ...actividadForm, fecha: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white" />
                <input type="text" placeholder="Título *" value={actividadForm.titulo} onChange={(e) => setActividadForm({ ...actividadForm, titulo: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500" required />
                <select value={actividadForm.responsableId} onChange={(e) => setActividadForm({ ...actividadForm, responsableId: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white">
                  <option value="">Asignar a... (yo mismo)</option>
                  {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.id === currentUser?.id ? '(yo)' : ''}</option>)}
                </select>
                <textarea placeholder="Descripción" value={actividadForm.descripcion} onChange={(e) => setActividadForm({ ...actividadForm, descripcion: e.target.value })} className="md:col-span-2 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 resize-none" rows="3"></textarea>
                <div className="md:col-span-2">
                  <label className="block text-slate-400 text-sm mb-2">Adjuntar archivo (opcional)</label>
                  <div className="border-2 border-dashed border-slate-700 rounded-xl p-4 text-center hover:border-violet-500/50 transition-all">
                    <input type="file" onChange={(e) => setActividadArchivo(e.target.files[0])} className="hidden" id="actividad-file-cliente" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp" />
                    <label htmlFor="actividad-file-cliente" className="cursor-pointer">
                      {actividadArchivo ? (
                        <div className="flex items-center justify-center gap-3">
                          <FileText size={24} className="text-violet-400" />
                          <div className="text-left"><p className="text-white text-sm">{actividadArchivo.name}</p><p className="text-slate-500 text-xs">{(actividadArchivo.size / 1024).toFixed(1)} KB</p></div>
                          <button type="button" onClick={(e) => { e.preventDefault(); setActividadArchivo(null); }} className="p-1 hover:bg-slate-700 rounded text-red-400"><X size={16} /></button>
                        </div>
                      ) : (<div><Upload size={24} className="mx-auto text-slate-500 mb-2" /><p className="text-slate-400 text-sm">Clic para seleccionar archivo</p></div>)}
                    </label>
                  </div>
                </div>
              </div>

              {/* Sección Tareas derivadas */}
              <div className="border-t border-slate-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-cyan-400 flex items-center gap-2"><Target size={16} />Tareas derivadas</h4>
                  <button type="button" onClick={() => setMostrarFormTarea(!mostrarFormTarea)} className="text-xs px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30">{mostrarFormTarea ? 'Cancelar' : '+ Agregar'}</button>
                </div>
                {editingActividad && (() => {
                  const tareasExistentes = (tareas || []).filter(t => t.actividadId === editingActividad.id);
                  if (tareasExistentes.length === 0) return null;
                  return (<div className="mb-3 space-y-2">{tareasExistentes.map(t => (<div key={t.id} className={`flex items-center justify-between p-3 rounded-lg ${t.completada ? 'bg-emerald-500/10' : 'bg-slate-700/50'}`}><div className="flex items-center gap-3"><button type="button" onClick={() => setTareas(tareas.map(ta => ta.id === t.id ? { ...ta, completada: !ta.completada } : ta))}>{t.completada ? <CheckCircle size={16} className="text-emerald-400" /> : <Clock size={16} className="text-slate-400" />}</button><div><p className={`text-sm ${t.completada ? 'text-emerald-300 line-through' : 'text-white'}`}>{t.descripcion}</p><p className="text-slate-500 text-xs">{formatDate(t.fechaCompromiso)}</p></div></div><div className="flex items-center gap-1"><button type="button" onClick={() => editarTareaExistente(t)} className="p-1 text-cyan-400 hover:bg-cyan-500/20 rounded"><Edit size={14} /></button><button type="button" onClick={() => { if (window.confirm('¿Eliminar?')) setTareas(tareas.filter(ta => ta.id !== t.id)); }} className="p-1 text-red-400 hover:bg-red-500/20 rounded"><Trash2 size={14} /></button></div></div>))}</div>);
                })()}
                {mostrarFormTarea && (
                  <div className="bg-slate-800/50 rounded-xl p-4 mb-3 space-y-3">
                    <input type="text" placeholder="Descripción *" value={tareaTemp.descripcion} onChange={(e) => setTareaTemp({ ...tareaTemp, descripcion: e.target.value })} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm" />
                    <div className="grid grid-cols-3 gap-2">
                      <input type="date" value={tareaTemp.fechaCompromiso} onChange={(e) => setTareaTemp({ ...tareaTemp, fechaCompromiso: e.target.value })} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm" />
                      <select value={tareaTemp.prioridad} onChange={(e) => setTareaTemp({ ...tareaTemp, prioridad: e.target.value })} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option></select>
                      <select value={tareaTemp.responsableId} onChange={(e) => setTareaTemp({ ...tareaTemp, responsableId: e.target.value })} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"><option value="">Yo mismo</option>{usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={agregarTareaTemp} className="text-xs px-4 py-2 bg-cyan-500 text-white rounded-lg">{editandoTareaExistenteId ? 'Guardar cambios' : 'Agregar'}</button>
                      {editandoTareaExistenteId && (<button type="button" onClick={() => { setEditandoTareaExistenteId(null); setTareaTemp({ descripcion: '', fechaCompromiso: '', prioridad: 'media', responsableId: '' }); setMostrarFormTarea(false); }} className="text-xs px-4 py-2 bg-slate-600 text-white rounded-lg">Cancelar</button>)}
                    </div>
                  </div>
                )}
                {tareasNuevas.length > 0 && (<div className="space-y-2">{tareasNuevas.map(t => (<div key={t.id} className="flex items-center justify-between bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3"><div className="flex items-center gap-3"><Target size={14} className="text-cyan-400" /><div><p className="text-white text-sm">{t.descripcion}</p><p className="text-slate-500 text-xs">{formatDate(t.fechaCompromiso)}</p></div></div><button type="button" onClick={() => eliminarTareaTemp(t.id)} className="p-1 text-red-400 hover:bg-red-500/20 rounded"><Trash2 size={14} /></button></div>))}</div>)}
              </div>

              {/* Sección Recordatorios derivados */}
              <div className="border-t border-slate-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-amber-400 flex items-center gap-2"><Bell size={16} />Recordatorios derivados</h4>
                  <button type="button" onClick={() => setMostrarFormRecordatorioNuevo(!mostrarFormRecordatorioNuevo)} className="text-xs px-3 py-1 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30">{mostrarFormRecordatorioNuevo ? 'Cancelar' : '+ Agregar'}</button>
                </div>
                {editingActividad && (() => {
                  const recordatoriosExistentes = recordatorios.filter(r => r.actividadId === editingActividad.id);
                  if (recordatoriosExistentes.length === 0) return null;
                  return (<div className="mb-3 space-y-2">{recordatoriosExistentes.map(r => (<div key={r.id} className={`flex items-center justify-between p-3 rounded-lg ${r.completado ? 'bg-emerald-500/10' : 'bg-slate-700/50'}`}><div className="flex items-center gap-3"><button type="button" onClick={() => setRecordatorios(recordatorios.map(re => re.id === r.id ? { ...re, completado: !re.completado } : re))}>{r.completado ? <CheckCircle size={16} className="text-emerald-400" /> : <Bell size={16} className="text-amber-400" />}</button><div><p className={`text-sm ${r.completado ? 'text-emerald-300 line-through' : 'text-white'}`}>{r.titulo}</p><p className="text-slate-500 text-xs">{formatDate(r.fecha)}</p></div></div><div className="flex items-center gap-1"><button type="button" onClick={() => editarRecordatorioExistente(r)} className="p-1 text-cyan-400 hover:bg-cyan-500/20 rounded"><Edit size={14} /></button><button type="button" onClick={() => { if (window.confirm('¿Eliminar?')) setRecordatorios(recordatorios.filter(re => re.id !== r.id)); }} className="p-1 text-red-400 hover:bg-red-500/20 rounded"><Trash2 size={14} /></button></div></div>))}</div>);
                })()}
                {mostrarFormRecordatorioNuevo && (
                  <div className="bg-slate-800/50 rounded-xl p-4 mb-3 space-y-3">
                    <input type="text" placeholder="Título *" value={recordatorioTemp.titulo} onChange={(e) => setRecordatorioTemp({ ...recordatorioTemp, titulo: e.target.value })} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm" />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" value={recordatorioTemp.fecha} onChange={(e) => setRecordatorioTemp({ ...recordatorioTemp, fecha: e.target.value })} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm" />
                      <select value={recordatorioTemp.responsableId} onChange={(e) => setRecordatorioTemp({ ...recordatorioTemp, responsableId: e.target.value })} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"><option value="">Yo mismo</option>{usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={agregarRecordatorioTemp} className="text-xs px-4 py-2 bg-amber-500 text-white rounded-lg">{editandoRecordatorioExistenteId ? 'Guardar cambios' : 'Agregar'}</button>
                      {editandoRecordatorioExistenteId && (<button type="button" onClick={() => { setEditandoRecordatorioExistenteId(null); setRecordatorioTemp({ titulo: '', fecha: '', descripcion: '', responsableId: '' }); setMostrarFormRecordatorioNuevo(false); }} className="text-xs px-4 py-2 bg-slate-600 text-white rounded-lg">Cancelar</button>)}
                    </div>
                  </div>
                )}
                {recordatoriosNuevos.length > 0 && (<div className="space-y-2">{recordatoriosNuevos.map(r => (<div key={r.id} className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-lg p-3"><div className="flex items-center gap-3"><Bell size={14} className="text-amber-400" /><div><p className="text-white text-sm">{r.titulo}</p><p className="text-slate-500 text-xs">{formatDate(r.fecha)}</p></div></div><button type="button" onClick={() => eliminarRecordatorioTemp(r.id)} className="p-1 text-red-400 hover:bg-red-500/20 rounded"><Trash2 size={14} /></button></div>))}</div>)}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={subiendoActividad} className="flex items-center gap-2 bg-violet-500 text-white px-5 py-3 rounded-xl hover:bg-violet-600 disabled:opacity-50">{subiendoActividad ? <Loader size={18} className="animate-spin" /> : <Save size={18} />} {subiendoActividad ? 'Guardando...' : editingActividad ? 'Guardar Cambios' : 'Guardar'}</button>
                <button type="button" onClick={() => { setShowActividadForm(false); setActividadArchivo(null); setEditingActividad(null); setTareasNuevas([]); setRecordatoriosNuevos([]); }} className="flex items-center gap-2 bg-slate-800 text-slate-300 px-5 py-3 rounded-xl hover:bg-slate-700"><X size={18} /> Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* Form Tarea */}
        {showTareaForm && (
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-cyan-500/30">
            <h3 className="text-lg font-semibold text-white mb-4">{editingTarea ? 'Editar Tarea' : 'Nueva Tarea'}</h3>
            <form onSubmit={handleAddTareaForm} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" placeholder="Descripción *" value={tareaFormData.descripcion} onChange={(e) => setTareaFormData({ ...tareaFormData, descripcion: e.target.value })} className="md:col-span-2 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500" required />
              <input type="date" value={tareaFormData.fechaCompromiso} onChange={(e) => setTareaFormData({ ...tareaFormData, fechaCompromiso: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white" required />
              <select value={tareaFormData.prioridad} onChange={(e) => setTareaFormData({ ...tareaFormData, prioridad: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option></select>
              <select value={tareaFormData.responsableId} onChange={(e) => setTareaFormData({ ...tareaFormData, responsableId: e.target.value })} className="md:col-span-2 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"><option value="">Asignar a... (yo mismo)</option>{usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.id === currentUser?.id ? '(yo)' : ''}</option>)}</select>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" className="flex items-center gap-2 bg-cyan-500 text-white px-5 py-3 rounded-xl hover:bg-cyan-600"><Save size={18} /> {editingTarea ? 'Guardar Cambios' : 'Guardar'}</button>
                <button type="button" onClick={() => { setShowTareaForm(false); setEditingTarea(null); }} className="flex items-center gap-2 bg-slate-800 text-slate-300 px-5 py-3 rounded-xl hover:bg-slate-700"><X size={18} /> Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* Form Recordatorio */}
        {showRecordatorioForm && (
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-amber-500/30">
            <h3 className="text-lg font-semibold text-white mb-4">{editingRecordatorio ? 'Editar Recordatorio' : 'Nuevo Recordatorio'}</h3>
            <form onSubmit={handleAddRecordatorio} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" placeholder="Título *" value={recordatorioForm.titulo} onChange={(e) => setRecordatorioForm({ ...recordatorioForm, titulo: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500" required />
              <input type="date" value={recordatorioForm.fecha} onChange={(e) => setRecordatorioForm({ ...recordatorioForm, fecha: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white" required />
              <select value={recordatorioForm.responsableId} onChange={(e) => setRecordatorioForm({ ...recordatorioForm, responsableId: e.target.value })} className="md:col-span-2 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white">
                <option value="">Asignar a... (yo mismo)</option>
                {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.id === currentUser?.id ? '(yo)' : ''}</option>)}
              </select>
              <textarea placeholder="Descripción" value={recordatorioForm.descripcion} onChange={(e) => setRecordatorioForm({ ...recordatorioForm, descripcion: e.target.value })} className="md:col-span-2 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 resize-none" rows="2"></textarea>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" className="flex items-center gap-2 bg-amber-500 text-white px-5 py-3 rounded-xl hover:bg-amber-600"><Save size={18} /> {editingRecordatorio ? 'Guardar Cambios' : 'Guardar'}</button>
                <button type="button" onClick={() => { setShowRecordatorioForm(false); setEditingRecordatorio(null); }} className="flex items-center gap-2 bg-slate-800 text-slate-300 px-5 py-3 rounded-xl hover:bg-slate-700"><X size={18} /> Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* Tab Content: Info */}
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Información de Contacto</h3>
                {puedeEditarCliente(cliente) && (
                  <button onClick={() => { handleEdit(cliente); setSelectedCliente(null); }} className="p-2 hover:bg-slate-700 rounded-lg transition-all text-slate-400 hover:text-cyan-400" title="Editar cliente">
                    <Edit size={18} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-slate-500 text-sm">Contacto Principal</p><p className="text-white">{cliente?.contacto || '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Cargo</p><p className="text-white">{cliente?.cargo || '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Email</p><p className="text-cyan-400">{cliente?.email || '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Teléfono</p><p className="text-white">{cliente?.telefono || '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Sitio Web</p><p className="text-cyan-400">{cliente?.sitioWeb ? (<a href={cliente.sitioWeb.startsWith('http') ? cliente.sitioWeb : `https://${cliente.sitioWeb}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{cliente.sitioWeb}</a>) : '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Número de Empleados</p><p className="text-cyan-400 font-semibold">{cliente?.numeroEmpleados || '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Servicio</p><p className="text-cyan-400">{cliente?.servicio || '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Fuente</p><p className="text-white">{cliente?.fuente || '-'}</p></div>
                {cliente?.fuente === 'Referido' && cliente?.referidoPor && (
                  <div className="col-span-2"><p className="text-slate-500 text-sm">Referido por</p><p className="text-white flex items-center gap-2"><User size={16} className="text-violet-400" />{cliente.referidoPor}{cliente.esComisionista && <span className="ml-2 px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">Comisionista</span>}</p></div>
                )}
                <div><p className="text-slate-500 text-sm">Responsable</p><p className="text-white">{usuarios.find(u => u.id === cliente?.asignadoA)?.nombre || usuarios.find(u => u.id === cliente?.creadoPor)?.nombre || '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Fecha de registro</p><p className="text-white">{formatDate(cliente?.fechaCreacion) || '-'}</p></div>
              </div>
              {cliente?.notas && (<div className="mt-4 pt-4 border-t border-slate-800"><p className="text-slate-500 text-sm mb-1">Notas</p><p className="text-slate-300">{cliente.notas}</p></div>)}
            </div>
            <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
              <h3 className="text-lg font-semibold text-white mb-4">Acciones</h3>
              <div className="space-y-3">
                {cliente?.telefono && (<a href={`https://wa.me/52${cliente.telefono.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400 transition-all"><Phone size={18} /> WhatsApp</a>)}
                {cliente?.email && (<button onClick={() => { setEmailDestinatario({ nombre: cliente.nombre || cliente.empresa, email: cliente.email, clienteId: cliente.id }); setEmailModalOpen(true); }} className="w-full flex items-center gap-3 p-3 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400 transition-all"><Mail size={18} /> Enviar Email</button>)}
                {puedeEditarCliente(cliente) && (<button onClick={() => { handleEdit(cliente); setSelectedCliente(null); }} className="w-full flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition-all"><Edit size={18} /> Editar Cliente</button>)}
              </div>
            </div>
            <div className="lg:col-span-3 bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
              <h3 className="text-lg font-semibold text-white mb-4">Proyectos en Pipeline</h3>
              {proyectosCliente.length === 0 ? (<p className="text-slate-500 text-center py-8">No hay proyectos registrados</p>) : (
                <div className="space-y-3">{proyectosCliente.map(p => { const stage = PIPELINE_STAGES.find(s => s.id === p.etapa); return (<div key={p.id} className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl"><div className={`w-3 h-3 rounded-full ${stage?.bg}`}></div><div className="flex-1"><p className="text-white font-medium">{p.nombre}</p><p className="text-slate-500 text-sm">{stage?.name}</p></div>{p.valorEstimado && (<span className="text-emerald-400 font-semibold">${parseFloat(p.valorEstimado).toLocaleString('es-MX')}/año</span>)}</div>); })}</div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content: Actividades */}
        {activeTab === 'actividades' && (
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Historial de Actividades</h3>
              {puedeEditarCliente(cliente) && (
                <button
                  onClick={() => { setEditingActividad(null); setActividadForm({ tipo: 'llamada', titulo: '', descripcion: '', fecha: getFechaLocal(), responsableId: '' }); setTareasNuevas([]); setRecordatoriosNuevos([]); setActividadArchivo(null); setShowActividadForm(true); }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 text-violet-400 rounded-lg text-sm hover:bg-violet-500/30 transition-all"
                >
                  <Plus size={14} /> Nueva Actividad
                </button>
              )}
            </div>
            {actividadesCliente.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No hay actividades registradas</p>
            ) : (
              <div className="space-y-3">
                {actividadesCliente.map(a => {
                  const tipo = TIPOS_ACTIVIDAD.find(t => t.id === a.tipo);
                  const Icon = tipo?.icon || MessageSquare;
                  return (
                    <div key={a.id} onClick={() => setViewingActividad(a)} className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-xl group cursor-pointer hover:bg-slate-800/70 transition-all">
                      <div className={`w-10 h-10 rounded-xl ${tipo?.color} bg-opacity-20 flex items-center justify-center flex-shrink-0`}><Icon size={18} className="text-white" /></div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded ${tipo?.color} text-white`}>{tipo?.name}</span>
                            <span className="text-slate-500 text-xs">{formatDate(a.fecha)}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {puedeEditarActividad(a) && <button onClick={(e) => { e.stopPropagation(); handleEditActividad(a); }} className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 rounded-lg"><Edit size={14} /></button>}
                            {puedeEliminarActividad(a) && <button onClick={(e) => { e.stopPropagation(); handleDeleteActividad(a.id); }} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg"><Trash2 size={14} /></button>}
                          </div>
                        </div>
                        <p className="text-white font-medium">{a.titulo}</p>
                        {a.descripcion && <p className="text-slate-400 text-sm mt-1 line-clamp-2">{a.descripcion}</p>}
                        {a.archivo && (<div onClick={(e) => e.stopPropagation()} className="inline-block"><a href={a.archivo.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 rounded-lg text-violet-300 text-sm"><Download size={14} /> {a.archivo.nombre}</a></div>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modal Ver Detalle de Actividad */}
        {viewingActividad && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setViewingActividad(null)}>
            <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {(() => {
                const tipo = TIPOS_ACTIVIDAD.find(t => t.id === viewingActividad.tipo);
                const Icon = tipo?.icon || MessageSquare;
                const responsable = usuarios.find(u => u.id === viewingActividad.responsableId);
                const creador = usuarios.find(u => u.id === viewingActividad.creadoPor);
                const tareasDerivadas = (tareas || []).filter(t => t.actividadId === viewingActividad.id);
                const recordatoriosDerivados = recordatorios.filter(r => r.actividadId === viewingActividad.id);
                return (
                  <>
                    <div className={`${tipo?.color} p-6 rounded-t-2xl`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center"><Icon size={28} className="text-white" /></div>
                          <div><span className="text-white/80 text-sm">{tipo?.name}</span><h3 className="text-xl font-bold text-white">{viewingActividad.titulo || 'Sin título'}</h3></div>
                        </div>
                        <button onClick={() => setViewingActividad(null)} className="p-2 hover:bg-white/20 rounded-lg"><X size={24} className="text-white" /></button>
                      </div>
                    </div>
                    <div className="p-6 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-800/50 rounded-xl p-4"><p className="text-slate-500 text-xs mb-1">Fecha</p><p className="text-white font-medium">{formatDate(viewingActividad.fecha)}</p></div>
                        <div className="bg-slate-800/50 rounded-xl p-4"><p className="text-slate-500 text-xs mb-1">Responsable</p><p className="text-white font-medium">{responsable?.nombre || 'No asignado'}</p></div>
                      </div>
                      {viewingActividad.tipo === 'email' && viewingActividad.emailDestinatario && (
                        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 space-y-3">
                          <p className="text-cyan-400 text-sm font-medium flex items-center gap-2"><Mail size={16} /> Correo Enviado</p>
                          <div className="space-y-2">
                            <div><p className="text-slate-500 text-xs">Para:</p><p className="text-white">{viewingActividad.emailDestinatario}</p></div>
                            <div><p className="text-slate-500 text-xs">Asunto:</p><p className="text-white font-medium">{viewingActividad.emailAsunto || viewingActividad.titulo?.replace('Email: ', '')}</p></div>
                            <div><p className="text-slate-500 text-xs">Mensaje:</p><p className="text-white whitespace-pre-wrap bg-slate-800/50 p-3 rounded-lg mt-1">{viewingActividad.emailCuerpo || viewingActividad.descripcion}</p></div>
                          </div>
                        </div>
                      )}
                      {viewingActividad.tipo !== 'email' && viewingActividad.descripcion && (<div className="bg-slate-800/50 rounded-xl p-4"><p className="text-slate-500 text-xs mb-2">Descripción</p><p className="text-white whitespace-pre-wrap">{viewingActividad.descripcion}</p></div>)}
                      {viewingActividad.archivo && (<div className="bg-slate-800/50 rounded-xl p-4"><p className="text-slate-500 text-xs mb-2">Archivo</p><a href={viewingActividad.archivo.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 px-4 py-3 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 rounded-xl text-violet-300"><Download size={20} /><div><p className="font-medium">{viewingActividad.archivo.nombre}</p><p className="text-violet-400/60 text-xs">{(viewingActividad.archivo.tamano / 1024).toFixed(1)} KB</p></div></a></div>)}
                      {tareasDerivadas.length > 0 && (<div className="bg-slate-800/50 rounded-xl p-4"><p className="text-cyan-400 text-sm font-medium mb-3 flex items-center gap-2"><Target size={16} /> Tareas ({tareasDerivadas.length})</p><div className="space-y-2">{tareasDerivadas.map(t => (<div key={t.id} className={`flex items-center justify-between p-3 rounded-lg ${t.completada ? 'bg-emerald-500/10' : 'bg-slate-700/50'}`}><div className="flex items-center gap-3">{t.completada ? <CheckCircle size={16} className="text-emerald-400" /> : <Clock size={16} className="text-slate-400" />}<div><p className={`text-sm ${t.completada ? 'text-emerald-300 line-through' : 'text-white'}`}>{t.descripcion}</p><p className="text-slate-500 text-xs">{formatDate(t.fechaCompromiso)}</p></div></div><span className={`text-xs px-2 py-1 rounded ${t.prioridad === 'alta' ? 'bg-red-500/20 text-red-400' : t.prioridad === 'media' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-600 text-slate-400'}`}>{t.prioridad}</span></div>))}</div></div>)}
                      {recordatoriosDerivados.length > 0 && (<div className="bg-slate-800/50 rounded-xl p-4"><p className="text-amber-400 text-sm font-medium mb-3 flex items-center gap-2"><Bell size={16} /> Recordatorios ({recordatoriosDerivados.length})</p><div className="space-y-2">{recordatoriosDerivados.map(r => (<div key={r.id} className={`flex items-center justify-between p-3 rounded-lg ${r.completado ? 'bg-emerald-500/10' : 'bg-slate-700/50'}`}><div className="flex items-center gap-3">{r.completado ? <CheckCircle size={16} className="text-emerald-400" /> : <Bell size={16} className="text-amber-400" />}<div><p className={`text-sm ${r.completado ? 'text-emerald-300 line-through' : 'text-white'}`}>{r.titulo}</p><p className="text-slate-500 text-xs">{formatDate(r.fecha)}</p></div></div></div>))}</div></div>)}
                      <div className="border-t border-slate-700 pt-4 flex items-center justify-between text-xs text-slate-500"><span>Creado por: {creador?.nombre || 'Sistema'}</span><span>{viewingActividad.fechaCreacion ? new Date(viewingActividad.fechaCreacion).toLocaleString('es-MX') : '-'}</span></div>
                      <div className="flex gap-3">
                        <button onClick={() => { handleEditActividad(viewingActividad); setViewingActividad(null); }} className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-xl hover:bg-cyan-500/30"><Edit size={16} /> Editar</button>
                        <button onClick={() => { handleDeleteActividad(viewingActividad.id); setViewingActividad(null); }} className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30"><Trash2 size={16} /> Eliminar</button>
                        <button onClick={() => setViewingActividad(null)} className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600 ml-auto">Cerrar</button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Tab Content: Tareas */}
        {activeTab === 'tareas' && (
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Tareas y Compromisos</h3>
              {puedeEditarCliente(cliente) && (
                <button
                  onClick={() => { setEditingTarea(null); setTareaFormData({ descripcion: '', fechaCompromiso: getFechaLocal(), prioridad: 'media', responsableId: '' }); setShowTareaForm(true); }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30 transition-all"
                >
                  <Plus size={14} /> Nueva Tarea
                </button>
              )}
            </div>
            {tareasCliente.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No hay tareas para este cliente</p>
            ) : (
              <div className="space-y-3">
                {tareasCliente.map(tarea => {
                  const hoy = getFechaLocal();
                  const vencida = !tarea.completada && tarea.fechaCompromiso < hoy;
                  const esHoy = tarea.fechaCompromiso === hoy;
                  const responsable = usuarios.find(u => u.id === tarea.responsableId);
                  return (
                    <div key={tarea.id} className={`flex items-center gap-4 p-4 rounded-xl group ${tarea.completada ? 'bg-slate-800/30' : vencida ? 'bg-red-500/10 border border-red-500/30' : esHoy ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-slate-800/50'}`}>
                      <button onClick={() => setTareas(tareas.map(t => t.id === tarea.id ? { ...t, completada: !t.completada } : t))} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${tarea.completada ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 hover:border-emerald-500'}`}>{tarea.completada && <CheckCircle size={14} className="text-white" />}</button>
                      <div className="flex-1">
                        <p className={`font-medium ${tarea.completada ? 'text-slate-500 line-through' : 'text-white'}`}>{tarea.descripcion}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className={`text-xs flex items-center gap-1 ${vencida ? 'text-red-400' : esHoy ? 'text-amber-400' : 'text-slate-400'}`}><Clock size={12} /> Compromiso: {esHoy ? 'Hoy' : vencida ? `Vencida (${formatDate(tarea.fechaCompromiso)})` : formatDate(tarea.fechaCompromiso)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${tarea.prioridad === 'alta' ? 'bg-red-500/20 text-red-400' : tarea.prioridad === 'media' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>{tarea.prioridad}</span>
                          {responsable && <span className="text-xs text-violet-400">{responsable.nombre}</span>}
                        </div>
                        {tarea.fechaCreacion && <p className="text-xs text-slate-500 mt-1">Creada: {new Date(tarea.fechaCreacion).toLocaleDateString('es-MX')}</p>}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {puedeEditarTarea(tarea) && <button onClick={() => handleEditTarea(tarea)} className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 rounded-lg"><Edit size={14} /></button>}
                        {puedeEliminarTarea(tarea) && <button onClick={() => handleDeleteTarea(tarea.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg"><Trash2 size={14} /></button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Timeline */}
        {activeTab === 'timeline' && (
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
            <h3 className="text-lg font-semibold text-white mb-4">Timeline del Cliente</h3>
            {timeline.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No hay eventos en el timeline</p>
            ) : (
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-700"></div>
                <div className="space-y-4">
                  {timeline.map((evento, idx) => {
                    const tipoAct = TIPOS_ACTIVIDAD.find(t => t.id === evento.subtipo);
                    const Icon = evento.tipo === 'actividad' ? (tipoAct?.icon || MessageSquare) : GitBranch;
                    const color = evento.tipo === 'actividad' ? (tipoAct?.color || 'bg-slate-500') : 'bg-cyan-500';
                    return (
                      <div key={idx} className="flex items-start gap-4 ml-0 relative">
                        <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center z-10 flex-shrink-0`}>
                          <Icon size={18} className="text-white" />
                        </div>
                        <div className="flex-1 bg-slate-800/50 rounded-xl p-4">
                          <p className="text-slate-500 text-xs mb-1">{formatDate(evento.fecha)}</p>
                          <p className="text-white font-medium">{evento.titulo}</p>
                          {evento.descripcion && <p className="text-slate-400 text-sm mt-1">{evento.descripcion}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Recordatorios */}
        {activeTab === 'recordatorios' && (
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Recordatorios</h3>
              {puedeEditarCliente(cliente) && (
                <button
                  onClick={() => { setEditingRecordatorio(null); setRecordatorioForm({ titulo: '', fecha: '', descripcion: '', responsableId: '' }); setShowRecordatorioForm(true); }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-sm hover:bg-amber-500/30 transition-all"
                >
                  <Plus size={14} /> Nuevo Recordatorio
                </button>
              )}
            </div>
            {recordatoriosCliente.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No hay recordatorios</p>
            ) : (
              <div className="space-y-3">
                {recordatoriosCliente.map(r => {
                  const hoy = getFechaLocal();
                  const vencido = !r.completado && r.fecha < hoy;
                  const esHoy = r.fecha === hoy;
                  const responsable = usuarios.find(u => u.id === r.responsableId);
                  return (
                    <div key={r.id} className={`flex items-center gap-4 p-4 rounded-xl group ${r.completado ? 'bg-slate-800/30' : vencido ? 'bg-red-500/10 border border-red-500/30' : esHoy ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-slate-800/50'}`}>
                      <button onClick={() => setRecordatorios(recordatorios.map(rec => rec.id === r.id ? { ...rec, completado: !rec.completado } : rec))} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${r.completado ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 hover:border-emerald-500'}`}>{r.completado && <CheckCircle size={14} className="text-white" />}</button>
                      <div className="flex-1">
                        <p className={`font-medium ${r.completado ? 'text-slate-500 line-through' : 'text-white'}`}>{r.titulo}</p>
                        {r.descripcion && <p className="text-slate-400 text-sm">{r.descripcion}</p>}
                        {responsable && <span className="text-xs text-violet-400">{responsable.nombre}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`text-sm ${vencido ? 'text-red-400' : esHoy ? 'text-amber-400' : 'text-slate-400'}`}>{formatDate(r.fecha)}</p>
                          {vencido && <span className="text-xs text-red-400">Vencido</span>}
                          {esHoy && !r.completado && <span className="text-xs text-amber-400">Hoy</span>}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {puedeEditarRecordatorio(r) && <button onClick={() => handleEditRecordatorio(r)} className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 rounded-lg"><Edit size={14} /></button>}
                          {puedeEliminarRecordatorio(r) && <button onClick={() => handleDeleteRecordatorio(r.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg"><Trash2 size={14} /></button>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Clientes</h1>
          <p className="text-slate-400">{clientes.length} empresas registradas</p>
        </div>
        {puedeCrear && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white px-5 py-3 rounded-xl hover:opacity-90 transition-all font-medium"
          >
            <Plus size={20} /> Nuevo Cliente
          </button>
        )}
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" size={20} />
        <input
          type="text"
          placeholder="Buscar por empresa, contacto o industria..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border-2 border-slate-400 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
        />
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
          <h2 className="text-xl font-bold text-white mb-6">{editingId ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" placeholder="Empresa *" value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" required />
            <input type="text" placeholder="Contacto Principal" value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="text" placeholder="Cargo" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="tel" placeholder="Teléfono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            {/* Selector de industria con opción de agregar nueva */}
            <div className="relative">
              {!showNewIndustria ? (
                <div className="flex gap-2">
                  <select value={form.industria} onChange={(e) => setForm({ ...form, industria: e.target.value })} className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-cyan-500/50">
                    <option value="">Seleccionar industria</option>
                    {todasLasIndustrias.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                  <button type="button" onClick={() => setShowNewIndustria(true)} className="px-3 py-3 bg-slate-700 hover:bg-slate-600 text-cyan-400 rounded-xl transition-all" title="Agregar nueva industria">
                    <Plus size={20} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input type="text" placeholder="Nueva industria..." value={newIndustriaName} onChange={(e) => setNewIndustriaName(e.target.value)} className="flex-1 px-4 py-3 bg-slate-800 border border-cyan-500/50 rounded-xl text-white placeholder-slate-500" autoFocus />
                  <button type="button" onClick={handleAddIndustria} className="px-3 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl transition-all" title="Guardar">
                    <Save size={20} />
                  </button>
                  <button type="button" onClick={() => { setShowNewIndustria(false); setNewIndustriaName(''); }} className="px-3 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-all" title="Cancelar">
                    <X size={20} />
                  </button>
                </div>
              )}
            </div>
            {/* Selector de servicio con opción de agregar nuevo */}
            <div className="relative">
              {!showNewServicio ? (
                <div className="flex gap-2">
                  <select value={form.servicio} onChange={(e) => setForm({ ...form, servicio: e.target.value })} className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-cyan-500/50">
                    <option value="">Seleccionar servicio</option>
                    {todosLosServicios.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button type="button" onClick={() => setShowNewServicio(true)} className="px-3 py-3 bg-slate-700 hover:bg-slate-600 text-cyan-400 rounded-xl transition-all" title="Agregar nuevo servicio">
                    <Plus size={20} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input type="text" placeholder="Nuevo servicio..." value={newServicioName} onChange={(e) => setNewServicioName(e.target.value)} className="flex-1 px-4 py-3 bg-slate-800 border border-cyan-500/50 rounded-xl text-white placeholder-slate-500" autoFocus />
                  <button type="button" onClick={handleAddServicio} className="px-3 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl transition-all" title="Guardar">
                    <Save size={20} />
                  </button>
                  <button type="button" onClick={() => { setShowNewServicio(false); setNewServicioName(''); }} className="px-3 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-all" title="Cancelar">
                    <X size={20} />
                  </button>
                </div>
              )}
            </div>
            <input type="url" placeholder="Sitio Web" value={form.sitioWeb} onChange={(e) => setForm({ ...form, sitioWeb: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="number" placeholder="Número de empleados" value={form.numeroEmpleados} onChange={(e) => setForm({ ...form, numeroEmpleados: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            {/* Fuente */}
            <select value={form.fuente || ''} onChange={(e) => setForm({ ...form, fuente: e.target.value, referidoPor: e.target.value !== 'Referido' ? '' : form.referidoPor, esComisionista: e.target.value !== 'Referido' ? false : form.esComisionista })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-cyan-500/50">
              <option value="">Fuente del cliente</option>
              {FUENTES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            {/* Campos adicionales si es Referido */}
            {form.fuente === 'Referido' && (
              <>
                <input type="text" placeholder="Nombre de quien refirió *" value={form.referidoPor || ''} onChange={(e) => setForm({ ...form, referidoPor: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
                <label className="flex items-center gap-3 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl cursor-pointer hover:border-cyan-500/50 transition-all">
                  <input type="checkbox" checked={form.esComisionista || false} onChange={(e) => setForm({ ...form, esComisionista: e.target.checked })} className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500/50" />
                  <span className="text-white">Es comisionista</span>
                </label>
              </>
            )}
            {/* Tags */}
            <div className="md:col-span-2">
              <p className="text-slate-400 text-sm mb-2">Etiquetas</p>
              <div className="flex flex-wrap gap-2">
                {TAGS_DISPONIBLES.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${(form.tags || []).includes(tag.id) ? `${tag.color} text-white` : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    <Tag size={14} className="inline mr-1" />{tag.name}
                  </button>
                ))}
              </div>
            </div>
            {esAdmin && (
              <select value={form.asignadoA || ''} onChange={(e) => setForm({ ...form, asignadoA: e.target.value })} className="md:col-span-2 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-cyan-500/50">
                <option value="">Asignar responsable... (yo mismo)</option>
                {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.id === currentUser?.id ? '(yo)' : ''}</option>)}
              </select>
            )}
            <textarea placeholder="Notas" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="md:col-span-2 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50 resize-none" rows="2"></textarea>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white px-5 py-3 rounded-xl hover:opacity-90 transition-all font-medium">
                <Save size={20} /> Guardar
              </button>
              <button type="button" onClick={resetForm} className="flex items-center gap-2 bg-slate-800 text-slate-300 px-5 py-3 rounded-xl hover:bg-slate-700 transition-all font-medium">
                <X size={20} /> Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClientes.map(cliente => (
          <div
            key={cliente.id}
            className="group bg-slate-900/50 backdrop-blur-sm rounded-2xl p-5 border-2 border-slate-400 hover:border-cyan-500/30 transition-all cursor-pointer"
            onClick={() => setSelectedCliente(cliente.id)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center">
                <Building className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                {puedeEditarCliente(cliente) && (
                  <button onClick={() => handleEdit(cliente)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
                    <Edit size={16} />
                  </button>
                )}
                {puedeEliminarCliente(cliente) && (
                  <button onClick={() => handleDelete(cliente.id)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">{cliente.empresa}</h3>
            <p className="text-slate-300 text-sm">{cliente.contacto || 'Sin contacto'}</p>
            {cliente.cargo && <p className="text-slate-500 text-xs mb-1">{cliente.cargo}</p>}
            {/* Contacto info */}
            <div className="space-y-1 mb-3 mt-2">
              {cliente.email && (
                <p className="text-slate-400 text-xs flex items-center gap-1.5">
                  <Mail size={12} className="text-cyan-400" />
                  <span className="truncate">{cliente.email}</span>
                </p>
              )}
              {cliente.telefono && (
                <p className="text-slate-400 text-xs flex items-center gap-1.5">
                  <Phone size={12} className="text-emerald-400" />
                  {cliente.telefono}
                </p>
              )}
            </div>
            {/* Tags */}
            {(cliente.tags || []).length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {(cliente.tags || []).slice(0, 3).map(tagId => {
                  const tag = TAGS_DISPONIBLES.find(t => t.id === tagId);
                  return tag ? (
                    <span key={tagId} className={`px-2 py-0.5 rounded text-xs text-white ${tag.color}`}>
                      {tag.name}
                    </span>
                  ) : null;
                })}
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs px-2 py-1 bg-slate-800 text-slate-400 rounded-lg">{cliente.industria || 'Sin industria'}</span>
              {cliente.numeroEmpleados && (
                <span className="text-cyan-400 text-sm font-medium">{cliente.numeroEmpleados} empleados</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredClientes.length === 0 && (
        <div className="text-center py-12">
          <Building className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-500">No hay clientes registrados</p>
        </div>
      )}
    </div>
  );
}

// ============== PIPELINE ==============
function Pipeline({ pipeline, setPipeline, clientes, setClientes, actividades, setActividades, recordatorios, setRecordatorios, tareas, setTareas, usuarios, currentUser, addNotificacion, setEmailDestinatario, setEmailModalOpen, todosLosServicios, addServicio, addAuditLog }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingNota, setEditingNota] = useState(null);
  const [notaTexto, setNotaTexto] = useState('');
  const [selectedProspecto, setSelectedProspecto] = useState(null);
  const [activeTab, setActiveTab] = useState('info');
  const [showActividadForm, setShowActividadForm] = useState(false);
  const [showRecordatorioForm, setShowRecordatorioForm] = useState(false);
  const [actividadArchivo, setActividadArchivo] = useState(null);
  const [subiendoActividad, setSubiendoActividad] = useState(false);
  const [form, setForm] = useState({
    nombre: '', empresa: '', contacto: '', cargo: '', email: '', telefono: '', paginaWeb: '', clienteId: '', etapa: 'prospecto', valorEstimado: '', servicio: '', notas: '', fechaSeguimiento: '', notaRapida: '', asignadoA: '',
    fuente: '', referidoPor: '', esComisionista: false, numeroEmpleados: ''
  });
  const [actividadForm, setActividadForm] = useState({
    tipo: 'llamada', titulo: '', descripcion: '', fecha: getFechaLocal(), responsableId: ''
  });
  const [recordatorioForm, setRecordatorioForm] = useState({
    titulo: '', fecha: '', descripcion: '', responsableId: ''
  });
  const [editingActividad, setEditingActividad] = useState(null);
  const [viewingActividad, setViewingActividad] = useState(null);
  const [editingRecordatorio, setEditingRecordatorio] = useState(null);
  // Para editar tareas desde la pestaña Tareas
  const [showTareaForm, setShowTareaForm] = useState(false);
  const [editingTarea, setEditingTarea] = useState(null);
  const [tareaFormData, setTareaFormData] = useState({ descripcion: '', fechaCompromiso: '', prioridad: 'media', responsableId: '' });
  // Tareas y recordatorios a crear desde el modal de actividad
  const [tareasNuevas, setTareasNuevas] = useState([]);
  const [recordatoriosNuevos, setRecordatoriosNuevos] = useState([]);
  const [mostrarFormTarea, setMostrarFormTarea] = useState(false);
  const [mostrarFormRecordatorioNuevo, setMostrarFormRecordatorioNuevo] = useState(false);
  const [tareaTemp, setTareaTemp] = useState({ descripcion: '', fechaCompromiso: '', prioridad: 'media', responsableId: '' });
  const [recordatorioTemp, setRecordatorioTemp] = useState({ titulo: '', fecha: '', descripcion: '', responsableId: '' });
  const [editandoTareaExistenteId, setEditandoTareaExistenteId] = useState(null);
  const [editandoRecordatorioExistenteId, setEditandoRecordatorioExistenteId] = useState(null);
  const [showNewServicio, setShowNewServicio] = useState(false);
  const [newServicioName, setNewServicioName] = useState('');

  // Usuarios activos para asignar
  const usuariosActivos = (usuarios || []).filter(u => u.activo !== false);

  // Permisos del usuario actual para pipeline (fallback a permisos básicos, no admin)
  const permisosPipeline = currentUser?.permisos?.pipeline || { ver: 'todos', crear: true, editar: 'propios', eliminar: false };
  const permisosActividades = currentUser?.permisos?.actividades || { ver: 'todos', crear: true, editar: 'propios', eliminar: false };
  const permisosTareas = currentUser?.permisos?.tareas || { ver: 'todos', crear: true, editar: 'propios', eliminar: 'propios' };
  const permisosRecordatorios = currentUser?.permisos?.recordatorios || { ver: 'todos', crear: true, editar: 'propios', eliminar: 'propios' };

  const puedeCrear = permisosPipeline.crear === true;
  const esAdmin = currentUser?.permisos?.modulos?.equipo === true;

  // Función para verificar si puede editar un prospecto específico
  const puedeEditarProspecto = (prospecto) => {
    if (!prospecto) return false;
    // Admin siempre puede editar
    if (esAdmin) return true;
    // Permitir si tiene permisos de editar todos o legacy true
    if (permisosPipeline.editar === 'todos' || permisosPipeline.editar === true) return true;
    // Si es 'propios', verificar que el prospecto sea suyo
    if (permisosPipeline.editar === 'propios') {
      return prospecto.asignadoA === currentUser?.id || prospecto.creadoPor === currentUser?.id;
    }
    // En cualquier otro caso (false, undefined, etc), no permitir
    return false;
  };

  // Función para verificar si puede eliminar un prospecto específico
  const puedeEliminarProspecto = (prospecto) => {
    if (!prospecto) return false;
    // Admin siempre puede eliminar
    if (esAdmin) return true;
    // Permitir si tiene permisos de eliminar todos o legacy true
    if (permisosPipeline.eliminar === 'todos' || permisosPipeline.eliminar === true) return true;
    // Si es 'propios', verificar que el prospecto sea suyo
    if (permisosPipeline.eliminar === 'propios') {
      return prospecto.asignadoA === currentUser?.id || prospecto.creadoPor === currentUser?.id;
    }
    // En cualquier otro caso (false, undefined, etc), no permitir
    return false;
  };

  // Funciones para actividades en pipeline
  const puedeVerActividad = (actividad) => {
    if (permisosActividades.ver === 'todos' || permisosActividades.ver === true) return true;
    if (permisosActividades.ver === 'propios') {
      return actividad.creadoPor === currentUser?.id || actividad.responsableId === currentUser?.id;
    }
    return false;
  };

  const puedeEditarActividad = (actividad) => {
    if (!actividad) return false;
    if (permisosActividades.editar === 'todos' || permisosActividades.editar === true) return true;
    if (permisosActividades.editar === 'propios') {
      return actividad.creadoPor === currentUser?.id || actividad.responsableId === currentUser?.id;
    }
    return false;
  };

  const puedeEliminarActividad = (actividad) => {
    if (!actividad) return false;
    if (permisosActividades.eliminar === 'todos' || permisosActividades.eliminar === true) return true;
    if (permisosActividades.eliminar === 'propios') {
      return actividad.creadoPor === currentUser?.id || actividad.responsableId === currentUser?.id;
    }
    return false;
  };

  // Funciones para tareas en pipeline
  const puedeVerTarea = (tarea) => {
    if (permisosTareas.ver === 'todos' || permisosTareas.ver === true) return true;
    if (permisosTareas.ver === 'propios') {
      return tarea.creadoPor === currentUser?.id || tarea.responsableId === currentUser?.id;
    }
    return false;
  };

  const puedeEditarTarea = (tarea) => {
    if (!tarea) return false;
    if (permisosTareas.editar === 'todos' || permisosTareas.editar === true) return true;
    if (permisosTareas.editar === 'propios') {
      return tarea.creadoPor === currentUser?.id || tarea.responsableId === currentUser?.id;
    }
    return false;
  };

  const puedeEliminarTarea = (tarea) => {
    if (!tarea) return false;
    if (permisosTareas.eliminar === 'todos' || permisosTareas.eliminar === true) return true;
    if (permisosTareas.eliminar === 'propios') {
      return tarea.creadoPor === currentUser?.id || tarea.responsableId === currentUser?.id;
    }
    return false;
  };

  // Funciones para recordatorios en pipeline
  const puedeVerRecordatorio = (recordatorio) => {
    if (permisosRecordatorios.ver === 'todos' || permisosRecordatorios.ver === true) return true;
    if (permisosRecordatorios.ver === 'propios') {
      return recordatorio.creadoPor === currentUser?.id || recordatorio.responsableId === currentUser?.id;
    }
    return false;
  };

  const puedeEditarRecordatorio = (recordatorio) => {
    if (!recordatorio) return false;
    if (permisosRecordatorios.editar === 'todos' || permisosRecordatorios.editar === true) return true;
    if (permisosRecordatorios.editar === 'propios') {
      return recordatorio.creadoPor === currentUser?.id || recordatorio.responsableId === currentUser?.id;
    }
    return false;
  };

  const puedeEliminarRecordatorio = (recordatorio) => {
    if (!recordatorio) return false;
    if (esAdmin) return true;
    if (permisosRecordatorios.eliminar === 'todos' || permisosRecordatorios.eliminar === true) return true;
    if (permisosRecordatorios.eliminar === 'propios') {
      return recordatorio.creadoPor === currentUser?.id || recordatorio.responsableId === currentUser?.id;
    }
    return false;
  };

  // Manejar agregar nuevo servicio
  const handleAddServicio = () => {
    if (addServicio(newServicioName)) {
      setForm({ ...form, servicio: newServicioName.trim() });
      setNewServicioName('');
      setShowNewServicio(false);
    }
  };

  const resetForm = () => {
    setForm({ nombre: '', empresa: '', contacto: '', cargo: '', email: '', telefono: '', paginaWeb: '', clienteId: '', etapa: 'prospecto', valorEstimado: '', servicio: '', notas: '', fechaSeguimiento: '', notaRapida: '', fuente: '', referidoPor: '', esComisionista: false, numeroEmpleados: '' });
    setShowForm(false);
    setEditingId(null);
    setShowNewServicio(false);
    setNewServicioName('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cliente = clientes.find(c => c.id === form.clienteId);
    const empresaNombre = form.empresa || cliente?.empresa || '';
    // Asegurar que no haya valores undefined
    const cleanForm = {
      nombre: form.nombre || empresaNombre,
      empresa: empresaNombre,
      contacto: form.contacto || '',
      cargo: form.cargo || '',
      email: form.email || '',
      telefono: form.telefono || '',
      paginaWeb: form.paginaWeb || '',
      clienteId: form.clienteId || '',
      etapa: form.etapa || 'prospecto',
      valorEstimado: form.valorEstimado || '',
      servicio: form.servicio || '',
      notas: form.notas || '',
      fechaSeguimiento: form.fechaSeguimiento || '',
      notaRapida: form.notaRapida || '',
      fuente: form.fuente || '',
      referidoPor: form.referidoPor || '',
      esComisionista: form.esComisionista || false,
      numeroEmpleados: form.numeroEmpleados || ''
    };
    if (editingId) {
      setPipeline(pipeline.map(p => p.id === editingId ? { ...p, ...cleanForm, asignadoA: form.asignadoA || p.asignadoA || currentUser?.id } : p));
      addAuditLog('editar', 'pipeline', `Oportunidad editada: ${cleanForm.nombre}`, editingId, cleanForm.nombre);
    } else {
      const nuevoId = generateId();
      const nuevo = {
        ...cleanForm,
        id: nuevoId,
        fechaCreacion: getFechaLocal(),
        creadoPor: currentUser?.id,
        asignadoA: form.asignadoA || currentUser?.id,
        historialEtapas: [{
          etapaAnterior: null,
          etapaNueva: cleanForm.etapa || 'prospecto',
          fecha: new Date().toISOString(),
          usuarioId: currentUser?.id,
          usuarioNombre: currentUser?.nombre
        }]
      };
      setPipeline([...pipeline, nuevo]);
      addAuditLog('crear', 'pipeline', `Nueva oportunidad: ${cleanForm.nombre}`, nuevoId, cleanForm.nombre);
    }
    resetForm();
  };

  const handleEdit = (item) => {
    // Asegurar valores por defecto para campos que puedan no existir
    setForm({
      nombre: item.nombre || '',
      empresa: item.empresa || '',
      contacto: item.contacto || '',
      cargo: item.cargo || '',
      email: item.email || '',
      telefono: item.telefono || '',
      paginaWeb: item.paginaWeb || '',
      clienteId: item.clienteId || '',
      etapa: item.etapa || 'prospecto',
      valorEstimado: item.valorEstimado || '',
      servicio: item.servicio || '',
      notas: item.notas || '',
      fechaSeguimiento: item.fechaSeguimiento || '',
      notaRapida: item.notaRapida || '',
      asignadoA: item.asignadoA || '',
      fuente: item.fuente || '',
      referidoPor: item.referidoPor || '',
      esComisionista: item.esComisionista || false,
      numeroEmpleados: item.numeroEmpleados || ''
    });
    setEditingId(item.id);
    setShowForm(true);
    setSelectedProspecto(null);
  };

  const handleDelete = (id) => {
    if (window.confirm('¿Eliminar este elemento del pipeline?')) {
      setPipeline(pipeline.filter(p => p.id !== id));
    }
  };

  const moverEtapa = (id, nuevaEtapa) => {
    const prospecto = pipeline.find(p => p.id === id);
    const etapaAnterior = prospecto?.etapa;

    // Agregar al historial de etapas
    const nuevoHistorial = [
      ...(prospecto?.historialEtapas || []),
      {
        etapaAnterior: etapaAnterior,
        etapaNueva: nuevaEtapa,
        fecha: new Date().toISOString(),
        usuarioId: currentUser?.id,
        usuarioNombre: currentUser?.nombre
      }
    ];

    setPipeline(pipeline.map(p => p.id === id ? { ...p, etapa: nuevaEtapa, historialEtapas: nuevoHistorial } : p));

    // Si pasa a "cerrado" (Cerrado Ganado), crear automáticamente un cliente
    if (nuevaEtapa === 'cerrado') {
      if (prospecto) {
        // Verificar si ya existe un cliente con este email o empresa
        const yaExiste = clientes.some(c =>
          (prospecto.email && c.email === prospecto.email) ||
          (prospecto.empresa && c.empresa === prospecto.empresa)
        );

        if (!yaExiste) {
          const nuevoClienteId = generateId();
          const nuevoCliente = {
            id: nuevoClienteId,
            empresa: prospecto.empresa || prospecto.nombre || '',
            contacto: prospecto.contacto || prospecto.nombre || '',
            email: prospecto.email || '',
            telefono: prospecto.telefono || '',
            sitioWeb: prospecto.paginaWeb || '',
            industria: '',
            servicio: prospecto.servicio || '',
            notas: `Convertido desde Pipeline. ${prospecto.notas || ''}`.trim(),
            fechaCreacion: getFechaLocal(),
            creadoPor: prospecto.creadoPor || currentUser?.id,
            asignadoA: prospecto.asignadoA || currentUser?.id,
            pipelineId: prospecto.id, // Referencia al prospecto original
            fuente: prospecto.fuente || '',
            referidoPor: prospecto.referidoPor || '',
            esComisionista: prospecto.esComisionista || false
          };
          setClientes(prev => [...prev, nuevoCliente]);

          // Transferir actividades del pipeline al cliente
          const actividadesProspecto = actividades.filter(a => a.pipelineId === id);
          if (actividadesProspecto.length > 0) {
            setActividades(prev => prev.map(a =>
              a.pipelineId === id
                ? { ...a, clienteId: nuevoClienteId, pipelineId: null, empresaNombre: nuevoCliente.empresa }
                : a
            ));
          }

          // Transferir tareas del pipeline al cliente
          const tareasProspecto = tareas.filter(t => t.pipelineId === id);
          if (tareasProspecto.length > 0) {
            setTareas(prev => prev.map(t =>
              t.pipelineId === id
                ? { ...t, clienteId: nuevoClienteId, pipelineId: null, empresaNombre: nuevoCliente.empresa }
                : t
            ));
          }

          // Transferir recordatorios del pipeline al cliente
          const recordatoriosProspecto = recordatorios.filter(r => r.pipelineId === id);
          if (recordatoriosProspecto.length > 0) {
            setRecordatorios(prev => prev.map(r =>
              r.pipelineId === id
                ? { ...r, clienteId: nuevoClienteId, pipelineId: null, empresaNombre: nuevoCliente.empresa }
                : r
            ));
          }

          addAuditLog('crear', 'clientes', `Cliente creado desde Pipeline: ${nuevoCliente.empresa} (${actividadesProspecto.length} actividades, ${tareasProspecto.length} tareas, ${recordatoriosProspecto.length} recordatorios transferidos)`, nuevoClienteId, nuevoCliente.empresa);
          addNotificacion(
            currentUser?.id,
            `Nuevo cliente creado: ${nuevoCliente.empresa}`,
            'pipeline',
            null,
            'Cerrado Ganado'
          );
        }
      }
    }

    // Si sale de "cerrado" (Cerrado Ganado) a otra etapa, eliminar el cliente creado automáticamente
    if (etapaAnterior === 'cerrado' && nuevaEtapa !== 'cerrado') {
      // Buscar cliente que fue creado desde este prospecto
      const clienteCreado = clientes.find(c => c.pipelineId === id);
      if (clienteCreado) {
        if (window.confirm(`¿Eliminar también el cliente "${clienteCreado.empresa}" que fue creado automáticamente? Las actividades, tareas y recordatorios volverán al pipeline.`)) {
          // Devolver actividades al pipeline
          setActividades(prev => prev.map(a =>
            a.clienteId === clienteCreado.id
              ? { ...a, pipelineId: id, clienteId: null }
              : a
          ));

          // Devolver tareas al pipeline
          setTareas(prev => prev.map(t =>
            t.clienteId === clienteCreado.id
              ? { ...t, pipelineId: id, clienteId: null }
              : t
          ));

          // Devolver recordatorios al pipeline
          setRecordatorios(prev => prev.map(r =>
            r.clienteId === clienteCreado.id
              ? { ...r, pipelineId: id, clienteId: null }
              : r
          ));

          setClientes(prev => prev.filter(c => c.id !== clienteCreado.id));
          addAuditLog('eliminar', 'clientes', `Cliente eliminado al revertir etapa: ${clienteCreado.empresa} (actividades, tareas y recordatorios devueltos al pipeline)`, clienteCreado.id, clienteCreado.empresa);
          addNotificacion(
            currentUser?.id,
            `Cliente eliminado: ${clienteCreado.empresa}`,
            'pipeline',
            null,
            'Etapa revertida'
          );
        }
      }
    }
  };

  const guardarNotaRapida = (id) => {
    setPipeline(pipeline.map(p => p.id === id ? { ...p, notaRapida: notaTexto } : p));
    setEditingNota(null);
    setNotaTexto('');
  };

  const iniciarEditarNota = (item) => {
    setEditingNota(item.id);
    setNotaTexto(item.notaRapida || '');
  };

  // Actividades del prospecto
  const handleAddActividad = async (e) => {
    e.preventDefault();
    setSubiendoActividad(true);
    try {
      let archivoData = null;
      if (actividadArchivo) {
        const timestamp = Date.now();
        const fileName = `actividades/pipeline/${selectedProspecto}/${timestamp}_${actividadArchivo.name}`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, actividadArchivo);
        const url = await getDownloadURL(storageRef);
        archivoData = { nombre: actividadArchivo.name, tipo: actividadArchivo.type, tamano: actividadArchivo.size, url };
      }
      const prospecto = pipeline.find(p => p.id === selectedProspecto);
      const responsableId = actividadForm.responsableId || currentUser?.id;

      let actividadId;

      if (editingActividad) {
        // Modo edición
        actividadId = editingActividad.id;
        setActividades(actividades.map(a => a.id === editingActividad.id ? {
          ...a,
          ...actividadForm,
          responsableId,
          archivo: archivoData || a.archivo
        } : a));
        setEditingActividad(null);
      } else {
        // Nueva actividad
        actividadId = generateId();
        const nuevaActividad = {
          ...actividadForm, id: actividadId, pipelineId: selectedProspecto, responsableId, creadoPor: currentUser?.id, fechaCreacion: new Date().toISOString(), archivo: archivoData
        };
        setActividades([...actividades, nuevaActividad]);

        // Notificar al responsable si es diferente al usuario actual
        if (responsableId && responsableId !== currentUser?.id && addNotificacion) {
          addNotificacion(
            responsableId,
            `Nueva actividad asignada: ${actividadForm.descripcion || actividadForm.tipo} - Prospecto: ${prospecto?.empresa || prospecto?.nombre || 'Prospecto'}`,
            'actividad'
          );
        }
      }

      // Crear tareas derivadas de la actividad (aplica tanto para nueva como para edición)
      if (tareasNuevas.length > 0 && setTareas) {
        const nuevasTareasCompletas = tareasNuevas.map(t => ({
          id: generateId(),
          descripcion: t.descripcion,
          fechaCompromiso: t.fechaCompromiso,
          prioridad: t.prioridad,
          responsableId: t.responsableId || currentUser?.id,
          pipelineId: selectedProspecto,
          actividadId: actividadId,
          completada: false,
          fechaCreacion: new Date().toISOString(),
          creadoPor: currentUser?.id
        }));
        setTareas(prev => [...prev, ...nuevasTareasCompletas]);

        // Notificar tareas asignadas a otros
        nuevasTareasCompletas.forEach(tarea => {
          if (tarea.responsableId && tarea.responsableId !== currentUser?.id && addNotificacion) {
            addNotificacion(tarea.responsableId, `Nueva tarea asignada: ${tarea.descripcion}`, 'tarea');
          }
        });
      }

      // Crear recordatorios derivados de la actividad (aplica tanto para nueva como para edición)
      if (recordatoriosNuevos.length > 0) {
        const nuevosRecordatoriosCompletos = recordatoriosNuevos.map(r => ({
          id: generateId(),
          titulo: r.titulo,
          descripcion: r.descripcion,
          fecha: r.fecha,
          responsableId: r.responsableId || currentUser?.id,
          pipelineId: selectedProspecto,
          actividadId: actividadId,
          completado: false,
          fechaCreacion: new Date().toISOString(),
          creadoPor: currentUser?.id
        }));
        setRecordatorios(prev => [...prev, ...nuevosRecordatoriosCompletos]);

        // Notificar recordatorios asignados a otros
        nuevosRecordatoriosCompletos.forEach(rec => {
          if (rec.responsableId && rec.responsableId !== currentUser?.id && addNotificacion) {
            addNotificacion(rec.responsableId, `Nuevo recordatorio asignado: ${rec.titulo}`, 'recordatorio');
          }
        });
      }

      setActividadForm({ tipo: 'llamada', titulo: '', descripcion: '', fecha: getFechaLocal(), responsableId: '' });
      setActividadArchivo(null);
      setTareasNuevas([]);
      setRecordatoriosNuevos([]);
      setShowActividadForm(false);
    } catch (error) {
      alert('Error al guardar: ' + error.message);
    }
    setSubiendoActividad(false);
  };

  const handleAddRecordatorio = (e) => {
    e.preventDefault();
    const prospecto = pipeline.find(p => p.id === selectedProspecto);
    const responsableId = recordatorioForm.responsableId || currentUser?.id;

    if (editingRecordatorio) {
      // Modo edición
      setRecordatorios(recordatorios.map(r => r.id === editingRecordatorio.id ? {
        ...r,
        ...recordatorioForm,
        responsableId
      } : r));
      setEditingRecordatorio(null);
    } else {
      // Nuevo recordatorio
      const nuevoRecordatorio = {
        ...recordatorioForm, id: generateId(), pipelineId: selectedProspecto, responsableId, creadoPor: currentUser?.id, completado: false, fechaCreacion: new Date().toISOString()
      };
      setRecordatorios([...recordatorios, nuevoRecordatorio]);

      // Notificar al responsable si es diferente al usuario actual
      if (responsableId && responsableId !== currentUser?.id && addNotificacion) {
        addNotificacion(
          responsableId,
          `Nuevo recordatorio asignado: ${recordatorioForm.titulo} - Prospecto: ${prospecto?.empresa || prospecto?.nombre || 'Prospecto'} - Fecha: ${formatDate(recordatorioForm.fecha)}`,
          'recordatorio'
        );
      }
    }

    setRecordatorioForm({ titulo: '', fecha: '', descripcion: '', responsableId: '' });
    setShowRecordatorioForm(false);
  };

  // Actividades: todos pueden ver todas
  const actividadesProspecto = actividades.filter(a => a.pipelineId === selectedProspecto).sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));
  // Recordatorios: solo propios (admin ve todos)
  const recordatoriosProspecto = recordatorios.filter(r => r.pipelineId === selectedProspecto).filter(r => esAdmin || r.creadoPor === currentUser?.id || r.responsableId === currentUser?.id).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  // Tareas: solo propias (admin ve todas)
  const tareasProspecto = (tareas || []).filter(t => t.pipelineId === selectedProspecto).filter(t => esAdmin || t.creadoPor === currentUser?.id || t.responsableId === currentUser?.id);

  // Funciones para editar/eliminar actividades
  const handleEditActividad = (actividad) => {
    setActividadForm({
      tipo: actividad.tipo,
      titulo: actividad.titulo,
      descripcion: actividad.descripcion || '',
      fecha: actividad.fecha,
      responsableId: actividad.responsableId || ''
    });
    setEditingActividad(actividad);
    setShowActividadForm(true);
  };

  const handleDeleteActividad = (id) => {
    const tareasVinculadas = tareas.filter(t => t.actividadId === id);
    const recordatoriosVinculados = recordatorios.filter(r => r.actividadId === id);
    const tieneVinculados = tareasVinculadas.length > 0 || recordatoriosVinculados.length > 0;

    const mensaje = tieneVinculados
      ? `¿Eliminar esta actividad?\n\nTambién se eliminarán:\n- ${tareasVinculadas.length} tarea(s)\n- ${recordatoriosVinculados.length} recordatorio(s)\n\nvinculados a esta actividad.`
      : '¿Eliminar esta actividad?';

    if (window.confirm(mensaje)) {
      setActividades(actividades.filter(a => a.id !== id));
      if (tareasVinculadas.length > 0) {
        setTareas(tareas.filter(t => t.actividadId !== id));
      }
      if (recordatoriosVinculados.length > 0) {
        setRecordatorios(recordatorios.filter(r => r.actividadId !== id));
      }
    }
  };

  const handleEditRecordatorio = (recordatorio) => {
    setRecordatorioForm({
      titulo: recordatorio.titulo,
      fecha: recordatorio.fecha,
      descripcion: recordatorio.descripcion || '',
      responsableId: recordatorio.responsableId || ''
    });
    setEditingRecordatorio(recordatorio);
    setShowRecordatorioForm(true);
  };

  const handleDeleteRecordatorio = (id) => {
    if (window.confirm('¿Eliminar este recordatorio?')) {
      setRecordatorios(recordatorios.filter(r => r.id !== id));
    }
  };

  // Funciones para editar tareas desde la pestaña Tareas
  const handleEditTarea = (tarea) => {
    setTareaFormData({
      descripcion: tarea.descripcion,
      fechaCompromiso: tarea.fechaCompromiso,
      prioridad: tarea.prioridad || 'media',
      responsableId: tarea.responsableId || ''
    });
    setEditingTarea(tarea);
    setShowTareaForm(true);
  };

  const handleAddTareaForm = (e) => {
    e.preventDefault();
    const prospecto = pipeline.find(p => p.id === selectedProspecto);
    const responsableId = tareaFormData.responsableId || currentUser?.id;

    if (editingTarea) {
      // Modo edición
      setTareas(tareas.map(t => t.id === editingTarea.id ? {
        ...t,
        ...tareaFormData,
        responsableId
      } : t));
      setEditingTarea(null);
    } else {
      // Nueva tarea
      const nuevaTarea = {
        ...tareaFormData,
        id: generateId(),
        pipelineId: selectedProspecto,
        responsableId,
        creadoPor: currentUser?.id,
        completada: false,
        fechaCreacion: new Date().toISOString()
      };
      setTareas([...tareas, nuevaTarea]);

      // Notificar al responsable si es diferente al usuario actual
      if (responsableId && responsableId !== currentUser?.id && addNotificacion) {
        addNotificacion(
          responsableId,
          `Nueva tarea asignada: ${tareaFormData.descripcion} - Prospecto: ${prospecto?.empresa || prospecto?.nombre || 'Prospecto'} - Fecha: ${formatDate(tareaFormData.fechaCompromiso)}`,
          'tarea'
        );
      }
    }

    setTareaFormData({ descripcion: '', fechaCompromiso: '', prioridad: 'media', responsableId: '' });
    setShowTareaForm(false);
  };

  const handleDeleteTarea = (id) => {
    if (window.confirm('¿Eliminar esta tarea?')) {
      setTareas(tareas.filter(t => t.id !== id));
    }
  };

  // Agregar o editar tarea temporal/existente
  const agregarTareaTemp = () => {
    if (!tareaTemp.descripcion.trim() || !tareaTemp.fechaCompromiso) return;

    if (editandoTareaExistenteId) {
      // Editando una tarea existente
      setTareas(tareas.map(t => t.id === editandoTareaExistenteId ? {
        ...t,
        descripcion: tareaTemp.descripcion,
        fechaCompromiso: tareaTemp.fechaCompromiso,
        prioridad: tareaTemp.prioridad,
        responsableId: tareaTemp.responsableId || currentUser?.id
      } : t));
      setEditandoTareaExistenteId(null);
    } else {
      // Nueva tarea
      setTareasNuevas([...tareasNuevas, { ...tareaTemp, id: generateId() }]);
    }
    setTareaTemp({ descripcion: '', fechaCompromiso: '', prioridad: 'media', responsableId: '' });
    setMostrarFormTarea(false);
  };

  const editarTareaExistente = (tarea) => {
    setTareaTemp({
      descripcion: tarea.descripcion,
      fechaCompromiso: tarea.fechaCompromiso,
      prioridad: tarea.prioridad,
      responsableId: tarea.responsableId || ''
    });
    setEditandoTareaExistenteId(tarea.id);
    setMostrarFormTarea(true);
  };

  const eliminarTareaTemp = (id) => {
    setTareasNuevas(tareasNuevas.filter(t => t.id !== id));
  };

  // Agregar o editar recordatorio temporal/existente
  const agregarRecordatorioTemp = () => {
    if (!recordatorioTemp.titulo.trim() || !recordatorioTemp.fecha) return;

    if (editandoRecordatorioExistenteId) {
      // Editando un recordatorio existente
      setRecordatorios(recordatorios.map(r => r.id === editandoRecordatorioExistenteId ? {
        ...r,
        titulo: recordatorioTemp.titulo,
        fecha: recordatorioTemp.fecha,
        descripcion: recordatorioTemp.descripcion,
        responsableId: recordatorioTemp.responsableId || currentUser?.id
      } : r));
      setEditandoRecordatorioExistenteId(null);
    } else {
      // Nuevo recordatorio
      setRecordatoriosNuevos([...recordatoriosNuevos, { ...recordatorioTemp, id: generateId() }]);
    }
    setRecordatorioTemp({ titulo: '', fecha: '', descripcion: '', responsableId: '' });
    setMostrarFormRecordatorioNuevo(false);
  };

  const editarRecordatorioExistente = (rec) => {
    setRecordatorioTemp({
      titulo: rec.titulo,
      fecha: rec.fecha,
      descripcion: rec.descripcion || '',
      responsableId: rec.responsableId || ''
    });
    setEditandoRecordatorioExistenteId(rec.id);
    setMostrarFormRecordatorioNuevo(true);
  };

  const eliminarRecordatorioTemp = (id) => {
    setRecordatoriosNuevos(recordatoriosNuevos.filter(r => r.id !== id));
  };

  const getTimeline = (pipelineId) => {
    const prospecto = pipeline.find(p => p.id === pipelineId);

    // Actividades
    const actividadesTimeline = actividades.filter(a => a.pipelineId === pipelineId).map(a => ({
      tipo: 'actividad', subtipo: a.tipo, titulo: a.titulo, descripcion: a.descripcion, fecha: a.fechaCreacion || a.fecha
    }));

    // Historial de etapas
    const etapasTimeline = (prospecto?.historialEtapas || []).map(h => {
      const etapaAnteriorInfo = PIPELINE_STAGES.find(s => s.id === h.etapaAnterior);
      const etapaNuevaInfo = PIPELINE_STAGES.find(s => s.id === h.etapaNueva);
      return {
        tipo: 'etapa',
        subtipo: 'cambio_etapa',
        titulo: h.etapaAnterior ? `${etapaAnteriorInfo?.name || h.etapaAnterior} → ${etapaNuevaInfo?.name || h.etapaNueva}` : `Creado en ${etapaNuevaInfo?.name || h.etapaNueva}`,
        descripcion: h.usuarioNombre ? `Por ${h.usuarioNombre}` : '',
        fecha: h.fecha,
        etapaAnterior: h.etapaAnterior,
        etapaNueva: h.etapaNueva,
        colorEtapa: etapaNuevaInfo?.bg || 'bg-slate-500'
      };
    });

    return [...actividadesTimeline, ...etapasTimeline].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  };

  // Vista de detalle del prospecto
  if (selectedProspecto) {
    const prospecto = pipeline.find(p => p.id === selectedProspecto);
    const cliente = clientes.find(c => c.id === prospecto?.clienteId);
    const stage = PIPELINE_STAGES.find(s => s.id === prospecto?.etapa);
    const timeline = getTimeline(selectedProspecto);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => { setSelectedProspecto(null); setActiveTab('info'); }} className="p-2 hover:bg-slate-800 rounded-xl transition-all">
              <X size={24} className="text-slate-400" />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-white">{prospecto?.nombre}</h1>
                <span className={`px-3 py-1 rounded-lg text-sm text-white ${stage?.bg}`}>{stage?.name}</span>
              </div>
              <p className="text-slate-400">{prospecto?.empresa}</p>
            </div>
          </div>
          {puedeEditarProspecto(prospecto) && (
            <div className="flex gap-2">
              <button onClick={() => setShowActividadForm(true)} className="flex items-center gap-2 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-400 px-4 py-2 rounded-xl transition-all">
                <Plus size={16} /> Actividad
              </button>
              <button onClick={() => setShowRecordatorioForm(true)} className="flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 px-4 py-2 rounded-xl transition-all">
                <Bell size={16} /> Recordatorio
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
          {[
            { id: 'info', name: 'Información', icon: GitBranch },
            { id: 'actividades', name: 'Actividades', icon: PhoneCall, count: actividadesProspecto.length },
            { id: 'tareas', name: 'Tareas', icon: Target, count: tareasProspecto.filter(t => !t.completada).length },
            { id: 'recordatorios', name: 'Recordatorios', icon: Bell, count: recordatoriosProspecto.filter(r => !r.completado).length },
            { id: 'timeline', name: 'Timeline', icon: History, count: timeline.length }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${activeTab === tab.id ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                <Icon size={16} /> {tab.name}
                {tab.count > 0 && <span className="bg-slate-700 text-xs px-2 py-0.5 rounded-full">{tab.count}</span>}
              </button>
            );
          })}
        </div>

        {/* Form Actividad */}
        {showActividadForm && (
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-violet-500/30">
            <h3 className="text-lg font-semibold text-white mb-4">{editingActividad ? 'Editar Actividad' : 'Nueva Actividad'}</h3>
            <form onSubmit={handleAddActividad} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select value={actividadForm.tipo} onChange={(e) => setActividadForm({ ...actividadForm, tipo: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white">
                  {TIPOS_ACTIVIDAD.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input type="date" value={actividadForm.fecha} onChange={(e) => setActividadForm({ ...actividadForm, fecha: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white" />
                <input type="text" placeholder="Título *" value={actividadForm.titulo} onChange={(e) => setActividadForm({ ...actividadForm, titulo: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500" required />
                <select value={actividadForm.responsableId} onChange={(e) => setActividadForm({ ...actividadForm, responsableId: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white">
                  <option value="">Asignar a... (yo mismo)</option>
                  {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.id === currentUser?.id ? '(yo)' : ''}</option>)}
                </select>
                <textarea placeholder="Descripción" value={actividadForm.descripcion} onChange={(e) => setActividadForm({ ...actividadForm, descripcion: e.target.value })} className="md:col-span-2 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 resize-none" rows="2"></textarea>
                <div className="md:col-span-2">
                  <label className="block text-slate-400 text-sm mb-2">Adjuntar archivo (opcional)</label>
                  <div className="border-2 border-dashed border-slate-700 rounded-xl p-4 text-center hover:border-violet-500/50 transition-all">
                    <input type="file" onChange={(e) => setActividadArchivo(e.target.files[0])} className="hidden" id="pipeline-actividad-file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp" />
                    <label htmlFor="pipeline-actividad-file" className="cursor-pointer">
                      {actividadArchivo ? (
                        <div className="flex items-center justify-center gap-3">
                          <FileText size={24} className="text-violet-400" />
                          <div className="text-left"><p className="text-white text-sm">{actividadArchivo.name}</p><p className="text-slate-500 text-xs">{(actividadArchivo.size / 1024).toFixed(1)} KB</p></div>
                          <button type="button" onClick={(e) => { e.preventDefault(); setActividadArchivo(null); }} className="p-1 hover:bg-slate-700 rounded text-red-400"><X size={16} /></button>
                        </div>
                      ) : (
                        <div><Upload size={24} className="mx-auto text-slate-500 mb-2" /><p className="text-slate-400 text-sm">Clic para seleccionar archivo</p><p className="text-slate-600 text-xs">PDF, Word, Excel, Imágenes</p></div>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              {/* Sección de Tareas/Compromisos derivados */}
              <div className="border-t border-slate-700 pt-4 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-cyan-400 flex items-center gap-2">
                      <Target size={16} />
                      Tareas/Compromisos derivados
                    </h4>
                    <button type="button" onClick={() => setMostrarFormTarea(!mostrarFormTarea)} className="text-xs px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-all">
                      {mostrarFormTarea ? 'Cancelar' : '+ Agregar Tarea'}
                    </button>
                  </div>

                  {/* Tareas existentes (solo en modo edición) */}
                  {editingActividad && (() => {
                    const tareasExistentes = tareas.filter(t => t.actividadId === editingActividad.id);
                    if (tareasExistentes.length === 0) return null;
                    return (
                      <div className="mb-3">
                        <p className="text-slate-500 text-xs mb-2">Tareas existentes:</p>
                        <div className="space-y-2">
                          {tareasExistentes.map(t => {
                            const respTarea = usuarios.find(u => u.id === t.responsableId);
                            return (
                              <div key={t.id} className={`flex items-center justify-between rounded-lg p-3 ${t.completada ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-700/50 border border-slate-600'}`}>
                                <div className="flex items-center gap-3">
                                  <button type="button" onClick={() => setTareas(tareas.map(ta => ta.id === t.id ? { ...ta, completada: !ta.completada } : ta))} className="flex-shrink-0">
                                    {t.completada ? <CheckCircle size={16} className="text-emerald-400" /> : <Clock size={16} className="text-slate-400 hover:text-cyan-400" />}
                                  </button>
                                  <div>
                                    <p className={`text-sm ${t.completada ? 'text-emerald-300 line-through' : 'text-white'}`}>{t.descripcion}</p>
                                    <p className="text-slate-500 text-xs">{formatDate(t.fechaCompromiso)} · {t.prioridad} · {respTarea?.nombre || 'Sin asignar'}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button type="button" onClick={() => editarTareaExistente(t)} className="p-1.5 text-cyan-400 hover:bg-cyan-500/20 rounded-lg"><Edit size={14} /></button>
                                  <button type="button" onClick={() => { if (window.confirm('¿Eliminar esta tarea?')) setTareas(tareas.filter(ta => ta.id !== t.id)); }} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg"><Trash2 size={14} /></button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Form para agregar tarea */}
                  {mostrarFormTarea && (
                    <div className="bg-slate-800/50 rounded-xl p-4 mb-3 space-y-3">
                      <input type="text" placeholder="Descripción de la tarea *" value={tareaTemp.descripcion} onChange={(e) => setTareaTemp({ ...tareaTemp, descripcion: e.target.value })} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500" />
                      <div className="grid grid-cols-3 gap-2">
                        <input type="date" value={tareaTemp.fechaCompromiso} onChange={(e) => setTareaTemp({ ...tareaTemp, fechaCompromiso: e.target.value })} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm" />
                        <select value={tareaTemp.prioridad} onChange={(e) => setTareaTemp({ ...tareaTemp, prioridad: e.target.value })} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm">
                          <option value="baja">Baja</option>
                          <option value="media">Media</option>
                          <option value="alta">Alta</option>
                        </select>
                        <select value={tareaTemp.responsableId} onChange={(e) => setTareaTemp({ ...tareaTemp, responsableId: e.target.value })} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm">
                          <option value="">Yo mismo</option>
                          {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={agregarTareaTemp} className="text-xs px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-all">
                          {editandoTareaExistenteId ? 'Guardar cambios' : 'Agregar a la lista'}
                        </button>
                        {editandoTareaExistenteId && (
                          <button type="button" onClick={() => { setEditandoTareaExistenteId(null); setTareaTemp({ descripcion: '', fechaCompromiso: '', prioridad: 'media', responsableId: '' }); setMostrarFormTarea(false); }} className="text-xs px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-all">Cancelar</button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Lista de tareas nuevas por agregar */}
                  {tareasNuevas.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-cyan-400/70 text-xs mb-1">Nuevas tareas a crear:</p>
                      {tareasNuevas.map(t => (
                        <div key={t.id} className="flex items-center justify-between bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
                          <div className="flex items-center gap-3">
                            <Target size={14} className="text-cyan-400" />
                            <div>
                              <p className="text-white text-sm">{t.descripcion}</p>
                              <p className="text-slate-500 text-xs">{formatDate(t.fechaCompromiso)} · {t.prioridad}</p>
                            </div>
                          </div>
                          <button type="button" onClick={() => eliminarTareaTemp(t.id)} className="p-1 text-red-400 hover:bg-red-500/20 rounded"><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sección de Recordatorios */}
                  <div className="border-t border-slate-700 pt-4 mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-amber-400 flex items-center gap-2">
                        <Bell size={16} />
                        Recordatorios derivados
                      </h4>
                      <button type="button" onClick={() => setMostrarFormRecordatorioNuevo(!mostrarFormRecordatorioNuevo)} className="text-xs px-3 py-1 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-all">
                        {mostrarFormRecordatorioNuevo ? 'Cancelar' : '+ Agregar Recordatorio'}
                      </button>
                    </div>

                    {/* Recordatorios existentes (solo en modo edición) */}
                    {editingActividad && (() => {
                      const recordatoriosExistentes = recordatorios.filter(r => r.actividadId === editingActividad.id);
                      if (recordatoriosExistentes.length === 0) return null;
                      return (
                        <div className="mb-3">
                          <p className="text-slate-500 text-xs mb-2">Recordatorios existentes:</p>
                          <div className="space-y-2">
                            {recordatoriosExistentes.map(r => {
                              const respRec = usuarios.find(u => u.id === r.responsableId);
                              return (
                                <div key={r.id} className={`flex items-center justify-between rounded-lg p-3 ${r.completado ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-700/50 border border-slate-600'}`}>
                                  <div className="flex items-center gap-3">
                                    <button type="button" onClick={() => setRecordatorios(recordatorios.map(re => re.id === r.id ? { ...re, completado: !re.completado } : re))} className="flex-shrink-0">
                                      {r.completado ? <CheckCircle size={16} className="text-emerald-400" /> : <Bell size={16} className="text-amber-400 hover:text-amber-300" />}
                                    </button>
                                    <div>
                                      <p className={`text-sm ${r.completado ? 'text-emerald-300 line-through' : 'text-white'}`}>{r.titulo}</p>
                                      <p className="text-slate-500 text-xs">{formatDate(r.fecha)} · {respRec?.nombre || 'Sin asignar'}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button type="button" onClick={() => editarRecordatorioExistente(r)} className="p-1.5 text-cyan-400 hover:bg-cyan-500/20 rounded-lg"><Edit size={14} /></button>
                                    <button type="button" onClick={() => { if (window.confirm('¿Eliminar este recordatorio?')) setRecordatorios(recordatorios.filter(re => re.id !== r.id)); }} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg"><Trash2 size={14} /></button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Form para agregar recordatorio */}
                    {mostrarFormRecordatorioNuevo && (
                      <div className="bg-slate-800/50 rounded-xl p-4 mb-3 space-y-3">
                        <input type="text" placeholder="Título del recordatorio *" value={recordatorioTemp.titulo} onChange={(e) => setRecordatorioTemp({ ...recordatorioTemp, titulo: e.target.value })} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500" />
                        <div className="grid grid-cols-2 gap-2">
                          <input type="date" value={recordatorioTemp.fecha} onChange={(e) => setRecordatorioTemp({ ...recordatorioTemp, fecha: e.target.value })} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm" />
                          <select value={recordatorioTemp.responsableId} onChange={(e) => setRecordatorioTemp({ ...recordatorioTemp, responsableId: e.target.value })} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm">
                            <option value="">Yo mismo</option>
                            {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                          </select>
                        </div>
                        <input type="text" placeholder="Descripción (opcional)" value={recordatorioTemp.descripcion} onChange={(e) => setRecordatorioTemp({ ...recordatorioTemp, descripcion: e.target.value })} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500" />
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={agregarRecordatorioTemp} className="text-xs px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all">
                            {editandoRecordatorioExistenteId ? 'Guardar cambios' : 'Agregar a la lista'}
                          </button>
                          {editandoRecordatorioExistenteId && (
                            <button type="button" onClick={() => { setEditandoRecordatorioExistenteId(null); setRecordatorioTemp({ titulo: '', fecha: '', descripcion: '', responsableId: '' }); setMostrarFormRecordatorioNuevo(false); }} className="text-xs px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-all">Cancelar</button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Lista de recordatorios nuevos por agregar */}
                    {recordatoriosNuevos.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-amber-400/70 text-xs mb-1">Nuevos recordatorios a crear:</p>
                        {recordatoriosNuevos.map(r => (
                          <div key={r.id} className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                            <div className="flex items-center gap-3">
                              <Bell size={14} className="text-amber-400" />
                              <div>
                                <p className="text-white text-sm">{r.titulo}</p>
                                <p className="text-slate-500 text-xs">{formatDate(r.fecha)}</p>
                              </div>
                            </div>
                            <button type="button" onClick={() => eliminarRecordatorioTemp(r.id)} className="p-1 text-red-400 hover:bg-red-500/20 rounded"><Trash2 size={14} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={subiendoActividad} className="flex items-center gap-2 bg-violet-500 text-white px-5 py-3 rounded-xl hover:bg-violet-600 transition-all disabled:opacity-50">
                  {subiendoActividad ? <Loader size={18} className="animate-spin" /> : <Save size={18} />} {subiendoActividad ? 'Guardando...' : editingActividad ? 'Guardar Cambios' : 'Guardar'}
                </button>
                <button type="button" onClick={() => { setShowActividadForm(false); setActividadArchivo(null); setEditingActividad(null); setTareasNuevas([]); setRecordatoriosNuevos([]); }} className="flex items-center gap-2 bg-slate-800 text-slate-300 px-5 py-3 rounded-xl hover:bg-slate-700 transition-all"><X size={18} /> Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* Modal Ver Detalle de Actividad */}
        {viewingActividad && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setViewingActividad(null)}>
            <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {(() => {
                const tipo = TIPOS_ACTIVIDAD.find(t => t.id === viewingActividad.tipo);
                const Icon = tipo?.icon || MessageSquare;
                const responsable = usuarios.find(u => u.id === viewingActividad.responsableId);
                const creador = usuarios.find(u => u.id === viewingActividad.creadoPor);
                const tareasDerivadas = tareas.filter(t => t.actividadId === viewingActividad.id);
                const recordatoriosDerivados = recordatorios.filter(r => r.actividadId === viewingActividad.id);

                return (
                  <>
                    {/* Header */}
                    <div className={`${tipo?.color} p-6 rounded-t-2xl`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                            <Icon size={28} className="text-white" />
                          </div>
                          <div>
                            <span className="text-white/80 text-sm">{tipo?.name}</span>
                            <h3 className="text-xl font-bold text-white">{viewingActividad.titulo || 'Sin título'}</h3>
                          </div>
                        </div>
                        <button onClick={() => setViewingActividad(null)} className="p-2 hover:bg-white/20 rounded-lg transition-all">
                          <X size={24} className="text-white" />
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                      {/* Información Principal */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-800/50 rounded-xl p-4">
                          <p className="text-slate-500 text-xs mb-1">Fecha</p>
                          <p className="text-white font-medium">{formatDate(viewingActividad.fecha)}</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-4">
                          <p className="text-slate-500 text-xs mb-1">Responsable</p>
                          <p className="text-white font-medium">{responsable?.nombre || 'No asignado'}</p>
                        </div>
                      </div>

                      {/* Email enviado */}
                      {viewingActividad.tipo === 'email' && viewingActividad.emailDestinatario && (
                        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 space-y-3">
                          <p className="text-cyan-400 text-sm font-medium flex items-center gap-2"><Mail size={16} /> Correo Enviado</p>
                          <div className="space-y-2">
                            <div><p className="text-slate-500 text-xs">Para:</p><p className="text-white">{viewingActividad.emailDestinatario}</p></div>
                            <div><p className="text-slate-500 text-xs">Asunto:</p><p className="text-white font-medium">{viewingActividad.emailAsunto || viewingActividad.titulo?.replace('Email: ', '')}</p></div>
                            <div><p className="text-slate-500 text-xs">Mensaje:</p><p className="text-white whitespace-pre-wrap bg-slate-800/50 p-3 rounded-lg mt-1">{viewingActividad.emailCuerpo || viewingActividad.descripcion}</p></div>
                          </div>
                        </div>
                      )}

                      {/* Descripción */}
                      {viewingActividad.tipo !== 'email' && viewingActividad.descripcion && (
                        <div className="bg-slate-800/50 rounded-xl p-4">
                          <p className="text-slate-500 text-xs mb-2">Descripción / Resumen</p>
                          <p className="text-white whitespace-pre-wrap">{viewingActividad.descripcion}</p>
                        </div>
                      )}

                      {/* Archivo adjunto */}
                      {viewingActividad.archivo && (
                        <div className="bg-slate-800/50 rounded-xl p-4">
                          <p className="text-slate-500 text-xs mb-2">Archivo Adjunto</p>
                          <a href={viewingActividad.archivo.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 px-4 py-3 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 rounded-xl text-violet-300 transition-all">
                            <Download size={20} />
                            <div>
                              <p className="font-medium">{viewingActividad.archivo.nombre}</p>
                              <p className="text-violet-400/60 text-xs">{(viewingActividad.archivo.tamano / 1024).toFixed(1)} KB</p>
                            </div>
                          </a>
                        </div>
                      )}

                      {/* Tareas derivadas */}
                      {tareasDerivadas.length > 0 && (
                        <div className="bg-slate-800/50 rounded-xl p-4">
                          <p className="text-cyan-400 text-sm font-medium mb-3 flex items-center gap-2">
                            <Target size={16} /> Tareas derivadas ({tareasDerivadas.length})
                          </p>
                          <div className="space-y-2">
                            {tareasDerivadas.map(t => {
                              const respTarea = usuarios.find(u => u.id === t.responsableId);
                              return (
                                <div key={t.id} className={`flex items-center justify-between p-3 rounded-lg ${t.completada ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-700/50'}`}>
                                  <div className="flex items-center gap-3">
                                    {t.completada ? <CheckCircle size={16} className="text-emerald-400" /> : <Clock size={16} className="text-slate-400" />}
                                    <div>
                                      <p className={`text-sm ${t.completada ? 'text-emerald-300 line-through' : 'text-white'}`}>{t.descripcion}</p>
                                      <p className="text-slate-500 text-xs">{formatDate(t.fechaCompromiso)} · {respTarea?.nombre || 'Sin asignar'}</p>
                                    </div>
                                  </div>
                                  <span className={`text-xs px-2 py-1 rounded ${t.prioridad === 'alta' ? 'bg-red-500/20 text-red-400' : t.prioridad === 'media' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-600 text-slate-400'}`}>
                                    {t.prioridad}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Recordatorios derivados */}
                      {recordatoriosDerivados.length > 0 && (
                        <div className="bg-slate-800/50 rounded-xl p-4">
                          <p className="text-amber-400 text-sm font-medium mb-3 flex items-center gap-2">
                            <Bell size={16} /> Recordatorios derivados ({recordatoriosDerivados.length})
                          </p>
                          <div className="space-y-2">
                            {recordatoriosDerivados.map(r => {
                              const respRec = usuarios.find(u => u.id === r.responsableId);
                              return (
                                <div key={r.id} className={`flex items-center justify-between p-3 rounded-lg ${r.completado ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-700/50'}`}>
                                  <div className="flex items-center gap-3">
                                    {r.completado ? <CheckCircle size={16} className="text-emerald-400" /> : <Bell size={16} className="text-amber-400" />}
                                    <div>
                                      <p className={`text-sm ${r.completado ? 'text-emerald-300 line-through' : 'text-white'}`}>{r.titulo}</p>
                                      <p className="text-slate-500 text-xs">{formatDate(r.fecha)} · {respRec?.nombre || 'Sin asignar'}</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="border-t border-slate-700 pt-4 flex items-center justify-between text-xs text-slate-500">
                        <span>Creado por: {creador?.nombre || 'Sistema'}</span>
                        <span>Fecha creación: {viewingActividad.fechaCreacion ? new Date(viewingActividad.fechaCreacion).toLocaleString('es-MX') : '-'}</span>
                      </div>

                      {/* Acciones */}
                      <div className="flex gap-3">
                        <button onClick={() => { handleEditActividad(viewingActividad); setViewingActividad(null); }} className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-xl hover:bg-cyan-500/30 transition-all">
                          <Edit size={16} /> Editar
                        </button>
                        <button onClick={() => { handleDeleteActividad(viewingActividad.id); setViewingActividad(null); }} className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-all">
                          <Trash2 size={16} /> Eliminar
                        </button>
                        <button onClick={() => setViewingActividad(null)} className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600 transition-all ml-auto">
                          Cerrar
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Form Recordatorio */}
        {showRecordatorioForm && (
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-amber-500/30">
            <h3 className="text-lg font-semibold text-white mb-4">{editingRecordatorio ? 'Editar Recordatorio' : 'Nuevo Recordatorio'}</h3>
            <form onSubmit={handleAddRecordatorio} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" placeholder="Título *" value={recordatorioForm.titulo} onChange={(e) => setRecordatorioForm({ ...recordatorioForm, titulo: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500" required />
              <input type="date" value={recordatorioForm.fecha} onChange={(e) => setRecordatorioForm({ ...recordatorioForm, fecha: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white" required />
              <select value={recordatorioForm.responsableId} onChange={(e) => setRecordatorioForm({ ...recordatorioForm, responsableId: e.target.value })} className="md:col-span-2 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white">
                <option value="">Asignar a... (yo mismo)</option>
                {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.id === currentUser?.id ? '(yo)' : ''}</option>)}
              </select>
              <textarea placeholder="Descripción" value={recordatorioForm.descripcion} onChange={(e) => setRecordatorioForm({ ...recordatorioForm, descripcion: e.target.value })} className="md:col-span-2 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 resize-none" rows="2"></textarea>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" className="flex items-center gap-2 bg-amber-500 text-white px-5 py-3 rounded-xl hover:bg-amber-600 transition-all"><Save size={18} /> {editingRecordatorio ? 'Guardar Cambios' : 'Guardar'}</button>
                <button type="button" onClick={() => { setShowRecordatorioForm(false); setEditingRecordatorio(null); }} className="flex items-center gap-2 bg-slate-800 text-slate-300 px-5 py-3 rounded-xl hover:bg-slate-700 transition-all"><X size={18} /> Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* Tab: Info */}
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Información del Proyecto</h3>
                {puedeEditarProspecto(prospecto) && (
                  <button onClick={() => handleEdit(prospecto)} className="p-2 hover:bg-slate-700 rounded-lg transition-all text-slate-400 hover:text-cyan-400" title="Editar proyecto">
                    <Edit size={18} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-slate-500 text-sm">Proyecto</p><p className="text-white">{prospecto?.nombre}</p></div>
                <div><p className="text-slate-500 text-sm">Cliente/Empresa</p><p className="text-cyan-400">{prospecto?.empresa}</p></div>
                <div><p className="text-slate-500 text-sm">Contacto</p><p className="text-white">{prospecto?.contacto || '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Email</p><p className="text-white">{prospecto?.email || '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Teléfono</p><p className="text-white">{prospecto?.telefono || '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Página Web</p><p className="text-cyan-400">{prospecto?.paginaWeb ? (<a href={prospecto.paginaWeb.startsWith('http') ? prospecto.paginaWeb : `https://${prospecto.paginaWeb}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{prospecto.paginaWeb}</a>) : '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Etapa</p><p className={`inline-block px-2 py-1 rounded text-sm text-white ${stage?.bg}`}>{stage?.name}</p></div>
                <div><p className="text-slate-500 text-sm">Valor Estimado</p><p className="text-emerald-400 font-semibold">{prospecto?.valorEstimado ? `$${parseFloat(prospecto.valorEstimado).toLocaleString('es-MX')}/año` : '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Servicio</p><p className="text-cyan-400">{prospecto?.servicio || '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Fuente</p><p className="text-white">{prospecto?.fuente || '-'}</p></div>
                {prospecto?.fuente === 'Referido' && prospecto?.referidoPor && (
                  <div className="col-span-2"><p className="text-slate-500 text-sm">Referido por</p><p className="text-white flex items-center gap-2"><User size={16} className="text-violet-400" />{prospecto.referidoPor}{prospecto.esComisionista && <span className="ml-2 px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">Comisionista</span>}</p></div>
                )}
                <div><p className="text-slate-500 text-sm">Responsable</p><p className="text-white">{usuarios.find(u => u.id === prospecto?.asignadoA)?.nombre || usuarios.find(u => u.id === prospecto?.creadoPor)?.nombre || '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Fecha Seguimiento</p><p className="text-white">{prospecto?.fechaSeguimiento ? formatDate(prospecto.fechaSeguimiento) : '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Fecha Creación</p><p className="text-white">{formatDate(prospecto?.fechaCreacion)}</p></div>
              </div>
              {prospecto?.notas && (<div className="mt-4 pt-4 border-t border-slate-800"><p className="text-slate-500 text-sm mb-1">Notas</p><p className="text-slate-300">{prospecto.notas}</p></div>)}
              {prospecto?.notaRapida && (<div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl"><p className="text-slate-500 text-xs mb-1">Nota Rápida</p><p className="text-amber-200">{prospecto.notaRapida}</p></div>)}
            </div>
            <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
              <h3 className="text-lg font-semibold text-white mb-4">Acciones</h3>
              <div className="space-y-3">
                {(prospecto?.telefono || cliente?.telefono) && (<a href={`https://wa.me/52${(prospecto?.telefono || cliente?.telefono).replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400 transition-all"><Phone size={18} /> WhatsApp</a>)}
                {(prospecto?.email || cliente?.email) && (<button onClick={() => { setEmailDestinatario({ nombre: prospecto?.contacto || cliente?.nombre || prospecto?.empresa, email: prospecto?.email || cliente?.email, pipelineId: prospecto?.id }); setEmailModalOpen(true); }} className="w-full flex items-center gap-3 p-3 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400 transition-all"><Mail size={18} /> Enviar Email</button>)}
                {puedeEditarProspecto(prospecto) && (
                  <>
                    <button onClick={() => handleEdit(prospecto)} className="w-full flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition-all"><Edit size={18} /> Editar Proyecto</button>
                    <div className="pt-3 border-t border-slate-800">
                      <p className="text-slate-500 text-sm mb-2">Mover a etapa:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {PIPELINE_STAGES.filter(s => s.id !== prospecto?.etapa).map(s => (
                          <button key={s.id} onClick={() => moverEtapa(prospecto.id, s.id)} className={`text-xs py-2 rounded-lg ${s.bg} bg-opacity-20 hover:bg-opacity-40 text-white transition-all`}>{s.name}</button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Actividades */}
        {activeTab === 'actividades' && (
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Historial de Actividades</h3>
              {puedeEditarProspecto(prospecto) && (
                <button
                  onClick={() => { setEditingActividad(null); setActividadForm({ tipo: 'llamada', titulo: '', descripcion: '', fecha: getFechaLocal(), responsableId: '' }); setTareasNuevas([]); setRecordatoriosNuevos([]); setActividadArchivo(null); setShowActividadForm(true); }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 text-violet-400 rounded-lg text-sm hover:bg-violet-500/30 transition-all"
                >
                  <Plus size={14} /> Nueva Actividad
                </button>
              )}
            </div>
            {actividadesProspecto.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No hay actividades registradas</p>
            ) : (
              <div className="space-y-3">
                {actividadesProspecto.map(a => {
                  const tipo = TIPOS_ACTIVIDAD.find(t => t.id === a.tipo);
                  const Icon = tipo?.icon || MessageSquare;
                  return (
                    <div key={a.id} onClick={() => setViewingActividad(a)} className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-xl group cursor-pointer hover:bg-slate-800/70 transition-all">
                      <div className={`w-10 h-10 rounded-xl ${tipo?.color} bg-opacity-20 flex items-center justify-center flex-shrink-0`}><Icon size={18} className="text-white" /></div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded ${tipo?.color} text-white`}>{tipo?.name}</span>
                            <span className="text-slate-500 text-xs">{formatDate(a.fecha)}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); handleEditActividad(a); }} className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 rounded-lg transition-all"><Edit size={14} /></button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteActividad(a.id); }} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-all"><Trash2 size={14} /></button>
                          </div>
                        </div>
                        <p className="text-white font-medium">{a.titulo}</p>
                        {a.descripcion && <p className="text-slate-400 text-sm mt-1 line-clamp-2">{a.descripcion}</p>}
                        {a.archivo && (
                          <div onClick={(e) => e.stopPropagation()} className="inline-block">
                            <a href={a.archivo.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 rounded-lg text-violet-300 text-sm transition-all">
                              <Download size={14} /> {a.archivo.nombre} <span className="text-violet-400/60 text-xs">({(a.archivo.tamano / 1024).toFixed(1)} KB)</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab: Timeline */}
        {activeTab === 'timeline' && (
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
            <h3 className="text-lg font-semibold text-white mb-4">Timeline del Proyecto</h3>

            {/* Resumen de tiempos por etapa */}
            {(() => {
              const historial = prospecto?.historialEtapas || [];
              if (historial.length > 1) {
                const tiemposPorEtapa = [];
                for (let i = 0; i < historial.length - 1; i++) {
                  const etapaInfo = PIPELINE_STAGES.find(s => s.id === historial[i].etapaNueva);
                  const fechaInicio = new Date(historial[i].fecha);
                  const fechaFin = new Date(historial[i + 1].fecha);
                  const diffMs = fechaFin - fechaInicio;
                  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                  const diffHoras = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                  tiemposPorEtapa.push({
                    etapa: etapaInfo?.name || historial[i].etapaNueva,
                    color: etapaInfo?.bg || 'bg-slate-500',
                    dias: diffDias,
                    horas: diffHoras
                  });
                }
                // Tiempo en etapa actual
                const ultimaEtapa = historial[historial.length - 1];
                const etapaActualInfo = PIPELINE_STAGES.find(s => s.id === ultimaEtapa.etapaNueva);
                const diffActual = new Date() - new Date(ultimaEtapa.fecha);
                const diasActual = Math.floor(diffActual / (1000 * 60 * 60 * 24));
                const horasActual = Math.floor((diffActual % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                tiemposPorEtapa.push({
                  etapa: etapaActualInfo?.name || ultimaEtapa.etapaNueva,
                  color: etapaActualInfo?.bg || 'bg-slate-500',
                  dias: diasActual,
                  horas: horasActual,
                  actual: true
                });
                return (
                  <div className="mb-6 p-4 bg-slate-800/50 rounded-xl">
                    <p className="text-slate-400 text-sm mb-3">Tiempo en cada etapa:</p>
                    <div className="flex flex-wrap gap-3">
                      {tiemposPorEtapa.map((t, i) => (
                        <div key={i} className={`px-3 py-2 rounded-lg ${t.color} bg-opacity-20 border ${t.actual ? 'border-cyan-500/50' : 'border-transparent'}`}>
                          <p className="text-white text-sm font-medium">{t.etapa} {t.actual && <span className="text-cyan-400 text-xs">(actual)</span>}</p>
                          <p className="text-slate-300 text-xs">{t.dias > 0 ? `${t.dias}d ` : ''}{t.horas}h</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {timeline.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No hay eventos en el timeline</p>
            ) : (
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-700"></div>
                <div className="space-y-4">
                  {timeline.map((evento, idx) => {
                    if (evento.tipo === 'etapa') {
                      return (
                        <div key={idx} className="flex items-start gap-4 ml-0 relative">
                          <div className={`w-10 h-10 rounded-full ${evento.colorEtapa || 'bg-violet-500'} flex items-center justify-center z-10 flex-shrink-0`}>
                            <Flag size={18} className="text-white" />
                          </div>
                          <div className="flex-1 bg-gradient-to-r from-violet-500/10 to-transparent rounded-xl p-4 border-l-2 border-violet-500">
                            <p className="text-slate-500 text-xs mb-1">{new Date(evento.fecha).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                            <p className="text-white font-medium">{evento.titulo}</p>
                            {evento.descripcion && <p className="text-slate-400 text-sm mt-1">{evento.descripcion}</p>}
                          </div>
                        </div>
                      );
                    } else {
                      const tipoAct = TIPOS_ACTIVIDAD.find(t => t.id === evento.subtipo);
                      const Icon = tipoAct?.icon || MessageSquare;
                      const color = tipoAct?.color || 'bg-slate-500';
                      return (
                        <div key={idx} className="flex items-start gap-4 ml-0 relative">
                          <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center z-10 flex-shrink-0`}><Icon size={18} className="text-white" /></div>
                          <div className="flex-1 bg-slate-800/50 rounded-xl p-4">
                            <p className="text-slate-500 text-xs mb-1">{formatDate(evento.fecha)}</p>
                            <p className="text-white font-medium">{evento.titulo}</p>
                            {evento.descripcion && <p className="text-slate-400 text-sm mt-1">{evento.descripcion}</p>}
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Tareas */}
        {activeTab === 'tareas' && (
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Tareas y Compromisos</h3>
              <button
                onClick={() => {
                  setTareaFormData({ descripcion: '', fechaCompromiso: getFechaLocal(), prioridad: 'media', responsableId: '' });
                  setEditingTarea(null);
                  setShowTareaForm(true);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30 transition-all"
              >
                <Plus size={14} /> Nueva Tarea
              </button>
            </div>

            {/* Form Tarea */}
            {showTareaForm && (
              <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-cyan-500/30 mb-4">
                <h3 className="text-lg font-semibold text-white mb-4">{editingTarea ? 'Editar Tarea' : 'Nueva Tarea'}</h3>
                <form onSubmit={handleAddTareaForm} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input type="text" placeholder="Descripción de la tarea *" value={tareaFormData.descripcion} onChange={(e) => setTareaFormData({ ...tareaFormData, descripcion: e.target.value })} className="md:col-span-2 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500" required />
                  <input type="date" value={tareaFormData.fechaCompromiso} onChange={(e) => setTareaFormData({ ...tareaFormData, fechaCompromiso: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white" required />
                  <select value={tareaFormData.prioridad} onChange={(e) => setTareaFormData({ ...tareaFormData, prioridad: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white">
                    <option value="baja">Prioridad Baja</option>
                    <option value="media">Prioridad Media</option>
                    <option value="alta">Prioridad Alta</option>
                  </select>
                  <select value={tareaFormData.responsableId} onChange={(e) => setTareaFormData({ ...tareaFormData, responsableId: e.target.value })} className="md:col-span-2 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white">
                    <option value="">Asignar a... (yo mismo)</option>
                    {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.id === currentUser?.id ? '(yo)' : ''}</option>)}
                  </select>
                  <div className="md:col-span-2 flex gap-3">
                    <button type="submit" className="flex items-center gap-2 bg-cyan-500 text-white px-5 py-3 rounded-xl hover:bg-cyan-600 transition-all"><Save size={18} /> {editingTarea ? 'Guardar Cambios' : 'Guardar'}</button>
                    <button type="button" onClick={() => { setShowTareaForm(false); setEditingTarea(null); }} className="flex items-center gap-2 bg-slate-800 text-slate-300 px-5 py-3 rounded-xl hover:bg-slate-700 transition-all"><X size={18} /> Cancelar</button>
                  </div>
                </form>
              </div>
            )}

            {tareasProspecto.length === 0 && !showTareaForm ? (
              <p className="text-slate-500 text-center py-8">No hay tareas para este prospecto</p>
            ) : (
              <div className="space-y-3">
                {tareasProspecto.map(tarea => {
                  const hoy = getFechaLocal();
                  const vencida = !tarea.completada && tarea.fechaCompromiso < hoy;
                  const esHoy = tarea.fechaCompromiso === hoy;
                  const responsable = usuarios.find(u => u.id === tarea.responsableId);
                  return (
                    <div key={tarea.id} className={`flex items-center gap-4 p-4 rounded-xl group ${tarea.completada ? 'bg-slate-800/30' : vencida ? 'bg-red-500/10 border border-red-500/30' : esHoy ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-slate-800/50'}`}>
                      <button
                        onClick={() => setTareas(tareas.map(t => t.id === tarea.id ? { ...t, completada: !t.completada } : t))}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${tarea.completada ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 hover:border-emerald-500'}`}
                      >
                        {tarea.completada && <CheckCircle size={14} className="text-white" />}
                      </button>
                      <div className="flex-1">
                        <p className={`font-medium ${tarea.completada ? 'text-slate-500 line-through' : 'text-white'}`}>{tarea.descripcion}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className={`text-xs flex items-center gap-1 ${vencida ? 'text-red-400' : esHoy ? 'text-amber-400' : 'text-slate-400'}`}>
                            <Clock size={12} /> Compromiso: {esHoy ? 'Hoy' : vencida ? `Vencida (${formatDate(tarea.fechaCompromiso)})` : formatDate(tarea.fechaCompromiso)}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded ${tarea.prioridad === 'alta' ? 'bg-red-500/20 text-red-400' : tarea.prioridad === 'media' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            {tarea.prioridad}
                          </span>
                          {responsable && <span className="text-xs text-violet-400">{responsable.nombre}</span>}
                        </div>
                        {tarea.fechaCreacion && <p className="text-xs text-slate-500 mt-1">Creada: {new Date(tarea.fechaCreacion).toLocaleDateString('es-MX')}</p>}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEditTarea(tarea)} className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 rounded-lg transition-all"><Edit size={14} /></button>
                        <button onClick={() => handleDeleteTarea(tarea.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-all"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab: Recordatorios */}
        {activeTab === 'recordatorios' && (
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Recordatorios</h3>
              {puedeEditarProspecto(prospecto) && (
                <button
                  onClick={() => { setEditingRecordatorio(null); setRecordatorioForm({ titulo: '', fecha: '', descripcion: '', responsableId: '' }); setShowRecordatorioForm(true); }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-sm hover:bg-amber-500/30 transition-all"
                >
                  <Plus size={14} /> Nuevo Recordatorio
                </button>
              )}
            </div>
            {recordatoriosProspecto.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No hay recordatorios</p>
            ) : (
              <div className="space-y-3">
                {recordatoriosProspecto.map(r => {
                  const hoy = getFechaLocal();
                  const vencido = !r.completado && r.fecha < hoy;
                  const esHoy = r.fecha === hoy;
                  return (
                    <div key={r.id} className={`flex items-center gap-4 p-4 rounded-xl group ${r.completado ? 'bg-slate-800/30' : vencido ? 'bg-red-500/10 border border-red-500/30' : esHoy ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-slate-800/50'}`}>
                      <button onClick={() => setRecordatorios(recordatorios.map(rec => rec.id === r.id ? { ...rec, completado: !rec.completado } : rec))} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${r.completado ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 hover:border-emerald-500'}`}>
                        {r.completado && <CheckCircle size={14} className="text-white" />}
                      </button>
                      <div className="flex-1">
                        <p className={`font-medium ${r.completado ? 'text-slate-500 line-through' : 'text-white'}`}>{r.titulo}</p>
                        {r.descripcion && <p className="text-slate-400 text-sm">{r.descripcion}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`text-sm ${vencido ? 'text-red-400' : esHoy ? 'text-amber-400' : 'text-slate-400'}`}>{formatDate(r.fecha)}</p>
                          {vencido && <span className="text-xs text-red-400">Vencido</span>}
                          {esHoy && !r.completado && <span className="text-xs text-amber-400">Hoy</span>}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEditRecordatorio(r)} className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 rounded-lg transition-all"><Edit size={14} /></button>
                          <button onClick={() => handleDeleteRecordatorio(r.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-all"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Pipeline</h1>
          <p className="text-slate-400">{pipeline.length} oportunidades</p>
        </div>
        {puedeCrear && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white px-5 py-3 rounded-xl hover:opacity-90 transition-all font-medium"
          >
            <Plus size={20} /> Nueva Oportunidad
          </button>
        )}
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
          <h2 className="text-xl font-bold text-white mb-6">{editingId ? 'Editar Oportunidad' : 'Nueva Oportunidad'}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" placeholder="Empresa / Cliente *" value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" required />
            <input type="text" placeholder="Nombre del contacto" value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="text" placeholder="Cargo" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="tel" placeholder="Teléfono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="url" placeholder="Página Web" value={form.paginaWeb || ''} onChange={(e) => setForm({ ...form, paginaWeb: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="number" placeholder="Número de empleados" value={form.numeroEmpleados} onChange={(e) => setForm({ ...form, numeroEmpleados: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <select value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-cyan-500/50">
              <option value="">Vincular a cliente existente (opcional)</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.empresa}</option>)}
            </select>
            <select value={form.etapa} onChange={(e) => setForm({ ...form, etapa: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-cyan-500/50">
              {PIPELINE_STAGES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="number" placeholder="Valor estimado (USD/año)" value={form.valorEstimado} onChange={(e) => setForm({ ...form, valorEstimado: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            {/* Selector de servicio con opción de agregar nuevo */}
            <div className="relative">
              {!showNewServicio ? (
                <div className="flex gap-2">
                  <select value={form.servicio} onChange={(e) => setForm({ ...form, servicio: e.target.value })} className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-cyan-500/50">
                    <option value="">Seleccionar servicio</option>
                    {todosLosServicios.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button type="button" onClick={() => setShowNewServicio(true)} className="px-3 py-3 bg-slate-700 hover:bg-slate-600 text-cyan-400 rounded-xl transition-all" title="Agregar nuevo servicio">
                    <Plus size={20} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input type="text" placeholder="Nuevo servicio..." value={newServicioName} onChange={(e) => setNewServicioName(e.target.value)} className="flex-1 px-4 py-3 bg-slate-800 border border-cyan-500/50 rounded-xl text-white placeholder-slate-500" autoFocus />
                  <button type="button" onClick={handleAddServicio} className="px-3 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl transition-all" title="Guardar">
                    <Save size={20} />
                  </button>
                  <button type="button" onClick={() => { setShowNewServicio(false); setNewServicioName(''); }} className="px-3 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-all" title="Cancelar">
                    <X size={20} />
                  </button>
                </div>
              )}
            </div>
            <input type="date" placeholder="Fecha seguimiento" value={form.fechaSeguimiento} onChange={(e) => setForm({ ...form, fechaSeguimiento: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-cyan-500/50" />
            {/* Fuente */}
            <select value={form.fuente || ''} onChange={(e) => setForm({ ...form, fuente: e.target.value, referidoPor: e.target.value !== 'Referido' ? '' : form.referidoPor, esComisionista: e.target.value !== 'Referido' ? false : form.esComisionista })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-cyan-500/50">
              <option value="">Fuente del prospecto</option>
              {FUENTES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            {/* Campos adicionales si es Referido */}
            {form.fuente === 'Referido' && (
              <>
                <input type="text" placeholder="Nombre de quien refirió *" value={form.referidoPor || ''} onChange={(e) => setForm({ ...form, referidoPor: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
                <label className="flex items-center gap-3 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl cursor-pointer hover:border-cyan-500/50 transition-all">
                  <input type="checkbox" checked={form.esComisionista || false} onChange={(e) => setForm({ ...form, esComisionista: e.target.checked })} className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500/50" />
                  <span className="text-white">Es comisionista</span>
                </label>
              </>
            )}
            {esAdmin && (
              <select value={form.asignadoA || ''} onChange={(e) => setForm({ ...form, asignadoA: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-cyan-500/50">
                <option value="">Asignar responsable... (yo mismo)</option>
                {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.id === currentUser?.id ? '(yo)' : ''}</option>)}
              </select>
            )}
            <textarea placeholder="Notas" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="md:col-span-2 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50 resize-none" rows="2"></textarea>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white px-5 py-3 rounded-xl hover:opacity-90 transition-all font-medium">
                <Save size={20} /> Guardar
              </button>
              <button type="button" onClick={resetForm} className="flex items-center gap-2 bg-slate-800 text-slate-300 px-5 py-3 rounded-xl hover:bg-slate-700 transition-all font-medium">
                <X size={20} /> Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Kanban Board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {PIPELINE_STAGES.map(stage => {
            // Filtrar por alcance de visualización
            const pipelinePorAlcance = permisosPipeline.ver === 'propios'
              ? pipeline.filter(p => p.asignadoA === currentUser?.id || p.creadoPor === currentUser?.id)
              : pipeline;
            const items = pipelinePorAlcance.filter(p => p.etapa === stage.id);
            return (
              <div key={stage.id} className="w-72 flex-shrink-0">
                <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-gradient-to-r ${stage.color}`}>
                  <span className="text-white font-semibold text-sm">{stage.name}</span>
                  <span className="ml-auto bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">{items.length}</span>
                </div>
                <div className="space-y-3 min-h-[200px]">
                  {items.map(item => {
                    const actCount = actividades.filter(a => a.pipelineId === item.id).length;
                    return (
                      <div key={item.id} onClick={() => setSelectedProspecto(item.id)} className="bg-slate-900/80 backdrop-blur-sm rounded-xl p-4 border-2 border-slate-400 hover:border-cyan-500/50 transition-all group cursor-pointer">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-white font-medium text-sm">{item.nombre}</h4>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => iniciarEditarNota(item)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-amber-400" title="Nota rápida">
                              <MessageSquare size={14} />
                            </button>
                            <button onClick={() => handleEdit(item)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
                              <Edit size={14} />
                            </button>
                            <button onClick={() => handleDelete(item.id)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <p className="text-slate-400 text-xs mb-2">{item.empresa}</p>
                        {item.valorEstimado && (
                          <p className="text-emerald-400 text-sm font-semibold mb-2">${parseFloat(item.valorEstimado).toLocaleString('es-MX')}/año</p>
                        )}
                        <div className="flex items-center gap-2 mb-2">
                          {item.fechaSeguimiento && (
                            <span className="text-slate-500 text-xs flex items-center gap-1">
                              <Calendar size={12} /> {formatDate(item.fechaSeguimiento)}
                            </span>
                          )}
                          {actCount > 0 && (
                            <span className="text-violet-400 text-xs flex items-center gap-1">
                              <PhoneCall size={12} /> {actCount}
                            </span>
                          )}
                        </div>
                        {/* Nota rápida */}
                        {editingNota === item.id ? (
                          <div className="mb-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                            <textarea value={notaTexto} onChange={(e) => setNotaTexto(e.target.value)} placeholder="Escribe una nota rápida..." className="w-full px-3 py-2 bg-slate-800 border border-amber-500/30 rounded-lg text-white text-xs placeholder-slate-500 resize-none focus:outline-none focus:border-amber-500" rows="2" autoFocus />
                            <div className="flex gap-1">
                              <button onClick={() => guardarNotaRapida(item.id)} className="flex-1 text-xs py-1 bg-amber-500 text-white rounded hover:bg-amber-600 transition-all">Guardar</button>
                              <button onClick={() => setEditingNota(null)} className="flex-1 text-xs py-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-all">Cancelar</button>
                            </div>
                          </div>
                        ) : item.notaRapida && (
                          <div className="mb-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg" onClick={(e) => { e.stopPropagation(); iniciarEditarNota(item); }}>
                            <p className="text-amber-200 text-xs">{item.notaRapida}</p>
                          </div>
                        )}
                        {/* Mover etapa */}
                        <div className="mt-2 pt-2 border-t border-slate-800 flex gap-1" onClick={(e) => e.stopPropagation()}>
                          {PIPELINE_STAGES.filter(s => s.id !== stage.id).slice(0, 3).map(s => (
                            <button key={s.id} onClick={() => moverEtapa(item.id, s.id)} className={`flex-1 text-xs py-1 rounded ${s.bg} bg-opacity-20 hover:bg-opacity-40 text-slate-300 transition-all`} title={`Mover a ${s.name}`}>
                              {s.name.split(' ')[0]}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============== LEADS ==============
function Leads({ leads, setLeads, setPipeline, todasLasIndustrias, addIndustria, todosLosServicios, addServicio, addAuditLog, recordatorios, setRecordatorios, tareas, setTareas, actividades, setActividades, usuarios, currentUser, addNotificacion, setEmailDestinatario, setEmailModalOpen }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [modalTab, setModalTab] = useState('info');
  const [form, setForm] = useState({
    empresa: '', contacto: '', cargo: '', email: '', telefono: '', paginaWeb: '',
    industria: '', servicio: '', fuente: '', notas: '', prioridad: 'media', tags: [], asignadoA: '',
    referidoPor: '', esComisionista: false, numeroEmpleados: ''
  });

  // Estados para crear recordatorios y tareas en el modal
  const [newRecordatorio, setNewRecordatorio] = useState({ titulo: '', fecha: '', descripcion: '' });
  const [newTarea, setNewTarea] = useState({ descripcion: '', fechaCompromiso: '', prioridad: 'media' });

  // Estados para modal de actividad completo (como Pipeline)
  const [showActividadForm, setShowActividadForm] = useState(false);
  const [actividadForm, setActividadForm] = useState({
    tipo: 'llamada', titulo: '', descripcion: '', fecha: getFechaLocal(), responsableId: ''
  });
  const [editingActividad, setEditingActividad] = useState(null);
  const [viewingActividad, setViewingActividad] = useState(null);
  const [actividadArchivo, setActividadArchivo] = useState(null);
  const [subiendoActividad, setSubiendoActividad] = useState(false);

  // Permisos del usuario actual para leads (fallback a permisos básicos, no admin)
  const permisosLeads = currentUser?.permisos?.leads || { ver: 'todos', crear: true, editar: 'propios', eliminar: false };
  const permisosActividades = currentUser?.permisos?.actividades || { ver: 'todos', crear: true, editar: 'propios', eliminar: false };

  const puedeCrear = permisosLeads.crear === true;
  const esAdmin = currentUser?.permisos?.modulos?.equipo === true;

  // Obtener datos del lead seleccionado
  // Actividades: todos pueden ver todas
  const leadActividades = selectedLead ? actividades.filter(a => a.leadId === selectedLead.id) : [];
  // Recordatorios: solo propios (admin ve todos)
  const leadRecordatorios = selectedLead ? recordatorios.filter(r => r.leadId === selectedLead.id).filter(r => esAdmin || r.creadoPor === currentUser?.id || r.responsableId === currentUser?.id) : [];
  // Tareas: solo propias (admin ve todas)
  const leadTareas = selectedLead ? tareas.filter(t => t.leadId === selectedLead.id).filter(t => esAdmin || t.creadoPor === currentUser?.id || t.responsableId === currentUser?.id) : [];
  const usuariosActivos = usuarios.filter(u => u.activo !== false);

  // Función para verificar si puede editar un lead específico
  const puedeEditarLead = (lead) => {
    if (!lead) return false;
    // Admin siempre puede editar
    if (esAdmin) return true;
    // Permitir si tiene permisos de editar todos o legacy true
    if (permisosLeads.editar === 'todos' || permisosLeads.editar === true) return true;
    // Si es 'propios', verificar que el lead sea suyo
    if (permisosLeads.editar === 'propios') {
      return lead.asignadoA === currentUser?.id || lead.creadoPor === currentUser?.id;
    }
    // En cualquier otro caso (false, undefined, etc), no permitir
    return false;
  };

  // Función para verificar si puede eliminar un lead específico
  const puedeEliminarLead = (lead) => {
    if (!lead) return false;
    // Admin siempre puede eliminar
    if (esAdmin) return true;
    // Permitir si tiene permisos de eliminar todos o legacy true
    if (permisosLeads.eliminar === 'todos' || permisosLeads.eliminar === true) return true;
    // Si es 'propios', verificar que el lead sea suyo
    if (permisosLeads.eliminar === 'propios') {
      return lead.asignadoA === currentUser?.id || lead.creadoPor === currentUser?.id;
    }
    // En cualquier otro caso (false, undefined, etc), no permitir
    return false;
  };

  // Funciones para actividades en leads
  const puedeVerActividad = (actividad) => {
    if (permisosActividades.ver === 'todos' || permisosActividades.ver === true) return true;
    if (permisosActividades.ver === 'propios') {
      return actividad.creadoPor === currentUser?.id || actividad.responsableId === currentUser?.id;
    }
    return false;
  };

  const puedeEditarActividad = (actividad) => {
    if (!actividad) return false;
    if (permisosActividades.editar === 'todos' || permisosActividades.editar === true) return true;
    if (permisosActividades.editar === 'propios') {
      return actividad.creadoPor === currentUser?.id || actividad.responsableId === currentUser?.id;
    }
    return false;
  };

  const puedeEliminarActividad = (actividad) => {
    if (!actividad) return false;
    if (permisosActividades.eliminar === 'todos' || permisosActividades.eliminar === true) return true;
    if (permisosActividades.eliminar === 'propios') {
      return actividad.creadoPor === currentUser?.id || actividad.responsableId === currentUser?.id;
    }
    return false;
  };

  // Abrir WhatsApp
  const abrirWhatsApp = (telefono, nombreContacto) => {
    if (!telefono) return;
    const numero = telefono.replace(/\D/g, '');
    const mensaje = encodeURIComponent(`Hola ${nombreContacto || ''}, me comunico de Grupo EÖN...`);
    window.open(`https://wa.me/${numero}?text=${mensaje}`, '_blank');
  };

  // Abrir Email con modal de EmailJS
  const abrirEmail = (lead) => {
    if (!lead.email) return;
    setEmailDestinatario({
      email: lead.email,
      nombre: lead.contacto || lead.empresa,
      empresa: lead.empresa
    });
    setEmailModalOpen(true);
  };

  // Crear recordatorio para el lead
  const crearRecordatorioLead = () => {
    if (!newRecordatorio.titulo || !newRecordatorio.fecha) return;
    const nuevoRec = {
      id: generateId(),
      ...newRecordatorio,
      leadId: selectedLead.id,
      leadNombre: selectedLead.empresa,
      responsableId: currentUser?.id,
      completado: false,
      fechaCreacion: new Date().toISOString()
    };
    setRecordatorios(prev => [...prev, nuevoRec]);
    setNewRecordatorio({ titulo: '', fecha: '', descripcion: '' });
    addAuditLog('crear', 'recordatorios', `Recordatorio creado para lead: ${selectedLead.empresa}`, nuevoRec.id, newRecordatorio.titulo);
    // Notificación
    addNotificacion(
      currentUser?.id,
      `Recordatorio creado: ${newRecordatorio.titulo}`,
      'recordatorio',
      null,
      `Lead: ${selectedLead.empresa}`
    );
  };

  // Crear tarea para el lead
  const crearTareaLead = () => {
    if (!newTarea.descripcion || !newTarea.fechaCompromiso) return;
    const nuevaTarea = {
      id: generateId(),
      ...newTarea,
      leadId: selectedLead.id,
      leadNombre: selectedLead.empresa,
      responsableId: currentUser?.id,
      completada: false,
      fechaCreacion: new Date().toISOString()
    };
    setTareas(prev => [...prev, nuevaTarea]);
    setNewTarea({ descripcion: '', fechaCompromiso: '', prioridad: 'media' });
    addAuditLog('crear', 'tareas', `Tarea creada para lead: ${selectedLead.empresa}`, nuevaTarea.id, newTarea.descripcion);
    // Notificación
    addNotificacion(
      currentUser?.id,
      `Tarea creada: ${newTarea.descripcion}`,
      'tarea',
      null,
      `Lead: ${selectedLead.empresa}`
    );
  };

  // Guardar actividad completa con archivo (como Pipeline)
  const handleSaveActividad = async (e) => {
    e.preventDefault();
    if (!actividadForm.titulo) return;

    setSubiendoActividad(true);
    try {
      let archivoData = null;
      if (actividadArchivo) {
        const timestamp = Date.now();
        const fileName = `actividades/leads/${selectedLead.id}/${timestamp}_${actividadArchivo.name}`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, actividadArchivo);
        const url = await getDownloadURL(storageRef);
        archivoData = { nombre: actividadArchivo.name, tipo: actividadArchivo.type, tamano: actividadArchivo.size, url };
      }

      const responsableId = actividadForm.responsableId || currentUser?.id;
      let actividadId;

      if (editingActividad) {
        // Modo edición
        actividadId = editingActividad.id;
        setActividades(actividades.map(a => a.id === editingActividad.id ? {
          ...a,
          ...actividadForm,
          responsableId,
          archivo: archivoData || a.archivo
        } : a));
        setEditingActividad(null);
        addAuditLog('editar', 'actividades', `Actividad editada para lead: ${selectedLead.empresa}`, actividadId, actividadForm.titulo);
      } else {
        // Nueva actividad
        actividadId = generateId();
        const nuevaActividad = {
          ...actividadForm,
          id: actividadId,
          leadId: selectedLead.id,
          leadNombre: selectedLead.empresa,
          responsableId,
          creadoPor: currentUser?.id,
          fechaCreacion: new Date().toISOString(),
          archivo: archivoData
        };
        setActividades([...actividades, nuevaActividad]);

        // Notificar al responsable si es diferente al usuario actual
        if (responsableId && responsableId !== currentUser?.id && addNotificacion) {
          addNotificacion(responsableId, 'Nueva actividad asignada', `Se te asignó una actividad para el lead ${selectedLead.empresa}`, 'actividad');
        }
        addAuditLog('crear', 'actividades', `Actividad registrada para lead: ${selectedLead.empresa}`, actividadId, actividadForm.titulo);
      }

      setActividadForm({ tipo: 'llamada', titulo: '', descripcion: '', fecha: getFechaLocal(), responsableId: '' });
      setActividadArchivo(null);
      setShowActividadForm(false);
    } catch (error) {
      console.error('Error guardando actividad:', error);
      alert('Error al guardar la actividad');
    }
    setSubiendoActividad(false);
  };

  // Editar actividad existente
  const handleEditActividad = (actividad) => {
    setActividadForm({
      tipo: actividad.tipo,
      titulo: actividad.titulo,
      descripcion: actividad.descripcion || '',
      fecha: actividad.fecha,
      responsableId: actividad.responsableId || ''
    });
    setEditingActividad(actividad);
    setShowActividadForm(true);
  };

  // Eliminar actividad
  const handleDeleteActividad = (id) => {
    if (window.confirm('¿Eliminar esta actividad?')) {
      setActividades(prev => prev.filter(a => a.id !== id));
      addAuditLog('eliminar', 'actividades', `Actividad eliminada del lead: ${selectedLead?.empresa}`, id);
    }
  };

  // Completar recordatorio
  const toggleRecordatorio = (recId) => {
    setRecordatorios(prev => prev.map(r => r.id === recId ? { ...r, completado: !r.completado } : r));
  };

  // Completar tarea
  const toggleTarea = (tareaId) => {
    setTareas(prev => prev.map(t => t.id === tareaId ? { ...t, completada: !t.completada } : t));
  };

  const toggleTag = (tagId) => {
    const currentTags = form.tags || [];
    if (currentTags.includes(tagId)) {
      setForm({ ...form, tags: currentTags.filter(t => t !== tagId) });
    } else {
      setForm({ ...form, tags: [...currentTags, tagId] });
    }
  };
  const PRIORIDADES = [
    { id: 'alta', name: 'Alta', color: 'bg-red-500' },
    { id: 'media', name: 'Media', color: 'bg-amber-500' },
    { id: 'baja', name: 'Baja', color: 'bg-slate-500' }
  ];

  const [showNewIndustria, setShowNewIndustria] = useState(false);
  const [newIndustriaName, setNewIndustriaName] = useState('');
  const [showNewServicio, setShowNewServicio] = useState(false);
  const [newServicioName, setNewServicioName] = useState('');

  // Manejar agregar nueva industria
  const handleAddIndustria = () => {
    if (addIndustria(newIndustriaName)) {
      setForm({ ...form, industria: newIndustriaName.trim() });
      setNewIndustriaName('');
      setShowNewIndustria(false);
    }
  };

  // Manejar agregar nuevo servicio
  const handleAddServicio = () => {
    if (addServicio(newServicioName)) {
      setForm({ ...form, servicio: newServicioName.trim() });
      setNewServicioName('');
      setShowNewServicio(false);
    }
  };

  const resetForm = () => {
    setForm({ empresa: '', contacto: '', cargo: '', email: '', telefono: '', paginaWeb: '', industria: '', servicio: '', fuente: '', notas: '', prioridad: 'media', tags: [], asignadoA: '', referidoPor: '', esComisionista: false, numeroEmpleados: '' });
    setShowForm(false);
    setEditingId(null);
    setShowNewIndustria(false);
    setNewIndustriaName('');
    setShowNewServicio(false);
    setNewServicioName('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingId) {
      setLeads(leads.map(l => l.id === editingId ? { ...l, ...form, asignadoA: form.asignadoA || l.asignadoA || currentUser?.id } : l));
      addAuditLog('editar', 'leads', `Lead editado: ${form.empresa}`, editingId, form.empresa);
    } else {
      const nuevoLead = { ...form, id: generateId(), fechaCreacion: getFechaLocal(), creadoPor: currentUser?.id, asignadoA: form.asignadoA || currentUser?.id };
      setLeads([...leads, nuevoLead]);
      addAuditLog('crear', 'leads', `Nuevo lead: ${form.empresa}`, nuevoLead.id, form.empresa);
    }
    resetForm();
  };

  const handleEdit = (lead) => {
    setForm({ ...lead, asignadoA: lead.asignadoA || '', paginaWeb: lead.paginaWeb || '', referidoPor: lead.referidoPor || '', esComisionista: lead.esComisionista || false, numeroEmpleados: lead.numeroEmpleados || '' });
    setEditingId(lead.id);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('¿Eliminar este lead?')) {
      setLeads(leads.filter(l => l.id !== id));
    }
  };

  const convertirAPipeline = (lead) => {
    const nuevoProyectoId = generateId();
    const nuevoProyecto = {
      id: nuevoProyectoId,
      nombre: `Proyecto ${lead.empresa}`,
      clienteId: '',
      empresa: lead.empresa,
      contacto: lead.contacto || '',
      email: lead.email || '',
      telefono: lead.telefono || '',
      paginaWeb: lead.paginaWeb || '',
      etapa: 'prospecto',
      valorEstimado: '',
      notas: lead.notas || '',
      servicio: lead.servicio || '',
      fechaCreacion: getFechaLocal(),
      creadoPor: lead.creadoPor || currentUser?.id,
      asignadoA: lead.asignadoA || currentUser?.id,
      fuente: lead.fuente || '',
      referidoPor: lead.referidoPor || '',
      esComisionista: lead.esComisionista || false,
      numeroEmpleados: lead.numeroEmpleados || '',
      leadOrigenId: lead.id // Referencia al lead original
    };
    setPipeline(prev => [...prev, nuevoProyecto]);

    // Transferir actividades del lead al pipeline
    const actividadesLead = actividades.filter(a => a.leadId === lead.id);
    if (actividadesLead.length > 0) {
      setActividades(prev => prev.map(a =>
        a.leadId === lead.id
          ? { ...a, pipelineId: nuevoProyectoId, leadId: null, empresaNombre: lead.empresa }
          : a
      ));
    }

    // Transferir tareas del lead al pipeline
    const tareasLead = tareas.filter(t => t.leadId === lead.id);
    if (tareasLead.length > 0) {
      setTareas(prev => prev.map(t =>
        t.leadId === lead.id
          ? { ...t, pipelineId: nuevoProyectoId, leadId: null, empresaNombre: lead.empresa }
          : t
      ));
    }

    // Transferir recordatorios del lead al pipeline
    const recordatoriosLead = recordatorios.filter(r => r.leadId === lead.id);
    if (recordatoriosLead.length > 0) {
      setRecordatorios(prev => prev.map(r =>
        r.leadId === lead.id
          ? { ...r, pipelineId: nuevoProyectoId, leadId: null, empresaNombre: lead.empresa }
          : r
      ));
    }

    // Eliminar el lead
    setLeads(leads.filter(l => l.id !== lead.id));

    addAuditLog('convertir', 'leads', `Lead convertido a Pipeline: ${lead.empresa} (${actividadesLead.length} actividades, ${tareasLead.length} tareas, ${recordatoriosLead.length} recordatorios transferidos)`, nuevoProyectoId, lead.empresa);

    // Notificación
    addNotificacion(
      currentUser?.id,
      `Lead convertido a Pipeline: ${lead.empresa}`,
      'pipeline',
      null,
      lead.empresa
    );
  };

  // Filtrar por alcance de visualización
  const leadsPorAlcance = permisosLeads.ver === 'propios'
    ? leads.filter(l => l.asignadoA === currentUser?.id || l.creadoPor === currentUser?.id)
    : leads;

  const filteredLeads = leadsPorAlcance.filter(l =>
    l.empresa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.contacto?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Leads</h1>
          <p className="text-slate-400">{leads.length} prospectos</p>
        </div>
        {puedeCrear && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white px-5 py-3 rounded-xl hover:opacity-90 transition-all font-medium"
          >
            <Plus size={20} /> Nuevo Lead
          </button>
        )}
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" size={20} />
        <input
          type="text"
          placeholder="Buscar leads..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border-2 border-slate-400 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
        />
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
          <h2 className="text-xl font-bold text-white mb-6">{editingId ? 'Editar Lead' : 'Nuevo Lead'}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" placeholder="Empresa *" value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" required />
            <input type="text" placeholder="Contacto" value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="text" placeholder="Cargo" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="tel" placeholder="Teléfono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="url" placeholder="Página Web" value={form.paginaWeb || ''} onChange={(e) => setForm({ ...form, paginaWeb: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="number" placeholder="Número de empleados" value={form.numeroEmpleados || ''} onChange={(e) => setForm({ ...form, numeroEmpleados: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            {/* Selector de industria con opción de agregar nueva */}
            <div className="relative">
              {!showNewIndustria ? (
                <div className="flex gap-2">
                  <select value={form.industria} onChange={(e) => setForm({ ...form, industria: e.target.value })} className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-cyan-500/50">
                    <option value="">Seleccionar industria</option>
                    {todasLasIndustrias.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                  <button type="button" onClick={() => setShowNewIndustria(true)} className="px-3 py-3 bg-slate-700 hover:bg-slate-600 text-cyan-400 rounded-xl transition-all" title="Agregar nueva industria">
                    <Plus size={20} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input type="text" placeholder="Nueva industria..." value={newIndustriaName} onChange={(e) => setNewIndustriaName(e.target.value)} className="flex-1 px-4 py-3 bg-slate-800 border border-cyan-500/50 rounded-xl text-white placeholder-slate-500" autoFocus />
                  <button type="button" onClick={handleAddIndustria} className="px-3 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl transition-all" title="Guardar">
                    <Save size={20} />
                  </button>
                  <button type="button" onClick={() => { setShowNewIndustria(false); setNewIndustriaName(''); }} className="px-3 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-all" title="Cancelar">
                    <X size={20} />
                  </button>
                </div>
              )}
            </div>
            {/* Selector de servicio con opción de agregar nuevo */}
            <div className="relative">
              {!showNewServicio ? (
                <div className="flex gap-2">
                  <select value={form.servicio} onChange={(e) => setForm({ ...form, servicio: e.target.value })} className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-cyan-500/50">
                    <option value="">Seleccionar servicio</option>
                    {todosLosServicios.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button type="button" onClick={() => setShowNewServicio(true)} className="px-3 py-3 bg-slate-700 hover:bg-slate-600 text-cyan-400 rounded-xl transition-all" title="Agregar nuevo servicio">
                    <Plus size={20} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input type="text" placeholder="Nuevo servicio..." value={newServicioName} onChange={(e) => setNewServicioName(e.target.value)} className="flex-1 px-4 py-3 bg-slate-800 border border-cyan-500/50 rounded-xl text-white placeholder-slate-500" autoFocus />
                  <button type="button" onClick={handleAddServicio} className="px-3 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl transition-all" title="Guardar">
                    <Save size={20} />
                  </button>
                  <button type="button" onClick={() => { setShowNewServicio(false); setNewServicioName(''); }} className="px-3 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-all" title="Cancelar">
                    <X size={20} />
                  </button>
                </div>
              )}
            </div>
            <select value={form.fuente || ''} onChange={(e) => setForm({ ...form, fuente: e.target.value, referidoPor: e.target.value !== 'Referido' ? '' : form.referidoPor, esComisionista: e.target.value !== 'Referido' ? false : form.esComisionista })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-cyan-500/50">
              <option value="">Fuente del lead</option>
              {FUENTES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            {/* Campos adicionales si es Referido */}
            {form.fuente === 'Referido' && (
              <>
                <input type="text" placeholder="Nombre de quien refirió *" value={form.referidoPor || ''} onChange={(e) => setForm({ ...form, referidoPor: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
                <label className="flex items-center gap-3 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl cursor-pointer hover:border-cyan-500/50 transition-all">
                  <input type="checkbox" checked={form.esComisionista || false} onChange={(e) => setForm({ ...form, esComisionista: e.target.checked })} className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500/50" />
                  <span className="text-white">Es comisionista</span>
                </label>
              </>
            )}
            <select value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-cyan-500/50">
              {PRIORIDADES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {/* Selector de responsable (solo admin) */}
            {esAdmin && (
              <select value={form.asignadoA || ''} onChange={(e) => setForm({ ...form, asignadoA: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-cyan-500/50">
                <option value="">Asignar responsable... (yo mismo)</option>
                {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.id === currentUser?.id ? '(yo)' : ''}</option>)}
              </select>
            )}
            {/* Tags */}
            <div className="md:col-span-2">
              <p className="text-slate-400 text-sm mb-2">Etiquetas</p>
              <div className="flex flex-wrap gap-2">
                {TAGS_DISPONIBLES.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${(form.tags || []).includes(tag.id) ? `${tag.color} text-white` : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    <Tag size={14} className="inline mr-1" />{tag.name}
                  </button>
                ))}
              </div>
            </div>
            <textarea placeholder="Notas" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="md:col-span-2 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50 resize-none" rows="2"></textarea>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white px-5 py-3 rounded-xl hover:opacity-90 transition-all font-medium">
                <Save size={20} /> Guardar
              </button>
              <button type="button" onClick={resetForm} className="flex items-center gap-2 bg-slate-800 text-slate-300 px-5 py-3 rounded-xl hover:bg-slate-700 transition-all font-medium">
                <X size={20} /> Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de leads */}
      <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border-2 border-slate-400 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left px-6 py-4 text-slate-400 font-medium text-sm">Empresa</th>
              <th className="text-left px-6 py-4 text-slate-400 font-medium text-sm">Contacto</th>
              <th className="text-left px-6 py-4 text-slate-400 font-medium text-sm">Teléfono</th>
              <th className="text-left px-6 py-4 text-slate-400 font-medium text-sm">Industria</th>
              <th className="text-left px-6 py-4 text-slate-400 font-medium text-sm">Servicio</th>
              <th className="text-left px-6 py-4 text-slate-400 font-medium text-sm">Fuente</th>
              <th className="text-left px-6 py-4 text-slate-400 font-medium text-sm">Referido por</th>
              <th className="text-left px-6 py-4 text-slate-400 font-medium text-sm">Responsable</th>
              <th className="text-left px-6 py-4 text-slate-400 font-medium text-sm">Prioridad</th>
              <th className="text-left px-6 py-4 text-slate-400 font-medium text-sm">Etiquetas</th>
              <th className="text-right px-6 py-4 text-slate-400 font-medium text-sm">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.map(lead => {
              const prioridad = PRIORIDADES.find(p => p.id === lead.prioridad);
              return (
                <tr key={lead.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-all cursor-pointer" onClick={() => setSelectedLead(lead)}>
                  <td className="px-6 py-4">
                    <p className="text-white font-medium">{lead.empresa}</p>
                    <p className="text-slate-500 text-sm">{lead.email}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-300">{lead.contacto || '-'}</td>
                  <td className="px-6 py-4 text-slate-300 text-sm">{lead.telefono || '-'}</td>
                  <td className="px-6 py-4 text-slate-400 text-sm">{lead.industria || '-'}</td>
                  <td className="px-6 py-4 text-cyan-400 text-sm">{lead.servicio || '-'}</td>
                  <td className="px-6 py-4 text-slate-400 text-sm">{lead.fuente || '-'}</td>
                  <td className="px-6 py-4">
                    {lead.referidoPor ? (
                      <span className="inline-flex items-center gap-1 text-sm text-violet-400">
                        {lead.referidoPor}
                        {lead.esComisionista && <span className="ml-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded">$</span>}
                      </span>
                    ) : <span className="text-slate-500 text-sm">-</span>}
                  </td>
                  <td className="px-6 py-4 text-cyan-400 text-sm">
                    {usuarios.find(u => u.id === lead.asignadoA)?.nombre || usuarios.find(u => u.id === lead.creadoPor)?.nombre || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${prioridad?.color} bg-opacity-20 text-white`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${prioridad?.color}`}></span>
                      {prioridad?.name}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(lead.tags || []).length > 0 ? (
                        (lead.tags || []).map(tagId => {
                          const tag = TAGS_DISPONIBLES.find(t => t.id === tagId);
                          return tag ? (
                            <span key={tagId} className={`px-2 py-0.5 rounded text-xs text-white ${tag.color}`}>
                              {tag.name}
                            </span>
                          ) : null;
                        })
                      ) : (
                        <span className="text-slate-500 text-xs">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      {puedeEliminarLead(lead) && (
                        <button onClick={() => handleDelete(lead.id)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-all" title="Borrar">
                          <Trash2 size={16} />
                        </button>
                      )}
                      {puedeEditarLead(lead) && (
                        <button onClick={() => handleEdit(lead)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all" title="Editar">
                          <Edit size={16} />
                        </button>
                      )}
                      {puedeEditarLead(lead) && (
                        <button
                          onClick={() => convertirAPipeline(lead)}
                          className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg text-emerald-400 transition-all"
                          title="Convertir a Pipeline"
                        >
                          <ArrowUpRight size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredLeads.length === 0 && (
          <div className="text-center py-12">
            <UserPlus className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500">No hay leads registrados</p>
          </div>
        )}
      </div>

      {/* Modal de detalle del Lead */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedLead(null)}>
          <div className="bg-slate-900 rounded-2xl border-2 border-slate-400 w-full max-w-4xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header del modal */}
            <div className="p-6 border-b border-slate-700 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">{selectedLead.empresa}</h2>
                <p className="text-slate-400">{selectedLead.contacto} {selectedLead.cargo && `- ${selectedLead.cargo}`}</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Botones de contacto rápido */}
                {selectedLead.telefono && (
                  <button
                    onClick={() => abrirWhatsApp(selectedLead.telefono, selectedLead.contacto)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 rounded-xl transition-all"
                  >
                    <MessageSquare size={18} /> WhatsApp
                  </button>
                )}
                {selectedLead.email && (
                  <button
                    onClick={() => abrirEmail(selectedLead)}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 rounded-xl transition-all"
                  >
                    <Mail size={18} /> Email
                  </button>
                )}
                <button onClick={() => setSelectedLead(null)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all">
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-700 px-6">
              {[
                { id: 'info', name: 'Información', icon: User },
                { id: 'actividades', name: 'Actividades', icon: PhoneCall },
                { id: 'tareas', name: 'Tareas', icon: CheckCircle },
                { id: 'recordatorios', name: 'Recordatorios', icon: Bell }
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setModalTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${modalTab === tab.id ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                  >
                    <Icon size={16} /> {tab.name}
                    {tab.id === 'tareas' && leadTareas.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-violet-500/20 text-violet-400 text-xs rounded-full">{leadTareas.filter(t => !t.completada).length}</span>
                    )}
                    {tab.id === 'recordatorios' && leadRecordatorios.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">{leadRecordatorios.filter(r => !r.completado).length}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Contenido del modal */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {/* Tab: Información */}
              {modalTab === 'info' && (
                <div className="space-y-6">
                  {/* Datos del lead */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-slate-500 text-sm mb-1">Teléfono</p>
                      <p className="text-white flex items-center gap-2">
                        <Phone size={16} className="text-slate-400" />
                        {selectedLead.telefono || '-'}
                      </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-slate-500 text-sm mb-1">Email</p>
                      <p className="text-white flex items-center gap-2">
                        <Mail size={16} className="text-slate-400" />
                        {selectedLead.email || '-'}
                      </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-slate-500 text-sm mb-1">Página Web</p>
                      <p className="text-cyan-400">
                        {selectedLead.paginaWeb ? (
                          <a href={selectedLead.paginaWeb.startsWith('http') ? selectedLead.paginaWeb : `https://${selectedLead.paginaWeb}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {selectedLead.paginaWeb}
                          </a>
                        ) : '-'}
                      </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-slate-500 text-sm mb-1">Industria</p>
                      <p className="text-white">{selectedLead.industria || '-'}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-slate-500 text-sm mb-1">Servicio de Interés</p>
                      <p className="text-cyan-400">{selectedLead.servicio || '-'}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-slate-500 text-sm mb-1">Fuente</p>
                      <p className="text-white">{selectedLead.fuente || '-'}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-slate-500 text-sm mb-1">Prioridad</p>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm ${PRIORIDADES.find(p => p.id === selectedLead.prioridad)?.color} bg-opacity-20 text-white`}>
                        {PRIORIDADES.find(p => p.id === selectedLead.prioridad)?.name}
                      </span>
                    </div>
                    {/* Referido */}
                    {selectedLead.fuente === 'Referido' && selectedLead.referidoPor && (
                      <div className="bg-slate-800/50 rounded-xl p-4">
                        <p className="text-slate-500 text-sm mb-1">Referido por</p>
                        <p className="text-white flex items-center gap-2">
                          <User size={16} className="text-violet-400" />
                          {selectedLead.referidoPor}
                          {selectedLead.esComisionista && (
                            <span className="ml-2 px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">Comisionista</span>
                          )}
                        </p>
                      </div>
                    )}
                    {/* Responsable asignado */}
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-slate-500 text-sm mb-1">Responsable</p>
                      <p className="text-white">{usuarios.find(u => u.id === selectedLead.asignadoA)?.nombre || usuarios.find(u => u.id === selectedLead.creadoPor)?.nombre || '-'}</p>
                    </div>
                    {/* Fecha de creación */}
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-slate-500 text-sm mb-1">Fecha de registro</p>
                      <p className="text-white">{formatDate(selectedLead.fechaCreacion) || '-'}</p>
                    </div>
                  </div>

                  {/* Etiquetas */}
                  {(selectedLead.tags || []).length > 0 && (
                    <div>
                      <p className="text-slate-500 text-sm mb-2">Etiquetas</p>
                      <div className="flex flex-wrap gap-2">
                        {(selectedLead.tags || []).map(tagId => {
                          const tag = TAGS_DISPONIBLES.find(t => t.id === tagId);
                          return tag ? (
                            <span key={tagId} className={`px-3 py-1 rounded-lg text-sm text-white ${tag.color}`}>
                              {tag.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}

                  {/* Notas */}
                  {selectedLead.notas && (
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-slate-500 text-sm mb-2">Notas</p>
                      <p className="text-white whitespace-pre-wrap">{selectedLead.notas}</p>
                    </div>
                  )}

                  {/* Botón convertir a pipeline */}
                  <div className="pt-4 border-t border-slate-700">
                    <button
                      onClick={() => { convertirAPipeline(selectedLead); setSelectedLead(null); }}
                      className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-6 py-3 rounded-xl hover:opacity-90 transition-all font-medium"
                    >
                      <ArrowUpRight size={20} /> Convertir a Pipeline
                    </button>
                  </div>
                </div>
              )}

              {/* Tab: Actividades */}
              {modalTab === 'actividades' && (
                <div className="space-y-4">
                  {/* Botón para abrir modal de nueva actividad */}
                  {puedeEditarLead(selectedLead) && (
                    <button
                      onClick={() => { setEditingActividad(null); setActividadForm({ tipo: 'llamada', titulo: '', descripcion: '', fecha: getFechaLocal(), responsableId: '' }); setActividadArchivo(null); setShowActividadForm(true); }}
                      className="w-full flex items-center justify-center gap-2 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-400 px-4 py-3 rounded-xl transition-all"
                    >
                      <Plus size={20} /> Nueva Actividad
                    </button>
                  )}

                  {/* Lista de actividades */}
                  {leadActividades.length === 0 ? (
                    <div className="text-center py-8">
                      <PhoneCall className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                      <p className="text-slate-500">No hay actividades registradas</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {leadActividades.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map(act => {
                        const tipoAct = TIPOS_ACTIVIDAD.find(t => t.id === act.tipo);
                        const Icon = tipoAct?.icon || PhoneCall;
                        const responsable = usuarios.find(u => u.id === act.responsableId);
                        return (
                          <div key={act.id} className="bg-slate-800/50 rounded-xl p-4 group">
                            <div className="flex items-start gap-3">
                              <div className={`w-10 h-10 rounded-lg ${tipoAct?.color || 'bg-slate-600'} flex items-center justify-center flex-shrink-0`}>
                                <Icon size={18} className="text-white" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <p className="text-white font-medium">{act.titulo}</p>
                                    {act.descripcion && <p className="text-slate-400 text-sm mt-1">{act.descripcion}</p>}
                                  </div>
                                  {puedeEditarLead(selectedLead) && (
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => handleEditActividad(act)} className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 rounded-lg"><Edit size={14} /></button>
                                      <button onClick={() => handleDeleteActividad(act.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg"><Trash2 size={14} /></button>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                  <span>{formatDate(act.fecha)}</span>
                                  {responsable && <span>• {responsable.nombre}</span>}
                                </div>
                                {act.archivo && (
                                  <a href={act.archivo.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-cyan-400 text-xs transition-all">
                                    <Paperclip size={12} /> {act.archivo.nombre}
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Tareas */}
              {modalTab === 'tareas' && (
                <div className="space-y-4">
                  {/* Formulario para crear tarea - solo si puede editar el lead */}
                  {puedeEditarLead(selectedLead) && (
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-white font-medium mb-3">Nueva Tarea</p>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <input
                          type="text"
                          placeholder="Descripción *"
                          value={newTarea.descripcion}
                          onChange={(e) => setNewTarea({ ...newTarea, descripcion: e.target.value })}
                          className="md:col-span-2 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500"
                        />
                        <input
                          type="date"
                          value={newTarea.fechaCompromiso}
                          onChange={(e) => setNewTarea({ ...newTarea, fechaCompromiso: e.target.value })}
                          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                        />
                        <button
                          onClick={crearTareaLead}
                          disabled={!newTarea.descripcion || !newTarea.fechaCompromiso}
                          className="px-4 py-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all text-sm"
                        >
                          Crear Tarea
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Lista de tareas */}
                  {leadTareas.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                      <p className="text-slate-500">No hay tareas para este lead</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {leadTareas.sort((a, b) => new Date(a.fechaCompromiso) - new Date(b.fechaCompromiso)).map(tarea => (
                        <div key={tarea.id} className={`bg-slate-800/50 rounded-xl p-4 flex items-center gap-3 ${tarea.completada ? 'opacity-60' : ''}`}>
                          <button
                            onClick={() => toggleTarea(tarea.id)}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${tarea.completada ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 hover:border-emerald-500'}`}
                          >
                            {tarea.completada && <CheckCircle size={14} className="text-white" />}
                          </button>
                          <div className="flex-1">
                            <p className={`text-white ${tarea.completada ? 'line-through' : ''}`}>{tarea.descripcion}</p>
                            <p className="text-slate-500 text-xs mt-1">Fecha límite: {formatDate(tarea.fechaCompromiso)}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs ${tarea.prioridad === 'alta' ? 'bg-red-500/20 text-red-400' : tarea.prioridad === 'media' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-600/50 text-slate-400'}`}>
                            {tarea.prioridad}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Recordatorios */}
              {modalTab === 'recordatorios' && (
                <div className="space-y-4">
                  {/* Formulario para crear recordatorio - solo si puede editar el lead */}
                  {puedeEditarLead(selectedLead) && (
                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-white font-medium mb-3">Nuevo Recordatorio</p>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <input
                          type="text"
                          placeholder="Título *"
                          value={newRecordatorio.titulo}
                          onChange={(e) => setNewRecordatorio({ ...newRecordatorio, titulo: e.target.value })}
                          className="md:col-span-2 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500"
                        />
                        <input
                          type="date"
                          value={newRecordatorio.fecha}
                          onChange={(e) => setNewRecordatorio({ ...newRecordatorio, fecha: e.target.value })}
                          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                        />
                        <button
                          onClick={crearRecordatorioLead}
                          disabled={!newRecordatorio.titulo || !newRecordatorio.fecha}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all text-sm"
                        >
                          Crear
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Lista de recordatorios */}
                  {leadRecordatorios.length === 0 ? (
                    <div className="text-center py-8">
                      <Bell className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                      <p className="text-slate-500">No hay recordatorios para este lead</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {leadRecordatorios.sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).map(rec => (
                        <div key={rec.id} className={`bg-slate-800/50 rounded-xl p-4 flex items-center gap-3 ${rec.completado ? 'opacity-60' : ''}`}>
                          <button
                            onClick={() => toggleRecordatorio(rec.id)}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${rec.completado ? 'bg-emerald-500 border-emerald-500' : 'border-amber-500 hover:bg-amber-500/20'}`}
                          >
                            {rec.completado && <CheckCircle size={14} className="text-white" />}
                          </button>
                          <div className="flex-1">
                            <p className={`text-white ${rec.completado ? 'line-through' : ''}`}>{rec.titulo}</p>
                            {rec.descripcion && <p className="text-slate-400 text-sm mt-1">{rec.descripcion}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-amber-400 text-sm">{formatDate(rec.fecha)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Nueva/Editar Actividad para Leads */}
      {showActividadForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowActividadForm(false)}>
          <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{editingActividad ? 'Editar Actividad' : 'Nueva Actividad'}</h3>
              <button onClick={() => setShowActividadForm(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveActividad} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <select value={actividadForm.tipo} onChange={(e) => setActividadForm({ ...actividadForm, tipo: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white">
                  {TIPOS_ACTIVIDAD.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input type="date" value={actividadForm.fecha} onChange={(e) => setActividadForm({ ...actividadForm, fecha: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white" />
              </div>
              <input type="text" placeholder="Título *" value={actividadForm.titulo} onChange={(e) => setActividadForm({ ...actividadForm, titulo: e.target.value })} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500" required />
              <textarea placeholder="Descripción" value={actividadForm.descripcion} onChange={(e) => setActividadForm({ ...actividadForm, descripcion: e.target.value })} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 resize-none" rows="3"></textarea>
              <select value={actividadForm.responsableId} onChange={(e) => setActividadForm({ ...actividadForm, responsableId: e.target.value })} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white">
                <option value="">Responsable (yo mismo)</option>
                {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.id === currentUser?.id ? '(yo)' : ''}</option>)}
              </select>
              {/* Archivo adjunto */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Archivo adjunto</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 cursor-pointer transition-all">
                    <Paperclip size={18} />
                    <span>{actividadArchivo ? actividadArchivo.name : 'Seleccionar archivo'}</span>
                    <input type="file" className="hidden" onChange={(e) => setActividadArchivo(e.target.files[0])} />
                  </label>
                  {actividadArchivo && (
                    <button type="button" onClick={() => setActividadArchivo(null)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"><X size={18} /></button>
                  )}
                </div>
                {editingActividad?.archivo && !actividadArchivo && (
                  <p className="text-xs text-slate-500 mt-2">Archivo actual: {editingActividad.archivo.nombre}</p>
                )}
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button type="submit" disabled={subiendoActividad} className="flex items-center gap-2 bg-violet-500 text-white px-5 py-3 rounded-xl hover:bg-violet-600 disabled:opacity-50">
                  {subiendoActividad ? <Loader size={18} className="animate-spin" /> : <Save size={18} />} {subiendoActividad ? 'Guardando...' : 'Guardar'}
                </button>
                <button type="button" onClick={() => setShowActividadForm(false)} className="flex items-center gap-2 bg-slate-800 text-slate-300 px-5 py-3 rounded-xl hover:bg-slate-700"><X size={18} /> Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== CALENDARIO ==============
function Calendario({ actividades, recordatorios, tareas, clientes, pipeline, leads, setCurrentModule, currentUser, usuarios }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Admin puede ver todo el equipo
  const esAdmin = currentUser?.permisos?.modulos?.equipo === true;

  // Helper para obtener nombre del usuario
  const getNombreUsuario = (userId) => {
    if (!userId) return 'Sin asignar';
    const usuario = usuarios.find(u => u.id === userId);
    return usuario?.nombre || 'Usuario desconocido';
  };

  // Si es admin, mostramos todos los eventos; si no, solo los propios
  const tareasFiltradas = esAdmin
    ? tareas
    : tareas.filter(t => t.responsableId === currentUser?.id || t.creadoPor === currentUser?.id);

  const recordatoriosFiltrados = esAdmin
    ? recordatorios
    : recordatorios.filter(r => r.creadoPor === currentUser?.id || r.usuarioId === currentUser?.id || r.responsableId === currentUser?.id);

  const actividadesFiltradas = esAdmin
    ? actividades
    : actividades.filter(a => a.creadoPor === currentUser?.id || a.responsableId === currentUser?.id);

  // Helper functions
  const getMonthName = (date) => {
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return months[date.getMonth()];
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    return { daysInMonth, startingDay };
  };

  const formatDateKey = (year, month, day) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    // Si ya está en formato YYYY-MM-DD, retornarlo directamente (evita problemas de zona horaria)
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    // Si es un ISO string con tiempo, extraer solo la fecha
    if (typeof dateStr === 'string' && dateStr.includes('T')) {
      return dateStr.split('T')[0];
    }
    // Fallback: intentar parsear
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
  };

  // Get events for a specific date (solo recordatorios y tareas, NO actividades)
  const getEventsForDate = (dateKey) => {
    const events = [];

    // Add recordatorios (filtrados por alcance)
    recordatoriosFiltrados.forEach(rec => {
      const recDate = parseDate(rec.fecha);
      if (recDate === dateKey) {
        let nombreEntidad = 'Desconocido';
        let tipoEntidad = '';
        let entidadId = null;

        if (rec.clienteId) {
          const cliente = clientes.find(c => c.id === rec.clienteId);
          nombreEntidad = cliente?.empresa || cliente?.nombre || 'Cliente';
          tipoEntidad = 'cliente';
          entidadId = rec.clienteId;
        } else if (rec.pipelineId) {
          const prospecto = pipeline.find(p => p.id === rec.pipelineId);
          nombreEntidad = prospecto?.empresa || 'Prospecto';
          tipoEntidad = 'prospecto';
          entidadId = rec.pipelineId;
        } else if (rec.leadId) {
          const lead = leads.find(l => l.id === rec.leadId);
          nombreEntidad = lead?.empresa || rec.leadNombre || 'Lead';
          tipoEntidad = 'lead';
          entidadId = rec.leadId;
        }

        events.push({
          id: rec.id,
          tipo: 'recordatorio',
          titulo: rec.titulo,
          descripcion: rec.descripcion,
          nombreEntidad,
          tipoEntidad,
          entidadId,
          fecha: rec.fecha,
          completado: rec.completado,
          color: rec.completado ? 'bg-emerald-500' : rec.leadId ? 'bg-violet-500' : 'bg-amber-500',
          icon: Bell,
          responsableId: rec.responsableId || rec.usuarioId,
          responsableNombre: getNombreUsuario(rec.responsableId || rec.usuarioId),
          creadoPor: rec.creadoPor,
          creadoPorNombre: getNombreUsuario(rec.creadoPor)
        });
      }
    });

    // Add tareas (filtradas por alcance)
    (tareasFiltradas || []).forEach(tarea => {
      const tareaDate = parseDate(tarea.fechaCompromiso);
      if (tareaDate === dateKey) {
        let nombreEntidad = 'Desconocido';
        let tipoEntidad = '';
        let entidadId = null;

        if (tarea.clienteId) {
          const cliente = clientes.find(c => c.id === tarea.clienteId);
          nombreEntidad = cliente?.empresa || cliente?.nombre || 'Cliente';
          tipoEntidad = 'cliente';
          entidadId = tarea.clienteId;
        } else if (tarea.pipelineId) {
          const prospecto = pipeline.find(p => p.id === tarea.pipelineId);
          nombreEntidad = prospecto?.empresa || 'Prospecto';
          tipoEntidad = 'prospecto';
          entidadId = tarea.pipelineId;
        } else if (tarea.leadId) {
          const lead = leads.find(l => l.id === tarea.leadId);
          nombreEntidad = lead?.empresa || tarea.leadNombre || 'Lead';
          tipoEntidad = 'lead';
          entidadId = tarea.leadId;
        }

        events.push({
          id: tarea.id,
          tipo: 'tarea',
          descripcion: tarea.descripcion,
          nombreEntidad,
          tipoEntidad,
          entidadId,
          fecha: tarea.fechaCompromiso,
          fechaCreacion: tarea.fechaCreacion,
          completada: tarea.completada,
          prioridad: tarea.prioridad,
          esLead: !!tarea.leadId,
          color: tarea.completada ? 'bg-emerald-500' : tarea.prioridad === 'alta' ? 'bg-red-500' : tarea.prioridad === 'media' ? 'bg-cyan-500' : 'bg-violet-500',
          icon: Target,
          responsableId: tarea.responsableId,
          responsableNombre: getNombreUsuario(tarea.responsableId),
          creadoPor: tarea.creadoPor,
          creadoPorNombre: getNombreUsuario(tarea.creadoPor)
        });
      }
    });

    return events;
  };

  // Navigation
  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(formatDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
  };

  // Navigate to entity
  const handleGoToEntity = (event) => {
    if (event.tipoEntidad === 'cliente') {
      setCurrentModule('clientes');
    } else if (event.tipoEntidad === 'prospecto') {
      setCurrentModule('pipeline');
    }
    setSelectedEvent(null);
  };

  // Render calendar
  const { daysInMonth, startingDay } = getDaysInMonth(currentDate);
  const days = [];
  const today = new Date();
  const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  // Empty cells for days before the first of the month
  for (let i = 0; i < startingDay; i++) {
    days.push(<div key={`empty-${i}`} className="h-28 bg-slate-900/30 border-2 border-slate-400/50"></div>);
  }

  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = formatDateKey(currentDate.getFullYear(), currentDate.getMonth(), day);
    const events = getEventsForDate(dateKey);
    const isToday = dateKey === todayKey;
    const isSelected = dateKey === selectedDate;

    days.push(
      <div
        key={day}
        onClick={() => setSelectedDate(dateKey)}
        className={`h-28 p-2 border-2 border-slate-400/50 cursor-pointer transition-all hover:bg-slate-800/50 ${
          isToday ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-slate-900/50'
        } ${isSelected ? 'ring-2 ring-cyan-500' : ''}`}
      >
        <div className={`text-sm font-medium mb-1 ${isToday ? 'text-cyan-400' : 'text-slate-300'}`}>
          {day}
        </div>
        <div className="space-y-1 overflow-hidden">
          {events.slice(0, 3).map((event, idx) => {
            const Icon = event.icon;
            return (
              <div
                key={idx}
                onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); }}
                className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 truncate ${event.color} text-white cursor-pointer hover:opacity-80 transition-opacity`}
              >
                <Icon size={10} />
                <span className="truncate">{event.titulo || event.descripcion?.slice(0, 15) || event.tipo}</span>
              </div>
            );
          })}
          {events.length > 3 && (
            <div className="text-xs text-slate-400">+{events.length - 3} más</div>
          )}
        </div>
      </div>
    );
  }

  // Get events for selected date
  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  // Get upcoming events (next 7 days)
  const getUpcomingEvents = () => {
    const upcoming = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dateKey = formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
      const events = getEventsForDate(dateKey);
      if (events.length > 0) {
        upcoming.push({ date: d, dateKey, events });
      }
    }
    return upcoming;
  };

  const upcomingEvents = getUpcomingEvents();

  return (
    <div className="space-y-6">
      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedEvent(null)}>
          <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${selectedEvent.color}`}>
                    {(() => {
                      const Icon = selectedEvent.icon;
                      return <Icon className="w-6 h-6 text-white" />;
                    })()}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      {selectedEvent.tipo === 'actividad' ? selectedEvent.tipoActividadNombre || 'Actividad' :
                       selectedEvent.tipo === 'tarea' ? 'Tarea' : 'Recordatorio'}
                    </h3>
                    <p className="text-sm text-slate-400">{formatDate(selectedEvent.fecha)}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-white p-1">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Título (para recordatorios y tareas) */}
              {selectedEvent.titulo && (
                <div>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Título</label>
                  <p className="text-white mt-1 font-medium">{selectedEvent.titulo}</p>
                </div>
              )}

              {/* Descripción */}
              {(selectedEvent.descripcion || !selectedEvent.titulo) && (
                <div>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Descripción</label>
                  <p className="text-white mt-1">{selectedEvent.descripcion || 'Sin descripción'}</p>
                </div>
              )}

              {/* Entidad relacionada */}
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {selectedEvent.tipoEntidad === 'cliente' ? 'Cliente' : selectedEvent.tipoEntidad === 'lead' ? 'Lead' : 'Prospecto'}
                </label>
                <p className="text-cyan-400 mt-1 font-medium">{selectedEvent.nombreEntidad}</p>
              </div>

              {/* Responsable y Creador */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Responsable</label>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                      {selectedEvent.responsableNombre?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <p className="text-white font-medium">{selectedEvent.responsableNombre || 'Sin asignar'}</p>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Creado por</label>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">
                      {selectedEvent.creadoPorNombre?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <p className="text-slate-300">{selectedEvent.creadoPorNombre || 'Desconocido'}</p>
                  </div>
                </div>
              </div>

              {/* Estado (solo para recordatorios) */}
              {selectedEvent.tipo === 'recordatorio' && (
                <div>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Estado</label>
                  <div className="mt-1">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm ${
                      selectedEvent.completado ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {selectedEvent.completado ? <CheckCircle size={14} /> : <Clock size={14} />}
                      {selectedEvent.completado ? 'Completado' : 'Pendiente'}
                    </span>
                  </div>
                </div>
              )}

              {/* Detalles de tarea */}
              {selectedEvent.tipo === 'tarea' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Prioridad</label>
                      <div className="mt-1">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm ${
                          selectedEvent.prioridad === 'alta' ? 'bg-red-500/20 text-red-400' :
                          selectedEvent.prioridad === 'media' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {selectedEvent.prioridad === 'alta' ? 'Alta' : selectedEvent.prioridad === 'media' ? 'Media' : 'Baja'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Estado</label>
                      <div className="mt-1">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm ${
                          selectedEvent.completada ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {selectedEvent.completada ? <CheckCircle size={14} /> : <Clock size={14} />}
                          {selectedEvent.completada ? 'Completada' : 'Pendiente'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {selectedEvent.fechaCreacion && (
                    <div>
                      <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Fecha de Creacion</label>
                      <p className="text-slate-300 mt-1">{new Date(selectedEvent.fechaCreacion).toLocaleDateString('es-MX')}</p>
                    </div>
                  )}
                </>
              )}

              {/* Archivo adjunto (solo para actividades) */}
              {selectedEvent.tipo === 'actividad' && selectedEvent.archivo && (
                <div>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Archivo Adjunto</label>
                  <a
                    href={selectedEvent.archivo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <Download size={16} />
                    <span>{selectedEvent.archivoNombre || 'Descargar archivo'}</span>
                  </a>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-800 flex gap-3">
              <button
                onClick={() => handleGoToEntity(selectedEvent)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-500 to-violet-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                <ArrowUpRight size={18} />
                Ir a {selectedEvent.tipoEntidad === 'cliente' ? 'Clientes' : 'Pipeline'}
              </button>
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-3 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Calendar className="w-7 h-7 text-cyan-400" />
            Calendario
          </h2>
          <p className="text-slate-400 mt-1">Visualiza tus recordatorios y tareas pendientes</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-all"
          >
            Hoy
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Calendar Grid */}
        <div className="xl:col-span-3 bg-slate-900/50 backdrop-blur-sm rounded-2xl border-2 border-slate-400 overflow-hidden">
          {/* Month Navigation */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <button
              onClick={goToPrevMonth}
              className="p-2 hover:bg-slate-800 rounded-lg transition-all text-slate-400 hover:text-white"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <h3 className="text-lg font-semibold text-white">
              {getMonthName(currentDate)} {currentDate.getFullYear()}
            </h3>
            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-slate-800 rounded-lg transition-all text-slate-400 hover:text-white"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-slate-800">
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
              <div key={day} className="p-3 text-center text-sm font-medium text-slate-400 bg-slate-800/30">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7">
            {days}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Selected Date Events */}
          {selectedDate && (
            <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border-2 border-slate-400 p-4">
              <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-400" />
                {formatDate(selectedDate)}
              </h4>
              {selectedEvents.length > 0 ? (
                <div className="space-y-3">
                  {selectedEvents.map((event, idx) => {
                    const Icon = event.icon;
                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedEvent(event)}
                        className="p-3 bg-slate-800/50 rounded-xl border border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${event.color}`}>
                            <Icon className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white">
                              {event.tipo === 'actividad' ? event.tipoActividadNombre || 'Actividad' : 'Recordatorio'}
                            </p>
                            <p className="text-xs text-slate-400 truncate">{event.descripcion}</p>
                            <p className="text-xs text-cyan-400 mt-1">
                              {event.tipoEntidad === 'cliente' ? 'Cliente' : 'Prospecto'}: {event.nombreEntidad}
                            </p>
                            {event.tipo === 'recordatorio' && (
                              <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${event.completado ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                {event.completado ? 'Completado' : 'Pendiente'}
                              </span>
                            )}
                          </div>
                          <ChevronRight size={16} className="text-slate-500" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">No hay eventos para este día</p>
              )}
            </div>
          )}

          {/* Upcoming Events */}
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border-2 border-slate-400 p-4">
            <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Próximos 7 días
            </h4>
            {upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                {upcomingEvents.map(({ date, events }, idx) => (
                  <div key={idx}>
                    <p className="text-xs font-medium text-slate-400 mb-2">
                      {date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' })}
                    </p>
                    {events.slice(0, 2).map((event, eventIdx) => (
                      <div
                        key={eventIdx}
                        onClick={() => setSelectedEvent(event)}
                        className="flex items-center gap-2 text-sm py-1 cursor-pointer hover:text-white transition-colors"
                      >
                        <div className={`w-2 h-2 rounded-full ${event.color}`}></div>
                        <span className="text-slate-300 truncate flex-1">{event.descripcion?.slice(0, 25) || event.tipo}</span>
                      </div>
                    ))}
                    {events.length > 2 && (
                      <p className="text-xs text-slate-500 pl-4">+{events.length - 2} más</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">No hay eventos próximos</p>
            )}
          </div>

          {/* Legend */}
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border-2 border-slate-400 p-4">
            <h4 className="font-semibold text-white mb-3">Leyenda</h4>
            <div className="space-y-2">
              <p className="text-xs text-slate-500 mb-1">Recordatorios:</p>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded bg-amber-500"></div>
                <Bell size={14} className="text-slate-400" />
                <span className="text-slate-300">Pendiente</span>
              </div>
              <div className="flex items-center gap-2 text-sm mt-1">
                <div className="w-3 h-3 rounded bg-emerald-500"></div>
                <CheckCircle size={14} className="text-slate-400" />
                <span className="text-slate-300">Completado</span>
              </div>
              <div className="border-t border-slate-700 my-2 pt-2">
                <p className="text-xs text-slate-500 mb-1">Tareas por prioridad:</p>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded bg-red-500"></div>
                  <Target size={14} className="text-slate-400" />
                  <span className="text-slate-300">Alta</span>
                </div>
                <div className="flex items-center gap-2 text-sm mt-1">
                  <div className="w-3 h-3 rounded bg-amber-500"></div>
                  <Target size={14} className="text-slate-400" />
                  <span className="text-slate-300">Media</span>
                </div>
                <div className="flex items-center gap-2 text-sm mt-1">
                  <div className="w-3 h-3 rounded bg-blue-500"></div>
                  <Target size={14} className="text-slate-400" />
                  <span className="text-slate-300">Baja</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============== TAREAS ==============
function Tareas({ tareas, setTareas, clientes, pipeline, leads, actividades, usuarios, currentUser, addNotificacion }) {
  const [filtro, setFiltro] = useState('todas');
  const [showForm, setShowForm] = useState(false);
  const [editingTarea, setEditingTarea] = useState(null);
  const [form, setForm] = useState({
    descripcion: '',
    fechaCompromiso: '',
    prioridad: 'media',
    responsableId: '',
    clienteId: '',
    pipelineId: '',
    actividadId: ''
  });

  const hoy = getFechaLocal();
  const usuariosActivos = usuarios.filter(u => u.activo);
  const permisosTareas = currentUser?.permisos?.tareas || { ver: 'todos', crear: true, editar: 'todos', eliminar: 'todos' };

  // Filtrar por alcance de visualización
  const tareasPorAlcance = permisosTareas.ver === 'propios'
    ? tareas.filter(t => t.responsableId === currentUser?.id || t.creadoPor === currentUser?.id)
    : tareas;

  // Filtrar tareas
  const tareasFiltradas = tareasPorAlcance.filter(tarea => {
    if (filtro === 'mis-tareas') return tarea.responsableId === currentUser?.id;
    if (filtro === 'pendientes') return !tarea.completada;
    if (filtro === 'completadas') return tarea.completada;
    if (filtro === 'vencidas') return !tarea.completada && tarea.fechaCompromiso < hoy;
    if (filtro === 'esta-semana') {
      const fechaTarea = new Date(tarea.fechaCompromiso);
      const ahora = new Date();
      const finSemana = new Date(ahora);
      finSemana.setDate(ahora.getDate() + 7);
      return fechaTarea >= ahora && fechaTarea <= finSemana && !tarea.completada;
    }
    return true;
  }).sort((a, b) => {
    // Ordenar: pendientes primero, luego por fecha
    if (a.completada !== b.completada) return a.completada ? 1 : -1;
    return new Date(a.fechaCompromiso) - new Date(b.fechaCompromiso);
  });

  const resetForm = () => {
    setForm({
      descripcion: '',
      fechaCompromiso: '',
      prioridad: 'media',
      responsableId: '',
      clienteId: '',
      pipelineId: '',
      actividadId: ''
    });
    setEditingTarea(null);
  };

  const handleSubmit = () => {
    if (!form.descripcion.trim() || !form.fechaCompromiso) {
      alert('Por favor completa los campos obligatorios');
      return;
    }

    if (editingTarea) {
      setTareas(tareas.map(t => t.id === editingTarea.id ? { ...t, ...form } : t));
    } else {
      const nuevaTarea = {
        id: generateId(),
        ...form,
        responsableId: form.responsableId || currentUser?.id,
        completada: false,
        fechaCreacion: new Date().toISOString(),
        creadoPor: currentUser?.id
      };
      setTareas([...tareas, nuevaTarea]);

      // Notificar si se asignó a otra persona
      if (form.responsableId && form.responsableId !== currentUser?.id && addNotificacion) {
        addNotificacion(form.responsableId, `Nueva tarea asignada: ${form.descripcion}`, 'tarea');
      }
    }

    resetForm();
    setShowForm(false);
  };

  const handleEdit = (tarea) => {
    setForm({
      descripcion: tarea.descripcion,
      fechaCompromiso: tarea.fechaCompromiso,
      prioridad: tarea.prioridad || 'media',
      responsableId: tarea.responsableId || '',
      clienteId: tarea.clienteId || '',
      pipelineId: tarea.pipelineId || '',
      actividadId: tarea.actividadId || ''
    });
    setEditingTarea(tarea);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('¿Eliminar esta tarea?')) {
      setTareas(tareas.filter(t => t.id !== id));
    }
  };

  const toggleCompletada = (id) => {
    setTareas(tareas.map(t => t.id === id ? { ...t, completada: !t.completada } : t));
  };

  const getEntidadNombre = (tarea) => {
    if (tarea.clienteId) {
      const cliente = clientes.find(c => c.id === tarea.clienteId);
      return { nombre: cliente?.empresa || 'Cliente', tipo: 'cliente' };
    }
    if (tarea.pipelineId) {
      const prospecto = pipeline.find(p => p.id === tarea.pipelineId);
      return { nombre: prospecto?.empresa || 'Prospecto', tipo: 'prospecto' };
    }
    if (tarea.leadId) {
      const lead = leads.find(l => l.id === tarea.leadId);
      return { nombre: lead?.empresa || tarea.leadNombre || 'Lead', tipo: 'lead' };
    }
    return null;
  };

  const getResponsable = (id) => usuarios.find(u => u.id === id);

  // Stats
  const totalPendientes = tareas.filter(t => !t.completada).length;
  const vencidas = tareas.filter(t => !t.completada && t.fechaCompromiso < hoy).length;
  const misTareasPendientes = tareas.filter(t => t.responsableId === currentUser?.id && !t.completada).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Target className="w-7 h-7 text-cyan-400" />
            Tareas y Compromisos
          </h2>
          <p className="text-slate-400 mt-1">Gestiona las tareas derivadas de tus actividades</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-violet-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={20} />
          Nueva Tarea
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/50 rounded-xl p-4 border-2 border-slate-400">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalPendientes}</p>
              <p className="text-sm text-slate-400">Pendientes</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900/50 rounded-xl p-4 border-2 border-slate-400">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{vencidas}</p>
              <p className="text-sm text-slate-400">Vencidas</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900/50 rounded-xl p-4 border-2 border-slate-400">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <User className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{misTareasPendientes}</p>
              <p className="text-sm text-slate-400">Mis Tareas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'todas', name: 'Todas' },
          { id: 'mis-tareas', name: 'Mis Tareas' },
          { id: 'pendientes', name: 'Pendientes' },
          { id: 'vencidas', name: 'Vencidas' },
          { id: 'esta-semana', name: 'Esta Semana' },
          { id: 'completadas', name: 'Completadas' }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filtro === f.id
                ? 'bg-cyan-500 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {f.name}
          </button>
        ))}
      </div>

      {/* Lista de Tareas */}
      <div className="space-y-3">
        {tareasFiltradas.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/50 rounded-2xl border-2 border-slate-400">
            <Target className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No hay tareas en esta categoría</p>
          </div>
        ) : (
          tareasFiltradas.map(tarea => {
            const entidad = getEntidadNombre(tarea);
            const responsable = getResponsable(tarea.responsableId);
            const esVencida = !tarea.completada && tarea.fechaCompromiso < hoy;
            const esHoy = tarea.fechaCompromiso === hoy;

            return (
              <div
                key={tarea.id}
                className={`bg-slate-900/50 rounded-xl border p-4 transition-all ${
                  tarea.completada ? 'border-emerald-500/30 opacity-60' : esVencida ? 'border-red-500/50' : 'border-slate-800'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleCompletada(tarea.id)}
                    className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      tarea.completada
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-slate-600 hover:border-cyan-500'
                    }`}
                  >
                    {tarea.completada && <CheckCircle size={14} className="text-white" />}
                  </button>

                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className={`font-medium ${tarea.completada ? 'text-slate-500 line-through' : 'text-white'}`}>
                          {tarea.descripcion}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-sm">
                          {/* Fecha */}
                          <span className={`flex items-center gap-1 ${
                            esVencida ? 'text-red-400' : esHoy ? 'text-amber-400' : 'text-slate-400'
                          }`}>
                            <Calendar size={14} />
                            {esHoy ? 'Hoy' : esVencida ? 'Vencida' : formatDate(tarea.fechaCompromiso)}
                          </span>
                          {/* Prioridad */}
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            tarea.prioridad === 'alta' ? 'bg-red-500/20 text-red-400' :
                            tarea.prioridad === 'media' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {tarea.prioridad === 'alta' ? 'Alta' : tarea.prioridad === 'media' ? 'Media' : 'Baja'}
                          </span>
                          {/* Entidad */}
                          {entidad && (
                            <span className={`flex items-center gap-1 ${entidad.tipo === 'lead' ? 'text-violet-400' : 'text-cyan-400'}`}>
                              {entidad.tipo === 'lead' && <span className="text-xs mr-1">[Lead]</span>}
                              <Building size={14} />
                              {entidad.nombre}
                            </span>
                          )}
                          {/* Responsable */}
                          {responsable && (
                            <span className="flex items-center gap-1 text-violet-400">
                              <User size={14} />
                              {responsable.nombre}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(tarea)}
                          className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-all"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(tarea.id)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-lg">
            <div className="p-6 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">
                  {editingTarea ? 'Editar Tarea' : 'Nueva Tarea'}
                </h3>
                <button onClick={() => { setShowForm(false); resetForm(); }} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Descripción *</label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white resize-none"
                  rows={3}
                  placeholder="¿Qué hay que hacer?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Fecha Compromiso */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Fecha Compromiso *</label>
                  <input
                    type="date"
                    value={form.fechaCompromiso}
                    onChange={(e) => setForm({ ...form, fechaCompromiso: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                {/* Prioridad */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Prioridad</label>
                  <select
                    value={form.prioridad}
                    onChange={(e) => setForm({ ...form, prioridad: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
              </div>

              {/* Responsable */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Asignar a</label>
                <select
                  value={form.responsableId}
                  onChange={(e) => setForm({ ...form, responsableId: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                >
                  <option value="">Yo mismo</option>
                  {usuariosActivos.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} {u.id === currentUser?.id ? '(yo)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cliente o Prospecto */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Cliente (opcional)</label>
                  <select
                    value={form.clienteId}
                    onChange={(e) => setForm({ ...form, clienteId: e.target.value, pipelineId: '' })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="">Sin cliente</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.empresa}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Prospecto (opcional)</label>
                  <select
                    value={form.pipelineId}
                    onChange={(e) => setForm({ ...form, pipelineId: e.target.value, clienteId: '' })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="">Sin prospecto</option>
                    {pipeline.filter(p => !['cerrado', 'perdido'].includes(p.etapa)).map(p => (
                      <option key={p.id} value={p.id}>{p.empresa}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 flex gap-3">
              <button
                onClick={handleSubmit}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-violet-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                {editingTarea ? 'Guardar Cambios' : 'Crear Tarea'}
              </button>
              <button
                onClick={() => { setShowForm(false); resetForm(); }}
                className="px-4 py-3 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== REPORTES ==============
function Reportes({ clientes, leads, pipeline, actividades }) {
  // Métricas del pipeline
  const totalOportunidades = pipeline.length;
  const cerradosGanados = pipeline.filter(p => p.etapa === 'cerrado');
  const cerradosPerdidos = pipeline.filter(p => p.etapa === 'perdido');
  const enProgreso = pipeline.filter(p => !['cerrado', 'perdido'].includes(p.etapa));

  const valorGanado = cerradosGanados.reduce((sum, p) => sum + (parseFloat(p.valorEstimado) || 0), 0);
  const valorPerdido = cerradosPerdidos.reduce((sum, p) => sum + (parseFloat(p.valorEstimado) || 0), 0);
  const valorEnProgreso = enProgreso.reduce((sum, p) => sum + (parseFloat(p.valorEstimado) || 0), 0);

  const tasaConversion = totalOportunidades > 0 ? ((cerradosGanados.length / totalOportunidades) * 100).toFixed(1) : 0;

  // Distribución por etapa
  const distribucionEtapas = PIPELINE_STAGES.map(stage => ({
    ...stage,
    count: pipeline.filter(p => p.etapa === stage.id).length,
    valor: pipeline.filter(p => p.etapa === stage.id).reduce((sum, p) => sum + (parseFloat(p.valorEstimado) || 0), 0)
  }));

  // Actividad por tipo
  const actividadPorTipo = TIPOS_ACTIVIDAD.map(tipo => ({
    ...tipo,
    count: actividades.filter(a => a.tipo === tipo.id).length
  }));

  // Exportar a CSV
  const exportarCSV = (tipo) => {
    let datos = [];
    let headers = [];
    let filename = '';

    switch (tipo) {
      case 'clientes':
        headers = ['Empresa', 'Contacto', 'Cargo', 'Email', 'Teléfono', 'Industria', 'Núm. Empleados', 'Fecha Creación'];
        datos = clientes.map(c => [
          c.empresa, c.contacto, c.cargo, c.email, c.telefono, c.industria, c.numeroEmpleados, c.fechaCreacion
        ]);
        filename = 'clientes_eongroup.csv';
        break;
      case 'leads':
        headers = ['Empresa', 'Contacto', 'Cargo', 'Email', 'Teléfono', 'Industria', 'Fuente', 'Prioridad', 'Fecha Creación'];
        datos = leads.map(l => [
          l.empresa, l.contacto, l.cargo, l.email, l.telefono, l.industria, l.fuente, l.prioridad, l.fechaCreacion
        ]);
        filename = 'leads_eongroup.csv';
        break;
      case 'pipeline':
        headers = ['Proyecto', 'Empresa', 'Etapa', 'Valor Estimado', 'Fecha Seguimiento', 'Notas', 'Fecha Creación'];
        datos = pipeline.map(p => [
          p.nombre, p.empresa, PIPELINE_STAGES.find(s => s.id === p.etapa)?.name, p.valorEstimado, p.fechaSeguimiento, p.notas, p.fechaCreacion
        ]);
        filename = 'pipeline_eongroup.csv';
        break;
      default:
        return;
    }

    const csvContent = [
      headers.join(','),
      ...datos.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Reportes</h1>
          <p className="text-slate-400">Análisis y métricas del pipeline</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportarCSV('clientes')} className="flex items-center gap-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 px-4 py-2 rounded-xl transition-all">
            <FileSpreadsheet size={18} /> Clientes
          </button>
          <button onClick={() => exportarCSV('leads')} className="flex items-center gap-2 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-400 px-4 py-2 rounded-xl transition-all">
            <FileSpreadsheet size={18} /> Leads
          </button>
          <button onClick={() => exportarCSV('pipeline')} className="flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 px-4 py-2 rounded-xl transition-all">
            <FileSpreadsheet size={18} /> Pipeline
          </button>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Target className="w-5 h-5 text-cyan-400" />
            </div>
            <span className="text-slate-400 text-sm">Tasa de Conversión</span>
          </div>
          <p className="text-3xl font-bold text-white">{tasaConversion}%</p>
          <p className="text-slate-500 text-xs mt-1">{cerradosGanados.length} de {totalOportunidades} oportunidades</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-slate-400 text-sm">Valor Ganado</span>
          </div>
          <p className="text-3xl font-bold text-emerald-400">${valorGanado.toLocaleString('es-MX')}</p>
          <p className="text-slate-500 text-xs mt-1">{cerradosGanados.length} proyectos cerrados</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-400" />
            </div>
            <span className="text-slate-400 text-sm">Valor Perdido</span>
          </div>
          <p className="text-3xl font-bold text-red-400">${valorPerdido.toLocaleString('es-MX')}</p>
          <p className="text-slate-500 text-xs mt-1">{cerradosPerdidos.length} proyectos perdidos</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <span className="text-slate-400 text-sm">En Progreso</span>
          </div>
          <p className="text-3xl font-bold text-amber-400">${valorEnProgreso.toLocaleString('es-MX')}</p>
          <p className="text-slate-500 text-xs mt-1">{enProgreso.length} proyectos activos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline por Etapa */}
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
          <h3 className="text-lg font-semibold text-white mb-4">Distribución por Etapa</h3>
          <div className="space-y-4">
            {distribucionEtapas.map(stage => {
              const maxCount = Math.max(...distribucionEtapas.map(s => s.count), 1);
              const percentage = (stage.count / maxCount) * 100;
              return (
                <div key={stage.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${stage.bg}`}></div>
                      <span className="text-slate-300 text-sm">{stage.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-white font-medium">{stage.count}</span>
                      <span className="text-slate-500 text-sm ml-2">${stage.valor.toLocaleString('es-MX')}</span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${stage.bg} transition-all`} style={{ width: `${percentage}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actividades por Tipo */}
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
          <h3 className="text-lg font-semibold text-white mb-4">Actividades Registradas</h3>
          {actividades.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No hay actividades registradas</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {actividadPorTipo.map(tipo => {
                const Icon = tipo.icon;
                return (
                  <div key={tipo.id} className="bg-slate-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-xl ${tipo.color} bg-opacity-20 flex items-center justify-center`}>
                        <Icon size={20} className="text-white" />
                      </div>
                      <span className="text-slate-300">{tipo.name}</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{tipo.count}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Resumen General */}
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
          <h3 className="text-lg font-semibold text-white mb-4">Resumen General</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                <Building className="w-5 h-5 text-cyan-400" />
                <span className="text-slate-300">Total Clientes</span>
              </div>
              <span className="text-white font-bold text-xl">{clientes.length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                <UserPlus className="w-5 h-5 text-violet-400" />
                <span className="text-slate-300">Total Leads</span>
              </div>
              <span className="text-white font-bold text-xl">{leads.length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                <GitBranch className="w-5 h-5 text-amber-400" />
                <span className="text-slate-300">Total Pipeline</span>
              </div>
              <span className="text-white font-bold text-xl">{pipeline.length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                <PhoneCall className="w-5 h-5 text-emerald-400" />
                <span className="text-slate-300">Total Actividades</span>
              </div>
              <span className="text-white font-bold text-xl">{actividades.length}</span>
            </div>
          </div>
        </div>

        {/* Win Rate por Mes (Simplificado) */}
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
          <h3 className="text-lg font-semibold text-white mb-4">Rendimiento</h3>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-slate-400">Win Rate</span>
                <span className="text-emerald-400 font-semibold">{tasaConversion}%</span>
              </div>
              <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${tasaConversion}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-slate-400">Valor Recuperado</span>
                <span className="text-cyan-400 font-semibold">
                  {valorGanado + valorPerdido > 0 ? ((valorGanado / (valorGanado + valorPerdido)) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden flex">
                <div className="h-full bg-emerald-500" style={{ width: `${valorGanado + valorPerdido > 0 ? (valorGanado / (valorGanado + valorPerdido)) * 100 : 0}%` }}></div>
                <div className="h-full bg-red-500 flex-1"></div>
              </div>
              <div className="flex justify-between mt-1 text-xs">
                <span className="text-emerald-400">Ganado: ${valorGanado.toLocaleString('es-MX')}</span>
                <span className="text-red-400">Perdido: ${valorPerdido.toLocaleString('es-MX')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============== ARCHIVOS ==============
const CATEGORIAS_ARCHIVOS = [
  { id: 'propuestas', name: 'Propuestas', color: 'bg-cyan-500' },
  { id: 'diagnosticos', name: 'Diagnósticos', color: 'bg-violet-500' },
  { id: 'contratos', name: 'Contratos', color: 'bg-emerald-500' },
  { id: 'presentaciones', name: 'Presentaciones', color: 'bg-amber-500' },
  { id: 'otros', name: 'Otros', color: 'bg-slate-500' }
];

function Archivos({ archivos, setArchivos, clientes }) {
  const [showForm, setShowForm] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [editingArchivo, setEditingArchivo] = useState(null);
  const [viewingArchivo, setViewingArchivo] = useState(null);
  const [form, setForm] = useState({
    nombre: '', categoria: 'propuestas', clienteId: '', descripcion: '', archivo: null
  });

  const resetForm = () => {
    setForm({ nombre: '', categoria: 'propuestas', clienteId: '', descripcion: '', archivo: null });
    setShowForm(false);
    setEditingArchivo(null);
  };

  const handleEdit = (archivo) => {
    setForm({
      nombre: archivo.nombre,
      categoria: archivo.categoria,
      clienteId: archivo.clienteId || '',
      descripcion: archivo.descripcion || '',
      archivo: null
    });
    setEditingArchivo(archivo);
    setShowForm(true);
  };

  const handleUpdate = (e) => {
    e.preventDefault();
    if (!editingArchivo) return;

    const cliente = clientes.find(c => c.id === form.clienteId);
    setArchivos(archivos.map(a => a.id === editingArchivo.id ? {
      ...a,
      nombre: form.nombre,
      categoria: form.categoria,
      clienteId: form.clienteId,
      clienteNombre: cliente?.empresa || '',
      descripcion: form.descripcion
    } : a));
    resetForm();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm({ ...form, archivo: file, nombre: form.nombre || file.name.split('.')[0] });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.archivo) {
      alert('Selecciona un archivo');
      return;
    }

    setSubiendo(true);
    try {
      const timestamp = Date.now();
      const fileName = `archivos/${form.categoria}/${timestamp}_${form.archivo.name}`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, form.archivo);
      const url = await getDownloadURL(storageRef);

      const cliente = clientes.find(c => c.id === form.clienteId);
      const nuevoArchivo = {
        id: generateId(),
        nombre: form.nombre,
        categoria: form.categoria,
        clienteId: form.clienteId,
        clienteNombre: cliente?.empresa || '',
        descripcion: form.descripcion,
        nombreArchivo: form.archivo.name,
        tipo: form.archivo.type,
        tamano: form.archivo.size,
        url,
        fecha: getFechaLocal()
      };

      setArchivos([...archivos, nuevoArchivo]);
      resetForm();
    } catch (error) {
      console.error('Error subiendo archivo:', error);
      alert('Error al subir el archivo');
    }
    setSubiendo(false);
  };

  const handleDelete = (id) => {
    if (window.confirm('¿Eliminar este archivo?')) {
      setArchivos(archivos.filter(a => a.id !== id));
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const archivosFiltrados = archivos.filter(a => {
    const matchCategoria = filtroCategoria === 'todos' || a.categoria === filtroCategoria;
    const matchBusqueda = !busqueda ||
      a.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      a.clienteNombre?.toLowerCase().includes(busqueda.toLowerCase());
    return matchCategoria && matchBusqueda;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Archivos</h1>
          <p className="text-slate-400">{archivos.length} documentos</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white px-5 py-3 rounded-xl hover:opacity-90 transition-all font-medium"
        >
          <Upload size={20} /> Subir Archivo
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" size={20} />
          <input
            type="text"
            placeholder="Buscar archivos..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border-2 border-slate-400 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50 transition-all"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFiltroCategoria('todos')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filtroCategoria === 'todos' ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            Todos
          </button>
          {CATEGORIAS_ARCHIVOS.map(cat => (
            <button
              key={cat.id}
              onClick={() => setFiltroCategoria(cat.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filtroCategoria === cat.id ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
          <h2 className="text-xl font-bold text-white mb-6">{editingArchivo ? 'Editar Archivo' : 'Subir Archivo'}</h2>
          <form onSubmit={editingArchivo ? handleUpdate : handleSubmit} className="space-y-4">
            {!editingArchivo && (
              <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-cyan-500/50 transition-all">
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload size={40} className="mx-auto text-slate-500 mb-4" />
                  <p className="text-white mb-2">{form.archivo ? form.archivo.name : 'Clic para seleccionar archivo'}</p>
                  <p className="text-slate-500 text-sm">PDF, Word, Excel, Imágenes</p>
                </label>
              </div>
            )}
            {editingArchivo && (
              <div className="bg-slate-800/50 rounded-xl p-4 flex items-center gap-3">
                <FileText size={24} className="text-cyan-400" />
                <div>
                  <p className="text-white font-medium">{editingArchivo.nombreArchivo}</p>
                  <p className="text-slate-500 text-sm">{formatFileSize(editingArchivo.tamano)}</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" placeholder="Nombre del archivo" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" required />
              <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-cyan-500/50">
                {CATEGORIAS_ARCHIVOS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-cyan-500/50">
                <option value="">Asociar a cliente (opcional)</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.empresa}</option>)}
              </select>
              <input type="text" placeholder="Descripción" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={subiendo}
                className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white px-5 py-3 rounded-xl hover:opacity-90 transition-all font-medium disabled:opacity-50"
              >
                {subiendo ? <Loader size={20} className="animate-spin" /> : <Save size={20} />}
                {subiendo ? 'Subiendo...' : editingArchivo ? 'Guardar' : 'Subir'}
              </button>
              <button type="button" onClick={resetForm} className="flex items-center gap-2 bg-slate-800 text-slate-300 px-5 py-3 rounded-xl hover:bg-slate-700 transition-all font-medium">
                <X size={20} /> Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid de archivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {archivosFiltrados.map(archivo => {
          const categoria = CATEGORIAS_ARCHIVOS.find(c => c.id === archivo.categoria);
          const esImagen = archivo.tipo?.startsWith('image/');
          return (
            <div key={archivo.id} onClick={() => setViewingArchivo(archivo)} className="group bg-slate-900/50 backdrop-blur-sm rounded-2xl p-5 border-2 border-slate-400 hover:border-cyan-500/50 transition-all cursor-pointer">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl ${categoria?.color} bg-opacity-20 flex items-center justify-center flex-shrink-0`}>
                  {esImagen ? <Image size={24} className="text-white" /> : <FileText size={24} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-medium truncate">{archivo.nombre}</h4>
                  <p className="text-slate-500 text-sm">{formatFileSize(archivo.tamano)}</p>
                  {archivo.clienteNombre && (
                    <p className="text-cyan-400 text-sm mt-1">{archivo.clienteNombre}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800">
                <span className={`text-xs px-2 py-1 rounded-lg ${categoria?.color} bg-opacity-20 text-white`}>
                  {categoria?.name}
                </span>
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => handleEdit(archivo)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all" title="Editar">
                    <Edit size={16} />
                  </button>
                  <a
                    href={archivo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-slate-800 rounded-lg text-cyan-400 transition-all"
                    title="Descargar"
                  >
                    <Download size={16} />
                  </a>
                  <button onClick={() => handleDelete(archivo.id)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-all" title="Eliminar">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {archivosFiltrados.length === 0 && (
        <div className="text-center py-12">
          <FolderOpen className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-500">No hay archivos</p>
        </div>
      )}

      {/* Modal de Resumen del Archivo */}
      {viewingArchivo && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewingArchivo(null)}>
          <div className="bg-slate-900 rounded-2xl border-2 border-slate-400 w-full max-w-2xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b border-slate-700 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl ${CATEGORIAS_ARCHIVOS.find(c => c.id === viewingArchivo.categoria)?.color} bg-opacity-20 flex items-center justify-center`}>
                  {viewingArchivo.tipo?.startsWith('image/') ? <Image size={28} className="text-white" /> : <FileText size={28} className="text-white" />}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{viewingArchivo.nombre}</h2>
                  <p className="text-slate-400 text-sm">{viewingArchivo.nombreArchivo}</p>
                </div>
              </div>
              <button onClick={() => setViewingArchivo(null)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all">
                <X size={20} />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6 space-y-6">
              {/* Preview de imagen */}
              {viewingArchivo.tipo?.startsWith('image/') && (
                <div className="bg-slate-800/50 rounded-xl p-4 flex items-center justify-center">
                  <img src={viewingArchivo.url} alt={viewingArchivo.nombre} className="max-h-64 rounded-lg object-contain" />
                </div>
              )}

              {/* Información del archivo */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <p className="text-slate-500 text-sm mb-1">Categoría</p>
                  <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm ${CATEGORIAS_ARCHIVOS.find(c => c.id === viewingArchivo.categoria)?.color} bg-opacity-20 text-white`}>
                    {CATEGORIAS_ARCHIVOS.find(c => c.id === viewingArchivo.categoria)?.name}
                  </span>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <p className="text-slate-500 text-sm mb-1">Tamaño</p>
                  <p className="text-white font-medium">{formatFileSize(viewingArchivo.tamano)}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <p className="text-slate-500 text-sm mb-1">Tipo de archivo</p>
                  <p className="text-white font-medium">{viewingArchivo.tipo || 'Desconocido'}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <p className="text-slate-500 text-sm mb-1">Fecha de subida</p>
                  <p className="text-white font-medium">{formatDate(viewingArchivo.fecha)}</p>
                </div>
                {viewingArchivo.clienteNombre && (
                  <div className="bg-slate-800/50 rounded-xl p-4 col-span-2">
                    <p className="text-slate-500 text-sm mb-1">Cliente asociado</p>
                    <p className="text-cyan-400 font-medium flex items-center gap-2">
                      <Building size={16} /> {viewingArchivo.clienteNombre}
                    </p>
                  </div>
                )}
                {viewingArchivo.descripcion && (
                  <div className="bg-slate-800/50 rounded-xl p-4 col-span-2">
                    <p className="text-slate-500 text-sm mb-1">Descripción</p>
                    <p className="text-white">{viewingArchivo.descripcion}</p>
                  </div>
                )}
              </div>

              {/* Acciones */}
              <div className="flex gap-3 pt-4 border-t border-slate-700">
                <a
                  href={viewingArchivo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white px-5 py-3 rounded-xl hover:opacity-90 transition-all font-medium"
                >
                  <Download size={18} /> Descargar
                </a>
                <button
                  onClick={() => { setViewingArchivo(null); handleEdit(viewingArchivo); }}
                  className="flex items-center gap-2 bg-slate-800 text-slate-300 px-5 py-3 rounded-xl hover:bg-slate-700 transition-all font-medium"
                >
                  <Edit size={18} /> Editar
                </button>
                <button
                  onClick={() => { handleDelete(viewingArchivo.id); setViewingArchivo(null); }}
                  className="flex items-center gap-2 bg-red-500/20 text-red-400 px-5 py-3 rounded-xl hover:bg-red-500/30 transition-all font-medium"
                >
                  <Trash2 size={18} /> Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== EMAIL COMPOSER ==============
// Configuración de EmailJS - Cambiar estos valores por los tuyos de emailjs.com
const EMAILJS_CONFIG = {
  publicKey: 'MdW1DuU1IFKC9HL_q',
  serviceId: 'service_nfefxqn',
  templateId: 'template_augho41'
};

const EMAIL_TEMPLATES = [
  {
    id: 'seguimiento',
    name: 'Seguimiento',
    subject: 'Seguimiento a nuestra conversación',
    body: `Estimado/a {nombre},

Espero que se encuentre bien. Me pongo en contacto para dar seguimiento a nuestra conversación anterior.

Quedo atento a sus comentarios.

Saludos cordiales,
{remitente}`
  },
  {
    id: 'propuesta',
    name: 'Envío de Propuesta',
    subject: 'Propuesta comercial - {empresa}',
    body: `Estimado/a {nombre},

Es un placer contactarle. Adjunto encontrará nuestra propuesta comercial con los servicios que hemos preparado especialmente para {empresa}.

Quedamos a su disposición para cualquier duda o aclaración.

Saludos cordiales,
{remitente}`
  },
  {
    id: 'agradecimiento',
    name: 'Agradecimiento',
    subject: 'Gracias por su preferencia',
    body: `Estimado/a {nombre},

Queremos agradecerle por confiar en nosotros. Es un placer tenerle como cliente.

Si tiene alguna pregunta o necesita asistencia, no dude en contactarnos.

Saludos cordiales,
{remitente}`
  },
  {
    id: 'recordatorio',
    name: 'Recordatorio de Reunión',
    subject: 'Recordatorio: Reunión programada',
    body: `Estimado/a {nombre},

Le recordamos nuestra reunión programada. Por favor confirme su asistencia.

Quedamos atentos.

Saludos cordiales,
{remitente}`
  },
  {
    id: 'custom',
    name: 'Personalizado',
    subject: '',
    body: ''
  }
];

function EmailComposer({ isOpen, onClose, destinatario, currentUser, onEmailSent }) {
  const [to, setTo] = useState('');
  const [toName, setToName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('custom');

  useEffect(() => {
    if (destinatario) {
      setTo(destinatario.email || '');
      setToName(destinatario.contacto || destinatario.nombre || '');
    }
  }, [destinatario]);

  useEffect(() => {
    if (isOpen) {
      setSent(false);
      setError('');
    }
  }, [isOpen]);

  const applyTemplate = (templateId) => {
    const template = EMAIL_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      let subjectText = template.subject
        .replace('{empresa}', destinatario?.empresa || '')
        .replace('{nombre}', toName);
      let bodyText = template.body
        .replace(/{nombre}/g, toName || '[Nombre]')
        .replace(/{empresa}/g, destinatario?.empresa || '[Empresa]')
        .replace(/{remitente}/g, currentUser?.nombre || 'Tu nombre');
      setSubject(subjectText);
      setBody(bodyText);
    }
  };

  const sendEmail = async () => {
    if (!to || !subject || !body) {
      setError('Por favor completa todos los campos');
      return;
    }

    // Verificar si EmailJS está configurado
    if (EMAILJS_CONFIG.publicKey === 'TU_PUBLIC_KEY') {
      setError('EmailJS no está configurado. Por favor configura las credenciales en el código.');
      return;
    }

    setSending(true);
    setError('');

    try {
      // eslint-disable-next-line no-undef
      await emailjs.send(
        EMAILJS_CONFIG.serviceId,
        EMAILJS_CONFIG.templateId,
        {
          to_email: to,
          to_name: toName,
          from_name: 'NewcorpAI',
          subject: subject,
          message: body
        },
        EMAILJS_CONFIG.publicKey
      );

      setSent(true);
      if (onEmailSent) {
        onEmailSent({
          to,
          toName,
          subject,
          body,
          fecha: new Date().toISOString()
        });
      }

      // Cerrar después de 2 segundos
      setTimeout(() => {
        onClose();
        setTo('');
        setToName('');
        setSubject('');
        setBody('');
        setSent(false);
        setSelectedTemplate('custom');
      }, 2000);

    } catch (err) {
      console.error('Error enviando email:', err);
      setError('Error al enviar el correo. Verifica la configuración de EmailJS.');
    } finally {
      setSending(false);
    }
  };

  // Abrir en cliente de correo como alternativa
  const openInMailClient = () => {
    const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-slate-700 bg-gradient-to-r from-cyan-500/10 to-violet-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-violet-500 rounded-xl flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Nuevo Correo</h3>
                <p className="text-xs text-slate-400">Envía un correo a tu cliente</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all">
              <X size={20} />
            </button>
          </div>
        </div>

        {sent ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h4 className="text-xl font-semibold text-white mb-2">¡Correo Enviado!</h4>
              <p className="text-slate-400">El correo ha sido enviado exitosamente a {to}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Plantillas */}
            <div className="p-4 border-b border-slate-800">
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">Plantillas</label>
              <div className="flex gap-2 flex-wrap">
                {EMAIL_TEMPLATES.map(template => (
                  <button
                    key={template.id}
                    onClick={() => applyTemplate(template.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                      selectedTemplate === template.id
                        ? 'bg-cyan-500 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Para</label>
                <input
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Asunto</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Asunto del correo"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Mensaje</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Escribe tu mensaje aquí..."
                  rows="10"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-700 flex items-center justify-between">
              <button
                onClick={openInMailClient}
                className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                <Globe size={16} />
                Abrir en cliente de correo
              </button>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={sendEmail}
                  disabled={sending || !to || !subject || !body}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? <Loader className="w-4 h-4 animate-spin" /> : <Send size={16} />}
                  {sending ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============== CHATBOT GEMINI AI ==============

// Función para renderizar markdown simple (imágenes, negritas, links)
function renderMarkdown(text) {
  if (!text) return null;

  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Buscar imagen: ![alt](url)
    const imgMatch = remaining.match(/!\[([^\]]*)\]\(([^)]+)\)/);
    // Buscar link: [text](url)
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
    // Buscar negrita: **text**
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);

    // Encontrar cuál viene primero
    const matches = [
      imgMatch ? { type: 'img', match: imgMatch, index: remaining.indexOf(imgMatch[0]) } : null,
      linkMatch && !imgMatch?.index === linkMatch?.index ? { type: 'link', match: linkMatch, index: remaining.indexOf(linkMatch[0]) } : null,
      boldMatch ? { type: 'bold', match: boldMatch, index: remaining.indexOf(boldMatch[0]) } : null
    ].filter(m => m !== null).sort((a, b) => a.index - b.index);

    if (matches.length === 0) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    const first = matches[0];

    // Agregar texto antes del match
    if (first.index > 0) {
      parts.push(<span key={key++}>{remaining.substring(0, first.index)}</span>);
    }

    // Agregar el elemento
    if (first.type === 'img') {
      parts.push(
        <img
          key={key++}
          src={first.match[2]}
          alt={first.match[1] || 'Imagen'}
          className="max-w-full h-auto rounded-lg my-2 max-h-64 object-contain cursor-pointer hover:opacity-90"
          onClick={() => window.open(first.match[2], '_blank')}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      );
    } else if (first.type === 'link') {
      parts.push(
        <a
          key={key++}
          href={first.match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:text-cyan-300 underline"
        >
          {first.match[1]}
        </a>
      );
    } else if (first.type === 'bold') {
      parts.push(<strong key={key++}>{first.match[1]}</strong>);
    }

    remaining = remaining.substring(first.index + first.match[0].length);
  }

  return parts;
}

function GeminiChatbot({ clientes, pipeline, actividades, tareas, recordatorios, currentUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '¡Hola! Soy tu asistente de CRM powered by Gemini AI. Puedo ayudarte a:\n\n• Buscar información de empresas en internet\n• Mostrar logos e imágenes de empresas\n• Redactar actividades y correos profesionales\n• Analizar imágenes que me envíes\n• Responder preguntas sobre tu CRM\n\n¿En qué puedo ayudarte?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Crear contexto del CRM para el asistente
  const getCRMContext = () => {
    const hoy = getFechaLocal();
    const manana = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    // Formatear fecha legible
    const formatFecha = (fecha) => {
      if (!fecha) return 'sin fecha';
      if (fecha === hoy) return 'hoy';
      if (fecha === manana) return 'mañana';
      const [y, m, d] = fecha.split('-');
      return `${d}/${m}/${y}`;
    };

    // Clientes (máx 10)
    const listaClientes = (clientes || []).slice(0, 10).map(c =>
      `• ${c.empresa || c.nombre} (${c.contacto || 'sin contacto'})`
    ).join('\n') || 'No hay clientes';

    // Prospectos (máx 10)
    const listaProspectos = (pipeline || []).slice(0, 10).map(p =>
      `• ${p.empresa || p.nombre} - Etapa: ${p.etapa} - Valor: $${p.valorEstimado || 0}`
    ).join('\n') || 'No hay prospectos';

    // Recordatorios pendientes con detalles
    const recordatoriosPendientesLista = (recordatorios || [])
      .filter(r => !r.completado)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      .slice(0, 10)
      .map(r => {
        const cliente = (clientes || []).find(c => c.id === r.clienteId);
        const prospecto = (pipeline || []).find(p => p.id === r.pipelineId);
        const entidad = cliente?.empresa || cliente?.nombre || prospecto?.empresa || prospecto?.nombre || '';
        return `• "${r.titulo}" - Fecha: ${formatFecha(r.fecha)}${entidad ? ` - Para: ${entidad}` : ''}`;
      }).join('\n') || 'No hay recordatorios pendientes';

    // Tareas pendientes con detalles
    const tareasPendientesLista = (tareas || [])
      .filter(t => !t.completada)
      .sort((a, b) => new Date(a.fechaCompromiso) - new Date(b.fechaCompromiso))
      .slice(0, 10)
      .map(t => {
        const cliente = (clientes || []).find(c => c.id === t.clienteId);
        const prospecto = (pipeline || []).find(p => p.id === t.pipelineId);
        const entidad = cliente?.empresa || cliente?.nombre || prospecto?.empresa || prospecto?.nombre || '';
        return `• "${t.descripcion}" - Fecha compromiso: ${formatFecha(t.fechaCompromiso)} - Prioridad: ${t.prioridad}${entidad ? ` - Para: ${entidad}` : ''}`;
      }).join('\n') || 'No hay tareas pendientes';

    // Actividades recientes
    const actividadesRecientes = (actividades || [])
      .sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion))
      .slice(0, 5)
      .map(a => `• ${a.tipo}: ${a.titulo || a.descripcion} (${formatFecha(a.fecha)})`
      ).join('\n') || 'No hay actividades recientes';

    return `CONTEXTO COMPLETO DEL CRM - Fecha actual: ${formatFecha(hoy)}
Usuario: ${currentUser?.nombre || 'Usuario'}

📊 RESUMEN:
- Total clientes: ${(clientes || []).length}
- Total prospectos: ${(pipeline || []).length}
- Tareas pendientes: ${(tareas || []).filter(t => !t.completada).length}
- Recordatorios pendientes: ${(recordatorios || []).filter(r => !r.completado).length}

🔔 RECORDATORIOS PENDIENTES:
${recordatoriosPendientesLista}

✅ TAREAS PENDIENTES:
${tareasPendientesLista}

👥 CLIENTES:
${listaClientes}

💼 PROSPECTOS EN PIPELINE:
${listaProspectos}

📝 ACTIVIDADES RECIENTES:
${actividadesRecientes}`;
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && !selectedImage) || loading) return;

    const userMessage = {
      role: 'user',
      content: input,
      image: imagePreview
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const crmContext = getCRMContext();

      // Construir historial de conversación (últimas 10 interacciones = 20 mensajes)
      const historialMensajes = updatedMessages
        .filter(m => !m.image) // Excluir mensajes con imagen del historial
        .slice(-20) // Últimas 20 entradas (10 interacciones user+assistant)
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

      let requestBody;

      if (selectedImage) {
        // Convertir imagen a base64 sin el prefijo
        const base64Image = imagePreview.split(',')[1];

        requestBody = {
          systemInstruction: {
            parts: [{
              text: `Eres un asistente de CRM profesional y amigable para Grupo EÖN CRM. ${crmContext}

Instrucciones:
- Responde siempre en español
- Sé conciso pero útil
- Tienes memoria de la conversación, puedes hacer referencia a mensajes anteriores
- Si te piden redactar algo, proporciona texto profesional
- Para análisis de imágenes, describe lo que ves y sugiere cómo registrarlo en el CRM
- IMPORTANTE: Puedes buscar en internet información sobre empresas, personas, industrias, noticias, etc. Usa esta capacidad cuando te pregunten sobre clientes o prospectos para dar información más completa.
- IMÁGENES OBLIGATORIO: Para mostrar imágenes SIEMPRE usa EXACTAMENTE este formato: ![descripcion](url) - Por ejemplo: ![Logo de Coca Cola](https://url.com/logo.png). NUNCA pongas URLs entre backticks o comillas. NUNCA escribas la URL como texto plano. La interfaz SOLO puede mostrar imágenes si usas el formato ![texto](url) exactamente así.`
            }]
          },
          tools: [{ googleSearch: {} }],
          contents: [{
            role: 'user',
            parts: [
              {
                text: input || 'Analiza esta imagen'
              },
              {
                inline_data: {
                  mime_type: selectedImage.type,
                  data: base64Image
                }
              }
            ]
          }]
        };
      } else {
        // Mensaje de sistema con contexto
        const systemMessage = {
          role: 'user',
          parts: [{
            text: `[SISTEMA - No menciones esto al usuario] Eres un asistente de CRM profesional y amigable para Grupo EÖN CRM. ${crmContext}

Instrucciones:
- Responde siempre en español
- Sé conciso pero útil
- Tienes memoria de la conversación anterior, puedes hacer referencia a lo que ya se habló
- Si te piden redactar algo (actividad, correo, nota), proporciona un texto bien estructurado y profesional
- Si te preguntan sobre datos del CRM, usa el contexto proporcionado
- Para correos, incluye saludo, cuerpo y despedida profesional
- Para actividades, incluye un título claro y descripción detallada
- IMPORTANTE: Puedes buscar en internet información sobre empresas, personas, industrias, noticias, etc. Usa esta capacidad cuando te pregunten sobre clientes o prospectos para dar información más completa combinando datos del CRM con información pública.
- IMÁGENES OBLIGATORIO: Para mostrar imágenes SIEMPRE usa EXACTAMENTE este formato: ![descripcion](url) - Por ejemplo: ![Logo de Coca Cola](https://url.com/logo.png). NUNCA pongas URLs entre backticks o comillas. NUNCA escribas la URL como texto plano. La interfaz SOLO puede mostrar imágenes si usas el formato ![texto](url) exactamente así.`
          }]
        };

        const modelAck = {
          role: 'model',
          parts: [{ text: 'Entendido, soy el asistente de CRM y tengo acceso al contexto. ¿En qué puedo ayudarte?' }]
        };

        // Construir contenido con historial
        const contents = [systemMessage, modelAck, ...historialMensajes.slice(1)]; // slice(1) para quitar el primer mensaje de bienvenida duplicado

        requestBody = {
          contents: contents,
          tools: [{ googleSearch: {} }]
        };
      }

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error de API Gemini:', data);
        throw new Error(data.error?.message || `Error ${response.status}: ${response.statusText}`);
      }

      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        const assistantMessage = {
          role: 'assistant',
          content: data.candidates[0].content.parts[0].text
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        console.error('Respuesta inesperada de Gemini:', data);
        throw new Error('Respuesta inválida de Gemini');
      }
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu mensaje. Por favor intenta de nuevo.'
      }]);
    } finally {
      setLoading(false);
      removeImage();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const quickActions = [
    { label: 'Info completa CRM', prompt: 'Dame un resumen completo de toda la información de mi CRM: clientes, prospectos, tareas pendientes, recordatorios y actividades recientes. Incluye fechas y detalles importantes.' },
    { label: 'Mis pendientes', prompt: 'Dame una lista detallada de todas mis tareas y recordatorios pendientes con sus fechas. ¿Cuáles son para hoy y cuáles para mañana?' },
    { label: 'Redactar actividad', prompt: 'Ayúdame a redactar una actividad profesional para registrar una llamada de seguimiento con un cliente' },
    { label: 'Escribir correo', prompt: 'Ayúdame a escribir un correo profesional para dar seguimiento a un prospecto interesado en nuestros servicios' },
    { label: 'Nota de reunión', prompt: 'Ayúdame a redactar una nota de reunión profesional para registrar los puntos discutidos con un cliente' }
  ];

  const clearChat = () => {
    setMessages([
      { role: 'assistant', content: '¡Hola! Soy tu asistente de CRM powered by Gemini AI. Puedo buscar información de empresas, mostrar logos e imágenes, y ayudarte con tu CRM. ¿En qué puedo ayudarte?' }
    ]);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center z-50 group"
      >
        <Bot className="w-7 h-7 text-white" />
        <span className="absolute -top-10 right-0 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700">
          Asistente AI
        </span>
      </button>
    );
  }

  return (
    <div className={`fixed ${isExpanded ? 'inset-4' : 'bottom-6 right-6 w-96 h-[600px]'} bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 flex flex-col z-50 transition-all duration-300`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-gradient-to-r from-violet-500/10 to-cyan-500/10 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold">Asistente CRM</h3>
            <p className="text-xs text-slate-400">Powered by Gemini AI</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={clearChat} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all" title="Limpiar chat">
            <RotateCcw size={18} />
          </button>
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all" title={isExpanded ? 'Minimizar' : 'Expandir'}>
            {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button onClick={() => setIsOpen(false)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all" title="Cerrar">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-3 border-b border-slate-800 flex gap-2 overflow-x-auto scrollbar-thin">
        {quickActions.map((action, idx) => (
          <button
            key={idx}
            onClick={() => { setInput(action.prompt); }}
            className="flex-shrink-0 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-all whitespace-nowrap"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-violet-500/20 border-violet-500/30' : 'bg-slate-800 border-slate-700'} border rounded-2xl p-3`}>
              {msg.image && (
                <img src={msg.image} alt="Uploaded" className="max-w-full h-auto rounded-lg mb-2 max-h-48 object-cover" />
              )}
              <div className="text-white text-sm whitespace-pre-wrap">{renderMarkdown(msg.content)}</div>
              {msg.role === 'assistant' && (
                <button
                  onClick={() => copyToClipboard(msg.content)}
                  className="mt-2 flex items-center gap-1 text-xs text-slate-500 hover:text-cyan-400 transition-colors"
                >
                  <Copy size={12} /> Copiar
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-3">
              <div className="flex items-center gap-2">
                <Loader className="w-4 h-4 text-cyan-400 animate-spin" />
                <span className="text-slate-400 text-sm">Pensando...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Image Preview */}
      {imagePreview && (
        <div className="px-4 pb-2">
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-20 w-auto rounded-lg border border-slate-700" />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-end gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-xl transition-all"
            title="Adjuntar imagen"
          >
            <Paperclip size={20} />
          </button>
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Escribe tu mensaje..."
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 resize-none focus:outline-none focus:border-cyan-500 transition-colors"
              rows="1"
              style={{ maxHeight: '120px', minHeight: '44px' }}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={loading || (!input.trim() && !selectedImage)}
            className="p-2.5 bg-gradient-to-r from-violet-500 to-cyan-500 text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
