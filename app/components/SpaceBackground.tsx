"use client";

import { useEffect, useRef } from "react";

/**
 * 宇宙アニメーション背景（v1.5）。
 * 星空（きらめき＋パララックス）＋ 太陽/月/惑星 ＋ 流れ星 ＋ 横切るロケット🚀。
 * - 全画面固定・操作透過（pointer-events: none）
 * - prefers-reduced-motion を尊重（静止した星空＋天体のみ）
 * - タブ非表示中は描画を止めて電池/CPUを節約
 */
export function SpaceBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let w = 0;
    let h = 0;
    let dpr = 1;

    interface Star {
      x: number;
      y: number;
      r: number;
      baseA: number;
      tw: number; // 瞬きの速さ
      vx: number; // 漂流速度（奥行きで変える）
      sparkle: boolean; // 十字のきらめきを出すか
      hue: string; // 色味（白/青白/暖色）
    }
    interface Shoot {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      max: number;
    }
    interface Rocket {
      x: number;
      y: number;
      vx: number;
      vy: number;
      angle: number;
      trail: Array<{ x: number; y: number; a: number }>;
    }

    let stars: Star[] = [];
    let shoots: Shoot[] = [];
    let rocket: Rocket | null = null;
    let rocketTimer = 0;

    const STAR_HUES = [
      "255,255,255",
      "255,255,255",
      "200,220,255", // 青白
      "255,236,200", // 暖色
    ];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2); // DPR上限でGPU負荷抑制
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = Math.floor(w * dpr);
      canvas!.height = Math.floor(h * dpr);
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      initStars();
    }

    function initStars() {
      const count = Math.round(Math.min(170, (w * h) / 9000));
      stars = Array.from({ length: count }, () => {
        const depth = Math.random(); // 0=遠い,1=近い
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: 0.5 + depth * 1.7,
          baseA: 0.5 + Math.random() * 0.5,
          tw: 0.5 + Math.random() * 1.5,
          vx: -(0.02 + depth * 0.12),
          sparkle: depth > 0.78, // 近い（明るい）星だけ十字のきらめき
          hue: STAR_HUES[Math.floor(Math.random() * STAR_HUES.length)],
        };
      });
    }

    // ── 天体（太陽・月・惑星） ────────────────────────────────
    function drawSun() {
      const cx = w * 0.1;
      const cy = h * 0.08;
      const pulse = reduced ? 1 : 0.96 + 0.04 * Math.sin(t * 0.03);
      const glow = 150 * pulse;
      const halo = ctx!.createRadialGradient(cx, cy, 0, cx, cy, glow);
      halo.addColorStop(0, "rgba(255,226,150,0.55)");
      halo.addColorStop(0.25, "rgba(255,180,90,0.22)");
      halo.addColorStop(1, "rgba(255,150,60,0)");
      ctx!.fillStyle = halo;
      ctx!.fillRect(0, 0, w, h);
      // コア
      const core = ctx!.createRadialGradient(cx, cy, 0, cx, cy, 24);
      core.addColorStop(0, "rgba(255,248,224,0.95)");
      core.addColorStop(1, "rgba(255,210,130,0.5)");
      ctx!.fillStyle = core;
      ctx!.beginPath();
      ctx!.arc(cx, cy, 24, 0, Math.PI * 2);
      ctx!.fill();
    }

    function drawMoon() {
      const cx = w * 0.84;
      const cy = h * 0.13;
      const r = 22;
      ctx!.save();
      // ほのかなグロー
      const glow = ctx!.createRadialGradient(cx, cy, 0, cx, cy, r * 3);
      glow.addColorStop(0, "rgba(220,228,245,0.18)");
      glow.addColorStop(1, "rgba(220,228,245,0)");
      ctx!.fillStyle = glow;
      ctx!.fillRect(0, 0, w, h);
      // 本体
      ctx!.fillStyle = "rgba(214,222,238,0.85)";
      ctx!.beginPath();
      ctx!.arc(cx, cy, r, 0, Math.PI * 2);
      ctx!.fill();
      // クレーター
      ctx!.fillStyle = "rgba(150,160,185,0.45)";
      const craters: Array<[number, number, number]> = [
        [-6, -4, 4],
        [5, 2, 3],
        [-2, 7, 2.5],
      ];
      for (const [dx, dy, cr] of craters) {
        ctx!.beginPath();
        ctx!.arc(cx + dx, cy + dy, cr, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.restore();
    }

    function drawPlanet() {
      // 右下に土星風の輪付き惑星
      const cx = w * 0.82;
      const cy = h * 0.82;
      const r = 26;
      ctx!.save();
      // 本体グラデーション（インディゴ系）
      const body = ctx!.createRadialGradient(
        cx - 8,
        cy - 8,
        2,
        cx,
        cy,
        r,
      );
      body.addColorStop(0, "rgba(165,180,252,0.8)");
      body.addColorStop(1, "rgba(79,70,229,0.55)");
      ctx!.fillStyle = body;
      ctx!.beginPath();
      ctx!.arc(cx, cy, r, 0, Math.PI * 2);
      ctx!.fill();
      // リング
      ctx!.translate(cx, cy);
      ctx!.rotate(-0.45);
      ctx!.strokeStyle = "rgba(199,210,254,0.55)";
      ctx!.lineWidth = 2.5;
      ctx!.beginPath();
      ctx!.ellipse(0, 0, r * 1.9, r * 0.55, 0, 0, Math.PI * 2);
      ctx!.stroke();
      ctx!.strokeStyle = "rgba(199,210,254,0.25)";
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.ellipse(0, 0, r * 2.2, r * 0.65, 0, 0, Math.PI * 2);
      ctx!.stroke();
      ctx!.restore();
    }

    function drawStar(s: Star) {
      const a = reduced
        ? s.baseA
        : s.baseA * (0.55 + 0.45 * Math.sin(t * 0.02 * s.tw + s.x));
      // コア
      ctx!.beginPath();
      ctx!.fillStyle = `rgba(${s.hue},${a})`;
      ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx!.fill();
      // きらめき（十字の光条）
      if (s.sparkle) {
        const len = s.r * (3.5 + 1.5 * Math.sin(t * 0.03 * s.tw + s.y));
        ctx!.strokeStyle = `rgba(${s.hue},${a * 0.5})`;
        ctx!.lineWidth = 0.8;
        ctx!.beginPath();
        ctx!.moveTo(s.x - len, s.y);
        ctx!.lineTo(s.x + len, s.y);
        ctx!.moveTo(s.x, s.y - len);
        ctx!.lineTo(s.x, s.y + len);
        ctx!.stroke();
      }
    }

    function spawnRocket() {
      const fromLeft = Math.random() > 0.5;
      const y = h * (0.25 + Math.random() * 0.45);
      const speed = 1.6 + Math.random() * 1.2;
      rocket = {
        x: fromLeft ? -60 : w + 60,
        y,
        vx: fromLeft ? speed : -speed,
        vy: -(0.3 + Math.random() * 0.4),
        angle: 0,
        trail: [],
      };
      rocket.angle = Math.atan2(rocket.vy, rocket.vx);
    }

    function drawRocket(r: Rocket) {
      // 炎トレイル（暖色→teal）
      for (const tr of r.trail) {
        ctx!.beginPath();
        ctx!.fillStyle = `rgba(255,170,80,${tr.a * 0.55})`;
        ctx!.arc(tr.x, tr.y, 3 * tr.a + 0.6, 0, Math.PI * 2);
        ctx!.fill();
      }
      // 本体（絵文字）＋発光で黒つぶれを防ぐ
      ctx!.save();
      ctx!.translate(r.x, r.y);
      ctx!.rotate(r.angle + Math.PI / 4); // 🚀は右上向き基準
      // 白い発光ハロー
      const halo = ctx!.createRadialGradient(0, 0, 0, 0, 0, 22);
      halo.addColorStop(0, "rgba(255,255,255,0.55)");
      halo.addColorStop(1, "rgba(255,255,255,0)");
      ctx!.fillStyle = halo;
      ctx!.beginPath();
      ctx!.arc(0, 0, 22, 0, Math.PI * 2);
      ctx!.fill();
      // 絵文字（グロー付き）
      ctx!.shadowColor = "rgba(120,220,255,0.9)";
      ctx!.shadowBlur = 12;
      ctx!.font = "30px serif";
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";
      ctx!.fillText("🚀", 0, 0);
      ctx!.restore();
    }

    let raf = 0;
    let t = 0;

    function frame() {
      t += 1;
      ctx!.clearRect(0, 0, w, h);

      // 宇宙グラデーション
      const g = ctx!.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#070a18");
      g.addColorStop(0.5, "#0a0a14");
      g.addColorStop(1, "#05060d");
      ctx!.fillStyle = g;
      ctx!.fillRect(0, 0, w, h);

      // 淡いネビュラ
      const neb = (cx: number, cy: number, rad: number, color: string) => {
        const rg = ctx!.createRadialGradient(cx, cy, 0, cx, cy, rad);
        rg.addColorStop(0, color);
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx!.fillStyle = rg;
        ctx!.fillRect(0, 0, w, h);
      };
      neb(w * 0.25, h * 0.4, Math.max(w, h) * 0.45, "rgba(45,212,191,0.05)");
      neb(w * 0.7, h * 0.55, Math.max(w, h) * 0.5, "rgba(99,102,241,0.06)");

      // 星
      for (const s of stars) {
        drawStar(s);
        if (!reduced) {
          s.x += s.vx;
          if (s.x < -3) {
            s.x = w + 3;
            s.y = Math.random() * h;
          }
        }
      }

      // 天体（星より手前）
      drawSun();
      drawMoon();
      drawPlanet();

      if (!reduced) {
        // 流れ星
        if (Math.random() < 0.004 && shoots.length < 3) {
          shoots.push({
            x: Math.random() * w * 0.8,
            y: Math.random() * h * 0.4,
            vx: 4 + Math.random() * 3,
            vy: 2 + Math.random() * 2,
            life: 0,
            max: 60,
          });
        }
        shoots = shoots.filter((sh) => sh.life < sh.max);
        for (const sh of shoots) {
          sh.life += 1;
          const a = 1 - sh.life / sh.max;
          ctx!.strokeStyle = `rgba(190,225,255,${a})`;
          ctx!.lineWidth = 2;
          ctx!.beginPath();
          ctx!.moveTo(sh.x, sh.y);
          ctx!.lineTo(sh.x - sh.vx * 4, sh.y - sh.vy * 4);
          ctx!.stroke();
          sh.x += sh.vx;
          sh.y += sh.vy;
        }

        // ロケット
        rocketTimer -= 1;
        if (!rocket && rocketTimer <= 0) {
          spawnRocket();
          rocketTimer = 60 * (12 + Math.random() * 10);
        }
        if (rocket) {
          rocket.trail.unshift({ x: rocket.x, y: rocket.y, a: 1 });
          if (rocket.trail.length > 18) rocket.trail.pop();
          for (const tr of rocket.trail) tr.a *= 0.9;
          rocket.x += rocket.vx;
          rocket.y += rocket.vy;
          drawRocket(rocket);
          if (rocket.x < -80 || rocket.x > w + 80 || rocket.y < -80) {
            rocket = null;
          }
        }
      }

      raf = requestAnimationFrame(frame);
    }

    function onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        raf = requestAnimationFrame(frame);
      }
    }

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);

    if (reduced) {
      frame();
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
    />
  );
}
