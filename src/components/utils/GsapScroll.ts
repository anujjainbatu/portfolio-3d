import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { characterControls } from "../Character/utils/animationUtils";
import { lenis } from "../Navbar";

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
/**
 * The drift finishes before the pin does, so he is standing at centre and still
 * running when the platform's tip arrives, rather than still sliding into place.
 */
const DRIFT_END = 0.8;
/**
 * Where the page takes itself once the platform is gone: the tech section's top
 * this far below the viewport top, which frames the heading and the pyramid.
 * The fall is measured against this same point, so he lands in the hole exactly
 * as the page arrives — scrolled there by hand or carried by the auto-scroll.
 */
const FALL_DEST_TOP_PX = 0;
/** Seconds the auto-scroll takes. The fall is scroll-driven, so this is also
 *  how long the drop takes to play out. */
const AUTOSCROLL_DURATION = 4.2;
/**
 * Lenis defaults to an exponential ease-out, which covers most of the distance
 * in the first half second — the fall is scroll-driven, so that flashed the
 * whole drop past before you could read it. This spreads the travel instead and
 * lets the fall's own acceleration do the work.
 */
const AUTOSCROLL_EASE = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
/**
 * Scroll px past the lip before the page takes over.
 *
 * Small, because it has to win the race with the reader's own momentum: Lenis
 * accelerates a flick to 400px a frame-ish, which covers the whole 1300px fall
 * in two or three wheel ticks. Waiting even 40px meant they had usually already
 * shot past the destination, the guard below suppressed the takeover, and the
 * drop flashed by unseen.
 */
const AUTOSCROLL_TRIGGER_PX = 8;
/**
 * The hole is the vortex in the tech section's background video, so its screen
 * position is derived from the video rather than guessed at as a fraction of
 * the section. Intrinsic size and the mouth's position were measured off the
 * file itself; the object-fit: cover maths below then holds at any viewport,
 * which a section-relative fraction would not (the crop changes with aspect).
 *
 * Note this scales with the SECTION, not the viewport. The section is taller
 * than its min-height: 100vh — 1060px against a 900px viewport, because the tag
 * sphere's 460px stage and the heading above it outgrow the screen — so the
 * video is cover-cropped to 1060 tall and every v below is a fraction of that.
 * Growing the section pushes the mouth down in proportion, which is why the
 * error in HOLE_V got worse when that section was rebuilt.
 */
const HOLE_VIDEO_W = 2560;
const HOLE_VIDEO_H = 1192;
/**
 * The mouth of the gravity well, measured off the video by profiling the bright
 * region's width per row across twelve frames. Every frame agrees within 0.01,
 * and the horizontal centre is steadier still: u = 0.494..0.500 throughout.
 *
 * v was 0.745 and that was wrong — it put him in open dark space below the whole
 * structure. The trap is that the well fades rather than ending on an edge, so
 * "where does it stop" depends almost entirely on the brightness threshold you
 * profile at. Sweeping that threshold across all twelve frames:
 *
 *   threshold   0.35   0.45   0.55   0.65   0.75
 *   collapses   .748   .723   .706   .689   .672
 *
 * A loose threshold chases the dim glow trailing underneath and lands near
 * 0.745; that is the tail, not the mouth. At a strict threshold the funnel
 * narrows steadily — width 53, 35, 26, 23 at v = 0.630, 0.655, 0.664, 0.672 —
 * and collapses to 5 by v = 0.681, which is its tip. Rendering a frame with
 * candidate rows drawn on it agrees: the grid converges and terminates around
 * v = 0.64..0.66.
 *
 * So this sits between where the grid visually ends and where the core
 * collapses, putting him in the neck with the funnel still open around him.
 */
const HOLE_U = 0.498;
const HOLE_V = 0.655;
/**
 * He reaches the pit only at the very end of the fall.
 *
 * The pit is about 694px down the tech section, so for most of the descent it
 * is still below the fold and rising. Arriving early meant arriving at an
 * off-screen position and then shrinking out of sight down there; staying with
 * it until the end keeps him on screen all the way in.
 */
