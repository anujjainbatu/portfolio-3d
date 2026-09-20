import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { characterControls } from "../Character/utils/animationUtils";

/**
 * Where the gripping hands sit relative to the model origin (its feet), in
 * world units, for the hang pose in animationUtils.ts.
 *
 * The grip is off to the robot's side rather than straight overhead: its head
 * is a wide dome topping out at y=4.58 while the arms only reach about 4.3, so
 * hands raised over the head are swallowed by it and the rope appears to end at
 * the skull. Gripping to the side puts the hands clear of the silhouette, and
 * offsetting the body by GRIP_X lands them on the rope.
 */
const ROBOT_GRIP_X = 1.72;
const ROBOT_GRIP_Y = 3.71;
const ROBOT_GRIP_Z = 0.32;
/**
 * How far the robot is turned while on the rope. tl2 leaves it at y=0.92 (~53
 * degrees), which hides the gripping arm behind the head; this faces it back
 * towards the viewer so the grip reads.
 */
const ROPE_FACE_Y = 0.22;
/** Camera distance while on the rope — this is what makes the robot small. */
const ROPE_CAM_Z = 104;
const ROPE_CAM_Y = 2.3;
/** tl2's end state, restored when the robot leaves the rope upwards. */
const ROPE_EXIT_CAM_Z = 78;
const ROPE_EXIT_CAM_Y = 3.0;
/** Peak pendulum angle in radians (~3.4 degrees). */
const SWAY = 0.06;
const SWAY_SPEED = 0.03;
/**
 * The hand-off window, measured as the career section's top travelling up the
 * screen, in fractions of viewport height.
 *
 * It deliberately FINISHES while the section top is still 0.25vh below the
 * viewport top, rather than at the top itself: the rope is already drawing by
 * then, and a partly-blended character leaves its hand short of the tip, so
 * the rope visibly dangles past the grip. Landing the blend early means the
 * hand is locked on before the rope is prominent.
 */
const APPROACH_FROM_VH = 0.85;
const APPROACH_TO_VH = 0.25;

/**
 * The step off the rope onto the Work section's rule, timed the same way but
 * against that section's top. It finishes well before the section pins so the
 * robot is already planted when the cards start sliding past.
 */
const STAND_FROM_VH = 0.95;
const STAND_TO_VH = 0.35;
/**
 * Where along the rule it stands, as a fraction of viewport width — to the
 * right of the "Systems in production" heading, which reaches about 0.72.
 */
const STAND_X_VW = 0.8;
/**
 * Where the treadmill leaves him. He keeps running to the right, but the belt
 * outruns him, so he slides back across the screen from where he lands to here
 * by the time the pin ends.
 */
const TREADMILL_END_X_VW = 0.5;
/**
 * Pulled further back than the rope. Once the section pins, the rule sits only
 * ~190px below the top of the viewport and the navbar occupies the first ~60,
 * so a rope-sized robot standing on it would run into both.
 */
const STAND_CAM_Z = 165;
/**
 * World pixels per stride.
 *
 * A stride true to his size would be ~70px, but the belt is measured at ~10
 * px/frame typically and 50 at the p90 — 600 to 3000 px/s past a robot only
 * 100px tall. Honouring that would spin the legs roughly nine times a second:
 * a blur, not a run. The world simply moves faster than any character could,
 * so this trades a little foot-skate for a cycle that reads, landing near two
 * or three strides a second at an ordinary scroll speed.
 */
const RUN_STRIDE_PX = 240;
/** World px moved in a frame at which the run is fully weighted. */
const RUN_FULL_SPEED_PX = 8;
/** How fast the run weight chases its target, per frame. */
const RUN_EASE = 0.12;
/**
 * Yaw while running: the model faces +Z at rest and +PI/2 turns it to +X
 * (screen right, the way the content is travelling). Short of a full profile so
 * the face still reads.
 */
