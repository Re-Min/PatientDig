// Model framing helpers shared by the dig site and the home-page map.
import * as THREE from 'three';

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
