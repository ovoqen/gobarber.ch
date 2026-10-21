"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import communes from "@/data/ge-communes.json";

type Info = { name: string; count: number; x: number; y: number } | null;
/** Le canton de Genève en relief doré : 45 communes (contours officiels swisstopo), pastilles lumineuses là où un barbier intervient réellement. */
export default function CarteGeneve3D({ counts, onPick, trip = false }: { counts: Record<string, number>; onPick: (name: string) => void; trip?: boolean }) {
  const host = useRef<HTMLDivElement>(null), pickRef = useRef(onPick), countsRef = useRef(counts);
  pickRef.current = onPick; countsRef.current = counts;
  const [info, setInfo] = useState<Info>(null);

  useEffect(() => {
    const el = host.current; if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
    const key = new THREE.DirectionalLight(0xfff1d6, 2.4); key.position.set(-4, 9, 7); scene.add(key);
    const rim = new THREE.DirectionalLight(0xb8913a, 2.2); rim.position.set(6, 3, -6); scene.add(rim);

    // Centrage + échelle (km → unités)
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const c of communes) for (const p of c.polys) for (const [x, y] of p[0]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, S = 0.3;
    const world = new THREE.Group(); scene.add(world);
    type C = { name: string; mesh: THREE.Group; mats: THREE.MeshStandardMaterial[]; target: number; h: number; delay: number; has: boolean; pin?: THREE.Group };
    const items: C[] = []; const hitMeshes: THREE.Mesh[] = [];
    const lineMat = new THREE.LineBasicMaterial({ color: 0xc9a24a, transparent: true, opacity: 0.85 });
    for (const c of communes) {
      const has = (countsRef.current[c.name] ?? 0) > 0;
      const mat = new THREE.MeshStandardMaterial({ color: has ? 0x3a2c12 : 0x18181b, metalness: 0.65, roughness: 0.38, emissive: 0xb8913a, emissiveIntensity: has ? 0.14 : 0.0 });
      const g = new THREE.Group(); g.userData.name = c.name; const mats = [mat];
      for (const poly of c.polys) {
        const pts = (r: number[][]) => r.map(([x, y]) => new THREE.Vector2((x - cx) * S, (y - cy) * S));
        const shape = new THREE.Shape(pts(poly[0])); for (const h of poly.slice(1)) shape.holes.push(new THREE.Path(pts(h)));
        const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false }), mat); mesh.userData.name = c.name; g.add(mesh); hitMeshes.push(mesh);
        for (const r of poly) { const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts(r).map((v) => new THREE.Vector3(v.x, v.y, 1.002))), lineMat); g.add(l); }
      }
      g.rotation.x = -Math.PI / 2; g.scale.z = 0.0001; world.add(g);
      const d = Math.hypot(c.cx - cx, c.cy - cy);
      const it: C = { name: c.name, mesh: g, mats, target: 0.12, h: 0.0001, delay: d * 0.05, has };
      if (has) { // pastille lumineuse + onde
        const pin = new THREE.Group(); const orb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), new THREE.MeshStandardMaterial({ color: 0xe2c77a, emissive: 0xe2c77a, emissiveIntensity: 1.6, metalness: 1, roughness: 0.2 }));
        const wave = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.12, 48), new THREE.MeshBasicMaterial({ color: 0xe2c77a, transparent: true, opacity: 0.8, side: THREE.DoubleSide })); wave.rotation.x = -Math.PI / 2; wave.name = "wave";
        pin.add(orb, wave); pin.position.set((c.cx - cx) * S, 0.3, -(c.cy - cy) * S); world.add(pin); it.pin = pin;
      }
      items.push(it);
    }
    // Trajet « le barbier vient chez vous » : un jeton doré voyage au-dessus de la carte jusqu'à une maison, en boucle.
    let tripTick: ((t: number) => void) | null = null;
    if (trip) {
      const at = (n: string) => { const c = communes.find((x) => x.name === n)!; return new THREE.Vector3((c.cx - cx) * S, 0, -(c.cy - cy) * S); };
      const home = at("Genève").add(new THREE.Vector3(0.45, 0, 0.35)), from = at("Meyrin");
      const house = new THREE.Group(); const wall = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.3), new THREE.MeshStandardMaterial({ color: 0xefe6d0, roughness: 0.4, emissive: 0xb8913a, emissiveIntensity: 0.1 }));
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.2, 4), new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 1, roughness: 0.25 })); roof.rotation.y = Math.PI / 4; roof.position.y = 0.22;
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.01), new THREE.MeshStandardMaterial({ color: 0x131315 })); door.position.set(0, -0.06, 0.155);
      wall.position.y = 0.12; house.add(wall, roof, door); house.position.copy(home); house.position.y = 0.2; house.scale.setScalar(1.7); world.add(house);
      const halo2 = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.23, 48), new THREE.MeshBasicMaterial({ color: 0xe2c77a, transparent: true, opacity: 0, side: THREE.DoubleSide })); halo2.rotation.x = -Math.PI / 2; halo2.position.set(home.x, 0.22, home.z); world.add(halo2);
      const token = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), new THREE.MeshStandardMaterial({ color: 0xe2c77a, emissive: 0xe2c77a, emissiveIntensity: 1.4, metalness: 1, roughness: 0.2 })); world.add(token);
      const TR = 40, trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: TR }, () => from.clone())), new THREE.LineBasicMaterial({ color: 0xe2c77a, transparent: true, opacity: 0.7 })); world.add(trail);
      const pts: THREE.Vector3[] = Array.from({ length: TR }, () => from.clone());
      tripTick = (t) => {
        const T = 5.5, ph = (t % T) / T, run = Math.min(1, ph / 0.65), k = 1 - Math.pow(1 - run, 2.2);
        const mid = from.clone().lerp(home, 0.5); mid.y = 1.5;
        const a = from.clone().lerp(mid, k), b = mid.clone().lerp(home, k), p = a.lerp(b, k); p.y += 0.3 * (1 - k) + 0.25; if (run >= 1) p.copy(home).setY(0.55);
        token.position.copy(p); token.visible = true; pts.shift(); pts.push(p.clone()); trail.geometry.setFromPoints(pts); (trail.material as THREE.LineBasicMaterial).opacity = run >= 1 ? Math.max(0, 0.7 - (ph - 0.65) * 4) : 0.7;
        const arrive = ph > 0.65 ? (ph - 0.65) / 0.35 : 0; (halo2.material as THREE.MeshBasicMaterial).opacity = arrive > 0 ? (1 - arrive) * 0.9 : 0; halo2.scale.setScalar(1 + arrive * 3); token.scale.setScalar(arrive > 0 ? Math.max(0.01, 1 - arrive * 1.4) : 1);
        (wall.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.1 + (arrive > 0 ? (1 - arrive) * 0.9 : 0);
      };
    }
    // (halo circulaire supprimé : son bord se voyait comme un cercle autour du canton)

    // Interaction : survol, glisser pour orienter, clic = choisir la commune
    const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(2, 2); let hovered: C | null = null, drag = false, moved = 0, lx = 0, ly = 0, yaw = 0, pitch = 0.0, tYaw = 0, tPitch = 0, last: string | null = null;
    const set = (e: PointerEvent) => { const r = renderer.domElement.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); return r; };
    const onMove = (e: PointerEvent) => {
      const r = set(e);
      if (drag) { moved += Math.abs(e.clientX - lx) + Math.abs(e.clientY - ly); tYaw = Math.max(-0.7, Math.min(0.7, tYaw + (e.clientX - lx) * 0.006)); tPitch = Math.max(-0.35, Math.min(0.35, tPitch + (e.clientY - ly) * 0.004)); lx = e.clientX; ly = e.clientY; }
      if (last) setInfo((p) => (p ? { ...p, x: e.clientX - r.left, y: e.clientY - r.top } : p));
    };
    const onDown = (e: PointerEvent) => { drag = true; moved = 0; lx = e.clientX; ly = e.clientY; renderer.domElement.setPointerCapture(e.pointerId); };
    const onUp = (e: PointerEvent) => { drag = false; if (moved < 6 && hovered) pickRef.current(hovered.name); try { renderer.domElement.releasePointerCapture(e.pointerId); } catch {} };
    const onLeave = () => { ptr.set(2, 2); };
    const cv = renderer.domElement; cv.addEventListener("pointermove", onMove); cv.addEventListener("pointerdown", onDown); cv.addEventListener("pointerup", onUp); cv.addEventListener("pointerleave", onLeave); cv.style.touchAction = "pan-y";
    const resize = () => { const { clientWidth: w, clientHeight: h } = el; renderer.setSize(w, h, false); cv.style.cssText += ";width:100%;height:100%;display:block"; camera.aspect = w / h; const dist = w / h < 1 ? 15.5 : 11.5; camera.position.set(0, dist * 0.78, dist * 0.82); camera.lookAt(0, 0, 0.2); camera.updateProjectionMatrix(); };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();

    let raf = 0, visible = true; const t0 = performance.now(); const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(el);
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick); if (!visible) return; const t = (now - t0) / 1000;
      ray.setFromCamera(ptr, camera); const hit = ray.intersectObjects(hitMeshes, false)[0]; const name = (hit?.object.userData.name as string) ?? null; hovered = items.find((i) => i.name === name) ?? null;
      cv.style.cursor = hovered ? "pointer" : drag ? "grabbing" : "grab";
      if (name !== last) { last = name; if (!name) setInfo(null); else setInfo({ name, count: countsRef.current[name] ?? 0, x: 0, y: 0 }); }
      for (const it of items) {
        const intro = reduce ? 1 : Math.min(1, Math.max(0, (t - 0.3 - it.delay) / 0.9)), e = 1 - Math.pow(1 - intro, 3);
        it.target = (it === hovered ? 0.55 : it.has ? 0.2 : 0.12);
        it.h += (it.target * e - it.h) * 0.14; it.mesh.scale.z = Math.max(0.0001, it.h);
        const em = it === hovered ? 0.6 : it.has ? 0.14 : 0; it.mats[0].emissiveIntensity += (em - it.mats[0].emissiveIntensity) * 0.15;
        if (it.pin) { it.pin.position.y = it.h + 0.12 + (reduce ? 0 : Math.sin(t * 2 + it.delay * 9) * 0.03); const w = it.pin.getObjectByName("wave") as THREE.Mesh; const k = reduce ? 0.5 : (t * 0.7 + it.delay) % 1; w.scale.setScalar(1 + k * 5); (w.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.7; }
      }
      if (tripTick && !reduce) tripTick(t); else if (tripTick) tripTick(3.9);
      yaw += (tYaw - yaw) * 0.08; pitch += (tPitch - pitch) * 0.08; if (!drag && !reduce) { tYaw *= 0.995; }
      world.rotation.y = yaw + (reduce ? 0 : Math.sin(t * 0.25) * 0.04); world.rotation.x = pitch;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); cv.removeEventListener("pointermove", onMove); cv.removeEventListener("pointerdown", onDown); cv.removeEventListener("pointerup", onUp); cv.removeEventListener("pointerleave", onLeave); world.traverse((o) => { (o as THREE.Mesh).geometry?.dispose?.(); }); renderer.dispose(); pm.dispose(); el.removeChild(cv); };
  }, []);

  return (
    <div className="relative h-[460px] w-full sm:h-[600px]">
      <div ref={host} aria-hidden className="size-full" />
      {info && <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[130%] whitespace-nowrap rounded-xl border border-gold/50 bg-ink/95 px-4 py-2 text-center shadow-xl" style={{ left: info.x, top: info.y }}>
        <p className="font-display text-xl text-white">{info.name}</p>
        <p className={`text-xs ${info.count ? "text-gold" : "text-white/50"}`}>{info.count ? `${info.count} barbier${info.count > 1 ? "s" : ""} disponible${info.count > 1 ? "s" : ""}` : "Bientôt disponible"}</p>
      </div>}
    </div>
  );
}
