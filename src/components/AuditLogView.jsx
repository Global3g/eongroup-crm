import React, { useState } from 'react';
import {
  Building, UserPlus, GitBranch, CheckCircle, Bell, History,
  Tag, FolderOpen, Users, FileText, Search, User, Clock
} from 'lucide-react';
import { formatDate } from '../utils/helpers';

function AuditLogView({ auditLog, usuarios }) {
  const [filtroModulo, setFiltroModulo] = useState('');
  const [filtroAccion, setFiltroAccion] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const MODULOS = ['clientes', 'leads', 'pipeline', 'tareas', 'recordatorios', 'actividades', 'industrias', 'archivos', 'equipo'];
  const ACCIONES = ['crear', 'editar', 'eliminar', 'mover', 'completar'];

  const getAccionColor = (accion) => {
    switch (accion) {
      case 'crear': return 'bg-emerald-500/20 text-emerald-400';
      case 'editar': return 'bg-amber-500/20 text-amber-400';
      case 'eliminar': return 'bg-red-500/20 text-red-400';
      case 'mover': return 'bg-blue-500/20 text-blue-400';
      case 'completar': return 'bg-cyan-500/20 text-cyan-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const getModuloIcon = (modulo) => {
    switch (modulo) {
      case 'clientes': return Building;
      case 'leads': return UserPlus;
      case 'pipeline': return GitBranch;
      case 'tareas': return CheckCircle;
      case 'recordatorios': return Bell;
      case 'actividades': return History;
      case 'industrias': return Tag;
      case 'archivos': return FolderOpen;
      case 'equipo': return Users;
      default: return FileText;
    }
  };

  const filteredLog = auditLog.filter(entry => {
    if (filtroModulo && entry.modulo !== filtroModulo) return false;
    if (filtroAccion && entry.accion !== filtroAccion) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        entry.detalles?.toLowerCase().includes(search) ||
        entry.usuarioNombre?.toLowerCase().includes(search) ||
        entry.entidadNombre?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-500/20 to-cyan-500/20 rounded-xl">
              <History size={24} className="text-violet-400" />
            </div>
            Historial de Cambios
          </h1>
          <p className="text-slate-400 mt-1">Registro de todas las acciones realizadas en el sistema</p>
        </div>
        <div className="text-slate-400 text-sm">
          {filteredLog.length} registro{filteredLog.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" size={20} />
          <input
            type="text"
            placeholder="Buscar en el historial..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border-2 border-slate-400 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50"
          />
        </div>
        <select
          value={filtroModulo}
          onChange={(e) => setFiltroModulo(e.target.value)}
          className="px-4 py-3 bg-slate-900/50 border-2 border-slate-400 rounded-xl text-white focus:border-cyan-500/50"
        >
          <option value="">Todos los módulos</option>
          {MODULOS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
        </select>
        <select
          value={filtroAccion}
          onChange={(e) => setFiltroAccion(e.target.value)}
          className="px-4 py-3 bg-slate-900/50 border-2 border-slate-400 rounded-xl text-white focus:border-cyan-500/50"
        >
          <option value="">Todas las acciones</option>
          {ACCIONES.map(a => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
        </select>
      </div>

      {/* Lista de registros */}
      <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border-2 border-slate-400 overflow-hidden">
        {filteredLog.length === 0 ? (
          <div className="p-12 text-center">
            <History size={48} className="mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400">No hay registros en el historial</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filteredLog.map(entry => {
              const ModuloIcon = getModuloIcon(entry.modulo);
              return (
                <div key={entry.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-slate-800 rounded-lg">
                      <ModuloIcon size={20} className="text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getAccionColor(entry.accion)}`}>
                          {entry.accion?.toUpperCase()}
                        </span>
                        <span className="text-slate-500 text-xs px-2 py-0.5 bg-slate-800 rounded">
                          {entry.modulo}
                        </span>
                      </div>
                      <p className="text-white mt-1">{entry.detalles}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <User size={14} />
                          {entry.usuarioNombre || 'Sistema'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {formatDate(entry.fecha)} {new Date(entry.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default AuditLogView;
