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

/**
 * Midnight Titanium + Electric Blue.
 *
 * The asset ships as the stock orange robot and carries exactly three
 * materials and no textures at all — every surface is a flat
 * pbrMetallicRoughness baseColorFactor — so overriding colour is exact rather
 * than a tint fighting a baked map.
 *
 *   Main   68.7% of tris  torso, head, shoulders, arms, legs, hands
 *   Grey   25.2%          torso band, head band, hand plates, feet
 *   Black   6.1%          the eyes, on the head only
 *
 * The palette names four roles, so Grey is split by mesh: the large torso and
 * head bands are panels, the small hand plates and feet are hardware.
 *
 * Hex is written as an sRGB swatch. three 0.168 has ColorManagement on by
 * default, so Color.set() converts it to working space for us; writing
 * baseColorFactor values directly would skip that and come out wrong.
 */
const SKIN = {
  /** Main shell. Matte, so roughness stays high despite the metalness. */
  shell: { color: "#6B7280", metalness: 0.2, roughness: 0.65 },
  /** Secondary panels: the torso and head bands. */
  panel: { color: "#111827", metalness: 0.15, roughness: 0.55 },
  /** Small highlights: hand plates and feet. Polished enough to catch the HDR. */
  highlight: { color: "#CBD5E1", metalness: 0.6, roughness: 0.28 },
  /** Accent lights: the eyes. */
  accent: { color: "#3B82F6", metalness: 0.2, roughness: 0.35 },
} as const;

/**
 * Emissive is deliberately modest. The renderer runs ACESFilmicToneMapping at
 * exposure 1 (Scene.tsx), which compresses and desaturates highlights — push
 * this much past 2 and the eyes stop reading blue and blow out to white dots.
 */
const ACCENT_EMISSIVE_INTENSITY = 0.8;

/**
 * Meshes whose Grey primitive is hardware rather than panelling.
 *
 * Matched by prefix, never by exact name. GLTFLoader's createUniqueName
 * appends _1, _2 … on collision and node names share that same counter, so
 * whether Hand.R's Grey primitive lands on "Hand.R_1" or "Hand.R_2" is not
 * predictable from the asset alone. A prefix test survives either.
 */
const HIGHLIGHT_MESHES = /^(Hand|Foot)/;

type Skin = (typeof SKIN)[keyof typeof SKIN];

const paint = (material: THREE.MeshStandardMaterial, skin: Skin) => {
  material.color.set(skin.color);
  material.metalness = skin.metalness;
  material.roughness = skin.roughness;
};

/**
 * Repaint the three authored materials onto the four palette roles.
 *
 * Runs before renderer.compileAsync: the Grey split creates new material
 * instances, and those would miss precompilation and cost a shader stall on
 * the first rendered frame if this ran after.
 */
const applySkin = (character: THREE.Object3D) => {
  character.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;

    const material = mesh.material;
    if (Array.isArray(material)) return;

    const standard = material as THREE.MeshStandardMaterial;

    switch (standard.name) {
      case "Main":
        paint(standard, SKIN.shell);
        break;

      case "Grey":
        if (HIGHLIGHT_MESHES.test(mesh.name)) {
          // GLTFLoader hands the same material instance to every mesh using
          // Grey, so this has to be cloned before it is touched — painting in
          // place would repaint the torso and head bands along with it.
          const own = standard.clone();
          paint(own, SKIN.highlight);
          mesh.material = own;
        } else {
          paint(standard, SKIN.panel);
        }
        break;

      case "Black":
        paint(standard, SKIN.accent);
        standard.emissive.set(SKIN.accent.color);
        standard.emissiveIntensity = ACCENT_EMISSIVE_INTENSITY;
        break;
    }
  });
};

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

          applySkin(character);

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
