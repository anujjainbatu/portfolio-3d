import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import setCharacter from "./utils/character";
import setLighting from "./utils/lighting";
import { useLoading } from "../../context/LoadingProvider";
import handleResize from "./utils/resizeUtils";
import {
  handleMouseMove,
  handleTouchEnd,
  handleHeadRotation,
  handleTouchMove,
} from "./utils/mouseUtils";
import setAnimations from "./utils/animationUtils";
import { setCharTimeline, setAllTimeline } from "../utils/GsapScroll";
import { setProgress } from "../Loading";

const Scene = () => {
  const canvasDiv = useRef<HTMLDivElement | null>(null);
  const hoverDivRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef(new THREE.Scene());
  const { setLoading } = useLoading();

  const [, setChar] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    if (canvasDiv.current) {
      const canvasElement = canvasDiv.current;
      const rect = canvasElement.getBoundingClientRect();
      const container = { width: rect.width, height: rect.height };
      const aspect = container.width / container.height;
      const scene = sceneRef.current;

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: window.devicePixelRatio < 2,
        powerPreference: "high-performance",
      });
      renderer.setSize(container.width, container.height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
      canvasElement.appendChild(renderer.domElement);

      // The robot is 4.6 units tall with its feet on the origin. This fov and
      // zoom show ~0.231 units of height per unit of distance, so z=25 frames
      // it at about 80% of the viewport; y sits at its vertical centre.
      const camera = new THREE.PerspectiveCamera(14.5, aspect, 0.1, 1000);
      camera.position.set(0, 2.3, 25);
      camera.zoom = 1.1;
      camera.updateProjectionMatrix();

      let headBone: THREE.Object3D | null = null;
      let mixer: THREE.AnimationMixer;
      let poseTick: (() => void) | null = null;
      let removeHoverListener: (() => void) | undefined;
      let removeChatReactionListener: (() => void) | undefined;

      const clock = new THREE.Clock();

      // The model loads asynchronously while sceneRef persists across mounts,
      // so under StrictMode's double-invoke the first load resolves after the
      // cleanup and adds a second character to the same scene. Harmless while
      // both sit at the origin, but visible the moment one of them moves.
      let cancelled = false;

      const light = setLighting(scene, renderer);
      const progress = setProgress((value) => setLoading(value));
      const { loadCharacter } = setCharacter(renderer, scene, camera);

      loadCharacter().then((gltf) => {
        if (gltf && !cancelled) {
          const animations = setAnimations(gltf);
          if (hoverDivRef.current) {
            removeHoverListener = animations.hover(gltf, hoverDivRef.current);
          }
          mixer = animations.mixer;
          poseTick = animations.tick;
          const loadedCharacter = gltf.scene;
          setChar(loadedCharacter);
          scene.add(loadedCharacter);
          // The rig has a bone named "Head" and a skinned mesh, also named
          // "Head", parented to it. getObjectByName returns the bone today
          // only because the mesh sits below it in the tree — ask for the
          // bone explicitly so a re-export cannot silently flip this.
          loadedCharacter.traverse((obj: THREE.Object3D) => {
            if (!headBone && (obj as THREE.Bone).isBone && obj.name === "Head") {
              headBone = obj;
            }
          });
          setCharTimeline(loadedCharacter, camera);
          setAllTimeline();
          progress.loaded().then(() => {
            setTimeout(() => {
              light.turnOnLights();
              animations.startIntro();
            }, 2500);
          });
          const onResize = () =>
            handleResize(renderer, camera, canvasDiv, loadedCharacter);
          window.addEventListener("resize", onResize);

          const onChatReaction = (event: Event) => {
            const reaction = (event as CustomEvent<{ reaction?: string }>).detail
              ?.reaction;
            if (reaction === "open" || reaction === "answer") {
              animations.reactToChat(reaction);
            }
          };
          window.addEventListener("portfolio:chat-reaction", onChatReaction);
          removeChatReactionListener = () => {
            window.removeEventListener("resize", onResize);
            window.removeEventListener("portfolio:chat-reaction", onChatReaction);
          };
        }
      });

      let mouse = { x: 0, y: 0 },
        interpolation = { x: 0.1, y: 0.2 };

      const onMouseMove = (event: MouseEvent) => {
        handleMouseMove(event, (x, y) => (mouse = { x, y }));
      };
      let debounce: ReturnType<typeof setTimeout> | undefined;
      const onTouchStart = (event: TouchEvent) => {
        const element = event.target as HTMLElement;
        debounce = setTimeout(() => {
          element?.addEventListener("touchmove", (e: TouchEvent) =>
            handleTouchMove(e, (x, y) => (mouse = { x, y }))
          );
        }, 200);
      };

      const onTouchEnd = () => {
        handleTouchEnd((x, y, interpolationX, interpolationY) => {
          mouse = { x, y };
          interpolation = { x: interpolationX, y: interpolationY };
        });
      };

      document.addEventListener("mousemove", onMouseMove);
      const landingDiv = document.getElementById("landingDiv");
      if (landingDiv) {
        landingDiv.addEventListener("touchstart", onTouchStart);
        landingDiv.addEventListener("touchend", onTouchEnd);
      }
      const animate = () => {
        requestAnimationFrame(animate);
        if (headBone) {
          handleHeadRotation(
            headBone,
            mouse.x,
            mouse.y,
            interpolation.x,
            interpolation.y,
            THREE.MathUtils.lerp
          );
        }
        const delta = clock.getDelta();
        if (mixer) {
          mixer.update(delta);
        }
        // After the mixer, never before: it restores bone state on update.
        poseTick?.();
        renderer.render(scene, camera);
      };
      animate();
      return () => {
        cancelled = true;
        clearTimeout(debounce);
        removeHoverListener?.();
        removeChatReactionListener?.();
        scene.clear();
        renderer.dispose();
        if (canvasElement.contains(renderer.domElement)) {
          canvasElement.removeChild(renderer.domElement);
        }
        document.removeEventListener("mousemove", onMouseMove);
        if (landingDiv) {
          landingDiv.removeEventListener("touchstart", onTouchStart);
          landingDiv.removeEventListener("touchend", onTouchEnd);
        }
      };
    }
  }, [setLoading]);

  return (
    <>
      <div className="character-container">
        <div className="character-model" ref={canvasDiv}>
          <div className="character-rim"></div>
          <div className="character-hover" ref={hoverDivRef}></div>
        </div>
      </div>
    </>
  );
};

export default Scene;
