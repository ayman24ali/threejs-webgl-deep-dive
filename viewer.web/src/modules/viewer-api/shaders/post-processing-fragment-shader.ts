//language=GLSL
// ─────────────────────────────────────────────────────────────────────────────
// POST-PROCESSING FRAGMENT SHADER
// This shader reads from the framebuffer texture produced in Pass 1 and applies
// two screen-space effects: chromatic aberration and a vignette.
// It runs on a fullscreen quad so every fragment corresponds to one screen pixel.
// ─────────────────────────────────────────────────────────────────────────────
export const postProcessingFragmentShader = `
    precision highp float;

    // ── Uniforms ──────────────────────────────────────────────────────────────
    uniform sampler2D tDiffuse;      // the scene texture from the FBO (Pass 1 output)
    uniform float     uTime;         // elapsed seconds — animates the aberration offset
    uniform vec2      uResolution;   // viewport size in pixels (available for pixel-space math)
    uniform float     uEffectIntensity; // global multiplier to scale effect strength

    // ── Varyings ──────────────────────────────────────────────────────────────
    varying vec2 vUv; // screen-space UV (0,0 bottom-left → 1,1 top-right)

    void main() {
        // ── Chromatic Aberration ───────────────────────────────────────────────
        // Simulates a lens optical defect where different light wavelengths
        // (colours) refract to slightly different focal points, causing colour
        // fringing at edges.  We achieve this by sampling the R, G, B channels
        // at slightly different UV positions along the horizontal axis.
        //
        // The offset oscillates via sin(uTime * 0.5) so the effect subtly pulses
        // over time rather than staying static.
        float offset = 0.005 * uEffectIntensity * sin(uTime * 0.5);

        // Red channel shifted right, blue shifted left, green centered.
        float r = texture2D(tDiffuse, vUv + vec2(offset, 0.0)).r;
        float g = texture2D(tDiffuse, vUv).g;                        // no offset
        float b = texture2D(tDiffuse, vUv - vec2(offset, 0.0)).b;

        // ── Vignette ──────────────────────────────────────────────────────────
        // Darkens the corners/edges so the eye is naturally drawn to the centre.
        // Technique: compute squared distance from the UV centre (0.5, 0.5).
        //   dot(center, center) == center.x² + center.y²  (no sqrt needed)
        // At the centre this is 0 → vignette = 1 (no darkening).
        // At the corners it rises → vignette approaches 0 (darkened).
        vec2  center   = vUv - 0.5;
        float vignette = 1.0 - dot(center, center) * 1.5 * uEffectIntensity;

        // Multiply the aberrated colour by the vignette mask and output.
        gl_FragColor = vec4(vec3(r, g, b) * vignette, 1.0);
    }
`