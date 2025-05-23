/**
 * Mesh Settings Modal
 * 
 * This module handles the functionality of the mesh settings modal.
 * It allows users to configure how HTML content is displayed on meshes.
 */

import { getState, updateState } from '../../core/state.js';
import { getCurrentGlbBuffer } from './model-integration.js';

// Store HTML settings for each mesh
const meshHtmlSettings = new Map();

// Flag to track if modal was opened from HTML editor
let openedFromHtmlEditor = false;

// Default settings for HTML content
const defaultSettings = {
    position: { x: 0, y: 0, z: 0 },
    scale: 1.0,
    opacity: 1.0,
    billboard: true,
    interactable: true,
    autoShow: true,
    distanceThreshold: 5.0,
    animation: {
        enabled: false,
        speed: 1.0,
        type: 'loop'
    }
};

/**
 * Open the Mesh Settings Modal for a specific mesh
 * @param {string} meshName - The name of the mesh
 * @param {number} meshId - The ID/index of the mesh
 * @param {Object} options - Additional options
 * @param {boolean} options.fromHtmlEditor - Whether the modal was opened from HTML editor
 */
export function openMeshSettingsModal(meshName, meshId, options = {}) {
    console.log(`openMeshSettingsModal called for mesh: ${meshName} (ID: ${meshId})`);
    
    try {
        // Track if opened from HTML editor
        openedFromHtmlEditor = !!options.fromHtmlEditor;
        
        const modal = document.getElementById('mesh-settings-modal');
        if (!modal) {
            console.error('Mesh Settings Modal element not found in the DOM');
            alert('Error: Could not find Mesh Settings Modal. Please try again.');
            return;
        }
        
        const meshNameEl = document.getElementById('mesh-settings-mesh-name');
        
        console.log('Found required modal elements');
        
        // Set mesh name in the modal title
        if (meshNameEl) meshNameEl.textContent = meshName;
        
        // Store the mesh ID in the modal's dataset
        modal.dataset.meshId = meshId;
        
        // Load settings for this mesh or use defaults
        loadSettingsForMesh(meshId);
        
        // Always ensure the highest z-index for this modal
        // No need to conditionally set based on openedFromHtmlEditor
        // As we always want it to be on top
        
        // Show the modal by adding the visible class
        modal.classList.add('visible');
        
        // Force the browser to recalculate styles to ensure modal is displayed correctly
        void modal.offsetWidth;
        
        console.log('Mesh Settings Modal opened successfully');
    } catch (error) {
        console.error('Error opening Mesh Settings Modal:', error);
        alert('Failed to open Mesh Settings. See console for details.');
    }
}

/**
 * Load settings for a specific mesh and update the UI
 * @param {number} meshId - The ID/index of the mesh
 */
function loadSettingsForMesh(meshId) {
    // Get settings for this mesh or use defaults
    const settings = meshHtmlSettings.get(meshId) || { ...defaultSettings };
    
    // Update position inputs
    document.getElementById('mesh-html-position-x').value = settings.position.x;
    document.getElementById('mesh-html-position-y').value = settings.position.y;
    document.getElementById('mesh-html-position-z').value = settings.position.z;
    
    // Update scale
    const scaleInput = document.getElementById('mesh-html-scale');
    const scaleValue = document.getElementById('mesh-html-scale-value');
    scaleInput.value = settings.scale;
    scaleValue.textContent = settings.scale.toFixed(1);
    
    // Update opacity
    const opacityInput = document.getElementById('mesh-html-opacity');
    const opacityValue = document.getElementById('mesh-html-opacity-value');
    opacityInput.value = settings.opacity;
    opacityValue.textContent = settings.opacity.toFixed(1);
    
    // Update checkbox settings
    document.getElementById('mesh-html-billboard').checked = settings.billboard;
    document.getElementById('mesh-html-interactable').checked = settings.interactable !== false; // Default to true if not set
    document.getElementById('mesh-html-auto-show').checked = settings.autoShow;
    
    // Update animation settings
    const animation = settings.animation || defaultSettings.animation;
    document.getElementById('mesh-html-animation-enabled').checked = animation.enabled;
    document.getElementById('mesh-html-animation-type').value = animation.type || defaultSettings.animation.type;
    
    // Update display of animation settings based on enabled state
    toggleAnimationControls(animation.enabled);
    
    // Update distance threshold
    const distanceInput = document.getElementById('mesh-html-distance');
    const distanceValue = document.getElementById('mesh-html-distance-value');
    distanceInput.value = settings.distanceThreshold;
    distanceValue.textContent = settings.distanceThreshold.toFixed(1);
    
    // Show/hide distance threshold based on auto-show setting
    document.getElementById('distance-threshold-group').style.display = 
        settings.autoShow ? 'block' : 'none';
}

/**
 * Toggle visibility of animation controls based on enabled state
 * @param {boolean} enabled - Whether animation is enabled
 */
function toggleAnimationControls(enabled) {
    const speedGroup = document.getElementById('animation-duration-group');
    const typeGroup = document.getElementById('animation-type-group');
    
    if (speedGroup && typeGroup) {
        speedGroup.style.display = enabled ? 'flex' : 'none';
        typeGroup.style.display = enabled ? 'flex' : 'none';
    }
}

/**
 * Get settings from form inputs
 * @returns {Object} The settings object
 */
