'use client';

import { useEffect, useRef } from 'react';

export type BrainMode =
  | 'idle' | 'listening' | 'thinking'
  | 'scanning' | 'results' | 'repair' | 'speaking';

interface FindingOrb {
  label: string;
  kind: 'fail' | 'warn' | 'pass';
  a: number;
  r: number;
}

interface SorenBrainProps {
  mode: BrainMode;
  findings?: FindingOrb[];
}

export function SorenBrain({ mode, findings = [] }: SorenBrainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef(mode);
  const findingsRef = useRef(findings);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => {
    findingsRef.current = findings;
  }, [findings]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId: number;
    let W = 0;
    let H = 0;
    let CX = 0;
    let CY = 0;
    let DPR = 1;
    let t = 0;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const c2d = ctx;

    function resize() {
      const r = canvas!.parentElement!.getBoundingClientRect();
      DPR = Math.min(devicePixelRatio || 1, 2);
      W = r.width;
      H = r.height;
      CX = W / 2;
      CY = H / 2 - 10;
      canvas!.width = W * DPR;
      canvas!.height = H * DPR;
      canvas!.style.width = `${W}px`;
      canvas!.style.height = `${H}px`;
      c2d.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function rnd(s: number) {
      return Math.abs((Math.sin(s * 999.123) * 43758.5453) % 1);
    }

    function insideBrain(x: number, y: number) {
      const lobes = [
        [-160, -54, 130, 90], [-64, -86, 128, 90],
        [60, -82, 138, 88], [165, -28, 110, 84],
        [94, 42, 130, 74], [-42, 42, 144, 82],
        [-156, 24, 106, 78], [166, 74, 76, 48],
      ];
      let ok = false;
      for (const l of lobes) {
        if (((x - l[0]) ** 2) / (l[2] ** 2) + ((y - l[1]) ** 2) / (l[3] ** 2) < 1) ok = true;
      }
      if (((x - 20) ** 2) / (86 ** 2) + ((y - 128) ** 2) / (62 ** 2) < 1 && x < 92) ok = false;
      return ok;
    }

    type Node = {
      ox: number;
      oy: number;
      oz: number;
      p: number;
      s: number;
      c: number;
      size: number;
    };
    const nodes: Node[] = [];
    let tries = 0;
    while (nodes.length < 1250 && tries < 150000) {
      tries++;
      const x = -290 + rnd(tries) * 580;
      const y = -170 + rnd(tries + 22) * 330;
      if (insideBrain(x, y)) {
        nodes.push({
          ox: x,
          oy: y,
          oz: (rnd(tries + 77) * 2 - 1) * 180,
          p: rnd(tries + 4) * 6.283,
          s: 0.55 + rnd(tries + 9) * 1.8,
          c: Math.floor(rnd(tries + 13) * 5),
          size: 0.7 + rnd(tries + 2) * 1.9,
        });
      }
    }

    const impulses: { idx: number; phase: number; speed: number; c: number }[] = [];
    for (let i = 0; i < 180; i++) {
      impulses.push({
        idx: Math.floor(rnd(i + 1) * nodes.length),
        phase: rnd(i + 2) * 6.283,
        speed: 0.02 + rnd(i + 3) * 0.06,
        c: i % 5,
      });
    }

    function col(c: number, a = 1) {
      return c === 0 ? `rgba(77,234,255,${a})`
        : c === 1 ? `rgba(255,95,210,${a})`
          : c === 2 ? `rgba(255,177,74,${a})`
            : c === 3 ? `rgba(79,140,255,${a})`
              : `rgba(99,255,163,${a})`;
    }
    function kindColor(k: string, a = 1) {
      return k === 'fail' ? `rgba(255,96,112,${a})`
        : k === 'warn' ? `rgba(255,177,74,${a})`
          : `rgba(99,255,163,${a})`;
    }

    function getState(m: BrainMode): [number, number, boolean, boolean, boolean] {
      const map: Record<BrainMode, [number, number, boolean, boolean, boolean]> = {
        idle: [0.18, 0.7, false, false, false],
        listening: [0.42, 1.2, true, false, false],
        thinking: [0.95, 1.7, false, false, false],
        scanning: [0.82, 1.8, true, true, false],
        results: [0.55, 1.45, false, false, true],
        repair: [0.78, 2.0, false, false, true],
        speaking: [0.62, 1.7, true, false, true],
      };
      return map[m];
    }

    function project(
      p: { x: number; y: number; z: number; p: number },
      rot: number,
      scale: number,
    ) {
      const x = p.x * Math.cos(rot) - p.z * Math.sin(rot);
      const z = p.x * Math.sin(rot) + p.z * Math.cos(rot);
      const y = p.y + Math.sin(t * 2 + p.p) * 2;
      const per = 760 / (760 + z);
      return {
        x: CX + x * per * scale,
        y: CY + y * per * scale,
        scale: per * scale,
        z,
      };
    }

    function drawBrainGlow(scale: number, rot: number, energy: number) {
      c2d.save();
      c2d.translate(CX, CY);
      c2d.scale(scale * (0.92 + 0.08 * Math.cos(rot)), scale);
      const g = c2d.createRadialGradient(0, -20, 30, 0, 0, 370);
      g.addColorStop(0, `rgba(77,234,255,${0.17 * energy})`);
      g.addColorStop(0.52, `rgba(255,95,210,${0.08 * energy})`);
      g.addColorStop(1, 'transparent');
      c2d.fillStyle = g;
      c2d.beginPath();
      for (let a = 0; a < 6.29; a += 0.012) {
        const rx = 285 + Math.sin(a * 5 + t) * 10 + Math.sin(a * 9) * 6;
        const ry = 162 + Math.cos(a * 4) * 8;
        const x = Math.cos(a) * rx;
        let y = Math.sin(a) * ry - 18;
        if (y > 74 && x < 90) y += 38 * Math.sin(((x + 170) / 250) * Math.PI);
        if (a === 0) c2d.moveTo(x, y);
        else c2d.lineTo(x, y);
      }
      c2d.closePath();
      c2d.fill();
      for (let k = 0; k < 12; k++) {
        c2d.strokeStyle = k % 2
          ? `rgba(255,95,210,${0.17 * energy})`
          : `rgba(77,234,255,${0.22 * energy})`;
        c2d.lineWidth = 1.2;
        c2d.beginPath();
        let st = false;
        for (let x = -255; x <= 255; x += 4) {
          const y = -82 + k * 20 + Math.sin(x * 0.028 + k + t * 0.75) * 13 + Math.sin(x * 0.06 + k) * 5;
          if (insideBrain(x, y)) {
            if (!st) { c2d.moveTo(x, y); st = true; }
            else c2d.lineTo(x, y);
          }
        }
        c2d.stroke();
      }
      c2d.restore();
    }

    function draw() {
      const m = modeRef.current;
      const orbs = findingsRef.current;
      const [speed, energy, wave, site, showOrbs] = getState(m);
      t += 0.012;
      c2d.clearRect(0, 0, W, H);

      const bg = c2d.createRadialGradient(CX, CY, 0, CX, CY, Math.min(W, H) * 0.55);
      bg.addColorStop(0, 'rgba(77,234,255,.18)');
      bg.addColorStop(0.48, 'rgba(155,108,255,.09)');
      bg.addColorStop(1, 'transparent');
      c2d.fillStyle = bg;
      c2d.fillRect(0, 0, W, H);

      const scale = Math.min(W, H) < 700 ? 0.68 : 0.86;
      const rot = t * speed;
      drawBrainGlow(scale, rot, energy);

      const wig = m === 'thinking' || m === 'repair' ? 7 : m === 'scanning' ? 5 : 3;
      const pts = nodes.map((n) => ({
        ...project({
          x: n.ox + Math.sin(t * n.s + n.p) * wig,
          y: n.oy + Math.cos(t * n.s + n.p) * wig * 0.65,
          z: n.oz + Math.sin(t * 0.8 + n.p) * 22,
          p: n.p,
        }, rot, scale),
        n,
      })).sort((a, b) => a.z - b.z);

      const maxDist = m === 'thinking' || m === 'repair' ? 54 : 44;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d = Math.hypot(dx, dy);
          if (d < maxDist) {
            c2d.strokeStyle = `rgba(77,234,255,${(1 - d / maxDist) * 0.2 * energy})`;
            c2d.lineWidth = 0.55;
            c2d.beginPath();
            c2d.moveTo(pts[i].x, pts[i].y);
            c2d.lineTo(pts[j].x, pts[j].y);
            c2d.stroke();
          }
        }
      }

      pts.forEach((p) => {
        const pulse = (Math.sin(t * 6 * p.n.s + p.n.p) + 1) / 2;
        c2d.fillStyle = col(p.n.c, 0.38 + 0.48 * pulse);
        c2d.shadowColor = col(p.n.c, 1);
        c2d.shadowBlur = 12 * energy;
        c2d.beginPath();
        c2d.arc(p.x, p.y, (p.n.size + 2.1 * pulse * energy) * p.scale, 0, 6.283);
        c2d.fill();
        c2d.shadowBlur = 0;
      });

      impulses.forEach((im) => {
        const n = nodes[im.idx];
        const p = project({
          x: n.ox + Math.cos(t * 8 + im.phase) * 20,
          y: n.oy + Math.sin(t * 7 + im.phase) * 12,
          z: n.oz,
          p: n.p,
        }, rot, scale);
        c2d.strokeStyle = col(im.c, 0.85);
        c2d.lineWidth = 2;
        c2d.shadowColor = col(im.c, 1);
        c2d.shadowBlur = 18;
        c2d.beginPath();
        c2d.arc(p.x, p.y, 3.5 * p.scale, 0, 6.283);
        c2d.stroke();
        c2d.shadowBlur = 0;
      });

      if (site) {
        const x = CX + 260;
        const y = CY - 60;
        const w = 190;
        const h = 120;
        c2d.strokeStyle = `rgba(77,234,255,${0.7 * energy})`;
        c2d.fillStyle = `rgba(77,234,255,${0.08 * energy})`;
        c2d.beginPath();
        c2d.rect(x, y, w, h);
        c2d.fill();
        c2d.stroke();
        c2d.beginPath();
        c2d.moveTo(CX + 130, CY);
        c2d.lineTo(x, y + h / 2);
        c2d.stroke();
        c2d.fillStyle = `rgba(99,255,163,${0.9 * energy})`;
        c2d.fillRect(x + 22, y + 18, 48, 6);
      }

      if (showOrbs && orbs.length > 0) {
        orbs.forEach((f) => {
          let r = f.r;
          if (m === 'repair') r -= Math.sin(Math.min((t % 3) / 1.2, 1) * Math.PI) * 135;
          const a = f.a + t * 0.28;
          const x = CX + Math.cos(a) * r;
          const y = CY + Math.sin(a) * r * 0.58;
          c2d.strokeStyle = kindColor(f.kind, 0.9);
          c2d.fillStyle = kindColor(f.kind, 0.14);
          c2d.shadowColor = kindColor(f.kind, 1);
          c2d.shadowBlur = 22;
          c2d.beginPath();
          c2d.arc(x, y, 22, 0, 6.283);
          c2d.fill();
          c2d.stroke();
          c2d.shadowBlur = 0;
          c2d.fillStyle = kindColor(f.kind, 1);
          c2d.font = '800 11px -apple-system,sans-serif';
          c2d.textAlign = 'center';
          c2d.fillText(f.label, x, y + 4);
        });
      }

      if (m === 'repair') {
        for (let i = 0; i < 36; i++) {
          const a = (i / 36) * 6.283 + t * 1.4;
          const r = 86 + Math.sin(t * 3 + i) * 20;
          const x = CX + Math.cos(a) * r;
          const y = CY + Math.sin(a) * r * 0.55;
          c2d.strokeStyle = 'rgba(99,255,163,.58)';
          c2d.beginPath();
          c2d.moveTo(CX, CY);
          c2d.lineTo(x, y);
          c2d.stroke();
        }
      }

      if (wave) {
        const wy = CY + 250;
        c2d.strokeStyle = `rgba(77,234,255,${0.75 * energy})`;
        c2d.lineWidth = 2;
        c2d.beginPath();
        for (let x = CX - 210; x <= CX + 210; x += 5) {
          const yy = wy + Math.sin(x * 0.06 + t * 12) * 24 * Math.sin(t * 4 + x * 0.01);
          if (x === CX - 210) c2d.moveTo(x, yy);
          else c2d.lineTo(x, yy);
        }
        c2d.stroke();
      }

      animId = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
      }}
    />
  );
}
