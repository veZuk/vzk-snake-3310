import * as THREE from 'three';
import { LCD_HEIGHT, LCD_WIDTH } from '../lcd/lcd-renderer.js';

// Classic 3310 swappable faceplate colorways
export const COVER_PRESETS = {
  navy: {
    name: 'Midnight Blue',
    shell: 0x223151,
    back: 0x1b2742,
    bezel: 0xc2c8d2,
    sideTrim: 0xa5aebc,
  },
  silver: {
    name: 'Arctic Silver',
    shell: 0x9aa4b2,
    back: 0x7f8998,
    bezel: 0xdce1e8,
    sideTrim: 0x6f7887,
  },
  red: {
    name: 'Deep Red',
    shell: 0x8b2130,
    back: 0x6b1824,
    bezel: 0xc7cbd1,
    sideTrim: 0x9ea5b0,
  },
  yellow: {
    name: 'Sahara Yellow',
    shell: 0xc99a27,
    back: 0xa37b1d,
    bezel: 0xd0d4da,
    sideTrim: 0x7e8692,
  },
};

function createPhoneBodyShape(scaleX = 1, scaleY = 1) {
  // Iconic 3310 silhouette: slightly wider rounded crown, gentle waist pinch near keypad, rounded chin
  const sx = (v) => v * scaleX;
  const sy = (v) => v * scaleY;
  const s = new THREE.Shape();

  s.moveTo(sx(0), sy(5.62));
  // Top-right crown
  s.bezierCurveTo(sx(1.58), sy(5.62), sx(2.38), sy(5.12), sx(2.40), sy(3.95));
  // Right flank gently pinching at keypad waist
  s.bezierCurveTo(sx(2.42), sy(2.25), sx(2.22), sy(0.35), sx(2.18), sy(-1.45));
  // Subtle flare toward lower keypad and rounded chin
  s.bezierCurveTo(sx(2.16), sy(-3.45), sx(2.28), sy(-4.72), sx(1.52), sy(-5.38));
  s.bezierCurveTo(sx(1.02), sy(-5.64), sx(0.48), sy(-5.66), sx(0), sy(-5.66));
  // Mirror left half
  s.bezierCurveTo(sx(-0.48), sy(-5.66), sx(-1.02), sy(-5.64), sx(-1.52), sy(-5.38));
  s.bezierCurveTo(sx(-2.28), sy(-4.72), sx(-2.16), sy(-3.45), sx(-2.18), sy(-1.45));
  s.bezierCurveTo(sx(-2.22), sy(0.35), sx(-2.42), sy(2.25), sx(-2.40), sy(3.95));
  s.bezierCurveTo(sx(-2.38), sy(5.12), sx(-1.58), sy(5.62), sx(0), sy(5.62));

  return s;
}

function createRoundedRectShape(width, height, radius) {
  const hw = width / 2;
  const hh = height / 2;
  const r = Math.min(radius, hw, hh);
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return shape;
}

function createSilverBezelShape() {
  // Iconic silver shield framing earpiece, screen, and upper nav cluster
  const s = new THREE.Shape();
  s.moveTo(0, 4.92);
  s.bezierCurveTo(1.25, 4.92, 1.98, 4.55, 2.02, 3.65);
  s.bezierCurveTo(2.06, 2.55, 1.98, 1.35, 1.92, 0.45);
  s.bezierCurveTo(1.88, -0.05, 1.56, -0.42, 0.92, -0.48);
  s.bezierCurveTo(0.45, -0.52, -0.45, -0.52, -0.92, -0.48);
  s.bezierCurveTo(-1.56, -0.42, -1.88, -0.05, -1.92, 0.45);
  s.bezierCurveTo(-1.98, 1.35, -2.06, 2.55, -2.02, 3.65);
  s.bezierCurveTo(-1.98, 4.55, -1.25, 4.92, 0, 4.92);

  // Recessed cutout for the LCD module (centered at y = 2.26)
  const hole = new THREE.Path();
  const hw = 1.66;
  const hh = 1.07;
  const cy = 2.26;
  const r = 0.14;
  hole.moveTo(-hw + r, cy - hh);
  hole.lineTo(hw - r, cy - hh);
  hole.quadraticCurveTo(hw, cy - hh, hw, cy - hh + r);
  hole.lineTo(hw, cy + hh - r);
  hole.quadraticCurveTo(hw, cy + hh, hw - r, cy + hh);
  hole.lineTo(-hw + r, cy + hh);
  hole.quadraticCurveTo(-hw, cy + hh, -hw, cy + hh - r);
  hole.lineTo(-hw, cy - hh + r);
  hole.quadraticCurveTo(-hw, cy - hh, -hw + r, cy - hh);
  s.holes.push(hole);

  return s;
}

function createWordmarkTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 140;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Recessed dark badge pill + crisp silkscreen wordmark
  ctx.fillStyle = '#18233a';
  ctx.beginPath();
  ctx.roundRect(24, 24, 592, 92, 16);
  ctx.fill();

  const text = 'SHMOKIA';
  ctx.fillStyle = '#e7edf7';
  ctx.font = '900 62px "Arial Black", "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const tracking = 12;
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const totalW = widths.reduce((sum, w) => sum + w, 0) + tracking * (text.length - 1);
  let cursorX = (canvas.width - totalW) / 2;
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], cursorX, 72);
    cursorX += widths[i] + tracking;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function createKeyLabelTexture({
  primary,
  secondary = '',
  cyrillic = '',
  dirHint = '',
  bg = '#d7dde6',
  fg = '#182438',
  accent = '#2b5797',
  isNavi = false,
}) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');

  // Subtle concave pearl-plastic gradient
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#eef2f7');
  grad.addColorStop(0.55, bg);
  grad.addColorStop(1, '#bbc4d1');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (isNavi) {
    // Classic horizontal blue Navi bar line
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(56, 62, 144, 34, 17);
    ctx.fill();
  } else {
    ctx.fillStyle = fg;
    ctx.textBaseline = 'middle';

    if (secondary || cyrillic) {
      if (primary === '*') {
        // Crisp vertically-centered 6-point asterisk matching the weight of numeric digits
        ctx.strokeStyle = fg;
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        const cx = 64;
        const cy = 82;
        const r = 21;
        for (let a = 0; a < 3; a++) {
          const ang = (a * Math.PI) / 3 + Math.PI / 6;
          ctx.beginPath();
          ctx.moveTo(cx - Math.cos(ang) * r, cy - Math.sin(ang) * r);
          ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
          ctx.stroke();
        }
      } else {
        ctx.font = '800 72px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(primary, 30, 82);
      }

      if (secondary === '__voicemail__') {
        // Authentic voicemail tape icon on key 1 (o_o)
        ctx.strokeStyle = '#334563';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(166, 84, 11, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(204, 84, 11, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(166, 95);
        ctx.lineTo(204, 95);
        ctx.stroke();
      } else if (secondary === '__plus__') {
        // Centered plus sign on key *
        ctx.strokeStyle = '#334563';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(176, 82);
        ctx.lineTo(208, 82);
        ctx.moveTo(192, 66);
        ctx.lineTo(192, 98);
        ctx.stroke();
      } else if (secondary === '__space__') {
        // Authentic spacebar bracket on key 0
        ctx.strokeStyle = '#334563';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(164, 82);
        ctx.lineTo(164, 96);
        ctx.lineTo(212, 96);
        ctx.lineTo(212, 82);
        ctx.stroke();
      } else if (secondary === '__shift__') {
        // Authentic 3310 upward shift arrow on key #
        ctx.strokeStyle = '#334563';
        ctx.lineWidth = 6;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(192, 108);
        ctx.lineTo(192, 62);
        ctx.moveTo(174, 78);
        ctx.lineTo(192, 60);
        ctx.lineTo(210, 78);
        ctx.stroke();
      } else if (cyrillic) {
        // Dual Latin + Cyrillic key printing
        ctx.textAlign = 'right';
        ctx.font = '700 30px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#3c4e6b';
        ctx.fillText(secondary, 226, 62);

        ctx.font = '800 30px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#182438';
        ctx.fillText(cyrillic, 226, 104);
      } else {
        ctx.font = '700 34px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#334563';
        ctx.textAlign = 'right';
        ctx.fillText(secondary, 224, 84);
      }
    } else if (primary === '__arrow_up__' || primary === '__arrow_down__') {
      // Crisp vector scroll arrows on the 3310 diagonal rocker keys
      ctx.fillStyle = fg;
      ctx.beginPath();
      if (primary === '__arrow_up__') {
        ctx.moveTo(128, 44);
        ctx.lineTo(166, 112);
        ctx.lineTo(90, 112);
      } else {
        ctx.moveTo(128, 116);
        ctx.lineTo(166, 48);
        ctx.lineTo(90, 48);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.font = '800 78px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(primary, 128, 82);
    }

    if (dirHint) {
      // Crisp vector direction indicator along the flat top center of keys 2/4/5/6/8
      ctx.fillStyle = accent;
      ctx.beginPath();
      const cx = 128;
      const cy = 27;
      if (dirHint === 'up') {
        ctx.moveTo(cx, cy - 9);
        ctx.lineTo(cx - 10, cy + 8);
        ctx.lineTo(cx + 10, cy + 8);
        ctx.closePath();
      } else if (dirHint === 'down') {
        ctx.moveTo(cx, cy + 9);
        ctx.lineTo(cx - 10, cy - 8);
        ctx.lineTo(cx + 10, cy - 8);
        ctx.closePath();
      } else if (dirHint === 'left') {
        ctx.moveTo(cx - 10, cy);
        ctx.lineTo(cx + 8, cy - 9);
        ctx.lineTo(cx + 8, cy + 9);
        ctx.closePath();
      } else if (dirHint === 'right') {
        ctx.moveTo(cx + 10, cy);
        ctx.lineTo(cx - 8, cy - 9);
        ctx.lineTo(cx - 8, cy + 9);
        ctx.closePath();
      } else if (dirHint === 'center') {
        ctx.arc(cx, cy, 7.5, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function createLcdShaderMaterial(lcdTexture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: lcdTexture },
      uBacklight: { value: 1.0 },
      uResolution: { value: new THREE.Vector2(LCD_WIDTH, LCD_HEIGHT) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex;
      uniform float uBacklight;
      uniform vec2 uResolution;
      varying vec2 vUv;

      float samplePixel(vec2 coord) {
        if (coord.x < 0.0 || coord.y < 0.0 || coord.x >= uResolution.x || coord.y >= uResolution.y) {
          return 0.0;
        }
        vec2 uv = (floor(coord) + 0.5) / uResolution;
        return texture2D(uTex, uv).r;
      }

      void main() {
        // Flip Y so row 0 in Uint8Array is top of LCD
        vec2 lcdUv = vec2(vUv.x, 1.0 - vUv.y);
        vec2 pCoord = lcdUv * uResolution;
        vec2 cellUv = fract(pCoord);

        // Anti-aliased sub-pixel grid using screen-space derivatives
        vec2 fw = max(fwidth(pCoord), vec2(0.015));
        float gap = 0.095;
        vec2 edgeLow = smoothstep(vec2(gap) - fw, vec2(gap) + fw, cellUv);
        vec2 edgeHigh = 1.0 - smoothstep(vec2(1.0 - gap) - fw, vec2(1.0 - gap) + fw, cellUv);
        float pixelMask = edgeLow.x * edgeLow.y * edgeHigh.x * edgeHigh.y;

        float pixOn = samplePixel(pCoord);
        // Subtle 0.45px offset shadow cast by liquid crystals onto reflective backing
        float shadowOn = samplePixel(pCoord - vec2(0.38, 0.46));

        // Authentic 3310 LCD palettes (unlit olive reflective vs green SMD LED lit)
        vec3 bgUnlit = vec3(0.515, 0.578, 0.392);
        vec3 inkUnlit = vec3(0.118, 0.155, 0.095);

        vec3 bgLit = vec3(0.575, 0.745, 0.145);
        vec3 inkLit = vec3(0.088, 0.138, 0.055);

        // Classic 4-LED side illumination pools along left and right edges of the 3310 LCD
        float sideEdge = 1.0 - smoothstep(0.0, 0.36, min(lcdUv.x, 1.0 - lcdUv.x));
        float ledPair = exp(-pow((lcdUv.y - 0.28) * 3.8, 2.0)) + exp(-pow((lcdUv.y - 0.72) * 3.8, 2.0));
        float ledBoost = 1.0 + uBacklight * (0.14 * sideEdge * (0.55 + 0.45 * ledPair));

        // Slight outer recess bevel shadow inside the LCD window
        float borderX = smoothstep(0.0, 0.045, lcdUv.x) * smoothstep(0.0, 0.045, 1.0 - lcdUv.x);
        float borderY = smoothstep(0.0, 0.06, lcdUv.y) * smoothstep(0.0, 0.06, 1.0 - lcdUv.y);
        float recessAO = mix(0.84, 1.0, borderX * borderY);

        // Subtle transflective metallic micro-grain
        float grain = (fract(sin(dot(floor(pCoord * 2.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.018;

        vec3 bgCol = mix(bgUnlit, bgLit, uBacklight) * ledBoost + grain;
        vec3 inkCol = mix(inkUnlit, inkLit, uBacklight);

        // Faint OFF-pixel dot matrix grid visibility (real STN electrodes are barely visible when off)
        float ghostGrid = 0.038 * pixelMask;
        vec3 col = mix(bgCol, inkCol, ghostGrid);

        // Transflector drop-shadow beneath lit liquid crystal pixels
        col = mix(col, inkCol, shadowOn * 0.18 * (0.75 + 0.25 * pixelMask));

        // Active liquid crystal pixel cell
        float activeStrength = pixOn * mix(0.18, 0.96, pixelMask);
        col = mix(col, inkCol, activeStrength);

        // Gentle diagonal studio glass catchlight gradient
        float sheen = pow(max(0.0, 1.0 - abs((lcdUv.x * 0.7 + lcdUv.y * 0.9) - 0.55) * 2.1), 4.0);
        col += vec3(0.045, 0.055, 0.04) * sheen * (1.0 - uBacklight * 0.35);

        col *= recessAO;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export class Phone3310 {
  constructor(lcdRenderer) {
    this.root = new THREE.Group();
    this.lcdRenderer = lcdRenderer;

    // Key registry for raycast picking & press animations
    this.keys = new Map();
    this.interactiveMeshes = [];
    this.hitMeshes = [];

    this.backlightTarget = 1.0;
    this.backlightValue = 1.0;

    // 84x48 monochrome DataTexture updated each frame from LcdRenderer
    this.lcdTexture = new THREE.DataTexture(
      lcdRenderer.rgba,
      LCD_WIDTH,
      LCD_HEIGHT,
      THREE.RGBAFormat,
    );
    this.lcdTexture.magFilter = THREE.NearestFilter;
    this.lcdTexture.minFilter = THREE.NearestFilter;
    this.lcdTexture.generateMipmaps = false;
    this.lcdTexture.flipY = false;
    this.lcdTexture.needsUpdate = true;

    this._createMaterials();
    this._buildBody();
    this._buildScreen();
    this._buildEarpieceAndLogo();
    this._buildKeypad();
    this._buildBackDetails();
  }

  _createMaterials() {
    const preset = COVER_PRESETS.navy;

    this.shellMat = new THREE.MeshStandardMaterial({
      color: preset.shell,
      roughness: 0.36,
      metalness: 0.12,
    });

    this.backMat = new THREE.MeshStandardMaterial({
      color: preset.back,
      roughness: 0.48,
      metalness: 0.08,
    });

    this.sideTrimMat = new THREE.MeshStandardMaterial({
      color: preset.sideTrim,
      roughness: 0.42,
      metalness: 0.22,
    });

    this.bezelMat = new THREE.MeshStandardMaterial({
      color: preset.bezel,
      roughness: 0.28,
      metalness: 0.45,
    });

    this.darkRecessMat = new THREE.MeshStandardMaterial({
      color: 0x10151f,
      roughness: 0.72,
      metalness: 0.05,
    });

    this.ledBedMat = new THREE.MeshStandardMaterial({
      color: 0x26381c,
      emissive: new THREE.Color(0x7ac724),
      emissiveIntensity: 0.75,
      roughness: 0.55,
      metalness: 0.0,
    });

    this.lcdMat = createLcdShaderMaterial(this.lcdTexture);

    this.glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.11,
      roughness: 0.07,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      reflectivity: 0.9,
      envMapIntensity: 1.45,
      depthWrite: false,
    });

    this.hitColliderMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
    });
  }

  setCover(coverId) {
    const preset = COVER_PRESETS[coverId] ?? COVER_PRESETS.navy;
    this.shellMat.color.setHex(preset.shell);
    this.backMat.color.setHex(preset.back);
    this.bezelMat.color.setHex(preset.bezel);
    this.sideTrimMat.color.setHex(preset.sideTrim);
  }

  setBacklight(enabled) {
    this.backlightTarget = enabled ? 1.0 : 0.0;
  }

  _buildBody() {
    // 1. Rear rounded shell (outer Z: -1.16 .. +0.02)
    const backShape = createPhoneBodyShape(0.985, 0.985);
    const backGeo = new THREE.ExtrudeGeometry(backShape, {
      depth: 0.72,
      bevelEnabled: true,
      bevelThickness: 0.24,
      bevelSize: 0.22,
      bevelSegments: 14,
      curveSegments: 72,
    });
    const backMesh = new THREE.Mesh(backGeo, this.backMat);
    backMesh.position.z = -0.92;
    backMesh.castShadow = true;
    backMesh.receiveShadow = true;
    this.root.add(backMesh);

    // 2. Iconic light-grey mid-frame perimeter trim band sitting uniformly between front & back shells
    const trimShape = createPhoneBodyShape(0.988, 0.986);
    const trimGeo = new THREE.ExtrudeGeometry(trimShape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.222,
      bevelSegments: 8,
      curveSegments: 72,
    });
    const trimMesh = new THREE.Mesh(trimGeo, this.sideTrimMat);
    trimMesh.position.z = -0.07;
    trimMesh.castShadow = true;
    trimMesh.receiveShadow = true;
    this.root.add(trimMesh);

    // 3. Sculpted swappable front cover (outer Z: -0.04 .. +0.82)
    const frontShape = createPhoneBodyShape(0.985, 0.985);
    const frontGeo = new THREE.ExtrudeGeometry(frontShape, {
      depth: 0.42,
      bevelEnabled: true,
      bevelThickness: 0.22,
      bevelSize: 0.22,
      bevelSegments: 14,
      curveSegments: 72,
    });
    const frontMesh = new THREE.Mesh(frontGeo, this.shellMat);
    frontMesh.position.z = 0.18;
    frontMesh.castShadow = true;
    frontMesh.receiveShadow = true;
    this.root.add(frontMesh);

    // 4. Iconic silver U-shield bezel framing screen + nav cluster
    const bezelShape = createSilverBezelShape();
    const bezelGeo = new THREE.ExtrudeGeometry(bezelShape, {
      depth: 0.12,
      bevelEnabled: true,
      bevelThickness: 0.055,
      bevelSize: 0.05,
      bevelSegments: 10,
      curveSegments: 64,
    });
    const bezelMesh = new THREE.Mesh(bezelGeo, this.bezelMat);
    bezelMesh.position.z = 0.78;
    bezelMesh.castShadow = true;
    bezelMesh.receiveShadow = true;
    this.root.add(bezelMesh);

    // 5. Top power button (classic rubbery black button on top crown of 3310)
    const powerGeo = new THREE.BoxGeometry(0.72, 0.16, 0.34);
    const powerMesh = new THREE.Mesh(powerGeo, this.darkRecessMat);
    powerMesh.position.set(0.32, 5.74, 0.05);
    this.root.add(powerMesh);

    // 6. Bottom charger + headset pin ports
    const portGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.14, 16);
    const port1 = new THREE.Mesh(portGeo, this.darkRecessMat);
    port1.position.set(-0.55, -5.72, 0.02);
    this.root.add(port1);

    const port2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 16), this.darkRecessMat);
    port2.position.set(0.12, -5.72, 0.02);
    this.root.add(port2);
  }

  _buildScreen() {
    // Dark inner LCD bezel cavity recessed inside the silver shield window
    const cavity = new THREE.Mesh(
      new THREE.PlaneGeometry(3.48, 2.30),
      this.darkRecessMat,
    );
    cavity.position.set(0, 2.26, 0.835);
    this.root.add(cavity);

    // Thin inner olive-grey metallic LCD frame
    const innerFrameMat = new THREE.MeshStandardMaterial({
      color: 0x3b4437,
      roughness: 0.55,
      metalness: 0.2,
    });
    const innerFrame = new THREE.Mesh(new THREE.PlaneGeometry(3.34, 2.14), innerFrameMat);
    innerFrame.position.set(0, 2.26, 0.844);
    this.root.add(innerFrame);

    // Active 84x48 Monochrome Dot-Matrix LCD Plane
    const lcdPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(3.16, 1.98),
      this.lcdMat,
    );
    lcdPlane.position.set(0, 2.26, 0.858);
    this.root.add(lcdPlane);

    // Glossy protective acrylic clearcoat lens floating slightly in front of LCD
    const glassShape = createRoundedRectShape(3.36, 2.16, 0.12);
    const glassGeo = new THREE.ShapeGeometry(glassShape, 12);
    const glassMesh = new THREE.Mesh(glassGeo, this.glassMat);
    glassMesh.position.set(0, 2.26, 0.942);
    this.root.add(glassMesh);
  }

  _buildEarpieceAndLogo() {
    // 5 iconic horizontal earpiece speaker slots above the SHMOKIA badge
    const slotGeo = new THREE.CapsuleGeometry(0.032, 0.54, 4, 8);
    slotGeo.rotateZ(Math.PI / 2);
    const slotOffsets = [-0.26, -0.13, 0, 0.13, 0.26];
    const slotWidths = [0.72, 0.92, 1.0, 0.92, 0.72];

    for (let i = 0; i < slotOffsets.length; i++) {
      const slot = new THREE.Mesh(slotGeo, this.darkRecessMat);
      slot.scale.set(slotWidths[i], 1, 0.6);
      slot.position.set(0, 4.38 + slotOffsets[i] * 0.72, 0.955);
      this.root.add(slot);
    }

    // Crisp silkscreen SHMOKIA badge between earpiece and screen
    const logoTex = createWordmarkTexture();
    const logoMat = new THREE.MeshStandardMaterial({
      map: logoTex,
      transparent: true,
      roughness: 0.35,
      metalness: 0.25,
    });
    const logoMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.12, 0.46), logoMat);
    logoMesh.position.set(0, 3.66, 0.962);
    this.root.add(logoMesh);
  }

  _createButton({
    id,
    width,
    height,
    radius = 0.2,
    depth = 0.14,
    x,
    y,
    z = 0.84,
    rotZ = 0,
    labelOptions,
    emissiveGlow = true,
  }) {
    const shape = createRoundedRectShape(width, height, radius);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.055,
      bevelSize: 0.045,
      bevelSegments: 4,
      curveSegments: 14,
    });

    // Normalize top-face UVs cleanly onto [0..1] x [0..1] for crisp printed legends
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const spanX = bb.max.x - bb.min.x || 1;
    const spanY = bb.max.y - bb.min.y || 1;
    const uvAttr = geo.attributes.uv;
    const posAttr = geo.attributes.position;
    for (let i = 0; i < uvAttr.count; i++) {
      const px = posAttr.getX(i);
      const py = posAttr.getY(i);
      uvAttr.setXY(i, (px - bb.min.x) / spanX, (py - bb.min.y) / spanY);
    }
    uvAttr.needsUpdate = true;

    const topTex = createKeyLabelTexture(labelOptions);
    const topMat = new THREE.MeshStandardMaterial({
      map: topTex,
      roughness: 0.34,
      metalness: 0.12,
      emissive: new THREE.Color(emissiveGlow ? 0x3b6e12 : 0x000000),
      emissiveIntensity: emissiveGlow ? 0.14 : 0.0,
    });
    const sideMat = new THREE.MeshStandardMaterial({
      color: 0xb7c0ce,
      roughness: 0.4,
      metalness: 0.15,
      emissive: new THREE.Color(emissiveGlow ? 0x62b81f : 0x000000),
      emissiveIntensity: emissiveGlow ? 0.25 : 0.0,
    });

    const mesh = new THREE.Mesh(geo, [topMat, sideMat]);
    mesh.position.set(x, y, z);
    mesh.rotation.z = rotZ;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.keyId = id;

    // Subtle green-lit key-well rim sitting cleanly inside the faceplate cutout beneath each numeric key
    if (emissiveGlow) {
      const collarShape = createRoundedRectShape(width + 0.12, height + 0.12, radius + 0.04);
      const collarGeo = new THREE.ShapeGeometry(collarShape, 12);
      const collar = new THREE.Mesh(collarGeo, this.ledBedMat);
      collar.position.set(x, y, 0.824);
      collar.rotation.z = rotZ;
      this.root.add(collar);
    }

    this.root.add(mesh);
    this.interactiveMeshes.push(mesh);

    // Forgiving invisible touch-hit plane slightly larger than keycap for reliable mobile finger taps
    const padX = id === 'up' || id === 'down' ? 0.14 : 0.18;
    const padY = id === 'up' || id === 'down' ? 0.22 : 0.20;
    const hitPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(width + padX, height + padY),
      this.hitColliderMat,
    );
    hitPlane.position.set(x, y, z + depth + 0.065);
    hitPlane.rotation.z = rotZ;
    hitPlane.userData.keyId = id;
    this.root.add(hitPlane);
    this.hitMeshes.push(hitPlane);

    this.keys.set(id, {
      mesh,
      restZ: z,
      press: 0,
      topMat,
      sideMat,
      emissiveGlow,
    });
  }

  _buildKeypad() {
    // 1. Center Navi key (Start / Select / Pause) aligned directly beneath the LCD softkey
    this._createButton({
      id: 'select',
      width: 1.66,
      height: 0.44,
      radius: 0.21,
      depth: 0.13,
      x: 0,
      y: 0.62,
      z: 0.91,
      labelOptions: { isNavi: true, accent: '#2c5da1' },
      emissiveGlow: false,
    });

    // 2. Left 'C' key (Back / Pause) following the lower-left silver bezel arc
    this._createButton({
      id: 'back',
      width: 0.86,
      height: 0.40,
      radius: 0.19,
      depth: 0.12,
      x: -0.98,
      y: -0.01,
      z: 0.90,
      rotZ: -0.26,
      labelOptions: { primary: 'C', fg: '#23314a', bg: '#cfd6e0' },
      emissiveGlow: false,
    });

    // 3. Right diagonal scroll rocker: ergonomically ▼ (Down) sits lower-inner, ▲ (Up) sits upper-outer
    this._createButton({
      id: 'down',
      width: 0.70,
      height: 0.38,
      radius: 0.18,
      depth: 0.12,
      x: 0.46,
      y: -0.12,
      z: 0.90,
      rotZ: 0.18,
      labelOptions: { primary: '__arrow_down__', fg: '#23314a', bg: '#cfd6e0' },
      emissiveGlow: false,
    });
    this._createButton({
      id: 'up',
      width: 0.70,
      height: 0.38,
      radius: 0.18,
      depth: 0.12,
      x: 1.26,
      y: 0.14,
      z: 0.90,
      rotZ: 0.36,
      labelOptions: { primary: '__arrow_up__', fg: '#23314a', bg: '#cfd6e0' },
      emissiveGlow: false,
    });

    // 4. Classic 3x4 Numeric Keypad with dual Latin + Cyrillic legends
    const rows = [
      [
        { id: '1', primary: '1', secondary: '__voicemail__' },
        { id: '2', primary: '2', secondary: 'abc', cyrillic: 'абвг', dirHint: 'up' },
        { id: '3', primary: '3', secondary: 'def', cyrillic: 'дежз' },
      ],
      [
        { id: '4', primary: '4', secondary: 'ghi', cyrillic: 'ийкл', dirHint: 'left' },
        { id: '5', primary: '5', secondary: 'jkl', cyrillic: 'мноп', dirHint: 'center' },
        { id: '6', primary: '6', secondary: 'mno', cyrillic: 'рсту', dirHint: 'right' },
      ],
      [
        { id: '7', primary: '7', secondary: 'pqrs', cyrillic: 'фхцч' },
        { id: '8', primary: '8', secondary: 'tuv', cyrillic: 'шщъы', dirHint: 'down' },
        { id: '9', primary: '9', secondary: 'wxyz', cyrillic: 'ьэюя' },
      ],
      [
        { id: 'star', primary: '*', secondary: '__plus__' },
        { id: '0', primary: '0', secondary: '__space__' },
        { id: 'hash', primary: '#', secondary: '__shift__' },
      ],
    ];

    const colX = [-1.24, 0, 1.24];
    const rowY = [-1.12, -2.06, -3.02, -3.98];

    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < 3; c++) {
        const spec = rows[r][c];
        // Iconic 3310 gentle curve: outer columns sit slightly higher and tilted inward
        const isOuter = c !== 1;
        const curveY = isOuter ? 0.11 : -0.04;
        const tilt = c === 0 ? -0.10 : c === 2 ? 0.10 : 0;

        this._createButton({
          id: spec.id,
          width: 0.98,
          height: 0.56,
          radius: 0.22,
          depth: 0.12,
          x: colX[c],
          y: rowY[r] + curveY,
          z: 0.82,
          rotZ: tilt,
          labelOptions: {
            primary: spec.primary,
            secondary: spec.secondary,
            cyrillic: spec.cyrillic ?? '',
            dirHint: spec.dirHint ?? '',
          },
          emissiveGlow: true,
        });
      }
    }
  }

  _buildBackDetails() {
    // Subtle rear battery cover seam + release latch notch for 3D Orbit inspection
    const seamShape = createRoundedRectShape(3.52, 6.4, 0.72);
    const seamGeo = new THREE.ExtrudeGeometry(seamShape, {
      depth: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
      curveSegments: 18,
    });
    const seamMesh = new THREE.Mesh(seamGeo, this.backMat);
    seamMesh.position.set(0, -1.25, -1.19);
    this.root.add(seamMesh);

    // Battery release push button on upper rear
    const latch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.30, 0.08, 20),
      this.sideTrimMat,
    );
    latch.rotation.x = Math.PI / 2;
    latch.position.set(0, 2.72, -1.18);
    this.root.add(latch);
  }

  triggerKeyPress(keyId) {
    const entry = this.keys.get(keyId);
    if (!entry) return;
    entry.press = 1.0;
  }

  update(dtSec) {
    // Upload updated 84x48 persistence buffer to GPU
    this.lcdTexture.needsUpdate = true;

    // Smoothly transition backlight LED state
    const ledLerp = 1 - Math.exp(-dtSec * 12);
    this.backlightValue += (this.backlightTarget - this.backlightValue) * ledLerp;

    this.lcdMat.uniforms.uBacklight.value = this.backlightValue;

    // Sync keypad backlight glow with LCD backlight LED
    this.ledBedMat.emissiveIntensity = 0.05 + this.backlightValue * 0.78;

    // Animate 3D physical key travel & LED translucency
    const keyDecay = Math.exp(-dtSec * 18);
    for (const entry of this.keys.values()) {
      if (entry.press > 0.001) {
        entry.press *= keyDecay;
        if (entry.press < 0.004) entry.press = 0;
      }
      entry.mesh.position.z = entry.restZ - entry.press * 0.095;
      if (entry.emissiveGlow) {
        entry.topMat.emissiveIntensity = 0.02 + this.backlightValue * 0.14;
        entry.sideMat.emissiveIntensity = 0.02 + this.backlightValue * 0.28;
      }
    }
  }
}
