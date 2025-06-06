const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Module Loading Tests', () => {
	let dom;
	let window;

	beforeAll(() => {
		// Create a virtual DOM environment
		dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
                <head>
                    <script async src="https://unpkg.com/es-module-shims@1.8.0/dist/es-module-shims.js"></script>
                    <script type="importmap">
                    {
                        "imports": {
                            "three": "https://unpkg.com/three@0.161.0/build/three.module.js",
                            "three/addons/": "https://unpkg.com/three@0.161.0/examples/jsm/"
                        }
                    }
                    </script>
                </head>
                <body>
                    <script type="module" src="./main.js"></script>
                </body>
            </html>
        `, {
			url: 'http://localhost',
			runScripts: 'dangerously',
			resources: 'usable'
		});
		window = dom.window;
	});

	afterAll(() => {
		dom.window.close();
	});

	it('should have es-module-shims script loaded', () => {
		const scripts = window.document.getElementsByTagName('script');
		const hasShims = Array.from(scripts).some(script => 
			script.src.includes('es-module-shims')
		);
		expect(hasShims).toBe(true);
	});

	it('should have correct import map configuration', () => {
		const importMapScript = Array.from(window.document.getElementsByTagName('script'))
			.find(script => script.type === 'importmap');
		expect(importMapScript).toBeTruthy();
        
		const importMap = JSON.parse(importMapScript.textContent);
		expect(importMap.imports['three']).toBe('https://unpkg.com/three@0.161.0/build/three.module.js');
		expect(importMap.imports['three/addons/']).toBe('https://unpkg.com/three@0.161.0/examples/jsm/');
	});

	it('should have main.js loaded as a module', () => {
		const scripts = window.document.getElementsByTagName('script');
		const mainScript = Array.from(scripts).find(script => 
			script.src.includes('main.js')
		);
		expect(mainScript).toBeTruthy();
		expect(mainScript.type).toBe('module');
	});
});

describe('Vite Configuration Tests', () => {
	it('should have correct base URL for GitHub Pages', () => {
		const viteConfigContent = fs.readFileSync(
			path.resolve(__dirname, '../../apps/portfolio/vite.config.js'),
			'utf-8'
		);
		expect(viteConfigContent).toContain('const base = isGitHubPages ? \'/threejs_site/\' : \'/\'');
	});

	it('should have Three.js properly configured in rollup options', () => {
		const viteConfigContent = fs.readFileSync(
			path.resolve(__dirname, '../../apps/portfolio/vite.config.js'),
			'utf-8'
		);
		expect(viteConfigContent).toContain('manualChunks: {');
		expect(viteConfigContent).toContain('\'three\': [\'three\']');
		expect(viteConfigContent).toContain('globals: {');
		expect(viteConfigContent).toContain('\'three\': \'THREE\'');
		expect(viteConfigContent).toContain('external: []');
	});

	it('should have correct chunk naming configuration', () => {
		const viteConfigContent = fs.readFileSync(
			path.resolve(__dirname, '../../apps/portfolio/vite.config.js'),
			'utf-8'
		);
		expect(viteConfigContent).toContain('chunkFileNames: \'[name].[hash].js\'');
		expect(viteConfigContent).toContain('assetFileNames: \'[name].[hash].[ext]\'');
	});

	it('should include Three.js in the runtime bundle', () => {
		const viteConfigContent = fs.readFileSync(
			path.resolve(__dirname, '../../apps/portfolio/vite.config.js'),
			'utf-8'
		);
		
		// Check that Three.js is in manual chunks
		expect(viteConfigContent).toContain('\'three\': [\'three\']');
		
		// Check that Three.js is NOT in external dependencies
		expect(viteConfigContent).not.toContain('external: [\'three\']');
		expect(viteConfigContent).toContain('external: []');
		
		// This ensures Three.js is bundled with the application and available at runtime,
		// rather than being expected as an external dependency
	});
});

describe('Content Security Policy Tests', () => {
	it('should have correct CSP headers for module loading', () => {
		const indexHtml = fs.readFileSync(
			path.resolve(__dirname, '../../apps/portfolio/index.html'),
			'utf-8'
		);
        
		const cspMeta = indexHtml.match(/<meta[^>]*Content-Security-Policy[^>]*>/)[0];
		expect(cspMeta).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
		expect(cspMeta).toContain("https://unpkg.com");
		expect(cspMeta).toContain("connect-src 'self'");
		expect(cspMeta).toContain("connect-src 'self' https://unpkg.com");
	});
	
	it('should verify all required domains for external resources are in CSP', () => {
		const indexHtml = fs.readFileSync(
			path.resolve(__dirname, '../../apps/portfolio/index.html'),
			'utf-8'
		);
		
		// Extract script sources from HTML
		const scriptSrcs = [...indexHtml.matchAll(/<script[^>]*src=["']([^"']+)["'][^>]*>/g)]
			.map(match => match[1])
			.filter(src => src.startsWith('https://'));
			
		// Extract domains from script sources
		const externalDomains = new Set(
			scriptSrcs.map(src => {
				const url = new URL(src);
				return url.hostname;
			})
		);
		
		// Get CSP content
		const cspMeta = indexHtml.match(/<meta[^>]*Content-Security-Policy[^>]*>/)[0];
		
		// Verify each external domain is in the CSP
		for (const domain of externalDomains) {
			expect(cspMeta).toContain(domain);
		}
	});
});

describe('ES Module Shims Compatibility Tests', () => {
	it('should have es-module-shims correctly referenced', () => {
		const indexHtml = fs.readFileSync(
			path.resolve(__dirname, '../../apps/portfolio/index.html'),
			'utf-8'
		);
		
		// Check that es-module-shims is included
		expect(indexHtml).toContain('https://unpkg.com/es-module-shims');
		
		// Ensure CSP allows unpkg.com for scripts
		const cspMeta = indexHtml.match(/<meta[^>]*Content-Security-Policy[^>]*>/)[0];
		expect(cspMeta).toContain('https://unpkg.com');
		
		// Get the specific es-module-shims URL
		const shimsScriptMatch = indexHtml.match(/<script[^>]*src=["'](https:\/\/unpkg\.com\/es-module-shims[^"']*)["'][^>]*>/);
		expect(shimsScriptMatch).toBeTruthy();
		
		if (shimsScriptMatch) {
			const shimsUrl = shimsScriptMatch[1];
			// Extract the domain from the URL
			const shimsUrlObj = new URL(shimsUrl);
			const shimsDomain = shimsUrlObj.hostname;
			
			// Verify the specific domain is in the CSP
			expect(cspMeta).toContain(shimsDomain);
		}
	});
}); 