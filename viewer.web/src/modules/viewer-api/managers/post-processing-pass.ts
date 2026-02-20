import {Scene, Vector3} from "three";
import * as THREE from "three";
import {postProcessingFragmentShader} from "../shaders/post-processing-fragment-shader";
import {postProcessingVertexShader} from "../shaders/post-processing-vertex-shader";

export class PostProcessingPass {

    constructor() {
    }

    static createPostProcessPass() {
        // Full-screen quad geometry (two triangles covering the viewport)
        const geometry = new THREE.PlaneGeometry(2, 2);

        // Post-processing material
        const material = new THREE.RawShaderMaterial({
            vertexShader: postProcessingVertexShader,
            fragmentShader: postProcessingFragmentShader,
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

}