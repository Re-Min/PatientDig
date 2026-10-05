// Static surroundings: terrain with a red-sandstone cut slope, survey grid, canopy, toolbox, sign, shrubs.
import * as THREE from 'three';
import { PIT, STRATA } from './soil.js';
import { enableShadows, normalize } from './assets.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Ground height outside the pit. Flat around the excavation, a man-made cut slope behind it (-z), rolling hills beyond.
export function terrainHeight(x, z) {
  const zc = z + 0.035 * x * x;              // slope wraps slightly around the pit
  const cut = smooth(-2.7, -3.25, zc) * 1.9;  // steep artificial cut face
  const hill = smooth(-3.2, -9, zc) * 1.4;    // gentle hill above the cut
  const noise = Math.sin(x * 0.7) * Math.cos(z * 0.6) * 0.25 + Math.sin(x * 1.9 + z * 1.3) * 0.06;
  const far = smooth(4.5, 9, Math.hypot(x, z * 1.2));
  const nearPit = Math.max(Math.abs(x) - PIT.w / 2, Math.abs(z) - PIT.d / 2);
  const flatten = smooth(0.4, 1.6, nearPit);
  return (cut + hill) * smooth(-2.6, -3.0, zc) + (noise * far + far * 0.15 * Math.sin(x * 0.3)) * flatten;
}

