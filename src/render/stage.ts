// Owns the WebGL renderer, scene, camera, lights, image-based lighting (a PMREM
// room env so metal reflects) and post-processing. A fixed 3/4 camera frames the
// restaurant; trauma adds shake and a serve adds a subtle dolly punch. The sky +
// key light shift from afternoon to night across the run (setTimeOfDay).

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  VignetteEffect,
} from "postprocessing";
import { clamp, clamp01, damp } from "../core/math";

const col = (hex: number) => new THREE.Color(hex);
const mix = (a: THREE.Color, b: THREE.Color, t: number) => a.clone().lerp(b, t);

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly keyLight: THREE.DirectionalLight;
  readonly hemiLight: THREE.HemisphereLight;
  quality: "high" | "low" = "high";
  private readonly fog: THREE.Fog;

  private composer!: EffectComposer;
  private trauma = 0;
  private zoom = 0;
  private readonly baseCamPos = new THREE.Vector3(0, 15.6, 14.0);
  private readonly lookAt = new THREE.Vector3(0, 0.5, 3.1);
  private readonly dolly: THREE.Vector3;
  private time = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "high-performance",
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.26;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = col(0x2a2444);
    this.fog = new THREE.Fog(0x2a2444, 34, 62);
    this.scene.fog = this.fog;

    // Image-based lighting: a PMREM of the built-in room env gives metal
    // appliances real reflections. Kept subtle via environmentIntensity.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.46;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(41, window.innerWidth / window.innerHeight, 0.5, 200);
    this.camera.position.copy(this.baseCamPos);
    this.camera.lookAt(this.lookAt);
    this.dolly = this.lookAt.clone().sub(this.baseCamPos).normalize();

    this.hemiLight = new THREE.HemisphereLight(0xfff4e6, 0x3a3658, 1.0);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff0d6, 1.9);
    this.keyLight.position.set(8, 24, 14);
    this.keyLight.castShadow = true;
    // 1024 map over a frustum tightened to the play area — quarter the shadow-pass
    // fill of a 2048/±20 setup, with similar on-screen resolution.
    this.keyLight.shadow.mapSize.set(1024, 1024);
    const c = this.keyLight.shadow.camera;
    c.left = -14;
    c.right = 14;
    c.top = 14;
    c.bottom = -14;
    c.near = 1;
    c.far = 70;
    this.keyLight.shadow.bias = -0.0006;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);
    this.keyLight.target.position.copy(this.lookAt);

    const fill = new THREE.DirectionalLight(0x8fb6ff, 0.5);
    fill.position.set(-12, 10, -8);
    this.scene.add(fill);

    this.buildPost();
    this.setTimeOfDay(0);
    window.addEventListener("resize", () => this.onResize());
  }

  /** (Re)build the post chain for the current quality. High adds mipmap bloom +
   *  SMAA; low uses a cheap bloom and no antialias pass. */
  private buildPost(): void {
    if (this.composer) this.composer.dispose();
    this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new BloomEffect({
      intensity: 0.55,
      luminanceThreshold: 0.9,
      luminanceSmoothing: 0.26,
      mipmapBlur: this.quality === "high",
      radius: 0.58,
    });
    const vignette = new VignetteEffect({ darkness: 0.26, offset: 0.42 });
    const effects = this.quality === "high"
      ? [bloom, vignette, new SMAAEffect()]
      : [bloom, vignette];
    this.composer.addPass(new EffectPass(this.camera, ...effects));
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  /** Switch graphics quality. Low drops shadows, antialiasing, mipmap bloom and
   *  device-pixel-ratio scaling for a big win on weak GPUs. */
  applyQuality(q: "high" | "low"): void {
    this.quality = q;
    this.renderer.setPixelRatio(q === "high" ? Math.min(window.devicePixelRatio, 2) : 1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.keyLight.castShadow = q === "high";
    this.buildPost();
  }

  /** f: 0 (afternoon) → 1 (deep night). Shifts sky, fog and key light. */
  setTimeOfDay(f: number): void {
    f = clamp01(f);
    const bg = mix(col(0x534a78), col(0x1a1438), f);
    this.scene.background = bg;
    this.fog.color.copy(bg);
    this.keyLight.color.copy(mix(col(0xfff1dc), col(0xb6c2ff), f));
    this.keyLight.intensity = 1.95 - 0.7 * f;
    this.hemiLight.color.copy(mix(col(0xfff4e6), col(0x6470a0), f));
    this.hemiLight.intensity = 1.05 - 0.35 * f;
    this.renderer.toneMappingExposure = 1.26 - 0.06 * f;
  }

  private onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  /** Add screen shake. amount ~0..1. */
  punch(amount: number): void {
    this.trauma = clamp01(this.trauma + amount);
  }

  /** Subtle camera dolly-in kick (serves). */
  punchZoom(amount: number): void {
    this.zoom = clamp(this.zoom + amount, 0, 1.6);
  }

  update(dt: number): void {
    this.time += dt;
    this.trauma = damp(this.trauma, 0, 5, dt);
    this.zoom = damp(this.zoom, 0, 6, dt);
    const s = this.trauma * this.trauma;
    const t = this.time * 40;
    this.camera.position.set(
      this.baseCamPos.x + Math.sin(t * 1.7) * s * 0.9 + this.dolly.x * this.zoom,
      this.baseCamPos.y + Math.cos(t * 2.3) * s * 0.6 + this.dolly.y * this.zoom,
      this.baseCamPos.z + Math.sin(t * 1.1) * s * 0.5 + this.dolly.z * this.zoom,
    );
    this.camera.lookAt(this.lookAt);
  }

  render(dt: number): void {
    this.composer.render(dt);
  }
}
