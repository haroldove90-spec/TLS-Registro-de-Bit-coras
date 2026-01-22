
import React, { useState, useRef, useEffect } from 'react';
import { Trip, TripStatus, EvidenceStatus, Evidence, LocationReport, TripDestination, ExpenseCategory, ExpenseItem, ExpenseRecord } from '../types';
import { TRIP_STAGES } from '../constants';
import { supabase, checkStorageBucket } from '../supabaseClient';
import { sendPushNotification, playSound, processWatermark, getCurrentLocation } from '../utils';
import { 
  ArrowLeft, Check, BellRing, MapPin, AlertTriangle, 
  Navigation, Camera, Loader, Fuel, Clock, RotateCcw, 
  ShieldAlert, RefreshCw, FileWarning, FileText, 
  ChevronRight, X, Image as ImageIcon, Plus, CheckCircle, UploadCloud, ExternalLink, Share2, Map, Building2, Calendar, MessageSquare, Truck,
  Briefcase, Wrench, Wallet, Trash2, Save, Paperclip, Gauge, Siren, ChevronDown, ChevronUp, Ticket, Construction, Key, Activity, Edit3
} from 'lucide-react';

interface TripDetailProps {
  trip: Trip;
  onBack: () => void;
  onUpdateTrip: (trip: Trip) => void;
}

