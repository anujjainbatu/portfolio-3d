import * as THREE from "three";
import { GLTF } from "three-stdlib";

/**
 * Animation for the RobotExpressive hero.
 *
 * The model ships 14 named clips. We use three of them:
 *   Idle      — the resting loop, running the whole time
 *   Wave      — played once on load, then crossfaded back to Idle
 *   ThumbsUp  — played once when the cursor enters the face area
 *
 * Facial expressions are morph targets ("Angry", "Surprised", "Sad") on the
 * head mesh. The three.js example looks that mesh up as "Head_4", but that
 * name is just the glTF mesh name plus a primitive index, so it moves whenever
 * the asset is re-exported — today the head has three primitives, not five.
 * We find it by looking for the morph target dictionary instead.
 */
const IDLE = "Idle";
const INTRO = "Wave";
const HOVER = "ThumbsUp";

/** How long a one-shot takes to blend in, and to hand back to Idle. */
const FADE = 0.35;

const findFaceMesh = (root: THREE.Object3D): THREE.Mesh | null => {
  let face: THREE.Mesh | null = null;
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (face || !mesh.isMesh) return;
    if (mesh.morphTargetDictionary && "Surprised" in mesh.morphTargetDictionary) {
      face = mesh;
    }
  });
  return face;
};

const setAnimations = (gltf: GLTF) => {
  const character = gltf.scene;
  const mixer = new THREE.AnimationMixer(character);

  const actionFor = (name: string): THREE.AnimationAction | null => {
    const clip = THREE.AnimationClip.findByName(gltf.animations, name);
    if (!clip) {
      console.error(`Animation "${name}" not found`);
      return null;
    }
    return mixer.clipAction(clip);
  };

  const idleAction = actionFor(IDLE);
  idleAction?.play();

  /** Play a clip once, then hand the mixer back to Idle. */
  const playOnce = (action: THREE.AnimationAction | null) => {
    if (!action || !idleAction) return;
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    idleAction.crossFadeTo(action, FADE, true);
    action.play();

    const onFinished = (event: { action: THREE.AnimationAction }) => {
      if (event.action !== action) return;
      mixer.removeEventListener("finished", onFinished as never);
      idleAction.reset().play();
      action.crossFadeTo(idleAction, FADE, true);
    };
    mixer.addEventListener("finished", onFinished as never);
  };

  function startIntro() {
    playOnce(actionFor(INTRO));
  }

  function hover(_gltf: GLTF, hoverDiv: HTMLDivElement) {
    if (!hoverDiv) return;
    const face = findFaceMesh(character);
    const surprised =
      face?.morphTargetDictionary?.["Surprised"] ?? null;

    let isHovering = false;

    const setExpression = (weight: number) => {
      if (face?.morphTargetInfluences && surprised !== null) {
        face.morphTargetInfluences[surprised] = weight;
      }
    };

    const onHoverFace = () => {
      if (isHovering) return;
      isHovering = true;
      setExpression(1);
      playOnce(actionFor(HOVER));
    };

    const onLeaveFace = () => {
      isHovering = false;
      setExpression(0);
    };

    hoverDiv.addEventListener("mouseenter", onHoverFace);
    hoverDiv.addEventListener("mouseleave", onLeaveFace);
    return () => {
      hoverDiv.removeEventListener("mouseenter", onHoverFace);
      hoverDiv.removeEventListener("mouseleave", onLeaveFace);
    };
  }

  return { mixer, startIntro, hover };
};

export default setAnimations;
