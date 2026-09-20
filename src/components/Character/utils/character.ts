import * as THREE from "three";
import { GLTF, GLTFLoader } from "three-stdlib";

/**
 * Hero model: RobotExpressive, from the three.js examples.
 * CC0 1.0 — Tomás Laulhé, modified by Don McCurdy. See LICENSES.md.
 *
 * The asset is a plain .glb: no Draco, no encryption. It authors at roughly
 * 2 units tall with its feet on the origin, which is why the scale and camera
 * here are small numbers compared to the desk scene this replaced.
 */
const MODEL_URL = "/models/RobotExpressive.glb";

/**
 * The model already authors at a usable size: 4.60 units tall (feet on the
 * origin, head at y=4.58) and 6.62 wide across the rest-pose arm span. The
 * camera in Scene.tsx is fitted to that, so no scaling is needed here.
 */
const MODEL_SCALE = 1;

const setCharacter = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera
) => {
  const loader = new GLTFLoader();

  const loadCharacter = () => {
    return new Promise<GLTF | null>((resolve, reject) => {
      loader.load(
        MODEL_URL,
        async (gltf) => {
          const character = gltf.scene;

          character.scale.setScalar(MODEL_SCALE);

          await renderer.compileAsync(character, camera, scene);

          character.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            mesh.frustumCulled = true;
            if (mesh.material && !Array.isArray(mesh.material)) {
              (mesh.material as THREE.ShaderMaterial).precision = "mediump";
            }
          });

          // Timeline setup deliberately does NOT happen here. This callback
          // runs for every load, including one StrictMode discards, which
          // would bind the scroll timelines to a character that never reaches
          // the scene. Scene.tsx owns that, once, for the live character.
          resolve(gltf);
        },
        undefined,
        (error) => {
          console.error("Error loading GLTF model:", error);
          reject(error);
        }
      );
    });
  };

  return { loadCharacter };
};

export default setCharacter;
