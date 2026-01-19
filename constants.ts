import { ReportOption, Trip, TripStatus, TripStageDef, Operator } from './types';

export const TRIP_STAGES: TripStageDef[] = [
  { key: 'START_TRIP', label: 'Comenzando viaje', order: 1 },
  { key: 'ARRIVING_LOAD', label: 'Llegando a cargar', order: 2 },
  { key: 'LOADED', label: 'Cargado', order: 3 },
  { key: 'WITH_CLIENT', label: 'Con cliente', order: 4 },
  { key: 'UNLOADED', label: 'Descargado', order: 5 },
  { key: 'END_TRIP', label: 'Fin de viaje', order: 6 },
];

export const MOCK_OPERATORS: Operator[] = [
  { id: 'OP-01', name: 'Roberto Gómez', plate: '52-AK-8F', status: 'AVAILABLE' },
  { id: 'OP-02', name: 'Juan Pérez', plate: '88-UE-1A', status: 'BUSY' },
  { id: 'OP-03', name: 'Carlos Ruiz', plate: 'XA-20-99', status: 'AVAILABLE' },
  { id: 'OP-04', name: 'Miguel Ángel', plate: 'BB-11-22', status: 'MAINTENANCE' },
];

export const MOCK_TRIPS: Trip[] = [
  {
    id: '1',
    code: 'VIA-TLS-001',
    origin: 'CEDIS Tultitlán',
    originMapsLink: 'https://maps.app.goo.gl/tultitlan',
    originLat: 19.6450, // Coordinates for Tultitlan
    originLng: -99.1650,
    
    destination: 'Planta Ford, Cuautitlán',
    destinationMapsLink: 'https://maps.app.goo.gl/ford',
    destinationLat: 19.6730, // Coordinates for Cuautitlan
    destinationLng: -99.1900,

    client: 'Automotriz del Valle',
    project: 'Just In Time - Línea 3',
    appointment: '08:00 AM',
    instructions: 'Ingresar por Puerta 4, uso obligatorio de botas y chaleco.',
    status: TripStatus.IN_TRANSIT,
    date: '2024-05-24',
    cargoType: 'Ejes Traseros',
    plate: '52-AK-8F',
    currentStageIndex: 1,
    hasIncident: false,
    evidence: [],
    evidenceStatus: 'NONE',
    locationHistory: []
  },
  {
    id: '2',
    code: 'VIA-TLS-002',
    origin: 'Tultitlán, Edo. Méx',
    originLat: 19.6450,
    originLng: -99.1650,

    destination: 'Querétaro, Qro',
    destinationLat: 20.5888,
    destinationLng: -100.3899,

    client: 'Manufacturas del Bajío',
    project: 'Resurtido Semanal',
    appointment: '14:30 PM',
    instructions: 'Esperar confirmación de descarga con Sr. López.',
    status: TripStatus.INCIDENT,
    date: '2024-05-24',
    cargoType: 'Rollos de Acero',
    plate: '88-UE-1A',
    currentStageIndex: 3,
    hasIncident: true,
    evidence: [
        {
            id: 'ev-1',
            tripId: '2',
            stageIndex: 3,
            url: 'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?auto=format&fit=crop&q=80&w=300',
            fileName: 'evidencia_incidencia.jpg',
            path: 'viajes/2/WITH_CLIENT/evidencia_incidencia.jpg',
            timestamp: Date.now()
        }
    ],
    evidenceStatus: 'PENDING',
    locationHistory: [
        {
            id: 'loc-1',
            lat: 19.7005,
            lng: -99.2005,
            timestamp: Date.now() - 3600000,
            type: 'CHECKIN',
            label: 'Inicio de Ruta'
        }
    ]
  },
  {
    id: '3',
    code: 'VIA-TLS-003',
    origin: 'Tultitlán, Edo. Méx',
    destination: 'Puebla, Pue',
    client: 'Construrama Global',
    project: 'Obra Civil Torre 5',
    appointment: '10:00 AM',
    instructions: 'Material frágil, revisar estiba.',
    status: TripStatus.DELAYED,
    date: '2024-05-24',
    cargoType: 'Cemento Paletizado',
    plate: 'XA-20-99',
    currentStageIndex: 2,
    hasIncident: false,
    evidence: [],
    evidenceStatus: 'APPROVED',
    locationHistory: []
  }
];

export const REPORT_OPTIONS: ReportOption[] = [
  { id: 'TRAFFIC', label: 'Tráfico Pesado' },
  { id: 'ACCIDENT', label: 'Accidente en Vía' },
  { id: 'WEATHER', label: 'Mal Clima' },
  { id: 'MECHANICAL', label: 'Falla Mecánica' },
  { id: 'FUEL', label: 'Carga de Combustible' },
  { id: 'FOOD', label: 'Alimentos' },
  { id: 'REST', label: 'Descanso' },
  { id: 'POLICE', label: 'Retén / Inspección' },
];