import React from 'react';
import { Mic, Brain, Volume2 } from 'lucide-react';

interface ModeToggleProps {
  secretaryMode: boolean;
  interactiveMode: boolean;
  onToggle: (mode: 'secretary' | 'interactive') => void;
  onSecretaryToggle: () => void; // Your existing toggleSecretaryMode function
}

const ModeToggle: React.FC<ModeToggleProps> = ({ 
  secretaryMode, 
  interactiveMode, 
  onToggle,
  onSecretaryToggle 
}) => {
  const handleSecretaryClick = () => {
    if (secretaryMode) {
      // If turning OFF secretary mode, also turn OFF interactive
      onSecretaryToggle();
    } else {
      // Turning ON secretary mode - turn off interactive first
      if (interactiveMode) {
        onToggle('interactive');
      }
      onSecretaryToggle();
    }
  };

  const handleInteractiveClick = () => {
    if (interactiveMode) {
      onToggle('interactive');
    } else {
      // Turning ON interactive mode - turn off secretary first
      if (secretaryMode) {
        onSecretaryToggle();
      }
      onToggle('interactive');
    }
  };

  return (
    <div className="mode-toggle-container">
      <button
        className={`mode-toggle-option ${secretaryMode ? 'active secretary' : ''}`}
        onClick={handleSecretaryClick}
        title="Secretary Mode - I listen and document, only respond when addressed"
      >
        <Brain size={14} />
        <span>Secretary</span>
        {secretaryMode && <span className="mode-active-indicator">● LIVE</span>}
      </button>
      
      <div className="mode-toggle-divider"></div>
      
      <button
        className={`mode-toggle-option ${interactiveMode ? 'active interactive' : ''}`}
        onClick={handleInteractiveClick}
        title="Interactive Mode - I respond to everything you say"
      >
        <Mic size={14} />
        <span>Interactive</span>
        {interactiveMode && <span className="mode-active-indicator">● LIVE</span>}
      </button>
    </div>
  );
};

export default ModeToggle;