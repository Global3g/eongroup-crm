import React, { useState, useMemo } from 'react';
import {
  Plus, Trash2, Edit, Save, Search, Phone, Mail,
  Building, FileText, CheckCircle, Clock, X,
  Target, Loader, Upload, Download, Image,
  Tag, MessageSquare, Bell, PhoneCall,
  History, AlertCircle, User, Calendar, GitBranch,
  List, LayoutGrid, UserPlus, Users, Send, Video,
  Sparkles, Copy, ClipboardCheck
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { formatDate, generateId, getFechaLocal, getColorUsuario, abrirGoogleCalendar, completarTareaConRecurrencia, RECURRENCIA_OPTIONS } from '../utils/helpers';
import { TIPOS_ACTIVIDAD, TAGS_DISPONIBLES, FUENTES, PIPELINE_STAGES } from '../utils/constants';
import { getWhatsAppLink, getCallLink, getLastContactInfo, QUICK_COMM_TYPES } from '../utils/communication';
import DataTable from './ui/DataTable';
import FilterPanel from './ui/FilterPanel';
import Timeline from './ui/Timeline';
import EmptyState from './ui/EmptyState';
import { generarResumenCuenta } from '../utils/scoring';

function Cuentas({ cuentas, setCuentas, contactos, setContactos, pipeline, actividades, setActividades, recordatorios, setRecordatorios, tareas, setTareas, usuarios, currentUser, addNotificacion, setEmailDestinatario, setEmailModalOpen, todasLasIndustrias, addIndustria, editIndustria, deleteIndustria, todosLosServicios, addServicio, addAuditLog }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCuenta, setSelectedCuenta] = useState(null);
  const [showActividadForm, setShowActividadForm] = useState(false);
  const [showRecordatorioForm, setShowRecordatorioForm] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  // Form state for cuenta (company fields only)
  const [form, setForm] = useState({
    empresa: '', industria: '', servicio: '', sitioWeb: '', direccion: '', notas: '', numeroEmpleados: '', tags: [], asignadoA: '', asignadoA2: '', asignadoA3: '',
    fuente: '', referidoPor: '', esComisionista: false
  });
  // Separate contact form for adding contacts to a cuenta
  const [contactForm, setContactForm] = useState({
    nombre: '', cargo: '', email: '', telefono: ''
  });
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContactId, setEditingContactId] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [actividadForm, setActividadForm] = useState({
    tipo: 'llamada', titulo: '', descripcion: '', fecha: getFechaLocal(), responsableId: ''
  });
  const [actividadArchivo, setActividadArchivo] = useState(null);
  const [subiendoActividad, setSubiendoActividad] = useState(false);
  const [recordatorioForm, setRecordatorioForm] = useState({
    titulo: '', fecha: '', hora: '', descripcion: '', responsableId: ''
  });
  // Estados para edicion
  const [editingActividad, setEditingActividad] = useState(null);
  const [viewingActividad, setViewingActividad] = useState(null);
  const [editingRecordatorio, setEditingRecordatorio] = useState(null);
  // Estados para tareas
  const [showTareaForm, setShowTareaForm] = useState(false);
  const [editingTarea, setEditingTarea] = useState(null);
  const [tareaFormData, setTareaFormData] = useState({ descripcion: '', fechaCompromiso: '', hora: '', prioridad: 'media', responsableId: '' });
  // Tareas y recordatorios derivados de actividad
  const [tareasNuevas, setTareasNuevas] = useState([]);
  const [recordatoriosNuevos, setRecordatoriosNuevos] = useState([]);
  const [mostrarFormTarea, setMostrarFormTarea] = useState(false);
  const [mostrarFormRecordatorioNuevo, setMostrarFormRecordatorioNuevo] = useState(false);
  const [tareaTemp, setTareaTemp] = useState({ descripcion: '', fechaCompromiso: '', hora: '', prioridad: 'media', responsableId: '' });
  const [recordatorioTemp, setRecordatorioTemp] = useState({ titulo: '', fecha: '', hora: '', descripcion: '', responsableId: '' });
  const [editandoTareaExistenteId, setEditandoTareaExistenteId] = useState(null);
  const [editandoRecordatorioExistenteId, setEditandoRecordatorioExistenteId] = useState(null);
  const [showNewIndustria, setShowNewIndustria] = useState(false);
  const [newIndustriaName, setNewIndustriaName] = useState('');
  const [showManageIndustrias, setShowManageIndustrias] = useState(false);
  const [editingIndustriaItem, setEditingIndustriaItem] = useState(null);
  const [editIndustriaValue, setEditIndustriaValue] = useState('');
  const [showNewServicio, setShowNewServicio] = useState(false);
  const [newServicioName, setNewServicioName] = useState('');
  const [viewMode, setViewMode] = useState('tarjetas'); // 'lista' | 'tarjetas'
  const [advancedFilters, setAdvancedFilters] = useState([]);
  // Quick communication state
  const [quickComm, setQuickComm] = useState({ tipo: 'llamada', nota: '' });
  const [showQuickComm, setShowQuickComm] = useState(false);
  // Estado para resumen inteligente
  const [showResumen, setShowResumen] = useState(false);
  const [resumenTexto, setResumenTexto] = useState('');
  const [copiedResumen, setCopiedResumen] = useState(false);

  // Usuarios activos para asignar
  const usuariosActivos = (usuarios || []).filter(u => u.activo !== false);

  // Permisos del usuario actual para cuentas (fallback a permisos basicos, no admin)
  const permisos = currentUser?.permisos?.cuentas || { ver: 'todos', crear: true, editar: 'propios', eliminar: false };
  const permisosContactos = currentUser?.permisos?.contactos || { ver: 'todos', crear: true, editar: 'propios', eliminar: false };
  const permisosActividades = currentUser?.permisos?.actividades || { ver: 'todos', crear: true, editar: 'propios', eliminar: false };
  const permisosTareas = currentUser?.permisos?.tareas || { ver: 'todos', crear: true, editar: 'propios', eliminar: 'propios' };
  const permisosRecordatorios = currentUser?.permisos?.recordatorios || { ver: 'todos', crear: true, editar: 'propios', eliminar: 'propios' };

  const puedeCrear = permisos.crear === true;
  const esAdmin = currentUser?.permisos?.modulos?.equipo === true;

  // Funcion para verificar si puede editar una cuenta especifica
  const puedeEditarCuenta = (cuenta) => {
    if (!cuenta) return false;
    if (esAdmin) return true;
    if (permisos.editar === 'todos' || permisos.editar === true) return true;
    if (permisos.editar === 'propios') {
      return cuenta.asignadoA === currentUser?.id || cuenta.asignadoA2 === currentUser?.id || cuenta.asignadoA3 === currentUser?.id || cuenta.creadoPor === currentUser?.id;
    }
    return false;
  };

  // Funcion para verificar si puede eliminar una cuenta especifica
  const puedeEliminarCuenta = (cuenta) => {
    if (!cuenta) return false;
    if (esAdmin) return true;
    if (permisos.eliminar === 'todos' || permisos.eliminar === true) return true;
    if (permisos.eliminar === 'propios') {
      return cuenta.asignadoA === currentUser?.id || cuenta.asignadoA2 === currentUser?.id || cuenta.asignadoA3 === currentUser?.id || cuenta.creadoPor === currentUser?.id;
    }
    return false;
  };

  // Funciones de permisos para contactos
  const puedeCrearContacto = permisosContactos.crear === true;

  const puedeEditarContacto = (contacto) => {
    if (!contacto) return false;
    if (esAdmin) return true;
    if (permisosContactos.editar === 'todos' || permisosContactos.editar === true) return true;
    if (permisosContactos.editar === 'propios') {
      return contacto.creadoPor === currentUser?.id;
    }
    return false;
  };

  const puedeEliminarContacto = (contacto) => {
    if (!contacto) return false;
    if (esAdmin) return true;
    if (permisosContactos.eliminar === 'todos' || permisosContactos.eliminar === true) return true;
    if (permisosContactos.eliminar === 'propios') {
      return contacto.creadoPor === currentUser?.id;
    }
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
    setForm({ empresa: '', industria: '', servicio: '', sitioWeb: '', direccion: '', notas: '', numeroEmpleados: '', tags: [], asignadoA: '', asignadoA2: '', asignadoA3: '', fuente: '', referidoPor: '', esComisionista: false });
    setContactForm({ nombre: '', cargo: '', email: '', telefono: '' });
    setShowForm(false);
    setEditingId(null);
    setShowNewIndustria(false);
    setNewIndustriaName('');
    setShowManageIndustrias(false);
    setEditingIndustriaItem(null);
    setShowNewServicio(false);
    setNewServicioName('');
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Solo se permiten archivos de imagen');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('La imagen no debe superar 5MB');
        return;
      }
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
      // Subir logo si se selecciono uno
      if (logoFile) {
        const timestamp = Date.now();
        const fileName = `cuentas/logos/${editingId || 'new'}_${timestamp}_${logoFile.name}`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, logoFile);
        logoUrl = await getDownloadURL(storageRef);
      }
    } catch (err) {
      console.error('Error al subir logo:', err);
      alert('Error al subir el logo. La cuenta se guardara sin logo.');
    }
    setSubiendoLogo(false);

    // Asegurar que no haya valores undefined
    const cleanForm = {
      empresa: form.empresa || '',
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
      const cuentaActual = cuentas.find(c => c.id === editingId);
      const logoFinal = logoUrl || (logoPreview ? cuentaActual?.logoUrl || '' : '');
      setCuentas(cuentas.map(c => c.id === editingId ? { id: c.id, fechaCreacion: c.fechaCreacion || '', creadoPor: c.creadoPor, ...cleanForm, logoUrl: logoFinal, asignadoA: form.asignadoA || c.asignadoA || currentUser?.id, asignadoA2: form.asignadoA2 || '', asignadoA3: form.asignadoA3 || '' } : c));
      addAuditLog('editar', 'cuentas', `Cuenta editada: ${cleanForm.empresa}`, editingId, cleanForm.empresa);
    } else {
      const nuevaCuenta = { ...cleanForm, logoUrl: logoUrl || '', id: generateId(), fechaCreacion: getFechaLocal(), creadoPor: currentUser?.id, asignadoA: form.asignadoA || currentUser?.id, asignadoA2: form.asignadoA2 || '', asignadoA3: form.asignadoA3 || '' };
      setCuentas([...cuentas, nuevaCuenta]);
      addAuditLog('crear', 'cuentas', `Nueva cuenta: ${cleanForm.empresa}`, nuevaCuenta.id, cleanForm.empresa);

      // Si es nueva cuenta y se proporcionaron datos de contacto, crear contacto principal
      if (contactForm.nombre) {
        const nuevoContacto = {
          id: generateId(),
          cuentaId: nuevaCuenta.id,
          nombre: contactForm.nombre || '',
          cargo: contactForm.cargo || '',
          email: contactForm.email || '',
          telefono: contactForm.telefono || '',
          esPrincipal: true,
          fechaCreacion: getFechaLocal(),
          creadoPor: currentUser?.id
        };
        setContactos([...(contactos || []), nuevoContacto]);
        addAuditLog('crear', 'contactos', `Contacto principal: ${contactForm.nombre} (${cleanForm.empresa})`, nuevoContacto.id, contactForm.nombre);
      }
    }
    resetForm();
  };

  const handleEdit = (cuenta) => {
    setForm({
      empresa: cuenta.empresa || '',
      industria: cuenta.industria || '',
      servicio: cuenta.servicio || '',
      sitioWeb: cuenta.sitioWeb || '',
      direccion: cuenta.direccion || '',
      notas: cuenta.notas || '',
      numeroEmpleados: cuenta.numeroEmpleados || '',
      tags: cuenta.tags || [],
      asignadoA: cuenta.asignadoA || '',
      asignadoA2: cuenta.asignadoA2 || '',
      asignadoA3: cuenta.asignadoA3 || '',
      fuente: cuenta.fuente || '',
      referidoPor: cuenta.referidoPor || '',
      esComisionista: cuenta.esComisionista || false
    });
    setEditingId(cuenta.id);
    setLogoFile(null);
    setLogoPreview(cuenta.logoUrl || null);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    const cuenta = cuentas.find(c => c.id === id);
    const contactosCuenta = (contactos || []).filter(c => c.cuentaId === id);
    const mensaje = contactosCuenta.length > 0
      ? `¿Eliminar esta cuenta?\n\nTambien se eliminaran ${contactosCuenta.length} contacto(s) asociados.`
      : '¿Eliminar esta cuenta?';
    if (window.confirm(mensaje)) {
      setCuentas(cuentas.filter(c => c.id !== id));
      // Eliminar contactos asociados
      if (contactosCuenta.length > 0) {
        setContactos((contactos || []).filter(c => c.cuentaId !== id));
      }
      if (cuenta) {
        addAuditLog('eliminar', 'cuentas', `Cuenta eliminada: ${cuenta.empresa}`, id, cuenta.empresa);
      }
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

  // ====== Contacto CRUD ======
  const handleAddContacto = (e) => {
    e.preventDefault();
    if (!contactForm.nombre) return;
    const contactosCuenta = (contactos || []).filter(c => c.cuentaId === selectedCuenta);

    if (editingContactId) {
      // Modo edicion
      setContactos((contactos || []).map(c => c.id === editingContactId ? {
        ...c,
        nombre: contactForm.nombre || '',
        cargo: contactForm.cargo || '',
        email: contactForm.email || '',
        telefono: contactForm.telefono || ''
      } : c));
      setEditingContactId(null);
    } else {
      // Nuevo contacto
      const nuevoContacto = {
        id: generateId(),
        cuentaId: selectedCuenta,
        nombre: contactForm.nombre || '',
        cargo: contactForm.cargo || '',
        email: contactForm.email || '',
        telefono: contactForm.telefono || '',
        esPrincipal: contactosCuenta.length === 0, // Primer contacto es principal
        fechaCreacion: getFechaLocal(),
        creadoPor: currentUser?.id
      };
      setContactos([...(contactos || []), nuevoContacto]);

      const cuenta = cuentas.find(c => c.id === selectedCuenta);
      addAuditLog('crear', 'contactos', `Nuevo contacto: ${contactForm.nombre} (${cuenta?.empresa || ''})`, nuevoContacto.id, contactForm.nombre);
    }
    setContactForm({ nombre: '', cargo: '', email: '', telefono: '' });
    setShowContactForm(false);
  };

  const handleEditContacto = (contacto) => {
    setContactForm({
      nombre: contacto.nombre || '',
      cargo: contacto.cargo || '',
      email: contacto.email || '',
      telefono: contacto.telefono || ''
    });
    setEditingContactId(contacto.id);
    setShowContactForm(true);
  };

  const handleDeleteContacto = (id) => {
    const contacto = (contactos || []).find(c => c.id === id);
    if (contacto?.esPrincipal) {
      if (!window.confirm('Este es el contacto principal. ¿Desea eliminarlo de todos modos?')) return;
    } else {
      if (!window.confirm('¿Eliminar este contacto?')) return;
    }
    setContactos((contactos || []).filter(c => c.id !== id));
    // Si se elimino el principal, hacer principal al siguiente
    if (contacto?.esPrincipal) {
      const restantes = (contactos || []).filter(c => c.cuentaId === contacto.cuentaId && c.id !== id);
      if (restantes.length > 0) {
        setContactos(prev => prev.map(c => c.id === restantes[0].id ? { ...c, esPrincipal: true } : c));
      }
    }
  };

  const handleSetPrincipal = (contactoId) => {
    const contacto = (contactos || []).find(c => c.id === contactoId);
    if (!contacto) return;
    setContactos((contactos || []).map(c => {
      if (c.cuentaId === contacto.cuentaId) {
        return { ...c, esPrincipal: c.id === contactoId };
      }
      return c;
    }));
  };

  // ====== Actividad CRUD ======
  const handleAddActividad = async (e) => {
    e.preventDefault();
    setSubiendoActividad(true);

    try {
      let archivoData = null;

      // Subir archivo si existe
      if (actividadArchivo) {
        const timestamp = Date.now();
        const fileName = `actividades/${selectedCuenta}/${timestamp}_${actividadArchivo.name}`;
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

      const cuenta = cuentas.find(c => c.id === selectedCuenta);
      const responsableId = actividadForm.responsableId || currentUser?.id;

      let actividadId;

      if (editingActividad) {
        // Modo edicion
        actividadId = editingActividad.id;
        setActividades(actividades.map(a => a.id === editingActividad.id ? {
          ...a,
          ...actividadForm,
          responsableId,
          archivo: archivoData || a.archivo
        } : a));
        setEditingActividad(null);
      } else {
        // Nueva actividad - use cuentaId, keep clienteId for backwards compat
        actividadId = generateId();
        const nuevaActividad = {
          ...actividadForm,
          id: actividadId,
          cuentaId: selectedCuenta,
          clienteId: selectedCuenta, // backwards compat
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
            `Nueva actividad asignada: ${actividadForm.descripcion || actividadForm.tipo} - Cuenta: ${cuenta?.empresa || 'Cuenta'}`,
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
          cuentaId: selectedCuenta,
          clienteId: selectedCuenta, // backwards compat
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
          cuentaId: selectedCuenta,
          clienteId: selectedCuenta, // backwards compat
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
      ? `¿Eliminar esta actividad?\n\nTambien se eliminaran:\n- ${tareasVinculadas.length} tarea(s)\n- ${recordatoriosVinculados.length} recordatorio(s)\n\nvinculados a esta actividad.`
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

  // ====== Recordatorio CRUD ======
  const handleAddRecordatorio = (e) => {
    e.preventDefault();
    const cuenta = cuentas.find(c => c.id === selectedCuenta);
    const responsableId = recordatorioForm.responsableId || currentUser?.id;

    if (editingRecordatorio) {
      // Modo edicion
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
        cuentaId: selectedCuenta,
        clienteId: selectedCuenta, // backwards compat
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
          `Nuevo recordatorio asignado: ${recordatorioForm.titulo} - Cuenta: ${cuenta?.empresa || 'Cuenta'} - Fecha: ${formatDate(recordatorioForm.fecha)}`,
          'recordatorio'
        );
      }
    }

    setRecordatorioForm({ titulo: '', fecha: '', hora: '', descripcion: '', responsableId: '' });
    setShowRecordatorioForm(false);
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

  // ====== Tarea CRUD ======
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
    const cuenta = cuentas.find(c => c.id === selectedCuenta);
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
        cuentaId: selectedCuenta,
        clienteId: selectedCuenta, // backwards compat
        responsableId,
        creadoPor: currentUser?.id,
        completada: false,
        recurrencia: tareaFormData.recurrencia || 'ninguna',
        fechaCreacion: new Date().toISOString()
      };
      setTareas([...tareas, nuevaTarea]);

      if (responsableId && responsableId !== currentUser?.id && addNotificacion) {
        addNotificacion(
          responsableId,
          `Nueva tarea asignada: ${tareaFormData.descripcion} - Cuenta: ${cuenta?.empresa || 'Cuenta'}`,
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

  // ====== Tareas/recordatorios temporales (desde modal actividad) ======
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

  // ====== Quick Comm icon map ======
  const QUICK_COMM_ICON_MAP = { PhoneCall, MessageSquare, Send, FileText, Users, Video };

  // Handler para registro rapido de comunicacion
  const handleQuickComm = () => {
    if (!quickComm.nota.trim()) return;
    const cuenta = cuentas.find(c => c.id === selectedCuenta);
    const tipoInfo = QUICK_COMM_TYPES.find(t => t.id === quickComm.tipo);
    const nuevaActividad = {
      id: generateId(),
      tipo: quickComm.tipo,
      titulo: `${tipoInfo?.label || quickComm.tipo}: ${quickComm.nota.slice(0, 60)}`,
      descripcion: quickComm.nota,
      fecha: getFechaLocal(),
      cuentaId: selectedCuenta,
      clienteId: selectedCuenta,
      responsableId: currentUser?.id,
      creadoPor: currentUser?.id,
      fechaCreacion: new Date().toISOString(),
      archivo: null
    };
    setActividades([...actividades, nuevaActividad]);
    addAuditLog && addAuditLog('crear', 'actividades', `Registro rapido (${tipoInfo?.label}): ${quickComm.nota.slice(0, 80)}`, nuevaActividad.id, cuenta?.empresa || '');
    setQuickComm({ tipo: 'llamada', nota: '' });
    setShowQuickComm(false);
  };

  // ====== Derived data for selected cuenta ======

  // Obtener contactos de la cuenta seleccionada
  const contactosCuenta = (contactos || [])
    .filter(c => c.cuentaId === selectedCuenta)
    .sort((a, b) => (b.esPrincipal ? 1 : 0) - (a.esPrincipal ? 1 : 0));

  // Contacto principal de la cuenta seleccionada
  const contactoPrincipal = contactosCuenta.find(c => c.esPrincipal) || contactosCuenta[0] || null;

  // Obtener actividades de la cuenta seleccionada (backwards compat: check both cuentaId and clienteId)
  const actividadesCuenta = actividades
    .filter(a => a.cuentaId === selectedCuenta || a.clienteId === selectedCuenta)
    .sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));

  // Obtener recordatorios de la cuenta seleccionada
  const recordatoriosCuenta = recordatorios
    .filter(r => (r.cuentaId === selectedCuenta || r.clienteId === selectedCuenta))
    .filter(r => esAdmin || r.creadoPor === currentUser?.id || r.responsableId === currentUser?.id)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  // Obtener tareas de la cuenta seleccionada
  const tareasCuenta = (tareas || [])
    .filter(t => (t.cuentaId === selectedCuenta || t.clienteId === selectedCuenta))
    .filter(t => esAdmin || t.creadoPor === currentUser?.id || t.responsableId === currentUser?.id)
    .sort((a, b) => new Date(a.fechaCompromiso) - new Date(b.fechaCompromiso));

  // Timeline: combinar actividades y cambios de pipeline
  const getTimeline = (cuentaId) => {
    const eventos = [];

    // Actividades (backwards compat)
    actividades.filter(a => a.cuentaId === cuentaId || a.clienteId === cuentaId).forEach(a => {
      const responsable = usuarios.find(u => u.id === a.responsableId);
      eventos.push({
        id: a.id,
        tipo: 'actividad',
        subtipo: a.tipo,
        titulo: a.titulo,
        descripcion: a.descripcion,
        fecha: a.fechaCreacion,
        responsableNombre: responsable?.nombre || '',
        archivo: a.archivo,
      });
    });

    // Proyectos en pipeline (backwards compat)
    pipeline.filter(p => p.cuentaId === cuentaId || p.clienteId === cuentaId).forEach(p => {
      eventos.push({
        id: p.id,
        tipo: 'pipeline',
        titulo: `Proyecto: ${p.nombre}`,
        descripcion: `Etapa: ${PIPELINE_STAGES.find(s => s.id === p.etapa)?.name}`,
        fecha: p.fechaCreacion,
        responsableNombre: '',
      });
    });

    return eventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  };

  // ====== Filtering & search ======

  // Filtrar por alcance de visualizacion
  const cuentasPorAlcance = permisos.ver === 'propios'
    ? cuentas.filter(c => c.asignadoA === currentUser?.id || c.asignadoA2 === currentUser?.id || c.asignadoA3 === currentUser?.id || c.creadoPor === currentUser?.id)
    : cuentas;

  // Helper to get primary contact for a cuenta (for search/display)
  const getContactoPrincipal = (cuentaId) => {
    const ctcs = (contactos || []).filter(c => c.cuentaId === cuentaId);
    return ctcs.find(c => c.esPrincipal) || ctcs[0] || null;
  };

  const searchFiltered = cuentasPorAlcance.filter(c => {
    const cp = getContactoPrincipal(c.id);
    return (
      c.empresa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cp?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.industria?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Apply advanced filters
  const filteredCuentas = useMemo(() => {
    if (advancedFilters.length === 0) return searchFiltered;
    return searchFiltered.filter(c => {
      return advancedFilters.every(cond => {
        let val;
        if (cond.field === 'contacto') {
          const cp = getContactoPrincipal(c.id);
          val = String(cp?.nombre || '').toLowerCase();
        } else {
          val = String(c[cond.field] || '').toLowerCase();
        }
        const target = String(cond.value).toLowerCase();
        switch (cond.operator) {
          case 'es': return val === target;
          case 'contiene': return val.includes(target);
          case 'no_contiene': return !val.includes(target);
          case 'empieza': return val.startsWith(target);
          case 'no_es': return val !== target;
          default: return true;
        }
      });
    });
  }, [searchFiltered, advancedFilters]);

  // FilterPanel field definitions
  const filterFields = useMemo(() => [
    { key: 'empresa', label: 'Empresa', type: 'text' },
    { key: 'contacto', label: 'Contacto Principal', type: 'text' },
    { key: 'industria', label: 'Industria', type: 'select', options: todasLasIndustrias.map(i => ({ value: i, label: i })) },
    { key: 'servicio', label: 'Servicio', type: 'select', options: todosLosServicios.map(s => ({ value: s, label: s })) },
    { key: 'asignadoA', label: 'Asignado a', type: 'select', options: usuariosActivos.map(u => ({ value: u.id, label: u.nombre })) },
    { key: 'fuente', label: 'Fuente', type: 'select', options: FUENTES.map(f => ({ value: f, label: f })) },
  ], [todasLasIndustrias, todosLosServicios, usuariosActivos]);

  // DataTable columns
  const tableColumns = useMemo(() => [
    {
      key: 'empresa',
      label: 'Empresa',
      sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-3">
          {row.logoUrl ? (
            <img src={row.logoUrl} alt={val} className="w-8 h-8 rounded-lg object-cover border border-slate-300/40 flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center flex-shrink-0">
              <Building className="w-4 h-4 text-cyan-400" />
            </div>
          )}
          <span className="text-white font-medium">{val}</span>
        </div>
      ),
    },
    {
      key: 'contacto',
      label: 'Contacto Principal',
      sortable: true,
      render: (val, row) => {
        const cp = getContactoPrincipal(row.id);
        return cp ? <span className="text-slate-300">{cp.nombre}</span> : <span className="text-slate-500">-</span>;
      },
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      render: (val, row) => {
        const cp = getContactoPrincipal(row.id);
        return cp?.email ? <span className="text-cyan-400">{cp.email}</span> : '-';
      },
    },
    {
      key: 'telefono',
      label: 'Telefono',
      sortable: false,
      render: (val, row) => {
        const cp = getContactoPrincipal(row.id);
        return cp?.telefono ? (
          <span className="flex items-center gap-1.5">
            <Phone className="w-3 h-3 text-emerald-400" />{cp.telefono}
            <a href={getWhatsAppLink(cp.telefono)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-green-400 hover:text-green-300" title="WhatsApp"><MessageSquare className="w-3.5 h-3.5" /></a>
            <a href={getCallLink(cp.telefono)} onClick={(e) => e.stopPropagation()} className="text-cyan-400 hover:text-cyan-300" title="Llamar"><PhoneCall className="w-3.5 h-3.5" /></a>
          </span>
        ) : '-';
      },
    },
    {
      key: 'ultimoContacto',
      label: 'Ultimo Contacto',
      sortable: false,
      render: (val, row) => {
        const lastContact = getLastContactInfo(row.id, actividades);
        return <span className={`text-xs font-medium ${lastContact.color}`}>{lastContact.texto}</span>;
      },
    },
    {
      key: 'industria',
      label: 'Industria',
      sortable: true,
      render: (val) => val ? <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded-full">{val}</span> : '-',
    },
    {
      key: 'servicio',
      label: 'Servicio',
      sortable: true,
      render: (val) => val ? <span className="px-2 py-0.5 text-xs bg-violet-500/20 text-violet-400 rounded-full">{val}</span> : '-',
    },
    {
      key: 'asignadoA',
      label: 'Asignado a',
      sortable: true,
      render: (val) => {
        const u = usuarios.find(u => u.id === val);
        return u ? <span className={`text-xs font-medium ${getColorUsuario(u.nombre)}`}>{u.nombre}</span> : '-';
      },
    },
  ], [usuarios, contactos]);

  const handleBulkDelete = (ids) => {
    if (window.confirm(`¿Eliminar ${ids.length} cuenta(s) seleccionadas?`)) {
      setCuentas(cuentas.filter(c => !ids.includes(c.id)));
      // Eliminar contactos asociados
      setContactos((contactos || []).filter(c => !ids.includes(c.cuentaId)));
    }
  };

  // ====== DETAIL VIEW ======
  if (selectedCuenta) {
    const cuenta = cuentas.find(c => c.id === selectedCuenta);
    const proyectosCuenta = pipeline.filter(p => p.cuentaId === selectedCuenta || p.clienteId === selectedCuenta);
    const timeline = getTimeline(selectedCuenta);

    return (
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        {/* Detail Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <button onClick={() => { setSelectedCuenta(null); setActiveTab('info'); }} className="p-2 hover:bg-slate-800 rounded-xl transition-all">
              <X size={24} className="text-slate-400" />
            </button>
            {cuenta?.logoUrl ? (
              <img src={cuenta.logoUrl} alt={cuenta.empresa} className="w-12 h-12 rounded-xl object-cover border-2 border-slate-300/40" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center">
                <Building className="w-6 h-6 text-cyan-400" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-white">{cuenta?.empresa}</h1>
                {(cuenta?.tags || []).map(tagId => {
                  const tag = TAGS_DISPONIBLES.find(t => t.id === tagId);
                  return tag ? (
                    <span key={tagId} className={`px-2 py-0.5 rounded text-xs text-white ${tag.color}`}>{tag.name}</span>
                  ) : null;
                })}
              </div>
              <p className="text-slate-400">{cuenta?.industria}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {puedeEditarCuenta(cuenta) && (
              <>
                <button onClick={() => { setEditingActividad(null); setActividadForm({ tipo: 'llamada', titulo: '', descripcion: '', fecha: getFechaLocal(), responsableId: '' }); setTareasNuevas([]); setRecordatoriosNuevos([]); setShowActividadForm(true); }} className="flex items-center gap-2 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-400 px-3 sm:px-4 py-2 rounded-xl transition-all text-sm sm:text-base">
                  <Plus size={16} /> Actividad
                </button>
                <button onClick={() => { setEditingTarea(null); setTareaFormData({ descripcion: '', fechaCompromiso: getFechaLocal(), hora: '', prioridad: 'media', responsableId: '' }); setShowTareaForm(true); }} className="flex items-center gap-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 px-3 sm:px-4 py-2 rounded-xl transition-all text-sm sm:text-base">
                  <Target size={16} /> Tarea
                </button>
                <button onClick={() => { setEditingRecordatorio(null); setRecordatorioForm({ titulo: '', fecha: '', hora: '', descripcion: '', responsableId: '' }); setShowRecordatorioForm(true); }} className="flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 px-3 sm:px-4 py-2 rounded-xl transition-all text-sm sm:text-base">
                  <Bell size={16} /> Recordatorio
                </button>
              </>
            )}
            <button
              onClick={() => {
                const cuentaContactos = (contactos || []).filter(c => c.cuentaId === selectedCuenta);
                const cuentaPipeline = (pipeline || []).filter(p => p.cuentaId === selectedCuenta || p.clienteId === selectedCuenta);
                const cuentaActividades = (actividades || []).filter(a => a.cuentaId === selectedCuenta || a.clienteId === selectedCuenta);
                const cuentaTareas = (tareas || []).filter(t => t.cuentaId === selectedCuenta || t.clienteId === selectedCuenta);
                const cuentaRecordatorios = (recordatorios || []).filter(r => r.cuentaId === selectedCuenta || r.clienteId === selectedCuenta);
                const resumen = generarResumenCuenta(cuenta, cuentaContactos, cuentaPipeline, cuentaActividades, cuentaTareas, cuentaRecordatorios);
                setResumenTexto(resumen);
                setShowResumen(true);
              }}
              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-violet-500/20 to-cyan-500/20 border border-violet-500/30 text-violet-400 hover:text-white rounded-xl transition-all text-sm"
            >
              <Sparkles size={16} />
              Resumen IA
            </button>
          </div>
        </div>

        {/* Panel Resumen Inteligente */}
        {showResumen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
            <div className="bg-slate-900 border border-violet-500/30 rounded-3xl w-[calc(100%-16px)] sm:w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl shadow-violet-500/10 mx-2 sm:mx-4 animate-modal-in">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-violet-500/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-violet-500/20 to-cyan-500/20 rounded-xl">
                    <Sparkles size={20} className="text-violet-400" />
                  </div>
                  <h3 className="text-lg font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                    Resumen Inteligente
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(resumenTexto);
                      setCopiedResumen(true);
                      setTimeout(() => setCopiedResumen(false), 2000);
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-300/40 text-slate-300 hover:text-white rounded-xl transition-all text-sm"
                  >
                    {copiedResumen ? <ClipboardCheck size={16} className="text-emerald-400" /> : <Copy size={16} />}
                    {copiedResumen ? 'Copiado!' : 'Copiar'}
                  </button>
                  <button
                    onClick={() => setShowResumen(false)}
                    className="p-2 hover:bg-slate-800 rounded-xl transition-all text-slate-400 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="whitespace-pre-wrap text-sm text-slate-300 font-mono leading-relaxed bg-slate-800/50 rounded-xl p-4 border border-slate-300/40">
                  {resumenTexto}
                </div>
              </div>
              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setShowResumen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all text-sm"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
          {[
            { id: 'info', name: 'Informacion', icon: Building },
            { id: 'contactos', name: 'Contactos', icon: Users, count: contactosCuenta.length },
            { id: 'actividades', name: 'Actividades', icon: PhoneCall, count: actividadesCuenta.length },
            { id: 'tareas', name: 'Tareas', icon: Target, count: tareasCuenta.filter(t => !t.completada).length },
            { id: 'recordatorios', name: 'Recordatorios', icon: Bell, count: recordatoriosCuenta.filter(r => !r.completado).length },
            { id: 'deals', name: 'Deals', icon: GitBranch, count: proyectosCuenta.length }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl transition-all ${activeTab === tab.id ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-lg shadow-cyan-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
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
          <div className="bg-indigo-900/15 border border-indigo-500/20 rounded-2xl p-3 sm:p-4 md:p-5">
            <h3 className="text-lg font-semibold text-white mb-4">{editingActividad ? 'Editar Actividad' : 'Nueva Actividad'}</h3>
            <form onSubmit={handleAddActividad} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <select value={actividadForm.tipo} onChange={(e) => setActividadForm({ ...actividadForm, tipo: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white">
                  {TIPOS_ACTIVIDAD.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input type="date" value={actividadForm.fecha} onChange={(e) => setActividadForm({ ...actividadForm, fecha: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white" />
                <input type="text" placeholder="Titulo *" value={actividadForm.titulo} onChange={(e) => setActividadForm({ ...actividadForm, titulo: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500" required />
                <select value={actividadForm.responsableId} onChange={(e) => setActividadForm({ ...actividadForm, responsableId: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white">
                  <option value="">Asignar a... (yo mismo)</option>
                  {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.id === currentUser?.id ? '(yo)' : ''}</option>)}
                </select>
                <textarea placeholder="Descripcion" value={actividadForm.descripcion} onChange={(e) => setActividadForm({ ...actividadForm, descripcion: e.target.value })} className="sm:col-span-2 px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 resize-none" rows="3"></textarea>
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 text-sm mb-2">Adjuntar archivo (opcional)</label>
                  <div className="border-2 border-dashed border-slate-300/40 rounded-xl p-4 text-center hover:border-violet-500/50 transition-all">
                    <input type="file" onChange={(e) => setActividadArchivo(e.target.files[0])} className="hidden" id="actividad-file-cuenta" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp" />
                    <label htmlFor="actividad-file-cuenta" className="cursor-pointer">
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

              {/* Tareas derivadas */}
              <div className="border-t border-slate-300/30 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-cyan-400 flex items-center gap-2"><Target size={16} />Tareas derivadas</h4>
                  <button type="button" onClick={() => setMostrarFormTarea(!mostrarFormTarea)} className="text-xs px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30">{mostrarFormTarea ? 'Cancelar' : '+ Agregar'}</button>
                </div>
                {editingActividad && (() => {
                  const tareasExistentes = (tareas || []).filter(t => t.actividadId === editingActividad.id);
                  if (tareasExistentes.length === 0) return null;
                  return (<div className="mb-3 space-y-2">{tareasExistentes.map(t => (<div key={t.id} className={`flex items-center justify-between p-3 rounded-lg ${t.completada ? 'bg-emerald-500/10' : 'bg-slate-700/50'}`}><div className="flex items-center gap-3"><button type="button" onClick={() => { const { newTareas } = completarTareaConRecurrencia(tareas, t.id, generateId); setTareas(newTareas); }}>{t.completada ? <CheckCircle size={16} className="text-emerald-400" /> : <Clock size={16} className="text-slate-400" />}</button><div><p className={`text-sm ${t.completada ? 'text-emerald-300 line-through' : 'text-white'}`}>{t.descripcion}</p><p className="text-slate-500 text-xs">{formatDate(t.fechaCompromiso)}{t.hora ? ` ${t.hora}` : ''}</p></div></div><div className="flex items-center gap-1"><button type="button" onClick={() => editarTareaExistente(t)} className="p-1 text-cyan-400 hover:bg-cyan-500/20 rounded"><Edit size={14} /></button><button type="button" onClick={() => { if (window.confirm('¿Eliminar?')) setTareas(tareas.filter(ta => ta.id !== t.id)); }} className="p-1 text-red-400 hover:bg-red-500/20 rounded"><Trash2 size={14} /></button></div></div>))}</div>);
                })()}
                {mostrarFormTarea && (
                  <div className="bg-slate-800/50 rounded-xl p-4 mb-3 space-y-3">
                    <input type="text" placeholder="Descripcion *" value={tareaTemp.descripcion} onChange={(e) => setTareaTemp({ ...tareaTemp, descripcion: e.target.value })} className="w-full px-3 py-2 bg-slate-700 border border-slate-300/40 rounded-lg text-white text-sm" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <input type="date" value={tareaTemp.fechaCompromiso} onChange={(e) => setTareaTemp({ ...tareaTemp, fechaCompromiso: e.target.value })} className="px-3 py-2 bg-slate-700 border border-slate-300/40 rounded-lg text-white text-sm" />
                      <input type="time" value={tareaTemp.hora} onChange={(e) => setTareaTemp({ ...tareaTemp, hora: e.target.value })} className="px-3 py-2 bg-slate-700 border border-slate-300/40 rounded-lg text-white text-sm" />
                      <select value={tareaTemp.prioridad} onChange={(e) => setTareaTemp({ ...tareaTemp, prioridad: e.target.value })} className="px-3 py-2 bg-slate-700 border border-slate-300/40 rounded-lg text-white text-sm"><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option></select>
                      <select value={tareaTemp.recurrencia || 'ninguna'} onChange={(e) => setTareaTemp({ ...tareaTemp, recurrencia: e.target.value })} className="px-3 py-2 bg-slate-700 border border-slate-300/40 rounded-lg text-white text-sm">{RECURRENCIA_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}</select>
                      <select value={tareaTemp.responsableId} onChange={(e) => setTareaTemp({ ...tareaTemp, responsableId: e.target.value })} className="px-3 py-2 bg-slate-700 border border-slate-300/40 rounded-lg text-white text-sm"><option value="">Yo mismo</option>{usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={agregarTareaTemp} className="text-xs px-4 py-2 bg-cyan-500 text-white rounded-lg">{editandoTareaExistenteId ? 'Guardar cambios' : 'Agregar'}</button>
                      {editandoTareaExistenteId && (<button type="button" onClick={() => { setEditandoTareaExistenteId(null); setTareaTemp({ descripcion: '', fechaCompromiso: '', hora: '', prioridad: 'media', responsableId: '' }); setMostrarFormTarea(false); }} className="text-xs px-4 py-2 bg-slate-600 text-white rounded-lg">Cancelar</button>)}
                    </div>
                  </div>
                )}
                {tareasNuevas.length > 0 && (<div className="space-y-2">{tareasNuevas.map(t => (<div key={t.id} className="flex items-center justify-between bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3"><div className="flex items-center gap-3"><Target size={14} className="text-cyan-400" /><div><p className="text-white text-sm">{t.descripcion}</p><p className="text-slate-500 text-xs">{formatDate(t.fechaCompromiso)}{t.hora ? ` ${t.hora}` : ''}</p></div></div><button type="button" onClick={() => eliminarTareaTemp(t.id)} className="p-1 text-red-400 hover:bg-red-500/20 rounded"><Trash2 size={14} /></button></div>))}</div>)}
              </div>

              {/* Recordatorios derivados */}
              <div className="border-t border-slate-300/30 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-amber-400 flex items-center gap-2"><Bell size={16} />Recordatorios derivados</h4>
                  <button type="button" onClick={() => setMostrarFormRecordatorioNuevo(!mostrarFormRecordatorioNuevo)} className="text-xs px-3 py-1 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30">{mostrarFormRecordatorioNuevo ? 'Cancelar' : '+ Agregar'}</button>
                </div>
                {editingActividad && (() => {
                  const recordatoriosExistentes = recordatorios.filter(r => r.actividadId === editingActividad.id);
                  if (recordatoriosExistentes.length === 0) return null;
                  return (<div className="mb-3 space-y-2">{recordatoriosExistentes.map(r => (<div key={r.id} className={`flex items-center justify-between p-3 rounded-lg ${r.completado ? 'bg-emerald-500/10' : 'bg-slate-700/50'}`}><div className="flex items-center gap-3"><button type="button" onClick={() => setRecordatorios(recordatorios.map(re => re.id === r.id ? { ...re, completado: !re.completado } : re))}>{r.completado ? <CheckCircle size={16} className="text-emerald-400" /> : <Bell size={16} className="text-amber-400" />}</button><div><p className={`text-sm ${r.completado ? 'text-emerald-300 line-through' : 'text-white'}`}>{r.titulo}</p><p className="text-slate-500 text-xs">{formatDate(r.fecha)}{r.hora ? ` ${r.hora}` : ''}</p></div></div><div className="flex items-center gap-1"><button type="button" onClick={() => editarRecordatorioExistente(r)} className="p-1 text-cyan-400 hover:bg-cyan-500/20 rounded"><Edit size={14} /></button><button type="button" onClick={() => { if (window.confirm('¿Eliminar?')) setRecordatorios(recordatorios.filter(re => re.id !== r.id)); }} className="p-1 text-red-400 hover:bg-red-500/20 rounded"><Trash2 size={14} /></button></div></div>))}</div>);
                })()}
                {mostrarFormRecordatorioNuevo && (
                  <div className="bg-slate-800/50 rounded-xl p-4 mb-3 space-y-3">
                    <input type="text" placeholder="Titulo *" value={recordatorioTemp.titulo} onChange={(e) => setRecordatorioTemp({ ...recordatorioTemp, titulo: e.target.value })} className="w-full px-3 py-2 bg-slate-700 border border-slate-300/40 rounded-lg text-white text-sm" />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input type="date" value={recordatorioTemp.fecha} onChange={(e) => setRecordatorioTemp({ ...recordatorioTemp, fecha: e.target.value })} className="px-3 py-2 bg-slate-700 border border-slate-300/40 rounded-lg text-white text-sm" />
                      <input type="time" value={recordatorioTemp.hora} onChange={(e) => setRecordatorioTemp({ ...recordatorioTemp, hora: e.target.value })} className="px-3 py-2 bg-slate-700 border border-slate-300/40 rounded-lg text-white text-sm" />
                      <select value={recordatorioTemp.responsableId} onChange={(e) => setRecordatorioTemp({ ...recordatorioTemp, responsableId: e.target.value })} className="px-3 py-2 bg-slate-700 border border-slate-300/40 rounded-lg text-white text-sm"><option value="">Yo mismo</option>{usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={agregarRecordatorioTemp} className="text-xs px-4 py-2 bg-amber-500 text-white rounded-lg">{editandoRecordatorioExistenteId ? 'Guardar cambios' : 'Agregar'}</button>
                      {editandoRecordatorioExistenteId && (<button type="button" onClick={() => { setEditandoRecordatorioExistenteId(null); setRecordatorioTemp({ titulo: '', fecha: '', hora: '', descripcion: '', responsableId: '' }); setMostrarFormRecordatorioNuevo(false); }} className="text-xs px-4 py-2 bg-slate-600 text-white rounded-lg">Cancelar</button>)}
                    </div>
                  </div>
                )}
                {recordatoriosNuevos.length > 0 && (<div className="space-y-2">{recordatoriosNuevos.map(r => (<div key={r.id} className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-lg p-3"><div className="flex items-center gap-3"><Bell size={14} className="text-amber-400" /><div><p className="text-white text-sm">{r.titulo}</p><p className="text-slate-500 text-xs">{formatDate(r.fecha)}{r.hora ? ` ${r.hora}` : ''}</p></div></div><button type="button" onClick={() => eliminarRecordatorioTemp(r.id)} className="p-1 text-red-400 hover:bg-red-500/20 rounded"><Trash2 size={14} /></button></div>))}</div>)}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={subiendoActividad} className="flex items-center gap-2 bg-violet-500 text-white px-5 py-3 rounded-2xl font-semibold shadow-lg shadow-violet-500/30 hover:bg-violet-600 disabled:opacity-50">{subiendoActividad ? <Loader size={18} className="animate-spin" /> : <Save size={18} />} {subiendoActividad ? 'Guardando...' : editingActividad ? 'Guardar Cambios' : 'Guardar'}</button>
                <button type="button" onClick={() => { setShowActividadForm(false); setActividadArchivo(null); setEditingActividad(null); setTareasNuevas([]); setRecordatoriosNuevos([]); }} className="flex items-center gap-2 bg-slate-700/50 border border-slate-600/50 text-white px-5 py-3 rounded-2xl hover:bg-slate-600/50"><X size={18} /> Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* Form Tarea */}
        {showTareaForm && (
          <div className="bg-teal-900/15 border border-teal-500/20 rounded-2xl p-3 sm:p-4 md:p-5">
            <h3 className="text-lg font-semibold text-white mb-4">{editingTarea ? 'Editar Tarea' : 'Nueva Tarea'}</h3>
            <form onSubmit={handleAddTareaForm} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input type="text" placeholder="Descripcion *" value={tareaFormData.descripcion} onChange={(e) => setTareaFormData({ ...tareaFormData, descripcion: e.target.value })} className="sm:col-span-2 px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500" required />
              <input type="date" value={tareaFormData.fechaCompromiso} onChange={(e) => setTareaFormData({ ...tareaFormData, fechaCompromiso: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white" required />
              <input type="time" value={tareaFormData.hora} onChange={(e) => setTareaFormData({ ...tareaFormData, hora: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white" />
              <select value={tareaFormData.prioridad} onChange={(e) => setTareaFormData({ ...tareaFormData, prioridad: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white"><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option></select>
              <select value={tareaFormData.recurrencia || 'ninguna'} onChange={(e) => setTareaFormData({ ...tareaFormData, recurrencia: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white">{RECURRENCIA_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}</select>
              <select value={tareaFormData.responsableId} onChange={(e) => setTareaFormData({ ...tareaFormData, responsableId: e.target.value })} className="sm:col-span-2 px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white"><option value="">Asignar a... (yo mismo)</option>{usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.id === currentUser?.id ? '(yo)' : ''}</option>)}</select>
              <div className="sm:col-span-2 flex gap-3">
                <button type="submit" className="flex items-center gap-2 bg-cyan-500 text-white px-5 py-3 rounded-2xl font-semibold shadow-lg shadow-cyan-500/30 hover:bg-cyan-600"><Save size={18} /> {editingTarea ? 'Guardar Cambios' : 'Guardar'}</button>
                <button type="button" onClick={() => { setShowTareaForm(false); setEditingTarea(null); }} className="flex items-center gap-2 bg-slate-700/50 border border-slate-600/50 text-white px-5 py-3 rounded-2xl hover:bg-slate-600/50"><X size={18} /> Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* Form Recordatorio */}
        {showRecordatorioForm && (
          <div className="bg-amber-900/15 border border-amber-500/20 rounded-2xl p-3 sm:p-4 md:p-5">
            <h3 className="text-lg font-semibold text-white mb-4">{editingRecordatorio ? 'Editar Recordatorio' : 'Nuevo Recordatorio'}</h3>
            <form onSubmit={handleAddRecordatorio} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input type="text" placeholder="Titulo *" value={recordatorioForm.titulo} onChange={(e) => setRecordatorioForm({ ...recordatorioForm, titulo: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500" required />
              <input type="date" value={recordatorioForm.fecha} onChange={(e) => setRecordatorioForm({ ...recordatorioForm, fecha: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white" required />
              <input type="time" value={recordatorioForm.hora} onChange={(e) => setRecordatorioForm({ ...recordatorioForm, hora: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white" />
              <select value={recordatorioForm.responsableId} onChange={(e) => setRecordatorioForm({ ...recordatorioForm, responsableId: e.target.value })} className="sm:col-span-2 px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white">
                <option value="">Asignar a... (yo mismo)</option>
                {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.id === currentUser?.id ? '(yo)' : ''}</option>)}
              </select>
              <textarea placeholder="Descripcion" value={recordatorioForm.descripcion} onChange={(e) => setRecordatorioForm({ ...recordatorioForm, descripcion: e.target.value })} className="sm:col-span-2 px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 resize-none" rows="2"></textarea>
              <div className="sm:col-span-2 flex gap-3">
                <button type="submit" className="flex items-center gap-2 bg-amber-500 text-white px-5 py-3 rounded-2xl font-semibold shadow-lg shadow-amber-500/30 hover:bg-amber-600"><Save size={18} /> {editingRecordatorio ? 'Guardar Cambios' : 'Guardar'}</button>
                <button type="button" onClick={() => { setShowRecordatorioForm(false); setEditingRecordatorio(null); }} className="flex items-center gap-2 bg-slate-700/50 border border-slate-600/50 text-white px-5 py-3 rounded-2xl hover:bg-slate-600/50"><X size={18} /> Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* ====== TAB: Info ====== */}
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-5 md:p-6 border border-white/[0.08]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Informacion de la Cuenta</h3>
                {puedeEditarCuenta(cuenta) && (
                  <button onClick={() => { handleEdit(cuenta); setSelectedCuenta(null); }} className="p-2 hover:bg-slate-700 rounded-lg transition-all text-slate-400 hover:text-cyan-400" title="Editar cuenta">
                    <Edit size={18} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><p className="text-slate-500 text-sm">Contacto Principal</p><p className="text-white">{contactoPrincipal?.nombre || '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Cargo</p><p className="text-white">{contactoPrincipal?.cargo || '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Email</p><p className="text-cyan-400">{contactoPrincipal?.email || '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Telefono</p><p className="text-white">{contactoPrincipal?.telefono || '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Sitio Web</p><p className="text-cyan-400">{cuenta?.sitioWeb ? (<a href={cuenta.sitioWeb.startsWith('http') ? cuenta.sitioWeb : `https://${cuenta.sitioWeb}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{cuenta.sitioWeb}</a>) : '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Numero de Empleados</p><p className="text-cyan-400 font-semibold">{cuenta?.numeroEmpleados || '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Servicio</p><p className="text-cyan-400">{cuenta?.servicio || '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Fuente</p><p className="text-white">{cuenta?.fuente || '-'}</p></div>
                {cuenta?.fuente === 'Referido' && cuenta?.referidoPor && (
                  <div className="col-span-2"><p className="text-slate-500 text-sm">Referido por</p><p className="text-white flex items-center gap-2"><User size={16} className="text-violet-400" />{cuenta.referidoPor}{cuenta.esComisionista && <span className="ml-2 px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">Comisionista</span>}</p></div>
                )}
                <div><p className="text-slate-500 text-sm">Direccion</p><p className="text-white">{cuenta?.direccion || '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Responsable</p>{(() => {
                  const ids = [cuenta?.asignadoA, cuenta?.asignadoA2, cuenta?.asignadoA3].filter(Boolean);
                  if (ids.length === 0 && cuenta?.creadoPor) ids.push(cuenta.creadoPor);
                  const nombres = ids.map(id => usuarios.find(u => u.id === id)?.nombre).filter(Boolean);
                  return nombres.length > 0 ? <p className="font-medium">{nombres.map((n, i) => (
                    <span key={i}><span className={getColorUsuario(n)}>{n}</span>{i < nombres.length - 1 ? ', ' : ''}</span>
                  ))}</p> : <p className="text-white font-medium">-</p>;
                })()}</div>
                <div><p className="text-slate-500 text-sm">Fecha de registro</p><p className="text-white">{formatDate(cuenta?.fechaCreacion) || '-'}</p></div>
                <div><p className="text-slate-500 text-sm">Total Contactos</p><p className="text-white font-semibold">{contactosCuenta.length}</p></div>
              </div>
              {cuenta?.notas && (<div className="mt-4 pt-4 border-t border-slate-800"><p className="text-slate-500 text-sm mb-1">Notas</p><p className="text-slate-300">{cuenta.notas}</p></div>)}
            </div>
            <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-5 md:p-6 border border-white/[0.08]">
              <h3 className="text-lg font-semibold text-white mb-4">Acciones</h3>
              <div className="space-y-3">
                {contactoPrincipal?.telefono && (
                  <>
                    <a href={getWhatsAppLink(contactoPrincipal.telefono)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-xl text-green-400 transition-all"><MessageSquare size={18} /> WhatsApp</a>
                    <a href={getCallLink(contactoPrincipal.telefono)} className="flex items-center gap-3 p-3 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400 transition-all"><PhoneCall size={18} /> Llamar</a>
                  </>
                )}
                {contactoPrincipal?.email && (<button onClick={() => { setEmailDestinatario({ nombre: contactoPrincipal.nombre || cuenta?.empresa, email: contactoPrincipal.email, clienteId: cuenta?.id }); setEmailModalOpen(true); }} className="w-full flex items-center gap-3 p-3 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400 transition-all"><Mail size={18} /> Enviar Email</button>)}
                {puedeEditarCuenta(cuenta) && (<button onClick={() => { handleEdit(cuenta); setSelectedCuenta(null); }} className="w-full flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition-all"><Edit size={18} /> Editar Cuenta</button>)}
              </div>
            </div>
          </div>
        )}

        {/* ====== TAB: Contactos ====== */}
        {activeTab === 'contactos' && (
          <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-5 md:p-6 border border-white/[0.08]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2"><Users size={20} className="text-cyan-400" /> Contactos de la Cuenta</h3>
              {puedeCrearContacto && (
                <button
                  onClick={() => { setEditingContactId(null); setContactForm({ nombre: '', cargo: '', email: '', telefono: '' }); setShowContactForm(true); }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30 transition-all"
                >
                  <UserPlus size={14} /> Agregar Contacto
                </button>
              )}
            </div>

            {/* Add/Edit Contact Form */}
            {showContactForm && (
              <form onSubmit={handleAddContacto} className="mb-6 bg-slate-800/50 rounded-xl p-3 sm:p-4 md:p-5 border border-cyan-500/20">
                <h4 className="text-sm font-semibold text-cyan-400 mb-3">{editingContactId ? 'Editar Contacto' : 'Nuevo Contacto'}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="text" placeholder="Nombre *" value={contactForm.nombre} onChange={(e) => setContactForm({ ...contactForm, nombre: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 focus:border-cyan-500/50" required />
                  <input type="text" placeholder="Cargo" value={contactForm.cargo} onChange={(e) => setContactForm({ ...contactForm, cargo: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
                  <input type="email" placeholder="Email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
                  <input type="tel" placeholder="Telefono" value={contactForm.telefono} onChange={(e) => setContactForm({ ...contactForm, telefono: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
                </div>
                <div className="flex gap-3 mt-4">
                  <button type="submit" className="flex items-center gap-2 bg-cyan-500 text-white px-5 py-3 rounded-2xl font-semibold shadow-lg shadow-cyan-500/30 hover:bg-cyan-600 text-sm"><Save size={16} /> {editingContactId ? 'Guardar Cambios' : 'Agregar'}</button>
                  <button type="button" onClick={() => { setShowContactForm(false); setEditingContactId(null); setContactForm({ nombre: '', cargo: '', email: '', telefono: '' }); }} className="flex items-center gap-2 bg-slate-700/50 border border-slate-600/50 text-white px-5 py-3 rounded-2xl hover:bg-slate-600/50 text-sm"><X size={16} /> Cancelar</button>
                </div>
              </form>
            )}

            {/* Contact List */}
            {contactosCuenta.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No hay contactos en esta cuenta</p>
            ) : (
              <div className="space-y-3">
                {contactosCuenta.map(contacto => (
                  <div key={contacto.id} className={`flex items-center gap-4 p-4 rounded-xl group transition-all ${contacto.esPrincipal ? 'bg-cyan-500/10 border border-cyan-500/20' : 'bg-slate-800/50 hover:bg-slate-800/70'}`}>
                    {/* Avatar & star */}
                    <div className="relative flex-shrink-0">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center ${contacto.esPrincipal ? 'bg-cyan-500/30' : 'bg-slate-700'}`}>
                        <User size={20} className={contacto.esPrincipal ? 'text-cyan-400' : 'text-slate-400'} />
                      </div>
                      {contacto.esPrincipal && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center" title="Contacto principal">
                          <span className="text-white text-xs">&#9733;</span>
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-white font-medium truncate">{contacto.nombre}</p>
                        {contacto.esPrincipal && <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded-full flex-shrink-0">Principal</span>}
                      </div>
                      {contacto.cargo && <p className="text-slate-400 text-sm">{contacto.cargo}</p>}
                      <div className="flex flex-wrap items-center gap-3 mt-1.5">
                        {contacto.email && (
                          <a href={`mailto:${contacto.email}`} className="text-cyan-400 text-xs hover:underline flex items-center gap-1"><Mail size={12} />{contacto.email}</a>
                        )}
                        {contacto.telefono && (
                          <span className="flex items-center gap-1.5">
                            <a href={getCallLink(contacto.telefono)} className="text-slate-300 text-xs flex items-center gap-1"><Phone size={12} className="text-emerald-400" />{contacto.telefono}</a>
                            <a href={getWhatsAppLink(contacto.telefono)} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300 transition-colors" title="WhatsApp"><MessageSquare size={13} /></a>
                            <a href={getCallLink(contacto.telefono)} className="text-cyan-400 hover:text-cyan-300 transition-colors" title="Llamar"><PhoneCall size={13} /></a>
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      {contacto.telefono && (
                        <>
                          <a href={getWhatsAppLink(contacto.telefono)} target="_blank" rel="noopener noreferrer" className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded-lg" title="WhatsApp">
                            <MessageSquare size={14} />
                          </a>
                          <a href={getCallLink(contacto.telefono)} className="p-1.5 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20 rounded-lg" title="Llamar">
                            <PhoneCall size={14} />
                          </a>
                        </>
                      )}
                      {contacto.email && (
                        <button onClick={() => { setEmailDestinatario({ nombre: contacto.nombre, email: contacto.email, clienteId: cuenta?.id }); setEmailModalOpen(true); }} className="p-1.5 text-cyan-400 hover:bg-cyan-500/20 rounded-lg" title="Enviar email">
                          <Mail size={14} />
                        </button>
                      )}
                      {!contacto.esPrincipal && puedeEditarContacto(contacto) && (
                        <button onClick={() => handleSetPrincipal(contacto.id)} className="p-1.5 text-amber-400 hover:bg-amber-500/20 rounded-lg" title="Hacer principal">
                          <span className="text-sm">&#9733;</span>
                        </button>
                      )}
                      {puedeEditarContacto(contacto) && (
                        <button onClick={() => handleEditContacto(contacto)} className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 rounded-lg" title="Editar"><Edit size={14} /></button>
                      )}
                      {puedeEliminarContacto(contacto) && (
                        <button onClick={() => handleDeleteContacto(contacto.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg" title="Eliminar"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ====== TAB: Actividades ====== */}
        {activeTab === 'actividades' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Registro Rapido de Comunicacion */}
            {puedeEditarCuenta(cuenta) && (
              <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-300/40 overflow-hidden">
                <button
                  onClick={() => setShowQuickComm(!showQuickComm)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-800/50 transition-all"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <MessageSquare size={16} className="text-green-400" /> Registro rapido de comunicacion
                  </span>
                  <span className={`text-slate-500 text-xs transition-transform ${showQuickComm ? 'rotate-180' : ''}`}>&#9660;</span>
                </button>
                {showQuickComm && (
                  <div className="px-5 pb-4 pt-1 space-y-3">
                    {/* Type selector buttons */}
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_COMM_TYPES.map(t => {
                        const Icon = QUICK_COMM_ICON_MAP[t.icon] || FileText;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setQuickComm({ ...quickComm, tipo: t.id })}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${quickComm.tipo === t.id ? `${t.color} text-white` : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}
                          >
                            <Icon size={13} /> {t.label}
                          </button>
                        );
                      })}
                    </div>
                    {/* Input bar */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Escribe una nota rapida..."
                        value={quickComm.nota}
                        onChange={(e) => setQuickComm({ ...quickComm, nota: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter' && quickComm.nota.trim()) handleQuickComm(); }}
                        className="flex-1 px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white text-sm placeholder-slate-500 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                      />
                      <button
                        type="button"
                        onClick={handleQuickComm}
                        disabled={!quickComm.nota.trim()}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-violet-500 text-white rounded-2xl text-sm font-semibold shadow-lg shadow-cyan-500/30 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        <Send size={14} /> Registrar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Timeline at top */}
            {actividadesCuenta.length > 0 && (
              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-5 md:p-6 border border-white/[0.08]">
                <h3 className="text-lg font-semibold text-white mb-4">Timeline</h3>
                <Timeline
                  activities={timeline.map(evento => {
                    const tipoMap = { llamada: 'llamada', email: 'email', reunion: 'reunion', nota: 'nota', whatsapp: 'whatsapp', zoom: 'reunion', presencial: 'reunion' };
                    return {
                      id: evento.id || `${evento.tipo}-${evento.fecha}`,
                      tipo: tipoMap[evento.subtipo] || 'nota',
                      titulo: evento.titulo,
                      descripcion: evento.descripcion,
                      fecha: evento.fecha,
                      usuario: evento.responsableNombre || '',
                      subtipo: evento.subtipo,
                    };
                  })}
                />
              </div>
            )}

            <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-5 md:p-6 border border-white/[0.08]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Historial de Actividades</h3>
                {puedeEditarCuenta(cuenta) && (
                  <button
                    onClick={() => { setEditingActividad(null); setActividadForm({ tipo: 'llamada', titulo: '', descripcion: '', fecha: getFechaLocal(), responsableId: '' }); setTareasNuevas([]); setRecordatoriosNuevos([]); setActividadArchivo(null); setShowActividadForm(true); }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 text-violet-400 rounded-lg text-sm hover:bg-violet-500/30 transition-all"
                  >
                    <Plus size={14} /> Nueva Actividad
                  </button>
                )}
              </div>
              {actividadesCuenta.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No hay actividades registradas</p>
              ) : (
                <div className="space-y-3">
                  {actividadesCuenta.map(a => {
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
          </div>
        )}

        {/* Modal Ver Detalle de Actividad */}
        {viewingActividad && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setViewingActividad(null)}>
            <div className="bg-slate-900 rounded-3xl border border-slate-300/40 w-[calc(100%-16px)] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-modal-in shadow-2xl shadow-black/40 mx-2 sm:mx-0" onClick={(e) => e.stopPropagation()}>
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
                          <div><span className="text-white/80 text-sm">{tipo?.name}</span><h3 className="text-xl font-bold text-white">{viewingActividad.titulo || 'Sin titulo'}</h3></div>
                        </div>
                        <button onClick={() => setViewingActividad(null)} className="p-2 hover:bg-white/20 rounded-lg"><X size={24} className="text-white" /></button>
                      </div>
                    </div>
                    <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-slate-800/50 rounded-xl p-5"><p className="text-slate-500 text-xs mb-1">Fecha</p><p className="text-white font-medium">{formatDate(viewingActividad.fecha)}</p></div>
                        <div className="bg-slate-800/50 rounded-xl p-5"><p className="text-slate-500 text-xs mb-1">Responsable</p><p className={`font-medium ${responsable?.nombre ? getColorUsuario(responsable.nombre) : 'text-white'}`}>{responsable?.nombre || 'No asignado'}</p></div>
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
                      {viewingActividad.tipo !== 'email' && viewingActividad.descripcion && (<div className="bg-slate-800/50 rounded-xl p-5"><p className="text-slate-500 text-xs mb-2">Descripcion</p><p className="text-white whitespace-pre-wrap">{viewingActividad.descripcion}</p></div>)}
                      {viewingActividad.archivo && (<div className="bg-slate-800/50 rounded-xl p-5"><p className="text-slate-500 text-xs mb-2">Archivo</p><a href={viewingActividad.archivo.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 px-4 py-3 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 rounded-xl text-violet-300"><Download size={20} /><div><p className="font-medium">{viewingActividad.archivo.nombre}</p><p className="text-violet-400/60 text-xs">{(viewingActividad.archivo.tamano / 1024).toFixed(1)} KB</p></div></a></div>)}
                      {tareasDerivadas.length > 0 && (<div className="bg-slate-800/50 rounded-xl p-4"><p className="text-cyan-400 text-sm font-medium mb-3 flex items-center gap-2"><Target size={16} /> Tareas ({tareasDerivadas.length})</p><div className="space-y-2">{tareasDerivadas.map(t => (<div key={t.id} className={`flex items-center justify-between p-3 rounded-lg ${t.completada ? 'bg-emerald-500/10' : 'bg-slate-700/50'}`}><div className="flex items-center gap-3">{t.completada ? <CheckCircle size={16} className="text-emerald-400" /> : <Clock size={16} className="text-slate-400" />}<div><p className={`text-sm ${t.completada ? 'text-emerald-300 line-through' : 'text-white'}`}>{t.descripcion}</p><p className="text-slate-500 text-xs">{formatDate(t.fechaCompromiso)}</p></div></div><span className={`text-xs px-2 py-1 rounded ${t.prioridad === 'alta' ? 'bg-red-500/20 text-red-400' : t.prioridad === 'media' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-600 text-slate-400'}`}>{t.prioridad}</span>{t.recurrencia && t.recurrencia !== 'ninguna' && <span className="text-xs text-cyan-400 ml-1">&#8635;</span>}</div>))}</div></div>)}
                      {recordatoriosDerivados.length > 0 && (<div className="bg-slate-800/50 rounded-xl p-4"><p className="text-amber-400 text-sm font-medium mb-3 flex items-center gap-2"><Bell size={16} /> Recordatorios ({recordatoriosDerivados.length})</p><div className="space-y-2">{recordatoriosDerivados.map(r => (<div key={r.id} className={`flex items-center justify-between p-3 rounded-lg ${r.completado ? 'bg-emerald-500/10' : 'bg-slate-700/50'}`}><div className="flex items-center gap-3">{r.completado ? <CheckCircle size={16} className="text-emerald-400" /> : <Bell size={16} className="text-amber-400" />}<div><p className={`text-sm ${r.completado ? 'text-emerald-300 line-through' : 'text-white'}`}>{r.titulo}</p><p className="text-slate-500 text-xs">{formatDate(r.fecha)}</p></div></div></div>))}</div></div>)}
                      <div className="border-t border-slate-300/30 pt-4 flex items-center justify-between text-xs text-slate-500"><span>Creado por: {creador?.nombre || 'Sistema'}</span><span>{viewingActividad.fechaCreacion ? new Date(viewingActividad.fechaCreacion).toLocaleString('es-MX') : '-'}</span></div>
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

        {/* ====== TAB: Tareas ====== */}
        {activeTab === 'tareas' && (
          <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-5 md:p-6 border border-white/[0.08]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Tareas y Compromisos</h3>
              {puedeEditarCuenta(cuenta) && (
                <button
                  onClick={() => { setEditingTarea(null); setTareaFormData({ descripcion: '', fechaCompromiso: getFechaLocal(), hora: '', prioridad: 'media', responsableId: '' }); setShowTareaForm(true); }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30 transition-all"
                >
                  <Plus size={14} /> Nueva Tarea
                </button>
              )}
            </div>
            {tareasCuenta.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No hay tareas para esta cuenta</p>
            ) : (
              <div className="space-y-3">
                {tareasCuenta.map(tarea => {
                  const hoy = getFechaLocal();
                  const vencida = !tarea.completada && tarea.fechaCompromiso < hoy;
                  const esHoy = tarea.fechaCompromiso === hoy;
                  const responsable = usuarios.find(u => u.id === tarea.responsableId);
                  return (
                    <div key={tarea.id} className={`flex items-center gap-4 p-4 rounded-xl group ${tarea.completada ? 'bg-slate-800/30' : vencida ? 'bg-red-500/10 border border-red-500/30' : esHoy ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-slate-800/50'}`}>
                      <button onClick={() => { const { newTareas } = completarTareaConRecurrencia(tareas, tarea.id, generateId); setTareas(newTareas); }} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${tarea.completada ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300/40 hover:border-emerald-500'}`}>{tarea.completada && <CheckCircle size={14} className="text-white" />}</button>
                      <div className="flex-1">
                        <p className={`font-medium ${tarea.completada ? 'text-slate-500 line-through' : 'text-white'}`}>{tarea.descripcion}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className={`text-xs flex items-center gap-1 ${vencida ? 'text-red-400' : esHoy ? 'text-amber-400' : 'text-slate-400'}`}><Clock size={12} /> Compromiso: {esHoy ? 'Hoy' : vencida ? `Vencida (${formatDate(tarea.fechaCompromiso)})` : formatDate(tarea.fechaCompromiso)}{tarea.hora ? ` ${tarea.hora}` : ''}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${tarea.prioridad === 'alta' ? 'bg-red-500/20 text-red-400' : tarea.prioridad === 'media' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>{tarea.prioridad}</span>
                          {tarea.recurrencia && tarea.recurrencia !== 'ninguna' && (<span className="text-xs text-cyan-400">&#8635;</span>)}
                          {responsable && <span className={`text-xs font-medium ${getColorUsuario(responsable.nombre)}`}>{responsable.nombre}</span>}
                        </div>
                        {tarea.fechaCreacion && <p className="text-xs text-slate-500 mt-1">Creada: {new Date(tarea.fechaCreacion).toLocaleDateString('es-MX')}</p>}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => abrirGoogleCalendar({ titulo: tarea.descripcion, descripcion: `Tarea CRM - ${cuenta?.empresa || ''}`, fecha: tarea.fechaCompromiso, hora: tarea.hora, userEmail: currentUser?.googleEmail || currentUser?.email })} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-lg" title="Agregar a Google Calendar"><Calendar size={14} /></button>
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

        {/* ====== TAB: Recordatorios ====== */}
        {activeTab === 'recordatorios' && (
          <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-5 md:p-6 border border-white/[0.08]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Recordatorios</h3>
              {puedeEditarCuenta(cuenta) && (
                <button
                  onClick={() => { setEditingRecordatorio(null); setRecordatorioForm({ titulo: '', fecha: '', hora: '', descripcion: '', responsableId: '' }); setShowRecordatorioForm(true); }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-sm hover:bg-amber-500/30 transition-all"
                >
                  <Plus size={14} /> Nuevo Recordatorio
                </button>
              )}
            </div>
            {recordatoriosCuenta.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No hay recordatorios</p>
            ) : (
              <div className="space-y-3">
                {recordatoriosCuenta.map(r => {
                  const hoy = getFechaLocal();
                  const vencido = !r.completado && r.fecha < hoy;
                  const esHoy = r.fecha === hoy;
                  const responsable = usuarios.find(u => u.id === r.responsableId);
                  return (
                    <div key={r.id} className={`flex items-center gap-4 p-4 rounded-xl group ${r.completado ? 'bg-slate-800/30' : vencido ? 'bg-red-500/10 border border-red-500/30' : esHoy ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-slate-800/50'}`}>
                      <button onClick={() => setRecordatorios(recordatorios.map(rec => rec.id === r.id ? { ...rec, completado: !rec.completado } : rec))} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${r.completado ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300/40 hover:border-emerald-500'}`}>{r.completado && <CheckCircle size={14} className="text-white" />}</button>
                      <div className="flex-1">
                        <p className={`font-medium ${r.completado ? 'text-slate-500 line-through' : 'text-white'}`}>{r.titulo}</p>
                        {r.descripcion && <p className="text-slate-400 text-sm">{r.descripcion}</p>}
                        {responsable && <span className={`text-xs font-medium ${getColorUsuario(responsable.nombre)}`}>{responsable.nombre}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`text-sm ${vencido ? 'text-red-400' : esHoy ? 'text-amber-400' : 'text-slate-400'}`}>{formatDate(r.fecha)}{r.hora ? ` ${r.hora}` : ''}</p>
                          {vencido && <span className="text-xs text-red-400">Vencido</span>}
                          {esHoy && !r.completado && <span className="text-xs text-amber-400">Hoy</span>}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => abrirGoogleCalendar({ titulo: r.titulo, descripcion: `Recordatorio CRM - ${cuenta?.empresa || ''}${r.descripcion ? '\n' + r.descripcion : ''}`, fecha: r.fecha, hora: r.hora, userEmail: currentUser?.googleEmail || currentUser?.email })} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-lg" title="Agregar a Google Calendar"><Calendar size={14} /></button>
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

        {/* ====== TAB: Deals ====== */}
        {activeTab === 'deals' && (
          <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-5 md:p-6 border border-white/[0.08]">
            <h3 className="text-lg font-semibold text-white mb-4">Proyectos en Pipeline</h3>
            {proyectosCuenta.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No hay proyectos registrados para esta cuenta</p>
            ) : (
              <div className="space-y-3">
                {proyectosCuenta.map(p => {
                  const stage = PIPELINE_STAGES.find(s => s.id === p.etapa);
                  return (
                    <div key={p.id} className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl hover:bg-slate-800/70 transition-all">
                      <div className={`w-3 h-3 rounded-full ${stage?.bg}`}></div>
                      <div className="flex-1">
                        <p className="text-white font-medium">{p.nombre}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${stage?.bg} bg-opacity-20 text-white`}>{stage?.name}</span>
                          {p.servicio && <span className="text-xs px-2 py-0.5 bg-violet-500/20 text-violet-400 rounded-full">{p.servicio}</span>}
                        </div>
                      </div>
                      {p.valorEstimado && (
                        <span className="text-emerald-400 font-semibold">${parseFloat(p.valorEstimado).toLocaleString('es-MX')}/ano</span>
                      )}
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

  // ====== MAIN LIST VIEW ======
  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white mb-2">Cuentas</h1>
          <p className="text-slate-400">{cuentas.length} empresas registradas</p>
        </div>
        {puedeCrear && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white px-5 py-3 rounded-2xl font-semibold shadow-lg shadow-cyan-500/30 hover:opacity-90 transition-all"
          >
            <Plus size={20} /> Nueva Cuenta
          </button>
        )}
      </div>

      {/* Hero Metrics */}
      {(() => {
        const totalActivas = cuentas.length;
        const hoy = new Date();
        const hace14Dias = new Date(hoy);
        hace14Dias.setDate(hoy.getDate() - 14);
        const sinContacto14 = cuentas.filter(c => {
          const acts = (actividades || []).filter(a => a.cuentaId === c.id);
          if (acts.length === 0) return true;
          const ultimaFecha = acts.reduce((max, a) => {
            const f = new Date(a.fecha);
            return f > max ? f : max;
          }, new Date(0));
          return ultimaFecha < hace14Dias;
        }).length;
        const contactosTotales = (contactos || []).filter(c => cuentas.some(cu => cu.id === c.cuentaId)).length;
        const dealsAsociados = (pipeline || []).filter(p => cuentas.some(c => c.id === p.clienteId || c.id === p.cuentaId)).length;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            <div className="bg-slate-800/50 rounded-2xl border border-slate-300/40 p-3 sm:p-4 md:p-6 text-center">
              <div className="text-xl sm:text-2xl md:text-3xl font-black text-white">{totalActivas}</div>
              <div className="text-xs text-slate-400 uppercase mt-1">Total cuentas activas</div>
            </div>
            <div className="bg-slate-800/50 rounded-2xl border border-slate-300/40 p-3 sm:p-4 md:p-6 text-center">
              <div className="text-xl sm:text-2xl md:text-3xl font-black text-white">{sinContacto14}</div>
              <div className="text-xs text-slate-400 uppercase mt-1">Sin contacto +14 días</div>
            </div>
            <div className="bg-slate-800/50 rounded-2xl border border-slate-300/40 p-3 sm:p-4 md:p-6 text-center">
              <div className="text-xl sm:text-2xl md:text-3xl font-black text-white">{contactosTotales}</div>
              <div className="text-xs text-slate-400 uppercase mt-1">Contactos totales</div>
            </div>
            <div className="bg-slate-800/50 rounded-2xl border border-slate-300/40 p-3 sm:p-4 md:p-6 text-center">
              <div className="text-xl sm:text-2xl md:text-3xl font-black text-white">{dealsAsociados}</div>
              <div className="text-xs text-slate-400 uppercase mt-1">Deals asociados</div>
            </div>
          </div>
        );
      })()}

      {/* Search & View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" size={20} />
          <input
            type="text"
            placeholder="Buscar por empresa, contacto o industria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-800/40 backdrop-blur-md border border-white/[0.08] rounded-2xl text-white placeholder-slate-500 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
          />
        </div>
        <div className="flex rounded-xl border border-slate-300/40 overflow-hidden">
          <button
            onClick={() => setViewMode('lista')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${viewMode === 'lista' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            <List size={18} /> Lista
          </button>
          <button
            onClick={() => setViewMode('tarjetas')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${viewMode === 'tarjetas' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            <LayoutGrid size={18} /> Tarjetas
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      <FilterPanel
        fields={filterFields}
        onFilter={setAdvancedFilters}
      />

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-5 md:p-6 border border-white/[0.08]">
          <h2 className="text-xl font-bold text-white mb-6">{editingId ? 'Editar Cuenta' : 'Nueva Cuenta'}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input type="text" placeholder="Empresa *" value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 focus:border-cyan-500/50" required />
            {/* Industria selector with add new */}
            <div className="relative">
              {!showNewIndustria ? (
                <div className="flex gap-2">
                  <select value={form.industria} onChange={(e) => setForm({ ...form, industria: e.target.value })} className="flex-1 px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white focus:border-cyan-500/50">
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
                  <input type="text" placeholder="Nueva industria..." value={newIndustriaName} onChange={(e) => setNewIndustriaName(e.target.value)} className="flex-1 px-4 py-3 bg-slate-800 border border-cyan-500/50 rounded-2xl text-white placeholder-slate-500" autoFocus />
                  <button type="button" onClick={handleAddIndustria} className="px-3 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl transition-all" title="Guardar">
                    <Save size={20} />
                  </button>
                  <button type="button" onClick={() => { setShowNewIndustria(false); setNewIndustriaName(''); }} className="px-3 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-all" title="Cancelar">
                    <X size={20} />
                  </button>
                </div>
              )}
              {/* Manage industrias panel */}
              {showManageIndustrias && (
                <div className="mt-2 bg-slate-800 border border-slate-300/40 rounded-xl p-3 space-y-1 max-h-60 overflow-y-auto">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Administrar Industrias</p>
                  {todasLasIndustrias.map(ind => (
                    <div key={ind} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-700/50 group">
                      {editingIndustriaItem === ind ? (
                        <>
                          <input
                            type="text"
                            value={editIndustriaValue}
                            onChange={(e) => setEditIndustriaValue(e.target.value)}
                            className="flex-1 px-2 py-1 bg-slate-900 border border-cyan-500/50 rounded-lg text-white text-sm"
                            autoFocus
                          />
                          <button type="button" onClick={() => { if (editIndustria(ind, editIndustriaValue)) { setEditingIndustriaItem(null); setEditIndustriaValue(''); } }} className="p-1 text-emerald-400 hover:text-emerald-300"><Save size={14} /></button>
                          <button type="button" onClick={() => { setEditingIndustriaItem(null); setEditIndustriaValue(''); }} className="p-1 text-slate-400 hover:text-white"><X size={14} /></button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm text-white">{ind}</span>
                          <button type="button" onClick={() => { setEditingIndustriaItem(ind); setEditIndustriaValue(ind); }} className="p-1 text-slate-500 hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity"><Edit size={14} /></button>
                          <button type="button" onClick={() => { if (window.confirm(`¿Eliminar la industria "${ind}"?`)) { deleteIndustria(ind); } }} className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                        </>
                      )}
                    </div>
                  ))}
                  {todasLasIndustrias.length === 0 && <p className="text-sm text-slate-500 text-center py-2">No hay industrias</p>}
                </div>
              )}
            </div>
            {/* Servicio selector with add new */}
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
                  <input type="text" placeholder="Nuevo servicio..." value={newServicioName} onChange={(e) => setNewServicioName(e.target.value)} className="flex-1 px-4 py-3 bg-slate-800 border border-cyan-500/50 rounded-2xl text-white placeholder-slate-500" autoFocus />
                  <button type="button" onClick={handleAddServicio} className="px-3 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl transition-all" title="Guardar">
                    <Save size={20} />
                  </button>
                  <button type="button" onClick={() => { setShowNewServicio(false); setNewServicioName(''); }} className="px-3 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-all" title="Cancelar">
                    <X size={20} />
                  </button>
                </div>
              )}
            </div>
            <input type="url" placeholder="Sitio Web" value={form.sitioWeb} onChange={(e) => setForm({ ...form, sitioWeb: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="text" placeholder="Direccion" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            <input type="number" placeholder="Numero de empleados" value={form.numeroEmpleados} onChange={(e) => setForm({ ...form, numeroEmpleados: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            {/* Fuente */}
            <select value={form.fuente || ''} onChange={(e) => setForm({ ...form, fuente: e.target.value, referidoPor: e.target.value !== 'Referido' ? '' : form.referidoPor, esComisionista: e.target.value !== 'Referido' ? false : form.esComisionista })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white focus:border-cyan-500/50">
              <option value="">Fuente de la cuenta</option>
              {FUENTES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            {/* Referido fields */}
            {form.fuente === 'Referido' && (
              <>
                <input type="text" placeholder="Nombre de quien refirio *" value={form.referidoPor || ''} onChange={(e) => setForm({ ...form, referidoPor: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
                <label className="flex items-center gap-3 px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl cursor-pointer hover:border-cyan-500/50 transition-all">
                  <input type="checkbox" checked={form.esComisionista || false} onChange={(e) => setForm({ ...form, esComisionista: e.target.checked })} className="w-5 h-5 rounded bg-slate-700 border-slate-300/40 text-cyan-500 focus:ring-cyan-500/50" />
                  <span className="text-white">Es comisionista</span>
                </label>
              </>
            )}
            {/* Tags */}
            <div className="sm:col-span-2">
              <p className="text-slate-400 text-sm mb-2">Etiquetas</p>
              <div className="flex flex-wrap gap-2">
                {TAGS_DISPONIBLES.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-all ${(form.tags || []).includes(tag.id) ? `${tag.color} text-white` : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    <Tag size={14} className="inline mr-1" />{tag.name}
                  </button>
                ))}
              </div>
            </div>
            {/* Assigned to */}
            {esAdmin && (
              <select value={form.asignadoA || ''} onChange={(e) => setForm({ ...form, asignadoA: e.target.value })} className="sm:col-span-2 px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white focus:border-cyan-500/50">
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

            {/* Contacto Principal section - only for new cuentas */}
            {!editingId && (
              <div className="sm:col-span-2 border-t border-slate-300/30 pt-4 mt-2">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><UserPlus size={20} className="text-cyan-400" /> Contacto Principal</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input type="text" placeholder="Nombre del contacto" value={contactForm.nombre} onChange={(e) => setContactForm({ ...contactForm, nombre: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
                  <input type="text" placeholder="Cargo" value={contactForm.cargo} onChange={(e) => setContactForm({ ...contactForm, cargo: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
                  <input type="email" placeholder="Email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
                  <input type="tel" placeholder="Telefono" value={contactForm.telefono} onChange={(e) => setContactForm({ ...contactForm, telefono: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-2xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
                </div>
              </div>
            )}

            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={subiendoLogo} className={`flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white px-5 py-3 rounded-2xl font-semibold shadow-lg shadow-cyan-500/30 hover:opacity-90 transition-all ${subiendoLogo ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {subiendoLogo ? <><Loader size={20} className="animate-spin" /> Subiendo logo...</> : <><Save size={20} /> Guardar</>}
              </button>
              <button type="button" onClick={resetForm} className="flex items-center gap-2 bg-slate-700/50 border border-slate-600/50 text-white px-5 py-3 rounded-2xl hover:bg-slate-600/50 transition-all font-medium">
                <X size={20} /> Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cuentas List / Cards */}
      {filteredCuentas.length === 0 ? (
        <EmptyState
          icon={Building}
          title="Sin cuentas"
          description="Agrega tu primera empresa"
          actionLabel={puedeCrear ? "Nueva Cuenta" : undefined}
          onAction={puedeCrear ? () => setShowForm(true) : undefined}
        />
      ) : viewMode === 'lista' ? (
        <DataTable
          columns={tableColumns}
          data={filteredCuentas}
          onRowClick={(row) => setSelectedCuenta(row.id)}
          selectable={true}
          emptyMessage="No hay cuentas que coincidan con la busqueda"
          bulkActions={[
            { label: 'Eliminar seleccionados', onClick: handleBulkDelete },
          ]}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCuentas.map(c => {
            const cp = getContactoPrincipal(c.id);
            const contactosCount = (contactos || []).filter(ct => ct.cuentaId === c.id).length;
            const dealsCount = pipeline.filter(p => p.cuentaId === c.id || p.clienteId === c.id).length;
            const asignado = usuarios.find(u => u.id === c.asignadoA);
            return (
              <div
                key={c.id}
                className="group bg-slate-800/40 backdrop-blur-md rounded-2xl border border-white/[0.08] hover:border-cyan-500/30 hover:scale-[1.01] hover:shadow-lg hover:shadow-cyan-500/5 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer overflow-hidden"
                onClick={() => setSelectedCuenta(c.id)}
              >
                {/* Card Header - Dark */}
                {c.logoUrl ? (
                  <div className="relative w-full h-28 bg-slate-800">
                    <img src={c.logoUrl} alt={c.empresa} className="w-full h-full object-contain bg-white/5 p-3" />
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      {puedeEditarCuenta(c) && (
                        <button onClick={() => handleEdit(c)} className="p-1.5 bg-slate-900/80 backdrop-blur-sm hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white">
                          <Edit size={14} />
                        </button>
                      )}
                      {puedeEliminarCuenta(c) && (
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 bg-slate-900/80 backdrop-blur-sm hover:bg-slate-800 rounded-lg text-slate-300 hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    {c.industria && (
                      <span className="absolute bottom-2 left-2 text-xs px-2 py-0.5 bg-slate-900/80 text-slate-300 rounded-full backdrop-blur-sm">{c.industria}</span>
                    )}
                  </div>
                ) : (
                  <div className="relative w-full h-28 bg-gradient-to-br from-cyan-500/10 to-violet-500/10 flex items-center justify-center">
                    <Building className="w-10 h-10 text-slate-600" />
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      {puedeEditarCuenta(c) && (
                        <button onClick={() => handleEdit(c)} className="p-1.5 bg-slate-900/80 backdrop-blur-sm hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white">
                          <Edit size={14} />
                        </button>
                      )}
                      {puedeEliminarCuenta(c) && (
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 bg-slate-900/80 backdrop-blur-sm hover:bg-slate-800 rounded-lg text-slate-300 hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    {c.industria && (
                      <span className="absolute bottom-2 left-2 text-xs px-2 py-0.5 bg-slate-900/80 text-slate-300 rounded-full backdrop-blur-sm">{c.industria}</span>
                    )}
                  </div>
                )}
                {/* Card Body */}
                <div className="p-5">
                  <h3 className="text-lg font-semibold text-white mb-1">{c.empresa}</h3>
                  {c.servicio && <span className="text-xs px-2 py-0.5 bg-violet-500/20 text-violet-400 rounded-full">{c.servicio}</span>}

                  {/* Contacto Principal */}
                  {cp && (
                    <div className="mt-3 space-y-1">
                      <p className="text-slate-300 text-sm font-medium">{cp.nombre}</p>
                      {cp.email && (
                        <p className="text-slate-400 text-xs flex items-center gap-1.5">
                          <Mail size={12} className="text-cyan-400" />
                          <span className="truncate">{cp.email}</span>
                        </p>
                      )}
                      {/* WhatsApp & Call buttons */}
                      {cp.telefono && (
                        <div className="flex items-center gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
                          <span className="text-slate-400 text-xs flex items-center gap-1"><Phone size={11} />{cp.telefono}</span>
                          <a href={getWhatsAppLink(cp.telefono)} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300 transition-colors" title="WhatsApp"><MessageSquare size={13} /></a>
                          <a href={getCallLink(cp.telefono)} className="text-cyan-400 hover:text-cyan-300 transition-colors" title="Llamar"><PhoneCall size={13} /></a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stats & Last Contact */}
                  <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Users size={12} className="text-cyan-400" />{contactosCount} contacto{contactosCount !== 1 ? 's' : ''}</span>
                    <span className="flex items-center gap-1"><GitBranch size={12} className="text-violet-400" />{dealsCount} deal{dealsCount !== 1 ? 's' : ''}</span>
                    {(() => {
                      const lastContact = getLastContactInfo(c.id, actividades);
                      return <span className={`flex items-center gap-1 ${lastContact.color}`}><Clock size={12} />{lastContact.texto}</span>;
                    })()}
                  </div>

                  {/* Tags */}
                  {(c.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {(c.tags || []).slice(0, 3).map(tagId => {
                        const tag = TAGS_DISPONIBLES.find(t => t.id === tagId);
                        return tag ? (
                          <span key={tagId} className={`px-2 py-0.5 rounded text-xs text-white ${tag.color}`}>{tag.name}</span>
                        ) : null;
                      })}
                    </div>
                  )}

                  {/* Assigned */}
                  {asignado && (
                    <div className="mt-3 pt-3 border-t border-slate-800">
                      <span className={`text-xs font-medium ${getColorUsuario(asignado.nombre)}`}>{asignado.nombre}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Cuentas;
