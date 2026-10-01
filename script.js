/* =========================================================
   1. DATA — plans (x,z = top-left corner in metres; w = size along x,
   d = size along z; door = wall side holding the door gap: n,s,e,w).
   Rooms tile exactly, no gaps or overlaps.
   ========================================================= */
const PLANS = {
  1: [ // 10 x 9 m
    { name: 'Living Room', type: 'living',  x: 0, z: 0,   w: 6, d: 5,   door: 'w' },
    { name: 'Balcony',     type: 'balcony', x: 6, z: 0,   w: 4, d: 2.5, door: 'w' },
    { name: 'Kitchen',     type: 'kitchen', x: 6, z: 2.5, w: 4, d: 3.5, door: 'w' },
    { name: 'Bedroom',     type: 'bedroom', x: 0, z: 5,   w: 6, d: 4,   door: 'n' },
    { name: 'Bathroom',    type: 'bath',    x: 6, z: 6,   w: 4, d: 3,   door: 'w' },
  ],
  2: [ // 11 x 9 m
    { name: 'Living Room', type: 'living',  x: 0,  z: 0, w: 6, d: 5, door: 'w' },
    { name: 'Kitchen',     type: 'kitchen', x: 6,  z: 0, w: 5, d: 5, door: 'w' },
    { name: 'Bedroom 1',   type: 'bedroom', x: 0,  z: 5, w: 4, d: 4, door: 'n' },
    { name: 'Bathroom 1',  type: 'bath',    x: 4,  z: 5, w: 2, d: 4, door: 'w' },
    { name: 'Bedroom 2',   type: 'bedroom', x: 6,  z: 5, w: 3, d: 4, door: 'n' },
    { name: 'Bathroom 2',  type: 'bath',    x: 9,  z: 5, w: 2, d: 4, door: 'w' },
  ],
  3: [ // 12 x 10 m
    { name: 'Living Room',    type: 'living',  x: 0, z: 0,   w: 6, d: 5,   door: 'w' },
    { name: 'Dining',         type: 'dining',  x: 6, z: 0,   w: 3, d: 5,   door: 'w' },
    { name: 'Kitchen',        type: 'kitchen', x: 9, z: 0,   w: 3, d: 5,   door: 'w' },
    { name: 'Master Bedroom', type: 'bedroom', x: 0, z: 5,   w: 4, d: 5,   door: 'n' },
    { name: 'Bathroom 1',     type: 'bath',    x: 4, z: 5,   w: 2, d: 2.5, door: 'w' },
    { name: 'Bathroom 2',     type: 'bath',    x: 4, z: 7.5, w: 2, d: 2.5, door: 'e' },
    { name: 'Bedroom 2',      type: 'bedroom', x: 6, z: 5,   w: 3, d: 5,   door: 'n' },
    { name: 'Bedroom 3',      type: 'bedroom', x: 9, z: 5,   w: 3, d: 5,   door: 'w' },
  ],
};

// Furniture palettes: each mesh has a "role"; restyling just recolours roles.
const STYLES = {
  modern:  { main: '#6b7078', alt: '#2a2c30', wood: '#4a4d52', linen: '#9aa0a8', rug: '#3a3d42', white: '#e6e8ea', dark: '#1d1e20', leaf: '#4f8a4f' },
  classic: { main: '#d9c9a3', alt: '#5a3a22', wood: '#4a2f1b', linen: '#efe3c8', rug: '#7a3b36', white: '#f1e8d2', dark: '#2e1c10', leaf: '#4f8a4f' },
  minimal: { main: '#f2f2ee', alt: '#d8bf94', wood: '#dcc7a0', linen: '#ffffff', rug: '#e9e6df', white: '#ffffff', dark: '#bfbfb8', leaf: '#4f8a4f' },
};
const FLOOR = { living: '#d9d2c3', bedroom: '#cdd6df', kitchen: '#e3d8c0', dining: '#e0cfb4', bath: '#bfd9d9', balcony: '#c9b89a' };

