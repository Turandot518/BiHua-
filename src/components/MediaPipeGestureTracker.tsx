/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { HandData } from "../types";
import { Camera, Video, ShieldAlert, CheckCircle, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface MediaPipeGestureTrackerProps {
  onHandUpdate: (hand: HandData | null) => void;
  isActive: boolean;
}

let sharedHandsInstance: any = null;

export default function MediaPipeGestureTracker({
  onHandUpdate,
  isActive
}: MediaPipeGestureTrackerProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [running, setRunning] = useState<boolean>(false);
  const [retryTrigger, setRetryTrigger] = useState<number>(0);

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
  const cdnRootRef = useRef<string>("https://npm.elemecdn.com/@mediapipe/hands@0.4.1675469240/");

  // Interactive smoothing (exponential moving average) to suppress webcam tracking jitter
  const smoothedXRef = useRef<number | null>(null);
  const smoothedYRef = useRef<number | null>(null);

  // Throttling configuration for main state updates to reduce frame rendering overhead
  const lastCallbackTimeRef = useRef<number>(0);
  const lastCallbackXRef = useRef<number>(0);
  const lastCallbackYRef = useRef<number>(0);
  const lastCallbackOpenRef = useRef<boolean>(false);
  const hasSentHandPresenceRef = useRef<boolean>(false);

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
        console.log(`MediaPipe Hands is already loaded. Setting cdnRootRef to active: ${activeCdn}`);
      }
      setLoading(false);
      return;
    }

    const cdns = [
      "https://npm.elemecdn.com/@mediapipe/hands@0.4.1675469240/",
      "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/",
      "https://unpkg.com/@mediapipe/hands@0.4.1675469240/",
      "https://www.gstatic.com/mediapipe/solutions/hands/"
    ];

    let activeScript: HTMLScriptElement | null = null;

    const tryLoadCdn = (index: number) => {
      if (!active || (window as any).Hands) return;
      if (index >= cdns.length) {
        console.warn("All MediaPipe Hands CDNs failed to load or timed out.");
        return;
      }

      // If there's an active script already, we clean it up before switching to next fallback to avoid clashing
      if (activeScript) {
        try {
          document.head.removeChild(activeScript);
        } catch (_) {}
        activeScript = null;
      }

      const cdnUrl = cdns[index];
      console.log(`Initiating load of MediaPipe Hands from CDN [${index}]: ${cdnUrl}`);

      const script = document.createElement("script");
      script.src = `${cdnUrl}hands.js`;
      if (cdnUrl.startsWith("http")) {
        script.crossOrigin = "anonymous";
      }
      script.async = true;

      script.onload = () => {
        if (active && (window as any).Hands) {
          cdnRootRef.current = cdnUrl;
          console.log(`Successfully loaded MediaPipe Hands from CDN [${index}]: ${cdnUrl}`);
        }
      };

      script.onerror = () => {
        if (!active || (window as any).Hands) return;
        console.warn(`CDN [${index}] failed to load: ${cdnUrl}. Falling back to next...`);
        tryLoadCdn(index + 1);
      };

      activeScript = script;
      document.head.appendChild(script);

      // Threshold: if this CDN does not load in 3.5 seconds, try sequential fallback after cleaning up the active script
      const checkTimer = setTimeout(() => {
        if (active && !(window as any).Hands) {
          console.log(`CDN [${index}] load threshold reached without success. Moving to next CDN fallbacks...`);
          tryLoadCdn(index + 1);
        }
      }, 3500);

      timersToClear.push(checkTimer);
    };

    // Kick off with the fast CDN first
    tryLoadCdn(0);

    // Safety timeout: If after 35 seconds we still don't have window.Hands, stop spinner and show timeout warning
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

    async function startMediaPipe() {
      if (pendingBootRef.current) {
        try {
          await pendingBootRef.current;
        } catch (_) {}
      }

      if (isDestroyed || !isActive) {
        return;
      }

      let resolveBoot: () => void = () => {};
      pendingBootRef.current = new Promise<void>((resolve) => {
        resolveBoot = resolve;
      });

      try {
        setPermissionError(null);

        // 1. Initialise and reuse MediaPipe Hands Instance
        let hands = sharedHandsInstance;
        if (!hands) {
          const HandsClass = (window as any).Hands;
          if (!HandsClass) {
            throw new Error("当前环境暂时无法加载 AI 摄像头计算库。请刷新页面或重试以进行隔空手势互动！");
          }

          // Safety bypass: prevent Emscripten from throwing due to legacy global arguments detection
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
            modelComplexity: 0, // 0 is the Lite model, which speeds up predictions dramatically and reduces latency
            minDetectionConfidence: 0.5, // slightly more sensitive to detect hand faster
            minTrackingConfidence: 0.5
          });

          sharedHandsInstance = hands;
        }

        // ALWAYS update the onResults callback pointer on the shared global instance
        // to dynamically target the newly mounted component's active callback ref
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
                // Calculate open hand state: index, middle, ring, pinky tips are higher than joint bases
                // MediaPipe context coord y goes from 0 (top) to 1 (bottom). So smaller y means higher up.
                let extendedFingers = 0;
                if (typeof pt8.y === "number" && typeof pt6.y === "number" && pt8.y < pt6.y) extendedFingers++;   // Index finger
                if (typeof pt12.y === "number" && typeof pt10.y === "number" && pt12.y < pt10.y) extendedFingers++; // Middle finger
                if (typeof pt16.y === "number" && typeof pt14.y === "number" && pt16.y < pt14.y) extendedFingers++; // Ring finger
                if (typeof pt20.y === "number" && typeof pt18.y === "number" && pt20.y < pt18.y) extendedFingers++; // Pinky finger

                // Normalize distances using the palm width as an auto-calibrating scale reference
                let palmScale = 0.12;
                if (typeof pt5.x === "number" && typeof pt17.x === "number" && typeof pt5.y === "number" && typeof pt17.y === "number") {
                  const dx = pt5.x - pt17.x;
                  const dy = pt5.y - pt17.y;
                  palmScale = Math.max(0.04, Math.sqrt(dx * dx + dy * dy));
                }

                // Check distance between thumb tip (pt4) and index finger tip (pt8)
                let isPinching = false;
                if (typeof pt4.x === "number" && typeof pt8.x === "number" && typeof pt4.y === "number" && typeof pt8.y === "number") {
                  const dx = pt4.x - pt8.x;
                  const dy = pt4.y - pt8.y;
                  const tipDistance = Math.sqrt(dx * dx + dy * dy);
                  // If the thumb tip is close to the index tip relative to the palm scale, it is a pinch!
                  if (tipDistance < palmScale * 0.52) {
                    isPinching = true;
                  }
                }

                // Open hand state check: must have enough extended fingers and must NOT be pinching
                const isOpen = extendedFingers >= 2 && !isPinching;

                // Hand key landmark points are usually represented by index base 9 (middle key joint) or 0 (wrist)
                // Mirror horizontal coordinate because webcam stream is usually mirrored for natural feedback
                const rawX = typeof pt9.x === "number" ? pt9.x : 0.5;
                const mirroredX = 1 - rawX; // Convert left/right
                const mappedY = typeof pt9.y === "number" ? pt9.y : 0.5;

                // 2. Exponential Moving Average to eliminate camera coordinate jitter/noise
                // Alpha of 0.45 balances responsiveness (low input lag) with extremely smooth dampening
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

                // Process swipe gesture (Right to Left displacement using smoothed coordinates)
                const now = Date.now();
                xHistoryRef.current.push({ x: currentSmoothedX, time: now });

                // Maintain last 450ms of tracking coordinates (extremely fast response window)
                xHistoryRef.current = xHistoryRef.current.filter(item => now - item.time < 450);

                let isSwipeLeft = false;
                if (xHistoryRef.current.length > 2) {
                  const newest = xHistoryRef.current[xHistoryRef.current.length - 1];
                  
                  // Find the rightmost position (max x) in the recent history to capture the start of a swipe
                  let maxX = newest.x;
                  let maxTime = newest.time;
                  for (const item of xHistoryRef.current) {
                    if (item.x > maxX) {
                      maxX = item.x;
                      maxTime = item.time;
                    }
                  }

                  const timeDelta = newest.time - maxTime;
                  const xDelta = newest.x - maxX; // negative value representing right-to-left swipe

                  // HIGHLY SENSITIVE & INSTANT RESPONSE:
                  // If hand moved leftwards by at least 15% of the screen width within 80ms - 450ms
                  if (xDelta < -0.15 && timeDelta > 80 && timeDelta < 450) {
                    isSwipeLeft = true;
                    xHistoryRef.current = []; // Reset history to avoid double-firing
                    triggerSwipeAnimation();
                  }
                }

                // Save hand coordinates for rendering real-time divine particles and responsive tracking shapes
                setHandInfo({
                  x: currentSmoothedX,
                  y: currentSmoothedY,
                  isOpen
                });

                // Dispatch throttled hand update to parent components
                const timeElapsed = now - lastCallbackTimeRef.current;
                
                // Conditions to bypass throttling and dispatch immediately:
                // - First hand presence registration
                // - Hand open/pinch state changed (isOpen / grab toggle)
                // - Swipe gesture triggered
                const firstPresence = !hasSentHandPresenceRef.current;
                const stateChanged = lastCallbackOpenRef.current !== isOpen;
                
                // Calculate coordinate displacement delta to ignore micro-jitters
                const dx = currentSmoothedX - lastCallbackXRef.current;
                const dy = currentSmoothedY - lastCallbackYRef.current;
                const distSq = dx * dx + dy * dy;
                
                // Throttle threshold: 20ms (max 50 updates per second)
                // Eagerly dispatch if spacing state changed, swipe occurred, or distance moved is meaningful
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
            // No hand detected
            setHandInfo(null);
            handleHandLostChange();
          }
        };

        handsInstanceRef.current = hands;

        // 2. Initialise and run camera via standard MediaDevices stream and frame loop
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("浏览器不支持摄像头访问，或当前页面非安全环境(HTTPS/localhost)。已自动启用鼠标模式。");
        }

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
              console.log(`Webcam is occupied or releasing (attempt ${attempts}/${maxAttempts}), retrying in 300ms...`);
              await new Promise(resolve => setTimeout(resolve, 300));
            } else {
              throw err;
            }
          }
        }

        if (!stream) {
          throw new Error("初始化摄像头失败：未知原因。");
        }

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

        // Start playing the video
        await video.play().catch(e => console.warn("Video play interrupted or rejected by browser autoplay policy.", e));

        // Start direct custom requestAnimationFrame tracking feed
        let isProcessing = false;
        
        const processFrame = async () => {
          if (isDestroyed || !isActive) return;
          
          if (video.readyState === video.HAVE_ENOUGH_DATA && !isProcessing && handsInstanceRef.current) {
            isProcessing = true;
            try {
              await handsInstanceRef.current.send({ image: video });
            } catch (err) {
              console.error("MediaPipe prediction frame skip:", err);
            } finally {
              isProcessing = false;
            }
          }
          
          if (!isDestroyed && isActive) {
            animationFrameIdRef.current = requestAnimationFrame(processFrame);
          }
        };

        animationFrameIdRef.current = requestAnimationFrame(processFrame);
        setRunning(true);
      } catch (err: any) {
        console.warn("Camera initializer handled: ", err?.message || err);
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

    return () => {
      isDestroyed = true;
      stopCameraAndTracking();
      if (swipeTimeoutRef.current) clearTimeout(swipeTimeoutRef.current);
    };
  }, [loading, isActive, retryTrigger]);

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
    onResultsRef.current = null; // deactivate callbacks

    setRunning(false);
    hasSentHandPresenceRef.current = false;
    smoothedXRef.current = null;
    smoothedYRef.current = null;
    onHandUpdate(null);
  }

  const isDeviceInUse = permissionError?.includes("Device in use");

  return (
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
          <div className="flex items-center gap-1.5 text-[#c5a059] text-xs font-semibold animate-pulse font-serif tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI 手势探测中 (五指张开上色)</span>
          </div>
        ) : permissionError ? (
          <div className="flex items-center gap-1.5 text-orange-500 text-xs font-serif">
            <ShieldAlert className="w-3.5 h-3.5 text-orange-500" />
            <span>手势功能受限</span>
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

        {/* Animated Swipe Left Flash Overlay */}
        <AnimatePresence>
          {swipeTriggered && (
            <motion.div
              initial={{ opacity: 0, x: "100%" }}
              animate={{ opacity: 1, x: "0%" }}
              exit={{ opacity: 0, x: "-100%" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 bg-gradient-to-l from-transparent via-[#c5a059]/20 to-[#c5a059]/40 pointer-events-none flex items-center justify-center z-20 border border-[#c5a059]"
            >
              <div className="bg-[#0f0e0c]/85 border border-[#c5a059]/50 px-3 py-1.5 rounded-sm flex items-center gap-2 shadow-xl">
                <Sparkles className="w-3.5 h-3.5 text-[#c5a059] animate-spin" />
                <span className="text-[#c5a059] text-[11px] font-serif font-bold tracking-widest">📜 挥手徐来 莫高新章</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
              onClick={() => setRetryTrigger(prev => prev + 1)}
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
          <div className="absolute bottom-2 right-2 bg-[#c5a059]/90 px-2 py-0.5 rounded-sm text-[9px] text-[#0f0e0c] font-bold flex items-center gap-1 z-10">
            <CheckCircle className="w-2.5 h-2.5" /> Sensoring
          </div>
        )}
      </div>

      {/* Mini Hint Text */}
      <div className="mt-3.5 text-[11px] text-[#8b7e6a] text-center w-full leading-relaxed select-none font-serif">
        {running ? (
          <div className="bg-[#0f0e0c] py-2 px-3 rounded-xs border border-white/5">
            <div className="text-[#e0d8cf]">五指张开在镜头前移动上色</div>
            <div className="text-[#c5a059] mt-0.5">从右往左快速挥手无缝翻卷</div>
          </div>
        ) : (
          <div className="px-2 text-stone-400 text-[10px]">
            提示：隔空手势互动需要相机权限。如果已被禁用，请在浏览器地址栏（小锁图标）中启用，然后点击 [重新请求并重试] 重新触发生命周期。
          </div>
        )}
      </div>
    </div>
  );
}
