import { useState, useEffect } from 'react';
import { shopAPI } from '../services/api';

const DynamicBackground = ({ blur = 0 }) => {
  const [shopStatus, setShopStatus] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Initial fetch
    shopAPI.getStatus().then(setShopStatus).catch(console.error);

    // Refresh status every 2 minutes
    const statusInterval = setInterval(() => {
      shopAPI.getStatus().then(setShopStatus).catch(console.error);
    }, 120000);

    // Update current time every minute for day/night logic
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(timeInterval);
    };
  }, []);

  const getBackgroundImage = () => {
    const hour = currentTime.getHours();
    const isDay = hour >= 6 && hour < 19; // 6 AM - 7 PM
    const isOpen = shopStatus?.is_open ?? true; // Default to open if loading

    if (isDay) {
      return isOpen ? '/assets/images/open%20day.png' : '/assets/images/closed%20day.png';
    } else {
      return isOpen ? '/assets/images/nighttime%20open.png' : '/assets/images/nighttime%20closed.png';
    }
  };

  const bgImage = getBackgroundImage();

  return (
    <div className="landing-bg-container" aria-hidden="true" style={{ transition: 'all 0.5s ease' }}>
      <img 
        key={bgImage}
        src={bgImage} 
        alt="" 
        className="landing-bg-image fadeIn" 
        style={{ 
          filter: `blur(${blur}px) brightness(0.75)`,
          transition: 'filter 0.8s ease'
        }}
      />
      <div className="landing-bg-overlay" />
    </div>
  );
};

export default DynamicBackground;