function getSettingsFromForm() {
    const animationEnabled = document.getElementById('mesh-html-animation-enabled').checked;
    
    return {
        position: {
            x: parseFloat(document.getElementById('mesh-html-position-x').value),
            y: parseFloat(document.getElementById('mesh-html-position-y').value),
            z: parseFloat(document.getElementById('mesh-html-position-z').value)
        },
        scale: parseFloat(document.getElementById('mesh-html-scale').value),
        opacity: parseFloat(document.getElementById('mesh-html-opacity').value),
        billboard: document.getElementById('mesh-html-billboard').checked,
        interactable: document.getElementById('mesh-html-interactable').checked,
        autoShow: document.getElementById('mesh-html-auto-show').checked,
        distanceThreshold: parseFloat(document.getElementById('mesh-html-distance').value),
        animation: {
            enabled: animationEnabled,
            speed: parseFloat(document.getElementById('mesh-html-animation-speed').value),
            type: document.getElementById('mesh-html-animation-type').value
        }
    };
}

/**
 * Save settings for a specific mesh
 * @param {number} meshId - The ID/index of the mesh
 * @param {Object} settings - The settings to save
 */
function saveSettingsForMesh(meshId, settings) {
    meshHtmlSettings.set(meshId, settings);
    
    // Here you would typically update any live HTML content with the new settings
    // For now, we're just storing the settings in the meshHtmlSettings map
    
    const state = getState();
    if (state.meshes && state.meshes[meshId]) {
        // Store settings in mesh userData for persistence
        if (!state.meshes[meshId].userData) {
            state.meshes[meshId].userData = {};
        }
        state.meshes[meshId].userData.htmlSettings = settings;
        console.log(`Saved HTML settings for mesh: ${state.meshes[meshId].name}`);
    }
}

/**
 * Show a status message in the modal
 * @param {string} message - The message to display
 * @param {string} type - The type of message ('success', 'error', 'info')
 */
function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('mesh-settings-status');
    statusEl.textContent = message;
    statusEl.className = `settings-status ${type}`;
    
    // Clear the message after 3 seconds
    setTimeout(() => {
        statusEl.textContent = '';
        statusEl.className = 'settings-status';
    }, 3000);
}

/**
 * Close the Mesh Settings Modal
 */
function closeModal() {
    const modal = document.getElementById('mesh-settings-modal');
    modal.classList.remove('visible');
    
    // If opened from HTML editor, re-open the HTML editor modal
    if (openedFromHtmlEditor) {
        // Wait a short moment before reopening HTML editor to avoid visual glitches
        setTimeout(() => {
            // Need to dynamically import to avoid circular dependency
            import('./html-editor-modal.js').then(htmlEditorModule => {
                if (typeof htmlEditorModule.reopenHtmlEditorModal === 'function') {
                    htmlEditorModule.reopenHtmlEditorModal();
                }
            }).catch(error => {
                console.error('Error importing HTML editor module:', error);
            });
        }, 100);
        
        // Reset flag
        openedFromHtmlEditor = false;
    }
}

/**
 * Initialize the Mesh Settings Modal
 */
export function initMeshSettingsModal() {
    console.log('Initializing Mesh Settings Modal');
    
    // Get modal elements
    const modal = document.getElementById('mesh-settings-modal');
    const closeBtn = document.getElementById('mesh-settings-close');
    const cancelBtn = document.getElementById('mesh-settings-cancel');
    const saveBtn = document.getElementById('mesh-settings-save');
    
    // Make the modal available globally
    window.openMeshSettingsModal = openMeshSettingsModal;
    console.log('Registered global function: window.openMeshSettingsModal =', 
                typeof window.openMeshSettingsModal === 'function' ? 'Function successfully registered' : 'Failed to register function');

    if (!modal) {
        console.error('Mesh Settings Modal not found in the DOM');
        return;
    }

    // Close modal events
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    // Close modal when clicking outside (on the overlay)
    modal.addEventListener('click', function(e) {
        // Check if the click was directly on the modal (overlay) and not on its children
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Auto-show checkbox toggle
    document.getElementById('mesh-html-auto-show').addEventListener('change', function(e) {
        const distanceGroup = document.getElementById('distance-threshold-group');
        distanceGroup.style.display = e.target.checked ? 'block' : 'none';
    });
    
    // Animation enabled toggle
    document.getElementById('mesh-html-animation-enabled').addEventListener('change', function(e) {
        toggleAnimationControls(e.target.checked);
    });
    
    // Scale slider update
    document.getElementById('mesh-html-scale').addEventListener('input', function(e) {
        document.getElementById('mesh-html-scale-value').textContent = parseFloat(e.target.value).toFixed(1);
    });
    
    // Opacity slider update
    document.getElementById('mesh-html-opacity').addEventListener('input', function(e) {
        document.getElementById('mesh-html-opacity-value').textContent = parseFloat(e.target.value).toFixed(1);
    });
    
    // Distance slider update
    document.getElementById('mesh-html-distance').addEventListener('input', function(e) {
        document.getElementById('mesh-html-distance-value').textContent = parseFloat(e.target.value).toFixed(1);
    });
    
    // Save button
    saveBtn.addEventListener('click', () => {
        try {
            const currentMeshId = modal.dataset.meshId;
            if (currentMeshId) {
                const settings = getSettingsFromForm();
                saveSettingsForMesh(parseInt(currentMeshId), settings);
                closeModal();
                showStatus('Settings saved successfully', 'success');
            }
        } catch (error) {
            showStatus('Error saving settings: ' + error.message, 'error');
        }
    });
}

/**
 * Get settings for a specific mesh
 * @param {number} meshId - The ID/index of the mesh
 * @returns {Object} The HTML settings for the mesh, or default settings if not found
 */
export function getHtmlSettingsForMesh(meshId) {
    return meshHtmlSettings.get(meshId) || { ...defaultSettings };
}

// Export for module use
export default {
    initMeshSettingsModal,
    openMeshSettingsModal,
    getHtmlSettingsForMesh
};