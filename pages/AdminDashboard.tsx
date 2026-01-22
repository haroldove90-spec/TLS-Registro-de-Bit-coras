
import React, { useState, useEffect, useRef } from 'react';
import { TRIP_STAGES, MOCK_OPERATORS } from '../constants';
import { Trip, TripStatus, EvidenceStatus, Evidence, LocationReport, TripDestination, ExpenseRecord } from '../types';
import { supabase } from '../supabaseClient';
import { sendPushNotification, playSound } from '../utils';
import { Siren, Search, Filter, CheckCircle, Clock, MapPin, Truck, AlertTriangle, Plus, X, Users, Save, Eye, ChevronRight, FileText, Link, ThumbsUp, ThumbsDown, Camera, AlertCircle, Folder, Download, ZoomIn, Image as ImageIcon, Archive, Map, Fuel, Loader, FileWarning, Paperclip, Check, Trash2, Navigation, Circle, CheckCircle2, Dot, Share2, Calendar, Building2, MessageSquare, Wallet, Wrench, Briefcase, FileJson, Hash, Gauge } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AdminDashboardProps {
  trips: Trip[];
  onUpdateTrip: (trip: Trip) => void;
  onAddTrip: (trip: Trip) => void;
  onDeleteTrip: (tripId: string) => void;
}

const REJECTION_REASONS = [
    "Foto borrosa / No visible",
    "Ángulo incorrecto",
    "Documento incompleto",
    "Unidad no visible",
    "Poca iluminación",
    "Ubicación no coincide"
];

