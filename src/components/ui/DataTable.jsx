import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Inbox } from 'lucide-react';

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

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const cmp = String(av).localeCompare(String(bv), 'es', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const paginated = sorted.slice(page * perPage, (page + 1) * perPage);

  // Reset page when data changes
  const dataLen = data.length;
  useMemo(() => setPage(0), [dataLen, perPage]);

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

  return (
    <div className="w-full rounded-xl overflow-hidden border-2 border-slate-400">
      {/* Bulk action bar */}
      {selectable && selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-cyan-900/30 border-b border-slate-700/50">
          <span className="text-sm text-cyan-300 font-medium">{selected.size} seleccionados</span>
          <div className="flex items-center gap-2 ml-auto">
            {bulkActions.map((action, i) => (
              <button
                key={i}
                onClick={() => action.onClick([...selected])}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors"
              >
                {action.label}
              </button>
            ))}
            <button
              onClick={() => setSelected(new Set())}
              className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-400 hover:text-white transition-colors"
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
            <tr className="bg-slate-700">
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
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white ${
                    col.sortable !== false ? 'cursor-pointer select-none hover:text-cyan-300 transition-colors' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {col.label}
                    {sortKey === col.key && (
                      sortDir === 'asc'
                        ? <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
                        : <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
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
                    ${idx % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-800/60'}
                    hover:bg-slate-700/50 transition-colors
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
                    <td key={col.key} className="px-4 py-3 text-slate-300">
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
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-t border-slate-700/50">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Mostrar</span>
            <select
              value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value))}
              className="bg-slate-700 border border-slate-600 text-white text-xs rounded-lg px-2 py-1 focus:ring-cyan-500/30 focus:border-cyan-500/50"
            >
              {[10, 25, 50].map(n => (
                <option key={n} value={n}>{n} por pagina</option>
              ))}
            </select>
            <span className="text-xs text-slate-500">
              {sorted.length} registros
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
                  className={`w-8 h-8 text-xs rounded-lg font-medium transition-colors ${
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
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
