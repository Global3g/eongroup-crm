import React, { useState, useMemo } from 'react';
import {
  AlertTriangle, Clock, Bell, CheckCircle, ChevronDown, ChevronUp,
  Eye, GitBranch, Target, Activity, Zap
} from 'lucide-react';
import {
  detectDealsEstancados,
  detectRecordatoriosVencidos,
  detectTareasVencidas,
  detectDealsEnMismaEtapa,
  generarResumenDiario
} from '../utils/automations';
import { PIPELINE_STAGES } from '../utils/constants';

function AutomationPanel({ pipeline, actividades, tareas, recordatorios, cuentas, currentUser, usuarios, addNotificacion, setCurrentModule }) {
  const [expanded, setExpanded] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    dealsEstancados: true,
    dealsEtapa: true,
    recordatoriosVencidos: true,
    tareasVencidas: true
  });

  // Run all detection rules
  const dealsEstancados = useMemo(
    () => detectDealsEstancados(pipeline || [], actividades || [], 7),
    [pipeline, actividades]
  );

  const dealsEnMismaEtapa = useMemo(
    () => detectDealsEnMismaEtapa(pipeline || [], 14),
    [pipeline]
  );

  const recordatoriosVencidos = useMemo(
    () => detectRecordatoriosVencidos(recordatorios || []),
    [recordatorios]
  );

  const tareasVencidas = useMemo(
    () => detectTareasVencidas(tareas || []),
    [tareas]
  );

  const resumen = useMemo(
    () => generarResumenDiario(currentUser?.id, pipeline || [], tareas || [], recordatorios || [], actividades || []),
    [currentUser, pipeline, tareas, recordatorios, actividades]
  );

  const totalAlertas = dealsEstancados.length + dealsEnMismaEtapa.length + recordatoriosVencidos.length + tareasVencidas.length;

  const toggleSection = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getStageName = (etapaId) => {
    const stage = PIPELINE_STAGES.find(s => s.id === etapaId);
    return stage ? stage.name : etapaId;
  };

  const getUsuarioNombre = (userId) => {
    if (!userId || !usuarios) return '';
    const user = usuarios.find(u => u.id === userId);
    return user ? user.nombre : '';
  };

  const handleNavegar = (modulo) => {
    if (setCurrentModule) setCurrentModule(modulo);
  };

  const noAlertas = totalAlertas === 0;

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="text-white font-semibold text-lg">Alertas Automaticas</h3>
            <p className="text-slate-400 text-sm">Motor de reglas del CRM</p>
          </div>
          {totalAlertas > 0 && (
            <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">
              {totalAlertas}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Resumen del dia */}
          <div className="bg-gradient-to-r from-cyan-500/10 to-violet-500/10 rounded-xl p-4 border border-cyan-500/20">
            <h4 className="text-white font-medium mb-3 flex items-center gap-2">
              <Activity size={16} className="text-cyan-400" />
              Resumen del dia
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-cyan-400">{resumen.dealsActivos}</p>
                <p className="text-slate-400 text-xs mt-1">Deals activos</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-violet-400">{resumen.tareasHoy}</p>
                <p className="text-slate-400 text-xs mt-1">Tareas hoy</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-400">{resumen.recordatoriosHoy}</p>
                <p className="text-slate-400 text-xs mt-1">Recordatorios hoy</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-400">{resumen.actividadesHoy}</p>
                <p className="text-slate-400 text-xs mt-1">Actividades hoy</p>
              </div>
              {resumen.tareasVencidas > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-400">{resumen.tareasVencidas}</p>
                  <p className="text-red-400/70 text-xs mt-1">Tareas vencidas</p>
                </div>
              )}
              {resumen.recordatoriosVencidos > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-400">{resumen.recordatoriosVencidos}</p>
                  <p className="text-red-400/70 text-xs mt-1">Rec. vencidos</p>
                </div>
              )}
            </div>
          </div>

          {/* Empty state */}
          {noAlertas && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
                <CheckCircle className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="text-white font-medium">Todo al dia</p>
              <p className="text-slate-400 text-sm mt-1">Sin alertas pendientes</p>
            </div>
          )}

          {/* Deals sin actividad */}
          {dealsEstancados.length > 0 && (
            <AlertSection
              title="Deals sin actividad"
              count={dealsEstancados.length}
              icon={Clock}
              colorClass="amber"
              expanded={expandedSections.dealsEstancados}
              onToggle={() => toggleSection('dealsEstancados')}
            >
              {dealsEstancados.map((alerta, idx) => (
                <AlertCard
                  key={`estancado-${idx}`}
                  icon={<Clock size={14} className="text-amber-400" />}
                  message={alerta.mensaje}
                  detail={`Etapa: ${getStageName(alerta.etapa)} ${alerta.asignadoA ? `| ${getUsuarioNombre(alerta.asignadoA)}` : ''}`}
                  colorClass="amber"
                  onView={() => handleNavegar('pipeline')}
                />
              ))}
            </AlertSection>
          )}

          {/* Deals en misma etapa */}
          {dealsEnMismaEtapa.length > 0 && (
            <AlertSection
              title="Deals estancados en misma etapa"
              count={dealsEnMismaEtapa.length}
              icon={GitBranch}
              colorClass="orange"
              expanded={expandedSections.dealsEtapa}
              onToggle={() => toggleSection('dealsEtapa')}
            >
              {dealsEnMismaEtapa.map((alerta, idx) => (
                <AlertCard
                  key={`etapa-${idx}`}
                  icon={<GitBranch size={14} className="text-orange-400" />}
                  message={alerta.mensaje}
                  detail={`${alerta.diasEnEtapa} dias en "${getStageName(alerta.etapa)}" ${alerta.asignadoA ? `| ${getUsuarioNombre(alerta.asignadoA)}` : ''}`}
                  colorClass="orange"
                  onView={() => handleNavegar('pipeline')}
                />
              ))}
            </AlertSection>
          )}

          {/* Recordatorios vencidos */}
          {recordatoriosVencidos.length > 0 && (
            <AlertSection
              title="Recordatorios vencidos"
              count={recordatoriosVencidos.length}
              icon={Bell}
              colorClass="red"
              expanded={expandedSections.recordatoriosVencidos}
              onToggle={() => toggleSection('recordatoriosVencidos')}
            >
              {recordatoriosVencidos.map((alerta, idx) => (
                <AlertCard
                  key={`rec-${idx}`}
                  icon={<Bell size={14} className="text-red-400" />}
                  message={alerta.mensaje}
                  detail={alerta.responsableId ? getUsuarioNombre(alerta.responsableId) : ''}
                  colorClass="red"
                  onView={() => handleNavegar('calendario')}
                />
              ))}
            </AlertSection>
          )}

          {/* Tareas vencidas */}
          {tareasVencidas.length > 0 && (
            <AlertSection
              title="Tareas vencidas"
              count={tareasVencidas.length}
              icon={Target}
              colorClass="red"
              expanded={expandedSections.tareasVencidas}
              onToggle={() => toggleSection('tareasVencidas')}
            >
              {tareasVencidas.map((alerta, idx) => (
                <AlertCard
                  key={`tarea-${idx}`}
                  icon={<Target size={14} className="text-red-400" />}
                  message={alerta.mensaje}
                  detail={alerta.responsableId ? getUsuarioNombre(alerta.responsableId) : ''}
                  colorClass="red"
                  onView={() => handleNavegar('tareas')}
                />
              ))}
            </AlertSection>
          )}
        </div>
      )}
    </div>
  );
}