const WALL_H = 2.4, DOOR_W = 0.9, EYE = 1.6, WALL_T = 0.12, SQFT = 10.7639;
const V3 = THREE.Vector3;

/* =========================================================
   2. STATE + SCENE SETUP
   ========================================================= */
const state = { plan: '1', style: 'modern', furn: true }; // remembered across layouts
let mode = 'orbit';          // 'orbit' | 'walk'
let rooms = [], walls = [], furnGroups = [], adj = new Map();
let house = null, labels = null, W = 0, D = 0, current = null, tourOn = false;
let yaw = 0, pitch = 0;      // walk-mode look angles

const $ = id => document.getElementById(id);
const stage = $('stage');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
camera.rotation.order = 'YXZ';
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 3; controls.maxDistance = 60;
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.addEventListener('start', () => stopTour()); // user input cancels a tour

// Lights: soft sky light + sun with shadows
const hemi = new THREE.HemisphereLight(0xffffff, 0x88aa88, 0.75);
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(7, 22, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
sun.shadow.bias = -0.0005;
scene.add(hemi, sun);

// Green lawn under the house
const lawn = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ color: '#74a96d', roughness: 1 }));
lawn.rotation.x = -Math.PI / 2; lawn.position.y = -0.1; lawn.receiveShadow = true;
scene.add(lawn);

// Light/dark scene colours follow the system setting
const mq = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const dark = mq.matches;
  scene.background = new THREE.Color(dark ? '#10181a' : '#dbe9ef');
  lawn.material.color.set(dark ? '#34553a' : '#74a96d');
  hemi.intensity = dark ? 0.5 : 0.75; sun.intensity = dark ? 0.6 : 1;
}
mq.addEventListener('change', applyTheme); applyTheme();

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);

/* =========================================================
   3. TWEEN HELPERS (promise based, cancellable)
   ========================================================= */
let tweens = [];
const easeIO = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
const linear = k => k;
function tween(ms, fn, ease = easeIO) { return new Promise(res => tweens.push({ t0: performance.now(), ms, fn, ease, res })); }
function cancelAll() { tweens.forEach(t => t.res(false)); tweens = []; }
const sleep = ms => tween(ms, () => {}, linear);
function lerpAng(a, b, k) { const d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * k; }
function runTweens() {
  const now = performance.now();
  tweens = tweens.filter(t => {
    const k = Math.min(1, (now - t.t0) / t.ms);
    t.fn(t.ease(k));
    if (k >= 1) { t.res(true); return false; }
    return true;
  });
}

/* =========================================================
   4. HOUSE BUILDER (floors, walls, labels, furniture)
   ========================================================= */
const wallMat = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: .9 });

function doorPt(r) { // door centre on the wall line + outward direction
  return { n: { x: r.cx, z: r.wz, dx: 0, dz: -1 }, s: { x: r.cx, z: r.wz + r.d, dx: 0, dz: 1 },
           w: { x: r.wx, z: r.cz, dx: -1, dz: 0 }, e: { x: r.wx + r.w, z: r.cz, dx: 1, dz: 0 } }[r.door];
}
const roomAt = (x, z) => rooms.find(r => x >= r.wx && x <= r.wx + r.w && z >= r.wz && z <= r.wz + r.d);

