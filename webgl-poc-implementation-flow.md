# WebGL Fundamentals PoC — Implementation Flow

## Project Overview

A React app with a Three.js scene that renders animated geometry using custom shaders, renders to a framebuffer, applies post-processing effects, and includes a debug panel to inspect the WebGL state underneath. Every step is designed to teach a specific WebGL concept.

---

## Tech Stack

- **React 18+** (Vite for scaffolding)
- **Three.js** (raw — no React Three Fiber, so you stay closer to the WebGL layer)
- **GLSL** (inline shader strings)
- **Leva** (lightweight debug GUI for tweaking uniforms in real time)

Why no React Three Fiber? R3F abstracts Three.js further, which defeats the purpose. You want to manage the Three.js lifecycle manually inside React so you see every setup step.

---

## File Structure

```
src/
├── App.jsx                        # Layout: canvas + debug panel side by side
├── main.jsx                       # Entry point
│
├── scene/
│   ├── SceneManager.js            # Core: initializes renderer, scene, camera, loop
│   ├── GeometryPass.js            # Pass 1: creates meshes with RawShaderMaterial
│   ├── PostProcessPass.js         # Pass 2: full-screen quad with post-FX shader
│   └── WebGLInspector.js          # Reads raw WebGL state for the debug panel
│
├── shaders/
│   ├── geometry.vert.js           # Vertex shader for the 3D objects
│   ├── geometry.frag.js           # Fragment shader for the 3D objects
│   ├── postprocess.vert.js        # Vertex shader for the full-screen quad
│   └── postprocess.frag.js        # Fragment shader for post-processing
│
├── components/
│   ├── Canvas.jsx                 # The <canvas> element + mounts SceneManager
│   ├── DebugPanel.jsx             # Shows live WebGL state info
│   └── ShaderEditor.jsx           # (Optional) live GLSL editing
│
└── hooks/
    └── useAnimationLoop.js        # requestAnimationFrame hook
```

---

## Build Flow — Step by Step

Each step builds on the previous one. Don't skip ahead — the learning is in the layering.

---

### STEP 1: Project Setup + Empty Canvas

**What you're building:**
A React app with a `<canvas>` element that initializes a Three.js renderer.

**What you'll learn:**
How Three.js creates and manages the WebGL context.

**Tasks:**

1. Scaffold the project:
   ```bash
   npm create vite@latest webgl-poc -- --template react
   cd webgl-poc
   npm install three leva
   ```

2. Create `Canvas.jsx`:
   - Renders a `<canvas>` element with a ref
   - On mount, creates a `THREE.WebGLRenderer` attached to that canvas
   - Sets pixel ratio and size

3. Create `SceneManager.js`:
   - Accepts the canvas DOM element
   - Creates: `WebGLRenderer`, `Scene`, `PerspectiveCamera`
   - Sets up the render loop with `requestAnimationFrame`
   - Exposes `start()`, `stop()`, `dispose()` methods

4. Create `App.jsx`:
   - Mounts `Canvas` component
   - Passes canvas ref to SceneManager on mount
   - Cleanup on unmount

**Checkpoint:** You should see a black canvas. Open the console and verify:
```javascript
const gl = renderer.getContext();
console.log('WebGL version:', gl.getParameter(gl.VERSION));
console.log('Vendor:', gl.getParameter(gl.VENDOR));
console.log('Max texture units:', gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS));
```

**WebGL concept confirmed:** The WebGL context exists. You have a remote control to the GPU.

---

### STEP 2: Add Geometry with Standard Material (Baseline)

**What you're building:**
Animated 3D shapes using Three.js built-in materials — the "easy way" that you'll later replace.

**What you'll learn:**
What Three.js does for you automatically (buffers, shaders, uniforms — all hidden).

**Tasks:**

1. In `GeometryPass.js`, create a function that:
   - Creates 3-5 geometries: `IcosahedronGeometry`, `TorusGeometry`, `TorusKnotGeometry`
   - Uses `MeshStandardMaterial` with different colors
   - Adds them to the scene at different positions

2. Add lighting:
   - `AmbientLight` (soft fill)
   - `DirectionalLight` (main light with shadows)

3. In the render loop, rotate the meshes:
   ```javascript
   meshes.forEach((mesh, i) => {
     mesh.rotation.x += 0.005 * (i + 1);
     mesh.rotation.y += 0.008 * (i + 1);
   });
   ```

