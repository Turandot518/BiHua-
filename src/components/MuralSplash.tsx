/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { HandData, DunhuangDayInfo } from "../types";
import { audio } from "../utils/audio";
import { motion, AnimatePresence } from "motion/react";
import dunhuangBuddha from "../assets/images/dunhuang_buddha_1781577713218.jpg";
import silkRoadCaravan from "../assets/images/dunhuang_silk_road_wide_1781578705874.jpg";
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
  Fingerprint,
  Calendar,
  Bookmark
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
  dunhuangToday?: DunhuangDayInfo | null;
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
  preloadedImagesCount = 0,
  dunhuangToday
}: MuralSplashProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [activeTab, setActiveTab] = useState<string>("repair");
  const [showGuideTip, setShowGuideTip] = useState<boolean>(true);
  const [textRevealed, setTextRevealed] = useState<boolean>(false);
  const [sweepProgress, setSweepProgress] = useState<number>(0);
  const sweepProgressRef = useRef<number>(0);
  const textRevealedRef = useRef<boolean>(false);
  const [allRibbonsShown, setAllRibbonsShown] = useState<boolean>(false);
  const allRibbonsShownRef = useRef<boolean>(false);
  const smoothedProgressRef = useRef<number>(0);
  const touchStartYRef = useRef<number | null>(null);
  const [scrollTop, setScrollTop] = useState<number>(0);

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

  const triggerTextReveal = () => {
    if (textRevealedRef.current) return;
    textRevealedRef.current = true;
    setTextRevealed(true);
    if (audioEnabled) {
      audio.playGuzhengPluck(1.3);
      setTimeout(() => {
        audio.playTempleBell();
      }, 400);
    }
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
        if (y > window.innerHeight * 0.02 && y < window.innerHeight * 0.98) {
          if (sweepProgressRef.current < 100) {
            setSweepProgress((prev) => {
              const next = prev + dist * 0.05; // Balanced interactive sliding contribution
              const roundedNext = Math.min(100, next);
              sweepProgressRef.current = roundedNext;
              return roundedNext;
            });
          }
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
          if (hY > H * 0.02 && hY < H * 0.98) {
            if (sweepProgressRef.current < 100) {
              setSweepProgress((prev) => {
                const next = prev + dist * 0.05; // Balanced interactive gesture contribution
                const roundedNext = Math.min(100, next);
                sweepProgressRef.current = roundedNext;
                return roundedNext;
              });
            }
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

      // Clear canvas so the beautiful background image is fully visible
      ctx.clearRect(0, 0, W, H);

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
      // Smoothly interpolate current drawing progress to eliminate any step stutter for elite visual flow
      smoothedProgressRef.current += (sweepProgressRef.current - smoothedProgressRef.current) * 0.035;
      if (Math.abs(sweepProgressRef.current - smoothedProgressRef.current) < 0.05) {
        smoothedProgressRef.current = sweepProgressRef.current;
      }

      const currentProgress = smoothedProgressRef.current;

      // Ribbon 1 Progress: draws when currentProgress is between 0% and 30%
      let r1Progress = Math.min(1.0, Math.max(0.0, currentProgress / 30));

      // Ribbon 2 Progress: starts only when Ribbon 1 is complete (currentProgress is between 30% and 60%)
      let r2Progress = Math.min(1.0, Math.max(0.0, (currentProgress - 30) / 30));

      // Ribbon 3 Progress: starts only when Ribbon 2 is complete (currentProgress is between 60% and 90%)
      let r3Progress = Math.min(1.0, Math.max(0.0, (currentProgress - 60) / 30));

      // If user has scroll-revealed the main body, instantly anchor ribbons to 100%
      if (textRevealed) {
        r1Progress = 1.0;
        r2Progress = 1.0;
        r3Progress = 1.0;
      }

      // Check if all ribbons are fully shown and transition background
      if (r3Progress >= 0.99 && !allRibbonsShownRef.current) {
        allRibbonsShownRef.current = true;
        setAllRibbonsShown(true);
      }

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
        baseY: number,
        colorName: string,
        colorEng: string
      ) => {
        if (waveProgress <= 0 || limitX < 6) return;
        
        ctx.save();
        const topPoints: {x: number; y: number}[] = [];
        const bottomPoints: {x: number; y: number}[] = [];
        
        // Build coordinates along the horizontal axis
        for (let x = 0; x <= limitX; x += 10) {
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

        // 7. Draw exquisite calligraphy style color name next to the ribbon wave
        if (waveProgress > 0 && topPoints.length > 0) {
          const lastIdx = topPoints.length - 1;
          const endX = topPoints[lastIdx].x;
          const endY = (topPoints[lastIdx].y + bottomPoints[lastIdx].y) / 2;
          
          ctx.save();
          const textOpacity = Math.min(1.0, waveProgress * 1.8);
          ctx.globalAlpha = textOpacity;
          
          // Align label gracefully relative to the tip of progress, clamped within safe borders to avoid cutting off
          const labelX = Math.min(W - 120, Math.max(90, endX - 10));
          const labelY = endY - 50;
          const leadY = labelY - 6;
          
          // Connect label dot to the actual ribbon tip with a beautiful traditional dotted lead line
          ctx.beginPath();
          ctx.moveTo(endX, endY - 8);
          ctx.lineTo(labelX - 16, leadY);
          ctx.strokeStyle = `rgba(197, 160, 89, ${0.45 * textOpacity})`;
          ctx.lineWidth = 0.6;
          ctx.setLineDash([2, 2]);
          ctx.stroke();
          ctx.setLineDash([]);
          
          // Small decorative circular capsule representing the dynamic pigment formula color
          ctx.beginPath();
          ctx.arc(labelX - 16, leadY, 4, 0, Math.PI * 2);
          ctx.fillStyle = `rgb(${blendedInnerR}, ${blendedInnerG}, ${blendedInnerB})`;
          ctx.fill();
          ctx.strokeStyle = gildedColor;
          ctx.lineWidth = 1.0;
          ctx.stroke();
          
          // Elegant traditional typeface for color name, enhanced contrast with deep background dropshadow (made bigger!)
          ctx.font = "bold 19px 'STKaiti', 'KaiTi', 'Playfair Display', serif";
          ctx.fillStyle = "#f5f2ed";
          ctx.shadowColor = "#000000";
          ctx.shadowBlur = 8;
          ctx.fillText(colorName, labelX, labelY);
          
          // Small English subtitle underneath
          ctx.font = "italic 600 10px 'JetBrains Mono', monospace";
          ctx.fillStyle = "rgba(197, 160, 89, 0.95)";
          ctx.fillText(colorEng, labelX, labelY + 13);
          
          ctx.restore();
        }

        ctx.restore();
      };

      // Curves and mathematical varying-width functions to recreate twisting satin ribbons
      const waveY1 = (x: number) => H * 0.73 + 
                     Math.sin(x * 0.0016 + waveTimeRef.current * 0.04) * 65 + 
                     Math.cos(x * 0.0007 - waveTimeRef.current * 0.018) * 22;

      const width1 = (x: number) => {
        const fold = Math.sin(x * 0.003 - waveTimeRef.current * 0.015);
        const foldAbs = Math.abs(fold); 
        return 10 + 44 * foldAbs * (0.8 + 0.2 * Math.cos(x * 0.007));
      };

      const waveY2 = (x: number) => H * 0.79 + 
                     Math.sin(x * 0.0013 - waveTimeRef.current * 0.045 + Math.PI) * 75 + 
                     Math.cos(x * 0.0009 + waveTimeRef.current * 0.022) * 25;

      const width2 = (x: number) => {
        const fold = Math.cos(x * 0.0025 + waveTimeRef.current * 0.01 + 1.5);
        const foldAbs = Math.abs(fold);
        return 8 + 48 * foldAbs * (0.75 + 0.25 * Math.sin(x * 0.005));
      };

      const waveY3 = (x: number) => H * 0.63 + 
                     Math.sin(x * 0.0022 + waveTimeRef.current * 0.03) * 30 + 
                     Math.sin(x * 0.0008 - waveTimeRef.current * 0.035) * 12;

      const width3 = (x: number) => {
        const fold = Math.sin(x * 0.004 - waveTimeRef.current * 0.02 + 0.8);
        const foldAbs = Math.abs(fold);
        return 6 + 32 * foldAbs * (0.8 + 0.2 * Math.cos(x * 0.01));
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
        H * 0.55,
        "朱砂",
        "CINNABAR"
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
        H * 0.62,
        "石绿",
        "MALACHITE"
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
        H * 0.44,
        "佛金",
        "OCHRE GOLD"
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
          ctx.stroke();
          ctx.globalAlpha = 1.0;

          survivors.push(s);
        }
      }
      sparksRef.current = survivors;
      ctx.restore();

      // --- 5. Interactive Ambient Halo for Gesturing Hand or Mouse Cursor (MediaPipe / Cursor Integration) ---
      let interactX: number | null = null;
      let interactY: number | null = null;

      if (handData) {
        interactX = handData.x * W;
        interactY = handData.y * H;
      } else if (prevPointerRef.current) {
        interactX = prevPointerRef.current.x;
        interactY = prevPointerRef.current.y;
      }

      if (interactX !== null && interactY !== null) {
        ctx.save();
        ctx.translate(interactX, interactY);
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

        // Spawn beautiful little sparkling star trails while gesturing or moving cursor
        if (timeRef.current % 4 === 0) {
          const pigment = DUNHUANG_PIGMENTS[Math.floor(Math.random() * DUNHUANG_PIGMENTS.length)];
          sparksRef.current.push({
            x: interactX,
            y: interactY,
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
    e.stopPropagation();
    triggerFirework(e.clientX, e.clientY);
    
    if (sweepProgress >= 100 && !textRevealed) {
      // If ribbons are fully drawn and background has faded, click anywhere in the container triggers the scroll down!
      triggerTextReveal();
    }
  };

  const scrollRatio = Math.min(1.0, scrollTop / (window.innerHeight || 800));
  const scrollOpacity = Math.max(0.0, 1.0 - scrollRatio * 1.5);

  const scrollToTextSection = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const textSection = document.getElementById("dunhuang-text-section");
    if (textSection) {
      textSection.scrollIntoView({ behavior: "smooth" });
    }
    triggerTextReveal();
  };

  return (
    <div 
      ref={containerRef}
      onScroll={(e) => {
        setScrollTop(e.currentTarget.scrollTop);
      }}
      onClick={handleContainerClick}
      className={`fixed inset-0 w-full h-full z-100 bg-[#0a0808] text-stone-100 select-none ${sweepProgress >= 99 ? "overflow-y-auto scroll-smooth animate-fade-in" : "overflow-hidden"}`}
    >
      {/* SCREEN 1: HERO CANVAS SECTION (100vh) */}
      <div className="relative w-full h-screen h-[100svh] overflow-hidden flex flex-col justify-between shrink-0 select-none">
        {/* SPECIAL POSTER BACKDROP FILLED FULL SCREEN & BEAUTIFULLY VISIBLE */}
        <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden bg-[#0a0808]">
          <div 
            className="absolute inset-0 h-full w-full transition-all duration-[2200ms] cubic-bezier(0.16, 1, 0.3, 1)"
            style={{
              opacity: allRibbonsShown ? 1.0 : (sweepProgress >= 90 ? Math.min(1.0, (sweepProgress - 90) / 10) : 0.0),
              transform: `scale(${1.02 - scrollRatio * 0.015})`,
            }}
          >
            <img 
              src={silkRoadCaravan} 
              alt="Dunhuang Silk Road Echoes landscape backdrop" 
              className="w-full h-full object-cover object-center"
              referrerPolicy="no-referrer"
            />
            {/* Unified 60% black dark mask overlay to dim the backdrop uniformly per user request */}
            <div className="absolute inset-0 bg-black/60 z-0 pointer-events-none" />
            
            {/* Strong and tall bottom edge vignetting to transition perfectly to the black section below */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0a0808] via-[#0a0808]/92 via-[#0a0808]/40 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-1/6 bg-gradient-to-b from-[#0a0808]/55 to-transparent z-0" />
          </div>
        </div>

        {/* BACKGROUND GRAPHIC INTERLACE GRID */}
        <div className="absolute inset-0 bg-[radial-gradient(#c5a059_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.05] pointer-events-none z-5"></div>

        {/* Majestic Dunhuang Echoes Calligraphy Title in the upper pattern area */}
        {sweepProgress >= 90 && (
          <div className="absolute inset-x-0 top-[28%] sm:top-[24%] flex flex-col items-center justify-center pointer-events-none select-none z-30 animate-fade-in font-serif">
            <div className="flex flex-col items-center bg-stone-950/40 backdrop-blur-[2px] px-8 py-5 rounded-lg border border-white/5 shadow-2xl">
              <h2 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-[#c5a059] tracking-[0.55em] pl-[0.55em] drop-shadow-[0_4px_22px_rgba(0,0,0,0.95)] select-none font-serif leading-none">
                敦煌遗响
              </h2>
              <div className="w-20 h-[1.5px] bg-gradient-to-r from-transparent via-[#c5a059]/60 to-transparent my-3.5 sm:my-4.5" />
              <p className="text-[10px] sm:text-xs tracking-[0.55em] pl-[0.55em] text-[#eddcc4] font-serif uppercase font-extrabold drop-shadow-[0_2px_8px_rgba(0,0,0,0.98)]">
                ECHOES OF DUNHUANG
              </p>
            </div>
          </div>
        )}

        {/* Interactive canvas layered beautifully on top of the backdrop but behind standard text elements */}
        <canvas
          ref={canvasRef}
          onClick={(e) => {
            // Canvas click bubbles up or is handled directly
            e.stopPropagation();
            triggerFirework(e.clientX, e.clientY);
          }}
          className="absolute inset-0 w-full h-full block cursor-crosshair z-10"
          title="点按屏幕绽放极乐净土古彩神光"
        />

      {/* ----------------- TOP HIGH-FIDELITY HEADER BAR ----------------- */}
      <div className="relative z-20 w-full px-4 sm:px-8 py-3.5 sm:py-4 bg-[#0d0c0a]/65 border-b border-[#c5a059]/15 backdrop-blur-md pointer-events-auto flex flex-row items-center justify-between gap-4">
        {/* Left Side: Museum Collaboratory Brand Logo */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Authentic red block pill */}
          <div className="bg-[#b3322a] border border-[#ff5b4f]/20 text-white font-serif font-bold text-xs px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-sm shadow-md animate-pulse">
            教
          </div>
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm font-semibold text-[#f5f2ed] tracking-wider font-serif">
              敦煌遗珍<span className="hidden xs:inline"> · 数字化交互平台</span>
            </span>
            <span className="text-[8px] sm:text-[9px] text-[#8b7e6a] tracking-widest font-mono uppercase truncate max-w-[125px] sm:max-w-none">
              MOGAO HERITAGE
            </span>
          </div>
        </div>

        {/* Right Side: Re-construction Engineering context & Switches */}
        <div className="flex items-center gap-3">
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
      {sweepProgress < 100 ? (
        <div className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-auto text-center select-none z-30 bg-stone-950/85 border-2 border-[#c5a059]/40 rounded-xl p-8 sm:p-10 backdrop-blur-md w-[92%] max-w-sm sm:max-w-md shadow-[0_24px_64px_rgba(0,0,0,0.95)] animate-fade-in font-serif">
          {/* Pulsing Fingerprint and waving ring */}
          <div className="relative w-18 h-18 flex items-center justify-center mb-5">
            <span className="absolute inset-0 rounded-full bg-[#c5a059]/35 animate-ping" />
            <span className="absolute inset-2 rounded-full bg-[#c5a059]/15 animate-pulse" />
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
            >
              <Fingerprint className="w-12 h-12 text-[#c5a059]" />
            </motion.div>
          </div>
          
          <span className="text-xs tracking-[0.35em] text-[#ff6459] font-mono block mb-2 uppercase font-bold animate-pulse">
            ✨ GESTURE / TOUCH TO REVEAL ✨
          </span>
          
          <h3 className="text-2xl sm:text-3xl font-serif font-black text-[#f5f2ed] tracking-[0.16em] mb-3 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            挥手 · 触碰屏幕互动
          </h3>
          
          <p className="text-sm sm:text-base text-stone-300 leading-relaxed font-serif px-2 mb-5 font-bold">
            在摄像头前<span className="text-[#c5a059] font-bold">挥手</span>，或在屏幕上<span className="text-[#c5a059] font-bold">滑动/点击</span>，
            <br />
            即可陆续唤醒古老丝带，随着您的动作缓慢逐个出现！
          </p>
          
          {/* Aesthetic progress indicator */}
          <div className="w-full h-1.5 bg-stone-900/95 rounded-full overflow-hidden mt-2 border border-white/10 shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-[#b3322a] via-[#c5a059] to-[#2f7a5b] transition-all duration-300 rounded-full"
              style={{ width: `${sweepProgress}%` }}
            />
          </div>
          <span className="text-[11px] text-[#c5a059] font-mono tracking-widest mt-3.5 uppercase flex flex-col items-center gap-1.5">
            <span className="font-bold text-stone-200">复原唤醒度: {Math.round(sweepProgress)}%</span>
            <span className="text-[#8b7e6a] text-xs font-serif normal-case font-semibold">
              {preloadedImagesCount < 5 
                ? `正在召回千年画幅色彩 (${preloadedImagesCount}/5)...` 
                : "✨ 千年画卷神采归位，一触即发 ✨"}
            </span>
          </span>
        </div>
      ) : (
        scrollRatio < 0.15 && (
          <div 
            onClick={(e) => scrollToTextSection(e)}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto text-center select-none z-30 bg-stone-950/90 border border-[#c5a059]/40 rounded-full px-6 py-2.5 backdrop-blur-md shadow-[0_12px_44px_rgba(0,0,0,0.85)] cursor-pointer hover:border-[#c5a059] transition-all transform hover:-translate-y-1 animate-bounce"
          >
            <span className="text-xs tracking-[0.2em] text-[#c5a059] font-serif font-black animate-pulse flex items-center gap-2">
              <span>画卷复原毕，向下滚动浏览文献</span>
              <span className="text-sm">⬇</span>
            </span>
          </div>
        )
      )}

    </div>

    {/* GRADIENT CONNECTOR THAT TRANSITIONS THE BACKGROUND TO DEEP BLACK */}
    <div className="relative w-full h-16 bg-gradient-to-b from-[#0a0808] to-black z-10 pointer-events-none select-none shrink-0" />

    {/* SCREEN 2: SCROLLABLE EXQUISITE BLACK TEXT & ACADEMIC REVEAL SECTION */}
    <div 
      id="dunhuang-text-section"
      className="relative w-full min-h-screen bg-black text-stone-100 flex flex-col items-center justify-start pt-2 sm:pt-4 pb-20 px-4 md:px-8 z-20 font-serif"
    >
      <div className="w-full max-w-5xl mx-auto flex flex-col md:flex-row items-center md:items-start justify-between gap-10 md:gap-16">
        
        {/* Left Column: Authentic Chinese Calligraphy Display */}
        <div className="flex flex-row items-stretch gap-6 select-none shrink-0 animate-fade-in">
          {/* Vertical Title & Seal Column without right-border divider */}
          <div className="flex flex-col items-center justify-start gap-4">
            {/* Vertical Title '敦煌' */}
            <div 
              className="text-shadow-md text-6xl xl:text-7xl font-serif font-black text-[#c5a059] tracking-widest select-all writing-vertical-rl transition-all duration-500 hover:text-[#e5c158]"
              style={{ writingMode: "vertical-rl", textOrientation: "upright" }}
            >
              敦煌
            </div>
            
            {/* Subtitle '敦煌遗响' */}
            <div className="flex flex-col items-center gap-2 mt-2">
              <div 
                className="text-[#c5a059] font-serif text-sm tracking-[0.3em] font-bold"
                style={{ writingMode: "vertical-rl", textOrientation: "upright" }}
              >
                敦煌遗响
              </div>
              
              {/* Red Seal Stamp */}
              <div 
                className="w-8 h-8 border-2 border-[#b3322a] text-[#b3322a] font-serif font-black text-[10px] flex items-center justify-center bg-[#b3322a]/15 rounded-sm mt-1 shadow-[0_2px_12px_rgba(179,50,42,0.5)] leading-none select-none tracking-normal shrink-0 transition-transform duration-300 hover:scale-110 active:scale-95 cursor-pointer animate-pulse"
                style={{ writingMode: "vertical-rl", textOrientation: "upright" }}
                title="敦煌印章：遗响"
              >
                遗响
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Informative Content and Real-World groundings */}
        <div className="flex-1 text-left flex flex-col justify-center items-start selection:bg-[#b3322a]/30 animate-fade-in font-serif">
          {/* CAVE PROJECT STAMP */}
          <div className="text-[10px] font-mono font-bold tracking-[0.35em] text-[#c5a059]/60 uppercase mb-2">
            洞窟透视计划 // CAVE MIRO PROJECT
          </div>

          {/* Action indicator prefix */}
          <div className="font-serif text-[11px] text-[#8b7e6a] tracking-widest mb-1.5 flex items-center gap-1.5 font-bold">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#b3322a] animate-ping" />
            <span>双按原色 · 重述尘世大漠画幅</span>
          </div>

          {/* High-Exploration Capsule */}
          <div className="inline-flex items-center gap-1.5 bg-[#b3322a]/10 border border-[#b3322a]/30 px-3 py-1 rounded-full text-[10px] tracking-widest font-semibold font-serif text-[#ff6459] mb-4 shadow-sm">
            <Sparkles className="w-3 h-3 text-[#ff6459]" />
            <span>高勘探极光 · 助尘物归</span>
          </div>

          {/* Title display */}
          <h1 className="text-3xl sm:text-5xl font-bold text-[#f5f2ed] tracking-[0.24em] font-serif leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)] font-black">
            敦煌遗响数字化探索
          </h1>

          {/* Golden accent bar */}
          <div className="w-24 h-[1.5px] bg-gradient-to-r from-[#c5a059] to-transparent my-5" />

          {/* Authentic Description text block */}
          <p className="text-[#c6bdae] text-xs sm:text-sm font-serif max-w-xl leading-relaxed tracking-wider mb-6">
            移动鼠标感应大漠古道奇意。飞天霓裳扶摇，驼队缓缓前行。莫高窟特有天然重彩：
            <span className="text-[#64b092] font-semibold">孔雀石绿（石绿）</span>、
            <span className="text-[#ff6459] font-semibold">硫化汞红（朱砂）</span>及
            <span className="text-[#5984b0] font-semibold">青金石蓝</span>
            交融汇聚，交织成跨越两千里的彩色史诗，等待您的探索与唤醒。
          </p>

          {/* Real-time Google Search Grounded Culture Card */}
          {dunhuangToday && (
            <div
              className="mb-8 p-4 sm:p-5 w-full max-w-xl rounded-sm bg-[#120d0a]/90 border border-[#c5a059]/35 shadow-[0_12px_48px_rgba(0,0,0,0.8)] backdrop-blur-md relative overflow-hidden group select-text pointer-events-auto hover:border-[#c5a059] transition-all"
            >
              {/* Decorative Corner Lines */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#c5a059]" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#c5a059]" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#c5a059]" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#c5a059]" />

              {/* Header category badge */}
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5 text-[#ff6459]" />
                  <span className="text-[10px] sm:text-[11px] font-serif font-semibold text-[#ff6459] tracking-widest leading-none uppercase">
                    {dunhuangToday.heading || "今日资讯推荐"}
                  </span>
                </div>
                {dunhuangToday.dynasty && (
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-sm bg-[#c5a059]/10 text-stone-300 border border-[#c5a059]/20 font-semibold">
                    {dunhuangToday.dynasty}
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className="text-sm sm:text-base font-serif font-bold text-[#f5f2ed] tracking-wider mb-2 flex items-center gap-1.5 select-all">
                <Calendar className="w-4 h-4 text-[#c5a059] shrink-0" />
                <span>{dunhuangToday.title}</span>
              </h3>

              {/* Content */}
              <p className="text-[#c6bdae] text-xs font-serif leading-relaxed pr-1">
                {dunhuangToday.content}
              </p>

              {/* Footer labels */}
              <div className="mt-3 pt-2.5 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                {dunhuangToday.tags && dunhuangToday.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {dunhuangToday.tags.map((tg, idx) => (
                      <span key={idx} className="text-[#8b7e6a] font-serif font-semibold">
                        #{tg}
                      </span>
                    ))}
                  </div>
                )}
                {dunhuangToday.source && (
                  <span className="text-[#8b7e6a]/60 font-serif italic">
                    出处: {dunhuangToday.source}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* PRIMARY PULSING CALL-TO-ACTION BUTTON */}
          <div className="relative pointer-events-auto">
            <button
              onClick={handleStartGame}
              className="relative group px-10 py-4 sm:py-5 bg-gradient-to-r from-[#c5a059] to-[#bf974b] text-[#0f0e0c] font-serif font-bold tracking-[0.3em] text-xs sm:text-sm rounded-sm shadow-[0_8px_32px_rgba(197,160,89,0.3)] hover:shadow-[0_12px_40px_rgba(197,160,89,0.55)] hover:-translate-y-0.5 border border-[#e5c158]/50 transition-all cursor-pointer overflow-hidden flex items-center gap-2 select-none"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
              <span className="relative flex items-center justify-center gap-2">
                <span>开启寻色之旅</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          </div>

          {/* Visual subtext footer */}
          <div className="text-[#8b7e6a]/55 text-[11px] font-serif tracking-widest mt-6 leading-normal select-none">
            扫拂复原及壁画交互且触响，感受身色共鸣意境 · Grotto Parallax
          </div>
        </div>
      </div>
    </div>
  </div>
);
}