const RUN_FACE_Y = 1.15;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Smoothstep: eases both ends so the hand-off has no velocity discontinuity. */
const ease = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Module-scoped so a re-run (resize rebuilds the timelines) cannot leak one. */
let ropeTicker: (() => void) | null = null;
let ropeTrigger: ScrollTrigger | null = null;

/**
 * Hang the character off the growing career timeline.
 *
 * .career-timeline draws downward on scroll and .career-dot already rides its
 * bottom tip, so rather than re-deriving the tip from scroll progress we read
 * the dot's rendered position every frame and place the robot there. That stays
 * in lockstep with the line for free, including through its scrub smoothing.
 *
 * The robot is moved in 3D (character.position) rather than by transforming
 * .character-model, because that element is a position:fixed WebGL canvas whose
 * transform is already owned by tl1/tl2/tl3. character.position is untouched by
 * those timelines, so it is a free channel.
 */
function setRopeDescent(
  character: THREE.Object3D,
  camera: THREE.PerspectiveCamera
) {
  const rope = document.querySelector<HTMLElement>(".career-timeline");
  const dot = document.querySelector<HTMLElement>(".career-dot");
  const model = document.querySelector<HTMLElement>(".character-model");
  if (!rope || !dot || !model) return;

  if (ropeTicker) {
    gsap.ticker.remove(ropeTicker);
    ropeTicker = null;
  }
  if (ropeTrigger) {
    ropeTrigger.kill();
    ropeTrigger = null;
  }

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  let phase = 0;
  const grip = new THREE.Vector3();
  /** Previous world offset of .work-flex, for this frame's run speed. */
  let lastShift: number | null = null;
  /** Smoothed so small scroll jitters do not flicker the run on and off. */
  let runWeight = 0;

  const section = document.querySelector<HTMLElement>(".career-section");
  const workSection = document.querySelector<HTMLElement>(".work-section");
  /**
   * The rule under "Systems in production" is .work-flex::before — a pseudo
   * element, so it cannot be measured directly. It sits at top:0 of .work-flex,
   * so that element's rect top IS the line. While .work-section is pinned the
   * line holds a fixed viewport position, which is what makes standing on it
   * work: the robot stays put and the cards slide past underneath.
   */
  const workFlex = document.querySelector<HTMLElement>(".work-flex");
  /**
   * The body yaw tl2 leaves behind. Captured once, before the approach blend
   * ever writes rotation.y — capture it later and we would hand back the
   * rope-facing angle instead of tl2's.
   */
  let restYaw: number | null = null;

  const follow = () => {
    const canvas = model.getBoundingClientRect();
    if (canvas.width === 0 || canvas.height === 0) return;
    const tip = dot.getBoundingClientRect();
    const line = rope.getBoundingClientRect();

    // Measure the canvas where it actually is. tl1/tl2/tl3 transform this
    // element and still do so during the approach, so assuming it sits centred
    // was what forced the old code to reset the transform (and snap) on entry.
    // Reading the live rect instead composes with whatever they are doing —
    // nothing here moves this element, so there is no feedback.
    const canvasLeft = canvas.left;
    const canvasTop = canvas.top;

    // How far into the hand-off we are: 0 while the career section is still
    // APPROACH_VH down the screen, 1 once its top reaches the viewport top.
    const sectionTop = section
      ? section.getBoundingClientRect().top
      : 0;
    const vh = window.innerHeight;
    const e = ease(
      clamp01(
        (APPROACH_FROM_VH * vh - sectionTop) /
          ((APPROACH_FROM_VH - APPROACH_TO_VH) * vh)
      )
    );

    // How far through stepping off the rope onto the Work rule. Needed before
    // the camera, which shrinks across the same blend.
    const s =
      workSection && workFlex
        ? ease(
            clamp01(
              (STAND_FROM_VH * vh - workSection.getBoundingClientRect().top) /
                ((STAND_FROM_VH - STAND_TO_VH) * vh)
            )
          )
        : 0;

    // Camera first — the projection below reads camera.position.
    camera.position.z = lerp(
      lerp(ROPE_EXIT_CAM_Z, ROPE_CAM_Z, e),
      STAND_CAM_Z,
      s
    );
    camera.position.y = lerp(ROPE_EXIT_CAM_Y, ROPE_CAM_Y, e);

    // Project the rope tip onto the world plane the character occupies (z ~ 0).
    const dist = camera.position.z;
    const visibleH =
      (2 * dist * Math.tan((camera.fov * Math.PI) / 360)) / camera.zoom;
    const visibleW = visibleH * camera.aspect;
    const fx = (line.left + line.width / 2 - canvasLeft) / canvas.width;
    const fy = (tip.top + tip.height / 2 - canvasTop) / canvas.height;
    const worldX = camera.position.x + (fx - 0.5) * visibleW;
    const worldY = camera.position.y + (0.5 - fy) * visibleH;

    // Treadmill. He runs to the right while the pinned Work content slides
    // left; the belt wins, so he loses ground across the screen as it goes.
    //
    // Progress comes from the pin itself. That ScrollTrigger belongs to
    // Work.tsx, and resizeUtils deliberately spares it when it kills and
    // rebuilds everything else — so unlike this module's own trigger it
    // survives a resize.
    const pin = ScrollTrigger.getById("work")?.progress ?? 0;
    const standXvw = lerp(STAND_X_VW, TREADMILL_END_X_VW, pin);

    // The belt only moves during the pin (.work-flex holds x = 0 before and
    // -translateX after), so the run confines itself to it for free.
    const beltTravel = -((gsap.getProperty(".work-flex", "x") as number) || 0);
    const driftPx = (STAND_X_VW - standXvw) * window.innerWidth;
    // What his feet actually cover: the belt's travel less his own slippage.
    // Striding against the raw belt travel instead would turn his legs faster
    // than the ground really passes under him — a skate that undoes the effect.
    const groundTravel = beltTravel - driftPx;

    const speed =
      lastShift === null ? 0 : Math.abs(groundTravel - lastShift);
    lastShift = groundTravel;
    const runTarget = s * ease(clamp01(speed / RUN_FULL_SPEED_PX));
    runWeight += (runTarget - runWeight) * RUN_EASE;
    characterControls?.setRun(runWeight, groundTravel / RUN_STRIDE_PX);

    const theta = reduceMotion ? 0 : Math.sin(phase) * SWAY * e * (1 - s);
    phase += SWAY_SPEED;
    character.rotation.z = theta;
    // Turns to face the way it is running, and back again as it settles.
    character.rotation.y = lerp(
      lerp(restYaw ?? ROPE_FACE_Y, ROPE_FACE_Y, e),
      RUN_FACE_Y,
      runWeight
    );
    // Arms let go of the rope as the feet find the rule.
    characterControls?.setHangWeight(e * (1 - s));

    // Put the HANDS on the rope, not the model origin. The grip is a point in
    // the character's local frame, and the character carries rotation from
    // tl1/tl2/tl3 plus the sway, so the offset has to be rotated with it —
    // subtracting the raw local vector left the hands a third of a unit adrift.
    // Doing it this way also gives the pendulum its pivot at the hands for
    // free, since the sway is part of the same quaternion.
    grip.set(ROBOT_GRIP_X, ROBOT_GRIP_Y, ROBOT_GRIP_Z).applyQuaternion(
      character.quaternion
    );
    // Travel from where "What I Do" leaves it (the origin) onto the rope.
    const ropeX = lerp(0, worldX - grip.x, e);
    const ropeY = lerp(0, worldY - grip.y, e);
    const ropeZ = lerp(0, -grip.z, e);

    if (s <= 0) {
      character.position.set(ropeX, ropeY, ropeZ);
      return;
    }

    // Standing target: feet on the rule. The model's origin sits at its feet,
    // so the projected line height is the position outright.
    const lineTop = workFlex!.getBoundingClientRect().top;
    const sfx = (standXvw * window.innerWidth - canvasLeft) / canvas.width;
    const sfy = (lineTop - canvasTop) / canvas.height;
    const standX = camera.position.x + (sfx - 0.5) * visibleW;
    const standY = camera.position.y + (0.5 - sfy) * visibleH;

    character.position.set(
      lerp(ropeX, standX, s),
      lerp(ropeY, standY, s),
      lerp(ropeZ, 0, s)
    );
  };

  const engage = () => {
    if (restYaw === null) restYaw = character.rotation.y;
    // The canvas transform stays with tl1/tl2/tl3 throughout; opacity is the
    // only thing here that owns, and only so the exit fade can be undone.
    gsap.set(".character-model", { opacity: 1 });
    if (!ropeTicker) {
      ropeTicker = follow;
      gsap.ticker.add(ropeTicker);
    }
  };

  const release = (goingBack: boolean) => {
    if (ropeTicker) {
      gsap.ticker.remove(ropeTicker);
      ropeTicker = null;
    }
    character.rotation.z = 0;

    if (goingBack) {
      character.position.set(0, 0, 0);
      if (restYaw !== null) character.rotation.y = restYaw;
      runWeight = 0;
      lastShift = null;
      characterControls?.setRun(0, 0);
      camera.position.z = ROPE_EXIT_CAM_Z;
      camera.position.y = ROPE_EXIT_CAM_Y;
      characterControls?.resumeIdle();
      gsap.set(".character-model", { opacity: 1 });
      return;
    }

    // Past the Work section. The arms came down as the feet found the rule, so
    // there is nothing to land — just fade out.
    gsap.to(".character-model", {
      opacity: 0,
      duration: 0.8,
      delay: 0.9,
      ease: "power2.out",
      onComplete: () => {
        character.position.set(0, 0, 0);
      },
    });
  };

  ropeTrigger = ScrollTrigger.create({
    trigger: ".career-section",
    // Earlier than the hand-off needs, so the ticker is already running when
    // the blend starts. At e = 0 every blended value equals its pre-career
    // value, so the early start is a visual no-op.
    start: "top 95%",
    // Runs on past the rope: the robot steps onto the Work rule and stands
    // there while that section is pinned, so the journey ends only once the
    // following section arrives.
    endTrigger: ".techstack-new",
    end: "top top",
    invalidateOnRefresh: true,
    onEnter: engage,
    onEnterBack: engage,
    onLeave: () => release(false),
    onLeaveBack: () => release(true),
  });
}