const getDataUrl = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg'));
      } else {
        reject('Canvas context failed');
      }
    };
    img.onerror = (error) => reject(error);
  });
};

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const SafeImage: React.FC<{ src: string; alt: string; className: string; onClick?: () => void }> = ({ src, alt, className, onClick }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  return (
    <div className={`relative overflow-hidden flex items-center justify-center ${className} bg-slate-100 cursor-pointer transition-transform hover:scale-[1.02]`} onClick={onClick}>
      {loading && <Loader className="absolute h-5 w-5 animate-spin text-slate-400 z-10" />}
      
      {error ? (
        <div className="flex flex-col items-center justify-center p-2 text-center w-full h-full">
          <FileWarning className="h-5 w-5 text-red-500 mb-1" />
          <button 
            onClick={(e) => { e.stopPropagation(); setError(false); setLoading(true); setRetryCount(prev => prev + 1); }}
            className="text-[8px] font-bold text-blue-600 underline"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <img 
          src={`${src}${retryCount > 0 ? `?retry=${retryCount}` : ''}`} 
          alt={alt} 
          className={`w-full h-full object-cover transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
          onLoad={() => setLoading(false)}
          onError={() => { setError(true); setLoading(false); }}
        />
      )}
    </div>
  );
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ trips, onUpdateTrip, onAddTrip, onDeleteTrip }) => {
  const [activeTab, setActiveTab] = useState<'MONITOR' | 'CREATE' | 'HISTORY'>('MONITOR');
  const [filterText, setFilterText] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [selectedTripForMonitor, setSelectedTripForMonitor] = useState<Trip | null>(null);
  const [showRejectionMenu, setShowRejectionMenu] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null); 
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  
  const [step5Evidence, setStep5Evidence] = useState<Evidence[]>([]);
  
  const [uploadingPdfId, setUploadingPdfId] = useState<string | null>(null);
  const autoAlertsSent = useRef<Set<string>>(new Set());

  const [newTrip, setNewTrip] = useState({
    code: '', 
    client: '',
    project: '',
    originMapsLink: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    appointment: '',
    instructions: '',
    indicaciones_pdf_url: '',
    plate: '52-AK-8F', 
    destinations: [
      { id: Date.now().toString(), name: '', mapsLink: '', currentStageIndex: 0, status: 'PENDING' as const, instructions: '', instructions_pdf_url: '', tripNumber: '' }
    ]
  });

  const criticalTrips = trips.filter(t => t.hasIncident || t.status === TripStatus.DELAYED || t.status === TripStatus.INCIDENT);
  const pendingEvidenceTrips = trips.filter(t => t.evidenceStatus === 'PENDING');

  useEffect(() => {
    if (selectedTripForMonitor) {
        const fetchMonitorData = async () => {
            try {
                const path = `${selectedTripForMonitor.id}/UNLOADED`;
                const { data: files } = await supabase.storage.from('evidencias').list(path);
                
                if (files) {
                    const formattedEvidence: Evidence[] = files.map(file => {
                        const { data: urlData } = supabase.storage.from('evidencias').getPublicUrl(`${path}/${file.name}`);
                        return {
                            id: file.id,
                            tripId: selectedTripForMonitor.id,
                            stageIndex: 4, 
                            url: urlData.publicUrl,
                            fileName: file.name,
                            path: `${path}/${file.name}`,
                            timestamp: new Date(file.created_at).getTime()
                        };
                    });
                    setStep5Evidence(formattedEvidence);
                }
            } catch (err) {
                console.error("Error fetching monitor data", err);
            }
        };
        fetchMonitorData();
    } else {
        setStep5Evidence([]);
    }
  }, [selectedTripForMonitor]);

  useEffect(() => {
    if (criticalTrips.length > 0 && audioEnabled) {
      const audio = new Audio('https://codeskulptor-demos.commondatastorage.googleapis.com/GalaxyInvaders/pause.wav');
      const interval = setInterval(() => {
        audio.play().catch(() => {});
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [criticalTrips.length, audioEnabled]);

  useEffect(() => {
    const checkDelayCron = () => {
        trips.forEach(trip => {
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
                        const diffMs = now.getTime() - appointmentDate.getTime(); 
                        const lateMinutes = Math.floor(diffMs / 60000);

                        if (lateMinutes > 10 && !autoAlertsSent.current.has(trip.id)) {
                            autoAlertsSent.current.add(trip.id);
                            onUpdateTrip({
                                ...trip,
                                status: TripStatus.DELAYED,
                                hasIncident: true 
                            });
                            playSound('alert');
                        }
                    }
                } catch (e) {
                    console.error("Cron Error", e);
                }
            }
        });
    };

    const interval = setInterval(checkDelayCron, 30000); 
    return () => clearInterval(interval);
  }, [trips, onUpdateTrip]);

  const uploadFileToStorage = async (file: File): Promise<string | null> => {
    try {
      const fileName = `documentos/${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage
        .from('evidencias')
        .upload(fileName, file);

      if (error) throw error;
      const { data: urlData } = supabase.storage.from('evidencias').getPublicUrl(fileName);
      return urlData.publicUrl;
    } catch (err: any) {
      console.error("Error al subir archivo:", err);
      alert("Error al subir el documento. Verifique su conexión.");
      return null;
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>, destId: string | 'GENERAL') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPdfId(destId);
    const publicUrl = await uploadFileToStorage(file);
    
    if (publicUrl) {
        if (destId === 'GENERAL') {
            setNewTrip(prev => ({ ...prev, indicaciones_pdf_url: publicUrl }));
        } else {
            setNewTrip(prev => ({
                ...prev,
                destinations: prev.destinations.map(d => d.id === destId ? { ...d, instructions_pdf_url: publicUrl } : d)
            }));
        }
    }
    setUploadingPdfId(null);
  };

  const handleAddDestination = () => {
    setNewTrip(prev => ({
      ...prev,
      destinations: [
        ...prev.destinations,
        { 
            id: (Date.now() + Math.random()).toString(), 
            name: '', 
            mapsLink: '', 
            currentStageIndex: 0, 
            status: 'PENDING' as const,
            client: '',
            origin: '',
            date: new Date().toISOString().split('T')[0],
            appointment: '',
            instructions: '',
            instructions_pdf_url: '',
            tripNumber: ''
        }
      ]
    }));
  };

  const handleRemoveDestination = (id: string) => {
    if (newTrip.destinations.length <= 1) return;
    setNewTrip(prev => ({
      ...prev,
      destinations: prev.destinations.filter(d => d.id !== id)
    }));
  };

  const updateDestination = (id: string, field: string, value: string) => {
    setNewTrip(prev => ({
      ...prev,
      destinations: prev.destinations.map(d => d.id === id ? { ...d, [field]: value } : d)
    }));
  };

  const handleApproveEvidence = async (trip: Trip) => {
    const updatedTrip = { 
        ...trip, 
        evidenceStatus: 'APPROVED' as EvidenceStatus,
        rejectionReason: undefined
    };

    const { error } = await supabase
        .from('viajes')
        .update({ evidence_status: 'APPROVED' })
        .eq('id', trip.id);
    
    // NOTIFICAR AL OPERADOR
    await supabase.from('notificaciones').insert({
        target_role: 'OPERATOR',
        target_user_id: trip.plate,
        title: '✅ EVIDENCIA APROBADA',
        message: 'Tus fotos han sido validadas por la torre de control.',
        type: 'success'
    });

    if (error) {
        console.error("Error updating evidence status in DB", error);
        alert("Error de conexión al aprobar evidencia.");
        return;
    }

    onUpdateTrip(updatedTrip);
    setSelectedTripForMonitor(updatedTrip);
    playSound('success');
  };

  const handleRejectEvidence = async (trip: Trip, reason: string) => {
    const updatedTrip = { 
        ...trip, 
        evidenceStatus: 'REJECTED' as EvidenceStatus, 
        rejectionReason: reason 
    };

    const { error } = await supabase
        .from('viajes')
        .update({ evidence_status: 'REJECTED' })
        .eq('id', trip.id);

    // NOTIFICAR AL OPERADOR
    await supabase.from('notificaciones').insert({
        target_role: 'OPERATOR',
        target_user_id: trip.plate,
        title: '⚠️ EVIDENCIA RECHAZADA',
        message: `Motivo: ${reason}. Por favor captura la evidencia nuevamente.`,
        type: 'alert'
    });

    if (error) {
        console.error("Error rejecting evidence in DB", error);
        alert("Error de conexión al rechazar evidencia.");
        return;
    }

    onUpdateTrip(updatedTrip);
    setSelectedTripForMonitor(updatedTrip); 
    setShowRejectionMenu(false);
    playSound('alert');
  };

  const handleDeleteClick = (e: React.MouseEvent, tripId: string) => {
    e.stopPropagation(); 
    const confirmDelete = window.confirm("⚠️ ¿Estás seguro de ELIMINAR este viaje?\n\nEsta acción no se puede deshacer y borrará todas las evidencias asociadas.");
    if (confirmDelete) {
      onDeleteTrip(tripId);
    }
  };

  // --- PDF DE ORDEN DE SERVICIO OPTIMIZADO PARA 1 PÁGINA ---
  const generateOrderPDF = (trip: Trip) => {
    setIsGeneratingPdf(true);
    try {
        const doc = new jsPDF();
        
        // Encabezado Compacto (24px altura)
        doc.setFillColor(15, 23, 42); 
        doc.rect(0, 0, 210, 24, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16); // Reducido de 22
        doc.setFont("helvetica", "bold");
        doc.text("TBS Logistics Services", 14, 12);
        doc.setFontSize(9); // Reducido de 10
        doc.text("ORDEN DE SERVICIO / BITÁCORA", 14, 18);
        
        doc.text(`FOLIO: ${trip.code}`, 195, 12, { align: "right" });
        doc.text(`FECHA: ${trip.date}`, 195, 18, { align: "right" });

        // 1. INFORMACIÓN GENERAL (Compacto)
        let yPos = 32; 
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10); // Reducido de 12
        doc.setFont("helvetica", "bold");
        doc.setFillColor(241, 245, 249); 
        doc.rect(14, yPos - 4, 182, 6, 'F');
        doc.text("1. INFORMACIÓN GENERAL", 16, yPos);
        yPos += 8