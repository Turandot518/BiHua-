/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from "react";
import { createPortal } from "react-dom";
import { HandData } from "../types";
import { Camera, Video, ShieldAlert, CheckCircle, Sparkles, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface MediaPipeGestureTrackerProps {
  onHandUpdate: (hand: HandData | null) => void;
  isActive: boolean;
  portalTarget?: HTMLElement | null;
}

let sharedHandsInstance: any = null;

// Error Boundary to gracefully catch any MediaPipe or WebGL initialization failures
class GestureTrackerErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  public state = {
    hasError: false,
    error: null as Error | null,
  };

  public static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[MediaPipe Cust ErrorBoundary] Caught model startup exception:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center bg-[#1a1815] p-5 rounded-xs border border-red-900/40 backdrop-blur-md shadow-lg w-full text-center select-none font-serif">
          <div className="w-10 h-10 rounded-full bg-red-950/20 border border-red-800/30 flex items-center justify-center mb-3">
            <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />
          </div>
          <span className="text-red-400 text-xs font-semibold tracking-wider block mb-1">手势交互计算加载受限</span>
          <p className="text-[10px] text-[#8b7e6a] leading-relaxed max-w-[210px] my-2">
            AI 摄像头手势交互加载遇到异常（可能是设备 CPU 负载过高或 WebGL 绘图上下文冲突）。您可以继续使用鼠标滑动/控制。
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-1 px-3 py-1 bg-red-900/20 hover:bg-red-900/30 border border-red-800/40 text-red-400 text-[10px] font-bold rounded-xs transition-colors cursor-pointer shadow-md shadow-black"
          >
            再次尝试加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function MediaPipeGestureTrackerInner({
  onHandUpdate,
  isActive,
  portalTarget = null
}: MediaPipeGestureTrackerProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [running, setRunning] = useState<boolean>(false);
  const [retryTrigger, setRetryTrigger] = useState<number>(0);
  const [cameraTimeout, setCameraTimeout] = useState<boolean>(false);
  const [bootTimeMs, setBootTimeMs] = useState<number | null>(null);

  // Hand visual coordinates and trigger overlay states
  const [handInfo, setHandInfo] = useState<{ x: number; y: number; isOpen: boolean } | null>(null);
  const [swipeTriggered, setSwipeTriggered] = useState<boolean>(false);
  const swipeTimeoutRef = useRef<any>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const handsInstanceRef = useRef<any | null>(null);
  const pendingBootRef = useRef<Promise<void> | null>(null);
  const onResultsRef = useRef<((results: any) => void) | null>(null);

  // Position buffer for swipe detection
  const xHistoryRef = useRef<{ x: number; time: number }[]>([]);
  const cdnRootRef = useRef<string>("https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/");

  // Interactive smoothing (exponential moving average) to suppress webcam tracking jitter
  const smoothedXRef = useRef<number | null>(null);
  const smoothedYRef = useRef<number | null>(null);

  // Throttling configuration for main state updates to reduce frame rendering overhead
  const lastCallbackTimeRef = useRef<number>(0);
  const lastCallbackXRef = useRef<number>(0);
  const lastCallbackYRef = useRef<number>(0);
  const lastCallbackOpenRef = useRef<boolean>(false);
  const hasSentHandPresenceRef = useRef<boolean>(false);
  const initStartTimeRef = useRef<number>(0);

  const triggerSwipeAnimation = () => {
    setSwipeTriggered(true);
    if (swipeTimeoutRef.current) clearTimeout(swipeTimeoutRef.current);
    swipeTimeoutRef.current = setTimeout(() => {
      setSwipeTriggered(false);
    }, 1200);
  };

  const handleHandLostChange = () => {
    smoothedXRef.current = null;
    smoothedYRef.current = null;
    if (hasSentHandPresenceRef.current) {
      hasSentHandPresenceRef.current = false;
      onHandUpdate(null);
    }
  };

  // Async script injector with pinned stable versioning to prevent runtime WASM mismatch
  useEffect(() => {
    let active = true;
    let checkLoaded: any = null;
    let timeoutId: any = null;
    const timersToClear: any[] = [];
    const scriptStartTime = performance.now();

    const findLoadedCdn = () => {
      const scripts = Array.from(document.getElementsByTagName("script"));
      for (const s of scripts) {
        const src = s.src || "";
        if (src.includes("hands.js") || src.includes("@mediapipe/hands")) {
          const idx = src.indexOf("hands.js");
          if (idx !== -1) {
            return src.substring(0, idx);
          }
        }
      }
      return null;
    };

    if ((window as any).Hands) {
      const activeCdn = findLoadedCdn();
      if (activeCdn) {
        cdnRootRef.current = activeCdn;
        console.log(`[MediaPipe Perf] Hands already loaded. Active: ${activeCdn}`);
      }
      setLoading(false);
      return;
    }

    const cdns = [
      "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/",
      "https://npm.elemecdn.com/@mediapipe/hands@0.4.1675469240/",
      "https://unpkg.com/@mediapipe/hands@0.4.1675469240/",
      "https://www.gstatic.com/mediapipe/solutions/hands/",
      "/mediapipe/"
    ];

    let activeScript: HTMLScriptElement | null = null;

    const tryLoadCdn = (index: number) => {
      if (!active || (window as any).Hands) return;
      if (index >= cdns.length) {
        console.warn("All MediaPipe Hands CDNs failed to load or timed out.");
        return;
      }

      if (activeScript) {
        try {
          document.head.removeChild(activeScript);
        } catch (_) {}
        activeScript = null;
      }

      const cdnUrl = cdns[index];
      console.log(`[MediaPipe Perf] Loading CDN [${index}]: ${cdnUrl}`);

      const script = document.createElement("script");
      script.src = `${cdnUrl}hands.js`;
      if (cdnUrl.startsWith("http")) {
        script.crossOrigin = "anonymous";
      }
      script.async = true;

      script.onload = () => {
        if (active && (window as any).Hands) {
          cdnRootRef.current = cdnUrl;
          const duration = performance.now() - scriptStartTime;
          console.log(`[MediaPipe Perf] Successfully loaded script from CDN [${index}] in ${duration.toFixed(2)}ms: ${cdnUrl}`);
        }
      };

      script.onerror = () => {
        if (!active || (window as any).Hands) return;
        console.warn(`CDN [${index}] failed to load: ${cdnUrl}. Falling back...`);
        tryLoadCdn(index + 1);
      };

      activeScript = script;
      document.head.appendChild(script);

      const checkTimer = setTimeout(() => {
        if (active && !(window as any).Hands) {
          console.log(`CDN [${index}] loading threshold reached (3.5s). Falling back to next...`);
          tryLoadCdn(index + 1);
        }
      }, 3500);

      timersToClear.push(checkTimer);
    };

    tryLoadCdn(0);

    timeoutId = setTimeout(() => {
      if (active) {
        clearInterval(checkLoaded);
        if (!(window as any).Hands) {
          console.warn("AI landmark library failed to load or timed out.");
          setPermissionError("AI 交互库加载超时（网络环境较弱）。请检查连接并刷新页面进行手势交互。");
          setLoading(false);
        }
      }
    }, 35000);

    checkLoaded = setInterval(() => {
      if ((window as any).Hands) {
        clearInterval(checkLoaded);
        clearTimeout(timeoutId);
        timersToClear.forEach(t => clearTimeout(t));
        if (active) setLoading(false);
      }
    }, 150);

    return () => {
      active = false;
      if (checkLoaded) clearInterval(checkLoaded);
      clearTimeout(timeoutId);
      timersToClear.forEach(t => clearTimeout(t));
    };
  }, []);

  // Initialize and run Hand Landmark detection
  useEffect(() => {
    if (loading || !isActive) {
      stopCameraAndTracking();
      return;
    }

    let isDestroyed = false;
    let timeoutTimer: any = null;
    initStartTimeRef.current = performance.now();

    // Setup 3-second timeout timer for camera initialization
    setCameraTimeout(false);
    timeoutTimer = setTimeout(() => {
      if (!isDestroyed && !running) {
        console.warn("[MediaPipe Perf] Camera initialization exceeded 3 seconds (latency trigger). Displaying retry button.");
        setCameraTimeout(true);
      }
    }, 3000);

    async function startMediaPipe() {
      if (pendingBootRef.current) {
        try {
          await pendingBootRef.current;
        } catch (_) {}
      }

      if (isDestroyed || !isActive) {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        return;
      }

      let resolveBoot: () => void = () => {};
      pendingBootRef.current = new Promise<void>((resolve) => {
        resolveBoot = resolve;
      });

      try {
        setPermissionError(null);

        // Defer 450ms for initial page rendering transition to prevent thread locking/black freezing on mount
        await new Promise(resolve => setTimeout(resolve, 450));
        if (isDestroyed || !isActive) {
          if (timeoutTimer) clearTimeout(timeoutTimer);
          return;
        }

        // 1. Initialise and reuse MediaPipe Hands Instance
        const modelSetupStart = performance.now();
        let hands = sharedHandsInstance;
        if (!hands) {
          const HandsClass = (window as any).Hands;
          if (!HandsClass) {
            throw new Error("当前环境暂时无法加载 AI 摄像头计算库。请刷新页面或重试以进行隔空手势互动！");
          }

          if (typeof window !== "undefined") {
            try {
              (window as any).arguments = undefined;
            } catch (e) {}
          }

          hands = new HandsClass({
            locateFile: (file: string) => `${cdnRootRef.current}${file}`
          });

          hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 0, 
            minDetectionConfidence: 0.35, 
            minTrackingConfidence: 0.35
          });

          sharedHandsInstance = hands;
        }

        const modelSetupDuration = performance.now() - modelSetupStart;
        console.log(`[MediaPipe Perf] Model setup/reuse resolved in ${modelSetupDuration.toFixed(2)}ms`);

        hands.onResults((results: any) => {
          if (onResultsRef.current) {
            onResultsRef.current(results);
          }
        });

        // Keep the latest prediction processing logic stored inside the ref
        onResultsRef.current = (results: any) => {
          if (isDestroyed || !isActive) return;

          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            
            if (landmarks && Array.isArray(landmarks) && landmarks.length >= 21) {
              const pt8 = landmarks[8];
              const pt6 = landmarks[6];
              const pt12 = landmarks[12];
              const pt10 = landmarks[10];
              const pt16 = landmarks[16];
              const pt14 = landmarks[14];
              const pt20 = landmarks[20];
              const pt18 = landmarks[18];
              const pt9 = landmarks[9];
              const pt4 = landmarks[4];
              const pt5 = landmarks[5];
              const pt17 = landmarks[17];

              if (pt8 && pt6 && pt12 && pt10 && pt16 && pt14 && pt20 && pt18 && pt9 && pt4 && pt5 && pt17) {
                let extendedFingers = 0;
                if (typeof pt8.y === "number" && typeof pt6.y === "number" && pt8.y < pt6.y) extendedFingers++;
                if (typeof pt12.y === "number" && typeof pt10.y === "number" && pt12.y < pt10.y) extendedFingers++;
                if (typeof pt16.y === "number" && typeof pt14.y === "number" && pt16.y < pt14.y) extendedFingers++;
                if (typeof pt20.y === "number" && typeof pt18.y === "number" && pt20.y < pt18.y) extendedFingers++;

                let palmScale = 0.12;
                if (typeof pt5.x === "number" && typeof pt17.x === "number" && typeof pt5.y === "number" && typeof pt17.y === "number") {
                  const dx = pt5.x - pt17.x;
                  const dy = pt5.y - pt17.y;
                  palmScale = Math.max(0.04, Math.sqrt(dx * dx + dy * dy));
                }

                let isPinching = false;
                if (typeof pt4.x === "number" && typeof pt8.x === "number" && typeof pt4.y === "number" && typeof pt8.y === "number") {
                  const dx = pt4.x - pt8.x;
                  const dy = pt4.y - pt8.y;
                  const tipDistance = Math.sqrt(dx * dx + dy * dy);
                  if (tipDistance < palmScale * 0.52) {
                    isPinching = true;
                  }
                }

                const isOpen = extendedFingers >= 2 && !isPinching;

                const rawX = typeof pt9.x === "number" ? pt9.x : 0.5;
                const mirroredX = 1 - rawX;
                const mappedY = typeof pt9.y === "number" ? pt9.y : 0.5;

                const alpha = 0.45;
                let currentSmoothedX = mirroredX;
                let currentSmoothedY = mappedY;

                if (smoothedXRef.current === null || smoothedYRef.current === null) {
                  smoothedXRef.current = mirroredX;
                  smoothedYRef.current = mappedY;
                } else {
                  smoothedXRef.current = alpha * mirroredX + (1 - alpha) * smoothedXRef.current;
                  smoothedYRef.current = alpha * mappedY + (1 - alpha) * smoothedYRef.current;
                  currentSmoothedX = smoothedXRef.current;
                  currentSmoothedY = smoothedYRef.current;
                }

                const now = Date.now();
                xHistoryRef.current.push({ x: currentSmoothedX, time: now });

                xHistoryRef.current = xHistoryRef.current.filter(item => now - item.time < 450);

                let isSwipeLeft = false;
                if (xHistoryRef.current.length > 2) {
                  const newest = xHistoryRef.current[xHistoryRef.current.length - 1];
                  
                  let maxX = newest.x;
                  let maxTime = newest.time;
                  for (const item of xHistoryRef.current) {
                    if (item.x > maxX) {
                      maxX = item.x;
                      maxTime = item.time;
                    }
                  }

                  const timeDelta = newest.time - maxTime;
                  const xDelta = newest.x - maxX;

                  if (xDelta < -0.15 && timeDelta > 80 && timeDelta < 450) {
                    isSwipeLeft = true;
                    xHistoryRef.current = [];
                    triggerSwipeAnimation();
                  }
                }

                setHandInfo({
                  x: currentSmoothedX,
                  y: currentSmoothedY,
                  isOpen
                });

                const timeElapsed = now - lastCallbackTimeRef.current;
                
                const firstPresence = !hasSentHandPresenceRef.current;
                const stateChanged = lastCallbackOpenRef.current !== isOpen;
                
                const dx = currentSmoothedX - lastCallbackXRef.current;
                const dy = currentSmoothedY - lastCallbackYRef.current;
                const distSq = dx * dx + dy * dy;
                
                if (isSwipeLeft || firstPresence || stateChanged || timeElapsed >= 20 || distSq > 0.00018) {
                  lastCallbackTimeRef.current = now;
                  lastCallbackXRef.current = currentSmoothedX;
                  lastCallbackYRef.current = currentSmoothedY;
                  lastCallbackOpenRef.current = isOpen;
                  hasSentHandPresenceRef.current = true;

                  onHandUpdate({
                    x: currentSmoothedX,
                    y: currentSmoothedY,
                    isOpen,
                    score: 0.9,
                    isSwipeLeft
                  });
                }
              } else {
                setHandInfo(null);
                handleHandLostChange();
              }
            } else {
              setHandInfo(null);
              handleHandLostChange();
            }
          } else {
            setHandInfo(null);
            handleHandLostChange();
          }
        };

        handsInstanceRef.current = hands;

        // 2. Initialise camera
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("浏览器不支持摄像头访问，或当前页面非安全环境(HTTPS/localhost)。已自动启用鼠标模式。");
        }

        const cameraStart = performance.now();
        let stream: MediaStream | null = null;
        let attempts = 0;
        const maxAttempts = 6;
        while (attempts < maxAttempts) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 480 },
                height: { ideal: 360 },
                facingMode: "user"
              },
              audio: false
            });
            break;
          } catch (err: any) {
            attempts++;
            const errName = (err.name || "").toLowerCase();
            const errMsg = (err.message || "").toLowerCase();
            const isBusy = errName === "notreadableerror" || errMsg.includes("in use") || errMsg.includes("readable") || errMsg.includes("lock") || errMsg.includes("source") || errMsg.includes("occupy");
            if (isBusy && attempts < maxAttempts) {
              console.log(`[MediaPipe Perf] Camera occupied, retrying (${attempts}/${maxAttempts})...`);
              await new Promise(resolve => setTimeout(resolve, 300));
            } else {
              throw err;
            }
          }
        }

        if (!stream) {
          throw new Error("初始化摄像头失败：未知原因。");
        }

        const cameraDuration = performance.now() - cameraStart;
        console.log(`[MediaPipe Perf] Camera stream acquired in ${cameraDuration.toFixed(2)}ms`);

        if (isDestroyed) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach(t => t.stop());
          throw new Error("视频容器 DOM 元素未正确创建。");
        }

        video.srcObject = stream;
        activeStreamRef.current = stream;

        await video.play().catch(e => console.warn("Video play interrupted or rejected by browser autoplay policy.", e));

        let isProcessing = false;
        let lastProcessTime = 0;
        const PROCESS_INTERVAL = 50;
        
        const processFrame = async () => {
          if (isDestroyed || !isActive) return;
          
          const now = Date.now();
          if (
            video.readyState === video.HAVE_ENOUGH_DATA && 
            !isProcessing && 
            handsInstanceRef.current &&
            (now - lastProcessTime >= PROCESS_INTERVAL)
          ) {
            isProcessing = true;
            lastProcessTime = now;
            try {
              const startProcessingTime = performance.now();
              await handsInstanceRef.current.send({ image: video });
              const processingDuration = performance.now() - startProcessingTime;
              if (Math.random() < 0.01) { 
                console.log(`[MediaPipe Perf] Frame processing latency: ${processingDuration.toFixed(2)}ms`);
              }
            } catch (err: any) {
              console.error("MediaPipe prediction frame skip:", err);
              const errMsg = String(err).toLowerCase();
              if (errMsg.includes("abort") || errMsg.includes("compileerror") || errMsg.includes("wasm") || errMsg.includes("webassembly")) {
                console.warn("WASM error inside MediaPipe. Swapping CDN...");
                sharedHandsInstance = null;
                handsInstanceRef.current = null;
                
                const healers = [
                  "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/",
                  "https://npm.elemecdn.com/@mediapipe/hands@0.4.1675469240/",
                  "https://unpkg.com/@mediapipe/hands@0.4.1675469240/",
                  "https://www.gstatic.com/mediapipe/solutions/hands/",
                  "/mediapipe/"
                ];
                
                const currentIdx = healers.indexOf(cdnRootRef.current);
                if (currentIdx !== -1 && currentIdx < healers.length - 1) {
                  const nextCdn = healers[currentIdx + 1];
                  cdnRootRef.current = nextCdn;
                  console.log(`Self-healing swapped CDN to: ${nextCdn}`);
                  setRetryTrigger(prev => prev + 1);
                } else {
                  cdnRootRef.current = "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/";
                  setRetryTrigger(prev => prev + 1);
                }
              }
            } finally {
              isProcessing = false;
            }
          }
          
          if (!isDestroyed && isActive) {
            animationFrameIdRef.current = requestAnimationFrame(processFrame);
          }
        };

        animationFrameIdRef.current = requestAnimationFrame(processFrame);
        
        // Succeeded within 3 seconds! Clear timeout
        if (timeoutTimer) clearTimeout(timeoutTimer);
        setRunning(true);
        setCameraTimeout(false);

        const totalDuration = performance.now() - initStartTimeRef.current;
        setBootTimeMs(totalDuration);
        console.log(`[MediaPipe Perf] Tracker loaded with camera successfully in ${totalDuration.toFixed(2)}ms!`);
      } catch (err: any) {
        console.warn("Camera initializer handled: ", err?.message || err);
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (!isDestroyed) {
          let friendlyMessage = "无法访问摄像头。请验证是否已开启当前页面的摄像头访问权限。";
          const errMsg = (err.message || "").toLowerCase();
          const errName = (err.name || "").toLowerCase();
          
          if (
            errName === "notreadableerror" || 
            errMsg.includes("in use") || 
            errMsg.includes("readable") || 
            errMsg.includes("lock") || 
            errMsg.includes("source") ||
            errMsg.includes("occupy")
          ) {
            friendlyMessage = "设备占用 (Device in use)。摄像头正被其他标签页或软件使用。";
          } else if (errName === "notallowederror" || errMsg.includes("permission") || errMsg.includes("denied")) {
            friendlyMessage = "相机权限已禁用，请在浏览器中开启。";
          } else if (errName === "notfounderror" || errMsg.includes("found") || errMsg.includes("device")) {
            friendlyMessage = "未检测到可用的摄像头。";
          } else {
            friendlyMessage = err.message || friendlyMessage;
          }
          
          setPermissionError(friendlyMessage);
          setRunning(false);
        }
      } finally {
        resolveBoot();
      }
    }

    startMediaPipe();

    // Auto trigger retry on first user gesture anywhere on window to bypass autoplay blocks
    const handleFirstUserInteraction = () => {
      if (!running && isActive && !loading) {
        console.log("[MediaPipe Perf] User gesture detected on window. Auto reloading stream to bypass browser block...");
        handleRetryWithCleanup();
      }
      window.removeEventListener("click", handleFirstUserInteraction);
      window.removeEventListener("pointerdown", handleFirstUserInteraction);
    };
    window.addEventListener("click", handleFirstUserInteraction);
    window.addEventListener("pointerdown", handleFirstUserInteraction);

    return () => {
      isDestroyed = true;
      if (timeoutTimer) clearTimeout(timeoutTimer);
      stopCameraAndTracking();
      if (swipeTimeoutRef.current) clearTimeout(swipeTimeoutRef.current);
      window.removeEventListener("click", handleFirstUserInteraction);
      window.removeEventListener("pointerdown", handleFirstUserInteraction);
    };
  }, [loading, isActive, retryTrigger, portalTarget]);

  function stopCameraAndTracking() {
    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => track.stop());
      activeStreamRef.current = null;
    }

    // Do NOT call close() on the shared global instance to avoid killing the Emscripten/WASM context
    handsInstanceRef.current = null;
    onResultsRef.current = null; 

    setRunning(false);
    hasSentHandPresenceRef.current = false;
    smoothedXRef.current = null;
    smoothedYRef.current = null;
    onHandUpdate(null);
  }

  function handleRetryWithCleanup() {
    console.log("[MediaPipe] Manual recovery retry triggered. Releasing old stream resources...");
    
    // Safety release: prevent memory overflow
    if (activeStreamRef.current) {
      try {
        activeStreamRef.current.getTracks().forEach((track) => {
          track.stop();
          console.log(`[MediaPipe Cleanup] Forcefully stopped track: ${track.label}`);
        });
      } catch (e) {
        console.error("Error stopping tracks on cleanup:", e);
      }
      activeStreamRef.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
        videoRef.current.pause();
      } catch (e) {}
    }

    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    setPermissionError(null);
    setCameraTimeout(false);
    setRunning(false);
    setRetryTrigger(prev => prev + 1);
  }

  const isDeviceInUse = permissionError?.includes("Device in use");

  const content = (
    <div className="flex flex-col items-center bg-[#1a1815] p-5 rounded-xs border border-white/5 backdrop-blur-md shadow-lg w-full">
      {/* Visual Status Indicator */}
      <div className="flex items-center gap-2 mb-3 select-none">
        {loading ? (
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c5a059] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#c5a059]"></span>
            </span>
            <span className="text-[#8b7e6a] text-xs font-serif tracking-wider">正在加载 AI 交互模型...</span>
          </div>
        ) : !isActive ? (
          <div className="flex items-center gap-1.5 text-[#8b7e6a] text-xs font-serif">
            <span className="w-2 h-2 rounded-full bg-[#0f0e0c] border border-white/10"></span>
            <span>手势追踪已暂停</span>
          </div>
        ) : running ? (
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5 text-[#c5a059] text-xs font-semibold animate-pulse font-serif tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI 手势探测中 (五指张开上色)</span>
            </div>
            {bootTimeMs !== null && (
              <span className="text-[9px] font-mono text-[#8b7e6a]/70">启动耗时: {bootTimeMs.toFixed(0)}ms</span>
            )}
          </div>
        ) : permissionError ? (
          <div className="flex items-center gap-1.5 text-orange-500 text-xs font-serif">
            <ShieldAlert className="w-3.5 h-3.5 text-orange-500" />
            <span>手势功能受限</span>
          </div>
        ) : cameraTimeout ? (
          <div className="flex items-center gap-1.5 text-orange-400 text-xs font-serif">
            <ShieldAlert className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
            <span>摄像头唤醒超时</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[#c5a059] text-xs font-serif">
            <Camera className="w-3.5 h-3.5" />
            <span>准备启动相机...</span>
          </div>
        )}
      </div>

      {/* Camera Video Area */}
      <div className="relative w-full h-32 bg-[#0f0e0c] rounded-xs overflow-hidden flex items-center justify-center border border-white/5 shadow-inner">
        <video
          ref={videoRef}
          playsInline
          muted
          id="webcam-video"
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1] opacity-70"
          style={{ display: running && isActive ? "block" : "none" }}
        />

        {/* Real-time Hand Aura Tracking Cursor */}
        <AnimatePresence>
          {running && isActive && handInfo && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "absolute",
                left: `${handInfo.x * 100}%`,
                top: `${handInfo.y * 100}%`,
                x: "-50%",
                y: "-50%",
              }}
              className="pointer-events-none z-30 transition-all duration-75 ease"
            >
              {handInfo.isOpen ? (
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-12 h-12 rounded-full bg-[#c5a059]/15 animate-ping" />
                  <div className="absolute w-8 h-8 rounded-full bg-[#c5a059]/35 border border-[#c5a059]/60 animate-pulse" />
                  
                  {/* Glowing Lotus / Sacred Compass pointer */}
                  <svg className="w-5 h-5 text-[#c5a059] drop-shadow-[0_0_6px_rgba(197,160,89,0.8)] animate-spin [animation-duration:6s]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C11.5 6 10 10 2 12c8 2 9.5 6 10 10 .5-4 2-8 10-10-8-2-9.5-6-10-10z" />
                  </svg>
                  
                  <span className="absolute w-2 h-2 bg-white rounded-full border border-[#c5a059]" />
                  
                  <span className="absolute top-6 bg-[#c5a059] text-[#0f0e0c] px-1 font-serif text-[7px] font-bold tracking-widest whitespace-nowrap uppercase rounded-xs shadow-md">
                    神笔触色
                  </span>
                </div>
              ) : (
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-4 h-4 rounded-full bg-stone-300/15 border border-white/40 animate-ping" />
                  <span className="w-1.5 h-1.5 bg-[#c5a059]/90 rounded-full ring-2 ring-black border border-white" />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!isActive ? (
          <div className="text-center p-2 text-[#8b7e6a] text-xs font-serif">
            <Video className="w-6 h-6 mx-auto mb-1 opacity-20" />
            <span>视频交互已禁用</span>
          </div>
        ) : loading ? (
          <div className="text-center p-2 text-[#c5a059]/70 text-xs animate-pulse font-serif flex flex-col items-center justify-center gap-1.5 z-10 w-full">
            <Sparkles className="w-5 h-5 mx-auto text-[#c5a059] animate-spin [animation-duration:10s]" />
            <span>AI 互动模块高速构建中...</span>
          </div>
        ) : cameraTimeout ? (
          <div className="text-center p-4 text-[#b5a796] text-xs leading-relaxed max-w-[210px] font-sans flex flex-col items-center justify-center gap-2 z-10 animate-fade-in bg-stone-950/80 w-full h-full">
            <ShieldAlert className="w-5 h-5 text-orange-400 animate-pulse" />
            <span className="text-[10px] text-orange-300 font-serif font-semibold tracking-wider">
              摄像头唤醒超时
            </span>
            <span className="text-[10px] opacity-80 leading-normal text-[#8b7e6a] text-center font-serif">
              相机连接未能于 3 秒内开启，可能被占用或在等待页面激活。
            </span>
            <button
              onClick={handleRetryWithCleanup}
              className="mt-1.5 px-3 py-1 bg-[#c5a059] hover:bg-[#c5a059]/90 text-[#0f0e0c] font-bold font-serif text-[10px] tracking-wider rounded-xs transition-all cursor-pointer shadow-md flex items-center justify-center gap-1 w-full animate-bounce shadow-black"
            >
              <RotateCcw className="w-3 h-3 animate-spin [animation-duration:5s]" />
              <span>释放资源并安全重试</span>
            </button>
          </div>
        ) : permissionError ? (
          <div className="text-center p-4 text-[#b5a796] text-xs leading-relaxed max-w-[210px] font-sans flex flex-col items-center justify-center gap-2 z-10">
            <ShieldAlert className="w-5 h-5 text-orange-500 animate-pulse" />
            <span className="text-[10px] text-orange-400 font-serif font-semibold tracking-wider">
              {isDeviceInUse ? "摄像头被占用" : "相机需要授权"}
            </span>
            <span className="text-[10px] opacity-80 leading-normal text-[#8b7e6a] text-center font-serif">
              请允许浏览器访问您的摄像头。如果已被禁用，请在地址栏小锁图标中开启后重试。
            </span>
            <button
              onClick={handleRetryWithCleanup}
              className="mt-1.5 px-3 py-1 bg-[#c5a059] hover:bg-[#c5a059]/90 text-[#0f0e0c] font-bold font-serif text-[10px] tracking-wider rounded-xs transition-colors cursor-pointer shadow-md flex items-center justify-center gap-1 w-full"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>重新请求并重试</span>
            </button>
          </div>
        ) : !running ? (
          <div className="text-center p-2 text-[#c5a059] text-xs font-serif">
            <div className="w-5 h-5 border-2 border-[#c5a059] border-t-transparent rounded-full animate-spin mx-auto mb-1.5"></div>
            <span>申请相机授权中...</span>
          </div>
        ) : (
          <div className="absolute bottom-2 right-2 bg-[#c5a059]/90 px-2 py-0.5 rounded-sm text-[9px] text-[#0f0e0c] font-bold flex items-center gap-1 z-10 shadow-md">
            <CheckCircle className="w-2.5 h-2.5" /> Sensoring
          </div>
        )}
      </div>

      {/* Mini Hint Text */}
      <div className="mt-2 text-center w-full select-none font-serif">
        {!running && (
          <div className="px-2 text-stone-400 text-[10px] leading-relaxed">
            提示：隔空手势互动需要相机权限。如果已被禁用，请在浏览器地址栏（小锁图标）中启用，然后点击 [重新请求并重试] 重新触发生命周期。
          </div>
        )}
      </div>
    </div>
  );

  if (portalTarget) {
    return createPortal(content, portalTarget);
  }

  return (
    <div className="hidden pointer-events-none w-0 h-0 overflow-hidden" style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}>
      {content}
    </div>
  );
}

export default function MediaPipeGestureTracker(props: MediaPipeGestureTrackerProps) {
  return (
    <GestureTrackerErrorBoundary>
      <MediaPipeGestureTrackerInner {...props} />
    </GestureTrackerErrorBoundary>
  );
}