/**
 * Scroll choreography for the hero.
 *
 * This was written around the desk scene that used to live here: the character
 * turned to a monitor, the screen faded up and its glow lit the room. The
 * RobotExpressive model has no desk and no monitor, so those beats are gone.
 * What remains is the page choreography — the section reveals and the camera
 * pull-back — which is what actually drives the layout, plus a neck bend that
 * the new rig happens to support (it has a "Neck" bone of its own).
 */
export function setCharTimeline(
  character: THREE.Object3D<THREE.Object3DEventMap> | null,
  camera: THREE.PerspectiveCamera
) {
  const tl1 = gsap.timeline({
    scrollTrigger: {
      trigger: ".landing-section",
      start: "top top",
      end: "bottom top",
      scrub: true,
      invalidateOnRefresh: true,
    },
  });
  const tl2 = gsap.timeline({
    scrollTrigger: {
      trigger: ".about-section",
      start: "center 55%",
      end: "bottom top",
      scrub: true,
      invalidateOnRefresh: true,
    },
  });
  const tl3 = gsap.timeline({
    scrollTrigger: {
      trigger: ".whatIDO",
      start: "top top",
      end: "bottom top",
      scrub: true,
      invalidateOnRefresh: true,
    },
  });

  const neckBone = character?.getObjectByName("Neck");

  if (window.innerWidth > 1024) {
    if (character) {
      tl1
        .fromTo(character.rotation, { y: 0 }, { y: 0.7, duration: 1 }, 0)
        .to(camera.position, { z: 22 }, 0)
        .fromTo(".character-model", { x: 0 }, { x: "-25%", duration: 1 }, 0)
        .to(".landing-container", { opacity: 0, duration: 0.4 }, 0)
        .to(".landing-container", { y: "40%", duration: 0.8 }, 0)
        .fromTo(".about-me", { y: "-50%" }, { y: "0%" }, 0);

      tl2
        .to(
          camera.position,
          { z: 78, y: 3.0, duration: 6, delay: 2, ease: "power3.inOut" },
          0
        )
        .to(".about-section", { y: "30%", duration: 6 }, 0)
        .to(".about-section", { opacity: 0, delay: 3, duration: 2 }, 0)
        .fromTo(
          ".character-model",
          { pointerEvents: "inherit" },
          { pointerEvents: "none", x: "-12%", delay: 2, duration: 5 },
          0
        )
        .to(character.rotation, { y: 0.92, x: 0.12, delay: 3, duration: 3 }, 0)
        // The "what I do" panel is revealed here and nowhere else — if this
        // tween goes, the section never appears on desktop.
        .fromTo(
          ".what-box-in",
          { display: "none" },
          { display: "flex", duration: 0.1, delay: 6 },
          0
        )
        .fromTo(
          ".character-rim",
          { opacity: 1, scaleX: 1.4 },
          { opacity: 0, scale: 0, y: "-70%", duration: 5, delay: 2 },
          0.3
        );

      if (neckBone) {
        tl2.to(neckBone.rotation, { x: 0.35, delay: 2, duration: 3 }, 0);
      }

      tl3
        .fromTo(
          ".character-model",
          { y: "0%" },
          { y: "-15%", duration: 4, ease: "none", delay: 1 },
          0
        )
        .fromTo(".whatIDO", { y: 0 }, { y: "15%", duration: 2 }, 0)
        .to(character.rotation, { x: -0.04, duration: 2, delay: 1 }, 0);

      setRopeDescent(character, camera);
    }
  } else {
    if (character) {
      const tM2 = gsap.timeline({
        scrollTrigger: {
          trigger: ".what-box-in",
          start: "top 70%",
          end: "bottom top",
        },
      });
      tM2.to(".what-box-in", { display: "flex", duration: 0.1, delay: 0 }, 0);
    }
  }
}

