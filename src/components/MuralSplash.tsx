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
  preloadedImagesCount?: number;
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
  onToggleCamera,
  preloadedImagesCount = 0
}: MuralSplashProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [activeTab, setActiveTab] = useState<string>("repair");
  const [showGuideTip, setShowGuideTip] = useState<boolean>(true);
  const [textRevealed, setTextRevealed] = useState<boolean>(false);
  const [sweepProgress, setSweepProgress] = useState<number>(0);
  const textRevealedRef = useRef<boolean>(false);

  const [selectedPigment, setSelectedPigment] = useState<typeof DUNHUANG_PIGMENTS[number]>(DUNHUANG_PIGMENTS[0]);
  const targetRgbRef = useRef<{ r: number; g: number; b: number }>({ r: 197, g: 160, b: 89 });
  const currentRgbRef = useRef<{ r: number; g: number; b: number }>({ r: 197, g: 160, b: 89 });

  useEffect(() => {
    const parts = selectedPigment.rgb.split(",").map(Number);
    if (parts.length === 3) {
      targetRgbRef.current = { r: parts[0], g: parts[1], b: parts[2] };
    }
  }, [selectedPigment]);

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

        // Calculate sweep progress when user moves cursor
        if (y > window.innerHeight * 0.25 && y < window.innerHeight * 0.75) {
          setSweepProgress((prev) => {
            const next = prev + dist * 0.20; // 0.2% per pixel moved
            if (next >= 100 && !textRevealedRef.current) {
              textRevealedRef.current = true;
              setTextRevealed(true);
              if (audioEnabled) {
                audio.playGuzhengPluck(1.3);
                setTimeout(() => {
                  audio.playTempleBell();
                }, 400);
              }
            }
            return Math.min(100, next);
          });
        }
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

      // Smoothly interpolate the active pigment RGB values for a graceful blending transition
      currentRgbRef.current.r += (targetRgbRef.current.r - currentRgbRef.current.r) * 0.08;
      currentRgbRef.current.g += (targetRgbRef.current.g - currentRgbRef.current.g) * 0.08;
      currentRgbRef.current.b += (targetRgbRef.current.b - currentRgbRef.current.b) * 0.08;

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

          // Waving gesture plucking accumulation
          if (hY > H * 0.25 && hY < H * 0.75) {
            setSweepProgress((prev) => {
              const next = prev + dist * 0.35;
              if (next >= 100 && !textRevealedRef.current) {
                textRevealedRef.current = true;
                setTextRevealed(true);
                if (audioEnabled) {
                  audio.playGuzhengPluck(1.3);
                  setTimeout(() => {
                    audio.playTempleBell();
                  }, 400);
                }
              }
              return Math.min(100, next);
            });
          }
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

      // --- 2. Elegant Wavy Harmonic Silk Ribbons (飞天丝带：从左至右，先后缓慢出现，厚重丝滑，宽窄不一如立体交织，且颜色与选定矿物色渐变色融合) ---
      const t = timeRef.current;
      // Staggered sequential entrance from left to right over 150 frames (~2.5 seconds per ribbon, extremely slow and graceful)
      const r1Progress = Math.min(1.0, Math.max(0.0, (t - 30) / 150));
      const r2Progress = Math.min(1.0, Math.max(0.0, (t - 150) / 150));
      const r3Progress = Math.min(1.0, Math.max(0.0, (t - 270) / 150));

      const easeOutQuad = (x: number) => 1 - (1 - x) * (1 - x);
      const limitX1 = W * easeOutQuad(r1Progress);
      const limitX2 = W * easeOutQuad(r2Progress);
      const limitX3 = W * easeOutQuad(r3Progress);

      // Centralized ribbon drawer that creates three-dimensional twisting profiles with dynamic mineral color fusion
      const drawSatinRibbon = (
        limitX: number,
        waveYFunc: (x: number) => number,
        widthFunc: (x: number) => number,
        defaultBaseRGB: [number, number, number],
        defaultInnerRGB: [number, number, number],
        gildedColor: string,
        waveProgress: number,
        baseY: number
      ) => {
        if (waveProgress <= 0 || limitX < 6) return;
        
        ctx.save();
        const topPoints: {x: number; y: number}[] = [];
        const bottomPoints: {x: number; y: number}[] = [];
        
        // Build coordinates along the horizontal axis
        for (let x = 0; x <= limitX; x += 6) {
          const cy = waveYFunc(x);
          const w = widthFunc(x);
          topPoints.push({ x, y: cy - w / 2 });
          bottomPoints.push({ x, y: cy + w / 2 });
        }
        
        const pR = currentRgbRef.current.r;
        const pG = currentRgbRef.current.g;
        const pB = currentRgbRef.current.b;

        // Blend ribbon's default color with currently selected pigment color (55% intensity of selected pigment)
        const blendedBaseR = Math.round(defaultBaseRGB[0] * 0.45 + pR * 0.55);
        const blendedBaseG = Math.round(defaultBaseRGB[1] * 0.45 + pG * 0.55);
        const blendedBaseB = Math.round(defaultBaseRGB[2] * 0.45 + pB * 0.55);

        const blendedInnerR = Math.round(defaultInnerRGB[0] * 0.45 + Math.min(255, pR * 1.25) * 0.55);
        const blendedInnerG = Math.round(defaultInnerRGB[1] * 0.45 + Math.min(255, pG * 1.25) * 0.55);
        const blendedInnerB = Math.round(defaultInnerRGB[2] * 0.45 + Math.min(255, pB * 1.25) * 0.55);

        // Interactive luster factor when ribbon is dragged (based on waveSpeed)
        const dragShimmer = Math.min(1.0, waveSpeedRef.current * 0.65);

        // 1. Draw glowing aura back shadow (matches active mineral pigment hue)
        ctx.beginPath();
        ctx.moveTo(topPoints[0].x, topPoints[0].y);
        for (let i = 1; i < topPoints.length; i++) {
          ctx.lineTo(topPoints[i].x, topPoints[i].y);
        }
        for (let i = bottomPoints.length - 1; i >= 0; i--) {
          ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = `rgba(${pR}, ${pG}, ${pB}, ${0.12 + dragShimmer * 0.12})`;
        ctx.fill();

        // 2. Draw outer thick silk fabric base
        ctx.beginPath();
        ctx.moveTo(topPoints[0].x, topPoints[0].y);
        for (let i = 1; i < topPoints.length; i++) {
          ctx.lineTo(topPoints[i].x, topPoints[i].y);
        }
        for (let i = bottomPoints.length - 1; i >= 0; i--) {
          ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y);
        }
        ctx.closePath();

        // Elegant horizontal sheen gradient: from deep (saturated) to light (shimmering mineral dust)
        const baseGrad = ctx.createLinearGradient(0, 0, limitX, 0);
        const deepR = Math.round(blendedBaseR * (0.8 - dragShimmer * 0.35));
        const deepG = Math.round(blendedBaseG * (0.8 - dragShimmer * 0.35));
        const deepB = Math.round(blendedBaseB * (0.8 - dragShimmer * 0.35));

        const lightR = Math.round(Math.min(255, blendedBaseR * (1.15 + dragShimmer * 0.4)));
        const lightG = Math.round(Math.min(255, blendedBaseG * (1.15 + dragShimmer * 0.4)));
        const lightB = Math.round(Math.min(255, blendedBaseB * (1.15 + dragShimmer * 0.4)));

        baseGrad.addColorStop(0, `rgb(${deepR}, ${deepG}, ${deepB})`);
        baseGrad.addColorStop(0.5, `rgb(${blendedBaseR}, ${blendedBaseG}, ${blendedBaseB})`);
        baseGrad.addColorStop(1, `rgb(${lightR}, ${lightG}, ${lightB})`);
        ctx.fillStyle = baseGrad;
        ctx.fill();

        // 3. Draw inner contrasting silk ribbon (represents layered stripes from visual reference)
        ctx.beginPath();
        ctx.moveTo(topPoints[0].x, topPoints[0].y + (bottomPoints[0].y - topPoints[0].y) * 0.22);
        for (let i = 1; i < topPoints.length; i++) {
          const w = bottomPoints[i].y - topPoints[i].y;
          ctx.lineTo(topPoints[i].x, topPoints[i].y + w * 0.22);
        }
        for (let i = bottomPoints.length - 1; i >= 0; i--) {
          const w = bottomPoints[i].y - topPoints[i].y;
          ctx.lineTo(bottomPoints[i].x, topPoints[i].y + w * 0.78);
        }
        ctx.closePath();
        
        const innerGrad = ctx.createLinearGradient(0, 0, limitX, 0);
        const innerDeepR = Math.round(blendedInnerR * (0.8 - dragShimmer * 0.35));
        const innerDeepG = Math.round(blendedInnerG * (0.8 - dragShimmer * 0.35));
        const innerDeepB = Math.round(blendedInnerB * (0.8 - dragShimmer * 0.35));

        const innerLightR = Math.round(Math.min(255, blendedInnerR * (1.18 + dragShimmer * 0.4)));
        const innerLightG = Math.round(Math.min(255, blendedInnerG * (1.18 + dragShimmer * 0.4)));
        const innerLightB = Math.round(Math.min(255, blendedInnerB * (1.18 + dragShimmer * 0.4)));

        innerGrad.addColorStop(0, `rgb(${innerDeepR}, ${innerDeepG}, ${innerDeepB})`);
        innerGrad.addColorStop(0.6, `rgb(${blendedInnerR}, ${blendedInnerG}, ${blendedInnerB})`);
        innerGrad.addColorStop(1, `rgb(${innerLightR}, ${innerLightG}, ${innerLightB})`);
        ctx.fillStyle = innerGrad;
        ctx.fill();

        // 4. Draw narrow central shimmering gold thread (classical Chinese silk embellishments)
        ctx.beginPath();
        for (let i = 0; i < topPoints.length; i++) {
          const cy = (topPoints[i].y + bottomPoints[i].y) / 2;
          if (i === 0) ctx.moveTo(topPoints[i].x, cy);
          else ctx.lineTo(topPoints[i].x, cy);
        }
        ctx.strokeStyle = gildedColor;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // 5. Draw top and bottom gilded borders (very fine lines as the ribbon's golden seams)
        ctx.beginPath();
        ctx.moveTo(topPoints[0].x, topPoints[0].y);
        for (let i = 1; i < topPoints.length; i++) {
          ctx.lineTo(topPoints[i].x, topPoints[i].y);
        }
        ctx.strokeStyle = gildedColor;
        ctx.lineWidth = 1.0;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(bottomPoints[0].x, bottomPoints[0].y);
        for (let i = 1; i < bottomPoints.length; i++) {
          ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y);
        }
        ctx.strokeStyle = "rgba(242, 190, 100, 0.4)";
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // 6. Draw running tip (glowing calligraphy ink spark showing where ribbon writes on)
        if (waveProgress < 1.0 && topPoints.length > 0) {
          const lastIdx = topPoints.length - 1;
          const endX = topPoints[lastIdx].x;
          const endY = (topPoints[lastIdx].y + bottomPoints[lastIdx].y) / 2;
          
          ctx.beginPath();
          ctx.arc(endX, endY, 6, 0, Math.PI * 2);
          ctx.fillStyle = gildedColor;
          ctx.shadowBlur = 15;
          ctx.shadowColor = gildedColor;
          ctx.fill();
        }

        ctx.restore();
      };

      // Curves and mathematical varying-width functions to recreate twisting satin ribbons
      const waveY1 = (x: number) => H * 0.55 + 
                     Math.sin(x * 0.0016 + waveTimeRef.current * 0.04) * 78 + 
                     Math.cos(x * 0.0007 - waveTimeRef.current * 0.018) * 32;

      const width1 = (x: number) => {
        const fold = Math.sin(x * 0.003 - waveTimeRef.current * 0.015);
        const foldAbs = Math.abs(fold); 
        return 12 + 56 * foldAbs * (0.8 + 0.2 * Math.cos(x * 0.007));
      };

      const waveY2 = (x: number) => H * 0.62 + 
                     Math.sin(x * 0.0013 - waveTimeRef.current * 0.045 + Math.PI) * 88 + 
                     Math.cos(x * 0.0009 + waveTimeRef.current * 0.022) * 38;

      const width2 = (x: number) => {
        const fold = Math.cos(x * 0.0025 + waveTimeRef.current * 0.01 + 1.5);
        const foldAbs = Math.abs(fold);
        return 10 + 60 * foldAbs * (0.75 + 0.25 * Math.sin(x * 0.005));
      };

      const waveY3 = (x: number) => H * 0.44 + 
                     Math.sin(x * 0.0022 + waveTimeRef.current * 0.03) * 36 + 
                     Math.sin(x * 0.0008 - waveTimeRef.current * 0.035) * 18;

      const width3 = (x: number) => {
        const fold = Math.sin(x * 0.004 - waveTimeRef.current * 0.02 + 0.8);
        const foldAbs = Math.abs(fold);
        return 8 + 40 * foldAbs * (0.8 + 0.2 * Math.cos(x * 0.01));
      };

      // Draw the three satin silk ribbons with their distinct colors and geometries fuzed with the active mineral pigment
      // RED SILK RIBBON (朱砂 / 飞天主飘带)
      drawSatinRibbon(
        limitX1,
        waveY1,
        width1,
        [179, 50, 42],       // deep crimson base
        [224, 91, 83],       // bright coral/vermilion inner
        "rgba(242, 190, 100, 0.95)", // gold thread
        r1Progress,
        H * 0.55
      );

      // GREEN SILK RIBBON (石绿 / 飞天辅飘带)
      drawSatinRibbon(
        limitX2,
        waveY2,
        width2,
        [47, 122, 91],       // deep jade green base
        [105, 201, 160],     // lively malachite inner
        "rgba(244, 240, 234, 0.85)", // white jade thread
        r2Progress,
        H * 0.62
      );

      // GOLD SILK RIBBON (佛金砂 / 薄绢黄金飘带)
      drawSatinRibbon(
        limitX3,
        waveY3,
        width3,
        [197, 160, 89],      // dunhuang gold ochre base
        [242, 211, 150],     // amber dust inner
        "rgba(242, 190, 100, 0.9)", // bright gold border thread
        r3Progress,
        H * 0.44
      );

      // --- 3. Sky-Scatter Lotus Petals (落花妙境 - 天女落花) ---
      // Disabled falling particles/dots per user request to keep the three ribbons clear
      
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
    setSweepProgress((prev) => {
      const next = prev + 35; // Click contributes to opening scroll
      if (next >= 100 && !textRevealedRef.current) {
        textRevealedRef.current = true;
        setTextRevealed(true);
        if (audioEnabled) {
          audio.playGuzhengPluck(1.3);
          setTimeout(() => {
            audio.playTempleBell();
          }, 400);
        }
      }
      return Math.min(100, next);
    });
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

      {/* GENTLE CALLIGRAPHY PLUCK GUIDE */}
      {!textRevealed && (
        <div className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-auto text-center select-none z-30 bg-stone-950/75 border border-[#c5a059]/20 rounded-md p-6 backdrop-blur-sm max-w-xs shadow-[0_12px_40px_rgba(0,0,0,0.8)] animate-fade-in">
          {/* Pulsing Fingerprint ring */}
          <div className="relative w-14 h-14 flex items-center justify-center mb-4">
            <span className="absolute inset-0 rounded-full bg-[#c5a059]/15 animate-ping" />
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
            >
              <Fingerprint className="w-10 h-10 text-[#c5a059] opacity-90" />
            </motion.div>
          </div>
          <span className="text-[10px] tracking-[0.25em] text-[#c5a059]/80 font-mono block mb-1">
            SWIPE TO REVEAL ALBUM
          </span>
          <h3 className="text-[15px] font-serif font-semibold text-[#f5f2ed] tracking-widest mb-1.5">
            触碰屏幕 · 唤醒庄严
          </h3>
          <p className="text-[11px] text-[#8b7e6a] leading-relaxed font-serif px-2">
            滑动或点击屏幕，即可解密经卷、开卷圣境。
          </p>
          
          {/* Aesthetic progress indicator */}
          <div className="w-full h-[3px] bg-stone-900/90 rounded-full overflow-hidden mt-4.5 border border-white/5">
            <div 
              className="h-full bg-gradient-to-r from-[#b3322a] via-[#c5a059] to-[#2f7a5b] transition-all duration-300 rounded-full"
              style={{ width: `${sweepProgress}%` }}
            />
          </div>
          <span className="text-[9px] text-[#c5a059] font-mono tracking-widest mt-2 uppercase flex flex-col items-center gap-1">
            <span>开卷解密: {Math.round(sweepProgress)}%</span>
            <span className="text-[#8b7e6a] text-[8px] tracking-wider font-serif normal-case mt-0.5">
              {preloadedImagesCount < 5 
                ? `正在召回千年画幅色彩 (${preloadedImagesCount}/5)...` 
                : "千年画卷神采归位 ✨"}
            </span>
          </span>
        </div>
      )}

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
        <div 
          className="w-full md:w-3/5 text-left pointer-events-auto flex flex-col justify-center items-start selection:bg-[#b3322a]/30 transition-all duration-[1200ms] ease-out"
          style={{
            opacity: textRevealed ? 1 : 0,
            transform: textRevealed ? "translateY(0)" : "translateY(40px)",
            pointerEvents: textRevealed ? "auto" : "none"
          }}
        >
          
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

          {/* Designed by Turandot signature badge */}
          <div className="flex items-center gap-1.5 mt-5.5 select-none font-serif text-xs text-[#8b7e6a] tracking-wider">
            <span className="opacity-60 text-[11px]">Designed by:</span>
            <span className="text-[#c5a059] font-bold tracking-[0.18em]">
              Turandot
            </span>
          </div>

          {/* Visual subtext footer */}
          <div className="text-[#8b7e6a] text-[10px] font-serif tracking-widest mt-5 leading-normal">
            扫拂复原及壁画交互且触响，感受身色共鸣意境 · Grotto Parallax
          </div>

          {/* PRIMARY PULSING CALL-TO-ACTION BUTTON */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={textRevealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
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

        {/* Right-Aligned Vertical Calligraphy Badge (Mogao Caves Silhouette facade) */}
        <div 
          className="w-full md:w-2/5 flex items-center justify-center pointer-events-auto transition-all duration-[1200ms] ease-out delay-100"
          style={{
            opacity: textRevealed ? 1 : 0,
            transform: textRevealed ? "translateY(0)" : "translateY(40px)",
            pointerEvents: textRevealed ? "auto" : "none"
          }}
        >
          {/* Mogao Caves Pagoda Silhouette and Calligraphy Title */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.85 }}
            animate={textRevealed ? { opacity: 0.95, scale: 1 } : { opacity: 0, scale: 0.85 }}
            transition={{ duration: 1.6, ease: "easeOut" }}
            onClick={() => {
              // Interactive facade click triggers multiple fireworks centered on right side
              const w = window.innerWidth;
              const h = window.innerHeight;
              triggerFirework(w * 0.7, h * 0.5);
              triggerFirework(w * 0.72, h * 0.53);
            }}
            className="relative cursor-pointer w-64 h-[350px] flex flex-col items-center justify-between transition-all hover:scale-105 active:scale-95 group pb-2"
            title="莫高窟数字九层楼 - 点击解密色彩"
          >
            {/* Outer golden rim highlights */}
            
            {/* The Pagoda Silhouette (Placed relative & proud at the top) */}
            <div className="relative w-full h-[220px] flex items-center justify-center z-10">
              <svg
                viewBox="0 0 200 240"
                className="w-full h-full text-[#c5a059]/20 fill-shadow group-hover:text-[#c5a059]/35 group-hover:scale-105 transition-all duration-700"
                style={{
                  filter: "drop-shadow(0 0 20px rgba(197, 160, 89, 0.2))"
                }}
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* 9-Story Pagoda Structure Path (detailed & layered for superb aesthetic depth) */}
                {/* Pagoda Base Grid */}
                <path
                  d="M 30 220 L 170 220 L 160 205 L 40 205 Z"
                  fill="#151210"
                  stroke="#c5a059"
                  strokeWidth="1.2"
                  strokeOpacity="0.4"
                />
                
                {/* Tier 1 Box (Ground portal) */}
                <rect x="52" y="170" width="96" height="35" fill="#0d0c0a" stroke="#c5a059" strokeWidth="0.8" strokeOpacity="0.3" />
                <path d="M 85 205 Q 100 175 115 205 Z" fill="#b3322a" opacity="0.6" stroke="#c5a059" strokeWidth="1" /> {/* Cavern arch */}
                <line x1="72" y1="170" x2="72" y2="205" stroke="#c5a059" strokeWidth="0.8" strokeOpacity="0.3" />
                <line x1="128" y1="170" x2="128" y2="205" stroke="#c5a059" strokeWidth="0.8" strokeOpacity="0.3" />

                {/* Tier 2 Roof */}
                <path
                  d="M44,170 C44,170 48,158 64,158 L136,158 C152,158 156,170 156,170 L146,163 L54,163 Z"
                  fill="#b3322a"
                  stroke="#c5a059"
                  strokeWidth="1.2"
                  strokeOpacity="0.5"
                />
                
                {/* Tier 2 Box */}
                <rect x="62" y="132" width="76" height="26" fill="#0e0d0b" stroke="#c5a059" strokeWidth="0.8" strokeOpacity="0.3" />
                <line x1="82" y1="132" x2="82" y2="158" stroke="#c5a059" strokeWidth="0.8" strokeOpacity="0.2" />
                <line x1="118" y1="132" x2="118" y2="158" stroke="#c5a059" strokeWidth="0.8" strokeOpacity="0.2" />

                {/* Tier 3 Roof */}
                <path
                  d="M54,132 C54,132 58,122 72,122 L128,122 C142,122 146,132 146,132 L138,127 L62,127 Z"
                  fill="#b3322a"
                  stroke="#c5a059"
                  strokeWidth="1.2"
                  strokeOpacity="0.5"
                />
                
                {/* Tier 3 Box */}
                <rect x="70" y="98" width="60" height="24" fill="#110e0c" stroke="#c5a059" strokeWidth="0.8" strokeOpacity="0.3" />
                
                {/* Tier 4 Roof */}
                <path
                  d="M62,98 C62,98 66,90 76,90 L124,90 C134,90 138,98 138,98 L130,94 L70,94 Z"
                  fill="#b3322a"
                  stroke="#c5a059"
                  strokeWidth="1.2"
                  strokeOpacity="0.5"
                />

                {/* Top Tower / Spire */}
                <rect x="80" y="66" width="40" height="24" fill="#0d0c0a" stroke="#c5a059" strokeWidth="0.8" strokeOpacity="0.3" />
                <path
                  d="M74,66 C74,66 78,58 86,58 L114,58 C122,58 126,66 126,66 Z"
                  fill="#b3322a"
                  stroke="#c5a059"
                  strokeWidth="1"
                  strokeOpacity="0.6"
                />
                
                {/* Final Finial Spire on top */}
                <line x1="100" y1="58" x2="100" y2="35" stroke="#c5a059" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="100" cy="46" r="4.5" fill="none" stroke="#c5a059" strokeWidth="1.2" />
                <path d="M 96 38 L 104 38" stroke="#c5a059" strokeWidth="1.2" />
              </svg>
            </div>

            {/* Typography branding text (positioned elegantly below the pagoda silhouette) */}
            <div className="relative z-10 flex flex-col items-center select-none text-shadow-lg mt-2 w-full">
              {/* Sacred Golden Fingerprint-Lotus Dial */}
              <div className="flex items-center gap-1.5 mb-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                <Fingerprint className="w-4 h-4 text-[#c5a059] animate-pulse" />
                <span className="text-[9px] text-[#c5a059] font-mono tracking-widest uppercase">
                  Mogao Caverns #381
                </span>
              </div>
              
              {/* Bold horizontal lettering */}
              <span className="text-3xl font-serif font-black tracking-[0.35em] text-[#f5f2ed] pl-3 leading-none mb-2 select-all text-shadow transition-colors duration-300 group-hover:text-[#c5a059]">
                莫高窟
              </span>
              
              {/* Subtitles */}
              <span className="text-[10px] text-[#8b7e6a] font-mono tracking-widest uppercase">
                DUNHUANG INDICES
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

        {/* Dynamic color swatches (Users can click them to trigger high-quality pigment explosions and color fusions!) */}
        <div className="flex flex-wrap justify-center gap-2">
          {DUNHUANG_PIGMENTS.map((c) => {
            const isSelected = selectedPigment.name === c.name;
            return (
              <div
                key={c.name}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPigment(c);
                  const w = window.innerWidth;
                  const h = window.innerHeight;
                  // Burst center random fireworks matching the pigment
                  triggerFirework(w * (0.3 + Math.random() * 0.4), h * (0.35 + Math.random() * 0.3));
                }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-sm border transition-all cursor-pointer shadow-md"
                style={{ 
                  borderColor: isSelected ? c.hex : "rgba(255, 255, 255, 0.05)",
                  backgroundColor: isSelected ? `${c.hex}18` : "rgba(28, 25, 23, 0.65)",
                  boxShadow: isSelected ? `0 0 10px ${c.hex}40` : "none",
                  transform: isSelected ? "scale(1.05)" : "scale(1)"
                }}
                title={`点击选定并将飞天丝带融合为《${c.name}》自然佛光色彩`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block shadow-inner ring-1 ring-white/10 text-shadow-sm"
                  style={{ backgroundColor: c.hex }}
                />
                <span 
                  className="text-[11px] font-serif font-medium tracking-wide transition-colors duration-200"
                  style={{ color: isSelected ? "#ffffff" : "#a8a29e" }}
                >
                  {c.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
