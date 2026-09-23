import * as THREE from "three";
import { RoomEnvironment } from "three-stdlib";
import { gsap } from "gsap";

const setLighting = (scene: THREE.Scene, renderer: THREE.WebGLRenderer) => {
  // Near-white key. It was blue while the robot was orange and the blue read as
  // a complement; against the titanium shell it cancelled the grey, so the key
  // is neutral now and the point light below carries the scene's blue.
  const directionalLight = new THREE.DirectionalLight(0xdce6f5, 0);
  directionalLight.intensity = 0;
  directionalLight.position.set(-0.47, -0.32, -1);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;
  scene.add(directionalLight);

  // Was driven by the old monitor mesh, flickering with the screen. With the
  // screen gone it is a plain blue fill light, ramped up by turnOnLights.
  const pointLight = new THREE.PointLight(0x60a5fa, 0, 100, 3);
  pointLight.position.set(3, 8, 6);
  pointLight.castShadow = true;
  scene.add(pointLight);

  /**
   * Neutral studio environment, generated rather than loaded.
   *
   * This replaced char_enviorment.hdr, which averages magenta in linear space
   * (R 1.00, G 0.56, B 0.96) — a leftover of the pre-space theme. The stock
   * orange shell hid that, but the titanium one mirrored it as a pink rim no
   * amount of light-tinting could remove, because it came from the reflections
   * rather than the lights.
   *
   * RoomEnvironment is greyscale throughout (white point light, area lights
   * built with setScalar), so metals get something to reflect without any
   * colour cast, and the blue comes from the point light alone. It also drops
   * a ~290KB texture fetch off the critical path.
   */
  const pmrem = new THREE.PMREMGenerator(renderer);
  // three-stdlib exports RoomEnvironment as a factory, not a class — no `new`.
  const envTarget = pmrem.fromScene(RoomEnvironment(), 0.04);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0;
  pmrem.dispose();

  const duration = 2;
  const ease = "power2.inOut";
  function turnOnLights() {
    gsap.to(scene, {
      environmentIntensity: 0.55,
      duration: duration,
      ease: ease,
    });
    gsap.to(directionalLight, {
      intensity: 1,
      duration: duration,
      ease: ease,
    });
    gsap.to(pointLight, {
      intensity: 55,
      duration: duration,
      ease: ease,
    });
    gsap.to(".character-rim", {
      y: "55%",
      opacity: 1,
      delay: 0.2,
      duration: 2,
    });
  }

  return { turnOnLights };
};

export default setLighting;
