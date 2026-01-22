
import React, { useState, useEffect, useRef } from 'react';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { TripDetail } from './pages/TripDetail';
import { AdminDashboard } from './pages/AdminDashboard';
import { Header } from './Header';
import { User, Trip, TripStatus, AppNotification } from './types';
import { MOCK_TRIPS, TRIP_STAGES } from './constants';
import { requestNotificationPermission, playSound, sendPushNotification } from './utils';
import { supabase } from './supabaseClient';
import { X, CheckCircle, AlertCircle, Info, Truck, RefreshCw } from 'lucide-react';

enum View {
  LOGIN,
  DASHBOARD,
  TRIP_DETAIL,
  ADMIN_DASHBOARD
}

interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'alert' | 'info';
}

const App: React.FC = () => {
  // --- SESSION PERSISTENCE LOGIC ---
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('tls_session_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      console.error("Error reading session", e);
      return null;
    }
  });

  const [currentView, setCurrentView] = useState<View>(() => {
    try {
      const savedUser = localStorage.getItem('tls_session_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        return parsedUser.role === 'ADMIN' ? View.ADMIN_DASHBOARD : View.DASHBOARD;
      }
    } catch (e) {}
    return View.LOGIN;
  });

  const [trips, setTrips] = useState<Trip[]>(MOCK_TRIPS);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  // Cambiado a array para manejar múltiples notificaciones simultáneas
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  
  // Referencia para guardar las alarmas activas (audio en loop) mapeadas por ID de notificación
  const activeAlarmsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const userRef = useRef<User | null>(user);

  useEffect(() => {
    userRef.current = user;
    if (user) {
        fetchNotifications();
        requestNotificationPermission(); // Solicitar permisos al iniciar sesión o cargar app
    }
  }, [user]);

  const showToast = (title: string, message: string, type: 'success' | 'alert' | 'info') => {
    const id = Date.now().toString() + Math.random().toString().slice(2, 5);
    const newToast = { id, title, message, type };
    
    // Agregar a la pila de notificaciones
    setToasts(prev => [...prev, newToast]);
    
    // LÓGICA DE SONIDO REFORZADA:
    // Si es 'alert' (Pánico/Urgente), activamos el loop (true).
    // Guardamos la referencia del audio para poder detenerlo al cerrar la notificación.
    const isCritical = type === 'alert';

    // FIX: Map 'info' type to 'notification' sound type
    const soundType = type === 'info' ? 'notification' : type;
    const audioInstance = playSound(soundType, isCritical);
    
    if (isCritical && audioInstance) {
        activeAlarmsRef.current.set(id, audioInstance);
    }
    
    // LÓGICA DE CIERRE AUTOMÁTICO:
    // Si NO es admin, cerramos automáticamente después de 8 segundos.
    // Si ES admin, la notificación persiste hasta que se cierre manualmente.
    if (userRef.current?.role !== 'ADMIN') {
        setTimeout(() => {
            // Si se cierra automáticamente (operador), también nos aseguramos de parar el audio si existiera
            removeToast(id);
        }, 8000);
    }
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    
    // DETENER ALARMA SI EXISTE
    const alarmAudio = activeAlarmsRef.current.get(id);
    if (alarmAudio) {
        alarmAudio.pause();
        alarmAudio.currentTime = 0;
        activeAlarmsRef.current.delete(id);
    }
  };

  const fetchNotifications = async () => {
    if (!userRef.current) return;
    
    try {
        const { data, error } = await supabase
            .from('notificaciones')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50); 
        
        if (error) {
            console.error("Error fetching notifications:", error);
            return;
        }

        if (data) {
            const myNotifs = data.filter((n: AppNotification) => {
                 const targetRole = n.target_role;
                 const targetUser = n.target_user_id;
                 const myRole = userRef.current?.role;
                 const myId = userRef.current?.id;
                 const myPlate = (userRef.current as any)?.plate || myId; 

                 const roleMatch = targetRole === 'ALL' || targetRole === myRole;
                 const userMatch = !targetUser || targetUser === myId || targetUser === myPlate;

                 return roleMatch && userMatch;
            });

            setNotifications(myNotifs);
        }
    } catch (err) {
        console.error("Fetch Notifs Exception:", err);
    }
  };

  const fetchTrips = async () => {
      const { data, error } = await supabase
        .from('viajes')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (data) {
        const mappedTrips: Trip[] = data.map((t: any) => ({
          id: t.id,
          code: t.code,
          origin: t.origin,
          destination: t.destination,
          destinations: t.destinos_lista || [],
          client: t.client || 'Cliente General',
          project: t.project || 'Logística',
          appointment: t.appointment || '00:00',
          instructions: t.instructions || '',
          indicaciones_pdf_url: t.indicaciones_pdf_url || '',
          status: t.status as TripStatus,
          date: t.scheduled_date || new Date(t.created_at).toLocaleDateString('es-MX'), 
          cargoType: 'General',
          plate: t.plate,
          currentStageIndex: t.current_stage || 0,
          hasIncident: false,
          evidence: t.evidence || [], 
          evidenceStatus: t.evidence_status || 'NONE',
          locationHistory: [],
          extraCosts: t.extra_costs || [],
          // MAPEO DE ODÓMETROS (CORRECCIÓN)
          odometerStart: t.odometer_start ? Number(t.odometer_start) : undefined,
          odometerEnd: t.odometer_end ? Number(t.odometer_end) : undefined
        }));

        const uniqueTrips = Array.from(new Map(mappedTrips.map(t => [t.id, t])).values());
        setTrips(uniqueTrips);
      }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            fetchTrips();
            fetchNotifications();
        }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    const intervalId = setInterval(() => {
        if (document.visibilityState === 'visible' && userRef.current) {
            fetchNotifications();
        }
    }, 10000);

    return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    fetchTrips();

    const tripsChannel = supabase.channel('realtime_viajes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viajes' }, (payload) => {
        fetchTrips();
      })
      .subscribe();

    const notifChannel = supabase.channel('realtime_notifs_global')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones' }, async (payload) => {
          console.log("🔔 REALTIME EVENT RECEIVED:", payload); 
          
          const newNotif = payload.new as AppNotification;
          const currentUser = userRef.current;

          if (currentUser) {
              const myRole = currentUser.role;
              const myId = currentUser.id;
              const myPlate = (currentUser as any)?.plate || myId;

              const isRoleMatch = newNotif.target_role === 'ALL' || newNotif.target_role === myRole;
              const isUserMatch = !newNotif.target_user_id || 
                                   newNotif.target_user_id === myId || 
                                   newNotif.target_user_id === myPlate;

              if (isRoleMatch && isUserMatch) {
                  setNotifications(prev => {
                      if (prev.some(n => n.id === newNotif.id)) return prev;
                      return [newNotif, ...prev];
                  });
                  
                  showToast(newNotif.title, newNotif.message, newNotif.type);
                  sendPushNotification(currentUser.role, newNotif.title, newNotif.message);
              }
          }
          
          await fetchNotifications();
      })
      .subscribe((status) => {
          console.log("Realtime Subscription Status:", status);
      });

    return () => {
      supabase.removeChannel(tripsChannel);
      supabase.removeChannel(notifChannel);
    };
  }, []);

  const handleLogin = async (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('tls_session_user', JSON.stringify(loggedInUser));
    await requestNotificationPermission();
    
    if (loggedInUser.role === 'ADMIN') {
      setCurrentView(View.ADMIN_DASHBOARD);
    } else {
      setCurrentView(View.DASHBOARD);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('tls_session_user');
    setCurrentView(View.LOGIN);
    setSelectedTripId(null);
    
    // Limpiar notificaciones y detener alarmas
    activeAlarmsRef.current.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });
    activeAlarmsRef.current.clear();
    setToasts([]); 
  };

  const handleSelectTrip = (trip: Trip) => {
    setSelectedTripId(trip.id);
    setCurrentView(View.TRIP_DETAIL);
  };

  const handleBackToDashboard = () => {
    setSelectedTripId(null);
    setCurrentView(View.DASHBOARD);
  };

  const updateTrip = (updatedTrip: Trip) => {
    setTrips(prev => prev.map(t => t.id === updatedTrip.id ? updatedTrip : t));
  };

  const addTrip = (newTrip: Trip) => {
    setTrips(prev => {
        if (prev.some(t => t.id === newTrip.id)) return prev;
        return [newTrip, ...prev];
    });
  };

  const deleteTrip = async (tripId: string) => {
    const { error } = await supabase.from('viajes').delete().eq('id', tripId);
    if (error) {
      alert("Error al eliminar el registro.");
      return;
    }
    setTrips(prev => prev.filter(t => t.id !== tripId));
    if (selectedTripId === tripId) setSelectedTripId(null);
    playSound('notification');
  };

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from('notificaciones').update({ is_read: true }).eq('id', id);
  };

  const deleteNotification = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    await supabase.from('notificaciones').delete().eq('id', id);
  };

  const activeTrip = trips.find(t => t.id === selectedTripId);

  return (
    <div className="min-h-screen flex flex-col">
      {currentView !== View.LOGIN && (
        <Header 
          userName={user?.name} 
          role={user?.role} 
          onLogout={handleLogout}
          notifications={notifications}
          onMarkAsRead={markAsRead}
          onDeleteNotification={deleteNotification}
        />
      )}

      {/* Contenedor de Notificaciones (Stack) */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-3 w-full max-w-sm pointer-events-none">
        {toasts.map((toast) => (
            <div 
                key={toast.id} 
                className={`pointer-events-auto bg-white shadow-2xl rounded-2xl border-l-8 overflow-hidden animate-in slide-in-from-right-10 duration-500 flex items-start p-5 ${
                    toast.type === 'alert' ? 'border-red-500 animate-pulse' : toast.type === 'success' ? 'border-green-500' : 'border-blue-600'
                }`}
            >
                <div className={`mr-4 p-3 rounded-full shrink-0 ${
                    toast.type === 'alert' ? 'bg-red-100 text-red-600' : toast.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                }`}>
                    {toast.type === 'alert' ? <AlertCircle size={24} /> : toast.type === 'success' ? <CheckCircle size={24} /> : <Truck size={24} />}
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight mb-1">{toast.title}</h4>
                    <p className="text-slate-600 text-xs font-medium leading-relaxed">{toast.message}</p>
                </div>
                <button 
                    onClick={() => removeToast(toast.id)} 
                    className="ml-3 text-slate-300 hover:text-slate-500 transition-colors p-1"
                >
                    <X size={20} />
                </button>
            </div>
        ))}
      </div>

      <main className={`flex-grow bg-slate-50 transition-all duration-300 ${currentView !== View.LOGIN ? 'pt-[70px]' : ''}`}>
        {currentView === View.LOGIN && <Login onLogin={handleLogin} />}
        
        {currentView === View.DASHBOARD && (
          <Dashboard 
            trips={trips} 
            onSelectTrip={handleSelectTrip} 
            user={user} 
          />
        )}
        
        {currentView === View.TRIP_DETAIL && activeTrip && (
          <TripDetail 
            trip={activeTrip} 
            onBack={handleBackToDashboard}
            onUpdateTrip={updateTrip}
          />
        )}

        {currentView === View.ADMIN_DASHBOARD && (
          <AdminDashboard 
            trips={trips} 
            onUpdateTrip={updateTrip}
            onAddTrip={addTrip}
            onDeleteTrip={deleteTrip}
          />
        )}
      </main>
    </div>
  );
};

export default App;
