import { sites as sitesZh, descriptions as descriptionsZh, ui as uiZh, messages as messagesZh } from './locale-zh.js';
import { sites as sitesEn, descriptions as descriptionsEn, ui as uiEn, messages as messagesEn } from './locale-en.js';
﻿import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import pinBytes from '../../assets/opt/map_pin.glb';
import hillsBytes from '../../assets/opt/map_hills.glb';
import compassBytes from '../../assets/opt/compass.glb';
import radioBytes from '../../assets/opt/field_radio.glb';
import rockBytes from '../../assets/opt/red_rock.glb';
import featherBytes from '../../assets/opt/feather_fossil.glb';
import dinoBytes from '../../assets/opt/yangchuanosaurus.glb';
import china from '../../assets/maps/china-provinces.json';

const $ = id => document.getElementById(id);
let language = 'zh';
try { if (localStorage.getItem('patientdig.language') === 'en') language = 'en'; } catch {}
const sites = sitesZh;
const currentSites = () => language === 'en' ? sitesEn : sitesZh;
const currentDescriptions = () => language === 'en' ? descriptionsEn : descriptionsZh;
const t = key => (language === 'en' ? messagesEn : messagesZh)[key];
const tableLabels = [];
let soundFailed = false;
let lastLoadError = null;
function musicEnabled() { return window.__patientDigMusic?.enabled ?? true; }
function soundLabel() {
  $('sound').textContent = t(musicEnabled() ? 'soundOn' : 'soundOff');
  $('sound').setAttribute('aria-pressed', String(musicEnabled()));
}
function setLanguage(value, persist = true) {
  language = value === 'en' ? 'en' : 'zh';
  if (persist) { try { localStorage.setItem('patientdig.language', language); } catch {} }
  const ui = language === 'en' ? uiEn : uiZh;
  for (const [selector, html] of Object.entries(ui)) document.querySelector(selector).innerHTML = html;
  document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
  for (const id of ['game-ui','pins','map3d','loading','tooltip','toast']) $(id).lang = language === 'en' ? 'en' : 'zh-CN';
  $('language-toggle').firstElementChild.textContent = language === 'en' ? 'A' : '文';
  $('language-toggle').lastElementChild.textContent = language === 'en' ? '中文' : 'English';
  $('language-toggle').setAttribute('aria-label',t('language'));
  $('language-toggle').title = t('language');
  $('reset-view').setAttribute('aria-label',t('reset'));
  $('map3d').setAttribute('aria-label',t('mapLabel'));
  document.querySelector('.dock').setAttribute('aria-label',t('navigation'));
  soundLabel();
  $('load-text').textContent = lastLoadError ? t('failed') + lastLoadError.message : state.loaded.length ? `${t('loading')} ${state.loaded.length} / 7` : t('loadingInitial');
  for (const draw of tableLabels) draw();
  for (const o of state.objects) {
    const {action,asset} = o.userData;
    o.userData.caption = action?.startsWith('site:') ? currentSites()[action.slice(5)].location : t(asset);
  }
  clearTimeout(toast.timer); $('toast').classList.remove('show'); $('tooltip').style.display='none';
  if (state.ready) { selectSite(state.selected,false); updateSpecimenText(); }
}
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = { ready: false, phase: 'map', mode: 'map', selected: 'sichuan', specimen: 'heping', models: {}, earned: false, sound: false, pins: {}, objects: [], loaded: [] };
let renderer, camera, controls, scene, mapRoot, studyRoot, studyModel, sun;
let audio, frameId, lastTime = 0;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const pickTargets = [];
const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
const lightClay = new THREE.MeshStandardMaterial({ color: 0xe0caa1, roughness: .95 });

