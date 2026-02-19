import React, { useState } from 'react';
import {
  Users, Plus, CheckCircle, Edit, Eye, Shield, XCircle,
  Trash2, X, AlertCircle, Loader, Camera
} from 'lucide-react';
import {
  createUserWithEmailAndPassword, signOut,
  EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail
} from 'firebase/auth';
import { auth, secondaryAuth } from '../firebase';
import { generateId } from '../utils/helpers';
import { ROLES, PERMISOS_ADMIN, PERMISOS_BASICOS, MODULES } from '../utils/constants';

function Equipo({ usuarios, setUsuarios, currentUser }) {
  const [showModal, setShowModal] = useState(false);
  const [showPermisosModal, setShowPermisosModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showPasswords, setShowPasswords] = useState({});
  const [creatingInFirebase, setCreatingInFirebase] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    passwordActual: '',
    rol: 'vendedor',
    fotoUrl: '',
    googleEmail: '',
    permisos: { ...PERMISOS_BASICOS }
  });

  // Crear nuevo usuario
  const handleCreateUser = async () => {
    if (!formData.nombre || !formData.email || !formData.password) {
      setError('Completa todos los campos');
      return;
    }
    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setCreatingInFirebase(true);
    setError('');

    try {
      // Crear usuario en Firebase Auth usando instancia secundaria (no afecta sesión actual)
      await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
      // Cerrar sesión en la instancia secundaria
      await signOut(secondaryAuth);

      // Agregar a la lista local
      const newUser = {
        id: generateId(),
        nombre: formData.nombre,
        email: formData.email,
        password: formData.password,
        fotoUrl: formData.fotoUrl || '',
        googleEmail: formData.googleEmail || '',
        activo: true,
        fechaCreacion: new Date().toISOString(),
        permisos: { ...formData.permisos }
      };
      setUsuarios(prev => [...prev, newUser]);

      setShowModal(false);
      setIsCreating(false);
      setFormData({ nombre: '', email: '', password: '', passwordActual: '', rol: 'vendedor', fotoUrl: '', googleEmail: '', permisos: { ...PERMISOS_BASICOS } });
    } catch (err) {
      console.error('Error creando usuario:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este email ya está registrado');
      } else {
        setError('Error al crear usuario: ' + err.message);
      }
    }
    setCreatingInFirebase(false);
  };

  // Guardar cambios de usuario (nombre, rol)
  const handleSaveUser = async () => {
    if (!formData.nombre) return;
    if (!formData.email) {
      setError('El email es obligatorio');
      return;
    }

    if (editingUser) {
      const emailChanged = editingUser.email !== formData.email;

      // Si cambió el email y es el usuario actual, re-autenticar y enviar verificación
      if (emailChanged && editingUser.id === currentUser?.id && auth.currentUser) {
        if (!formData.passwordActual) {
          setError('Ingresa tu contraseña actual para cambiar el email');
          return;
        }
        try {
          setCreatingInFirebase(true);
          // Re-autenticar con la contraseña actual
          const credential = EmailAuthProvider.credential(auth.currentUser.email, formData.passwordActual);
          await reauthenticateWithCredential(auth.currentUser, credential);
          // Ahora sí enviar verificación al nuevo email
          await verifyBeforeUpdateEmail(auth.currentUser, formData.email);
          alert('Se ha enviado un enlace de verificación a ' + formData.email + '. Una vez verificado, tu email se actualizará automáticamente.');
          setCreatingInFirebase(false);
          setShowModal(false);
          setEditingUser(null);
          setFormData({ nombre: '', email: '', password: '', passwordActual: '', rol: 'vendedor', fotoUrl: '', googleEmail: '', permisos: { ...PERMISOS_BASICOS } });
          return;
        } catch (err) {
          console.error('Error:', err);
          if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
            setError('Contraseña incorrecta');
          } else if (err.code === 'auth/email-already-in-use') {
            setError('Este email ya está en uso por otra cuenta');
          } else if (err.code === 'auth/invalid-email') {
            setError('El email ingresado no es válido');
          } else {
            setError('Error: ' + err.message);
          }
          setCreatingInFirebase(false);
          return;
        }
      }

      setUsuarios(prev => prev.map(u =>
        u.id === editingUser.id ? { ...u, nombre: formData.nombre, email: formData.email, fotoUrl: formData.fotoUrl || '', googleEmail: formData.googleEmail || '' } : u
      ));
    }
    setShowModal(false);
    setEditingUser(null);
    setFormData({ nombre: '', email: '', password: '', passwordActual: '', rol: 'vendedor', fotoUrl: '', googleEmail: '', permisos: { ...PERMISOS_BASICOS } });
  };

  // Guardar permisos
  const handleSavePermisos = () => {
    if (editingUser) {
      setUsuarios(prev => prev.map(u =>
        u.id === editingUser.id ? { ...u, permisos: { ...formData.permisos } } : u
      ));
    }
    setShowPermisosModal(false);
    setEditingUser(null);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setIsCreating(false);
    setFormData({
      nombre: user.nombre,
      email: user.email,
      password: user.password || '',
      rol: user.rol,
      fotoUrl: user.fotoUrl || '',
      googleEmail: user.googleEmail || '',
      permisos: user.permisos || { ...PERMISOS_BASICOS }
    });
    setShowModal(true);
    setError('');
  };

  const handleEditPermisos = (user) => {
    setEditingUser(user);
    setFormData({
      ...formData,
      permisos: user.permisos || { ...PERMISOS_BASICOS }
    });
    setShowPermisosModal(true);
  };

  const handleNewUser = () => {
    setEditingUser(null);
    setIsCreating(true);
    setFormData({ nombre: '', email: '', password: '', passwordActual: '', rol: 'vendedor', fotoUrl: '', googleEmail: '', permisos: { ...PERMISOS_BASICOS } });
    setShowModal(true);
    setError('');
  };

  const handleToggleActive = (userId) => {
    setUsuarios(prev => prev.map(u =>
      u.id === userId ? { ...u, activo: !u.activo } : u
    ));
  };

  const handleDeleteUser = (userId, userName) => {
    if (window.confirm(`¿Eliminar a ${userName} permanentemente?`)) {
      setUsuarios(prev => prev.filter(u => u.id !== userId));
    }
  };

  const toggleShowPassword = (userId) => {
    setShowPasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const togglePermiso = (categoria, permiso) => {
    if (categoria === 'modulos') {
      setFormData(prev => ({
        ...prev,
        permisos: {
          ...prev.permisos,
          modulos: {
            ...prev.permisos.modulos,
            [permiso]: !prev.permisos.modulos[permiso]
          }
        }
      }));
    } else if (categoria === 'alcance') {
      setFormData(prev => ({
        ...prev,
        permisos: {
          ...prev.permisos,
          alcance: prev.permisos.alcance === 'todos' ? 'propios' : 'todos'
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        permisos: {
          ...prev.permisos,
          [categoria]: {
            ...prev.permisos[categoria],
            [permiso]: !prev.permisos[categoria][permiso]
          }
        }
      }));
    }
  };

  const getRolColor = (rol) => {
    const found = ROLES.find(r => r.id === rol);
    return found?.color || 'bg-slate-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-cyan-400" />
            Equipo
          </h2>
          <p className="text-slate-400 mt-1">Gestiona los miembros de tu equipo y sus permisos</p>
        </div>
        <button
          onClick={handleNewUser}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={18} />
          Nuevo Usuario
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/40 backdrop-blur-md rounded-xl border border-white/[0.08] p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <Users className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{usuarios.length}</p>
              <p className="text-sm text-slate-400">Total usuarios</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/40 backdrop-blur-md rounded-xl border border-white/[0.08] p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{usuarios.filter(u => u.activo !== false).length}</p>
              <p className="text-sm text-slate-400">Activos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl border border-white/[0.08] overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h3 className="font-semibold text-white">Miembros del equipo</h3>
        </div>
        <div className="divide-y divide-slate-800">
          {usuarios.map(user => (
            <div key={user.id} className="p-4 hover:bg-slate-800/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {user.fotoUrl ? (
                    <img src={user.fotoUrl} alt={user.nombre} className={`w-12 h-12 rounded-full object-cover border-2 border-cyan-500/30 ${user.activo === false ? 'opacity-50' : ''}`} />
                  ) : (
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center text-white font-bold text-lg ${user.activo === false ? 'opacity-50' : ''}`}>
                      {user.nombre?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className={`font-medium text-white ${user.activo === false ? 'opacity-50' : ''}`}>{user.nombre}</p>
                      {user.id === currentUser?.id && (
                        <span className="text-xs text-cyan-400">(Tú)</span>
                      )}
                    </div>
                    <p className={`text-sm text-slate-400 ${user.activo === false ? 'opacity-50' : ''}`}>{user.email}</p>
                    {/* Mostrar contraseña si es admin y no es él mismo */}
                    {currentUser?.permisos?.modulos?.equipo && user.password && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500">Contraseña:</span>
                        <span className="text-xs text-slate-400 font-mono">
                          {showPasswords[user.id] ? user.password : '••••••••'}
                        </span>
                        <button
                          onClick={() => toggleShowPassword(user.id)}
                          className="text-slate-500 hover:text-cyan-400 transition-colors"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {user.activo === false && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                      Inactivo
                    </span>
                  )}
                  {/* Botón para editar mi propio perfil */}
                  {user.id === currentUser?.id && (
                    <button
                      onClick={() => handleEditUser(user)}
                      className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-lg text-xs font-medium hover:bg-cyan-500/30 transition-colors flex items-center gap-1"
                    >
                      <Edit size={14} /> Editar mi perfil
                    </button>
                  )}
                  {currentUser?.permisos?.modulos?.equipo && user.id !== currentUser.id && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="p-2 text-slate-400 hover:text-cyan-400 transition-colors"
                        title="Editar datos"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleEditPermisos(user)}
                        className="p-2 text-slate-400 hover:text-violet-400 transition-colors"
                        title="Editar permisos"
                      >
                        <Shield size={16} />
                      </button>
                      <button
                        onClick={() => handleToggleActive(user.id)}
                        className={`p-2 transition-colors ${user.activo !== false ? 'text-slate-400 hover:text-amber-400' : 'text-slate-400 hover:text-emerald-400'}`}
                        title={user.activo !== false ? 'Desactivar' : 'Activar'}
                      >
                        {user.activo !== false ? <XCircle size={16} /> : <CheckCircle size={16} />}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id, user.nombre)}
                        className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                        title="Eliminar usuario"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-slate-900 rounded-2xl border border-slate-300/40 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                {isCreating ? 'Nuevo Usuario' : 'Editar Usuario'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Nombre</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-300/40 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                  placeholder="Nombre completo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-300/40 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                  placeholder="correo@empresa.com"
                />
                {!isCreating && editingUser?.email !== formData.email && (
                  <p className="text-xs text-amber-400 mt-1">Al cambiar el email, se enviará un enlace de verificación al nuevo correo</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  <Camera size={14} className="inline mr-1" />
                  Foto de perfil
                </label>
                <div className="flex items-center gap-3">
                  {formData.fotoUrl && (
                    <img src={formData.fotoUrl} alt="Preview" className="w-12 h-12 rounded-full object-cover border-2 border-cyan-500/30" onError={(e) => { e.target.style.display = 'none'; }} />
                  )}
                  <input
                    type="url"
                    value={formData.fotoUrl}
                    onChange={(e) => setFormData({ ...formData, fotoUrl: e.target.value })}
                    className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-300/40 rounded-xl text-white focus:outline-none focus:border-cyan-500 text-sm"
                    placeholder="URL de foto de perfil"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">Pega la URL de una imagen (ej. desde Google Drive, Imgur, etc.)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Email de Google Calendar</label>
                <input
                  type="email"
                  value={formData.googleEmail}
                  onChange={(e) => setFormData({ ...formData, googleEmail: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-300/40 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                  placeholder="tucuenta@gmail.com"
                />
                <p className="text-xs text-slate-500 mt-1">Opcional. Si tu cuenta de Google es diferente al email de login, ponla aqui para que Google Calendar abra con tu cuenta correcta.</p>
              </div>
              {!isCreating && editingUser?.id === currentUser?.id && editingUser?.email !== formData.email && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Contraseña Actual</label>
                  <input
                    type="password"
                    value={formData.passwordActual}
                    onChange={(e) => setFormData({ ...formData, passwordActual: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-300/40 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                    placeholder="Ingresa tu contraseña actual"
                  />
                  <p className="text-xs text-slate-500 mt-1">Requerida para verificar tu identidad</p>
                </div>
              )}
              {isCreating && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Contraseña</label>
                  <input
                    type="text"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-300/40 rounded-xl text-white focus:outline-none focus:border-cyan-500 font-mono"
                    placeholder="Mínimo 6 caracteres"
                  />
                  <p className="text-xs text-slate-500 mt-1">La contraseña será visible para ti como administrador</p>
                </div>
              )}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-800 flex gap-3">
              <button
                onClick={isCreating ? handleCreateUser : handleSaveUser}
                disabled={creatingInFirebase}
                className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-violet-500 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creatingInFirebase ? (
                  <>
                    <Loader size={18} className="animate-spin" />
                    Creando...
                  </>
                ) : (
                  isCreating ? 'Crear Usuario' : 'Guardar'
                )}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permisos Modal - Nueva versión con alcance por acción */}
      {showPermisosModal && editingUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowPermisosModal(false)}>
          <div className="bg-slate-900 rounded-2xl border border-slate-300/40 w-full max-w-4xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-violet-400" />
                Permisos de {editingUser.nombre}
              </h3>
              <button onClick={() => setShowPermisosModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto max-h-[65vh]">

              {/* Módulos - Pills clickeables */}
              <div>
                <p className="text-white font-medium mb-3">Acceso a módulos</p>
                <div className="flex flex-wrap gap-2">
                  {MODULES.map(mod => {
                    const isActive = formData.permisos?.modulos?.[mod.id];
                    const Icon = mod.icon;
                    return (
                      <button
                        key={mod.id}
                        onClick={() => togglePermiso('modulos', mod.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${isActive ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50' : 'bg-slate-800 text-slate-500 border border-slate-300/40 hover:border-slate-400'}`}
                      >
                        <Icon size={16} />
                        {mod.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Leyenda */}
              <div className="bg-slate-800/30 rounded-xl p-4">
                <p className="text-sm text-slate-400 mb-2">Valores de permisos:</p>
                <div className="flex flex-wrap gap-4 text-xs">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500"></span> Todos = puede con registros de cualquier usuario</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500"></span> Propios = solo registros que creó o tiene asignados</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-600"></span> No = no tiene este permiso</span>
                </div>
              </div>

              {/* Permisos por módulo - Nueva tabla con dropdowns */}
              <div>
                <p className="text-white font-medium mb-3">Permisos detallados</p>
                <div className="bg-slate-800/30 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-300/30">
                        <th className="text-left p-3 text-slate-400 font-medium">Módulo</th>
                        <th className="text-center p-3 text-slate-400 font-medium">Ver</th>
                        <th className="text-center p-3 text-slate-400 font-medium">Crear</th>
                        <th className="text-center p-3 text-slate-400 font-medium">Editar</th>
                        <th className="text-center p-3 text-slate-400 font-medium">Eliminar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { id: 'clientes', name: 'Clientes' },
                        { id: 'pipeline', name: 'Pipeline' },
                        { id: 'leads', name: 'Leads' },
                        { id: 'actividades', name: 'Actividades' },
                        { id: 'tareas', name: 'Tareas' },
                        { id: 'recordatorios', name: 'Recordatorios' }
                      ].map(modulo => {
                        const permisos = formData.permisos?.[modulo.id] || {};
                        return (
                          <tr key={modulo.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                            <td className="p-3 text-white">{modulo.name}</td>
                            {/* Ver */}
                            <td className="text-center p-2">
                              <select
                                value={permisos.ver || false}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  permisos: {
                                    ...prev.permisos,
                                    [modulo.id]: { ...prev.permisos?.[modulo.id], ver: e.target.value === 'false' ? false : e.target.value }
                                  }
                                }))}
                                className={`px-2 py-1.5 rounded-lg text-xs font-medium border-0 cursor-pointer ${
                                  permisos.ver === 'todos' ? 'bg-emerald-500/20 text-emerald-400' :
                                  permisos.ver === 'propios' ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-slate-700 text-slate-400'
                                }`}
                              >
                                <option value="todos">Todos</option>
                                <option value="propios">Propios</option>
                                <option value="false">No</option>
                              </select>
                            </td>
                            {/* Crear */}
                            <td className="text-center p-2">
                              <button
                                onClick={() => setFormData(prev => ({
                                  ...prev,
                                  permisos: {
                                    ...prev.permisos,
                                    [modulo.id]: { ...prev.permisos?.[modulo.id], crear: !prev.permisos?.[modulo.id]?.crear }
                                  }
                                }))}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                  permisos.crear ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                                }`}
                              >
                                {permisos.crear ? 'Sí' : 'No'}
                              </button>
                            </td>
                            {/* Editar */}
                            <td className="text-center p-2">
                              <select
                                value={permisos.editar || false}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  permisos: {
                                    ...prev.permisos,
                                    [modulo.id]: { ...prev.permisos?.[modulo.id], editar: e.target.value === 'false' ? false : e.target.value }
                                  }
                                }))}
                                className={`px-2 py-1.5 rounded-lg text-xs font-medium border-0 cursor-pointer ${
                                  permisos.editar === 'todos' ? 'bg-emerald-500/20 text-emerald-400' :
                                  permisos.editar === 'propios' ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-slate-700 text-slate-400'
                                }`}
                              >
                                <option value="todos">Todos</option>
                                <option value="propios">Propios</option>
                                <option value="false">No</option>
                              </select>
                            </td>
                            {/* Eliminar */}
                            <td className="text-center p-2">
                              <select
                                value={permisos.eliminar || false}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  permisos: {
                                    ...prev.permisos,
                                    [modulo.id]: { ...prev.permisos?.[modulo.id], eliminar: e.target.value === 'false' ? false : e.target.value }
                                  }
                                }))}
                                className={`px-2 py-1.5 rounded-lg text-xs font-medium border-0 cursor-pointer ${
                                  permisos.eliminar === 'todos' ? 'bg-emerald-500/20 text-emerald-400' :
                                  permisos.eliminar === 'propios' ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-slate-700 text-slate-400'
                                }`}
                              >
                                <option value="todos">Todos</option>
                                <option value="propios">Propios</option>
                                <option value="false">No</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                      {/* Archivos - caso especial */}
                      <tr className="hover:bg-slate-800/50">
                        <td className="p-3 text-white">Archivos</td>
                        <td className="text-center p-2">
                          <select
                            value={formData.permisos?.archivos?.ver || false}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              permisos: {
                                ...prev.permisos,
                                archivos: { ...prev.permisos?.archivos, ver: e.target.value === 'false' ? false : e.target.value }
                              }
                            }))}
                            className={`px-2 py-1.5 rounded-lg text-xs font-medium border-0 cursor-pointer ${
                              formData.permisos?.archivos?.ver === 'todos' ? 'bg-emerald-500/20 text-emerald-400' :
                              formData.permisos?.archivos?.ver === 'propios' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-slate-700 text-slate-400'
                            }`}
                          >
                            <option value="todos">Todos</option>
                            <option value="propios">Propios</option>
                            <option value="false">No</option>
                          </select>
                        </td>
                        <td className="text-center p-2">
                          <button
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              permisos: {
                                ...prev.permisos,
                                archivos: { ...prev.permisos?.archivos, subir: !prev.permisos?.archivos?.subir }
                              }
                            }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              formData.permisos?.archivos?.subir ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                            }`}
                          >
                            {formData.permisos?.archivos?.subir ? 'Sí' : 'No'}
                          </button>
                        </td>
                        <td className="text-center p-2 text-slate-600">-</td>
                        <td className="text-center p-2">
                          <select
                            value={formData.permisos?.archivos?.eliminar || false}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              permisos: {
                                ...prev.permisos,
                                archivos: { ...prev.permisos?.archivos, eliminar: e.target.value === 'false' ? false : e.target.value }
                              }
                            }))}
                            className={`px-2 py-1.5 rounded-lg text-xs font-medium border-0 cursor-pointer ${
                              formData.permisos?.archivos?.eliminar === 'todos' ? 'bg-emerald-500/20 text-emerald-400' :
                              formData.permisos?.archivos?.eliminar === 'propios' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-slate-700 text-slate-400'
                            }`}
                          >
                            <option value="todos">Todos</option>
                            <option value="propios">Propios</option>
                            <option value="false">No</option>
                          </select>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Acciones rápidas */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setFormData({ ...formData, permisos: { ...PERMISOS_ADMIN } })}
                  className="px-3 py-2 bg-violet-500/20 text-violet-400 rounded-lg text-xs hover:bg-violet-500/30"
                >
                  Dar acceso total (Admin)
                </button>
                <button
                  onClick={() => setFormData({ ...formData, permisos: { ...PERMISOS_BASICOS } })}
                  className="px-3 py-2 bg-amber-500/20 text-amber-400 rounded-lg text-xs hover:bg-amber-500/30"
                >
                  Vendedor (ve todo, edita propios)
                </button>
                <button
                  onClick={() => setFormData({ ...formData, permisos: {
                    modulos: { dashboard: true, clientes: true, pipeline: true, leads: true, calendario: true, tareas: true, reportes: true, archivos: true, auditlog: false, equipo: false },
                    clientes: { ver: 'todos', crear: false, editar: false, eliminar: false },
                    pipeline: { ver: 'todos', crear: false, editar: false, eliminar: false },
                    leads: { ver: 'todos', crear: false, editar: false, eliminar: false },
                    actividades: { ver: 'todos', crear: false, editar: false, eliminar: false },
                    tareas: { ver: 'todos', crear: false, editar: false, eliminar: false },
                    recordatorios: { ver: 'todos', crear: false, editar: false, eliminar: false },
                    archivos: { ver: 'todos', subir: false, eliminar: false }
                  }})}
                  className="px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-xs hover:bg-slate-600"
                >
                  Solo lectura
                </button>
              </div>
            </div>
            <div className="p-6 border-t border-slate-800 flex gap-3">
              <button
                onClick={handleSavePermisos}
                className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-violet-500 text-white rounded-xl font-medium hover:opacity-90"
              >
                Guardar Permisos
              </button>
              <button
                onClick={() => setShowPermisosModal(false)}
                className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Equipo;
