import React, { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';

interface HeaderProps {
  userName?: string;
  role?: 'ADMIN' | 'OPERATOR';
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ userName, role, onLogout }) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Activar efecto después de 20px de desplazamiento
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const bgColor = role === 'ADMIN' ? 'bg-slate-900' : 'bg-blue-900';

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-[1000] ${bgColor} text-white shadow-md transition-all duration-300 ease-in-out ${
        isScrolled ? 'h-[50px]' : 'h-[70px]'
      }`}
    >
      <div className="max-w-7xl mx-auto h-full px-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0 flex items-center justify-center">
            <img 
              src="https://tritex.com.mx/tlslogo.png" 
              alt="TBS Logo" 
              className={`w-auto object-contain transition-all duration-300 ${
                isScrolled ? 'h-[30px]' : 'h-[40px]'
              }`}
            />
          </div>
          
          <div 
            className={`h-6 w-px bg-white/20 mx-1 hidden sm:block transition-opacity duration-300 ${
              isScrolled ? 'opacity-0' : 'opacity-100'
            }`}
          ></div>
          
          <span 
            className={`font-bold text-sm sm:text-base tracking-tight transition-all duration-300 transform ${
              isScrolled 
                ? 'opacity-0 -translate-x-10 pointer-events-none w-0 overflow-hidden' 
                : 'opacity-100 translate-x-0'
            }`}
          >
            Registro de Bitácoras
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <div className={`flex flex-col text-right transition-all duration-300 ${isScrolled ? 'scale-90 opacity-80' : 'scale-100 opacity-100'}`}>
            <span className="text-[8px] uppercase font-black text-white/40 leading-none">
              {role === 'ADMIN' ? 'Control Tower' : 'Operador'}
            </span>
            <span className="text-xs font-bold truncate max-w-[80px] xs:max-w-[110px]">
              {userName}
            </span>
          </div>
          
          <button 
            onClick={onLogout}
            className={`p-2 hover:bg-white/10 rounded-full transition-all active:scale-90 ${
              isScrolled ? 'bg-transparent' : 'bg-white/5'
            }`}
          >
            <LogOut className={isScrolled ? 'h-4 w-4' : 'h-5 w-5'} />
          </button>
        </div>
      </div>
    </header>
  );
};