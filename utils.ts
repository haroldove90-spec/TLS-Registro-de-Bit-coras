

// Simulation of Push Notification Service
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.log('This browser does not support desktop notification');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error("Error requesting permission", error);
    return false;
  }
};

export const sendPushNotification = async (targetRole: 'ADMIN' | 'OPERATOR' | 'ALL', title: string, message: string) => {
  console.log(`[INTENTO NOTIFICACIÓN] Para: ${targetRole} | Título: ${title}`);
  
  // 1. Reproducir Sonido (Prioridad Alta)
  // Usamos diferentes sonidos para diferenciar alertas críticas de informativas
  const upperTitle = title.toUpperCase();
  if (upperTitle.includes('NUEVO VIAJE') || upperTitle.includes('INCIDENCIA') || upperTitle.includes('RECHAZADA') || upperTitle.includes('PÁNICO') || upperTitle.includes('SOS') || upperTitle.includes('URGENTE')) {
    playSound('alert');
  } else {
    playSound('notification');
  }

  // 2. Verificar Permisos y Soporte
  if (!('Notification' in window)) return;

  if (Notification.permission !== 'granted') {
    // Intentar pedir permiso si no está denegado explícitamente, aunque esto suele requerir gesto de usuario
    if (Notification.permission !== 'denied') {
        await Notification.requestPermission();
    }
  }

  if (Notification.permission === 'granted') {
    // Fix: vibrate is not in standard NotificationOptions type in some environments, so we cast to any
    const options: any = {
      body: message,
      icon: 'https://tritex.com.mx/tlsicono.png', // Icono de la app
      badge: 'https://tritex.com.mx/tlsicono.png',
      vibrate: [200, 100, 200, 100, 200, 100, 200], // Patrón de vibración largo para llamar la atención
      tag: 'tls-update-' + Date.now(), // Tag único para que se apilen y no se reemplacen
      requireInteraction: true, // La notificación se queda hasta que el usuario la cierra
      data: {
        url: window.location.href
      }
    };

    try {
      // MÉTODO A: Service Worker (Mejor para PWA / Android / Background)
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        // Check if showNotification exists on registration (it should)
        if (registration && 'showNotification' in registration) {
            await registration.showNotification(title, options);
            return;
        }
      }

      // MÉTODO B: Fallback API Estándar (Escritorio / Navegador simple)
      new Notification(title, options);
    } catch (err) {
      console.error("Fallo al enviar notificación nativa:", err);
      // Fallback final: Alert nativo si todo falla (solo para pruebas extremas, usualmente molesto)
      // alert(`${title}\n${message}`); 
    }
  }
};

export const playSound = (type: 'alert' | 'notification' | 'success', loop: boolean = false): HTMLAudioElement | null => {
  let audioSrc = '';
  switch (type) {
    case 'alert':
      // Sonido de Alarma fuerte (Siren/Alarm)
      audioSrc = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'; 
      break;
    case 'notification':
      // Sonido de "Ping" o "Glass"
      audioSrc = 'https://assets.mixkit.co/active_storage/sfx/2344/2344-preview.mp3'; 
      break;
    case 'success':
      // Sonido positivo
      audioSrc = 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'; 
      break;
  }
  
  if (audioSrc) {
    const audio = new Audio(audioSrc);
    audio.volume = 1.0; // Máximo volumen
    
    if (loop) {
        audio.loop = true;
    }

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
          console.warn('El navegador bloqueó la reproducción automática de sonido. Se requiere interacción previa del usuario.', error);
      });
    }
    return audio;
  }
  return null;
};

// --- GEOLOCATION & WATERMARKING SERVICES ---

export const getCurrentLocation = (): Promise<{ lat: number; lng: number; accuracy: number } | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        console.error("Error getting location", error);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 } // Timeout aumentado a 15s para mayor probabilidad de éxito
    );
  });
};

/**
 * Calculates the distance between two coordinates in meters using the Haversine formula.
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

export const processWatermark = async (
  file: File, 
  tripCode: string, 
  plate: string
): Promise<string> => {
  // 1. Get GPS Location
  const location = await getCurrentLocation();
  const latStr = location ? location.lat.toFixed(5) : 'Sin GPS';
  const lngStr = location ? location.lng.toFixed(5) : 'Sin GPS';
  
  // 2. Format Date
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-MX');
  const timeStr = now.toLocaleTimeString('es-MX');

  return new Promise((resolve) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(img.src); // Fallback to original
        return;
      }

      // Set canvas size to image size
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // --- WATERMARK STYLING ---
      
      // Calculate font size relative to image height (approx 3% of height)
      const fontSize = Math.max(16, Math.floor(canvas.height * 0.03)); 
      const lineHeight = fontSize * 1.3;
      const padding = fontSize;
      
      // Text Content
      const line1 = `${dateStr} ${timeStr}`;
      const line2 = `Lat: ${latStr}, Lon: ${lngStr}`;
      const line3 = `Viaje: ${tripCode} | Unidad: ${plate}`;

      // Measure text width to determine box size
      ctx.font = `bold ${fontSize}px sans-serif`;
      const maxWidth = Math.max(
        ctx.measureText(line1).width,
        ctx.measureText(line2).width,
        ctx.measureText(line3).width
      );

      // Box Positioning (Bottom Right)
      const boxWidth = maxWidth + (padding * 2);
      const boxHeight = (lineHeight * 3) + (padding * 2);
      const x = canvas.width - boxWidth;
      const y = canvas.height - boxHeight;

      // Draw Semi-transparent Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // Black with 60% opacity
      ctx.fillRect(x, y, boxWidth, boxHeight);

      // Draw Text
      ctx.fillStyle = '#FFFFFF';
      ctx.textBaseline = 'top';
      
      ctx.fillText(line1, x + padding, y + padding);
      ctx.fillText(line2, x + padding, y + padding + lineHeight);
      ctx.fillText(line3, x + padding, y + padding + (lineHeight * 2));

      // Export
      const watermarkedUrl = canvas.toDataURL('image/jpeg', 0.9);
      resolve(watermarkedUrl);
    };
    
    img.onerror = () => {
      resolve(URL.createObjectURL(file)); // Fallback
    };
  });
};
