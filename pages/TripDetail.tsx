import React, { useState, useRef, useEffect } from 'react';
import { Trip, TripStatus, EvidenceStatus, Evidence, LocationReport } from '../types';
import { TRIP_STAGES } from '../constants';
import { supabase, checkStorageBucket } from '../supabaseClient';
import { sendPushNotification, playSound, processWatermark, getCurrentLocation } from '../utils';
import { ArrowLeft, Check, BellRing, MapPin, AlertTriangle, Navigation, Camera, Loader, Fuel, Clock, RotateCcw, ShieldAlert, RefreshCw } from 'lucide-react';

interface TripDetailProps {
  trip: Trip;
  onBack: () => void;
  onUpdateTrip: (trip: Trip) => void;
}

const STAGE_STYLES = [
    { bg: 'bg-blue-600', border: 'border-blue-800', text: 'text-white' },
    { bg: 'bg-yellow-400', border: 'border-yellow-600', text: 'text-black' },
    { bg: 'bg-orange-500', border: 'border-orange-700', text: 'text-white' },
    { bg: 'bg-purple-600', border: 'border-purple-800', text: 'text-white' },
    { bg: 'bg-cyan-500', border: 'border-cyan-700', text: 'text-white' },
    { bg: 'bg-emerald-600', border: 'border-emerald-800', text: 'text-white' }
];

