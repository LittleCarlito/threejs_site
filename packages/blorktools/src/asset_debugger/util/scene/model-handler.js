/**
 * Models Module
 * 
 * Handles creation and loading of 3D models for debugging.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getState, updateState } from '../state/scene-state.js';
import { createMaterial } from './pbr-material-factory.js';
import { fitCameraToObject } from './threejs-scene-controller.js';
import { createMeshVisibilityPanel } from '../../panels/mesh-panel/mesh-panel.js';
import { updateAtlasVisualization } from '../../panels/atlas-panel/atlas-panel.js';
import { updateUvPanel } from '../../panels/uv-panel/uv-panel.js';

/**
 * Load and setup a custom model from file
 * @param {HTMLElement} loadingIndicator - Loading indicator element to show/hide
 * @returns {Promise} A promise that resolves when the model is loaded and set up
 */
export function loadAndSetupModel(loadingIndicator) {
    const state = getState();
    
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        const reader = new FileReader();
        
        reader.onload = function(event) {
            const modelData = event.target.result;
            
            try {
                Promise.all([
                    import('../data/mesh-html-manager.js'),
                    import('../../modals/html-editor-modal/model-integration.js')
                ]).then(([meshDataUtil, modelIntegration]) => {
                    let bufferPromises = [];
                    
                    if (typeof meshDataUtil.setCurrentGlbBuffer === 'function') {
                        meshDataUtil.setCurrentGlbBuffer(modelData);
                    }
                    
                    if (modelIntegration.processModelFileForHtmlEditor && state.modelFile) {
                        bufferPromises.push(modelIntegration.processModelFileForHtmlEditor(state.modelFile));
                    }
                    
                    if (!state.currentGlb) {
                        updateState('currentGlb', {
                            arrayBuffer: modelData,
                            fileName: state.modelFile?.name || 'model.glb',
                            fileSize: state.modelFile?.size || modelData.byteLength
                        });
                    } else {
                        state.currentGlb.arrayBuffer = modelData;
                    }
                    
                    return Promise.all(bufferPromises).then(() => {
                        const buffer = state.currentGlb?.arrayBuffer || 
                                      (modelIntegration.getCurrentGlbBuffer && modelIntegration.getCurrentGlbBuffer());
                        
                        if (!buffer) {
                            console.warn('GLB buffer was not set during processing.');
                        }
                        
                        return buffer;
                    });
                }).then((buffer) => {
                    loader.parse(modelData, '', (gltf) => {
                        try {
                            processLoadedModel(gltf);
                            resolve();
                        } catch (processError) {
                            reject(processError);
                        }
                    }, undefined, function(error) {
                        alert('Error loading model. Please make sure it is a valid glTF/GLB file.');
                        reject(error);
                    });
                }).catch(error => {
                    loader.parse(modelData, '', (gltf) => {
                        try {
                            processLoadedModel(gltf);
                            resolve();
                        } catch (processError) {
                            reject(processError);
                        }
                    }, undefined, function(error) {
                        alert('Error loading model. Please make sure it is a valid glTF/GLB file.');
                        reject(error);
                    });
                });
            } catch (parseError) {
                alert('Error parsing model data: ' + parseError.message);
                reject(parseError);
            }
        };
        
        reader.onerror = function(error) {
            alert('Error reading model file: ' + error);
            reject(error);
        };
        
        reader.readAsArrayBuffer(state.modelFile);
    });
}

/**
 * Process a loaded GLTF model
 * @param {Object} gltf - The loaded GLTF data
 */
