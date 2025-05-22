'use client';
import { useEffect } from 'react';

export default function RedirectToMobile() {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = 'http://localhost:3535/mobile';
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#212529', color: '#FFFFFF' }}>
      Please wait while we connect you...
    </div>
  );
}