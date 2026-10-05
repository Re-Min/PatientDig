// 3D dig site: heightfield excavation with Tripo models, three tools, particles, fossil exposure and the catalog card.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadAll, normalize, enableShadows } from './assets.js';
import { Soil, PIT, STRATA, ZONE, stratumAt } from './soil.js';
import { Particles } from './particles.js';
import { buildWorld, terrainHeight, textSprite } from './world.js';
import { Fossils } from './fossils.js';
import { ToolRig, TOOLS } from './tools.js';
import { Character } from './character.js';
import { sfx } from './audio.js';
import { ui as uiZh, messages as messagesZh } from './locale-zh.js';
import { ui as uiEn, messages as messagesEn } from './locale-en.js';

const $ = id => document.getElementById(id);
const CATALOG_KEY = 'datday.catalog';
const UI_TOOL = { shovel: 'trowel', brush: 'brush', pick: 'pick' };
const TOOL_DOM_KEY = { trowel: 'toolShovel', brush: 'toolBrush', pick: 'toolPick' };
const FOSSIL_KEYS = { vertebra: 'Vertebra', tail: 'Tail', rib: 'Rib', frag: 'Fragment' };
let language = 'zh';
try { if (localStorage.getItem('patientdig.language') === 'en') language = 'en'; } catch {}
const locale = () => language === 'en' ? uiEn : uiZh;
const messages = () => language === 'en' ? messagesEn : messagesZh;
const t = key => messages()[key] ?? locale()[key] ?? key;
const format = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), t(key));
const fossilKey = f => f.spec.id.includes('_vertebra_') ? 'Vertebra' : f.spec.id.includes('_tail_') ? 'Tail' : f.spec.id.includes('_rib_') ? 'Rib' : 'Fragment';
const fossilElement = f => t(`fossil${fossilKey(f)}`);
const fossilClue = f => t(`clue${fossilKey(f)}`);

function notice(text, ms = 2600) {
  const el = $('notice');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(notice.t);
  notice.t = setTimeout(() => el.classList.remove('show'), ms);
}

// ---------- renderer / scene ----------
const container = $('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!window.__TEST__ });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

const SKY = 0xcdd6c4;
const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 14, 34);

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 120);
camera.position.set(0.6, 3.9, 5.2);

scene.add(new THREE.HemisphereLight(0xf6f0dc, 0x6b6450, 1.6));
const sun = new THREE.DirectionalLight(0xfff1d2, 2.6);
sun.position.set(-4, 9, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 25 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, -0.1, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 2.2;
controls.maxDistance = 11;
controls.maxPolarAngle = 1.32;
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };

// ---------- game state ----------
const game = {
  ready: false, tool: 'trowel', holding: false, hover: null, aim: null,
  hoverFossil: -1, brushTick: 0, autoBrush: 0, records: 0, done: false, deepest: 0, warnAt: 0, tutorialSeen: false,
};
let soil, fossils, particles, rig, hero, ring, rangeLabels, models, cropLabel;
const freedLabels = new Map();
const recordEntries = new Map();
const recordLabels = new Map();

function refreshRangeLabels() {
  if (!rangeLabels) return;
  for (const [key, old] of Object.entries(rangeLabels)) {
    const pos = old.position.clone();
    scene.remove(old);
    const next = textSprite(t(`range${key[0].toUpperCase()}${key.slice(1)}`), { size: 0.075, tone: 'moss' });
    next.visible = old.visible;
    next.position.copy(pos);
    rangeLabels[key] = next;
    scene.add(next);
  }
}

function refreshCropLabel() {
  if (!cropLabel) return;
  const pos = cropLabel.position.clone();
  scene.remove(cropLabel);
  cropLabel = textSprite(t('cropLabel'), { size: 0.11, tone: 'sun', dot: true });
  cropLabel.position.copy(pos);
  scene.add(cropLabel);
}

