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
/**
 * Pointing at the chat rail from the footer peek.
 *
 * Solved the same way and with the same caveats as HANG_POSE above, against the
 * live scene: a hill climb over the two bones' Euler offsets, minimising the
 * screen-space angle between the forearm (elbow to Index2R) and the start of the
 * text in .portfolio-chat__launcher, while holding the arm at full extension and
 * clear of the head and torso silhouettes. Converged to 0.5 degrees of error.
 *
 * Aimed at the start of the text rather than its middle deliberately. The middle
 * sits almost directly below him, and an arm pointing near-vertically runs down
 * his own silhouette and reads as hanging at his side; the start of the text
 * puts the line at roughly 45 degrees, where it separates from the body.
 *
 * Only the RIGHT arm is posed. He faces the camera square through the peek and
 * leans out of the edge rather than turning (PEEK_LEAN_Z in GsapScroll.ts), which
 * leaves the target down and to his right — the side this arm is already on. The
 * left would have to cross his chest to reach it, so it stays where Idle leaves
 * it, at his side.
 *
 * The solve is constrained to keep the elbow near the shoulder-to-hand line.
 * Without that it folded: a bent arm spans the same screen distance as a straight
 * one and scores identically on reach, but reads as an arm tucked in rather than
 * a point.
 *
 * Two poses, not one: `rot` is the arm drawn back to the shoulder and `rot2` is
 * it fully extended, both solved to aim at the same point. GsapScroll.ts
 * oscillates between them, so the fingertip travels about 47px straight down the
 * line it is pointing along and back — a jab, which is what pointing something
 * out actually looks like.
 *
 * It has to be two solved poses. Modulating a single pose's weight is cheaper
 * and was tried first, but the arc from rest to "pointing" runs ACROSS the aim
 * line, not along it — the hand swung at about 75 degrees to where it pointed
 * and read as a wave. Solving the near end for a short reach and the far end for
 * a long one, both aimed at the target, puts the travel on the line itself.
 *
 * The near end is additionally solved to stay close to the far end in JOINT
 * space, not just on screen. Two poses that look adjacent in the render can sit
 * in quite different corners of configuration space, and the slerp between those
 * bows the hand out sideways instead of drawing it straight back. Its aim is
 * looser as a result (about 13 degrees), which does not matter: the arm is tucked
 * in at that end and it is the extended end that has to point true.
 *
 * Both ends are solved against PEEK_CAM_Z, so moving the camera changes the
 * arm's length on screen and both poses need re-solving together.
 */
