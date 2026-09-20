import * as THREE from "three";
import { GLTF } from "three-stdlib";
import gsap from "gsap";

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

/**
 * The rig has no "hanging from a rope" clip, and none of the fourteen comes
 * close: a forward-kinematics sweep of every frame of every clip found no pose
 * with both hands above the head. Jump comes nearest and still leaves the head
 * higher than the hands and 3.6 units apart — which reads as dangling by the
 * neck rather than gripping.
 *
 * So the grip is posed directly, solved numerically against the LIVE scene
 * graph rather than the glTF file. Two traps made an offline solve wrong:
 * the rig carries duplicate node names (Shoulder.L and Torso each exist as
 * both a bone and a mesh, so a name lookup silently picks the mesh), and
 * GLTFLoader strips dots, so "UpperArm.L" arrives as "UpperArmL".
 *
 * The hands grip out to the robot's left, not overhead. Measured in the
 * character's local frame, the head mesh spans x[-1.35, 1.28], y[2.71, 4.44],
 * while the arm's maximum reach is y=4.31 — so hands raised over the head can
 * never clear the dome and simply vanish inside it. Reaching sideways past
 * x=1.28 puts them clear of the silhouette. Solved hands: left (1.72, 3.71,
 * 0.32), right (1.03, 3.17, 0.29); the right arm cannot cross the body far
 * enough to match the left, which reads naturally as one hand high on the rope
 * and the other lower. Applied on top of each bone's rest rotation.
 */
type Rot = [number, number, number];
const HANG_POSE: { bone: string; rot: Rot }[] = [
  { bone: "UpperArmL", rot: [-3.498, 0.795, -0.101] },
  { bone: "LowerArmL", rot: [-0.175, 0.368, -0.622] },
  { bone: "UpperArmR", rot: [-1.404, 1.627, -1.147] },
  { bone: "LowerArmR", rot: [-0.032, 1.049, -0.367] },
];
/** Played once when the robot reaches the bottom of the rope. */
const LAND = "Standing";

/**
 * Scroll code (see GsapScroll.ts) needs to drive the pose from outside the
 * component tree, and setAnimations is called once per load from Scene.tsx —
 * so the handle is published here rather than threaded through React.
 */
export let characterControls: {
  setHangWeight: (w: number) => void;
  land: () => void;
  resumeIdle: () => void;
} | null = null;

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

  // Captured before anything plays: stopping the mixer leaves bones wherever
  // the last frame put them, so the hang pose needs a clean slate to build on.
  const restPose = new Map<THREE.Object3D, THREE.Quaternion>();
  character.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) {
      restPose.set(obj, obj.quaternion.clone());
    }
  });

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

  /**
   * How much of the rope grip is applied, 0 to 1. The scroll code ramps this
   * up as the character approaches the rope so the arms rise into the grip
   * instead of snapping into it.
   */
  const hang = { weight: 0 };

  // GLTFLoader sanitises node names and strips dots, so the rig's "UpperArm.L"
  // reaches three.js as "UpperArmL". Looking it up by the glTF spelling
  // silently returns undefined and the arms never move.
  //
  // The target is precomputed from the REST rotation, because that is what the
  // pose was solved against — not from whatever Idle happens to be playing.
  const hangBones = HANG_POSE.map(({ bone, rot }) => {
    const node = character.getObjectByName(bone);
    const rest = node && restPose.get(node);
    return {
      node,
      rest: rest ?? null,
      posed: rest
        ? rest
            .clone()
            .multiply(
              new THREE.Quaternion().setFromEuler(
                new THREE.Euler(rot[0], rot[1], rot[2])
              )
            )
        : null,
    };
  }).filter((b) => b.node && b.rest && b.posed);

  /**
   * Blend the arms towards the grip. Must run after every mixer.update(), which
   * Scene.tsx does from the render loop.
   *
   * Only the four arm bones are touched, so Idle keeps driving the rest of the
   * body and the robot stays alive while it hangs.
   *
   * It always rebuilds from the REST rotation rather than slerping the bone's
   * current value. Idle animates only Head, Body and the four leg bones — it
   * never writes the arms — so there is nothing to overwrite them each frame
   * and slerping in place accumulated: the arms crept to the full grip and,
   * once the weight returned to 0, stayed raised with nothing to reset them.
   * Driving from rest is deterministic and costs four quaternion copies.
   */
  function tick() {
    for (const { node, rest, posed } of hangBones) {
      node!.quaternion.copy(rest!).slerp(posed!, hang.weight);
    }
  }

  function setHangWeight(w: number) {
    hang.weight = Math.min(1, Math.max(0, w));
  }

  function resumeIdle() {
    gsap.killTweensOf(hang);
    hang.weight = 0;
    idleAction?.reset().setEffectiveWeight(1).play();
  }

  /** Let go of the rope: land on both feet, then settle back into Idle. */
  function land() {
    // Ease the arms down rather than dropping them in a frame.
    gsap.killTweensOf(hang);
    gsap.to(hang, { weight: 0, duration: 0.45, ease: "power2.out" });
    const landing = actionFor(LAND);
    if (!landing || !idleAction) {
      resumeIdle();
      return;
    }
    landing.reset();
    landing.setLoop(THREE.LoopOnce, 1);
    landing.clampWhenFinished = true;
    landing.play();

    const onFinished = (event: { action: THREE.AnimationAction }) => {
      if (event.action !== landing) return;
      mixer.removeEventListener("finished", onFinished as never);
      idleAction.reset().play();
      landing.crossFadeTo(idleAction, FADE, true);
    };
    mixer.addEventListener("finished", onFinished as never);
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

  characterControls = { setHangWeight, land, resumeIdle };

  return { mixer, startIntro, hover, tick };
};

export default setAnimations;