function buildHouse() {
  if (house) { scene.remove(house); house.traverse(o => { o.geometry && o.geometry.dispose(); if (o.material && o.material !== wallMat) { o.material.map && o.material.map.dispose(); o.material.dispose(); } }); }
  const plan = PLANS[state.plan];
  W = Math.max(...plan.map(r => r.x + r.w)); D = Math.max(...plan.map(r => r.z + r.d));
  const ox = -W / 2, oz = -D / 2;
  house = new THREE.Group(); labels = new THREE.Group(); house.add(labels); scene.add(house);
  walls = []; furnGroups = []; adj = new Map();
  rooms = plan.map(r => ({ ...r, wx: r.x + ox, wz: r.z + oz, cx: r.x + ox + r.w / 2, cz: r.z + oz + r.d / 2 }));

  // Door lines, so a neighbour's door also opens the shared wall
  const doors = rooms.map(r => { const p = doorPt(r); return { axis: p.dx ? 'x' : 'z', pos: p.dx ? p.x : p.z, c: p.dx ? p.z : p.x }; });

  rooms.forEach(r => {
    // Coloured floor (top surface at y = 0)
    const f = new THREE.Mesh(new THREE.BoxGeometry(r.w, 0.1, r.d), new THREE.MeshStandardMaterial({ color: FLOOR[r.type], roughness: .85 }));
    f.position.set(r.cx, -0.05, r.cz); f.receiveShadow = true; house.add(f);

    // Walls with door gaps (balcony = short railing)
    const h = r.type === 'balcony' ? 1.0 : WALL_H, t = r.type === 'balcony' ? 0.06 : WALL_T;
    ['n', 's', 'w', 'e'].forEach(side => {
      const horiz = side === 'n' || side === 's';
      const line = { n: r.wz, s: r.wz + r.d, w: r.wx, e: r.wx + r.w }[side];
      const s0 = horiz ? r.wx : r.wz, s1 = horiz ? r.wx + r.w : r.wz + r.d;
      const off = (side === 'n' || side === 'w') ? t / 2 : -t / 2;
      const gaps = doors.filter(d => d.axis === (horiz ? 'z' : 'x') && Math.abs(d.pos - line) < .01 && d.c > s0 + .5 && d.c < s1 - .5)
        .map(d => [d.c - DOOR_W / 2, d.c + DOOR_W / 2]).sort((a, b) => a[0] - b[0]);
      const segs = []; let cur = s0;
      gaps.forEach(g => { if (g[0] > cur) segs.push([cur, g[0]]); cur = g[1]; });
      if (s1 - cur > .02) segs.push([cur, s1]);
      segs.forEach(([a, b]) => {
        const L = b - a, m = new THREE.Mesh(new THREE.BoxGeometry(horiz ? L : t, h, horiz ? t : L), wallMat);
        const px = horiz ? a + L / 2 : line + off, pz = horiz ? line + off : a + L / 2;
        m.position.set(px, h / 2, pz); m.castShadow = m.receiveShadow = true; house.add(m);
        walls.push({ x0: px - (horiz ? L : t) / 2, x1: px + (horiz ? L : t) / 2, z0: pz - (horiz ? t : L) / 2, z1: pz + (horiz ? t : L) / 2 }); // collision box
      });
    });

    // Floating label
    const sp = makeLabel(r.name); sp.position.set(r.cx, 3.0, r.cz); labels.add(sp);

    // Furniture in its own group per room
    const fg = buildFurniture(r); house.add(fg); furnGroups.push(fg);
  });

  // Door graph (used to route walk-mode tours through doorways)
  rooms.forEach(a => {
    const p = doorPt(a), b = roomAt(p.x + p.dx * .5, p.z + p.dz * .5);
    if (!b) return;
    const add = (from, to, nx, nz) => { if (!adj.has(from)) adj.set(from, []); adj.get(from).push({ to, x: p.x, z: p.z, nx, nz }); };
    add(a, b, p.dx, p.dz); add(b, a, -p.dx, -p.dz);
  });

  applyStyle(); applyFurnVisibility(); labels.visible = mode === 'orbit';
  buildRoomButtons();
  const area = rooms.reduce((s, r) => s + r.w * r.d, 0);
  $('total').innerHTML = `Total ${area.toFixed(1)} m²<br>${Math.round(area * SQFT)} sq ft`;
}

function makeLabel(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); (g.roundRect || g.rect).call(g, 8, 16, 496, 96, 48); g.fill();
  g.fillStyle = '#2f4a35'; g.font = '600 50px Outfit, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 66);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
  s.scale.set(3, 0.75, 1); s.renderOrder = 10; return s;
}

