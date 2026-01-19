import React, { useState, useRef, useEffect } from 'react';
import { Trip, TripStatus, EvidenceStatus, Evidence, LocationReport } from '../types';
import { TRIP_STAGES } from '../constants';
import { supabase } from '../supabaseClient';
import { sendPushNotification, playSound, processWatermark, getCurrentLocation, calculateDistance } from '../utils';
import { ArrowLeft, Check, Lock, BellRing, MapPin, CalendarClock, AlertTriangle, Navigation, Camera, Loader, XCircle, Image as ImageIcon, Map, Fuel, Clock } from 'lucide-react';

interface TripDetailProps {
  trip: Trip;
  onBack: () => void;
  onUpdateTrip: (trip: Trip) => void;
}

const STAGE_STYLES = [
    { bg: 'bg-blue-600', border: 'border-blue-800', text: 'text-white', futureText: 'text-blue-600', futureBorder: 'border-blue-200' },
    { bg: 'bg-yellow-400', border: 'border-yellow-600', text: 'text-black', futureText: 'text-yellow-600', futureBorder: 'border-yellow-200' },
    { bg: 'bg-orange-500', border: 'border-orange-700', text: 'text-white', futureText: 'text-orange-500', futureBorder: 'border-orange-200' },
    { bg: 'bg-purple-600', border: 'border-purple-800', text: 'text-white', futureText: 'text-purple-600', futureBorder: 'border-purple-200' },
    { bg: 'bg-cyan-500', border: 'border-cyan-700', text: 'text-white', futureText: 'text-cyan-600', futureBorder: 'border-cyan-200' },
    { bg: 'bg-emerald-600', border: 'border-emerald-800', text: 'text-white', futureText: 'text-emerald-600', futureBorder: 'border-emerald-200' }
];

