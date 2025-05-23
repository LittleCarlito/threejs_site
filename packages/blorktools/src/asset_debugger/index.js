/**
 * Asset Debugger Tool - Main Entry Point
 * 
 * This module exports the asset debugger tool functionality
 * for use in other parts of the application or external imports.
 */

// Import and re-export the init function from the main module
import { init } from './main.js';

// Prevent default drag-and-drop behavior for the entire document
function preventDefaultDragBehavior() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });
}

// Check if the DOM is already loaded before calling init
function initializeDebugger() {
    console.log('Asset Debugger: Initializing from index.js');
    
    if (document.readyState === 'loading') {
        // Document still loading, add event listener
        document.addEventListener('DOMContentLoaded', () => {
            console.log('Asset Debugger: DOM now loaded, initializing...');
            preventDefaultDragBehavior();
            init();
        });
    } else {
        // Document already loaded, call directly
        console.log('Asset Debugger: DOM already loaded, initializing immediately...');
        preventDefaultDragBehavior();
        init();
    }
}

// Initialize on script load
initializeDebugger();

// Export the init function for external use
export { init };