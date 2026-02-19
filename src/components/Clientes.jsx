import React, { useState, useMemo } from 'react';
import {
  Plus, Trash2, Edit, Save, Search, Phone, Mail,
  Building, FileText, CheckCircle, Clock, X,
  Target, Loader, Upload, Download, Image,
  Tag, MessageSquare, Bell, PhoneCall,
  History, AlertCircle, User, Calendar, GitBranch,
  List, LayoutGrid
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { formatDate, generateId, getFechaLocal, getColorUsuario, abrirGoogleCalendar } from '../utils/helpers';
import { TIPOS_ACTIVIDAD, TAGS_DISPONIBLES, FUENTES, PIPELINE_STAGES } from '../utils/constants';
import DataTable from './ui/DataTable';
import FilterPanel from './ui/FilterPanel';
import Timeline from './ui/Timeline';
import EmptyState from './ui/EmptyState';

function Clientes({ clientes, setClientes, pipeline, actividades, setActividades, recordatorios, setRecordatorios, tareas, setTareas, usuarios, currentUser, addNotificacion, setEmailDestinatario, setEmailModalOpen, todasLasIndustrias, addIndustria, editIndustria, deleteIndustria, todosLosServicios, addServicio, addAuditLog }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [showActividadForm, setShowActividadForm] = useState(false);
  const [showRecordatorioForm, setShowRecordatorioForm] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [form, setForm] = useState({
    empresa: '', contacto: '', cargo: '', email: '', telefono: '',
    industria: '', servicio: '', sitioWeb: '', direccion: '', notas: '', numeroEmpleados: '', tags: [], asignadoA: '', asignadoA2: '', asignadoA3: '',
    fuente: '', referidoPor: '', esComisionista: false
  });
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
  // Estados para edición
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
  const [editingIndustria, setEditingIndustria] = useState(null);
  const [editIndustriaValue, setEditIndustriaValue] = useState('');
  const [showNewServicio, setShowNewServicio] = useState(false);
  const [newServicioName, setNewServicioName] = useState('');
  const [viewMode, setViewMode] = useState('tarjetas'); // 'lista' | 'tarjetas'
  const [advancedFilters, setAdvancedFilters] = useState([]);

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
      return cliente.asignadoA === currentUser?.id || cliente.asignadoA2 === currentUser?.id || cliente.asignadoA3 === currentUser?.id || cliente.creadoPor === currentUser?.id;
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
      return cliente.asignadoA === currentUser?.id || cliente.asignadoA2 === currentUser?.id || cliente.asignadoA3 === currentUser?.id || cliente.creadoPor === currentUser?.id;
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
    setForm({ empresa: '', contacto: '', cargo: '', email: '', telefono: '', industria: '', servicio: '', sitioWeb: '', direccion: '', notas: '', numeroEmpleados: '', tags: [], asignadoA: '', asignadoA2: '', asignadoA3: '', fuente: '', referidoPor: '', esComisionista: false });
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
      // Subir logo si se seleccionó uno
      if (logoFile) {
        const timestamp = Date.now();
        const fileName = `clientes/logos/${editingId || 'new'}_${timestamp}_${logoFile.name}`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, logoFile);
        logoUrl = await getDownloadURL(storageRef);
      }
    } catch (err) {
      console.error('Error al subir logo:', err);
      alert('Error al subir el logo. El cliente se guardará sin logo.');
    }
    setSubiendoLogo(false);

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
      const clienteActual = clientes.find(c => c.id === editingId);
      const logoFinal = logoUrl || (logoPreview ? clienteActual?.logoUrl || '' : '');
      setClientes(clientes.map(c => c.id === editingId ? { id: c.id, fechaCreacion: c.fechaCreacion || '', creadoPor: c.creadoPor, ...cleanForm, logoUrl: logoFinal, asignadoA: form.asignadoA || c.asignadoA || currentUser?.id } : c));
      addAuditLog('editar', 'clientes', `Cliente editado: ${cleanForm.empresa}`, editingId, cleanForm.empresa);
    } else {
      const nuevoCliente = { ...cleanForm, logoUrl: logoUrl || '', id: generateId(), fechaCreacion: getFechaLocal(), creadoPor: currentUser?.id, asignadoA: form.asignadoA || currentUser?.id };
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
      asignadoA2: cliente.asignadoA2 || '',
      asignadoA3: cliente.asignadoA3 || '',
      fuente: cliente.fuente || '',
      referidoPor: cliente.referidoPor || '',
      esComisionista: cliente.esComisionista || false
    });
    setEditingId(cliente.id);
    setLogoFile(null);
    setLogoPreview(cliente.logoUrl || null);
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

  // Funciones para tareas
  const handleEditTarea = (tarea) => {
    setTareaFormData({
      descripcion: tarea.descripcion,
      fechaCompromiso: tarea.fechaCompromiso,
      hora: tarea.hora || '',
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

    setTareaFormData({ descripcion: '', fechaCompromiso: '', hora: '', prioridad: 'media', responsableId: '' });
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

    // Proyectos en pipeline
    pipeline.filter(p => p.clienteId === clienteId).forEach(p => {
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

  // Filtrar por alcance de visualización
  const clientesPorAlcance = permisos.ver === 'propios'
    ? clientes.filter(c => c.asignadoA === currentUser?.id || c.asignadoA2 === currentUser?.id || c.asignadoA3 === currentUser?.id || c.creadoPor === currentUser?.id)
    : clientes;

  const searchFiltered = clientesPorAlcance.filter(c =>
    c.empresa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.contacto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.industria?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Apply advanced filters
  const filteredClientes = useMemo(() => {
    if (advancedFilters.length === 0) return searchFiltered;
    return searchFiltered.filter(c => {
      return advancedFilters.every(cond => {
        const val = String(c[cond.field] || '').toLowerCase();
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
    { key: 'contacto', label: 'Contacto', type: 'text' },
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
            <img src={row.logoUrl} alt={val} className="w-8 h-8 rounded-lg object-cover border border-slate-600 flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center flex-shrink-0">
              <Building className="w-4 h-4 text-cyan-400" />
            </div>
          )}
          <span className="text-white font-medium">{val}</span>
        </div>
      ),
    },
    { key: 'contacto', label: 'Contacto', sortable: true },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      render: (val) => val ? <span className="text-cyan-400">{val}</span> : '-',
    },
    {
      key: 'telefono',
      label: 'Telefono',
      sortable: false,
      render: (val) => val ? <span className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-emerald-400" />{val}</span> : '-',
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
  ], [usuarios]);

  const handleBulkDelete = (ids) => {
    if (window.confirm(`¿Eliminar ${ids.length} cliente(s) seleccionados?`)) {
      setClientes(clientes.filter(c => !ids.includes(c.id)));
    }
  };

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
            {cliente?.logoUrl ? (
              <img src={cliente.logoUrl} alt={cliente.empresa} className="w-12 h-12 rounded-xl object-cover border-2 border-slate-700" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center">
                <Building className="w-6 h-6 text-cyan-400" />
              </div>
            )}
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
              <button onClick={() => { setEditingTarea(null); setTareaFormData({ descripcion: '', fechaCompromiso: getFechaLocal(), hora: '', prioridad: 'media', responsableId: '' }); setShowTareaForm(true); }} className="flex items-center gap-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 px-4 py-2 rounded-xl transition-all">
                <Target size={16} /> Tarea
              </button>
              <button onClick={() => { setEditingRecordatorio(null); setRecordatorioForm({ titulo: '', fecha: '', hora: '', descripcion: '', responsableId: '' }); setShowRecordatorioForm(true); }} className="flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 px-4 py-2 rounded-xl transition-all">
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
                  return (<div className="mb-3 space-y-2">{tareasExistentes.map(t => (<div key={t.id} className={`flex items-center justify-between p-3 rounded-lg ${t.completada ? 'bg-emerald-500/10' : 'bg-slate-700/50'}`}><div className="flex items-center gap-3"><button type="button" onClick={() => setTareas(tareas.map(ta => ta.id === t.id ? { ...ta, completada: !ta.completada } : ta))}>{t.completada ? <CheckCircle size={16} className="text-emerald-400" /> : <Clock size={16} className="text-slate-400" />}</button><div><p className={`text-sm ${t.completada ? 'text-emerald-300 line-through' : 'text-white'}`}>{t.descripcion}</p><p className="text-slate-500 text-xs">{formatDate(t.fechaCompromiso)}{t.hora ? ` ${t.hora}` : ''}</p></div></div><div className="flex items-center gap-1"><button type="button" onClick={() => editarTareaExistente(t)} className="p-1 text-cyan-400 hover:bg-cyan-500/20 rounded"><Edit size={14} /></button><button type="button" onClick={() => { if (window.confirm('¿Eliminar?')) setTareas(tareas.filter(ta => ta.id !== t.id)); }} className="p-1 text-red-400 hover:bg-red-500/20 rounded"><Trash2 size={14} /></button></div></div>))}</div>);
                })()}
                {mostrarFormTarea && (
                  <div className="bg-slate-800/50 rounded-xl p-4 mb-3 space-y-3">
                    <input type="text" placeholder="Descripción *" value={tareaTemp.descripcion} onChange={(e) => setTareaTemp({ ...tareaTemp, descripcion: e.target.value })} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm" />
                    <div className="grid grid-cols-4 gap-2">
                      <input type="date" value={tareaTemp.fechaCompromiso} onChange={(e) => setTareaTemp({ ...tareaTemp, fechaCompromiso: e.target.value })} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm" />
                      <input type="time" value={tareaTemp.hora} onChange={(e) => setTareaTemp({ ...tareaTemp, hora: e.target.value })} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm" />
                      <select value={tareaTemp.prioridad} onChange={(e) => setTareaTemp({ ...tareaTemp, prioridad: e.target.value })} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option></select>
                      <select value={tareaTemp.responsableId} onChange={(e) => setTareaTemp({ ...tareaTemp, responsableId: e.target.value })} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"><option value="">Yo mismo</option>{usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={agregarTareaTemp} className="text-xs px-4 py-2 bg-cyan-500 text-white rounded-lg">{editandoTareaExistenteId ? 'Guardar cambios' : 'Agregar'}</button>
                      {editandoTareaExistenteId && (<button type="button" onClick={() => { setEditandoTareaExistenteId(null); setTareaTemp({ descripcion: '', fechaCompromiso: '', hora: '', prioridad: 'media', responsableId: '' }); setMostrarFormTarea(false); }} className="text-xs px-4 py-2 bg-slate-600 text-white rounded-lg">Cancelar</button>)}
                    </div>
                  </div>
                )}
                {tareasNuevas.length > 0 && (<div className="space-y-2">{tareasNuevas.map(t => (<div key={t.id} className="flex items-center justify-between bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3"><div className="flex items-center gap-3"><Target size={14} className="text-cyan-400" /><div><p className="text-white text-sm">{t.descripcion}</p><p className="text-slate-500 text-xs">{formatDate(t.fechaCompromiso)}{t.hora ? ` ${t.hora}` : ''}</p></div></div><button type="button" onClick={() => eliminarTareaTemp(t.id)} className="p-1 text-red-400 hover:bg-red-500/20 rounded"><Trash2 size={14} /></button></div>))}</div>)}
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
                  return (<div className="mb-3 space-y-2">{recordatoriosExistentes.map(r => (<div key={r.id} className={`flex items-center justify-between p-3 rounded-lg ${r.completado ? 'bg-emerald-500/10' : 'bg-slate-700/50'}`}><div className="flex items-center gap-3"><button type="button" onClick={() => setRecordatorios(recordatorios.map(re => re.id === r.id ? { ...re, completado: !re.completado } : re))}>{r.completado ? <CheckCircle size={16} className="text-emerald-400" /> : <Bell size={16} className="text-amber-400" />}</button><div><p className={`text-sm ${r.completado ? 'text-emerald-300 line-through' : 'text-white'}`}>{r.titulo}</p><p className="text-slate-500 text-xs">{formatDate(r.fecha)}{r.hora ? ` ${r.hora}` : ''}</p></div></div><div className="flex items-center gap-1"><button type="button" onClick={() => editarRecordatorioExistente(r)} className="p-1 text-cyan-400 hover:bg-cyan-500/20 rounded"><Edit size={14} /></button><button type="button" onClick={() => { if (window.confirm('¿Eliminar?')) setRecordatorios(recordatorios.filter(re => re.id !== r.id)); }} className="p-1 text-red-400 hover:bg-red-500/20 rounded"><Trash2 size={14} /></button></div></div>))}</div>);
                })()}
                {mostrarFormRecordatorioNuevo && (
                  <div className="bg-slate-800/50 rounded-xl p-4 mb-3 space-y-3">
                    <input type="text" placeholder="Título *" value={recordatorioTemp.titulo} onChange={(e) => setRecordatorioTemp({ ...recordatorioTemp, titulo: e.target.value })} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm" />
                    <div className="grid grid-cols-3 gap-2">
                      <input type="date" value={recordatorioTemp.fecha} onChange={(e) => setRecordatorioTemp({ ...recordatorioTemp, fecha: e.target.value })} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm" />
                      <input type="time" value={recordatorioTemp.hora} onChange={(e) => setRecordatorioTemp({ ...recordatorioTemp, hora: e.target.value })} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm" />
                      <select value={recordatorioTemp.responsableId} onChange={(e) => setRecordatorioTemp({ ...recordatorioTemp, responsableId: e.target.value })} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"><option value="">Yo mismo</option>{usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
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
              <input type="time" value={tareaFormData.hora} onChange={(e) => setTareaFormData({ ...tareaFormData, hora: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white" />
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
              <input type="time" value={recordatorioForm.hora} onChange={(e) => setRecordatorioForm({ ...recordatorioForm, hora: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white" />
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
                <div><p className="text-slate-500 text-sm">Responsable</p>{(() => {
                  const ids = [cliente?.asignadoA, cliente?.asignadoA2, cliente?.asignadoA3].filter(Boolean);
                  if (ids.length === 0 && cliente?.creadoPor) ids.push(cliente.creadoPor);
                  const nombres = ids.map(id => usuarios.find(u => u.id === id)?.nombre).filter(Boolean);
                  return nombres.length > 0 ? <p className="font-medium">{nombres.map((n, i) => (
                    <span key={i}><span className={getColorUsuario(n)}>{n}</span>{i < nombres.length - 1 ? ', ' : ''}</span>
                  ))}</p> : <p className="text-white font-medium">-</p>;
                })()}</div>
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setViewingActividad(null)}>
            <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/40" onClick={(e) => e.stopPropagation()}>
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
                      {viewingActividad.tipo !== 'email' && viewingActividad.descripcion && (<div className="bg-slate-800/50 rounded-xl p-5"><p className="text-slate-500 text-xs mb-2">Descripción</p><p className="text-white whitespace-pre-wrap">{viewingActividad.descripcion}</p></div>)}
                      {viewingActividad.archivo && (<div className="bg-slate-800/50 rounded-xl p-5"><p className="text-slate-500 text-xs mb-2">Archivo</p><a href={viewingActividad.archivo.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 px-4 py-3 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 rounded-xl text-violet-300"><Download size={20} /><div><p className="font-medium">{viewingActividad.archivo.nombre}</p><p className="text-violet-400/60 text-xs">{(viewingActividad.archivo.tamano / 1024).toFixed(1)} KB</p></div></a></div>)}
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
                  onClick={() => { setEditingTarea(null); setTareaFormData({ descripcion: '', fechaCompromiso: getFechaLocal(), hora: '', prioridad: 'media', responsableId: '' }); setShowTareaForm(true); }}
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
                          <span className={`text-xs flex items-center gap-1 ${vencida ? 'text-red-400' : esHoy ? 'text-amber-400' : 'text-slate-400'}`}><Clock size={12} /> Compromiso: {esHoy ? 'Hoy' : vencida ? `Vencida (${formatDate(tarea.fechaCompromiso)})` : formatDate(tarea.fechaCompromiso)}{tarea.hora ? ` ${tarea.hora}` : ''}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${tarea.prioridad === 'alta' ? 'bg-red-500/20 text-red-400' : tarea.prioridad === 'media' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>{tarea.prioridad}</span>
                          {responsable && <span className={`text-xs font-medium ${getColorUsuario(responsable.nombre)}`}>{responsable.nombre}</span>}
                        </div>
                        {tarea.fechaCreacion && <p className="text-xs text-slate-500 mt-1">Creada: {new Date(tarea.fechaCreacion).toLocaleDateString('es-MX')}</p>}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => abrirGoogleCalendar({ titulo: tarea.descripcion, descripcion: `Tarea CRM — ${selectedCliente?.empresa || ''}`, fecha: tarea.fechaCompromiso, hora: tarea.hora, userEmail: currentUser?.googleEmail || currentUser?.email })} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-lg" title="Agregar a Google Calendar"><Calendar size={14} /></button>
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
            <Timeline
              activities={timeline.map(evento => {
                const tipoMap = { llamada: 'llamada', email: 'email', reunion: 'reunion', nota: 'nota' };
                return {
                  id: evento.id || `${evento.tipo}-${evento.fecha}`,
                  tipo: tipoMap[evento.subtipo] || 'nota',
                  titulo: evento.titulo,
                  descripcion: evento.descripcion,
                  fecha: evento.fecha,
                  usuario: evento.responsableNombre || '',
                };
              })}
            />
          </div>
        )}

        {/* Tab Content: Recordatorios */}
        {activeTab === 'recordatorios' && (
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Recordatorios</h3>
              {puedeEditarCliente(cliente) && (
                <button
                  onClick={() => { setEditingRecordatorio(null); setRecordatorioForm({ titulo: '', fecha: '', hora: '', descripcion: '', responsableId: '' }); setShowRecordatorioForm(true); }}
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
                        {responsable && <span className={`text-xs font-medium ${getColorUsuario(responsable.nombre)}`}>{responsable.nombre}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`text-sm ${vencido ? 'text-red-400' : esHoy ? 'text-amber-400' : 'text-slate-400'}`}>{formatDate(r.fecha)}{r.hora ? ` ${r.hora}` : ''}</p>
                          {vencido && <span className="text-xs text-red-400">Vencido</span>}
                          {esHoy && !r.completado && <span className="text-xs text-amber-400">Hoy</span>}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => abrirGoogleCalendar({ titulo: r.titulo, descripcion: `Recordatorio CRM — ${selectedCliente?.empresa || ''}${r.descripcion ? '\n' + r.descripcion : ''}`, fecha: r.fecha, hora: r.hora, userEmail: currentUser?.googleEmail || currentUser?.email })} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-lg" title="Agregar a Google Calendar"><Calendar size={14} /></button>
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

      {/* Buscador y View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" size={20} />
          <input
            type="text"
            placeholder="Buscar por empresa, contacto o industria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border-2 border-slate-400 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
          />
        </div>
        <div className="flex rounded-xl border border-slate-700 overflow-hidden">
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
                <div className="mt-2 bg-slate-800 border border-slate-700 rounded-xl p-3 space-y-1 max-h-60 overflow-y-auto">
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
            <select value={form.asignadoA2 || ''} onChange={(e) => setForm({ ...form, asignadoA2: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-cyan-500/50">
              <option value="">Responsable 2 (opcional)</option>
              {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
            <select value={form.asignadoA3 || ''} onChange={(e) => setForm({ ...form, asignadoA3: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-cyan-500/50">
              <option value="">Responsable 3 (opcional)</option>
              {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
            {/* Logo del cliente */}
            <div className="md:col-span-2">
              <p className="text-slate-400 text-sm mb-2">Logo del cliente</p>
              <div className="flex items-center gap-4">
                {logoPreview ? (
                  <div className="relative">
                    <img src={logoPreview} alt="Logo preview" className="w-16 h-16 rounded-xl object-cover border-2 border-slate-600" />
                    <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(null); }} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600"><X size={12} /></button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center">
                    <Image size={24} className="text-slate-600" />
                  </div>
                )}
                <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 hover:border-cyan-500/50 cursor-pointer transition-all">
                  <Upload size={16} />
                  {logoPreview ? 'Cambiar logo' : 'Subir logo'}
                  <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                </label>
                {subiendoLogo && <span className="text-cyan-400 text-sm flex items-center gap-2"><Loader size={14} className="animate-spin" /> Subiendo...</span>}
              </div>
            </div>
            <textarea placeholder="Notas" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="md:col-span-2 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50 resize-none" rows="2"></textarea>
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
      )}

      {/* Lista de clientes */}
      {filteredClientes.length === 0 ? (
        <EmptyState
          icon={Building}
          title="Sin clientes"
          description="Agrega tu primer cliente para empezar"
          actionLabel={puedeCrear ? "Agregar Cliente" : undefined}
          onAction={puedeCrear ? () => setShowForm(true) : undefined}
        />
      ) : viewMode === 'lista' ? (
        <DataTable
          columns={tableColumns}
          data={filteredClientes}
          onRowClick={(row) => setSelectedCliente(row.id)}
          selectable={true}
          emptyMessage="No hay clientes que coincidan con la busqueda"
          bulkActions={[
            { label: 'Eliminar seleccionados', onClick: handleBulkDelete },
          ]}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClientes.map(cliente => (
            <div
              key={cliente.id}
              className="group bg-slate-900/50 backdrop-blur-sm rounded-2xl border-2 border-slate-400 hover:border-cyan-500/30 transition-all cursor-pointer overflow-hidden"
              onClick={() => setSelectedCliente(cliente.id)}
            >
              {/* Banner del logo */}
              {cliente.logoUrl ? (
                <div className="relative w-full h-28 bg-slate-800">
                  <img src={cliente.logoUrl} alt={cliente.empresa} className="w-full h-full object-contain bg-white/5 p-3" />
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    {puedeEditarCliente(cliente) && (
                      <button onClick={() => handleEdit(cliente)} className="p-1.5 bg-slate-900/80 backdrop-blur-sm hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white">
                        <Edit size={14} />
                      </button>
                    )}
                    {puedeEliminarCliente(cliente) && (
                      <button onClick={() => handleDelete(cliente.id)} className="p-1.5 bg-slate-900/80 backdrop-blur-sm hover:bg-slate-800 rounded-lg text-slate-300 hover:text-red-400">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative w-full h-28 bg-gradient-to-br from-cyan-500/10 to-violet-500/10 flex items-center justify-center">
                  <Building className="w-10 h-10 text-slate-600" />
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    {puedeEditarCliente(cliente) && (
                      <button onClick={() => handleEdit(cliente)} className="p-1.5 bg-slate-900/80 backdrop-blur-sm hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white">
                        <Edit size={14} />
                      </button>
                    )}
                    {puedeEliminarCliente(cliente) && (
                      <button onClick={() => handleDelete(cliente.id)} className="p-1.5 bg-slate-900/80 backdrop-blur-sm hover:bg-slate-800 rounded-lg text-slate-300 hover:text-red-400">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div className="p-5">
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Clientes;
