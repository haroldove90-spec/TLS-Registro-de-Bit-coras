import React, { useState } from 'react';
import { User } from '../types';
import { ShieldCheck, KeyRound } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [operatorId, setOperatorId] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Mock authentication with simplified logic for testing
    setTimeout(() => {
      const id = operatorId.toUpperCase().trim();
      
      // ADMIN ACCESS
      if (id === 'ADMIN' || id === 'MONITOR') {
        onLogin({
          id: 'ADM-001',
          name: 'Supervisor de Torre',
          role: 'ADMIN'
        });
        return;
      }

      // OPERATOR ACCESS (Now accepts 2+ digits as requested)
      if (id.length >= 2) {
        onLogin({
          id: id,
          name: 'Operador Roberto Gómez',
          role: 'OPERATOR'
        });
      } else {
        setError('ID inválido. Ingrese al menos 2 caracteres.');
        setIsLoading(false);
      }
    }, 500);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
          {/* Decorative background element */}
          <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-400 via-slate-900 to-slate-900"></div>
          
          <img 
            src="https://tritex.com.mx/tlslogo.png" 
            alt="TBS Logo" 
            className="mx-auto w-[120px] mb-6 relative z-10"
          />
          
          <h1 className="text-2xl font-bold text-white relative z-10">TBS Logistics Services</h1>
          <p className="text-slate-400 text-sm mt-2 relative z-10 font-medium">Registro de Bitácoras - Acceso de Operadores</p>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="operatorId" className="block text-sm font-medium text-gray-700 mb-1">
                Credencial de Acceso
              </label>
              <div className="relative">
                <input
                  id="operatorId"
                  type="text"
                  value={operatorId}
                  onChange={(e) => setOperatorId(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-100 border border-gray-300 text-gray-900 placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-colors"
                  placeholder="ID Operador o 'ADMIN'"
                  autoComplete="off"
                />
                <KeyRound className="absolute left-3 top-3.5 h-5 w-5 text-gray-500" />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                * Para pruebas de Operador: Ingrese "12" o "OP-123"<br/>
                * Para pruebas de Admin: Ingrese "ADMIN"
              </p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center animate-pulse">
                <ShieldCheck className="h-4 w-4 mr-2" /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-lg text-white font-bold tracking-wide shadow-md transition-all 
                ${isLoading ? 'bg-slate-700 cursor-wait' : 'bg-blue-700 hover:bg-blue-600 active:scale-[0.98]'}`}
            >
              {isLoading ? 'Verificando...' : 'INGRESAR AL SISTEMA'}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-400">
              TBS Logistics Services v2.2
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};