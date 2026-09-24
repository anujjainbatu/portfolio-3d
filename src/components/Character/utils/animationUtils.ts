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
/** Run-on-the-spot cycle for the Work platform. Carries no root motion. */
const RUN = "Running";
/**
 * The backwards fall. Despite the name this clip is simply a body tipping over:
 * its Body rotation runs 0 to -95.6 degrees about X across the first 0.38s and
 * then holds, with the head, forearms and both legs trailing. It carries no
 * root drift (Body translation spans about 0.01 units), so the scroll-driven
 * positioning stays in charge of where he actually goes.
 */
const FALL = "Death";
const CHAT_ANSWER = "Yes";

/**
 * Scroll code (see GsapScroll.ts) needs to drive the pose from outside the
 * component tree, and setAnimations is called once per load from Scene.tsx —
 * so the handle is published here rather than threaded through React.
 */
export let characterControls: {
  setHangWeight: (w: number) => void;
  setRun: (weight: number, phase: number) => void;
  setFall: (weight: number, phase: number) => void;
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

  function reactToChat(reaction: "open" | "answer") {
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reducedMotion || window.scrollY >= 200) return;
    playOnce(actionFor(reaction === "open" ? INTRO : CHAT_ANSWER));
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
   * Only the four arm bones are touched, so whatever clip is playing keeps
   * driving the rest of the body.
   *
   * While the grip is on, it rebuilds from the REST rotation rather than
   * slerping the bone's current value: Idle animates only Head, Body and the
   * four leg bones, so with nothing overwriting the arms each frame, slerping
   * in place accumulated and left them stuck raised after the weight dropped.
   *
   * Once the weight reaches 0 it resets to rest ONCE and then stops writing, so
   * the mixer can own the arms again. That matters for Running, which does
   * animate all four — holding them at rest every frame would flatten its arm
   * swing into a marionette.
   */
  let gripApplied = false;
  function tick() {
    if (hang.weight <= 0) {
      if (!gripApplied) return;
      for (const { node, rest } of hangBones) node!.quaternion.copy(rest!);
      gripApplied = false;
      return;
    }
    for (const { node, rest, posed } of hangBones) {
      node!.quaternion.copy(rest!).slerp(posed!, hang.weight);
    }
    gripApplied = true;
  }

  function setHangWeight(w: number) {
    hang.weight = Math.min(1, Math.max(0, w));
  }

  /**
   * Run on the spot, driven by scroll rather than by the clock.
   *
   * The action is kept paused and its `time` set directly from `phase`, so the
   * legs only move when the world does. Letting it play on its own timer would
   * foot-slide the moment the scroll stopped, because the platform it is
   * standing on is static while the content slides past.
   *
   * `phase` is signed: scrolling back up runs the cycle backwards, which is what
   * the world is doing too.
   */
  const runAction = actionFor(RUN);
  if (runAction) {
    runAction.play();
    runAction.paused = true;
    runAction.setEffectiveWeight(0);
  }
  /**
   * Run and fall both borrow from Idle, and both share the legs, head and body,
   * so neither can own Idle's weight alone — whichever ran second would undo
   * the other. They each report their weight here instead.
   */
  const blend = { run: 0, fall: 0 };
  function balanceIdle() {
    const taken = Math.min(1, blend.run + blend.fall);
    idleAction?.setEffectiveWeight(1 - taken);
  }

  function setRun(weight: number, phase: number) {
    if (!runAction) return;
    const w = Math.min(1, Math.max(0, weight));
    const duration = runAction.getClip().duration;
    let t = (phase % 1) * duration;
    if (t < 0) t += duration;
    runAction.time = t;
    runAction.setEffectiveWeight(w);
    blend.run = w;
    balanceIdle();
  }

  /**
   * Tip over backwards, driven by scroll like everything else in this sequence.
   *
   * `phase` is CLAMPED rather than wrapped, unlike the run: this is a one-shot,
   * and wrapping it would snap him upright again the instant the fall completed.
   */
  const fallAction = actionFor(FALL);
  if (fallAction) {
    fallAction.play();
    fallAction.paused = true;
    fallAction.setEffectiveWeight(0);
  }
  function setFall(weight: number, phase: number) {
    if (!fallAction) return;
    const w = Math.min(1, Math.max(0, weight));
    const duration = fallAction.getClip().duration;
    fallAction.time = Math.min(1, Math.max(0, phase)) * duration;
    fallAction.setEffectiveWeight(w);
    blend.fall = w;
    balanceIdle();
  }

  function resumeIdle() {
    gsap.killTweensOf(hang);
    hang.weight = 0;
    blend.run = 0;
    blend.fall = 0;
    runAction?.setEffectiveWeight(0);
    fallAction?.setEffectiveWeight(0);
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

  characterControls = { setHangWeight, setRun, setFall, land, resumeIdle };

  return { mixer, startIntro, hover, tick, reactToChat };
};

export default setAnimations;
