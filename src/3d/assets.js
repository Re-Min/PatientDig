// Tripo-generated GLBs (optimized by tools/optimize_glb.py), inlined by esbuild so the page works from file://.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

import archaeologist from '../../assets/opt/archaeologist.glb';
import trowel from '../../assets/opt/trowel.glb';
import brush from '../../assets/opt/brush.glb';
import bamboo_pick from '../../assets/opt/bamboo_pick.glb';
import tail_vertebrae from '../../assets/opt/tail_vertebrae.glb';
import vertebra from '../../assets/opt/vertebra.glb';
import rib from '../../assets/opt/rib.glb';
import bone_fragment from '../../assets/opt/bone_fragment.glb';
import yangchuanosaurus from '../../assets/opt/yangchuanosaurus.glb';
import canopy from '../../assets/opt/canopy.glb';
import toolbox from '../../assets/opt/toolbox.glb';
import site_sign from '../../assets/opt/site_sign.glb';
import grid_stake from '../../assets/opt/grid_stake.glb';
import animIdle from '../../assets/opt/anim/idle.glb';
import animDig from '../../assets/opt/anim/dig.glb';
import animShovel from '../../assets/opt/anim/shovel.glb';
import animCheer from '../../assets/opt/anim/cheer.glb';
import animWalk from '../../assets/opt/anim/walk.glb';

export const MODELS = {
  archaeologist, trowel, brush, bamboo_pick, tail_vertebrae, vertebra, rib, bone_fragment,
  yangchuanosaurus, canopy, toolbox, site_sign, grid_stake,
};
export const ANIMS = { idle: animIdle, dig: animDig, shovel: animShovel, cheer: animCheer, walk: animWalk };

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

function parse(bytes) {
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return loader.parseAsync(buf, '');
}

// Loads every model and animation clip; onProgress(done, total) drives the loading bar.
export async function loadAll(onProgress = () => {}) {
  const entries = [...Object.entries(MODELS), ...Object.entries(ANIMS).map(([k, v]) => ['anim:' + k, v])];
  let done = 0;
  const out = { models: {}, clips: {} };
  await Promise.all(entries.map(async ([name, bytes]) => {
    const gltf = await parse(bytes);
    if (name.startsWith('anim:')) {
      const clip = gltf.animations[0];
      clip.name = name.slice(5);
      out.clips[clip.name] = clip;
    } else {
      out.models[name] = gltf;
    }
    onProgress(++done, entries.length);
  }));
  await MeshoptDecoder.ready;
  return out;
}

export function enableShadows(root, cast = true, receive = true) {
  root.traverse(o => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
  return root;
}

const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];

/**
 * Wraps a model in a pivot group so that it has a predictable frame:
 *  - `up`: 'thin' rotates the thinnest bbox axis to +Y (lay bones flat); 'span' aligns lowest→highest vertex
 *    with +Y (straightens a diagonal stick). Most Tripo tools already export Y-up with the working end down.
 *  - `size`: target length of the longest dimension in metres.
 *  - `anchor`: 'center' centres the bbox on the origin, 'bottom' puts the bbox floor on y=0.
 *  - `flip`: rotate 180° around X afterwards (swap which end of a tool points down).
 * Returns the pivot; the original scene sits inside it.
 */
export function normalize(object, { up = null, size = 1, anchor = 'center', flip = false } = {}) {
  const inner = new THREE.Group();
  inner.add(object);
  let box = new THREE.Box3().setFromObject(object);
  const dims = box.getSize(new THREE.Vector3()).toArray();
  if (up === 'thin') {
    const axis = [0, 1, 2].sort((a, b) => dims[a] - dims[b])[0];
    if (axis !== 1) inner.quaternion.setFromUnitVectors(AXES[axis], AXES[1]);
  } else if (up === 'span') {
    const lo = new THREE.Vector3(0, Infinity, 0), hi = new THREE.Vector3(0, -Infinity, 0), v = new THREE.Vector3();
    object.updateMatrixWorld(true);
    object.traverse(o => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        v.fromBufferAttribute(pos, k).applyMatrix4(o.matrixWorld);
        if (v.y < lo.y) lo.copy(v);
        if (v.y > hi.y) hi.copy(v);
      }
    });
    inner.quaternion.setFromUnitVectors(hi.sub(lo).normalize(), AXES[1]);
  }
  if (flip) inner.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(AXES[0], Math.PI));
  inner.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(inner);
  const s = size / Math.max(...box.getSize(new THREE.Vector3()).toArray());
  inner.scale.setScalar(s);
  inner.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(inner);
  const c = box.getCenter(new THREE.Vector3());
  inner.position.sub(anchor === 'center' ? c : new THREE.Vector3(c.x, box.min.y, c.z));
  const pivot = new THREE.Group();
  pivot.add(inner);
  return pivot;
}
