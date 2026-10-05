// The field paleontologist: rigged Tripo character with retargeted preset clips (idle / dig / shovel / cheer).
// They stand at a fixed spot in front of the grid's left corner, turned toward the viewer.
import * as THREE from 'three';
import { PIT } from './soil.js';
import { enableShadows, normalize } from './assets.js';

const SPOT = new THREE.Vector3(-(PIT.digX - 0.55), 0, PIT.digZ + 1.0); // front-left corner, outside the grid and clear of the HUD panel
const HOME_YAW = Math.PI / 2; // until the first frame: facing +x, into the pit

export class Character {
  constructor(scene, gltf, clips) {
    this.root = normalize(gltf.scene, { size: 1.5, anchor: 'bottom' });
    enableShadows(this.root, true, false);
    gltf.scene.traverse(o => { if (o.isSkinnedMesh) o.frustumCulled = false; });
    scene.add(this.root);
    this.mixer = new THREE.AnimationMixer(gltf.scene);
    this.actions = {};
    for (const [name, clip] of Object.entries(clips)) this.actions[name] = this.mixer.clipAction(clip);
    this.current = null;
    this.play('idle', 0);
    this.yaw = HOME_YAW;
    this.busyUntil = 0;
    this.mood = 'idle';
    this.root.position.copy(SPOT);
    this.root.rotation.y = HOME_YAW;
  }

  play(name, fade = 0.3) {
    const next = this.actions[name];
    if (!next || this.current === next) return;
    next.reset().setEffectiveWeight(1).play();
    if (this.current) this.current.crossFadeTo(next, fade, false);
    this.current = next;
  }

  /** Keep the working clip going for a moment after each tool use. */
  work(kind, now) {
    this.mood = kind;
    this.busyUntil = now + 1.3;
  }

  cheer(now) {
    this.mood = 'cheer';
    this.busyUntil = now + 4.5;
  }

  update(dt, now, groundAt, viewer) {
    const p = this.root.position;
    // face the viewer (horizontally), following the camera as it orbits
    this.yaw = Math.atan2(viewer.x - p.x, viewer.z - p.z);
    let diff = this.yaw - this.root.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.root.rotation.y += diff * Math.min(1, dt * 6);
    p.y += (groundAt(p.x, p.z) - p.y) * Math.min(1, dt * 12);

    if (now < this.busyUntil) this.play(this.mood, 0.25);
    else this.play('idle', 0.4);
    this.mixer.update(dt);
  }
}