function terrainMaterial() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0 });
  mat.onBeforeCompile = shader => {
    shader.uniforms.uPit = { value: new THREE.Vector2(PIT.w / 2 - 0.005, PIT.d / 2 - 0.005) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNorm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz; vWNorm = normalize(mat3(modelMatrix) * objectNormal);');
    const c = h => new THREE.Color(h);
    const v3 = col => `vec3(${col.r.toFixed(4)},${col.g.toFixed(4)},${col.b.toFixed(4)})`;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNorm; uniform vec2 uPit;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (abs(vWPos.x) < uPit.x && abs(vWPos.z) < uPit.y) discard;`)
      .replace('#include <color_fragment>', `
        vec3 grass = mix(${v3(c(0x8a9868))}, ${v3(c(0x9fa877))}, 0.5 + 0.5 * sin(vWPos.x * 1.7) * sin(vWPos.z * 2.1));
        float bands = sin(vWPos.y * 9.0 + sin(vWPos.x * 0.8) * 0.8);
        vec3 rock = mix(${v3(c(STRATA[1].hex))}, ${v3(c(0xb9714f))}, 0.5 + 0.5 * bands);
        rock = mix(rock, ${v3(c(0x8c5d4d))}, step(0.75, fract(vWPos.y * 1.3 + 0.2)) * 0.6);
        float steep = 1.0 - smoothstep(0.55, 0.8, vWNorm.y);
        float d = max(abs(vWPos.x) - uPit.x, abs(vWPos.z) - uPit.y);
        vec3 trampled = ${v3(c(STRATA[0].hex))};
        vec3 col = mix(trampled, grass, smoothstep(0.25, 1.4, d + sin(vWPos.x * 3.0 + vWPos.z * 2.0) * 0.15));
        col = mix(col, rock, steep);
        diffuseColor.rgb *= col * vColor;`);
  };
  return mat;
}

function buildTerrain() {
  const size = 44, seg = 176;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
    const j = 0.92 + Math.random() * 0.12;
    colors.set([j, j, j], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, terrainMaterial());
  mesh.receiveShadow = true; // no castShadow: the discard hole would not apply to the shadow pass
  mesh.name = 'terrain';
  return mesh;
}

const clay = hex => new THREE.MeshStandardMaterial({ color: hex, roughness: 1, metalness: 0 });

function shrub(x, z, s) {
  const g = new THREE.Group();
  const greens = [0x6f8461, 0x7b8f68, 0x667a5a];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22 * s, 1), clay(greens[i % 3]));
    m.position.set((Math.random() - 0.5) * 0.45 * s, (0.18 + Math.random() * 0.25) * s, (Math.random() - 0.5) * 0.4 * s);
    m.scale.y = 1.2;
    g.add(m);
  }
  g.position.set(x, terrainHeight(x, z), z);
  return enableShadows(g);
}

function rock(x, z, s) {
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 * s, 0), clay(0xa97a5e));
  m.scale.set(1.3, 0.7, 1);
  m.rotation.set(Math.random(), Math.random() * 6, Math.random() * 0.4);
  m.position.set(x, terrainHeight(x, z) + 0.04 * s, z);
  return enableShadows(m);
}

// Label tones share the page's tokens (see 3d.html :root): paper card, moss info chip, sun call-to-action.
const LABEL_TONE = {
  paper: { bg: 'rgba(255,253,246,0.95)', line: '#ded9c9', color: '#29352f', dot: '#697b59' },
  moss: { bg: 'rgba(70,88,66,0.9)', line: 'rgba(255,253,240,0.25)', color: '#fffdf0', dot: '#e7bd68' },
  sun: { bg: 'rgba(252,248,233,0.97)', line: '#e7bd68', color: '#796943', dot: '#e7bd68' },
};

export function textSprite(text, { size = 0.16, tone = 'paper', dot = false, font = '800 44px Nunito, "Microsoft YaHei", sans-serif' } = {}) {
  const t = LABEL_TONE[tone];
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = font;
  const pad = 22, lead = dot ? 26 : 0, h = 72;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2 + lead;
  c.width = w; c.height = h;
  ctx.font = font;
  ctx.fillStyle = t.bg;
  ctx.strokeStyle = t.line; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(1.5, 1.5, w - 3, h - 3, 22); ctx.fill(); ctx.stroke();
  if (dot) {
    ctx.fillStyle = t.dot;
    ctx.beginPath(); ctx.arc(pad + 8, h / 2, 8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = t.color; ctx.textBaseline = 'middle';
  ctx.fillText(text, pad + lead, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(size * w / h, size, 1);
  sprite.renderOrder = 10;
  return sprite;
}

export function buildWorld(scene, models) {
  scene.add(buildTerrain());

  // survey grid: stakes at the dig-area corners and midpoints joined by orange string
  const { digX, digZ } = PIT;
  const pts = [[-digX, -digZ], [0, -digZ], [digX, -digZ], [digX, digZ], [0, digZ], [-digX, digZ]].map(([x, z]) => [x + Math.sign(x || 1) * 0.06 * (x ? 1 : 0), z + Math.sign(z) * 0.06]);
  const stakeTop = 0.3;
  const stringMat = new THREE.MeshStandardMaterial({ color: 0xe0752f, roughness: 0.8 });
  pts.forEach(([x, z], i) => {
    const s = normalize(models.grid_stake.scene.clone(), { size: 0.38, anchor: 'bottom' });
    s.position.set(x, -0.06, z);
    s.rotation.y = i * 1.3;
    scene.add(enableShadows(s));
  });
  const ring = [...pts, pts[0]];
  for (let i = 0; i < ring.length - 1; i++) {
    const a = new THREE.Vector3(ring[i][0], stakeTop, ring[i][1]);
    const b = new THREE.Vector3(ring[i + 1][0], stakeTop, ring[i + 1][1]);
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, len, 4), stringMat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    scene.add(m);
  }
  // grid cell labels along the front string
  ['A', 'B'].forEach((t, i) => {
    const l = textSprite(t, { size: 0.12 });
    l.position.set((i - 0.5) * digX, stakeTop + 0.12, digZ + 0.08);
    scene.add(l);
  });

  const canopy = normalize(models.canopy.scene, { size: 2.3, anchor: 'bottom' });
  canopy.position.set(3.9, terrainHeight(3.9, -0.6), -0.6);
  canopy.rotation.y = -0.35;
  scene.add(enableShadows(canopy));

  const toolbox = normalize(models.toolbox.scene, { size: 0.55, anchor: 'bottom' });
  toolbox.position.set(3.55, 0, -0.3);
  toolbox.rotation.y = -0.9;
  scene.add(enableShadows(toolbox));

  const sign = normalize(models.site_sign.scene, { size: 0.95, anchor: 'bottom' });
  sign.position.set(-3.0, 0, 1.95);
  sign.rotation.y = 0.5;
  scene.add(enableShadows(sign)); // no floating label: it sits at the screen edge, and the HUD already names the site

  [[-4.2, -1.8, 1.3], [4.6, 2.3, 1], [-4.8, 2.6, 0.9], [2.2, -3.0, 1.1], [-1.8, -3.2, 1.2], [5.6, -2.0, 1.4], [-6, -0.5, 1.2]]
    .forEach(([x, z, s]) => scene.add(shrub(x, z, s)));
  [[2.8, 2.1, 1], [-2.7, -2.0, 1.3], [3.1, 1.5, 0.6], [-3.4, 0.4, 0.8], [1.2, 2.4, 0.7]]
    .forEach(([x, z, s]) => scene.add(rock(x, z, s)));
}
