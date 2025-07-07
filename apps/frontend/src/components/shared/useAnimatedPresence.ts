import { useState, useEffect } from 'react';

function useAnimatedPresence(show: boolean, duration = 500) {
  const [isVisible, setIsVisible] = useState(show);
  useEffect(() => {
    if (show) setIsVisible(true);
    else {
      const timeout = setTimeout(() => setIsVisible(false), duration);
      return () => clearTimeout(timeout);
    }
  }, [show, duration]);
  return isVisible;
}

export default useAnimatedPresence; 