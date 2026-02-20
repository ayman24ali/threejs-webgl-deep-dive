import {Mesh, Vector3, WebGLRenderTarget} from "three";
import * as THREE from "three";
import {GeometryManager} from "./managers/geometry-manager";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import {LightManager} from "./managers/light-manager";
import {EventEmitterManager} from "./managers/event-emitter-manager";
import {MaterialManager} from "./managers/material-manager";
import {PostProcessingPass} from "./managers/post-processing-pass";

// ─────────────────────────────────────────────────────────────────────────────
// ViewerManager — central orchestrator for the Three.js scene.
//
// Architecture:
//   • Owns the WebGLRenderer, Scene, PerspectiveCamera, and OrbitControls.
//   • Delegates mesh/geometry concerns to GeometryManager.
//   • Delegates lighting to LightManager.
//   • Delegates texture loading to MaterialManager.
//   • Delegates post-processing to PostProcessingPass.
//   • Exposes a typed event bus via EventEmitterManager so React components
//     can subscribe to viewer events without coupling to Three.js internals.
//
// Render Pipeline (two-pass):
//   Pass 1 — Geometry Pass:
//     Render the 3D scene into a WebGLRenderTarget (FBO / off-screen texture).
//   Pass 2 — Post-Processing Pass:
//     Bind the FBO texture as `tDiffuse` and render a fullscreen quad with the
//     post-FX shader (chromatic aberration + vignette) to the screen.
// ─────────────────────────────────────────────────────────────────────────────
export class ViewerManager {
  toast: any;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera | undefined;
  renderer: THREE.WebGLRenderer | undefined;
  container: HTMLDivElement;
  controls!: OrbitControls;

  // WebGLRenderTarget wraps a WebGL Framebuffer Object (FBO).
  // Instead of drawing directly to the screen, Pass 1 renders into this texture.
  renderTarget: WebGLRenderTarget;

  geometryManager: GeometryManager;
  lightManager: LightManager;

  // postFx holds the separate scene/camera/material used for the fullscreen-quad pass.
  postFx: { scene: THREE.Scene; camera: THREE.OrthographicCamera; material: THREE.RawShaderMaterial };

  eventEmitter: EventEmitterManager;
  materialManager: MaterialManager;
  cube: Mesh | undefined = undefined;

  // THREE.Clock provides a monotonically increasing elapsed time in seconds,
  // independent of frame rate — used to drive time-based shader animations.
  clock: THREE.Clock = new THREE.Clock();

  constructor(containerRef: HTMLDivElement, toast: any) {
    this.toast = toast;
    this.container = containerRef;
    this.scene = new THREE.Scene();
    this.lightManager = new LightManager();
    this.eventEmitter = new EventEmitterManager();
    this.materialManager = new MaterialManager();
    this.geometryManager = new GeometryManager(this.materialManager);

    // Create the off-screen render target for the geometry pass.
    // LinearFilter: bilinear interpolation when the texture is scaled.
    // RGBAFormat: stores 4 channels (red, green, blue, alpha).
    this.renderTarget = new WebGLRenderTarget( window.innerWidth,
        window.innerHeight,
        {
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          format: THREE.RGBAFormat
        })

    // Build the fullscreen-quad scene, orthographic camera, and post-FX material.
    this.postFx = PostProcessingPass.createPostProcessPass()
    this.initializeScene(containerRef);
    this.attachEvents();
  }

  attachEvents = (): void => {
    // Listen for viewport resizes so the camera aspect ratio and renderer size
    // stay in sync with the actual window dimensions.
    window.addEventListener('resize', this.onWindowResize);
  }

  initializeScene(container: HTMLDivElement): void {
    // ── Camera ──────────────────────────────────────────────────────────────
    // PerspectiveCamera(fov, aspect, near, far)
    //   fov 75° — fairly wide, natural-looking perspective.
    //   near/far define the frustum depth range; geometry outside is clipped.
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.z = 5;

    // ── Renderer ────────────────────────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(container.clientWidth, container.clientHeight);

    // Enable the shadow-map subsystem. Without this line, no shadows are cast.
    this.renderer.shadowMap.enabled = true;
    // PCFSoftShadowMap: Percentage Closer Filtering — samples the shadow map
    // multiple times and averages results, producing soft shadow edges.
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    (window as any).renderer = this.renderer; // expose for browser DevTools inspection

    // ── OrbitControls ───────────────────────────────────────────────────────
    // Attaches mouse/touch listeners to the renderer's canvas so the user can
    // rotate, zoom, and pan the camera around a target point.
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;   // inertia — camera glides to a stop
    this.controls.dampingFactor = 0.05;   // lower = more glide

    // ── Geometry ─────────────────────────────────────────────────────────────
    this.cube = this.geometryManager.createCube()
    this.scene.add(this.cube);

    const plane = this.geometryManager.createPlane();
    this.scene.add(plane);

    // renderer.compile() forces Three.js to compile and link all GLSL shader
    // programs synchronously right now, rather than lazily on the first frame.
    // renderer.info.programs then lets us inspect the compiled programs for
    // debugging purposes (uniform locations, attribute locations, etc.).
    this.renderer.compile(this.scene, this.camera);
    const programs = this.renderer.info.programs;
    console.log('Compiled shader programs:', programs);

    // ── Lights ───────────────────────────────────────────────────────────────
    this.lightManager.createPointLight(this.scene, new Vector3(0, 5, 0))
    this.lightManager.createAmbientLight(this.scene)

    // Start the render loop.
    this.animate(this.cube);
  }

  animate = (rotatingObject: Mesh): void => {
    // ── Update Uniforms ──────────────────────────────────────────────────────
    // Push the current elapsed time into the cube's shader so the vertex
    // animation wave and any time-based colour effects stay in sync.
    (this.cube!.material as THREE.RawShaderMaterial).uniforms.uTime.value = this.clock.getElapsedTime();

    // ── Pass 1: Geometry → FBO ───────────────────────────────────────────────
    // Redirect WebGL's draw output from the screen to the off-screen texture.
    this.renderer?.setRenderTarget(this.renderTarget);
    this.renderer?.render(this.scene, this.camera!);

    // ── Pass 2: FBO texture → Post-FX → Screen ───────────────────────────────
    // Bind the FBO texture as the diffuse input for the post-processing shader.
    this.postFx.material.uniforms.tDiffuse.value = this.renderTarget.texture;
    this.postFx.material.uniforms.uTime.value = this.clock.getElapsedTime();
    this.postFx.material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);

    // Restore the default framebuffer (the screen) and render the fullscreen quad.
    this.renderer?.setRenderTarget(null);
    this.renderer?.render(this.postFx.scene, this.postFx.camera);

    // Schedule the next frame — requestAnimationFrame syncs to the display
    // refresh rate and pauses when the tab is hidden, saving GPU resources.
    requestAnimationFrame(() => this.animate(rotatingObject));
  }

  onWindowResize = (): void => {
    // Keep camera aspect ratio and renderer pixel dimensions aligned with the
    // container's current size after a window resize event.
    if (this.camera && this.renderer) {
      this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera.updateProjectionMatrix(); // must call after changing camera params
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
  }
}
