# Blorktools - 3D Asset Development Toolset

A collection of development and debugging tools for 3D assets in Three.js applications.

## Installation

```bash
npm install @littlecarlito/blorktools
```

## Features

- **Asset Debugger**: Interactive tool for debugging 3D models and textures
  - UV mapping visualization
  - Multi-texture support with different UV channels
  - Atlas visualization for texture mapping
  - Detailed model information
  - Texture management and blending
- **Performance Monitoring**: Track and optimize 3D scene performance
- **Scene Inspection**: Debug scene hierarchy and object properties

## Usage

### As a Development Tool

When used within the main project, the tools automatically start with:
```bash
npm run dev
```

The tools will start on the next available port after the main application.

### Standalone Usage

Run the tools independently:
```bash
npm run tools
```

Run the modular version (new architecture):
```bash
npm run tools:modular
```

### Programmatic Usage

```javascript
import { tools } from '@littlecarlito/blorktools';

// Initialize the asset debugger
await tools.assetDebugger.init();

// Use utility functions
import { formatFileSize, getFileExtension } from '@littlecarlito/blorktools';
```

## Architecture

The codebase has been refactored into a modular architecture for better maintainability and extensibility:

### Core Modules
- `index.js` - Application entry point and state management
- `scene.js` - Three.js scene and rendering setup
- `loader.js` - Model and texture loading
- `analyzer.js` - Model structure analysis and UV handling

### UI Modules
- `debugPanel.js` - Information panel and controls
- `textureEditor.js` - Texture editor with multi-texture support
- `atlasVisualization.js` - UV mapping visualization
- `dragdrop.js` - Drag and drop interface for file uploading

### Material Modules
- `textureManager.js` - Texture loading and application
- `multiTextureMaterial.js` - Custom shader-based material for blending multiple textures 

### Utility Modules
- `helpers.js` - Common utility functions
- `events.js` - Event listeners and keyboard shortcuts

## Browser Support

Requires a modern browser with WebGL support.

## Dependencies

- Three.js (^0.172.0)
- Express (^4.18.3)
- Vite (for development server)

## Contributing

This package is part of the [threejs_site](https://github.com/littlecarlito/threejs_site) monorepo. Please refer to the main repository for contribution guidelines. 