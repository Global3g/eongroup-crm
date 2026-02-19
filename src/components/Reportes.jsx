import React, { useState, useMemo } from 'react';
import {
  Building, UserPlus, GitBranch, CheckCircle, Clock,
  TrendingUp, XCircle, FileSpreadsheet, FileDown, PhoneCall, BarChart3,
  DollarSign, Award, Users, Activity, Percent,
  Calendar, Zap, Trophy, Medal, Crown,
  Sparkles, Lightbulb, TrendingDown
} from 'lucide-react';
import { PIPELINE_STAGES, TIPOS_ACTIVIDAD } from '../utils/constants';
import { exportarPDFCuentas, exportarPDFLeads, exportarPDFPipeline } from '../utils/pdfExport';
import { detectarPatrones } from '../utils/scoring';
import StatCard from './ui/StatCard';
import EmptyState from './ui/EmptyState';
import { FunnelChart, SimpleLineChart, DonutChart, HorizontalBarChart, SimpleAreaChart } from './ui/Charts';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const STAGE_PROBABILITIES = {
  prospecto: 0.10,
  contacto: 0.20,
  diagnostico: 0.40,
  piloto: 0.60,
  negociacion: 0.80
};

const STAGE_COLORS_HEX = {
  prospecto: '#64748b',
  contacto: '#3b82f6',
  diagnostico: '#06b6d4',
  piloto: '#8b5cf6',
  negociacion: '#f59e0b',
  cerrado: '#10b981',
  perdido: '#ef4444'
};

const ACTIVITY_COLORS_HEX = {
  llamada: '#10b981',
  whatsapp: '#22c55e',
  zoom: '#3b82f6',
  presencial: '#8b5cf6',
  email: '#06b6d4',
  nota: '#f59e0b'
};

