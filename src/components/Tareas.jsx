import React, { useState } from 'react';
import {
  Plus, Trash2, Edit, CheckCircle, Clock, Target,
  Calendar, AlertCircle, Building, User, X
} from 'lucide-react';
import { formatDate, generateId, getFechaLocal, abrirGoogleCalendar, completarTareaConRecurrencia, RECURRENCIA_OPTIONS } from '../utils/helpers';
import EmptyState from './ui/EmptyState';

function Tareas({ tareas, setTareas, cuentas, pipeline, leads, actividades, usuarios, currentUser, addNotificacion }) {
  const [filtro, setFiltro] = useState('todas');
  const [showForm, setShowForm] = useState(false);
  const [editingTarea, setEditingTarea] = useState(null);
  const [form, setForm] = useState({
    descripcion: '',
    fechaCompromiso: '',
    hora: '',
    prioridad: 'media',
    recurrencia: 'ninguna',
    responsableId: '',
    cuentaId: '',
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
      hora: '',
      prioridad: 'media',
      recurrencia: 'ninguna',
      responsableId: '',
      cuentaId: '',
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
      hora: tarea.hora || '',
      prioridad: tarea.prioridad || 'media',
      recurrencia: tarea.recurrencia || 'ninguna',
      responsableId: tarea.responsableId || '',
      cuentaId: tarea.cuentaId || tarea.clienteId || '',
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
    const { newTareas } = completarTareaConRecurrencia(tareas, id, generateId);
    setTareas(newTareas);
  };

  const getEntidadNombre = (tarea) => {
    const cuentaId = tarea.cuentaId || tarea.clienteId;
    if (cuentaId) {
      const cuenta = cuentas.find(c => c.id === cuentaId);
      return { nombre: cuenta?.empresa || 'Cuenta', tipo: 'cuenta' };
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
        <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-4 border border-white/[0.08]">
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
        <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-4 border border-white/[0.08]">
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
        <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-4 border border-white/[0.08]">
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
          <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl border border-white/[0.08]">
            <EmptyState
              icon={CheckCircle}
              title="Sin tareas pendientes"
              description="Crea tu primera tarea"
              actionLabel="Nueva Tarea"
              onAction={() => { resetForm(); setShowForm(true); }}
            />
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
                        : 'border-slate-300/40 hover:border-cyan-500'
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
                            {esHoy ? 'Hoy' : esVencida ? 'Vencida' : formatDate(tarea.fechaCompromiso)}{tarea.hora ? ` ${tarea.hora}` : ''}
                          </span>
                          {/* Prioridad */}
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            tarea.prioridad === 'alta' ? 'bg-red-500/20 text-red-400' :
                            tarea.prioridad === 'media' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {tarea.prioridad === 'alta' ? 'Alta' : tarea.prioridad === 'media' ? 'Media' : 'Baja'}
                          </span>
                          {/* Recurrencia */}
                          {tarea.recurrencia && tarea.recurrencia !== 'ninguna' && (
                            <span className="px-2 py-0.5 rounded text-xs bg-cyan-500/20 text-cyan-400 flex items-center gap-1">
                              ↻ {RECURRENCIA_OPTIONS.find(r => r.id === tarea.recurrencia)?.label}
                            </span>
                          )}
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
                          onClick={() => abrirGoogleCalendar({ titulo: tarea.descripcion, descripcion: `Tarea CRM${entidad ? ' — ' + entidad.nombre : ''}`, fecha: tarea.fechaCompromiso, hora: tarea.hora, userEmail: currentUser?.googleEmail || currentUser?.email })}
                          className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-all"
                          title="Agregar a Google Calendar"
                        >
                          <Calendar size={16} />
                        </button>
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
          <div className="bg-slate-900 rounded-2xl border border-slate-300/40 w-full max-w-lg animate-modal-in">
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
              <div className="bg-teal-900/15 border border-teal-500/20 rounded-xl p-5 space-y-4">
              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Descripción *</label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white resize-none"
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
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white"
                  />
                </div>

                {/* Hora */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Hora</label>
                  <input
                    type="time"
                    value={form.hora}
                    onChange={(e) => setForm({ ...form, hora: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white"
                  />
                </div>

                {/* Prioridad */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Prioridad</label>
                  <select
                    value={form.prioridad}
                    onChange={(e) => setForm({ ...form, prioridad: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white"
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>

                {/* Recurrencia */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Recurrencia</label>
                  <select
                    value={form.recurrencia}
                    onChange={(e) => setForm({ ...form, recurrencia: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white"
                  >
                    {RECURRENCIA_OPTIONS.map(r => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Responsable */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Asignar a</label>
                <select
                  value={form.responsableId}
                  onChange={(e) => setForm({ ...form, responsableId: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white"
                >
                  <option value="">Yo mismo</option>
                  {usuariosActivos.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} {u.id === currentUser?.id ? '(yo)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cuenta o Prospecto */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Cuenta (opcional)</label>
                  <select
                    value={form.cuentaId}
                    onChange={(e) => setForm({ ...form, cuentaId: e.target.value, pipelineId: '' })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white"
                  >
                    <option value="">Sin cuenta</option>
                    {cuentas.map(c => (
                      <option key={c.id} value={c.id}>{c.empresa}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Prospecto (opcional)</label>
                  <select
                    value={form.pipelineId}
                    onChange={(e) => setForm({ ...form, pipelineId: e.target.value, cuentaId: '' })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-300/40 rounded-xl text-white"
                  >
                    <option value="">Sin prospecto</option>
                    {pipeline.filter(p => !['cerrado', 'perdido'].includes(p.etapa)).map(p => (
                      <option key={p.id} value={p.id}>{p.empresa}</option>
                    ))}
                  </select>
                </div>
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

export default Tareas;
