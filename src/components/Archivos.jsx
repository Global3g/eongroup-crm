import React, { useState } from 'react';
import {
  FolderOpen, Upload, Download, Edit, Save, Search,
  Trash2, FileText, Building, Image, Loader, X, LayoutGrid, List
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { formatDate, generateId, getFechaLocal } from '../utils/helpers';
import EmptyState from './ui/EmptyState';
import DataTable from './ui/DataTable';

// ============== ARCHIVOS ==============
const CATEGORIAS_ARCHIVOS = [
  { id: 'propuestas', name: 'Propuestas', color: 'bg-cyan-500' },
  { id: 'diagnosticos', name: 'Diagnósticos', color: 'bg-violet-500' },
  { id: 'contratos', name: 'Contratos', color: 'bg-emerald-500' },
  { id: 'presentaciones', name: 'Presentaciones', color: 'bg-amber-500' },
  { id: 'otros', name: 'Otros', color: 'bg-slate-500' }
];

function Archivos({ archivos, setArchivos, cuentas }) {
  const [showForm, setShowForm] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [editingArchivo, setEditingArchivo] = useState(null);
  const [viewingArchivo, setViewingArchivo] = useState(null);
  const [vistaTabla, setVistaTabla] = useState(false);
  const [form, setForm] = useState({
    nombre: '', categoria: 'propuestas', cuentaId: '', descripcion: '', archivo: null
  });

  const resetForm = () => {
    setForm({ nombre: '', categoria: 'propuestas', cuentaId: '', descripcion: '', archivo: null });
    setShowForm(false);
    setEditingArchivo(null);
  };

  const handleEdit = (archivo) => {
    setForm({
      nombre: archivo.nombre,
      categoria: archivo.categoria,
      cuentaId: archivo.cuentaId || archivo.clienteId || '',
      descripcion: archivo.descripcion || '',
      archivo: null
    });
    setEditingArchivo(archivo);
    setShowForm(true);
  };

  const handleUpdate = (e) => {
    e.preventDefault();
    if (!editingArchivo) return;

    const cuenta = cuentas.find(c => c.id === form.cuentaId);
    setArchivos(archivos.map(a => a.id === editingArchivo.id ? {
      ...a,
      nombre: form.nombre,
      categoria: form.categoria,
      cuentaId: form.cuentaId,
      cuentaNombre: cuenta?.empresa || '',
      descripcion: form.descripcion
    } : a));
    resetForm();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm({ ...form, archivo: file, nombre: form.nombre || file.name.split('.')[0] });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.archivo) {
      alert('Selecciona un archivo');
      return;
    }

    setSubiendo(true);
    try {
      const timestamp = Date.now();
      const fileName = `archivos/${form.categoria}/${timestamp}_${form.archivo.name}`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, form.archivo);
      const url = await getDownloadURL(storageRef);

      const cuenta = cuentas.find(c => c.id === form.cuentaId);
      const nuevoArchivo = {
        id: generateId(),
        nombre: form.nombre,
        categoria: form.categoria,
        cuentaId: form.cuentaId,
        cuentaNombre: cuenta?.empresa || '',
        descripcion: form.descripcion,
        nombreArchivo: form.archivo.name,
        tipo: form.archivo.type,
        tamano: form.archivo.size,
        url,
        fecha: getFechaLocal()
      };

      setArchivos([...archivos, nuevoArchivo]);
      resetForm();
    } catch (error) {
      console.error('Error subiendo archivo:', error);
      alert('Error al subir el archivo');
    }
    setSubiendo(false);
  };

  const handleDelete = (id) => {
    if (window.confirm('¿Eliminar este archivo?')) {
      setArchivos(archivos.filter(a => a.id !== id));
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const archivosFiltrados = archivos.filter(a => {
    const matchCategoria = filtroCategoria === 'todos' || a.categoria === filtroCategoria;
    const matchBusqueda = !busqueda ||
      a.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (a.cuentaNombre || a.clienteNombre)?.toLowerCase().includes(busqueda.toLowerCase());
    return matchCategoria && matchBusqueda;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Archivos</h1>
          <p className="text-slate-400">{archivos.length} documentos</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white px-5 py-3 rounded-xl hover:opacity-90 transition-all font-medium"
        >
          <Upload size={20} /> Subir Archivo
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" size={20} />
          <input
            type="text"
            placeholder="Buscar archivos..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border-2 border-slate-400 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50 transition-all"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFiltroCategoria('todos')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filtroCategoria === 'todos' ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            Todos
          </button>
          {CATEGORIAS_ARCHIVOS.map(cat => (
            <button
              key={cat.id}
              onClick={() => setFiltroCategoria(cat.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filtroCategoria === cat.id ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 border-slate-400">
          <h2 className="text-xl font-bold text-white mb-6">{editingArchivo ? 'Editar Archivo' : 'Subir Archivo'}</h2>
          <form onSubmit={editingArchivo ? handleUpdate : handleSubmit} className="space-y-4">
            {!editingArchivo && (
              <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-cyan-500/50 transition-all">
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload size={40} className="mx-auto text-slate-500 mb-4" />
                  <p className="text-white mb-2">{form.archivo ? form.archivo.name : 'Clic para seleccionar archivo'}</p>
                  <p className="text-slate-500 text-sm">PDF, Word, Excel, Imágenes</p>
                </label>
              </div>
            )}
            {editingArchivo && (
              <div className="bg-slate-800/50 rounded-xl p-4 flex items-center gap-3">
                <FileText size={24} className="text-cyan-400" />
                <div>
                  <p className="text-white font-medium">{editingArchivo.nombreArchivo}</p>
                  <p className="text-slate-500 text-sm">{formatFileSize(editingArchivo.tamano)}</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" placeholder="Nombre del archivo" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" required />
              <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-cyan-500/50">
                {CATEGORIAS_ARCHIVOS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={form.cuentaId} onChange={(e) => setForm({ ...form, cuentaId: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-cyan-500/50">
                <option value="">Asociar a cuenta (opcional)</option>
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.empresa}</option>)}
              </select>
              <input type="text" placeholder="Descripción" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-cyan-500/50" />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={subiendo}
                className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white px-5 py-3 rounded-xl hover:opacity-90 transition-all font-medium disabled:opacity-50"
              >
                {subiendo ? <Loader size={20} className="animate-spin" /> : <Save size={20} />}
                {subiendo ? 'Subiendo...' : editingArchivo ? 'Guardar' : 'Subir'}
              </button>
              <button type="button" onClick={resetForm} className="flex items-center gap-2 bg-slate-800 text-slate-300 px-5 py-3 rounded-xl hover:bg-slate-700 transition-all font-medium">
                <X size={20} /> Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Vista toggle */}
      <div className="flex justify-end">
        <div className="flex bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setVistaTabla(false)}
            className={`p-2 rounded-lg transition-all ${!vistaTabla ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            title="Vista de tarjetas"
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => setVistaTabla(true)}
            className={`p-2 rounded-lg transition-all ${vistaTabla ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            title="Vista de tabla"
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {archivosFiltrados.length === 0 ? (
        <div className="bg-slate-900/50 rounded-2xl border-2 border-slate-400">
          <EmptyState
            icon={FolderOpen}
            title="Sin archivos"
            description="Sube tu primer archivo"
            actionLabel="Subir Archivo"
            onAction={() => setShowForm(true)}
          />
        </div>
      ) : vistaTabla ? (
        /* DataTable view */
        <DataTable
          columns={[
            {
              key: 'nombre',
              label: 'Nombre',
              render: (val, row) => {
                const esImagen = row.tipo?.startsWith('image/');
                return (
                  <div className="flex items-center gap-3">
                    {esImagen ? <Image size={18} className="text-violet-400" /> : <FileText size={18} className="text-cyan-400" />}
                    <span className="text-white font-medium">{val}</span>
                  </div>
                );
              }
            },
            {
              key: 'categoria',
              label: 'Categoría',
              render: (val) => {
                const cat = CATEGORIAS_ARCHIVOS.find(c => c.id === val);
                return (
                  <span className={`text-xs px-2 py-1 rounded-lg ${cat?.color} bg-opacity-20 text-white`}>
                    {cat?.name || val}
                  </span>
                );
              }
            },
            {
              key: 'cuentaNombre',
              label: 'Cuenta',
              render: (val, row) => {
                const nombre = val || row.clienteNombre;
                return nombre ? <span className="text-cyan-400">{nombre}</span> : <span className="text-slate-500">-</span>;
              }
            },
            {
              key: 'tipo',
              label: 'Tipo',
              render: (val) => <span className="text-slate-400 text-xs">{val || 'Desconocido'}</span>
            },
            {
              key: 'tamano',
              label: 'Tamaño',
              render: (val) => <span className="text-slate-300">{formatFileSize(val)}</span>
            },
            {
              key: 'fecha',
              label: 'Fecha',
              render: (val) => <span className="text-slate-400">{formatDate(val)}</span>
            }
          ]}
          data={archivosFiltrados}
          onRowClick={(row) => setViewingArchivo(row)}
          emptyMessage="No hay archivos"
        />
      ) : (
        /* Grid de archivos */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {archivosFiltrados.map(archivo => {
            const categoria = CATEGORIAS_ARCHIVOS.find(c => c.id === archivo.categoria);
            const esImagen = archivo.tipo?.startsWith('image/');
            return (
              <div key={archivo.id} onClick={() => setViewingArchivo(archivo)} className="group bg-slate-900/50 backdrop-blur-sm rounded-2xl p-5 border-2 border-slate-400 hover:border-cyan-500/50 transition-all cursor-pointer">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl ${categoria?.color} bg-opacity-20 flex items-center justify-center flex-shrink-0`}>
                    {esImagen ? <Image size={24} className="text-white" /> : <FileText size={24} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-medium truncate">{archivo.nombre}</h4>
                    <p className="text-slate-500 text-sm">{formatFileSize(archivo.tamano)}</p>
                    {(archivo.cuentaNombre || archivo.clienteNombre) && (
                      <p className="text-cyan-400 text-sm mt-1">{archivo.cuentaNombre || archivo.clienteNombre}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800">
                  <span className={`text-xs px-2 py-1 rounded-lg ${categoria?.color} bg-opacity-20 text-white`}>
                    {categoria?.name}
                  </span>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleEdit(archivo)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all" title="Editar">
                      <Edit size={16} />
                    </button>
                    <a
                      href={archivo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-slate-800 rounded-lg text-cyan-400 transition-all"
                      title="Descargar"
                    >
                      <Download size={16} />
                    </a>
                    <button onClick={() => handleDelete(archivo.id)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-all" title="Eliminar">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Resumen del Archivo */}
      {viewingArchivo && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewingArchivo(null)}>
          <div className="bg-slate-900 rounded-2xl border-2 border-slate-400 w-full max-w-2xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b border-slate-700 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl ${CATEGORIAS_ARCHIVOS.find(c => c.id === viewingArchivo.categoria)?.color} bg-opacity-20 flex items-center justify-center`}>
                  {viewingArchivo.tipo?.startsWith('image/') ? <Image size={28} className="text-white" /> : <FileText size={28} className="text-white" />}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{viewingArchivo.nombre}</h2>
                  <p className="text-slate-400 text-sm">{viewingArchivo.nombreArchivo}</p>
                </div>
              </div>
              <button onClick={() => setViewingArchivo(null)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all">
                <X size={20} />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6 space-y-6">
              {/* Preview de imagen */}
              {viewingArchivo.tipo?.startsWith('image/') && (
                <div className="bg-slate-800/50 rounded-xl p-4 flex items-center justify-center">
                  <img src={viewingArchivo.url} alt={viewingArchivo.nombre} className="max-h-64 rounded-lg object-contain" />
                </div>
              )}

              {/* Información del archivo */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <p className="text-slate-500 text-sm mb-1">Categoría</p>
                  <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm ${CATEGORIAS_ARCHIVOS.find(c => c.id === viewingArchivo.categoria)?.color} bg-opacity-20 text-white`}>
                    {CATEGORIAS_ARCHIVOS.find(c => c.id === viewingArchivo.categoria)?.name}
                  </span>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <p className="text-slate-500 text-sm mb-1">Tamaño</p>
                  <p className="text-white font-medium">{formatFileSize(viewingArchivo.tamano)}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <p className="text-slate-500 text-sm mb-1">Tipo de archivo</p>
                  <p className="text-white font-medium">{viewingArchivo.tipo || 'Desconocido'}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <p className="text-slate-500 text-sm mb-1">Fecha de subida</p>
                  <p className="text-white font-medium">{formatDate(viewingArchivo.fecha)}</p>
                </div>
                {(viewingArchivo.cuentaNombre || viewingArchivo.clienteNombre) && (
                  <div className="bg-slate-800/50 rounded-xl p-4 col-span-2">
                    <p className="text-slate-500 text-sm mb-1">Cuenta asociada</p>
                    <p className="text-cyan-400 font-medium flex items-center gap-2">
                      <Building size={16} /> {viewingArchivo.cuentaNombre || viewingArchivo.clienteNombre}
                    </p>
                  </div>
                )}
                {viewingArchivo.descripcion && (
                  <div className="bg-slate-800/50 rounded-xl p-4 col-span-2">
                    <p className="text-slate-500 text-sm mb-1">Descripción</p>
                    <p className="text-white">{viewingArchivo.descripcion}</p>
                  </div>
                )}
              </div>

              {/* Acciones */}
              <div className="flex gap-3 pt-4 border-t border-slate-700">
                <a
                  href={viewingArchivo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white px-5 py-3 rounded-xl hover:opacity-90 transition-all font-medium"
                >
                  <Download size={18} /> Descargar
                </a>
                <button
                  onClick={() => { setViewingArchivo(null); handleEdit(viewingArchivo); }}
                  className="flex items-center gap-2 bg-slate-800 text-slate-300 px-5 py-3 rounded-xl hover:bg-slate-700 transition-all font-medium"
                >
                  <Edit size={18} /> Editar
                </button>
                <button
                  onClick={() => { handleDelete(viewingArchivo.id); setViewingArchivo(null); }}
                  className="flex items-center gap-2 bg-red-500/20 text-red-400 px-5 py-3 rounded-xl hover:bg-red-500/30 transition-all font-medium"
                >
                  <Trash2 size={18} /> Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Archivos;