export const TripDetail: React.FC<TripDetailProps> = ({ trip, onBack, onUpdateTrip }) => {
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [activeUploads, setActiveUploads] = useState<{[key: string]: number}>({});
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [showLocationMenu, setShowLocationMenu] = useState(false);
  const [showUrgentModal, setShowUrgentModal] = useState(false);
  
  const [timeStatus, setTimeStatus] = useState<'ON_TIME' | 'WARNING' | 'URGENT' | 'LATE'>('ON_TIME');
  const alertSentRef = useRef<{ [key: string]: boolean }>({}); 

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stagePendingPhoto, setStagePendingPhoto] = useState<number | null>(null);

  // --- EFFECT: Sincronización Real-time con Supabase ---
  useEffect(() => {
    const channel = supabase
      .channel(`trip-${trip.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'viajes', filter: `id=eq.${trip.id}` }, (payload) => {
        onUpdateTrip(payload.new as Trip);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [trip.id, onUpdateTrip]);

  // --- EFFECT: Reloj Inteligente ---
  useEffect(() => {
    if (trip.currentStageIndex > 1 || trip.status === TripStatus.COMPLETED) {
        setTimeStatus('ON_TIME');
        return;
    }

    const checkTime = () => {
        try {
            const dateParts = trip.date.split('-');
            const timeParts = trip.appointment.match(/(\d+):(\d+)\s*(AM|PM)?/i);

            if (dateParts.length === 3 && timeParts) {
                let hours = parseInt(timeParts[1], 10);
                const minutes = parseInt(timeParts[2], 10);
                const period = timeParts[3]?.toUpperCase();
                if (period === 'PM' && hours < 12) hours += 12;
                if (period === 'AM' && hours === 12) hours = 0;

                const appointmentDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]), hours, minutes);
                const now = new Date();
                const diffMs = appointmentDate.getTime() - now.getTime();
                const diffMinutes = Math.floor(diffMs / 60000);

                if (diffMinutes < 0) {
                    setTimeStatus('LATE');
                    if (!alertSentRef.current['LATE']) {
                        playSound('alert');
                        alertSentRef.current['LATE'] = true;
                    }
                } else if (diffMinutes <= 15) {
                    setTimeStatus('URGENT');
                    if (!alertSentRef.current['URGENT']) {
                        setShowUrgentModal(true);
                        playSound('alert');
                        alertSentRef.current['URGENT'] = true;
                    }
                } else if (diffMinutes <= 60) {
                    setTimeStatus('WARNING');
                } else {
                    setTimeStatus('ON_TIME');
                }
            }
        } catch (e) { console.error("Error reloj", e); }
    };

    const interval = setInterval(checkTime, 30000);
    checkTime();
    return () => clearInterval(interval);
  }, [trip, trip.currentStageIndex, trip.date, trip.appointment]);

  const triggerCamera = (index: number) => {
    if (trip.evidenceStatus === 'PENDING') return;
    setStagePendingPhoto(index);
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handlePhotoCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0 && stagePendingPhoto !== null) {
        setIsProcessingImages(true);
        const filesArray = Array.from(files) as File[];
        const location = await getCurrentLocation();
        const newEvidenceItems: Evidence[] = [];

        for (const file of filesArray) {
            const watermarkedUrl = await processWatermark(file, trip.code, trip.plate);
            const fileNameClean = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            
            const evidenceItem: Evidence = {
                id: Math.random().toString(36).substr(2, 9),
                tripId: trip.id,
                stageIndex: stagePendingPhoto,
                url: watermarkedUrl,
                fileName: fileNameClean,
                path: `viajes/${trip.id}/${TRIP_STAGES[stagePendingPhoto].key}/${fileNameClean}`,
                timestamp: Date.now(),
                lat: location?.lat,
                lng: location?.lng
            };

            // Sincronizar con Supabase
            await supabase.from('evidencias_geoselladas').insert({
                trip_id: trip.id,
                stage_index: stagePendingPhoto,
                url: watermarkedUrl,
                lat: location?.lat,
                lng: location?.lng,
                timestamp: Date.now()
            });

            newEvidenceItems.push(evidenceItem);
        }

        setIsProcessingImages(false);
        finalizeBatchUpload(newEvidenceItems);
    }
  };

  const finalizeBatchUpload = async (newItems: Evidence[]) => {
      if (stagePendingPhoto === null) return;
      const updatedTrip = { 
          ...trip, 
          evidence: [...trip.evidence, ...newItems],
          evidenceStatus: 'PENDING' as EvidenceStatus,
          status: stagePendingPhoto === 0 ? TripStatus.IN_TRANSIT : trip.status
      };

      // Actualizar estado del viaje en Supabase
      await supabase.from('viajes').update({ 
          evidence_status: 'PENDING',
          status: updatedTrip.status 
      }).eq('id', trip.id);

      onUpdateTrip(updatedTrip);
      setStagePendingPhoto(null);
  };

  const handleSendLocation = async (type: 'CHECKIN' | 'GAS') => {
      setShowLocationMenu(false);
      setIsCheckingIn(true);
      const coords = await getCurrentLocation();
      if (!coords) {
          alert("GPS no disponible");
          setIsCheckingIn(false);
          return;
      }

      const report: LocationReport = {
          id: Date.now().toString(),
          lat: coords.lat,
          lng: coords.lng,
          timestamp: Date.now(),
          type: type,
          label: type === 'GAS' ? 'Carga Combustible' : `Check-in: ${TRIP_STAGES[trip.currentStageIndex].label}`
      };

      // Guardar en Supabase
      await supabase.from('historial_ubicaciones').insert({
          trip_id: trip.id,
          lat: coords.lat,
          lng: coords.lng,
          type: type,
          label: report.label,
          timestamp: Date.now()
      });

      onUpdateTrip({
          ...trip,
          locationHistory: [...(trip.locationHistory || []), report]
      });
      
      setIsCheckingIn(false);
      playSound('success');
      if (showUrgentModal) setShowUrgentModal(false);
  };

  const handleAcceptTrip = async () => {
    const updatedTrip = { ...trip, status: TripStatus.ACCEPTED };
    await supabase.from('viajes').update({ status: TripStatus.ACCEPTED }).eq('id', trip.id);
    onUpdateTrip(updatedTrip);
  };

  const handleIncidence = async () => {
    setIsEmergencyActive(true);
    const updatedTrip = { ...trip, status: TripStatus.INCIDENT, hasIncident: true };
    await supabase.from('viajes').update({ status: TripStatus.INCIDENT, has_incident: true }).eq('id', trip.id);
    onUpdateTrip(updatedTrip);
    setTimeout(() => setIsEmergencyActive(false), 3000);
  };

  const getClockStyles = () => {
      switch(timeStatus) {
          case 'LATE': return 'text-red-600 animate-pulse scale-110';
          case 'URGENT': return 'text-orange-600 scale-105';
          case 'WARNING': return 'text-yellow-600';
          default: return 'text-blue-700';
      }
  };

  if (trip.status === TripStatus.PENDING_ACCEPTANCE) {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col p-4">
            <div className="bg-amber-400 p-6 rounded-2xl mb-6 shadow-md border-b-4 border-amber-600 text-center">
                <BellRing className="h-16 w-16 text-black mx-auto mb-2" />
                <h1 className="text-3xl font-black text-black uppercase tracking-tight">Nuevo Viaje</h1>
                <p className="text-xl font-bold text-amber-900">Confirma recepción</p>
            </div>
            <div className="flex-1 space-y-4">
                <div className="bg-white p-6 rounded-2xl border-2 border-gray-300 shadow-sm space-y-4">
                    <div className="flex justify-center mb-4">
                        <img src="https://tritex.com.mx/tlslogo.png" alt="TLS" className="h-10" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-bold uppercase mb-1">Carga</p>
                        <p className="text-xl font-bold text-gray-800">{trip.origin}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-bold uppercase mb-1">Destino</p>
                        <p className="text-xl font-bold text-gray-800">{trip.destination}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-bold uppercase mb-1">Cita</p>
                        <p className="text-3xl font-black text-blue-700">{trip.appointment}</p>
                    </div>
                </div>
            </div>
            <button onClick={handleAcceptTrip} className="w-full bg-slate-800 text-white font-black text-2xl py-8 rounded-2xl shadow-xl border-b-8 border-slate-900 active:translate-y-2 mt-6 mb-4">
                CONFIRMAR
            </button>
        </div>
    );
  }

  return (
    <div className={`flex flex-col min-h-screen ${isEmergencyActive ? 'bg-red-50' : 'bg-slate-50'}`}>
      <input type="file" accept="image/*" capture="environment" multiple ref={fileInputRef} onChange={handlePhotoCapture} className="hidden" />
      
      {showUrgentModal && (
          <div className="fixed inset-0 bg-red-600/90 z-50 flex flex-col items-center justify-center p-6 text-white text-center">
              <Clock className="h-24 w-24 mb-4 animate-bounce" />
              <h1 className="text-4xl font-black mb-4 uppercase">Cita Próxima</h1>
              <p className="text-xl mb-8">Menos de 15 minutos. Reporta tu ubicación ahora.</p>
              <button onClick={() => handleSendLocation('CHECKIN')} className="bg-white text-red-700 font-black text-2xl py-6 px-12 rounded-2xl shadow-xl w-full">
                  REPORTAR AQUÍ
              </button>
          </div>
      )}

      <div className="bg-white p-4 shadow-sm border-b-2 border-gray-200 sticky top-0 z-30">
        <div className="flex items-center justify-between mb-4">
            <button onClick={onBack} className="p-2 bg-gray-100 rounded-lg"><ArrowLeft className="h-6 w-6 text-black" /></button>
            <img src="https://tritex.com.mx/tlslogo.png" alt="TLS" className="h-6" />
            <div className="text-right">
                <p className="text-sm text-gray-500">Unidad</p>
                <p className="text-lg font-black text-gray-800">{trip.plate}</p>
            </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-2 flex justify-between items-center border border-gray-200">
            <div>
                 <p className="text-xs text-gray-500 font-bold uppercase">Cita Programada</p>
                 <p className={`text-4xl font-black transition-all ${getClockStyles()}`}>{trip.appointment}</p>
            </div>
             {timeStatus === 'LATE' && <div className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded animate-pulse">ATRASADO</div>}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-2">
            <button onClick={() => window.open(trip.originMaps_link, '_blank')} className="bg-blue-600 text-white p-3 rounded-xl shadow border-b-4 border-blue-800 flex flex-col items-center">
                <Navigation className="h-6 w-6 mb-1" />
                <span className="font-bold text-xs uppercase">Ruta Carga</span>
            </button>
            <button onClick={() => window.open(trip.destinationMaps_link, '_blank')} className="bg-green-600 text-white p-3 rounded-xl shadow border-b-4 border-green-800 flex flex-col items-center">
                <MapPin className="h-6 w-6 mb-1" />
                <span className="font-bold text-xs uppercase">Ruta Destino</span>
            </button>
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col max-w-lg mx-auto w-full pb-20">
        <div className="flex-1 space-y-6"> 
            {TRIP_STAGES.map((stage, index) => {
                const isCompleted = index < trip.currentStageIndex;
                const isCurrent = index === trip.currentStageIndex;
                const style = STAGE_STYLES[index];
                
                return (
                    <button
                        key={stage.key}
                        onClick={() => { if (isCurrent && trip.evidenceStatus !== 'PENDING') triggerCamera(index); }}
                        disabled={isCompleted || index > trip.currentStageIndex || trip.evidenceStatus === 'PENDING'}
                        className={`w-full min-h-[70px] px-4 py-3 rounded-2xl flex items-center justify-between transition-all border-b-8
                            ${isCompleted ? 'bg-gray-200 border-gray-300 text-gray-400' : 
                              isCurrent ? `${style.bg} ${style.text} ${style.border} shadow-lg scale-[1.02]` : 
                              'bg-white border-gray-100 text-gray-300'}`}
                    >
                        <div className="flex items-center space-x-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 font-bold ${isCurrent ? 'bg-white/20' : ''}`}>
                                {isCompleted ? <Check className="h-6 w-6" /> : <span>{index + 1}</span>}
                            </div>
                            <span className="text-lg font-black uppercase text-left leading-tight">{stage.label}</span>
                        </div>
                        {isCurrent && trip.evidenceStatus === 'PENDING' ? <Loader className="h-6 w-6 animate-spin" /> : isCurrent && <Camera className="h-6 w-6" />}
                    </button>
                );
            })}
        </div>

        <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end">
            {showLocationMenu && (
                <div className="bg-white rounded-xl shadow-xl p-2 mb-2 flex flex-col space-y-1 w-48 border border-gray-200">
                    <button onClick={() => handleSendLocation('CHECKIN')} className="flex items-center px-4 py-3 hover:bg-gray-50 text-gray-700 font-bold"><MapPin className="h-5 w-5 mr-2 text-blue-600" /> Reportar Ruta</button>
                    <button onClick={() => handleSendLocation('GAS')} className="flex items-center px-4 py-3 hover:bg-gray-50 text-gray-700 font-bold border-t"><Fuel className="h-5 w-5 mr-2 text-orange-500" /> Gasolina</button>
                </div>
            )}
            <button onClick={() => setShowLocationMenu(!showLocationMenu)} className="bg-blue-600 text-white p-4 rounded-full shadow-2xl border-4 border-white"><Map className="h-8 w-8" /></button>
        </div>

        <button onClick={handleIncidence} className="mt-12 bg-red-100 text-red-800 border-2 border-red-300 rounded-2xl p-4 font-black flex items-center justify-center space-x-2">
            <AlertTriangle className="h-6 w-6" />
            <span>REPORTAR INCIDENCIA</span>
        </button>
      </div>
    </div>
  );
};