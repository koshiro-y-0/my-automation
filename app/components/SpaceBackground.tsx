"use client";

import { useEffect, useRef } from "react";

/**
 * 宇宙アニメーション背景（v1.5）。
 * 星空（パララックス）＋ 流れ星 ＋ たまに横切るロケット🚀。
 * - 全画面固定・操作透過（pointer-events: none）
 * - prefers-reduced-motion を尊重（静止した星空のみ）
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
      const count = Math.round(Math.min(160, (w * h) / 9000));
      stars = Array.from({ length: count }, () => {
        const depth = Math.random(); // 0=遠い,1=近い
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: 0.5 + depth * 1.6,
          baseA: 0.5 + Math.random() * 0.5,
          tw: 0.5 + Math.random() * 1.5,
          vx: -(0.02 + depth * 0.12), // 近い星ほど速く左へ流れる
        };
      });
    }

    function spawnRocket() {
      const fromLeft = Math.random() > 0.5;
      const y = h * (0.15 + Math.random() * 0.5);
      const speed = 1.6 + Math.random() * 1.2;
      rocket = {
        x: fromLeft ? -60 : w + 60,
        y,
        vx: fromLeft ? speed : -speed,
        vy: -(0.3 + Math.random() * 0.4),
        angle: 0,
        trail: [],
      };
      // 進行方向へ機首を向ける（絵文字は右上向き🚀基準で調整）
      rocket.angle = Math.atan2(rocket.vy, rocket.vx);
    }

    function drawRocket(r: Rocket) {
      // 炎トレイル
      for (const t of r.trail) {
        ctx!.beginPath();
        ctx!.fillStyle = `rgba(45,212,191,${t.a * 0.5})`;
        ctx!.arc(t.x, t.y, 2.4 * t.a + 0.5, 0, Math.PI * 2);
        ctx!.fill();
      }
      // 本体（絵文字）
      ctx!.save();
      ctx!.translate(r.x, r.y);
      // 🚀は右上(-45°)を向いているので、進行角に合わせて補正
      ctx!.rotate(r.angle + Math.PI / 4);
      ctx!.font = "26px serif";
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

      // 背景の宇宙グラデーション
      const g = ctx!.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#070a18");
      g.addColorStop(0.5, "#0a0a14");
      g.addColorStop(1, "#05060d");
      ctx!.fillStyle = g;
      ctx!.fillRect(0, 0, w, h);

      // 淡いネビュラ（星雲）グロー：奥行きと色味を足す
      const neb = (
        cx: number,
        cy: number,
        rad: number,
        color: string,
      ) => {
        const rg = ctx!.createRadialGradient(cx, cy, 0, cx, cy, rad);
        rg.addColorStop(0, color);
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx!.fillStyle = rg;
        ctx!.fillRect(0, 0, w, h);
      };
      neb(w * 0.2, h * 0.25, Math.max(w, h) * 0.45, "rgba(45,212,191,0.06)");
      neb(w * 0.85, h * 0.7, Math.max(w, h) * 0.5, "rgba(99,102,241,0.07)");

      // 星
      for (const s of stars) {
        const a = reduced
          ? s.baseA
          : s.baseA * (0.6 + 0.4 * Math.sin(t * 0.02 * s.tw + s.x));
        ctx!.beginPath();
        ctx!.fillStyle = `rgba(255,255,255,${a})`;
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx!.fill();
        if (!reduced) {
          s.x += s.vx;
          if (s.x < -2) {
            s.x = w + 2;
            s.y = Math.random() * h;
          }
        }
      }

      if (!reduced) {
        // 流れ星（たまに）
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
          ctx!.strokeStyle = `rgba(180,220,255,${a})`;
          ctx!.lineWidth = 2;
          ctx!.beginPath();
          ctx!.moveTo(sh.x, sh.y);
          ctx!.lineTo(sh.x - sh.vx * 4, sh.y - sh.vy * 4);
          ctx!.stroke();
          sh.x += sh.vx;
          sh.y += sh.vy;
        }

        // ロケット（一定間隔で出現）
        rocketTimer -= 1;
        if (!rocket && rocketTimer <= 0) {
          spawnRocket();
          rocketTimer = 60 * (12 + Math.random() * 10); // 次回まで12〜22秒
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
      // 動かさず1フレームだけ描画
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