function setLanguage(value, persist = true) {
  language = value === 'en' ? 'en' : 'zh';
  if (persist) { try { localStorage.setItem('patientdig.language', language); } catch {} }
  document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
  document.title = locale().title;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = locale()[el.dataset.i18n] ?? el.textContent; });
  const toggle = $('language-toggle');
  if (toggle) {
    toggle.textContent = locale().targetLanguage;
    toggle.setAttribute('aria-label', locale().language);
    toggle.title = locale().language;
  }
  const log = $('log');
  if (log) log.dataset.emptyText = locale().logEmpty;
  refreshRangeLabels();
  refreshCropLabel();
  for (const [f, label] of freedLabels) {
    const pos = label.position.clone(); scene.remove(label);
    const next = textSprite(t('recordHint'), { size: 0.11, tone: 'sun', dot: true });
    next.position.copy(pos); scene.add(next); freedLabels.set(f, next);
  }
  for (const [f, li] of recordEntries) li.innerHTML = `<b>No.0${fossils.list.indexOf(f) + 1} ${fossilElement(f)}</b>${fossilClue(f)}`;
  for (const [f, label] of recordLabels) {
    const pos = label.position.clone(); scene.remove(label);
    const next = textSprite(`No.0${fossils.list.indexOf(f) + 1} · ${fossilElement(f)}`, { size: 0.1, dot: true });
    next.position.copy(pos); scene.add(next); recordLabels.set(f, next);
  }
  $('layer').textContent = t('strata0');
  $('fossil').textContent = t('fossilNone');
  $('notice').classList.remove('show');
  if (game.ready) { updateHUD(); $('dig').textContent = t(`action${game.tool[0].toUpperCase()}${game.tool.slice(1)}`); }
}

function groundAt(x, z) {
  return soil && soil.inPit(x, z) ? soil.heightAt(x, z) : terrainHeight(x, z);
}

setLanguage(language, false);

// ---------- loading ----------
loadAll((done, total) => {
  $('load-bar').style.width = `${Math.round(done / total * 100)}%`;
  $('load-text').textContent = `${t('loadingModels')} ${done} / ${total}`;
}).then(start).catch(err => {
  console.error(err);
  $('load-text').textContent = t('loadFailed') + err.message;
});

function start({ models: m, clips }) {
  models = m;
  soil = new Soil();
  scene.add(soil.mesh);
  buildWorld(scene, models);
  fossils = new Fossils(scene, soil, models);
  cropOut();
  particles = new Particles(scene);
  particles.resize(innerHeight, camera.fov, renderer.getPixelRatio());
  rig = new ToolRig(scene, models);
  hero = new Character(scene, models.archaeologist, clips);
  ring = makeRing();
  rangeLabels = Object.fromEntries(['trowel', 'brush', 'pick'].map(k => {
    const s = textSprite(t(`range${k[0].toUpperCase()}${k.slice(1)}`), { size: 0.075, tone: 'moss' });
    s.visible = false;
    scene.add(s);
    return [k, s];
  }));
  bindUI();
  updateHUD();
  game.ready = true;
  $('loading').classList.add('hide');
  notice(t('ready'), 4200);
}

// The first, smaller specimen already shows through the trampled surface as the tutorial clue.
function cropOut() {
  const f = fossils.list[0];
  const pos = soil.geometry.attributes.position;
  let peak = null;
  for (const s of f.samples) {
    if (s.top > -0.1) {
      const y = Math.min(soil.h[s.i], s.top - 0.015);
      soil.h[s.i] = y;
      pos.setY(s.i, y);
      if (!peak || s.top > peak.top) peak = s;
    }
  }
  pos.needsUpdate = true;
  soil.geometry.computeVertexNormals();
  fossils.update();
  if (peak) {
    const ix = peak.i % (soil.nx + 1), iz = (peak.i / (soil.nx + 1)) | 0;
    cropLabel = textSprite(t('cropLabel'), { size: 0.11, tone: 'sun', dot: true });
    cropLabel.position.set(soil.vx(ix), 0.32, soil.vz(iz));
    scene.add(cropLabel);
  }
}

