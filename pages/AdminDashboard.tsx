import React, { useState, useEffect, useRef } from 'react';
import { TRIP_STAGES, MOCK_OPERATORS } from '../constants';
import { Trip, TripStatus, EvidenceStatus, Evidence } from '../types';
import { sendPushNotification, playSound } from '../utils';
import { Siren, Search, Filter, CheckCircle, Clock, MapPin, Truck, AlertTriangle, Plus, X, Users, Save, Eye, ChevronRight, FileText, Link, ThumbsUp, ThumbsDown, Camera, AlertCircle, Folder, Download, ZoomIn, Image as ImageIcon, Archive, Map, Fuel } from 'lucide-react';

interface AdminDashboardProps {
  trips: Trip[];
  onUpdateTrip: (trip: Trip) => void;
  onAddTrip: (trip: Trip) => void;
}

const REJECTION_REASONS = [
    "Foto borrosa / No visible",
    "Ángulo incorrecto",
    "Documento incompleto",
    "Unidad no visible",
    "Poca iluminación",
    "Ubicación no coincide"
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ trips, onUpdateTrip, onAddTrip }) => {
  const [activeTab, setActiveTab] = useState<'MONITOR' | 'CREATE'>('MONITOR');
  const [filterText, setFilterText] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [selectedTripForMonitor, setSelectedTripForMonitor] = useState<Trip | null>(null);
  const [showRejectionMenu, setShowRejectionMenu] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null); // For Zoom Modal
  
  // Track trips that have already triggered an automated delay alert to avoid loop
  const autoAlertsSent = useRef<Set<string>>(new Set());

  // Create Trip State
  const [newTrip, setNewTrip] = useState({
    client: '',
    project: '',
    destination: '',
    destinationMapsLink: '', 
    originMapsLink: '',      
    appointment: '',
    instructions: '',
    plate: '52-AK-8F', 
  });

  // Computed: Critical Alerts & Pending Evidence
  const criticalTrips = trips.filter(t => t.hasIncident || t.status === TripStatus.DELAYED || t.status === TripStatus.INCIDENT);
  const pendingEvidenceTrips = trips.filter(t => t.evidenceStatus === 'PENDING');

  // Effect: Play sound on incident
  useEffect(() => {
    if (criticalTrips.length > 0 && audioEnabled) {
      const audio = new Audio('https://codeskulptor-demos.commondatastorage.googleapis.com/GalaxyInvaders/pause.wav');
      const interval = setInterval(() => {
        audio.play().catch(() => {});
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [criticalTrips.length, audioEnabled]);

  // --- EFFECT: SERVER CRON JOB SIMULATION ---
  // Detects if a trip is > 10 mins late for the appointment and hasn't started loading
  useEffect(() => {
    const checkDelayCron = () => {
        trips.forEach(trip => {
            // Only check active trips that are not yet "loaded"
            if (trip.status === TripStatus.IN_TRANSIT && trip.currentStageIndex < 2) {
                 try {
                    const dateParts = trip.date.split('-');
                    const timeParts = trip.appointment.match(/(\d+):(\d+)\s*(AM|PM)?/i);

                    if (dateParts.length === 3 && timeParts) {
                        let hours = parseInt(timeParts[1], 10);
                        const minutes = parseInt(timeParts[2], 10);
                        const period = timeParts[3]?.toUpperCase();

                        if (period === 'PM' && hours < 12) hours += 12;
                        if (period === 'AM' && hours === 12) hours = 0;

                        const appointmentDate = new Date(
                            parseInt(dateParts[0]), 
                            parseInt(dateParts[1]) - 1, 
                            parseInt(dateParts[2]), 
                            hours, 
                            minutes
                        );

                        const now = new Date();
                        const diffMs = now.getTime() - appointmentDate.getTime(); // Positive if late
                        const lateMinutes = Math.floor(diffMs / 60000);

                        // If more than 10 minutes late AND we haven't flagged it yet
                        if (lateMinutes > 10 && !autoAlertsSent.current.has(trip.id)) {
                            console.log(`[CRON] Trip ${trip.code} is ${lateMinutes} mins late. Marking DELAYED.`);
                            
                            // 1. Mark as sent locally
                            autoAlertsSent.current.add(trip.id);
                            
                            // 2. Update Trip Status
                            onUpdateTrip({
                                ...trip,
                                status: TripStatus.DELAYED,
                                hasIncident: true // Mark as incident so it flashes red
                            });

                            // 3. Play Sound in Control Tower
                            playSound('alert');
                        }
                    }
                } catch (e) {
                    console.error("Cron Error", e);
                }
            }
        });
    };

    const interval = setInterval(checkDelayCron, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [trips, onUpdateTrip]);

  const handleApproveEvidence = (trip: Trip) => {
    // 1. Get GPS from the latest evidence being approved
    const currentEvidence = trip.evidence.filter(e => e.stageIndex === trip.currentStageIndex);
    const latestEvidence = currentEvidence[currentEvidence.length - 1];

    let updatedLocationHistory = [...(trip.locationHistory || [])];

    // 2. Add a definitive pin to the map if coordinates exist in the evidence
    if (latestEvidence && latestEvidence.lat && latestEvidence.lng) {
        updatedLocationHistory.push({
            id: `val-${Date.now()}`,
            lat: latestEvidence.lat,
            lng: latestEvidence.lng,
            timestamp: Date.now(),
            type: 'VALIDATION',
            label: `Validado: ${TRIP_STAGES[trip.currentStageIndex].label}`,
            isOutOfRange: false
        });
    }

    // 3. Update the trip state
    onUpdateTrip({ 
        ...trip, 
        evidenceStatus: 'APPROVED',
        rejectionReason: undefined,
        locationHistory: updatedLocationHistory
    });
    
    // 4. Notify Operator
    sendPushNotification('OPERATOR', '✅ Evidencia Aprobada', `Tu foto ha sido validada. Puedes continuar.`);
  };

  const handleRejectEvidence = (trip: Trip, reason: string) => {
    onUpdateTrip({ 
        ...trip, 
        evidenceStatus: 'REJECTED', 
        rejectionReason: reason 
    });
    setShowRejectionMenu(false);
    sendPushNotification('OPERATOR', '⚠️ Evidencia Rechazada', `Motivo: ${reason}. Toma la foto nuevamente.`);
  };

  const downloadImage = (evidence: Evidence) => {
      const link = document.createElement('a');
      link.href = evidence.url;
      link.download = evidence.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleDownloadAll = (trip: Trip) => {
      // Simulation of Zip Download
      alert(`Generando archivo comprimido para Viaje ${trip.code}...\n\nContenido: ${trip.evidence.length} archivos.\nEstructura: /viajes/${trip.id}/...`);
      // In a real app, we would use JSZip here to bundle blobs and trigger one download.
  };

  const handleCreateTrip = (e: React.FormEvent) => {
    e.preventDefault();
    
    const targets = newTrip.plate === 'ALL' 
        ? MOCK_OPERATORS.map(op => op.plate) 
        : [newTrip.plate];

    targets.forEach((plate, index) => {
        const tripId = Date.now().toString() + index; 
        const createdTrip: Trip = {
            id: tripId,
            code: `VIA-TLS-${Math.floor(Math.random() * 1000)}`,
            origin: 'CEDIS Tultitlán',
            originMapsLink: newTrip.originMapsLink,         
            destination: newTrip.destination,
            destinationMapsLink: newTrip.destinationMapsLink, 
            client: newTrip.client,
            project: newTrip.project,
            appointment: newTrip.appointment,
            instructions: newTrip.instructions,
            status: TripStatus.PENDING_ACCEPTANCE,
            date: new Date().toISOString().split('T')[0],
            cargoType: 'General',
            plate: plate,
            currentStageIndex: 0,
            hasIncident: false,
            evidence: [],
            evidenceStatus: 'NONE',
            locationHistory: []
        };
        onAddTrip(createdTrip);
    });
    
    const notificationTitle = "🚚 ¡NUEVO VIAJE ASIGNADO!";
    const notificationBody = `Tienes una nueva carga programada para el proyecto ${newTrip.project}. Toca aquí para revisar.`;
    
    sendPushNotification('OPERATOR', notificationTitle, notificationBody);
    
    alert(`Viaje(s) creado(s) y notificación enviada a: ${newTrip.plate === 'ALL' ? 'TODOS LOS OPERADORES' : newTrip.plate}`);
    
    setNewTrip({ 
      client: '', project: '', destination: '', destinationMapsLink: '', originMapsLink: '', 
      appointment: '', instructions: '', plate: '52-AK-8F' 
    });
    setActiveTab('MONITOR');
  };

  const filteredTrips = trips.filter(trip => 
    trip.client.toLowerCase().includes(filterText.toLowerCase()) ||
    trip.project.toLowerCase().includes(filterText.toLowerCase()) ||
    trip.code.toLowerCase().includes(filterText.toLowerCase()) ||
    trip.plate.toLowerCase().includes(filterText.toLowerCase())
  );

  const inputStyle = "w-full bg-gray-100 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white block p-3 transition-colors outline-none placeholder-gray-500";
  const labelStyle = "block text-sm font-bold text-gray-700 mb-1.5";

  // --- SUB-COMPONENT: Evidence Grid for a Stage ---
  const EvidenceGrid = ({ evidenceItems }: { evidenceItems: Evidence[] }) => (
      <div className="grid grid-cols-3 gap-2 mt-2">
          {evidenceItems.map(ev => (
              <div key={ev.id} className="relative group bg-gray-100 rounded-lg overflow-hidden border border-gray-200 aspect-square">
                  <img src={ev.url} alt={ev.fileName} className="w-full h-full object-cover" />
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                      <button 
                        onClick={() => setSelectedImage(ev.url)}
                        title="Ver Pantalla Completa"
                        className="p-1.5 bg-white rounded-full hover:bg-blue-100 text-blue-600"
                      >
                          <ZoomIn className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => downloadImage(ev)}
                        title="Descargar"
                        className="p-1.5 bg-white rounded-full hover:bg-green-100 text-green-600"
                      >
                          <Download className="h-4 w-4" />
                      </button>
                  </div>
              </div>
          ))}
      </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 p-4 lg:p-6 relative">
      
      {/* Top Navigation / Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="flex space-x-2">
              <button 
                onClick={() => setActiveTab('MONITOR')}
                className={`px-4 py-2 rounded-lg font-bold transition-colors ${activeTab === 'MONITOR' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                  Lista de Operarios
              </button>
              <button 
                onClick={() => setActiveTab('CREATE')}
                className={`px-4 py-2 rounded-lg font-bold transition-colors flex items-center ${activeTab === 'CREATE' ? 'bg-blue-700 text-white' : 'bg-white text-blue-700 hover:bg-blue-50'}`}
              >
                  <Plus className="h-4 w-4 mr-2" /> Alta de Viaje
              </button>
          </div>

          <div className="flex space-x-2">
              <div className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${pendingEvidenceTrips.length > 0 ? 'bg-yellow-100 text-yellow-700 border border-yellow-200 animate-pulse' : 'bg-gray-100 text-gray-400'}`}>
                   <Camera className="h-5 w-5" />
                   <span className="font-bold text-sm">{pendingEvidenceTrips.length} Revisiones</span>
              </div>
              <div className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${criticalTrips.length > 0 ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700'}`}>
                   {criticalTrips.length > 0 ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                   <span className="font-bold text-sm">{criticalTrips.length} Alertas</span>
              </div>
          </div>
      </div>

      {activeTab === 'CREATE' && (
          // ... (Same Create Form as before)
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 max-w-2xl mx-auto overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-blue-700 p-4 text-white flex justify-between items-center">
                  <h3 className="font-bold text-lg flex items-center"><Plus className="h-5 w-5 mr-2" /> Nuevo Viaje</h3>
                  <button onClick={() => setActiveTab('MONITOR')} className="hover:bg-blue-600 rounded p-1 transition-colors"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={handleCreateTrip} className="p-6 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                          <label className={labelStyle}>Cliente</label>
                          <input required type="text" className={inputStyle} placeholder="Ej. Ford Motor Co." 
                            value={newTrip.client} onChange={e => setNewTrip({...newTrip, client: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className={labelStyle}>Proyecto</label>
                          <input required type="text" className={inputStyle} placeholder="Ej. Just In Time" 
                            value={newTrip.project} onChange={e => setNewTrip({...newTrip, project: e.target.value})}
                          />
                      </div>
                      
                      {/* GPS Links Section */}
                      <div>
                          <label className={labelStyle}>Lugar de Carga (Link Maps)</label>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                            <input type="url" className={`${inputStyle} pl-10`} placeholder="https://maps.app.goo.gl/..." 
                              value={newTrip.originMapsLink} onChange={e => setNewTrip({...newTrip, originMapsLink: e.target.value})}
                            />
                          </div>
                      </div>
                      <div>
                          <label className={labelStyle}>Destino (Nombre)</label>
                          <input required type="text" className={inputStyle} placeholder="Ej. Planta Cuautitlán" 
                            value={newTrip.destination} onChange={e => setNewTrip({...newTrip, destination: e.target.value})}
                          />
                      </div>
                      <div className="md:col-span-2">
                          <label className={labelStyle}>Destino (Link Maps)</label>
                           <div className="relative">
                            <Link className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                            <input type="url" className={`${inputStyle} pl-10`} placeholder="https://maps.app.goo.gl/..." 
                                value={newTrip.destinationMapsLink} onChange={e => setNewTrip({...newTrip, destinationMapsLink: e.target.value})}
                            />
                          </div>
                      </div>

                      <div>
                          <label className={labelStyle}>Cita de Carga</label>
                          <input required type="time" className={inputStyle} 
                            value={newTrip.appointment} onChange={e => setNewTrip({...newTrip, appointment: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className={labelStyle}>Indicaciones</label>
                          <input className={inputStyle} placeholder="Puerta 4, EPP obligatorio..." 
                            value={newTrip.instructions} onChange={e => setNewTrip({...newTrip, instructions: e.target.value})}
                          />
                      </div>
                  </div>

                  <div className="pt-5 border-t border-gray-100">
                      <label className={labelStyle}>Asignación de Unidad</label>
                      <div className="flex flex-col sm:flex-row gap-3">
                          <select 
                            className={`${inputStyle} flex-grow`}
                            value={newTrip.plate} onChange={e => setNewTrip({...newTrip, plate: e.target.value})}
                          >
                              {MOCK_OPERATORS.map(op => (
                                  <option key={op.id} value={op.plate}>{op.plate} - {op.name} ({op.status})</option>
                              ))}
                          </select>
                          <button 
                            type="button" 
                            onClick={() => setNewTrip({...newTrip, plate: 'ALL'})}
                            className={`px-6 py-3 rounded-lg text-sm font-bold flex items-center justify-center transition-colors shadow-sm whitespace-nowrap
                                ${newTrip.plate === 'ALL' 
                                    ? 'bg-slate-800 text-white ring-2 ring-offset-2 ring-slate-800' 
                                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                          >
                              <Users className="h-4 w-4 mr-2" /> Asignación Masiva
                          </button>
                      </div>
                      {newTrip.plate === 'ALL' && (
                          <div className="mt-2 flex items-center text-xs text-blue-700 bg-blue-50 p-2 rounded border border-blue-100">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Se generará una orden individual para los {MOCK_OPERATORS.length} operadores registrados.
                          </div>
                      )}
                  </div>

                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-4 rounded-xl shadow-lg mt-2 flex justify-center items-center transition-transform active:scale-[0.99]">
                      <Save className="h-5 w-5 mr-2" />
                      CREAR ORDEN Y NOTIFICAR
                  </button>
              </form>
          </div>
      )}

      {activeTab === 'MONITOR' && (
          // ... (Same Monitor View)
          <>
            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col sm:flex-row gap-4 items-center">
                <div className="relative flex-grow w-full">
                    <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar por Operario, Placas, Cliente..." 
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={() => setAudioEnabled(!audioEnabled)}
                        className={`text-xs font-bold px-3 py-2 rounded-lg border ${audioEnabled ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                    >
                        Audio: {audioEnabled ? 'ON' : 'OFF'}
                    </button>
                </div>
            </div>

            {/* LIST VIEW OF OPERATORS */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidad</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estatus</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente / Destino</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Evidencia</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredTrips.map((trip) => (
                            <tr key={trip.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedTripForMonitor(trip)}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center">
                                            <Truck className="h-6 w-6 text-slate-600" />
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-bold text-gray-900">{trip.plate}</div>
                                            <div className="text-xs text-gray-500">{trip.code}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                                        ${trip.hasIncident ? 'bg-red-100 text-red-800 animate-pulse' : 
                                          trip.status === TripStatus.PENDING_ACCEPTANCE ? 'bg-amber-100 text-amber-800' :
                                          trip.status === TripStatus.COMPLETED ? 'bg-gray-100 text-gray-800' :
                                          'bg-green-100 text-green-800'}`}>
                                        {trip.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900 font-medium">{trip.client}</div>
                                    <div className="text-xs text-gray-500">{trip.destination}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                   {trip.evidenceStatus === 'PENDING' ? (
                                       <span className="flex items-center text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full animate-pulse border border-yellow-200">
                                           <Camera className="h-3 w-3 mr-1" /> REVISIÓN
                                       </span>
                                   ) : trip.evidenceStatus === 'REJECTED' ? (
                                        <span className="flex items-center text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full border border-red-200">
                                            <X className="h-3 w-3 mr-1" /> RECHAZADO
                                        </span>
                                   ) : (
                                       <span className="text-xs text-gray-400">---</span>
                                   )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={(e) => { e.stopPropagation(); setSelectedTripForMonitor(trip); }} className="text-blue-600 hover:text-blue-900 flex items-center justify-end">
                                        <Eye className="h-4 w-4 mr-1" /> Monitor
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </>
      )}

      {/* FULL SCREEN IMAGE ZOOM MODAL */}
      {selectedImage && (
          <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedImage(null)}>
              <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full">
                  <X className="h-8 w-8" />
              </button>
              <img src={selectedImage} className="max-w-full max-h-full object-contain rounded shadow-2xl" alt="Full screen" onClick={(e) => e.stopPropagation()} />
          </div>
      )}

      {/* DETAILED LIVE MONITOR MODAL */}
      {selectedTripForMonitor && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end transition-opacity duration-300">
            <div className="bg-white w-full max-w-lg h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300 flex flex-col">
                
                {/* Modal Header */}
                <div className="bg-slate-900 text-white p-6 sticky top-0 z-10 flex justify-between items-start shrink-0">
                    <div>
                        <h2 className="text-xl font-bold">{selectedTripForMonitor.plate}</h2>
                        <p className="text-slate-400 text-sm">{selectedTripForMonitor.code}</p>
                        <span className={`mt-2 inline-block px-2 py-0.5 rounded text-xs font-bold ${selectedTripForMonitor.status === TripStatus.INCIDENT ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'}`}>
                            {selectedTripForMonitor.status}
                        </span>
                    </div>
                    <button onClick={() => setSelectedTripForMonitor(null)} className="p-1 hover:bg-white/20 rounded">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    
                    {/* APPROVAL SECTION */}
                    {selectedTripForMonitor.evidenceStatus === 'PENDING' && (
                        <div className="mb-8 bg-yellow-50 border-2 border-yellow-400 rounded-xl p-4 shadow-lg">
                            <div className="flex items-center mb-3 text-yellow-800 font-black uppercase text-sm tracking-wide">
                                <AlertCircle className="h-5 w-5 mr-2" />
                                Validación Requerida: Paso {selectedTripForMonitor.currentStageIndex}
                            </div>
                            
                            {/* Get only the current stage evidence for quick review */}
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                {selectedTripForMonitor.evidence
                                    .filter(e => e.stageIndex === selectedTripForMonitor.currentStageIndex)
                                    .map(e => (
                                        <img key={e.id} src={e.url} className="w-full h-24 object-cover rounded border border-yellow-300 cursor-pointer" onClick={() => setSelectedImage(e.url)} alt="review" />
                                    ))
                                }
                            </div>
                            
                            {!showRejectionMenu ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => setShowRejectionMenu(true)} className="bg-white border-2 border-red-500 text-red-600 font-bold py-3 rounded-lg flex justify-center items-center hover:bg-red-50">
                                        <ThumbsDown className="h-5 w-5 mr-2" /> RECHAZAR
                                    </button>
                                    <button onClick={() => handleApproveEvidence(selectedTripForMonitor)} className="bg-green-600 text-white font-bold py-3 rounded-lg flex justify-center items-center hover:bg-green-700 shadow-md">
                                        <ThumbsUp className="h-5 w-5 mr-2" /> APROBAR
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                    <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Seleccione motivo de rechazo:</p>
                                    <div className="space-y-2">
                                        {REJECTION_REASONS.map(reason => (
                                            <button key={reason} onClick={() => handleRejectEvidence(selectedTripForMonitor, reason)} className="w-full text-left text-sm px-3 py-2 bg-red-50 text-red-700 rounded hover:bg-red-100 border border-red-100 transition-colors">
                                                {reason}
                                            </button>
                                        ))}
                                        <button onClick={() => setShowRejectionMenu(false)} className="w-full text-center text-xs text-gray-500 mt-2 underline">Cancelar</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                     {/* MAP VIEW SECTION (NEW) */}
                     <div className="mb-8">
                         <h3 className="font-bold text-gray-700 flex items-center mb-3">
                             <Map className="h-5 w-5 mr-2 text-blue-600" />
                             Ubicación en Tiempo Real
                         </h3>
                         <div className="w-full h-64 bg-gray-200 rounded-xl overflow-hidden border border-gray-300 shadow-inner relative">
                             {selectedTripForMonitor.locationHistory && selectedTripForMonitor.locationHistory.length > 0 ? (
                                 <iframe 
                                     width="100%" 
                                     height="100%" 
                                     frameBorder="0" 
                                     scrolling="no" 
                                     marginHeight={0} 
                                     marginWidth={0} 
                                     src={`https://maps.google.com/maps?q=${selectedTripForMonitor.locationHistory[selectedTripForMonitor.locationHistory.length - 1].lat},${selectedTripForMonitor.locationHistory[selectedTripForMonitor.locationHistory.length - 1].lng}&hl=es&z=14&output=embed`}
                                 >
                                 </iframe>
                             ) : (
                                 <div className="w-full h-full flex items-center justify-center text-gray-500 flex-col">
                                     <MapPin className="h-10 w-10 mb-2 opacity-50" />
                                     <p>Sin datos de GPS recientes</p>
                                 </div>
                             )}
                         </div>
                     </div>

                     {/* LOCATION HISTORY LOG (NEW) */}
                     <div className="mb-8 bg-slate-50 rounded-xl p-4 border border-slate-200">
                         <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Bitácora de Ruta (GPS)</h4>
                         <div className="space-y-3">
                             {(!selectedTripForMonitor.locationHistory || selectedTripForMonitor.locationHistory.length === 0) && (
                                 <p className="text-sm text-gray-400 italic">No hay registros de ubicación.</p>
                             )}
                             {selectedTripForMonitor.locationHistory && [...selectedTripForMonitor.locationHistory].reverse().map((loc) => (
                                 <div key={loc.id} className={`flex items-start space-x-3 p-2 rounded-lg ${loc.isOutOfRange ? 'bg-red-50 border border-red-100' : 'bg-white border border-gray-100'}`}>
                                     <div className={`mt-0.5 p-1.5 rounded-full text-white ${loc.type === 'GAS' ? 'bg-orange-500' : loc.isOutOfRange ? 'bg-red-500' : loc.type === 'VALIDATION' ? 'bg-green-600' : 'bg-blue-500'}`}>
                                         {loc.type === 'GAS' ? <Fuel className="h-3 w-3" /> : loc.type === 'VALIDATION' ? <CheckCircle className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                                     </div>
                                     <div className="flex-1">
                                         <p className="text-sm font-bold text-gray-800">{loc.label}</p>
                                         <p className="text-xs text-gray-500">
                                             {new Date(loc.timestamp).toLocaleTimeString()} • {new Date(loc.timestamp).toLocaleDateString()}
                                         </p>
                                         {loc.isOutOfRange && (
                                             <p className="text-xs font-bold text-red-600 mt-1 flex items-center">
                                                 <AlertTriangle className="h-3 w-3 mr-1" /> Fuera de rango ({Math.round(loc.distanceToTarget || 0)}m)
                                             </p>
                                         )}
                                     </div>
                                 </div>
                             ))}
                         </div>
                     </div>

                    {/* MEDIA ARCHIVE SECTION */}
                    <div className="mb-8">
                         <div className="flex items-center justify-between mb-4">
                             <h3 className="font-bold text-gray-700 flex items-center">
                                <Archive className="h-5 w-5 mr-2 text-blue-600" />
                                Archivo de Medios
                             </h3>
                             <button 
                                onClick={() => handleDownloadAll(selectedTripForMonitor)}
                                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center bg-blue-50 px-3 py-1.5 rounded-full"
                             >
                                 <Download className="h-3 w-3 mr-1" /> DESCARGAR TODO (.ZIP)
                             </button>
                         </div>
                         
                         {selectedTripForMonitor.evidence.length === 0 ? (
                             <div className="text-center p-6 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-400 text-sm">
                                 Sin evidencias cargadas.
                             </div>
                         ) : (
                             <div className="space-y-4">
                                 {TRIP_STAGES.map((stage, idx) => {
                                     const stageEvidence = selectedTripForMonitor.evidence.filter(e => e.stageIndex === idx);
                                     if (stageEvidence.length === 0) return null;

                                     return (
                                         <div key={stage.key} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
                                             <div className="flex items-center text-xs font-bold text-gray-500 mb-2 uppercase border-b pb-2">
                                                 <Folder className="h-4 w-4 mr-2 text-amber-500" />
                                                 {stage.label} ({stageEvidence.length})
                                             </div>
                                             <EvidenceGrid evidenceItems={stageEvidence} />
                                         </div>
                                     );
                                 })}
                             </div>
                         )}
                    </div>

                    <h3 className="font-bold text-gray-700 mb-4 flex items-center">
                        <Clock className="h-5 w-5 mr-2 text-blue-600" />
                        Línea de Tiempo
                    </h3>
                    
                    <div className="space-y-0 relative">
                        {/* Connecting Line */}
                        <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gray-200 z-0"></div>

                        {TRIP_STAGES.map((stage, idx) => {
                             const isCompleted = idx < selectedTripForMonitor.currentStageIndex;
                             const isCurrent = idx === selectedTripForMonitor.currentStageIndex;

                             return (
                                 <div key={stage.key} className="relative z-10 flex items-start mb-6 last:mb-0">
                                     <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 shrink-0 transition-colors duration-500
                                        ${isCompleted ? 'bg-gray-100 border-gray-300 text-gray-400' : 
                                          isCurrent ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-110' : 
                                          'bg-white border-gray-200 text-gray-300'}`}>
                                         {isCompleted ? <CheckCircle className="h-6 w-6" /> : <span className="font-bold">{idx + 1}</span>}
                                     </div>
                                     <div className="ml-4 pt-2">
                                         <p className={`font-bold text-lg leading-none ${isCompleted ? 'text-gray-400 line-through' : isCurrent ? 'text-blue-700' : 'text-gray-300'}`}>
                                             {stage.label}
                                         </p>
                                         {isCurrent && selectedTripForMonitor.evidenceStatus === 'REJECTED' && (
                                            <span className="block mt-1 text-xs font-bold text-red-600">
                                                ⚠ RECHAZADO: {selectedTripForMonitor.rejectionReason}
                                            </span>
                                         )}
                                     </div>
                                 </div>
                             );
                        })}
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};