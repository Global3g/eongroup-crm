import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';
import {
  generateId,
  limpiarUndefined
} from '../utils/helpers';
import {
  COLLECTION_NAME,
  DOC_ID,
  INDUSTRIAS,
  SERVICIOS,
  MODULES,
  PERMISOS_ADMIN,
  PERMISOS_BASICOS
} from '../utils/constants';

const CRMContext = createContext(null);

export function CRMProvider({ children }) {
  // UI state
  const [currentModule, setCurrentModule] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Auth state
  const [authUser, setAuthUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);

  // Data state
  const [cuentas, setCuentas] = useState([]);
  const [contactos, setContactos] = useState([]);
  const [clientes, setClientes] = useState([]); // kept temporarily for backwards compatibility
  const [leads, setLeads] = useState([]);
  const [pipeline, setPipeline] = useState([]);
  const [archivos, setArchivos] = useState([]);
  const [actividades, setActividades] = useState([]);
  const [recordatorios, setRecordatorios] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);
  const [industrias, setIndustrias] = useState([]);
  const [industriasEliminadas, setIndustriasEliminadas] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Email modal state
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailDestinatario, setEmailDestinatario] = useState(null);

  // Toast state
  const [toastNotificacion, setToastNotificacion] = useState(null);

  // ========== Auth listener ==========
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ========== Load data from Firebase ==========
  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        console.log('Cargando datos desde Firebase...');
        const docRef = doc(db, COLLECTION_NAME, DOC_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();

          // Migration: convert old clientes to cuentas + contactos
          if (data.cuentas) {
            // New format - load directly
            setCuentas(data.cuentas || []);
            setContactos(data.contactos || []);
          } else {
            // Old format - migrate clientes to cuentas + contactos
            const migratedCuentas = [];
            const migratedContactos = [];
            (data.clientes || []).forEach(cliente => {
              const cuenta = {
                id: cliente.id,
                empresa: cliente.empresa,
                industria: cliente.industria,
                servicio: cliente.servicio,
                sitioWeb: cliente.sitioWeb,
                direccion: cliente.direccion,
                numeroEmpleados: cliente.numeroEmpleados,
                logoUrl: cliente.logoUrl,
                tags: cliente.tags || [],
                fuente: cliente.fuente,
                referidoPor: cliente.referidoPor,
                esComisionista: cliente.esComisionista,
                notas: cliente.notas,
                asignadoA: cliente.asignadoA,
                asignadoA2: cliente.asignadoA2,
                asignadoA3: cliente.asignadoA3,
                fechaCreacion: cliente.fechaCreacion,
                creadoPor: cliente.creadoPor
              };
              migratedCuentas.push(cuenta);

              if (cliente.contacto || cliente.email) {
                migratedContactos.push({
                  id: generateId(),
                  cuentaId: cliente.id,
                  nombre: cliente.contacto || '',
                  cargo: cliente.cargo || '',
                  email: cliente.email || '',
                  telefono: cliente.telefono || '',
                  esPrincipal: true,
                  fechaCreacion: cliente.fechaCreacion,
                  creadoPor: cliente.creadoPor
                });
              }
            });
            setCuentas(migratedCuentas);
            setContactos(migratedContactos);
            console.log(`Migración completada: ${migratedCuentas.length} cuentas, ${migratedContactos.length} contactos`);
          }

          setClientes(data.clientes || []);
          setLeads(data.leads || []);
          setPipeline(data.pipeline || []);
          setArchivos(data.archivos || []);
          setActividades(data.actividades || []);
          setRecordatorios(data.recordatorios || []);
          setTareas(data.tareas || []);
          setUsuarios(data.usuarios || []);
          setNotificaciones(data.notificaciones || []);
          setIndustrias(data.industrias || []);
          setIndustriasEliminadas(data.industriasEliminadas || []);
          setServicios(data.servicios || []);
          setAuditLog(data.auditLog || []);

          // Find current user by UID first, then by email
          let foundUser = (data.usuarios || []).find(u => u.id === authUser.uid)
                       || (data.usuarios || []).find(u => u.email === authUser.email);

          // If no users in system OR admin principal without record, create as admin
          if (!foundUser && (!data.usuarios || data.usuarios.length === 0 || authUser.email === 'gustavo@eongroup.com')) {
            foundUser = {
              id: authUser.uid,
              nombre: authUser.displayName || authUser.email.split('@')[0],
              email: authUser.email,
              password: '(creado externamente)',
              activo: true,
              rol: 'admin',
              permisos: { ...PERMISOS_ADMIN },
              fechaCreacion: new Date().toISOString()
            };
            const existingUsers = data.usuarios || [];
            setUsuarios([...existingUsers, foundUser]);
          }

          if (foundUser) {
            if (!foundUser.activo) {
              alert('Tu cuenta ha sido desactivada. Contacta al administrador.');
              await signOut(auth);
              setLoading(false);
              return;
            }
            if (!foundUser.permisos) {
              foundUser.permisos = foundUser.rol === 'admin' ? { ...PERMISOS_ADMIN } : { ...PERMISOS_BASICOS };
            }
            setCurrentUser(foundUser);
          } else {
            alert('No tienes acceso al sistema. Contacta al administrador para que te registre.');
            await signOut(auth);
            setLoading(false);
            return;
          }
          console.log('Datos cargados correctamente');
          setDataLoaded(true);
        } else {
          console.log('No hay datos previos, creando usuario inicial como admin');
          setDataLoaded(true);
          const newUser = {
            id: generateId(),
            email: authUser.email,
            nombre: authUser.displayName || authUser.email.split('@')[0],
            rol: 'admin',
            activo: true,
            fechaCreacion: new Date().toISOString(),
            permisos: { ...PERMISOS_ADMIN }
          };
          setUsuarios([newUser]);
          setCurrentUser(newUser);
        }
      } catch (error) {
        console.error('Error cargando datos:', error);
      }
      setLoading(false);
    };
    loadData();
  }, [authUser, authLoading]);

  // ========== Save data to Firebase on changes ==========
  useEffect(() => {
    if (loading || !authUser || !dataLoaded) return;

    const saveData = async () => {
      setSaving(true);
      try {
        const data = limpiarUndefined({
          cuentas, contactos, leads, pipeline, archivos, actividades,
          recordatorios, tareas, usuarios, notificaciones,
          industrias, industriasEliminadas, servicios, auditLog
        });
        await setDoc(doc(db, COLLECTION_NAME, DOC_ID), data);
        console.log('Datos guardados exitosamente');
      } catch (error) {
        console.error('Error guardando datos:', error);
        alert('Error al guardar: ' + error.message);
      }
      setSaving(false);
    };

    const timeoutId = setTimeout(saveData, 500);
    return () => clearTimeout(timeoutId);
  }, [cuentas, contactos, leads, pipeline, archivos, actividades, recordatorios, tareas, usuarios, notificaciones, industrias, industriasEliminadas, servicios, auditLog, loading, authUser, dataLoaded]);

  // ========== Functions ==========

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setCurrentModule('dashboard');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const addNotificacion = (userId, mensaje, tipo = 'info', link = null, entidadNombre = null) => {
    const newNotif = {
      id: generateId(),
      userId,
      mensaje,
      tipo,
      link,
      entidadNombre,
      leida: false,
      fecha: new Date().toISOString()
    };
    setNotificaciones(prev => [newNotif, ...prev]);

    if (userId === currentUser?.id) {
      setToastNotificacion(newNotif);
      setTimeout(() => setToastNotificacion(null), 5000);
    }
  };

  const marcarLeida = (notifId) => {
    setNotificaciones(prev => prev.map(n =>
      n.id === notifId ? { ...n, leida: true } : n
    ));
  };

  const marcarTodasLeidas = () => {
    setNotificaciones(prev => prev.map(n =>
      n.userId === currentUser?.id ? { ...n, leida: true } : n
    ));
  };

  const addAuditLog = (accion, modulo, detalles, entidadId = null, entidadNombre = null) => {
    const newEntry = {
      id: generateId(),
      accion,
      modulo,
      detalles,
      entidadId,
      entidadNombre,
      usuarioId: currentUser?.id,
      usuarioNombre: currentUser?.nombre || currentUser?.email,
      fecha: new Date().toISOString()
    };
    setAuditLog(prev => [newEntry, ...prev]);
  };

  const addIndustria = (nombre) => {
    if (!nombre.trim()) return false;
    const todas = [...INDUSTRIAS, ...industrias].filter(i => !industriasEliminadas.includes(i));
    const existe = todas.some(i => i.toLowerCase() === nombre.trim().toLowerCase());
    if (existe) return false;
    setIndustrias(prev => [...prev, nombre.trim()]);
    setIndustriasEliminadas(prev => prev.filter(i => i !== nombre.trim()));
    addAuditLog('crear', 'industrias', `Nueva industria agregada: ${nombre.trim()}`);
    return true;
  };

  const editIndustria = (oldName, newName) => {
    if (!newName.trim() || oldName === newName.trim()) return false;
    setIndustrias(prev => prev.filter(i => i !== oldName));
    setIndustriasEliminadas(prev => [...prev, oldName]);
    setIndustrias(prev => [...prev, newName.trim()]);
    setIndustriasEliminadas(prev => prev.filter(i => i !== newName.trim()));
    addAuditLog('editar', 'industrias', `Industria editada: ${oldName} → ${newName.trim()}`);
    return true;
  };

  const deleteIndustria = (nombre) => {
    setIndustrias(prev => prev.filter(i => i !== nombre));
    if (INDUSTRIAS.includes(nombre)) {
      setIndustriasEliminadas(prev => [...prev, nombre]);
    }
    addAuditLog('eliminar', 'industrias', `Industria eliminada: ${nombre}`);
  };

  const addServicio = (nombre) => {
    if (!nombre.trim()) return false;
    const existe = [...SERVICIOS, ...servicios].some(
      s => s.toLowerCase() === nombre.trim().toLowerCase()
    );
    if (existe) return false;
    setServicios(prev => [...prev, nombre.trim()]);
    addAuditLog('crear', 'servicios', `Nuevo servicio agregado: ${nombre.trim()}`);
    return true;
  };

  // ========== Computed values ==========

  const misNotificaciones = notificaciones.filter(n => n.userId === currentUser?.id && !n.leida);
  const todasMisNotificaciones = notificaciones.filter(n => n.userId === currentUser?.id);
  const todasLasIndustrias = [...new Set([...INDUSTRIAS, ...industrias])].filter(i => !industriasEliminadas.includes(i)).sort((a, b) => a.localeCompare(b));
  const todosLosServicios = [...new Set([...SERVICIOS, ...servicios].map(s => s.trim()))].sort((a, b) => a.localeCompare(b));
  const modulosVisibles = MODULES.filter(m => {
    if (currentUser?.permisos?.modulos) {
      return currentUser.permisos.modulos[m.id] === true;
    }
    return true;
  });

  // ========== Context value ==========

  const value = {
    // UI state
    currentModule, setCurrentModule,
    sidebarOpen, setSidebarOpen,
    loading,
    saving,
    showNotifications, setShowNotifications,

    // Auth state
    authUser,
    authLoading,
    currentUser, setCurrentUser,

    // Data state + setters
    cuentas, setCuentas,
    contactos, setContactos,
    clientes, setClientes, // kept temporarily for backwards compatibility
    leads, setLeads,
    pipeline, setPipeline,
    archivos, setArchivos,
    actividades, setActividades,
    recordatorios, setRecordatorios,
    tareas, setTareas,
    usuarios, setUsuarios,
    notificaciones, setNotificaciones,
    industrias, setIndustrias,
    industriasEliminadas, setIndustriasEliminadas,
    servicios, setServicios,
    auditLog, setAuditLog,

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
    addIndustria,
    editIndustria,
    deleteIndustria,
    addServicio,

    // Computed values
    misNotificaciones,
    todasMisNotificaciones,
    todasLasIndustrias,
    todosLosServicios,
    modulosVisibles
  };

  return (
    <CRMContext.Provider value={value}>
      {children}
    </CRMContext.Provider>
  );
}

export function useCRM() {
  const context = useContext(CRMContext);
  if (!context) {
    throw new Error('useCRM must be used within a CRMProvider');
  }
  return context;
}
