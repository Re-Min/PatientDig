// Debug gallery: renders every Tripo model raw (scaled to 1 m) with axes, to check orientation.
import * as THREE from 'three';
import { loadAll, normalize } from './assets.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(1600, 900);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdddddd);
scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 3));
const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 100);
camera.position.set(4.5, 7, 14);
camera.lookAt(4.5, 0, 0);

loadAll().then(({ models, clips }) => {
  const info = {};
  Object.entries(models).forEach(([name, gltf], i) => {
    const raw = gltf.scene;
    const box = new THREE.Box3().setFromObject(raw);
    info[name] = box.getSize(new THREE.Vector3()).toArray().map(v => +v.toFixed(3));
    const p = normalize(raw, { size: 1.2, anchor: 'bottom' });
    p.position.set((i % 5) * 2.2, 0, Math.floor(i / 5) * 2.2 - 2.2);
    p.add(new THREE.AxesHelper(0.8));
    scene.add(p);
  });
  info.clips = Object.fromEntries(Object.entries(clips).map(([k, c]) => [k, +c.duration.toFixed(2)]));
  renderer.render(scene, camera);
  window.__info = info;
  window.__ready = true;
});