function Reportes({ cuentas, leads, pipeline, actividades, usuarios, archivos, setArchivos }) {
  const [activeTab, setActiveTab] = useState('general');

  // ========================== CORE METRICS ==========================
  const totalOportunidades = pipeline.length;
  const cerradosGanados = pipeline.filter(p => p.etapa === 'cerrado');
  const cerradosPerdidos = pipeline.filter(p => p.etapa === 'perdido');
  const enProgreso = pipeline.filter(p => !['cerrado', 'perdido'].includes(p.etapa));

  const valorGanado = cerradosGanados.reduce((sum, p) => sum + (parseFloat(p.valorEstimado) || 0), 0);
  const valorPerdido = cerradosPerdidos.reduce((sum, p) => sum + (parseFloat(p.valorEstimado) || 0), 0);
  const valorEnProgreso = enProgreso.reduce((sum, p) => sum + (parseFloat(p.valorEstimado) || 0), 0);

  const tasaConversion = totalOportunidades > 0 ? ((cerradosGanados.length / totalOportunidades) * 100).toFixed(1) : 0;
  const ticketPromedio = cerradosGanados.length > 0 ? (valorGanado / cerradosGanados.length) : 0;

  // ========================== PIPELINE DISTRIBUTION ==========================
  const distribucionEtapas = PIPELINE_STAGES.map(stage => ({
    ...stage,
    count: pipeline.filter(p => p.etapa === stage.id).length,
    valor: pipeline.filter(p => p.etapa === stage.id).reduce((sum, p) => sum + (parseFloat(p.valorEstimado) || 0), 0)
  }));

  // ========================== ACTIVITY BY TYPE ==========================
  const actividadPorTipo = TIPOS_ACTIVIDAD.map(tipo => ({
    ...tipo,
    count: actividades.filter(a => a.tipo === tipo.id).length
  }));

  // ========================== HELPER: GET LAST 6 MONTHS ==========================
  const getLast6Months = () => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: MESES[d.getMonth()]
      });
    }
    return months;
  };

  const last6Months = getLast6Months();

  // ========================== VALUE BY MONTH (cerrados ganados) ==========================
  const valorPorMes = useMemo(() => {
    return last6Months.map(m => {
      const total = cerradosGanados
        .filter(p => {
          if (!p.fechaCreacion) return false;
          const d = new Date(p.fechaCreacion);
          return d.getFullYear() === m.year && d.getMonth() === m.month;
        })
        .reduce((sum, p) => sum + (parseFloat(p.valorEstimado) || 0), 0);
      return { label: m.label, value: total };
    });
  }, [cerradosGanados, last6Months]);

  // ========================== ACTIVITIES BY MONTH ==========================
  const actividadesPorMes = useMemo(() => {
    return last6Months.map(m => {
      const count = actividades.filter(a => {
        if (!a.fecha && !a.fechaCreacion) return false;
        const d = new Date(a.fecha || a.fechaCreacion);
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      }).length;
      return { label: m.label, value: count };
    });
  }, [actividades, last6Months]);

  // ========================== SALES FORECAST ==========================
  const forecast = useMemo(() => {
    const stageData = PIPELINE_STAGES
      .filter(s => STAGE_PROBABILITIES[s.id] !== undefined)
      .map(stage => {
        const stageItems = pipeline.filter(p => p.etapa === stage.id);
        const stageValue = stageItems.reduce((sum, p) => sum + (parseFloat(p.valorEstimado) || 0), 0);
        const probability = STAGE_PROBABILITIES[stage.id];
        const weightedValue = stageValue * probability;
        return {
          name: stage.name,
          id: stage.id,
          value: stageValue,
          probability,
          weightedValue,
          count: stageItems.length
        };
      });

    const totalWeighted = stageData.reduce((sum, s) => sum + s.weightedValue, 0);
    return { stageData, totalWeighted };
  }, [pipeline]);

  // ========================== FUNNEL DATA ==========================
  const funnelStages = useMemo(() => {
    const orderedStages = PIPELINE_STAGES.filter(s => s.id !== 'perdido');
    return orderedStages.map((stage, i) => {
      const count = pipeline.filter(p => p.etapa === stage.id).length;
      const value = pipeline.filter(p => p.etapa === stage.id).reduce((sum, p) => sum + (parseFloat(p.valorEstimado) || 0), 0);
      let percentage = 100;
      if (i > 0) {
        const prevCount = pipeline.filter(p => p.etapa === orderedStages[i - 1].id).length;
        percentage = prevCount > 0 ? ((count / prevCount) * 100).toFixed(1) : 0;
      }
      return {
        name: stage.name,
        count,
        value,
        color: STAGE_COLORS_HEX[stage.id],
        percentage: i === 0 ? undefined : percentage
      };
    });
  }, [pipeline]);

  // ========================== TEAM LEADERBOARD ==========================
  const leaderboard = useMemo(() => {
    if (!usuarios || usuarios.length <= 1) return [];

    return usuarios.map(u => {
      const userDeals = pipeline.filter(p => p.responsableId === u.id && p.etapa === 'cerrado');
      const userValor = userDeals.reduce((sum, p) => sum + (parseFloat(p.valorEstimado) || 0), 0);
      const userActividades = actividades.filter(a => a.responsableId === u.id || a.creadoPor === u.id).length;
      const userEnProgreso = pipeline.filter(p => p.responsableId === u.id && !['cerrado', 'perdido'].includes(p.etapa)).length;

      return {
        id: u.id,
        nombre: u.nombre || u.email || 'Sin nombre',
        avatar: u.avatar || null,
        dealsCerrados: userDeals.length,
        valorGanado: userValor,
        actividades: userActividades,
        dealsEnProgreso: userEnProgreso
      };
    }).sort((a, b) => b.valorGanado - a.valorGanado);
  }, [usuarios, pipeline, actividades]);

  // ========================== RECENT ACTIVITIES ==========================
  const actividadesRecientes = useMemo(() => {
    return [...actividades]
      .sort((a, b) => {
        const dateA = new Date(a.fecha || a.fechaCreacion || 0);
        const dateB = new Date(b.fecha || b.fechaCreacion || 0);
        return dateB - dateA;
      })
      .slice(0, 10);
  }, [actividades]);

  // ========================== PATTERN DETECTION ==========================
  const patrones = useMemo(() => {
    return detectarPatrones(cuentas, leads, pipeline, actividades);
  }, [cuentas, leads, pipeline, actividades]);

  // ========================== CSV EXPORT ==========================
  const exportarCSV = (tipo) => {
    let datos = [];
    let headers = [];
    let filename = '';

    switch (tipo) {
      case 'cuentas':
        headers = ['Empresa', 'Industria', 'Servicio', 'Num. Empleados', 'Fecha Creacion'];
        datos = cuentas.map(c => [
          c.empresa, c.industria, c.servicio, c.numeroEmpleados, c.fechaCreacion
        ]);
        filename = 'cuentas_eongroup.csv';
        break;
      case 'leads':
        headers = ['Empresa', 'Contacto', 'Cargo', 'Email', 'Telefono', 'Industria', 'Fuente', 'Prioridad', 'Fecha Creacion'];
        datos = leads.map(l => [
          l.empresa, l.contacto, l.cargo, l.email, l.telefono, l.industria, l.fuente, l.prioridad, l.fechaCreacion
        ]);
        filename = 'leads_eongroup.csv';
        break;
      case 'pipeline':
        headers = ['Proyecto', 'Empresa', 'Etapa', 'Valor Estimado', 'Fecha Seguimiento', 'Notas', 'Fecha Creacion'];
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

  // ========================== TAB CONFIG ==========================
  const tabs = [
    { id: 'general', label: 'General', icon: BarChart3 },
    { id: 'pipeline', label: 'Pipeline', icon: GitBranch },
    { id: 'actividades', label: 'Actividades', icon: Activity },
    { id: 'equipo', label: 'Equipo', icon: Users },
    { id: 'inteligencia', label: 'Inteligencia', icon: Sparkles }
  ];

  // ========================== HELPER: FORMAT ACTIVITY DATE ==========================
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
  };

  // ========================== HELPER: GET ACTIVITY ICON ==========================
  const getActivityIcon = (tipo) => {
    const found = TIPOS_ACTIVIDAD.find(t => t.id === tipo);
    return found ? found.icon : Activity;
  };

  const getActivityColor = (tipo) => {
    const found = TIPOS_ACTIVIDAD.find(t => t.id === tipo);
    return found ? found.color : 'bg-slate-500';
  };

  const getActivityName = (tipo) => {
    const found = TIPOS_ACTIVIDAD.find(t => t.id === tipo);
    return found ? found.name : tipo;
  };

  // ========================== RANK ICON ==========================
  const getRankIcon = (rank) => {
    if (rank === 0) return <Crown size={20} className="text-yellow-400" />;
    if (rank === 1) return <Medal size={20} className="text-slate-300" />;
    if (rank === 2) return <Trophy size={20} className="text-amber-600" />;
    return <span className="text-sm font-bold text-slate-500 w-5 text-center">{rank + 1}</span>;
  };

  // ========================== DONUT SEGMENTS FOR PIPELINE ==========================
  const pipelineDonutSegments = distribucionEtapas
    .filter(s => s.count > 0)
    .map(s => ({
      label: s.name,
      value: s.count,
      color: STAGE_COLORS_HEX[s.id]
    }));

  // ========================== DONUT SEGMENTS FOR ACTIVITIES ==========================
  const activityDonutSegments = actividadPorTipo
    .filter(t => t.count > 0)
    .map(t => ({
      label: t.name,
      value: t.count,
      color: ACTIVITY_COLORS_HEX[t.id]
    }));

  // ========================== EMPTY STATE CHECK ==========================
  const noData = totalOportunidades === 0 && cuentas.length === 0 && leads.length === 0 && actividades.length === 0;

  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8">
      {/* ==================== HEADER ==================== */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white mb-2">Reportes y Analitica</h1>
          <p className="text-slate-400">Analisis completo de metricas, pipeline, actividades y equipo</p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <span className="flex items-center text-xs text-slate-500 font-medium mr-1">CSV</span>
            <button onClick={() => exportarCSV('cuentas')} className="flex items-center gap-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 px-4 py-2 rounded-xl transition-all text-sm">
              <FileSpreadsheet size={16} /> Cuentas
            </button>
            <button onClick={() => exportarCSV('leads')} className="flex items-center gap-2 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-400 px-4 py-2 rounded-xl transition-all text-sm">
              <FileSpreadsheet size={16} /> Leads
            </button>
            <button onClick={() => exportarCSV('pipeline')} className="flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 px-4 py-2 rounded-xl transition-all text-sm">
              <FileSpreadsheet size={16} /> Pipeline
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="flex items-center text-xs text-slate-500 font-medium mr-1">PDF</span>
            <button onClick={async () => { const a = await exportarPDFCuentas(cuentas, 'Grupo EÖN CRM'); if (a && setArchivos) setArchivos(prev => [...prev, a]); }} className="flex items-center gap-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-300 px-4 py-2 rounded-xl transition-all text-sm">
              <FileDown size={16} /> Cuentas
            </button>
            <button onClick={async () => { const a = await exportarPDFLeads(leads, 'Grupo EÖN CRM'); if (a && setArchivos) setArchivos(prev => [...prev, a]); }} className="flex items-center gap-2 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-violet-300 px-4 py-2 rounded-xl transition-all text-sm">
              <FileDown size={16} /> Leads
            </button>
            <button onClick={async () => { const a = await exportarPDFPipeline(pipeline, 'Grupo EÖN CRM'); if (a && setArchivos) setArchivos(prev => [...prev, a]); }} className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 px-4 py-2 rounded-xl transition-all text-sm">
              <FileDown size={16} /> Pipeline
            </button>
          </div>
        </div>
      </div>

      {/* ==================== EMPTY STATE ==================== */}
      {noData ? (
        <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl border border-white/[0.08]">
          <EmptyState
            icon={BarChart3}
            title="Sin datos para reportes"
            description="Agrega cuentas, leads o prospectos para ver tus metricas"
          />
        </div>
      ) : (
        <>
          {/* ==================== TAB NAVIGATION ==================== */}
          <div className="flex flex-wrap gap-2">
            {tabs.map(tab => {
              // Hide equipo tab if only 1 or fewer users
              if (tab.id === 'equipo' && (!usuarios || usuarios.length <= 1)) return null;
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 sm:px-5 sm:py-2.5 rounded-2xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 font-semibold'
                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <TabIcon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ==================== TAB: GENERAL ==================== */}
          {activeTab === 'general' && (
            <div className="space-y-4 sm:space-y-6 md:space-y-8">
              {/* 6 KPI StatCards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard
                  icon={Percent}
                  title="Tasa de Conversion"
                  value={`${tasaConversion}%`}
                  trend={Number(tasaConversion) > 50 ? 'up' : Number(tasaConversion) > 0 ? 'neutral' : 'down'}
                  color="cyan"
                />
                <StatCard
                  icon={TrendingUp}
                  title="Valor Ganado"
                  value={`$${valorGanado.toLocaleString('es-MX')}`}
                  trend={valorGanado > 0 ? 'up' : 'neutral'}
                  color="emerald"
                />
                <StatCard
                  icon={XCircle}
                  title="Valor Perdido"
                  value={`$${valorPerdido.toLocaleString('es-MX')}`}
                  trend={valorPerdido > 0 ? 'down' : 'neutral'}
                  color="rose"
                />
                <StatCard
                  icon={Clock}
                  title="Valor En Progreso"
                  value={`$${valorEnProgreso.toLocaleString('es-MX')}`}
                  trend={enProgreso.length > 0 ? 'up' : 'neutral'}
                  color="amber"
                />
                <StatCard
                  icon={DollarSign}
                  title="Ticket Promedio"
                  value={`$${ticketPromedio.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`}
                  trend={ticketPromedio > 0 ? 'up' : 'neutral'}
                  color="violet"
                />
                <StatCard
                  icon={Activity}
                  title="Total Actividades"
                  value={actividades.length}
                  trend={actividades.length > 0 ? 'up' : 'neutral'}
                  color="blue"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Resumen General */}
                <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-6 md:p-8 border border-white/[0.08]">
                  <h3 className="text-lg font-bold text-white mb-4">Resumen General</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Building className="w-5 h-5 text-cyan-400" />
                        <span className="text-slate-300">Total Cuentas</span>
                      </div>
                      <span className="text-white font-bold text-xl">{cuentas.length}</span>
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

                {/* Donut: Distribucion del Pipeline */}
                <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-6 md:p-8 border border-white/[0.08]">
                  <h3 className="text-lg font-bold text-white mb-4">Distribucion del Pipeline</h3>
                  {pipelineDonutSegments.length > 0 ? (
                    <DonutChart
                      segments={pipelineDonutSegments}
                      size={200}
                      label="oportunidades"
                      centerValue={String(totalOportunidades)}
                    />
                  ) : (
                    <p className="text-slate-500 text-center py-8">Sin oportunidades en el pipeline</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB: PIPELINE ==================== */}
          {activeTab === 'pipeline' && (
            <div className="space-y-4 sm:space-y-6 md:space-y-8">
              {/* Sales Funnel */}
              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-6 md:p-8 border border-white/[0.08]">
                <h3 className="text-lg font-bold text-white mb-4">Embudo de Ventas</h3>
                {totalOportunidades > 0 ? (
                  <FunnelChart stages={funnelStages} />
                ) : (
                  <p className="text-slate-500 text-center py-8">Sin datos de pipeline</p>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Valor por Mes */}
                <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-6 md:p-8 border border-white/[0.08]">
                  <h3 className="text-lg font-bold text-white mb-4">Valor Ganado por Mes</h3>
                  {valorPorMes.some(m => m.value > 0) ? (
                    <SimpleAreaChart
                      data={valorPorMes}
                      color="emerald"
                      height={220}
                      showDots={true}
                    />
                  ) : (
                    <p className="text-slate-500 text-center py-8">Sin cierres registrados en los ultimos 6 meses</p>
                  )}
                </div>

                {/* Pronostico de Ventas */}
                <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-4 sm:p-6 md:p-8 border-2 border-cyan-500/30" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.7) 0%, rgba(6,182,212,0.05) 100%)' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-xl bg-cyan-500/20">
                      <Zap size={20} className="text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Pronostico de Ventas</h3>
                      <p className="text-xs text-slate-400">Valor ponderado por probabilidad de cierre</p>
                    </div>
                  </div>

                  <div className="mb-6 p-4 bg-slate-800/60 rounded-xl">
                    <p className="text-sm text-slate-400 mb-1">Valor Ponderado Total</p>
                    <p className="text-3xl font-bold text-cyan-400">
                      ${forecast.totalWeighted.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </p>
                  </div>

                  {forecast.stageData.some(s => s.weightedValue > 0) ? (
                    <HorizontalBarChart
                      data={forecast.stageData.map(s => ({
                        label: `${s.name} (${(s.probability * 100).toFixed(0)}%)`,
                        value: Math.round(s.weightedValue),
                        maxValue: Math.max(...forecast.stageData.map(x => x.weightedValue), 1),
                        color: STAGE_COLORS_HEX[s.id],
                        suffix: ''
                      }))}
                    />
                  ) : (
                    <p className="text-slate-500 text-center py-4">Sin oportunidades activas</p>
                  )}
                </div>
              </div>

              {/* Rendimiento */}
              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-6 md:p-8 border border-white/[0.08]">
                <h3 className="text-lg font-bold text-white mb-4">Rendimiento</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-slate-400">Win Rate</span>
                      <span className="text-emerald-400 font-semibold">{tasaConversion}%</span>
                    </div>
                    <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-700" style={{ width: `${tasaConversion}%` }}></div>
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
                      <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${valorGanado + valorPerdido > 0 ? (valorGanado / (valorGanado + valorPerdido)) * 100 : 0}%` }}></div>
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
          )}

          {/* ==================== TAB: ACTIVIDADES ==================== */}
          {activeTab === 'actividades' && (
            <div className="space-y-4 sm:space-y-6 md:space-y-8">
              {/* Activity counts by type */}
              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-6 md:p-8 border border-white/[0.08]">
                <h3 className="text-lg font-bold text-white mb-4">Actividades por Tipo</h3>
                {actividades.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No hay actividades registradas</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    {actividadPorTipo.map(tipo => {
                      const Icon = tipo.icon;
                      return (
                        <div key={tipo.id} className="bg-slate-800/50 rounded-xl p-4 text-center">
                          <div className={`w-12 h-12 rounded-xl ${tipo.color} bg-opacity-20 flex items-center justify-center mx-auto mb-3`}>
                            <Icon size={22} className="text-white" />
                          </div>
                          <p className="text-2xl font-bold text-white">{tipo.count}</p>
                          <p className="text-xs text-slate-400 mt-1">{tipo.name}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Actividades por Mes */}
                <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-6 md:p-8 border border-white/[0.08]">
                  <h3 className="text-lg font-bold text-white mb-4">Actividades por Mes</h3>
                  {actividadesPorMes.some(m => m.value > 0) ? (
                    <SimpleLineChart
                      data={actividadesPorMes}
                      color="violet"
                      height={220}
                    />
                  ) : (
                    <p className="text-slate-500 text-center py-8">Sin actividades en los ultimos 6 meses</p>
                  )}
                </div>

                {/* Donut de Actividades */}
                <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-6 md:p-8 border border-white/[0.08]">
                  <h3 className="text-lg font-bold text-white mb-4">Distribucion de Actividades</h3>
                  {activityDonutSegments.length > 0 ? (
                    <DonutChart
                      segments={activityDonutSegments}
                      size={200}
                      label="actividades"
                      centerValue={String(actividades.length)}
                    />
                  ) : (
                    <p className="text-slate-500 text-center py-8">Sin actividades registradas</p>
                  )}
                </div>
              </div>

              {/* Actividades Recientes */}
              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-6 md:p-8 border border-white/[0.08]">
                <h3 className="text-lg font-bold text-white mb-4">Actividades Recientes</h3>
                {actividadesRecientes.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No hay actividades registradas</p>
                ) : (
                  <div className="space-y-2">
                    {actividadesRecientes.map((act, i) => {
                      const ActIcon = getActivityIcon(act.tipo);
                      const actColor = getActivityColor(act.tipo);
                      return (
                        <div key={act.id || i} className="flex items-center gap-4 p-3 bg-slate-800/40 rounded-xl hover:bg-slate-800/60 transition-colors">
                          <div className={`w-10 h-10 rounded-xl ${actColor} bg-opacity-20 flex items-center justify-center flex-shrink-0`}>
                            <ActIcon size={18} className="text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">
                              {act.descripcion || act.notas || getActivityName(act.tipo)}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-slate-500">{getActivityName(act.tipo)}</span>
                              {act.empresa && (
                                <>
                                  <span className="text-slate-600">|</span>
                                  <span className="text-xs text-slate-400">{act.empresa}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Calendar size={14} className="text-slate-500" />
                            <span className="text-xs text-slate-400">{formatDate(act.fecha || act.fechaCreacion)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== TAB: EQUIPO ==================== */}
          {activeTab === 'equipo' && usuarios && usuarios.length > 1 && (
            <div className="space-y-4 sm:space-y-6 md:space-y-8">
              {/* Leaderboard Table */}
              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-6 md:p-8 border border-white/[0.08]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-xl bg-amber-500/20">
                    <Award size={20} className="text-amber-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Tabla de Posiciones</h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-300/30">
                        <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3 pl-2 w-12">#</th>
                        <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3">Nombre</th>
                        <th className="text-center text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3">Deals Cerrados</th>
                        <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3">Valor Ganado</th>
                        <th className="text-center text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3">Actividades</th>
                        <th className="text-center text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3 pr-2">En Progreso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((user, rank) => (
                        <tr key={user.id} className="border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 pl-2">
                            <div className="flex items-center justify-center w-8 h-8">
                              {getRankIcon(rank)}
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-bold text-white">
                                  {user.nombre.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="text-sm font-medium text-white truncate">{user.nombre}</span>
                            </div>
                          </td>
                          <td className="py-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-semibold">
                              <CheckCircle size={14} />
                              {user.dealsCerrados}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <span className="text-sm font-bold text-white">
                              ${user.valorGanado.toLocaleString('es-MX')}
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-500/10 text-violet-400 text-sm font-semibold">
                              <Activity size={14} />
                              {user.actividades}
                            </span>
                          </td>
                          <td className="py-3 text-center pr-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-sm font-semibold">
                              <Clock size={14} />
                              {user.dealsEnProgreso}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top performers by deal value */}
                <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-6 md:p-8 border border-white/[0.08]">
                  <h3 className="text-lg font-bold text-white mb-4">Valor Ganado por Persona</h3>
                  {leaderboard.some(u => u.valorGanado > 0) ? (
                    <HorizontalBarChart
                      data={leaderboard
                        .filter(u => u.valorGanado > 0)
                        .slice(0, 8)
                        .map((u, i) => ({
                          label: u.nombre,
                          value: u.valorGanado,
                          maxValue: Math.max(...leaderboard.map(x => x.valorGanado), 1),
                          color: ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#f43f5e', '#6366f1'][i % 8]
                        }))}
                    />
                  ) : (
                    <p className="text-slate-500 text-center py-8">Sin valor ganado registrado</p>
                  )}
                </div>

                {/* Activity comparison */}
                <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-6 md:p-8 border border-white/[0.08]">
                  <h3 className="text-lg font-bold text-white mb-4">Actividades por Persona</h3>
                  {leaderboard.some(u => u.actividades > 0) ? (
                    <HorizontalBarChart
                      data={leaderboard
                        .filter(u => u.actividades > 0)
                        .sort((a, b) => b.actividades - a.actividades)
                        .slice(0, 8)
                        .map((u, i) => ({
                          label: u.nombre,
                          value: u.actividades,
                          maxValue: Math.max(...leaderboard.map(x => x.actividades), 1),
                          color: ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#f43f5e', '#6366f1'][i % 8]
                        }))}
                    />
                  ) : (
                    <p className="text-slate-500 text-center py-8">Sin actividades registradas</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB: INTELIGENCIA ==================== */}
          {activeTab === 'inteligencia' && (
            <div className="space-y-4 sm:space-y-6 md:space-y-8">
              {/* ---- Insights Summary Box ---- */}
              {(() => {
                const insights = [];
                const topIndustria = patrones.industriasMasConversion?.[0];
                const topFuente = patrones.fuentesMasEfectivas?.[0];
                const topCuello = patrones.etapasCuelloBotella?.[0];
                const topServicio = patrones.serviciosMasRentables?.[0];

                if (topIndustria && topIndustria.tasa > 0) {
                  insights.push(`Tu industria mas rentable es ${topIndustria.industria} con ${topIndustria.tasa.toFixed(1)}% de conversion`);
                }
                if (topFuente && topFuente.tasaConversion > 0) {
                  const promedioGeneral = patrones.fuentesMasEfectivas.reduce((sum, f) => sum + f.tasaConversion, 0) / patrones.fuentesMasEfectivas.length;
                  const diferencia = promedioGeneral > 0 ? ((topFuente.tasaConversion - promedioGeneral) / promedioGeneral * 100).toFixed(0) : 0;
                  insights.push(`Los leads de ${topFuente.fuente} convierten ${diferencia}% mas que el promedio`);
                }
                if (topCuello && topCuello.promedioDias > 0) {
                  insights.push(`Deals se estancan en ${topCuello.nombre} un promedio de ${topCuello.promedioDias.toFixed(0)} dias`);
                }
                if (topServicio && topServicio.ticketPromedio > 0) {
                  insights.push(`Tu mejor servicio es ${topServicio.servicio} con ticket promedio de $${topServicio.ticketPromedio.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`);
                }

                if (insights.length === 0) return null;

                return (
                  <div className="bg-gradient-to-br from-cyan-500/10 via-violet-500/10 to-cyan-500/5 backdrop-blur-sm rounded-2xl p-4 sm:p-6 md:p-8 border-2 border-cyan-500/30">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-xl bg-cyan-500/20">
                        <Sparkles size={20} className="text-cyan-400" />
                      </div>
                      <h3 className="text-lg font-bold text-white">Insights Automaticos</h3>
                    </div>
                    <div className="space-y-3">
                      {insights.map((insight, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-slate-800/40 rounded-xl">
                          <Lightbulb size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-slate-300">{insight}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* ---- Mejor Mes Highlight Card ---- */}
              {patrones.mejorMes && patrones.mejorMes.valor > 0 && (
                <div className="bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/5 backdrop-blur-sm rounded-2xl p-4 sm:p-6 md:p-8 border-2 border-amber-500/40">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-amber-500/20">
                      <Trophy size={28} className="text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm text-amber-300 font-medium mb-1">Mejor Mes</p>
                      <p className="text-lg text-white font-bold">
                        Tu mejor mes fue <span className="text-amber-400">{patrones.mejorMes.label}</span> con{' '}
                        <span className="text-amber-400">{patrones.mejorMes.deals}</span> deals cerrados por{' '}
                        <span className="text-emerald-400">${patrones.mejorMes.valor.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ---- 4a. Industrias con Mayor Conversion ---- */}
                <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-6 md:p-8 border border-white/[0.08]">
                  <h3 className="text-lg font-bold text-white mb-4">Industrias con Mayor Conversion</h3>
                  {patrones.industriasMasConversion && patrones.industriasMasConversion.length > 0 ? (
                    <>
                      <HorizontalBarChart
                        data={patrones.industriasMasConversion.slice(0, 5).map((ind, i) => ({
                          label: ind.industria,
                          value: parseFloat(ind.tasa.toFixed(1)),
                          maxValue: 100,
                          color: ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#3b82f6'][i % 5],
                          suffix: '%'
                        }))}
                      />
                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-300/30">
                              <th className="text-left text-xs font-semibold text-slate-400 pb-2">Industria</th>
                              <th className="text-center text-xs font-semibold text-slate-400 pb-2">Deals</th>
                              <th className="text-center text-xs font-semibold text-slate-400 pb-2">Ganados</th>
                              <th className="text-center text-xs font-semibold text-slate-400 pb-2">Tasa</th>
                              <th className="text-right text-xs font-semibold text-slate-400 pb-2">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {patrones.industriasMasConversion.slice(0, 5).map((ind, idx) => (
                              <tr key={idx} className="border-b border-slate-800/50">
                                <td className="py-2 text-slate-300">{ind.industria}</td>
                                <td className="py-2 text-center text-white font-bold">{ind.total}</td>
                                <td className="py-2 text-center text-white font-bold">{ind.ganados}</td>
                                <td className="py-2 text-center text-cyan-400 font-bold">{ind.tasa.toFixed(1)}%</td>
                                <td className="py-2 text-right text-white font-bold">${(ind.valor || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <p className="text-slate-500 text-center py-8">Sin datos suficientes</p>
                  )}
                </div>

                {/* ---- 4b. Servicios Mas Rentables ---- */}
                <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-6 md:p-8 border border-white/[0.08]">
                  <h3 className="text-lg font-bold text-white mb-4">Servicios Mas Rentables</h3>
                  {patrones.serviciosMasRentables && patrones.serviciosMasRentables.length > 0 ? (
                    <>
                      <HorizontalBarChart
                        data={patrones.serviciosMasRentables.slice(0, 5).map((srv, i) => ({
                          label: srv.servicio,
                          value: Math.round(srv.valorTotal),
                          maxValue: Math.max(...patrones.serviciosMasRentables.map(s => s.valorTotal), 1),
                          color: ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ec4899'][i % 5]
                        }))}
                      />
                      <div className="mt-4 space-y-2">
                        {patrones.serviciosMasRentables.slice(0, 5).map((srv, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-slate-800/40 rounded-lg">
                            <span className="text-sm text-slate-300">{srv.servicio}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-500">{srv.deals} deals</span>
                              <span className="text-sm font-bold text-white">
                                Ticket: ${srv.ticketPromedio.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-slate-500 text-center py-8">Sin datos suficientes</p>
                  )}
                </div>

                {/* ---- 4c. Fuentes de Leads Mas Efectivas ---- */}
                <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-6 md:p-8 border border-white/[0.08]">
                  <h3 className="text-lg font-bold text-white mb-4">Fuentes de Leads Mas Efectivas</h3>
                  {patrones.fuentesMasEfectivas && patrones.fuentesMasEfectivas.length > 0 ? (
                    <>
                      <DonutChart
                        segments={patrones.fuentesMasEfectivas.map((f, i) => ({
                          label: f.fuente,
                          value: f.totalLeads,
                          color: ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#3b82f6'][i % 6]
                        }))}
                        size={200}
                        label="leads"
                        centerValue={String(patrones.fuentesMasEfectivas.reduce((sum, f) => sum + f.totalLeads, 0))}
                      />
                      <div className="mt-4 space-y-2">
                        {patrones.fuentesMasEfectivas.map((f, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-slate-800/40 rounded-lg">
                            <span className="text-sm text-slate-300">{f.fuente}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-500">{f.convertidos} convertidos</span>
                              <span className={`text-sm font-bold ${f.tasaConversion >= 50 ? 'text-emerald-400' : f.tasaConversion >= 25 ? 'text-cyan-400' : 'text-slate-300'}`}>
                                {f.tasaConversion.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-slate-500 text-center py-8">Sin datos suficientes</p>
                  )}
                </div>

                {/* ---- 4d. Cuellos de Botella ---- */}
                <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-6 md:p-8 border border-white/[0.08]">
                  <div className="flex items-center gap-3 mb-4">
                    <TrendingDown size={20} className="text-rose-400" />
                    <h3 className="text-lg font-bold text-white">Cuellos de Botella</h3>
                  </div>
                  {patrones.etapasCuelloBotella && patrones.etapasCuelloBotella.length > 0 ? (
                    <>
                      <HorizontalBarChart
                        data={patrones.etapasCuelloBotella.map((etapa, i) => ({
                          label: etapa.nombre,
                          value: parseFloat(etapa.promedioDias.toFixed(1)),
                          maxValue: Math.max(...patrones.etapasCuelloBotella.map(e => e.promedioDias), 1),
                          color: etapa.promedioDias > 30 ? '#ef4444' : etapa.promedioDias > 14 ? '#f59e0b' : '#10b981',
                          suffix: ' dias'
                        }))}
                      />
                      <div className="mt-4 space-y-2">
                        {patrones.etapasCuelloBotella.map((etapa, idx) => {
                          const isWarning = etapa.promedioDias > 14 && etapa.promedioDias <= 30;
                          const isDanger = etapa.promedioDias > 30;
                          return (
                            <div key={idx} className={`flex items-center justify-between p-2 rounded-lg ${isDanger ? 'bg-red-500/10 border border-red-500/20' : isWarning ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-slate-800/40'}`}>
                              <span className="text-sm text-slate-300">{etapa.nombre}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-500">{etapa.count} deals</span>
                                <span className={`text-sm font-bold ${isDanger ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'}`}>
                                  {etapa.promedioDias.toFixed(0)} dias
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-slate-500 mt-3">
                        Las etapas en rojo ({'>'}30 dias) y ambar ({'>'}14 dias) necesitan atencion para mejorar la velocidad del pipeline.
                      </p>
                    </>
                  ) : (
                    <p className="text-slate-500 text-center py-8">Sin datos suficientes</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Reportes;
