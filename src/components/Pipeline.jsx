import React, { useState, useMemo } from 'react';
import {
  Plus, Trash2, Edit, Save, Search, Phone, Mail,
  Building, FileText, CheckCircle, Clock, X,
  Target, Loader, Upload, Download, Image,
  Tag, MessageSquare, Bell, PhoneCall, Send,
  History, AlertCircle, User, Calendar, GitBranch, Flag,
  LayoutGrid, Table2, Info, Zap, Lightbulb
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { formatDate, generateId, getFechaLocal, getColorUsuario, abrirGoogleCalendar, completarTareaConRecurrencia, RECURRENCIA_OPTIONS } from '../utils/helpers';
import { TIPOS_ACTIVIDAD, FUENTES, PIPELINE_STAGES } from '../utils/constants';
import { validarTransicionEtapa, esTransicionPermitida, generarTareaSeguimiento, BLUEPRINT_RULES } from '../utils/automations';
import { getWhatsAppLink, getCallLink, getLastContactInfo } from '../utils/communication';
import { calcularDealScore, getSugerenciaAccion } from '../utils/scoring';
import DataTable from './ui/DataTable';
import FilterPanel from './ui/FilterPanel';
import Timeline from './ui/Timeline';
import EmptyState from './ui/EmptyState';

// Mapa de iconos para sugerencias de IA
const ICON_MAP = { PhoneCall, Send, FileText, Calendar, AlertCircle, CheckCircle };

// Mapa de colores hex para scores (los utils retornan clases tailwind, necesitamos hex para estilos inline)
const SCORE_COLORS = {
  'text-red-400': '#f87171',
  'text-amber-400': '#fbbf24',
  'text-blue-400': '#60a5fa',
  'text-slate-400': '#94a3b8',
  'text-emerald-400': '#34d399',
};
const getScoreHex = (tailwindColor) => SCORE_COLORS[tailwindColor] || '#94a3b8';

function Pipeline({ pipeline, setPipeline, cuentas, setCuentas, contactos, setContactos, actividades, setActividades, recordatorios, setRecordatorios, tareas, setTareas, usuarios, currentUser, addNotificacion, setEmailDestinatario, setEmailModalOpen, todosLosServicios, addServicio, addAuditLog }) {
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
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [form, setForm] = useState({
    nombre: '', empresa: '', contacto: '', cargo: '', email: '', telefono: '', paginaWeb: '', clienteId: '', etapa: 'prospecto', valorEstimado: '', servicio: '', notas: '', fechaSeguimiento: '', notaRapida: '', asignadoA: '', asignadoA2: '', asignadoA3: '',
    fuente: '', referidoPor: '', esComisionista: false, numeroEmpleados: ''
  });
  const [actividadForm, setActividadForm] = useState({
    tipo: 'llamada', titulo: '', descripcion: '', fecha: getFechaLocal(), responsableId: ''
  });
  const [recordatorioForm, setRecordatorioForm] = useState({
    titulo: '', fecha: '', hora: '', descripcion: '', responsableId: ''
  });
  const [editingActividad, setEditingActividad] = useState(null);
  const [viewingActividad, setViewingActividad] = useState(null);
  const [editingRecordatorio, setEditingRecordatorio] = useState(null);
  // Drag & Drop
  const [draggedItemId, setDraggedItemId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  // Para editar tareas desde la pestaña Tareas
  const [showTareaForm, setShowTareaForm] = useState(false);
  const [editingTarea, setEditingTarea] = useState(null);
  const [tareaFormData, setTareaFormData] = useState({ descripcion: '', fechaCompromiso: '', hora: '', prioridad: 'media', responsableId: '' });
  // Tareas y recordatorios a crear desde el modal de actividad
  const [tareasNuevas, setTareasNuevas] = useState([]);
  const [recordatoriosNuevos, setRecordatoriosNuevos] = useState([]);
  const [mostrarFormTarea, setMostrarFormTarea] = useState(false);
  const [mostrarFormRecordatorioNuevo, setMostrarFormRecordatorioNuevo] = useState(false);
  const [tareaTemp, setTareaTemp] = useState({ descripcion: '', fechaCompromiso: '', hora: '', prioridad: 'media', responsableId: '' });
  const [recordatorioTemp, setRecordatorioTemp] = useState({ titulo: '', fecha: '', hora: '', descripcion: '', responsableId: '' });
  const [editandoTareaExistenteId, setEditandoTareaExistenteId] = useState(null);
  const [editandoRecordatorioExistenteId, setEditandoRecordatorioExistenteId] = useState(null);
  const [showNewServicio, setShowNewServicio] = useState(false);
  const [newServicioName, setNewServicioName] = useState('');
  // View toggle: 'kanban' or 'tabla'
  const [vistaActual, setVistaActual] = useState('kanban');
  // Filter conditions from FilterPanel
  const [filterConditions, setFilterConditions] = useState([]);

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
      return prospecto.asignadoA === currentUser?.id || prospecto.asignadoA2 === currentUser?.id || prospecto.asignadoA3 === currentUser?.id || prospecto.creadoPor === currentUser?.id;
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
      return prospecto.asignadoA === currentUser?.id || prospecto.asignadoA2 === currentUser?.id || prospecto.asignadoA3 === currentUser?.id || prospecto.creadoPor === currentUser?.id;
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

  // Pipeline filtrado por alcance de visualización
  const pipelinePorAlcance = useMemo(() => {
    return permisosPipeline.ver === 'propios'
      ? pipeline.filter(p => p.asignadoA === currentUser?.id || p.asignadoA2 === currentUser?.id || p.asignadoA3 === currentUser?.id || p.creadoPor === currentUser?.id)
      : pipeline;
  }, [pipeline, permisosPipeline.ver, currentUser?.id]);

  // Aplicar filtros avanzados
  const pipelineFiltrado = useMemo(() => {
    if (filterConditions.length === 0) return pipelinePorAlcance;
    return pipelinePorAlcance.filter(item => {
      return filterConditions.every(cond => {
        let valor = item[cond.field];
        // Para campo "nombre", buscar en empresa + nombre
        if (cond.field === 'empresa') valor = item.empresa || item.nombre || '';
        // Para asignadoA, buscar el nombre del usuario
        if (cond.field === 'asignadoA') {
          const u = (usuarios || []).find(u => u.id === item.asignadoA);
          valor = u?.nombre || '';
        }
        const v = String(valor || '').toLowerCase();
        const cv = String(cond.value || '').toLowerCase();
        switch (cond.operator) {
          case 'es': return v === cv;
          case 'no_es': return v !== cv;
          case 'contiene': return v.includes(cv);
          case 'no_contiene': return !v.includes(cv);
          case 'empieza': return v.startsWith(cv);
          case 'mayor_que': return parseFloat(valor || 0) > parseFloat(cond.value || 0);
          case 'menor_que': return parseFloat(valor || 0) < parseFloat(cond.value || 0);
          default: return true;
        }
      });
    });
  }, [pipelinePorAlcance, filterConditions, usuarios]);

  // Filter panel fields definition
  const filterFields = useMemo(() => [
    { key: 'empresa', label: 'Empresa / Nombre', type: 'text' },
    { key: 'etapa', label: 'Etapa', type: 'select', options: PIPELINE_STAGES.map(s => ({ value: s.id, label: s.name })) },
    { key: 'servicio', label: 'Servicio', type: 'text' },
    { key: 'asignadoA', label: 'Asignado a', type: 'select', options: usuariosActivos.map(u => ({ value: u.id, label: u.nombre })) },
    { key: 'valorEstimado', label: 'Valor Estimado', type: 'number' },
  ], [usuariosActivos]);

  // Table columns for DataTable view
  const tableColumns = useMemo(() => [
    {
      key: 'empresa',
      label: 'Empresa / Nombre',
      sortable: true,
      render: (val, row) => {
        const cta = (cuentas || []).find(c => c.id === row.clienteId || c.id === row.cuentaId);
        const empresaNombre = cta?.empresa || val || row.nombre;
        const cont = (contactos || []).find(c => c.id === row.contactoId);
        const contactoNombre = cont?.nombre || row.contacto;
        const logo = row.logoUrl || cta?.logoUrl;
        return (
          <div className="flex items-center gap-3">
            {logo ? (
              <img src={logo} alt={empresaNombre} className="w-8 h-8 rounded-lg object-contain bg-white/10 p-0.5" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
                <Building className="w-4 h-4 text-slate-400" />
              </div>
            )}
            <div>
              <p className="text-white font-medium text-sm">{empresaNombre}</p>
              {contactoNombre && <p className="text-slate-500 text-xs">{contactoNombre}</p>}
            </div>
          </div>
        );
      },
    },
    {
      key: 'etapa',
      label: 'Etapa',
      sortable: true,
      render: (val) => {
        const stage = PIPELINE_STAGES.find(s => s.id === val);
        return stage ? (
          <span className={`inline-block px-3 py-1.5 rounded-full text-xs font-medium text-white ${stage.bg}`}>
            {stage.name}
          </span>
        ) : val || '-';
      },
    },
    {
      key: 'valorEstimado',
      label: 'Valor Estimado',
      sortable: true,
      render: (val) => val ? (
        <span className="text-emerald-400 font-semibold">${parseFloat(val).toLocaleString('es-MX')}</span>
      ) : <span className="text-slate-500">-</span>,
    },
    {
      key: 'servicio',
      label: 'Servicio',
      sortable: true,
      render: (val) => val || <span className="text-slate-500">-</span>,
    },
    {
      key: 'contacto',
      label: 'Contacto',
      sortable: true,
      render: (val, row) => {
        const cont = (contactos || []).find(c => c.id === row.contactoId);
        const nombre = cont?.nombre || val || '-';
        const email = cont?.email || row.email || '';
        return (
          <div>
            <p className="text-sm">{nombre}</p>
            {email && <p className="text-xs text-slate-500">{email}</p>}
          </div>
        );
      },
    },
    {
      key: 'asignadoA',
      label: 'Asignado',
      sortable: false,
      render: (val, row) => {
        const ids = [row.asignadoA, row.asignadoA2, row.asignadoA3].filter(Boolean);
        if (ids.length === 0 && row.creadoPor) ids.push(row.creadoPor);
        const usrs = ids.map(id => (usuarios || []).find(u => u.id === id)).filter(Boolean);
        return usrs.length > 0 ? (
          <div className="flex flex-wrap gap-1 items-center">
            {usrs.map((u, i) => (
              <span key={i} className="flex items-center gap-1">
                {u.fotoUrl ? <img src={u.fotoUrl} alt={u.nombre} className="w-5 h-5 rounded-full object-cover inline-block" /> : null}
                <span className={`text-xs font-medium ${getColorUsuario(u.nombre)}`}>{u.nombre}</span>
              </span>
            ))}
          </div>
        ) : <span className="text-slate-500">-</span>;
      },
    },
    {
      key: 'fechaSeguimiento',
      label: 'Seguimiento',
      sortable: true,
      render: (val) => val ? (
        <span className="text-xs flex items-center gap-1 text-slate-300">
          <Calendar className="w-3 h-3" /> {formatDate(val)}
        </span>
      ) : <span className="text-slate-500">-</span>,
    },
    {
      key: 'ultimoContacto',
      label: 'Ultimo Contacto',
      sortable: false,
      render: (val, row) => {
        const lastContact = getLastContactInfo(row.id, actividades, 'pipelineId');
        const phone = row.telefono;
        return (
          <div className="flex items-center gap-2">
            <span className={`text-xs ${lastContact.color}`}>{lastContact.texto}</span>
            {phone && (
              <span className="flex items-center gap-0.5">
                <a href={getWhatsAppLink(phone)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-0.5 rounded hover:bg-green-500/20 text-green-400 transition-all" title="WhatsApp"><MessageSquare size={12} /></a>
                <a href={getCallLink(phone)} onClick={(e) => e.stopPropagation()} className="p-0.5 rounded hover:bg-cyan-500/20 text-cyan-400 transition-all" title="Llamar"><Phone size={12} /></a>
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'score',
      label: 'Score',
      sortable: true,
      sortFunction: (a, b) => {
        const scoreA = calcularDealScore(a, actividades)?.score || 0;
        const scoreB = calcularDealScore(b, actividades)?.score || 0;
        return scoreA - scoreB;
      },
      render: (val, row) => {
        const scoreData = calcularDealScore(row, actividades);
        const tareasRow = (tareas || []).filter(t => t.pipelineId === row.id);
        const sug = getSugerenciaAccion(row, actividades, tareasRow);
        const RowSugIcon = ICON_MAP[sug?.icono] || Zap;
        return (
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0"
              style={{ backgroundColor: `${getScoreHex(scoreData.color)}20`, color: getScoreHex(scoreData.color) }}
              title={`Score: ${scoreData.score} - ${scoreData.nivel}`}
            >
              {scoreData.score}
            </div>
            {sug && sug.accion && (
              <div className="flex items-center gap-1 min-w-0" title={sug.descripcion}>
                <RowSugIcon size={12} style={{ color: getScoreHex(sug.color) }} className="flex-shrink-0" />
                <span className="text-xs truncate max-w-[120px]" style={{ color: getScoreHex(sug.color) }}>{sug.accion}</span>
              </div>
            )}
          </div>
        );
      },
    },
  ], [usuarios, cuentas, contactos, actividades, tareas]);

  // Bulk actions for DataTable
  const tableBulkActions = useMemo(() => [
    {
      label: 'Eliminar seleccionados',
      onClick: (ids) => {
        if (window.confirm(`¿Eliminar ${ids.length} elementos del pipeline?`)) {
          setPipeline(prev => prev.filter(p => !ids.includes(p.id)));
        }
      },
    },
    {
      label: 'Cambiar etapa',
      onClick: (ids) => {
        const nuevaEtapa = window.prompt('Nueva etapa:\n' + PIPELINE_STAGES.map(s => `${s.id} = ${s.name}`).join('\n'));
        if (nuevaEtapa && PIPELINE_STAGES.find(s => s.id === nuevaEtapa)) {
          ids.forEach(id => moverEtapa(id, nuevaEtapa));
        }
      },
    },
  ], []);

  // Manejar agregar nuevo servicio
  const handleAddServicio = () => {
    if (addServicio(newServicioName)) {
      setForm({ ...form, servicio: newServicioName.trim() });
      setNewServicioName('');
      setShowNewServicio(false);
    }
  };

  const resetForm = () => {
    setForm({ nombre: '', empresa: '', contacto: '', cargo: '', email: '', telefono: '', paginaWeb: '', clienteId: '', etapa: 'prospecto', valorEstimado: '', servicio: '', notas: '', fechaSeguimiento: '', notaRapida: '', asignadoA: '', asignadoA2: '', asignadoA3: '', fuente: '', referidoPor: '', esComisionista: false, numeroEmpleados: '' });
    setShowForm(false);
    setEditingId(null);
    setShowNewServicio(false);
    setNewServicioName('');
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) { alert('Solo se permiten archivos de imagen'); return; }
      if (file.size > 5 * 1024 * 1024) { alert('La imagen no debe superar 5MB'); return; }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubiendoLogo(!!logoFile);
    let logoUrl = '';
    try {
      if (logoFile) {
        const timestamp = Date.now();
        const fileName = `pipeline/logos/${editingId || 'new'}_${timestamp}_${logoFile.name}`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, logoFile);
        logoUrl = await getDownloadURL(storageRef);
      }
    } catch (err) {
      console.error('Error al subir logo:', err);
    }
    setSubiendoLogo(false);

    const cuenta = (cuentas || []).find(c => c.id === form.clienteId || c.id === form.cuentaId);
    const empresaNombre = form.empresa || cuenta?.empresa || '';
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
      const itemActual = pipeline.find(p => p.id === editingId);
      const logoFinal = logoUrl || (logoPreview ? itemActual?.logoUrl || '' : '');
      setPipeline(pipeline.map(p => p.id === editingId ? { ...p, ...cleanForm, logoUrl: logoFinal, asignadoA: form.asignadoA || p.asignadoA || currentUser?.id } : p));
      addAuditLog('editar', 'pipeline', `Oportunidad editada: ${cleanForm.nombre}`, editingId, cleanForm.nombre);
    } else {
      const nuevoId = generateId();
      const nuevo = {
        ...cleanForm,
        logoUrl: logoUrl || '',
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
      asignadoA2: item.asignadoA2 || '',
      asignadoA3: item.asignadoA3 || '',
      fuente: item.fuente || '',
      referidoPor: item.referidoPor || '',
      esComisionista: item.esComisionista || false,
      numeroEmpleados: item.numeroEmpleados || ''
    });
    setEditingId(item.id);
    setLogoFile(null);
    setLogoPreview(item.logoUrl || null);
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

    // Validar transicion permitida (perdido siempre se permite)
    if (!esTransicionPermitida(etapaAnterior, nuevaEtapa)) {
      const etapaActualNombre = PIPELINE_STAGES.find(s => s.id === etapaAnterior)?.name || etapaAnterior;
      const nuevaEtapaNombre = PIPELINE_STAGES.find(s => s.id === nuevaEtapa)?.name || nuevaEtapa;
      alert(`No puedes mover directamente de "${etapaActualNombre}" a "${nuevaEtapaNombre}". Sigue el proceso del pipeline.`);
      return;
    }

    // Validar campos requeridos antes de avanzar
    const actividadesProspectoVal = actividades.filter(a => a.pipelineId === id);
    const validacion = validarTransicionEtapa(prospecto, nuevaEtapa, actividadesProspectoVal);
    if (!validacion.valido) {
      alert(`No se puede avanzar:\n${validacion.errores.join('\n')}\n\n${validacion.mensaje}`);
      return;
    }

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

    // Auto-crear tarea de seguimiento
    const tareaAuto = generarTareaSeguimiento(prospecto, nuevaEtapa, currentUser?.id);
    if (tareaAuto) {
      const nuevaTarea = { ...tareaAuto, id: generateId(), fechaCreacion: new Date().toISOString(), creadoPor: currentUser?.id };
      setTareas(prev => [...prev, nuevaTarea]);
      if (tareaAuto.responsableId) {
        addNotificacion(tareaAuto.responsableId, `Tarea automática: ${tareaAuto.descripcion}`, 'tarea', null, prospecto.empresa || prospecto.nombre);
      }
    }

    // Si pasa a "cerrado" (Cerrado Ganado), crear automáticamente una Cuenta + Contacto
    if (nuevaEtapa === 'cerrado') {
      if (prospecto) {
        // Verificar si ya existe una cuenta con esta empresa
        const yaExiste = (cuentas || []).some(c =>
          (prospecto.empresa && c.empresa === prospecto.empresa)
        );

        if (!yaExiste) {
          const nuevaCuentaId = generateId();
          const nuevaCuenta = {
            id: nuevaCuentaId,
            empresa: prospecto.empresa || prospecto.nombre || '',
            industria: '',
            servicio: prospecto.servicio || '',
            sitioWeb: prospecto.paginaWeb || '',
            direccion: '',
            numeroEmpleados: prospecto.numeroEmpleados || '',
            logoUrl: prospecto.logoUrl || '',
            tags: [],
            fuente: prospecto.fuente || '',
            referidoPor: prospecto.referidoPor || '',
            esComisionista: prospecto.esComisionista || false,
            notas: `Convertido desde Pipeline. ${prospecto.notas || ''}`.trim(),
            asignadoA: prospecto.asignadoA || currentUser?.id,
            asignadoA2: prospecto.asignadoA2 || '',
            asignadoA3: prospecto.asignadoA3 || '',
            fechaCreacion: new Date().toISOString(),
            creadoPor: prospecto.creadoPor || currentUser?.id,
            pipelineId: prospecto.id
          };
          setCuentas(prev => [...prev, nuevaCuenta]);

          const nuevoContactoId = generateId();
          const nuevoContacto = {
            id: nuevoContactoId,
            cuentaId: nuevaCuentaId,
            nombre: prospecto.contacto || '',
            cargo: prospecto.cargo || '',
            email: prospecto.email || '',
            telefono: prospecto.telefono || '',
            esPrincipal: true,
            notas: '',
            fechaCreacion: new Date().toISOString(),
            creadoPor: currentUser?.id
          };
          setContactos(prev => [...prev, nuevoContacto]);

          // Actualizar el pipeline item con cuentaId y contactoId
          setPipeline(prev => prev.map(p => p.id === id ? { ...p, cuentaId: nuevaCuentaId, contactoId: nuevoContactoId } : p));

          // Transferir actividades del pipeline al cliente (cuenta)
          const actividadesProspecto = actividades.filter(a => a.pipelineId === id);
          if (actividadesProspecto.length > 0) {
            setActividades(prev => prev.map(a =>
              a.pipelineId === id
                ? { ...a, clienteId: nuevaCuentaId, pipelineId: null, empresaNombre: nuevaCuenta.empresa }
                : a
            ));
          }

          // Transferir tareas del pipeline al cliente (cuenta)
          const tareasProspecto = tareas.filter(t => t.pipelineId === id);
          if (tareasProspecto.length > 0) {
            setTareas(prev => prev.map(t =>
              t.pipelineId === id
                ? { ...t, clienteId: nuevaCuentaId, pipelineId: null, empresaNombre: nuevaCuenta.empresa }
                : t
            ));
          }

          // Transferir recordatorios del pipeline al cliente (cuenta)
          const recordatoriosProspecto = recordatorios.filter(r => r.pipelineId === id);
          if (recordatoriosProspecto.length > 0) {
            setRecordatorios(prev => prev.map(r =>
              r.pipelineId === id
                ? { ...r, clienteId: nuevaCuentaId, pipelineId: null, empresaNombre: nuevaCuenta.empresa }
                : r
            ));
          }

          addAuditLog('crear', 'cuentas', `Cuenta creada desde Pipeline: ${nuevaCuenta.empresa} (${actividadesProspecto.length} actividades, ${tareasProspecto.length} tareas, ${recordatoriosProspecto.length} recordatorios transferidos)`, nuevaCuentaId, nuevaCuenta.empresa);
          addNotificacion(
            currentUser?.id,
            `Nueva cuenta creada: ${nuevaCuenta.empresa}`,
            'pipeline',
            null,
            'Cerrado Ganado'
          );
        }
      }
    }

    // Si sale de "cerrado" (Cerrado Ganado) a otra etapa, eliminar la cuenta creada automáticamente
    if (etapaAnterior === 'cerrado' && nuevaEtapa !== 'cerrado') {
      // Buscar cuenta que fue creada desde este prospecto
      const cuentaCreada = (cuentas || []).find(c => c.pipelineId === id);
      if (cuentaCreada) {
        if (window.confirm(`¿Eliminar también la cuenta "${cuentaCreada.empresa}" que fue creada automáticamente? Las actividades, tareas y recordatorios volverán al pipeline.`)) {
          // Devolver actividades al pipeline
          setActividades(prev => prev.map(a =>
            a.clienteId === cuentaCreada.id
              ? { ...a, pipelineId: id, clienteId: null }
              : a
          ));

          // Devolver tareas al pipeline
          setTareas(prev => prev.map(t =>
            t.clienteId === cuentaCreada.id
              ? { ...t, pipelineId: id, clienteId: null }
              : t
          ));

          // Devolver recordatorios al pipeline
          setRecordatorios(prev => prev.map(r =>
            r.clienteId === cuentaCreada.id
              ? { ...r, pipelineId: id, clienteId: null }
              : r
          ));

          // Eliminar contactos de esta cuenta
          setContactos(prev => prev.filter(c => c.cuentaId !== cuentaCreada.id));

          setCuentas(prev => prev.filter(c => c.id !== cuentaCreada.id));

          // Limpiar cuentaId/contactoId del pipeline item
          setPipeline(prev => prev.map(p => p.id === id ? { ...p, cuentaId: null, contactoId: null } : p));

          addAuditLog('eliminar', 'cuentas', `Cuenta eliminada al revertir etapa: ${cuentaCreada.empresa} (actividades, tareas y recordatorios devueltos al pipeline)`, cuentaCreada.id, cuentaCreada.empresa);
          addNotificacion(
            currentUser?.id,
            `Cuenta eliminada: ${cuentaCreada.empresa}`,
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

    setRecordatorioForm({ titulo: '', fecha: '', hora: '', descripcion: '', responsableId: '' });
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
      hora: recordatorio.hora || '',
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
      hora: tarea.hora || '',
      prioridad: tarea.prioridad || 'media',
      responsableId: tarea.responsableId || '',
      recurrencia: tarea.recurrencia || 'ninguna'
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
        recurrencia: tareaFormData.recurrencia || 'ninguna',
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

    setTareaFormData({ descripcion: '', fechaCompromiso: '', hora: '', prioridad: 'media', responsableId: '' });
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
        hora: tareaTemp.hora,
        prioridad: tareaTemp.prioridad,
        responsableId: tareaTemp.responsableId || currentUser?.id
      } : t));
      setEditandoTareaExistenteId(null);
    } else {
      // Nueva tarea
      setTareasNuevas([...tareasNuevas, { ...tareaTemp, id: generateId() }]);
    }
    setTareaTemp({ descripcion: '', fechaCompromiso: '', hora: '', prioridad: 'media', responsableId: '' });
    setMostrarFormTarea(false);
  };

  const editarTareaExistente = (tarea) => {
    setTareaTemp({
      descripcion: tarea.descripcion,
      fechaCompromiso: tarea.fechaCompromiso,
      hora: tarea.hora || '',
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
        hora: recordatorioTemp.hora,
        descripcion: recordatorioTemp.descripcion,
        responsableId: recordatorioTemp.responsableId || currentUser?.id
      } : r));
      setEditandoRecordatorioExistenteId(null);
    } else {
      // Nuevo recordatorio
      setRecordatoriosNuevos([...recordatoriosNuevos, { ...recordatorioTemp, id: generateId() }]);
    }
    setRecordatorioTemp({ titulo: '', fecha: '', hora: '', descripcion: '', responsableId: '' });
    setMostrarFormRecordatorioNuevo(false);
  };

  const editarRecordatorioExistente = (rec) => {
    setRecordatorioTemp({
      titulo: rec.titulo,
      fecha: rec.fecha,
      hora: rec.hora || '',
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
    const cuenta = (cuentas || []).find(c => c.id === prospecto?.clienteId || c.id === prospecto?.cuentaId);
    const contacto = (contactos || []).find(c => c.id === prospecto?.contactoId);
    const stage = PIPELINE_STAGES.find(s => s.id === prospecto?.etapa);
    const timeline = getTimeline(selectedProspecto);
    const detailDealScore = calcularDealScore(prospecto, actividades);
    const detailTareas = (tareas || []).filter(t => t.pipelineId === selectedProspecto);
    const detailSugerencia = getSugerenciaAccion(prospecto, actividades, detailTareas);
    const DetailSugIcon = ICON_MAP[detailSugerencia?.icono] || Zap;

    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => { setSelectedProspecto(null); setActiveTab('info'); }} className="p-2 hover:bg-slate-800 rounded-xl transition-all">
              <X size={24} className="text-slate-400" />
            </button>
            {/* Deal Score circle */}
            <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg shadow-lg"
                style={{ backgroundColor: `${getScoreHex(detailDealScore.color)}20`, color: getScoreHex(detailDealScore.color), border: `2px solid ${getScoreHex(detailDealScore.color)}40` }}
              >
                {detailDealScore.score}
              </div>
              <span className="text-xs font-semibold" style={{ color: getScoreHex(detailDealScore.color) }}>{detailDealScore.nivel}</span>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-white">{prospecto?.nombre}</h1>
                <span className={`px-3 py-1.5 rounded-full text-sm text-white ${stage?.bg}`}>{stage?.name}</span>
              </div>
              <p className="text-slate-400">{prospecto?.empresa}</p>
              {(() => {
                const lastContact = getLastContactInfo(selectedProspecto, actividades, 'pipelineId');
                return <p className={`text-xs mt-1 ${lastContact.color}`}>Ultimo contacto: {lastContact.texto}</p>;
              })()}
            </div>
          </div>
          {puedeEditarProspecto(prospecto) && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowActividadForm(true)} className="flex items-center gap-2 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-400 px-4 py-2 rounded-xl transition-all">
                <Plus size={16} /> Actividad
              </button>
              <button onClick={() => setShowRecordatorioForm(true)} className="flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 px-4 py-2 rounded-xl transition-all">
                <Bell size={16} /> Recordatorio
              </button>
            </div>
          )}
        </div>

        {/* Sugerencia IA */}
        {detailSugerencia && detailSugerencia.accion && (
          <div
            className="flex items-center gap-3 p-4 rounded-xl"
            style={{ backgroundColor: `${getScoreHex(detailSugerencia.color)}10`, border: `1px solid ${getScoreHex(detailSugerencia.color)}30` }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${getScoreHex(detailSugerencia.color)}20` }}
            >
              <DetailSugIcon size={20} style={{ color: getScoreHex(detailSugerencia.color) }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <Lightbulb size={14} className="text-amber-400" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sugerencia IA</span>
              </div>
              <p className="text-white font-medium text-sm">{detailSugerencia.accion}</p>
              {detailSugerencia.descripcion && (
                <p className="text-slate-400 text-xs mt-0.5">{detailSugerencia.descripcion}</p>
              )}
            </div>
            {puedeEditarProspecto(prospecto) && detailSugerencia.accion?.toLowerCase().includes('llamada') && (
              <button
                onClick={() => { setActividadForm({ tipo: 'llamada', titulo: detailSugerencia.accion, descripcion: detailSugerencia.descripcion || '', fecha: getFechaLocal(), responsableId: '' }); setEditingActividad(null); setTareasNuevas([]); setRecordatoriosNuevos([]); setActividadArchivo(null); setShowActividadForm(true); }}
                className="px-3 py-1.5 bg-violet-500/20 text-violet-400 border border-violet-500/30 rounded-lg text-xs hover:bg-violet-500/30 transition-all flex-shrink-0"
              >
                Crear actividad
              </button>
            )}
            {puedeEditarProspecto(prospecto) && detailSugerencia.accion?.toLowerCase().includes('contacto') && !detailSugerencia.accion?.toLowerCase().includes('llamada') && (
              <button
                onClick={() => { setActividadForm({ tipo: 'llamada', titulo: detailSugerencia.accion, descripcion: detailSugerencia.descripcion || '', fecha: getFechaLocal(), responsableId: '' }); setEditingActividad(null); setTareasNuevas([]); setRecordatoriosNuevos([]); setActividadArchivo(null); setShowActividadForm(true); }}
                className="px-3 py-1.5 bg-violet-500/20 text-violet-400 border border-violet-500/30 rounded-lg text-xs hover:bg-violet-500/30 transition-all flex-shrink-0"
              >
                Crear actividad
              </button>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
          {[
            { id: 'info', name: 'Información', icon: GitBranch },
            { id: 'actividades', name: 'Actividades', icon: PhoneCall, count: actividadesProspecto.length },
            { id: 'tareas', name: 'Tareas', icon: Target, count: tareasProspecto.filter(t => !t.completada).length },
            { id: 'recordatorios', name: 'Recordatorios', icon: Bell, count: recordatoriosProspecto.filter(r => !r.completado).length },
            { id: 'timeline', name: 'Timeline', icon: History, count: timeline.length }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-2xl transition-all ${activeTab === tab.id ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-lg shadow-cyan-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                <Icon size={16} /> {tab.name}
                {tab.count > 0 && <span className="bg-slate-700 text-xs px-2 py-0.5 rounded-full">{tab.count}</span>}
              </button>
            );
          })}
        </div>

        {/* Form Actividad */}
        {showActividadForm && (
          <div className="bg-indigo-900/15 border border-indigo-500/20 rounded-2xl p-3 sm:p-4 md:p-5">
            <h3 className="text-lg font-semibold text-white mb-4">{editingActividad ? 'Editar Actividad' : 'Nueva Actividad'}</h3>
            <form onSubmit={handleAddActividad} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <select value={actividadForm.tipo} onChange={(e) => setActividadForm({ ...actividadForm, tipo: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white">
                  {TIPOS_ACTIVIDAD.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input type="date" value={actividadForm.fecha} onChange={(e) => setActividadForm({ ...actividadForm, fecha: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white" />
                <input type="text" placeholder="Título *" value={actividadForm.titulo} onChange={(e) => setActividadForm({ ...actividadForm, titulo: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500" required />
                <select value={actividadForm.responsableId} onChange={(e) => setActividadForm({ ...actividadForm, responsableId: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white">
                  <option value="">Asignar a... (yo mismo)</option>
                  {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.id === currentUser?.id ? '(yo)' : ''}</option>)}
                </select>
                <textarea placeholder="Descripción" value={actividadForm.descripcion} onChange={(e) => setActividadForm({ ...actividadForm, descripcion: e.target.value })} className="sm:col-span-2 px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 resize-none" rows="2"></textarea>
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 text-sm mb-2">Adjuntar archivo (opcional)</label>
                  <div className="border-2 border-dashed border-slate-300/40 rounded-xl p-4 text-center hover:border-violet-500/50 transition-all">
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
              <div className="border-t border-slate-300/30 pt-4 mt-4">
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
                              <div key={t.id} className={`flex items-center justify-between rounded-lg p-3 ${t.completada ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-700/50 border border-slate-300/40'}`}>
                                <div className="flex items-center gap-3">
                                  <button type="button" onClick={() => { const { newTareas } = completarTareaConRecurrencia(tareas, t.id, generateId); setTareas(newTareas); }} className="flex-shrink-0">
                                    {t.completada ? <CheckCircle size={16} className="text-emerald-400" /> : <Clock size={16} className="text-slate-400 hover:text-cyan-400" />}
                                  </button>
                                  <div>
                                    <p className={`text-sm ${t.completada ? 'text-emerald-300 line-through' : 'text-white'}`}>{t.descripcion}</p>
                                    <p className="text-slate-500 text-xs">{formatDate(t.fechaCompromiso)}{t.hora ? ` ${t.hora}` : ''} · {t.prioridad} · {respTarea?.nombre || 'Sin asignar'}</p>
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
                    <div className="bg-slate-800/50 rounded-2xl p-4 mb-3 space-y-3">
                      <input type="text" placeholder="Descripción de la tarea *" value={tareaTemp.descripcion} onChange={(e) => setTareaTemp({ ...tareaTemp, descripcion: e.target.value })} className="w-full px-3 py-3 bg-slate-700 border border-slate-300/40 rounded-2xl text-white text-sm placeholder-slate-500" />
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                        <input type="date" value={tareaTemp.fechaCompromiso} onChange={(e) => setTareaTemp({ ...tareaTemp, fechaCompromiso: e.target.value })} className="px-3 py-3 bg-slate-700 border border-slate-300/40 rounded-2xl text-white text-sm" />
                        <input type="time" value={tareaTemp.hora} onChange={(e) => setTareaTemp({ ...tareaTemp, hora: e.target.value })} className="px-3 py-3 bg-slate-700 border border-slate-300/40 rounded-2xl text-white text-sm" />
                        <select value={tareaTemp.prioridad} onChange={(e) => setTareaTemp({ ...tareaTemp, prioridad: e.target.value })} className="px-3 py-3 bg-slate-700 border border-slate-300/40 rounded-2xl text-white text-sm">
                          <option value="baja">Baja</option>
                          <option value="media">Media</option>
                          <option value="alta">Alta</option>
                        </select>
                        <select value={tareaTemp.recurrencia || 'ninguna'} onChange={(e) => setTareaTemp({ ...tareaTemp, recurrencia: e.target.value })} className="px-3 py-3 bg-slate-700 border border-slate-300/40 rounded-2xl text-white text-sm">
                          {RECURRENCIA_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                        </select>
                        <select value={tareaTemp.responsableId} onChange={(e) => setTareaTemp({ ...tareaTemp, responsableId: e.target.value })} className="px-3 py-3 bg-slate-700 border border-slate-300/40 rounded-2xl text-white text-sm">
                          <option value="">Yo mismo</option>
                          {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={agregarTareaTemp} className="text-xs px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-all">
                          {editandoTareaExistenteId ? 'Guardar cambios' : 'Agregar a la lista'}
                        </button>
                        {editandoTareaExistenteId && (
                          <button type="button" onClick={() => { setEditandoTareaExistenteId(null); setTareaTemp({ descripcion: '', fechaCompromiso: '', hora: '', prioridad: 'media', responsableId: '' }); setMostrarFormTarea(false); }} className="text-xs px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-all">Cancelar</button>
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
                              <p className="text-slate-500 text-xs">{formatDate(t.fechaCompromiso)}{t.hora ? ` ${t.hora}` : ''} · {t.prioridad}</p>
                            </div>
                          </div>
                          <button type="button" onClick={() => eliminarTareaTemp(t.id)} className="p-1 text-red-400 hover:bg-red-500/20 rounded"><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sección de Recordatorios */}
                  <div className="border-t border-slate-300/30 pt-4 mt-4">
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
                                <div key={r.id} className={`flex items-center justify-between rounded-lg p-3 ${r.completado ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-700/50 border border-slate-300/40'}`}>
                                  <div className="flex items-center gap-3">
                                    <button type="button" onClick={() => setRecordatorios(recordatorios.map(re => re.id === r.id ? { ...re, completado: !re.completado } : re))} className="flex-shrink-0">
                                      {r.completado ? <CheckCircle size={16} className="text-emerald-400" /> : <Bell size={16} className="text-amber-400 hover:text-amber-300" />}
                                    </button>
                                    <div>
                                      <p className={`text-sm ${r.completado ? 'text-emerald-300 line-through' : 'text-white'}`}>{r.titulo}</p>
                                      <p className="text-slate-500 text-xs">{formatDate(r.fecha)}{r.hora ? ` ${r.hora}` : ''} · {respRec?.nombre || 'Sin asignar'}</p>
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
                      <div className="bg-slate-800/50 rounded-2xl p-4 mb-3 space-y-3">
                        <input type="text" placeholder="Título del recordatorio *" value={recordatorioTemp.titulo} onChange={(e) => setRecordatorioTemp({ ...recordatorioTemp, titulo: e.target.value })} className="w-full px-3 py-3 bg-slate-700 border border-slate-300/40 rounded-2xl text-white text-sm placeholder-slate-500" />
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input type="date" value={recordatorioTemp.fecha} onChange={(e) => setRecordatorioTemp({ ...recordatorioTemp, fecha: e.target.value })} className="px-3 py-3 bg-slate-700 border border-slate-300/40 rounded-2xl text-white text-sm" />
                          <input type="time" value={recordatorioTemp.hora} onChange={(e) => setRecordatorioTemp({ ...recordatorioTemp, hora: e.target.value })} className="px-3 py-3 bg-slate-700 border border-slate-300/40 rounded-2xl text-white text-sm" />
                          <select value={recordatorioTemp.responsableId} onChange={(e) => setRecordatorioTemp({ ...recordatorioTemp, responsableId: e.target.value })} className="px-3 py-3 bg-slate-700 border border-slate-300/40 rounded-2xl text-white text-sm">
                            <option value="">Yo mismo</option>
                            {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                          </select>
                        </div>
                        <input type="text" placeholder="Descripción (opcional)" value={recordatorioTemp.descripcion} onChange={(e) => setRecordatorioTemp({ ...recordatorioTemp, descripcion: e.target.value })} className="w-full px-3 py-3 bg-slate-700 border border-slate-300/40 rounded-2xl text-white text-sm placeholder-slate-500" />
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={agregarRecordatorioTemp} className="text-xs px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all">
                            {editandoRecordatorioExistenteId ? 'Guardar cambios' : 'Agregar a la lista'}
                          </button>
                          {editandoRecordatorioExistenteId && (
                            <button type="button" onClick={() => { setEditandoRecordatorioExistenteId(null); setRecordatorioTemp({ titulo: '', fecha: '', hora: '', descripcion: '', responsableId: '' }); setMostrarFormRecordatorioNuevo(false); }} className="text-xs px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-all">Cancelar</button>
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
                                <p className="text-slate-500 text-xs">{formatDate(r.fecha)}{r.hora ? ` ${r.hora}` : ''}</p>
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
                <button type="submit" disabled={subiendoActividad} className="flex items-center gap-2 bg-violet-500 text-white px-5 py-3 rounded-2xl hover:bg-violet-600 transition-all disabled:opacity-50 font-semibold shadow-lg shadow-violet-500/30">
                  {subiendoActividad ? <Loader size={18} className="animate-spin" /> : <Save size={18} />} {subiendoActividad ? 'Guardando...' : editingActividad ? 'Guardar Cambios' : 'Guardar'}
                </button>
                <button type="button" onClick={() => { setShowActividadForm(false); setActividadArchivo(null); setEditingActividad(null); setTareasNuevas([]); setRecordatoriosNuevos([]); }} className="flex items-center gap-2 bg-slate-700/50 border border-slate-600/50 text-white hover:bg-slate-600/50 px-5 py-3 rounded-2xl transition-all"><X size={18} /> Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* Modal Ver Detalle de Actividad */}
        {viewingActividad && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setViewingActividad(null)}>
            <div className="bg-slate-900 rounded-3xl border border-slate-300/40 w-[calc(100%-16px)] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-modal-in shadow-2xl shadow-black/40 mx-2 sm:mx-4" onClick={(e) => e.stopPropagation()}>
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
                    <div className={`${tipo?.color} p-4 sm:p-6 md:p-8 rounded-t-3xl`}>
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
                    <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
                      {/* Información Principal */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-slate-800/50 rounded-2xl p-5">
                          <p className="text-slate-500 text-xs mb-1">Fecha</p>
                          <p className="text-white font-medium">{formatDate(viewingActividad.fecha)}</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-2xl p-5">
                          <p className="text-slate-500 text-xs mb-1">Responsable</p>
                          <p className={`font-medium ${responsable?.nombre ? getColorUsuario(responsable.nombre) : 'text-white'}`}>{responsable?.nombre || 'No asignado'}</p>
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
                        <div className="bg-slate-800/50 rounded-2xl p-5">
                          <p className="text-slate-500 text-xs mb-2">Descripción / Resumen</p>
                          <p className="text-white whitespace-pre-wrap">{viewingActividad.descripcion}</p>
                        </div>
                      )}

                      {/* Archivo adjunto */}
                      {viewingActividad.archivo && (
                        <div className="bg-slate-800/50 rounded-2xl p-5">
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
                        <div className="bg-slate-800/50 rounded-2xl p-4">
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
                                      <p className="text-slate-500 text-xs">{formatDate(t.fechaCompromiso)}{t.hora ? ` ${t.hora}` : ''} · {respTarea?.nombre || 'Sin asignar'}</p>
                                    </div>
                                  </div>
                                  <span className={`text-xs px-3 py-1.5 rounded-full ${t.prioridad === 'alta' ? 'bg-red-500/30 text-red-300' : t.prioridad === 'media' ? 'bg-amber-500/35 text-amber-300' : 'bg-indigo-500/30 text-indigo-300'}`}>
                                    {t.prioridad}
                                  </span>
                                  {t.recurrencia && t.recurrencia !== 'ninguna' && (
                                    <span className="text-xs text-cyan-400">&#8635;</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Recordatorios derivados */}
                      {recordatoriosDerivados.length > 0 && (
                        <div className="bg-slate-800/50 rounded-2xl p-4">
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
                                      <p className="text-slate-500 text-xs">{formatDate(r.fecha)}{r.hora ? ` ${r.hora}` : ''} · {respRec?.nombre || 'Sin asignar'}</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="border-t border-slate-300/30 pt-4 flex items-center justify-between text-xs text-slate-500">
                        <span>Creado por: {creador?.nombre || 'Sistema'}</span>
                        <span>Fecha creación: {viewingActividad.fechaCreacion ? new Date(viewingActividad.fechaCreacion).toLocaleString('es-MX') : '-'}</span>
                      </div>

                      {/* Acciones */}
                      <div className="flex gap-3">
                        {puedeEditarActividad(viewingActividad) && (
                          <button onClick={() => { handleEditActividad(viewingActividad); setViewingActividad(null); }} className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-xl hover:bg-cyan-500/30 transition-all">
                            <Edit size={16} /> Editar
                          </button>
                        )}
                        {puedeEliminarActividad(viewingActividad) && (
                          <button onClick={() => { handleDeleteActividad(viewingActividad.id); setViewingActividad(null); }} className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-all">
                            <Trash2 size={16} /> Eliminar
                          </button>
                        )}
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
          <div className="bg-amber-900/15 border border-amber-500/20 rounded-2xl p-3 sm:p-4 md:p-5">
            <h3 className="text-lg font-semibold text-white mb-4">{editingRecordatorio ? 'Editar Recordatorio' : 'Nuevo Recordatorio'}</h3>
            <form onSubmit={handleAddRecordatorio} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input type="text" placeholder="Título *" value={recordatorioForm.titulo} onChange={(e) => setRecordatorioForm({ ...recordatorioForm, titulo: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500" required />
              <input type="date" value={recordatorioForm.fecha} onChange={(e) => setRecordatorioForm({ ...recordatorioForm, fecha: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white" required />
              <input type="time" value={recordatorioForm.hora} onChange={(e) => setRecordatorioForm({ ...recordatorioForm, hora: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white" />
              <select value={recordatorioForm.responsableId} onChange={(e) => setRecordatorioForm({ ...recordatorioForm, responsableId: e.target.value })} className="sm:col-span-2 px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white">
                <option value="">Asignar a... (yo mismo)</option>
                {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.id === currentUser?.id ? '(yo)' : ''}</option>)}
              </select>
              <textarea placeholder="Descripción" value={recordatorioForm.descripcion} onChange={(e) => setRecordatorioForm({ ...recordatorioForm, descripcion: e.target.value })} className="sm:col-span-2 px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 resize-none" rows="2"></textarea>
              <div className="sm:col-span-2 flex gap-3">
                <button type="submit" className="flex items-center gap-2 bg-amber-500 text-white px-5 py-3 rounded-2xl hover:bg-amber-600 transition-all font-semibold shadow-lg shadow-amber-500/30"><Save size={18} /> {editingRecordatorio ? 'Guardar Cambios' : 'Guardar'}</button>
                <button type="button" onClick={() => { setShowRecordatorioForm(false); setEditingRecordatorio(null); }} className="flex items-center gap-2 bg-slate-700/50 border border-slate-600/50 text-white hover:bg-slate-600/50 px-5 py-3 rounded-2xl transition-all"><X size={18} /> Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* Tab: Info */}
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-5 md:p-6 border border-white/[0.08]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Información del Proyecto</h3>
                {puedeEditarProspecto(prospecto) && (
                  <button onClick={() => handleEdit(prospecto)} className="p-2 hover:bg-slate-700 rounded-lg transition-all text-slate-400 hover:text-cyan-400" title="Editar proyecto">
                    <Edit size={18} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><p className="text-slate-500 text-sm">Proyecto</p><p className="text-white">{prospecto?.nombre}</p></div>
                <div><p className="text-slate-500 text-sm">Cliente/Empresa</p><p className="text-cyan-400">{prospecto?.empresa}</p></div>
                <div><p className="text-slate-500 text-sm">Contacto</p><p className="text-white">{prospecto?.contacto || '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Email</p><p className="text-white">{prospecto?.email || '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Teléfono</p><p className="text-white flex items-center gap-2">{prospecto?.telefono || '-'}{prospecto?.telefono && (<span className="flex items-center gap-1 ml-1"><a href={getWhatsAppLink(prospecto.telefono)} target="_blank" rel="noopener noreferrer" className="p-1 rounded-lg hover:bg-green-500/20 text-green-400 transition-all" title="WhatsApp"><MessageSquare size={14} /></a><a href={getCallLink(prospecto.telefono)} className="p-1 rounded-lg hover:bg-cyan-500/20 text-cyan-400 transition-all" title="Llamar"><Phone size={14} /></a></span>)}</p></div>
                <div><p className="text-slate-500 text-sm">Página Web</p><p className="text-cyan-400">{prospecto?.paginaWeb ? (<a href={prospecto.paginaWeb.startsWith('http') ? prospecto.paginaWeb : `https://${prospecto.paginaWeb}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{prospecto.paginaWeb}</a>) : '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Etapa</p><p className={`inline-block px-3 py-1.5 rounded-full text-sm text-white ${stage?.bg}`}>{stage?.name}</p></div>
                <div><p className="text-slate-500 text-sm">Valor Estimado</p><p className="text-emerald-400 font-semibold">{prospecto?.valorEstimado ? `$${parseFloat(prospecto.valorEstimado).toLocaleString('es-MX')}/año` : '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Servicio</p><p className="text-cyan-400">{prospecto?.servicio || '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Fuente</p><p className="text-white">{prospecto?.fuente || '-'}</p></div>
                {prospecto?.fuente === 'Referido' && prospecto?.referidoPor && (
                  <div className="col-span-2"><p className="text-slate-500 text-sm">Referido por</p><p className="text-white flex items-center gap-2"><User size={16} className="text-violet-400" />{prospecto.referidoPor}{prospecto.esComisionista && <span className="ml-2 px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">Comisionista</span>}</p></div>
                )}
                <div><p className="text-slate-500 text-sm">Responsable</p>{(() => {
                  const ids = [prospecto?.asignadoA, prospecto?.asignadoA2, prospecto?.asignadoA3].filter(Boolean);
                  if (ids.length === 0 && prospecto?.creadoPor) ids.push(prospecto.creadoPor);
                  const usrs = ids.map(id => usuarios.find(u => u.id === id)).filter(Boolean);
                  return usrs.length > 0 ? <div className="flex items-center gap-2 font-medium">{usrs.map((u, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {u.fotoUrl ? <img src={u.fotoUrl} alt={u.nombre} className="w-6 h-6 rounded-full object-cover inline-block" /> : null}
                      <span className={getColorUsuario(u.nombre)}>{u.nombre}</span>
                      {i < usrs.length - 1 ? ', ' : ''}
                    </span>
                  ))}</div> : <p className="text-white font-medium">-</p>;
                })()}</div>
                <div><p className="text-slate-500 text-sm">Fecha Seguimiento</p><p className="text-white">{prospecto?.fechaSeguimiento ? formatDate(prospecto.fechaSeguimiento) : '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Fecha Creación</p><p className="text-white">{formatDate(prospecto?.fechaCreacion)}</p></div>
                {cuenta && (
                  <div className="col-span-2"><p className="text-slate-500 text-sm">Cuenta vinculada</p><p className="text-cyan-400 flex items-center gap-2"><Building size={16} className="text-cyan-400" />{cuenta.empresa}<span className="ml-2 px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded-full">Cuenta</span></p></div>
                )}
                {contacto && (
                  <div className="col-span-2"><p className="text-slate-500 text-sm">Contacto principal</p><p className="text-white flex items-center gap-2"><User size={16} className="text-violet-400" />{contacto.nombre}{contacto.cargo && <span className="text-slate-500 text-sm">({contacto.cargo})</span>}</p></div>
                )}
              </div>
              {prospecto?.notas && (<div className="mt-4 pt-4 border-t border-slate-800"><p className="text-slate-500 text-sm mb-1">Notas</p><p className="text-slate-300">{prospecto.notas}</p></div>)}
              {prospecto?.notaRapida && (<div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl"><p className="text-slate-500 text-xs mb-1">Nota Rápida</p><p className="text-amber-200">{prospecto.notaRapida}</p></div>)}
            </div>
            <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-5 md:p-6 border border-white/[0.08]">
              <h3 className="text-lg font-semibold text-white mb-4">Acciones</h3>
              <div className="space-y-3">
                {(prospecto?.telefono || contacto?.telefono) && (
                  <>
                    <a href={getWhatsAppLink(prospecto?.telefono || contacto?.telefono)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-xl text-green-400 transition-all"><MessageSquare size={18} /> WhatsApp</a>
                    <a href={getCallLink(prospecto?.telefono || contacto?.telefono)} className="flex items-center gap-3 p-3 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400 transition-all"><Phone size={18} /> Llamar</a>
                  </>
                )}
                {(prospecto?.email || contacto?.email) && (<button onClick={() => { setEmailDestinatario({ nombre: prospecto?.contacto || contacto?.nombre || prospecto?.empresa, email: prospecto?.email || contacto?.email, pipelineId: prospecto?.id }); setEmailModalOpen(true); }} className="w-full flex items-center gap-3 p-3 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400 transition-all"><Mail size={18} /> Enviar Email</button>)}
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
          <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-6 border border-white/[0.08]">
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
              <>
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
                            {puedeEditarActividad(a) && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); handleEditActividad(a); }} className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 rounded-lg transition-all"><Edit size={14} /></button>
                              {puedeEliminarActividad(a) && <button onClick={(e) => { e.stopPropagation(); handleDeleteActividad(a.id); }} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-all"><Trash2 size={14} /></button>}
                            </div>
                            )}
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
              </>
            )}
          </div>
        )}

        {/* Tab: Timeline */}
        {activeTab === 'timeline' && (
          <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-6 border border-white/[0.08]">
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
                          <div className="flex-1 bg-slate-800/50 rounded-2xl p-4">
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
          <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-5 md:p-6 border border-white/[0.08]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Tareas y Compromisos</h3>
              <button
                onClick={() => {
                  setTareaFormData({ descripcion: '', fechaCompromiso: getFechaLocal(), hora: '', prioridad: 'media', responsableId: '' });
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
              <div className="bg-teal-900/15 border border-teal-500/20 rounded-2xl p-3 sm:p-4 md:p-5 mb-4">
                <h3 className="text-lg font-semibold text-white mb-4">{editingTarea ? 'Editar Tarea' : 'Nueva Tarea'}</h3>
                <form onSubmit={handleAddTareaForm} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input type="text" placeholder="Descripción de la tarea *" value={tareaFormData.descripcion} onChange={(e) => setTareaFormData({ ...tareaFormData, descripcion: e.target.value })} className="sm:col-span-2 px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500" required />
                  <input type="date" value={tareaFormData.fechaCompromiso} onChange={(e) => setTareaFormData({ ...tareaFormData, fechaCompromiso: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white" required />
                  <input type="time" value={tareaFormData.hora} onChange={(e) => setTareaFormData({ ...tareaFormData, hora: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white" />
                  <select value={tareaFormData.prioridad} onChange={(e) => setTareaFormData({ ...tareaFormData, prioridad: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white">
                    <option value="baja">Prioridad Baja</option>
                    <option value="media">Prioridad Media</option>
                    <option value="alta">Prioridad Alta</option>
                  </select>
                  <select value={tareaFormData.recurrencia || 'ninguna'} onChange={(e) => setTareaFormData({ ...tareaFormData, recurrencia: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white">
                    {RECURRENCIA_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                  </select>
                  <select value={tareaFormData.responsableId} onChange={(e) => setTareaFormData({ ...tareaFormData, responsableId: e.target.value })} className="sm:col-span-2 px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white">
                    <option value="">Asignar a... (yo mismo)</option>
                    {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.id === currentUser?.id ? '(yo)' : ''}</option>)}
                  </select>
                  <div className="sm:col-span-2 flex gap-3">
                    <button type="submit" className="flex items-center gap-2 bg-cyan-500 text-white px-5 py-3 rounded-2xl hover:bg-cyan-600 transition-all font-semibold shadow-lg shadow-cyan-500/30"><Save size={18} /> {editingTarea ? 'Guardar Cambios' : 'Guardar'}</button>
                    <button type="button" onClick={() => { setShowTareaForm(false); setEditingTarea(null); }} className="flex items-center gap-2 bg-slate-700/50 border border-slate-600/50 text-white hover:bg-slate-600/50 px-5 py-3 rounded-2xl transition-all"><X size={18} /> Cancelar</button>
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
                        onClick={() => { const { newTareas } = completarTareaConRecurrencia(tareas, tarea.id, generateId); setTareas(newTareas); }}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${tarea.completada ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300/40 hover:border-emerald-500'}`}
                      >
                        {tarea.completada && <CheckCircle size={14} className="text-white" />}
                      </button>
                      <div className="flex-1">
                        <p className={`font-medium ${tarea.completada ? 'text-slate-500 line-through' : 'text-white'}`}>{tarea.descripcion}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className={`text-xs flex items-center gap-1 ${vencida ? 'text-red-400' : esHoy ? 'text-amber-400' : 'text-slate-400'}`}>
                            <Clock size={12} /> Compromiso: {esHoy ? 'Hoy' : vencida ? `Vencida (${formatDate(tarea.fechaCompromiso)})` : formatDate(tarea.fechaCompromiso)}{tarea.hora ? ` ${tarea.hora}` : ''}
                          </span>
                          <span className={`text-xs px-3 py-1.5 rounded-full ${tarea.prioridad === 'alta' ? 'bg-red-500/30 text-red-300' : tarea.prioridad === 'media' ? 'bg-amber-500/35 text-amber-300' : 'bg-indigo-500/30 text-indigo-300'}`}>
                            {tarea.prioridad}
                          </span>
                          {tarea.recurrencia && tarea.recurrencia !== 'ninguna' && (
                            <span className="text-xs text-cyan-400">&#8635;</span>
                          )}
                          {responsable && <span className={`text-xs font-medium ${getColorUsuario(responsable.nombre)}`}>{responsable.nombre}</span>}
                        </div>
                        {tarea.fechaCreacion && <p className="text-xs text-slate-500 mt-1">Creada: {new Date(tarea.fechaCreacion).toLocaleDateString('es-MX')}</p>}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => abrirGoogleCalendar({ titulo: tarea.descripcion, descripcion: `Tarea CRM — ${selectedProspecto?.empresa || ''}`, fecha: tarea.fechaCompromiso, hora: tarea.hora, userEmail: currentUser?.googleEmail || currentUser?.email })} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-lg transition-all" title="Agregar a Google Calendar"><Calendar size={14} /></button>
                        {puedeEditarTarea(tarea) && <button onClick={() => handleEditTarea(tarea)} className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 rounded-lg transition-all"><Edit size={14} /></button>}
                        {puedeEliminarTarea(tarea) && <button onClick={() => handleDeleteTarea(tarea.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-all"><Trash2 size={14} /></button>}
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
          <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-6 border border-white/[0.08]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Recordatorios</h3>
              {puedeEditarProspecto(prospecto) && (
                <button
                  onClick={() => { setEditingRecordatorio(null); setRecordatorioForm({ titulo: '', fecha: '', hora: '', descripcion: '', responsableId: '' }); setShowRecordatorioForm(true); }}
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
                      <button onClick={() => setRecordatorios(recordatorios.map(rec => rec.id === r.id ? { ...rec, completado: !rec.completado } : rec))} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${r.completado ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300/40 hover:border-emerald-500'}`}>
                        {r.completado && <CheckCircle size={14} className="text-white" />}
                      </button>
                      <div className="flex-1">
                        <p className={`font-medium ${r.completado ? 'text-slate-500 line-through' : 'text-white'}`}>{r.titulo}</p>
                        {r.descripcion && <p className="text-slate-400 text-sm">{r.descripcion}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`text-sm ${vencido ? 'text-red-400' : esHoy ? 'text-amber-400' : 'text-slate-400'}`}>{formatDate(r.fecha)}{r.hora ? ` ${r.hora}` : ''}</p>
                          {vencido && <span className="text-xs text-red-400">Vencido</span>}
                          {esHoy && !r.completado && <span className="text-xs text-amber-400">Hoy</span>}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => abrirGoogleCalendar({ titulo: r.titulo, descripcion: `Recordatorio CRM — ${selectedProspecto?.empresa || ''}${r.descripcion ? '\n' + r.descripcion : ''}`, fecha: r.fecha, hora: r.hora, userEmail: currentUser?.googleEmail || currentUser?.email })} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-lg transition-all" title="Agregar a Google Calendar"><Calendar size={14} /></button>
                          {puedeEditarRecordatorio(r) && <button onClick={() => handleEditRecordatorio(r)} className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 rounded-lg transition-all"><Edit size={14} /></button>}
                          {puedeEliminarRecordatorio(r) && <button onClick={() => handleDeleteRecordatorio(r.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-all"><Trash2 size={14} /></button>}
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white mb-2">Pipeline</h1>
          <p className="text-slate-400">{pipelineFiltrado.length} oportunidades{filterConditions.length > 0 ? ` (${pipeline.length} total)` : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-300/40">
            <button
              onClick={() => setVistaActual('kanban')}
              className={`flex items-center gap-2 px-3 py-2 rounded-2xl text-sm font-medium transition-all ${vistaActual === 'kanban' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-lg shadow-cyan-500/30' : 'text-slate-400 hover:text-white'}`}
            >
              <LayoutGrid size={16} /> Kanban
            </button>
            <button
              onClick={() => setVistaActual('tabla')}
              className={`flex items-center gap-2 px-3 py-2 rounded-2xl text-sm font-medium transition-all ${vistaActual === 'tabla' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-lg shadow-cyan-500/30' : 'text-slate-400 hover:text-white'}`}
            >
              <Table2 size={16} /> Tabla
            </button>
          </div>
          {puedeCrear && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white px-5 py-3 rounded-2xl hover:opacity-90 transition-all font-semibold shadow-lg shadow-cyan-500/30"
            >
              <Plus size={20} /> Nueva Oportunidad
            </button>
          )}
        </div>
      </div>

      {/* Hero Metrics */}
      {(() => {
        const enPipeline = pipeline.filter(p => p.etapa !== 'cerrado' && p.etapa !== 'perdido');
        const totalEnPipeline = enPipeline.length;
        const valorTotal = enPipeline.reduce((sum, p) => sum + (parseFloat(p.valorEstimado) || 0), 0);
        const porCerrar = pipeline.filter(p => p.etapa === 'negociacion').length;
        const cerrados = pipeline.filter(p => p.etapa === 'cerrado').length;
        const tasaConversion = pipeline.length > 0 ? Math.round((cerrados / pipeline.length) * 100) : 0;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            <div className="bg-slate-800/50 rounded-2xl border border-slate-300/40 p-3 sm:p-4 md:p-6 text-center">
              <div className="text-xl sm:text-2xl md:text-3xl font-black text-white">{totalEnPipeline}</div>
              <div className="text-xs text-slate-400 uppercase mt-1">Total en pipeline</div>
            </div>
            <div className="bg-slate-800/50 rounded-2xl border border-slate-300/40 p-3 sm:p-4 md:p-6 text-center">
              <div className="text-xl sm:text-2xl md:text-3xl font-black text-white">${valorTotal.toLocaleString('es-MX')}</div>
              <div className="text-xs text-slate-400 uppercase mt-1">Valor total USD</div>
            </div>
            <div className="bg-slate-800/50 rounded-2xl border border-slate-300/40 p-3 sm:p-4 md:p-6 text-center">
              <div className="text-xl sm:text-2xl md:text-3xl font-black text-white">{porCerrar}</div>
              <div className="text-xs text-slate-400 uppercase mt-1">Por cerrar (negociacion)</div>
            </div>
            <div className="bg-slate-800/50 rounded-2xl border border-slate-300/40 p-3 sm:p-4 md:p-6 text-center">
              <div className="text-xl sm:text-2xl md:text-3xl font-black text-white">{tasaConversion}%</div>
              <div className="text-xs text-slate-400 uppercase mt-1">Tasa de conversion</div>
            </div>
          </div>
        );
      })()}

      {/* Filter Panel */}
      <FilterPanel
        fields={filterFields}
        onFilter={(conditions) => setFilterConditions(conditions)}
      />

      {/* Formulario */}
      {showForm && (
        <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-6 md:p-8 border border-white/[0.08]">
          <h2 className="text-xl font-bold text-white mb-6">{editingId ? 'Editar Oportunidad' : 'Nueva Oportunidad'}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input type="text" placeholder="Empresa / Cliente *" value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 focus:border-cyan-500/50" required />
            <input type="text" placeholder="Nombre del contacto" value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="text" placeholder="Cargo" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="tel" placeholder="Teléfono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="url" placeholder="Página Web" value={form.paginaWeb || ''} onChange={(e) => setForm({ ...form, paginaWeb: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="number" placeholder="Número de empleados" value={form.numeroEmpleados} onChange={(e) => setForm({ ...form, numeroEmpleados: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <select value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white focus:border-cyan-500/50">
              <option value="">Vincular a cuenta existente (opcional)</option>
              {(cuentas || []).map(c => <option key={c.id} value={c.id}>{c.empresa}</option>)}
            </select>
            <select value={form.etapa} onChange={(e) => setForm({ ...form, etapa: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white focus:border-cyan-500/50">
              {PIPELINE_STAGES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="number" placeholder="Valor estimado (USD/año)" value={form.valorEstimado} onChange={(e) => setForm({ ...form, valorEstimado: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            {/* Selector de servicio con opción de agregar nuevo */}
            <div className="relative">
              {!showNewServicio ? (
                <div className="flex gap-2">
                  <select value={form.servicio} onChange={(e) => setForm({ ...form, servicio: e.target.value })} className="flex-1 px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white focus:border-cyan-500/50">
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
            <input type="date" placeholder="Fecha seguimiento" value={form.fechaSeguimiento} onChange={(e) => setForm({ ...form, fechaSeguimiento: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white focus:border-cyan-500/50" />
            {/* Fuente */}
            <select value={form.fuente || ''} onChange={(e) => setForm({ ...form, fuente: e.target.value, referidoPor: e.target.value !== 'Referido' ? '' : form.referidoPor, esComisionista: e.target.value !== 'Referido' ? false : form.esComisionista })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white focus:border-cyan-500/50">
              <option value="">Fuente del prospecto</option>
              {FUENTES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            {/* Campos adicionales si es Referido */}
            {form.fuente === 'Referido' && (
              <>
                <input type="text" placeholder="Nombre de quien refirió *" value={form.referidoPor || ''} onChange={(e) => setForm({ ...form, referidoPor: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
                <label className="flex items-center gap-3 px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl cursor-pointer hover:border-cyan-500/50 transition-all">
                  <input type="checkbox" checked={form.esComisionista || false} onChange={(e) => setForm({ ...form, esComisionista: e.target.checked })} className="w-5 h-5 rounded bg-slate-700 border-slate-300/40 text-cyan-500 focus:ring-cyan-500/50" />
                  <span className="text-white">Es comisionista</span>
                </label>
              </>
            )}
            {esAdmin && (
              <select value={form.asignadoA || ''} onChange={(e) => setForm({ ...form, asignadoA: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white focus:border-cyan-500/50">
                <option value="">Asignar responsable... (yo mismo)</option>
                {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.id === currentUser?.id ? '(yo)' : ''}</option>)}
              </select>
            )}
            <select value={form.asignadoA2 || ''} onChange={(e) => setForm({ ...form, asignadoA2: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white focus:border-cyan-500/50">
              <option value="">Responsable 2 (opcional)</option>
              {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
            <select value={form.asignadoA3 || ''} onChange={(e) => setForm({ ...form, asignadoA3: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white focus:border-cyan-500/50">
              <option value="">Responsable 3 (opcional)</option>
              {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
            {/* Logo */}
            <div className="sm:col-span-2">
              <p className="text-slate-400 text-sm mb-2">Logo de la empresa</p>
              <div className="flex items-center gap-4">
                {logoPreview ? (
                  <div className="relative">
                    <img src={logoPreview} alt="Logo preview" className="w-16 h-16 rounded-xl object-cover border-2 border-slate-300/40" />
                    <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(null); }} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600"><X size={12} /></button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-slate-800 border-2 border-dashed border-slate-300/40 flex items-center justify-center">
                    <Image size={24} className="text-slate-600" />
                  </div>
                )}
                <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 border border-slate-300/40 rounded-xl text-slate-300 hover:border-cyan-500/50 cursor-pointer transition-all">
                  <Upload size={16} />
                  {logoPreview ? 'Cambiar logo' : 'Subir logo'}
                  <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                </label>
                {subiendoLogo && <span className="text-cyan-400 text-sm flex items-center gap-2"><Loader size={14} className="animate-spin" /> Subiendo...</span>}
              </div>
            </div>
            <textarea placeholder="Notas" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="sm:col-span-2 px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 focus:border-cyan-500/50 resize-none" rows="2"></textarea>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={subiendoLogo} className={`flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white px-5 py-3 rounded-2xl hover:opacity-90 transition-all font-semibold shadow-lg shadow-cyan-500/30 ${subiendoLogo ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {subiendoLogo ? <><Loader size={20} className="animate-spin" /> Subiendo logo...</> : <><Save size={20} /> Guardar</>}
              </button>
              <button type="button" onClick={resetForm} className="flex items-center gap-2 bg-slate-700/50 border border-slate-600/50 text-white hover:bg-slate-600/50 px-5 py-3 rounded-2xl transition-all font-medium">
                <X size={20} /> Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Empty State */}
      {pipelineFiltrado.length === 0 && !showForm && (
        <EmptyState
          icon={GitBranch}
          title="Pipeline vacio"
          description="Agrega tu primera oportunidad de venta"
          actionLabel={puedeCrear ? 'Nueva Oportunidad' : undefined}
          onAction={puedeCrear ? () => setShowForm(true) : undefined}
        />
      )}

      {/* Table View */}
      {vistaActual === 'tabla' && pipelineFiltrado.length > 0 && (
        <DataTable
          columns={tableColumns}
          data={pipelineFiltrado}
          onRowClick={(row) => setSelectedProspecto(row.id)}
          selectable={esAdmin}
          emptyMessage="No hay oportunidades que coincidan con los filtros"
          bulkActions={esAdmin ? tableBulkActions : []}
        />
      )}

      {/* Kanban Board */}
      {vistaActual === 'kanban' && pipelineFiltrado.length > 0 && (
      <div className="overflow-x-auto pb-4 -mx-3 sm:mx-0 px-3 sm:px-0">
        <div className="flex gap-2 sm:gap-3 md:gap-4 min-w-max">
          {PIPELINE_STAGES.map(stage => {
            const items = pipelineFiltrado.filter(p => p.etapa === stage.id);
            return (
              <div key={stage.id} className="w-72 flex-shrink-0" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDragEnter={(e) => { e.preventDefault(); setDragOverStage(stage.id); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStage(null); }} onDrop={(e) => { e.preventDefault(); if (draggedItemId) { const item = pipeline.find(p => p.id === draggedItemId); if (item && item.etapa !== stage.id) moverEtapa(draggedItemId, stage.id); } setDraggedItemId(null); setDragOverStage(null); }}>
                <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-gradient-to-r ${stage.color}`}>
                  <span className="text-white font-bold text-sm">{stage.name}</span>
                  {(() => {
                    // Find the next stage in sequence to show requirements
                    const stageIds = PIPELINE_STAGES.map(s => s.id);
                    const currentIdx = stageIds.indexOf(stage.id);
                    const nextStageId = currentIdx < stageIds.length - 2 ? stageIds[currentIdx + 1] : null;
                    const nextRule = nextStageId ? BLUEPRINT_RULES[nextStageId] : null;
                    if (nextRule && nextRule.requisitos && nextRule.requisitos.length > 0) {
                      const nextStageName = PIPELINE_STAGES.find(s => s.id === nextStageId)?.name || nextStageId;
                      return (
                        <span className="relative group/tip">
                          <Info size={14} className="text-white/60 hover:text-white cursor-help" />
                          <span className="absolute left-0 top-6 z-50 hidden group-hover/tip:block w-56 p-2 bg-slate-900 border border-slate-300/40 rounded-lg shadow-xl text-xs text-slate-300">
                            <span className="font-semibold text-white block mb-1">Para avanzar a {nextStageName}:</span>
                            {nextRule.requisitos.map((r, i) => <span key={i} className="block">- {r}</span>)}
                          </span>
                        </span>
                      );
                    }
                    return null;
                  })()}
                  <span className="ml-auto bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">{items.length}</span>
                </div>
                <div className={`space-y-3 min-h-[200px] rounded-xl transition-all ${dragOverStage === stage.id && draggedItemId ? 'bg-cyan-500/10 border-2 border-dashed border-cyan-500/40 p-2' : 'p-0'}`}>
                  {items.map(item => {
                    const actCount = actividades.filter(a => a.pipelineId === item.id).length;
                    // Visual indicators: time in stage and inactivity
                    const ultimaEtapaChange = (item.historialEtapas || []).filter(h => h.etapaNueva === item.etapa).slice(-1)[0];
                    const diasEnEtapa = ultimaEtapaChange ? Math.floor((Date.now() - new Date(ultimaEtapaChange.fecha).getTime()) / (1000*60*60*24)) : 0;
                    const actividadesItem = actividades.filter(a => a.pipelineId === item.id);
                    const ultimaActividad = actividadesItem.length > 0 ? actividadesItem.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0] : null;
                    const diasSinActividad = ultimaActividad ? Math.floor((Date.now() - new Date(ultimaActividad.fecha).getTime()) / (1000*60*60*24)) : (item.fechaCreacion ? Math.floor((Date.now() - new Date(item.fechaCreacion).getTime()) / (1000*60*60*24)) : 0);
                    const stuckInStage = diasEnEtapa > 7 && item.etapa !== 'cerrado' && item.etapa !== 'perdido';
                    const sinActividad = diasSinActividad > 5 && item.etapa !== 'cerrado' && item.etapa !== 'perdido';
                    // AI Scoring
                    const dealScore = calcularDealScore(item, actividades);
                    const tareasItem = (tareas || []).filter(t => t.pipelineId === item.id);
                    const sugerencia = getSugerenciaAccion(item, actividades, tareasItem);
                    const SugIcon = ICON_MAP[sugerencia?.icono] || Zap;
                    const stageBorderColors = { prospecto: 'border-l-slate-500', contacto: 'border-l-blue-500', diagnostico: 'border-l-cyan-500', piloto: 'border-l-violet-500', negociacion: 'border-l-amber-500', cerrado: 'border-l-emerald-500', perdido: 'border-l-red-500' };
                    const stageBorderClass = `border-l-4 ${stageBorderColors[item.etapa] || 'border-l-slate-500'}`;
                    return (
                      <div key={item.id} draggable onDragStart={(e) => { setDraggedItemId(item.id); e.dataTransfer.effectAllowed = 'move'; e.currentTarget.style.opacity = '0.5'; }} onDragEnd={(e) => { setDraggedItemId(null); setDragOverStage(null); e.currentTarget.style.opacity = '1'; }} onClick={() => setSelectedProspecto(item.id)} className={`bg-slate-800/40 backdrop-blur-md rounded-2xl border ${stageBorderClass} ${draggedItemId === item.id ? 'border-cyan-400' : sinActividad ? 'border-red-500/50' : stuckInStage ? 'border-amber-500/50' : 'border-white/[0.08]'} shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5 hover:border-cyan-500/50 transition-all duration-300 group cursor-grab active:cursor-grabbing overflow-hidden`}>
                        {item.logoUrl && (
                          <div className="w-full h-20 bg-slate-800">
                            <img src={item.logoUrl} alt={item.empresa} className="w-full h-full object-contain bg-white/5 p-2" />
                          </div>
                        )}
                        <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-white font-medium text-sm">{item.empresa || item.nombre}</h4>
                            {sinActividad && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title={`Sin actividad por ${diasSinActividad} días`} />}
                            {stuckInStage && !sinActividad && <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" title={`${diasEnEtapa} días en esta etapa`} />}
                            {/* Deal Score badge */}
                            <span
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ backgroundColor: `${getScoreHex(dealScore.color)}20`, color: getScoreHex(dealScore.color) }}
                              title={`Score: ${dealScore.score} - ${dealScore.nivel}`}
                            >
                              {dealScore.score}
                            </span>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            {puedeEditarProspecto(item) && (
                              <>
                                <button onClick={() => iniciarEditarNota(item)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-amber-400" title="Nota rápida">
                                  <MessageSquare size={14} />
                                </button>
                                <button onClick={() => handleEdit(item)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
                                  <Edit size={14} />
                                </button>
                              </>
                            )}
                            {puedeEliminarProspecto(item) && (
                              <button onClick={() => handleDelete(item.id)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Deal Score Bar */}
                        <div className="mt-2 mb-2 flex items-center gap-2"><div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden"><div className={`h-full rounded-full ${dealScore.score >= 70 ? 'bg-emerald-500' : dealScore.score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${dealScore.score}%` }} /></div><span className={`text-[10px] font-bold ${dealScore.score >= 70 ? 'text-emerald-400' : dealScore.score >= 40 ? 'text-amber-400' : 'text-red-400'}`}>{dealScore.score}</span></div>
                        {(() => {
                          const ids = [item.asignadoA, item.asignadoA2, item.asignadoA3].filter(Boolean);
                          if (ids.length === 0 && item.creadoPor) ids.push(item.creadoPor);
                          const usrs = ids.map(id => usuarios.find(u => u.id === id)).filter(Boolean);
                          return usrs.length > 0 ? <div className="flex items-center gap-1.5 mb-2">{usrs.map((u, i) => (
                            <span key={i} className="flex items-center gap-1">
                              {u.fotoUrl ? (
                                <img src={u.fotoUrl} alt={u.nombre} className="w-5 h-5 rounded-full object-cover inline-block" />
                              ) : null}
                              <span className={`text-xs font-medium ${getColorUsuario(u.nombre)}`}>{u.nombre}</span>
                              {i < usrs.length - 1 ? <span className="text-slate-600">,</span> : ''}
                            </span>
                          ))}</div> : null;
                        })()}
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
                          <div className="mb-3 bg-purple-900/15 border border-purple-500/20 rounded-xl p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                            <textarea value={notaTexto} onChange={(e) => setNotaTexto(e.target.value)} placeholder="Escribe una nota rápida..." className="w-full px-3 py-2 bg-slate-800 border border-purple-500/30 rounded-lg text-white text-xs placeholder-slate-500 resize-none focus:outline-none focus:border-purple-500" rows="2" autoFocus />
                            <div className="flex gap-1">
                              <button onClick={() => guardarNotaRapida(item.id)} className="flex-1 text-xs py-1 bg-purple-500 text-white rounded hover:bg-purple-600 transition-all">Guardar</button>
                              <button onClick={() => setEditingNota(null)} className="flex-1 text-xs py-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-all">Cancelar</button>
                            </div>
                          </div>
                        ) : item.notaRapida && (
                          <div className="mb-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg" onClick={(e) => { e.stopPropagation(); iniciarEditarNota(item); }}>
                            <p className="text-amber-200 text-xs">{item.notaRapida}</p>
                          </div>
                        )}
                        {/* Ultimo contacto */}
                        {(() => {
                          const lastContact = getLastContactInfo(item.id, actividades, 'pipelineId');
                          return (
                            <div className="flex items-center justify-between mt-1">
                              <span className={`text-xs ${lastContact.color}`}>Contacto: {lastContact.texto}</span>
                              {(item.telefono) && (
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <a href={getWhatsAppLink(item.telefono)} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-green-500/20 text-green-400 transition-all" title="WhatsApp">
                                    <MessageSquare size={13} />
                                  </a>
                                  <a href={getCallLink(item.telefono)} className="p-1 rounded hover:bg-cyan-500/20 text-cyan-400 transition-all" title="Llamar">
                                    <Phone size={13} />
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {/* Sugerencia IA */}
                        {sugerencia && sugerencia.accion && (
                          <div
                            className="mt-2 p-2 rounded-lg flex items-center gap-2"
                            style={{ backgroundColor: `${getScoreHex(sugerencia.color)}15`, border: `1px solid ${getScoreHex(sugerencia.color)}30` }}
                            title={sugerencia.descripcion}
                          >
                            <SugIcon size={13} style={{ color: getScoreHex(sugerencia.color) }} className="flex-shrink-0" />
                            <span className="text-xs font-medium truncate" style={{ color: getScoreHex(sugerencia.color) }}>
                              {sugerencia.accion}
                            </span>
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
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
}

export default Pipeline;