/* =========================================================
   5. FURNITURE (boxes only). Built as if the door is on the south
   side (+z), then the group is rotated to match the real door.
   ========================================================= */
function buildFurniture(r) {
  const g = new THREE.Group();
  g.position.set(r.cx, 0, r.cz);
  g.rotation.y = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }[r.door];
  const side = r.door === 'e' || r.door === 'w';
  const lw = side ? r.d : r.w, ld = side ? r.w : r.d, bz = -ld / 2; // local size, back wall z

  // B(role, width, height, depth, x, bottomY, z)
  const B = (role, w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ roughness: .8 }));
    m.position.set(x, y + h / 2, z); m.userData.role = role; m.castShadow = m.receiveShadow = true; g.add(m); return m;
  };
  const plant = (x, z) => { B('dark', .35, .35, .35, x, 0, z); B('leaf', .5, .6, .5, x, .35, z); B('leaf', .3, .4, .3, x, .95, z); };
  const chair = (x, z, dir) => { // backrest on side "dir" (z direction)
    B('alt', .45, .06, .45, x, .45, z); B('alt', .45, .5, .06, x, .5, z + dir * .2);
    [-1, 1].forEach(a => [-1, 1].forEach(b => B('wood', .05, .45, .05, x + a * .19, 0, z + b * .19)));
  };

  if (r.type === 'living') {
    B('rug', Math.min(3, lw - 1), .02, 2, 0, 0, bz + 2.1);
    B('main', 2.2, .45, .9, 0, 0, bz + .65); B('main', 2.2, .5, .2, 0, .45, bz + .2);       // sofa seat + back
    B('main', .2, .3, .9, -1.1, .45, bz + .65); B('main', .2, .3, .9, 1.1, .45, bz + .65);  // arms
    B('wood', 1.1, .4, .6, 0, 0, bz + 2.0);                                                 // coffee table
    B('wood', .4, .5, 1.4, lw / 2 - .35, 0, bz + 2); B('dark', .06, .7, 1.2, lw / 2 - .5, .55, bz + 2); // TV unit + TV
    plant(-lw / 2 + .45, bz + .45);
  }
  if (r.type === 'bedroom') {
    B('wood', 1.8, .3, 2.1, 0, 0, bz + 1.2); B('linen', 1.7, .2, 1.95, 0, .3, bz + 1.25); // bed
    B('wood', 1.9, 1, .1, 0, 0, bz + .1);                                                   // headboard
    B('white', .7, .12, .4, -.45, .5, bz + .45); B('white', .7, .12, .4, .45, .5, bz + .45); // pillows
    B('wood', .35, .5, .4, -1.15, 0, bz + .3); B('wood', .35, .5, .4, 1.15, 0, bz + .3);    // side tables
    B('alt', .6, 2, 1.4, -lw / 2 + .45, 0, ld / 2 - .9);                                    // wardrobe
  }
  if (r.type === 'kitchen') {
    const L1 = lw - 1.15, Ls = Math.min(ld - 1.4, 2.2);
    B('alt', L1, .9, .6, -.275, 0, bz + .35); B('wood', L1, .05, .65, -.275, .9, bz + .37);                 // back counter
    B('alt', .6, .9, Ls, -lw / 2 + .35, 0, bz + .7 + Ls / 2); B('wood', .65, .05, Ls, -lw / 2 + .37, .9, bz + .7 + Ls / 2); // L side
    B('dark', .6, .05, .5, .3, .95, bz + .35);                                                              // stove
    B('alt', .12, .02, .12, .1, 1.0, bz + .3); B('alt', .12, .02, .12, .5, 1.0, bz + .3);                   // burners
    B('white', .7, 1.9, .7, lw / 2 - .45, 0, bz + .45);                                                     // fridge
  }
  if (r.type === 'dining') {
    B('wood', 1.6, .06, .9, 0, .72, 0);
    [-1, 1].forEach(a => [-1, 1].forEach(b => B('wood', .07, .72, .07, a * .72, 0, b * .38)));
    chair(-.4, -.75, -1); chair(.4, -.75, -1); chair(-.4, .75, 1); chair(.4, .75, 1);
  }
  if (r.type === 'bath') {
    B('white', .4, .4, .5, -lw / 2 + .5, 0, bz + .4); B('white', .4, .5, .18, -lw / 2 + .5, .4, bz + .14); // toilet
    B('white', .5, .85, .5, -lw / 2 + .35, 0, bz + 1.3); B('alt', .35, .05, .35, -lw / 2 + .35, .85, bz + 1.3); // sink
    B('white', .9, .06, .9, lw / 2 - .55, 0, bz + .55);                                                      // shower tray
  }
  if (r.type === 'balcony') {
    chair(-.55, bz + .8, -1); chair(.55, bz + .8, -1);
    plant(lw / 2 - .4, bz + .4);
  }
  return g;
}

