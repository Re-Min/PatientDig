// Buried fossil specimens: real Tripo meshes placed under the heightfield, exposure tracked from the soil.
import * as THREE from 'three';
import { PIT } from './soil.js';
import { enableShadows, normalize } from './assets.js';

// Gameplay layout (positions are a game arrangement; species, site and story follow published accounts).
export const SPECIMENS = [
  {
    id: 'heping_yangchuanosaurus_vertebra_01', model: 'vertebra', element: '椎体', size: 0.5,
    position: [-0.55, 0, 0.15], yaw: -0.6, tilt: 0, top: -0.04, // small first specimen: a quick, readable introduction to the workflow
    relation: 'tail-series', clue: '椎体关节面朝向尾椎一侧，位置关系有助于确认骨骼序列。',
  },
  {
    id: 'heping_yangchuanosaurus_tail_02', model: 'tail_vertebrae', element: '尾椎', size: 1.15,
    position: [0.55, 0, -0.45], yaw: 0.35, tilt: 0.22, top: -0.36,
    relation: 'tail-series', clue: '串珠状关节轮廓连成一列，是连续的尾椎。',
  },
  {
    id: 'heping_yangchuanosaurus_rib_03', model: 'rib', element: '肋骨片段', size: 0.85,
    position: [0.95, 0, 0.55], yaw: 2.4, tilt: 0, top: -0.4,
    relation: 'torso', clue: '弧形肋骨片段，与椎体需要分别编号、记录。',
  },
  {
    id: 'heping_yangchuanosaurus_frag_04', model: 'bone_fragment', element: '零散骨片', size: 0.38,
    position: [-1.35, 0, -0.75], yaw: 1.1, tilt: 0, top: -0.38,
    relation: 'isolated', clue: '保存不完整的骨质碎片，是否属于同一个体仍需后续修理判断。',
  },
].map(s => ({
  species: '和平永川龙', latin: 'Yangchuanosaurus hepingensis', preservation: 'good', hardness: 'mudstone',
  exposure: 0, edgeClear: 0, state: 'buried', ...s,
}));

const DIRT = new THREE.Color(0x8a6a58);
const WHITE = new THREE.Color(1, 1, 1);

export class Fossils {
  constructor(scene, soil, models) {
    this.soil = soil;
    this.list = SPECIMENS.map((spec, fi) => {
      const pivot = normalize(models[spec.model].scene.clone(), { up: 'thin', size: spec.size });
      pivot.rotation.set(0, spec.yaw, spec.tilt, 'YXZ');
      const materials = [];
      pivot.traverse(o => {
        if (o.isMesh) {
          o.material = o.material.clone();
          o.material.color.copy(DIRT);
          o.material.emissive = new THREE.Color(0xffd27a);
          o.material.emissiveIntensity = 0;
          o.userData.fossil = fi;
          materials.push(o.material);
        }
      });
      enableShadows(pivot);
      pivot.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(pivot);
      pivot.position.set(spec.position[0], spec.top - box.max.y, spec.position[2]);
      pivot.updateMatrixWorld(true);
      scene.add(pivot);
      const f = { spec, pivot, materials, samples: [], edges: [], highlight: 0 };
      this.footprint(f, fi);
      return f;
    });
    this.meshes = [];
    this.list.forEach(f => f.pivot.traverse(o => { if (o.isMesh) this.meshes.push(o); }));
  }

  // Bin the mesh's world-space vertices onto the soil grid to find the bone's top surface per grid vertex.
  footprint(f, fi) {
    const soil = this.soil;
    const top = new Map(), bot = new Map();
    let bottom = Infinity;
    const v = new THREE.Vector3();
    f.pivot.traverse(o => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        v.fromBufferAttribute(pos, k).applyMatrix4(o.matrixWorld);
        bottom = Math.min(bottom, v.y);
        const ix = Math.round((v.x + PIT.w / 2) / PIT.step), iz = Math.round((v.z + PIT.d / 2) / PIT.step);
        if (ix < 0 || iz < 0 || ix > soil.nx || iz > soil.nz) continue;
        const i = soil.index(ix, iz);
        if (!(top.get(i) >= v.y)) top.set(i, v.y);
        if (!(bot.get(i) <= v.y)) bot.set(i, v.y);
      }
    });
    f.samples = [...top].map(([i, t]) => ({ i, top: t, bot: bot.get(i) }));
    f.bottom = bottom;
    f.edges = soil.addFossil(fi, f.samples);
  }

  /** Recompute exposure from the soil. Returns fossils whose state changed. */
  update() {
    const h = this.soil.h;
    const changed = [];
    for (const f of this.list) {
      // bare: bone surface showing; near: only a skin of soil left (the trowel has been stopped by it)
      let bare = 0, near = 0;
      for (const s of f.samples) {
        if (h[s.i] < s.top - 0.004) bare++;
        if (h[s.i] < s.top + 0.035) near++;
      }
      let clear = 0;
      for (const s of f.edges) if (h[s.i] < s.top - 0.025) clear++;
      const spec = f.spec;
      spec.exposure = bare / f.samples.length;
      spec.edgeClear = f.edges.length ? clear / f.edges.length : 1;
      // dirt on the bone washes off as it gets brushed
      const clean = Math.min(1, spec.exposure * 1.3);
      for (const m of f.materials) m.color.copy(DIRT).lerp(WHITE, clean);
      const prev = spec.state;
      if (spec.state === 'buried' && (spec.exposure > 0.03 || near / f.samples.length > 0.15)) spec.state = 'glimpsed';
      if (spec.state === 'glimpsed' && spec.exposure > 0.7) spec.state = 'exposed';
      // Stop at a practical 98% surface exposure: the last tiny grid cells can be
      // unreachable because of the heightfield sampling and should not block play.
      if (spec.state === 'exposed' && spec.exposure >= 0.98) spec.state = 'freed';
      if (spec.state !== prev) changed.push(f);
    }
    return changed;
  }

  centerOf(f) {
    return new THREE.Box3().setFromObject(f.pivot).getCenter(new THREE.Vector3());
  }

  tick(t, hovered) {
    for (const [fi, f] of this.list.entries()) {
      const target = f.spec.state === 'freed' ? (hovered === fi ? 0.55 : 0.12 + 0.1 * Math.sin(t * 4)) : 0;
      f.highlight += (target - f.highlight) * 0.15;
      for (const m of f.materials) m.emissiveIntensity = f.highlight;
    }
  }
}
