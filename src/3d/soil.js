// Excavation heightfield: a dense grid of soil heights that tools lower locally.
// Strata are coloured per pixel from world height, so pit walls show the layer bands.
import * as THREE from 'three';

export const PIT = {
  w: 4.6, d: 3.4, step: 0.04, // heightfield extent (m) and vertex spacing
  digX: 2.0, digZ: 1.4,       // diggable half-extents; the rim outside stays at ground level
  maxDepth: 0.7,
};

export const STRATA = [
  { name: '松散坡积物', top: 0, hex: 0xb39270 },
  { name: '红色砂岩', top: -0.1, hex: 0xa65a3e },
  { name: '化石层 · 紫红泥岩', top: -0.34, hex: 0x82554c },
];

export function stratumAt(y) {
  for (let i = STRATA.length - 1; i >= 0; i--) if (y <= STRATA[i].top) return i;
  return 0;
}

// How much of a tool's nominal removal survives in each stratum (loose / sandstone / fossil layer).
export const HARDNESS = {
  trowel: [1, 0.7, 0.55],
  brush: [1, 0.45, 0.5],
  pick: [0.6, 1, 1],
};

const ZONE_NONE = 0, ZONE_BONE = 1, ZONE_EDGE = 2;
export const ZONE = { NONE: ZONE_NONE, BONE: ZONE_BONE, EDGE: ZONE_EDGE };

