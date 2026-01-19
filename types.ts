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
  | 'WITH_CLIENT' 
  | 'UNLOADED' 
  | 'END_TRIP';

export interface TripStageDef {
  key: TripStageKey;
  label: string;
  order: number;
}

export enum TripStatus {
  PENDING_ACCEPTANCE = 'Por Aceptar', // Created by Admin
  ACCEPTED = 'Confirmado', // Changed label to Confirmado per request
  ASSIGNED = 'Asignado',
  IN_TRANSIT = 'En Ruta',
  COMPLETED = 'Completado',
  DELAYED = 'Retrasado',
  INCIDENT = 'Incidencia'
}

export type EvidenceStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NONE';

export interface Evidence {
  id: string;
  tripId: string;
  stageIndex: number;
  url: string; // Base64 or Blob URL
  fileName: string; // name.jpg
  path: string; // viajes/{id}/{stage}/{name}
  timestamp: number;
  // Coordinates for Geo-validation map pinning
  lat?: number;
  lng?: number;
}

// New: Location Report for GPS History
export interface LocationReport {
  id: string;
  lat: number;
  lng: number;
  timestamp: number;
  type: 'CHECKIN' | 'GAS' | 'ARRIVAL' | 'VALIDATION'; // Added VALIDATION type
  label: string; // e.g., "Llegada a Carga", "Gasolinera"
  isOutOfRange?: boolean; // True if > 500m from target
  distanceToTarget?: number; // In meters
}

export interface Trip {
  id: string;
  code: string;
  origin: string;
  originMapsLink?: string;
  // Coordinates for Validation
  originLat?: number;
  originLng?: number;
  
  destination: string;
  destinationMapsLink?: string;
  // Coordinates for Validation
  destinationLat?: number; 
  destinationLng?: number;

  client: string;
  project: string;
  appointment: string;
  instructions?: string;
  status: TripStatus;
  date: string;
  cargoType: string;
  plate: string;
  currentStageIndex: number; 
  hasIncident: boolean;
  
  evidence: Evidence[]; 
  evidenceStatus: EvidenceStatus;
  rejectionReason?: string;

  // New: Location History
  locationHistory: LocationReport[];
}

export interface ReportOption {
  id: string;
  label: string;
  icon?: string;
}