**Checkpoint:** You see rotating 3D shapes with lighting. Now inspect what Three.js created:
```javascript
const geo = mesh.geometry;
console.log('Position buffer:', geo.attributes.position);
console.log('Normal buffer:', geo.attributes.normal);
console.log('UV buffer:', geo.attributes.uv);
console.log('Vertex count:', geo.attributes.position.count);
console.log('Index buffer:', geo.index);

// Peek at the compiled shader Three.js generated
renderer.compile(scene, camera);
const programs = renderer.info.programs;
console.log('Compiled shader programs:', programs);
```

**WebGL concepts confirmed:** Three.js automatically created buffers for position/normal/uv, compiled a complex PBR shader, and set up all attribute pointers. You did none of it manually.

---

### STEP 3: Replace with RawShaderMaterial (Go Manual)

**What you're building:**
The same geometry, but with your own GLSL shaders. This is where real learning begins.

**What you'll learn:**
Buffers → attributes, uniforms, varyings, the vertex/fragment shader pipeline.

**Tasks:**

1. Write `geometry.vert.js`:
   ```glsl
   // You MUST declare everything manually with RawShaderMaterial
   precision highp float;

   // Attributes — these come from the geometry buffers
   attribute vec3 position;
   attribute vec3 normal;
   attribute vec2 uv;

   // Uniforms — Three.js provides these, but with RawShaderMaterial
   // you must declare them yourself
   uniform mat4 modelViewMatrix;
   uniform mat4 projectionMatrix;
   uniform mat3 normalMatrix;
   uniform float uTime;

   // Varyings — pass data to the fragment shader
   varying vec3 vNormal;
   varying vec2 vUv;
   varying vec3 vPosition;

   void main() {
     vNormal = normalize(normalMatrix * normal);
     vUv = uv;
     vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;

     // Animate the vertices
     vec3 pos = position;
     pos += normal * sin(uTime + position.y * 3.0) * 0.1;

     gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
   }
   ```

2. Write `geometry.frag.js`:
   ```glsl
   precision highp float;

   varying vec3 vNormal;
   varying vec2 vUv;
   varying vec3 vPosition;

   uniform float uTime;
   uniform vec3 uColor;

   void main() {
     // Basic directional lighting
     vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
     float diffuse = max(dot(vNormal, lightDir), 0.0);
     float ambient = 0.2;

     vec3 color = uColor * (ambient + diffuse * 0.8);
     gl_FragColor = vec4(color, 1.0);
   }
   ```

3. In `GeometryPass.js`, replace `MeshStandardMaterial` with:
   ```javascript
   const material = new THREE.RawShaderMaterial({
     vertexShader: geometryVertexShader,
     fragmentShader: geometryFragmentShader,
     uniforms: {
       uTime: { value: 0 },
       uColor: { value: new THREE.Color(0.2, 0.5, 1.0) }
     }
   });
   ```

4. Update the render loop to pass time:
   ```javascript
   material.uniforms.uTime.value = clock.getElapsedTime();
   ```

5. Remove the lights (your shader handles lighting now).

**Checkpoint:** The shapes render with your custom shader. Now verify the connection:
```javascript
const gl = renderer.getContext();
renderer.render(scene, camera);

// Check what program is active
const program = gl.getParameter(gl.CURRENT_PROGRAM);
console.log('Active shader program:', program);

// Check how many attributes are active
const numAttribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
for (let i = 0; i < numAttribs; i++) {
  const info = gl.getActiveAttrib(program, i);
  console.log(`Attribute ${i}: ${info.name}, type: ${info.type}`);
}

// Check how many uniforms are active
const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
for (let i = 0; i < numUniforms; i++) {
  const info = gl.getActiveUniform(program, i);
  console.log(`Uniform ${i}: ${info.name}, type: ${info.type}`);
}
```

**WebGL concepts confirmed:** You wrote the shaders. You declared the attributes that read from buffers. You passed uniforms from JavaScript. You used varyings to pass data from vertex to fragment shader. This is the core GPU pipeline.

---

### STEP 4: Add a Texture to the Geometry

**What you're building:**
Load an image texture and apply it to one of the meshes via your custom shader.

**What you'll learn:**
Texture creation, texture units, sampler2D, UV mapping — the full texture pipeline.

**Tasks:**

1. Load a texture:
   ```javascript
   const textureLoader = new THREE.TextureLoader();
   const diffuseMap = textureLoader.load('/textures/some-texture.jpg');
   ```

