# WebGL Fundamentals — The Full Picture

## The Big Question: Why Does Any of This Exist?

Your browser gives you a `<canvas>` element. Your computer has a GPU — a chip designed to do millions of tiny math operations in parallel. WebGL is the **bridge** between your JavaScript code (running on the CPU) and the GPU. That's all it is. Every concept below exists to solve one problem: **how do we get data from JavaScript into the GPU, tell the GPU what to do with it, and get pixels on screen?**

Here's the entire flow in one sentence:

> You put **geometry data** into **buffers**, upload those buffers to the GPU, write **shaders** (small programs) that tell the GPU how to process that data, optionally use **textures** as image data the shaders can read, and the GPU writes the final pixels either to the **screen** or to a **framebuffer** (an off-screen image you can reuse).

Every concept — buffers, shaders, textures, framebuffers — is a piece of this pipeline. Let's walk through each one and how they connect.

---

## Part 1: The WebGL Context — Your Remote Control for the GPU

When you do this:

```javascript
const canvas = document.getElementById('myCanvas');
const gl = canvas.getContext('webgl2');
```

You're not "starting WebGL." You're getting a **remote control** — an object (`gl`) with ~300 methods that send commands to the GPU. Every single thing you do in WebGL goes through this object. Think of it like this:

```
Your JavaScript Code  →  gl object (the remote control)  →  GPU
```

The `gl` object is stateful — it remembers what's currently "active" or "bound." This is a crucial mental model. You don't say "draw this buffer with this shader." Instead you say:

1. "Hey GPU, make **this** buffer the active one" (`gl.bindBuffer(...)`)
2. "Hey GPU, make **this** shader the active one" (`gl.useProgram(...)`)
3. "Now draw." (`gl.drawArrays(...)`)

The GPU looks at whatever is currently active/bound and uses that. This "bind then act" pattern is everywhere in WebGL.

**Three.js hides this entirely.** When you call `renderer.render(scene, camera)`, Three.js is making dozens of these `gl.bindX()` and `gl.bindY()` calls behind the scenes. The PoC will make you see them.

---

## Part 2: Buffers — Getting Your Geometry to the GPU

### The Problem

You have a 3D cube in JavaScript. It's just numbers — vertex positions, normals, UV coordinates. But these numbers live in **CPU memory** (your regular RAM). The GPU can't see them. You need to **upload** this data to **GPU memory** (VRAM).

### The Solution: Buffers

A buffer is a chunk of GPU memory that holds raw numbers. Here's what happens step by step:

```javascript
// Step 1: Create an empty buffer on the GPU
const buffer = gl.createBuffer();

// Step 2: Make it the "active" buffer (bind it)
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

// Step 3: Upload data from CPU → GPU
const positions = new Float32Array([
  -1, -1, 0,   // vertex 1: x, y, z
   1, -1, 0,   // vertex 2: x, y, z
   0,  1, 0    // vertex 3: x, y, z
]);
gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
```

After step 3, those 9 numbers now live on the GPU. Your JavaScript array could be garbage collected — the GPU has its own copy.

### But Wait — The GPU Doesn't Know What These Numbers Mean

You uploaded 9 floats. The GPU sees: `[-1, -1, 0, 1, -1, 0, 0, 1, 0]`. It doesn't know these are XYZ positions grouped in threes. You need to **describe the layout**:

```javascript
// "Hey GPU, attribute #0 should read this buffer as groups of 3 floats"
gl.vertexAttribPointer(
  0,        // attribute index (location in the shader)
  3,        // 3 components per vertex (x, y, z)
  gl.FLOAT, // data type
  false,    // don't normalize
  0,        // stride (0 = tightly packed)
  0         // offset (start from the beginning)
);
gl.enableVertexAttribArray(0);
```

This is called an **attribute pointer** — it tells the GPU how to read the buffer. "Start at byte 0, read 3 floats, that's one vertex. Jump forward, read 3 more floats, that's the next vertex..."

### Real Geometry Has Multiple Attributes

A typical vertex has:
- **Position** (x, y, z) — where is it?
- **Normal** (nx, ny, nz) — which direction does the surface face? (needed for lighting)
- **UV** (u, v) — where on a 2D texture does this vertex map to?

