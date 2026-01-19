import React, { useState } from 'react';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { TripDetail } from './pages/TripDetail';
import { AdminDashboard } from './pages/AdminDashboard';
import { Header } from './Header';
import { User, Trip } from './types';
import { MOCK_TRIPS } from './constants';
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
  
  const [trips, setTrips] = useState<Trip[]>(MOCK_TRIPS);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  const handleLogin = async (loggedInUser: User) => {
    setUser(loggedInUser);
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

  const updateTrip = (updatedTrip: Trip) => {
    setTrips(prev => prev.map(t => t.id === updatedTrip.id ? updatedTrip : t));
  };

  const addTrip = (newTrip: Trip) => {
    setTrips(prev => [newTrip, ...prev]);
  };

  const activeTrip = trips.find(t => t.id === selectedTripId);

  return (
    <div className="min-h-screen flex flex-col">
      {currentView !== View.LOGIN && (
        <Header 
          userName={user?.name} 
          role={user?.role} 
          onLogout={handleLogout} 
        />
      )}

      {/* Main Content con padding reactivo para el fixed header */}
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
          />
        )}
      </main>
    </div>
  );
};

export default App;