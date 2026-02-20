import {Scene, Vector3} from "three";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// LightManager — adds Three.js lights and diagnostic helpers to the scene.
//
// Key concepts:
//   PointLight  — emits light in all directions from a single point in space.
//                 Supports shadow casting (requires a shadow-map render per face
//                 of the cube-map shadow camera, which is expensive).
//   AmbientLight — adds a constant flat illumination to all surfaces equally.
//                  Does NOT cast shadows. Simulates indirect / bounced light so
//                  no part of the scene is completely pitch black.
//   PointLightHelper — a visual wireframe sphere placed at the light's position,
//                      useful for debugging light placement at development time.
// ─────────────────────────────────────────────────────────────────────────────
export class LightManager {
  
  constructor() {
  }
  
  createPointLight = (scene: Scene, position: Vector3) => {
    // PointLight(color, intensity, distance)
    //   color     0xff0000 — red-tinted light
    //   intensity 2        — brightness multiplier
    //   distance  100      — light attenuates to 0 at this world-unit radius;
    //                        0 means infinite range
    const pointLight = new THREE.PointLight(0xff0000, 2, 100);
    pointLight.position.set(position.x, position.y, position.z);
    scene.add(pointLight);

    // PointLightHelper draws a wireframe sphere at the light's position so you
    // can visually confirm placement — remove for production builds.
    const sphereSize = 1;
    const pointLightHelper = new THREE.PointLightHelper(pointLight, sphereSize);
    scene.add(pointLightHelper);
  }
  
  createAmbientLight = (scene: Scene) => {
    // AmbientLight(color) — soft, directionless fill light.
    // 0x404040 is a dark grey — just enough to prevent fully shadowed faces from
    // being completely black without washing out the diffuse lighting.
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
  }
  
}