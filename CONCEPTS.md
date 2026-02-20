# Three.js & WebGL Deep Dive — Concepts Summary

A living reference document for all the WebGL, Three.js, and architecture concepts practiced in this project.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [WebGL Core Concepts](#webgl-core-concepts)
3. [GLSL Shaders](#glsl-shaders)
4. [Three.js RawShaderMaterial](#threejs-rawshadermaterial)
5. [Render Targets & Framebuffer Objects (FBO)](#render-targets--framebuffer-objects-fbo)
6. [Post-Processing Pipeline](#post-processing-pipeline)
7. [Post-Processing Effects](#post-processing-effects)
8. [Lighting Model](#lighting-model)
9. [Geometry & Buffer Attributes](#geometry--buffer-attributes)
10. [Texture Loading & Sampling](#texture-loading--sampling)
11. [Animation Loop & Uniforms](#animation-loop--uniforms)
12. [Shadows](#shadows)
13. [OrbitControls & Camera](#orbitcontrols--camera)
14. [React Integration Architecture](#react-integration-architecture)
15. [State Management with MobX](#state-management-with-mobx)
16. [Typed Event Emitter](#typed-event-emitter)
17. [File & Class Map](#file--class-map)

---

## Project Overview

This project is a **Three.js + React + TypeScript** viewer that deliberately goes below the abstraction layer Three.js normally provides. Instead of using `MeshStandardMaterial` or `MeshPhongMaterial`, it wires custom GLSL shaders directly to the GPU via `RawShaderMaterial`. A two-pass render pipeline (geometry pass → post-processing pass) demonstrates framebuffer objects and fullscreen-quad techniques.

```
React (UI layer)
  └─ ViewerManager (Three.js orchestrator)
        ├─ GeometryManager   — meshes + custom shader materials
        ├─ MaterialManager   — texture loading
        ├─ LightManager      — Three.js lights
        ├─ PostProcessingPass — FBO + fullscreen quad
        └─ EventEmitterManager — typed pub/sub
```

---

## WebGL Core Concepts

### The GPU Pipeline (simplified)

```
CPU (JavaScript / Three.js)
  │  uploads geometry buffers (VBO/EBO) and uniform data
  ▼
Vertex Shader  — runs once per vertex, outputs gl_Position
  ▼
Rasterization  — GPU converts triangles to fragments (pixels)
  ▼
Fragment Shader — runs once per fragment, outputs gl_FragColor
  ▼
Framebuffer    — the render target (screen or texture)
```

### Buffers & Attributes

Three.js exposes each geometry attribute as a **VBO (Vertex Buffer Object)**:

| Attribute | Type     | Content                            |
|-----------|----------|------------------------------------|
| `position`| `vec3`   | XYZ world-space coordinates        |
| `normal`  | `vec3`   | Surface normal direction           |
| `uv`      | `vec2`   | Texture coordinate (0–1 range)     |
| `index`   | uint     | Index buffer — shared vertices     |

These are inspected at startup:

```typescript
console.log('Position buffer:', geometry.attributes.position);
console.log('Normal buffer:',   geometry.attributes.normal);
console.log('UV buffer:',       geometry.attributes.uv);
console.log('Index buffer:',    geometry.index);
```

---

## GLSL Shaders

### Precision Qualifiers

```glsl
precision highp float; // full 32-bit float — required in RawShaderMaterial
```

With `RawShaderMaterial` Three.js does **not** inject default precision, so it must be declared explicitly.

### Variable Qualifiers

| Qualifier   | Direction         | Description                                      |
|-------------|-------------------|--------------------------------------------------|
| `attribute` | Geometry → Vert   | Per-vertex data from VBOs                        |
| `uniform`   | CPU → Both stages | Data that is the same for every vertex/fragment  |
| `varying`   | Vert → Frag       | Interpolated per-fragment data                   |

### Geometry Vertex Shader (`geometry.vert.ts`)

Key concepts demonstrated:

- **`normalMatrix`** — transforms normals from model space to view/eye space. Needed because non-uniform scaling would distort plain `modelViewMatrix * normal`.
- **View-space position** (`vPosition`) — computes position after the model-view transform; used for lighting in the fragment shader.
- **Vertex animation** — displaces each vertex along its normal using a sine wave driven by `uTime`, creating an organic "breathing" effect:

  ```glsl
  pos += normal * sin(uTime + position.y * 3.0) * 0.1;
  ```

### Geometry Fragment Shader (`geometry.frag.ts`)

Key concepts demonstrated:

- **Diffuse (Lambertian) lighting** — `max(dot(vNormal, lightDir), 0.0)` — measures how directly the surface faces the light.
- **Ambient lighting** — flat constant that prevents fully-dark areas, simulating indirect light.
- **Texture sampling with fallback** — the `uUseTexture` flag switches between a loaded diffuse texture and a solid `uColor`:

  ```glsl
  if (uUseTexture > 0.5) {
      baseColor = texture2D(uTexture, vUv).rgb;
  } else {
      baseColor = uColor;
  }
  ```

---

## Three.js RawShaderMaterial

`RawShaderMaterial` is the **bare-metal** shader material in Three.js:

| Feature                          | `ShaderMaterial` | `RawShaderMaterial` |
|----------------------------------|------------------|---------------------|
| Auto-inject `#include` chunks    | ✅               | ❌                  |
| Auto-inject built-in uniforms    | ✅               | ❌                  |
| Full control over shader source  | Partial          | ✅ Complete         |
| Must declare `precision`         | Optional         | Required            |
| Must declare `modelViewMatrix`   | Auto             | Manual              |

By using `RawShaderMaterial` the developer is forced to understand every uniform and attribute that flows into the shader — which is the main learning goal here.

---

## Render Targets & Framebuffer Objects (FBO)

A **`WebGLRenderTarget`** is Three.js's abstraction over a WebGL **Framebuffer Object (FBO)** — a texture that the GPU renders into instead of the screen.

```typescript
this.renderTarget = new WebGLRenderTarget(
  window.innerWidth,
  window.innerHeight,
  {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat
  }
);
```

**`LinearFilter`** means neighbouring texels are blended when the texture is scaled, giving smooth results. **`RGBAFormat`** stores red, green, blue, and alpha channels.

Rendering to the target:

```typescript
this.renderer?.setRenderTarget(this.renderTarget); // redirect output to texture
this.renderer?.render(this.scene, this.camera!);   // draw geometry into texture
this.renderer?.setRenderTarget(null);              // redirect output back to screen
```

---

## Post-Processing Pipeline

The project implements a **manual two-pass render pipeline** (no EffectComposer):

```
Pass 1 — Geometry Pass
  Render 3D scene → WebGLRenderTarget (texture in GPU memory)

Pass 2 — Post-Processing Pass
  Bind texture from Pass 1 as uniform (tDiffuse)
  Render fullscreen quad with post-FX shader → Screen
```

### Fullscreen Quad

A `PlaneGeometry(2, 2)` fills exactly clip space (-1 to +1 in X and Y). Paired with an `OrthographicCamera(-1, 1, 1, -1, 0, 1)` that has no perspective distortion, every fragment maps to exactly one screen pixel.

The post-processing vertex shader bypasses model/view/projection matrices entirely:

```glsl
gl_Position = vec4(position.xy, 0.0, 1.0); // direct clip-space passthrough
```

`depthTest: false` and `depthWrite: false` prevent depth fighting since this quad is not part of the 3D scene.

---

## Post-Processing Effects

### Chromatic Aberration

Simulates the optical imperfection of a real lens where different wavelengths of light focus at slightly different points. Each colour channel is sampled from a slightly offset UV coordinate:

```glsl
float offset = 0.005 * uEffectIntensity * sin(uTime * 0.5);
float r = texture2D(tDiffuse, vUv + vec2(offset,  0.0)).r;
float g = texture2D(tDiffuse, vUv).g;                         // no offset
float b = texture2D(tDiffuse, vUv - vec2(offset,  0.0)).b;
```

The offset oscillates over time for an animated, subtle glitch look.

### Vignette

Darkens the corners and edges of the image, directing attention toward the centre — a classic photographic and film effect:

```glsl
vec2 center  = vUv - 0.5;
float vignette = 1.0 - dot(center, center) * 1.5 * uEffectIntensity;
gl_FragColor = vec4(vec3(r, g, b) * vignette, 1.0);
```

`dot(center, center)` is equivalent to `center.x² + center.y²` — the squared distance from the UV centre — which creates a smooth radial falloff without needing `sqrt`.

---

## Lighting Model

Three.js lights (`PointLight`, `AmbientLight`) affect the scene rendered in Pass 1. The custom fragment shader also implements its own **manual lighting** in GLSL, demonstrating both approaches:

| Light Type    | Three.js Object   | GLSL equivalent used in shader           |
|---------------|-------------------|------------------------------------------|
| Ambient       | `AmbientLight`    | `float ambient = 0.2;`                   |
| Directional   | *(manual)*        | `max(dot(vNormal, lightDir), 0.0)`       |
| Point         | `PointLight`      | Visual helper sphere via `PointLightHelper` |

The Three.js `PointLight` and `AmbientLight` affect the `MeshBasicMaterial` plane. The cube uses `RawShaderMaterial` with hand-written lighting, so Three.js lights do not directly drive it — the shader computes its own fixed light direction.

---

## Geometry & Buffer Attributes

```
BoxGeometry  → cube   → RawShaderMaterial (custom GLSL, cast/receive shadow)
PlaneGeometry(10,10) → ground plane → MeshBasicMaterial (yellow, DoubleSide)
PlaneGeometry(2,2)   → fullscreen quad → RawShaderMaterial (post-FX)
```

Logging buffer data at creation time is a common debugging technique:

```typescript
console.log('Vertex count:', geometry.attributes.position.count);
console.log('Index buffer:', geometry.index); // shared vertices
```

---

## Texture Loading & Sampling

`MaterialManager` wraps Three.js's `TextureLoader` to keep texture concerns out of geometry code:

```typescript
loadMaterialFromLocalPath(path: string) {
    const textureLoader = new TextureLoader();
    return textureLoader.load(path); // async — texture streams in
}
```

In the shader, `sampler2D` + `texture2D()` sample the loaded texture at the interpolated UV coordinate passed from the vertex shader via the `vUv` varying.

---

## Animation Loop & Uniforms

The animation loop uses `requestAnimationFrame` (via Three.js convention) to run at the display's refresh rate. A `THREE.Clock` provides a monotonically increasing `elapsedTime` fed into shaders as `uTime`:

```typescript
(this.cube!.material as THREE.RawShaderMaterial).uniforms.uTime.value
    = this.clock.getElapsedTime();
```

`uTime` drives both the vertex displacement wave and the chromatic aberration oscillation, keeping all animations synchronized to real-world seconds rather than frame count.

---

## Shadows

Shadow mapping is enabled globally and per-mesh:

```typescript
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Percentage Closer Filtering
```

- **`castShadow`** — the cube projects a shadow.
- **`receiveShadow`** — the plane and cube receive shadows cast by others.
- **PCFSoftShadowMap** — samples the shadow map multiple times and averages results for softer shadow edges compared to basic hard-shadow mapping.

---

## OrbitControls & Camera

```typescript
this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
this.controls = new OrbitControls(this.camera, this.renderer.domElement);
this.controls.enableDamping  = true;
this.controls.dampingFactor  = 0.05;
```

- **FOV 75°** — reasonably wide perspective.
- **Near/Far 0.1–1000** — the frustum range; objects outside are clipped.
- **Damping** — applies inertia to mouse/touch input so the camera glides to a stop rather than stopping instantly.

---

## React Integration Architecture

```
App.tsx
  ├─ viewerDivRef  — HTMLDivElement ref passed to ViewerManager
  ├─ isViewerCreated (ref) — prevents double-init in React StrictMode
  ├─ appContext.Provider  — provides MobX stores to the component tree
  └─ ViewerContext.Provider — provides the ViewerManager instance
```

The viewer is created imperatively inside `useEffect` so that the DOM element exists before Three.js tries to append the canvas to it. The `isViewerCreated` ref guard is essential in React 18 StrictMode where effects fire twice in development.

---

## State Management with MobX

`GeneralStore` uses `makeAutoObservable` to make all properties observable and all methods actions automatically:

```typescript
export class GeneralStore {
    testElement: any;
    constructor() { makeAutoObservable(this); }
    setTestElement(element: any) { this.testElement = element; }
}
```

Events emitted by the viewer (e.g. `building:updated`) update the store, which triggers reactive re-renders in any MobX-observer components.

---

## Typed Event Emitter

`EventEmitterManager` is a **generic, type-safe pub/sub bus** built with TypeScript mapped types:

```typescript
type BuildingEventMap = {
    "building:updated": { key: any; value: any; building: any };
    "building:loaded":  { building: any };
    "building:error":   { error: Error };
};
```

Using `K extends keyof BuildingEventMap` as a generic constraint means:
- Event names are validated at compile time (typos are errors).
- Callback payloads are fully typed.
- `on()` returns an **unsubscribe function** for clean React `useEffect` teardown.

---

## File & Class Map

| File | Class / Export | Responsibility |
|------|---------------|----------------|
| `viewer-manager.ts` | `ViewerManager` | Orchestrates all Three.js subsystems, owns the render loop |
| `geometry-manager.ts` | `GeometryManager` | Creates meshes with geometries and materials |
| `material-manager.ts` | `MaterialManager` | Loads textures |
| `light-manager.ts` | `LightManager` | Adds Three.js lights and helpers to the scene |
| `post-processing-pass.ts` | `PostProcessingPass` | Builds fullscreen-quad post-FX pass |
| `event-emitter-manager.ts` | `EventEmitterManager` | Typed pub/sub event bus |
| `geometry.vert.ts` | `vertexShader` | GLSL vertex shader — transform + animation |
| `geometry.frag.ts` | `fragmentShader` | GLSL fragment shader — lighting + texturing |
| `post-processing-vertex-shader.ts` | `postProcessingVertexShader` | Passthrough clip-space vertex shader |
| `post-processing-fragment-shader.ts` | `postProcessingFragmentShader` | Chromatic aberration + vignette |
| `general-store.ts` | `GeneralStore` | MobX observable store |
| `store-context.ts` | `appContext` | React context for MobX stores |
| `viewer-context.ts` | `ViewerContext` | React context for the viewer instance |
| `useLoadContextValue.ts` | hook | Bridges ViewerManager into React context |
| `App.tsx` | `App` | Root component — mounts viewer + provides contexts |