const FALL_ARRIVES = 0.95;
/**
 * Fraction of the fall after which he starts shrinking into the pit — after he
 * has essentially reached it, not before. Shrinking from 0.8 had him fading out
 * some 150px short, because the descent itself only closes the last of the gap
 * right at the end.
 */
const SINK_FROM = 0.9;
/**
 * How far below the pit's mouth he carries on descending, in screen px.
 *
 * He has to keep sinking as he shrinks or it reads as evaporating in mid-air
 * rather than being swallowed — but the funnel's tip is only ~28px below the
 * mouth (HOLE_V above), so the old 55 carried him straight back out of the
 * bottom of it. That was the same complaint this fix is for, in miniature.
 * At 30 he comes to rest on the tip: swallowed, with nothing left showing.
 */
const SINK_DEPTH_PX = 30;
/** Fraction of the fall over which he eases out of standing and into the tip. */
const FALL_POSE_BLEND = 0.12;
/**
 * Yaw while falling. The fall clip tips him about his own X axis, and he spends
 * the descent facing the camera — so left as is he would tip AWAY from the
 * viewer, foreshortened, reading as shrinking rather than going over. Turning
 * him side-on lines that axis up with the camera's Z so the tip swings across
 * the screen. The sign is what puts his back to the ground rather than the sky.
 */
const FALL_FACE_Y = -Math.PI / 2;

/**
 * The footer peek. He leans back in from behind the right edge of the viewport,
 * just above the fixed chat rail, and points down at LET'S TALK.
 *
 * Pulled in from the STAND_CAM_Z the journey ends on. At 165 he stands about
 * 110px tall and his whole arm measures 54px, which made the jab too small a
 * movement to register as pointing at anything. At 130 he is about 140px with a
 * 69px arm, so the gesture has room to travel. follow() writes the camera every
 * frame once it takes back over, so nothing needs handing back.
 */
const PEEK_CAM_Z = 130;
const PEEK_CAM_Y = ROPE_CAM_Y;
/**
 * Square to the camera. He is leaning out of the edge rather than standing at
 * it, so the lean does the work a yaw would otherwise do — and leaving the yaw
 * at zero puts both arms flat in the screen plane, which is where the pointing
 * arm reads at its full length.
 */
const PEEK_FACE_Y = 0;
/**
 * How far he tips out of the edge, about his feet. This is the whole silhouette
 * of the beat: a figure canted out from behind the frame, the way someone leans
 * around a doorway to point at something. A positive z rotation swings his head
 * towards screen-left, which is out into the page.
 */
const PEEK_LEAN_Z = Math.PI / 4;
/**
 * How far his MIDDLE sits inside the canvas's right edge.
 *
 * His middle, not his feet, because the lean rotates about the model origin and
 * the origin is between his feet — anchoring there swings the whole body out of
 * frame as the angle grows, which had him lying diagonally across the corner
 * with his legs off screen. Anchored at the waist the framing holds at any lean,
 * and at 45 degrees his feet fall outside the edge on their own, so the pivot is
 * hidden and what shows is the top of him canted out.
 */
const PEEK_INSET_PX = 62;
/** Half his height in world units — the model is 4.6 tall, feet on the origin. */
const PEEK_HALF_H = 2.3;
/**
 * How far above the rail's top his middle sits.
 *
 * Kept short. His arm measures about 54px on screen at this camera whatever the
 * pose does — that is simply its length — so every pixel of gap between his hand
 * and the text is empty space the eye has to cross before the point lands.
 */
const PEEK_GAP_PX = 76;
/** How far further right he waits before leaning in. */
const PEEK_ENTER_PX = 150;
/**
 * Jabs per second while he holds the point.
 *
 * The gesture is the hand travelling roughly 22px back and forth ALONG the line
 * it is pointing down — the two ends of POINT_POSE — rather than the arm rising
 * and falling across it, which is what modulating a single pose's weight gave
 * and which read as a wave.
 */
