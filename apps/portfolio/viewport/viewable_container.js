import { OverlayContainer } from "./overlay/overlay_container";
import { extract_type, TYPES, WEST} from './overlay/overlay_common';
import { CameraManager } from './camera_manager';
import { THREE } from "../common";
import { FLAGS } from "../common";
export const UI_Z_DIST = 25;

export class ViewableContainer {
	detect_rotation = false;
	detect_pan = false;
	overlay_container;
	left_mouse_down = false;
	right_mouse_down = false;
	camera_manager;
	asset_handler;

	constructor(window) {
		this.viewable_container_container = new THREE.Object3D();
		this.parent = window.scene;
		this.world = window.world;
		this.asset_handler = window.asset_handler || window.world.asset_handler;
		const camera_config = window.manifest_manager.get_camera_config();
		this.camera = this.asset_handler.spawn_scene_camera(camera_config);
		this.camera_manager = new CameraManager(this.parent, this.camera, camera_config.ui_distance);
		this.overlay_container = new OverlayContainer(this.viewable_container_container, this.get_camera());
		this.camera_manager.set_overlay_container(this.overlay_container);
		this.camera_manager.add_update_callback(() => {
			if (this.overlay_container) {
				this.overlay_container.resize_reposition_offscreen();
			}
		});
		this.viewable_container_container.add(this.camera);
		this.parent.add(this.viewable_container_container);
	}

	swap_sides() {
		this.get_overlay().swap_column_sides();
	}

	reset_hover() {
		this.get_overlay().reset_hover();
	}

	focus_text_box(incoming_name) {
		this.get_overlay().focus_text_box(incoming_name);
	}

	open_link(incoming_url) {
		this.get_overlay().open_link(incoming_url);
	}

	lose_focus_text_box(incoming_direction = null) {
		this.get_overlay().lose_focus_text_box(incoming_direction);
	}

	reset_camera() {
		this.get_camera().aspect = window.innerWidth / window.innerHeight;
		this.get_camera().updateProjectionMatrix();
		this.camera_manager.update_camera();
	}

	resize_reposition() {
		if(this.is_overlay_hidden()){
			this.get_overlay().resize_reposition_offscreen();
		} else {
			this.get_overlay().resize_reposition();
		}
	}

	trigger_overlay() {
		this.get_overlay().trigger_overlay();
	}

	handle_mouse_up(found_intersections){
		if(FLAGS.SELECT_LOGS) {
			console.log("Mouse up handler:", {
				is_column_left: this.is_column_left_side(),
				found_intersections: found_intersections.length > 0 ? 
					found_intersections[0].object.name : 'none',
				focused_text: this.is_text_active() ? this.get_active_name() : 'none',
				is_animating: this.is_animating()
			});
		}
		if (this.is_animating()) {
			if(FLAGS.SELECT_LOGS) {
				console.log("Skipping interaction - animation in progress");
			}
			return;
		}
		if(this.is_column_left_side()){
			if(found_intersections.length > 0){
				const intersected_object = found_intersections[0].object;
				const object_name = intersected_object.name;
				const name_type = extract_type(intersected_object);
				switch(name_type) {
				case TYPES.LABEL:
					if(FLAGS.SELECT_LOGS) {
						console.log(object_name, "clicked up");
					}
					this.reset_hover();
					this.swap_sides();
					this.focus_text_box(object_name);
					break;
				case TYPES.HIDE:
					this.trigger_overlay();
					break;
				case TYPES.LINK:
					this.open_link(object_name.split("_")[1].trim());
					break;
				}
			}
		} else {
			if(found_intersections.length > 0) {
				const intersected_object = found_intersections[0].object;
				const object_name = intersected_object.name;
				const name_type = extract_type(intersected_object);
				if(FLAGS.SELECT_LOGS) {
					console.log("Right column click:", {
						object_name,
						name_type
					});
				}
				switch(name_type) {
				case TYPES.LABEL:
					if(FLAGS.SELECT_LOGS) {
						console.log(object_name, "clicked up on right side");
					}
					this.focus_text_box(object_name);
					break;
				case TYPES.LINK:
					this.open_link(object_name.split("_")[1].trim());
					break;
				case TYPES.TEXT:
				case TYPES.TEXT_BLOCK:
				case TYPES.BACKGROUND:
					if(FLAGS.SELECT_LOGS) {
						console.log("Clicked on text element, not swapping sides");
					}
					break;
				default:
					if(FLAGS.SELECT_LOGS) {
						console.log("Clicked outside elements, swapping sides");
					}
					this.swap_sides();
					this.lose_focus_text_box(WEST);
				}
			} else {
				if(FLAGS.SELECT_LOGS) {
					console.log("No intersection, swapping sides");
				}
				this.swap_sides();
				this.lose_focus_text_box(WEST);
			}
		}
	}

	handle_mouse_down(found_intersections) {
		if(FLAGS.SELECT_LOGS) {
			console.log("Mouse down handler:", {
				is_column_left: this.is_column_left_side(),
				found_intersections: found_intersections.length > 0 ? 
					found_intersections[0].object.name : 'none',
				is_animating: this.is_animating()
			});
		}
		if (this.is_animating()) {
			if(FLAGS.SELECT_LOGS) {
				console.log("Skipping interaction - animation in progress");
			}
			return;
		}
		if(found_intersections.length > 0) {
			const intersected_object = found_intersections[0].object;
			const object_name = intersected_object.name;
			const name_type = extract_type(intersected_object);
			switch(name_type) {
			case TYPES.LABEL:
				if(FLAGS.SELECT_LOGS) {
					console.log(object_name, "clicked down");
				}
				break;
			}
		}
	}

	is_primary_triggered() {
		return this.get_overlay().primary_control_trigger;
	}

	is_secondary_triggered() {
		return this.get_overlay().secondary_control_trigger;
	}

	is_column_left_side() {
		return this.get_overlay().is_label_container_left_side();
	}

	is_text_active() {
		return this.overlay_container.is_text_active();
	}

	is_overlay_hidden() {
		return this.get_overlay().is_overlay_hidden();
	}

	is_animating() {
		return this.get_overlay().is_animating();
	}

	get_hide_transition_map() {
		return this.get_overlay().hide_transition_map;
	}

	get_camera() {
		return this.camera;
	}

	get_camera_manager() {
		return this.camera_manager;
	}

	get_overlay() {
		return this.overlay_container;
	}

	get_active_name() {
		return this.overlay_container.get_active_box().name;
	}

	get_viewable_container() {
		return this.viewable_container_container;
	}

	get_intersected_name() {
		return this.get_overlay().intersected_name();
	}
}