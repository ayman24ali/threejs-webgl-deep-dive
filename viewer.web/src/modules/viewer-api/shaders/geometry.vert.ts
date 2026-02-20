// language=GLSL
// ─────────────────────────────────────────────────────────────────────────────
// GEOMETRY VERTEX SHADER
// Used with THREE.RawShaderMaterial — no Three.js built-ins are injected
// automatically, so every uniform, attribute, and varying must be declared here.
// ─────────────────────────────────────────────────────────────────────────────
export const vertexShader = `
   // With RawShaderMaterial, precision MUST be declared manually.
   // "highp" gives full 32-bit float precision — required for matrices.
   precision highp float;

   // ── Attributes ────────────────────────────────────────────────────────────
   // Per-vertex data streamed from the geometry's VBOs (Vertex Buffer Objects).
   // Three.js binds them by name when the BufferGeometry has matching attributes.
   attribute vec3 position; // object-space vertex position
   attribute vec3 normal;   // object-space surface normal
   attribute vec2 uv;       // texture coordinate (0–1 range)

   // ── Uniforms ──────────────────────────────────────────────────────────────
   // Same value for every vertex in a draw call; set from JavaScript.
   // Three.js provides these for RawShaderMaterial but you must still declare them.
   uniform mat4 modelViewMatrix;   // model → view (camera) space transform
   uniform mat4 projectionMatrix;  // view space → clip space (perspective divide)
   // normalMatrix = transpose(inverse(mat3(modelViewMatrix))).
   // Using it (instead of plain modelViewMatrix) ensures normals stay
   // perpendicular to the surface even when the mesh is non-uniformly scaled.
   uniform mat3 normalMatrix;
   uniform float uTime; // elapsed seconds — drives vertex animation

   // ── Varyings ──────────────────────────────────────────────────────────────
   // Written in the vertex shader; GPU linearly interpolates them across the
   // triangle's surface and delivers per-fragment values to the fragment shader.
   varying vec3 vNormal;   // view-space normal for per-fragment lighting
   varying vec2 vUv;       // texture coordinate passed through to fragment
   varying vec3 vPosition; // view-space position (useful for fog, rim lighting…)

   void main() {
     // Transform normal to view space and renormalize after the matrix multiply.
     vNormal = normalize(normalMatrix * normal);

     // UVs need no transform — pass straight through.
     vUv = uv;

     // Compute view-space position for use in the fragment shader.
     vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;

     // ── Vertex Animation (Sine-Wave Displacement) ─────────────────────────
     // Displace each vertex outward along its normal using a time-driven sine.
     // position.y * 3.0 creates a spatial frequency so vertices at different
     // heights receive different phase offsets — producing a wave-like pattern.
     // Amplitude 0.1 keeps the deformation subtle.
     vec3 pos = position;
     pos += normal * sin(uTime + position.y * 3.0) * 0.1;

     // Standard MVP transform: projection * view * model * position
     gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
   }
`;