// Collapsible section for each alert category
function AlertSection({ title, count, icon: Icon, colorClass, expanded, onToggle, children }) {
  const borderColors = {
    amber: 'border-amber-500/30',
    orange: 'border-orange-500/30',
    red: 'border-red-500/30'
  };
  const bgColors = {
    amber: 'from-amber-500/10 to-amber-600/5',
    orange: 'from-orange-500/10 to-orange-600/5',
    red: 'from-red-500/10 to-red-600/5'
  };
  const badgeColors = {
    amber: 'bg-amber-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500'
  };
  const textColors = {
    amber: 'text-amber-400',
    orange: 'text-orange-400',
    red: 'text-red-400'
  };

  return (
    <div className={`rounded-xl border ${borderColors[colorClass]} bg-gradient-to-r ${bgColors[colorClass]} overflow-hidden`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-all"
      >
        <div className="flex items-center gap-2">
          <Icon size={16} className={textColors[colorClass]} />
          <span className="text-white text-sm font-medium">{title}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold text-white ${badgeColors[colorClass]}`}>
            {count}
          </span>
        </div>
        {expanded ? (
          <ChevronUp size={14} className="text-slate-400" />
        ) : (
          <ChevronDown size={14} className="text-slate-400" />
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

// Individual alert card
function AlertCard({ icon, message, detail, colorClass, onView }) {
  return (
    <div className="flex items-center justify-between bg-slate-900/50 rounded-lg p-3 hover:bg-slate-900/70 transition-all">
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        <div className="mt-0.5">{icon}</div>
        <div className="min-w-0">
          <p className="text-white text-sm leading-snug">{message}</p>
          {detail && <p className="text-slate-500 text-xs mt-0.5">{detail}</p>}
        </div>
      </div>
      {onView && (
        <button
          onClick={onView}
          className="ml-2 flex-shrink-0 px-2.5 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg text-slate-300 text-xs font-medium transition-all flex items-center gap-1"
        >
          <Eye size={12} />
          Ver
        </button>
      )}
    </div>
  );
}

export default AutomationPanel;