// ---------- hover ring ("铲入范围") that drapes over the soil ----------
function makeRing() {
  const geo = new THREE.RingGeometry(0.0001, 1, 48, 5);
  geo.rotateX(-Math.PI / 2);
  const base = geo.attributes.position.array.slice();
  const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0xfff1c2, transparent: true, opacity: 0.26, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
  const pts = [];
  for (let k = 0; k <= 64; k++) pts.push(new THREE.Vector3(Math.cos(k / 64 * Math.PI * 2), 0, Math.sin(k / 64 * Math.PI * 2)));
  const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
  const lineBase = lineGeo.attributes.position.array.slice();
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0.95, depthWrite: false }));
  fill.renderOrder = line.renderOrder = 5;
  fill.visible = line.visible = false;
  scene.add(fill, line);
  const drape = (g, src, c, r) => {
    const a = g.attributes.position.array;
    for (let k = 0; k < a.length; k += 3) {
      const x = c.x + src[k] * r, z = c.z + src[k + 2] * r;
      a[k] = x; a[k + 1] = groundAt(x, z) + 0.006; a[k + 2] = z;
    }
    g.attributes.position.needsUpdate = true;
    g.computeBoundingSphere();
  };
  return {
    update(c, r, blocked) {
      const show = !!c;
      fill.visible = line.visible = show;
      if (!show) return;
      drape(geo, base, c, r);
      drape(lineGeo, lineBase, c, r);
      fill.material.color.set(blocked ? 0xe2654c : 0xfff1c2);
      line.material.color.set(blocked ? 0xffb09e : 0xfff6d8);
    },
  };
}

// Bone surface already showing inside the tool footprint (the trowel must not touch it).
function boneShowing(x, z, r) {
  const { step } = PIT;
  const ix0 = Math.max(0, Math.floor((x - r + PIT.w / 2) / step)), ix1 = Math.min(soil.nx, Math.ceil((x + r + PIT.w / 2) / step));
  const iz0 = Math.max(0, Math.floor((z - r + PIT.d / 2) / step)), iz1 = Math.min(soil.nz, Math.ceil((z + r + PIT.d / 2) / step));
  for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
    const i = soil.index(ix, iz);
    if (soil.zone[i] === ZONE.BONE && soil.h[i] < soil.hardTop[i] - 0.004 && Math.hypot(soil.vx(ix) - x, soil.vz(iz) - z) < r * 0.85) return true;
  }
  return false;
}

// ---------- picking ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function pick(clientX, clientY) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set((clientX - r.left) / r.width * 2 - 1, -(clientY - r.top) / r.height * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const p = soil.raycast(raycaster.ray);
  game.hover = p && soil.inDigArea(p.x, p.z) ? p : null;
  // freed fossils can be clicked to record them
  game.hoverFossil = -1;
  const targets = fossils.meshes.filter(m => fossils.list[m.userData.fossil].spec.state === 'freed');
  if (targets.length) {
    const hit = raycaster.intersectObjects(targets, false)[0];
    if (hit && (!p || hit.distance <= raycaster.ray.origin.distanceTo(p) + 0.05)) {
      game.hoverFossil = hit.object.userData.fossil;
      game.hover = null;
    }
  }
  renderer.domElement.style.cursor = game.hoverFossil >= 0 ? 'pointer' : game.hover ? 'crosshair' : 'grab';
}

// ---------- tool use ----------
function strataColor(y) { return new THREE.Color(STRATA[stratumAt(y)].hex); }

function tryStrike(point) {
  if (!point || game.done) return;
  const tool = game.tool;
  if (tool === 'brush') return;
  if (rig.busy) return; // action lock: one stroke at a time
  if (tool === 'trowel' && boneShowing(point.x, point.z, TOOLS.trowel.radius)) {
    warn(t('blocked'));
    return;
  }
  rig.aim(point, camera.position);
  if (rig.strike(point)) {
    hero.work(tool === 'trowel' ? 'shovel' : 'dig', clock.elapsedTime);
  }
}

function warn(text) {
  const now = clock.elapsedTime;
  if (now - game.warnAt < 1.2) return;
  game.warnAt = now;
  notice(text);
  sfx.bone();
}