const SafeImage: React.FC<{ src: string; alt: string; className: string }> = ({ src, alt, className }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <div className={`relative overflow-hidden flex items-center justify-center ${className} bg-slate-200 rounded-xl border border-gray-200 shadow-sm`}>
      {loading && <Loader className="absolute h-6 w-6 animate-spin text-slate-400 z-10" />}
      {error ? (
        <FileWarning className="h-8 w-8 text-red-400" />
      ) : (
        <img 
          src={src} 
          alt={alt} 
          className={`w-full h-full object-cover transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
          onLoad={() => setLoading(false)}
          onError={() => setError(true)}
        />
      )}
    </div>
  );
};

export const TripDetail: React.FC<TripDetailProps> = ({ trip, onBack, onUpdateTrip }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false); 
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false); 
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Estados para Gastos
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [currentExpenseCategory, setCurrentExpenseCategory] = useState<ExpenseCategory | null>(null);
  // Usamos 'any' en el estado de filas para permitir que amount sea string vacío durante la edición y evitar bloqueos
  const [expenseRows, setExpenseRows] = useState<any[]>([{ concept: '', description: '', amount: '' }]);
  const [expenseEvidence, setExpenseEvidence] = useState<Evidence[]>([]); 
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [isUploadingExpenseEvidence, setIsUploadingExpenseEvidence] = useState(false);

  // Estados Específicos para Combustible
  const [fuelOdometer, setFuelOdometer] = useState<string>('');
  const [fuelLiters, setFuelLiters] = useState<string>('');
  const [fuelPrice, setFuelPrice] = useState<string>('');
  const [fuelTotal, setFuelTotal] = useState<number>(0);

  // Estados para Menús Desplegables (Nuevo Diseño)
  const [showGastosMenu, setShowGastosMenu] = useState(false);
  const [showMantenimientoMenu, setShowMantenimientoMenu] = useState(false);
  
  // Estado para desplegar Monitor Operativo (Nuevo)
  const [showOperativeSection, setShowOperativeSection] = useState(false);

  // Estados para Odómetro (Nuevo Requisito)
  const [showOdometerModal, setShowOdometerModal] = useState<{show: boolean, type: 'START' | 'END', pendingStageIndex: number} | null>(null);
  const [odometerValue, setOdometerValue] = useState<string>('');

  // Estado para Botón de Pánico
  const [isPanicLoading, setIsPanicLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const expenseFileInputRef = useRef<HTMLInputElement>(null); 
  
  const destinations = trip.destinations && trip.destinations.length > 0 
    ? trip.destinations 
    : [{ id: 'default', name: trip.destination, mapsLink: trip.destinationMapsLink, currentStageIndex: 0, status: 'PENDING' }];

  const currentDestIdx = destinations.findIndex(d => d.status !== 'COMPLETED');
  const activeDest = currentDestIdx !== -1 ? destinations[currentDestIdx] : destinations[destinations.length - 1];

  const verifyConnection = async () => {
    const ok = await checkStorageBucket();
    if (!ok) setConnectionError("⚠️ ERROR DE RED: Fallo de servidor de evidencias.");
    else setConnectionError(null);
  };

  useEffect(() => { verifyConnection(); }, []);

  // Calcular total de combustible automáticamente
  useEffect(() => {
    const liters = parseFloat(fuelLiters);
    const price = parseFloat(fuelPrice);
    if (!isNaN(liters) && !isNaN(price)) {
        setFuelTotal(liters * price);
    } else {
        setFuelTotal(0);
    }
  }, [fuelLiters, fuelPrice]);

  // --- LÓGICA DE PÁNICO REFORZADA ---
  const handlePanicButton = async () => {
    if (!window.confirm("⚠️ ¿ESTÁS SEGURO?\n\nEsta acción enviará una alerta CRÍTICA a la central con tu ubicación actual precisa.")) {
        return;
    }

    setIsPanicLoading(true);
    // Reproducir sonido inmediatamente para feedback local
    playSound('alert');

    try {
        // Intentar obtener ubicación con alta precisión
        const location = await getCurrentLocation();
        
        const timestamp = new Date().toLocaleString();
        const accuracyText = location?.accuracy ? `(Precisión: +/- ${Math.round(location.accuracy)}m)` : '(GPS Impreciso)';
        const locationText = location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : 'UBICACIÓN NO DISPONIBLE';

        // Registrar alerta en Supabase con metadata enriquecida
        const { error } = await supabase.from('notificaciones').insert({
            target_role: 'ADMIN',
            title: '🆘 PÁNICO - ASISTENCIA URGENTE',
            message: `La unidad ${trip.plate} solicitó auxilio a las ${timestamp}. Ubicación: ${locationText} ${accuracyText}.`,
            type: 'alert',
            metadata: { 
                trip_id: trip.id,
                lat: location?.lat,
                lng: location?.lng,
                accuracy: location?.accuracy,
                timestamp: Date.now(),
                extra_info: 'PANIC BUTTON PRESSED'
            }
        });

        if (error) throw error;

        // Actualizar estado del viaje a INCIDENT para que sea visible en rojo en el dashboard
        const updatedTrip = { ...trip, status: TripStatus.INCIDENT, hasIncident: true };
        await supabase.from('viajes').update({ status: TripStatus.INCIDENT }).eq('id', trip.id);
        onUpdateTrip(updatedTrip);

        alert("🚨 ALERTA ENVIADA. LA CENTRAL HA RECIBIDO TU UBICACIÓN Y SOLICITUD DE AYUDA.");

    } catch (err) {
        console.error("Error enviando alerta de pánico:", err);
        alert("Error de conexión al enviar alerta. POR FAVOR LLAMA POR TELÉFONO INMEDIATAMENTE.");
    } finally {
        setIsPanicLoading(false);
    }
  };
  // -----------------------

  // --- LÓGICA DE ODÓMETRO ---
  const handleSaveOdometer = async () => {
    if (!showOdometerModal || !odometerValue) return;

    const value = parseFloat(odometerValue);
    if (isNaN(value) || value <= 0) {
        alert("Por favor ingrese un kilometraje válido.");
        return;
    }

    // Validar coherencia (Final > Inicial)
    if (showOdometerModal.type === 'END' && trip.odometerStart && value <= trip.odometerStart) {
        alert(`El odómetro final (${value}) debe ser mayor al inicial (${trip.odometerStart}).`);
        return;
    }

    setIsProcessing(true);
    try {
        const updateField = showOdometerModal.type === 'START' ? 'odometer_start' : 'odometer_end';
        const tripField = showOdometerModal.type === 'START' ? 'odometerStart' : 'odometerEnd';
        
        // 1. Guardar en DB
        const { error } = await supabase
            .from('viajes')
            .update({ [updateField]: value })
            .eq('id', trip.id);

        if (error) throw error;

        // 2. Actualizar estado local
        const updatedTrip = { ...trip, [tripField]: value };
        onUpdateTrip(updatedTrip); // Actualizamos el trip global

        // 3. Cerrar modal y proceder con la etapa pendiente
        const pendingIndex = showOdometerModal.pendingStageIndex;
        setShowOdometerModal(null);
        setOdometerValue('');
        
        // 4. Ejecutar el cambio de etapa que estaba pendiente
        await executeStageChange(pendingIndex, updatedTrip); // Pasamos el trip actualizado

    } catch (err) {
        console.error("Error guardando odómetro:", err);
        alert("Error al guardar el kilometraje.");
    } finally {
        setIsProcessing(false);
    }
  };

  // ------------------------

  // --- LÓGICA DE GASTOS ---
  const handleOpenExpenseModal = (category: ExpenseCategory, initialConcept: string = '') => {
    setCurrentExpenseCategory(category);
    // Inicializar amount como string vacío para evitar que aparezca un '0' difícil de borrar
    // Se inicializa 'description' vacío
    setExpenseRows([{ concept: initialConcept, description: '', amount: '' }]); 
    setExpenseEvidence([]); 
    
    // Resetear campos de combustible
    setFuelOdometer('');
    setFuelLiters('');
    setFuelPrice('');
    setFuelTotal(0);

    setShowExpenseModal(true);
    playSound('notification');
  };

  const handleAddExpenseRow = () => {
    setExpenseRows([...expenseRows, { concept: '', description: '', amount: '' }]);
  };

  const handleRemoveExpenseRow = (index: number) => {
    if (expenseRows.length === 1) return;
    setExpenseRows(expenseRows.filter((_, i) => i !== index));
  };

  const handleExpenseChange = (index: number, field: string, value: string | number) => {
    const newRows = [...expenseRows];
    newRows[index] = { ...newRows[index], [field]: value };
    setExpenseRows(newRows);
  };

  const handleExpensePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingExpenseEvidence(true);
    playSound('notification');

    try {
        const location = await getCurrentLocation();
        const newEvidences: Evidence[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const watermarkedUrl = await processWatermark(file, trip.code, trip.plate);
            
            const fileName = `${trip.id}_EXPENSE_${Date.now()}_${i}.jpg`;
            const filePath = `${trip.id}/expenses/${fileName}`;

            const res = await fetch(watermarkedUrl);
            const blob = await res.blob();

            const { error: uploadError } = await supabase.storage
                .from('evidencias')
                .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('evidencias').getPublicUrl(filePath);

            newEvidences.push({
                id: Math.random().toString(36).substr(2, 9),
                tripId: trip.id,
                stageIndex: -1, 
                url: urlData.publicUrl,
                fileName: fileName,
                path: filePath,
                timestamp: Date.now(),
                lat: location?.lat,
                lng: location?.lng
            });
        }

        setExpenseEvidence(prev => [...prev, ...newEvidences]);
        playSound('success');

    } catch (err) {
        console.error("Error subiendo evidencia de gasto", err);
        alert("Error al subir la evidencia.");
    } finally {
        setIsUploadingExpenseEvidence(false);
        if (expenseFileInputRef.current) expenseFileInputRef.current.value = '';
    }
  };

  const handleRemoveExpenseEvidence = (id: string) => {
      setExpenseEvidence(prev => prev.filter(e => e.id !== id));
  };

  const handleSaveExpense = async () => {
    if (!currentExpenseCategory) return;
    
    // Determinar tipo de registro para lógica específica
    const isFuel = currentExpenseCategory === 'GASTOS' && expenseRows[0]?.concept?.includes('Combustible');
    const isUrgentMaintenance = currentExpenseCategory === 'MANTENIMIENTO' && expenseRows[0]?.concept?.includes('Reporte urgente');
    
    let validRows: ExpenseItem[] = [];
    let total = 0;

    if (isFuel) {
        if (!fuelOdometer || !fuelLiters || !fuelPrice || fuelTotal <= 0) {
            alert("Por favor completa todos los campos de combustible correctamente.");
            return;
        }
        validRows = [{
            concept: 'Combustible',
            amount: fuelTotal,
            odometer: parseFloat(fuelOdometer),
            liters: parseFloat(fuelLiters),
            pricePerLiter: parseFloat(fuelPrice)
        }];
        total = fuelTotal;
    } else {
        // Validación genérica para otros gastos y mantenimientos (incluyendo reportes urgentes)
        // Convertimos el input de amount (que puede ser string) a number
        const processedRows = expenseRows.map(r => ({
            concept: r.concept,
            description: r.description,
            amount: r.amount ? parseFloat(r.amount) : 0
        }));

        validRows = processedRows.filter(r => r.concept.trim() !== '');
        
        if (validRows.length === 0) {
            alert("Agrega al menos una descripción.");
            return;
        }
        total = validRows.reduce((sum, r) => sum + (r.amount || 0), 0);
    }

    setIsSavingExpense(true);
    try {
        const newRecord: ExpenseRecord = {
            id: Math.random().toString(36).substr(2, 9),
            category: currentExpenseCategory,
            items: validRows,
            total: total,
            timestamp: Date.now(),
            evidence: expenseEvidence 
        };

        const updatedCosts = [...(trip.extraCosts || []), newRecord];
        
        const { error } = await supabase
            .from('viajes')
            .update({ extra_costs: updatedCosts })
            .eq('id', trip.id);

        if (error) throw error;

        const expenseImageUrl = expenseEvidence.length > 0 ? expenseEvidence[0].url : undefined;
        
        // CONFIGURACIÓN DE NOTIFICACIÓN
        let notifTitle = '💰 GASTO REGISTRADO';
        let notifType: 'info' | 'alert' | 'success' = 'info';
        // Incluir la descripción manual en la notificación si existe para dar más contexto
        const conceptDetail = validRows[0].description ? `${validRows[0].concept} (${validRows[0].description})` : validRows[0].concept;
        let notifMessage = `Unidad ${trip.plate} registró: ${currentExpenseCategory} - ${conceptDetail} ($${total.toFixed(2)}).`;

        if (isFuel) {
            notifTitle = '⛽ COMBUSTIBLE REGISTRADO';
            notifMessage = `Unidad ${trip.plate} cargó combustible ($${total.toFixed(2)}). Odo: ${fuelOdometer}`;
        } else if (isUrgentMaintenance) {
            notifTitle = '🚨 REPORTE URGENTE - MANTENIMIENTO';
            notifType = 'alert'; // ESTO DISPARA LA ALARMA EN ADMIN
            notifMessage = `⚠️ LA UNIDAD ${trip.plate} REPORTA FALLA URGENTE: ${conceptDetail}`;
        } else if (currentExpenseCategory === 'MANTENIMIENTO') {
            notifTitle = '🔧 REPORTE MANTENIMIENTO';
            notifMessage = `Unidad ${trip.plate} reporta incidencia: ${conceptDetail}`;
        }

        await supabase.from('notificaciones').insert({
            target_role: 'ADMIN',
            title: notifTitle,
            message: notifMessage,
            type: notifType,
            metadata: { 
                trip_id: trip.id, 
                image_url: expenseImageUrl,
                amount: total,
                category: currentExpenseCategory,
                urgent: isUrgentMaintenance
            }
        });

        onUpdateTrip({ ...trip, extraCosts: updatedCosts });
        playSound('success');
        setShowExpenseModal(false);
        
        if (isUrgentMaintenance) {
            alert("Reporte Urgente Enviado a Torre de Control.");
        }

    } catch (error) {
        console.error("Error saving expense", error);
        alert("Error al guardar registro.");
    } finally {
        setIsSavingExpense(false);
    }
  };
  // ------------------------

  const handleAcceptTrip = async () => {
    playSound('notification');
    setIsProcessing(true);
    
    onUpdateTrip({...trip, status: TripStatus.ACCEPTED});
    playSound('success');

    const { error } = await supabase
        .from('viajes')
        .update({ status: TripStatus.ACCEPTED })
        .eq('id', trip.id);
    
    await supabase.from('notificaciones').insert({
        target_role: 'ADMIN',
        title: '✅ VIAJE ACEPTADO',
        message: `La unidad ${trip.plate} ha confirmado la aceptación del viaje.`,
        type: 'success',
        metadata: { trip_id: trip.id }
    });

    if (error) {
        console.error("Error accepting trip in DB:", error);
        alert("Hubo un problema de conexión al confirmar el viaje, pero se ha guardado localmente.");
    }
    setIsProcessing(false);
  };

  const handleShareLocation = async () => {
    if (isSharingLocation) return;
    setIsSharingLocation(true);
    playSound('notification');

    try {
        const location = await getCurrentLocation();
        if (!location) {
            alert("No se pudo obtener la ubicación. Verifique los permisos del GPS.");
            setIsSharingLocation(false);
            return;
        }

        const newReport: LocationReport = {
            id: `manual-${Date.now()}`,
            lat: location.lat,
            lng: location.lng,
            timestamp: Date.now(),
            type: 'CHECKIN',
            label: 'Ubicación Compartida Manualmente',
            isOutOfRange: false
        };

        const updatedHistory = [...(trip.locationHistory || []), newReport];
        const { error } = await supabase.from('viajes').update({ locationHistory: updatedHistory }).eq('id', trip.id);
        
        const { error: notifError } = await supabase.from('notificaciones').insert({
            target_role: 'ADMIN',
            title: '📍 UBICACIÓN COMPARTIDA',
            message: `La unidad ${trip.plate} compartió su ubicación manual: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`,
            type: 'info',
            metadata: { 
                trip_id: trip.id,
                lat: location.lat,
                lng: location.lng
            }
        });

        if (notifError) {
             console.error("Error enviando notificación:", notifError);
             throw new Error("No se pudo enviar la alerta al administrador (Error BD).");
        }

        onUpdateTrip({ ...trip, locationHistory: updatedHistory });
        playSound('success');
        alert("✅ Ubicación enviada correctamente a la Torre de Control.");

    } catch (error: any) {
        console.error("Error compartiendo ubicación:", error);
        alert(`Error al compartir: ${error.message || 'Intente nuevamente'}`);
    } finally {
        setIsSharingLocation(false);
    }
  };

  // Función principal para avanzar etapa
  const handleStageClick = (index: number) => {
    if (index !== trip.currentStageIndex || isProcessing) return;

    // VALIDACIÓN: ODÓMETRO INICIAL (Al comenzar viaje - Etapa 0)
    if (index === 0 && !trip.odometerStart) {
        setOdometerValue('');
        setShowOdometerModal({ show: true, type: 'START', pendingStageIndex: index });
        return;
    }

    // VALIDACIÓN: ODÓMETRO FINAL (Al finalizar viaje - Etapa 6)
    if (index === 6 && !trip.odometerEnd) {
        setOdometerValue('');
        setShowOdometerModal({ show: true, type: 'END', pendingStageIndex: index });
        return;
    }

    // Si pasa las validaciones de odómetro, ejecuta la lógica normal
    executeStageChange(index, trip);
  };

  const executeStageChange = async (index: number, currentTripData: Trip) => {
    const isStepUnloaded = index === 5; 

    if (isStepUnloaded) {
        const hasEvidence = currentTripData.evidence.some(e => e.stageIndex === 5 && (!e.destinationId || e.destinationId === activeDest?.id));
        if (!hasEvidence) {
            alert("⚠️ REQUERIDO: Debes tomar al menos una foto de evidencia para confirmar la descarga.");
            playSound('alert');
            fileInputRef.current?.click();
            return;
        }
    }

    playSound('notification');
    setIsProcessing(true);
    try {
      let nextStepIndex = index + 1;
      let updatedDestinations = [...destinations];
      let alertMessage = "";

      if (isStepUnloaded) { 
        if (activeDest) {
            updatedDestinations = updatedDestinations.map(d => 
                d.id === activeDest.id ? { ...d, status: 'COMPLETED' as const } : d
            );
        }
        
        const nextPendingDest = updatedDestinations.find(d => d.status === 'PENDING');
        
        if (nextPendingDest) {
          nextStepIndex = 3; 
          alertMessage = `✅ Destino completado. Iniciando ruta hacia: ${nextPendingDest.name}`;
        }
      }

      const currentStageAsNumber = Number(nextStepIndex);
      let newStatus = currentTripData.status;
      const isTripFinished = nextStepIndex === 6; 

      if (isTripFinished) {
        newStatus = TripStatus.COMPLETED;
      } else if (nextStepIndex === 1) {
        newStatus = TripStatus.IN_TRANSIT;
      } else if (nextStepIndex > 1 && newStatus === TripStatus.ACCEPTED) {
        newStatus = TripStatus.IN_TRANSIT;
      }

      const { data, error } = await supabase
        .from('viajes')
        .update({ 
          current_stage: currentStageAsNumber,
          destinos_lista: updatedDestinations,
          status: newStatus 
        })
        .eq('id', currentTripData.id) 
        .select();

      if (error) throw error;
      
      const stageName = TRIP_STAGES[nextStepIndex]?.label || 'Siguiente Etapa';
      await supabase.from('notificaciones').insert({
        target_role: 'ADMIN',
        title: isTripFinished ? '🏁 VIAJE COMPLETADO' : '🚚 AVANCE DE RUTA',
        message: isTripFinished 
            ? `La unidad ${currentTripData.plate} ha finalizado el viaje correctamente.`
            : `Unidad ${currentTripData.plate} avanzó a: ${stageName}`,
        type: isTripFinished ? 'success' : 'info',
        metadata: { trip_id: currentTripData.id }
      });

      const updatedTrip: Trip = { 
        ...currentTripData, 
        currentStageIndex: nextStepIndex,
        destinations: updatedDestinations,
        status: newStatus
      };
      
      onUpdateTrip(updatedTrip);
      playSound('success');
      
      if (isTripFinished) {
        setShowCompletionModal(true);
      }
      
      if (alertMessage) {
        alert(alertMessage);
      }

    } catch (err: any) {
      console.error("Fallo general en handleStageClick:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setIsProcessing(true);
    playSound('notification');
    
    try {
      const location = await getCurrentLocation();
      const newEvidences: Evidence[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const watermarkedUrl = await processWatermark(file, trip.code, trip.plate);
        const stageLabel = TRIP_STAGES[trip.currentStageIndex].key; 
        const fileName = `${trip.id}_${stageLabel}_${Date.now()}_${i}.jpg`;
        const filePath = `${trip.id}/${stageLabel}/${fileName}`;

        const res = await fetch(watermarkedUrl);
        const blob = await res.blob();

        const { error: uploadError } = await supabase.storage
          .from('evidencias')
          .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('evidencias').getPublicUrl(filePath);

        newEvidences.push({
          id: Math.random().toString(36).substr(2, 9),
          tripId: trip.id,
          destinationId: activeDest?.id,
          stageIndex: trip.currentStageIndex,
          url: urlData.publicUrl,
          fileName: fileName,
          path: filePath,
          timestamp: Date.now(),
          lat: location?.lat,
          lng: location?.lng
        });
      }

      const updatedEvidenceList = [...trip.evidence, ...newEvidences];
      const updatedTrip = { ...trip, evidence: updatedEvidenceList, evidenceStatus: 'PENDING' as EvidenceStatus };

      await supabase.from('viajes').update({ 
          evidence: updatedEvidenceList,
          evidence_status: 'PENDING' 
      }).eq('id', trip.id);

      const evidenceImageUrl = newEvidences.length > 0 ? newEvidences[0].url : undefined;
      
      await supabase.from('notificaciones').insert({
          target_role: 'ADMIN',
          title: '📷 NUEVA EVIDENCIA',
          message: `Unidad ${trip.plate} subió ${newEvidences.length} fotos nuevas.`,
          type: 'info',
          metadata: { 
              trip_id: trip.id,
              image_url: evidenceImageUrl, 
              evidence_count: newEvidences.length
          }
      });

      onUpdateTrip(updatedTrip);
      playSound('success');
      
    } catch (err: any) {
      console.error("Error al procesar evidencias:", err);
      alert("Error al guardar las evidencias fotográficas.");
    } finally {
      setIsProcessing(false);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const renderInfoCards = () => (
    <div className="space-y-6">
        {destinations.map((dest, idx) => (
            <div key={dest.id} className="bg-white rounded-2xl p-6 shadow-sm border-l-8 border-blue-600 animate-in slide-in-from-right-4" style={{ animationDelay: `${idx * 100}ms` }}>
                 <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <div className="bg-blue-100 p-2 rounded-lg mr-3">
                            <MapPin className="h-6 w-6 text-blue-700" />
                        </div>
                        <h3 className="text-xl font-black text-blue-900 uppercase">DESTINO #{idx + 1}</h3>
                    </div>
                    {dest.status === 'COMPLETED' && <span className="bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full text-xs">COMPLETADO</span>}
                </div>

                <div className="space-y-5 pl-2">
                    <div>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-wide mb-1">Cliente</p>
                        <p className="font-black text-slate-900 text-2xl leading-tight">{dest.client || trip.client}</p>
                    </div>

                    <div>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-wide mb-1">Dirección de Entrega</p>
                        <p className="font-bold text-slate-800 text-xl leading-snug">{dest.name}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-center space-x-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <Calendar className="h-6 w-6 text-blue-600" />
                            <div>
                                <p className="text-xs text-slate-500 font-bold uppercase">Fecha de carga</p>
                                <p className="text-lg font-black text-blue-900">{dest.date || trip.date}</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center space-x-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <Clock className="h-6 w-6 text-blue-600" />
                            <div>
                                <p className="text-xs text-slate-500 font-bold uppercase">Hora de carga</p>
                                <p className="text-lg font-black text-blue-900">{dest.appointment || trip.appointment || 'Abierto'}</p>
                            </div>
                        </div>
                    </div>

                    {dest.instructions && (
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center">
                                    <MessageSquare className="h-5 w-5 text-yellow-700 mr-2" />
                                    <p className="text-xs font-black text-yellow-800 uppercase tracking-wide">INDICACIONES</p>
                                </div>
                                {dest.instructions_pdf_url && (
                                    <a href={dest.instructions_pdf_url} target="_blank" rel="noreferrer" className="bg-white border border-yellow-300 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold flex items-center hover:bg-yellow-100">
                                        <FileText className="h-3 w-3 mr-1"/> Ver PDF
                                    </a>
                                )}
                            </div>
                            <p className="text-lg font-bold text-yellow-900 leading-snug">{dest.instructions}</p>
                        </div>
                    )}
                </div>
            </div>
        ))}
    </div>
  );

  if (trip.status === TripStatus.PENDING_ACCEPTANCE) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col p-4 pt-10">
        <div className="bg-amber-400 p-8 rounded-2xl mb-8 shadow-lg border-b-8 border-amber-600 text-center animate-in zoom-in-95">
          <BellRing className="h-20 w-20 text-black mx-auto mb-4 animate-bounce" />
          <h1 className="text-4xl font-black text-black uppercase tracking-tight leading-none">Nuevo Viaje</h1>
          <p className="text-2xl font-bold text-amber-900 mt-3">Confirma recepción</p>
        </div>
        
        <div className="mb-8">
            <h2 className="text-slate-400 font-bold uppercase text-sm tracking-widest mb-4 ml-2">Detalles de la Ruta</h2>
            {renderInfoCards()}
        </div>

        <button onClick={handleAcceptTrip} disabled={isProcessing} className="w-full bg-slate-900 text-white font-black text-2xl py-8 rounded-3xl shadow-2xl border-b-8 border-black active:translate-y-2 transition-all sticky bottom-4 z-50">
          {isProcessing ? <Loader className="h-8 w-8 animate-spin mx-auto" /> : "ACEPTAR VIAJE"}
        </button>
      </div>
    );
  }

  const isCombustible = currentExpenseCategory === 'GASTOS' && expenseRows[0]?.concept?.includes('Combustible');

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <input type="file" accept="image/*" capture="environment" multiple ref={fileInputRef} onChange={handlePhotoUpload} className="hidden" />
      <input type="file" accept="image/*" capture="environment" multiple ref={expenseFileInputRef} onChange={handleExpensePhotoUpload} className="hidden" />
      
      {connectionError && (
        <div className="fixed top-20 left-4 right-4 z-[1001] bg-red-600 text-white p-6 rounded-2xl shadow-2xl border-4 border-white animate-in slide-in-from-top-4">
          <p className="font-bold text-xl text-center mb-4">{connectionError}</p>
          <button onClick={verifyConnection} className="w-full bg-white text-red-600 font-black py-4 text-lg rounded-xl shadow-lg">REINTENTAR</button>
        </div>
      )}

      <div className="bg-white p-4 shadow-sm border-b-2 border-gray-200 sticky top-0 z-[100]">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => { playSound('notification'); onBack(); }} className="p-3 bg-gray-100 rounded-xl active:scale-90 border border-gray-300">
             <ArrowLeft className="h-8 w-8 text-black" />
          </button>
          <div className="text-right">
            <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">Viaje {trip.code}</p>
            <p className="text-3xl font-black text-slate-900 leading-none">{trip.plate}</p>
          </div>
        </div>
        <div className={`text-center py-3 rounded-xl font-black text-base uppercase tracking-widest shadow-sm ${trip.status === TripStatus.IN_TRANSIT ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
          Estatus: {trip.status}
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col max-w-lg mx-auto w-full pb-32 space-y-8">
        
        <div>{renderInfoCards()}</div>
        
        {/* BOTÓN PRINCIPAL PARA MOSTRAR MONITOR OPERATIVO */}
        <button
            onClick={() => setShowOperativeSection(!showOperativeSection)}
            className="w-full bg-blue-600 text-white font-black text-xl py-4 rounded-2xl shadow-lg border-b-4 border-blue-800 active:translate-y-1 active:border-b-0 transition-all flex items-center justify-center space-x-3 mb-2"
        >
            <Activity className="h-6 w-6" />
            <span>OPERATIVO</span>
            {showOperativeSection ? <ChevronUp className="h-6 w-6" /> : <ChevronDown className="h-6 w-6" />}
        </button>

        {showOperativeSection && (
            <div className="animate-in fade-in slide-in-from-top-4 space-y-8">
                <div className="flex items-center my-2">
                    <div className="flex-grow h-px bg-slate-300"></div>
                    <span className="mx-4 text-slate-400 font-black uppercase text-sm tracking-widest">Control de Etapas</span>
                    <div className="flex-grow h-px bg-slate-300"></div>
                </div>
                
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-100 px-5 py-4 border-b border-slate-200 flex justify-between items-center">
                        <h3 className="font-black text-sm text-slate-700 uppercase tracking-widest flex items-center">
                            <Map className="h-5 w-5 mr-2" /> Navegación Rápida
                        </h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {destinations.map((dest, idx) => {
                            const isCompleted = dest.status === 'COMPLETED';
                            const isActive = dest.id === activeDest?.id && !isCompleted;

                            return (
                                <div key={dest.id} className={`p-5 flex items-center justify-between ${isActive ? 'bg-blue-50/50' : 'bg-white'}`}>
                                    <div className="flex items-center space-x-4 overflow-hidden">
                                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-black text-lg border-4 ${isCompleted ? 'bg-slate-200 text-slate-400 border-slate-300' : isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-200'}`}>
                                            {isCompleted ? <Check className="h-6 w-6" /> : idx + 1}
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`text-lg font-black truncate ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{dest.name}</p>
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">{isActive ? '🟢 Destino Actual' : isCompleted ? '⚪ Completado' : '🟠 Pendiente'}</p>
                                        </div>
                                    </div>
                                    {!isCompleted && (
                                        <button 
                                            onClick={() => { 
                                                playSound('notification'); 
                                                const url = dest.mapsLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dest.name)}`; 
                                                window.open(url, '_blank'); 
                                            }} 
                                            className={`flex-shrink-0 p-3 rounded-xl border-2 transition-all active:scale-95 ${isActive ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-500 border-slate-300 hover:border-blue-400 hover:text-blue-600'}`}
                                        >
                                            <Navigation className="h-6 w-6" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {trip.indicaciones_pdf_url && (
                    <button onClick={() => setShowPdfModal(true)} className="w-full bg-white border-2 border-blue-100 p-5 rounded-2xl shadow-sm flex items-center justify-between active:scale-[0.98] transition-all group hover:border-blue-400">
                        <div className="flex items-center">
                            <div className="bg-blue-100 p-4 rounded-xl mr-5 group-hover:bg-blue-600 transition-colors"><FileText className="h-8 w-8 text-blue-700 group-hover:text-white transition-colors" /></div>
                            <div className="text-left"><h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">Documento de Viaje</h4><p className="text-sm text-slate-500 font-medium">Ver indicaciones (PDF)</p></div>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-full"><ChevronRight className="h-6 w-6 text-slate-400" /></div>
                    </button>
                )}

                {/* Lista de Etapas */}
                <div className="space-y-4">
                {TRIP_STAGES.map((stage, index) => {
                    const isCompleted = index < trip.currentStageIndex;
                    const isCurrent = index === trip.currentStageIndex;
                    const isStepUnloaded = index === 5; 
                    
                    const currentEvidence = trip.evidence.filter(e => 
                        e.stageIndex === 5 && (!e.destinationId || e.destinationId === activeDest?.id)
                    );

                    return (
                    <div key={stage.key} className="space-y-3">
                        <button
                        onClick={() => handleStageClick(index)}
                        disabled={!isCurrent || isProcessing}
                        className={`w-full py-8 px-6 rounded-3xl flex items-center justify-between border-b-[6px] transition-all active:translate-y-1
                            ${isCompleted ? 'bg-slate-200 border-slate-300 text-slate-400' : 
                            isCurrent ? 'bg-amber-400 border-amber-600 text-black shadow-xl ring-4 ring-white' : 
                            'bg-white border-gray-100 text-gray-300 opacity-60'}`}
                        >
                        <div className="flex items-center space-x-6">
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center border-4 font-black text-3xl shadow-inner shrink-0
                            ${isCurrent ? 'bg-black text-white border-black' : isCompleted ? 'bg-slate-300 text-slate-500 border-slate-400' : 'border-current'}`}>
                            {isCompleted ? <Check className="h-8 w-8" /> : <span>{index + 1}</span>}
                            </div>
                            <div className="text-left">
                            <span className="text-2xl font-black uppercase tracking-tight block leading-none">{stage.label}</span>
                            {isCurrent && (
                                <span className="text-sm font-black uppercase opacity-70 flex items-center mt-2 bg-black/10 px-2 py-1 rounded w-fit">
                                {isProcessing ? <Loader className="h-4 w-4 animate-spin mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                                {isStepUnloaded && currentEvidence.length === 0 ? "FOTO REQUERIDA" : "PULSAR PARA CONFIRMAR"}
                                </span>
                            )}
                            </div>
                        </div>
                        </button>

                        {index === 0 && (
                        <div className="mt-2 animate-in fade-in slide-in-from-top-2">
                            <button onClick={() => { playSound('notification'); const url = trip.originMapsLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trip.origin)}`; window.open(url, '_blank'); }} className="w-full bg-white border-2 border-slate-200 text-slate-800 p-4 rounded-2xl flex items-center justify-center space-x-3 active:scale-95 transition-all shadow-sm hover:border-slate-300">
                            <MapPin className="h-6 w-6 text-red-600" />
                            <div className="text-left leading-tight"><span className="block text-xs font-bold uppercase text-slate-400">Lugar de Carga</span><span className="block text-base font-black uppercase">Ver Mapa</span></div>
                            </button>
                        </div>
                        )}

                        {isCurrent && isStepUnloaded && (
                        <div className="bg-slate-800 rounded-3xl p-6 border-4 border-slate-600 shadow-2xl animate-in slide-in-from-top-4 duration-300">
                            <div className="flex flex-col items-center mb-6 text-center">
                                <div className="bg-amber-400 p-4 rounded-full mb-4 shadow-lg animate-bounce"><Camera className="h-10 w-10 text-black" /></div>
                                <h4 className="text-2xl font-black text-white uppercase tracking-tight">Evidencia: {activeDest?.name || 'Destino'}</h4>
                                <p className="text-sm font-medium text-slate-300 mt-2 max-w-[250px]">Toma fotos de la mercancía descargada.</p>
                            </div>
                            <button 
                                onClick={() => fileInputRef.current?.click()} 
                                disabled={isUploading}
                                className={`w-full text-white py-5 rounded-2xl font-black text-lg uppercase flex items-center justify-center border-b-4 active:translate-y-1 active:border-b-0 transition-all mb-6 shadow-lg group ${isUploading ? 'bg-slate-500 border-slate-700 cursor-wait' : 'bg-blue-600 hover:bg-blue-500 border-blue-800'}`}
                            >
                                {isUploading ? (
                                    <>
                                        <Loader className="h-6 w-6 mr-3 animate-spin" />
                                        SUBIENDO...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="h-6 w-6 mr-3 group-hover:rotate-90 transition-transform" />
                                        SUBIR FOTO
                                    </>
                                )}
                            </button>
                            {currentEvidence.length === 0 ? (
                            <div className="py-8 text-center border-2 border-dashed border-slate-600 rounded-2xl bg-slate-700/50"><ImageIcon className="h-10 w-10 text-slate-500 mx-auto mb-3" /><p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sin evidencias</p></div>
                            ) : (
                            <div className="grid grid-cols-2 gap-4">
                                {currentEvidence.map((ev) => (
                                    <div key={ev.id} className="relative group"><SafeImage src={ev.url} alt="Evidencia" className="aspect-square rounded-xl border-4 border-slate-600 shadow-lg" /><div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-sm">{new Date(ev.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div><div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-1 border-2 border-white"><Check className="h-4 w-4 text-white" /></div></div>
                                ))}
                            </div>
                            )}
                        </div>
                        )}
                    </div>
                    );
                })}
                </div>
            </div>
        )}

        {/* SECCIÓN DE BOTONES DE GASTOS Y MANTENIMIENTO (NUEVO DISEÑO) */}
        <div className="mt-8 px-2 space-y-4 pb-10">
            <h4 className="text-center text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Panel de Control Operativo</h4>
            
            {/* BOTÓN GASTOS */}
            <div className="flex flex-col">
                <button 
                    onClick={() => setShowGastosMenu(!showGastosMenu)}
                    className="w-full py-5 rounded-3xl font-black text-xl text-white shadow-xl flex items-center justify-center space-x-3 active:scale-95 transition-all border-b-8 bg-emerald-600 border-emerald-800 hover:bg-emerald-500"
                >
                    <Wallet className="h-8 w-8" />
                    <span>GASTOS</span>
                    {showGastosMenu ? <ChevronUp className="h-6 w-6 ml-2" /> : <ChevronDown className="h-6 w-6 ml-2" />}
                </button>
                
                {showGastosMenu && (
                    <div className="mt-4 space-y-2 animate-in slide-in-from-top-2">
                        {[
                            { label: "1.- Combustible", icon: <Fuel className="h-5 w-5" /> },
                            { label: "2.- Casetas efectivo", icon: <Ticket className="h-5 w-5" /> },
                            { label: "3.- Viáticos", icon: <Wallet className="h-5 w-5" /> },
                            { label: "4.- Reparaciones / Refacciones", icon: <Wrench className="h-5 w-5" /> },
                            { label: "5.- Maniobras", icon: <Construction className="h-5 w-5" /> },
                            { label: "6.- Permisos clave", icon: <Key className="h-5 w-5" /> },
                            { label: "7.- Otros", icon: <Briefcase className="h-5 w-5" /> },
                        ].map((item, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleOpenExpenseModal('GASTOS', item.label)}
                                className="w-full py-3 rounded-2xl font-bold text-lg text-white shadow-md flex items-center justify-between px-6 active:scale-95 transition-all border-b-4 bg-emerald-500 border-emerald-700 hover:bg-emerald-400"
                            >
                                <div className="flex items-center space-x-3">
                                    {item.icon}
                                    <span>{item.label}</span>
                                </div>
                                <Plus className="h-5 w-5 text-emerald-200" />
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* BOTÓN MANTENIMIENTO */}
            <div className="flex flex-col">
                <button 
                    onClick={() => setShowMantenimientoMenu(!showMantenimientoMenu)}
                    className="w-full py-5 rounded-3xl font-black text-xl text-white shadow-xl flex items-center justify-center space-x-3 active:scale-95 transition-all border-b-8 bg-orange-600 border-orange-800 hover:bg-orange-500"
                >
                    <Wrench className="h-8 w-8" />
                    <span>MANTENIMIENTO</span>
                    {showMantenimientoMenu ? <ChevronUp className="h-6 w-6 ml-2" /> : <ChevronDown className="h-6 w-6 ml-2" />}
                </button>
                
                {showMantenimientoMenu && (
                    <div className="mt-4 space-y-2 animate-in slide-in-from-top-2">
                        <button
                            onClick={() => handleOpenExpenseModal('MANTENIMIENTO', 'Reportar incidencia')}
                            className="w-full py-3 rounded-2xl font-bold text-lg text-white shadow-md flex items-center justify-between px-6 active:scale-95 transition-all border-b-4 bg-orange-500 border-orange-700 hover:bg-orange-400"
                        >
                            <div className="flex items-center space-x-3">
                                <FileText className="h-5 w-5" />
                                <span>Reportar incidencia</span>
                            </div>
                            <Plus className="h-5 w-5 text-orange-200" />
                        </button>
                        <button
                            onClick={() => handleOpenExpenseModal('MANTENIMIENTO', 'Reporte urgente')}
                            className="w-full py-3 rounded-2xl font-bold text-lg text-white shadow-md flex items-center justify-between px-6 active:scale-95 transition-all border-b-4 bg-orange-500 border-orange-700 hover:bg-orange-400"
                        >
                            <div className="flex items-center space-x-3">
                                <AlertTriangle className="h-5 w-5" />
                                <span>Reporte urgente</span>
                            </div>
                            <Plus className="h-5 w-5 text-orange-200" />
                        </button>
                    </div>
                )}
            </div>
        </div>

        {/* BOTÓN DE PÁNICO (ASISTENCIA URGENTE) - MOVIDO AQUÍ */}
        <div className="mt-6 mb-8 px-2 animate-in fade-in slide-in-from-bottom-2">
            <button 
                onClick={handlePanicButton}
                disabled={isPanicLoading}
                className={`w-full py-5 rounded-3xl font-black text-xl text-white shadow-2xl flex items-center justify-center space-x-3 active:scale-95 transition-all border-b-8
                    ${isPanicLoading ? 'bg-red-800 border-red-900 cursor-wait' : 'bg-red-600 border-red-800 hover:bg-red-500'}`}
            >
                {isPanicLoading ? (
                    <Loader className="h-8 w-8 animate-spin" />
                ) : (
                    <>
                        <Siren className="h-8 w-8 animate-pulse" />
                        <span>ASISTENCIA URGENTE</span>
                    </>
                )}
            </button>
            <p className="text-center text-[10px] text-red-400 font-bold mt-2 uppercase tracking-wider">
                Solo usar en caso de emergencia real
            </p>
        </div>
      </div>

      <div className="fixed bottom-8 right-6 z-[500] flex flex-col items-end space-y-4">
          <button onClick={handleShareLocation} disabled={isSharingLocation} className={`p-6 rounded-full shadow-2xl border-4 border-white transition-all transform active:scale-90 ring-8 ${isSharingLocation ? 'bg-slate-400 ring-slate-200' : 'bg-green-600 ring-green-600/20'}`}>
            {isSharingLocation ? <Loader className="h-8 w-8 text-white animate-spin" /> : <Share2 className="h-8 w-8 text-white" />}
          </button>
          <span className="bg-black/90 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow backdrop-blur-sm">{isSharingLocation ? 'Enviando...' : 'Enviar ubicación'}</span>
      </div>

      {showCompletionModal && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl p-10 max-w-sm w-full text-center shadow-2xl border-t-[10px] border-green-500">
            <div className="mx-auto bg-green-100 w-28 h-28 rounded-full flex items-center justify-center mb-8 animate-bounce"><CheckCircle className="h-16 w-16 text-green-600" /></div>
            <h2 className="text-4xl font-black text-slate-900 mb-3 uppercase tracking-tighter">¡Buen Trabajo!</h2>
            <p className="text-slate-600 font-bold text-lg mb-10 leading-relaxed">Viaje registrado como <strong className="text-slate-900 text-xl">COMPLETADO</strong>.</p>
            <button onClick={() => { playSound('notification'); onBack(); }} className="w-full bg-slate-900 text-white font-black text-xl py-5 rounded-2xl shadow-xl hover:bg-slate-800 active:scale-[0.98] transition-all">VOLVER AL INICIO</button>
          </div>
        </div>
      )}

      {showPdfModal && trip.indicaciones_pdf_url && (
        <div className="fixed inset-0 z-[2100] bg-slate-900/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
            <div className="bg-slate-800 px-5 py-5 flex justify-between items-center shadow-md shrink-0">
                <h3 className="text-white font-bold text-lg flex items-center"><FileText className="h-6 w-6 mr-3 text-blue-400" />Indicaciones Operativas</h3>
                <div className="flex gap-4"><a href={trip.indicaciones_pdf_url} target="_blank" rel="noreferrer" className="bg-slate-700 text-white p-3 rounded-xl hover:bg-slate-600 transition-colors" title="Abrir en navegador externo"><ExternalLink className="h-6 w-6" /></a><button onClick={() => setShowPdfModal(false)} className="bg-slate-700 text-white p-3 rounded-xl hover:bg-red-600 transition-colors"><X className="h-6 w-6" /></button></div>
            </div>
            <div className="flex-1 bg-slate-200 overflow-hidden relative"><iframe src={`${trip.indicaciones_pdf_url}#toolbar=0&navpanes=0&scrollbar=0`} className="w-full h-full border-0" title="Visor PDF" /></div>
        </div>
      )}

      {/* MODAL DE REGISTRO DE ODÓMETRO (NUEVO) */}
      {showOdometerModal && (
        <div className="fixed inset-0 z-[2200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 relative overflow-hidden">
                <div className="flex flex-col items-center mb-6">
                    <div className="bg-blue-100 p-4 rounded-full mb-3 shadow-sm">
                        <Gauge className="h-10 w-10 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight text-center">
                        Registro de Odómetro
                    </h3>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">
                        {showOdometerModal.type === 'START' ? 'Kilometraje Inicial' : 'Kilometraje Final'}
                    </p>
                </div>
                
                <div className="mb-6">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Ingrese Valor (KM)</label>
                    <input 
                        type="number"
                        autoFocus
                        value={odometerValue}
                        onChange={(e) => setOdometerValue(e.target.value)}
                        placeholder="000000"
                        className="w-full text-center text-3xl font-black py-3 border-b-4 border-blue-500 focus:border-blue-700 outline-none bg-slate-50 rounded-t-lg"
                    />
                </div>

                <div className="flex space-x-3">
                    <button 
                        onClick={() => { setShowOdometerModal(null); setOdometerValue(''); }}
                        className="flex-1 bg-slate-200 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-300"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSaveOdometer}
                        disabled={isProcessing}
                        className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 shadow-lg"
                    >
                        {isProcessing ? <Loader className="h-5 w-5 animate-spin mx-auto" /> : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL DE GASTOS */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-[2200] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
            <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-10 overflow-hidden flex flex-col max-h-[90vh]">
                <div className={`px-6 py-4 flex justify-between items-center text-white shrink-0 ${
                    currentExpenseCategory === 'OPERATIVO' ? 'bg-indigo-600' : 
                    currentExpenseCategory === 'GASTOS' ? 'bg-emerald-600' : 'bg-orange-600'
                }`}>
                    <h3 className="font-black text-lg uppercase flex items-center">
                        {currentExpenseCategory === 'OPERATIVO' && <Briefcase className="h-5 w-5 mr-2"/>}
                        {currentExpenseCategory === 'GASTOS' && <Wallet className="h-5 w-5 mr-2"/>}
                        {currentExpenseCategory === 'MANTENIMIENTO' && <Wrench className="h-5 w-5 mr-2"/>}
                        {isCombustible ? 'Registro de Combustible' : `Registrar ${currentExpenseCategory}`}
                    </h3>
                    <button onClick={() => setShowExpenseModal(false)} className="p-1 hover:bg-white/20 rounded-full"><X className="h-6 w-6" /></button>
                </div>
                
                <div className="p-6 overflow-y-auto">
                    {/* FORMULARIO ESPECÍFICO PARA COMBUSTIBLE */}
                    {isCombustible ? (
                        <div className="space-y-4 animate-in fade-in">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Odómetro Actual</label>
                                <div className="relative">
                                    <Gauge className="absolute left-3 top-3 h-5 w-5 text-emerald-500" />
                                    <input 
                                        type="number" 
                                        placeholder="000000" 
                                        className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-10 pr-3 py-3 text-lg font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={fuelOdometer}
                                        onChange={(e) => setFuelOdometer(e.target.value)}
                                    />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Litros</label>
                                    <div className="relative">
                                        <Fuel className="absolute left-3 top-3 h-5 w-5 text-emerald-500" />
                                        <input 
                                            type="number" 
                                            placeholder="0.00" 
                                            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-10 pr-3 py-3 text-base font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                                            value={fuelLiters}
                                            onChange={(e) => setFuelLiters(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Precio x Litro</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-3 text-emerald-500 font-bold">$</span>
                                        <input 
                                            type="number" 
                                            placeholder="0.00" 
                                            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-3 text-base font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                                            value={fuelPrice}
                                            onChange={(e) => setFuelPrice(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex justify-between items-center">
                                <span className="text-sm font-bold text-emerald-800 uppercase">Importe Total</span>
                                <span className="text-2xl font-black text-emerald-700">${fuelTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    ) : (
                        /* FORMULARIO GENÉRICO PARA OTROS GASTOS */
                        <div className="space-y-4">
                            {expenseRows.map((row, index) => (
                                <div key={index} className="flex gap-2 items-start animate-in fade-in slide-in-from-bottom-2">
                                    <div className="flex-grow space-y-3">
                                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                                            <input 
                                                type="text" 
                                                placeholder="Categoría / Concepto" 
                                                className="w-full bg-transparent text-sm font-black text-slate-700 outline-none"
                                                value={row.concept}
                                                onChange={(e) => handleExpenseChange(index, 'concept', e.target.value)}
                                            />
                                        </div>
                                        
                                        {/* Nuevo campo de Descripción Manual solicitado */}
                                        <div className="relative">
                                            <Edit3 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                            <input 
                                                type="text" 
                                                placeholder="Descripción detallada (Opcional)" 
                                                className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={row.description || ''}
                                                onChange={(e) => handleExpenseChange(index, 'description', e.target.value)}
                                            />
                                        </div>

                                        <div className="relative">
                                            <span className="absolute left-3 top-2 text-slate-400 font-bold">$</span>
                                            <input 
                                                type="number" 
                                                placeholder="0.00" 
                                                className="w-full bg-white border border-slate-300 rounded-lg pl-6 pr-3 py-2 text-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                                                value={row.amount}
                                                onChange={(e) => handleExpenseChange(index, 'amount', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    {expenseRows.length > 1 && (
                                        <button onClick={() => handleRemoveExpenseRow(index)} className="mt-1 p-2 text-red-500 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200">
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button onClick={handleAddExpenseRow} className="mt-4 w-full py-2 border-2 border-dashed border-slate-300 text-slate-500 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-400 transition-colors flex items-center justify-center text-sm">
                                <Plus className="h-4 w-4 mr-2" /> AGREGAR OTRO CONCEPTO
                            </button>
                        </div>
                    )}

                    {/* SECCIÓN DE EVIDENCIAS FOTOGRÁFICAS EN EL MODAL */}
                    <div className="mt-6 border-t border-slate-100 pt-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                            {isCombustible ? 'Comprobante / Ticket (Obligatorio)' : 'Evidencia (Opcional)'}
                        </p>
                        <button 
                            onClick={() => expenseFileInputRef.current?.click()}
                            disabled={isUploadingExpenseEvidence}
                            className={`w-full py-3 rounded-xl border-2 border-blue-100 bg-blue-50 text-blue-600 font-bold flex items-center justify-center hover:bg-blue-100 transition-all ${isUploadingExpenseEvidence ? 'opacity-50 cursor-wait' : ''}`}
                        >
                             {isUploadingExpenseEvidence ? <Loader className="h-5 w-5 animate-spin mr-2" /> : <Camera className="h-5 w-5 mr-2" />}
                             {isUploadingExpenseEvidence ? 'SUBIENDO...' : 'ADJUNTAR FOTO / TICKET'}
                        </button>
                        
                        {expenseEvidence.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 mt-3">
                                {expenseEvidence.map((ev) => (
                                    <div key={ev.id} className="relative group">
                                        <SafeImage src={ev.url} alt="Evidencia Gasto" className="aspect-square rounded-lg border border-slate-200" />
                                        <button 
                                            onClick={() => handleRemoveExpenseEvidence(ev.id)}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0">
                    <button 
                        onClick={handleSaveExpense} 
                        disabled={isSavingExpense || isUploadingExpenseEvidence}
                        className={`w-full py-4 rounded-xl text-white font-black text-lg shadow-lg flex items-center justify-center active:scale-[0.98] transition-all ${
                            isSavingExpense ? 'bg-slate-400 cursor-wait' : 'bg-slate-900 hover:bg-slate-800'
                        }`}
                    >
                        {isSavingExpense ? <Loader className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
                        GUARDAR REGISTRO
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