const PEEK_JAB_HZ = 1.15;
/**
 * How much of the lean the head cancels out.
 *
 * Not for realism — for legibility. His head is a wide flat dome with two eyes
 * side by side, so tipping it 45 degrees stacks the eyes diagonally and it stops
 * reading as a face looking at you; the whole figure then reads as lying down
 * rather than leaning out. Holding the head close to level while the body tips
 * is the same thing a person does leaning around a doorway, and it is what makes
 * the angle read as a lean. Short of 1 so the head is not eerily rigid.
 */
const PEEK_HEAD_LEVEL = 0.85;
/** Lean-in and withdraw times, in seconds. */
const PEEK_IN = 0.75;
const PEEK_OUT = 0.4;
/**
 * Where his feet go when the rail is not in the DOM at all. Only reached while
 * he is already sliding out, so it just needs to be somewhere sane.
 */
const PEEK_RAIL_FALLBACK_PX = 120;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Smoothstep: eases both ends so the hand-off has no velocity discontinuity. */
const ease = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Module-scoped so a re-run (resize rebuilds the timelines) cannot leak one. */
let ropeTicker: (() => void) | null = null;
let ropeTrigger: ScrollTrigger | null = null;
let peekTicker: ((time: number) => void) | null = null;
let peekTrigger: ScrollTrigger | null = null;
/**
 * The footer peek has the character.
 *
 * The two ScrollTriggers overlap: the rope's runs to .techstack-new "bottom
 * top", and the peek starts when .contact-section reaches 80% of the viewport —
 * which is before the tech section has finished leaving. Without this, follow()
 * is still writing position, rotation and the canvas transform every frame and
 * fights the peek for them. By that point follow() has nothing left to say
 * anyway: the fall is complete and he is sunk and faded.
 */
