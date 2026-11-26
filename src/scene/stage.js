import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

function createSoftShadowTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 12, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.52)');
  grad.addColorStop(0.45, 'rgba(0, 0, 0, 0.24)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class PhoneStage {
  constructor(canvas, phone, { onKeyClick }) {
    this.canvas = canvas;
    this.phone = phone;
    this.onKeyClick = onKeyClick;

    this.cameraMode = 'play'; // 'play' | 'closeup' | 'orbit'
    this.pointerNdc = new THREE.Vector2(0, 0);
    this.parallaxNdc = new THREE.Vector2(0, 0);
    this.smoothPointer = new THREE.Vector2(0, 0);
    this._arcWaypoint = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.activePointers = new Set();
    this.tapPointerId = null;
    this.pointerDownPos = { x: 0, y: 0 };

    this._initRenderer();
    this._initScene();
    this._initControls();
    this._bindPointerEvents();
    this.resize();
    this.camera.position.copy(this.desiredCamPos);
    this.controls.target.copy(this.desiredTarget);
    this.camera.lookAt(this.controls.target);
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1019);
    this.scene.fog = new THREE.FogExp2(0x0b1019, 0.022);

    this.camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 100);
    this.camera.position.set(0.35, 1.35, 19.2);

    // Subtle procedural studio environment for authentic plastic & glass reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRT = pmrem.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.65;
    roomEnv.dispose();
    pmrem.dispose();

    // Three-point studio lighting
    const hemi = new THREE.HemisphereLight(0xd9e6ff, 0x151e2c, 0.55);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff7ea, 1.65);
    keyLight.position.set(6.5, 9.5, 11.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 32;
    keyLight.shadow.camera.left = -8;
    keyLight.shadow.camera.right = 8;
    keyLight.shadow.camera.top = 9;
    keyLight.shadow.camera.bottom = -9;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x7fb4ff, 0.85);
    rimLight.position.set(-7.5, 4.0, -6.0);
    this.scene.add(rimLight);

    // Subtle dynamic green LED bounce light from the LCD screen
    this.lcdGlowLight = new THREE.PointLight(0x8fdc2e, 0.85, 8.5, 1.6);
    this.lcdGlowLight.position.set(0, 2.26, 2.35);
    this.scene.add(this.lcdGlowLight);

    // Phone holder group (subtle float & pointer tilt in Play mode)
    this.phoneRig = new THREE.Group();
    this.phoneRig.add(this.phone.root);
    this.scene.add(this.phoneRig);

    // Subtle grounded studio pedestal shadow beneath the handset
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(7.2, 4.6),
      new THREE.MeshBasicMaterial({
        map: createSoftShadowTexture(),
        transparent: true,
        depthWrite: false,
      }),
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(0, -6.28, -0.2);
    this.scene.add(shadowPlane);

    // Subtle matte studio desk backdrop surface
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(28, 48),
      new THREE.MeshStandardMaterial({
        color: 0x0e1522,
        roughness: 0.92,
        metalness: 0.04,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -6.32, 0);
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  _initControls() {
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 4.5;
    this.controls.maxDistance = 36;
    this.controls.maxPolarAngle = Math.PI * 0.85;
    this.controls.target.set(0, 0.05, 0);
    this.controls.enabled = false;
    this.orbitTransitionActive = false;

    this.controls.addEventListener('start', () => {
      this.orbitTransitionActive = false;
    });

    this.desiredCamPos = new THREE.Vector3(0.45, 0.65, 25.8);
    this.desiredTarget = new THREE.Vector3(0, 0.05, 0.25);
  }

  setCameraMode(mode) {
    if (mode !== 'play' && mode !== 'closeup' && mode !== 'orbit') return;
    this.cameraMode = mode;
    this.controls.enabled = mode === 'orbit';
    this.canvas.style.cursor = mode === 'orbit' ? 'grab' : 'default';
    this._updateCameraGoals();
    this.orbitTransitionActive = mode === 'orbit';
  }

  cycleCameraMode() {
    const order = ['play', 'closeup', 'orbit'];
    const idx = (order.indexOf(this.cameraMode) + 1) % order.length;
    this.setCameraMode(order[idx]);
    return this.cameraMode;
  }

  _updateCameraGoals() {
    const width = window.innerWidth || 1280;
    const height = window.innerHeight || 720;
    const aspect = Math.max(0.42, this.camera.aspect || 1.6);
    const tanHalfV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5));
    const tanHalfH = tanHalfV * aspect;
    const isPortraitMobile = width <= 780 && aspect < 0.85;
    const isShortViewport = height < 520;

    if (this.cameraMode === 'play') {
      // Exact frustum fit for entire 3310 handset (height 11.7, width 5.3) with clean HUD clearance
      const halfHeightPad = isShortViewport ? 8.15 : isPortraitMobile ? 7.65 : 7.15;
      const halfWidthPad = isPortraitMobile ? 3.15 : 3.25;
      const distV = halfHeightPad / tanHalfV;
      const distH = halfWidthPad / tanHalfH;
      const zDist = Math.max(distV, distH) + 1.05;
      // On portrait mobile, bias target slightly upward so phone sits cleanly below the 2-row top HUD
      const targetY = isPortraitMobile ? 0.42 : isShortViewport ? 0.14 : 0.02;
      this.desiredCamPos.set(isPortraitMobile ? 0 : 0.45, targetY + 0.35, zDist);
      this.desiredTarget.set(0, targetY, 0.25);
    } else if (this.cameraMode === 'closeup') {
      // Exact frustum fit for entire 84x48 LCD (3.16 x 1.98) + silver bezel + SHMOKIA badge below top HUD
      const distV = (isShortViewport ? 2.35 : 2.05) / tanHalfV;
      const distH = 2.15 / tanHalfH;
      const zDist = Math.max(distV, distH) + 0.92;
      this.desiredCamPos.set(0, 2.38, zDist);
      this.desiredTarget.set(0, 2.38, 0.86);
    } else {
      // Full-handset 3/4 showcase angle for 3D Orbit inspection
      const distV = (isShortViewport ? 8.2 : 7.4) / tanHalfV;
      const distH = 3.8 / tanHalfH;
      const dist = Math.max(distV, distH) * 0.92;
      this.desiredCamPos.set(dist * 0.44, dist * 0.16, dist * 0.88);
      this.desiredTarget.set(0, 0.0, 0);
    }
  }

  _bindPointerEvents() {
    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const rect = this.canvas.getBoundingClientRect();
      this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.parallaxNdc.copy(this.pointerNdc);

      const hit = this._pickKey();
      this.canvas.style.cursor = hit
        ? 'pointer'
        : this.cameraMode === 'orbit'
          ? 'grab'
          : 'default';
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.activePointers.add(e.pointerId);
      if (this.activePointers.size > 1) {
        // Multi-touch gesture (e.g., pinch zoom) cancels single-key tap
        this.tapPointerId = null;
        return;
      }
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
      this.tapPointerId = e.pointerId;
    });

    const releasePointer = (e) => {
      this.activePointers.delete(e.pointerId);
      if (e.pointerId === this.tapPointerId) {
        this.tapPointerId = null;
      }
    };

    window.addEventListener('pointercancel', releasePointer);

    this.canvas.addEventListener('pointerup', (e) => {
      const wasTapCandidate = e.pointerId === this.tapPointerId;
      releasePointer(e);
      if (!wasTapCandidate) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      const dx = e.clientX - this.pointerDownPos.x;
      const dy = e.clientY - this.pointerDownPos.y;
      const maxDrift = e.pointerType === 'touch' ? 14 : 8;
      if (Math.hypot(dx, dy) > maxDrift) return; // Ignore orbit drag / swipe release

      const rect = this.canvas.getBoundingClientRect();
      this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const keyId = this._pickKey();
      if (keyId && this.onKeyClick) {
        this.onKeyClick(keyId);
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (e.target !== this.canvas) {
        releasePointer(e);
      }
    });
  }

  _pickKey() {
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.phone.interactiveMeshes, false);
    if (hits.length > 0) {
      return hits[0].object.userData.keyId ?? null;
    }
    return null;
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this._updateCameraGoals();
  }

  _lerpCameraAvoidingPhone(smooth) {
    // If transitioning from behind the handset back to the front, arc around the side instead of clipping through it
    if (this.camera.position.z < 0.25 && this.desiredCamPos.z > 1.0) {
      const sideSign = this.camera.position.x < 0 ? -1 : 1;
      const orbitRadius = Math.max(12, Math.hypot(this.camera.position.x, this.camera.position.z));
      this._arcWaypoint.set(sideSign * orbitRadius, this.desiredCamPos.y, 2.2);
      this.camera.position.lerp(this._arcWaypoint, smooth);
    } else {
      this.camera.position.lerp(this.desiredCamPos, smooth);
    }
    this.controls.target.lerp(this.desiredTarget, smooth);
    this.camera.lookAt(this.controls.target);
  }

  update(dtSec, elapsedSec) {
    const smooth = 1 - Math.exp(-dtSec * 6.5);
    this.smoothPointer.lerp(this.parallaxNdc, smooth);

    // Sync ambient green screen glow light with LCD backlight state
    this.lcdGlowLight.intensity = 0.08 + this.phone.backlightValue * 0.95;

    if (this.cameraMode === 'play') {
      // Subtle living studio presence: gentle mouse parallax, zero distraction to LCD readability
      const targetRotY = this.smoothPointer.x * 0.14 - 0.03;
      const targetRotX = -this.smoothPointer.y * 0.07 + 0.03;
      this.phoneRig.rotation.y += (targetRotY - this.phoneRig.rotation.y) * smooth;
      this.phoneRig.rotation.x += (targetRotX - this.phoneRig.rotation.x) * smooth;
      this.phoneRig.position.y = Math.sin(elapsedSec * 1.15) * 0.055;

      this._lerpCameraAvoidingPhone(smooth);
    } else if (this.cameraMode === 'closeup') {
      // Perfectly square to LCD for razor-sharp high-score play
      this.phoneRig.rotation.y += (0 - this.phoneRig.rotation.y) * smooth;
      this.phoneRig.rotation.x += (0 - this.phoneRig.rotation.x) * smooth;
      this.phoneRig.position.y += (0 - this.phoneRig.position.y) * smooth;

      this._lerpCameraAvoidingPhone(smooth);
    } else {
      // Free 3D Orbit inspection (smoothly frames full handset on entry until user drags)
      this.phoneRig.rotation.y += (0 - this.phoneRig.rotation.y) * smooth;
      this.phoneRig.rotation.x += (0 - this.phoneRig.rotation.x) * smooth;
      this.phoneRig.position.y = Math.sin(elapsedSec * 1.15) * 0.055;

      if (this.orbitTransitionActive) {
        this.camera.position.lerp(this.desiredCamPos, smooth);
        this.controls.target.lerp(this.desiredTarget, smooth);
        if (
          this.camera.position.distanceTo(this.desiredCamPos) < 0.08 &&
          this.controls.target.distanceTo(this.desiredTarget) < 0.04
        ) {
          this.orbitTransitionActive = false;
        }
      }
      this.controls.update();
    }

    this.renderer.render(this.scene, this.camera);
  }
}