function processLoadedModel(gltf) {
    const state = getState();
    
    try {
        if (state.scene) {
            if (state.model) {
                state.scene.remove(state.model);
            }
            if (state.cube) {
                state.scene.remove(state.cube);
            }
        }
        
        updateState('meshes', []);
        updateState('meshGroups', {});
        
        const model = gltf.scene;
        updateState('model', model);
        
        const baseMaterial = createMaterial();
        
        const meshes = [];
        model.traverse(node => {
            if (node.isMesh) {
                const originalMaterial = node.material;
                const material = baseMaterial.clone();
                
                if (state.textureObjects.baseColor && originalMaterial.map && material.map) {
                    material.map.offset.copy(originalMaterial.map.offset);
                    material.map.repeat.copy(originalMaterial.map.repeat);
                    material.map.rotation = originalMaterial.map.rotation;
                }
                
                node.material = material;
                
                if (state.textureObjects.orm && !node.geometry.attributes.uv2 && node.geometry.attributes.uv) {
                    node.geometry.attributes.uv2 = node.geometry.attributes.uv;
                }
                
                meshes.push(node);
                node.userData.meshId = meshes.length - 1;
            }
        });
        
        updateState('meshes', meshes);
        state.scene.add(model);
        
        createMeshVisibilityPanel();
        fitCameraToObject(model);
        
        const atlasTab = document.getElementById('atlas-tab');
        const uvTab = document.getElementById('uv-tab');
        
        if (atlasTab && atlasTab.classList.contains('active')) {
            updateAtlasVisualization();
        }
        if (uvTab && uvTab.classList.contains('active')) {
            updateUvPanel();
        }
        
        import('../../panels/rig-panel/rig-panel.js').then(module => {
            if (module.updateRigPanel) {
                module.updateRigPanel();
            }
        }).catch(err => {
            console.error('Error importing rig-panel.js:', err);
        });
        
    } catch (processError) {
        alert('Error processing model: ' + processError.message);
    }
}

/**
 * Create a basic cube with loaded textures for material debugging
 * @returns {THREE.Mesh} The created cube mesh
 */
export function createCube() {
    const state = getState();
    
    if (!state.scene) {
        throw new Error("Scene not initialized. Try again after scene is ready.");
    }
    
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    
    if (state.textureObjects.orm && state.textureObjects.orm.image) {
        geometry.attributes.uv2 = geometry.attributes.uv;
    }
    
    const material = createMaterial();
    const cube = new THREE.Mesh(geometry, material);
    cube.name = "Cube";
    
    state.scene.add(cube);
    updateState('cube', cube);
    updateState('meshes', [cube]);
    
    createMeshVisibilityPanel();
    fitCameraToObject(cube);
    
    const atlasTab = document.getElementById('atlas-tab');
    const uvTab = document.getElementById('uv-tab');
    
    if (atlasTab && atlasTab.classList.contains('active')) {
        updateAtlasVisualization();
    }
    if (uvTab && uvTab.classList.contains('active')) {
        updateUvPanel();
    }
    
    return cube;
}

/**
 * Create a multi-material test cube for lighting showcase
 * Each face has a different material to show different lighting properties
 * @returns {THREE.Mesh} The created lighting test cube mesh
 */
export function createLightingTestCube() {
    const state = getState();
    
    if (!state.scene) {
        throw new Error("Scene not initialized. Try again after scene is ready.");
    }
    
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    
    const materials = [
        new THREE.MeshStandardMaterial({
            color: 0x8888ff,
            metalness: 1.0,
            roughness: 0.1,
            name: 'Metal'
        }),
        new THREE.MeshStandardMaterial({
            color: 0xcc3333,
            metalness: 0.0,
            roughness: 0.9,
            name: 'Matte'
        }),
        new THREE.MeshStandardMaterial({
            color: 0x8B4513,
            metalness: 0.0,
            roughness: 0.7,
            name: 'Wood'
        }),
        new THREE.MeshStandardMaterial({
            color: 0x22cc22,
            metalness: 0.1,
            roughness: 0.5,
            name: 'Plastic'
        }),
        new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0.0,
            roughness: 0.3,
            name: 'Ceramic'
        }),
        new THREE.MeshStandardMaterial({
            color: 0xaaccff,
            metalness: 0.2,
            roughness: 0.1,
            transparent: true,
            opacity: 0.7,
            name: 'Glass'
        })
    ];
    
    const cube = new THREE.Mesh(geometry, materials);
    cube.name = "LightingTestCube";
    
    state.scene.add(cube);
    updateState('cube', cube);
    updateState('meshes', [cube]);
    
    createMeshVisibilityPanel();
    fitCameraToObject(cube);
    
    return cube;
}