let peekActive = false;

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
  /** So the page only takes over once per departure from the platform. */
  let autoScrolled = false;

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
  const techSection = document.querySelector<HTMLElement>(".techstack-new");
  /**
   * The body yaw tl2 leaves behind. Captured once, before the approach blend
   * ever writes rotation.y — capture it later and we would hand back the
   * rope-facing angle instead of tl2's.
   */
  let restYaw: number | null = null;

  const follow = () => {
    // The footer peek owns him from here on; see peekActive.
    if (peekActive) return;
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
    const workTrigger = ScrollTrigger.getById("work");
    const pin = workTrigger?.progress ?? 0;
    const standXvw = lerp(
      STAND_X_VW,
      TREADMILL_END_X_VW,
      clamp01(pin / DRIFT_END)
    );

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
    const flexRect = workFlex!.getBoundingClientRect();
    const sfx = (standXvw * window.innerWidth - canvasLeft) / canvas.width;
    const sfy = (flexRect.top - canvasTop) / canvas.height;
    const standX = camera.position.x + (sfx - 0.5) * visibleW;
    const standY = camera.position.y + (0.5 - sfy) * visibleH;

    const onPlatformX = lerp(ropeX, standX, s);
    const onPlatformY = lerp(ropeY, standY, s);
    const onPlatformZ = lerp(ropeZ, 0, s);

    // --- Losing the platform ------------------------------------------------
    // The rule ends with the last card now, so its tip eventually reaches him.
    // The belt runs 1:1 with scroll from the pin's start, which lets the moment
    // it passes be expressed as a scroll position rather than tracked as state:
    // stateless, so scrubbing backwards puts him back on solid ground.
    const charScreenX = standXvw * window.innerWidth;
    let fall = 0;
    if (workTrigger && techSection) {
      const lineW =
        parseFloat(
          getComputedStyle(workFlex!).getPropertyValue("--work-line-w")
        ) || 0;
      // Where the tip sits with the belt at rest, and so the scroll at which it
      // draws level with him.
      const tipAtRest = flexRect.left + lineW + beltTravel;
      const lipPassScroll = workTrigger.start + (tipAtRest - charScreenX);

      // The fall spans from losing the platform to the page being parked on the
      // tech section. Measuring it against that destination rather than a fixed
      // number of pixels means he is fully in the hole exactly when the page
      // gets there, however the scrolling happened.
      const destScroll =
        techSection.getBoundingClientRect().top +
        window.scrollY -
        FALL_DEST_TOP_PX;
      const span = Math.max(1, destScroll - lipPassScroll);
      fall = clamp01((window.scrollY - lipPassScroll) / span);

      // Once the ground is gone the page carries itself to the tech section, so
      // the fall finishes whether or not anyone keeps scrolling. Lenis lets the
      // user take back over mid-flight; the fall stays scroll-driven either way.
      const pastLip = window.scrollY - lipPassScroll;
      // Never drag anyone backwards: someone who flicks straight past the
      // destination has already seen it, and yanking them back up would be
      // worse than not helping at all.
      if (
        pastLip > AUTOSCROLL_TRIGGER_PX &&
        window.scrollY < destScroll &&
        !autoScrolled
      ) {
        autoScrolled = true;
        lenis?.scrollTo(destScroll, {
          duration: AUTOSCROLL_DURATION,
          easing: AUTOSCROLL_EASE,
          // Hold the scroll for the duration. Without this the reader's own
          // momentum cancels the takeover immediately and the fall is over
          // before it is visible — "whether they scroll or not" needs the page
          // to actually keep the wheel for these few seconds.
          lock: true,
          force: true,
        });
      } else if (pastLip <= 0) {
        // Back on the platform — re-arm for the next time through.
        autoScrolled = false;
      }
    }

    if (fall <= 0) {
      characterControls?.setFall(0, 0);
      character.scale.setScalar(1);
      character.position.set(onPlatformX, onPlatformY, onPlatformZ);
      return;
    }

    // Nothing to run on any more — he tips over backwards instead.
    const poseIn = clamp01(fall / FALL_POSE_BLEND);
    characterControls?.setRun(0, 0);
    characterControls?.setFall(poseIn, fall);
    // Turn side-on as he goes over, so the tip reads across the screen.
    character.rotation.y = lerp(ROPE_FACE_Y, FALL_FACE_Y, ease(poseIn));

    // tl3 parks the canvas 15% up the screen, so it covers only y -135..765 —
    // and the pit is below that, which was clipping his body off at the canvas
    // edge and leaving just a sliver of his head. Cover the viewport while he
    // falls. This does not move him: the projection above reads the canvas's
    // live rect, so shifting the canvas is compensated in the same frame.
    //
    // Nothing hands this back, for the same reason setContactPeek does not —
    // see the note there. tl3 owns y and rewrites it as soon as its own range
    // is scrubbed again; until then the offset is invisible, and covering more
    // of the viewport than tl3 asked for can only clip less.
    gsap.set(".character-model", { y: 0 });

    // Where the video actually sits after object-fit: cover crops it.
    const techRect = techSection!.getBoundingClientRect();
    const vScale = Math.max(
      techRect.width / HOLE_VIDEO_W,
      techRect.height / HOLE_VIDEO_H
    );
    const vW = HOLE_VIDEO_W * vScale;
    const vH = HOLE_VIDEO_H * vScale;
    const holeScreenX = techRect.left + (techRect.width - vW) / 2 + HOLE_U * vW;
    const holeScreenY = techRect.top + (techRect.height - vH) / 2 + HOLE_V * vH;

    const hfx = (holeScreenX - canvasLeft) / canvas.width;
    const hfy = (holeScreenY - canvasTop) / canvas.height;
    const holeX = camera.position.x + (hfx - 0.5) * visibleW;
    const holeY = camera.position.y + (0.5 - hfy) * visibleH;
    const sinkDepth = (SINK_DEPTH_PX / canvas.height) * visibleH;

    // Squared, not smoothed: a fall should accelerate. It completes early so he
    // arrives at the hole and then sinks, rather than doing both at once.
    const arrive = clamp01(fall / FALL_ARRIVES);
    const drop = arrive * arrive;
    character.position.set(
      lerp(onPlatformX, holeX, drop),
      lerp(onPlatformY, holeY, drop),
      lerp(onPlatformZ, 0, drop)
    );

    // The canvas draws above the page, so he cannot pass behind the icons —
    // shrinking is what reads as being swallowed rather than landing on top.
    // Sinking, not just vanishing: he keeps descending past the pit's mouth as
    // he shrinks, the way something goes down a drain. Shrinking alone to
    // nothing read as evaporating in mid-air, and shrinking to 5% put him below
    // a pixel or two long before the fade had finished.
    const sink = clamp01((fall - SINK_FROM) / (1 - SINK_FROM));
    character.position.y -= sink * sinkDepth;
    character.scale.setScalar(lerp(1, 0.22, sink));
    gsap.set(".character-model", {
      opacity: 1 - clamp01((sink - 0.6) / 0.4),
    });
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
      character.scale.setScalar(1);
      if (restYaw !== null) character.rotation.y = restYaw;
      characterControls?.setFall(0, 0);
      autoScrolled = false;
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
        character.scale.setScalar(1);
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
    // Must outlive the sink: "top top" fires while he is still descending, and
    // the sink now runs on past the section's centre.
    end: "bottom top",
    invalidateOnRefresh: true,
    onEnter: engage,
    onEnterBack: engage,
    onLeave: () => release(false),
    onLeaveBack: () => release(true),
  });
}

