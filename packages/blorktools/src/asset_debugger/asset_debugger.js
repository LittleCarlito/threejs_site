/**
 * Asset Debugger - Main Entry Point
 * 
 * This file serves as the bridge between the HTML page and the application.
 * It imports and exports all functionality from index.js.
 */

// Import the initialization function from index.js
import init from './index.js';

// Initialize the application when loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Asset Debugger: Application loading...');
    init();
    
    // Once the DOM is loaded, set up the event listeners for debugging
    setupDebuggerEvents();
});

/**
 * Set up event listeners for the Start Debug and Restart buttons
 */
function setupDebuggerEvents() {
    // Initialize 3D scene when Start Debugging is clicked
    const startDebugBtn = document.getElementById('start-debug');
    const restartDebugBtn = document.getElementById('restart-debug');
    const viewport = document.getElementById('viewport');
    const tabContainer = document.getElementById('tab-container');
    
    if (startDebugBtn) {
        startDebugBtn.addEventListener('click', startDebugging);
    }
    
    if (restartDebugBtn) {
        restartDebugBtn.addEventListener('click', restartDebugging);
    }
}

/**
 * Set up tab navigation system
 */
function setupTabNavigation() {
    console.log('Setting up tab navigation...');
    
    // Get tab buttons and tab content elements
    const meshTabButton = document.getElementById('mesh-tab-button');
    const atlasTabButton = document.getElementById('atlas-tab-button');
    const uvTabButton = document.getElementById('uv-tab-button');
    const rigTabButton = document.getElementById('rig-tab-button');
    
    const meshTab = document.getElementById('mesh-tab');
    const atlasTab = document.getElementById('atlas-tab');
    const uvTab = document.getElementById('uv-tab');
    const rigTab = document.getElementById('rig-tab');
    
    // Set up click handlers for each tab button
    if (meshTabButton && meshTab) {
        meshTabButton.addEventListener('click', () => {
            // Update active button
            meshTabButton.classList.add('active');
            atlasTabButton.classList.remove('active');
            uvTabButton.classList.remove('active');
            rigTabButton.classList.remove('active');
            
            // Update active content
            meshTab.classList.add('active');
            atlasTab.classList.remove('active');
            uvTab.classList.remove('active');
            rigTab.classList.remove('active');
        });
    }
    
    if (atlasTabButton && atlasTab) {
        atlasTabButton.addEventListener('click', () => {
            // Update active button
            meshTabButton.classList.remove('active');
            atlasTabButton.classList.add('active');
            uvTabButton.classList.remove('active');
            rigTabButton.classList.remove('active');
            
            // Update active content
            meshTab.classList.remove('active');
            atlasTab.classList.add('active');
            uvTab.classList.remove('active');
            rigTab.classList.remove('active');
            
            // Update atlas visualization
            import('./ui/atlas-panel.js').then(module => {
                if (module.updateAtlasVisualization) {
                    module.updateAtlasVisualization();
                }
            });
        });
    }
    
    if (uvTabButton && uvTab) {
        uvTabButton.addEventListener('click', () => {
            // Update active button
            meshTabButton.classList.remove('active');
            atlasTabButton.classList.remove('active');
            uvTabButton.classList.add('active');
            rigTabButton.classList.remove('active');
            
            // Update active content
            meshTab.classList.remove('active');
            atlasTab.classList.remove('active');
            uvTab.classList.add('active');
            rigTab.classList.remove('active');
            
            // Update UV panel
            import('./ui/uv-panel.js').then(module => {
                if (module.updateUvPanel) {
                    module.updateUvPanel();
                }
            });
        });
    }
    
    if (rigTabButton && rigTab) {
        rigTabButton.addEventListener('click', () => {
            // Update active button
            meshTabButton.classList.remove('active');
            atlasTabButton.classList.remove('active');
            uvTabButton.classList.remove('active');
            rigTabButton.classList.add('active');
            
            // Update active content
            meshTab.classList.remove('active');
            atlasTab.classList.remove('active');
            uvTab.classList.remove('active');
            rigTab.classList.add('active');
        });
    }
}

/**
 * Start the debugging process
 */
function startDebugging() {
    console.log('Starting debugging...');
    
    // Get elements
    const viewport = document.getElementById('viewport');
    const tabContainer = document.getElementById('tab-container');
    
    // Show viewport and tab container
    if (viewport) {
        viewport.style.display = 'block';
    }
    
    if (tabContainer) {
        tabContainer.style.display = 'flex';
    }
    
    // Set up tab navigation
    setupTabNavigation();
    
    // Import and initialize the scene
    import('./core/scene.js').then(sceneModule => {
        console.log('Scene module loaded');
        sceneModule.initScene(viewport);
        sceneModule.startAnimation();
        
        // Import and initialize the model
        import('./core/models.js').then(modelsModule => {
            modelsModule.loadDebugModel();
        });
    });
}

/**
 * Restart the debugging process
 */
function restartDebugging() {
    console.log('Restarting debugging...');
    
    // Reload the page to start over
    window.location.reload();
}

// Export for external use
export default init; 