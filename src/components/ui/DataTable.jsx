import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Inbox, Filter, X, Check } from 'lucide-react';

const DataTable = ({
  columns = [],
  data = [],
  onRowClick,
  selectable = false,
  emptyMessage = 'No hay datos para mostrar',
  bulkActions = [],
}) => {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(10);
  const [filters, setFilters] = useState({}); // { columnKey: Set of selected values }
  const [openFilter, setOpenFilter] = useState(null); // which column filter dropdown is open
  const [filterSearch, setFilterSearch] = useState(''); // search within filter dropdown
  const filterRef = useRef(null);

  // Close filter dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setOpenFilter(null);
        setFilterSearch('');
      }
    };
    if (openFilter) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [openFilter]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Apply filters first, then sort
  const filtered = useMemo(() => {
    const activeFilters = Object.entries(filters).filter(([, vals]) => vals.size > 0);
    if (activeFilters.length === 0) return data;
    return data.filter(row => {
      return activeFilters.every(([key, allowedVals]) => {
        const val = String(row[key] ?? '-');
        return allowedVals.has(val);
      });
    });
  }, [data, filters]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const cmp = String(av).localeCompare(String(bv), 'es', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const paginated = sorted.slice(page * perPage, (page + 1) * perPage);

  // Reset page when data/filters change
  const dataLen = data.length;
  const filterCount = Object.values(filters).reduce((s, v) => s + v.size, 0);
  useMemo(() => setPage(0), [dataLen, perPage, filterCount]);

  const allSelected = paginated.length > 0 && paginated.every(row => selected.has(row.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(paginated.map(r => r.id)));
    }
  };

  const toggleRow = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  // Get unique values for a column (from ALL data, not filtered)
  const getUniqueValues = (key) => {
    const vals = new Set();
    data.forEach(row => vals.add(String(row[key] ?? '-')));
    return [...vals].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  };

  const toggleFilterValue = (colKey, val) => {
    setFilters(prev => {
      const current = new Set(prev[colKey] || []);
      if (current.has(val)) {
        current.delete(val);
      } else {
        current.add(val);
      }
      return { ...prev, [colKey]: current };
    });
  };

  const selectAllFilterValues = (colKey, values) => {
    setFilters(prev => ({ ...prev, [colKey]: new Set(values) }));
  };

  const clearColumnFilter = (colKey) => {
    setFilters(prev => ({ ...prev, [colKey]: new Set() }));
  };

  const activeFilterCount = Object.values(filters).filter(v => v.size > 0).length;

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-white/[0.08] shadow-xl shadow-black/20">
      {/* Active filters bar */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-cyan-900/20 border-b border-cyan-500/30 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
          <span className="text-xs text-cyan-300 font-medium flex-shrink-0">Filtros activos:</span>
          {Object.entries(filters).filter(([, v]) => v.size > 0).map(([key, vals]) => {
            const col = columns.find(c => c.key === key);
            return (
              <span key={key} className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-xs text-cyan-300">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                <span className="font-medium">{col?.label || key}:</span>
                <span className="text-cyan-200">{vals.size === 1 ? [...vals][0] : `${vals.size} valores`}</span>
                <button
                  onClick={() => clearColumnFilter(key)}
                  className="ml-0.5 p-0.5 rounded hover:bg-cyan-500/30 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
          <button
            onClick={() => setFilters({})}
            className="ml-auto text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-2xl hover:bg-slate-700"
          >
            Limpiar todos
          </button>
        </div>
      )}

      {/* Bulk action bar */}
      {selectable && selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-cyan-900/30 border-b border-cyan-500/30">
          <span className="text-sm text-cyan-300 font-medium">{selected.size} seleccionados</span>
          <div className="flex items-center gap-2 ml-auto">
            {bulkActions.map((action, i) => (
              <button
                key={i}
                onClick={() => action.onClick([...selected])}
                className="px-3 py-1.5 text-xs font-medium rounded-2xl bg-slate-700 text-white hover:bg-slate-600 transition-colors"
              >
                {action.label}
              </button>
            ))}
            <button
              onClick={() => setSelected(new Set())}
              className="px-3 py-1.5 text-xs font-medium rounded-2xl text-slate-400 hover:text-white transition-colors"
            >
              Deseleccionar
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900/90 backdrop-blur-sm border-b border-white/[0.06]">
              {selectable && (
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-slate-500 bg-slate-800 text-cyan-500 focus:ring-cyan-500/30 cursor-pointer"
                  />
                </th>
              )}
              {columns.map(col => {
                const isFilterable = col.filterable === true;
                const hasActiveFilter = filters[col.key]?.size > 0;
                const isFilterOpen = openFilter === col.key;

                return (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-left text-sm font-bold text-white relative"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        onClick={() => col.sortable !== false && handleSort(col.key)}
                        className={`flex items-center gap-1 ${
                          col.sortable !== false ? 'cursor-pointer select-none hover:text-cyan-300 transition-colors' : ''
                        }`}
                      >
                        {col.label}
                        {sortKey === col.key && (
                          sortDir === 'asc'
                            ? <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
                            : <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
                        )}
                      </span>
                      {isFilterable && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenFilter(isFilterOpen ? null : col.key);
                            setFilterSearch('');
                          }}
                          className={`p-1 rounded-md transition-all ${
                            hasActiveFilter
                              ? 'bg-cyan-500/30 text-cyan-300 hover:bg-cyan-500/40'
                              : isFilterOpen
                                ? 'bg-slate-600 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-slate-600'
                          }`}
                          title={`Filtrar por ${col.label}`}
                        >
                          <Filter className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Filter dropdown */}
                    {isFilterable && isFilterOpen && (
                      <div
                        ref={filterRef}
                        className="absolute top-full left-0 mt-1 w-56 bg-slate-800 border border-white/[0.08] rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden animate-modal-in"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Search within filter */}
                        <div className="p-2 border-b border-slate-700">
                          <input
                            type="text"
                            value={filterSearch}
                            onChange={(e) => setFilterSearch(e.target.value)}
                            placeholder="Buscar..."
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                            autoFocus
                          />
                        </div>

                        {/* Select all / Clear */}
                        <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700">
                          <button
                            onClick={() => {
                              const allVals = getUniqueValues(col.key);
                              selectAllFilterValues(col.key, allVals);
                            }}
                            className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                          >
                            Todos
                          </button>
                          <button
                            onClick={() => clearColumnFilter(col.key)}
                            className="text-[10px] text-slate-400 hover:text-white font-medium transition-colors"
                          >
                            Ninguno
                          </button>
                        </div>

                        {/* Values list */}
                        <div className="max-h-48 overflow-y-auto py-1">
                          {getUniqueValues(col.key)
                            .filter(v => !filterSearch || v.toLowerCase().includes(filterSearch.toLowerCase()))
                            .map(val => {
                              const isChecked = filters[col.key]?.has(val);
                              const count = data.filter(r => String(r[col.key] ?? '-') === val).length;
                              return (
                                <label
                                  key={val}
                                  onClick={() => toggleFilterValue(col.key, val)}
                                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700/60 cursor-pointer transition-colors group"
                                >
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                                    isChecked
                                      ? 'bg-cyan-500 border-cyan-500'
                                      : 'border-slate-500 group-hover:border-slate-400'
                                  }`}>
                                    {isChecked && <Check className="w-3 h-3 text-white" />}
                                  </div>
                                  <span className="text-xs text-slate-300 truncate flex-1">{val}</span>
                                  <span className="text-[10px] text-slate-500 flex-shrink-0">{count}</span>
                                </label>
                              );
                            })}
                        </div>

                        {/* Apply / close */}
                        <div className="p-2 border-t border-slate-700 flex justify-end">
                          <button
                            onClick={() => { setOpenFilter(null); setFilterSearch(''); }}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
                          >
                            Aplicar
                          </button>
                        </div>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300/20">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Inbox className="w-10 h-10 text-slate-600" />
                    <span className="text-slate-500 text-sm">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map((row, idx) => (
                <tr
                  key={row.id || idx}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`
                    ${onRowClick ? 'cursor-pointer' : ''}
                    ${idx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'}
                    hover:bg-white/[0.08] transition-colors duration-150
                  `}
                >
                  {selectable && (
                    <td className="w-10 px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        className="w-4 h-4 rounded border-slate-500 bg-slate-800 text-cyan-500 focus:ring-cyan-500/30 cursor-pointer"
                      />
                    </td>
                  )}
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-3 text-slate-100">
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '-')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {sorted.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/50 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Mostrar</span>
            <select
              value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value))}
              className="bg-slate-700 border border-white/[0.08] text-white text-xs rounded-2xl px-2 py-1 focus:ring-cyan-500/30 focus:border-cyan-500/50"
            >
              {[10, 25, 50].map(n => (
                <option key={n} value={n}>{n} por pagina</option>
              ))}
            </select>
            <span className="text-xs text-slate-500">
              {sorted.length}{filtered.length !== data.length ? ` de ${data.length}` : ''} registros
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="p-1.5 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i;
              } else if (page < 3) {
                pageNum = i;
              } else if (page > totalPages - 4) {
                pageNum = totalPages - 5 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 text-xs rounded-2xl font-medium transition-colors ${
                    page === pageNum
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {pageNum + 1}
                </button>
              );
            })}

            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