export function setAllTimeline() {
  const careerTimeline = gsap.timeline({
    scrollTrigger: {
      trigger: ".career-section",
      start: "top 50%",
      end: "bottom 30%",
      scrub: 1.5,
      invalidateOnRefresh: true,
    },
  });
  careerTimeline
    .fromTo(
      ".career-timeline",
      { maxHeight: "0%" },
      { maxHeight: "100%", duration: 1, ease: "none" },
      0
    )

    .fromTo(
      ".career-timeline",
      { opacity: 0 },
      { opacity: 1, duration: 0.2 },
      0
    )
    .fromTo(
      ".career-info-box",
      { opacity: 0 },
      { opacity: 1, stagger: 0.1, duration: 0.5 },
      0
    )
    .fromTo(
      ".career-dot",
      { animationIterationCount: "infinite" },
      {
        animationIterationCount: "1",
        delay: 0.3,
        duration: 0.1,
      },
      0
    );

  if (window.innerWidth > 1024) {
    careerTimeline.fromTo(
      ".career-section",
      { y: 0 },
      { y: "20%", duration: 0.5, delay: 0.2 },
      0
    );
  } else {
    careerTimeline.fromTo(
      ".career-section",
      { y: 0 },
      { y: 0, duration: 0.5, delay: 0.2 },
      0
    );
  }
}
