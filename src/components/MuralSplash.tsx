/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { HandData } from "../types";
import { audio } from "../utils/audio";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Camera, 
  Compass, 
  Layers, 
  Music,
  ArrowRight,
  Eye,
  Hammer,
  Palette,
  Fingerprint
} from "lucide-react";

// Official Dunhuang Ancient Pigments Collection
const DUNHUANG_PIGMENTS = [
  { name: "佛金砂", hex: "#c5a059", rgb: "197, 160, 89" },
  { name: "赤朱", hex: "#b3322a", rgb: "179, 50, 42" },
  { name: "石青", hex: "#2e5c8a", rgb: "46, 92, 138" },
  { name: "石绿", hex: "#2f7a5b", rgb: "47, 122, 91" },
  { name: "黛粉", hex: "#d28b9d", rgb: "210, 139, 157" },
  { name: "玉白", hex: "#f4f0ea", rgb: "244, 240, 234" }
];

interface MuralSplashProps {
  key?: React.Key;
  onContinue: () => void;
  handData: HandData | null;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  isCameraEnabled: boolean;
  onToggleCamera: () => void;
}

// Falling Lotus Petal details (落花妙境)
interface PetalParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  colorObj: typeof DUNHUANG_PIGMENTS[number];
  angle: number;
  spinSpeed: number;
  phase: number;
  amplitude: number;
  type: "petal" | "leaf" | "blossom";
}

// Fireworks Spark details
interface FireworkSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
  size: number;
  decay: number;
  gravity: number;
  trail: { x: number; y: number }[];
}