Each of these is a separate buffer (or interleaved in one buffer), each with its own attribute pointer.

### How Three.js Handles This

When you create a `BoxGeometry()`, Three.js:

1. Calculates all vertex positions, normals, and UVs
2. Stores them in a `BufferGeometry` object
3. At render time, creates WebGL buffers and uploads the data
4. Sets up all the attribute pointers automatically

```javascript
// Three.js abstraction
const geometry = new THREE.BoxGeometry(1, 1, 1);

// What's actually inside:
console.log(geometry.attributes.position); // Float32BufferAttribute — the position data
console.log(geometry.attributes.normal);   // Float32BufferAttribute — the normal data
console.log(geometry.attributes.uv);       // Float32BufferAttribute — the UV data
```

Each of those `.attributes.position`, `.attributes.normal`, `.attributes.uv` will become a separate WebGL buffer with its own attribute pointer. Three.js does all of this when you call `renderer.render()`.

---

## Part 3: Shaders — Programs That Run ON the GPU

### The Problem

Data is on the GPU now. But the GPU doesn't know what to **do** with it. Should the triangle be red? Should it rotate? Should it have lighting? You need to give the GPU instructions.

### The Solution: Shaders

Shaders are small programs written in **GLSL** (a C-like language) that run directly on the GPU. There are two types that work as a pair:

### Vertex Shader — Runs Once Per Vertex

Its job: take each vertex's position and figure out where it should appear on screen.

```glsl
// Inputs (from buffers — this is where buffers connect to shaders!)
attribute vec3 position;  // ← comes from the position buffer
attribute vec3 normal;    // ← comes from the normal buffer
attribute vec2 uv;        // ← comes from the UV buffer

// Uniforms (values you send from JavaScript — same for ALL vertices)
uniform mat4 modelViewMatrix;   // where is the object + camera?
uniform mat4 projectionMatrix;  // perspective projection

// Output (passed to the fragment shader)
varying vec2 vUv;
varying vec3 vNormal;

void main() {
  vUv = uv;
  vNormal = normal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

**Key insight:** The `attribute` inputs are the **exact same data** you uploaded in buffers and described with attribute pointers. This is where Part 2 and Part 3 connect. The attribute pointer you set up tells the GPU "feed buffer data into this attribute variable in the shader."

### Fragment Shader — Runs Once Per Pixel

After the vertex shader positions the triangle on screen, the GPU figures out which pixels are inside that triangle (this step is called **rasterization** — the GPU does it automatically). Then the fragment shader runs for **every single pixel** to determine its color.

```glsl
// Inputs (interpolated from the vertex shader outputs)
varying vec2 vUv;
varying vec3 vNormal;

// Uniforms
uniform float time;

void main() {
  // Simple lighting based on normal direction
  float light = dot(vNormal, normalize(vec3(1.0, 1.0, 1.0)));
  gl_FragColor = vec4(vec3(light), 1.0);
}
```

### The `varying` Connection Between Shaders

Notice `varying vec2 vUv` appears in both shaders. The vertex shader writes it; the fragment shader reads it. But here's the magic: if vertex A has `vUv = (0, 0)` and vertex B has `vUv = (1, 1)`, then a pixel halfway between them automatically gets `vUv = (0.5, 0.5)`. The GPU **interpolates** varying values across the surface. This is how smooth gradients and texture mapping work.

### Three Types of Shader Inputs

| Type | Set by | Changes per | Example |
|------|--------|-------------|---------|
| `attribute` | Buffer data | Each vertex | position, normal, uv |
| `uniform` | JavaScript (`gl.uniform*`) | Each draw call (same for all vertices/pixels) | time, camera matrix, texture |
| `varying` | Vertex shader output | Each pixel (interpolated) | passed UV coords, passed normals |

### Compiling and Linking

Shaders are compiled at runtime (your browser compiles them into GPU machine code):

```javascript
// Raw WebGL shader compilation
const vertexShader = gl.createShader(gl.VERTEX_SHADER);
gl.shaderSource(vertexShader, vertexShaderCode);
gl.compileShader(vertexShader);

const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
gl.shaderSource(fragmentShader, fragmentShaderCode);
gl.compileShader(fragmentShader);