function toast(text) {
  $('toast').textContent = text; $('toast').classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').classList.remove('show'), 3600);
}
function ping() {
  if (!state.sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.frequency.setValueAtTime(620, audio.currentTime); osc.frequency.exponentialRampToValueAtTime(940, audio.currentTime + .12);
    gain.gain.setValueAtTime(.025, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .22);
    osc.connect(gain).connect(audio.destination); osc.start(); osc.stop(audio.currentTime + .23);
  } catch { state.sound = false; soundFailed = true; soundLabel(); $('sound').setAttribute('aria-pressed','false'); }
}
function earned() {
  try { const value = JSON.parse(localStorage.getItem('datday.catalog') || '[]'); return Array.isArray(value) && value.includes('heping'); } catch { return false; }
}
function updateEarned() { state.earned = earned(); $('catalog-count').textContent = state.earned ? '01' : '00'; }
function material(color) { return new THREE.MeshStandardMaterial({ color, roughness: .97, metalness: 0 }); }
function box(w, h, d, radius, mat) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, radius), mat);
  m.castShadow = m.receiveShadow = true; return m;
}
// Keep all provinces and offshore features in one map, including the southernmost islands.
function project(lon, lat) { return [(lon - 104.5) * .115, -(lat - 29) * .128 - .2]; }
function makeModel(gltf, size, { layFlat = false } = {}) {
  const source = gltf.scene.clone(true), inner = new THREE.Group(), pivot = new THREE.Group();
  inner.add(source); pivot.add(inner); inner.updateMatrixWorld(true);
  if (layFlat) {
    const dim = new THREE.Box3().setFromObject(inner).getSize(new THREE.Vector3()).toArray();
    const thin = dim.indexOf(Math.min(...dim));
    const axes = [new THREE.Vector3(1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,1)];
    inner.quaternion.setFromUnitVectors(axes[thin], axes[1]);
  }
  inner.updateMatrixWorld(true);
  let b = new THREE.Box3().setFromObject(inner);
  inner.scale.setScalar(size / Math.max(...b.getSize(new THREE.Vector3()).toArray()));
  inner.updateMatrixWorld(true); b = new THREE.Box3().setFromObject(inner);
  const center = b.getCenter(new THREE.Vector3()); inner.position.sub(new THREE.Vector3(center.x, b.min.y, center.z));
  pivot.traverse(o => { if(o.isMesh) { o.castShadow = o.receiveShadow = true; o.material = o.material.clone(); o.material.roughness = Math.max(.8, o.material.roughness); o.material.metalness = Math.min(.15, o.material.metalness); } });
  return pivot;
}
function addProp(key, pos, size, yaw, action, caption, options) {
  const obj = makeModel(state.models[key], size, options); obj.position.set(...pos); obj.rotation.y = yaw;
  obj.userData.action = action; obj.userData.caption = caption; obj.userData.asset = key;
  mapRoot.add(obj); state.objects.push(obj); if (action) pickTargets.push(obj); return obj;
}
function printOnTable(key, x, z, width, tone = '#56614d') {
  const cv = document.createElement('canvas'); cv.width = 768; cv.height = 100;
  const ctx = cv.getContext('2d');
  const texture = new THREE.CanvasTexture(cv); texture.colorSpace = THREE.SRGBColorSpace;
  const draw = () => {
    ctx.clearRect(0,0,cv.width,cv.height); ctx.fillStyle=tone; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='600 38px "Microsoft YaHei", sans-serif'; ctx.fillText(t(key),384,50,740); texture.needsUpdate=true;
  };
  tableLabels.push(draw); draw();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width,width/7.68),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));
  m.rotation.x = -Math.PI/2; m.position.set(x,.205,z); mapRoot.add(m);
}
function buildMap() {
  const wood = box(12,.4,9,.2,material(0xa37957)); wood.position.y = -.26; mapRoot.add(wood);
  const rim = box(9.7,.13,7.65,.13,material(0xc6b491)); rim.position.y = .025; mapRoot.add(rim);
  const paper = box(9.5,.12,7.48,.1,material(0xdbd9bb)); paper.position.y = .10; mapRoot.add(paper);
  const shades = [0x9fa580,0xb1b28a,0x98a37a,0xb5ab7c,0x8d9e7c,0xa9b28a];
  china.features.forEach((feature,i) => {
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    const mat = material(shades[i % shades.length]);
    polygons.forEach(rings => {
      const paths = rings.map(ring => ring.map(([lon,lat]) => {const [x,z] = project(lon,lat); return new THREE.Vector2(x,-z); }));
      if (paths[0].length < 3) return;
      const shape = new THREE.Shape(paths[0]); for(const h of paths.slice(1)) shape.holes.push(new THREE.Path(h));
      const geo = new THREE.ExtrudeGeometry(shape,{depth:.09,bevelEnabled:false,steps:1,curveSegments:1}); geo.rotateX(-Math.PI/2);
      const mesh = new THREE.Mesh(geo,mat); mesh.position.y=.17; mesh.receiveShadow = true; mapRoot.add(mesh);
      const outline = new THREE.Line(new THREE.BufferGeometry().setFromPoints(paths[0].map(p=>new THREE.Vector3(p.x,.263,-p.y))),new THREE.LineBasicMaterial({color:0x687c5a,transparent:true,opacity:.42}));
      mapRoot.add(outline);
    });
  });
  printOnTable('tableTitle',-2.0,-3.25,2.6);
  printOnTable('islands',3.65,2.8,1.0);
  printOnTable('tableNote',-.8,3.43,2.65,'#959272');
  addProp('hills',[-2.12,.29,-.8],.9,.2,null,'粘土丘陵');
  addProp('hills',[-1.1,.29,-.6],.63,-.5,null,'粘土丘陵');
  addProp('compass',[3.75,.4,2.1],1.12,-.12,'reset','罗盘 · 复位地图',{layFlat:true});
  addProp('radio',[-4.35,.05,1.65],1.15,.35,'radio','收音机 · 查看当前情报');
  addProp('rock',[4.05,.17,-1.1],.9,-.32,'rock','红层样本 · 拿到研究桌上');
  addProp('feather',[-4.07,.17,-1.6],1.15,.18,'feather','化石板 · 拿到研究桌上',{layFlat:true});
  for (const [id,s] of Object.entries(sites)) {
    const [x,z] = project(s.lon,s.lat);
    const p = addProp('pin',[x,.27,z],.45,0,'site:'+id,s.location);
    p.traverse(o => { if(o.isMesh) o.material.color.set(id === 'sichuan' ? 0xc58145 : 0xf1e5ba); });
    const halo = new THREE.Mesh(new THREE.RingGeometry(.13,.18,32),new THREE.MeshBasicMaterial({color:0xf0c978,side:THREE.DoubleSide,transparent:true,opacity:.8}));
    halo.rotation.x=-Math.PI/2;halo.position.set(x,.275,z); mapRoot.add(halo);
    state.pins[id] = { obj:p, halo, button:document.querySelector(`[data-pin="${id}"]`) };
  }
}
function selectSite(id, sound = true) {
  if(!sites[id]) return; state.selected=id;
  const s=currentSites()[id];
  $('report-id').textContent=s.report; $('report-title').textContent=s.title; $('report-location').textContent=s.location;
  $('report-body').textContent=s.body; $('report-note').textContent=s.note;
  $('depart').disabled=!s.active; $('depart').textContent=t(s.active?'depart':'unavailable');
  for(const [key,p] of Object.entries(state.pins)) {p.button.classList.toggle('selected',key===id);p.button.setAttribute('aria-pressed',String(key===id));p.halo.visible=key===id;}
  if(sound)ping();
}
function frameCamera() {
  const ratio=innerWidth/innerHeight;
  const multiplier=ratio<1?1.38:ratio<1.4?1.1:1;
  const map = state.mode==='map';
  camera.position.set(map? .2:3.3, (map?9.6:4.3)*multiplier,(map?8.0:5.2)*multiplier);
  controls.target.set(0,map?0:1.15,0);controls.minDistance=map?7:3.6;controls.maxDistance=map?21:12;
  controls.minPolarAngle=.22;controls.maxPolarAngle=1.16;controls.update();camera.updateMatrixWorld(true);
}
function setMode(mode, syncHash = true) {
  if(!state.ready)return;
  state.mode=mode;mapRoot.visible=mode==='map';studyRoot.visible=mode==='catalog';
  $('letter').classList.toggle('hidden',mode!=='map');$('chapter').classList.toggle('hidden',mode!=='map');
  $('pins').classList.toggle('hidden',mode!=='map');$('sample-help').classList.toggle('hidden',mode!=='map');
  $('catalog-info').style.display=mode==='catalog'?'block':'none';$('catalog-tabs').style.display=mode==='catalog'?'flex':'none';
  $('nav-map').classList.toggle('active',mode==='map');$('nav-catalog').classList.toggle('active',mode==='catalog');
  $('nav-map').setAttribute('aria-pressed',String(mode==='map'));$('nav-catalog').setAttribute('aria-pressed',String(mode==='catalog'));
  if(mode==='catalog')showSpecimen(state.specimen);
  frameCamera();$('tooltip').style.display='none';
  if(syncHash&&location.hash!==(mode==='catalog'?'#catalog':'#map'))location.hash=mode==='catalog'?'catalog':'map';
}
function showSpecimen(id) {
  if(!currentDescriptions()[id])return;state.specimen=id;updateEarned();
  if(studyModel){studyRoot.remove(studyModel);studyModel.traverse(o=>{if(o.isMesh)o.material.dispose();});}
  const key=id==='heping'?'dino':id==='feather'?'feather':'rock';
  studyModel=makeModel(state.models[key],id==='heping'?3.5:2.45);studyModel.position.y=.20;
  studyModel.rotation.y=id==='heping'?-.4:id==='feather'?.85:.18;studyRoot.add(studyModel);
  if(id==='heping'&&!state.earned) studyModel.traverse(o=>{if(o.isMesh){o.material.map=null;o.material.color.set(0x777d67);}});
  updateSpecimenText();
  document.querySelectorAll('[data-specimen]').forEach(b=>b.classList.toggle('active',b.dataset.specimen===id));
}
function updateSpecimenText() {
  const d=currentDescriptions()[state.specimen];$('specimen-title').textContent=d.title;$('specimen-latin').textContent=d.latin;$('specimen-text').textContent=d.text;
  $('specimen-status').textContent=t(state.specimen==='heping'?(state.earned?'archived':'locked'):'reference');
}