function applyStyle() { // recolour roles, no rebuild
  const pal = STYLES[state.style];
  furnGroups.forEach(g => g.traverse(o => { if (o.isMesh && pal[o.userData.role]) o.material.color.set(pal[o.userData.role]); }));
}
function applyFurnVisibility() { furnGroups.forEach(g => g.visible = state.furn); }

/* =========================================================
   6. CAMERA HELPERS (orbit fly-to, walk moves)
   ========================================================= */
const overviewPos = () => { const L = Math.max(W, D); return new V3(0, L * 1.15, L * 0.8); };
const look = () => camera.rotation.set(pitch, yaw, 0);

function flyTo(pos, target, ms = 1400) {
  const p0 = camera.position.clone(), t0 = controls.target.clone();
  return tween(ms, k => { camera.position.lerpVectors(p0, pos, k); controls.target.lerpVectors(t0, target, k); controls.update(); });
}
function roomView(r) {
  const span = Math.max(r.w, r.d);
  return [new V3(r.cx, 3.5 + span * .75, r.cz + r.d * .25 + 2.8), new V3(r.cx, .4, r.cz)];
}
function startOf(r) { // standing spot just inside the doorway, facing into the room
  const p = doorPt(r), inset = Math.min(.9, (p.dx ? r.w : r.d) * .35);
  return { x: p.x - p.dx * inset, z: p.z - p.dz * inset, yaw: Math.atan2(p.dx, p.dz) };
}
// Walk one segment (position + heading) at eye height
function seg(x, z, yawT, ms, last) {
  const x0 = camera.position.x, z0 = camera.position.z, y0 = camera.position.y, a0 = yaw, p0 = pitch;
  return tween(ms, k => {
    camera.position.set(x0 + (x - x0) * k, y0 + (EYE - y0) * k, z0 + (z - z0) * k);
    yaw = lerpAng(a0, yawT, last ? k : Math.min(1, k * 3)); pitch = p0 * (1 - k); look();
  }, linear);
}
function route(a, b) { // BFS over rooms; returns waypoints through each doorway
  const prev = new Map([[a, null]]), q = [a];
  while (q.length) { const c = q.shift(); if (c === b) break; (adj.get(c) || []).forEach(e => { if (!prev.has(e.to)) { prev.set(e.to, { from: c, e }); q.push(e.to); } }); }
  const hops = []; let c = b;
  while (prev.get(c)) { const p = prev.get(c); hops.unshift(p.e); c = p.from; }
  const pts = [];
  hops.forEach(e => pts.push([e.x - e.nx * .8, e.z - e.nz * .8], [e.x, e.z], [e.x + e.nx * .8, e.z + e.nz * .8]));
  return pts;
}
async function walkTo(r) {
  const cur = roomAt(camera.position.x, camera.position.z), s = startOf(r);
  const pts = cur && cur !== r ? route(cur, r) : [];
  pts.push([s.x, s.z]);
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i], dx = x - camera.position.x, dz = z - camera.position.z, dist = Math.hypot(dx, dz);
    if (dist < .05) continue;
    const last = i === pts.length - 1;
    if (!await seg(x, z, last ? s.yaw : Math.atan2(-dx, -dz), Math.max(500, dist / 1.7 * 1000), last)) return false;
  }
  return true;
}
function rotate360() { // slow full turn
  const a0 = yaw; return tween(6500, k => { yaw = a0 - Math.PI * 2 * k; pitch *= .98; look(); }, linear);
}