/** Apply a tool at (x, z). Shared by the animated strike, the brush stroke and the test hook. */
function applyTool(tool, x, z, amountScale = 1) {
  const def = TOOLS[tool];
  const amount = (tool === 'brush' ? def.rate * 0.1 : def.amount) * amountScale;
  const before = soil.heightAt(x, z);
  const res = soil.carve(x, z, def.radius, amount, tool);
  const p = new THREE.Vector3(x, soil.heightAt(x, z), z);
  const color = strataColor((before + p.y) / 2);
  if (tool === 'trowel') {
    if (res.removed > 0) {
      particles.burst(p, color, { chunks: 16, dust: 12, power: 1.05, size: 1.1 });
      sfx.trowel();
    }
    if (res.hitBone || res.hitEdge) {
      particles.burst(p, new THREE.Color(0xf2ead2), { chunks: 0, dust: 6, power: 0.5, size: 0.5 });
      warn(res.hitBone ? t('hardBone') : t('nearEdge'));
    }
  } else if (tool === 'brush') {
    if (res.removed > 0) particles.burst(p, color, { chunks: 1, dust: 4, power: 0.35, size: 0.6 });
    if (res.hitEdge && !res.hitBone) warn(t('brushEdge'));
  } else {
    if (res.removed > 0) {
      particles.burst(p, color, { chunks: 4, dust: 3, power: 0.55, size: 0.45 });
      sfx.pick();
    }
  }
  game.deepest = Math.min(game.deepest, p.y);
  for (const f of fossils.update()) onFossilState(f);
  updateHUD(p.y);
  return res;
}

function onFossilState(f) {
  const s = f.spec;
  if (s.state === 'glimpsed') {
    notice(format('glimpsed', { element: fossilElement(f) }));
    $('fossil').textContent = fossilElement(f);
  } else if (s.state === 'exposed') {
    notice(format('exposed', { element: fossilElement(f) }));
    if (f === fossils.list[0] && cropLabel) { scene.remove(cropLabel); cropLabel = null; }
  } else if (s.state === 'freed') {
    notice(format('freed', { element: fossilElement(f) }), 3400);
    sfx.chime();
    hero.cheer(clock.elapsedTime);
    hero.busyUntil = clock.elapsedTime + 2;
    const l = textSprite(t('recordHint'), { size: 0.11, tone: 'sun', dot: true });
    l.position.copy(fossils.centerOf(f)).add(new THREE.Vector3(0, 0.28, 0));
    scene.add(l);
    freedLabels.set(f, l);
  }
}

function record(fi) {
  const f = fossils.list[fi];
  if (!f || f.spec.state !== 'freed') return false;
  f.spec.state = 'recorded';
  game.records++;
  sfx.shutter();
  const l = freedLabels.get(f);
  if (l) scene.remove(l);
  freedLabels.delete(f);
  const tag = textSprite(`No.0${fi + 1} · ${fossilElement(f)}`, { size: 0.1, dot: true });
  tag.position.copy(fossils.centerOf(f)).add(new THREE.Vector3(0, 0.26, 0));
  scene.add(tag);
  const li = document.createElement('div');
  li.innerHTML = `<b>No.0${fi + 1} ${fossilElement(f)}</b>${fossilClue(f)}`;
  $('log').appendChild(li);
  recordEntries.set(f, li); recordLabels.set(f, tag);
  notice(format('recordDone', { element: fossilElement(f), clue: fossilClue(f) }), 3600);
  updateHUD();
  if (game.records === fossils.list.length) setTimeout(finish, 1400);
  return true;
}

// ---------- finale: reconstruction + catalog card ----------
let dino = null;
function finish() {
  if (game.done) return;
  game.done = true;
  rig.holder.visible = false;
  ring.update(null);
  setTimeout(() => hero.cheer(clock.elapsedTime), 900);
  sfx.chime();
  dino = normalize(models.yangchuanosaurus.scene, { size: 3.2, anchor: 'bottom' });
  enableShadows(dino, true, false);
  dino.position.set(-0.2, terrainHeight(-0.2, -2.45), -2.45);
  dino.rotation.y = 0.35;
  dino.userData.t = 0;
  dino.scale.setScalar(0.001);
  scene.add(dino);
  particles.burst(dino.position.clone().add(new THREE.Vector3(0, 0.05, 0)), new THREE.Color(0xd8c39a), { chunks: 0, dust: 60, power: 2.4, size: 2.2 });
  saveCatalog();
  setTimeout(() => $('reveal').classList.add('show'), 2200);
}

