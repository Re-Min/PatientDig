// Hand tools: Tripo meshes driven by small keyframed motions. The tool tip sits at the pivot origin,
// so placing the holder on the soil puts the working edge exactly at the contact point.
import * as THREE from 'three';
import { enableShadows, normalize } from './assets.js';

export const TOOLS = {
  trowel: {
    label: '小铲', model: 'trowel', size: 0.42, up: null,
    radius: 0.24, amount: 0.11, duration: 0.8, contactAt: 0.45, repeat: true,
    tip: '小铲：快速移除松散表土，靠近骨骼会被硬物挡住',
  },
  brush: {
    label: '毛刷', model: 'brush', size: 0.3, up: null,
    radius: 0.11, rate: 0.28, stroke: true,
    tip: '毛刷：按住拖动，清除骨面细土',
  },
  pick: {
    label: '竹签', model: 'bamboo_pick', size: 0.3, up: 'span',
    radius: 0.085, amount: 0.06, duration: 0.34, contactAt: 0.5, repeat: true,
    tip: '竹签：剔除骨骼边缘的薄围岩，按住连续剔',
  },
};

// [t, lift, forward, pitch] keyframes. Positive pitch leans the handle back toward the camera.
const TROWEL_KEYS = [
  [0, 0.12, 0, 0.5],
  [0.25, 0.27, -0.12, 0.15],  // raise
  [0.45, -0.035, 0.02, 1.0],  // press forward and down, blade cuts in
  [0.62, 0.04, 0.13, 1.3],    // scoop forward
  [0.76, 0.22, 0.05, 0.75],   // lift the load out
  [1, 0.12, 0, 0.5],
];
const PICK_KEYS = [
  [0, 0.09, -0.02, 0.35],
  [0.5, -0.012, 0.01, 0.42],
  [1, 0.09, -0.02, 0.35],
];

function sampleKeys(keys, t) {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1];
  let u = (t - a[0]) / (b[0] - a[0]);
  u = u * u * (3 - 2 * u);
  return [1, 2, 3].map(k => a[k] + (b[k] - a[k]) * u);
}

export class ToolRig {
  constructor(scene, models) {
    this.holder = new THREE.Group();  // world position + yaw (local -Z points away from the camera)
    this.tilt = new THREE.Group();    // pitch / roll
    this.holder.add(this.tilt);
    scene.add(this.holder);
    this.meshes = {};
    for (const [name, def] of Object.entries(TOOLS)) {
      const m = normalize(models[def.model].scene, { up: def.up, size: def.size, anchor: 'bottom' });
      enableShadows(m, true, false);
      m.visible = false;
      this.tilt.add(m);
      this.meshes[name] = m;
    }
    this.name = 'trowel';
    this.meshes.trowel.visible = true;
    this.target = new THREE.Vector3();
    this.yaw = 0;
    this.action = null;
    this.stroking = false;
    this.strokeT = 0;
    this.holder.visible = false;
  }

  set(name) {
    this.meshes[this.name].visible = false;
    this.name = name;
    this.meshes[name].visible = true;
    this.action = null;
  }

  get busy() { return !!this.action; }

  /** Rest the tool above `point`, facing away from the camera. */
  aim(point, cameraPos) {
    this.target.copy(point);
    this.yaw = Math.atan2(cameraPos.x - point.x, cameraPos.z - point.z);
    this.holder.visible = true;
  }

  strike(point) {
    const def = TOOLS[this.name];
    if (this.action || def.stroke) return false;
    this.action = { t: 0, def, point: point.clone(), fired: false };
    return true;
  }

  /**
   * Advances the animation. Returns { contact } once per strike when the edge bites, and for the trowel
   * { shake } when the load is shaken off the blade (world position of the blade at that moment).
   */
  update(dt, groundAt) {
    const def = TOOLS[this.name];
    const h = this.holder, tilt = this.tilt;
    h.rotation.y = this.yaw;
    const away = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    let contact = null, shake = null;
    if (this.action) {
      const a = this.action;
      a.t += dt / def.duration;
      const t = Math.min(1, a.t);
      const [lift, fwd, pitch] = sampleKeys(this.name === 'trowel' ? TROWEL_KEYS : PICK_KEYS, t);
      h.position.copy(a.point).addScaledVector(away, fwd);
      h.position.y = groundAt(h.position.x, h.position.z) + lift;
      tilt.rotation.set(pitch, 0, this.name === 'trowel' && t > 0.76 && t < 0.95 ? Math.sin(t * 90) * 0.12 : 0);
      if (!a.fired && t >= def.contactAt) { a.fired = true; contact = a.point; }
      if (this.name === 'trowel' && !a.shook && t >= 0.8) { a.shook = true; shake = h.position.clone(); }
      if (a.t >= 1) this.action = null;
    } else if (def.stroke && this.stroking) {
      this.strokeT += dt;
      const side = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const wig = Math.sin(this.strokeT * 19);
      const p = this.target.clone().addScaledVector(side, wig * 0.035);
      h.position.lerp(new THREE.Vector3(p.x, groundAt(p.x, p.z) + 0.004, p.z), 0.5);
      tilt.rotation.set(0.6, 0, wig * 0.35);
    } else {
      const lift = def.stroke ? 0.08 : this.name === 'trowel' ? 0.12 : 0.09;
      const rest = this.target.clone();
      rest.y = groundAt(rest.x, rest.z) + lift + Math.sin(performance.now() / 400) * 0.008;
      h.position.lerp(rest, Math.min(1, dt * 14));
      tilt.rotation.set(this.name === 'trowel' ? 0.5 : 0.4, 0, 0);
    }
    return { contact, shake };
  }
}
