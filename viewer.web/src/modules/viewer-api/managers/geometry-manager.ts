import * as THREE from "three";
import {vertexShader} from "../shaders/geometry.vert";
import {fragmentShader} from "../shaders/geometry.frag";
import {MaterialManager} from "./material-manager";

export class GeometryManager {
    materialManager: MaterialManager

    constructor(materialManager: MaterialManager) {
        this.materialManager = materialManager;
    }

    createCube = () => {
        const geometry = new THREE.BoxGeometry();
        // const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const diffuseMap = this.materialManager.loadMaterialFromLocalPath('./textures/diffuse.jpg');
        const material = new THREE.RawShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: {
                uTime: {value: 0},
                uColor: {value: new THREE.Color(1, 0, 0)},
                uTexture: {value: diffuseMap},
                uUseTexture: {value: 1.0}  // toggle flag
            }
        });


        const cube = new THREE.Mesh(geometry, material)

        cube.position.set(0, 2, 0);
        cube.castShadow = true; // Enable shadow casting for the cube
        cube.receiveShadow = true; // Optional: if you want the cube to receive shadows too

        console.log('Position buffer:', geometry.attributes.position);
        console.log('Normal buffer:', geometry.attributes.normal);
        console.log('UV buffer:', geometry.attributes.uv);
        console.log('Vertex count:', geometry.attributes.position.count);
        console.log('Index buffer:', geometry.index);

        return cube
    }

    createPlane = () => {
        const geometry = new THREE.PlaneGeometry(10, 10);
        const material = new THREE.MeshBasicMaterial({color: 0xffff00, side: THREE.DoubleSide});
        const plane = new THREE.Mesh(geometry, material);

        plane.position.set(0, 0, 0);
        plane.rotation.x = -Math.PI / 2;
        plane.receiveShadow = true; // Enable shadow receiving for the ground
        return plane
    }

    createSphere = () => {

    }
}