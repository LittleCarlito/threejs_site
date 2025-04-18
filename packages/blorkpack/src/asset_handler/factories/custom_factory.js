import { THREE, RAPIER } from "../../index.js";
import { AssetUtils } from "../../index.js";
import CustomTypeManager from "../../custom_type_manager.js";
import { AssetStorage } from "../../asset_storage.js";
import { BLORKPACK_FLAGS } from "../../blorkpack_flags.js";
import { IdGenerator } from "../common/id_generator.js";
import { CollisionFactory } from "./collision_factory.js";
/**
 * Factory class responsible for spawning custom assets in the scene.
 * Handles loading and spawning of custom 3D models with physics.
 */
export class CustomFactory {
	static #instance = null;
	static #disposed = false;
	storage;
	scene;
	world;
	// Cache the types and configs from CustomTypeManager
	#assetTypes = null;
	#assetConfigs = null;
	/**
     * Constructor
     * @param {THREE.Scene} scene - The Three.js scene to add objects to
     * @param {RAPIER.World} world - The physics world
     */
	constructor(scene = null, world = null) {
		// Singleton pattern - throw error if trying to create new instance
		if (CustomFactory.#instance) {
			throw new Error('CustomFactory is a singleton. Use CustomFactory.get_instance() instead.');
		}
		// Initialize properties
		this.storage = AssetStorage.get_instance();
		this.scene = scene;
		this.world = world;
		// Cache asset types and configs
		this.#assetTypes = CustomTypeManager.getTypes();
		this.#assetConfigs = CustomTypeManager.getConfigs();
		// Store the instance
		CustomFactory.#instance = this;
		CustomFactory.#disposed = false;
	}
	/**
     * Gets or creates the singleton instance of CustomFactory
     * @param {THREE.Scene} scene - The Three.js scene to add objects to
     * @param {RAPIER.World} world - The physics world
     * @returns {CustomFactory} The singleton instance
     */
	static get_instance(scene, world) {
		if (CustomFactory.#disposed) {
			CustomFactory.#instance = null;
			CustomFactory.#disposed = false;
		}
		if (!CustomFactory.#instance) {
			CustomFactory.#instance = new CustomFactory(scene, world);
		} else if (scene || world) {
			// Update scene and world if provided
			if (scene) CustomFactory.#instance.scene = scene;
			if (world) CustomFactory.#instance.world = world;
		}
		return CustomFactory.#instance;
	}
	/**
     * Dispose of the factory instance and clean up resources
     */
	dispose() {
		if (!CustomFactory.#instance) return;
		// Clear references
		this.scene = null;
		this.world = null;
		this.storage = null;
		this.#assetTypes = null;
		this.#assetConfigs = null;
		CustomFactory.#disposed = true;
		CustomFactory.#instance = null;
	}
	/**
	 *
	 */
	static dispose_instance() {
		if (CustomFactory.#instance) {
			CustomFactory.#instance.dispose();
		}
	}
	/**
     * Spawns a custom asset of the specified type at the given position with the given rotation
     * @param {string} asset_type - The type of asset to spawn
     * @param {THREE.Vector3} position - The position to spawn the asset at
     * @param {THREE.Quaternion} rotation - The rotation of the asset
     * @param {Object} options - Additional options for spawning
     * @returns {Promise<Object>} A promise that resolves with the spawned asset details
     */
	async spawn_custom_asset(asset_type, position = new THREE.Vector3(), rotation = new THREE.Quaternion(), options = {}) {
		try {
			// Check if custom types have been loaded
			if (!CustomTypeManager.hasLoadedCustomTypes()) {
				console.error(`Custom types not loaded yet. Please ensure CustomTypeManager.loadCustomTypes() is called before spawning assets.`);
				console.error(`Failed to spawn asset type: "${asset_type}"`);
				return null;
			}
			// Check if the type exists
			if (!CustomTypeManager.hasType(asset_type)) {
				console.error(`Unsupported asset type: "${asset_type}". Cannot spawn asset.`);
				console.error(`Available types:`, Object.keys(CustomTypeManager.getTypes()));
				return null;
			}
			// Get the actual asset type key from the custom type manager
			const customTypeKey = CustomTypeManager.getType(asset_type);
			if (BLORKPACK_FLAGS.ASSET_LOGS) {
				console.log(`Spawning custom asset type: ${asset_type} (key: ${customTypeKey})`);
			}
			// Load the asset with the resolved custom type key
			const gltfData = await this.storage.load_asset_type(customTypeKey);
			if (!gltfData) {
				console.error(`Failed to load custom asset type: ${customTypeKey}`);
				return null;
			}
			// Get asset configuration from cache or CustomTypeManager
			let asset_config = this.#assetConfigs[customTypeKey];
			if (!asset_config) {
				// Try to get it from CustomTypeManager
				asset_config = CustomTypeManager.getConfig(customTypeKey);
				if (asset_config) {
					// Cache it for future use
					this.#assetConfigs[customTypeKey] = asset_config;
				} else {
					console.error(`No configuration found for custom asset type: ${customTypeKey}`);
					return null;
				}
			}
			// Clone the model and continue with regular asset loading flow
			const originalModel = gltfData.scene;
			const model = AssetUtils.cloneSkinnedMesh(originalModel);
			// Apply scaling based on asset_config
			const scale = asset_config.scale || 1.0;
			model.scale.set(scale, scale, scale);
			// Apply position and rotation
			model.position.copy(position);
			model.quaternion.copy(rotation);
			// Add interactable_ prefix to the model name to make it grabbable
			const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
			model.name = `interactable_${customTypeKey}_${uniqueId}`;
			// Hide collision meshes (objects with names starting with "col_")
			// And collect them for potential physics use
			const collisionMeshes = [];
			const displayMeshes = [];
			model.traverse((child) => {
				if (child.isMesh) {
					if (child.name.startsWith('col_')) {
						// This is a collision mesh - hide it and collect for physics
						child.visible = false;
						collisionMeshes.push(child);
					} else if (child.name.startsWith('display_')) {
						// This is a display mesh - make it visible but transparent by default
						child.visible = true;
						if (BLORKPACK_FLAGS.ASSET_LOGS) {
							console.log(`Setting display mesh ${child.name} to transparent by default`);
						}
						// Create a transparent material as the default for display meshes
						const displayMaterial = this.createDisplayMeshMaterial(0); // 0 = transparent
						// Apply the material to the display mesh
						child.material = displayMaterial;
						// Explicitly set display state to transparent (0) in userData
						// This ensures the debug UI will recognize it as transparent
						if (model.userData) {
							model.userData.currentDisplayImage = 0;
							if (BLORKPACK_FLAGS.ASSET_LOGS) {
								console.log(`Set userData.currentDisplayImage to 0 (transparent) for ${model.name}`);
							}
						}
						if (BLORKPACK_FLAGS.ASSET_LOGS) {
							console.log(`Applied transparent material to display mesh: ${child.name} in ${customTypeKey}`);
						}
						// Keep track of display meshes
						displayMeshes.push(child);
						if (BLORKPACK_FLAGS.ASSET_LOGS) {
							console.log(`Found display mesh: ${child.name} in ${customTypeKey}`);
						}
					} else {
						// Add interactable_ prefix to all visible meshes to make them grabbable
						// Use the same naming convention for child meshes
						const childId = child.id || Math.floor(Math.random() * 10000);
						child.name = `interactable_${customTypeKey}_${child.name || 'part'}_${childId}`;
					}
				}
			});
			// Store reference to display meshes in model's userData if available
			if (displayMeshes.length > 0) {
				model.userData.displayMeshes = displayMeshes;
				// Add a helper function to switch between atlas images
				model.userData.switchDisplayImage = (imageIndex) => {
					if (imageIndex < 0 || imageIndex > 2) {
						console.error(`Invalid image index: ${imageIndex}. Must be between 0 and 2.`);
						return;
					}
					displayMeshes.forEach(mesh => {
						if (mesh.material && mesh.material.map) {
							const texture = mesh.material.map;
							// Set offset based on the selected image (0, 1, or 2)
							texture.offset.x = imageIndex / 3;
							// Ensure the texture is updated
							texture.needsUpdate = true;
						}
					});
				};
			}
			// Add objects to scene in next frame to prevent stuttering
			await new Promise(resolve => setTimeout(resolve, 0));
			// Add to scene
			this.scene.add(model);
			// Make the model and all its children accessible for physics
			model.userData.assetType = customTypeKey;
			let physicsBody = null;
			// Add physics if enabled
			if (options.enablePhysics !== false && this.world) {
				// Create a basic physics body
				const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
					.setTranslation(position.x, position.y, position.z)
					.setLinearDamping(0.5)
					.setAngularDamping(0.6);
				// Explicitly set gravity scale to ensure gravity affects this object
				rigidBodyDesc.setGravityScale(1.0);
				// Set initial rotation if provided
				if (rotation) {
					rigidBodyDesc.setRotation(rotation);
				}
				physicsBody = this.world.createRigidBody(rigidBodyDesc);
				// Check if we have collision meshes to use for more accurate colliders
				if (collisionMeshes.length > 0) {
					// Use the collision meshes for physics
					for (const collisionMesh of collisionMeshes) {
						await CollisionFactory.get_instance(this.world).create_collider_from_mesh(collisionMesh, physicsBody, asset_config, options);
					}
				} else {
					// Fallback to simple cuboid collider
					const halfScale = asset_config.scale / 2;
					let collider_desc;
					// Use different collider shapes based on asset type or configuration
					if (options.colliderType === 'sphere') {
						collider_desc = RAPIER.ColliderDesc.ball(halfScale);
					} else if (options.colliderType === 'capsule') {
						collider_desc = RAPIER.ColliderDesc.capsule(halfScale, halfScale * 0.5);
					} else {
						// Default to cuboid
						collider_desc = RAPIER.ColliderDesc.cuboid(halfScale, halfScale, halfScale);
					}
					// Set physics materials
					collider_desc.setRestitution(asset_config.restitution || 0.5);
					collider_desc.setFriction(asset_config.friction || 0.5);
					// Create the collider and attach it to the rigid body
					this.world.createCollider(collider_desc, physicsBody);
					// Create debug wireframe if debug is enabled
					if (BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) {
						try {
							await this.create_debug_wireframe(
								'box',
								{ width: halfScale * 2, height: halfScale * 2, depth: halfScale * 2 },
								position,
								rotation,
								{ color: 0x00ff00, opacity: 0.3, body: physicsBody }
							);
						} catch (error) {
							console.warn('Failed to create debug wireframe:', error);
						}
					}
				}
				if (BLORKPACK_FLAGS.PHYSICS_LOGS) {
					console.log(`Created physics body for ${customTypeKey} with mass: ${asset_config.mass || 1.0}, scale: ${scale}`);
				}
			}
			// Register with asset storage
			const instance_id = this.storage.add_object(model, physicsBody);
			return {
				mesh: model,
				body: physicsBody,
				instance_id
			};
		} catch (error) {
			console.error(`Error spawning custom asset ${asset_type}:`, error);
			return null;
		}
	}
	/**
     * Creates a material for display meshes based on the specified display mode
     * @param {number} displayMode - 0: Transparent, 1: Black Screen, 2: White Screen
     * @returns {THREE.Material} The created material
     */
	createDisplayMeshMaterial(displayMode = 0) {
		let material;
		switch(displayMode) {
		case 0: // Transparent
			material = new THREE.MeshStandardMaterial({
				color: 0xffffff,            // White base color
				transparent: true,           // Enable transparency
				opacity: 0.0,                // Fully transparent
				side: THREE.DoubleSide
			});
			break;
		case 1: // Black Screen
			material = new THREE.MeshStandardMaterial({
				color: 0x000000,            // Black base color
				emissive: 0x000000,         // No emission (black)
				emissiveIntensity: 0,       // No emission intensity
				side: THREE.DoubleSide
			});
			break;
		case 2: // White Screen
			material = new THREE.MeshStandardMaterial({
				color: 0xffffff,            // White base color
				emissive: 0xffffff,         // White emission
				emissiveIntensity: 0.3,     // Moderate emission intensity to avoid too bright
				side: THREE.DoubleSide
			});
			break;
		default: // Default to transparent if invalid mode
			console.warn(`Invalid display mode: ${displayMode}, defaulting to transparent`);
			material = new THREE.MeshStandardMaterial({
				color: 0xffffff,
				transparent: true,
				opacity: 0.0,
				side: THREE.DoubleSide
			});
		}
		return material;
	}
	/**
     * Creates a debug wireframe for visualizing physics shapes
     * @param {string} type - The type of wireframe to create
     * @param {Object} dimensions - The dimensions of the wireframe
     * @param {THREE.Vector3} position - The position of the wireframe
     * @param {THREE.Quaternion} rotation - The rotation of the wireframe
     * @param {Object} options - Additional options for the wireframe
     * @returns {Promise<THREE.Mesh>} The created wireframe mesh
     */
	async create_debug_wireframe(type, dimensions, position, rotation, options = {}) {
		let geometry;
		// If we have a mesh geometry provided, use it directly for maximum accuracy
		if (type === 'mesh' && options.geometry) {
			geometry = options.geometry;
		} else {
			// Otherwise create a primitive shape based on dimensions
			const size = dimensions || { x: 1, y: 1, z: 1 };
			switch (type) {
			case 'cuboid':
				geometry = new THREE.BoxGeometry(size.x * 2, size.y * 2, size.z * 2);
				break;
			case 'sphere':
				geometry = new THREE.SphereGeometry(size.radius || 1, 16, 16);
				break;
			case 'capsule':
				// Approximate capsule with cylinder
				geometry = new THREE.CylinderGeometry(size.radius, size.radius, size.height, 16);
				break;
			default:
				geometry = new THREE.BoxGeometry(1, 1, 1);
			}
		}
		// Define the colors we'll use
		const staticColor = 0x00FF00; // Green for static objects
		// Set of blue colors for dynamic objects
		const blueColors = [
			0x0000FF, // Pure blue
			0x4444FF, // Light blue
			0x0088FF, // Sky blue
			0x00AAFF, // Azure
			0x00FFFF, // Cyan
			0x0066CC, // Medium blue
			0x0033AA, // Dark blue
			0x3366FF, // Royal blue
			0x6666FF, // Periwinkle
			0x0099CC  // Ocean blue
		];
		// Choose a color based on position hash to ensure consistent but varied colors
		let color;
		if (options.isStatic === true) {
			// Static objects (like rooms) are green
			color = staticColor;
		} else {
			// Generate a simple hash based on the object's position
			// This ensures the same object gets the same color, but different objects get different colors
			let hash = 0;
			// Use position for a simple hash
			const posX = Math.round(position.x * 10);
			const posY = Math.round(position.y * 10);
			const posZ = Math.round(position.z * 10);
			hash = Math.abs(posX + posY * 31 + posZ * 47) % blueColors.length;
			// Select a blue color using the hash
			color = blueColors[hash];
		}
		const material = new THREE.MeshBasicMaterial({ 
			color: color,
			wireframe: true,
			transparent: true,
			opacity: 0.7
		});
		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.copy(position);
		mesh.quaternion.copy(rotation);
		// Apply scale for mesh-type wireframes
		if (options.scale && type === 'mesh') {
			mesh.scale.copy(options.scale);
		}
		mesh.renderOrder = 999; // Ensure wireframes render on top
		// Store any references needed to update this wireframe
		mesh.userData.physicsBodyId = options.bodyId;
		mesh.userData.debugType = type;
		mesh.userData.originalObject = options.originalObject;
		mesh.userData.isStatic = options.isStatic;
		// Add objects to scene in next frame to prevent stuttering
		await new Promise(resolve => setTimeout(resolve, 0));
		// Only add to scene and store if debug is enabled
		if (BLORKPACK_FLAGS.COLLISION_VISUAL_DEBUG) {
			this.scene.add(mesh);
			this.debugMeshes.set(mesh.uuid, mesh);
		}
		return mesh;
	}
	/**
     * Spawns all custom assets from the manifest
     * @param {Object} manifest_manager - Instance of ManifestManager
     * @param {Function} progress_callback - Optional callback function for progress updates
     * @returns {Promise<Array>} Array of spawned custom assets
     */
	async spawn_custom_assets(manifest_manager, progress_callback = null) {
		const spawned_assets = [];
		try {
			// Get all custom assets from manifest
			const custom_assets = manifest_manager.get_custom_assets();
			if (!custom_assets || custom_assets.length === 0) {
				if (BLORKPACK_FLAGS.ASSET_LOGS) {
					console.log("No custom assets found in manifest");
				}
				return spawned_assets;
			}
			if (BLORKPACK_FLAGS.ASSET_LOGS) {
				console.log(`Found ${custom_assets.length} custom assets to spawn`);
			}
			// Process each custom asset
			for (const asset_data of custom_assets) {
				// Extract position and rotation from asset data
				const position = new THREE.Vector3(
					asset_data.position?.x || 0, 
					asset_data.position?.y || 0, 
					asset_data.position?.z || 0
				);
				// Create rotation from Euler angles
				const rotation = new THREE.Euler(
					asset_data.rotation?.x || 0,
					asset_data.rotation?.y || 0,
					asset_data.rotation?.z || 0
				);
				const quaternion = new THREE.Quaternion().setFromEuler(rotation);
				// Prepare options from asset data
				const options = {
					scale: asset_data.scale,
					material: asset_data.material,
					collider: asset_data.collider,
					mass: asset_data.mass,
					...asset_data.options
				};
				// Spawn the custom asset
				const result = await this.spawn_custom_asset(
					asset_data.asset_type,
					position,
					quaternion,
					options
				);
				if (result) {
					// Store the asset ID with the spawned asset data
					result.id = asset_data.id;
					spawned_assets.push(result);
				}
			}
			if (BLORKPACK_FLAGS.ASSET_LOGS) {
				console.log(`Spawned ${spawned_assets.length} custom assets from manifest`);
			}
			return spawned_assets;
		} catch (error) {
			console.error("Error spawning custom assets:", error);
			return spawned_assets;
		}
	}
}