export class Soil {
  constructor() {
    const { w, d, step, digX, digZ, maxDepth } = PIT;
    this.nx = Math.round(w / step);
    this.nz = Math.round(d / step);
    const N = (this.nx + 1) * (this.nz + 1);
    this.h = new Float32Array(N);
    this.floor = new Float32Array(N);
    this.hardTop = new Float32Array(N).fill(-Infinity);   // trowel must stay 3 cm above this
    this.brushLimit = new Float32Array(N).fill(-Infinity); // brush cannot clean below this (edge matrix)
    this.zone = new Uint8Array(N);
    this.owner = new Int8Array(N).fill(-1);
    this.removedVolume = 0;

    const geo = new THREE.PlaneGeometry(w, d, this.nx, this.nz);
    geo.rotateX(-Math.PI / 2); // row 0 ends up at z = -d/2
    const pos = geo.attributes.position;
    const colors = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const inside = Math.abs(x) < digX && Math.abs(z) < digZ;
      // gentle trampled-surface bumps inside the grid, flat rim so it meets the ground plane
      const edge = Math.min(digX - Math.abs(x), digZ - Math.abs(z));
      const bump = inside ? (Math.sin(x * 5.3 + z * 2.1) * 0.5 + Math.sin(z * 7.7 - x * 3.4) * 0.5) * 0.012 * Math.min(1, edge / 0.25) : 0;
      this.h[i] = bump;
      this.floor[i] = inside ? -maxDepth : bump;
      pos.setY(i, bump);
      const j = 0.93 + Math.random() * 0.1;
      colors.set([j, j, j], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    geo.boundingSphere.radius += 1;
    this.geometry = geo;
    this.mesh = new THREE.Mesh(geo, strataMaterial());
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    this.mesh.name = 'soil';
  }

  index(ix, iz) { return iz * (this.nx + 1) + ix; }
  vx(ix) { return -PIT.w / 2 + ix * PIT.step; }
  vz(iz) { return -PIT.d / 2 + iz * PIT.step; }
  inPit(x, z) { return Math.abs(x) <= PIT.w / 2 && Math.abs(z) <= PIT.d / 2; }
  inDigArea(x, z) { return Math.abs(x) < PIT.digX && Math.abs(z) < PIT.digZ; }

  heightAt(x, z) {
    if (!this.inPit(x, z)) return 0;
    const fx = (x + PIT.w / 2) / PIT.step, fz = (z + PIT.d / 2) / PIT.step;
    const ix = Math.min(this.nx - 1, Math.floor(fx)), iz = Math.min(this.nz - 1, Math.floor(fz));
    const tx = fx - ix, tz = fz - iz;
    const h = this.h;
    const a = h[this.index(ix, iz)], b = h[this.index(ix + 1, iz)];
    const c = h[this.index(ix, iz + 1)], d = h[this.index(ix + 1, iz + 1)];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }

  // March along a ray until it dips under the heightfield. Cheaper than triangle raycasting.
  raycast(ray) {
    const o = ray.origin, dir = ray.direction;
    if (dir.y >= 0) return null;
    const tStart = Math.max(0, (0.1 - o.y) / dir.y);
    const tEnd = (-PIT.maxDepth - 0.05 - o.y) / dir.y;
    const p = new THREE.Vector3();
    let prevT = tStart, prevDiff = Infinity;
    for (let t = tStart; t <= tEnd; t += 0.01) {
      p.copy(dir).multiplyScalar(t).add(o);
      if (!this.inPit(p.x, p.z)) { prevDiff = Infinity; prevT = t; continue; }
      const diff = p.y - this.heightAt(p.x, p.z);
      if (diff <= 0) {
        // refine between the last two samples
        const k = prevDiff === Infinity ? 1 : prevDiff / (prevDiff - diff);
        p.copy(dir).multiplyScalar(prevT + (t - prevT) * k).add(o);
        p.y = this.heightAt(p.x, p.z);
        return p;
      }
      prevDiff = diff; prevT = t;
    }
    return null;
  }

  /**
   * Lower the soil around (x, z) with a cosine falloff brush.
   * Returns the removed volume (m³) and, for vertices where a fossil stopped the tool,
   * how many sat over bone vs. edge matrix and which fossils they belong to.
   */
  carve(x, z, radius, amount, tool) {
    const { step } = PIT;
    const hard = HARDNESS[tool];
    const ix0 = Math.max(0, Math.floor((x - radius + PIT.w / 2) / step));
    const ix1 = Math.min(this.nx, Math.ceil((x + radius + PIT.w / 2) / step));
    const iz0 = Math.max(0, Math.floor((z - radius + PIT.d / 2) / step));
    const iz1 = Math.min(this.nz, Math.ceil((z + radius + PIT.d / 2) / step));
    const pos = this.geometry.attributes.position;
    let removed = 0, hitBone = 0, hitEdge = 0;
    const owners = new Set();
    for (let iz = iz0; iz <= iz1; iz++) {
      for (let ix = ix0; ix <= ix1; ix++) {
        const dist = Math.hypot(this.vx(ix) - x, this.vz(iz) - z);
        if (dist > radius) continue;
        const i = this.index(ix, iz);
        const h = this.h[i];
        const f = 0.5 + 0.5 * Math.cos(Math.PI * dist / radius);
        let limit = this.floor[i];
        let fossilLimit = -Infinity;
        if (tool === 'trowel') fossilLimit = this.hardTop[i] + 0.03;
        else if (tool === 'brush') fossilLimit = this.brushLimit[i];
        limit = Math.max(limit, fossilLimit);
        const target = Math.max(Math.min(h, limit), h - amount * f * hard[stratumAt(h)]);
        if (this.zone[i] !== ZONE_NONE && fossilLimit === limit && h - limit < 0.004 && f > 0.4) {
          if (this.zone[i] === ZONE_BONE) hitBone++; else hitEdge++;
          owners.add(this.owner[i]);
        }
        if (target < h) {
          removed += (h - target) * step * step;
          this.h[i] = target;
          pos.setY(i, target);
        }
      }
    }
    if (removed > 0) {
      pos.needsUpdate = true;
      this.geometry.computeVertexNormals();
      this.removedVolume += removed;
    }
    return { removed, hitBone, hitEdge, owners };
  }

  /** Register a buried fossil from its footprint samples [{i, top, bot}] (bone surface heights per grid vertex). */
  addFossil(fi, samples) {
    const bone = new Set();
    for (const { i, top, bot } of samples) {
      // the bone rests half-embedded: soil can never be removed below its mid-line
      const mid = Math.min((top + bot) / 2, top - 0.02);
      this.zone[i] = ZONE_BONE;
      this.owner[i] = fi;
      this.floor[i] = Math.max(this.floor[i], mid);
      this.hardTop[i] = Math.max(this.hardTop[i], top);
      bone.add(i);
    }
    // Edge band: 2 vertices (~8 cm) of matrix around the bone that only the bamboo pick removes.
    const edgeTop = new Map();
    let frontier = samples.map(s => [s.i, s.top, Math.min((s.top + s.bot) / 2, s.top - 0.06)]);
    for (let ring = 1; ring <= 2; ring++) {
      const next = [];
      for (const [i, top, mid] of frontier) {
        const ix = i % (this.nx + 1), iz = (i / (this.nx + 1)) | 0;
        for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const jx = ix + ax, jz = iz + az;
          if (jx < 0 || jz < 0 || jx > this.nx || jz > this.nz) continue;
          const j = this.index(jx, jz);
          if (bone.has(j) || edgeTop.has(j) || this.zone[j] === ZONE_BONE) continue;
          edgeTop.set(j, [top, mid]);
          next.push([j, top, mid]);
        }
      }
      frontier = next;
    }
    const edges = [];
    for (const [i, [top, mid]] of edgeTop) {
      this.zone[i] = ZONE_EDGE;
      this.owner[i] = fi;
      this.hardTop[i] = Math.max(this.hardTop[i], top);
      this.brushLimit[i] = Math.max(this.brushLimit[i], top);
      this.floor[i] = Math.max(this.floor[i], mid);
      edges.push({ i, top });
    }
    return edges;
  }
}

function strataMaterial() {
  const lin = hex => new THREE.Color(hex);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
  mat.onBeforeCompile = shader => {
    shader.uniforms.uC0 = { value: lin(STRATA[0].hex) };
    shader.uniforms.uC1 = { value: lin(STRATA[1].hex) };
    shader.uniforms.uC2 = { value: lin(STRATA[2].hex) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform vec3 uC0, uC1, uC2;')
      .replace('#include <color_fragment>', `
        float y = vWPos.y + sin(vWPos.x * 2.3 + vWPos.z * 1.7) * 0.012; // slightly wavy contacts
        float t1 = 1.0 - smoothstep(${(STRATA[1].top - 0.02).toFixed(3)}, ${(STRATA[1].top + 0.02).toFixed(3)}, y);
        float t2 = 1.0 - smoothstep(${(STRATA[2].top - 0.02).toFixed(3)}, ${(STRATA[2].top + 0.02).toFixed(3)}, y);
        vec3 strata = mix(mix(uC0, uC1, t1), uC2, t2);
        float bedding = sin(y * 150.0 + sin(vWPos.x * 3.1) * 1.2);
        strata *= 1.0 + 0.07 * bedding * t1 * (1.0 - t2) + 0.035 * sin(y * 70.0) * t2;
        diffuseColor.rgb *= strata * vColor;
      `);
  };
  return mat;
}
