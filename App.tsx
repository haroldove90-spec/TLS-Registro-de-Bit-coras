import React, { useState } from 'react';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { TripDetail } from './pages/TripDetail';
import { AdminDashboard } from './pages/AdminDashboard';
import { User, Trip } from './types';
import { MOCK_TRIPS } from './constants'; // Initial state
import { Truck, LogOut, Shield } from 'lucide-react';
import { requestNotificationPermission } from './utils';

enum View {
  LOGIN,
  DASHBOARD,
  TRIP_DETAIL,
  ADMIN_DASHBOARD
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.LOGIN);
  const [user, setUser] = useState<User | null>(null);
  
  // "Database" State lifted here to simulate Real-Time Firestore
  const [trips, setTrips] = useState<Trip[]>(MOCK_TRIPS);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  const handleLogin = async (loggedInUser: User) => {
    setUser(loggedInUser);
    
    // Request Notification Permission immediately upon login
    await requestNotificationPermission();

    if (loggedInUser.role === 'ADMIN') {
      setCurrentView(View.ADMIN_DASHBOARD);
    } else {
      setCurrentView(View.DASHBOARD);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentView(View.LOGIN);
    setSelectedTripId(null);
  };

  const handleSelectTrip = (trip: Trip) => {
    setSelectedTripId(trip.id);
    setCurrentView(View.TRIP_DETAIL);
  };

  const handleBackToDashboard = () => {
    setSelectedTripId(null);
    setCurrentView(View.DASHBOARD);
  };

  // Function to update a trip (Simulating Firestore .update())
  const updateTrip = (updatedTrip: Trip) => {
    setTrips(prev => prev.map(t => t.id === updatedTrip.id ? updatedTrip : t));
  };

  // Function to add a trip (Simulating Firestore .add())
  const addTrip = (newTrip: Trip) => {
    setTrips(prev => [newTrip, ...prev]);
  };

  // Get the full object for the selected trip
  const activeTrip = trips.find(t => t.id === selectedTripId);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header - Visible only when logged in */}
      {currentView !== View.LOGIN && (
        <header className={`${user?.role === 'ADMIN' ? 'bg-slate-900' : 'bg-blue-900'} text-white py-2 px-4 sticky top-0 z-50 shadow-md`}>
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <img 
                src="https://tritex.com.mx/tlslogo.png" 
                alt="TBS Logo" 
                className="h-[60px] w-auto object-contain"
              />
              <div className="h-10 w-px bg-white/20 mx-1 hidden xs:block"></div>
              <span className="font-semibold text-[22px] tracking-tight hidden xs:block opacity-100">
                Registro de Bitácoras
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`text-xs font-medium ${user?.role === 'ADMIN' ? 'text-slate-300' : 'text-blue-200'} hidden sm:inline`}>
                {user?.name}
              </span>
              <button 
                onClick={handleLogout}
                className="p-2 hover:bg-white/10 rounded-full transition-colors bg-white/5"
                aria-label="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="flex-grow bg-slate-50">
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
          />
        )}
      </main>
    </div>
  );
};

export default App;