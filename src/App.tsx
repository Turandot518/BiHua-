/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { HandData, InteractionMode, DunhuangDayInfo } from "./types";
import { muralsData } from "./data";
import { audio } from "./utils/audio";
import MediaPipeGestureTracker from "./components/MediaPipeGestureTracker";
import MuralCanvas from "./components/MuralCanvas";
import MuralJigsaw from "./components/MuralJigsaw";
import StoryPopup from "./components/StoryPopup";
import MuralLibrary from "./components/MuralLibrary";
import MuralSplash from "./components/MuralSplash";
import MuralPhotoBooth from "./components/MuralPhotoBooth";
import CanvasErrorBoundary from "./components/CanvasErrorBoundary";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Camera,
  Layers,
  Volume2,
  VolumeX,
  HelpCircle,
  Paintbrush,
  Eye,
  RefreshCcw,
  Sliders,
  Play,
  ArrowRight,
  Compass,
  CheckCircle,
  X,
  Search,
  BookOpen,
  Grid
} from "lucide-react";

export default function App() {
  const [currentMuralIndex, setCurrentMuralIndex] = useState<number>(0);
  const [activeHand, setActiveHand] = useState<HandData | null>(null);
  
  // Settings
  const [isCameraEnabled, setIsCameraEnabled] = useState<boolean>(true);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("spotlight");
  const [brushSize, setBrushSize] = useState<number>(80);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  
  // Transitions
  const [transitionStyle, setTransitionStyle] = useState<"mist" | "zoom" | "parallax">("mist");

  const transitionVariants = {
    mist: {
      initial: { opacity: 0, scale: 0.95, filter: "blur(12px)", y: 15 },
      animate: { opacity: 1, scale: 1, filter: "blur(0px)", y: 0 },
      exit: { opacity: 0, scale: 1.05, filter: "blur(8px)", y: -15 },
      transition: { type: "tween", ease: "easeInOut", duration: 0.6 }
    },
    zoom: {
      initial: { opacity: 0, scale: 0.84, rotate: -0.5, y: 10 },
      animate: { opacity: 1, scale: 1, rotate: 0, y: 0 },
      exit: { opacity: 0, scale: 1.16, rotate: 0.5, y: -10 },
      transition: { type: "spring", stiffness: 70, damping: 15 }
    },
    parallax: {
      initial: { opacity: 0, x: 140, skewX: -4 },
      animate: { opacity: 1, x: 0, skewX: 0 },
      exit: { opacity: 0, x: -140, skewX: 4 },
      transition: { type: "spring", stiffness: 85, damping: 18 }
    }
  } as const;
  
  // Progress and story modals
  const [progress, setProgress] = useState<number>(0);
  const [storyOpen, setStoryOpen] = useState<boolean>(false);
  const [photoBoothOpen, setPhotoBoothOpen] = useState<boolean>(false);
  const [hasOpenedStory, setHasOpenedStory] = useState<boolean>(false);
  const [libraryOpen, setLibraryOpen] = useState<boolean>(false);
  const [swipeLockTimer, setSwipeLockTimer] = useState<number>(0);
  const [tutorialOpen, setTutorialOpen] = useState<boolean>(false);
  const [resetKey, setResetKey] = useState<number>(0);
  const [sidebarPortalEl, setSidebarPortalEl] = useState<HTMLDivElement | null>(null);

  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [preloadedImagesCount, setPreloadedImagesCount] = useState<number>(0);

  // Dynamic Google Search Grounding data for Duhuang timely culture
  const [dunhuangToday, setDunhuangToday] = useState<DunhuangDayInfo | null>(null);
  const [loadingToday, setLoadingToday] = useState<boolean>(true);
  const [surpriseTip, setSurpriseTip] = useState<string | null>(null);

  useEffect(() => {
    if (interactionMode === "paint") {
      setSurpriseTip("完成涂色有惊喜哦");
      const timer = setTimeout(() => {
        setSurpriseTip(null);
      }, 4000);
      return () => clearTimeout(timer);
    } else if (interactionMode === "jigsaw") {
      setSurpriseTip("完成拼图有惊喜哦");
      const timer = setTimeout(() => {
        setSurpriseTip(null);
      }, 4000);
      return () => clearTimeout(timer);
    } else {
      setSurpriseTip(null);
    }
  }, [interactionMode, currentMuralIndex]);

  useEffect(() => {
    fetch("/api/dunhuang-today")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setDunhuangToday(data.data);
        }
      })
      .catch((e) => {
        console.error("Error loading Dunhuang dynamic culture:", e);
      })
      .finally(() => {
        setLoadingToday(false);
      });
  }, []);

  // Background High-Performance Preloader for Dunhuang HD Murals
  useEffect(() => {
    let loadedCount = 0;
    const urls = muralsData.map((m) => {
      if (typeof m.imageSrc === "string") {
        return m.imageSrc;
      }
      return (m.imageSrc as any)?.default || (m.imageSrc as any)?.src || "";
    }).filter(Boolean);

    if (urls.length === 0) {
      setPreloadedImagesCount(5);
      return;
    }

    urls.forEach((url) => {
      // 1. Inject <link rel="preload"> dynamics at head level to warm up browser network pipe early
      try {
        const link = document.createElement("link");
        link.rel = "preload";
        link.as = "image";
        link.href = url;
        document.head.appendChild(link);
      } catch (e) {
        console.warn("Preload link failed to append:", e);
      }

      // 2. Perform concurrent raw Javascript image fetches to guarantee memory socket cache
      const img = new Image();
      img.onload = () => {
        loadedCount++;
        setPreloadedImagesCount(Math.min(urls.length, loadedCount));
      };
      img.onerror = () => {
        // Increment count even on error so splash transitions don't hang if one URL fails
        loadedCount++;
        setPreloadedImagesCount(Math.min(urls.length, loadedCount));
      };
      img.src = url;
    });
  }, []);

  // Immersive Mural Library Landing Screen States (Before Interactive Canvas)
  const [showLanding, setShowLanding] = useState<boolean>(true);
  const [landingSearchQuery, setLandingSearchQuery] = useState<string>("");
  const [landingDynastyFilter, setLandingDynastyFilter] = useState<string>("全部");
  const [previewMuralIndex, setPreviewMuralIndex] = useState<number>(0);

  const getDynastyCategory = (dynasty: string): string => {
    if (dynasty.includes("魏") || dynasty.includes("北")) return "北朝 (魏/晋)";
    if (dynasty.includes("唐") || dynasty.includes("隋")) return "隋唐盛世";
    if (dynasty.includes("夏") || dynasty.includes("五") || dynasty.includes("宋")) return "五代西夏";
    return "其他";
  };

  // Luxury traditional pigment swatches mapping
  const mineralPigments = [
    { name: "佛金砂", hex: "#c5a059", meaning: "纯金箔研泥，灿烂庄严" },
    { name: "赤朱砂", hex: "#b3322a", meaning: "天然辰砂，千年不变之艳红" },
    { name: "石青黛", hex: "#2e5c8a", meaning: "阿富汗进口青金石，深邃神圣" },
    { name: "孔雀石绿", hex: "#2f7a5b", meaning: "孔雀石研碎，苍翠灵动" },
    { name: "高岭白土", hex: "#f4f0ea", meaning: "高岭白垩土，玉润脱俗" }
  ];

  const getDynastyBadgeStyle = (dynasty: string): string => {
    if (dynasty.includes("唐") || dynasty.includes("隋")) {
      return "bg-[#b3322a]/15 text-[#e15b53] border-[#b3322a]/35";
    }
    if (dynasty.includes("魏") || dynasty.includes("北")) {
      return "bg-[#2f7a5b]/15 text-[#59cba6] border-[#2f7a5b]/35";
    }
    if (dynasty.includes("夏") || dynasty.includes("宋")) {
      return "bg-[#2e5c8a]/15 text-[#62a6e9] border-[#2e5c8a]/35";
    }
    return "bg-[#c5a059]/15 text-[#e5c17d] border-[#c5a059]/35";
  };

  const currentMural = muralsData[currentMuralIndex];

  // Lock hand gestures when entering story view to avoid accidental double-skips
  useEffect(() => {
    if (storyOpen) {
      setSwipeLockTimer(2); // 2 seconds cool-off lockout
      const interval = setInterval(() => {
        setSwipeLockTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setSwipeLockTimer(0);
    }
  }, [storyOpen]);

  // Effect to manage background audio enabled status and toggle the soothing background track
  useEffect(() => {
    audio.setBGMEnabled(audioEnabled);
  }, [audioEnabled]);

  // Support lazy initialization on first real user gesture
  useEffect(() => {
    const handleGesture = () => {
      if (audioEnabled) {
        audio.setBGMEnabled(true);
      }
    };
    window.addEventListener("click", handleGesture, { once: true });
    window.addEventListener("pointerdown", handleGesture, { once: true });
    return () => {
      window.removeEventListener("click", handleGesture);
      window.removeEventListener("pointerdown", handleGesture);
    };
  }, [audioEnabled]);

  // Hook swipe gestures from hand tracker inside frame
  useEffect(() => {
    if (activeHand && activeHand.isSwipeLeft) {
      if (storyOpen && swipeLockTimer === 0) {
        handleNextMural();
      }
    }
  }, [activeHand, storyOpen, swipeLockTimer]);

  // Autoplay or trigger success popups when murals reach 80% progress
  useEffect(() => {
    if (progress >= 80 && !storyOpen && !hasOpenedStory) {
      setStoryOpen(true);
      setHasOpenedStory(true);
      if (audioEnabled) {
        audio.playTempleBell();
      }
    }
  }, [progress, storyOpen, hasOpenedStory, audioEnabled]);

  const handleNextMural = () => {
    if (currentMuralIndex < muralsData.length - 1) {
      audio.playSwipeSound();
      setCurrentMuralIndex((prev) => prev + 1);
      setProgress(0);
      setStoryOpen(false);
      setHasOpenedStory(false);
      setResetKey((prev) => prev + 1);
    }
  };

  const handleRestartMural = () => {
    audio.playSwipeSound();
    setProgress(0);
    setStoryOpen(false);
    setHasOpenedStory(false);
    setResetKey((prev) => prev + 1);
  };

  const handleSelectMural = (index: number) => {
    setCurrentMuralIndex(index);
    setProgress(0);
    setStoryOpen(false);
    setHasOpenedStory(false);
    setResetKey((prev) => prev + 1);
  };

  const handlePlayGuzhengChimeRandom = () => {
    if (audioEnabled) {
      audio.playGuzhengPluck(Math.random());
    }
  };

  const handleStartRestorationFromLibrary = (index: number) => {
    setCurrentMuralIndex(index);
    setProgress(0);
    setStoryOpen(false);
    setHasOpenedStory(false);
    setResetKey((prev) => prev + 1);
    setShowLanding(false);
    setTutorialOpen(true);
    if (audioEnabled) {
      audio.playTempleBell();
    }
  };

  const handleReturnToLibrary = () => {
    setPreviewMuralIndex(currentMuralIndex);
    setShowLanding(true);
    if (audioEnabled) {
      audio.playChimes();
    }
  };

  const handleReturnToLibraryFromStory = () => {
    setStoryOpen(false);
    handleReturnToLibrary();
  };

  return (
    <div className="min-h-screen bg-[#0f0e0c] text-[#e0d8cf] flex flex-col selection:bg-[#c5a059]/30 selection:text-[#f5f2ed] font-serif relative overflow-x-hidden">
      
      {/* Background Texture Overlays matching the Warm Organic design HTML */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')] z-0"></div>
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-t from-black/40 via-transparent to-black/20 z-0"></div>
      
      {/* Dynamic Background Noise/Texture pattern representing sand/grit of caves */}
      <div className="absolute inset-0 bg-[radial-gradient(#c5a059_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.08] pointer-events-none z-0"></div>

      <AnimatePresence mode="wait">
        {showSplash ? (
          <MuralSplash
            key="splash-screen"
            onContinue={() => {
              setShowSplash(false);
            }}
            handData={activeHand}
            audioEnabled={audioEnabled}
            onToggleAudio={() => setAudioEnabled(!audioEnabled)}
            isCameraEnabled={isCameraEnabled}
            onToggleCamera={() => setIsCameraEnabled(!isCameraEnabled)}
            preloadedImagesCount={preloadedImagesCount}
            dunhuangToday={dunhuangToday}
          />
        ) : showLanding ? (
          <motion.div
            key="landing-screen"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex-1 w-full max-w-6xl mx-auto px-6 sm:px-12 py-10 flex flex-col z-10"
          >
            {/* Elegant Header for Material Library Landing */}
            <div className="flex flex-col md:flex-row items-center justify-between border-b border-[#c5a059]/20 pb-6 mb-8 gap-4 select-none relative">
              <div className="text-left flex-1">
                <div className="flex items-center gap-3 mb-1.5 justify-center md:justify-start">
                  <Compass className="w-5.5 h-5.5 text-[#c5a059] animate-spin-slow" />
                  <span className="text-[10px] tracking-[0.38em] text-[#c5a059] uppercase font-serif font-bold">
                    CLASSICAL DUNHUANG MURAL REPOSITORY
                  </span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-serif text-[#f5f2ed] tracking-widest font-normal text-center md:text-left drop-shadow-md dunhuang-title-lg">
                  敦古焕彩 <span className="font-sans font-light text-lg text-stone-500 ml-2 tracking-normal">数字化藏经阁素材库</span>
                </h2>
                <p className="text-[#8b7e6a] text-xs mt-3 text-center md:text-left leading-relaxed max-w-2xl font-serif">
                  精选莫高窟历代传世名作精品与其历史典故。在此抚拨民乐、品鉴骨法笔迹、赏析天然重彩墨砚，挑选心仪卷轴一键启封，步入交互复原空间。
                </p>
              </div>

              {/* Decorative silk riband banner display */}
              <div className="flex items-center gap-4 bg-[#14120f]/80 border border-[#c5a059]/15 p-3 rounded-xs shadow-inner">
                <div className="text-right hidden sm:block">
                  <span className="block text-[8px] text-[#8b7e6a] tracking-widest uppercase font-sans">EXPERIENCE ENVIRONMENT</span>
                  <span className="text-[11px] text-[#c5a059] font-serif font-medium">传统声乐：五声音调已载入</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAudioEnabled(prev => !prev);
                    audio.playGuzhengPluck(0.5);
                  }}
                  className={`p-3 rounded-xs border transition-all cursor-pointer ${
                    audioEnabled
                      ? "bg-[#c5a059]/15 border-[#c5a059]/40 text-[#c5a059] hover:bg-[#c5a059]/30"
                      : "bg-[#1a1815] border-white/10 text-[#8b7e6a]"
                  }`}
                  title={audioEnabled ? "已启用民乐合成音" : "已静音"}
                >
                  {audioEnabled ? <Volume2 className="w-4.5 h-4.5" /> : <VolumeX className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            {/* Real-time Google Search Grounded Culture Banner */}
            {dunhuangToday && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-6 p-3 px-4 rounded-xs bg-[#16120e]/95 border border-[#c5a059]/25 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs relative overflow-hidden pointer-events-auto"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-[#ff6459]" />
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-serif font-bold text-white bg-[#ff6459] rounded-sm tracking-wider uppercase">
                    {dunhuangToday.heading || "实时快讯"}
                  </span>
                  <div className="min-w-0 flex-1 md:flex md:items-center gap-3">
                    <span className="font-serif font-bold text-[#f5f2ed] tracking-wider shrink-0">
                      {dunhuangToday.title}
                      {dunhuangToday.dynasty && (
                        <span className="text-[10px] text-[#c5a059] ml-1.5 font-normal">({dunhuangToday.dynasty})</span>
                      )}
                    </span>
                    <span className="text-[#c6bdae] font-serif tracking-wide truncate block md:inline md:max-w-2xl select-text">
                      {dunhuangToday.content}
                    </span>
                  </div>
                </div>
                {dunhuangToday.source && (
                  <span className="shrink-0 text-[10px] text-[#8b7e6a] font-serif italic self-end md:self-auto select-all">
                    出处: {dunhuangToday.source}
                  </span>
                )}
              </motion.div>
            )}

            {/* Grand Unified Historical Mural Classification & Preservation Hall */}
            <div className="bg-[#14120f]/95 border border-[#c5a059]/20 p-5 sm:p-6 rounded-md mb-6 flex flex-col gap-6 select-none shadow-2xl relative overflow-hidden">
              {/* Decorative background accent line */}
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#c5a059]/40 to-transparent" />
              
              {/* Info Tips & Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#c5a059]/10">
                <div>
                  <h3 className="text-sm font-serif font-bold text-[#c5a059] tracking-widest flex items-center gap-1.5 flex-wrap">
                    <Compass className="w-4 h-4 animate-pulse" />
                    莫高名胜 · 壁画朝代历史分类
                  </h3>
                  <p className="text-[11px] text-[#8b7e6a] font-serif mt-1">
                    💡 <span className="text-[#c6bdae] font-semibold">筛选提示</span>：点击下方大屏分类按键，快速过滤并锁定对应时期的传世壁画；选定左侧任一画轴卡片，点击其右侧的「点击进入修复」按键即可开启。
                  </p>
                </div>
                
                {/* Search query input */}
                <div className="relative w-full md:max-w-xs shrink-0">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                  <input
                    type="text"
                    value={landingSearchQuery}
                    onChange={(e) => setLandingSearchQuery(e.target.value)}
                    placeholder="按名称、朝代、古窟或典故搜索..."
                    className="w-full pl-9 pr-10 py-1.5 text-xs bg-[#0f0e0c] text-[#f5f2ed] border border-[#c5a059]/15 rounded-sm placeholder-stone-600 focus:outline-none focus:border-[#c5a059]/50 transition-colors font-sans"
                  />
                  {landingSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setLandingSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 p-0.5 rounded-full"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Enlarged Classifications Buttons Grid / Choices */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { value: "全部", display: "全部历史朝代", sub: "历代传世名作精选" },
                  { value: "北朝 (魏/晋)", display: "北朝古风时期", sub: "魏晋南北朝 · 朴拙神秘" },
                  { value: "隋唐盛世", display: "隋唐繁盛之治", sub: "隋代至唐代 · 丰美艳丽" },
                  { value: "五代西夏", display: "五代宋夏岁月", sub: "宋/西夏/五代 · 典雅精细" }
                ].map((item) => {
                  const isSelected = landingDynastyFilter === item.value;
                  return (
                    <button
                      type="button"
                      key={item.value}
                      onClick={() => {
                        setLandingDynastyFilter(item.value);
                        if (audioEnabled) audio.playChimes();
                      }}
                      className={`relative flex flex-col items-center justify-center p-3 text-center border transition-all duration-200 cursor-pointer rounded-xs group ${
                        isSelected
                          ? "bg-[#c5a059]/15 border-[#c5a059] shadow-[0_4px_15px_rgba(197,160,89,0.18)]"
                          : "bg-[#090807] border-white/5 hover:border-[#c5a059]/35 hover:bg-[#11100e]"
                      }`}
                    >
                      {/* Selection indicator ornament */}
                      <span className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full transition-all ${isSelected ? "bg-[#c5a059] shadow-[0_0_6px_#c5a059] scale-110" : "bg-transparent scale-50"}`} />
                      
                      <span className={`text-xs font-serif font-bold tracking-widest transition-colors ${isSelected ? "text-[#c5a059]" : "text-[#c6bdae] group-hover:text-stone-100"}`}>
                        {item.display}
                      </span>
                      <span className={`text-[9px] font-sans mt-1.5 tracking-wide transition-colors ${isSelected ? "text-[#8b7e6a]" : "text-stone-500 group-hover:text-stone-400"}`}>
                        {item.sub}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Delicate division separator */}
              <div className="h-[1px] bg-gradient-to-r from-transparent via-[#c5a059]/15 to-transparent my-1" />

              {/* Immersive interactive material library display panels */}
            {(() => {
              const filteredLandingMurals = muralsData
                .map((m, idx) => ({ ...m, originalIndex: idx }))
                .filter((m) => {
                  if (landingDynastyFilter !== "全部") {
                    const category = getDynastyCategory(m.dynasty);
                    if (category !== landingDynastyFilter) return false;
                  }
                  if (!landingSearchQuery.trim()) return true;
                  const query = landingSearchQuery.toLowerCase();
                  return (
                    m.title.toLowerCase().includes(query) ||
                    m.cave.toLowerCase().includes(query) ||
                    m.dynasty.toLowerCase().includes(query) ||
                    m.storyTitle.toLowerCase().includes(query) ||
                    m.storyContent.toLowerCase().includes(query) ||
                    m.artStyle.toLowerCase().includes(query)
                  );
                });

              const activePreviewIndex = Math.min(
                previewMuralIndex,
                filteredLandingMurals.length > 0 ? filteredLandingMurals.length - 1 : 0
              );
              const previewMural = filteredLandingMurals[activePreviewIndex];

              return (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start flex-1 min-h-0">
                  {/* Left Column: Scrollable Cards Grid (col-span-5) */}
                  <div className="lg:col-span-5 flex flex-col gap-4 max-h-[60vh] lg:max-h-[65vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-stone-800 scrollbar-track-stone-950 font-serif">
                    {filteredLandingMurals.length > 0 ? (
                      filteredLandingMurals.map((mural, listIdx) => {
                        const isCurrentRestoring = currentMuralIndex === mural.originalIndex;
                        const isHighlighted = listIdx === activePreviewIndex;

                        return (
                          <motion.div
                            key={mural.id}
                            onClick={() => {
                              setPreviewMuralIndex(listIdx);
                              if (audioEnabled) audio.playChimes();
                            }}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.99 }}
                            className={`p-4 rounded-xs border transition-all cursor-pointer flex gap-4 items-center group relative select-none ${
                              isHighlighted
                                ? "bg-[#14120f]/90 border-[#c5a059] shadow-[0_0_15px_rgba(197,160,89,0.12)]"
                                : "bg-[#100f0d]/60 border-white/5 hover:border-[#c5a059]/40 hover:bg-[#12110e]"
                            }`}
                          >
                            {isCurrentRestoring && (
                              <div className="absolute top-0 right-0 bg-[#c5a059]/30 text-[#c5a059] border-l border-b border-[#c5a059]/40 text-[8px] tracking-wider uppercase font-semibold text-center px-1.5 py-0.5 rounded-bl-xs">
                                正在修复
                              </div>
                            )}

                            <div className="w-20 h-14 rounded-xs bg-[#0c0b09] overflow-hidden flex-shrink-0 border border-white/5 relative">
                              <img
                                src={mural.imageSrc}
                                alt={mural.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>

                            <div className="flex-1 min-w-0 text-left">
                              <span className={`px-2 py-0.5 text-[8px] font-sans border rounded-xs font-semibold mr-2 block w-fit mb-1 ${getDynastyBadgeStyle(mural.dynasty)}`}>
                                {mural.dynasty} · {mural.cave}
                              </span>
                              <h3 className="text-sm sm:text-base font-serif font-light text-[#f5f2ed] group-hover:text-[#c5a059] transition-colors truncate mt-0.5 font-serif">
                                {mural.title}
                              </h3>
                              <p className="text-stone-500 text-[10px] truncate max-w-sm mt-0.5 font-serif">
                                {mural.storyTitle}
                              </p>
                            </div>
                          </motion.div>
                        );
                      })
                    ) : (
                      <div className="text-center py-16 bg-[#12110f]/40 border border-white/5 rounded-xs flex flex-col items-center justify-center p-6 gap-3">
                        <Compass className="w-8 h-8 text-[#8b7e6a] animate-spin-slow" />
                        <p className="text-xs text-stone-500 max-w-xs leading-normal font-sans">
                          馆藏壁画中暂未检索到相关内容。请换用其他朝代（唐、魏）或关键词。
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setLandingSearchQuery("");
                            setLandingDynastyFilter("全部");
                            if (audioEnabled) audio.playChimes();
                          }}
                          className="px-3.5 py-1.5 mt-2 bg-[#1a1815] border border-[#c5a059]/30 text-xs text-[#c5a059] rounded-xs hover:bg-[#c5a059]/10 transition-colors cursor-pointer"
                        >
                          重置搜索条件
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Full Panel Preview Details (col-span-7) */}
                  <div className="lg:col-span-7 bg-[#13110e] border border-[#c5a059]/20 rounded-xs overflow-hidden flex flex-col shadow-2xl h-[60vh] lg:h-[65vh]">
                    {previewMural ? (
                      <div className="flex flex-col h-full overflow-y-auto scrollbar-thin scrollbar-thumb-stone-800 scrollbar-track-stone-950 font-serif">
                        <div className="h-44 sm:h-52 w-full relative bg-stone-950 flex-shrink-0 border-b border-white/5 overflow-hidden">
                          <img
                            src={previewMural.imageSrc}
                            alt={previewMural.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover animate-ribbon-wave"
                          />
                          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 text-left flex flex-col sm:flex-row sm:items-end justify-between gap-3 bg-gradient-to-t from-[#13110e] via-[#13110e]/60 to-transparent">
                            <div>
                              <span className={`px-2.5 py-0.5 text-[9px] font-sans border rounded-sm ${getDynastyBadgeStyle(previewMural.dynasty)}`}>
                                {previewMural.dynasty} · {previewMural.cave}
                              </span>
                              <h2 className="text-xl sm:text-2xl font-serif text-[#f5f2ed] tracking-wider mt-2.5 drop-shadow-lg font-serif">
                                {previewMural.title}
                              </h2>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleStartRestorationFromLibrary(previewMural.originalIndex)}
                              className="px-7 py-3.5 bg-[#c5a059] hover:bg-[#c5a059]/90 text-[#0f0e0c] font-serif font-extrabold text-sm sm:text-base rounded-md shadow-[0_6px_20px_rgba(197,160,89,0.45)] hover:shadow-[0_8px_25px_rgba(197,160,89,0.60)] active:scale-95 transition-all text-center flex items-center justify-center gap-2.5 cursor-pointer font-serif shrink-0 mb-0.5"
                            >
                              <Paintbrush className="w-4 h-4 sm:w-5 sm:h-5 text-current" />
                              <span>点击进入修复</span>
                            </button>
                          </div>
                        </div>

                        <div className="p-6 sm:p-8 flex-1 space-y-6 select-none text-left">
                          <div className="bg-[#181613]/90 p-5 rounded-xs border border-[#c5a059]/15 relative">
                            {/* Decorative traditional corner lines indicating a historic scroll paper */}
                            <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-[#c5a059]/40"></div>
                            <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-[#c5a059]/40"></div>
                            
                            <div className="flex items-center gap-1.5 text-[#c5a059] font-serif text-xs mb-2 font-semibold">
                              <BookOpen className="w-4 h-4" />
                              <span>历史因缘 · {previewMural.storyTitle}</span>
                            </div>
                            <p className="text-stone-400 text-xs leading-relaxed text-justify font-serif">
                              {previewMural.storyContent}
                            </p>
                          </div>

                          {/* Traditional Mineral Colors Palette display */}
                          <div className="border-t border-white/5 pt-4">
                            <span className="text-[10px] text-[#c5a059] uppercase tracking-widest font-serif font-bold block mb-2.5">🎨 莫高天然重彩矿物墨系</span>
                            <div className="flex flex-wrap gap-4 items-center bg-[#0d0c0a] p-3 rounded-xs border border-[#c5a059]/15">
                              {mineralPigments.map((p, pIdx) => (
                                <div key={pIdx} className="flex items-center gap-2 group cursor-help relative" title={p.meaning}>
                                  <div 
                                    className="w-4 h-4 rounded-full border border-white/10 shadow-[inner_0_1px_4px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:scale-125"
                                    style={{ backgroundColor: p.hex }}
                                  ></div>
                                  <span className="text-[11px] text-stone-400 group-hover:text-[#c5a059] font-serif transition-colors">
                                    {p.name}
                                  </span>
                                  {/* Beautiful absolute tooltips for organic high quality educational feel */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-36 bg-[#181613] border border-[#c5a059]/30 p-2 rounded-xs text-[9px] text-[#e0d8cf] leading-normal pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-25 shadow-2xl text-center font-serif">
                                    <span className="font-bold block text-[#c5a059] border-b border-white/5 pb-0.5 mb-1">{p.name}</span>
                                    {p.meaning}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4 border-t border-white/5">
                            <div>
                              <span className="text-stone-500 text-[10px] uppercase font-serif tracking-widest block mb-1">🖌️ 艺术手法与画论</span>
                              <p className="text-stone-400 text-[11px] leading-relaxed text-justify font-serif">
                                {previewMural.artStyle}
                              </p>
                            </div>
                            <div>
                              <span className="text-[#c5a059] text-[10px] uppercase font-serif tracking-widest block mb-1">🎨 矿物色彩构成</span>
                              <p className="text-stone-400 text-[11px] leading-relaxed text-justify font-serif">
                                {previewMural.colorExplanation}
                              </p>
                            </div>
                          </div>

                          <div className="border-t border-white/5 pt-5 pb-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-stone-500 font-sans">
                              <span>修复区：</span>
                              {previewMural.restoredAreas.slice(0, 3).map((area, areaIdx) => (
                                <span key={areaIdx} className="px-2 py-0.5 bg-[#0f0e0c] border border-white/5 text-stone-400 rounded-sm font-serif">
                                  {area}
                                </span>
                              ))}
                              {previewMural.restoredAreas.length > 3 && <span>...</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-stone-500 p-8 select-none text-center">
                        <Compass className="w-12 h-12 text-stone-700 mb-2 animate-spin-slow" />
                        <p className="text-xs font-serif">请在左侧列表中点选一件精美画卷以查看详情</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="interface-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-grow flex flex-col w-full"
          >
            {/* Primary Global Navbar */}
            <header className="relative z-20 border-b border-[#c5a059]/20 bg-[#070605]/95 backdrop-blur-md px-4 sm:px-6 md:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Brand Calligraph and logo titles */}
        <div className="flex items-center gap-4">
          <div className="relative w-11 h-11 rounded-full bg-gradient-to-tr from-[#1a1815] to-[#0f0e0c] flex items-center justify-center border border-[#c5a059]/30 shadow-[0_0_15px_rgba(197,160,89,0.15)]">
            <Compass className="w-5.5 h-5.5 text-[#c5a059] animate-spin-slow" />
            <div className="absolute -inset-0.5 border border-[#c5a059]/15 rounded-full animate-pulse"></div>
          </div>
          <div>
            <div className="flex flex-col">
              <span className="text-[10px] tracking-[0.34em] uppercase text-[#c5a059] mb-0.5 font-serif select-none">
                DIGITAL PRESERVATION PROJECT
              </span>
              <h1 className="text-2xl font-normal tracking-widest text-[#f5f2ed] flex items-center gap-2 dunhuang-title-lg">
                敦煌遗响 <span className="text-xs text-[#8b7e6a] font-sans tracking-normal uppercase hidden sm:inline-block font-thin">Echoes of Dunhuang</span>
              </h1>
            </div>
          </div>
        </div>

        {/* Global actions: Sound control, Tutorial help */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block select-none mr-4">
            <p className="text-xs tracking-widest text-[#c5a059] font-serif font-medium">{currentMural.cave} | {currentMural.dynasty}</p>
            <p className="text-[10px] text-[#8b7e6a] tracking-wider opacity-90">{currentMural.storyTitle}</p>
          </div>

          {/* Mural Asset Library button */}
          <button
            onClick={() => {
              setLibraryOpen(true);
              if (audioEnabled) audio.playChimes();
            }}
            className="px-4 py-2 text-xs bg-[#c5a059]/15 hover:bg-[#c5a059] text-[#c5a059] hover:text-[#0f0e0c] font-serif rounded-xs border border-[#c5a059]/40 active:scale-95 transition-all flex items-center gap-2 cursor-pointer font-bold shadow-[0_0_10px_rgba(197,160,89,0.1)]"
            title="浏览千载莫高与古文重彩素材库"
          >
            <span>📜 壁画素材库</span>
          </button>
          
          {/* Guzheng Synthesizer tester chime button */}
          <button
            onClick={handlePlayGuzhengChimeRandom}
            className="px-4 py-2 text-xs text-[#c5a059] hover:text-[#f5f2ed] font-serif bg-[#1a1815] hover:bg-[#c5a059]/10 rounded-xs border border-[#c5a059]/30 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>🏮 抚弦试音</span>
          </button>

          {/* Audio toggle */}
          <button
            onClick={() => {
              setAudioEnabled(prev => !prev);
              audio.playGuzhengPluck(0.5);
            }}
            className={`p-2.5 rounded-xs border transition-all cursor-pointer ${
              audioEnabled
                ? "bg-[#c5a059]/15 border-[#c5a059]/40 text-[#c5a059] hover:bg-[#c5a059]/25 hover:text-[#f5f2ed]"
                : "bg-[#1a1815] border-white/10 text-[#8b7e6a] hover:text-[#e0d8cf]"
            }`}
            title={audioEnabled ? "已启用民乐合成：轻触音律" : "已静音"}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Quick guide trigger */}
          <button
            onClick={() => setTutorialOpen(true)}
            className="p-2.5 bg-[#1a1815] hover:bg-[#c5a059]/10 border border-white/10 hover:border-[#c5a059]/30 rounded-xs text-[#8b7e6a] hover:text-[#e0d8cf] transition-all cursor-pointer"
            title="查看操作指南"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Core Body Segment */}
      <main className="flex-1 relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-4 flex flex-col lg:flex-row gap-5 items-start justify-center">
        
        {/* Left Column Section: Restoration Canvas Screen */}
        <div className="w-full lg:flex-1 flex flex-col gap-3">
          
          {/* Mural description card & active info banner */}
          <div className="bg-[#14120f] border border-[#c5a059]/20 rounded-xs p-3.5 flex flex-row items-center justify-between gap-4 select-none relative overflow-hidden shadow-lg">
            {/* Soft gold side strip */}
            <div className="absolute top-0 left-0 w-[3px] h-full bg-[#c5a059]"></div>
            
            <div className="pl-2">
              <span className="text-[9px] tracking-[0.25em] text-[#c5a059] font-serif uppercase font-semibold block leading-none">
                CURRENT SCENE / 临摹复原空间
              </span>
              <h2 className="text-base sm:text-lg font-serif text-[#f5f2ed] mt-1.5 flex items-center gap-2.5 dunhuang-title-lg leading-none">
                <span>{String(currentMuralIndex + 1).padStart(2, "0")} / {currentMural.title}</span>
                <span className={`text-[9px] font-sans px-1.5 py-0.5 rounded border ${getDynastyBadgeStyle(currentMural.dynasty)}`}>
                  {currentMural.cave} · {currentMural.dynasty}
                </span>
              </h2>
            </div>
            
            {/* Real-time slider progress HUD component */}
            <div className="flex items-center gap-3 pr-1">
              <div className="flex items-center gap-1.5 text-xs font-serif">
                <span className="text-[#8b7e6a] tracking-widest uppercase text-[9px]">修复进度</span>
                <span className="text-sm font-semibold text-[#f5f2ed]">{progress}%</span>
              </div>
              <div className="hidden xs:block w-32 bg-stone-950/80 h-[4px] rounded-full overflow-hidden p-0 border border-white/5 shadow-inner">
                <div
                  className="bg-[#c5a059] h-full transition-all duration-300 shadow-[0_0_8px_rgba(197,160,89,0.5)]"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Prominent Interaction Instructions */}
          <div className="bg-gradient-to-r from-[#1c1813] via-[#120f0c] to-[#1c1813] border border-[#c5a059]/40 rounded-xs p-3 md:p-4 text-center select-none shadow-[0_4px_15px_rgba(197,160,89,0.1)] relative overflow-hidden group">
            {/* Elegant glowing background element */}
            <div className="absolute inset-0 bg-[radial-gradient(#c5a059_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03] pointer-events-none"></div>
            
            <div className="relative z-10 flex flex-col items-center justify-center gap-1">
              {isCameraEnabled ? (
                <>
                  <div className="text-[#c5a059] text-base sm:text-lg md:text-xl font-bold tracking-widest leading-none flex items-center justify-center gap-2 font-serif">
                    <Sparkles className="w-4.5 h-4.5 text-[#c5a059] animate-pulse shrink-0" />
                    {interactionMode === "jigsaw" ? (
                      <span>握拳 / 双指捏合 · 隔空拖拽碎片</span>
                    ) : interactionMode === "spotlight" ? (
                      <span>五指张开 · 镜头前移动手势操控聚光灯</span>
                    ) : (
                      <span>五指张开 · 镜头前隔空挥洒彩墨</span>
                    )}
                  </div>
                  <div className="text-[#f5f2ed] text-xs sm:text-sm font-medium font-serif max-w-2xl leading-normal mt-0.5">
                    {interactionMode === "jigsaw" ? (
                      "在镜头前挥动五指移动，捏合五指（握拳）即可隔空抓取并放置碎片"
                    ) : interactionMode === "spotlight" ? (
                      "在摄像头前移动五指，操控聚光灯移动，照亮并探索古老壁画的深层细节"
                    ) : (
                      "在摄像头前轻柔挥动五指，即可拂去历史尘埃，还原千年彩绘"
                    )}
                  </div>
                  <div className="text-[#8b7e6a] text-[10px] mt-1 font-sans flex items-center gap-1.5 justify-center bg-[#0f0e0c]/65 px-2.5 py-0.5 rounded-full border border-white/5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>AI 感应已启用 · 建议距离摄像头 <strong className="text-[#c5a059]">0.5米 ~ 1.5米</strong> 交互效果最佳</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[#c5a059] text-base sm:text-lg md:text-xl font-bold tracking-widest leading-none flex items-center justify-center gap-2 font-serif">
                    <Sparkles className="w-4.5 h-4.5 text-[#c5a059] animate-pulse shrink-0" />
                    {interactionMode === "jigsaw" ? (
                      <span>鼠标按住拖拽 · 完美拼合壁画</span>
                    ) : interactionMode === "spotlight" ? (
                      <span>鼠标滑动移动 · 操控探索聚光灯</span>
                    ) : (
                      <span>鼠标滑动游走 · 勾勒复原彩绘</span>
                    )}
                  </div>
                  <div className="text-[#f5f2ed] text-xs sm:text-sm font-medium font-serif max-w-2xl leading-normal mt-0.5">
                    {interactionMode === "jigsaw" ? (
                      "按住鼠标左键并拖动碎片到中间正确底图区域，完美拼合古迹"
                    ) : interactionMode === "spotlight" ? (
                      "直接在画布上滑动鼠标或手指触摸，操控神奇的聚光灯，探索隐藏在岁月中精美的敦煌壁画故事与神采"
                    ) : (
                      "直接在画布上滑动鼠标或手指触摸，妙笔生花唤醒沉睡千年的中国彩绘"
                    )}
                  </div>
                  <div className="text-[#8b7e6a] text-[10px] mt-1 font-sans flex items-center gap-1.5 justify-center bg-[#0f0e0c]/65 px-2.5 py-0.5 rounded-full border border-white/5">
                    <span>💡 提示：可开启右上角 <strong className="text-[#c5a059]">“AI 隔空手势”</strong> 体验科幻手感！</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* The interactive Compositor Canvas element */}
          <div className="relative overflow-hidden w-full rounded-xs">
            {/* Surprise Tip overlay */}
            <AnimatePresence>
              {surpriseTip && (
                <motion.div
                  initial={{ opacity: 0, y: -15, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 15, scale: 0.92 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="absolute top-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none select-none max-w-[90%] text-center"
                >
                  <div className="bg-[#14120f]/95 border border-[#c5a059] px-6 py-2.5 rounded-full flex items-center justify-center gap-2.5 shadow-[0_8px_30px_rgba(197,160,89,0.35)] backdrop-blur-md">
                    <Sparkles className="w-4 h-4 text-[#c5a059] shrink-0 animate-pulse" />
                    <span className="text-[#f5f2ed] font-serif text-xs md:text-sm tracking-[0.15em] font-medium leading-none">
                      {surpriseTip}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <CanvasErrorBoundary fallbackKey={`${currentMuralIndex}-${interactionMode}-${resetKey}`}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${currentMuralIndex}-${interactionMode === "jigsaw" ? "jigsaw" : "canvas"}`}
                  initial={transitionVariants[transitionStyle].initial}
                  animate={transitionVariants[transitionStyle].animate}
                  exit={transitionVariants[transitionStyle].exit}
                  transition={transitionVariants[transitionStyle].transition}
                  className="w-full origin-center"
                >
                  {interactionMode === "jigsaw" ? (
                    <MuralJigsaw
                      imageSrc={currentMural.imageSrc}
                      muralTitle={currentMural.title}
                      dynasty={currentMural.dynasty}
                      cave={currentMural.cave}
                      handData={activeHand}
                      onComplete={() => {
                        setProgress(100);
                        setStoryOpen(true);
                        setHasOpenedStory(true);
                      }}
                      resetTrigger={resetKey}
                    />
                  ) : (
                    <MuralCanvas
                      imageSrc={currentMural.imageSrc}
                      handData={activeHand}
                      interactionMode={interactionMode === "spotlight" ? "spotlight" : "paint"}
                      brushSize={brushSize}
                      onProgressUpdate={setProgress}
                      resetTrigger={resetKey}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </CanvasErrorBoundary>
          </div>

          {/* Quick interactive shortcuts beneath the screen */}
          <div className="flex flex-wrap gap-4 items-center justify-between mt-2 bg-[#1a1815] p-4 rounded-xs border border-white/5 shadow-md">
            <div className="flex flex-wrap gap-3">
              <button
                onPointerDown={(e) => {
                  handleRestartMural();
                }}
                onClick={(e) => e.preventDefault()}
                className="px-4 py-2 bg-[#0f0e0c] hover:bg-[#c5a059]/15 border border-white/10 hover:border-[#c5a059]/40 rounded-xs text-[#b5a796] hover:text-[#f5f2ed] text-xs flex items-center gap-2 transition-all cursor-pointer font-serif"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                <span>重新上色复原</span>
              </button>
              
              <button
                onPointerDown={(e) => {
                  setInteractionMode("spotlight");
                  if (audioEnabled) audio.playChimes();
                }}
                onClick={(e) => e.preventDefault()}
                className={`px-4 py-2 border rounded-xs text-xs flex items-center gap-2 transition-all cursor-pointer font-serif ${
                  interactionMode === "spotlight"
                    ? "bg-[#c5a059] border-[#c5a059] text-[#0f0e0c] font-bold"
                    : "bg-[#0f0e0c] border-white/10 text-[#b5a796] hover:text-[#f5f2ed] hover:border-[#c5a059]/40"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>聚光探秘</span>
              </button>

              <button
                onPointerDown={(e) => {
                  setInteractionMode("paint");
                  if (audioEnabled) audio.playChimes();
                }}
                onClick={(e) => e.preventDefault()}
                className={`px-4 py-2 border rounded-xs text-xs flex items-center gap-2 transition-all cursor-pointer font-serif ${
                  interactionMode === "paint"
                    ? "bg-[#c5a059] border-[#c5a059] text-[#0f0e0c] font-bold"
                    : "bg-[#0f0e0c] border-white/10 text-[#b5a796] hover:text-[#f5f2ed] hover:border-[#c5a059]/40"
                }`}
              >
                <Paintbrush className="w-3.5 h-3.5" />
                <span>神笔随色</span>
              </button>

              <button
                onPointerDown={(e) => {
                  setInteractionMode("jigsaw");
                  if (audioEnabled) audio.playChimes();
                }}
                onClick={(e) => e.preventDefault()}
                className={`px-4 py-2 border rounded-xs text-xs flex items-center gap-2 transition-all cursor-pointer font-serif ${
                  interactionMode === "jigsaw"
                    ? "bg-[#c5a059] border-[#c5a059] text-[#0f0e0c] font-bold"
                    : "bg-[#0f0e0c] border-white/10 text-[#b5a796] hover:text-[#f5f2ed] hover:border-[#c5a059]/40"
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>古壁拼图</span>
              </button>

              <button
                onClick={() => {
                  setLibraryOpen(true);
                  if (audioEnabled) audio.playChimes();
                }}
                className="px-4 py-2 bg-[#1a1815] hover:bg-[#c5a059]/15 border border-[#c5a059]/30 hover:border-[#c5a059]/60 rounded-xs text-[#c5a059] hover:text-[#f5f2ed] text-xs flex items-center gap-2 transition-all cursor-pointer font-serif"
                title="打开千年古卷素材库，挑选其他壁画进行修复"
              >
                <Compass className="w-3.5 h-3.5 animate-spin-slow" />
                <span>选择其他古卷</span>
              </button>
            </div>

            {/* If mural completed, show explore results */}
            {progress >= 80 ? (
              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={() => setStoryOpen(true)}
                  className="px-4.5 py-2.5 bg-[#c5a059] hover:bg-[#c5a059]/90 text-[#0f0e0c] font-bold text-xs rounded-xs flex items-center gap-1.5 transition-all cursor-pointer tracking-wider"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>开启修复日志 · 《{currentMural.title}》</span>
                </button>

                <button
                  onClick={() => {
                    setPhotoBoothOpen(true);
                    if (audioEnabled) audio.playChimes();
                  }}
                  className="px-4.5 py-2.5 bg-[#b3322a] hover:bg-[#b3322a]/95 text-white font-serif font-bold text-xs rounded-xs flex items-center gap-1.5 transition-all cursor-pointer tracking-wider shadow-[0_4px_12px_rgba(179,50,42,0.3)]"
                  title="与本幅修复完成后的壁画进行合影，并下载精美信片"
                >
                  <Camera className="w-3.5 h-3.5 animate-bounce" />
                  <span>与壁画合影</span>
                </button>
              </div>
            ) : (
              <div className="text-[11px] text-[#8b7e6a] font-sans flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c5a059] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#c5a059]/80"></span>
                </span>
                <span>涂抹至 80% 以上可解说古物修复日志</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column Section: AI Camera control and settings panel */}
        <div className="w-full lg:w-[320px] flex flex-col gap-6">
          
          {/* AI Webcam controller wrapper */}
          <div className="bg-[#1a1815] border border-white/5 rounded-xs p-6 flex flex-col gap-4 shadow-lg">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-4.5 h-4.5 text-[#c5a059]" />
                <h3 className="text-sm font-serif font-bold text-[#f5f2ed] tracking-wider">AI 摄像头手势交互</h3>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isCameraEnabled}
                  onChange={(e) => {
                    setIsCameraEnabled(e.target.checked);
                    audio.playSwipeSound();
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-[#0f0e0c] peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-stone-400 after:border-stone-400 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#c5a059]"></div>
              </label>
            </div>

            <div ref={setSidebarPortalEl} className="w-full flex justify-center items-center" id="sidebar-camera-portal" />
          </div>

          {/* Interactive options & parameters widget */}
          <div className="bg-[#1a1815] border border-white/5 rounded-xs p-6 flex flex-col gap-5 select-none shadow-lg">
            
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <Sliders className="w-4.5 h-4.5 text-[#c5a059]" />
              <h3 className="text-sm font-serif font-bold text-[#f5f2ed] tracking-wider">点击下方切换玩法</h3>
            </div>

            {/* Brush restoration style selector */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-wider text-[#8b7e6a] font-serif">1. 交互核心模式</span>
              <div className="grid grid-cols-3 gap-1.5 bg-[#0f0e0c] p-1 rounded-xs border border-white/5">
                <button
                  onPointerDown={(e) => {
                    setInteractionMode("spotlight");
                    if (audioEnabled) audio.playChimes();
                  }}
                  onClick={(e) => e.preventDefault()}
                  className={`py-2 text-[10px] rounded-xs font-serif transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    interactionMode === "spotlight"
                      ? "bg-[#c5a059] text-[#0f0e0c] font-bold"
                      : "text-[#8b7e6a] hover:text-[#f5f2ed]"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>聚光探秘</span>
                </button>
                <button
                  onPointerDown={(e) => {
                    setInteractionMode("paint");
                    if (audioEnabled) audio.playChimes();
                  }}
                  onClick={(e) => e.preventDefault()}
                  className={`py-2 text-[10px] rounded-xs font-serif transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    interactionMode === "paint"
                      ? "bg-[#c5a059] text-[#0f0e0c] font-bold"
                      : "text-[#8b7e6a] hover:text-[#f5f2ed]"
                  }`}
                >
                  <Paintbrush className="w-3.5 h-3.5" />
                  <span>神笔随色</span>
                </button>
                <button
                  onPointerDown={(e) => {
                    setInteractionMode("jigsaw");
                    if (audioEnabled) audio.playChimes();
                  }}
                  onClick={(e) => e.preventDefault()}
                  className={`py-2 text-[10px] rounded-xs font-serif transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    interactionMode === "jigsaw"
                      ? "bg-[#c5a059] text-[#0f0e0c] font-bold"
                      : "text-[#8b7e6a] hover:text-[#f5f2ed]"
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>古壁拼图</span>
                </button>
              </div>
            </div>

            {/* Custom Brush Size Adjuster */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs">
                <span className="text-[10px] uppercase tracking-wider text-[#8b7e6a] font-serif">2. 手势/触碰感应半径</span>
                <span className="text-[#c5a059] font-mono font-bold">{brushSize}px</span>
              </div>
              <input
                type="range"
                min={40}
                max={150}
                value={brushSize}
                onChange={(e) => {
                  setBrushSize(Number(e.target.value));
                  if (audioEnabled && Math.random() > 0.8) {
                    audio.playGuzhengPluck(0.5);
                  }
                }}
                className="w-full accent-[#c5a059] bg-[#0f0e0c] h-1 rounded-sm cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#8b7e6a] font-sans">
                <span>微光(小)</span>
                <span>佛光万丈(大)</span>
              </div>
            </div>
          </div>
        </div>
      </main>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Narrative Classical Scroll story modal (for restored murals) */}
      <AnimatePresence>
        {storyOpen && (
          <StoryPopup
            mural={currentMural}
            isOpen={storyOpen}
            onClose={handleReturnToLibraryFromStory}
            onNext={handleNextMural}
            onRestart={handleRestartMural}
            isLastMural={currentMuralIndex === muralsData.length - 1}
            swipeLockTimer={swipeLockTimer}
            onReturnToLibrary={handleReturnToLibraryFromStory}
            onOpenPhotoBooth={() => {
              setStoryOpen(false);
              setPhotoBoothOpen(true);
            }}
          />
        )}
      </AnimatePresence>

      {/* Commemorative photo booth (莫高飞天合影镜) page overlay */}
      <AnimatePresence>
        {photoBoothOpen && (
          <MuralPhotoBooth
            mural={currentMural}
            isOpen={photoBoothOpen}
            onClose={() => setPhotoBoothOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Dynamic Material Asset Library sliding overlay drawer */}
      <AnimatePresence>
        {libraryOpen && (
          <MuralLibrary
            isOpen={libraryOpen}
            onClose={() => setLibraryOpen(false)}
            currentMuralIndex={currentMuralIndex}
            onSelectMural={handleSelectMural}
            audioEnabled={audioEnabled}
          />
        )}
      </AnimatePresence>

      {/* Onboarding Interactive Instructions modal */}
      <AnimatePresence>
        {tutorialOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f0e0c]/95 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="relative w-full max-w-3xl bg-[#1a1815] border border-[#c5a059]/40 rounded-sm p-8 shadow-2xl text-[#e0d8cf] text-center"
            >
              {/* Decorative Corner borders of cultural template */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#c5a059]/30"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#c5a059]/30"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#c5a059]/30"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#c5a059]/30"></div>

              {/* Close icon */}
              <button
                onClick={() => setTutorialOpen(false)}
                className="absolute top-4 right-4 text-[#8b7e6a] hover:text-[#f5f2ed] p-1.5 hover:bg-[#0f0e0c] rounded-full transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-16 h-16 bg-[#c5a059]/10 rounded-full flex items-center justify-center border border-[#c5a059]/30 mx-auto mb-4 animate-pulse">
                <Sparkles className="w-7 h-7 text-[#c5a059]" />
              </div>

              <span className="text-[10px] tracking-[0.3em] uppercase text-[#c5a059] block mb-1">Interactive Exhibition Guide</span>
              <h2 className="text-2xl font-serif text-[#f5f2ed] mb-3 font-light tracking-widest dunhuang-title-lg">
                莫高寻色 · 数字化互动指南
              </h2>
              <p className="text-[#b5a796] text-xs leading-relaxed max-w-xl mx-auto mb-6 font-serif">
                欢迎您化身为敦煌艺术数字化保护专家。由于古窟千载风沙浸润，经卷色泽渐归淡雅纯素。请以轻拂灵动之姿，挥手拨筝，临摹出古画本真辉煌色泽！
              </p>

              {/* Steps grid showing all 3 interaction modes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left max-w-3xl mx-auto mb-6">
                
                {/* Gameplay Mode 1 */}
                <div className="bg-[#0f0e0c] p-4 border border-[#c5a059]/15 rounded-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 text-[#c5a059] font-serif font-bold text-xs select-none">
                      <span>👁️</span>
                      <span>聚光探秘 (神引烛照)</span>
                    </div>
                    <ul className="text-[11px] text-[#b5a796] space-y-1.5 list-disc pl-3 font-serif leading-relaxed">
                      <li>对准屏幕并在空中<b>移动手掌/准星</b></li>
                      <li>保持<b>手掌舒开</b>即可投射探索光环</li>
                      <li>穿透斑驳微尘，探秘隐匿起线与底色</li>
                    </ul>
                  </div>
                </div>

                {/* Gameplay Mode 2 */}
                <div className="bg-[#0f0e0c] p-4 border border-[#c5a059]/15 rounded-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 text-[#c5a059] font-serif font-bold text-xs select-none">
                      <span>🎨</span>
                      <span>神笔随色 (极色重光)</span>
                    </div>
                    <ul className="text-[11px] text-[#b5a796] space-y-1.5 list-disc pl-3 font-serif leading-relaxed">
                      <li>允许浏览器开启<b>摄像头</b>权限</li>
                      <li>在对焦点前<b>张开五指</b>并轻缓移动</li>
                      <li>挥洒天然重彩，拂尘还原壁画真色彩</li>
                    </ul>
                  </div>
                </div>

                {/* Gameplay Mode 3 */}
                <div className="bg-[#0f0e0c] p-4 border border-[#c5a059]/15 rounded-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 text-[#c5a059] font-serif font-bold text-xs select-none">
                      <span>🧩</span>
                      <span>古极拼图 (千丝碎拼)</span>
                    </div>
                    <ul className="text-[11px] text-[#b5a796] space-y-1.5 list-disc pl-3 font-serif leading-relaxed">
                      <li>在散落割裂的残片上<b>握拳/合拢手指</b></li>
                      <li>拖移吸附的古典碎瓣，归至正确底盘</li>
                      <li><b>松开手掌</b>自动磁吸拼合，疗愈缝痕</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Swipe transition visual tip */}
              <div className="bg-[#c5a059]/10 border border-[#c5a059]/30 p-3.5 rounded-xs max-w-3xl mx-auto mb-6 text-[11px] text-[#c5a059] leading-relaxed font-serif text-justify">
                <b>👉 隔空翻卷：</b>上色、探索或拼图进度达到 <b>88%</b> 以上，通过手势<b>自右向左快速空挥</b>，使画卷凭风平移，登临下一朝代之敦煌圣景。
              </div>

              <button
                onClick={() => {
                  setTutorialOpen(false);
                  audio.playTempleBell();
                }}
                className="w-full sm:w-auto px-8 py-3 bg-[#c5a059] hover:bg-[#c5a059]/90 text-[#0f0e0c] font-serif font-bold text-sm rounded-xs tracking-widest transition-all cursor-pointer shadow-lg"
              >
                开启数字化上色之旅
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Single, permanently mounted MediaPipe Gesture Tracker to avoid double-stream contexts and WebGL crashes */}
      {isCameraEnabled && (
        <MediaPipeGestureTracker
          onHandUpdate={setActiveHand}
          isActive={isCameraEnabled}
          portalTarget={(!showSplash && !showLanding) ? sidebarPortalEl : null}
        />
      )}

      {/* Absolute Bottom Decorative Border */}
      {!showSplash && !showLanding && (
        <footer className="mt-auto border-t border-[#c5a059]/15 bg-[#0a0907] py-6 text-center select-none flex flex-col items-center justify-center gap-1.5 relative overflow-hidden">
          {/* Decorative dynamic top divider line */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#c5a059]/30 to-transparent"></div>
          
          {/* Digital preservation brand title */}
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[11px] text-[#c5a059]/90 font-serif tracking-[0.26em] text-xs">
              莫高藏经 · 千年华壁数字化复原
            </span>
          </div>

          <p className="text-[10px] font-serif text-[#8b7e6a] tracking-[0.3em] uppercase">
            ECHOES OF DUNHUANG · DIGITAL PRESERVATION GROUP
          </p>
          <p className="text-[9px] font-sans text-stone-600 tracking-wider">
            国家级数字资产传承示范系统 v2.0 · 莫高窟学术保护委员会监制
          </p>
        </footer>
      )}
    </div>
  );
}