2. Add it to the material's uniforms:
   ```javascript
   uniforms: {
     uTime: { value: 0 },
     uColor: { value: new THREE.Color(1, 1, 1) },
     uTexture: { value: diffuseMap },
     uUseTexture: { value: 1.0 }  // toggle flag
   }
   ```

3. Update `geometry.frag.js`:
   ```glsl
   uniform sampler2D uTexture;
   uniform float uUseTexture;

   void main() {
     vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
     float diffuse = max(dot(vNormal, lightDir), 0.0);

     vec3 baseColor;
     if (uUseTexture > 0.5) {
       baseColor = texture2D(uTexture, vUv).rgb;
     } else {
       baseColor = uColor;
     }

     vec3 color = baseColor * (0.2 + diffuse * 0.8);
     gl_FragColor = vec4(color, 1.0);
   }
   ```

4. Inspect the texture unit assignment:
   ```javascript
   renderer.render(scene, camera);
   const gl = renderer.getContext();

   // Check which texture unit is active
   console.log('Active texture unit:', gl.getParameter(gl.ACTIVE_TEXTURE) - gl.TEXTURE0);

   // Check what texture is bound to unit 0
   gl.activeTexture(gl.TEXTURE0);
   console.log('Texture bound to unit 0:', gl.getParameter(gl.TEXTURE_BINDING_2D));
   ```

**Checkpoint:** One mesh shows a texture, others show flat colors. You can toggle with `uUseTexture`.

**WebGL concepts confirmed:** Texture loading, UV mapping (buffer → attribute → varying → texture2D), texture units, sampler uniforms.

---

### STEP 5: Render to Framebuffer (WebGLRenderTarget)

**What you're building:**
Instead of rendering to the screen, render the entire scene to a texture.

**What you'll learn:**
Framebuffer objects, render-to-texture, the OUTPUT role of textures.

**Tasks:**

1. In `SceneManager.js`, create a render target:
   ```javascript
   this.renderTarget = new THREE.WebGLRenderTarget(
     window.innerWidth,
     window.innerHeight,
     {
       minFilter: THREE.LinearFilter,
       magFilter: THREE.LinearFilter,
       format: THREE.RGBAFormat
     }
   );
   ```

2. Modify the render loop:
   ```javascript
   // Render scene to the framebuffer (NOT the screen)
   renderer.setRenderTarget(this.renderTarget);
   renderer.clear();
   renderer.render(scene, camera);

   // For now, also render directly to screen so you can see it
   // (We'll replace this with post-processing in the next step)
   renderer.setRenderTarget(null);
   renderer.render(scene, camera);
   ```

3. Verify the framebuffer was created:
   ```javascript
   const gl = renderer.getContext();
   const props = renderer.properties.get(this.renderTarget);

   console.log('Framebuffer object:', props.__webglFramebuffer);
   console.log('Color texture:', props.__webglTexture);

   // Check framebuffer status
   gl.bindFramebuffer(gl.FRAMEBUFFER, props.__webglFramebuffer);
   const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
   console.log('FBO complete?', status === gl.FRAMEBUFFER_COMPLETE);
   gl.bindFramebuffer(gl.FRAMEBUFFER, null);
   ```

**Checkpoint:** Scene still renders to screen (for now), but it's ALSO being rendered to a framebuffer texture. The console confirms the FBO exists and is complete.

**WebGL concepts confirmed:** Framebuffer creation, texture attachment, render target switching.

---

### STEP 6: Post-Processing Pass (Full-Screen Quad)

**What you're building:**
A second render pass that takes the framebuffer texture and applies effects to it.

**What you'll learn:**
The texture role switch (output → input), full-screen quad rendering, post-processing pipeline.

**Tasks:**

1. Create `PostProcessPass.js`:
   ```javascript
   export function createPostProcessPass() {
     // Full-screen quad geometry (two triangles covering the viewport)
     const geometry = new THREE.PlaneGeometry(2, 2);

     // Post-processing material
     const material = new THREE.RawShaderMaterial({
       vertexShader: postprocessVertexShader,
       fragmentShader: postprocessFragmentShader,
       uniforms: {
         tDiffuse: { value: null },  // will receive the framebuffer texture
         uTime: { value: 0 },
         uResolution: { value: new THREE.Vector2() },
         uEffectIntensity: { value: 1.0 }
       },
       depthTest: false,
       depthWrite: false
     });

     const mesh = new THREE.Mesh(geometry, material);

     // Separate scene and camera for the post-process pass
     const scene = new THREE.Scene();
     scene.add(mesh);
     const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

     return { scene, camera, material };
   }
   ```

