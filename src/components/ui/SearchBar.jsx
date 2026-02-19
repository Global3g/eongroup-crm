import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Users, GitBranch, UserPlus, CheckCircle, X } from 'lucide-react';

const SearchBar = ({ clientes = [], leads = [], pipeline = [], tareas = [], onSelect }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const results = useMemo(() => {
    if (query.length < 2) return {};
    const q = query.toLowerCase();

    const filtrar = (arr, campos) =>
      arr.filter(item => campos.some(c => (item[c] || '').toLowerCase().includes(q)));

    const groups = {};
    const cRes = filtrar(clientes, ['nombre', 'empresa', 'email']);
    if (cRes.length) groups.clientes = cRes.slice(0, 5);

    const lRes = filtrar(leads, ['nombre', 'empresa', 'email']);
    if (lRes.length) groups.leads = lRes.slice(0, 5);

    const pRes = filtrar(pipeline, ['nombre', 'empresa', 'cliente']);
    if (pRes.length) groups.pipeline = pRes.slice(0, 5);

    const tRes = filtrar(tareas, ['titulo', 'descripcion', 'asignado']);
    if (tRes.length) groups.tareas = tRes.slice(0, 5);

    return groups;
  }, [query, clientes, leads, pipeline, tareas]);

  const hasResults = Object.keys(results).length > 0;

  const groupConfig = {
    clientes: { label: 'Clientes', icon: Users, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
    leads: { label: 'Leads', icon: UserPlus, color: 'text-violet-400', bg: 'bg-violet-500/20' },
    pipeline: { label: 'Pipeline', icon: GitBranch, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    tareas: { label: 'Tareas', icon: CheckCircle, color: 'text-amber-400', bg: 'bg-amber-500/20' },
  };

  const handleSelect = (tipo, item) => {
    if (onSelect) onSelect(tipo, item);
    setQuery('');
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
    if (e.key === 'Enter' && hasResults) {
      const firstGroup = Object.keys(results)[0];
      if (firstGroup && results[firstGroup].length > 0) {
        handleSelect(firstGroup, results[firstGroup][0]);
      }
    }
  };

  const getSubtitle = (tipo, item) => {
    switch (tipo) {
      case 'clientes': return item.empresa || item.email || '';
      case 'leads': return item.empresa || item.origen || '';
      case 'pipeline': return item.empresa || item.etapa || '';
      case 'tareas': return item.asignado || item.estado || '';
      default: return '';
    }
  };

  const getName = (tipo, item) => {
    if (tipo === 'tareas') return item.titulo || 'Sin titulo';
    return item.nombre || item.empresa || 'Sin nombre';
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar en el CRM..."
          className="w-full pl-10 pr-8 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 max-h-96 overflow-y-auto">
          {!hasResults ? (
            <div className="px-4 py-6 text-center text-slate-500 text-sm">
              No se encontraron resultados para "{query}"
            </div>
          ) : (
            Object.entries(results).map(([tipo, items]) => {
              const config = groupConfig[tipo];
              const Icon = config.icon;
              return (
                <div key={tipo}>
                  <div className="px-3 py-2 flex items-center gap-2 border-b border-slate-800">
                    <div className={`p-1 rounded ${config.bg}`}>
                      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                    </div>
                    <span className={`text-xs font-semibold uppercase tracking-wider ${config.color}`}>
                      {config.label}
                    </span>
                    <span className="text-xs text-slate-600">({items.length})</span>
                  </div>
                  {items.map((item, idx) => (
                    <button
                      key={item.id || idx}
                      onClick={() => handleSelect(tipo, item)}
                      className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-800 transition-colors text-left"
                    >
                      <div>
                        <div className="text-sm text-white">{getName(tipo, item)}</div>
                        <div className="text-xs text-slate-500">{getSubtitle(tipo, item)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
