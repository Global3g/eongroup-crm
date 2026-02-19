import React, { useState } from 'react';
import {
  Calendar, CheckCircle, ChevronRight, Clock, Bell,
  Target, Edit, Save, ArrowUpRight, Download, X
} from 'lucide-react';
import { formatDate, abrirGoogleCalendar } from '../utils/helpers';
import EmptyState from './ui/EmptyState';

function Calendario({ actividades, recordatorios, setRecordatorios, tareas, setTareas, cuentas, pipeline, leads, setCurrentModule, currentUser, usuarios }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});

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

        if (rec.clienteId || rec.cuentaId) {
          const cuenta = cuentas.find(c => c.id === rec.clienteId || c.id === rec.cuentaId);
          nombreEntidad = cuenta?.empresa || 'Cuenta';
          tipoEntidad = 'cuenta';
          entidadId = rec.cuentaId || rec.clienteId;
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
          hora: rec.hora,
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

        if (tarea.clienteId || tarea.cuentaId) {
          const cuenta = cuentas.find(c => c.id === tarea.clienteId || c.id === tarea.cuentaId);
          nombreEntidad = cuenta?.empresa || 'Cuenta';
          tipoEntidad = 'cuenta';
          entidadId = tarea.cuentaId || tarea.clienteId;
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
          hora: tarea.hora,
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
    if (event.tipoEntidad === 'cuenta') {
      setCurrentModule('cuentas');
    } else if (event.tipoEntidad === 'prospecto') {
      setCurrentModule('pipeline');
    }
    setSelectedEvent(null);
  };

  // Toggle completado/completada
  const toggleCompletado = (event, e) => {
    e.stopPropagation();
    if (event.tipo === 'recordatorio') {
      setRecordatorios(prev => prev.map(r => r.id === event.id ? { ...r, completado: !r.completado } : r));
    } else if (event.tipo === 'tarea') {
      setTareas(prev => prev.map(t => t.id === event.id ? { ...t, completada: !t.completada } : t));
    }
  };

  // Editar evento desde el calendario
  const handleStartEdit = () => {
    if (!selectedEvent) return;
    if (selectedEvent.tipo === 'tarea') {
      setEditForm({
        descripcion: selectedEvent.descripcion || '',
        fecha: selectedEvent.fecha || '',
        hora: selectedEvent.hora || '',
        prioridad: selectedEvent.prioridad || 'media'
      });
    } else if (selectedEvent.tipo === 'recordatorio') {
      setEditForm({
        titulo: selectedEvent.titulo || '',
        descripcion: selectedEvent.descripcion || '',
        fecha: selectedEvent.fecha || '',
        hora: selectedEvent.hora || ''
      });
    }
    setEditMode(true);
  };

  const handleSaveEdit = () => {
    if (!selectedEvent) return;
    if (selectedEvent.tipo === 'tarea') {
      setTareas(prev => prev.map(t => t.id === selectedEvent.id ? {
        ...t,
        descripcion: editForm.descripcion,
        fechaCompromiso: editForm.fecha,
        hora: editForm.hora,
        prioridad: editForm.prioridad
      } : t));
    } else if (selectedEvent.tipo === 'recordatorio') {
      setRecordatorios(prev => prev.map(r => r.id === selectedEvent.id ? {
        ...r,
        titulo: editForm.titulo,
        descripcion: editForm.descripcion,
        fecha: editForm.fecha,
        hora: editForm.hora
      } : r));
    }
    setEditMode(false);
    setSelectedEvent(null);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditForm({});
  };

  // Render calendar data
  const { daysInMonth, startingDay } = getDaysInMonth(currentDate);
  const today = new Date();
  const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  // Agenda date (selected or today)
  const agendaDate = selectedDate || todayKey;
  const agendaEvents = getEventsForDate(agendaDate);

  // Group events by hour for daily agenda
  const eventosPorHora = {};
  const eventosSinHora = [];
  agendaEvents.forEach(event => {
    if (event.hora) {
      const h = parseInt(event.hora.split(':')[0], 10);
      if (!eventosPorHora[h]) eventosPorHora[h] = [];
      eventosPorHora[h].push(event);
    } else {
      eventosSinHora.push(event);
    }
  });

  const ahora = new Date();
  const horaActual = ahora.getHours();
  const minutoActual = ahora.getMinutes();
  const esHoyAgenda = agendaDate === todayKey;

  // Upcoming events (next 7 days)
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
    <div className="h-[calc(100vh-140px)] flex flex-col">
      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setSelectedEvent(null); setEditMode(false); }}>
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
                    <p className="text-sm text-slate-400">{formatDate(selectedEvent.fecha)}{selectedEvent.hora ? ` a las ${selectedEvent.hora}` : ''}</p>
                  </div>
                </div>
                <button onClick={() => { setSelectedEvent(null); setEditMode(false); }} className="text-slate-400 hover:text-white p-1">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            {editMode ? (
              <div className="p-6 space-y-4">
                {/* Edit Form */}
                {selectedEvent.tipo === 'recordatorio' && (
                  <div>
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Título</label>
                    <input
                      type="text"
                      value={editForm.titulo || ''}
                      onChange={e => setEditForm({...editForm, titulo: e.target.value})}
                      className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Descripción</label>
                  <textarea
                    value={editForm.descripcion || ''}
                    onChange={e => setEditForm({...editForm, descripcion: e.target.value})}
                    rows={3}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition-colors resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Fecha</label>
                    <input
                      type="date"
                      value={editForm.fecha || ''}
                      onChange={e => setEditForm({...editForm, fecha: e.target.value})}
                      className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Hora</label>
                    <input
                      type="time"
                      value={editForm.hora || ''}
                      onChange={e => setEditForm({...editForm, hora: e.target.value})}
                      className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>
                </div>
                {selectedEvent.tipo === 'tarea' && (
                  <div>
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Prioridad</label>
                    <select
                      value={editForm.prioridad || 'media'}
                      onChange={e => setEditForm({...editForm, prioridad: e.target.value})}
                      className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    >
                      <option value="alta">Alta</option>
                      <option value="media">Media</option>
                      <option value="baja">Baja</option>
                    </select>
                  </div>
                )}
                {/* Entity info (read only) */}
                <div className="pt-2 border-t border-slate-800">
                  <p className="text-xs text-slate-500">
                    {selectedEvent.tipoEntidad === 'cuenta' ? 'Cuenta' : selectedEvent.tipoEntidad === 'lead' ? 'Lead' : 'Prospecto'}: <span className="text-cyan-400">{selectedEvent.nombreEntidad}</span>
                  </p>
                </div>
              </div>
            ) : (
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
                    {selectedEvent.tipoEntidad === 'cuenta' ? 'Cuenta' : selectedEvent.tipoEntidad === 'lead' ? 'Lead' : 'Prospecto'}
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
            )}

            {/* Modal Footer */}
            {editMode ? (
              <div className="p-6 border-t border-slate-800 flex gap-3">
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors"
                >
                  <Save size={18} />
                  Guardar
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-3 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="p-6 border-t border-slate-800 flex gap-3 flex-wrap">
                {(selectedEvent.tipo === 'tarea' || selectedEvent.tipo === 'recordatorio') && (
                  <button
                    onClick={handleStartEdit}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-medium transition-colors"
                  >
                    <Edit size={18} />
                    Editar
                  </button>
                )}
                <button
                  onClick={() => abrirGoogleCalendar({ titulo: selectedEvent.titulo || selectedEvent.descripcion, descripcion: `${selectedEvent.tipo === 'tarea' ? 'Tarea' : 'Recordatorio'} CRM — ${selectedEvent.nombreEntidad || ''}${selectedEvent.descripcion && selectedEvent.titulo ? '\n' + selectedEvent.descripcion : ''}`, fecha: selectedEvent.fecha, hora: selectedEvent.hora, userEmail: currentUser?.googleEmail || currentUser?.email })}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
                  title="Agregar a Google Calendar"
                >
                  <Calendar size={18} />
                  Google Calendar
                </button>
                <button
                  onClick={() => handleGoToEntity(selectedEvent)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-500 to-violet-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                >
                  <ArrowUpRight size={18} />
                  Ir a {selectedEvent.tipoEntidad === 'cuenta' ? 'Cuentas' : 'Pipeline'}
                </button>
                <button
                  onClick={() => { setSelectedEvent(null); setEditMode(false); }}
                  className="px-4 py-3 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Apple-Style Split Calendar View */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-slate-300/40 overflow-hidden shadow-2xl">

        {/* LEFT PANEL: Mini Calendar + Upcoming */}
        <div className="lg:w-[320px] xl:w-[350px] flex-shrink-0 lg:border-r border-b lg:border-b-0 border-slate-300/40 flex flex-col">

          {/* Month Navigation */}
          <div className="px-5 py-4 flex items-center justify-between">
            <button onClick={goToPrevMonth} className="p-1.5 hover:bg-slate-700/50 rounded-lg transition-all text-slate-400 hover:text-white">
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
            <h3 className="text-base font-semibold text-white tracking-wide">
              {getMonthName(currentDate)} {currentDate.getFullYear()}
            </h3>
            <button onClick={goToNextMonth} className="p-1.5 hover:bg-slate-700/50 rounded-lg transition-all text-slate-400 hover:text-white">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Mini Calendar Grid */}
          <div className="px-4 pb-3">
            <div className="grid grid-cols-7 mb-1">
              {['D','L','M','M','J','V','S'].map((d,i) => (
                <div key={i} className="text-center text-[11px] font-semibold text-slate-300 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({length: startingDay}).map((_,i) => (
                <div key={`e-${i}`} className="aspect-square" />
              ))}
              {Array.from({length: daysInMonth}).map((_,i) => {
                const day = i + 1;
                const dateKey = formatDateKey(currentDate.getFullYear(), currentDate.getMonth(), day);
                const dayEvents = getEventsForDate(dateKey);
                const isToday = dateKey === todayKey;
                const isSelected = dateKey === agendaDate;

                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDate(dateKey)}
                    className="aspect-square flex flex-col items-center justify-center cursor-pointer relative group"
                  >
                    <div className={`w-8 h-8 flex items-center justify-center rounded-full transition-all text-sm
                      ${isSelected
                        ? 'bg-cyan-500 text-white font-bold shadow-lg shadow-cyan-500/30'
                        : isToday
                          ? 'ring-2 ring-cyan-500/60 text-cyan-400 font-semibold'
                          : 'text-slate-300 group-hover:bg-slate-700/50 font-medium'}
                    `}>
                      {day}
                    </div>
                    {dayEvents.length > 0 && !isSelected && (
                      <div className="flex gap-[3px] absolute bottom-0.5">
                        {dayEvents.slice(0,3).map((e,idx) => (
                          <div key={idx} className={`w-[5px] h-[5px] rounded-full ${e.color}`} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Today Button */}
          <div className="px-4 pb-3">
            <button onClick={goToToday} className="w-full py-2 text-sm text-cyan-400 hover:bg-cyan-500/10 rounded-xl transition-all font-medium">
              Ir a Hoy
            </button>
          </div>

          <div className="border-t border-slate-300/40" />

          {/* Upcoming Events + Legend */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <h4 className="text-[11px] font-bold text-slate-200 uppercase tracking-widest">Próximos 7 días</h4>
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map(({ date, dateKey: dk, events }, idx) => (
                <div key={idx}>
                  <p className="text-xs font-semibold text-slate-400 mb-1.5 capitalize">
                    {date.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                  <div className="space-y-1">
                    {events.slice(0,3).map((event, eventIdx) => (
                      <div
                        key={eventIdx}
                        onClick={() => { setSelectedDate(dk); setSelectedEvent(event); }}
                        className="flex items-center gap-2 py-1 cursor-pointer hover:bg-slate-700/30 rounded-lg px-2 -mx-2 transition-colors"
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleCompletado(event, e); }}
                          className="w-3.5 h-3.5 rounded-full border-[1.5px] border-slate-500 flex-shrink-0 flex items-center justify-center hover:border-slate-300 transition-all"
                        >
                          {(event.completada || event.completado) && <CheckCircle size={10} className="text-emerald-400" />}
                        </button>
                        <span className={`text-sm text-slate-300 truncate ${event.completada || event.completado ? 'line-through opacity-50' : ''}`}>{event.hora ? `${event.hora} ` : ''}{event.titulo || event.descripcion?.slice(0,25) || event.tipo}</span>
                      </div>
                    ))}
                    {events.length > 3 && (
                      <p className="text-xs text-slate-600 pl-4">+{events.length - 3} más</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600 text-center py-4">Sin eventos próximos</p>
            )}

            {/* Compact Legend */}
            <div className="border-t border-slate-300/40 pt-4 mt-4">
              <h4 className="text-[11px] font-bold text-slate-200 uppercase tracking-widest mb-2">Leyenda</h4>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500" /><span className="text-slate-400">Recordatorio</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-slate-400">Tarea Alta</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-cyan-500" /><span className="text-slate-400">Tarea Media</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-violet-500" /><span className="text-slate-400">Tarea Baja</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-slate-400">Completado</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Daily Agenda */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Day Header */}
          <div className="px-6 py-4 border-b border-slate-300/40 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white capitalize">
                {(() => {
                  const d = new Date(agendaDate + 'T12:00:00');
                  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                })()}
              </h3>
              {esHoyAgenda && <span className="text-xs text-cyan-400 font-semibold tracking-wide">HOY</span>}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const d = new Date(agendaDate + 'T00:00:00');
                  d.setDate(d.getDate() - 1);
                  setSelectedDate(formatDateKey(d.getFullYear(), d.getMonth(), d.getDate()));
                }}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition-all text-slate-400 hover:text-white"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
              <button
                onClick={() => setSelectedDate(todayKey)}
                className="px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700/50 rounded-lg transition-all font-medium"
              >
                Hoy
              </button>
              <button
                onClick={() => {
                  const d = new Date(agendaDate + 'T00:00:00');
                  d.setDate(d.getDate() + 1);
                  setSelectedDate(formatDateKey(d.getFullYear(), d.getMonth(), d.getDate()));
                }}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition-all text-slate-400 hover:text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* All-day events */}
          {eventosSinHora.length > 0 && (
            <div className="px-6 py-2.5 border-b border-slate-300/40 bg-slate-800/20">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-semibold text-slate-200 uppercase tracking-wider w-14 text-right flex-shrink-0">Todo el día</span>
                <div className="flex flex-wrap gap-1.5">
                  {eventosSinHora.map((event, idx) => {
                    const Icon = event.icon;
                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedEvent(event)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-white cursor-pointer hover:opacity-80 transition-opacity ${event.color}`}
                      >
                        <button
                          onClick={(e) => toggleCompletado(event, e)}
                          className="w-4 h-4 rounded-full border-[1.5px] border-white/50 flex-shrink-0 flex items-center justify-center hover:border-white transition-all"
                        >
                          {(event.completada || event.completado) && <CheckCircle size={11} className="text-white" />}
                        </button>
                        <Icon size={12} />
                        <span className={`truncate max-w-[180px] ${event.completada || event.completado ? 'line-through opacity-70' : ''}`}>{event.titulo || event.descripcion?.slice(0,30) || event.tipo}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="flex-1 overflow-y-auto relative">
            {agendaEvents.length === 0 && (
              <EmptyState
                icon={Calendar}
                title="Sin eventos"
                description="No hay actividades para este día"
              />
            )}
            {/* Current time indicator */}
            {esHoyAgenda && horaActual >= 8 && horaActual <= 22 && (
              <div
                className="absolute left-0 right-0 z-10 pointer-events-none"
                style={{ top: `${(horaActual - 8) * 60 + (minutoActual / 60) * 60}px` }}
              >
                <div className="flex items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 ml-[58px] -mr-1.5 flex-shrink-0 shadow-lg shadow-red-500/50" />
                  <div className="flex-1 h-[2px] bg-red-500 shadow-sm shadow-red-500/50" />
                </div>
              </div>
            )}

            {/* Hour rows */}
            {[8,9,10,11,12,13,14,15,16,17,18,19,20,21,22].map(h => {
              const eventosEnHora = eventosPorHora[h] || [];
              const horaStr = `${String(h).padStart(2, '0')}:00`;
              const esPasada = esHoyAgenda && h < horaActual;

              return (
                <div key={h} className={`flex border-b border-slate-300/35 min-h-[60px] ${esPasada ? 'opacity-40' : ''}`}>
                  <div className="w-[65px] flex-shrink-0 py-2 pr-3 text-right">
                    <span className={`text-[11px] font-medium ${esHoyAgenda && h === horaActual ? 'text-red-400 font-bold' : 'text-slate-200'}`}>
                      {horaStr}
                    </span>
                  </div>
                  <div className="flex-1 py-1 px-3 border-l border-slate-300/40">
                    {eventosEnHora.length > 0 && (
                      <div className="space-y-1">
                        {eventosEnHora.map((event, idx) => {
                          const Icon = event.icon;
                          return (
                            <div
                              key={idx}
                              onClick={() => setSelectedEvent(event)}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:scale-[1.01] transition-all ${event.color} shadow-lg`}
                            >
                              <button
                                onClick={(e) => toggleCompletado(event, e)}
                                className="w-5 h-5 rounded-full border-2 border-white/50 flex-shrink-0 flex items-center justify-center hover:border-white transition-all"
                                title={event.completada || event.completado ? 'Marcar pendiente' : 'Marcar completado'}
                              >
                                {(event.completada || event.completado) && <CheckCircle size={14} className="text-white" />}
                              </button>
                              <Icon size={15} className="text-white/90 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold text-white truncate ${event.completada || event.completado ? 'line-through opacity-70' : ''}`}>
                                  {event.titulo || event.descripcion?.slice(0,40)}
                                </p>
                                <p className="text-[11px] text-white/60 truncate">
                                  {event.hora} · {event.nombreEntidad} · {event.tipo === 'tarea' ? 'Tarea' : 'Recordatorio'}
                                </p>
                              </div>
                              {event.tipo === 'tarea' && event.prioridad && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 text-white font-medium uppercase tracking-wider">
                                  {event.prioridad}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-slate-300/40 flex items-center justify-between bg-slate-900/30">
            <p className="text-sm text-slate-500">
              {agendaEvents.length === 0
                ? 'Sin eventos para este día'
                : `${agendaEvents.length} evento${agendaEvents.length !== 1 ? 's' : ''}`}
            </p>
            {agendaEvents.length > 0 && (
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-cyan-400"><Target size={12} /> {agendaEvents.filter(e => e.tipo === 'tarea').length} tareas</span>
                <span className="flex items-center gap-1.5 text-amber-400"><Bell size={12} /> {agendaEvents.filter(e => e.tipo === 'recordatorio').length} recordatorios</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Calendario;
