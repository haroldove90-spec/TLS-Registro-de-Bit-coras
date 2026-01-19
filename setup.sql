-- ==========================================================
-- TLS LOGISTICS - CONFIGURACIÓN DE BASE DE DATOS Y STORAGE
-- Instrucciones: Copia y pega TODO este código en el SQL Editor de Supabase
-- ==========================================================

-- 1. Crear la tabla de evidencias si no existe
CREATE TABLE IF NOT EXISTS evidencias_geoselladas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id TEXT NOT NULL,
    stage_index INTEGER NOT NULL,
    url TEXT NOT NULL,
    lat DECIMAL,
    lng DECIMAL,
    timestamp BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar Seguridad (RLS)
ALTER TABLE evidencias_geoselladas ENABLE ROW LEVEL SECURITY;

-- 3. Políticas para la Tabla (Rol: anon)
-- Nota: La app usa login simulado, por lo que las peticiones llegan como 'anon'
DROP POLICY IF EXISTS "Lectura pública metadata" ON evidencias_geoselladas;
CREATE POLICY "Lectura pública metadata" ON evidencias_geoselladas FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Inserción anónima metadata" ON evidencias_geoselladas;
CREATE POLICY "Inserción anónima metadata" ON evidencias_geoselladas FOR INSERT TO anon WITH CHECK (true);

-- 4. Políticas para Storage (Bucket: evidencias)
-- Asegúrate de que el bucket 'evidencias' sea PÚBLICO en la pestaña de Storage.

DROP POLICY IF EXISTS "Permitir subida a operadores" ON storage.objects;
CREATE POLICY "Permitir subida a operadores" 
ON storage.objects FOR INSERT 
TO anon 
WITH CHECK (bucket_id = 'evidencias');

DROP POLICY IF EXISTS "Permitir lectura pública" ON storage.objects;
CREATE POLICY "Permitir lectura pública" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'evidencias');

DROP POLICY IF EXISTS "Permitir actualización a operadores" ON storage.objects;
CREATE POLICY "Permitir actualización a operadores" 
ON storage.objects FOR UPDATE 
TO anon 
USING (bucket_id = 'evidencias');