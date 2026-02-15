// language=GLSL
export const vertexShader = `
// You MUST declare everything manually with RawShaderMaterial
   precision highp float;


   // Attributes — these come from the geometry buffers
   attribute vec3 position;
   attribute vec3 normal;
   attribute vec2 uv;

   // Uniforms — Three.js provides these, but with RawShaderMaterial
   // you must declare them yourself
   uniform mat4 modelViewMatrix;
   uniform mat4 projectionMatrix;
   uniform mat3 normalMatrix;
   uniform float uTime;

   // Varyings — pass data to the fragment shader
   varying vec3 vNormal;
   varying vec2 vUv;
   varying vec3 vPosition;

   void main() {
     vNormal = normalize(normalMatrix * normal);
     vUv = uv;
     vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;

     // Animate the vertices
     vec3 pos = position;
     pos += normal * sin(uTime + position.y * 3.0) * 0.1;

     gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
   }
`;