import {Mesh, Vector3, WebGLRenderTarget} from "three";
import * as THREE from "three";
import {GeometryManager} from "./managers/geometry-manager";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import {LightManager} from "./managers/light-manager";
import {EventEmitterManager} from "./managers/event-emitter-manager";
import {MaterialManager} from "./managers/material-manager";
import {PostProcessingPass} from "./managers/post-processing-pass";

export class ViewerManager {
  toast: any;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera | undefined;
  renderer: THREE.WebGLRenderer | undefined;
  container: HTMLDivElement;
  controls!: OrbitControls;
  renderTarget: WebGLRenderTarget;
  geometryManager: GeometryManager;
  lightManager:LightManager;
  postFx:{ scene: THREE.Scene; camera: THREE.OrthographicCamera; material: THREE.RawShaderMaterial };
  eventEmitter:EventEmitterManager;
  materialManager:MaterialManager;
  cube: Mesh|undefined = undefined;
  clock: THREE.Clock = new THREE.Clock();
  
  constructor(containerRef: HTMLDivElement, toast: any) {
    this.toast = toast;
    this.container = containerRef;
    this.scene = new THREE.Scene();
    this.lightManager = new LightManager();
    this.eventEmitter = new EventEmitterManager();
    this.materialManager = new MaterialManager();
    this.geometryManager = new GeometryManager(this.materialManager);
    this.renderTarget = new WebGLRenderTarget( window.innerWidth,
        window.innerHeight,
        {
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          format: THREE.RGBAFormat
        })
    this.postFx = PostProcessingPass.createPostProcessPass()
    this.initializeScene(containerRef);
    this.attachEvents();
  }
  
  attachEvents = (): void => {
    window.addEventListener('resize', this.onWindowResize);
  }
  
  initializeScene(container: HTMLDivElement): void {
    // Initialize camera and renderer
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.z = 5;

    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true; // Enable shadows
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Optional: softer shadows
    container.appendChild(this.renderer.domElement);
    (window as any).renderer = this.renderer; // Expose renderer for debugging

    // Initialize OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; // Smooth controls
    this.controls.dampingFactor = 0.05;

    this.cube = this.geometryManager.createCube()
    this.scene.add(this.cube);

    const plane = this.geometryManager.createPlane();
    this.scene.add(plane);

      this.renderer.compile(this.scene, this.camera);
      const programs = this.renderer.info.programs;
      console.log('Compiled shader programs:', programs);


    this.lightManager.createPointLight(this.scene,new Vector3(0,5,0))
    this.lightManager.createAmbientLight(this.scene)
    // Start animation loop
    this.animate(this.cube);
  }
  
  animate = (rotatingObject: Mesh): void => {

    
    // Rotate the cube
    // rotatingObject.rotation.x += 0.01;
    // rotatingObject.rotation.y += 0.01;

      (this.cube!.material as THREE.RawShaderMaterial).uniforms.uTime.value = this.clock.getElapsedTime();
    // this.renderer?.render(this.scene, this.camera!);

    this.renderer?.setRenderTarget(this.renderTarget);
    this.renderer?.render(this.scene, this.camera!);

    // PASS 2: Framebuffer texture → Post-process shader → Screen
    this.postFx.material.uniforms.tDiffuse.value = this.renderTarget.texture;
    this.postFx.material.uniforms.uTime.value = this.clock.getElapsedTime();
    this.postFx.material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);

    this.renderer?.setRenderTarget(null);
    this.renderer?.render(this.postFx.scene, this.postFx.camera);

    requestAnimationFrame(() => this.animate(rotatingObject));
  }
  
  onWindowResize = (): void => {
    if (this.camera && this.renderer) {
      this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
  }
}