function hitObject(event) {
  if(state.mode!=='map')return null;
  pointer.set(event.clientX/innerWidth*2-1,-event.clientY/innerHeight*2+1);ray.setFromCamera(pointer,camera);
  const hit=ray.intersectObjects(pickTargets,true)[0];if(!hit)return null;
  let root=hit.object;while(root&&!root.userData.action)root=root.parent;
  return root;
}
function activate(root) {
  const act=root.userData.action;
  if(act.startsWith('site:'))selectSite(act.slice(5));
  else if(act==='reset'){frameCamera();ping();}
  else if(act==='radio'){selectSite(state.selected);toast(currentSites()[state.selected].body);}
  else{state.specimen=act;setMode('catalog');ping();}
}
function bind() {
  $('language-toggle').onclick=()=>setLanguage(language === 'en' ? 'zh' : 'en');
  document.querySelectorAll('[data-pin]').forEach(b=>b.onclick=()=>selectSite(b.dataset.pin));
  $('depart').onclick=()=>{if(sites[state.selected].active)location.href='3d.html';};
  $('nav-field').onclick=()=>{location.href='3d.html';};
  $('nav-map').onclick=()=>setMode('map');$('nav-catalog').onclick=()=>setMode('catalog');
  $('reset-view').onclick=()=>{frameCamera();ping();};
  $('sound').onclick=()=>{window.__patientDigMusic?.toggle();soundLabel();};
  document.querySelectorAll('[data-specimen]').forEach(b=>b.onclick=()=>{showSpecimen(b.dataset.specimen);ping();});
  addEventListener('hashchange',()=>setMode(location.hash==='#catalog'?'catalog':'map',false));
  addEventListener('storage',()=>{updateEarned();if(state.mode==='catalog')showSpecimen(state.specimen);});
  addEventListener('keydown',e=>{if(e.key==='Escape')setMode('map');});
  let down=null;
  renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,id:e.pointerId,button:e.button};});
  renderer.domElement.addEventListener('pointerup',e=>{
    if(down&&down.id===e.pointerId&&down.button===0&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<6){const obj=hitObject(e);if(obj)activate(obj);}down=null;
  });
  renderer.domElement.addEventListener('pointercancel',()=>{down=null;});
  renderer.domElement.addEventListener('pointermove',e=>{
    const obj=hitObject(e);renderer.domElement.style.cursor=obj?'pointer':'grab';
    $('tooltip').style.display=obj&&!down?'block':'none';
    if(obj){$('tooltip').textContent=obj.userData.caption;$('tooltip').style.left=Math.min(e.clientX+16,innerWidth-240)+'px';$('tooltip').style.top=Math.max(12,e.clientY-35)+'px';}
  });
  renderer.domElement.addEventListener('pointerleave',()=>{$('tooltip').style.display='none';});
}
function updateLabels(time) {
  if(state.mode!=='map')return;
  camera.updateMatrixWorld();
  for(const [id,p] of Object.entries(state.pins)) {
    p.obj.rotation.y=Math.atan2(camera.position.x-p.obj.position.x,camera.position.z-p.obj.position.z)+Math.PI/2;
    const pos=new THREE.Vector3(p.obj.position.x,.82,p.obj.position.z).project(camera);
    const visible=pos.z<1&&pos.z>-1&&Math.abs(pos.x)<1.1&&Math.abs(pos.y)<1.1;
    p.button.style.display=visible?'block':'none';p.button.style.left=(pos.x*.5+.5)*innerWidth+'px';p.button.style.top=(-pos.y*.5+.5)*innerHeight+'px';
    if(!reducedMotion&&id===state.selected)p.halo.material.opacity=.65+Math.sin(time*2)*.2;
  }
}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);frameCamera();}
function loop(time){frameId=requestAnimationFrame(loop);lastTime=time;controls.update();updateLabels(time/1000);renderer.render(scene,camera);}
function fail(err) {
  lastLoadError=err;console.error(err);$('loading').classList.remove('hide');$('load-text').textContent=t('failed')+err.message;$('retry').hidden=false;
}
async function start() {
  renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:!!window.__TEST__});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  $('map3d').appendChild(renderer.domElement);
  scene=new THREE.Scene();scene.background=new THREE.Color(0xb8bea3);scene.fog=new THREE.Fog(0xb8bea3,24,55);
  camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.05,100);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=!reducedMotion;controls.enablePan=false;
  scene.add(new THREE.HemisphereLight(0xfff6db,0x65745a,2.0));
  sun=new THREE.DirectionalLight(0xffefd1,3.0);sun.position.set(-5,12,4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-9,right:9,top:9,bottom:-9,near:.5,far:30});sun.shadow.normalBias=.018;scene.add(sun);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),material(0xa9b397));floor.rotation.x=-Math.PI/2;floor.position.y=-.53;floor.receiveShadow=true;scene.add(floor);
  mapRoot=new THREE.Group();studyRoot=new THREE.Group();scene.add(mapRoot,studyRoot);
  const plinth=box(4.8,.27,3.7,.17,lightClay);plinth.position.y=.04;studyRoot.add(plinth);
  let count=0;
  const mapAssets={pin:pinBytes,hills:hillsBytes,compass:compassBytes,radio:radioBytes,rock:rockBytes,feather:featherBytes,dino:dinoBytes};
  const total=Object.keys(mapAssets).length;
  $('load-bar').max=total;
  await Promise.all(Object.entries(mapAssets).map(async([id,bytes])=>{
    state.models[id]=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    state.loaded.push(id);
    $('load-bar').value=++count;$('load-text').textContent=`${t('loading')} ${count} / ${total}`;
  }));
  buildMap();updateEarned();bind();state.ready=true;setLanguage(language,false);
  setMode(location.hash==='#catalog'?'catalog':'map',false);
  loop(0);$('loading').classList.add('hide');addEventListener('resize',resize);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(frameId);fail(new Error(t('contextLost')));});
  window.__home={get ready(){return state.ready;},get mode(){return state.mode;},get selected(){return state.selected;},get loaded(){return [...state.loaded];},get earned(){return state.earned;},get specimen(){return state.specimen;},
    screenPoint(key){camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);const o=state.objects.find(o=>o.userData.action===key);if(!o)return null;const v=new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).project(camera);return{x:(v.x*.5+.5)*innerWidth,y:(-v.y*.5+.5)*innerHeight};},stats(){return{triangles:renderer.info.render.triangles,calls:renderer.info.render.calls};}};
}
$('retry').onclick=()=>location.reload();setLanguage(language,false);start().catch(fail);
