import * as THREE from "three";
import {postProcessingFragmentShader} from "../shaders/post-processing-fragment-shader";
import {postProcessingVertexShader} from "../shaders/post-processing-vertex-shader";

// ─────────────────────────────────────────────────────────────────────────────
// PostProcessingPass — builds the resources needed for Pass 2 of the pipeline.
//
// Concept: Fullscreen-Quad (FSQ) Technique
//   Instead of rendering a 3D scene, we render a 2D quad that exactly covers
//   the viewport and apply an image-processing shader to the FBO texture from
//   Pass 1.  This is the foundation of ALL post-processing effects:
//   bloom, depth of field, motion blur, colour grading, tone mapping, etc.
//
// The pass has its OWN separate Scene and OrthographicCamera so it doesn't
// interfere with the main 3D scene hierarchy or its perspective camera.
// ─────────────────────────────────────────────────────────────────────────────
export class PostProcessingPass {

    constructor() {
    }

    static createPostProcessPass() {
        // ── Fullscreen Quad Geometry ──────────────────────────────────────────
        // PlaneGeometry(2, 2) produces a rectangle whose corners sit at exactly
        // (-1,-1), (1,-1), (1,1), (-1,1) — the four corners of clip space.
        // No vertex transform is needed; the passthrough vertex shader emits them as-is.
        const geometry = new THREE.PlaneGeometry(2, 2);

        // ── Post-FX Material ──────────────────────────────────────────────────
        // RawShaderMaterial again — we need full control over the GLSL source.
        const material = new THREE.RawShaderMaterial({
            vertexShader: postProcessingVertexShader,
            fragmentShader: postProcessingFragmentShader,
            uniforms: {
                tDiffuse:        { value: null },           // FBO texture — set each frame in animate()
                uTime:           { value: 0 },              // elapsed seconds for animated effects
                uResolution:     { value: new THREE.Vector2() }, // viewport size for pixel-space math
                uEffectIntensity:{ value: 1.0 }             // master scale for all effects
            },
            // Disable depth testing and writing — the quad is not part of the 3D
            // scene so there is nothing to test it against or write into the depth buffer.
            depthTest:  false,
            depthWrite: false
        });

        const mesh = new THREE.Mesh(geometry, material);

        // ── Isolated Pass Scene ───────────────────────────────────────────────
        // A dedicated Scene keeps the post-processing quad completely separate
        // from the main scene so it never appears in the geometry pass (Pass 1).
        const scene = new THREE.Scene();
        scene.add(mesh);

        // ── Orthographic Camera ───────────────────────────────────────────────
        // OrthographicCamera(-1, 1, 1, -1, 0, 1) maps clip coordinates directly
        // to NDC with no perspective distortion — the quad fills the viewport exactly.
        //   left=-1, right=1, top=1, bottom=-1, near=0, far=1
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        return { scene, camera, material };
    }

}