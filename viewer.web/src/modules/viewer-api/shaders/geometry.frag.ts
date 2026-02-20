
// language=GLSL
// ─────────────────────────────────────────────────────────────────────────────
// GEOMETRY FRAGMENT SHADER
// Runs once per rasterized fragment (roughly: per screen pixel covered by a
// triangle). Responsible for computing the final RGBA colour output.
// ─────────────────────────────────────────────────────────────────────────────
export const fragmentShader = `
    precision highp float;

    // ── Varyings (interpolated from vertex shader) ────────────────────────────
    varying vec3 vNormal;   // view-space surface normal (interpolated per fragment)
    varying vec2 vUv;       // texture coordinate for this fragment
    varying vec3 vPosition; // view-space position (available for future effects)

    // ── Uniforms ──────────────────────────────────────────────────────────────
    uniform float uTime;         // elapsed seconds (available for animated colour effects)
    uniform vec3  uColor;        // fallback solid colour when no texture is used
    uniform sampler2D uTexture;  // diffuse texture map (bound from MaterialManager)
    uniform float uUseTexture;   // 1.0 = sample texture, 0.0 = use uColor

    void main() {
        // ── Diffuse (Lambertian) Lighting ──────────────────────────────────────
        // A fixed hardcoded light direction in view space (diagonal from top-right-front).
        // dot(normal, lightDir) gives the cosine of the angle between them:
        //   1.0 → surface faces the light directly  → fully lit
        //   0.0 → surface is perpendicular (grazing) → no contribution
        //  <0.0 → back face — clamped to 0 by max()
        vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
        float diffuse = max(dot(vNormal, lightDir), 0.0);

        // ── Ambient Lighting ───────────────────────────────────────────────────
        // A small constant that prevents completely dark shadows, simulating
        // indirect/bounced light from the environment.
        float ambient = 0.2;

        // ── Base Colour (Texture or Solid) ─────────────────────────────────────
        // The uUseTexture float flag lets JavaScript toggle texturing at runtime
        // without recompiling the shader (using a branch on a uniform value).
        vec3 baseColor;
        if (uUseTexture > 0.5) {
            // texture2D samples the bound sampler2D at the UV coordinate.
            // .rgb discards the alpha channel (not needed here).
            baseColor = texture2D(uTexture, vUv).rgb;
        } else {
            baseColor = uColor;
        }

        // ── Final Colour Composition ───────────────────────────────────────────
        // Combine ambient and diffuse contributions, then scale by base colour.
        // diffuse * 0.8 slightly reduces diffuse strength so the texture isn't
        // blown out by the directional light.
        vec3 color = baseColor * (ambient + diffuse * 0.8);

        // gl_FragColor is the built-in output: the final RGBA colour of this fragment.
        gl_FragColor = vec4(color, 1.0);
    }
`;