// Link them into a "program"
const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);

// Use it
gl.useProgram(program);
```

**Three.js wraps this** in `ShaderMaterial` / `RawShaderMaterial`. When you pass `vertexShader` and `fragmentShader` strings, Three.js compiles and links them for you.

---

## Part 4: Uniforms — JavaScript Talking to Shaders

Uniforms are how you send values from your JavaScript render loop into the shader every frame. Unlike attributes (which differ per vertex), uniforms are the **same for every vertex/pixel** in a single draw call.

```javascript
// Raw WebGL: find the uniform's location, then set it
const timeLoc = gl.getUniformLocation(program, 'time');
gl.uniform1f(timeLoc, performance.now() / 1000);

const matrixLoc = gl.getUniformLocation(program, 'projectionMatrix');
gl.uniformMatrix4fv(matrixLoc, false, projectionMatrix);
```

Common uniforms:
- **`time`** — for animation
- **`modelViewMatrix`** — positions the object relative to camera
- **`projectionMatrix`** — applies perspective
- **`resolution`** — screen size (for post-processing effects)
- **Textures** — yes, textures are passed as uniforms (more on this next)

**Three.js wraps this** via the `uniforms` property on materials:

```javascript
const material = new THREE.RawShaderMaterial({
  uniforms: {
    time: { value: 0.0 },
    color: { value: new THREE.Color(0xff0000) }
  },
  vertexShader: '...',
  fragmentShader: '...'
});

// In your render loop:
material.uniforms.time.value = clock.getElapsedTime();
```

Three.js reads those values and calls the appropriate `gl.uniform*` functions before each draw.

---

## Part 5: Textures — Image Data on the GPU

### The Problem

You want to put an image on a surface, or you want to pass a 2D grid of data to a shader. You need a way to upload image/2D data to the GPU and let shaders read it.

### The Solution: Textures

A texture is essentially a 2D array of pixel data stored on the GPU. Loading one looks like this in raw WebGL:

```javascript
const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);

// Upload image data CPU → GPU
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

// Configure how the GPU samples (reads) from it
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
```

### Texture Units — The Slot System

The GPU has a limited number of "slots" (texture units) where textures can be active simultaneously (usually 8-32). To use a texture in a shader:

```javascript
gl.activeTexture(gl.TEXTURE0);            // activate slot 0
gl.bindTexture(gl.TEXTURE_2D, myTexture); // put texture in slot 0
gl.uniform1i(samplerLocation, 0);         // tell shader: "use slot 0"
```

Then in GLSL:

```glsl
uniform sampler2D myTexture;  // connected to texture unit 0
varying vec2 vUv;

void main() {
  vec4 color = texture2D(myTexture, vUv);  // read the pixel at this UV coordinate
  gl_FragColor = color;
}
```

The `vUv` coordinate (from the vertex shader, interpolated) tells the GPU **where** on the texture to sample for each pixel. `(0,0)` is bottom-left, `(1,1)` is top-right.

### This Is Where UVs and Textures Connect

Remember UV coordinates from Part 2 (buffers)? They flow like this:

```
UV buffer → attribute in vertex shader → varying → fragment shader → texture2D(sampler, vUv)
```

The UV tells the GPU "for this pixel on the 3D surface, look up this coordinate on the 2D texture image."

### Three.js Wraps This

```javascript
const texture = new THREE.TextureLoader().load('image.jpg');
// Three.js creates the WebGL texture, uploads the image,
// sets filtering parameters, assigns a texture unit, etc.

