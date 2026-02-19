import React, { useState, useEffect, useMemo } from 'react';
import {
  X, ChevronRight, Bell, BellRing, CheckCircle, Loader, LogOut,
  Target, UserPlus, GitBranch, AlertCircle, MessageSquare, HelpCircle, Menu
} from 'lucide-react';
import { CRMProvider, useCRM } from './context/CRMContext';
import { generateId, getFechaLocal, tiempoRelativo } from './utils/helpers';
import { ROLES, MODULES, TIPOS_NOTIFICACION } from './utils/constants';

// Componentes de módulo
import LoginScreen from './components/LoginScreen';
import AuditLogView from './components/AuditLogView';
import Equipo from './components/Equipo';
import Dashboard from './components/Dashboard';
import Cuentas from './components/Cuentas';
import Pipeline from './components/Pipeline';
import Leads from './components/Leads';
import Calendario from './components/Calendario';
import Tareas from './components/Tareas';
import Reportes from './components/Reportes';
import Archivos from './components/Archivos';
import EmailComposer from './components/EmailComposer';
import GeminiChatbot from './components/GeminiChatbot';

// Componentes UI
import SearchBar from './components/ui/SearchBar';
import QuickActions from './components/ui/QuickActions';
import OnboardingTour from './components/ui/OnboardingTour';

import './App.css';

// ============== APP WRAPPER ==============
export default function App() {
  return (
    <CRMProvider>
      <AppContent />
    </CRMProvider>
  );
}

