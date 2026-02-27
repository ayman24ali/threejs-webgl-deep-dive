# Deep Dive: Textures & Framebuffer Objects

## PART A: TEXTURES — Everything You Need to Know

### What Is a Texture, Really?

Forget the word "texture" for a moment. Think of it as a **2D grid of data stored on the GPU**. Each cell in the grid holds a color value (RGBA). That's it — it's a 2D array.

```
A 4x4 texture is just:

     col 0      col 1      col 2      col 3
row 0  [R,G,B,A]  [R,G,B,A]  [R,G,B,A]  [R,G,B,A]
row 1  [R,G,B,A]  [R,G,B,A]  [R,G,B,A]  [R,G,B,A]
row 2  [R,G,B,A]  [R,G,B,A]  [R,G,B,A]  [R,G,B,A]
row 3  [R,G,B,A]  [R,G,B,A]  [R,G,B,A]  [R,G,B,A]
```

The reason it's on the GPU (and not just a JavaScript array) is **speed**. The GPU's fragment shader runs for millions of pixels per frame. If it had to reach back to CPU memory for every pixel lookup, it would be impossibly slow. Textures sit in VRAM, right next to the GPU cores, so sampling is nearly instant.

---

### The Two Roles a Texture Can Play

This is important because it directly connects textures to framebuffers later:

**Role 1: Source of data (INPUT)**
An image loaded from a file, used to paint onto a 3D surface. This is the classic "texture mapping" usage. The shader READS from it.

**Role 2: Destination for rendering (OUTPUT)**
An empty texture attached to a framebuffer. The GPU WRITES pixels into it instead of the screen. This is how render-to-texture works.

Same data structure, two completely different purposes. The texture doesn't care — it's just a 2D grid. Whether you fill it from an image file or from a render pass, the GPU treats it identically afterward.

---

### The Lifecycle of a Texture

#### Step 1: Creation

```javascript
// Raw WebGL
const texture = gl.createTexture();
```

This creates a **handle** — a reference to a texture object on the GPU. No memory is allocated yet, no data exists. It's like creating an empty file name with no file.

```javascript
// Three.js equivalent
const texture = new THREE.Texture();
// or
const texture = new THREE.TextureLoader().load('image.jpg');
```

#### Step 2: Binding (Making It Active)

Remember the "bind then act" pattern from the previous doc? It applies here too:

```javascript
gl.bindTexture(gl.TEXTURE_2D, texture);
// NOW every texture-related call refers to THIS texture
```

After binding, the texture is "selected." Any operation you do next (uploading data, setting parameters) affects this specific texture.

#### Step 3: Uploading Data

This is where the actual pixel data goes from CPU → GPU:

```javascript
// From an image element (photo, loaded via <img> or Image())
gl.texImage2D(
  gl.TEXTURE_2D,    // target: we're working with a 2D texture
  0,                 // mipmap level (0 = full resolution, more on this below)
  gl.RGBA,           // internal format: how the GPU stores it
  gl.RGBA,           // source format: how the input data is arranged
  gl.UNSIGNED_BYTE,  // data type: 8 bits per channel (0-255)
  imageElement       // the actual image data (HTMLImageElement, Canvas, Video, etc.)
);
```

You can also create an **empty texture** (for framebuffer rendering):

```javascript
gl.texImage2D(
  gl.TEXTURE_2D,
  0,
  gl.RGBA,
  1024,              // width
  768,               // height
  0,                 // border (always 0)
  gl.RGBA,
  gl.UNSIGNED_BYTE,
  null               // ← NULL! No data. GPU allocates empty memory.
);
```

That `null` is critical for framebuffers — you're telling the GPU "make space for a 1024x768 RGBA image, but don't fill it yet. You'll render into it later."

#### Step 4: Setting Parameters (How the GPU Reads From It)

This is where things get interesting. When the fragment shader calls `texture2D(sampler, uv)`, the UV coordinate might not land exactly on a pixel center. Maybe `uv = (0.333, 0.667)` on a 4x4 texture — that's between pixels. What should the GPU return?

**Filtering** answers this question:

```javascript
// NEAREST: snap to the closest pixel. Pixelated look, like retro games.
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

// LINEAR: blend the 4 nearest pixels. Smooth look, standard for 3D.
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
```

Visual difference:

```
NEAREST (pixelated):          LINEAR (smooth):
┌───┬───┬───┐                 ┌─────────────┐
│   │   │   │                 │  ░░▒▒▓▓██   │
├───┼───┼───┤                 │  ░░▒▒▓▓██   │
│   │███│   │   ──→           │  ▒▒▓▓████   │
├───┼───┼───┤                 │  ▒▒▓▓████   │
│   │   │   │                 │             │
└───┴───┴───┘                 └─────────────┘
Sharp pixel edges              Blurred, smooth transitions
```

- `MAG_FILTER` = what happens when you zoom IN (texture appears larger than its actual pixel resolution, one texel covers multiple screen pixels)
- `MIN_FILTER` = what happens when you zoom OUT (texture appears smaller, multiple texels map to one screen pixel)

**Wrapping** answers another question: what if the UV coordinate is outside the 0-1 range? Like `uv = (1.5, 0.3)`?

```javascript
// REPEAT: the texture tiles infinitely. uv 1.5 becomes 0.5
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

// CLAMP_TO_EDGE: anything beyond 0-1 shows the edge pixel color
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

// MIRRORED_REPEAT: tiles, but every other tile is flipped
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
```

Note: `S` and `T` are the texture coordinate axes (equivalent to U and V, or X and Y). WebGL uses S/T naming by convention.

```
UV = (0.5, 0.5) → center of texture (always works normally)

UV = (1.5, 0.5) with REPEAT:           tiles, reads from (0.5, 0.5)
UV = (1.5, 0.5) with CLAMP_TO_EDGE:    reads from (1.0, 0.5) — the edge
UV = (1.5, 0.5) with MIRRORED_REPEAT:  reads from (0.5, 0.5) but flipped
```

#### Three.js Wrapping Equivalents

```javascript
const texture = new THREE.TextureLoader().load('image.jpg');
texture.minFilter = THREE.LinearFilter;     // gl.LINEAR
texture.magFilter = THREE.NearestFilter;    // gl.NEAREST
texture.wrapS = THREE.RepeatWrapping;       // gl.REPEAT
texture.wrapT = THREE.ClampToEdgeWrapping;  // gl.CLAMP_TO_EDGE
```

---

### Mipmaps — Handling Textures at Different Distances

When a textured object is far from the camera, a 2048x2048 texture might only cover 20 screen pixels. Reading from such a high-res texture for so few pixels causes visual artifacts (shimmering, moiré patterns) because you're skipping over most of the pixels.

**Mipmaps** solve this. They're pre-computed smaller versions of the texture:

```
Level 0: 2048 × 2048  (original)
Level 1: 1024 × 1024  (half)
Level 2:  512 ×  512  (quarter)
Level 3:  256 ×  256
Level 4:  128 ×  128
...down to 1×1
```

The GPU automatically picks the right mipmap level based on how much screen space the texture covers. Up close → level 0. Far away → level 5 or 6.

```javascript
// Generate mipmaps automatically
gl.generateMipmap(gl.TEXTURE_2D);

// Use trilinear filtering (smoothly blends between mipmap levels)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
```

**Important constraint:** Mipmaps require textures with **power-of-two dimensions** (256, 512, 1024, 2048...) in WebGL 1. WebGL 2 relaxes this, but it's still good practice.

**For framebuffer textures (render targets), you typically DON'T use mipmaps** — you're rendering at a specific resolution and reading at that same resolution in the post-processing pass. So you use `LINEAR` filter, not `LINEAR_MIPMAP_LINEAR`.

---

### Texture Units — The Slot System (Expanded)

This is where people often get confused. Let me be very explicit.

The GPU has a fixed number of **texture unit slots** — think of them as numbered shelves:

```
┌──────────────────────────────────────────────┐
│              GPU Texture Slots                │
│                                              │
│  Slot 0: [can hold one texture]              │
│  Slot 1: [can hold one texture]              │
│  Slot 2: [can hold one texture]              │
│  ...                                         │
│  Slot 15: [can hold one texture]             │
│                                              │
│  (typically 16-32 slots available)           │
└──────────────────────────────────────────────┘
```

To use a texture in a shader, you need to:
1. Choose a slot
2. Put the texture in that slot
3. Tell the shader which slot number to look at

```javascript
// Step 1: "I want to work with slot 3"
gl.activeTexture(gl.TEXTURE3);

// Step 2: "Put myTexture into the currently active slot (slot 3)"
gl.bindTexture(gl.TEXTURE_2D, myTexture);

// Step 3: "Tell the shader's sampler uniform to read from slot 3"
const loc = gl.getUniformLocation(program, 'uTexture');
gl.uniform1i(loc, 3);  // the integer 3 = texture unit 3
```

Then in GLSL:

```glsl
uniform sampler2D uTexture; // this is connected to slot 3
```

When the shader calls `texture2D(uTexture, someUV)`, the GPU knows to read from whatever texture is in slot 3.

**Why does this matter?** Because you might need **multiple textures** in one shader. For example, a post-processing shader that combines the scene render with a noise texture:

```javascript
// Put scene texture in slot 0
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
gl.uniform1i(sceneSamplerLoc, 0);

// Put noise texture in slot 1
gl.activeTexture(gl.TEXTURE1);
gl.bindTexture(gl.TEXTURE_2D, noiseTexture);
gl.uniform1i(noiseSamplerLoc, 1);
```

```glsl
uniform sampler2D uScene;  // slot 0
uniform sampler2D uNoise;  // slot 1

void main() {
  vec4 sceneColor = texture2D(uScene, vUv);
  vec4 noiseValue = texture2D(uNoise, vUv);
  gl_FragColor = sceneColor + noiseValue * 0.1;
}
```

### Three.js Handles Texture Units Automatically

When you do this in Three.js:

```javascript
material.uniforms.uScene = { value: sceneTexture };
material.uniforms.uNoise = { value: noiseTexture };
```

