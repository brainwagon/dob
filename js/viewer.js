// three.js viewer — renders the parts produced by the geometry engine.
// It only EXTRUDES profiles (plywood) or draws primitives (cylinders/markers); it
// never invents geometry. The three frame groups (ground/az/ota) carry the azimuth
// and altitude transforms so you can swing the OTA through its range and eyeball clearance.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// map a part id to a visibility group
export function groupOf(id) {
  if (id.startsWith('cradle')) return 'cradle';
  if (id === 'tube') return 'tube';
  if (id.startsWith('bearing')) return 'bearings';
  if (id === 'rocker_bottom') return 'rockerbase';
  if (id.startsWith('rocker')) return 'rocker';
  if (id.startsWith('ground') || id.startsWith('foot')) return 'ground';
  return 'markers'; // altpad / azpad / axis_marker
}

export class Viewer {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1d22);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
    this.camera.position.set(60, 55, 80);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(50, 80, 40); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.4);
    fill.position.set(-40, 30, -50); this.scene.add(fill);
    this.scene.add(new THREE.GridHelper(120, 24, 0x333a44, 0x262b33));

    // frame groups
    this.ground = new THREE.Group();
    this.az = new THREE.Group();
    this.ota = new THREE.Group();
    this.az.add(this.ota);
    this.scene.add(this.ground);
    this.scene.add(this.az);

    this.dims = null;
    this.visibility = {};          // group → bool (default visible)
    this.colorMode = false;        // distinct per-part colors
    this.colorSeed = 0;
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._animate();
  }

  _resize() {
    const c = this.renderer.domElement;
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== w || c.height !== h) this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _clear(group) {
    for (const m of [...group.children]) {
      if (m.isGroup) continue;
      group.remove(m);
      m.geometry?.dispose();
      m.material?.dispose();
    }
  }

  _extrude(profile, holes, thickness) {
    const shape = new THREE.Shape(profile.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const h of holes || []) {
      const path = new THREE.Path();
      if (h.poly) {                       // rectangular/arbitrary slot
        path.moveTo(h.poly[0][0], h.poly[0][1]);
        for (let i = 1; i < h.poly.length; i++) path.lineTo(h.poly[i][0], h.poly[i][1]);
        path.closePath();
      } else {                            // circular bolt/pivot hole
        path.absarc(h.x, h.y, h.r, 0, Math.PI * 2, true);
      }
      shape.holes.push(path);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    geo.translate(0, 0, -thickness / 2);
    geo.computeVertexNormals();
    return geo;
  }

  _mesh(part) {
    let geo, mat;
    const transparent = part.opacity != null && part.opacity < 1;
    if (part.kind === 'plywood') {
      geo = this._extrude(part.profile, part.holes, part.thickness);
      mat = new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.85, side: THREE.DoubleSide });
    } else if (part.kind === 'cylinder') {
      geo = new THREE.CylinderGeometry(part.radius, part.radius, part.height, 48);
      mat = new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.5, transparent, opacity: part.opacity ?? 1, depthWrite: !transparent });
    } else { // marker
      geo = part.shape === 'sphere'
        ? new THREE.SphereGeometry(part.size, 16, 16)
        : new THREE.BoxGeometry(part.size[0], part.size[1], part.size[2]);
      mat = new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.4 });
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...part.position);
    if (part.rotation) mesh.rotation.set(...part.rotation);
    return mesh;
  }

  setModel(model) {
    this.dims = model.dims;
    this._clear(this.ground); this._clear(this.az); this._clear(this.ota);
    const frame = { ground: this.ground, az: this.az, ota: this.ota };
    for (const part of model.parts) {
      const mesh = this._mesh(part);
      mesh.userData = { group: groupOf(part.id), partId: part.id, kind: part.kind, baseColor: part.color };
      mesh.visible = this.visibility[mesh.userData.group] !== false;
      frame[part.frame].add(mesh);
    }
    // place the OTA pivot at the altitude axis height
    this.ota.position.set(0, model.dims.axisHeight, 0);
    this._applyColors();
  }

  setGroupVisible(group, visible) {
    this.visibility[group] = visible;
    for (const root of [this.ground, this.az, this.ota])
      root.traverse(o => { if (o.isMesh && o.userData.group === group) o.visible = visible; });
  }

  // a stable pseudo-random hue per part id (+ seed)
  _hue(id) {
    let h = (2166136261 ^ this.colorSeed) >>> 0;
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
    return ((h >>> 0) % 1000) / 1000;
  }

  _applyColors() {
    for (const root of [this.ground, this.az, this.ota])
      root.traverse(o => {
        if (o.isMesh && o.userData.kind === 'plywood')
          this.colorMode ? o.material.color.setHSL(this._hue(o.userData.partId), 0.45, 0.6)
                         : o.material.color.setHex(o.userData.baseColor);
      });
  }

  setColorMode(on) { this.colorMode = on; this._applyColors(); }
  randomizeColors() { this.colorSeed = (this.colorSeed + 1) >>> 0; this.colorMode = true; this._applyColors(); }

  setAltitude(deg) { this.ota.rotation.x = -deg * Math.PI / 180; } // 0=horizon, 90=zenith
  setAzimuth(deg)  { this.az.rotation.y  =  deg * Math.PI / 180; }

  _animate() {
    requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