material.uniforms.myTexture = { value: texture };
// At render time, Three.js binds it to a texture unit and
// sets the uniform integer to point to that unit.
```

---

## Part 6: The Rendering Pipeline — How It All Flows Together

Now you have all the pieces. Here's the **complete pipeline** for rendering a single object, showing how every concept connects:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         YOUR JAVASCRIPT CODE                            │
│                                                                         │
│  1. Create buffers, upload geometry data (positions, normals, UVs)      │
│  2. Compile vertex + fragment shaders, link into a program              │
│  3. Load textures, upload to GPU                                        │
│  4. Set uniforms (time, matrices, texture unit references)              │
│  5. Bindeverything and call gl.drawArrays()                             │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      GPU: VERTEX SHADER STAGE                           │
│                                                                         │
│  Runs once per vertex.                                                  │
│  Reads: attributes (from buffers) + uniforms (from JS)                  │
│  Outputs: gl_Position (screen position) + varyings (to pass forward)    │
│                                                                         │
│  attribute vec3 position ──→ transformed by matrices ──→ gl_Position    │
│  attribute vec2 uv ──→ passed as varying vUv ──→ (to fragment shader)   │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      GPU: RASTERIZATION (automatic)                     │
│                                                                         │
│  The GPU figures out which screen pixels are inside each triangle.       │
│  For each pixel, it interpolates all the varying values.                │
│  You don't write code for this — the GPU handles it.                    │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    GPU: FRAGMENT SHADER STAGE                            │
│                                                                         │
│  Runs once per pixel.                                                   │
│  Reads: interpolated varyings + uniforms + textures                     │
│  Outputs: gl_FragColor (the final RGBA color of this pixel)             │
│                                                                         │
│  varying vUv ──→ texture2D(sampler, vUv) ──→ sampled color              │
│  uniform time ──→ animated effects                                      │
│  Everything combined ──→ gl_FragColor                                   │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      GPU: OUTPUT                                        │
│                                                                         │
│  The pixel color is written to either:                                  │
│  a) The DEFAULT FRAMEBUFFER → screen (canvas)                           │
│  b) A CUSTOM FRAMEBUFFER → a texture (for post-processing)              │
└─────────────────────────────────────────────────────────────────────────┘
```

**This is the full picture.** Everything in WebGL is about feeding this pipeline.

---

## Part 7: Framebuffers — Rendering to a Texture Instead of the Screen

### The Problem

Normally the GPU writes pixels to the screen. But what if you want to take the rendered image and process it further — like applying blur, color correction, or glitch effects? You need to **capture** the render output as an image you can feed back into another shader.

### The Solution: Framebuffer Objects (FBOs)

A framebuffer is an **off-screen render target**. Instead of writing pixels to the canvas, the GPU writes them to a texture that you attached to the framebuffer. Then you can use that texture as input to another shader.

```javascript
// Raw WebGL: create a framebuffer
const fbo = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

// Create a texture to render into
const fboTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, fboTexture);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
// Notice: null data — we're not uploading an image, the GPU will WRITE to this

// Attach the texture to the framebuffer
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTexture, 0);
```

Now when you render:

```javascript
// Render to the framebuffer (off-screen)
gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
gl.drawArrays(...); // pixels go into fboTexture

// Switch back to screen
gl.bindFramebuffer(gl.FRAMEBUFFER, null); // null = default = screen
```

### This Is How Post-Processing Works

The pattern is:

```
Pass 1: Render 3D scene → framebuffer texture
Pass 2: Draw a full-screen quad, sampling from that texture, applying effects → screen
```

Pass 2 is just a rectangle that covers the entire screen. Its fragment shader reads the Pass 1 result as a texture and modifies every pixel:

```glsl
uniform sampler2D tDiffuse; // the framebuffer texture from Pass 1
varying vec2 vUv;

void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  
  // Invert colors as a simple effect
  gl_FragColor = vec4(1.0 - color.rgb, 1.0);
}
```

### Three.js Wraps This with WebGLRenderTarget

```javascript
const renderTarget = new THREE.WebGLRenderTarget(width, height);

// Pass 1: render to texture
renderer.setRenderTarget(renderTarget);
renderer.render(scene, camera);

// Pass 2: render to screen using the texture
postProcessMaterial.uniforms.tDiffuse.value = renderTarget.texture;
renderer.setRenderTarget(null);
renderer.render(postProcessScene, postProcessCamera);
```

`WebGLRenderTarget` is literally a wrapper around `gl.createFramebuffer()` + `gl.createTexture()` + `gl.framebufferTexture2D()`.

---

## Part 8: How Everything Connects — The Complete Map

Here's every concept and how they relate:

