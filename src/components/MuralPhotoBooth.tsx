/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Camera, 
  Download, 
  RefreshCw, 
  Upload, 
  X, 
  Sparkles, 
  Award, 
  Check, 
  ChevronLeft,
  Loader2,
  Image as ImageIcon
} from "lucide-react";
import { MuralInfo } from "../types";
import { audio } from "../utils/audio";

interface MuralPhotoBoothProps {
  mural: MuralInfo;
  isOpen: boolean;
  onClose: () => void;
}

type FrameStyle = "feitian" | "fresco-blend" | "archivist";

export default function MuralPhotoBooth({
  mural,
  isOpen,
  onClose,
}: MuralPhotoBoothProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasCameraAccess, setHasCameraAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [frameStyle, setFrameStyle] = useState<FrameStyle>("feitian");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFlashActive, setIsFlashActive] = useState<boolean>(false);
  const [mergedResult, setMergedResult] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<"vintage" | "sepia" | "normal">("vintage");

  const [keyColor, setKeyColor] = useState<{ r: number; g: number; b: number }>({ r: 200, g: 200, b: 200 });
  const [tolerance, setTolerance] = useState<number>(45);
  const [fadeRange, setFadeRange] = useState<number>(15);
  const [isKeyColorSampled, setIsKeyColorSampled] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize camera stream
  useEffect(() => {
    if (isOpen && !uploadedImage && !capturedImage) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, uploadedImage, capturedImage]);

  // Click on the live preview canvas to manually select a backdrop color to key out
  const handleLiveCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = liveCanvasRef.current;
    if (!canvas || !videoRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const clickY = ((e.clientY - rect.top) / rect.height) * canvas.height;

    // Draw the raw camera to an offscreen buffer to sample the unkeyed color
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    if (tempCtx) {
      tempCtx.translate(canvas.width, 0);
      tempCtx.scale(-1, 1);
      tempCtx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      try {
        const pixel = tempCtx.getImageData(Math.floor(clickX), Math.floor(clickY), 1, 1).data;
        setKeyColor({ r: pixel[0], g: pixel[1], b: pixel[2] });
        setIsKeyColorSampled(true);
        audio.playChimes();
      } catch (err) {
        console.warn("Could not sample color:", err);
      }
    }
  };

  // Real-time live chroma key composite loop to show person segmented onto mural
  useEffect(() => {
    let active = true;
    let animId: number;

    const muralImg = new Image();
    muralImg.crossOrigin = "anonymous";
    muralImg.src = mural.imageSrc;

    const offscreenCanvas = document.createElement("canvas");
    const offscreenCtx = offscreenCanvas.getContext("2d");

    const tick = () => {
      if (!active) return;
      
      const video = videoRef.current;
      const liveCanvas = liveCanvasRef.current;

      if (video && liveCanvas && video.readyState >= 2) {
        const ctx = liveCanvas.getContext("2d");
        if (ctx && offscreenCtx) {
          const W = video.videoWidth || 640;
          const H = video.videoHeight || 480;

          if (liveCanvas.width !== W || liveCanvas.height !== H) {
            liveCanvas.width = W;
            liveCanvas.height = H;
          }
          if (offscreenCanvas.width !== W || offscreenCanvas.height !== H) {
            offscreenCanvas.width = W;
            offscreenCanvas.height = H;
          }

          // 1. Draw Mural as background (cover)
          if (muralImg.complete) {
            const scale = Math.max(W / muralImg.width, H / muralImg.height);
            const x = (W - muralImg.width * scale) / 2;
            const y = (H - muralImg.height * scale) / 2;
            ctx.drawImage(muralImg, x, y, muralImg.width * scale, muralImg.height * scale);
          } else {
            ctx.fillStyle = "#12100e";
            ctx.fillRect(0, 0, W, H);
          }

          // 2. Draw mirrored video to offscreen canvas
          offscreenCtx.save();
          offscreenCtx.translate(W, 0);
          offscreenCtx.scale(-1, 1);
          offscreenCtx.drawImage(video, 0, 0, W, H);
          offscreenCtx.restore();

          // 3. Process pixels
          const imgData = offscreenCtx.getImageData(0, 0, W, H);
          const data = imgData.data;

          // Auto-sample background color from top-left corners if not manually set
          if (!isKeyColorSampled) {
            let sumR = 0, sumG = 0, sumB = 0, count = 0;
            for (let sy = 15; sy < 25; sy++) {
              for (let sx = 15; sx < 25; sx++) {
                const idx = (sy * W + sx) * 4;
                sumR += data[idx];
                sumG += data[idx+1];
                sumB += data[idx+2];
                count++;
              }
            }
            if (count > 0) {
              setKeyColor({
                r: Math.round(sumR / count),
                g: Math.round(sumG / count),
                b: Math.round(sumB / count)
              });
              setIsKeyColorSampled(true);
            }
          }

          const { r: kr, g: kg, b: kb } = keyColor;
          const tol = tolerance;
          const fade = fadeRange;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];

            // Color distance
            const dist = Math.sqrt((r - kr)**2 + (g - kg)**2 + (b - kb)**2);

            if (dist < tol) {
              data[i+3] = 0;
            } else if (dist < tol + fade) {
              data[i+3] = ((dist - tol) / fade) * 255;
            }
          }

          offscreenCtx.putImageData(imgData, 0, 0);

          // 4. Overlay user over the background mural
          ctx.drawImage(offscreenCanvas, 0, 0);
        }
      }

      animId = requestAnimationFrame(tick);
    };

    if (isOpen && stream && !capturedImage && !uploadedImage) {
      animId = requestAnimationFrame(tick);
    }

    return () => {
      active = false;
      cancelAnimationFrame(animId);
    };
  }, [isOpen, stream, capturedImage, uploadedImage, keyColor, tolerance, fadeRange, isKeyColorSampled, mural.imageSrc]);

  const startCamera = async () => {
    setIsLoading(true);
    setHasCameraAccess(null);
    stopCamera();

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user" 
        },
        audio: false,
      });
      setStream(mediaStream);
      setHasCameraAccess(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.warn("Camera streaming request failed or rejected:", err);
      setHasCameraAccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  // Synthesize a retro mechanical camera shutter click
  const playShutterSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      
      // Generate noise buffer
      const bufferSize = ctx.sampleRate * 0.12; 
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filterNode = ctx.createBiquadFilter();
      filterNode.type = "bandpass";
      filterNode.frequency.setValueAtTime(1000, now);
      filterNode.frequency.exponentialRampToValueAtTime(120, now + 0.1);
      filterNode.Q.setValueAtTime(3.0, now);
      
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.24, now + 0.002);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      
      noise.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      noise.start(now);
      noise.stop(now + 0.12);
    } catch (e) {
      // Audio fallback
      audio.playSwipeSound();
    }
  };

  // Handle local photo upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setUploadedImage(event.target.result as string);
        setCapturedImage(null);
        stopCamera();
        audio.playChimes();
      }
      setIsLoading(false);
    };
    reader.onerror = () => {
      setIsLoading(false);
    };
    reader.readAsDataURL(file);
  };

  // Trigger snapshot countdown
  const triggerCapture = () => {
    if (countdown !== null) return;
    audio.playSwipeSound();
    setCountdown(3);
  };

  // Countdown timer handler
  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      setCountdown(null);
      captureSnapshot();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
      audio.playGuzhengPluck(1.0 - (countdown / 3));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  // Capture snapshot from live video with background segmentation
  const captureSnapshot = () => {
    if (!videoRef.current) return;

    // Trigger flash animation and sound
    setIsFlashActive(true);
    playShutterSound();
    setTimeout(() => setIsFlashActive(false), 240);

    const W = videoRef.current.videoWidth || 640;
    const H = videoRef.current.videoHeight || 480;

    // We capture ONLY the transparent cutout user from the offscreen canvas processing!
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = W;
    tempCanvas.height = H;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    // Render the mirrored user to this canvas
    tempCtx.translate(W, 0);
    tempCtx.scale(-1, 1);
    tempCtx.drawImage(videoRef.current, 0, 0, W, H);

    // Apply color-based segmentation (chroma keying) to capture transparent user foreground
    const imgData = tempCtx.getImageData(0, 0, W, H);
    const data = imgData.data;
    const { r: kr, g: kg, b: kb } = keyColor;
    const tol = tolerance;
    const fade = fadeRange;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];

      const dist = Math.sqrt((r - kr)**2 + (g - kg)**2 + (b - kb)**2);
      if (dist < tol) {
        data[i+3] = 0;
      } else if (dist < tol + fade) {
        data[i+3] = ((dist - tol) / fade) * 255;
      }
    }
    tempCtx.putImageData(imgData, 0, 0);

    // Convert to image
    const dataUrl = tempCanvas.toDataURL("image/png");
    setCapturedImage(dataUrl);
    stopCamera();
  };

  // Reset current photo state and resume camera
  const resetPhoto = () => {
    audio.playSwipeSound();
    setCapturedImage(null);
    setUploadedImage(null);
    setMergedResult(null);
    setIsKeyColorSampled(false);
    startCamera();
  };

  // Render composite image when photos change or styles shift
  useEffect(() => {
    if (!isOpen) return;
    const sourceImg = capturedImage || uploadedImage;
    if (!sourceImg) return;

    generateMergedImage(sourceImg);
  }, [isOpen, capturedImage, uploadedImage, frameStyle, filterMode]);

  const generateMergedImage = (userImgSrc: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const canvasW = 1000;
    const canvasH = 750;
    canvas.width = canvasW;
    canvas.height = canvasH;

    // Load both images
    const userImg = new Image();
    const muralImg = new Image();
    
    muralImg.crossOrigin = "anonymous";
    let loadedCount = 0;

    const onImageLoaded = () => {
      loadedCount++;
      if (loadedCount === 2) {
        drawComposite(ctx, canvasW, canvasH, userImg, muralImg);
      }
    };

    userImg.onload = onImageLoaded;
    muralImg.onload = onImageLoaded;

    userImg.src = userImgSrc;
    muralImg.src = mural.imageSrc;
  };

  // Draw complex art composition onto the offscreen canvas
  const drawComposite = (
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    userImg: HTMLImageElement,
    muralImg: HTMLImageElement
  ) => {
    // 1. Draw solid backdrop
    ctx.fillStyle = "#12100e";
    ctx.fillRect(0, 0, W, H);

    ctx.save();

    // Draw background mural as solid backdrop first
    if (muralImg.complete) {
      const scale = Math.max(W / muralImg.width, H / muralImg.height);
      const x = (W - muralImg.width * scale) / 2;
      const y = (H - muralImg.height * scale) / 2;
      ctx.drawImage(muralImg, x, y, muralImg.width * scale, muralImg.height * scale);
    }

    // Draw transparent user image in the foreground, scaled to fit/cover nicely
    const aspect = userImg.width / userImg.height;
    let drawW = W;
    let drawH = W / aspect;
    if (drawH < H) {
      drawH = H;
      drawW = drawH * aspect;
    }
    ctx.save();
    // Directly draw user (the clean cutout) on top of the mural background
    ctx.drawImage(userImg, W / 2 - drawW / 2, H / 2 - drawH / 2, drawW, drawH);
    ctx.restore();

    // Draw an elegant fine gold frame border around the final composite
    ctx.strokeStyle = "#c5a059";
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, W - 12, H - 12);

    ctx.strokeStyle = "rgba(229, 193, 125, 0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 18, W - 36, H - 36);

    // Add clean, classy commemorative labeling at the bottom
    ctx.fillStyle = "rgba(10, 8, 6, 0.75)";
    ctx.fillRect(40, H - 110, W - 80, 80);

    ctx.strokeStyle = "#c5a059";
    ctx.lineWidth = 1;
    ctx.strokeRect(42, H - 108, W - 84, 76);

    ctx.fillStyle = "#f5f2ed";
    ctx.font = "bold 26px Georgia, serif, KaiTi";
    ctx.textAlign = "center";
    ctx.fillText(`《${mural.title}》 妙相合影`, W / 2, H - 75);

    ctx.fillStyle = "#c5a059";
    ctx.font = "14px Georgia, serif, KaiTi";
    ctx.fillText(`${mural.cave} · ${mural.dynasty}期`, W / 2, H - 48);

    // 5. Draw digital preservation small signature text bottom center
    ctx.restore();
    ctx.fillStyle = "rgba(139, 126, 106, 0.4)";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ECHOES OF DUNHUANG DIGITAL PRESERVATION TEAM · SOUVENIR RECORD", W / 2, H - 20);

    // Save output
    try {
      const dataUrl = ctx.canvas.toDataURL("image/jpeg", 0.9);
      setMergedResult(dataUrl);
    } catch (e) {
      console.warn("Canvas export failed:", e);
    }
  };

  // Canvas filter implementation helper (Vintage/Sepia/Normal)
  const applyCanvasFilter = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ) => {
    if (filterMode === "normal") return;

    try {
      const imgData = ctx.getImageData(x, y, w, h);
      const data = imgData.data;
      const len = data.length;

      for (let i = 0; i < len; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        if (filterMode === "sepia") {
          // Classic Sepia formulas
          data[i] = r * 0.393 + g * 0.769 + b * 0.189;
          data[i + 1] = r * 0.349 + g * 0.686 + b * 0.168;
          data[i + 2] = r * 0.272 + g * 0.534 + b * 0.131;
        } else if (filterMode === "vintage") {
          // Warm vintage filter with enhanced contrast
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          data[i] = Math.min(255, gray * 1.15 + 15);
          data[i + 1] = Math.min(255, gray * 0.98 + 10);
          data[i + 2] = Math.min(255, gray * 0.78);
        }
      }
      ctx.putImageData(imgData, x, y);
    } catch (_) {
      // Safe fallback if raw imageData is restricted due to CORS
    }
  };

  // Draws a highly intricate Chinese cinnabar seal stamp style on the canvas
  const drawRedSeal = (ctx: CanvasRenderingContext2D, px: number, py: number) => {
    ctx.save();
    
    const size = 90;
    // Cinnabar vermilion red pigment
    ctx.strokeStyle = "rgba(179, 50, 42, 0.9)";
    ctx.fillStyle = "rgba(179, 50, 42, 0.9)";
    ctx.lineWidth = 4;
    
    // Outer wax border
    ctx.strokeRect(px, py, size, size);
    
    // Inner thin border
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 4, py + 4, size - 8, size - 8);

    // Calligraphy square letter cuts inside stamp box "敦煌守护" (Dunhuang Guardian)
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.font = "bold 31px KaiTi, STKaiti, serif";
    
    ctx.fillText("敦", px + size*0.74, py + size*0.27);
    ctx.fillText("煌", px + size*0.74, py + size*0.72);
    ctx.fillText("守", px + size*0.26, py + size*0.27);
    ctx.fillText("护", px + size*0.26, py + size*0.72);

    ctx.restore();
  };

  const handleDownload = () => {
    if (!mergedResult) return;
    audio.playTempleBell();
    
    const link = document.createElement("a");
    link.href = mergedResult;
    link.download = `Dunhuang_${mural.id}_Souvenir.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  const currentSelectionImage = capturedImage || uploadedImage;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0907]/95 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="relative w-full max-w-5xl bg-[#14120f] border border-[#c5a059]/30 rounded-sm p-4 sm:p-6 md:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.9)] max-h-[96vh] flex flex-col justify-between overflow-y-auto scrollbar-thin overflow-x-hidden"
      >
        {/* Fine gold ornament borders */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-[#c5a059]/30"></div>
        <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-[#c5a059]/30"></div>
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-[#c5a059]/30"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-[#c5a059]/30"></div>

        {/* Shutter Flash effect */}
        <AnimatePresence>
          {isFlashActive && (
            <motion.div
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="absolute inset-0 bg-white z-50 pointer-events-none"
            />
          )}
        </AnimatePresence>

        {/* Headline Header */}
        <div className="flex items-center justify-between border-b border-[#c5a059]/15 pb-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="text-[#8b7e6a] hover:text-[#f5f2ed] p-1 bg-[#1c1a16] border border-white/5 rounded-xs transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#c5a059] animate-pulse" />
                <span className="text-[10px] sm:text-xs font-serif text-[#c5a059] tracking-widest uppercase">妙相留念 · 敦煌影境</span>
              </div>
              <h2 className="text-base sm:text-lg text-[#f5f2ed] font-serif font-semibold tracking-wider">与《{mural.title}》合影留念</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8b7e6a] hover:text-[#f5f2ed] p-1.5 hover:bg-[#1a1815] rounded-full border border-white/5 transition-all cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Central interactive body segment */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1 min-h-0">
          
          {/* Left panel: Photo area / Camera stream */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="relative aspect-[4/3] w-full bg-[#0a0907] border border-[#c5a059]/20 rounded-xs overflow-hidden flex items-center justify-center shadow-inner">
              
              {/* Golden corner visual hints */}
              <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-[#c5a059]/40 z-10 pointer-events-none" />
              <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-[#c5a059]/40 z-10 pointer-events-none" />
              <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-[#c5a059]/40 z-10 pointer-events-none" />
              <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-[#c5a059]/40 z-10 pointer-events-none" />

              {!currentSelectionImage ? (
                <>
                  {/* Live Camera preview or Request fallback information */}
                  {hasCameraAccess === false ? (
                    <div className="text-center p-6 space-y-4 max-w-sm">
                      <ImageIcon className="w-12 h-12 text-[#8b7e6a]/40 mx-auto" />
                      <p className="text-xs text-[#8b7e6a] leading-relaxed">
                        未能获取相机权限（或在沙箱框架下被限制）。不用担心，您可以通过上传照片完美生成合影！
                      </p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#c5a059]/10 border border-[#c5a059]/45 text-[#c5a059] text-xs font-serif rounded-xs hover:bg-[#c5a059]/20 transition-colors cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>上传本地人像</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      {isLoading ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="w-8 h-8 text-[#c5a059] animate-spin" />
                          <span className="text-[11px] text-[#8b7e6a] font-serif">正在调度莫高古镜...</span>
                        </div>
                      ) : (
                        <div className="relative w-full h-full">
                          {/* Live Video element (hidden, processed by canvas) */}
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="hidden"
                          />

                          {/* Live Composite Canvas for Real-Time Background Removal and Preview */}
                          <canvas
                            ref={liveCanvasRef}
                            onClick={handleLiveCanvasClick}
                            className="w-full h-full object-cover cursor-crosshair"
                            title="点击画面任意位置可吸取背景颜色以精准校准抠像"
                          />
                          
                          {/* Central grid helper */}
                          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                            <div className="border-b border-r border-white/5"></div>
                            <div className="border-b border-r border-white/5"></div>
                            <div className="border-b border-white/5"></div>
                            <div className="border-b border-r border-white/5"></div>
                            <div className="border-b border-r border-[#c5a059]/15 relative">
                              {/* Oval face guide */}
                              <div className="absolute inset-x-6 inset-y-4 border border-dashed border-[#c5a059]/35 rounded-full animate-pulse" />
                            </div>
                            <div className="border-b border-white/5"></div>
                            <div className="border-r border-white/5"></div>
                            <div className="border-r border-white/5"></div>
                          </div>

                          <div className="absolute bottom-3 left-3 bg-[#0a0907]/90 py-1.5 px-3 rounded-xs text-[10px] text-[#c5a059] font-serif border border-[#c5a059]/20 flex items-center gap-1.5 shadow-md">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                            <span>● 莫高古镜：实时抠出人像，点击背景精准校色</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                /* Static Captured/Uploaded Picture frame */
                <div className="relative w-full h-full flex items-center justify-center">
                  <img
                    src={currentSelectionImage}
                    alt="人像捕获"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-4 left-4 bg-teal-500/90 text-white font-serif px-2.5 py-1 text-[11px] font-bold rounded-xs flex items-center gap-1.5 shadow-md">
                    <Check className="w-3.5 h-3.5" />
                    <span>像片就绪</span>
                  </div>
                </div>
              )}

              {/* Shutter Countdown overlay */}
              <AnimatePresence>
                {countdown !== null && (
                  <motion.div
                    initial={{ scale: 1.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none"
                  >
                    <div className="text-center">
                      <div className="text-6xl sm:text-7xl font-bold font-serif text-[#c5a059] dynamic-pulsate drop-shadow-lg">
                        {countdown}
                      </div>
                      <p className="text-[12px] text-stone-400 font-serif tracking-widest mt-2">妙音绕耳，静息对焦中...</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Quick captures control drawer */}
            <div className="flex gap-2.5">
              {!currentSelectionImage ? (
                <>
                  <button
                    onClick={triggerCapture}
                    disabled={hasCameraAccess === false || countdown !== null || isLoading}
                    className="flex-1 py-3 text-xs font-serif font-bold tracking-widest bg-gradient-to-r from-[#c5a059] to-[#bf974b] text-[#0f0e0c] rounded-xs shadow-[0_4px_16px_rgba(197,160,89,0.25)] hover:shadow-[0_6px_22px_rgba(197,160,89,0.38)] hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Camera className="w-4 h-4" />
                    <span>📸 捕获本相 (倒计时 3s)</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={countdown !== null}
                    className="px-5 bg-[#1a1815] border border-white/10 text-[#8b7e6a] text-xs font-serif rounded-xs hover:border-[#c5a059]/40 hover:text-[#f5f2ed] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    title="从设备中选取一张照片进行背景融合"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>上传像片</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={resetPhoto}
                  className="w-full py-2.5 bg-[#161411] border border-[#c5a059]/30 text-[#c5a059] hover:bg-[#c5a059]/10 text-xs font-serif rounded-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>重开古镜 / 重新拍摄或上传</span>
                </button>
              )}

              {/* Hidden file selector trigger */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Right panel: Live composite output download / style selection */}
          <div className="lg:col-span-5 flex flex-col gap-5 bg-[#0f0e0c] p-4 border border-white/5 rounded-xs">
            
            {/* Chroma Key settings */}
            {!currentSelectionImage && hasCameraAccess !== false && (
              <div className="space-y-3 bg-[#161411] p-4 rounded-xs border border-[#c5a059]/10">
                <div className="flex items-center justify-between border-b border-[#c5a059]/15 pb-2">
                  <span className="text-xs font-serif text-[#c5a059] tracking-wider uppercase">1. 实时抠像边缘微调</span>
                  <button
                    onClick={() => {
                      setIsKeyColorSampled(false);
                      audio.playSwipeSound();
                    }}
                    className="text-[9px] px-2 py-0.5 bg-[#0f0e0c] border border-white/10 text-[#c5a059] rounded-xs hover:bg-[#c5a059]/10 transition-colors"
                  >
                    重置背景采样
                  </button>
                </div>
                <div className="space-y-3 pt-1">
                  <div>
                    <div className="flex justify-between text-[10px] text-stone-400 font-sans mb-1">
                      <span>抠像容差 (Tolerance)</span>
                      <span>{tolerance}</span>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="110"
                      value={tolerance}
                      onChange={(e) => setTolerance(parseInt(e.target.value))}
                      className="w-full accent-[#c5a059] h-1 bg-stone-800 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-stone-400 font-sans mb-1">
                      <span>边缘羽化 (Feathering)</span>
                      <span>{fadeRange}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="40"
                      value={fadeRange}
                      onChange={(e) => setFadeRange(parseInt(e.target.value))}
                      className="w-full accent-[#c5a059] h-1 bg-stone-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Realtime compilation block */}
            <h3 className="text-xs font-serif text-[#c5a059] tracking-widest uppercase pt-1 pb-2 border-b border-white/5">2. 留影神相一览</h3>
            <div className="relative aspect-[4/3] w-full bg-[#1c1a16] border border-dashed border-white/10 rounded-xs overflow-hidden flex items-center justify-center">
              {mergedResult ? (
                <img
                  src={mergedResult}
                  alt="合影预览"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-4 space-y-2">
                  <ImageIcon className="w-10 h-10 text-stone-600 mx-auto" />
                  <p className="text-[10px] text-[#8b7e6a] max-w-[200px] leading-relaxed mx-auto">
                    请在左侧拍摄或上传您的人相，系统将自动和壁画及红色印泥合印生成 Commemorative Card。
                  </p>
                </div>
              )}
            </div>

            {/* Action Download segment */}
            {mergedResult ? (
              <button
                onClick={handleDownload}
                className="w-full py-3.5 bg-gradient-to-r from-red-700 to-red-800 hover:from-red-600 hover:to-red-700 text-white font-serif font-bold text-xs tracking-widest rounded-xs shadow-[0_6px_20px_rgba(179,50,42,0.35)] flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-all cursor-pointer animate-pulse"
              >
                <Download className="w-4 h-4" />
                <span>下载敦煌留念信卡 (JPG High Definition)</span>
              </button>
            ) : (
              <div className="w-full py-3 text-center text-[10px] text-stone-600 font-serif border border-white/5 bg-[#161411] rounded-xs select-none">
                📸 在左侧捕获或上传人像，即可合成下载数字示范留影卡
              </div>
            )}
          </div>

        </div>

        {/* Secret hidden rendering pipeline */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Informative text footer */}
        <div className="mt-5 pt-3 border-t border-white/10 text-center text-[9px] sm:text-[10px] text-[#8b7e6a]/60 select-none font-serif">
          国家资产数字化临摹示范平台支持 · 莫高窟数字化保护小组监制
        </div>
      </motion.div>
    </div>
  );
}
