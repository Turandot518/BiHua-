/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { HandData } from "../types";
import { audio } from "../utils/audio";
import { motion, AnimatePresence } from "motion/react";
import { Hand, RefreshCcw, Compass, ArrowRight, Grid, Grab, Sparkles, CheckCircle, Flame } from "lucide-react";

interface MuralJigsawProps {
  imageSrc: string;
  muralTitle: string;
  dynasty: string;
  cave: string;
  handData: HandData | null;
  onComplete: () => void;
  resetTrigger: number;
}

interface JigsawPiece {
  id: number;
  col: number;
  row: number;
  // target coordinates relative to the target board inside the canvas
  relativeTargetX: number;
  relativeTargetY: number;
  // current coordinates relative to the workspace container
  x: number;
  y: number;
  width: number;
  height: number;
  isSnapped: boolean;
}

export default function MuralJigsaw({
  imageSrc,
  muralTitle,
  dynasty,
  cave,
  handData,
  onComplete,
  resetTrigger
}: MuralJigsawProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // Game dimensions & layout state
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [boardDimensions, setBoardDimensions] = useState({ width: 480, height: 300, x: 160, y: 100 });
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [pieces, setPieces] = useState<JigsawPiece[]>([]);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [completedTimer, setCompletedTimer] = useState<boolean>(false);

  // Maintain a reference to pieces to decouple high-frequency coordinate tracking from the state change trigger
  const piecesRef = useRef<JigsawPiece[]>([]);
  useEffect(() => {
    piecesRef.current = pieces;
  }, [pieces]);
  
  // Dragging states
  // 1. Mouse/pointer drag
  const [pointerGrabbedId, setPointerGrabbedId] = useState<number | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  
  // 2. Camera grab (for camera gesture interaction)
  const [cameraGrabbedId, setCameraGrabbedId] = useState<number | null>(null);
  const cameraGrabbedIdRef = useRef<number | null>(null);
  const cameraGrabOffsetRef = useRef({ x: 0, y: 0 });
  const lastHandOpenRef = useRef<boolean>(true); // tracking hand state transition

  // Cursor coordinates for rendering custom hand feedback in the workspace
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number; isAI: boolean; isOpen: boolean } | null>(null);

  // Parse image source URL
  const imgUrl = React.useMemo(() => {
    if (typeof imageSrc === "string") return imageSrc;
    if (imageSrc && typeof imageSrc === "object") {
      return (imageSrc as any).default || (imageSrc as any).src || "";
    }
    return "";
  }, [imageSrc]);

  // Load image to cache sizing ratios
  useEffect(() => {
    setImageLoaded(false);
    setIsCompleted(false);
    setCompletedTimer(false);
    
    if (!imgUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImageLoaded(true);
    };
    img.onerror = () => {
      // Fallback loaded
      setImageLoaded(true);
    };
    img.src = imgUrl;
  }, [imgUrl, resetTrigger]);

  // Handle workspace size resizing using a ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width } = entries[0].contentRect;
      
      const roundedW = Math.round(Math.max(width, 400));
      // Adaptive height preserving golden display proportions
      const roundedH = Math.round(Math.min(roundedW * 0.618, window.innerHeight * 0.58));
      
      setDimensions((current) => {
        if (Math.abs(current.width - roundedW) > 16 || Math.abs(current.height - roundedH) > 16) {
          return { width: roundedW, height: roundedH };
        }
        return current;
      });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute sub-layout grid parameters based on current dimensions
  useEffect(() => {
    if (!imageLoaded || dimensions.width <= 0 || dimensions.height <= 0) return;

    // 1. Position the target board centrally (takes up ~60% of the workspace width)
    const boardW = Math.round(dimensions.width * 0.58);
    const boardH = Math.round(boardW * 0.625); // match aspect ratio
    const boardX = Math.round((dimensions.width - boardW) / 2);
    const boardY = Math.round((dimensions.height - boardH) / 2);

    setBoardDimensions({ width: boardW, height: boardH, x: boardX, y: boardY });

    // 2. Initialize pieces grid: cols = 3, rows = 2 (6 premium modular fragments)
    const cols = 3;
    const rows = 2;
    const pw = Math.round(boardW / cols);
    const ph = Math.round(boardH / rows);

    const initPieces: JigsawPiece[] = [];
    let id = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const relativeTargetX = c * pw;
        const relativeTargetY = r * ph;

        // Scramble locations into left and right side reservoirs inside the viewport to leave the center board vacant
        const isOnLeft = id % 2 === 0;
        
        // Define safe random coordinates on the left or right side reservoirs
        let randX = 0;
        if (isOnLeft) {
          // Left zone margin
          const maxX = Math.max(10, boardX - pw - 10);
          randX = 10 + Math.random() * (maxX - 10);
        } else {
          // Right zone margin
          const minX = boardX + boardW + 10;
          const maxX = Math.max(minX + 10, dimensions.width - pw - 10);
          randX = minX + Math.random() * (maxX - minX);
        }
        
        // Random Y coordinates with slight padding constraints
        const randY = 15 + Math.random() * (dimensions.height - ph - 30);

        initPieces.push({
          id,
          col: c,
          row: r,
          relativeTargetX,
          relativeTargetY,
          x: Math.round(randX),
          y: Math.round(randY),
          width: pw,
          height: ph,
          isSnapped: false
        });
        id++;
      }
    }

    setPieces(initPieces);
    setPointerGrabbedId(null);
    setCameraGrabbedId(null);
    setIsCompleted(false);
    setCompletedTimer(false);
  }, [imageLoaded, dimensions.width, dimensions.height, resetTrigger]);

  // Synchronous Web Camera hand tracking loop mapping coordinates onto our Jigsaw workspace
  useEffect(() => {
    if (!handData || isCompleted) {
      // Clear AI cursor
      if (cursorPos?.isAI) {
        setCursorPos(null);
      }
      // Safely release and snap current piece if hand leaves
      if (cameraGrabbedIdRef.current !== null) {
        checkPieceSnap(cameraGrabbedIdRef.current);
        cameraGrabbedIdRef.current = null;
        setCameraGrabbedId(null);
      }
      return;
    }

    // Map handData normalized [0..1] coordinates into the puzzle workspace area
    const cx = Math.round(handData.x * dimensions.width);
    const cy = Math.round(handData.y * dimensions.height);
    const isHandOpen = handData.isOpen;

    setCursorPos({
      x: cx,
      y: cy,
      isAI: true,
      isOpen: isHandOpen
    });

    if (isHandOpen) {
      // Hand is open: if we were holding a piece, drop it with snapping
      if (cameraGrabbedIdRef.current !== null) {
        checkPieceSnap(cameraGrabbedIdRef.current);
        cameraGrabbedIdRef.current = null;
        setCameraGrabbedId(null);
      }
    } else {
      // Hand is closed / pinching
      if (cameraGrabbedIdRef.current === null) {
        // Find closest unsnapped piece within pinching grasp distance
        let clickedPiece: JigsawPiece | null = null;
        let bestDist = 120; // grab radius threshold

        for (const p of piecesRef.current) {
          if (p.isSnapped) continue;
          const pcx = p.x + p.width / 2;
          const pcy = p.y + p.height / 2;
          const dx = cx - pcx;
          const dy = cy - pcy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Check if hand is within or very close to the piece bounds
          const insideX = cx >= p.x - 20 && cx <= p.x + p.width + 20;
          const insideY = cy >= p.y - 20 && cy <= p.y + p.height + 20;

          if ((insideX && insideY) || dist < bestDist) {
            clickedPiece = p;
            bestDist = dist;
          }
        }

        if (clickedPiece) {
          cameraGrabbedIdRef.current = clickedPiece.id;
          setCameraGrabbedId(clickedPiece.id);
          cameraGrabOffsetRef.current = {
            x: cx - clickedPiece.x,
            y: cy - clickedPiece.y
          };
          // Play gentle Guzheng pluck trigger for tactile confirmation
          audio.playGuzhengPluck(0.3 + Math.random() * 0.4);
        }
      } else {
        // Active dragging
        const activeId = cameraGrabbedIdRef.current;
        setPieces((prev) =>
          prev.map((p) => {
            if (p.id !== activeId) return p;

            // Compute raw dragged coordinate
            let nx = cx - cameraGrabOffsetRef.current.x;
            let ny = cy - cameraGrabOffsetRef.current.y;

            // Constrain coordinates so that pieces don't slip completely outside the container
            nx = Math.max(-10, Math.min(nx, dimensions.width - p.width + 10));
            ny = Math.max(-10, Math.min(ny, dimensions.height - p.height + 10));

            return { ...p, x: nx, y: ny };
          })
        );
      }
    }

  }, [handData, dimensions, isCompleted]);

  // Handle pointer/mouse events fallbacks (allows hybrid play for multiple environments)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, piece: JigsawPiece) => {
    if (piece.isSnapped || isCompleted) return;

    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const lx = Math.round(e.clientX - rect.left);
    const ly = Math.round(e.clientY - rect.top);

    setPointerGrabbedId(piece.id);
    dragOffsetRef.current = {
      x: lx - piece.x,
      y: ly - piece.y
    };

    setCursorPos({
      x: lx,
      y: ly,
      isAI: false,
      isOpen: false
    });

    audio.playGuzhengPluck(0.4 + Math.random() * 0.3);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isCompleted) return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const lx = Math.round(e.clientX - rect.left);
    const ly = Math.round(e.clientY - rect.top);

    // Update cursor feedback (regular hover vs drag)
    setCursorPos({
      x: lx,
      y: ly,
      isAI: false,
      isOpen: pointerGrabbedId === null
    });

    if (pointerGrabbedId === null) return;

    setPieces((prev) =>
      prev.map((p) => {
        if (p.id !== pointerGrabbedId) return p;

        let nx = lx - dragOffsetRef.current.x;
        let ny = ly - dragOffsetRef.current.y;

        // Constraint screen safety margins
        nx = Math.max(-10, Math.min(nx, dimensions.width - p.width + 10));
        ny = Math.max(-10, Math.min(ny, dimensions.height - p.height + 10));

        return { ...p, x: nx, y: ny };
      })
    );
  };

  const handlePointerUp = () => {
    if (pointerGrabbedId !== null) {
      checkPieceSnap(pointerGrabbedId);
      setPointerGrabbedId(null);
    }
  };

  // Perform absolute positional magnetic validation
  const checkPieceSnap = (id: number) => {
    setPieces((prev) => {
      let snappedSome = false;
      const updated = prev.map((p) => {
        if (p.id !== id || p.isSnapped) return p;

        // Calculate absolute target position in workspace
        const absTargetX = boardDimensions.x + p.relativeTargetX;
        const absTargetY = boardDimensions.y + p.relativeTargetY;

        const distance = Math.sqrt(
          Math.pow(p.x - absTargetX, 2) + Math.pow(p.y - absTargetY, 2)
        );

        // Snap tolerance: if within 36 pixels, snap cleanly!
        const snapTolerance = 36;
        if (distance <= snapTolerance) {
          snappedSome = true;
          return {
            ...p,
            x: absTargetX,
            y: absTargetY,
            isSnapped: true
          };
        }
        return p;
      });

      if (snappedSome) {
        // Play holy tone when snapped successfully
        audio.playGuzhengPluck(0.9);
      }

      return updated;
    });
  };

  // Puzzle success checker
  useEffect(() => {
    if (pieces.length === 0 || isCompleted) return;

    const allSnapped = pieces.every((p) => p.isSnapped);
    if (allSnapped) {
      setIsCompleted(true);
      // Play glorious temple bell chimes for ultimate triumph celebration!
      audio.playTempleBell();
      
      // Auto trigger completed modal feedback after 600ms
      const finishTimer = setTimeout(() => {
        onComplete();
      }, 600);

      return () => clearTimeout(finishTimer);
    }
  }, [pieces, isCompleted, onComplete]);

  // Restart puzzle
  const handleShuffleAgain = () => {
    audio.playSwipeSound();
    setIsCompleted(false);
    setCompletedTimer(false);
    
    const cols = 3;
    const rows = 2;
    const pw = boardDimensions.width / cols;
    const ph = boardDimensions.height / rows;

    setPieces((prev) =>
      prev.map((p, idx) => {
        const isOnLeft = idx % 2 === 0;
        let randX = 0;
        if (isOnLeft) {
          const maxX = Math.max(10, boardDimensions.x - pw - 10);
          randX = 10 + Math.random() * (maxX - 10);
        } else {
          const minX = boardDimensions.x + boardDimensions.width + 10;
          const maxX = Math.max(minX + 10, dimensions.width - pw - 10);
          randX = minX + Math.random() * (maxX - minX);
        }
        const randY = 15 + Math.random() * (dimensions.height - ph - 30);

        return {
          ...p,
          x: Math.round(randX),
          y: Math.round(randY),
          isSnapped: false
        };
      })
    );
  };

  return (
    <div className="flex flex-col items-center w-full" id="mural-jigsaw-game">
      {/* Dynamic Header details */}
      <div className="w-full flex items-center justify-between mb-3 px-1 select-none">
        <div>
          <div className="flex items-center gap-1.5 text-[#c5a059] text-xs">
            <span className="animate-pulse bg-[#c5a059] w-1.5 h-1.5 rounded-full" />
            <span className="font-serif tracking-widest">{dynasty} · {cave}</span>
          </div>
          <h3 className="text-[#f5f2ed] font-serif text-lg tracking-widest font-normal mt-0.5">
            古壁拼图拼合：{muralTitle}
          </h3>
        </div>

        <button
          onClick={handleShuffleAgain}
          className="px-3 py-1.5 bg-[#1a1815] hover:bg-[#c5a059]/10 text-stone-300 hover:text-[#c5a059] border border-white/5 hover:border-[#c5a059]/40 text-[10px] rounded-xs flex items-center gap-1.5 transition-all cursor-pointer font-serif"
        >
          <RefreshCcw className="w-3 h-3" />
          <span>重新洗牌打碎</span>
        </button>
      </div>

      {/* The main workspace boundary */}
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="w-full relative overflow-hidden bg-[#0a0908] border border-white/10 rounded-sm cursor-none select-none shadow-[inset_0_4px_24px_rgba(0,0,0,0.9)]"
        style={{ height: `${dimensions.height}px` }}
      >
        {/* Organic silk canvas scroll backing */}
        <div className="absolute inset-0 bg-[#0c0a09] opacity-[0.97] pointer-events-none"></div>
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#c5a059]/30 to-transparent"></div>
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-[#c5a059]/30 to-transparent"></div>

        {/* Real-time Instructions and cues */}
        <div className="absolute inset-x-12 top-4 flex items-center justify-between pointer-events-none z-10 select-none opacity-80">
          <span className="text-[10px] text-[#8b7e6a] font-serif tracking-widest">
            {handData ? "👉 AI 摄相机已接通：握拳/双指捏合拖动，张开释下" : "👉 鼠标互动开启：按住拖拽碎片"}
          </span>
          <span className="text-[10px] text-[#c5a059] font-serif tracking-widest">
            拼合度: {Math.round((pieces.filter(p=>p.isSnapped).length / pieces.length)*100)}%
          </span>
        </div>

        {/* 1. CENTRAL TARGET BOARD ASSEMBLY AREA */}
        <div
          className="absolute border border-[#c5a059]/25 bg-[#12100e] overflow-hidden flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.85)]"
          style={{
            width: `${boardDimensions.width}px`,
            height: `${boardDimensions.height}px`,
            left: `${boardDimensions.x}px`,
            top: `${boardDimensions.y}px`
          }}
        >
          {/* Subtle grid separator lines underneath */}
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 pointer-events-none opacity-[0.14] z-10">
            <div className="border-r border-b border-[#c5a059]"></div>
            <div className="border-r border-b border-[#c5a059]"></div>
            <div className="border-b border-[#c5a059]"></div>
            <div className="border-r border-[#c5a059]"></div>
            <div className="border-r border-[#c5a059]"></div>
            <div></div>
          </div>

          {/* Dim Monochrome background image acting as a trace guide */}
          {imgUrl && (
            <div
              className="absolute inset-0 grayscale contrast-[0.8] opacity-[0.18] pointer-events-none"
              style={{
                backgroundImage: `url(${imgUrl})`,
                backgroundSize: "cover"
              }}
            />
          )}

          {/* Guide vector outline sketch fallback if no background image */}
          {!imgUrl && (
            <div className="text-[#8b7e6a]/40 font-serif text-[10px] tracking-widest text-center select-none leading-relaxed p-4">
              ✨ 佛陀法相 · 拼合基座 ✨
            </div>
          )}

          {/* Golden outline details */}
          <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-[#c5a059]/20"></div>
          
          {/* Hint outline label in empty target zones */}
          {pieces.filter(p => !p.isSnapped).length > 2 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
              <Compass className="w-8 h-8 text-[#c5a059]/15 animate-spin-slow" />
              <span className="text-[9px] text-[#8b7e6a]/40 uppercase tracking-[0.2em] font-serif font-light mt-1.5">
                Target Assembly Zone
              </span>
            </div>
          )}
        </div>

        {/* 2. RENDER THE SCATTERED OR ASSEMBLED MURAL JIGSAW FRAGMENTS */}
        {pieces.map((piece) => {
          // CSS background clipping offset calculations
          const bgX = (piece.col / 3) * 100;
          const bgY = (piece.row / 2) * 100;

          // Drag status checks
          const isBeingDragged = pointerGrabbedId === piece.id || cameraGrabbedId === piece.id;

          return (
            <div
              key={piece.id}
              onPointerDown={(e) => handlePointerDown(e, piece)}
              className={`absolute overflow-hidden transition-shadow ${
                piece.isSnapped 
                  ? "border border-white/5 cursor-default z-0 pointer-events-none" 
                  : isBeingDragged
                    ? "border-2 border-[#c5a059] shadow-[0_12px_28px_rgba(197,160,89,0.55)] scale-[1.03] rotate-[0.5deg] cursor-grabbing z-40" 
                    : "border border-[#c5a059]/40 hover:border-[#c5a059] shadow-md hover:shadow-lg active:scale-95 cursor-grab z-20"
              }`}
              style={{
                width: `${piece.width}px`,
                height: `${piece.height}px`,
                left: `${piece.x}px`,
                top: `${piece.y}px`,
                // Fast GPU 3D rendering for smooth translation during high-frequency camera-drag ticks
                willChange: "transform, left, top"
              }}
            >
              {/* Mural Image clip matching layout proportions */}
              {imgUrl ? (
                <div
                  className="w-full h-full pointer-events-none select-none transition-filter duration-300"
                  style={{
                    backgroundImage: `url(${imgUrl})`,
                    backgroundSize: `${boardDimensions.width}px ${boardDimensions.height}px`,
                    backgroundPosition: `-${piece.col * piece.width}px -${piece.row * piece.height}px`,
                    backgroundRepeat: "no-repeat"
                  }}
                />
              ) : (
                // Safe gradient-filled placeholder block styled like medieval tile in case of image failure
                <div className="w-full h-full bg-gradient-to-br from-[#2a1a15] to-[#120a08] flex items-center justify-center p-3 text-center border-t border-l border-white/10">
                  <div className="font-serif text-[10px] text-[#c5a059] font-bold select-none">
                    <div>古卷真篇</div>
                    <div className="opacity-50 text-[8px] mt-0.5">#{piece.id + 1}</div>
                  </div>
                </div>
              )}

              {/* Distressed cracked styling overlays on border for high-end archeological ceramic texture */}
              {!piece.isSnapped && (
                <div className="absolute inset-0 pointer-events-none border border-white/15 mix-blend-overlay"></div>
              )}

              {/* Snap indicator sparkle flash */}
              {piece.isSnapped && (
                <motion.div
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 1 }}
                  className="absolute inset-0 bg-[#c5a059]/25 pointer-events-none flex items-center justify-center"
                >
                  <Sparkles className="w-6 h-6 text-white animate-pulse" />
                </motion.div>
              )}
            </div>
          );
        })}

        {/* 3. GLORIOUS CONGRATULATIONS CELEBRATION MODAL OVERLAY (Handoff to unified App StoryPopup) */}

        {/* 4. REAL-TIME HIGH-FIDELITY GESTURE CURSOR INDICATOR */}
        {cursorPos && (
          <div
            className="absolute pointer-events-none z-50 transition-all duration-[75ms] ease"
            style={{
              left: `${cursorPos.x}px`,
              top: `${cursorPos.y}px`,
              transform: "translate(-50%, -50%)"
            }}
          >
            {/* Gesture-based posture selector */}
            {!cursorPos.isOpen ? (
              // PINCHED / CLOSE CLAW - Grab status representation
              <div className="relative flex items-center justify-center">
                {/* Glowing grasping pulses */}
                <div className="absolute w-10 h-10 rounded-full bg-[#c5a059]/30 border-2 border-[#c5a059] animate-ping" />
                <div className="absolute w-8 h-8 rounded-full bg-[#c5a059]/40 border border-[#c5a059]/70 animate-pulse" />
                
                {/* Clenched custom hand vector icon */}
                <Grab className="w-5 h-5 text-white drop-shadow-[0_0_8px_rgba(197,160,89,1.0)] animate-pulse" />
                
                <span className="absolute top-6 bg-[#c5a059] text-[#0f0e0c] px-1 font-serif text-[7px] font-bold tracking-widest uppercase rounded-xs whitespace-nowrap shadow-md">
                  抓取拖移
                </span>
              </div>
            ) : (
              // OPEN HAND - Hover state representation
              <div className="relative flex items-center justify-center">
                {/* Glowing hovering waves */}
                <div className="absolute w-12 h-12 rounded-full bg-[#c5a059]/15 animate-pulse" />
                
                {/* Open hand custom vector icon */}
                <Hand className="w-5 h-5 text-[#c5a059] drop-shadow-[0_0_6px_rgba(197,160,89,0.7)]" />
                
                <span className="absolute top-6 bg-[#1a1815] text-[#c5a059] border border-[#c5a059]/30 px-1 font-serif text-[7px] font-bold tracking-widest uppercase rounded-xs whitespace-nowrap shadow-md">
                  隔空漂浮
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Guide controls under the wrapper */}
      <div className="w-full mt-3 bg-[#11100e] border border-white/5 rounded-xs p-3 flex flex-col sm:flex-row items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#c5a059]/10 flex items-center justify-center border border-[#c5a059]/20 text-[#c5a059]">
            <Grid className="w-3.5 h-3.5" />
          </div>
          <p className="text-[#8b7e6a] text-[10px] font-serif leading-relaxed">
            <b>玩法提示：</b> 将两旁散落的古卷拼图碎片向中央暗色虚线插槽推入。拼至正确位置时，会自动磁力归位并牢固锁定。
          </p>
        </div>

        {/* Simple interactive shortcuts */}
        <div className="flex items-center gap-2.5">
          <div className="text-[10px] text-[#c5a059] font-serif font-semibold tracking-wider">
            {pieces.filter(p => p.isSnapped).length} / {pieces.length} 已拼好
          </div>
        </div>
      </div>
    </div>
  );
}