```
JAVASCRIPT (CPU SIDE)
│
├── BUFFERS
│   ├── Position buffer (Float32Array of x,y,z values)
│   ├── Normal buffer (Float32Array of nx,ny,nz values)
│   └── UV buffer (Float32Array of u,v values)
│       │
│       │ uploaded to GPU via gl.bufferData()
│       │ layout described via gl.vertexAttribPointer()
│       ▼
│
├── SHADER PROGRAM (compiled on GPU)
│   ├── Vertex Shader
│   │   ├── READS attributes ←── from buffers (position, normal, uv)
│   │   ├── READS uniforms ←── from JS (matrices, time)
│   │   ├── OUTPUTS gl_Position (where on screen)
│   │   └── OUTPUTS varyings (data for fragment shader)
│   │       │
│   │       │ rasterization (GPU finds pixels inside triangles)
│   │       │ varyings are interpolated per pixel
│   │       ▼
│   └── Fragment Shader
│       ├── READS interpolated varyings (vUv, vNormal, etc.)
│       ├── READS uniforms (time, colors, etc.)
│       ├── READS textures ←── via sampler2D + texture2D()
│       └── OUTPUTS gl_FragColor (pixel color)
│           │
│           ▼
│
├── TEXTURES
│   ├── Image textures (loaded from files)
│   └── Framebuffer textures (rendered by a previous pass)
│       │
│       │ bound to texture units (gl.TEXTURE0, gl.TEXTURE1...)
│       │ referenced in shaders as uniform sampler2D
│       │
│
├── FRAMEBUFFERS
│   ├── Default framebuffer → SCREEN (canvas)
│   └── Custom framebuffers → attached TEXTURE
│       │
│       │ The attached texture can be used as input
│       │ to another shader pass (post-processing!)
│       │
│       └── This creates the multi-pass pipeline:
│           Pass 1: scene → FBO texture
│           Pass 2: FBO texture → screen (with effects)
│
└── UNIFORMS (the bridge from JS to shaders)
    ├── Matrices (modelView, projection) — set per object
    ├── Time — set per frame
    ├── Texture unit indices — connect samplers to texture slots
    └── Custom values — anything your effect needs
```

---

## Part 9: How the PoC Exercises All of This

Now you can see why the PoC is structured the way it is:

### Step 1: Scene with `RawShaderMaterial`

You create geometry (Three.js makes buffers) → write your own vertex + fragment shaders → manually declare attributes and uniforms → pass matrices and time. **This covers: buffers, attributes, shaders, uniforms.**

### Step 2: Render to `WebGLRenderTarget`

Instead of rendering to screen, you render to an FBO. The entire 3D scene becomes a texture. **This covers: framebuffers, render-to-texture.**

### Step 3: Post-Processing Pass

A full-screen quad reads the FBO texture and applies effects. The fragment shader samples the texture using UVs, modifies colors, outputs to screen. **This covers: textures, texture sampling, the full multi-pass pipeline.**

### Step 4: Inspect the WebGL state

Use `renderer.getContext()` to look at what Three.js actually did — confirming the buffers, programs, texture units, and framebuffers that were created. **This covers: understanding the abstraction gap.**

---

## Part 10: Glossary of Connections

If you ever get lost, here's the "what connects to what" reference:

- **Buffer → Attribute:** Buffers hold the data, attribute pointers describe the layout, attributes in the vertex shader receive the values.
- **Vertex Shader → Fragment Shader:** Connected by `varying` variables. Vertex shader writes them, GPU interpolates them, fragment shader reads them.
- **JavaScript → Shader:** Connected by `uniforms`. You set them from JS, the shader reads them.
- **Texture → Shader:** Textures are bound to texture units, shaders reference them via `uniform sampler2D`, and read pixels via `texture2D(sampler, uv)`.
- **Framebuffer → Texture:** A framebuffer has a texture attached. When you render to the framebuffer, the GPU writes into that texture. You can then use that texture as input to another shader.
- **UV coordinates → Texture sampling:** UVs stored in buffers flow through the vertex shader as varyings, arrive at the fragment shader, and are used as coordinates to read from a texture.
- **Three.js → WebGL:** Every Three.js class maps to raw WebGL calls. `BufferGeometry` → buffers + attribute pointers. `ShaderMaterial` → compiled shader program. `WebGLRenderTarget` → framebuffer + texture. `renderer.render()` → bind everything + `gl.drawArrays()`.
