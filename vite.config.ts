
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'terser',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', '@supabase/supabase-js', 'lucide-react']
          }
        }
      }
    },
    // En produccion (Vercel), Vite expone automáticamente las variables VITE_*
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode)
    },
    server: {
      port: 3000,
      host: true
    }
  };
});
