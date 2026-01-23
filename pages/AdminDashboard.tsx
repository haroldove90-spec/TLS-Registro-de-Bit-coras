
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
        yPos += 8;

        const generalInfo = [
            ["Cliente:", trip.client],
            ["Proyecto:", trip.project],
            ["Origen:", trip.origin],
            ["Link Maps:", trip.originMapsLink || "No disponible"],
            ["Cita Carga:", `${trip.date} - ${trip.appointment}`] // Combinado para ahorrar fila
        ];

        autoTable(doc, {
            startY: yPos,
            body: generalInfo,
            theme: 'plain',
            styles: { fontSize: 8, cellPadding: 1, minCellHeight: 4 }, // Muy compacto
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } }
        });

        // 2. DESTINOS / PARADAS
        yPos = (doc as any).lastAutoTable.finalY + 8;
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setFillColor(241, 245, 249);
        doc.rect(14, yPos - 4, 182, 6, 'F');
        doc.text("2. ITINERARIO Y DESTINOS", 16, yPos);
        yPos += 8;

        const destinations = trip.destinations && trip.destinations.length > 0 
            ? trip.destinations 
            : [{ id: 'main', name: trip.destination, mapsLink: trip.destinationMapsLink }];

        destinations.forEach((dest, idx) => {
             // Control de salto de página
             if (yPos > 270) {
                 doc.addPage();
                 yPos = 20;
             }

             // Encabezado de Parada
             doc.setFontSize(9);
             doc.setFont("helvetica", "bold");
             doc.setTextColor(30, 58, 138); // Blue 800
             doc.text(`DESTINO #${idx + 1}: ${dest.name}`, 14, yPos);
             yPos += 4;
             
             const destData = [
                 ["Link Maps:", dest.mapsLink || "No disponible"]
             ];

             if (idx === 0) {
                 destData.push(["Indicaciones:", trip.instructions || "Sin indicaciones"]);
                 destData.push(["PDF Adjunto:", trip.indicaciones_pdf_url ? "SÍ" : "NO"]);
             } else {
                 destData.push(["No. Viaje / Ref:", dest.tripNumber || "N/A"]); // Nuevo campo en PDF
                 destData.push(["Cliente:", dest.client || "N/A"]);
                 // Combinar campos para ahorrar líneas
                 destData.push(["Origen:", dest.origin || "N/A"]);
                 destData.push(["Cita:", `${dest.date || ''} ${dest.appointment || ''}`]);
                 destData.push(["Indicaciones:", dest.instructions || "N/A"]);
                 destData.push(["PDF:", dest.instructions_pdf_url ? "SÍ" : "NO"]);
             }

             autoTable(doc, {
                startY: yPos,
                body: destData,
                theme: 'grid',
                styles: { fontSize: 7, cellPadding: 1 }, // Extremadamente compacto
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35, fillColor: [248, 250, 252] } },
                margin: { left: 14 }
             });

             yPos = (doc as any).lastAutoTable.finalY + 6;
        });

        // 3. ASIGNACIÓN Y ODÓMETROS
        if (yPos + 30 > 280) { doc.addPage(); yPos = 20; }
        
        doc.setTextColor(0,0,0);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setFillColor(241, 245, 249);
        doc.rect(14, yPos - 4, 182, 6, 'F');
        doc.text("3. ASIGNACIÓN DE UNIDAD Y ODÓMETRO", 16, yPos);
        yPos += 8;

        autoTable(doc, {
            startY: yPos,
            body: [
                ["Unidad:", trip.plate],
                ["Estatus:", trip.status],
                ["Operador:", "Roberto Gómez (ID: OP-01)"],
                ["Odómetro Inicial:", trip.odometerStart ? `${trip.odometerStart} KM` : "NO REGISTRADO"],
                ["Odómetro Final:", trip.odometerEnd ? `${trip.odometerEnd} KM` : "NO REGISTRADO"]
            ],
            theme: 'plain',
            styles: { fontSize: 8, cellPadding: 1 },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } }
        });

        // 4. GASTOS DE COMBUSTIBLE Y OTROS (NUEVA SECCIÓN EN PDF)
        if (trip.extraCosts && trip.extraCosts.length > 0) {
            yPos = (doc as any).lastAutoTable.finalY + 8;
            if (yPos + 30 > 280) { doc.addPage(); yPos = 20; }

            doc.setFillColor(241, 245, 249);
            doc.rect(14, yPos - 4, 182, 6, 'F');
            doc.text("4. REGISTRO DE GASTOS Y COMBUSTIBLE", 16, yPos);
            yPos += 8;

            const expenseData: any[] = [];
            trip.extraCosts.forEach(record => {
                record.items.forEach(item => {
                    let desc = item.concept;
                    
                    // Lógica visual para Reporte Urgente en PDF
                    if (desc.includes('Reporte urgente')) {
                        desc = `!!! URGENTE !!! ${desc}`;
                    }

                    // Agregar detalles de combustible si existen
                    if (item.liters && item.pricePerLiter) {
                        desc += ` (${item.liters}L a $${item.pricePerLiter}/L - Odo: ${item.odometer})`;
                    }
                    expenseData.push([
                        record.category,
                        desc,
                        `$${item.amount.toFixed(2)}`
                    ]);
                });
            });

            autoTable(doc, {
                startY: yPos,
                head: [['Categoría', 'Concepto / Detalle', 'Monto']],
                body: expenseData,
                theme: 'striped',
                styles: { fontSize: 7, cellPadding: 1 }, // Reducido para intentar caber en 1 hoja
                columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } }
            });
        }

        doc.save(`Orden_Servicio_${trip.code}.pdf`);
        playSound('success');

    } catch (error) {
        console.error("Error generating Order PDF", error);
        alert("Error generando el PDF.");
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); 
    
    if (isSubmitting || isSubmittingRef.current) return; 
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
        const targets = newTrip.plate === 'ALL' ? MOCK_OPERATORS.map(op => op.plate) : [newTrip.plate];
        
        for (const plate of targets) {
            const tripId = generateUUID();
            
            // Usar el código ingresado o generar uno si está vacío
            const finalCode = newTrip.code.trim() !== '' ? newTrip.code : `VIA-TLS-${Math.floor(Math.random() * 1000)}`;

            const createdTrip: Trip = {
                id: tripId,
                code: finalCode,
                origin: 'CEDIS Tultitlán',
                originMapsLink: newTrip.originMapsLink,         
                destination: newTrip.destinations[0]?.name || 'Varias Paradas', 
                destinationMapsLink: newTrip.destinations[0]?.mapsLink || '', 
                destinations: [...newTrip.destinations],
                client: newTrip.client,
                project: newTrip.project,
                appointment: newTrip.appointment,
                instructions: newTrip.instructions,
                indicaciones_pdf_url: newTrip.indicaciones_pdf_url,
                status: TripStatus.PENDING_ACCEPTANCE,
                date: newTrip.scheduledDate, 
                cargoType: 'General',
                plate: plate,
                currentStageIndex: 0,
                hasIncident: false,
                evidence: [],
                evidenceStatus: 'NONE',
                locationHistory: [],
                extraCosts: [] // Inicializar array de gastos
            };
            
            const { error } = await supabase.from('viajes').insert({
                 id: createdTrip.id,
                 code: createdTrip.code,
                 origin: createdTrip.origin,
                 destination: createdTrip.destination,
                 client: createdTrip.client,
                 project: createdTrip.project,
                 appointment: createdTrip.appointment,
                 status: createdTrip.status,
                 plate: createdTrip.plate,
                 current_stage: createdTrip.currentStageIndex,
                 destinos_lista: createdTrip.destinations,
                 instructions: createdTrip.instructions,
                 indicaciones_pdf_url: createdTrip.indicaciones_pdf_url,
                 scheduled_date: createdTrip.date 
            });

            // NOTIFICAR AL OPERADOR
            await supabase.from('notificaciones').insert({
                target_role: 'OPERATOR',
                target_user_id: plate,
                title: '🚨 NUEVO VIAJE ASIGNADO',
                message: `Cliente: ${createdTrip.client} | Destino: ${createdTrip.destination}`,
                type: 'alert'
            });
            
            if (error) {
                console.error("Error creating trip in Supabase:", error);
            }
        }
        
        setNewTrip({ 
          code: '',
          client: '', 
          project: '', 
          originMapsLink: '', 
          scheduledDate: new Date().toISOString().split('T')[0],
          appointment: '', 
          instructions: '', 
          indicaciones_pdf_url: '', 
          plate: '52-AK-8F',
          destinations: [{ id: Date.now().toString(), name: '', mapsLink: '', currentStageIndex: 0, status: 'PENDING' as const, instructions: '', instructions_pdf_url: '', tripNumber: '' }]
        });
        
        setActiveTab('MONITOR');

    } catch (err) {
        console.error("Critical error during trip creation", err);
    } finally {
        setIsSubmitting(false);
        isSubmittingRef.current = false;
    }
  };

  const filteredTrips = trips.filter(trip => 
    trip.client.toLowerCase().includes(filterText.toLowerCase()) ||
    trip.project.toLowerCase().includes(filterText.toLowerCase()) ||
    trip.code.toLowerCase().includes(filterText.toLowerCase()) ||
    trip.plate.toLowerCase().includes(filterText.toLowerCase())
  );

  const inputStyle = "w-full bg-gray-100 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white block p-3 transition-colors outline-none placeholder-gray-500";
  const labelStyle = "block text-sm font-bold text-gray-700 mb-1.5";
  
  const getLastLocation = (trip: Trip) => {
    if (!trip.locationHistory || trip.locationHistory.length === 0) return null;
    return trip.locationHistory[trip.locationHistory.length - 1];
  };

  const lastLocation = selectedTripForMonitor ? getLastLocation(selectedTripForMonitor) : null;

  return (
    <div className="min-h-screen bg-slate-100 p-4 lg:p-6 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="flex space-x-2">
              <button onClick={() => setActiveTab('MONITOR')} className={`px-4 py-2 rounded-lg font-bold transition-colors ${activeTab === 'MONITOR' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Lista de Bitácoras</button>
              <button onClick={() => setActiveTab('CREATE')} className={`px-4 py-2 rounded-lg font-bold transition-colors flex items-center ${activeTab === 'CREATE' ? 'bg-blue-700 text-white' : 'bg-white text-blue-700 hover:bg-blue-50'}`}><Plus className="h-4 w-4 mr-2" /> Alta de Viaje</button>
              <button onClick={() => setActiveTab('HISTORY')} className={`px-4 py-2 rounded-lg font-bold transition-colors flex items-center ${activeTab === 'HISTORY' ? 'bg-emerald-700 text-white' : 'bg-white text-emerald-700 hover:bg-emerald-50'}`}><Archive className="h-4 w-4 mr-2" /> Historial</button>
          </div>
      </div>

      {activeTab === 'CREATE' && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 max-w-2xl mx-auto overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-blue-700 p-4 text-white flex justify-between items-center"><h3 className="font-bold text-lg flex items-center"><Plus className="h-5 w-5 mr-2" /> Nuevo Viaje</h3><button onClick={() => setActiveTab('MONITOR')} className="hover:bg-blue-600 rounded p-1 transition-colors"><X className="h-5 w-5" /></button></div>
              <form onSubmit={handleCreateTrip} className="p-6 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Campo Número de Viaje Manual */}
                      <div><label className={labelStyle}>Número de Viaje / Folio</label><div className="relative"><Hash className="absolute left-3 top-3 h-5 w-5 text-gray-400" /><input required type="text" className={`${inputStyle} pl-10`} placeholder="Ej. VIA-12345" value={newTrip.code} onChange={e => setNewTrip({...newTrip, code: e.target.value})} /></div></div>
                      
                      <div><label className={labelStyle}>Cliente</label><input required type="text" className={inputStyle} placeholder="Ej. Ford Motor Co." value={newTrip.client} onChange={e => setNewTrip({...newTrip, client: e.target.value})} /></div>
                      <div><label className={labelStyle}>Proyecto</label><input required type="text" className={inputStyle} placeholder="Ej. Just In Time" value={newTrip.project} onChange={e => setNewTrip({...newTrip, project: e.target.value})} /></div>
                      <div className="md:col-span-1"><label className={labelStyle}>Lugar de Carga (Link Maps)</label><div className="relative"><MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" /><input type="url" className={`${inputStyle} pl-10`} placeholder="https://maps.app.goo.gl/..." value={newTrip.originMapsLink} onChange={e => setNewTrip({...newTrip, originMapsLink: e.target.value})} /></div></div>
                      
                      <div className="md:col-span-2 grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelStyle}>Fecha de Carga</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-3 h-5 w-5 text-gray-400 pointer-events-none" />
                                <input 
                                    required 
                                    type="date" 
                                    className={`${inputStyle} pl-10`} 
                                    value={newTrip.scheduledDate} 
                                    onChange={e => setNewTrip({...newTrip, scheduledDate: e.target.value})} 
                                />
                            </div>
                        </div>
                        <div>
                            <label className={labelStyle}>Hora de Carga</label>
                            <input required type="time" className={inputStyle} value={newTrip.appointment} onChange={e => setNewTrip({...newTrip, appointment: e.target.value})} />
                        </div>
                      </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <div className="bg-slate-50 -mx-6 px-6 py-3 border-b border-gray-100 mb-2">
                      <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center">
                        <Navigation className="h-4 w-4 mr-2 text-blue-600" /> DESTINOS / PARADAS
                      </h4>
                    </div>

                    <div className="space-y-4">
                      {newTrip.destinations.map((dest, idx) => (
                        <div key={dest.id} className="bg-white p-4 rounded-xl border-2 border-slate-200 relative group animate-in slide-in-from-right-2 duration-200 shadow-sm">
                          <div className="absolute -left-3 top-4 w-8 h-8 bg-slate-800 text-white text-xs font-black rounded-full flex items-center justify-center shadow-lg border-2 border-white">#{idx + 1}</div>
                          {newTrip.destinations.length > 1 && (
                            <button 
                              type="button" 
                              onClick={() => handleRemoveDestination(dest.id)}
                              className="absolute -right-2 -top-2 bg-red-100 text-red-600 p-1.5 rounded-full border border-red-200 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}

                          {idx > 0 && (
                            <div className="mb-4 pb-4 border-b border-gray-100 bg-blue-50/50 p-3 rounded-lg">
                                <h5 className="text-[10px] font-bold text-blue-600 uppercase mb-3 flex items-center"><Share2 className="h-3 w-3 mr-1"/> Detalles de Logística - Destino #{idx + 1}</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Número de Viaje</label>
                                        <div className="relative"><Hash className="absolute left-2 top-2 h-4 w-4 text-gray-400"/><input type="text" className={`${inputStyle} py-2 pl-8 text-xs`} placeholder="Ej. REM-9988" value={dest.tripNumber || ''} onChange={e => updateDestination(dest.id, 'tripNumber', e.target.value)} /></div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Cliente</label>
                                        <div className="relative"><Building2 className="absolute left-2 top-2 h-4 w-4 text-gray-400"/><input type="text" className={`${inputStyle} py-2 pl-8 text-xs`} placeholder="Ej. DHL" value={dest.client || ''} onChange={e => updateDestination(dest.id, 'client', e.target.value)} /></div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Lugar de Carga (Origen)</label>
                                        <div className="relative"><MapPin className="absolute left-2 top-2 h-4 w-4 text-gray-400"/><input type="text" className={`${inputStyle} py-2 pl-8 text-xs`} placeholder="Ej. Almacén Central" value={dest.origin || ''} onChange={e => updateDestination(dest.id, 'origin', e.target.value)} /></div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Fecha Carga</label>
                                        <input type="date" className={`${inputStyle} py-2 text-xs`} value={dest.date || ''} onChange={e => updateDestination(dest.id, 'date', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Hora Cita</label>
                                        <input type="time" className={`${inputStyle} py-2 text-xs`} value={dest.appointment || ''} onChange={e => updateDestination(dest.id, 'appointment', e.target.value)} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Indicaciones Específicas</label>
                                        <div className="flex gap-2">
                                          <div className="relative flex-grow">
                                            <MessageSquare className="absolute left-2 top-2 h-4 w-4 text-gray-400"/>
                                            <input type="text" className={`${inputStyle} py-2 pl-8 text-xs`} placeholder="Ej. Contactar a seguridad en puerta 2" value={dest.instructions || ''} onChange={e => updateDestination(dest.id, 'instructions', e.target.value)} />
                                          </div>
                                          <label className="shrink-0 bg-white border border-blue-200 p-2 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors flex items-center justify-center shadow-sm">
                                            <Paperclip className={`h-4 w-4 ${dest.instructions_pdf_url ? 'text-green-600' : 'text-slate-400'}`} />
                                            <input type="file" accept="application/pdf" className="hidden" onChange={(e) => handlePdfUpload(e, dest.id)} />
                                          </label>
                                        </div>
                                        {uploadingPdfId === dest.id && <p className="text-[10px] text-blue-600 font-bold mt-1 animate-pulse">Subiendo PDF...</p>}
                                        {dest.instructions_pdf_url && <p className="text-[10px] text-green-600 font-bold mt-1 flex items-center"><Check className="h-3 w-3 mr-1" /> PDF de parada adjuntado</p>}
                                    </div>
                                </div>
                            </div>
                          )}
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-2">
                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">PARADA #{idx+1}: DESTINO (NOMBRE)</label>
                              <input required type="text" className={inputStyle} placeholder="Ej. Planta Ford Izcalli" value={dest.name} onChange={e => updateDestination(dest.id, 'name', e.target.value)} />
                            </div>
                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">DESTINO (LINK MAPS)</label>
                              <div className="relative">
                                <Link className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <input type="url" className={`${inputStyle} pl-9`} placeholder="https://maps.app.goo.gl/..." value={dest.mapsLink} onChange={e => updateDestination(dest.id, 'mapsLink', e.target.value)} />
                              </div>
                            </div>
                          </div>

                          {idx === 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <label className={labelStyle}>Indicaciones Generales (Viaje Principal)</label>
                                <div className="flex gap-2">
                                    <input className={inputStyle} placeholder="Puerta 4, EPP obligatorio..." value={newTrip.instructions} onChange={e => setNewTrip({...newTrip, instructions: e.target.value})} />
                                    <label className="shrink-0 bg-slate-100 border border-gray-300 p-3 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors flex items-center justify-center">
                                    <Paperclip className={`h-5 w-5 ${newTrip.indicaciones_pdf_url ? 'text-green-600' : 'text-gray-500'}`} />
                                    <input type="file" accept="application/pdf" className="hidden" onChange={(e) => handlePdfUpload(e, 'GENERAL')} />
                                    </label>
                                </div>
                                {uploadingPdfId === 'GENERAL' && <p className="text-[10px] text-blue-600 font-bold mt-1 animate-pulse">Subiendo PDF...</p>}
                                {newTrip.indicaciones_pdf_url && <p className="text-[10px] text-green-600 font-bold mt-1 flex items-center"><Check className="h-3 w-3 mr-1" /> PDF Adjuntado Correctamente</p>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                        type="button"
                        onClick={handleAddDestination}
                        className="w-full mt-4 py-3 rounded-xl border-2 border-dashed border-blue-200 text-blue-600 font-bold hover:bg-blue-50 hover:border-blue-400 transition-all flex items-center justify-center"
                    >
                        <Plus className="h-5 w-5 mr-2" /> AGREGAR DESTINO
                    </button>

                  </div>

                  <div className="pt-5 border-t border-gray-100">
                    <label className={labelStyle}>Asignación de Unidad</label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <select className={`${inputStyle} flex-grow`} value={newTrip.plate} onChange={e => setNewTrip({...newTrip, plate: e.target.value})}>
                        {MOCK_OPERATORS.map(op => (<option key={op.id} value={op.plate}>{op.plate} - {op.name} ({op.status})</option>))}
                      </select>
                      <button type="button" onClick={() => setNewTrip({...newTrip, plate: 'ALL'})} className={`px-6 py-3 rounded-lg text-sm font-bold flex items-center justify-center transition-colors shadow-sm whitespace-nowrap ${newTrip.plate === 'ALL' ? 'bg-slate-800 text-white ring-2 ring-offset-2 ring-slate-800' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                        <Users className="h-4 w-4 mr-2" /> Asignación Masiva
                      </button>
                    </div>
                  </div>
                  <button type="submit" disabled={isSubmitting} className={`w-full text-white font-bold py-4 rounded-xl shadow-lg mt-2 flex justify-center items-center transition-transform active:scale-[0.99] ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'}`}>
                    {isSubmitting ? <Loader className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
                    {isSubmitting ? 'PROCESANDO...' : 'CREAR ORDEN Y NOTIFICAR'}
                  </button>
              </form>
          </div>
      )}

      {activeTab === 'HISTORY' && (
          <div className="space-y-6">
              <div className="bg-emerald-700 rounded-xl p-6 text-white shadow-lg flex justify-between items-center animate-in slide-in-from-top-4">
                  <div>
                    <h3 className="text-2xl font-black mb-2">Historial de Viajes</h3>
                    <p className="text-emerald-100 font-medium">Consulta y descarga de órdenes de servicio completas.</p>
                  </div>
                  <div className="bg-emerald-600 p-3 rounded-full shadow-inner"><Archive className="h-8 w-8" /></div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Fecha / Folio</th>
                            <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Cliente</th>
                            <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Ruta</th>
                            <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Unidad</th>
                            <th className="px-6 py-4 text-right text-xs font-black text-gray-500 uppercase tracking-wider">Descargas</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {trips.length === 0 ? (
                             <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400 font-bold">No hay registros en el historial</td></tr>
                        ) : (
                            // Ordenar por fecha descendente para el historial
                            [...trips].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(trip => (
                                <tr key={trip.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-bold text-gray-900">{trip.date}</div>
                                        <div className="text-xs text-gray-500 font-medium">{trip.code}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-bold text-gray-900">{trip.client}</div>
                                        <div className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full inline-block mt-1">{trip.project}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs font-medium text-gray-500 flex items-center"><MapPin className="h-3 w-3 mr-1 text-red-400"/> {trip.origin}</div>
                                        <div className="h-4 border-l border-dashed border-gray-300 ml-1.5 my-0.5"></div>
                                        <div className="text-xs font-medium text-gray-900 flex items-center"><MapPin className="h-3 w-3 mr-1 text-blue-600"/> {trip.destination}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-8 w-8 bg-slate-100 rounded-full flex items-center justify-center mr-3">
                                                <Truck className="h-4 w-4 text-slate-600" />
                                            </div>
                                            <span className="text-sm font-bold text-slate-700">{trip.plate}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <button 
                                            onClick={() => generateOrderPDF(trip)}
                                            disabled={isGeneratingPdf}
                                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-xs font-bold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none active:scale-95 transition-all"
                                        >
                                            {isGeneratingPdf ? <Loader className="h-4 w-4 animate-spin mr-2" /> : <FileJson className="h-4 w-4 mr-2" />}
                                            Orden de Servicio (PDF)
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
              </div>
          </div>
      )}

      {activeTab === 'MONITOR' && (
          <>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col sm:flex-row gap-4 items-center">
                <div className="relative flex-grow w-full"><Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" /><input type="text" placeholder="Buscar por Operario, Placas, Cliente..." value={filterText} onChange={(e) => setFilterText(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                <div className="flex items-center space-x-2"><button onClick={() => setAudioEnabled(!audioEnabled)} className={`text-xs font-bold px-3 py-2 rounded-lg border ${audioEnabled ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>Audio: {audioEnabled ? 'ON' : 'OFF'}</button></div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidad</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estatus</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente / Destino</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Evidencia</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th></tr></thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredTrips.map((trip) => (
                        <tr key={trip.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedTripForMonitor(trip)}>
                          <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center"><div className="flex-shrink-0 h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center"><Truck className="h-6 w-6 text-slate-600" /></div><div className="ml-4"><div className="text-sm font-bold text-gray-900">{trip.plate}</div><div className="text-xs text-gray-500">{trip.code}</div></div></div></td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                              ${trip.hasIncident ? 'bg-red-100 text-red-800 animate-pulse' : 
                                trip.status === TripStatus.PENDING_ACCEPTANCE ? 'bg-amber-100 text-amber-800' : 
                                trip.status === TripStatus.ACCEPTED ? 'bg-blue-100 text-blue-800' :
                                trip.status === TripStatus.IN_TRANSIT ? 'bg-indigo-100 text-indigo-800' :
                                trip.status === TripStatus.COMPLETED ? 'bg-gray-100 text-gray-800' : 
                                'bg-green-100 text-green-800'}`}>
                                {trip.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900 font-medium">{trip.client}</div><div className="text-xs text-gray-500 max-w-[150px] truncate">{trip.destination}</div></td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {trip.evidenceStatus === 'PENDING' ? (
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTripForMonitor(trip);
                                    }}
                                    className="flex items-center text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full animate-pulse border border-yellow-200 hover:bg-yellow-100 hover:shadow-sm transition-all"
                                >
                                    <Camera className="h-3 w-3 mr-1" /> REVISIÓN
                                </button>
                            ) : trip.evidenceStatus === 'REJECTED' ? (
                                <span className="flex items-center text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full border border-red-200"><X className="h-3 w-3 mr-1" /> RECHAZADO</span>
                            ) : (<span className="text-xs text-gray-400">---</span>)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-3">
                              <button 
                                onClick={(e) => handleDeleteClick(e, trip.id)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                title="Eliminar Viaje"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setSelectedTripForMonitor(trip); }} className="text-blue-600 hover:text-blue-900 flex items-center"><Eye className="h-4 w-4 mr-1" /> Monitor</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                </table>
            </div>
          </>
      )}

      {selectedImage && (
          <div className="fixed inset-0 z-[2100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedImage(null)}><button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full"><X className="h-8 w-8" /></button><img src={selectedImage} className="max-w-full max-h-full object-contain rounded shadow-2xl" alt="Full screen" onClick={(e) => e.stopPropagation()} /></div>
      )}

      {selectedTripForMonitor && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center shrink-0">
                    <div>
                        <div className="flex items-center space-x-2">
                            <h2 className="text-lg font-bold tracking-tight">{selectedTripForMonitor.plate}</h2>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${selectedTripForMonitor.status === TripStatus.INCIDENT ? 'bg-red-500' : 'bg-blue-600'}`}>
                                {selectedTripForMonitor.status}
                            </span>
                        </div>
                        <p className="text-slate-400 text-xs">{selectedTripForMonitor.client}</p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                        {/* Se eliminó el botón de reporte operativo antiguo de aquí para evitar confusión con la nueva orden de servicio */}
                        <button 
                            onClick={() => setSelectedTripForMonitor(null)} 
                            className="p-2 bg-white/10 hover:bg-red-500 rounded-full transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                
                {/* BARRA DE INFORMACIÓN DE ODÓMETRO (NUEVA) */}
                <div className="bg-slate-800 px-5 py-2 flex justify-between items-center border-t border-slate-700">
                    <div className="flex items-center space-x-2 text-xs text-slate-300">
                        <Gauge className="h-4 w-4 text-emerald-400" />
                        <span>Inicio: <strong className="text-white">{selectedTripForMonitor.odometerStart ? `${selectedTripForMonitor.odometerStart} KM` : '---'}</strong></span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-300">
                         <Gauge className="h-4 w-4 text-red-400" />
                        <span>Fin: <strong className="text-white">{selectedTripForMonitor.odometerEnd ? `${selectedTripForMonitor.odometerEnd} KM` : '---'}</strong></span>
                    </div>
                </div>

                {lastLocation && (
                    <div className="bg-blue-50 border-b border-blue-100 px-5 py-3 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="bg-blue-200 p-2 rounded-full">
                                <Share2 className="h-4 w-4 text-blue-800" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Última Ubicación Compartida</p>
                                <p className="text-xs font-bold text-slate-700">
                                    {new Date(lastLocation.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {lastLocation.label || 'Reporte Manual'}
                                </p>
                            </div>
                        </div>
                        <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${lastLocation.lat},${lastLocation.lng}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-[10px] font-bold text-blue-600 bg-white border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-600 hover:text-white transition-colors"
                        >
                            VER MAPA
                        </a>
                    </div>
                )}
                
                <div className="flex-1 overflow-y-auto bg-slate-50 relative">
                    {selectedTripForMonitor.evidenceStatus === 'PENDING' && (
                        <div className="bg-white border-b border-yellow-200 p-4 sticky top-0 z-10 shadow-sm">
                            <div className="flex items-center mb-2 text-yellow-700 font-bold uppercase text-xs">
                                <AlertCircle className="h-4 w-4 mr-2" /> Validación Requerida
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                                {selectedTripForMonitor.evidence
                                    .filter(e => e.stageIndex === selectedTripForMonitor.currentStageIndex) 
                                    .map(e => (<SafeImage key={e.id} src={e.url} alt="review" className="w-full h-24 rounded-lg border border-slate-200 object-cover" onClick={() => setSelectedImage(e.url)} />))
                                }
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setShowRejectionMenu(true)} className="flex-1 bg-white border border-red-200 text-red-600 text-xs font-bold py-2 rounded-lg hover:bg-red-50">RECHAZAR</button>
                                <button onClick={() => handleApproveEvidence(selectedTripForMonitor)} className="flex-1 bg-green-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-green-700 active:scale-95 transition-transform">APROBAR</button>
                            </div>
                             {showRejectionMenu && (
                                <div className="mt-2 bg-slate-50 p-2 rounded border border-slate-200">
                                    <div className="space-y-1">
                                        {REJECTION_REASONS.map(reason => (
                                            <button key={reason} onClick={() => handleRejectEvidence(selectedTripForMonitor, reason)} className="w-full text-left text-xs px-2 py-1.5 bg-white rounded hover:bg-red-50 text-slate-700 hover:text-red-700 border border-transparent hover:border-red-100 block">
                                                {reason}
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={() => setShowRejectionMenu(false)} className="w-full text-center text-[10px] text-slate-400 mt-2 underline">Cancelar</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* SECCIÓN DE GASTOS Y COSTOS */}
                    {selectedTripForMonitor.extraCosts && selectedTripForMonitor.extraCosts.length > 0 && (
                        <div className="bg-white m-5 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200">
                                <h3 className="text-xs font-black text-slate-600 uppercase">Centro de Costos</h3>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {selectedTripForMonitor.extraCosts.map((record, idx) => (
                                    <div key={idx} className="p-3">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                                record.category === 'OPERATIVO' ? 'bg-indigo-100 text-indigo-700' :
                                                record.category === 'GASTOS' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                                            }`}>
                                                {record.category}
                                            </span>
                                            <span className="text-xs text-slate-400">{new Date(record.timestamp).toLocaleDateString()}</span>
                                        </div>
                                        <div className="pl-1 border-l-2 border-slate-200 space-y-1 mt-2">
                                            {record.items.map((item, i) => (
                                                <div key={i} className="flex justify-between text-xs">
                                                    <span className="text-slate-600">
                                                        {item.concept}
                                                        {item.liters && ` (${item.liters}L @ $${item.pricePerLiter})`}
                                                    </span>
                                                    <span className="font-bold text-slate-900">${item.amount.toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        {/* EVIDENCIA FOTOGRÁFICA DEL GASTO */}
                                        {record.evidence && record.evidence.length > 0 && (
                                            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                                                {record.evidence.map((ev, evIdx) => (
                                                    <SafeImage key={evIdx} src={ev.url} alt="Evidencia Gasto" className="h-10 w-10 rounded-lg border border-slate-200 flex-shrink-0" onClick={() => setSelectedImage(ev.url)} />
                                                ))}
                                            </div>
                                        )}

                                        <div className="mt-2 text-right border-t border-slate-50 pt-1">
                                            <span className="text-xs font-black text-slate-800">Total: ${record.total.toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="p-5">
                        <div className="relative pl-2 space-y-0">
                            <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-slate-200 rounded-full -z-10"></div>
                            {TRIP_STAGES.map((stage, index) => {
                                const isCompleted = index < selectedTripForMonitor.currentStageIndex;
                                const isCurrent = index === selectedTripForMonitor.currentStageIndex;

                                return (
                                    <div key={stage.key} className="flex items-center py-2 group">
                                        <div className={`
                                            h-10 w-10 rounded-full flex items-center justify-center border-2 z-10 shrink-0 mr-4 transition-colors duration-300 bg-white
                                            ${isCompleted ? 'border-slate-800 text-slate-800' : 
                                              isCurrent ? 'border-amber-400 text-amber-500 ring-2 ring-amber-100' : 
                                              'border-slate-200 text-slate-300'}
                                        `}>
                                            {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : 
                                             isCurrent ? <div className="h-2.5 w-2.5 bg-amber-500 rounded-full animate-pulse" /> :
                                             <Circle className="h-4 w-4" />}
                                        </div>

                                        <div className={`flex-1 px-4 py-2 rounded-lg border transition-all duration-200 ${
                                            isCurrent ? 'bg-white border-amber-200 shadow-sm translate-x-1' : 'border-transparent'
                                        }`}>
                                            <div className="flex justify-between items-center">
                                                <span className={`text-sm font-bold uppercase tracking-tight ${isCurrent ? 'text-slate-900' : isCompleted ? 'text-slate-500' : 'text-slate-300'}`}>
                                                    {stage.label}
                                                </span>
                                                {isCurrent && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">En curso</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
