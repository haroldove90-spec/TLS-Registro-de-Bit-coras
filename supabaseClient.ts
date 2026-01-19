
import { createClient } from '@supabase/supabase-js';

/**
 * TBS Logistics - Cliente Supabase (Vercel Ready)
 * 
 * Para mayor seguridad y facilidad en Vercel:
 * 1. Ve a Vercel Dashboard > Settings > Environment Variables.
 * 2. Agrega VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.
 */

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://vkzzfccktctoljvkmwsz.supabase.co';

// Intenta leer de la variable de entorno de Vercel, si no, usa el placeholder (que debe ser actualizado si no se usa env vars)
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrenpmY2NrdGN0b2xqdmttd3N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTEwNDA3MjMsImV4cCI6MjAyNjYxNjcyM30.vW2PQ6R0i8z2W6q7r7Z1U4l0u9l8l6l5l4l3l2l1l0'; 

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

/**
 * Verifica si la conexión con Supabase es válida y la firma del JWT es correcta
 */
export const checkStorageBucket = async () => {
  try {
    // Listar archivos es la forma más rápida de validar que la Anon Key es aceptada por el servidor
    const { error } = await supabase.storage.from('evidencias').list('', { limit: 1 });
    
    if (error) {
      console.error("Supabase Connection Check:", error.message);
      // El error de firma (Signature Verification) ocurre cuando la API KEY no pertenece a este proyecto URL
      if (error.message.toLowerCase().includes('signature') || 
          error.message.toLowerCase().includes('apikey') || 
          error.message.toLowerCase().includes('invalid token')) {
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error("Critical Connection Error:", err);
    return false;
  }
};
