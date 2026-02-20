//language=GLSL
// ─────────────────────────────────────────────────────────────────────────────
// POST-PROCESSING VERTEX SHADER
// This is an intentionally minimal "passthrough" vertex shader used for the
// fullscreen-quad technique.
//
// The quad is a PlaneGeometry(2, 2) whose vertices already sit at the corners
// of clip space (-1 to +1 in X and Y).  Paired with an OrthographicCamera that
// maps -1..1 directly to the viewport, we can skip all matrix multiplications
// and simply output position.xy as the clip-space position.
//
// The only job here is to forward UV coordinates so the fragment shader knows
// which texel of the FBO texture to sample.
// ─────────────────────────────────────────────────────────────────────────────
export const postProcessingVertexShader = `
    precision highp float;

    // Raw geometry attributes — no matrix transforms needed.
    attribute vec3 position; // already in clip space: corners at (±1, ±1)
    attribute vec2 uv;       // 0..1 screen-space UV coordinates

    // Passed to the fragment shader so it can look up the right texel.
    varying vec2 vUv;

    void main() {
        vUv = uv;
        // Clip-space passthrough: z=0 (on the near plane), w=1 (no perspective divide).
        // This places the quad exactly covering the entire viewport.
        gl_Position = vec4(position.xy, 0.0, 1.0);
    }
    
`