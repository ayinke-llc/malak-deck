import { useState, useEffect } from 'react';

export function useTour() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    // Check if the tour has been completed before
    const hasCompletedTour = localStorage.getItem('hasCompletedTour');
    if (!hasCompletedTour) {
      setRun(true);
    }
  }, []);

  const completeTour = () => {
    localStorage.setItem('hasCompletedTour', 'true');
    setRun(false);
  };

  const startTour = () => {
    setRun(true);
  };

  return { run, completeTour, startTour };
} 