function saveCatalog() {
  try {
    const list = new Set(JSON.parse(localStorage.getItem(CATALOG_KEY) || '[]'));
    list.add('heping');
    localStorage.setItem(CATALOG_KEY, JSON.stringify([...list]));
  } catch (e) { /* storage may be unavailable from file:// in some browsers */ }
}

// ---------- HUD ----------
function updateHUD(y) {
  $('record').textContent = `${game.records} / ${fossils.list.length}`;
  $('depth').textContent = `${Math.abs(game.deepest).toFixed(2)} m`;
  if (y !== undefined) $('layer').textContent = t(`strata${stratumAt(y)}`);
  const found = fossils.list.find(f => f.spec.state !== 'buried');
  $('fossil').textContent = found ? fossilElement(found) : t('fossilNone');
  // 4 × 3 survey cells; a cell counts as opened once its mean level is 6 cm down
  let opened = 0;
  const cw = PIT.digX * 2 / 4, cd = PIT.digZ * 2 / 3;
  for (let cz = 0; cz < 3; cz++) for (let cx = 0; cx < 4; cx++) {
    let sum = 0, n = 0;
    for (let z = -PIT.digZ + cz * cd + 0.05; z < -PIT.digZ + (cz + 1) * cd - 0.05; z += 0.12)
      for (let x = -PIT.digX + cx * cw + 0.05; x < -PIT.digX + (cx + 1) * cw - 0.05; x += 0.12) { sum += soil.heightAt(x, z); n++; }
    if (sum / n < -0.06) opened++;
  }
  $('cells').textContent = `${opened} / 12`;
}

function setTool(tool) {
  game.tool = tool;
  rig.set(tool);
  rig.stroking = false;
  document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', UI_TOOL[b.dataset.tool] === tool));
  $('dig').textContent = t(`action${tool[0].toUpperCase()}${tool.slice(1)}`);
  notice(t(`tip${tool[0].toUpperCase()}${tool.slice(1)}`));
}

function showFirstTutorial() {
  if (game.tutorialSeen || !window.__digTutorial) return false;
  game.tutorialSeen = true;
  game.holding = false;
  rig.stroking = false;
  window.__digTutorial.show();
  return true;
}

function bindUI() {
  const el = renderer.domElement;
  $('language-toggle').onclick = () => setLanguage(language === 'en' ? 'zh' : 'en');
  // Registered before OrbitControls sees the event: left button / one finger on the soil uses the tool,
  // anywhere else it orbits the camera.
  el.addEventListener('pointerdown', e => {
    if (game.ready && showFirstTutorial()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    sfx.unlock();
    pick(e.clientX, e.clientY);
    const primary = e.button === 0;
    const onTarget = primary && (game.hover || game.hoverFossil >= 0) && !game.done;
    controls.mouseButtons.LEFT = onTarget ? -1 : THREE.MOUSE.ROTATE;
    controls.touches.ONE = onTarget ? -1 : THREE.TOUCH.ROTATE;
    if (!onTarget) return;
    if (game.hoverFossil >= 0) { record(game.hoverFossil); return; }
    game.holding = true;
    game.aim = game.hover.clone();
    el.setPointerCapture(e.pointerId);
    tryStrike(game.hover);
  }, true);
  el.addEventListener('pointermove', e => { if (game.ready) pick(e.clientX, e.clientY); });
  const release = () => { game.holding = false; rig && (rig.stroking = false); };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('pointerleave', () => { if (!game.holding) game.hover = null; });
  el.addEventListener('contextmenu', e => e.preventDefault());

  document.querySelectorAll('[data-tool]').forEach(b => { b.onclick = () => setTool(UI_TOOL[b.dataset.tool]); });
  addEventListener('keydown', e => {
    const t = { 1: 'trowel', 2: 'brush', 3: 'pick' }[e.key];
    if (t) setTool(t);
  });
  $('dig').onclick = () => {
    if (showFirstTutorial()) return;
    sfx.unlock();
    const p = game.aim;
    if (!p) { notice(t('choosePoint')); return; }
    if (game.tool === 'brush') { game.autoBrush = 0.6; }
    else tryStrike(p);
  };
  $('reveal-stay').onclick = () => $('reveal').classList.remove('show');
  $('reveal-go').onclick = () => { location.href = 'index.html#catalog'; };
  setTool('trowel');
}

// ---------- loop ----------
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 1 / 20);
  const now = clock.elapsedTime;
  controls.update();
  if (game.ready) step(dt, now);
  renderer.render(scene, camera);
}

