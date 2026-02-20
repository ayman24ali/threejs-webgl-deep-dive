import * as THREE from "three";
import {vertexShader} from "../shaders/geometry.vert";
import {fragmentShader} from "../shaders/geometry.frag";
import {MaterialManager} from "./material-manager";

// ─────────────────────────────────────────────────────────────────────────────
// GeometryManager — responsible for creating Three.js meshes.
//
// Key concepts demonstrated here:
//   • THREE.RawShaderMaterial: bypasses Three.js shader injection so we can
//     write fully manual GLSL programs and see exactly what the GPU receives.
//   • Uniforms: typed data (floats, vectors, textures) pushed from CPU to GPU
//     each frame or on demand.
//   • Buffer attribute inspection: logging geometry VBOs at creation time to
//     understand what raw data lives on the GPU.
//   • Shadow casting/receiving: per-mesh flags that feed into Three.js's
//     shadow-map rendering pipeline.
// ─────────────────────────────────────────────────────────────────────────────
export class GeometryManager {
    materialManager: MaterialManager

    constructor(materialManager: MaterialManager) {
        this.materialManager = materialManager;
    }

    createCube = () => {
        const geometry = new THREE.BoxGeometry();

        // Load a diffuse texture through MaterialManager (wraps TextureLoader).
        // THREE.TextureLoader is async — the texture streams in after the first render.
        const diffuseMap = this.materialManager.loadMaterialFromLocalPath('./textures/diffuse.jpg');

        // RawShaderMaterial: the "bare metal" material.
        // Unlike ShaderMaterial, Three.js injects NO built-in uniforms or #include
        // directives — the developer is fully responsible for the shader source.
        const material = new THREE.RawShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: {
                // uTime drives vertex displacement and post-FX animations — updated each frame.
                uTime:       { value: 0 },
                // uColor is the fallback solid colour when texturing is disabled.
                uColor:      { value: new THREE.Color(1, 0, 0) },
                // uTexture holds a sampler2D reference — the loaded diffuse map.
                uTexture:    { value: diffuseMap },
                // uUseTexture is a float flag: >0.5 = use texture, else use uColor.
                // Using a float instead of a bool avoids GLSL bool uniform quirks.
                uUseTexture: { value: 1.0 }
            }
        });

        const cube = new THREE.Mesh(geometry, material)
        cube.position.set(0, 2, 0);

        // castShadow: this mesh will project shadows onto other receiveShadow objects.
        // receiveShadow: this mesh will show shadows cast by other castShadow objects.
        // Both require renderer.shadowMap.enabled = true.
        cube.castShadow    = true;
        cube.receiveShadow = true;

        // ── VBO Inspection ─────────────────────────────────────────────────────
        // Logging the raw buffer attributes lets us verify what data the GPU holds:
        //   position — Float32Array of XYZ coords for each vertex
        //   normal   — Float32Array of surface normal directions
        //   uv       — Float32Array of texture coordinates (0–1 range)
        //   index    — Uint16/Uint32Array referencing shared vertices (index buffer)
        console.log('Position buffer:', geometry.attributes.position);
        console.log('Normal buffer:',   geometry.attributes.normal);
        console.log('UV buffer:',       geometry.attributes.uv);
        console.log('Vertex count:',    geometry.attributes.position.count);
        console.log('Index buffer:',    geometry.index);

        return cube
    }

    createPlane = () => {
        const geometry = new THREE.PlaneGeometry(10, 10);
        // MeshBasicMaterial is unlit — useful as a simple ground plane without
        // the complexity of a custom shader. DoubleSide renders both faces.
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide });
        const plane    = new THREE.Mesh(geometry, material);

        plane.position.set(0, 0, 0);
        // Rotate 90° around X to lay the plane flat (default orientation is vertical).
        plane.rotation.x = -Math.PI / 2;
        // The plane receives shadows from the cube above it.
        plane.receiveShadow = true;
        return plane
    }

    // Placeholder for a future sphere mesh — follow the same pattern as createCube().
    createSphere = () => {

    }
}