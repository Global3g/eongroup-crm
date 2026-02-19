import React from 'react';
import {
  Building, UserPlus, GitBranch, CheckCircle, Clock,
  Bell, Target, Calendar, DollarSign, BarChart3
} from 'lucide-react';
import { formatDate, getFechaLocal, abrirGoogleCalendar, generateId, completarTareaConRecurrencia } from '../utils/helpers';
import { PIPELINE_STAGES } from '../utils/constants';
import StatCard from './ui/StatCard';
import EmptyState from './ui/EmptyState';
import Timeline from './ui/Timeline';
import AutomationPanel from './AutomationPanel';

function Dashboard({ cuentas, leads, pipeline, recordatorios, setRecordatorios, tareas, setTareas, setCurrentModule, currentUser, usuarios, actividades, addNotificacion }) {
  const totalCuentas = cuentas.length;
  const totalLeads = leads.length;
  const enPipeline = pipeline.filter(p => !['cerrado', 'perdido'].includes(p.etapa)).length;
  const cerradosGanados = pipeline.filter(p => p.etapa === 'cerrado').length;
  const valorPotencial = pipeline
    .filter(p => !['cerrado', 'perdido'].includes(p.etapa))
    .reduce((sum, p) => sum + (parseFloat(p.valorEstimado) || 0), 0);

  // Calculate trends: compare current month vs previous month
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const isCurrentMonth = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  };
  const isPrevMonth = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
  };

  const calcTrend = (currentCount, prevCount) => {
    if (prevCount === 0 && currentCount === 0) return { trend: 'neutral', change: 0 };
    if (prevCount === 0) return { trend: 'up', change: 100 };
    const pct = Math.round(((currentCount - prevCount) / prevCount) * 100);
    if (pct > 0) return { trend: 'up', change: pct };
    if (pct < 0) return { trend: 'down', change: pct };
    return { trend: 'neutral', change: 0 };
  };

  const cuentasCurrent = cuentas.filter(c => isCurrentMonth(c.fechaCreacion)).length;
  const cuentasPrev = cuentas.filter(c => isPrevMonth(c.fechaCreacion)).length;
  const cuentasTrend = calcTrend(cuentasCurrent, cuentasPrev);

  const leadsCurrent = leads.filter(l => isCurrentMonth(l.fechaCreacion)).length;
  const leadsPrev = leads.filter(l => isPrevMonth(l.fechaCreacion)).length;
  const leadsTrend = calcTrend(leadsCurrent, leadsPrev);

  const pipelineCurrent = pipeline.filter(p => !['cerrado', 'perdido'].includes(p.etapa) && isCurrentMonth(p.fechaCreacion)).length;
  const pipelinePrev = pipeline.filter(p => !['cerrado', 'perdido'].includes(p.etapa) && isPrevMonth(p.fechaCreacion)).length;
  const pipelineTrend = calcTrend(pipelineCurrent, pipelinePrev);

  const cerradosCurrent = pipeline.filter(p => p.etapa === 'cerrado' && isCurrentMonth(p.fechaCreacion)).length;
  const cerradosPrev = pipeline.filter(p => p.etapa === 'cerrado' && isPrevMonth(p.fechaCreacion)).length;
  const cerradosTrend = calcTrend(cerradosCurrent, cerradosPrev);

  // Map actividades to Timeline format
  const actividadesTimeline = (actividades || [])
    .sort((a, b) => new Date(b.fechaCreacion || b.fecha) - new Date(a.fechaCreacion || a.fecha))
    .slice(0, 10)
    .map(a => {
      const usuario = usuarios?.find(u => u.id === (a.responsableId || a.creadoPor));
      return {
        id: a.id,
        tipo: a.tipo || 'nota',
        titulo: a.titulo || a.descripcion || 'Sin titulo',
        descripcion: a.descripcion || '',
        fecha: a.fechaCreacion || a.fecha,
        hora: a.hora || '',
        usuario: usuario?.nombre || '',
        archivo: a.archivo || null,
      };
    });

  const hoy = getFechaLocal();

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
      const { newTareas } = completarTareaConRecurrencia(tareas, id, generateId);
      setTareas(newTareas);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-black tracking-tight text-white mb-2">Dashboard</h1>
        <p className="text-slate-300">Resumen de tu actividad comercial</p>
      </div>

      {/* Mis Tareas y Recordatorios Pendientes */}
      {totalTareasPendientes > 0 && (
        <div className="bg-gradient-to-r from-violet-500/10 to-cyan-500/10 rounded-2xl p-8 border border-white/[0.08]">
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
              <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-4 border border-white/[0.06]">
                <h4 className="text-sm font-medium text-cyan-400 mb-3 flex items-center gap-2">
                  <Target size={14} />
                  Tareas ({misTareasPendientes.length})
                </h4>
                <div className="space-y-2">
                  {misTareasPendientes.map(tarea => {
                    const cuenta = cuentas.find(c => c.id === tarea.clienteId || c.id === tarea.cuentaId);
                    const pipelineItem = pipeline.find(p => p.id === tarea.pipelineId);
                    const lead = leads.find(l => l.id === tarea.leadId);
                    const entidadNombre = cuenta?.empresa || pipelineItem?.empresa || lead?.empresa || tarea.leadNombre || 'Sin asociar';
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
                              {' '}Compromiso: {esHoy ? 'Hoy' : esPasado ? `Vencido (${formatDate(tarea.fechaCompromiso)})` : formatDate(tarea.fechaCompromiso)}{tarea.hora ? ` ${tarea.hora}` : ''}
                            </span>
                          </p>
                          {tarea.fechaCreacion && (
                            <p className="text-slate-600 text-xs">Creada: {new Date(tarea.fechaCreacion).toLocaleDateString('es-MX')}</p>
                          )}
                        </div>
                        <button
                          onClick={() => abrirGoogleCalendar({ titulo: tarea.descripcion, descripcion: `Tarea CRM — ${entidadNombre}`, fecha: tarea.fechaCompromiso, hora: tarea.hora, userEmail: currentUser?.googleEmail || currentUser?.email })}
                          className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg text-blue-400 transition-all"
                          title="Agregar a Google Calendar"
                        >
                          <Calendar size={14} />
                        </button>
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
              <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-4 border border-white/[0.06]">
                <h4 className="text-sm font-medium text-amber-400 mb-3 flex items-center gap-2">
                  <Bell size={14} />
                  Recordatorios ({misRecordatoriosPendientes.length})
                </h4>
                <div className="space-y-2">
                  {misRecordatoriosPendientes.map(rec => {
                    const cuenta = cuentas.find(c => c.id === rec.clienteId || c.id === rec.cuentaId);
                    const pipelineItem = pipeline.find(p => p.id === rec.pipelineId);
                    const lead = leads.find(l => l.id === rec.leadId);
                    const entidadNombre = cuenta?.empresa || pipelineItem?.empresa || lead?.empresa || rec.leadNombre || 'Sin asociar';
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
                              {esHoy ? ' Hoy' : esPasado ? ' Vencido' : ` ${formatDate(rec.fecha)}`}{rec.hora ? ` ${rec.hora}` : ''}
                            </span>
                          </p>
                        </div>
                        <button
                          onClick={() => abrirGoogleCalendar({ titulo: rec.titulo, descripcion: `Recordatorio CRM — ${entidadNombre}${rec.descripcion ? '\n' + rec.descripcion : ''}`, fecha: rec.fecha, hora: rec.hora, userEmail: currentUser?.googleEmail || currentUser?.email })}
                          className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg text-blue-400 transition-all"
                          title="Agregar a Google Calendar"
                        >
                          <Calendar size={14} />
                        </button>
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

      {/* Stats Grid - Using StatCard component */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="cursor-pointer" onClick={() => setCurrentModule('cuentas')}>
          <StatCard
            icon={Building}
            title="Cuentas Activas"
            value={totalCuentas}
            trend={cuentasTrend.trend}
            change={cuentasTrend.change}
            color="cyan"
          />
        </div>
        <div className="cursor-pointer" onClick={() => setCurrentModule('leads')}>
          <StatCard
            icon={UserPlus}
            title="Leads"
            value={totalLeads}
            trend={leadsTrend.trend}
            change={leadsTrend.change}
            color="violet"
          />
        </div>
        <div className="cursor-pointer" onClick={() => setCurrentModule('pipeline')}>
          <StatCard
            icon={GitBranch}
            title="En Pipeline"
            value={enPipeline}
            trend={pipelineTrend.trend}
            change={pipelineTrend.change}
            color="amber"
          />
        </div>
        <StatCard
          icon={CheckCircle}
          title="Cerrados Ganados"
          value={cerradosGanados}
          trend={cerradosTrend.trend}
          change={cerradosTrend.change}
          color="emerald"
        />
      </div>

      {/* Alertas Automaticas */}
      <div className="mb-8">
        <AutomationPanel
          pipeline={pipeline}
          actividades={actividades}
          tareas={tareas}
          recordatorios={recordatorios}
          cuentas={cuentas}
          currentUser={currentUser}
          usuarios={usuarios}
          addNotificacion={addNotificacion}
          setCurrentModule={setCurrentModule}
        />
      </div>

      {/* Valor Potencial */}
      {valorPotencial > 0 && (
        <div className="bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-cyan-500/10 rounded-2xl p-8 border border-white/[0.08]">
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
        <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-8 border border-white/[0.06]">
          <h3 className="text-lg font-semibold text-white mb-4">Pipeline por Etapa</h3>
          {pipeline.length === 0 ? (
            <EmptyState
              icon={GitBranch}
              title="Sin prospectos"
              description="Aun no hay prospectos en el pipeline. Agrega tu primer prospecto para comenzar."
              actionLabel="Ir a Pipeline"
              onAction={() => setCurrentModule('pipeline')}
            />
          ) : (
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
          )}
        </div>

        {/* Actividad Reciente - Using Timeline component */}
        <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-8 border border-white/[0.06]">
          <h3 className="text-lg font-semibold text-white mb-4">Actividad Reciente</h3>
          {actividadesTimeline.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="Sin actividad reciente"
              description="Registra llamadas, emails o reuniones desde una cuenta o prospecto."
              actionLabel="Ir a Cuentas"
              onAction={() => setCurrentModule('cuentas')}
            />
          ) : (
            <Timeline activities={actividadesTimeline} />
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
