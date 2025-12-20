import { LiveMorph } from './live-morph.js';

// Create global instance
const liveMorph = new LiveMorph(window);

// Export to window for browser access
window.LiveMorph = liveMorph;

// Listen for shutdown events
if (typeof document !== 'undefined') {
  document.addEventListener('LiveMorphShutDown', () => {
    liveMorph.shutDown();
  });

  // Fire connect/disconnect events for integration
  liveMorph.on('connect', () => {
    const event = new CustomEvent('LiveMorphConnect');
    document.dispatchEvent(event);
  });

  liveMorph.on('disconnect', () => {
    const event = new CustomEvent('LiveMorphDisconnect');
    document.dispatchEvent(event);
  });
}

export default liveMorph;
