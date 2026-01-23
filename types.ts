
export interface User {
  id: string;
  name: string;
  role: 'OPERATOR' | 'ADMIN';
}

export interface Operator {
  id: string;
  name: string;
  plate: string;
  status: 'AVAILABLE' | 'BUSY' | 'MAINTENANCE';
}

export type TripStageKey = 
  | 'START_TRIP' 
  | 'ARRIVING_LOAD' 
  | 'LOADED' 
  | 'START_DEST_2'
  | 'WITH_CLIENT' 
  | 'UNLOADED' 
  | 'END_TRIP';

export interface TripStageDef {
  key: string;
  label: string;
  order: number;
}

export enum TripStatus {
  PENDING_ACCEPTANCE = 'Por Aceptar', 
  ACCEPTED = 'Confirmado',
  ASSIGNED = 'Asignado',
  IN_TRANSIT = 'En Curso',
  COMPLETED = 'Completado',
  DELAYED = 'Retrasado',
  INCIDENT = 'Incidencia'
}

export type EvidenceStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NONE';

export interface Evidence {
  id: string;
  tripId: string;
  destinationId?: string; 
  stageIndex: number;
  url: string; 
  fileName: string; 
  path: string; 
  timestamp: number;
  lat?: number;
  lng?: number;
}

export interface LocationReport {
  id: string;
  lat: number;
  lng: number;
  timestamp: number;
  type: 'CHECKIN' | 'GAS' | 'ARRIVAL' | 'VALIDATION'; 
  label: string; 
  isOutOfRange?: boolean; 
  distanceToTarget?: number; 
}

export interface TripDestination {
  id: string;
  name: string;
  mapsLink?: string;
  currentStageIndex: number; 
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  client?: string;
  origin?: string;
  date?: string;
  appointment?: string;
  instructions?: string; 
  instructions_pdf_url?: string;
  tripNumber?: string; // Nuevo campo solicitado
}

// --- TIPOS PARA GASTOS ---
export type ExpenseCategory = 'OPERATIVO' | 'GASTOS' | 'MANTENIMIENTO';

export interface ExpenseItem {
  concept: string;
  amount: number;
  // Campos específicos para Combustible
  odometer?: number;
  liters?: number;
  pricePerLiter?: number;
}

export interface ExpenseRecord {
  id: string;
  category: ExpenseCategory;
  items: ExpenseItem[];
  total: number;
  timestamp: number;
  evidence?: Evidence[]; // Campo nuevo para evidencias del gasto
}
// -------------------------

export interface Trip {
  id: string;
  code: string;
  origin: string;
  originMapsLink?: string;
  originLat?: number;
  originLng?: number;
  
  destination: string; 
  destinationMapsLink?: string;
  destinations: TripDestination[]; 
  
  destinationLat?: number; 
  destinationLng?: number;

  client: string;
  project: string;
  appointment: string;
  instructions?: string;
  indicaciones_pdf_url?: string; 
  status: TripStatus;
  date: string;
  cargoType: string;
  plate: string;
  currentStageIndex: number; 
  hasIncident: boolean;
  
  evidence: Evidence[]; 
  evidenceStatus: EvidenceStatus;
  rejectionReason?: string;

  locationHistory: LocationReport[];
  extraCosts: ExpenseRecord[]; // Nueva propiedad para gastos
  
  // Nuevos campos para Odómetro
  odometerStart?: number;
  odometerEnd?: number;
}

export interface ReportOption {
  id: string;
  label: string;
  icon?: string;
}

// --- NOTIFICACIONES ---
export interface AppNotification {
  id: string;
  target_role: 'ADMIN' | 'OPERATOR' | 'ALL';
  target_user_id?: string;
  title: string;
  message: string;
  type: 'success' | 'alert' | 'info';
  is_read: boolean;
  created_at: string;
  metadata?: {
    trip_id?: string;
    image_url?: string;
    extra_info?: string;
    [key: string]: any;
  };
}
