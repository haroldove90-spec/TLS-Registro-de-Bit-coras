// Simulation of Push Notification Service
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('This browser does not support desktop notification');
    return;
  }
  
  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return true;
};

export const sendPushNotification = async (toRole: 'ADMIN' | 'OPERATOR' | 'ALL', title: string, message: string) => {
  console.log(`[PUSH to ${toRole}] ${title}: ${message}`);
  
  // 1. Play Sound (In-App Feedback)
  if (toRole === 'ADMIN') {
    playSound('notification');
  } else if (toRole === 'OPERATOR') {
    playSound('alert');
  }

  // 2. Trigger System Notification (Service Worker)
  if ('serviceWorker' in navigator && Notification.permission === 'granted') {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // We use 'showNotification' from the SW registration to ensure it works on Mobile/Background
      registration.showNotification(title, {
        body: message,
        icon: 'https://cdn-icons-png.flaticon.com/512/759/759988.png', // Truck Icon
        vibrate: [500, 250, 500, 250, 500], // High Priority Pattern
        tag: 'tls-alert', // Overwrite old alerts
        requireInteraction: true, // Stays until clicked
        data: { dateOfArrival: Date.now() }
      } as any);
      
    } catch (e) {
      console.error("Error showing notification via SW:", e);
      // Fallback
      new Notification(title, { body: message });
    }
  }
};

export const playSound = (type: 'alert' | 'notification' | 'success') => {
  let audioSrc = '';
  switch (type) {
    case 'alert':
      audioSrc = 'https://codeskulptor-demos.commondatastorage.googleapis.com/GalaxyInvaders/pause.wav'; // Loud beep
      break;
    case 'notification':
      audioSrc = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'; // Soft ping
      break;
    case 'success':
      audioSrc = 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'; // Success chime
      break;
  }
  
  if (audioSrc) {
    const audio = new Audio(audioSrc);
    audio.volume = 1.0; // Max volume for alerts
    audio.play().catch(e => console.log('Audio autoplay blocked by browser policy', e));
  }
};

// --- GEOLOCATION & WATERMARKING SERVICES ---

export const getCurrentLocation = (): Promise<{ lat: number; lng: number } | null> => {
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
        });
      },
      (error) => {
        console.error("Error getting location", error);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
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