// Owns the renderer, scene, camera, lights, image-based lighting and post. A
// fixed sunny 3/4 camera frames the diner during play; in "cine" mode the
// cutscene director dollies the camera through the same world. Bright, warm,
// candy-coloured — morning light that mellows to a golden evening across the run.

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer, EffectPass, RenderPass, SMAAEffect, VignetteEffect } from "postprocessing";
import { clamp, clamp01, damp, easeInOut } from "../core/math";

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
  private vignette!: VignetteEffect;

  // play camera
  private readonly baseCamPos = new THREE.Vector3(0, 18.5, 17.5);
  private readonly lookAt = new THREE.Vector3(0, 0.4, 0.6);
  private readonly dolly: THREE.Vector3;
  private trauma = 0;
  private zoom = 0;
  private time = 0;

  // cinematic camera
  private mode: "play" | "cine" = "play";
  private cineBlend = 0;
  private cinePos = new THREE.Vector3();
  private cineLook = new THREE.Vector3();
  private cineFov = 50;
  private cineHandheld = 1;
  private curLook = new THREE.Vector3(0, 1, -4);

  // setup/manage "studio preview". Two framings: a zoomed close-up on the chef +
  // pet (for picking their colours), and a pulled-back room view (so wall / floor /
  // table / equipment / flower colours are clearly seen changing).
  private preview = false;
  private previewFocus: "chef" | "room" = "chef";
  private readonly pvChefPos = new THREE.Vector3(2.6, 2.5, 8.2);
  private readonly pvChefLook = new THREE.Vector3(4.7, 1.05, 2.4);
  private readonly pvRoomPos = new THREE.Vector3(2.2, 8.6, 15.5);
  private readonly pvRoomLook = new THREE.Vector3(1.0, 1.5, -2.2);
  private previewPose(): { pos: THREE.Vector3; look: THREE.Vector3; fov: number } {
    return this.previewFocus === "room"
      ? { pos: this.pvRoomPos, look: this.pvRoomLook, fov: 42 }
      : { pos: this.pvChefPos, look: this.pvChefLook, fov: 33 };
  }

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", stencil: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // Neutral (Khronos PBR Neutral) tone mapping preserves hue + saturation, so a
    // colour the player picks renders as that colour (ACES Filmic shifted whites
    // to cream and desaturated brights). Lights are kept near-neutral for the same
    // reason — true-to-swatch customization.
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 0.98;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = col(0x8fbfe0);
    // Fog pushed well past the play area (~24-35 units away) so the diner reads
    // crisp; only the far sky beyond the low walls softens into depth.
    this.fog = new THREE.Fog(0x7fb0d4, 52, 105);
    this.scene.fog = this.fog;

    // Image-based lighting kept low so glossy pastels don't go milky.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.3;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.5, 220);
    this.camera.position.copy(this.baseCamPos);
    this.camera.lookAt(this.lookAt);
    this.dolly = this.lookAt.clone().sub(this.baseCamPos).normalize();

    this.hemiLight = new THREE.HemisphereLight(0xfff1e0, 0x6a7560, 0.62);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff0d0, 1.85);
    this.keyLight.position.set(7, 22, 12);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    const c = this.keyLight.shadow.camera;
    c.left = -16; c.right = 16; c.top = 16; c.bottom = -16; c.near = 1; c.far = 70;
    this.keyLight.shadow.bias = -0.0006;
    this.scene.add(this.keyLight, this.keyLight.target);
    this.keyLight.target.position.copy(this.lookAt);

    const fill = new THREE.DirectionalLight(0xbfe0ff, 0.28);
    fill.position.set(-12, 9, -6);
    this.scene.add(fill);

    this.buildPost();
    this.setTimeOfDay(0);
    window.addEventListener("resize", () => this.onResize());
  }

  private buildPost(): void {
    if (this.composer) this.composer.dispose();
    this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // No bloom — the game reads cleaner and cuter as flat candy colour with crisp
    // shading. Cooking/serving no longer haloes the whole frame in light.
    this.vignette = new VignetteEffect({ darkness: 0.4, offset: 0.34 });
    const effects = this.quality === "high" ? [this.vignette, new SMAAEffect()] : [this.vignette];
    this.composer.addPass(new EffectPass(this.camera, ...effects));
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  applyQuality(q: "high" | "low"): void {
    this.quality = q;
    this.renderer.setPixelRatio(q === "high" ? Math.min(window.devicePixelRatio, 2) : 1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.keyLight.castShadow = q === "high";
    this.buildPost();
  }

  /** f: 0 (sunny morning) → 1 (warm golden evening). Warm + friendly, not washed. */
  setTimeOfDay(f: number): void {
    f = clamp01(f);
    const bg = mix(col(0x8fbfe0), col(0xe6ab78), f);
    this.scene.background = bg;
    this.fog.color.copy(bg).multiplyScalar(0.82); // horizon a touch richer than sky
    // Near-neutral white key (a hint of warmth at evening) so albedo reads true:
    // a white apron looks white, a red table looks red.
    this.keyLight.color.copy(mix(col(0xfff6ee), col(0xffd9b4), f));
    this.keyLight.intensity = 1.45 - 0.15 * f;
    this.hemiLight.color.copy(mix(col(0xfdf6ee), col(0xffe2cc), f));
    this.hemiLight.intensity = 0.58 - 0.06 * f;
    this.renderer.toneMappingExposure = 0.98 + 0.02 * f;
  }

  private onResize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  punch(amount: number): void {
    this.trauma = clamp01(this.trauma + amount);
  }
  punchZoom(amount: number): void {
    this.zoom = clamp(this.zoom + amount, 0, 1.6);
  }

  // ── Cinematic camera ──
  setCinematic(on: boolean): void {
    this.mode = on ? "cine" : "play";
  }
  setPreview(on: boolean): void {
    this.preview = on;
  }
  /** Choose what the studio preview frames: the characters or the whole room. */
  setPreviewFocus(focus: "chef" | "room"): void {
    this.preview = true;
    this.previewFocus = focus;
  }
  /** Jump straight to the current preview pose (no fly-in) when the studio opens. */
  snapPreview(): void {
    this.preview = true;
    const p = this.previewPose();
    this.camera.position.copy(p.pos);
    this.curLook.copy(p.look);
    this.camera.fov = p.fov;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(p.look);
  }
  setCinePose(pos: THREE.Vector3, look: THREE.Vector3, fov = 50, handheld = 1): void {
    this.cinePos.copy(pos);
    this.cineLook.copy(look);
    this.cineFov = fov;
    this.cineHandheld = handheld;
  }
  snapCinePose(pos: THREE.Vector3, look: THREE.Vector3, fov = 50): void {
    this.cinePos.copy(pos);
    this.cineLook.copy(look);
    this.curLook.copy(look);
    this.cineFov = fov;
    this.camera.position.copy(pos);
    this.camera.fov = fov;
    this.camera.lookAt(look);
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    this.time += dt;
    this.trauma = damp(this.trauma, 0, 5, dt);
    this.zoom = damp(this.zoom, 0, 6, dt);
    this.cineBlend = damp(this.cineBlend, this.mode === "cine" ? 1 : 0, 6, dt);
    const s = this.trauma * this.trauma;
    const t = this.time * 40;

    if (this.mode === "cine") {
      const k = 9;
      this.camera.position.x = damp(this.camera.position.x, this.cinePos.x, k, dt);
      this.camera.position.y = damp(this.camera.position.y, this.cinePos.y, k, dt);
      this.camera.position.z = damp(this.camera.position.z, this.cinePos.z, k, dt);
      this.curLook.x = damp(this.curLook.x, this.cineLook.x, k, dt);
      this.curLook.y = damp(this.curLook.y, this.cineLook.y, k, dt);
      this.curLook.z = damp(this.curLook.z, this.cineLook.z, k, dt);
      const hh = this.cineHandheld;
      this.camera.position.x += Math.sin(this.time * 0.9) * 0.05 * hh;
      this.camera.position.y += Math.cos(this.time * 0.7) * 0.04 * hh;
      this.camera.fov = damp(this.camera.fov, this.cineFov, 6, dt);
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(this.curLook);
    } else if (this.preview) {
      const k = 7;
      const p = this.previewPose();
      this.camera.position.x = damp(this.camera.position.x, p.pos.x, k, dt);
      this.camera.position.y = damp(this.camera.position.y, p.pos.y, k, dt);
      this.camera.position.z = damp(this.camera.position.z, p.pos.z, k, dt);
      this.curLook.x = damp(this.curLook.x, p.look.x, k, dt);
      this.curLook.y = damp(this.curLook.y, p.look.y, k, dt);
      this.curLook.z = damp(this.curLook.z, p.look.z, k, dt);
      this.camera.fov = damp(this.camera.fov, p.fov, 6, dt);
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(this.curLook);
    } else {
      this.camera.position.set(
        this.baseCamPos.x + Math.sin(t * 1.7) * s * 0.9 + this.dolly.x * this.zoom,
        this.baseCamPos.y + Math.cos(t * 2.3) * s * 0.6 + this.dolly.y * this.zoom,
        this.baseCamPos.z + Math.sin(t * 1.1) * s * 0.5 + this.dolly.z * this.zoom,
      );
      this.camera.fov = damp(this.camera.fov, 46, 6, dt);
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(this.lookAt);
    }

    if (this.vignette) this.vignette.darkness = 0.4 + easeInOut(this.cineBlend) * 0.18;
  }

  render(dt: number): void {
    this.composer.render(dt);
  }
}