2. Write `postprocess.vert.js`:
   ```glsl
   precision highp float;

   attribute vec3 position;
   attribute vec2 uv;

   varying vec2 vUv;

   void main() {
     vUv = uv;
     gl_Position = vec4(position.xy, 0.0, 1.0);
   }
   ```

3. Write `postprocess.frag.js` (start with chromatic aberration):
   ```glsl
   precision highp float;

   uniform sampler2D tDiffuse;
   uniform float uTime;
   uniform vec2 uResolution;
   uniform float uEffectIntensity;

   varying vec2 vUv;

   void main() {
     // Chromatic aberration — offset R, G, B channels
     float offset = 0.005 * uEffectIntensity * sin(uTime * 0.5);

     float r = texture2D(tDiffuse, vUv + vec2(offset, 0.0)).r;
     float g = texture2D(tDiffuse, vUv).g;
     float b = texture2D(tDiffuse, vUv - vec2(offset, 0.0)).b;

     // Vignette
     vec2 center = vUv - 0.5;
     float vignette = 1.0 - dot(center, center) * 1.5 * uEffectIntensity;

     gl_FragColor = vec4(vec3(r, g, b) * vignette, 1.0);
   }
   ```

4. Update the render loop in `SceneManager.js`:
   ```javascript
   // PASS 1: Scene → Framebuffer
   renderer.setRenderTarget(this.renderTarget);
   renderer.clear();
   renderer.render(this.mainScene, this.mainCamera);

   // PASS 2: Framebuffer texture → Post-process shader → Screen
   this.postFx.material.uniforms.tDiffuse.value = this.renderTarget.texture;
   this.postFx.material.uniforms.uTime.value = clock.getElapsedTime();
   this.postFx.material.uniforms.uResolution.value.set(width, height);

   renderer.setRenderTarget(null);
   renderer.render(this.postFx.scene, this.postFx.camera);
   ```

**Checkpoint:** The 3D scene renders with chromatic aberration and vignette effects. The post-processing is reading from the framebuffer texture.

**WebGL concepts confirmed:** The full post-processing pipeline. The texture that was a render OUTPUT in Pass 1 becomes a shader INPUT in Pass 2. You've confirmed the role switch.

---

### STEP 7: Debug Panel (WebGL Inspector)

**What you're building:**
A React panel that displays live WebGL state, showing what Three.js is doing under the hood.

**What you'll learn:**
The connection between Three.js abstractions and raw WebGL calls.

**Tasks:**

1. Create `WebGLInspector.js`:
   ```javascript
   export function inspectWebGLState(renderer, renderTarget) {
     const gl = renderer.getContext();

     return {
       // Renderer info
       drawCalls: renderer.info.render.calls,
       triangles: renderer.info.render.triangles,
       programs: renderer.info.programs.length,
       textures: renderer.info.memory.textures,
       geometries: renderer.info.memory.geometries,

       // WebGL context info
       vendor: gl.getParameter(gl.VENDOR),
       glVersion: gl.getParameter(gl.VERSION),
       maxTextureUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
       maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
       viewport: Array.from(gl.getParameter(gl.VIEWPORT)),

       // Framebuffer status
       fboExists: !!renderer.properties.get(renderTarget).__webglFramebuffer,
       renderTargetSize: {
         width: renderTarget.width,
         height: renderTarget.height
       },

       // Current state
       activeTextureUnit: gl.getParameter(gl.ACTIVE_TEXTURE) - gl.TEXTURE0,
       depthTestEnabled: gl.isEnabled(gl.DEPTH_TEST),
       blendingEnabled: gl.isEnabled(gl.BLEND)
     };
   }
   ```

2. Create `DebugPanel.jsx`:
   - Receives the inspection data as props (updated each frame)
   - Displays it in a styled panel
   - Groups info by category: Renderer Stats, WebGL Context, Framebuffer, Pipeline State

3. In the render loop, call the inspector after each frame and pass data to React:
   ```javascript
   // Use a callback or shared ref to pass data to React
   const stats = inspectWebGLState(renderer, renderTarget);
   onDebugUpdate(stats);
   ```

4. Use `leva` for real-time uniform controls:
   ```javascript
   import { useControls } from 'leva';

   const controls = useControls({
     effectIntensity: { value: 1.0, min: 0, max: 2, step: 0.01 },
     chromaticOffset: { value: 0.005, min: 0, max: 0.02, step: 0.001 },
     animationSpeed: { value: 1.0, min: 0, max: 3, step: 0.1 }
   });
   ```

