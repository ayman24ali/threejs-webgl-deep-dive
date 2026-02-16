import {TextureLoader} from "three";

export class MaterialManager {

    constructor() {
    }

    loadMaterialFromLocalPath(path: string) {
        const textureLoader = new TextureLoader();
        return textureLoader.load(path);
    }

}