/* =========================================================
   7. MODES: walk / orbit, tour
   ========================================================= */
function ui() {
  document.body.classList.toggle('walk', mode === 'walk');
  $('walkBtn').hidden = mode === 'walk'; $('exitBtn').hidden = mode !== 'walk';
  if (labels) labels.visible = mode === 'orbit'; // labels hidden in walk mode
}
async function enterWalk() {
  stopTour(); mode = 'walk'; controls.enabled = false; ui();
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ'); yaw = e.y; pitch = e.x;
  const s = startOf(rooms[0]), p0 = camera.position.clone(), a0 = yaw, q0 = pitch;
  if (await tween(1600, k => { camera.position.set(p0.x + (s.x - p0.x) * k, p0.y + (EYE - p0.y) * k, p0.z + (s.z - p0.z) * k); yaw = lerpAng(a0, s.yaw, k); pitch = q0 * (1 - k); look(); })) setCurrent(rooms[0]);
}
async function exitWalk() { // smooth return to overview from above
  const o = overviewPos(), p0 = camera.position.clone(), a0 = yaw, q0 = pitch, qT = -Math.atan2(o.y, o.z);
  const ok = await tween(1800, k => { camera.position.lerpVectors(p0, o, k); yaw = lerpAng(a0, 0, k); pitch = q0 + (qT - q0) * k; look(); });
  if (!ok) return false;
  mode = 'orbit'; controls.target.set(0, 0, 0); controls.enabled = true; controls.update(); setCurrent(null); ui(); return true;
}
function setTourLabel() { $('tourBtn').textContent = tourOn ? 'Stop tour' : 'Start tour'; }
function stopTour() { tourOn = false; cancelAll(); setTourLabel(); }
async function startTour() {
  stopTour(); tourOn = true; setTourLabel();
  for (const r of rooms) {
    if (!tourOn) return;
    setCurrent(r);
    if (mode === 'walk') { if (!await walkTo(r) || !await rotate360()) return; }       // walk in, look around 360°
    else { const [p, t] = roomView(r); if (!await flyTo(p, t, 1500) || !await sleep(2000)) return; } // 3.5 s per room
  }
  if (!tourOn) return;
  if (mode === 'walk') await exitWalk(); else { await flyTo(overviewPos(), new V3(0, 0, 0)); setCurrent(null); }
  tourOn = false; setTourLabel();
}

/* =========================================================
   8. UI: panel, buttons, room list
   ========================================================= */
let roomBtns = [];
function setCurrent(r) {
  if (r === current) return; current = r;
  $('roomName').textContent = r ? r.name : 'Overview';
  $('roomSize').textContent = r ? `${r.w.toFixed(1)} × ${r.d.toFixed(1)} m · ${(r.w * r.d).toFixed(1)} m²` : 'Whole house';
  roomBtns.forEach((b, i) => b.classList.toggle('on', rooms[i] === r));
}
function buildRoomButtons() {
  const box = $('rooms'); box.innerHTML = ''; current = undefined;
  roomBtns = rooms.map(r => {
    const b = document.createElement('button'); b.textContent = r.name;
    b.onclick = () => { stopTour(); setCurrent(r); if (mode === 'walk') walkTo(r); else { const [p, t] = roomView(r); flyTo(p, t); } };
    box.appendChild(b); return b;
  });
}
function setPlan(k) {
  stopTour(); state.plan = k;
  document.querySelectorAll('#bhk button').forEach(b => b.classList.toggle('on', b.dataset.plan === k));
  buildHouse();
  if (mode === 'walk') { const s = startOf(rooms[0]); camera.position.set(s.x, EYE, s.z); yaw = s.yaw; pitch = 0; look(); setCurrent(rooms[0]); }
  else { camera.position.copy(overviewPos()); controls.target.set(0, 0, 0); controls.update(); setCurrent(null); }
}

