import React from 'react';

interface PresenceOrbProps {
  state: 'idle' | 'listening' | 'thinking' | 'speaking';
  onClick?: () => void;
}

const PresenceOrb: React.FC<PresenceOrbProps> = ({ state, onClick }) => {
  const getStateLabel = () => {
    switch (state) {
      case 'listening': return '[LISTENING]';
      case 'thinking': return '[THINKING]';
      case 'speaking': return '[RESPONDING]';
      default: return '[IDLE]';
    }
  };

  const getStateColor = () => {
    switch (state) {
      case 'listening': return '#F5C451';
      case 'thinking': return '#A78BFA';
      case 'speaking': return '#34D399';
      default: return '#5B6A8C';
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: '80px', 
      right: '24px', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      gap: '0px',
      zIndex: 200 
    }}>
      <div 
        onClick={onClick}
        style={{ 
          lineHeight: 0,
          margin: 0,
          padding: 0
        }}
      >
        <div className="presence-orb" style={{ position: 'relative', margin: 0, padding: 0 }}>
          <div className="orb-ring"></div>
          <div className={`orb-core ${state}`}></div>
        </div>
      </div>
      {state !== 'idle' && (
        <div style={{ 
          fontSize: '0.55rem',
          fontFamily: 'monospace',
          padding: '2px 8px',
          background: 'rgba(11, 16, 32, 0.95)',
          border: `1px solid ${getStateColor()}`,
          borderRadius: '20px',
          color: getStateColor(),
          fontWeight: 'bold',
          letterSpacing: '0.5px',
          marginTop: '-4px'
        }}>
          {getStateLabel()}
        </div>
      )}
    </div>
  );
};

export default PresenceOrb;