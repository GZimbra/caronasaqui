import React, { useEffect, useRef } from 'react';

/**
 * Componente React para Google AdSense
 * Como usar: <AdSense client="ca-pub-4628393920859887" slot="1234567890" />
 */
export const AdSense = ({ 
  client, 
  slot, 
  format = 'auto', 
  responsive = 'true', 
  style = { display: 'block' } 
}) => {
  const adRef = useRef(null);
  const isLoaded = useRef(false);

  useEffect(() => {
    // Evita múltiplos "pushes" no mesmo slot (evita erros do AdSense com React StrictMode)
    if (adRef.current && !isLoaded.current) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        isLoaded.current = true;
      } catch (e) {
        console.error('AdSense error:', e);
      }
    }
  }, []);

  return (
    <ins
      ref={adRef}
      className="adsbygoogle"
      style={style}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={responsive}
    />
  );
};

export default AdSense;
