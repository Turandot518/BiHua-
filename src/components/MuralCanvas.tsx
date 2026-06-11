/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { HandData, InteractionMode } from "../types";
import { audio } from "../utils/audio";
import { Hand, RefreshCcw, ZoomIn, Eye, Sparkles, Check, Grab } from "lucide-react";

interface MuralCanvasProps {
  imageSrc: string;
  handData: HandData | null;
  interactionMode: InteractionMode;
  brushSize: number;
  onProgressUpdate: (progress: number) => void;
  resetTrigger: number;
}

export default function MuralCanvas({
  imageSrc,
  handData,
  interactionMode,
  brushSize,
  onProgressUpdate,
  resetTrigger
}: MuralCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Offscreen canvas to track permanent mask (used in 'paint' mode)
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Offscreen canvas for double-buffered rendering (flicker prevention)
  const bufferCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Persistent offscreen canvas composition to prevent high-frequency DOM memory leak and GC stutter
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Persistent offscreen canvas for a robust grayscale version of our mural (for high-performance mobile support)
  const grayscaleCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const lastProgressRef = useRef<number>(-1);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [localCursor, setLocalCursor] = useState<{ x: number; y: number; isDown: boolean } | null>(null);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  // Load Image
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setImageLoaded(false);
    
    // Support string URLs or ES module objects safely
    let srcStr = "";
    if (typeof imageSrc === "string") {
      srcStr = imageSrc;
    } else if (imageSrc && typeof imageSrc === "object") {
      srcStr = (imageSrc as any).default || (imageSrc as any).src || "";
    }
    
    if (!srcStr) {
      console.error("MuralCanvas: Invalid imageSrc", imageSrc);
      // Fallback SVG placeholder if source is completely missing
      const fallbackImg = new Image();
      const svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
          <rect width="100%" height="100%" fill="#1a120b"/>
          <text x="50%" y="50%" font-family="serif" font-size="20" fill="#c5a059" text-anchor="middle" dominant-baseline="middle">敦煌壁画精品（数据源空缺）</text>
        </svg>
      `;
      fallbackImg.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
      fallbackImg.onload = () => {
        imgRef.current = fallbackImg;
        setImageLoaded(true);
        initMask(dimensions.width, dimensions.height);
      };
      return;
    }

    const isRemote = srcStr.startsWith("http://") || srcStr.startsWith("https://") || srcStr.startsWith("//");
    const img = new Image();
    if (isRemote && !srcStr.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    
    // Secure CORS-first or immediate load
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
      initMask(dimensions.width, dimensions.height);
    };

    img.onerror = () => {
      console.warn("Mural image failed with anonymous CORS loading. Trying fallback regular mode without CORS...", srcStr);
      
      const fallbackNoCorsImg = new Image();
      fallbackNoCorsImg.onload = () => {
        imgRef.current = fallbackNoCorsImg;
        setImageLoaded(true);
        initMask(dimensions.width, dimensions.height);
      };
      
      fallbackNoCorsImg.onerror = () => {
        console.error("Mural image completely failed to load:", srcStr);
        
        // Bulletproof Attempt: Create a beautiful themed SVG vector placeholder resembling the actual mural structure
        const fallbackImg = new Image();
        const width = 800;
        const height = 500;
        const isMural1 = srcStr.includes("mural1");
        const muralTitle = isMural1 ? "棺盖自启为母说法" : "山林禅修故事";
        const dynasty = isMural1 ? "盛唐 · 莫高窟第148窟" : "北魏/西魏 · 莫高窟第285窟";
        
        const svgString = `
          <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <defs>
              <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#2a1a0c"/>
                <stop offset="50%" stop-color="#402c18"/>
                <stop offset="100%" stop-color="#1f1207"/>
              </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#g)"/>
            <text x="50%" y="42%" font-family="serif" font-size="28" fill="#c5a059" text-anchor="middle" dominant-baseline="middle" font-weight="bold">${muralTitle}</text>
            <text x="50%" y="54%" font-family="serif" font-size="16" fill="#a49380" text-anchor="middle" dominant-baseline="middle">${dynasty}</text>
            <text x="50%" y="65%" font-family="serif" font-size="13" fill="#8c7865" text-anchor="middle" dominant-baseline="middle">图像未能直接渲染，已为您生成数字艺术摹本</text>
            
            <!-- Beautiful decorative mandala or scroll lines in gold -->
            <circle cx="400" cy="250" r="180" fill="none" stroke="#c5a059" stroke-width="0.7" stroke-opacity="0.15" stroke-dasharray="4,4"/>
            <circle cx="400" cy="250" r="120" fill="none" stroke="#c5a059" stroke-width="0.5" stroke-opacity="0.1" stroke-dasharray="8,4"/>
            
            <!-- Elegant frame lines -->
            <rect x="25" y="25" width="${width - 50}" height="${height - 50}" fill="none" stroke="#c5a059" stroke-width="1.5" stroke-opacity="0.35"/>
            <rect x="30" y="30" width="${width - 60}" height="${height - 60}" fill="none" stroke="#c5a059" stroke-width="0.5" stroke-opacity="0.15"/>
          </svg>
        `;
        
        fallbackImg.onload = () => {
          imgRef.current = fallbackImg;
          setImageLoaded(true);
          initMask(dimensions.width, dimensions.height);
        };
        fallbackImg.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
      };
      
      fallbackNoCorsImg.src = srcStr;
    };

    img.src = srcStr;
  }, [imageSrc]);

  // Handle Container Resizing
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      
      // Keep beautiful widescreen aspect ratio
      const targetWidth = Math.max(width, 280);
      const targetHeight = Math.min(targetWidth * 0.625, window.innerHeight * 0.62); // 16:10 or capped by viewport

      // Round layout parameters to lock integer coordinates, preventing sub-pixel layout recalculation loops
      const roundedW = Math.round(targetWidth);
      const roundedH = Math.round(targetHeight);

      setDimensions((current) => {
        // Only trigger size change if mutated by at least 16 pixels to shield from sub-pixel rendering and scrollbar layout oscillatory feedback loops
        if (Math.abs(current.width - roundedW) > 16 || Math.abs(current.height - roundedH) > 16) {
          return { width: roundedW, height: roundedH };
        }
        return current;
      });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Pre-generate a high-performance, 100% mobile-robust grayscale copy of the current mural
  const updateGrayscaleCache = (w: number, h: number) => {
    if (!imgRef.current || w <= 0 || h <= 0) return;

    if (!grayscaleCanvasRef.current) {
      grayscaleCanvasRef.current = document.createElement("canvas");
    }
    const gCanvas = grayscaleCanvasRef.current;
    gCanvas.width = w;
    gCanvas.height = h;

    const gCtx = gCanvas.getContext("2d");
    if (!gCtx) return;

    // Build the high-performance, CORS-safe, Safari-compatible ancient grayscale fresco look
    // 1. Draw the original colorful image
    gCtx.clearRect(0, 0, w, h);
    gCtx.drawImage(imgRef.current, 0, 0, w, h);

    // 2. Live canvas compositing to convert to 100% high-quality grayscale.
    // This technique works on ALL mobile browsers (including iOS Safari and Android Chrome inside any iframe),
    // and completely bypasses tainted canvas errors or missing ctx.filter support.
    gCtx.save();
    gCtx.globalCompositeOperation = "color";
    gCtx.fillStyle = "#808080"; // Absolute neutral gray (0% saturation)
    gCtx.fillRect(0, 0, w, h);
    gCtx.restore();

    // 3. Apply standard blend mode to dim and enhance contrast for a moody Dunhuang stone-cave underlay look in charcoal/dust
    gCtx.save();
    gCtx.globalCompositeOperation = "multiply";
    gCtx.fillStyle = "rgba(0, 0, 0, 0.28)"; // Fine-tuned brightness dampener (matches ~0.72 brightness)
    gCtx.fillRect(0, 0, w, h);
    gCtx.restore();
  };

  // Initialize or resize persistent mask
  const initMask = (w: number, h: number) => {
    if (!maskCanvasRef.current) {
      maskCanvasRef.current = document.createElement("canvas");
    }
    const mask = maskCanvasRef.current;
    mask.width = w;
    mask.height = h;

    const mCtx = mask.getContext("2d");
    if (mCtx) {
      mCtx.clearRect(0, 0, w, h); // Initialize mask as completely transparent (unrestored)
    }

    if (!bufferCanvasRef.current) {
      bufferCanvasRef.current = document.createElement("canvas");
    }
    bufferCanvasRef.current.width = w;
    bufferCanvasRef.current.height = h;

    // Cache the grayscale copy
    updateGrayscaleCache(w, h);

    lastProgressRef.current = 0;
    // Defer state propagation to avoid updating during a synchronous layout or rendering tick
    setTimeout(() => {
      onProgressUpdate(0);
    }, 0);
  };

  // Synchronize mask canvas size when size state changes (preserving contents)
  useEffect(() => {
    if (imageLoaded && dimensions.width > 0 && dimensions.height > 0) {
      // Save old mask contents
      const oldMask = document.createElement("canvas");
      oldMask.width = maskCanvasRef.current?.width || dimensions.width;
      oldMask.height = maskCanvasRef.current?.height || dimensions.height;
      const oldCtx = oldMask.getContext("2d");
      if (oldCtx && maskCanvasRef.current) {
        oldCtx.drawImage(maskCanvasRef.current, 0, 0);
      }

      // Re-initialize mask size
      if (maskCanvasRef.current) {
        maskCanvasRef.current.width = dimensions.width;
        maskCanvasRef.current.height = dimensions.height;
        const mCtx = maskCanvasRef.current.getContext("2d");
        if (mCtx) {
          mCtx.clearRect(0, 0, dimensions.width, dimensions.height);
          // Re-draw saved mask stretched to new size
          mCtx.drawImage(oldMask, 0, 0, dimensions.width, dimensions.height);
        }
      }

      if (bufferCanvasRef.current) {
        bufferCanvasRef.current.width = dimensions.width;
        bufferCanvasRef.current.height = dimensions.height;
      }

      // Re-cache our high-performance grayscale canvas at the new dimensions
      updateGrayscaleCache(dimensions.width, dimensions.height);
    }
  }, [dimensions.width, dimensions.height, imageLoaded]);

  // Listen for reset trigger
  useEffect(() => {
    if (imageLoaded) {
      initMask(dimensions.width, dimensions.height);
    }
  }, [resetTrigger, imageLoaded]);

  // Actual Coordinate of Hand Brush / Mouse Simulator
  // Supports both AI video hand-tracking AND elegant Mouse dragging simulation
  // (Hovering alone does NOT scratch/paint to prevent accidental coloring)
  const activeBrush = React.useMemo(() => {
    if (handData) {
      // In spotlight mode, light is ON when hand is open (isOpen is true).
      // In paint mode, painting is active when the hand is open (five-finger open posture).
      const isSpotlightOn = handData.isOpen;
      return {
        x: handData.x * dimensions.width,
        y: handData.y * dimensions.height,
        isActive: handData.isOpen, // For paint mode (Only paint when hand is open!)
        isSpotlightOn,
        isOpen: handData.isOpen,
        isAI: true
      };
    }
    if (localCursor && isHovered) {
      // For local pointer:
      // In spotlight mode: Hovering -> Spotlight ON. Clicking down -> Spotlight OFF (simulates pinch gesture).
      // In paint mode: Only paints when clicking and dragging.
      const isSpotlightOn = !localCursor.isDown;
      return {
        x: localCursor.x,
        y: localCursor.y,
        isActive: localCursor.isDown, // For paint mode
        isSpotlightOn,
        isOpen: !localCursor.isDown,
        isAI: false
      };
    }
    return null;
  }, [
    handData,
    localCursor?.x,
    localCursor?.y,
    localCursor?.isDown,
    isHovered,
    dimensions.width,
    dimensions.height
  ]);

  // Paint onto the offscreen mask & handle composition loop
  useEffect(() => {
    if (!imageLoaded || !imgRef.current || !mainCanvasRef.current || !maskCanvasRef.current || !bufferCanvasRef.current) return;

    try {
      const mainCtx = mainCanvasRef.current.getContext("2d");
      const maskCtx = maskCanvasRef.current.getContext("2d");
      const bufCtx = bufferCanvasRef.current.getContext("2d");

      if (!mainCtx || !maskCtx || !bufCtx) return;

      const W = dimensions.width;
      const H = dimensions.height;

      // Prevent crashes on uninitialized, zero, or non-finite dimensions
      if (W <= 0 || H <= 0 || !isFinite(W) || !isFinite(H)) return;

      // Ensure valid brush dimensions before drawing. Scale dynamically on smaller mobile viewports to prevent massive brush sizes relative to screen size.
      const scaleMultiplier = W / 800;
      const safeBrushSize = Math.max(8, (isFinite(brushSize) ? brushSize : 80) * scaleMultiplier);

      // 1. Perform permanent paint on mask if in 'paint' mode and hand/cursor brush is active
      if (activeBrush && activeBrush.isActive && interactionMode === "paint") {
        const gradient = maskCtx.createRadialGradient(
          activeBrush.x,
          activeBrush.y,
          safeBrushSize * 0.1,
          activeBrush.x,
          activeBrush.y,
          safeBrushSize
        );
        gradient.addColorStop(0, "rgba(255, 255, 255, 1.0)");
        gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.7)");
        gradient.addColorStop(1, "rgba(255, 255, 255, 0.0)");

        maskCtx.fillStyle = gradient;
        maskCtx.beginPath();
        maskCtx.arc(activeBrush.x, activeBrush.y, safeBrushSize, 0, Math.PI * 2);
        maskCtx.fill();

        // Trigger plucking musical chimes sounds proportional to horizontal motion
        audio.playGuzhengPluck(activeBrush.x / W);
      } else if (activeBrush && interactionMode === "spotlight" && activeBrush.isSpotlightOn) {
        // Play soft notes for spotlight only when the light is actually ON
        audio.playGuzhengPluck(activeBrush.x / W);
      }

      // 2. Render Pipeline
      // A. Draw black-and-white (underlay) fresco onto buffer from our high-performance mobile-robust grayscale cache
      bufCtx.clearRect(0, 0, W, H);
      if (grayscaleCanvasRef.current) {
        bufCtx.drawImage(grayscaleCanvasRef.current, 0, 0, W, H);
      } else {
        // Bulletproof blending fallback in case grayscale cache is ever uninitialized/null
        bufCtx.save();
        bufCtx.drawImage(imgRef.current, 0, 0, W, H);
        bufCtx.globalCompositeOperation = "color";
        bufCtx.fillStyle = "#808080";
        bufCtx.fillRect(0, 0, W, H);
        bufCtx.globalCompositeOperation = "multiply";
        bufCtx.fillStyle = "rgba(0, 0, 0, 0.28)"; 
        bufCtx.fillRect(0, 0, W, H);
        bufCtx.restore();
      }

      // B. Draw colored mask layer onto buffer
      // Lazily initialize persistent offscreen composition canvas to avoid memory allocation churn
      if (!tempCanvasRef.current) {
        tempCanvasRef.current = document.createElement("canvas");
      }
      const tempCanvas = tempCanvasRef.current;
      if (tempCanvas.width !== W || tempCanvas.height !== H) {
        tempCanvas.width = W;
        tempCanvas.height = H;
      }
      const tempCtx = tempCanvas.getContext("2d");
      
      if (tempCtx) {
        // Draw fully colored gorgeous details
        tempCtx.clearRect(0, 0, W, H);
        tempCtx.save();
        tempCtx.drawImage(imgRef.current, 0, 0, W, H);

        if (interactionMode === "paint") {
          // Intersect color with the painted mask (white pixels in mask remain colored)
          tempCtx.globalCompositeOperation = "destination-in";
          tempCtx.drawImage(maskCanvasRef.current, 0, 0);
        } else {
          // Spotlight Mode: Cut a circular flashlight cone around brush coord if light is on
          tempCtx.globalCompositeOperation = "destination-in";
          if (activeBrush && activeBrush.isSpotlightOn) {
            const spotGrad = tempCtx.createRadialGradient(
              activeBrush.x,
              activeBrush.y,
              safeBrushSize * 0.15,
              activeBrush.x,
              activeBrush.y,
              safeBrushSize
            );
            spotGrad.addColorStop(0, "rgba(255, 255, 255, 1.0)");
            spotGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.9)");
            spotGrad.addColorStop(1, "rgba(255, 255, 255, 0.0)");

            tempCtx.fillStyle = spotGrad;
            tempCtx.beginPath();
            tempCtx.arc(activeBrush.x, activeBrush.y, safeBrushSize, 0, Math.PI * 2);
            tempCtx.fill();
          } else {
            // If no interactive brush or light is off, draw completely transparent (reveals monochrome background)
            tempCtx.fillStyle = "rgba(0,0,0,0)";
            tempCtx.fillRect(0,0,W,H);
          }
        }
        tempCtx.restore();

        // Draw masked color overlay onto buffer on top of black&white
        bufCtx.drawImage(tempCanvas, 0, 0);
      }

      // 3. Blit double-buffered frame to live main viewport canvas
      mainCtx.clearRect(0,0,W,H);
      mainCtx.drawImage(bufferCanvasRef.current, 0, 0);

      // 4. Draw brush visual cue (glowing cursor/circle)
      if (activeBrush && (isHovered || activeBrush.isAI)) {
        const shouldShowCue = interactionMode === "paint" || activeBrush.isSpotlightOn;
        if (shouldShowCue) {
          // Draw brush radius border outline
          mainCtx.strokeStyle = activeBrush.isActive ? "rgba(245, 158, 11, 0.45)" : "rgba(245, 158, 11, 0.15)";
          mainCtx.lineWidth = 1.8;
          mainCtx.setLineDash([5, 5]);
          mainCtx.beginPath();
          mainCtx.arc(activeBrush.x, activeBrush.y, safeBrushSize, 0, Math.PI * 2);
          mainCtx.stroke();
          mainCtx.setLineDash([]); // Reset dash

          // Golden particle rings inside the brush
          mainCtx.fillStyle = "rgba(245, 158, 11, 0.08)";
          mainCtx.beginPath();
          mainCtx.arc(activeBrush.x, activeBrush.y, safeBrushSize * 0.4, 0, Math.PI * 2);
          mainCtx.fill();
        } else {
          // If the light is turned off under spotlight mode, show a small dim tracking dot for user awareness
          mainCtx.fillStyle = "rgba(245, 158, 11, 0.3)";
          mainCtx.beginPath();
          mainCtx.arc(activeBrush.x, activeBrush.y, 4, 0, Math.PI * 2);
          mainCtx.fill();
        }
      }
    } catch (err) {
      console.error("MuralCanvas paint rendering cycle exception handled:", err);
    }
  }, [imageLoaded, activeBrush, dimensions.width, dimensions.height, interactionMode, brushSize, resetTrigger]);

  // Separated progress calculator to prevent GPU pipeline stalls and memory bloating on high-frequency gesture updates
  useEffect(() => {
    if (!imageLoaded || interactionMode !== "paint") {
      if (lastProgressRef.current !== 0) {
        lastProgressRef.current = 0;
        onProgressUpdate(0);
      }
      return;
    }

    const calcProgress = () => {
      const maskCanvas = maskCanvasRef.current;
      if (!maskCanvas) return;
      const maskCtx = maskCanvas.getContext("2d");
      if (!maskCtx) return;

      const W = maskCanvas.width;
      const H = maskCanvas.height;
      if (W <= 0 || H <= 0) return;

      try {
        const maskData = maskCtx.getImageData(0, 0, W, H);
        const u8 = maskData.data;
        let whiteCount = 0;
        // Step scan every 48 items in the flat array (covers Red channel of pixel indexes quickly)
        const step = 48; 
        for (let i = 0; i < u8.length; i += step) {
          if (u8[i] > 120) { // Painted white
            whiteCount++;
          }
        }
        const scanPct = Math.min(100, Math.round((whiteCount / (u8.length / step)) * 100));
        // Amplify progress slightly for satisfying user feedback (so small gaps on corners don't prevent 100%)
        const amplifiedPct = scanPct >= 88 ? 100 : Math.round((scanPct / 88) * 100);
        if (amplifiedPct !== lastProgressRef.current) {
          lastProgressRef.current = amplifiedPct;
          onProgressUpdate(amplifiedPct);
        }
      } catch (err) {
        // Safe bypass
      }
    };

    // Run initially
    calcProgress();

    // Run periodically
    const timer = setInterval(calcProgress, 300);
    return () => clearInterval(timer);
  }, [imageLoaded, interactionMode, resetTrigger, dimensions.width, dimensions.height]);

  // Handle Mouse Events fallback
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!mainCanvasRef.current) return;
    const rect = mainCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setLocalCursor(prev => ({
      x,
      y,
      isDown: prev ? prev.isDown : false
    }));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!mainCanvasRef.current) return;
    const rect = mainCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setLocalCursor({ x, y, isDown: true });
  };

  const handleMouseUp = () => {
    setLocalCursor(prev => prev ? { ...prev, isDown: false } : null);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setLocalCursor(null);
  };

  // Handle Touch Events fallback
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!mainCanvasRef.current || e.touches.length === 0) return;
    const rect = mainCanvasRef.current.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const y = e.touches[0].clientY - rect.top;
    setLocalCursor({ x, y, isDown: true });
    setIsHovered(true);
  };

  const handleTouchEnd = () => {
    setIsHovered(false);
    setLocalCursor(null);
  };

  return (
    <div className="relative w-full flex flex-col items-center">
      
      {/* Dynamic Overlay HUD */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <div className="bg-[#0f0e0c]/90 backdrop-blur-md px-4 py-2 rounded-xs border border-[#c5a059]/30 flex items-center gap-2 shadow-lg select-none">
          {interactionMode === "paint" ? (
            <>
              <Sparkles className="w-4 h-4 text-[#c5a059] animate-spin-slow" />
              <span className="text-xs font-serif text-[#f5f2ed] font-medium tracking-wide">神笔复原涂抹中</span>
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 text-[#c5a059] animate-pulse" />
              <span className="text-xs font-serif text-[#f5f2ed] font-medium tracking-wide">聚光探秘探索中</span>
            </>
          )}
        </div>
      </div>

      {/* Primary Canvas Box */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-xs border border-[#c5a059]/40 bg-[#0f0e0c] shadow-[0_12px_45px_rgba(0,0,0,0.9)]"
        style={{ touchAction: "none" }}
      >
        {!imageLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0f0e0c] text-[#e0d8cf]">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c5a059]/20 opacity-75"></span>
              <div className="w-10 h-10 border-4 border-[#c5a059]/30 border-t-[#c5a059] rounded-full animate-spin"></div>
            </div>
            <p className="text-[#b5a796] text-sm font-serif tracking-widest">
              正在展开千年古卷，加载敦煌矿物颜料...
            </p>
          </div>
        )}

        <canvas
          ref={mainCanvasRef}
          width={dimensions.width}
          height={dimensions.height}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onTouchMove={handleTouchMove}
          onTouchStart={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`block max-w-full ${activeBrush?.isAI ? "cursor-none" : "cursor-default"}`}
        />

        {/* Dynamic Holographic Silhouette following the Tracking Coordinates */}
        {activeBrush && (
          <div
            className="absolute pointer-events-none transition-transform duration-75 mix-blend-screen"
            style={{
              left: `${activeBrush.x}px`,
              top: `${activeBrush.y}px`,
              transform: "translate(-50%, -50%)",
            }}
          >
            {activeBrush.isOpen ? (
              <div className="relative flex items-center justify-center">
                {/* Radiant halo for active open hand */}
                <div className="absolute w-12 h-12 bg-[#c5a059]/30 rounded-full animate-ping"></div>
                <div className="absolute w-8 h-8 bg-[#c5a059]/45 rounded-full border border-[#c5a059]/70 blur-[1px]"></div>
                <Hand className="w-5 h-5 text-white drop-shadow-[0_0_8px_rgba(197,160,89,1.0)] rotate-12" />
                <span className="absolute top-8 bg-[#c5a059] text-[#0f0e0c] px-1 font-serif text-[7px] font-bold tracking-widest uppercase rounded-xs whitespace-nowrap shadow-md">
                  {interactionMode === "spotlight" ? "御光开灯" : "随色拂彩"}
                </span>
              </div>
            ) : (
              <div className="relative flex items-center justify-center">
                {/* Compact protective circle for closed/clenched pinch state */}
                <div className="absolute w-10 h-10 bg-[#c5a059]/10 rounded-full animate-pulse border border-orange-500/30"></div>
                <Grab className="w-5 h-5 text-[#c5a059] drop-shadow-[0_0_6px_rgba(197,160,89,0.7)]" />
                <span className="absolute top-8 bg-[#1a1815] text-[#8b7e6a] border border-[#8b7e6a]/30 px-1 font-serif text-[7px] font-bold tracking-widest uppercase rounded-xs whitespace-nowrap shadow-md">
                  {interactionMode === "spotlight" ? "捏指熄灯" : "随色拨弦"}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Screen Interactive Overlay hints */}
      {dimensions.width > 0 && (
        <div className="w-full max-w-lg mt-3 bg-[#1a1815] border border-white/5 rounded-xs p-3.5 flex items-center justify-between shadow-sm select-none">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#c5a059]"></div>
            <span className="text-xs text-[#b5a796] font-serif">
              模式：{interactionMode === "paint" ? "色彩复原（挥动以拂去黑白，还原古彩）" : "聚光探秘（手掌打开开灯照亮，隔空缩捏息火闭灯）"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[#c5a059] text-[11px] font-serif">
            <Sparkles className="w-3.5 h-3.5" />
            <span>智能 AI 隔空手势专属</span>
          </div>
        </div>
      )}
    </div>
  );
}