export default function MuralSplash({
  onContinue,
  handData,
  audioEnabled,
  onToggleAudio,
  isCameraEnabled,
  onToggleCamera
}: MuralSplashProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [activeTab, setActiveTab] = useState<string>("repair");
  const [showGuideTip, setShowGuideTip] = useState<boolean>(true);

  // References for tick animation loops
  const petalsRef = useRef<PetalParticle[]>([]);
  const sparksRef = useRef<FireworkSpark[]>([]);
  const timeRef = useRef<number>(0);
  const waveTimeRef = useRef<number>(0);
  const waveSpeedRef = useRef<number>(0);
  const prevPointerRef = useRef<{ x: number; y: number } | null>(null);
  const prevHandRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize petals (落花妙境)
  useEffect(() => {
    const tempPetals: PetalParticle[] = [];
    const width = window.innerWidth || 1200;
    for (let i = 0; i < 48; i++) {
      tempPetals.push(createRandomPetal(Math.random() * width, Math.random() * -window.innerHeight));
    }
    petalsRef.current = tempPetals;

    // Auto-dismiss guide hint slowly
    const timer = setTimeout(() => {
      setShowGuideTip(false);
    }, 9000);

    return () => clearTimeout(timer);
  }, []);

  const createRandomPetal = (x: number, y: number): PetalParticle => {
    const colorObj = DUNHUANG_PIGMENTS[Math.floor(Math.random() * DUNHUANG_PIGMENTS.length)];
    const types: ("petal" | "leaf" | "blossom")[] = ["petal", "leaf", "blossom"];
    return {
      x,
      y,
      vx: (Math.random() - 0.5) * 0.4,
      vy: 0.4 + Math.random() * 0.55,
      size: 5 + Math.random() * 10,
      colorObj,
      angle: Math.random() * Math.PI * 2,
      spinSpeed: (Math.random() - 0.5) * 0.012,
      phase: Math.random() * Math.PI * 2,
      amplitude: 15 + Math.random() * 30,
      type: types[Math.floor(Math.random() * types.length)]
    };
  };

  // Spark Generator (Fireworks/Interactions)
  const triggerFirework = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const count = 35 + Math.floor(Math.random() * 25);
    const pigment = DUNHUANG_PIGMENTS[Math.floor(Math.random() * DUNHUANG_PIGMENTS.length)];
    
    if (audioEnabled) {
      audio.playGuzhengPluck(0.6 + Math.random() * 0.7);
    }

    const newSparks: FireworkSpark[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const speed = 2.5 + Math.random() * 3.8;
      newSparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.3,
        alpha: 1.0,
        color: pigment.hex,
        size: 2.0 + Math.random() * 2.5,
        decay: 0.016 + Math.random() * 0.014,
        gravity: 0.04 + Math.random() * 0.03,
        trail: []
      });
    }

    sparksRef.current = [...sparksRef.current, ...newSparks];
  };

  // Core High-Performance Canvas Animation Cycle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Track pointer movement globally to feed the wave speed dynamically
    const handleGlobalPointerMove = (e: PointerEvent) => {
      const x = e.clientX;
      const y = e.clientY;
      if (prevPointerRef.current) {
        const dx = x - prevPointerRef.current.x;
        const dy = y - prevPointerRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Slowly increment the target velocity up
        waveSpeedRef.current = Math.min(1.8, waveSpeedRef.current + dist * 0.0035);
      } else {
        waveSpeedRef.current = Math.min(1.8, waveSpeedRef.current + 0.02);
      }
      prevPointerRef.current = { x, y };
    };

    window.addEventListener("pointermove", handleGlobalPointerMove);

    const draw = () => {
      timeRef.current += 1;
      const W = canvas.width;
      const H = canvas.height;

      // Update gesture tracker velocity if available
      if (handData) {
        const hX = handData.x * W;
        const hY = handData.y * H;
        if (prevHandRef.current) {
          const dx = hX - prevHandRef.current.x;
          const dy = hY - prevHandRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // Scale camera gestures to feed into the waving speed directly
          waveSpeedRef.current = Math.min(1.8, waveSpeedRef.current + dist * 0.008);
        }
        prevHandRef.current = { x: hX, y: hY };
      } else {
        prevHandRef.current = null;
      }

      // Smooth organic fluid damping on the ribbon waving speed
      waveSpeedRef.current *= 0.955; // Gentle friction cooldown
      
      // If it drops below threshold, line stays completely still as requested
      if (waveSpeedRef.current < 0.0005) {
        waveSpeedRef.current = 0;
      }

      waveTimeRef.current += waveSpeedRef.current;

      // Draw beautiful dynamic background gradient centered on offset spotlight
      const focusX = W * 0.65;
      const focusY = H * 0.52;

      ctx.save();
      const bgGrad = ctx.createRadialGradient(focusX, focusY, 20, focusX, focusY, W * 0.75);
      bgGrad.addColorStop(0, "#191410"); // Warm golden-charcoal core
      bgGrad.addColorStop(0.5, "#0d0c0a"); // Mogao cave dark transition
      bgGrad.addColorStop(1, "#080706"); // Absolute pure ink black background
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      // --- 1. Concentric Glowing Orbits (Grotto Radar Scanning Waves) ---
      ctx.save();
      const ringCount = 4;
      for (let r = 0; r < ringCount; r++) {
        // Slowing scanning waves to fit gentle atmosphere
        const radius = ((timeRef.current * 0.35 + r * (280 / ringCount)) % 280);
        const alpha = Math.max(0, 1 - radius / 280) * 0.12;
        
        ctx.beginPath();
        ctx.arc(focusX, focusY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(197, 160, 89, ${alpha})`;
        ctx.lineWidth = 1.0;
        ctx.stroke();

        if (r % 2 === 0) {
          ctx.beginPath();
          const dotAngle = (timeRef.current * 0.0015 + r) % (Math.PI * 2);
          ctx.arc(focusX + Math.cos(dotAngle) * radius, focusY + Math.sin(dotAngle) * radius, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(197, 160, 89, ${alpha * 1.4})`;
          ctx.fill();
        }
      }
      ctx.restore();

      // --- 2. Elegant Wavy Harmonic Sine Waves (飞天飘带与矿物色彩轨迹) ---
      // Red Wave (赤朱 / 朱砂)
      ctx.save();
      ctx.beginPath();
      for (let x = 0; x <= W; x += 6) {
        // Spatial frequency stretched perfectly to imitate long flying ribbons in horizontal drift
        const waveY = H * 0.55 + 
                     Math.sin(x * 0.0016 + waveTimeRef.current * 0.04) * 78 + 
                     Math.cos(x * 0.0007 - waveTimeRef.current * 0.018) * 32;
        
        if (x === 0) ctx.moveTo(x, waveY);
        else ctx.lineTo(x, waveY);
      }
      ctx.strokeStyle = "rgba(179, 50, 42, 0.15)"; // Soft glowing aura
      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      ctx.stroke();

      ctx.strokeStyle = "rgba(224, 91, 83, 0.65)"; // Inner elegant thread
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.restore();

      // Green Wave (孔雀石绿 / 石绿)
      ctx.save();
      ctx.beginPath();
      for (let x = 0; x <= W; x += 6) {
        const waveY = H * 0.62 + 
                     Math.sin(x * 0.0013 - waveTimeRef.current * 0.045 + Math.PI) * 88 + 
                     Math.cos(x * 0.0009 + waveTimeRef.current * 0.022) * 38;
        
        if (x === 0) ctx.moveTo(x, waveY);
        else ctx.lineTo(x, waveY);
      }
      ctx.strokeStyle = "rgba(47, 122, 91, 0.13)";
      ctx.lineWidth = 18;
      ctx.lineCap = "round";
      ctx.stroke();

      ctx.strokeStyle = "rgba(105, 201, 160, 0.68)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Gold Wave (佛金砂 / 飞天丝雨)
      ctx.save();
      ctx.beginPath();
      for (let x = 0; x <= W; x += 8) {
        const waveY = H * 0.44 + 
                     Math.sin(x * 0.0022 + waveTimeRef.current * 0.03) * 36 + 
                     Math.sin(x * 0.0008 - waveTimeRef.current * 0.035) * 18;
        
        if (x === 0) ctx.moveTo(x, waveY);
        else ctx.lineTo(x, waveY);
      }
      ctx.strokeStyle = "rgba(197, 160, 89, 0.12)";
      ctx.lineWidth = 10;
      ctx.stroke();

      ctx.strokeStyle = "rgba(242, 211, 150, 0.58)";
      ctx.lineWidth = 1.0;
      ctx.stroke();
      ctx.restore();

      // --- 3. Sky-Scatter Lotus Petals (落花妙境 - 天女落花) ---
      ctx.save();
      const activePetals = petalsRef.current;
      for (let i = 0; i < activePetals.length; i++) {
        const p = activePetals[i];
        
        // Sway sideways gently; respond slightly when ribbon waves are pulsing as well
        const reactionFactor = 0.5 + waveSpeedRef.current * 1.5;
        const sway = Math.sin(timeRef.current * 0.006 + p.phase) * (p.amplitude * 0.08) * reactionFactor;
        p.y += p.vy * 0.38; // Extreme slow motion falling
        p.x += (p.vx + sway * 0.15);
        p.angle += p.spinSpeed * 0.38;

        // Respawn if slips off bounds
        if (p.y > H + 40 || p.x < -40 || p.x > W + 40) {
          petalsRef.current[i] = createRandomPetal(Math.random() * W, -30);
          continue;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

        // Radial colors matching elegant pigment collection
        const radGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
        radGrad.addColorStop(0, `rgba(${p.colorObj.rgb}, 0.95)`);
        radGrad.addColorStop(0.6, `rgba(${p.colorObj.rgb}, 0.6)`);
        radGrad.addColorStop(1, `rgba(${p.colorObj.rgb}, 0)`);
        ctx.fillStyle = radGrad;

        ctx.beginPath();
        if (p.type === "petal") {
          ctx.moveTo(0, -p.size);
          ctx.bezierCurveTo(p.size * 0.7, -p.size * 0.25, p.size * 0.6, p.size * 0.75, 0, p.size);
          ctx.bezierCurveTo(-p.size * 0.6, p.size * 0.75, -p.size * 0.7, -p.size * 0.25, 0, -p.size);
        } else if (p.type === "leaf") {
          ctx.arc(0, 0, p.size * 0.8, 0, Math.PI * 1.6, false);
          ctx.lineTo(0, p.size * 0.15);
        } else {
          ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
          for (let petalIdx = 0; petalIdx < 5; petalIdx++) {
            ctx.rotate((Math.PI * 2) / 5);
            ctx.ellipse(p.size * 0.35, 0, p.size * 0.25, p.size * 0.14, 0, 0, Math.PI * 2);
          }
        }
        ctx.fill();

        ctx.strokeStyle = `rgba(${p.colorObj.rgb}, 0.32)`;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
      }
      ctx.restore();

      // --- 4. Fireworks Sparks (彩色气流与触控微光) ---
      ctx.save();
      const activeSparks = sparksRef.current;
      const survivors: FireworkSpark[] = [];

      for (let i = 0; i < activeSparks.length; i++) {
        const s = activeSparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += s.gravity;
        s.vx *= 0.975;
        s.vy *= 0.975;
        s.alpha -= s.decay;

        if (s.alpha > 0) {
          s.trail.push({ x: s.x, y: s.y });
          if (s.trail.length > 6) s.trail.shift();

          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          if (s.trail.length > 0) {
            ctx.lineTo(s.trail[0].x, s.trail[0].y);
          }
          ctx.strokeStyle = s.color;
          ctx.globalAlpha = s.alpha;
          ctx.lineWidth = s.size;
          ctx.lineCap = "round";
          ctx.shadowBlur = 12;
          ctx.shadowColor = s.color;
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1.0;

          survivors.push(s);
        }
      }
      sparksRef.current = survivors;
      ctx.restore();

      // --- 5. Interactive Ambient Halo for Gesturing Hand (MediaPipe integration) ---
      if (handData) {
        const hX = handData.x * W;
        const hY = handData.y * H;

        ctx.save();
        ctx.translate(hX, hY);
        ctx.rotate(timeRef.current * 0.012);

        // Starry focal ring
        ctx.beginPath();
        ctx.arc(0, 0, 36, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(197, 160, 89, 0.45)";
        ctx.lineWidth = 1.0;
        ctx.setLineDash([5, 5]);
        ctx.stroke();

        // Center diffuse
        ctx.beginPath();
        ctx.arc(0, 0, 20 + Math.sin(timeRef.current * 0.06) * 4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(197, 160, 89, 0.12)";
        ctx.fill();

        // Crosshairs rays
        for (let ray = 0; ray < 8; ray++) {
          ctx.rotate(Math.PI / 4);
          ctx.beginPath();
          ctx.moveTo(14, 0);
          ctx.lineTo(26, 0);
          ctx.strokeStyle = "rgba(197, 160, 89, 0.4)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.restore();

        // Spawn beautiful little sparkling star trails while gesturing
        if (timeRef.current % 5 === 0) {
          const pigment = DUNHUANG_PIGMENTS[Math.floor(Math.random() * DUNHUANG_PIGMENTS.length)];
          sparksRef.current.push({
            x: hX,
            y: hY,
            vx: (Math.random() - 0.5) * 1.8,
            vy: (Math.random() - 0.5) * 1.8 - 0.6,
            alpha: 0.85,
            color: pigment.hex,
            size: 1.2 + Math.random() * 2,
            decay: 0.02 + Math.random() * 0.015,
            gravity: 0.02,
            trail: []
          });
        }
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("pointermove", handleGlobalPointerMove);
    };
  }, [handData, audioEnabled]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    triggerFirework(e.clientX, e.clientY);
  };

  const handleStartGame = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioEnabled) {
      audio.playTempleBell();
    }
    onContinue(); // Continue to immersive main experience
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    triggerFirework(e.clientX, e.clientY);
  };

  return (
    <div 
      ref={containerRef}
      onClick={handleContainerClick}
      className="fixed inset-0 w-full h-full z-100 flex flex-col justify-between overflow-hidden bg-[#0a0808] select-none text-stone-100"
    >
      {/* Interactive canvas behind everything */}
      <canvas
        ref={canvasRef}
        onClick={(e) => {
          // Canvas click bubbles up or is handled directly
          e.stopPropagation();
          triggerFirework(e.clientX, e.clientY);
        }}
        className="absolute inset-0 w-full h-full block cursor-crosshair z-0"
        title="点按屏幕绽放极乐净土古彩神光"
      />

      {/* BACKGROUND GRAPHIC INTERLACE GRID */}
      <div className="absolute inset-0 bg-[radial-gradient(#c5a059_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.05] pointer-events-none z-0"></div>

      {/* ----------------- TOP HIGH-FIDELITY HEADER BAR ----------------- */}
      <div className="relative z-20 w-full px-8 py-4 bg-[#0d0c0a]/65 border-b border-[#c5a059]/15 backdrop-blur-md pointer-events-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left Side: Museum Collaboratory Brand Logo */}
        <div className="flex items-center gap-3">
          {/* Authentic red block pill */}
          <div className="bg-[#b3322a] border border-[#ff5b4f]/20 text-white font-serif font-bold text-xs px-2.5 py-1 rounded-sm shadow-md animate-pulse">
            教
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-[#f5f2ed] tracking-wider font-serif">
              敦煌遗珍 <span className="text-[#c5a059]">·</span> 数字化交互平台
            </span>
            <span className="text-[9px] text-[#8b7e6a] tracking-widest font-mono uppercase">
              MOGAO DIGITAL HERITAGE COLLABORATORY
            </span>
          </div>
        </div>

        {/* Center: Interactive Elegant Tab Selection System */}
        <div className="flex items-center bg-stone-950/85 border border-[#c5a059]/30 rounded-full p-1 shadow-inner gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab("perspective");
              if (audioEnabled) audio.playGuzhengPluck(0.9);
            }}
            className={`cursor-pointer px-4 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-serif transition-all ${
              activeTab === "perspective"
                ? "bg-[#c5a059] text-[#0f0e0c] font-medium shadow-md"
                : "text-stone-400 hover:text-stone-200 hover:bg-stone-900/60"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>首创透视照片</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab("repair");
              if (audioEnabled) audio.playGuzhengPluck(1.1);
            }}
            className={`cursor-pointer px-4 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-serif transition-all ${
              activeTab === "repair"
                ? "bg-[#c5a059] text-[#0f0e0c] font-medium shadow-md"
                : "text-stone-400 hover:text-stone-200 hover:bg-stone-900/60"
            }`}
          >
            <Hammer className="w-3.5 h-3.5" />
            <span>壁画交互修复</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab("pigments");
              if (audioEnabled) audio.playGuzhengPluck(1.2);
            }}
            className={`cursor-pointer px-4 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-serif transition-all ${
              activeTab === "pigments"
                ? "bg-[#c5a059] text-[#0f0e0c] font-medium shadow-md"
                : "text-stone-400 hover:text-stone-200 hover:bg-stone-900/60"
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>矿物色彩解密</span>
          </button>
        </div>

        {/* Right Side: Re-construction Engineering context & Switches */}
        <div className="flex items-center gap-4">
          <div className="hidden xl:flex flex-col items-end text-right font-mono text-[9px] text-[#8b7e6a] tracking-widest leading-normal">
            <span>千百幅数字敦煌壁画</span>
            <span>RECONSTRUCTING COOP. EST 2026</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Gesture Cam Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleCamera();
              }}
              className={`p-2 rounded-full border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-serif ${
                isCameraEnabled
                  ? "bg-[#c5a059]/25 border-[#c5a059]/40 text-[#c5a059]"
                  : "bg-stone-900/65 border-white/5 text-stone-500"
              }`}
              title="隔空摄像头手势交互"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden lg:inline text-[11px]">{isCameraEnabled ? "隔空手势控" : "手势未启"}</span>
            </button>

            {/* Audio Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleAudio();
              }}
              className={`p-2 rounded-full border transition-all cursor-pointer ${
                audioEnabled
                  ? "bg-[#c5a059]/15 border-[#c5a059]/35 text-[#c5a059]"
                  : "bg-stone-900/65 border-white/5 text-stone-500"
              }`}
            >
              {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* MAIN ATMOSPHERIC WORK AREA WITH CORNER DECO METADATA */}
      <div className="relative flex-1 w-full max-w-7xl mx-auto px-8 flex flex-col md:flex-row items-center justify-between pointer-events-none z-10 py-4 gap-8">
        
        {/* BACKGROUND TELEMETRY LABELS (GUTTER PARALLAX STYLED) */}
        <div className="absolute top-8 left-8 text-[9px] text-[#8b7e6a]/40 font-mono tracking-widest uppercase flex flex-col">
          <span>CAVE: #381 PRESET</span>
          <span>SYSTEM CHRONOLOGY ACTIVE</span>
        </div>
        <div className="absolute top-8 right-8 text-[9px] text-[#8b7e6a]/40 font-mono tracking-widest uppercase flex flex-col items-end">
          <span>INDEX-ACCESS: DEC132514109</span>
          <span>INTER-ACTIVE DIGITIZATION</span>
        </div>

        {/* Left-Aligned Typography Content Cluster (Exact Match to video style) */}
        <div className="w-full md:w-3/5 text-left pointer-events-auto flex flex-col justify-center items-start selection:bg-[#b3322a]/30">
          
          {/* CAVE PROJECT STAMP */}
          <div className="text-[10px] font-mono font-bold tracking-[0.35em] text-[#c5a059]/60 uppercase mb-3">
            洞窟透视计划 // CAVE MIRO PROJECT
          </div>

          {/* Action indicator prefix */}
          <div className="font-serif text-[11px] text-[#8b7e6a] tracking-widest mb-2 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#b3322a] animate-ping" />
            <span>1. 双击激光 · 同忆色彩庄严中心</span>
          </div>

          {/* High-Exploration Capsule */}
          <div className="inline-flex items-center gap-1.5 bg-[#b3322a]/10 border border-[#b3322a]/30 px-3 py-1 rounded-full text-[10px] tracking-widest font-semibold font-serif text-[#ff6459] mb-4 shadow-sm">
            <Sparkles className="w-3 h-3 text-[#ff6459]" />
            <span>高勘探极光 · 助尘物归</span>
          </div>

          {/* Authentic Elegant Header */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-light text-[#f5f2ed] tracking-[0.24em] font-serif leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)]">
            敦煌壁画神韵
          </h1>

          {/* Golden accent bar */}
          <div className="w-24 h-[1.5px] bg-gradient-to-r from-[#c5a059] to-transparent my-6" />

          {/* Authentic Description text block */}
          <p className="text-[#c6bdae] text-xs sm:text-sm font-serif max-w-xl leading-relaxed tracking-wider">
            移动鼠标（或倾斜手机）感应洞窟空间的奇幻深度。敦煌壁画以大自然的名义呈现：
            <span className="text-[#64b092] font-semibold">孔雀石绿（石绿）</span>、
            <span className="text-[#ff6459] font-semibold">硫化汞红（朱砂）</span>及
            <span className="text-[#5984b0] font-semibold">青金石蓝</span>
            相互碰撞，编织出跨越一千六百余载的彩色形貌感。
          </p>

          {/* Visual subtext footer */}
          <div className="text-[#8b7e6a] text-[10px] font-serif tracking-widest mt-5 leading-normal">
            扫拂复原及壁画交互且触响，感受身色共鸣意境 · Grotto Parallax
          </div>

          {/* PRIMARY PULSING CALL-TO-ACTION BUTTON */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.0, delay: 0.8 }}
            className="mt-8 relative"
          >
            <button
              onClick={handleStartGame}
              className="relative group px-9 py-4 bg-gradient-to-r from-[#c5a059] to-[#bf974b] text-[#0f0e0c] font-serif font-semibold tracking-[0.3em] text-xs rounded-sm shadow-[0_4px_22px_rgba(197,160,89,0.3)] hover:shadow-[0_8px_30px_rgba(197,160,89,0.55)] hover:-translate-y-0.5 border border-[#e5c158]/40 transition-all cursor-pointer overflow-hidden flex items-center gap-2"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
              <span className="relative flex items-center justify-center gap-1.5">
                <span>开启寻色之旅</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          </motion.div>
        </div>

        {/* Right-Aligned Vertical Calligraphy Badge ("莫高窟 DUNHUANG CAVERNS") */}
        <div className="w-full md:w-2/5 flex items-center justify-center pointer-events-auto">
          {/* Circular Badge Ring */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 0.95, scale: 1 }}
            transition={{ duration: 1.6, ease: "easeOut" }}
            onClick={() => {
              // Interactive ring click triggers multiple fireworks centered on right side
              const w = window.innerWidth;
              const h = window.innerHeight;
              triggerFirework(w * 0.7, h * 0.5);
              triggerFirework(w * 0.72, h * 0.53);
            }}
            className="relative cursor-pointer w-48 h-48 sm:w-56 sm:h-56 rounded-full border border-[#c5a059]/40 bg-[#0e0c0a]/75 backdrop-blur-sm shadow-[0_0_40px_rgba(197,160,89,0.12)] flex flex-col items-center justify-center hover:border-[#c5a059]/80 transition-all"
            title="莫高窟数字密印 - 点击解密色彩"
          >
            {/* Compass-like fine-grained lines */}
            <div className="absolute inset-2 block rounded-full border border-[#c5a059]/15 border-dashed pointer-events-none" />
            <div className="absolute inset-4 block rounded-full border border-[#c5a059]/5 pointer-events-none" />

            {/* Vertical calligraphy branding text */}
            <div className="flex flex-col items-center select-none text-shadow">
              {/* Star symbol */}
              <Fingerprint className="w-7 h-7 text-[#c5a059] mb-3 opacity-80 animate-pulse" />
              
              {/* Bold vertical font */}
              <span className="text-3xl sm:text-4xl font-serif font-black tracking-[0.45em] text-[#f5f2ed] pl-2 leading-none mb-4 uppercase">
                莫高窟
              </span>
              
              {/* Subtitles */}
              <span className="text-[9px] text-[#c5a059] font-mono tracking-widest uppercase">
                DUNHUANG INDICES
              </span>
              <span className="text-[8px] text-[#8b7e6a] font-serif tracking-widest uppercase mt-0.5">
                Mogao Caverns #381
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* FOOTER MINERAL COLOR SWATCH BAR WITH ACCENT CHIPS */}
      <div className="relative z-20 w-full px-8 py-6 border-t border-white/5 bg-[#0a0808]/95 backdrop-blur-sm pointer-events-auto select-none flex flex-col lg:flex-row items-center justify-between gap-4">
        
        {/* Description caption */}
        <div className="text-left">
          <h4 className="text-[10px] tracking-[0.2em] text-[#8b7e6a] uppercase font-semibold font-serif mb-0.5">
            Dunhuang Authentic Mineral Pigment Database
          </h4>
          <p className="text-[11px] text-stone-400 font-serif font-light">
            本卷完全解构莫高古窟千年壁画之原石色彩，采用真实提取并纯化的矿石配方色值
          </p>
        </div>

        {/* Dynamic color swatches (Users can click them to trigger high-quality pigment explosions!) */}
        <div className="flex flex-wrap justify-center gap-2">
          {DUNHUANG_PIGMENTS.map((c) => (
            <div
              key={c.name}
              onClick={(e) => {
                e.stopPropagation();
                const w = window.innerWidth;
                const h = window.innerHeight;
                // Burst center random fireworks
                triggerFirework(w * (0.3 + Math.random() * 0.4), h * (0.35 + Math.random() * 0.3));
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-sm border border-white/5 bg-stone-900/65 hover:bg-[#c5a059]/10 hover:border-[#c5a059]/40 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-md"
              title={`点击燃放《${c.name}》自然佛光烟花`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full inline-block shadow-inner ring-1 ring-white/10"
                style={{ backgroundColor: c.hex }}
              />
              <span className="text-[11px] font-serif text-stone-300 font-medium tracking-wide">
                {c.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
