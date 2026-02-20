//language=GLSL
export const postProcessingFragmentShader = `
    precision highp float;

    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uEffectIntensity;

    varying vec2 vUv;

    void main() {
        // Chromatic aberration — offset R, G, B channels
        float offset = 0.005 * uEffectIntensity * sin(uTime * 0.5);

        float r = texture2D(tDiffuse, vUv + vec2(offset, 0.0)).r;
        float g = texture2D(tDiffuse, vUv).g;
        float b = texture2D(tDiffuse, vUv - vec2(offset, 0.0)).b;

        // Vignette
        vec2 center = vUv - 0.5;
        float vignette = 1.0 - dot(center, center) * 1.5 * uEffectIntensity;

        gl_FragColor = vec4(vec3(r, g, b) * vignette, 1.0);
    }
`