**Checkpoint:** You see a live panel showing draw calls, triangle count, active shader programs, texture units, framebuffer status — all updating in real time as the scene renders.

**WebGL concepts confirmed:** Every abstraction mapped to its WebGL reality. You can see the GPU state that Three.js manages for you.

---

### STEP 8: Add More Post-Processing Effects

**What you're building:**
Additional shader effects that you can toggle and combine.

**What you'll learn:**
More GLSL techniques, how different effects manipulate the framebuffer texture.

**Tasks:**

Add these effects as toggleable blocks in your post-process fragment shader:

1. **Scan Lines:**
   ```glsl
   float scanLine = sin(vUv.y * uResolution.y * 1.5) * 0.04;
   color -= scanLine;
   ```

2. **Film Grain:**
   ```glsl
   float grain = (fract(sin(dot(vUv * uTime, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.1;
   color += grain;
   ```

3. **Pixelation:**
   ```glsl
   float pixelSize = 8.0;
   vec2 pixelUv = floor(vUv * uResolution / pixelSize) * pixelSize / uResolution;
   color = texture2D(tDiffuse, pixelUv).rgb;
   ```

4. **Edge Detection (Sobel):**
   ```glsl
   vec2 texel = 1.0 / uResolution;
   float tl = length(texture2D(tDiffuse, vUv + vec2(-texel.x, texel.y)).rgb);
   float tr = length(texture2D(tDiffuse, vUv + vec2(texel.x, texel.y)).rgb);
   float bl = length(texture2D(tDiffuse, vUv + vec2(-texel.x, -texel.y)).rgb);
   float br = length(texture2D(tDiffuse, vUv + vec2(texel.x, -texel.y)).rgb);
   float edgeX = tr + 2.0 * length(texture2D(tDiffuse, vUv + vec2(texel.x, 0)).rgb) + br
               - tl - 2.0 * length(texture2D(tDiffuse, vUv + vec2(-texel.x, 0)).rgb) - bl;
   float edgeY = tl + 2.0 * length(texture2D(tDiffuse, vUv + vec2(0, texel.y)).rgb) + tr
               - bl - 2.0 * length(texture2D(tDiffuse, vUv + vec2(0, -texel.y)).rgb) - br;
   float edge = sqrt(edgeX * edgeX + edgeY * edgeY);
   ```

5. Connect each effect to a `leva` toggle so you can turn them on/off and control intensity.

**Checkpoint:** You can toggle between different post-processing effects in real time, seeing how each one samples and transforms the framebuffer texture differently.

---

### STEP 9: Multi-Pass Chain (Advanced)

**What you're building:**
Two framebuffers chained together — render scene → FBO-A, apply blur → FBO-B, apply color grading → screen.

**What you'll learn:**
Multi-pass rendering, multiple framebuffers, the full production post-processing pipeline.

**Tasks:**

1. Create a second render target:
   ```javascript
   this.renderTargetA = new THREE.WebGLRenderTarget(w, h, options);
   this.renderTargetB = new THREE.WebGLRenderTarget(w, h, options);
   ```

2. Create a blur shader (samples neighboring pixels):
   ```glsl
   // Simple box blur — averages surrounding pixels
   vec4 blur = vec4(0.0);
   float total = 0.0;
   for (float x = -4.0; x <= 4.0; x += 1.0) {
     for (float y = -4.0; y <= 4.0; y += 1.0) {
       blur += texture2D(tDiffuse, vUv + vec2(x, y) / uResolution);
       total += 1.0;
     }
   }
   blur /= total;
   ```

3. Update the render loop to three passes:
   ```javascript
   // Pass 1: Scene → FBO-A
   renderer.setRenderTarget(this.renderTargetA);
   renderer.render(mainScene, mainCamera);

   // Pass 2: FBO-A → blur shader → FBO-B
   blurMaterial.uniforms.tDiffuse.value = this.renderTargetA.texture;
   renderer.setRenderTarget(this.renderTargetB);
   renderer.render(blurScene, blurCamera);

   // Pass 3: FBO-B → color grade shader → Screen
   colorGradeMaterial.uniforms.tDiffuse.value = this.renderTargetB.texture;
   renderer.setRenderTarget(null);
   renderer.render(colorGradeScene, colorGradeCamera);
   ```

