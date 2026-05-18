import React, { useEffect, useState } from 'react';

interface BootSequenceProps {
  onComplete: () => void;
}

const BootSequence: React.FC<BootSequenceProps> = ({ onComplete }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete();
    }, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div className="boot-overlay">
      <div className="boot-content">
        <div className="boot-line">INITIALIZING BUTLER...</div>
        <div className="boot-line">LOADING CONVERSATIONAL MEMORY...</div>
        <div className="boot-line">JANITOR ONLINE</div>
        <div className="boot-line">LIVING DOCUMENT ACTIVE</div>
      </div>
    </div>
  );
};

export default BootSequence;