document.querySelectorAll('#bhk button').forEach(b => b.onclick = () => setPlan(b.dataset.plan));
$('tourBtn').onclick = () => tourOn ? stopTour() : startTour();
$('walkBtn').onclick = enterWalk;
$('exitBtn').onclick = () => { stopTour(); exitWalk(); };
$('overviewBtn').onclick = () => {
  stopTour();
  if (mode === 'walk') exitWalk(); else { flyTo(overviewPos(), new V3(0, 0, 0)); setCurrent(null); }
};
$('furnBtn').onclick = e => { state.furn = !state.furn; e.currentTarget.setAttribute('aria-pressed', state.furn); applyFurnVisibility(); };
document.querySelectorAll('#styles button').forEach(b => b.onclick = () => {
  state.style = b.dataset.style;
  document.querySelectorAll('#styles button').forEach(x => x.classList.toggle('on', x === b));
  applyStyle();
});

/* =========================================================
   9. WALK INPUT: keys, d-pad, drag-to-look, wall collisions
   ========================================================= */
const keys = { f: 0, b: 0, l: 0, r: 0 };
const KEYMAP = { w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b', a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r' };
addEventListener('keydown', e => { const k = KEYMAP[e.key.toLowerCase()]; if (k && mode === 'walk') { keys[k] = 1; e.preventDefault(); } });
addEventListener('keyup', e => { const k = KEYMAP[e.key.toLowerCase()]; if (k) keys[k] = 0; });
document.querySelectorAll('#dpad button').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); keys[k] = 1; });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => keys[k] = 0));
});

let drag = null;
renderer.domElement.addEventListener('pointerdown', e => { if (mode === 'walk') drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointerup', () => drag = null);
addEventListener('pointermove', e => {
  if (mode !== 'walk' || !drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
  if (tourOn && Math.hypot(dx, dy) > 1) stopTour();
  yaw -= dx * 0.005; pitch = Math.max(-.6, Math.min(.6, pitch - dy * 0.004)); look();
});

const R = 0.25; // body radius for collisions
const blocked = (x, z) => Math.abs(x) > 28 || Math.abs(z) > 28 || walls.some(b => x > b.x0 - R && x < b.x1 + R && z > b.z0 - R && z < b.z1 + R);
function walkStep(dt) {
  const f = keys.f - keys.b, s = keys.r - keys.l;
  if (!f && !s) return;
  if (tweens.length) stopTour(); // manual movement takes over from any tour
  const sp = 2.4 * dt, p = camera.position;
  const nx = p.x + (-Math.sin(yaw) * f + Math.cos(yaw) * s) * sp;
  const nz = p.z + (-Math.cos(yaw) * f - Math.sin(yaw) * s) * sp;
  if (!blocked(nx, p.z)) p.x = nx;   // slide along walls: test axes separately
  if (!blocked(p.x, nz)) p.z = nz;
}

/* =========================================================
   10. MAIN LOOP + INIT
   ========================================================= */
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  runTweens();
  if (mode === 'walk') { walkStep(dt); const r = roomAt(camera.position.x, camera.position.z); if (r) setCurrent(r); }
  else controls.update();
  renderer.render(scene, camera);
}
function init() { resize(); setPlan('1'); ui(); requestAnimationFrame(loop); }
(document.fonts && document.fonts.load ? document.fonts.load('600 50px Outfit').catch(() => {}) : Promise.resolve()).then(init);