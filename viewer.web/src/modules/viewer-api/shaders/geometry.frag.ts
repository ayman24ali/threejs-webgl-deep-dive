
// language=GLSL
export const fragmentShader = `
    precision highp float;

    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vPosition;

    uniform float uTime;
    uniform vec3 uColor;
    uniform sampler2D uTexture;
    uniform float uUseTexture;

    void main() {
        // Basic directional lighting
        vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
        float diffuse = max(dot(vNormal, lightDir), 0.0);
        float ambient = 0.2;

        vec3 baseColor;
        if (uUseTexture > 0.5) {
            baseColor = texture2D(uTexture, vUv).rgb;
        } else {
            baseColor = uColor;
        }
        
        
        vec3 color = baseColor * (ambient + diffuse * 0.8);
        gl_FragColor = vec4(color, 1.0);
    }
`;