function step(dt, now) {
  const tool = game.tool;
  const def = TOOLS[tool];
  const focus = game.holding || game.autoBrush > 0 ? (game.holding && game.hover ? game.hover : game.aim) : game.hover;
  if (game.holding && game.hover) game.aim = game.hover.clone();

  // tool rig follows the cursor; strikes repeat while the button is held
  if (focus && !game.done) rig.aim(focus, camera.position);
  else if (!rig.busy) rig.holder.visible = false;
  if (game.holding && def.repeat && game.hover) tryStrike(game.hover);

  const brushing = tool === 'brush' && focus && ((game.holding && game.hover) || game.autoBrush > 0);
  rig.stroking = !!brushing;
  if (brushing) {
    game.autoBrush = Math.max(0, game.autoBrush - dt);
    game.brushTick += dt;
    while (game.brushTick >= 0.1) {
      game.brushTick -= 0.1;
      applyTool('brush', focus.x, focus.z);
      sfx.brush();
    }
    hero.work('dig', now);
  }

  const { contact, shake } = rig.update(dt, groundAt);
  if (contact) applyTool(tool, contact.x, contact.z);
  if (shake) {
    // the scooped load is flicked off the blade
    particles.burst(shake, strataColor(shake.y - 0.1), { chunks: 9, dust: 5, power: 0.45, size: 1 });
  }

  const blocked = tool === 'trowel' && game.hover && boneShowing(game.hover.x, game.hover.z, def.radius);
  const ringAt = game.done ? null : game.hover;
  ring.update(ringAt, def.radius, blocked);
  for (const [k, s] of Object.entries(rangeLabels)) {
    s.visible = !!ringAt && k === tool;
    if (s.visible) s.position.set(ringAt.x, ringAt.y + 0.16, ringAt.z);
  }
  if (game.hover && !game.holding) $('layer').textContent = t(`strata${stratumAt(game.hover.y)}`);

  particles.update(dt, groundAt);
  fossils.tick(now, game.hoverFossil);
  hero.update(dt, now, groundAt, camera.position);
  for (const l of freedLabels.values()) l.position.y += Math.sin(now * 3) * 0.0006;

  if (dino && dino.userData.t < 1) {
    dino.userData.t = Math.min(1, dino.userData.t + dt / 1.8);
    const t = dino.userData.t, c = 1.6;
    dino.scale.setScalar(Math.max(0.001, 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)));
  }
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (particles) particles.resize(innerHeight, camera.fov, renderer.getPixelRatio());
});

frame();

// Test / debug hook: drives the same code paths as the pointer input.
window.__dig = {
  get ready() { return game.ready; },
  game, camera, controls,
  setTool,
  apply: (tool, x, z, n = 1) => { for (let k = 0; k < n; k++) applyTool(tool, x, z); },
  strike: (tool, x, z) => { setTool(tool); tryStrike(new THREE.Vector3(x, soil.heightAt(x, z), z)); },
  hold: (tool, x, z, on) => {
    setTool(tool);
    const p = new THREE.Vector3(x, soil.heightAt(x, z), z);
    game.hover = on ? p : null; game.aim = p; game.holding = on;
  },
  fossils: () => fossils.list.map(f => ({ element: f.spec.element, state: f.spec.state, exposure: +f.spec.exposure.toFixed(3), edgeClear: +f.spec.edgeClear.toFixed(3), center: fossils.centerOf(f).toArray().map(v => +v.toFixed(3)) })),
  record,
  hud: () => ({ record: $('record').textContent, cells: $('cells').textContent, depth: $('depth').textContent, fossil: $('fossil').textContent, notice: $('notice').textContent }),
};