// ============== APP CONTENT ==============
function AppContent() {
  const {
    // UI state
    currentModule, setCurrentModule,
    sidebarOpen, setSidebarOpen,
    loading, saving,
    showNotifications, setShowNotifications,
    // Auth
    authUser, authLoading, currentUser,
    // Data
    cuentas, setCuentas,
    contactos, setContactos,
    leads, setLeads,
    pipeline, setPipeline,
    archivos, setArchivos,
    actividades, setActividades,
    recordatorios, setRecordatorios,
    tareas, setTareas,
    usuarios, setUsuarios,
    notificaciones,
    auditLog,
    // Email modal
    emailModalOpen, setEmailModalOpen,
    emailDestinatario, setEmailDestinatario,
    // Toast
    toastNotificacion, setToastNotificacion,
    // Functions
    handleLogout,
    addNotificacion,
    marcarLeida,
    marcarTodasLeidas,
    addAuditLog,
    addIndustria, editIndustria, deleteIndustria,
    addServicio,
    // Computed
    misNotificaciones,
    todasMisNotificaciones,
    todasLasIndustrias,
    todosLosServicios,
    modulosVisibles
  } = useCRM();

  // State for chatbot external trigger
  const [chatOpen, setChatOpen] = useState(false);

  // Onboarding tour state
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (authUser && !loading) {
      const tourDone = localStorage.getItem('eoncrm-tour-done');
      if (!tourDone) {
        setShowTour(true);
      }
    }
  }, [authUser, loading]);

  const handleTourClose = () => {
    setShowTour(false);
    localStorage.setItem('eoncrm-tour-done', 'true');
  };

  // Badge counters for sidebar
  const badgeCounts = useMemo(() => {
    const hoy = new Date().toISOString().split('T')[0];

    // Leads created in the last 7 days
    const hace7dias = new Date();
    hace7dias.setDate(hace7dias.getDate() - 7);
    const hace7diasStr = hace7dias.toISOString().split('T')[0];
    const leadsRecientes = (leads || []).filter(l => l.fechaCreacion && l.fechaCreacion >= hace7diasStr).length;

    // Overdue tasks (fechaCompromiso < today and not completed)
    const tareasVencidas = (tareas || []).filter(t => !t.completada && t.fechaCompromiso && t.fechaCompromiso < hoy).length;

    // Recordatorios for today (fecha === today and not completed)
    const recordatoriosHoy = (recordatorios || []).filter(r => !r.completado && r.fecha === hoy).length;

    return { leads: leadsRecientes, tareas: tareasVencidas, calendario: recordatoriosHoy };
  }, [leads, tareas, recordatorios]);

  // Badge config per module
  const badgeConfig = {
    leads: { count: badgeCounts.leads, color: 'bg-violet-500 text-white' },
    tareas: { count: badgeCounts.tareas, color: 'bg-red-500 text-white' },
    calendario: { count: badgeCounts.calendario, color: 'bg-amber-500 text-white' },
  };

  // Render del módulo actual
  const renderModule = () => {
    switch (currentModule) {
      case 'dashboard':
        return <Dashboard cuentas={cuentas} contactos={contactos} leads={leads} pipeline={pipeline} recordatorios={recordatorios} setRecordatorios={setRecordatorios} tareas={tareas} setTareas={setTareas} setCurrentModule={setCurrentModule} currentUser={currentUser} usuarios={usuarios} actividades={actividades} addNotificacion={addNotificacion} />;
      case 'cuentas':
        return <Cuentas cuentas={cuentas} setCuentas={setCuentas} contactos={contactos} setContactos={setContactos} pipeline={pipeline} actividades={actividades} setActividades={setActividades} recordatorios={recordatorios} setRecordatorios={setRecordatorios} tareas={tareas} setTareas={setTareas} usuarios={usuarios} currentUser={currentUser} addNotificacion={addNotificacion} setEmailDestinatario={setEmailDestinatario} setEmailModalOpen={setEmailModalOpen} todasLasIndustrias={todasLasIndustrias} addIndustria={addIndustria} editIndustria={editIndustria} deleteIndustria={deleteIndustria} todosLosServicios={todosLosServicios} addServicio={addServicio} addAuditLog={addAuditLog} />;
      case 'pipeline':
        return <Pipeline pipeline={pipeline} setPipeline={setPipeline} cuentas={cuentas} setCuentas={setCuentas} contactos={contactos} setContactos={setContactos} actividades={actividades} setActividades={setActividades} recordatorios={recordatorios} setRecordatorios={setRecordatorios} tareas={tareas} setTareas={setTareas} usuarios={usuarios} currentUser={currentUser} addNotificacion={addNotificacion} setEmailDestinatario={setEmailDestinatario} setEmailModalOpen={setEmailModalOpen} todosLosServicios={todosLosServicios} addServicio={addServicio} addAuditLog={addAuditLog} />;
      case 'leads':
        return <Leads leads={leads} setLeads={setLeads} pipeline={pipeline} setPipeline={setPipeline} todasLasIndustrias={todasLasIndustrias} addIndustria={addIndustria} editIndustria={editIndustria} deleteIndustria={deleteIndustria} todosLosServicios={todosLosServicios} addServicio={addServicio} addAuditLog={addAuditLog} recordatorios={recordatorios} setRecordatorios={setRecordatorios} tareas={tareas} setTareas={setTareas} actividades={actividades} setActividades={setActividades} usuarios={usuarios} currentUser={currentUser} addNotificacion={addNotificacion} setEmailDestinatario={setEmailDestinatario} setEmailModalOpen={setEmailModalOpen} />;
      case 'calendario':
        return <Calendario actividades={actividades} recordatorios={recordatorios} setRecordatorios={setRecordatorios} tareas={tareas} setTareas={setTareas} cuentas={cuentas} pipeline={pipeline} leads={leads} setCurrentModule={setCurrentModule} currentUser={currentUser} usuarios={usuarios} />;
      case 'tareas':
        return <Tareas tareas={tareas} setTareas={setTareas} cuentas={cuentas} pipeline={pipeline} leads={leads} actividades={actividades} usuarios={usuarios} currentUser={currentUser} addNotificacion={addNotificacion} />;
      case 'reportes':
        return <Reportes cuentas={cuentas} leads={leads} pipeline={pipeline} actividades={actividades} usuarios={usuarios} archivos={archivos} setArchivos={setArchivos} />;
      case 'archivos':
        return <Archivos archivos={archivos} setArchivos={setArchivos} cuentas={cuentas} />;
      case 'auditlog':
        return <AuditLogView auditLog={auditLog} usuarios={usuarios} />;
      case 'equipo':
        return <Equipo usuarios={usuarios} setUsuarios={setUsuarios} currentUser={currentUser} />;
      default:
        return <Dashboard cuentas={cuentas} contactos={contactos} leads={leads} pipeline={pipeline} recordatorios={recordatorios} setRecordatorios={setRecordatorios} tareas={tareas} setTareas={setTareas} setCurrentModule={setCurrentModule} currentUser={currentUser} usuarios={usuarios} actividades={actividades} addNotificacion={addNotificacion} />;
    }
  };

  // Pantalla de carga
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

  // Login
  if (!authUser) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-800 flex">
      {/* Fondo animado */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl animate-aurora"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/15 rounded-full blur-3xl animate-aurora" style={{ animationDelay: '-30s' }}></div>
      </div>

      {/* Notifications Dropdown */}
      {showNotifications && (
        <div className="fixed top-16 right-2 sm:right-4 z-50 w-[calc(100vw-16px)] sm:w-96 bg-slate-900 border-2 border-slate-400 rounded-2xl shadow-2xl overflow-hidden">
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
                <button onClick={marcarTodasLeidas} className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
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
        <div className="fixed bottom-6 right-3 sm:right-6 z-50 animate-slide-up">
          <div className="bg-slate-900 border-2 border-cyan-500/50 rounded-2xl shadow-2xl p-4 max-w-sm">
            <div className="flex gap-3 items-start">
              <div className={`w-10 h-10 rounded-xl ${TIPOS_NOTIFICACION[toastNotificacion.tipo]?.color || 'bg-blue-500'} flex items-center justify-center flex-shrink-0`}>
                <BellRing size={18} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-cyan-400 font-medium mb-1">Nueva notificación</p>
                <p className="text-sm text-white">{toastNotificacion.mensaje}</p>
              </div>
              <button onClick={() => setToastNotificacion(null)} className="text-slate-400 hover:text-white p-1">
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile backdrop overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:relative z-50 lg:z-40 h-screen transition-all duration-300
        ${sidebarOpen
          ? 'translate-x-0 w-64'
          : '-translate-x-full lg:translate-x-0 lg:w-20'
        } bg-slate-900/80 backdrop-blur-xl border-r border-white/5`}
      >
        <div className="p-4 h-full flex flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-6">
            <img src="/logo-eon.png" alt="Grupo EÖN" className="w-[70px] h-[70px] rounded-xl object-cover" />
            {sidebarOpen && (
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Grupo EÖN</h1>
                <p className="text-sm text-slate-500">CRM Platform</p>
              </div>
            )}
          </div>

          {/* Toggle - hidden on mobile */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="absolute -right-3 top-20 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full hidden lg:flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
          >
            <ChevronRight size={14} className={`transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* User Info */}
          {currentUser && (
            <div className={`mb-6 p-3 bg-slate-800/50 rounded-xl ${sidebarOpen ? '' : 'text-center'}`}>
              <div className="flex items-center gap-3">
                {currentUser.fotoUrl ? (
                  <img src={currentUser.fotoUrl} alt={currentUser.nombre} className="w-9 h-9 rounded-full object-cover border-2 border-cyan-500/30" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm">
                    {currentUser.nombre?.charAt(0).toUpperCase()}
                  </div>
                )}
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
              const badge = badgeConfig[module.id];
              return (
                <button
                  key={module.id}
                  onClick={() => {
                    setCurrentModule(module.id);
                    // Close sidebar on mobile after selecting a module
                    if (window.innerWidth < 1024) setSidebarOpen(false);
                  }}
                  className={`relative w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/30 to-violet-500/30 text-white border border-cyan-500/50 shadow-lg shadow-cyan-500/10 shadow-[inset_0_0_20px_rgba(6,182,212,0.05)]'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <div className="relative">
                    <Icon size={22} className={isActive ? 'text-cyan-400' : ''} />
                    {badge && badge.count > 0 && !sidebarOpen && (
                      <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold ${badge.color}`}>
                        {badge.count > 99 ? '99+' : badge.count}
                      </span>
                    )}
                  </div>
                  {sidebarOpen && (
                    <>
                      <span className="text-[1.05rem] font-semibold text-white">{module.name}</span>
                      {badge && badge.count > 0 && (
                        <span className={`ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold ${badge.color}`}>
                          {badge.count > 99 ? '99+' : badge.count}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Status & Help */}
          <div className={`mt-auto pt-4 border-t border-slate-800 ${sidebarOpen ? '' : 'text-center'}`}>
            <div className="flex items-center justify-between">
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
              <button
                onClick={() => setShowTour(true)}
                className="p-2 text-slate-500 hover:text-cyan-400 hover:bg-slate-800 rounded-xl transition-all"
                title="Tour de la app"
              >
                <HelpCircle size={18} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative z-10 overflow-auto">
        {/* Search Bar */}
        <div className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50 px-3 sm:px-4 md:px-6 py-3">
          <div className="flex items-center gap-3">
            {/* Hamburger menu - mobile only */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all flex-shrink-0"
              aria-label="Abrir menú"
            >
              <Menu size={22} />
            </button>
            <div className="flex-1 min-w-0">
              <SearchBar
                cuentas={cuentas}
                leads={leads}
                pipeline={pipeline}
                tareas={tareas}
                onSelect={(tipo, item) => {
                  const moduleMap = { cuenta: 'cuentas', lead: 'leads', pipeline: 'pipeline', tarea: 'tareas' };
                  setCurrentModule(moduleMap[tipo] || 'dashboard');
                }}
              />
            </div>
          </div>
        </div>
        <div key={currentModule} className="p-3 sm:p-4 md:p-6 lg:p-8 animate-page-in">
          {renderModule()}
        </div>
      </main>

      {/* Quick Actions FAB */}
      <QuickActions
        onNewTarea={() => setCurrentModule('tareas')}
        onNewLlamada={() => setCurrentModule('calendario')}
        onNewNota={() => setCurrentModule('cuentas')}
        onOpenChat={() => setChatOpen(true)}
      />

      {/* Chatbot Gemini AI */}
      <GeminiChatbot
        clientes={cuentas}
        leads={leads}
        pipeline={pipeline}
        actividades={actividades}
        tareas={tareas}
        recordatorios={recordatorios}
        currentUser={currentUser}
        externalOpen={chatOpen}
        onExternalOpenHandled={() => setChatOpen(false)}
      />

      {/* Onboarding Tour */}
      <OnboardingTour isOpen={showTour} onClose={handleTourClose} currentModule={currentModule} />

      {/* Modal de Email Composer */}
      <EmailComposer
        isOpen={emailModalOpen}
        onClose={() => { setEmailModalOpen(false); setEmailDestinatario(null); }}
        destinatario={emailDestinatario}
        currentUser={currentUser}
        onEmailSent={(emailData) => {
          const nuevaActividad = {
            id: generateId(),
            tipo: 'email',
            titulo: `Email: ${emailData.subject}`,
            descripcion: emailData.body,
            fecha: getFechaLocal(),
            fechaCreacion: new Date().toISOString(),
            cuentaId: emailDestinatario?.cuentaId || '',
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
