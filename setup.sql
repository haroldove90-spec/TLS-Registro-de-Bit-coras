-- TLS Logistics - Base de Datos en Supabase (vkzzfccktctoljvkmwsz)
-- Script Corregido y Optimizado

-- 0. Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de Operadores
CREATE TABLE IF NOT EXISTS operadores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  plate TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'AVAILABLE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabla de Viajes (Core del Negocio)
CREATE TABLE IF NOT EXISTS viajes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  client TEXT NOT NULL,
  project TEXT NOT NULL,
  origin TEXT NOT NULL,
  origin_maps_link TEXT,
  origin_lat DECIMAL,
  origin_lng DECIMAL,
  destination TEXT NOT NULL,
  destination_maps_link TEXT,
  destination_lat DECIMAL,
  destination_lng DECIMAL,
  appointment TEXT NOT NULL, -- HH:MM AM/PM
  date DATE DEFAULT CURRENT_DATE,
  instructions TEXT,
  status TEXT DEFAULT 'Por Aceptar',
  plate TEXT REFERENCES operadores(plate),
  current_stage_index INTEGER DEFAULT 0,
  has_incident BOOLEAN DEFAULT FALSE,
  evidence_status TEXT DEFAULT 'NONE',
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabla de Evidencias (Geoselladas)
CREATE TABLE IF NOT EXISTS evidencias_geoselladas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES viajes(id) ON DELETE CASCADE,
  stage_index INTEGER NOT NULL,
  url TEXT NOT NULL,
  lat DECIMAL,
  lng DECIMAL,
  timestamp BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabla de Historial GPS (Bitácora de Ruta)
CREATE TABLE IF NOT EXISTS historial_ubicaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES viajes(id) ON DELETE CASCADE,
  lat DECIMAL NOT NULL,
  lng DECIMAL NOT NULL,
  type TEXT, -- CHECKIN, GAS, ARRIVAL, VALIDATION
  label TEXT,
  is_out_of_range BOOLEAN DEFAULT FALSE,
  distance_to_target DECIMAL,
  timestamp BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. CONFIGURACIÓN DE SEGURIDAD (RLS) - CORREGIDO
ALTER TABLE operadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE viajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidencias_geoselladas ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_ubicaciones ENABLE ROW LEVEL SECURITY;

-- 6. POLÍTICAS DE ACCESO (Permitir lectura/escritura pública para esta demo)
-- Nota: En producción, estas políticas se filtrarían por auth.uid()
CREATE POLICY "Acceso total a operadores" ON operadores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total a viajes" ON viajes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total a evidencias" ON evidencias_geoselladas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total a historial" ON historial_ubicaciones FOR ALL USING (true) WITH CHECK (true);

-- 7. Datos Iniciales
INSERT INTO operadores (name, plate, status) VALUES 
('Roberto Gómez', '52-AK-8F', 'AVAILABLE'),
('Juan Pérez', '88-UE-1A', 'BUSY')
ON CONFLICT (plate) DO NOTHING;
