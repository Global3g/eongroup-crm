import React, { useState, useRef, useEffect } from 'react';
import {
  Plus, Trash2, Edit, Save, Search, Phone, Mail,
  Building, CheckCircle, X, UserPlus, Tag,
  MessageSquare, Bell, PhoneCall, Loader,
  Upload, Image, User, ArrowUpRight, Paperclip, AlertCircle,
  List, LayoutGrid, Zap, Calendar
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { formatDate, generateId, getFechaLocal, getColorUsuario, completarTareaConRecurrencia, RECURRENCIA_OPTIONS } from '../utils/helpers';
import { TIPOS_ACTIVIDAD, TAGS_DISPONIBLES, FUENTES } from '../utils/constants';
import { getWhatsAppLink, getCallLink, getLastContactInfo } from '../utils/communication';
import { calcularLeadScore } from '../utils/scoring';
import DataTable from './ui/DataTable';
import FilterPanel from './ui/FilterPanel';
import EmptyState from './ui/EmptyState';
import Timeline from './ui/Timeline';

// Mapa de colores hex para scores (los utils retornan clases tailwind, necesitamos hex para estilos inline)
const SCORE_COLORS = {
  'text-red-400': '#f87171',
  'text-amber-400': '#fbbf24',
  'text-blue-400': '#60a5fa',
  'text-slate-400': '#94a3b8',
  'text-emerald-400': '#34d399',
};
const getScoreHex = (tailwindColor) => SCORE_COLORS[tailwindColor] || '#94a3b8';

function buildGoogleCalendarUrl(title, date, time, details, userEmail) {
  const d = date.replace(/-/g, '');
  let start, end;
  if (time) {
    const t = time.replace(/:/g, '');
    start = `${d}T${t}00`;
    // +1 hora de duración
    const [h, m] = time.split(':').map(Number);
    const endH = String((h + 1) % 24).padStart(2, '0');
    end = `${d}T${endH}${String(m).padStart(2, '0')}00`;
  } else {
    start = d;
    end = d;
  }
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
    details: details || '',
  });
  if (userEmail) params.set('authuser', userEmail);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function Leads({ leads, setLeads, pipeline, setPipeline, todasLasIndustrias, addIndustria, editIndustria, deleteIndustria, todosLosServicios, addServicio, addAuditLog, recordatorios, setRecordatorios, tareas, setTareas, actividades, setActividades, usuarios, currentUser, addNotificacion, setEmailDestinatario, setEmailModalOpen }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const formRef = useRef(null);

  useEffect(() => {
    if (showForm && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showForm]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [modalTab, setModalTab] = useState('info');
  const [viewMode, setViewMode] = useState('lista'); // 'lista' | 'tarjetas'
  const [sortBy, setSortBy] = useState('asignado'); // 'asignado' | 'score' | 'empresa' | 'prioridad'
  const [activeFilters, setActiveFilters] = useState([]);
  const [form, setForm] = useState({
    empresa: '', contacto: '', cargo: '', email: '', telefono: '', paginaWeb: '',
    industria: '', servicio: '', fuente: '', notas: '', prioridad: 'media', tags: [], asignadoA: '', asignadoA2: '', asignadoA3: '',
    referidoPor: '', esComisionista: false, numeroEmpleados: ''
  });

  // Estados para crear recordatorios y tareas en el modal
  const [newRecordatorio, setNewRecordatorio] = useState({ titulo: '', fecha: '', hora: '', descripcion: '' });
  const [newTarea, setNewTarea] = useState({ descripcion: '', fechaCompromiso: '', hora: '', prioridad: 'media', recurrencia: 'ninguna' });
  const [editingTarea, setEditingTarea] = useState(null);
  const [editingRecordatorio, setEditingRecordatorio] = useState(null);

  // Estados para modal de actividad completo (como Pipeline)
  const [showActividadForm, setShowActividadForm] = useState(false);
  const [actividadForm, setActividadForm] = useState({
    tipo: 'llamada', titulo: '', descripcion: '', fecha: getFechaLocal(), responsableId: ''
  });
  const [editingActividad, setEditingActividad] = useState(null);
  const [viewingActividad, setViewingActividad] = useState(null);
  const [actividadArchivo, setActividadArchivo] = useState(null);
  const [subiendoActividad, setSubiendoActividad] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [subiendoLogo, setSubiendoLogo] = useState(false);

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
      return lead.asignadoA === currentUser?.id || lead.asignadoA2 === currentUser?.id || lead.asignadoA3 === currentUser?.id || lead.creadoPor === currentUser?.id;
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
      return lead.asignadoA === currentUser?.id || lead.asignadoA2 === currentUser?.id || lead.asignadoA3 === currentUser?.id || lead.creadoPor === currentUser?.id;
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
    setNewRecordatorio({ titulo: '', fecha: '', hora: '', descripcion: '' });
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
    setNewTarea({ descripcion: '', fechaCompromiso: '', hora: '', prioridad: 'media', recurrencia: 'ninguna' });
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
    const { newTareas } = completarTareaConRecurrencia(tareas, tareaId, generateId);
    setTareas(newTareas);
  };

  // Editar tarea
  const handleEditTarea = (tarea) => {
    setEditingTarea(tarea);
    setNewTarea({ descripcion: tarea.descripcion, fechaCompromiso: tarea.fechaCompromiso, hora: tarea.hora || '', prioridad: tarea.prioridad || 'media', recurrencia: tarea.recurrencia || 'ninguna' });
  };

  // Guardar edición de tarea
  const guardarEdicionTarea = () => {
    if (!newTarea.descripcion || !newTarea.fechaCompromiso) return;
    setTareas(prev => prev.map(t => t.id === editingTarea.id ? { ...t, ...newTarea } : t));
    addAuditLog('editar', 'tareas', `Tarea editada para lead: ${selectedLead?.empresa}`, editingTarea.id, newTarea.descripcion);
    setEditingTarea(null);
    setNewTarea({ descripcion: '', fechaCompromiso: '', hora: '', prioridad: 'media', recurrencia: 'ninguna' });
  };

  // Eliminar tarea
  const handleDeleteTarea = (tareaId) => {
    if (window.confirm('¿Eliminar esta tarea?')) {
      setTareas(prev => prev.filter(t => t.id !== tareaId));
      addAuditLog('eliminar', 'tareas', `Tarea eliminada del lead: ${selectedLead?.empresa}`, tareaId);
    }
  };

  // Editar recordatorio
  const handleEditRecordatorio = (rec) => {
    setEditingRecordatorio(rec);
    setNewRecordatorio({ titulo: rec.titulo, fecha: rec.fecha, hora: rec.hora || '', descripcion: rec.descripcion || '' });
  };

  // Guardar edición de recordatorio
  const guardarEdicionRecordatorio = () => {
    if (!newRecordatorio.titulo || !newRecordatorio.fecha) return;
    setRecordatorios(prev => prev.map(r => r.id === editingRecordatorio.id ? { ...r, ...newRecordatorio } : r));
    addAuditLog('editar', 'recordatorios', `Recordatorio editado para lead: ${selectedLead?.empresa}`, editingRecordatorio.id, newRecordatorio.titulo);
    setEditingRecordatorio(null);
    setNewRecordatorio({ titulo: '', fecha: '', hora: '', descripcion: '' });
  };

  // Eliminar recordatorio
  const handleDeleteRecordatorio = (recId) => {
    if (window.confirm('¿Eliminar este recordatorio?')) {
      setRecordatorios(prev => prev.filter(r => r.id !== recId));
      addAuditLog('eliminar', 'recordatorios', `Recordatorio eliminado del lead: ${selectedLead?.empresa}`, recId);
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
  const PRIORIDADES = [
    { id: 'alta', name: 'Alta', color: 'bg-red-500' },
    { id: 'media', name: 'Media', color: 'bg-amber-500' },
    { id: 'baja', name: 'Baja', color: 'bg-slate-500' }
  ];

  const [showNewIndustria, setShowNewIndustria] = useState(false);
  const [newIndustriaName, setNewIndustriaName] = useState('');
  const [showManageIndustrias, setShowManageIndustrias] = useState(false);
  const [editingIndustria, setEditingIndustria] = useState(null);
  const [editIndustriaValue, setEditIndustriaValue] = useState('');
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
    setForm({ empresa: '', contacto: '', cargo: '', email: '', telefono: '', paginaWeb: '', industria: '', servicio: '', fuente: '', notas: '', prioridad: 'media', tags: [], asignadoA: '', asignadoA2: '', asignadoA3: '', referidoPor: '', esComisionista: false, numeroEmpleados: '' });
    setShowForm(false);
    setEditingId(null);
    setShowNewIndustria(false);
    setNewIndustriaName('');
    setShowManageIndustrias(false);
    setEditingIndustria(null);
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
        const fileName = `leads/logos/${editingId || 'new'}_${timestamp}_${logoFile.name}`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, logoFile);
        logoUrl = await getDownloadURL(storageRef);
      }
    } catch (err) {
      console.error('Error al subir logo:', err);
    }
    setSubiendoLogo(false);

    if (editingId) {
      const leadActual = leads.find(l => l.id === editingId);
      const logoFinal = logoUrl || (logoPreview ? leadActual?.logoUrl || '' : '');
      setLeads(leads.map(l => l.id === editingId ? { ...l, ...form, logoUrl: logoFinal, asignadoA: form.asignadoA || l.asignadoA || currentUser?.id } : l));
      addAuditLog('editar', 'leads', `Lead editado: ${form.empresa}`, editingId, form.empresa);
    } else {
      const nuevoLead = { ...form, logoUrl: logoUrl || '', id: generateId(), fechaCreacion: getFechaLocal(), creadoPor: currentUser?.id, asignadoA: form.asignadoA || currentUser?.id };
      setLeads([...leads, nuevoLead]);
      addAuditLog('crear', 'leads', `Nuevo lead: ${form.empresa}`, nuevoLead.id, form.empresa);
    }
    resetForm();
  };

  const handleEdit = (lead) => {
    setForm({ ...lead, asignadoA: lead.asignadoA || '', asignadoA2: lead.asignadoA2 || '', asignadoA3: lead.asignadoA3 || '', paginaWeb: lead.paginaWeb || '', referidoPor: lead.referidoPor || '', esComisionista: lead.esComisionista || false, numeroEmpleados: lead.numeroEmpleados || '' });
    setEditingId(lead.id);
    setLogoFile(null);
    setLogoPreview(lead.logoUrl || null);
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
      asignadoA2: lead.asignadoA2 || '',
      asignadoA3: lead.asignadoA3 || '',
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
    ? leads.filter(l => l.asignadoA === currentUser?.id || l.asignadoA2 === currentUser?.id || l.asignadoA3 === currentUser?.id || l.creadoPor === currentUser?.id)
    : leads;

  // Apply search filter
  const searchFiltered = leadsPorAlcance.filter(l =>
    l.empresa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.contacto?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Apply advanced FilterPanel conditions
  const applyAdvancedFilters = (leadsArr) => {
    if (activeFilters.length === 0) return leadsArr;
    return leadsArr.filter(lead => {
      return activeFilters.every(cond => {
        let fieldValue = lead[cond.field];
        // Special handling for asignadoA - match by user name
        if (cond.field === 'asignadoA') {
          const usr = usuarios.find(u => u.id === fieldValue);
          fieldValue = usr?.nombre || '';
        }
        const val = String(fieldValue || '').toLowerCase();
        const condVal = String(cond.value || '').toLowerCase();
        switch (cond.operator) {
          case 'es': return val === condVal;
          case 'no_es': return val !== condVal;
          case 'contiene': return val.includes(condVal);
          case 'no_contiene': return !val.includes(condVal);
          case 'empieza': return val.startsWith(condVal);
          default: return true;
        }
      });
    });
  };

  const filteredLeads = applyAdvancedFilters(searchFiltered).sort((a, b) => {
    if (sortBy === 'score') {
      const scoreA = calcularLeadScore(a, actividades, pipeline)?.score || 0;
      const scoreB = calcularLeadScore(b, actividades, pipeline)?.score || 0;
      return scoreB - scoreA; // Mayor score primero
    }
    if (sortBy === 'empresa') {
      return (a.empresa || '').localeCompare(b.empresa || '');
    }
    if (sortBy === 'prioridad') {
      const orden = { alta: 0, media: 1, baja: 2 };
      return (orden[a.prioridad] || 1) - (orden[b.prioridad] || 1);
    }
    // Default: por asignado
    const nA = usuarios.find(u => u.id === a.asignadoA)?.nombre || usuarios.find(u => u.id === a.creadoPor)?.nombre || 'zzz';
    const nB = usuarios.find(u => u.id === b.asignadoA)?.nombre || usuarios.find(u => u.id === b.creadoPor)?.nombre || 'zzz';
    const cmp = nA.localeCompare(nB);
    if (cmp !== 0) return cmp;
    return (a.empresa || '').localeCompare(b.empresa || '');
  });

  // FilterPanel field definitions
  const filterFields = [
    { key: 'empresa', label: 'Empresa', type: 'text' },
    { key: 'contacto', label: 'Contacto', type: 'text' },
    { key: 'industria', label: 'Industria', type: 'select', options: todasLasIndustrias.map(i => ({ value: i, label: i })) },
    { key: 'prioridad', label: 'Prioridad', type: 'select', options: [{ value: 'alta', label: 'Alta' }, { value: 'media', label: 'Media' }, { value: 'baja', label: 'Baja' }] },
    { key: 'fuente', label: 'Fuente', type: 'select', options: FUENTES.map(f => ({ value: f, label: f })) },
    { key: 'servicio', label: 'Servicio', type: 'select', options: todosLosServicios.map(s => ({ value: s, label: s })) },
    { key: 'asignadoA', label: 'Asignado a', type: 'select', options: usuariosActivos.map(u => ({ value: u.nombre, label: u.nombre })) },
  ];

  // DataTable columns
  const tableColumns = [
    {
      key: 'empresa',
      label: 'Empresa',
      sortable: true,
      filterable: true,
      render: (val, row) => (
        <div className="flex items-center gap-3">
          {row.logoUrl ? (
            <img src={row.logoUrl} alt={row.empresa} className="w-8 h-8 rounded-lg object-cover border border-slate-300/40 flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center flex-shrink-0">
              <Building size={14} className="text-slate-500" />
            </div>
          )}
          <span className="text-cyan-300 font-bold text-[15px]">{row.empresa}</span>
        </div>
      ),
    },
    { key: 'contacto', label: 'Contacto', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    {
      key: 'telefono',
      label: 'Telefono',
      sortable: false,
      render: (val, row) => val ? (
        <div className="flex items-center gap-2">
          <span>{val}</span>
          <span className="flex items-center gap-0.5">
            <a href={getWhatsAppLink(val)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-0.5 rounded hover:bg-green-500/20 text-green-400 transition-all" title="WhatsApp"><MessageSquare size={12} /></a>
            <a href={getCallLink(val)} onClick={(e) => e.stopPropagation()} className="p-0.5 rounded hover:bg-cyan-500/20 text-cyan-400 transition-all" title="Llamar"><Phone size={12} /></a>
          </span>
        </div>
      ) : <span className="text-slate-500">-</span>,
    },
    {
      key: 'ultimoContacto',
      label: 'Ultimo Contacto',
      sortable: false,
      render: (val, row) => {
        const lastContact = getLastContactInfo(row.id, actividades, 'leadId');
        return <span className={`text-xs ${lastContact.color}`}>{lastContact.texto}</span>;
      },
    },
    { key: 'industria', label: 'Industria', sortable: true, filterable: true },
    { key: 'servicio', label: 'Servicio', sortable: true, filterable: true },
    {
      key: 'prioridad',
      label: 'Prioridad',
      sortable: true,
      filterable: true,
      render: (val) => {
        const colors = { alta: 'bg-red-500/20 text-red-400 border-red-500/30', media: 'bg-amber-500/20 text-amber-400 border-amber-500/30', baja: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
        const labels = { alta: 'Alta', media: 'Media', baja: 'Baja' };
        return (
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${colors[val] || colors.media}`}>
            {labels[val] || val}
          </span>
        );
      },
    },
    { key: 'fuente', label: 'Fuente', sortable: true, filterable: true },
    {
      key: 'asignadoA',
      label: 'Asignado',
      sortable: true,
      filterable: true,
      render: (val, row) => {
        const ids = [row.asignadoA, row.asignadoA2, row.asignadoA3].filter(Boolean);
        if (ids.length === 0 && row.creadoPor) ids.push(row.creadoPor);
        const usrs = ids.map(id => usuarios.find(u => u.id === id)).filter(Boolean);
        return usrs.length > 0 ? (
          <span className="flex items-center gap-1 flex-wrap">{usrs.map((u, i) => (
            <span key={i} className="flex items-center gap-1">
              {u.fotoUrl ? <img src={u.fotoUrl} alt={u.nombre} className="w-5 h-5 rounded-full object-cover inline-block" /> : null}
              <span className={`font-medium ${getColorUsuario(u.nombre)}`}>{u.nombre}</span>
              {i < usrs.length - 1 ? ', ' : ''}
            </span>
          ))}</span>
        ) : <span className="text-slate-500">-</span>;
      },
    },
    {
      key: 'score',
      label: 'Score',
      sortable: true,
      sortFunction: (a, b) => {
        const scoreA = calcularLeadScore(a, actividades, pipeline)?.score || 0;
        const scoreB = calcularLeadScore(b, actividades, pipeline)?.score || 0;
        return scoreA - scoreB;
      },
      render: (val, row) => {
        const scoreData = calcularLeadScore(row, actividades, pipeline);
        return (
          <div className="flex flex-col items-center gap-1">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
              style={{ backgroundColor: `${getScoreHex(scoreData.color)}20`, color: getScoreHex(scoreData.color) }}
              title={scoreData.detalles?.join('\n')}
            >
              {scoreData.score}
            </div>
            <span className="text-xs" style={{ color: getScoreHex(scoreData.color) }}>{scoreData.nivel}</span>
          </div>
        );
      },
    },
  ];

  // Bulk actions for DataTable
  const bulkActions = [
    {
      label: 'Eliminar seleccionados',
      onClick: (selectedIds) => {
        if (window.confirm(`¿Eliminar ${selectedIds.length} leads?`)) {
          setLeads(prev => prev.filter(l => !selectedIds.includes(l.id)));
        }
      },
    },
    {
      label: 'Convertir a Pipeline',
      onClick: (selectedIds) => {
        if (window.confirm(`¿Convertir ${selectedIds.length} leads a Pipeline?`)) {
          selectedIds.forEach(id => {
            const lead = leads.find(l => l.id === id);
            if (lead) convertirAPipeline(lead);
          });
        }
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Leads</h1>
          <p className="text-slate-400">{leads.length} prospectos</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-300/40">
            <button
              onClick={() => setViewMode('lista')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'lista' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white'}`}
            >
              <List size={16} /> Lista
            </button>
            <button
              onClick={() => setViewMode('tarjetas')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'tarjetas' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white'}`}
            >
              <LayoutGrid size={16} /> Tarjetas
            </button>
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
      </div>

      {/* Hero Metrics */}
      {(() => {
        const totalActivos = leads.length;
        const listosConvertir = leads.filter(l => {
          const s = calcularLeadScore(l, actividades, pipeline);
          return s && s.score > 60;
        }).length;
        const hoy = new Date();
        const inicioSemana = new Date(hoy);
        inicioSemana.setDate(hoy.getDate() - hoy.getDay());
        inicioSemana.setHours(0, 0, 0, 0);
        const leadsEstaSemana = leads.filter(l => l.fechaCreacion && new Date(l.fechaCreacion) >= inicioSemana).length;
        const scores = leads.map(l => calcularLeadScore(l, actividades, pipeline)?.score || 0);
        const scorePromedio = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        return (
          <div className="flex gap-4">
            <div className="bg-slate-800/50 rounded-xl border border-slate-300/40 p-4 text-center flex-1">
              <div className="text-3xl font-bold text-white">{totalActivos}</div>
              <div className="text-xs text-slate-400 uppercase mt-1">Total leads activos</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl border border-slate-300/40 p-4 text-center flex-1">
              <div className="text-3xl font-bold text-white">{listosConvertir}</div>
              <div className="text-xs text-slate-400 uppercase mt-1">Listos para convertir</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl border border-slate-300/40 p-4 text-center flex-1">
              <div className="text-3xl font-bold text-white">{leadsEstaSemana}</div>
              <div className="text-xs text-slate-400 uppercase mt-1">Leads esta semana</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl border border-slate-300/40 p-4 text-center flex-1">
              <div className="text-3xl font-bold text-white">{scorePromedio}</div>
              <div className="text-xs text-slate-400 uppercase mt-1">Score promedio</div>
            </div>
          </div>
        );
      })()}

      {/* Buscador y Ordenar */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" size={20} />
          <input
            type="text"
            placeholder="Buscar leads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-800/40 backdrop-blur-md border border-white/[0.08] rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-3 bg-slate-800/40 backdrop-blur-md border border-white/[0.08] rounded-xl text-white focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all text-sm"
        >
          <option value="asignado">Ordenar: Asignado</option>
          <option value="score">Ordenar: Score IA</option>
          <option value="empresa">Ordenar: Empresa</option>
          <option value="prioridad">Ordenar: Prioridad</option>
        </select>
      </div>

      {/* FilterPanel */}
      <FilterPanel
        fields={filterFields}
        onFilter={(conditions) => setActiveFilters(conditions)}
      />

      {/* Formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={resetForm}>
        <div ref={formRef} className="bg-slate-900 rounded-2xl p-6 border border-slate-300/40 w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-modal-in shadow-2xl shadow-black/40" onClick={e => e.stopPropagation()}>
          <h2 className="text-xl font-bold text-white mb-6">{editingId ? 'Editar Lead' : 'Nuevo Lead'}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" placeholder="Empresa *" value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" required />
            <input type="text" placeholder="Contacto" value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="text" placeholder="Cargo" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="tel" placeholder="Teléfono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="url" placeholder="Página Web" value={form.paginaWeb || ''} onChange={(e) => setForm({ ...form, paginaWeb: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="number" placeholder="Número de empleados" value={form.numeroEmpleados || ''} onChange={(e) => setForm({ ...form, numeroEmpleados: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            {/* Selector de industria con opción de agregar nueva */}
            <div className="relative">
              {!showNewIndustria ? (
                <div className="flex gap-2">
                  <select value={form.industria} onChange={(e) => setForm({ ...form, industria: e.target.value })} className="flex-1 px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white focus:border-cyan-500/50">
                    <option value="">Seleccionar industria</option>
                    {todasLasIndustrias.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                  <button type="button" onClick={() => setShowNewIndustria(true)} className="px-3 py-3 bg-slate-700 hover:bg-slate-600 text-cyan-400 rounded-xl transition-all" title="Agregar nueva industria">
                    <Plus size={20} />
                  </button>
                  <button type="button" onClick={() => setShowManageIndustrias(!showManageIndustrias)} className={`px-3 py-3 rounded-xl transition-all ${showManageIndustrias ? 'bg-amber-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-amber-400'}`} title="Administrar industrias">
                    <Edit size={20} />
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
              {/* Panel de administración de industrias */}
              {showManageIndustrias && (
                <div className="mt-2 bg-slate-800 border border-slate-300/40 rounded-xl p-3 space-y-1 max-h-60 overflow-y-auto">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Administrar Industrias</p>
                  {todasLasIndustrias.map(ind => (
                    <div key={ind} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-700/50 group">
                      {editingIndustria === ind ? (
                        <>
                          <input
                            type="text"
                            value={editIndustriaValue}
                            onChange={(e) => setEditIndustriaValue(e.target.value)}
                            className="flex-1 px-2 py-1 bg-slate-900 border border-cyan-500/50 rounded-lg text-white text-sm"
                            autoFocus
                          />
                          <button type="button" onClick={() => { if (editIndustria(ind, editIndustriaValue)) { setEditingIndustria(null); setEditIndustriaValue(''); } }} className="p-1 text-emerald-400 hover:text-emerald-300"><Save size={14} /></button>
                          <button type="button" onClick={() => { setEditingIndustria(null); setEditIndustriaValue(''); }} className="p-1 text-slate-400 hover:text-white"><X size={14} /></button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm text-white">{ind}</span>
                          <button type="button" onClick={() => { setEditingIndustria(ind); setEditIndustriaValue(ind); }} className="p-1 text-slate-500 hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity"><Edit size={14} /></button>
                          <button type="button" onClick={() => { if (window.confirm(`¿Eliminar la industria "${ind}"?`)) { deleteIndustria(ind); } }} className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                        </>
                      )}
                    </div>
                  ))}
                  {todasLasIndustrias.length === 0 && <p className="text-sm text-slate-500 text-center py-2">No hay industrias</p>}
                </div>
              )}
            </div>
            {/* Selector de servicio con opción de agregar nuevo */}
            <div className="relative">
              {!showNewServicio ? (
                <div className="flex gap-2">
                  <select value={form.servicio} onChange={(e) => setForm({ ...form, servicio: e.target.value })} className="flex-1 px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white focus:border-cyan-500/50">
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
            <select value={form.fuente || ''} onChange={(e) => setForm({ ...form, fuente: e.target.value, referidoPor: e.target.value !== 'Referido' ? '' : form.referidoPor, esComisionista: e.target.value !== 'Referido' ? false : form.esComisionista })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white focus:border-cyan-500/50">
              <option value="">Fuente del lead</option>
              {FUENTES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            {/* Campos adicionales si es Referido */}
            {form.fuente === 'Referido' && (
              <>
                <input type="text" placeholder="Nombre de quien refirió *" value={form.referidoPor || ''} onChange={(e) => setForm({ ...form, referidoPor: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
                <label className="flex items-center gap-3 px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl cursor-pointer hover:border-cyan-500/50 transition-all">
                  <input type="checkbox" checked={form.esComisionista || false} onChange={(e) => setForm({ ...form, esComisionista: e.target.checked })} className="w-5 h-5 rounded bg-slate-700 border-slate-300/40 text-cyan-500 focus:ring-cyan-500/50" />
                  <span className="text-white">Es comisionista</span>
                </label>
              </>
            )}
            <select value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white focus:border-cyan-500/50">
              {PRIORIDADES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {/* Selector de responsable (solo admin) */}
            {esAdmin && (
              <select value={form.asignadoA || ''} onChange={(e) => setForm({ ...form, asignadoA: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white focus:border-cyan-500/50">
                <option value="">Asignar responsable... (yo mismo)</option>
                {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.id === currentUser?.id ? '(yo)' : ''}</option>)}
              </select>
            )}
            <select value={form.asignadoA2 || ''} onChange={(e) => setForm({ ...form, asignadoA2: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white focus:border-cyan-500/50">
              <option value="">Responsable 2 (opcional)</option>
              {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
            <select value={form.asignadoA3 || ''} onChange={(e) => setForm({ ...form, asignadoA3: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white focus:border-cyan-500/50">
              <option value="">Responsable 3 (opcional)</option>
              {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
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
            {/* Logo */}
            <div className="md:col-span-2">
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
            <textarea placeholder="Notas" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="md:col-span-2 px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50 resize-none" rows="2"></textarea>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" disabled={subiendoLogo} className={`flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white px-5 py-3 rounded-xl hover:opacity-90 transition-all font-medium ${subiendoLogo ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {subiendoLogo ? <><Loader size={20} className="animate-spin" /> Subiendo logo...</> : <><Save size={20} /> Guardar</>}
              </button>
              <button type="button" onClick={resetForm} className="flex items-center gap-2 bg-slate-800 text-slate-300 px-5 py-3 rounded-xl hover:bg-slate-700 transition-all font-medium">
                <X size={20} /> Cancelar
              </button>
            </div>
          </form>
        </div>
        </div>
      )}

      {/* Leads content */}
      {filteredLeads.length === 0 && leads.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="Sin leads"
          description="Captura tu primer prospecto"
          actionLabel={puedeCrear ? 'Agregar Lead' : undefined}
          onAction={puedeCrear ? () => setShowForm(true) : undefined}
        />
      ) : viewMode === 'lista' ? (
        /* DataTable view */
        <DataTable
          columns={tableColumns}
          data={filteredLeads}
          onRowClick={(row) => setSelectedLead(row)}
          selectable={esAdmin}
          emptyMessage="No hay leads que coincidan con la busqueda"
          bulkActions={esAdmin ? bulkActions : []}
        />
      ) : (
        /* Tarjetas (card) view */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredLeads.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <UserPlus className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500">No hay leads que coincidan</p>
            </div>
          ) : (
            filteredLeads.map(lead => {
              const prioridad = PRIORIDADES.find(p => p.id === lead.prioridad);
              const ids = [lead.asignadoA, lead.asignadoA2, lead.asignadoA3].filter(Boolean);
              if (ids.length === 0 && lead.creadoPor) ids.push(lead.creadoPor);
              const cardUsrs = ids.map(id => usuarios.find(u => u.id === id)).filter(Boolean);
              const nombres = cardUsrs.map(u => u.nombre);
              const cardScore = calcularLeadScore(lead, actividades, pipeline);
              return (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className="bg-slate-800/40 backdrop-blur-md rounded-2xl border border-white/[0.08] hover:border-cyan-500/60 hover:scale-[1.01] hover:shadow-lg hover:shadow-cyan-500/5 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer overflow-hidden group relative"
                >
                  {/* Score badge */}
                  <div
                    className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-lg"
                    style={{ backgroundColor: `${getScoreHex(cardScore.color)}20`, color: getScoreHex(cardScore.color), border: `1.5px solid ${getScoreHex(cardScore.color)}40` }}
                    title={`Score: ${cardScore.score} - ${cardScore.nivel}`}
                  >
                    {cardScore.score}
                  </div>
                  {/* Card header */}
                  <div className="bg-slate-800 px-5 py-4 flex items-center gap-3">
                    {lead.logoUrl ? (
                      <img src={lead.logoUrl} alt={lead.empresa} className="w-10 h-10 rounded-lg object-cover border border-slate-300/40 flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center flex-shrink-0">
                        <Building size={18} className="text-slate-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">{lead.empresa}</p>
                      <p className="text-slate-400 text-sm truncate">{lead.contacto || '-'}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${prioridad?.id === 'alta' ? 'bg-red-500/20 text-red-400' : prioridad?.id === 'media' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                      {prioridad?.name}
                    </span>
                  </div>
                  {/* Card body */}
                  <div className="px-5 py-4 space-y-2">
                    {lead.email && (
                      <p className="text-slate-400 text-sm flex items-center gap-2 truncate">
                        <Mail size={14} className="flex-shrink-0 text-slate-500" /> {lead.email}
                      </p>
                    )}
                    {lead.telefono && (
                      <div className="flex items-center justify-between">
                        <p className="text-slate-400 text-sm flex items-center gap-2">
                          <Phone size={14} className="flex-shrink-0 text-slate-500" /> {lead.telefono}
                        </p>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <a href={getWhatsAppLink(lead.telefono)} target="_blank" rel="noopener noreferrer" className="p-1 rounded-lg hover:bg-green-500/20 text-green-400 transition-all" title="WhatsApp">
                            <MessageSquare size={14} />
                          </a>
                          <a href={getCallLink(lead.telefono)} className="p-1 rounded-lg hover:bg-cyan-500/20 text-cyan-400 transition-all" title="Llamar">
                            <Phone size={14} />
                          </a>
                        </div>
                      </div>
                    )}
                    {lead.industria && (
                      <p className="text-slate-400 text-sm flex items-center gap-2">
                        <Building size={14} className="flex-shrink-0 text-slate-500" /> {lead.industria}
                      </p>
                    )}
                    {cardUsrs.length > 0 && (
                      <div className="text-sm flex items-center gap-1.5 flex-wrap">
                        <User size={14} className="flex-shrink-0 text-slate-500" />
                        {cardUsrs.map((u, i) => (
                          <span key={i} className="flex items-center gap-1">
                            {u.fotoUrl ? <img src={u.fotoUrl} alt={u.nombre} className="w-5 h-5 rounded-full object-cover inline-block" /> : null}
                            <span className={`font-medium ${getColorUsuario(u.nombre)}`}>{u.nombre}</span>
                            {i < cardUsrs.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Ultimo contacto */}
                    {(() => {
                      const lastContact = getLastContactInfo(lead.id, actividades, 'leadId');
                      return <p className={`text-xs mt-1 ${lastContact.color}`}>Contacto: {lastContact.texto}</p>;
                    })()}
                  </div>
                  {/* Card footer actions */}
                  <div className="px-5 py-3 border-t border-slate-800 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
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
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal de detalle del Lead */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={() => setSelectedLead(null)}>
          <div className="bg-slate-900 rounded-2xl border border-white/[0.08] w-full max-w-4xl max-h-[90vh] overflow-hidden animate-modal-in shadow-2xl shadow-black/40" onClick={e => e.stopPropagation()}>
            {/* Header del modal */}
            <div className="p-6 border-b border-slate-300/30">
              {/* Fila 1: Título + Score + Cerrar */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  {/* Score circle */}
                  {(() => {
                    const modalScore = calcularLeadScore(selectedLead, actividades, pipeline);
                    return (
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg shadow-lg flex-shrink-0"
                        style={{ backgroundColor: `${getScoreHex(modalScore.color)}20`, color: getScoreHex(modalScore.color), border: `2px solid ${getScoreHex(modalScore.color)}40` }}
                        title={modalScore.detalles?.join('\n')}
                      >
                        {modalScore.score}
                      </div>
                    );
                  })()}
                  <div>
                    <h2 className="text-2xl font-bold text-white">{selectedLead.empresa}</h2>
                    <p className="text-slate-400">{selectedLead.contacto} {selectedLead.cargo && `- ${selectedLead.cargo}`}</p>
                    {(() => {
                      const lastContact = getLastContactInfo(selectedLead.id, actividades, 'leadId');
                      const modalScore = calcularLeadScore(selectedLead, actividades, pipeline);
                      return (
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`text-xs ${lastContact.color}`}>Ultimo contacto: {lastContact.texto}</span>
                          <span className="text-xs font-semibold" style={{ color: getScoreHex(modalScore.color) }}>{modalScore.nivel}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <button onClick={() => setSelectedLead(null)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all flex-shrink-0">
                  <X size={24} />
                </button>
              </div>
              {/* Fila 2: Comunicación */}
              <div className="flex flex-wrap items-center gap-2">
                {selectedLead.telefono && (
                  <>
                    <a href={getWhatsAppLink(selectedLead.telefono)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 rounded-xl transition-all text-sm">
                      <MessageSquare size={16} /> WhatsApp
                    </a>
                    <a href={getCallLink(selectedLead.telefono)} className="flex items-center gap-2 px-3 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 rounded-xl transition-all text-sm">
                      <Phone size={16} /> Llamar
                    </a>
                  </>
                )}
                {selectedLead.email && (
                  <button onClick={() => abrirEmail(selectedLead)} className="flex items-center gap-2 px-3 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 rounded-xl transition-all text-sm">
                    <Mail size={16} /> Email
                  </button>
                )}
                <div className="flex-1" />
                {puedeEditarLead(selectedLead) && (
                  <button onClick={() => { handleEdit(selectedLead); setSelectedLead(null); }} className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all text-sm">
                    <Edit size={16} /> Editar
                  </button>
                )}
                {puedeEliminarLead(selectedLead) && (
                  <button onClick={() => { handleDelete(selectedLead.id); setSelectedLead(null); }} className="flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all text-sm">
                    <Trash2 size={16} /> Eliminar
                  </button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-300/30 px-6">
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
                        {selectedLead.telefono && (
                          <span className="flex items-center gap-1 ml-1">
                            <a href={getWhatsAppLink(selectedLead.telefono)} target="_blank" rel="noopener noreferrer" className="p-1 rounded-lg hover:bg-green-500/20 text-green-400 transition-all" title="WhatsApp"><MessageSquare size={14} /></a>
                            <a href={getCallLink(selectedLead.telefono)} className="p-1 rounded-lg hover:bg-cyan-500/20 text-cyan-400 transition-all" title="Llamar"><Phone size={14} /></a>
                          </span>
                        )}
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
                      {(() => {
                        const ids = [selectedLead.asignadoA, selectedLead.asignadoA2, selectedLead.asignadoA3].filter(Boolean);
                        if (ids.length === 0 && selectedLead.creadoPor) ids.push(selectedLead.creadoPor);
                        const usrs = ids.map(id => usuarios.find(u => u.id === id)).filter(Boolean);
                        return usrs.length > 0 ? <div className="flex items-center gap-2 font-medium">{usrs.map((u, i) => (
                          <span key={i} className="flex items-center gap-1">
                            {u.fotoUrl ? <img src={u.fotoUrl} alt={u.nombre} className="w-6 h-6 rounded-full object-cover inline-block" /> : null}
                            <span className={getColorUsuario(u.nombre)}>{u.nombre}</span>
                            {i < usrs.length - 1 ? ', ' : ''}
                          </span>
                        ))}</div> : <p className="text-white font-medium">-</p>;
                      })()}
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
                  <div className="pt-4 border-t border-slate-300/30">
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
                  {/* Formulario para crear/editar tarea - solo si puede editar el lead */}
                  {puedeEditarLead(selectedLead) && (
                    <div className="bg-teal-900/15 border border-teal-500/20 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-white font-medium">{editingTarea ? 'Editar Tarea' : 'Nueva Tarea'}</p>
                        {editingTarea && (
                          <button onClick={() => { setEditingTarea(null); setNewTarea({ descripcion: '', fechaCompromiso: '', hora: '', prioridad: 'media', recurrencia: 'ninguna' }); }} className="text-slate-400 hover:text-white text-xs">Cancelar</button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                        <input
                          type="text"
                          placeholder="Descripción *"
                          value={newTarea.descripcion}
                          onChange={(e) => setNewTarea({ ...newTarea, descripcion: e.target.value })}
                          className="md:col-span-2 px-3 py-2 bg-slate-700 border border-slate-300/40 rounded-lg text-white text-sm placeholder-slate-500"
                        />
                        <input
                          type="date"
                          value={newTarea.fechaCompromiso}
                          onChange={(e) => setNewTarea({ ...newTarea, fechaCompromiso: e.target.value })}
                          className="px-3 py-2 bg-slate-700 border border-slate-300/40 rounded-lg text-white text-sm"
                        />
                        <input
                          type="time"
                          value={newTarea.hora}
                          onChange={(e) => setNewTarea({ ...newTarea, hora: e.target.value })}
                          className="px-3 py-2 bg-slate-700 border border-slate-300/40 rounded-lg text-white text-sm"
                        />
                        <select
                          value={newTarea.recurrencia}
                          onChange={(e) => setNewTarea({ ...newTarea, recurrencia: e.target.value })}
                          className="px-3 py-2 bg-slate-700 border border-slate-300/40 rounded-lg text-white text-sm"
                        >
                          {RECURRENCIA_OPTIONS.map(r => (
                            <option key={r.id} value={r.id}>{r.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={editingTarea ? guardarEdicionTarea : crearTareaLead}
                          disabled={!newTarea.descripcion || !newTarea.fechaCompromiso}
                          className={`px-4 py-2 ${editingTarea ? 'bg-cyan-500 hover:bg-cyan-600' : 'bg-violet-500 hover:bg-violet-600'} disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all text-sm`}
                        >
                          {editingTarea ? 'Guardar' : 'Crear Tarea'}
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
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${tarea.completada ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300/40 hover:border-emerald-500'}`}
                          >
                            {tarea.completada && <CheckCircle size={14} className="text-white" />}
                          </button>
                          <div className="flex-1">
                            <p className={`text-white ${tarea.completada ? 'line-through' : ''}`}>{tarea.descripcion}</p>
                            <p className="text-slate-500 text-xs mt-1">Fecha límite: {formatDate(tarea.fechaCompromiso)}{tarea.hora ? ` ${tarea.hora}` : ''}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs ${tarea.prioridad === 'alta' ? 'bg-red-500/20 text-red-400' : tarea.prioridad === 'media' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-600/50 text-slate-400'}`}>
                            {tarea.prioridad}
                          </span>
                          {tarea.recurrencia && tarea.recurrencia !== 'ninguna' && (
                            <span className="px-2 py-1 rounded text-xs bg-cyan-500/20 text-cyan-400">{'\u21BB'} {RECURRENCIA_OPTIONS.find(r => r.id === tarea.recurrencia)?.label}</span>
                          )}
                          <a
                            href={buildGoogleCalendarUrl(tarea.descripcion, tarea.fechaCompromiso, tarea.hora, `Lead: ${selectedLead?.empresa}`, currentUser?.googleEmail || currentUser?.email)}
                            target="_blank" rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-blue-400 transition-colors" title="Agregar a Google Calendar"
                          ><Calendar size={14} /></a>
                          {puedeEditarLead(selectedLead) && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleEditTarea(tarea)} className="p-1.5 text-slate-400 hover:text-cyan-400 transition-colors" title="Editar"><Edit size={14} /></button>
                              <button onClick={() => handleDeleteTarea(tarea.id)} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Recordatorios */}
              {modalTab === 'recordatorios' && (
                <div className="space-y-4">
                  {/* Formulario para crear/editar recordatorio - solo si puede editar el lead */}
                  {puedeEditarLead(selectedLead) && (
                    <div className="bg-amber-900/15 border border-amber-500/20 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-white font-medium">{editingRecordatorio ? 'Editar Recordatorio' : 'Nuevo Recordatorio'}</p>
                        {editingRecordatorio && (
                          <button onClick={() => { setEditingRecordatorio(null); setNewRecordatorio({ titulo: '', fecha: '', hora: '', descripcion: '' }); }} className="text-slate-400 hover:text-white text-xs">Cancelar</button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        <input
                          type="text"
                          placeholder="Título *"
                          value={newRecordatorio.titulo}
                          onChange={(e) => setNewRecordatorio({ ...newRecordatorio, titulo: e.target.value })}
                          className="md:col-span-2 px-3 py-2 bg-slate-700 border border-slate-300/40 rounded-lg text-white text-sm placeholder-slate-500"
                        />
                        <input
                          type="date"
                          value={newRecordatorio.fecha}
                          onChange={(e) => setNewRecordatorio({ ...newRecordatorio, fecha: e.target.value })}
                          className="px-3 py-2 bg-slate-700 border border-slate-300/40 rounded-lg text-white text-sm"
                        />
                        <input
                          type="time"
                          value={newRecordatorio.hora}
                          onChange={(e) => setNewRecordatorio({ ...newRecordatorio, hora: e.target.value })}
                          className="px-3 py-2 bg-slate-700 border border-slate-300/40 rounded-lg text-white text-sm"
                        />
                        <button
                          onClick={editingRecordatorio ? guardarEdicionRecordatorio : crearRecordatorioLead}
                          disabled={!newRecordatorio.titulo || !newRecordatorio.fecha}
                          className={`px-4 py-2 ${editingRecordatorio ? 'bg-cyan-500 hover:bg-cyan-600' : 'bg-amber-500 hover:bg-amber-600'} disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all text-sm`}
                        >
                          {editingRecordatorio ? 'Guardar' : 'Crear'}
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
                            <p className="text-amber-400 text-sm">{formatDate(rec.fecha)}{rec.hora ? ` ${rec.hora}` : ''}</p>
                          </div>
                          <a
                            href={buildGoogleCalendarUrl(rec.titulo, rec.fecha, rec.hora, rec.descripcion ? `${rec.descripcion} — Lead: ${selectedLead?.empresa}` : `Lead: ${selectedLead?.empresa}`, currentUser?.googleEmail || currentUser?.email)}
                            target="_blank" rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-blue-400 transition-colors" title="Agregar a Google Calendar"
                          ><Calendar size={14} /></a>
                          {puedeEditarLead(selectedLead) && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleEditRecordatorio(rec)} className="p-1.5 text-slate-400 hover:text-cyan-400 transition-colors" title="Editar"><Edit size={14} /></button>
                              <button onClick={() => handleDeleteRecordatorio(rec.id)} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                            </div>
                          )}
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={() => setShowActividadForm(false)}>
          <div className="bg-slate-900 rounded-2xl border border-slate-300/40 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-modal-in" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{editingActividad ? 'Editar Actividad' : 'Nueva Actividad'}</h3>
              <button onClick={() => setShowActividadForm(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveActividad} className="p-6 space-y-4">
              <div className="bg-indigo-900/15 border border-indigo-500/20 rounded-xl p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <select value={actividadForm.tipo} onChange={(e) => setActividadForm({ ...actividadForm, tipo: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white">
                  {TIPOS_ACTIVIDAD.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input type="date" value={actividadForm.fecha} onChange={(e) => setActividadForm({ ...actividadForm, fecha: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white" />
              </div>
              <input type="text" placeholder="Título *" value={actividadForm.titulo} onChange={(e) => setActividadForm({ ...actividadForm, titulo: e.target.value })} className="w-full px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white placeholder-slate-500" required />
              <textarea placeholder="Descripción" value={actividadForm.descripcion} onChange={(e) => setActividadForm({ ...actividadForm, descripcion: e.target.value })} className="w-full px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white placeholder-slate-500 resize-none" rows="3"></textarea>
              <select value={actividadForm.responsableId} onChange={(e) => setActividadForm({ ...actividadForm, responsableId: e.target.value })} className="w-full px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white">
                <option value="">Responsable (yo mismo)</option>
                {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.id === currentUser?.id ? '(yo)' : ''}</option>)}
              </select>
              {/* Archivo adjunto */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Archivo adjunto</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-300/40 rounded-xl text-slate-300 cursor-pointer transition-all">
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

export default Leads;