Three.js internally:
1. Picks available texture units (let's say 0 and 1)
2. Calls `gl.activeTexture(gl.TEXTURE0)` then `gl.bindTexture(gl.TEXTURE_2D, ...)`
3. Calls `gl.activeTexture(gl.TEXTURE1)` then `gl.bindTexture(gl.TEXTURE_2D, ...)`
4. Sets `gl.uniform1i(uSceneLoc, 0)` and `gl.uniform1i(uNoiseLoc, 1)`

You never see any of this, but it's happening every frame inside `renderer.render()`.

---

### Texture Data Sources — It's Not Just Images

You can create textures from multiple sources:

```javascript
// From an <img> element
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imgElement);

// From a <canvas> element (your 2D drawings become a texture!)
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvasElement);

// From a <video> element (live video as a texture, updated per frame!)
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoElement);

// From raw pixel data
const pixels = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]); // 2 red+green pixels
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

// From NOTHING (empty — for framebuffer targets)
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1024, 768, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
```

The canvas source is particularly interesting given your canvas animation work — you could literally pipe a 2D canvas animation into a 3D texture in real time.

---

### Complete Texture Flow Diagram

```
SOURCE (CPU side)                    GPU side
─────────────────                    ────────────────────────────

Image file ─────┐
Canvas 2D ──────┤                    ┌──────────────────────┐
Video frame ────┤── texImage2D() ──→ │   TEXTURE OBJECT     │
Raw bytes ──────┤                    │   (2D grid of RGBA)  │
null (empty) ───┘                    │                      │
                                     │   Has parameters:    │
  texParameteri() ─────────────────→ │   - MIN_FILTER       │
                                     │   - MAG_FILTER       │
                                     │   - WRAP_S           │
                                     │   - WRAP_T           │
                                     └──────────┬───────────┘
                                                │
                                     bound to a TEXTURE UNIT
                                                │
                                     ┌──────────▼───────────┐
                                     │   TEXTURE UNIT #N    │
                                     └──────────┬───────────┘
                                                │
                                     uniform sampler2D = N
                                                │
                                     ┌──────────▼───────────┐
                                     │   FRAGMENT SHADER    │
                                     │                      │
                                     │   texture2D(         │
                                     │     sampler,         │
                                     │     vec2(u, v)       │
                                     │   )                  │
                                     │   → returns vec4     │
                                     │     (R, G, B, A)     │
                                     └──────────────────────┘
```

---

---

## PART B: FRAMEBUFFER OBJECTS — Rendering Off-Screen

### The Default Framebuffer

Every WebGL context has a **default framebuffer** — this is the canvas itself. When you call `gl.drawArrays()` without doing anything special, pixels go to this default framebuffer, and the browser displays them on screen.

```javascript
// This renders to screen (default framebuffer)
gl.bindFramebuffer(gl.FRAMEBUFFER, null);  // null = default = screen
gl.drawArrays(gl.TRIANGLES, 0, 3);
// → pixels appear on the <canvas> element
```

### Why Would You Render Somewhere Else?

Consider this scenario: you render a beautiful 3D scene, but you want to add a blur effect to the entire image. The problem is that the fragment shader runs per-pixel **independently** — it can't look at neighboring pixels. When it's computing the color of pixel (500, 300), it has no access to pixel (501, 300) or (499, 300). So you can't blur during the initial render.

The solution:
1. First, render the scene into a **texture** (not the screen)
2. Then, render a full-screen rectangle that reads from that texture and applies blur

Step 1 requires rendering to something that's **not the screen**. That's what a framebuffer object (FBO) is.

### Anatomy of a Framebuffer

A framebuffer is a **container with attachment slots**. It doesn't store pixels itself — instead, you attach things to it that store pixels:

```
┌─────────────────────────────────────────────────┐
│              FRAMEBUFFER OBJECT                  │
│                                                  │
│  ┌──────────────────────────────────────┐        │
│  │ COLOR_ATTACHMENT0: → [texture]       │ ← where pixel COLORS go
│  └──────────────────────────────────────┘        │
│                                                  │
│  ┌──────────────────────────────────────┐        │
│  │ DEPTH_ATTACHMENT:  → [renderbuffer]  │ ← where DEPTH values go
│  └──────────────────────────────────────┘        │
│                                                  │
│  ┌──────────────────────────────────────┐        │
│  │ STENCIL_ATTACHMENT: → [renderbuffer] │ ← where STENCIL values go
│  └──────────────────────────────────────┘        │
│                                                  │
└─────────────────────────────────────────────────┘
```

For our post-processing PoC, we care most about **COLOR_ATTACHMENT0** — that's where the rendered image goes. We attach a **texture** to it so we can read the rendered image later.

The **DEPTH_ATTACHMENT** is important too — without it, 3D objects don't have proper depth ordering (things behind other things show through). But we usually attach a **renderbuffer** here, not a texture, because we don't need to read depth values back in our post-processing shader (we just need the GPU to use them during rendering).

### Renderbuffer vs Texture Attachment

Both can hold pixel data, but:

- **Texture attachment**: The GPU writes to it, AND you can sample (read) from it later in a shader. Use this when you need the data in a subsequent pass.
- **Renderbuffer attachment**: The GPU writes to it, but you CANNOT read from it in a shader. It's faster and uses less memory. Use this for depth/stencil when you only need the GPU to use it internally.

```
                            Can GPU       Can shader
                            write to it?  read from it?
Texture attachment          ✓             ✓            ← use for color (post-processing needs to read it)
Renderbuffer attachment     ✓             ✗            ← use for depth (GPU uses it internally, shader doesn't need it)
```

---

### Building a Framebuffer — Step by Step (Raw WebGL)

```javascript
// ═══════════════════════════════════════════════════
// STEP 1: Create the framebuffer (the container)
// ═══════════════════════════════════════════════════
const fbo = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
// Now we're "inside" this framebuffer — everything we attach goes here


// ═══════════════════════════════════════════════════
// STEP 2: Create a texture for the color attachment
// ═══════════════════════════════════════════════════
const colorTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, colorTexture);

// Allocate empty texture at canvas resolution
gl.texImage2D(
  gl.TEXTURE_2D, 0, gl.RGBA,
  canvas.width, canvas.height, 0,
  gl.RGBA, gl.UNSIGNED_BYTE,
  null  // ← EMPTY! The GPU will fill this when rendering
);

// Set filtering (no mipmaps for render targets)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

// Attach it to the framebuffer's color slot
gl.framebufferTexture2D(
  gl.FRAMEBUFFER,        // target
  gl.COLOR_ATTACHMENT0,  // attachment point
  gl.TEXTURE_2D,         // texture target
  colorTexture,          // the texture
  0                      // mipmap level
);


// ═══════════════════════════════════════════════════
// STEP 3: Create a renderbuffer for depth
// ═══════════════════════════════════════════════════
const depthBuffer = gl.createRenderbuffer();
gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);

// Allocate depth storage at the same resolution
gl.renderbufferStorage(
  gl.RENDERBUFFER,
  gl.DEPTH_COMPONENT16,  // 16-bit depth precision
  canvas.width,
  canvas.height
);

// Attach it to the framebuffer's depth slot
gl.framebufferRenderbuffer(
  gl.FRAMEBUFFER,
  gl.DEPTH_ATTACHMENT,
  gl.RENDERBUFFER,
  depthBuffer
);


// ═══════════════════════════════════════════════════
// STEP 4: Verify it's complete
// ═══════════════════════════════════════════════════
const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
if (status !== gl.FRAMEBUFFER_COMPLETE) {
  console.error('Framebuffer is not complete!', status);
}

// Unbind — go back to default framebuffer (screen)
gl.bindFramebuffer(gl.FRAMEBUFFER, null);
```

After this setup, the framebuffer structure looks like:

```
fbo (framebuffer)
├── COLOR_ATTACHMENT0 → colorTexture (empty RGBA 1024×768)
└── DEPTH_ATTACHMENT  → depthBuffer (renderbuffer, depth16)
```

---

### Using the Framebuffer in a Render Loop (Raw WebGL)

```javascript
function renderFrame() {
  // ═══════════════════════════════════════════════
  // PASS 1: Render 3D scene INTO the framebuffer
  // ═══════════════════════════════════════════════
  
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  // ↑ NOW all rendering goes into fbo's attachments:
  //   - colors → colorTexture
  //   - depth → depthBuffer
  
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
  // Set up 3D scene shader
  gl.useProgram(sceneProgram);
  // ... bind buffers, set uniforms, set attributes ...
  gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
  
  // At this point, colorTexture contains the rendered scene as an image!
  // The texture that was empty (null) is now filled with pixel data.


  // ═══════════════════════════════════════════════
  // PASS 2: Render full-screen quad TO THE SCREEN
  //         using colorTexture as input
  // ═══════════════════════════════════════════════
  
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  // ↑ NOW rendering goes to the screen again
  
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT);
  
  // Set up post-processing shader
  gl.useProgram(postProcessProgram);
  
  // Bind the colorTexture (the scene render) as input
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, colorTexture);
  gl.uniform1i(tDiffuseLoc, 0);  // tell shader to sample from unit 0
  
  // ... bind the full-screen quad buffer, set attributes ...
  gl.drawArrays(gl.TRIANGLES, 0, 6); // two triangles = one quad
  
  requestAnimationFrame(renderFrame);
}
```

### The Key Insight: A Texture Changes Roles

Look at what happens to `colorTexture`:

```
PASS 1:
  colorTexture is ATTACHED TO THE FRAMEBUFFER
  It's an OUTPUT — the GPU writes rendered pixels into it
  Role: DESTINATION
  
  ┌──────────┐     ┌──────────────────┐
  │ 3D Scene │ ──→ │  colorTexture    │  (GPU writes TO this)
  │ render   │     │  (framebuffer)   │
  └──────────┘     └──────────────────┘

PASS 2:
  colorTexture is BOUND TO A TEXTURE UNIT
  It's a UNIFORM — the post-processing shader reads from it
  Role: SOURCE
  
  ┌──────────────────┐     ┌──────────┐     ┌────────┐
  │  colorTexture    │ ──→ │ Post-FX  │ ──→ │ Screen │
  │  (sampler2D)     │     │ shader   │     │        │
  └──────────────────┘     └──────────┘     └────────┘
```

**The same texture goes from being a render OUTPUT to being a shader INPUT.** This role-switching is the entire foundation of post-processing, and it's what makes framebuffers so powerful.

---

### The Full-Screen Quad — The Delivery Mechanism

In Pass 2, you need a "surface" to display the texture on. Since the post-processing effect covers the entire screen, you use a **full-screen quad** — two triangles that exactly fill the viewport.

```
The quad covers clip space from (-1,-1) to (1,1):

         (-1, 1) ──────── (1, 1)
            │  ╲            │
            │    ╲   tri2   │
            │      ╲        │
            │  tri1  ╲      │
            │          ╲    │
         (-1,-1) ──────── (1,-1)

Two triangles:
  tri1: (-1,-1), (1,-1), (-1,1)
  tri2: (1,-1), (1,1), (-1,1)
```

The vertex shader for this is trivial — no transformation needed:

```glsl
attribute vec2 position;  // already in clip space (-1 to 1)
varying vec2 vUv;

void main() {
  // Convert from clip space (-1 to 1) to UV space (0 to 1)
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
```

And the fragment shader reads from the framebuffer texture:

```glsl
uniform sampler2D tDiffuse;
varying vec2 vUv;

void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  // Apply any effect here — this runs for every pixel on screen
  gl_FragColor = color;
}
```

---

### Three.js Makes All of This One Object

Everything above — the framebuffer, color texture, depth renderbuffer, status check — is wrapped in `WebGLRenderTarget`:

```javascript
// This single line creates:
// - A framebuffer object
// - A color texture (empty, at this resolution)
// - A depth renderbuffer
// - Attaches everything
// - Sets filtering parameters
const renderTarget = new THREE.WebGLRenderTarget(
  window.innerWidth,
  window.innerHeight,
  {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    depthBuffer: true,           // creates the depth renderbuffer
    stencilBuffer: false
  }
);
```

Using it in the render loop:

```javascript
function animate() {
  // PASS 1: Render scene to framebuffer
  renderer.setRenderTarget(renderTarget);      // ← gl.bindFramebuffer(fbo)
  renderer.clear();                            // ← gl.clear(...)
  renderer.render(scene, camera);              // ← bind everything + gl.drawArrays
  
  // PASS 2: Render post-processing to screen
  renderer.setRenderTarget(null);              // ← gl.bindFramebuffer(null)
  
  // The rendered scene is now in renderTarget.texture
  postFxMaterial.uniforms.tDiffuse.value = renderTarget.texture;
  renderer.render(postFxScene, postFxCamera);  // renders the full-screen quad
  
  requestAnimationFrame(animate);
}
```

**`renderTarget.texture`** is the exact same color texture we created manually with `gl.createTexture()` + `gl.texImage2D(... null)` + `gl.framebufferTexture2D()`. Three.js just did all of it inside the `WebGLRenderTarget` constructor.

---

### Proof: Inspecting What Three.js Actually Created

```javascript
const gl = renderer.getContext();
const properties = renderer.properties.get(renderTarget);

// The actual WebGL framebuffer object
console.log('FBO:', properties.__webglFramebuffer);
// → WebGLFramebuffer {}

// The actual WebGL texture attached to it
console.log('Color texture:', properties.__webglTexture);
// → WebGLTexture {}

// You could even manually bind them:
// gl.bindFramebuffer(gl.FRAMEBUFFER, properties.__webglFramebuffer);
// This would do the same thing as renderer.setRenderTarget(renderTarget)
```

---

### Multi-Pass Chains — Going Further

You can chain multiple framebuffers. Each pass reads from the previous pass's texture and writes to a new one:

```
Pass 1: 3D Scene  ──render──→  FBO-A (colorTextureA)
Pass 2: colorTextureA ──blur──→  FBO-B (colorTextureB)  
Pass 3: colorTextureB ──color grade──→  Screen
```

In Three.js:

```javascript
const fboA = new THREE.WebGLRenderTarget(w, h);
const fboB = new THREE.WebGLRenderTarget(w, h);

// Pass 1: Scene → FBO-A
renderer.setRenderTarget(fboA);
renderer.render(scene, camera);

// Pass 2: FBO-A texture → blur shader → FBO-B
blurMaterial.uniforms.tDiffuse.value = fboA.texture;
renderer.setRenderTarget(fboB);
renderer.render(blurScene, blurCamera);

// Pass 3: FBO-B texture → color grade shader → screen
colorGradeMaterial.uniforms.tDiffuse.value = fboB.texture;
renderer.setRenderTarget(null);
renderer.render(colorGradeScene, colorGradeCamera);
```

Each pass: read from previous texture → process → write to next framebuffer (or screen).

---

### The Complete Framebuffer Flow Diagram

```
                     ┌─────────── RENDER LOOP ───────────┐
                     │                                     │
                     ▼                                     │
              ┌─────────────┐                              │
              │  PASS 1:    │                              │
              │  3D Scene   │                              │
              │             │                              │
              │  Uses:      │                              │
              │  - Buffers  │ (geometry)                   │
              │  - Shaders  │ (vertex + fragment)          │
              │  - Textures │ (material textures)          │
              │  - Uniforms │ (matrices, time)             │
              └──────┬──────┘                              │
                     │                                     │
                     │ gl.bindFramebuffer(fbo)             │
                     │ GPU writes pixels to colorTexture   │
                     ▼                                     │
              ┌─────────────┐                              │
              │ FRAMEBUFFER │                              │
              │             │                              │
              │ ┌─────────┐ │                              │
              │ │ color   │ │ ← colorTexture (now filled)  │
              │ │ texture │ │                              │
              │ └─────────┘ │                              │
              │ ┌─────────┐ │                              │
              │ │ depth   │ │ ← depthBuffer (used by GPU)  │
              │ │ buffer  │ │                              │
              │ └─────────┘ │                              │
              └──────┬──────┘                              │
                     │                                     │
                     │ colorTexture changes role:           │
                     │ OUTPUT → INPUT                      │
                     ▼                                     │
              ┌─────────────┐                              │
              │  PASS 2:    │                              │
              │  Post-FX    │                              │
              │             │                              │
              │  Uses:      │                              │
              │  - Full-screen quad (buffer)               │
              │  - Post-FX shader                          │
              │  - colorTexture as sampler2D INPUT         │
              │  - Uniforms (time, resolution)             │
              └──────┬──────┘                              │
                     │                                     │
                     │ gl.bindFramebuffer(null)             │
                     │ GPU writes pixels to SCREEN          │
                     ▼                                     │
              ┌─────────────┐                              │
              │   SCREEN    │                              │
              │  (canvas)   │     requestAnimationFrame ───┘
              └─────────────┘
```

---

### Common Gotchas

**1. Reading and writing the same texture simultaneously**
You CANNOT bind a texture as a shader input AND have it attached to the active framebuffer at the same time. The GPU can't read from and write to the same texture in one pass. This is why you need separate framebuffers for multi-pass chains.

**2. Resolution mismatch**
The framebuffer texture resolution should match your viewport. If you resize the window, you need to resize the texture:

```javascript
// Three.js
renderTarget.setSize(newWidth, newHeight);

// Raw WebGL: rebind texture, call texImage2D with new dimensions, 
// rebind renderbuffer, call renderbufferStorage with new dimensions
```

**3. Forgetting to switch back to the screen**
If you forget `gl.bindFramebuffer(gl.FRAMEBUFFER, null)` or `renderer.setRenderTarget(null)` before your final pass, nothing appears on screen — the pixels go into a framebuffer nobody displays.

**4. Depth buffer necessity**
Without a depth attachment on your framebuffer, 3D objects won't render with correct depth ordering — back faces might appear in front of front faces. Always attach a depth buffer if your framebuffer receives 3D scene rendering.