export const TripDetail: React.FC<TripDetailProps> = ({ trip, onBack, onUpdateTrip }) => {
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [showLocationMenu, setShowLocationMenu] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [cameraTimeout, setCameraTimeout] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stagePendingPhoto, setStagePendingPhoto] = useState<number | null>(null);
  const cameraTimerRef = useRef<number | null>(null);

  const verifyConnection = async () => {
    setConnectionError(null);
    const ok = await checkStorageBucket();
    if (!ok) {
      setConnectionError("⚠️ ERROR DE FIRMA: No se pudo validar la conexión con Supabase. Verifique su API Key.");
    }
  };

  useEffect(() => {
    verifyConnection();
  }, []);

  const triggerCamera = (index: number) => {
    if (trip.evidenceStatus === 'PENDING') return;
    setStagePendingPhoto(index);
    setCameraTimeout(false);

    if (fileInputRef.current) {
      fileInputRef.current.click();
      if (cameraTimerRef.current) clearTimeout(cameraTimerRef.current);
      cameraTimerRef.current = window.setTimeout(() => {
        if (stagePendingPhoto !== null && !isProcessingImages) setCameraTimeout(true);
      }, 8000);
    }
  };

  const handlePhotoCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0 && stagePendingPhoto !== null) {
        if (cameraTimerRef.current) clearTimeout(cameraTimerRef.current);
        setCameraTimeout(false);
        setIsProcessingImages(true);
        setConnectionError(null);

        try {
          const file = files[0];
          const location = await getCurrentLocation();
          const watermarkedUrl = await processWatermark(file, trip.code, trip.plate);
          
          const stageKey = TRIP_STAGES[stagePendingPhoto].key;
          const fileName = `${trip.id}_${stageKey}_${Date.now()}.jpg`;
          const filePath = `${trip.id}/${stageKey}/${fileName}`;

          const res = await fetch(watermarkedUrl);
          const blob = await res.blob();

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('evidencias')
            .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from('evidencias')
            .getPublicUrl(filePath);

          const finalUrl = urlData.publicUrl;

          const { error: dbError } = await supabase.from('evidencias_geoselladas').insert({
              trip_id: trip.id,
              stage_index: stagePendingPhoto,
              url: finalUrl,
              lat: location?.lat,
              lng: location?.lng,
              timestamp: Date.now()
          });

          if (dbError) throw dbError;

          const newEvidence: Evidence = {
              id: Math.random().toString(36).substr(2, 9),
              tripId: trip.id,
              stageIndex: stagePendingPhoto,
              url: finalUrl,
              fileName: fileName,
              path: filePath,
              timestamp: Date.now(),
              lat: location?.lat,
              lng: location?.lng
          };

          finalizeUpload(newEvidence);
        } catch (err: any) {
          console.error("Error al procesar evidencia:", err);
          setConnectionError(`⚠️ Error al subir (Firma): ${err.message || 'Error de servidor'}`);
        } finally {
          setIsProcessingImages(false);
        }
    }
  };

  const finalizeUpload = async (newItem: Evidence) => {
      if (stagePendingPhoto === null) return;
      
      const nextStageIndex = trip.currentStageIndex + 1;
      const isEndTrip = stagePendingPhoto === TRIP_STAGES.length - 1;
      
      const updatedTrip = { 
          ...trip, 
          evidence: [...trip.evidence, newItem],
          evidenceStatus: 'PENDING' as EvidenceStatus,
          currentStageIndex: isEndTrip ? trip.currentStageIndex : nextStageIndex,
          status: isEndTrip ? TripStatus.COMPLETED : trip.status
      };

      onUpdateTrip(updatedTrip);
      setStagePendingPhoto(null);
      playSound('success');
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
          label: type === 'GAS' ? 'Carga Combustible' : `Ubicación: ${TRIP_STAGES[trip.currentStageIndex].label}`
      };

      onUpdateTrip({
          ...trip,
          locationHistory: [...(trip.locationHistory || []), report]
      });
      
      setIsCheckingIn(false);
      playSound('success');
  };

  if (trip.status === TripStatus.PENDING_ACCEPTANCE) {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col p-4 pt-10">
            <div className="bg-amber-400 p-8 rounded-2xl mb-6 shadow-lg border-b-8 border-amber-600 text-center animate-in zoom-in-95">
                <BellRing className="h-16 w-16 text-black mx-auto mb-4 animate-bounce" />
                <h1 className="text-3xl font-black text-black uppercase tracking-tight">Nuevo Viaje</h1>
                <p className="text-xl font-bold text-amber-900">Confirma recepción</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border-2 border-gray-200 shadow-sm space-y-4 flex-1">
                <div className="flex justify-center mb-6">
                    <img src="https://tritex.com.mx/tlslogo.png" alt="TLS" className="h-12" />
                </div>
                <div><p className="text-xs text-gray-400 font-bold uppercase">Carga</p><p className="text-xl font-bold">{trip.origin}</p></div>
                <div><p className="text-xs text-gray-400 font-bold uppercase">Destino</p><p className="text-xl font-bold">{trip.destination}</p></div>
                <div className="pt-4 border-t"><p className="text-xs text-gray-400 font-bold uppercase">Cita de Carga</p><p className="text-4xl font-black text-blue-700">{trip.appointment}</p></div>
            </div>
            <button onClick={() => onUpdateTrip({...trip, status: TripStatus.ACCEPTED})} className="w-full bg-slate-800 text-white font-black text-2xl py-8 rounded-2xl shadow-xl border-b-8 border-slate-900 active:translate-y-2 mt-6 mb-4 transition-transform">
                ACEPTAR VIAJE
            </button>
        </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handlePhotoCapture} className="hidden" />
      
      {connectionError && (
        <div className="fixed top-20 left-4 right-4 z-[1001] bg-red-600 text-white p-5 rounded-2xl shadow-2xl animate-in slide-in-from-top-4">
          <div className="flex items-start space-x-3 mb-4">
            <ShieldAlert className="h-8 w-8 shrink-0" />
            <div className="flex-1">
                <p className="font-black text-sm leading-tight mb-1">FALLO DE CONEXIÓN</p>
                <p className="text-xs opacity-90">{connectionError}</p>
            </div>
          </div>
          <button 
            onClick={verifyConnection} 
            className="w-full bg-white text-red-600 font-black py-3 rounded-xl flex items-center justify-center space-x-2 active:scale-95 transition-transform shadow-lg"
          >
            <RefreshCw className="h-5 w-5" />
            <span>REINTENTAR CONEXIÓN</span>
          </button>
        </div>
      )}

      <div className="bg-white p-4 shadow-sm border-b-2 border-gray-200">
        <div className="flex items-center justify-between mb-4">
            <button onClick={onBack} className="p-2 bg-gray-100 rounded-lg active:scale-90"><ArrowLeft className="h-6 w-6 text-black" /></button>
            <div className="text-right">
                <p className="text-xs text-gray-400 font-bold uppercase">Unidad</p>
                <p className="text-lg font-black text-slate-800 leading-none">{trip.plate}</p>
            </div>
        </div>

        <div className="bg-blue-50 rounded-xl p-4 flex justify-between items-center border border-blue-100 mb-4">
            <div>
                 <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">Cita de Carga</p>
                 <p className="text-3xl font-black text-blue-800">{trip.appointment}</p>
            </div>
            {trip.status === TripStatus.DELAYED && <div className="px-3 py-1 bg-red-600 text-white text-[10px] font-black rounded-full animate-pulse shadow-md">ATRASADO</div>}
        </div>

        <div className="grid grid-cols-2 gap-3">
            <button onClick={() => window.open(trip.originMapsLink, '_blank')} className="bg-blue-600 text-white p-3 rounded-xl shadow-lg border-b-4 border-blue-800 active:translate-y-1 flex flex-col items-center">
                <Navigation className="h-5 w-5 mb-1" />
                <span className="font-black text-[10px] uppercase">Ruta Carga</span>
            </button>
            <button onClick={() => window.open(trip.destinationMapsLink, '_blank')} className="bg-emerald-600 text-white p-3 rounded-xl shadow-lg border-b-4 border-emerald-800 active:translate-y-1 flex flex-col items-center">
                <MapPin className="h-5 w-5 mb-1" />
                <span className="font-black text-[10px] uppercase">Ruta Destino</span>
            </button>
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col max-w-lg mx-auto w-full pb-24">
        <div className="flex-1 space-y-4"> 
            {TRIP_STAGES.map((stage, index) => {
                const isCompleted = index < trip.currentStageIndex;
                const isCurrent = index === trip.currentStageIndex;
                const style = STAGE_STYLES[index];
                
                return (
                    <div key={stage.key} className="relative">
                        <button
                            onClick={() => { if (isCurrent) triggerCamera(index); }}
                            disabled={isCompleted || index > trip.currentStageIndex || trip.evidenceStatus === 'PENDING'}
                            className={`w-full min-h-[75px] px-5 py-4 rounded-2xl flex items-center justify-between transition-all border-b-8
                                ${isCompleted ? 'bg-gray-100 border-gray-200 text-gray-400 scale-[0.98]' : 
                                  isCurrent ? `${style.bg} ${style.text} ${style.border} shadow-xl scale-[1.02] ring-4 ring-white` : 
                                  'bg-white border-gray-200 text-gray-300 opacity-60'}`}
                        >
                            <div className="flex items-center space-x-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 font-black ${isCurrent ? 'bg-white/20 border-white' : 'border-current'}`}>
                                    {isCompleted ? <Check className="h-6 w-6" /> : <span>{index + 1}</span>}
                                </div>
                                <span className="text-lg font-black uppercase text-left leading-none tracking-tight">{stage.label}</span>
                            </div>
                            {isCurrent && isProcessingImages ? (
                              <Loader className="h-6 w-6 animate-spin" />
                            ) : isCurrent ? (
                              <Camera className="h-7 w-7 animate-pulse" />
                            ) : isCompleted ? (
                              <Check className="h-6 w-6 opacity-40" />
                            ) : null}
                        </button>
                        
                        {isCurrent && cameraTimeout && !isProcessingImages && (
                          <button 
                            onClick={() => triggerCamera(index)}
                            className="absolute -top-2 -right-2 bg-slate-800 text-white p-2 rounded-full shadow-lg border-2 border-white animate-bounce flex items-center space-x-1"
                          >
                            <RotateCcw className="h-4 w-4" />
                            <span className="text-[10px] font-black pr-1">REINTENTAR CÁMARA</span>
                          </button>
                        )}
                    </div>
                );
            })}
        </div>

        <div className="fixed bottom-6 right-6 z-[1001] flex flex-col items-end">
            {showLocationMenu && (
                <div className="bg-white rounded-2xl shadow-2xl p-2 mb-3 flex flex-col space-y-1 w-52 border-2 border-gray-100 animate-in slide-in-from-bottom-2">
                    <button onClick={() => handleSendLocation('CHECKIN')} className="flex items-center px-4 py-4 hover:bg-blue-50 text-blue-700 font-black text-sm rounded-xl transition-colors">
                      <MapPin className="h-5 w-5 mr-3" /> Reportar Ubicación
                    </button>
                    <button onClick={() => handleSendLocation('GAS')} className="flex items-center px-4 py-4 hover:bg-orange-50 text-orange-700 font-black text-sm border-t border-gray-100 rounded-xl transition-colors">
                      <Fuel className="h-5 w-5 mr-3" /> Gasolinera
                    </button>
                </div>
            )}
            <button 
              onClick={() => setShowLocationMenu(!showLocationMenu)} 
              className={`p-5 rounded-full shadow-2xl border-4 border-white transition-transform active:scale-90 ${showLocationMenu ? 'bg-slate-800 rotate-45' : 'bg-blue-700'}`}
            >
              {showLocationMenu ? <Clock className="h-8 w-8 text-white" /> : <MapPin className="h-8 w-8 text-white" />}
            </button>
        </div>
      </div>
    </div>
  );
};