/**
 * Load the appropriate model for debugging
 * @returns {Promise} A promise that resolves when the model is loaded
 */
export function loadDebugModel() {
    const state = getState();
    const loadingIndicator = document.getElementById('loading-indicator');
    
    if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
    }
    
    return new Promise((resolve, reject) => {
        if (!state.scene) {
            let attempts = 0;
            const maxAttempts = 10;
            const checkInterval = setInterval(() => {
                attempts++;
                if (state.scene) {
                    clearInterval(checkInterval);
                    handleModelLoading()
                        .then(() => {
                            if (loadingIndicator) loadingIndicator.style.display = 'none';
                            resolve();
                        })
                        .catch((error) => {
                            if (loadingIndicator) loadingIndicator.style.display = 'none';
                            reject(error);
                        });
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    const error = new Error('Scene initialization timeout');
                    if (loadingIndicator) loadingIndicator.style.display = 'none';
                    reject(error);
                }
            }, 300);
        } else {
            handleModelLoading()
                .then(() => {
                    if (loadingIndicator) loadingIndicator.style.display = 'none';
                    resolve();
                })
                .catch((error) => {
                    if (loadingIndicator) loadingIndicator.style.display = 'none';
                    reject(error);
                });
        }
    });
}

/**
 * Handle model loading based on current state
 * @returns {Promise} A promise that resolves when the model is loaded
 */
function handleModelLoading() {
    return prepareGlbBuffer().then(loadModelBasedOnState);
}

/**
 * Prepare the GLB buffer for HTML editor integration if a custom model file is available
 * @returns {Promise} A promise that resolves when the GLB buffer is prepared
 */
function prepareGlbBuffer() {
    const state = getState();
    
    if (state.useCustomModel && state.modelFile) {
        return Promise.all([
            import('../data/mesh-html-manager.js'),
            import('../../modals/html-editor-modal/model-integration.js')
        ]).then(([meshDataUtil, modelIntegration]) => {
            if (modelIntegration.processModelFileForHtmlEditor) {
                return modelIntegration.processModelFileForHtmlEditor(state.modelFile)
                    .then(() => {
                        const updatedState = getState();
                        const buffer = updatedState.currentGlb?.arrayBuffer || modelIntegration.getCurrentGlbBuffer();
                        
                        if (!buffer) {
                            console.warn('GLB buffer was not set during pre-processing.');
                        }
                        
                        return buffer;
                    });
            }
            return Promise.resolve(null);
        }).catch(error => {
            return Promise.resolve(null);
        });
    }
    
    return Promise.resolve(null);
}

/**
 * Load the appropriate model based on current state
 * @returns {Promise} A promise that resolves when the model is loaded
 */
function loadModelBasedOnState() {
    const state = getState();
    
    return new Promise((resolve, reject) => {
        try {
            if (state.selectedExample) {
                if (state.selectedExample === 'rig') {
                    import('../../modals/examples-modal/examples.js').then(examplesModule => {
                        examplesModule.loadExample('wireframe-cube')
                            .then(resolve)
                            .catch(error => {
                                resolve();
                            });
                    }).catch(error => {
                        resolve();
                    });
                } else {
                    console.warn(`Unknown example type: ${state.selectedExample}`);
                    resolve();
                }
            } else if (state.useCustomModel && state.modelFile) {
                loadAndSetupModel(null)
                    .then(resolve)
                    .catch(reject);
            } else if (state.useLightingTestCube) {
                try {
                    createLightingTestCube();
                    resolve();
                } catch (error) {
                    reject(error);
                }
            } else if (state.textureObjects.baseColor || 
                      state.textureObjects.orm || 
                      state.textureObjects.normal) {
                try {
                    createCube();
                    resolve();
                } catch (error) {
                    reject(error);
                }
            } else {
                resolve();
            }
        } catch (error) {
            reject(error);
        }
    });
}