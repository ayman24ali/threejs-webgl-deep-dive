import {TextureLoader} from "three";

// ─────────────────────────────────────────────────────────────────────────────
// MaterialManager — centralises texture loading and (future) caching.
//
// Key concept: THREE.TextureLoader
//   TextureLoader.load() is asynchronous — it returns a Texture object immediately
//   (so it can be assigned to a material right away) and populates the texture
//   data in the background once the image has downloaded.  Three.js automatically
//   re-renders with the texture once it is ready.
//
//   Keeping all texture loads in one place makes it easy to later add:
//     • A texture cache (Map<path, Texture>) to avoid reloading the same image.
//     • Loading-progress callbacks to drive a UI progress bar.
//     • Texture compression / KTX2 loading via KTX2Loader.
// ─────────────────────────────────────────────────────────────────────────────
export class MaterialManager {

    constructor() {
    }

    // Returns a THREE.Texture immediately; the image data streams in asynchronously.
    // The returned texture can be assigned to a uniform before loading completes —
    // Three.js will swap in the real pixel data once the download finishes.
    loadMaterialFromLocalPath(path: string) {
        const textureLoader = new TextureLoader();
        return textureLoader.load(path);
    }

}