/**
 * The last beat: peek in from the right edge of the footer and point at the
 * chat rail.
 *
 * Deliberately NOT scroll-scrubbed, unlike everything before it. The rest of the
 * journey is a thing the reader drags along a line; this is a reaction to
 * arriving somewhere, so it plays on its own clock once the footer's name is on
 * screen and simply holds.
 *
 * Its target, .portfolio-chat__launcher, is position: fixed and is unmounted
 * while the chat panel is open — so reading it once a frame serves as both the
 * aim point and the signal to withdraw, with no event wiring to keep in sync.
 */
function setContactPeek(
  character: THREE.Object3D,
  camera: THREE.PerspectiveCamera
) {
  const model = document.querySelector<HTMLElement>(".character-model");
  const section = document.querySelector<HTMLElement>(".contact-section");
  if (!model || !section) return;

  if (peekTicker) {
    gsap.ticker.remove(peekTicker);
    peekTicker = null;
  }
  if (peekTrigger) {
    peekTrigger.kill();
    peekTrigger = null;
  }

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /** 0 waiting off the edge, 1 leaning in and pointing. */
  const peek = { t: 0 };
  /** Edge-triggered, so opening the chat starts one withdrawal, not sixty. */
  let railPresent = false;

  const railEl = () =>
    document.querySelector<HTMLElement>(".portfolio-chat__launcher");

  const slide = (to: number) => {
    gsap.killTweensOf(peek);
    if (reduceMotion) {
      peek.t = to;
      return;
    }
    gsap.to(peek, {
      t: to,
      duration: to > 0 ? PEEK_IN : PEEK_OUT,
      ease: to > 0 ? "power3.out" : "power2.in",
    });
  };

  const draw = (time: number) => {
    const canvas = model.getBoundingClientRect();
    if (canvas.width === 0 || canvas.height === 0) return;

    const rail = railEl();
    const present = !!rail;
    if (present !== railPresent) {
      railPresent = present;
      slide(present ? 1 : 0);
    }

    const dist = camera.position.z;
    const visibleH =
      (2 * dist * Math.tan((camera.fov * Math.PI) / 360)) / camera.zoom;
    const visibleW = visibleH * camera.aspect;

    // Anchored to the CANVAS's right edge, not the viewport's. .character-model
    // is capped at max-width: 1920, so on anything wider the viewport edge lies
    // outside the render and anchoring there would park him past its boundary.
    const edgeX = Math.min(window.innerWidth, canvas.right);
    const railTop = rail
      ? rail.getBoundingClientRect().top
      : window.innerHeight - PEEK_RAIL_FALLBACK_PX;

    const screenX = edgeX - PEEK_INSET_PX + (1 - peek.t) * PEEK_ENTER_PX;
    const screenY = railTop - PEEK_GAP_PX;

    const fx = (screenX - canvas.left) / canvas.width;
    const fy = (screenY - canvas.top) / canvas.height;
    const midX = camera.position.x + (fx - 0.5) * visibleW;
    const midY = camera.position.y + (0.5 - fy) * visibleH;

    // The tip out of the edge and the arm come in together, so the whole thing
    // reads as one movement — leaning out to point — rather than a robot
    // arriving already canted over.
    const lean = PEEK_LEAN_Z * peek.t;
    character.rotation.z = lean;

    // Place his middle on the anchor and work back to the origin, which is what
    // position actually sets. Rotating his middle by the lean and subtracting it
    // keeps the waist on the anchor however far over he is tipped.
    character.position.set(
      midX + PEEK_HALF_H * Math.sin(lean),
      midY - PEEK_HALF_H * Math.cos(lean),
      0
    );

    // Driven off the ticker's own clock rather than a per-frame increment, so
    // the jab keeps the same tempo whatever the frame rate. Held fully extended
    // under reduced motion: still a point, just not a repeating one.
    const jab = reduceMotion
      ? 1
      : 0.5 - 0.5 * Math.cos(time * PEEK_JAB_HZ * Math.PI * 2);
    characterControls?.setPointWeight(peek.t, jab);
    characterControls?.setHeadRoll(-lean * PEEK_HEAD_LEVEL);
  };

  const engage = () => {
    // release(false) leaves a delayed opacity-0 tween in flight. Left alone it
    // lands a second into the entrance and fades him straight back out.
    gsap.killTweensOf(".character-model");
    peekActive = true;

    // He arrives here on his back in the Death pose, yawed to FALL_FACE_Y and
    // shrunk into the pit — the fall never hands any of that back, because
    // until now nothing came after it.
    characterControls?.resumeIdle();
    character.scale.setScalar(1);
    character.rotation.y = PEEK_FACE_Y;
    character.rotation.z = 0; // draw() takes it from here, tied to the entrance
    // rotation.x is left alone: tl3 owns it by scrub and restores it on the way
    // back up, and at -0.04 the difference is not visible anyway.

    camera.position.z = PEEK_CAM_Z;
    camera.position.y = PEEK_CAM_Y;

    // tl2 parks the canvas 12% left, which stops it ~173px short of the right
    // edge — exactly the strip he has to reach. Cover the viewport while he is
    // here; draw() reads the live rect, so this is compensated the same frame.
    //
    // Nothing puts this back on the way out, deliberately. A one-shot gsap.set
    // from a ScrollTrigger callback lands AFTER the scrub tweens in the same
    // update, so restoring here left the canvas pinned at the journey's end
    // offset and tl1/tl3 never got it back. They own x and y, and they reassert
    // them the moment their own ranges are entered. In between the offset is
    // invisible — the canvas is transparent, its gradients are display: none
    // above 1024px, and everything that places him reads its live rect — so
    // leaving it covering the viewport costs nothing and clips nothing.
    gsap.set(".character-model", { x: 0, y: 0, opacity: 1 });

    railPresent = !!railEl();
    peek.t = 0;
    if (!peekTicker) {
      peekTicker = draw;
      gsap.ticker.add(peekTicker);
    }
    slide(railPresent ? 1 : 0);
  };

  const release = () => {
    gsap.killTweensOf(peek);
    if (peekTicker) {
      gsap.ticker.remove(peekTicker);
      peekTicker = null;
    }
    peek.t = 0;
    characterControls?.setPointWeight(0);
    characterControls?.setHeadRoll(0);
    peekActive = false;
  };

  peekTrigger = ScrollTrigger.create({
    trigger: ".contact-section",
    // The same start Contact.tsx uses to reveal its heading, so he arrives with
    // the name rather than after it.
    start: "top 80%",
    end: "bottom top",
    invalidateOnRefresh: true,
    onEnter: engage,
    onEnterBack: engage,
    onLeave: release,
    onLeaveBack: release,
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
      setContactPeek(character, camera);
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
