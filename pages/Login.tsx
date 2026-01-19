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

    setTimeout(() => {
      const id = operatorId.toUpperCase().trim();
      
      if (id === 'ADMIN' || id === 'MONITOR') {
        onLogin({
          id: 'ADM-001',
          name: 'Supervisor de Torre',
          role: 'ADMIN'
        });
        return;
      }

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
        <div className="bg-slate-900 p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-400 via-slate-900 to-slate-900"></div>
          
          <div className="flex justify-center mb-6 relative z-10">
            <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-sm border border-white/10 shadow-inner">
                <img 
                src="https://tritex.com.mx/tlslogo.png" 
                alt="TBS Logo" 
                className="w-[120px] h-auto object-contain"
                />
            </div>
          </div>
          
          <h1 className="text-2xl font-black text-white relative z-10 tracking-tight">TBS Logistics Services</h1>
          <p className="text-slate-400 text-xs mt-1 relative z-10 font-bold uppercase tracking-widest">Control Operativo</p>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="operatorId" className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-wider">
                Credencial de Acceso
              </label>
              <div className="relative">
                <input
                  id="operatorId"
                  type="text"
                  value={operatorId}
                  onChange={(e) => setOperatorId(e.target.value)}
                  className="w-full pl-10 pr-4 py-4 bg-slate-50 border-2 border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all font-bold"
                  placeholder="ID Operador"
                  autoComplete="off"
                />
                <KeyRound className="absolute left-3 top-4 h-5 w-5 text-slate-400" />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl flex items-center font-bold border border-red-100 animate-in fade-in zoom-in-95">
                <ShieldCheck className="h-5 w-5 mr-2 shrink-0" /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-4 px-4 rounded-xl text-white font-black text-sm uppercase tracking-widest shadow-lg transition-all transform active:scale-[0.97]
                ${isLoading ? 'bg-slate-700' : 'bg-blue-700 hover:bg-blue-600 hover:shadow-blue-200'}`}
            >
              {isLoading ? 'Verificando...' : 'INGRESAR'}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-slate-50 pt-6">
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
              TBS Logistics Services v2.5
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};