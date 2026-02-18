import React, { useState } from 'react';
import { Plus, X, Filter, Save, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

const OPERATORS = {
  text: [
    { value: 'es', label: 'es' },
    { value: 'contiene', label: 'contiene' },
    { value: 'no_contiene', label: 'no contiene' },
    { value: 'empieza', label: 'empieza con' },
  ],
  select: [
    { value: 'es', label: 'es' },
    { value: 'no_es', label: 'no es' },
  ],
  date: [
    { value: 'es', label: 'es' },
    { value: 'mayor_que', label: 'despues de' },
    { value: 'menor_que', label: 'antes de' },
  ],
  number: [
    { value: 'es', label: 'es' },
    { value: 'mayor_que', label: 'mayor que' },
    { value: 'menor_que', label: 'menor que' },
  ],
};

const FilterPanel = ({ fields = [], onFilter, savedViews = [], onSaveView }) => {
  const [conditions, setConditions] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const [viewName, setViewName] = useState('');
  const [showSave, setShowSave] = useState(false);

  const addCondition = () => {
    if (fields.length === 0) return;
    setConditions(prev => [
      ...prev,
      { id: Date.now(), field: fields[0].key, operator: 'contiene', value: '' }
    ]);
    setCollapsed(false);
  };

  const updateCondition = (id, key, val) => {
    setConditions(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, [key]: val };
      // Reset operator when field type changes
      if (key === 'field') {
        const fieldDef = fields.find(f => f.key === val);
        const type = fieldDef?.type || 'text';
        updated.operator = OPERATORS[type]?.[0]?.value || 'es';
        updated.value = '';
      }
      return updated;
    }));
  };

  const removeCondition = (id) => {
    setConditions(prev => prev.filter(c => c.id !== id));
  };

  const clearAll = () => {
    setConditions([]);
    if (onFilter) onFilter([]);
  };

  const applyFilters = () => {
    if (onFilter) onFilter(conditions.filter(c => c.value !== ''));
  };

  const handleSaveView = () => {
    if (viewName.trim() && onSaveView) {
      onSaveView({ name: viewName.trim(), conditions: [...conditions] });
      setViewName('');
      setShowSave(false);
    }
  };

  const loadView = (view) => {
    setConditions(view.conditions.map((c, i) => ({ ...c, id: Date.now() + i })));
    setCollapsed(false);
  };

  const getFieldType = (fieldKey) => {
    const f = fields.find(f => f.key === fieldKey);
    return f?.type || 'text';
  };

  const getFieldOptions = (fieldKey) => {
    const f = fields.find(f => f.key === fieldKey);
    return f?.options || [];
  };

  const activeCount = conditions.filter(c => c.value !== '').length;

  return (
    <div className="rounded-xl border-2 border-slate-400 bg-slate-800/50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(prev => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-white">Filtros avanzados</span>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-cyan-500/20 text-cyan-400 rounded-full">
              {activeCount}
            </span>
          )}
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3">
          {/* Active filter pills */}
          {activeCount > 0 && (
            <div className="flex flex-wrap gap-2">
              {conditions.filter(c => c.value !== '').map(c => {
                const fieldDef = fields.find(f => f.key === c.field);
                return (
                  <span key={c.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-slate-700 text-slate-300 rounded-full">
                    <span className="text-cyan-400 font-medium">{fieldDef?.label || c.field}</span>
                    <span className="text-slate-500">{c.operator}</span>
                    <span className="text-white">{c.value}</span>
                    <button onClick={() => removeCondition(c.id)} className="ml-0.5 text-slate-500 hover:text-red-400 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Saved views */}
          {savedViews.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {savedViews.map((v, i) => (
                <button
                  key={i}
                  onClick={() => loadView(v)}
                  className="px-3 py-1 text-xs bg-violet-500/20 text-violet-400 rounded-full hover:bg-violet-500/30 transition-colors"
                >
                  {v.name}
                </button>
              ))}
            </div>
          )}

          {/* Conditions */}
          <div className="space-y-2">
            {conditions.map(cond => {
              const type = getFieldType(cond.field);
              const operators = OPERATORS[type] || OPERATORS.text;
              return (
                <div key={cond.id} className="flex items-center gap-2 flex-wrap">
                  {/* Field selector */}
                  <select
                    value={cond.field}
                    onChange={(e) => updateCondition(cond.id, 'field', e.target.value)}
                    className="bg-slate-700 border border-slate-600 text-white text-xs rounded-lg px-2.5 py-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 min-w-[120px]"
                  >
                    {fields.map(f => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>

                  {/* Operator selector */}
                  <select
                    value={cond.operator}
                    onChange={(e) => updateCondition(cond.id, 'operator', e.target.value)}
                    className="bg-slate-700 border border-slate-600 text-white text-xs rounded-lg px-2.5 py-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 min-w-[110px]"
                  >
                    {operators.map(op => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>

                  {/* Value input */}
                  {type === 'select' ? (
                    <select
                      value={cond.value}
                      onChange={(e) => updateCondition(cond.id, 'value', e.target.value)}
                      className="bg-slate-700 border border-slate-600 text-white text-xs rounded-lg px-2.5 py-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 flex-1 min-w-[140px]"
                    >
                      <option value="">Seleccionar...</option>
                      {getFieldOptions(cond.field).map(opt => (
                        <option key={opt.value || opt} value={opt.value || opt}>{opt.label || opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={type === 'date' ? 'date' : type === 'number' ? 'number' : 'text'}
                      value={cond.value}
                      onChange={(e) => updateCondition(cond.id, 'value', e.target.value)}
                      placeholder="Valor..."
                      className="bg-slate-700 border border-slate-600 text-white text-xs rounded-lg px-2.5 py-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 flex-1 min-w-[140px] placeholder-slate-500"
                    />
                  )}

                  <button
                    onClick={() => removeCondition(cond.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={addCondition}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar condicion
            </button>

            {conditions.length > 0 && (
              <>
                <button
                  onClick={applyFilters}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-cyan-500 to-violet-500 rounded-lg hover:opacity-90 transition-opacity"
                >
                  Aplicar filtros
                </button>
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Limpiar todo
                </button>
              </>
            )}

            {conditions.length > 0 && onSaveView && (
              showSave ? (
                <div className="flex items-center gap-1 ml-auto">
                  <input
                    type="text"
                    value={viewName}
                    onChange={(e) => setViewName(e.target.value)}
                    placeholder="Nombre de la vista..."
                    className="bg-slate-700 border border-slate-600 text-white text-xs rounded-lg px-2.5 py-1.5 focus:ring-cyan-500/30 focus:border-cyan-500/50 placeholder-slate-500 w-40"
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveView()}
                  />
                  <button onClick={handleSaveView} className="px-2 py-1.5 text-xs text-emerald-400 hover:text-emerald-300">
                    <Save className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setShowSave(false)} className="px-1 py-1.5 text-xs text-slate-500 hover:text-slate-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSave(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 ml-auto transition-colors"
                >
                  <Save className="w-3 h-3" />
                  Guardar vista
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterPanel;