const POINT_POSE: { bone: string; rot: Rot; rot2: Rot }[] = [
  { bone: "UpperArmR", rot: [1.101, 0.143, 0.894], rot2: [1.16, 0.155, 0.07] },
  { bone: "LowerArmR", rot: [0.504, 1.693, -0.631], rot2: [-0.084, 1.2, -0.631] },
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
  setPointWeight: (w: number, mix?: number) => void;
  setHeadRoll: (radians: number) => void;
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
  /**
   * The same, for the footer peek's pointing arm, plus `mix`: where the hand
   * sits between the drawn-back and fully extended ends of POINT_POSE. The
   * scroll code oscillates it to jab.
   */
  const point = { weight: 0, mix: 0 };

  type PosedBone = {
    node: THREE.Object3D;
    rest: THREE.Quaternion;
    posed: THREE.Quaternion;
    /** Optional far end of a two-pose gesture; see the point's jab. */
    posed2: THREE.Quaternion | null;
  };

  // GLTFLoader sanitises node names and strips dots, so the rig's "UpperArm.L"
  // reaches three.js as "UpperArmL". Looking it up by the glTF spelling
  // silently returns undefined and the arms never move.
  //
  // The rig also carries duplicate names — Shoulder.L, Torso and Head each exist
  // as both a bone and a mesh — so getObjectByName can hand back a mesh. Nothing
  // guards that explicitly because restPose holds bones only, so a mesh fails
  // the lookup below and is filtered out.
  //
  // The target is precomputed from the REST rotation, because that is what the
  // poses were solved against — not from whatever Idle happens to be playing.
  const offset = (rest: THREE.Quaternion, rot: Rot) =>
    rest
      .clone()
      .multiply(
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(rot[0], rot[1], rot[2])
        )
      );

  const resolvePose = (
    pose: { bone: string; rot: Rot; rot2?: Rot }[]
  ): PosedBone[] =>
    pose
      .map(({ bone, rot, rot2 }) => {
        const node = character.getObjectByName(bone);
        const rest = node && restPose.get(node);
        return {
          node,
          rest: rest ?? null,
          posed: rest ? offset(rest, rot) : null,
          posed2: rest && rot2 ? offset(rest, rot2) : null,
        };
      })
      .filter((b): b is PosedBone => !!(b.node && b.rest && b.posed));

  /**
   * Every pose this module lays over the mixer, each with its own live weight.
   *
   * The grip and the point belong to different stretches of the page and never
   * run together, so they are applied in order rather than blended: if they ever
   * did overlap, the later entry would simply win on any bone they share.
   */
  const poses: {
    bones: PosedBone[];
    state: { weight: number; mix?: number };
  }[] = [
    { bones: resolvePose(HANG_POSE), state: hang },
    { bones: resolvePose(POINT_POSE), state: point },
  ];

  /**
   * Blend the arms towards whichever pose is active. Must run after every
   * mixer.update(), which Scene.tsx does from the render loop.
   *
   * Only arm bones are touched, so whatever clip is playing keeps driving the
   * rest of the body.
   *
   * While a pose is on, it rebuilds from the REST rotation rather than slerping
   * the bone's current value: Idle animates only Head, Body and the four leg
   * bones, so with nothing overwriting the arms each frame, slerping in place
   * accumulated and left them stuck raised after the weight dropped.
   *
   * A bone written last frame but not this one is reset to rest ONCE and then
   * left alone, so the mixer can own it again. That matters for Running, which
   * does animate all four arm bones — holding them at rest every frame would
   * flatten its arm swing into a marionette. It is also what stops the grip
   * leaving an arm raised when the point takes over, and vice versa.
   */
  /**
   * Roll applied to the head after the mixer, to keep it level while the body
   * is tipped over.
   *
   * It has to live here rather than with the scroll code because Idle animates
   * the Head bone: anything written before mixer.update is simply overwritten.
   * Only .z is touched, which is the one channel handleHeadRotation (mouseUtils)
   * leaves alone — it writes .x and .y for the cursor-follow.
   */
  const headRoll = { value: 0 };
  let headBone: THREE.Object3D | null = null;
  character.traverse((obj) => {
    // "Head" is both a bone and a skinned mesh on this rig, so ask for the bone.
    if (!headBone && (obj as THREE.Bone).isBone && obj.name === "Head") {
      headBone = obj;
    }
  });
  let headRolled = false;

  function setHeadRoll(radians: number) {
    headRoll.value = radians;
  }

  let written: PosedBone[] = [];
  function tick() {
    if (headBone && (headRoll.value !== 0 || headRolled)) {
      (headBone as THREE.Object3D).rotation.z = headRoll.value;
      headRolled = headRoll.value !== 0;
    }
    const active = poses.filter((p) => p.state.weight > 0);

    if (active.length === 0) {
      if (written.length === 0) return;
      for (const { node, rest } of written) node.quaternion.copy(rest);
      written = [];
      return;
    }

    const now: PosedBone[] = [];
    for (const { bones, state } of active) {
      for (const bone of bones) {
        bone.node.quaternion.copy(bone.rest).slerp(bone.posed, state.weight);
        // Then on towards the far pose. Scaled by weight as well, so a gesture
        // still easing in travels the same fraction of the way as the rest of
        // the arm rather than snapping to its far end.
        if (bone.posed2 && state.mix) {
          bone.node.quaternion.slerp(bone.posed2, state.mix * state.weight);
        }
        now.push(bone);
      }
    }
    for (const prev of written) {
      if (!now.some((bone) => bone.node === prev.node)) {
        prev.node.quaternion.copy(prev.rest);
      }
    }
    written = now;
  }

  function setHangWeight(w: number) {
    hang.weight = Math.min(1, Math.max(0, w));
  }

  function setPointWeight(w: number, mix = 0) {
    point.weight = Math.min(1, Math.max(0, w));
    point.mix = Math.min(1, Math.max(0, mix));
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
    point.weight = 0;
    point.mix = 0;
    headRoll.value = 0;
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

  characterControls = {
    setHangWeight,
    setPointWeight,
    setHeadRoll,
    setRun,
    setFall,
    land,
    resumeIdle,
  };

  return { mixer, startIntro, hover, tick, reactToChat };
};

export default setAnimations;