4. Update the debug panel to show both framebuffers and the 3-pass pipeline state.

**Checkpoint:** The scene renders through a 3-pass pipeline. The debug panel shows two FBOs with different states.

---

### STEP 10: Polish + Window Resize + Cleanup

**Tasks:**

1. Handle window resize:
   ```javascript
   window.addEventListener('resize', () => {
     camera.aspect = window.innerWidth / window.innerHeight;
     camera.updateProjectionMatrix();
     renderer.setSize(window.innerWidth, window.innerHeight);
     renderTargetA.setSize(window.innerWidth, window.innerHeight);
     renderTargetB.setSize(window.innerWidth, window.innerHeight);
   });
   ```

2. Proper React cleanup on unmount:
   ```javascript
   useEffect(() => {
     const manager = new SceneManager(canvasRef.current);
     manager.start();
     return () => manager.dispose();
   }, []);
   ```

3. Dispose geometry, materials, textures, render targets:
   ```javascript
   dispose() {
     this.renderTargetA.dispose();
     this.renderTargetB.dispose();
     this.geometries.forEach(g => g.dispose());
     this.materials.forEach(m => m.dispose());
     this.renderer.dispose();
   }
   ```

---

## Build Order Summary

```
Step 1:  Empty canvas + WebGL context
         └── confirms: context exists, GPU accessible
              │
Step 2:  Add geometry with MeshStandardMaterial
         └── confirms: Three.js creates buffers/shaders automatically
              │
Step 3:  Replace with RawShaderMaterial + custom GLSL
         └── confirms: buffers → attributes, JS → uniforms, vertex → fragment via varyings
              │
Step 4:  Add texture to geometry
         └── confirms: texture loading, UV mapping, sampler2D, texture units
              │
Step 5:  Render to WebGLRenderTarget (framebuffer)
         └── confirms: FBO creation, render-to-texture
              │
Step 6:  Post-processing pass (full-screen quad)
         └── confirms: texture role switch (output → input), post-FX pipeline
              │
Step 7:  Debug panel showing WebGL state
         └── confirms: Three.js abstraction → raw WebGL mapping
              │
Step 8:  Multiple post-processing effects
         └── confirms: GLSL techniques, texture sampling patterns
              │
Step 9:  Multi-pass framebuffer chain
         └── confirms: multiple FBOs, production pipeline architecture
              │
Step 10: Polish, resize handling, cleanup
         └── confirms: resource management, lifecycle
```

---

## Concept Coverage Map

| WebGL Concept              | Covered In    | How                                              |
|----------------------------|---------------|--------------------------------------------------|
| WebGL context              | Step 1        | `canvas.getContext('webgl2')` via Three.js       |
| Buffers (ARRAY_BUFFER)     | Step 2-3      | BufferGeometry attributes → WebGL buffers        |
| Attribute pointers         | Step 3        | `attribute vec3 position` in RawShaderMaterial   |
| Vertex shaders             | Step 3        | Custom GLSL, manual matrix transforms            |
| Fragment shaders           | Step 3        | Custom GLSL, per-pixel lighting                  |
| Shader compilation         | Step 3        | Inspect `renderer.info.programs`                 |
| Uniforms                   | Step 3-4      | `uTime`, `uColor`, matrices, samplers            |
| Varyings                   | Step 3        | Pass normals/UVs from vertex to fragment shader  |
| Texture creation           | Step 4        | `TextureLoader`, `texImage2D` under the hood     |
| Texture parameters         | Step 4-5      | Filter modes, wrap modes on render targets       |
| Texture units              | Step 4        | Inspect `gl.ACTIVE_TEXTURE`, sampler binding     |
| UV mapping                 | Step 4        | Buffer → attribute → varying → `texture2D()`    |
| Framebuffer objects        | Step 5        | `WebGLRenderTarget` → FBO + attached texture     |
| Render-to-texture          | Step 5-6      | `setRenderTarget(fbo)` → `setRenderTarget(null)` |
| Full-screen quad           | Step 6        | PlaneGeometry(2,2) + orthographic camera         |
| Post-processing            | Step 6-8      | Chromatic aberration, vignette, blur, edge detect |
| Multi-pass rendering       | Step 9        | Chain: scene → FBO-A → FBO-B → screen            |
| WebGL state inspection     | Step 7        | `gl.getParameter()`, `renderer.properties`       |
| Resource disposal          | Step 10       | `.dispose()` on geometries, materials, textures  |
