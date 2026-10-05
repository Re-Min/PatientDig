// Soil chunks (instanced, with gravity and bounce) plus soft dust puffs (points) for digging feedback.
import * as THREE from 'three';

const MAX_CHUNKS = 400;
const MAX_DUST = 700;

const DUST_VS = `
attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
uniform float uScale;
varying float vAlpha; varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / -mv.z;
  vAlpha = aAlpha; vColor = aColor;
}`;
const DUST_FS = `
varying float vAlpha; varying vec3 vColor;
void main() {
  float a = smoothstep(0.5, 0.08, length(gl_PointCoord - 0.5)) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
  #include <colorspace_fragment>
}`;

export class Particles {
  constructor(scene) {
    this.chunks = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, flatShading: true }),
      MAX_CHUNKS,
    );
    this.chunks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.chunks.castShadow = true;
    this.chunks.frustumCulled = false;
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < MAX_CHUNKS; i++) this.chunks.setColorAt(i, white);
    this.chunks.count = 0;
    this.c = [];
    scene.add(this.chunks);

    const g = new THREE.BufferGeometry();
    this.dPos = new Float32Array(MAX_DUST * 3);
    this.dCol = new Float32Array(MAX_DUST * 3);
    this.dSize = new Float32Array(MAX_DUST);
    this.dAlpha = new Float32Array(MAX_DUST);
    const attr = (name, arr, n) => g.setAttribute(name, new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage));
    attr('position', this.dPos, 3);
    attr('aColor', this.dCol, 3);
    attr('aSize', this.dSize, 1);
    attr('aAlpha', this.dAlpha, 1);
    g.setDrawRange(0, 0);
    this.dustMat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 500 } },
      vertexShader: DUST_VS, fragmentShader: DUST_FS,
      transparent: true, depthWrite: false,
    });
    this.dust = new THREE.Points(g, this.dustMat);
    this.dust.frustumCulled = false;
    this.d = [];
    scene.add(this.dust);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3();
  }

  resize(heightPx, fovDeg, pixelRatio) {
    this.dustMat.uniforms.uScale.value = heightPx * pixelRatio / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
  }

  /** color: THREE.Color of the soil that was hit; power scales launch speed. */
  burst(point, color, { chunks = 6, dust = 8, power = 1, size = 1 } = {}) {
    for (let k = 0; k < chunks && this.c.length < MAX_CHUNKS; k++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.4 + Math.random() * 0.9) * power;
      this.c.push({
        p: point.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.08, 0.02, (Math.random() - 0.5) * 0.08)),
        v: new THREE.Vector3(Math.cos(a) * sp, (1.2 + Math.random() * 1.4) * power, Math.sin(a) * sp),
        rot: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(14),
        size: (0.012 + Math.random() * 0.022) * size,
        life: 0, ttl: 1.4 + Math.random() * 0.8, rest: false,
        color: color.clone().multiplyScalar(0.8 + Math.random() * 0.35),
      });
    }
    for (let k = 0; k < dust && this.d.length < MAX_DUST; k++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.05 + Math.random() * 0.25) * power;
      this.d.push({
        p: point.clone().add(new THREE.Vector3(0, 0.03, 0)),
        v: new THREE.Vector3(Math.cos(a) * sp, 0.15 + Math.random() * 0.35 * power, Math.sin(a) * sp),
        size: (0.05 + Math.random() * 0.07) * size,
        life: 0, ttl: 0.9 + Math.random() * 0.9,
        color: color.clone().lerp(new THREE.Color(0xe8dcc4), 0.45),
      });
    }
  }

  update(dt, groundAt) {
    // chunks
    let n = 0;
    for (let k = this.c.length - 1; k >= 0; k--) {
      const c = this.c[k];
      c.life += dt;
      if (c.life > c.ttl) { this.c.splice(k, 1); continue; }
      if (!c.rest) {
        c.v.y -= 9.8 * dt;
        c.p.addScaledVector(c.v, dt);
        c.rot.addScaledVector(c.spin, dt);
        const g = groundAt(c.p.x, c.p.z) + c.size * 0.6;
        if (c.p.y < g) {
          c.p.y = g;
          if (c.v.y < -0.6) { c.v.y *= -0.3; c.v.x *= 0.5; c.v.z *= 0.5; c.spin.multiplyScalar(0.5); }
          else c.rest = true;
        }
      }
    }
    for (const c of this.c) {
      const shrink = Math.min(1, (c.ttl - c.life) / 0.35);
      this._e.set(c.rot.x, c.rot.y, c.rot.z);
      this._q.setFromEuler(this._e);
      this._s.set(c.size, c.size * 0.75, c.size).multiplyScalar(shrink);
      this._m.compose(c.p, this._q, this._s);
      this.chunks.setMatrixAt(n, this._m);
      this.chunks.setColorAt(n, c.color);
      n++;
    }
    this.chunks.count = n;
    this.chunks.instanceMatrix.needsUpdate = true;
    if (this.chunks.instanceColor) this.chunks.instanceColor.needsUpdate = true;

    // dust
    let m = 0;
    for (let k = this.d.length - 1; k >= 0; k--) {
      const d = this.d[k];
      d.life += dt;
      if (d.life > d.ttl) { this.d.splice(k, 1); continue; }
      d.v.multiplyScalar(1 - 1.8 * dt);
      d.v.y += 0.05 * dt;
      d.p.addScaledVector(d.v, dt);
    }
    for (const d of this.d) {
      const q = d.life / d.ttl;
      this.dPos.set([d.p.x, d.p.y, d.p.z], m * 3);
      this.dCol.set([d.color.r, d.color.g, d.color.b], m * 3);
      this.dSize[m] = d.size * (1 + q * 2.2);
      this.dAlpha[m] = 0.55 * Math.sin(Math.PI * Math.min(1, q * 1.4 + 0.05)) * (1 - q);
      m++;
    }
    const g = this.dust.geometry;
    g.setDrawRange(0, m);
    for (const k of ['position', 'aColor', 'aSize', 'aAlpha']) g.attributes[k].needsUpdate = true;
  }
}
