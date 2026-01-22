
-- =================================================================
-- SCRIPT DE ACTUALIZACIÓN: SOPORTE PARA HISTORIAL Y ORDENES
-- =================================================================

-- 1. Asegurar que la tabla 'viajes' tenga los campos necesarios
CREATE TABLE IF NOT EXISTS viajes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    origin TEXT,
    destination TEXT,
    client TEXT,
    project TEXT,
    appointment TEXT,
    status TEXT,
    plate TEXT,
    current_stage INTEGER DEFAULT 0,
    evidence_status TEXT DEFAULT 'NONE',
    destinos_lista JSONB DEFAULT '[]'::jsonb, 
    evidence JSONB DEFAULT '[]'::jsonb,
    locationHistory JSONB DEFAULT '[]'::jsonb,
    extra_costs JSONB DEFAULT '[]'::jsonb,
    instructions TEXT,
    originMapsLink TEXT,
    destinationMapsLink TEXT,
    indicaciones_pdf_url TEXT,
    rejectionReason TEXT,
    odometer_start NUMERIC,
    odometer_end NUMERIC,
    scheduled_date DATE, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Crear índices
CREATE INDEX IF NOT EXISTS idx_viajes_plate ON viajes(plate);
CREATE INDEX IF NOT EXISTS idx_viajes_status ON viajes(status);
CREATE INDEX IF NOT EXISTS idx_viajes_date ON viajes(scheduled_date);

-- 3. Tabla de Notificaciones
CREATE TABLE IF NOT EXISTS notificaciones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    target_role TEXT NOT NULL,
    target_user_id TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT CHECK (type IN ('success', 'alert', 'info')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 4. Actualización de esquema para tablas existentes (IMPORTANTE PARA ODOMETROS)
DO $$
BEGIN
    BEGIN
        ALTER TABLE viajes ADD COLUMN odometer_start NUMERIC;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
    
    BEGIN
        ALTER TABLE viajes ADD COLUMN odometer_end NUMERIC;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
END $$;

-- 5. Realtime
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'viajes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE viajes;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notificaciones') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notificaciones;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
