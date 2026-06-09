/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { HandData, InteractionMode } from "./types";
import { muralsData } from "./data";
import { audio } from "./utils/audio";
import MediaPipeGestureTracker from "./components/MediaPipeGestureTracker";
import MuralCanvas from "./components/MuralCanvas";
import MuralJigsaw from "./components/MuralJigsaw";
import StoryPopup from "./components/StoryPopup";
import MuralLibrary from "./components/MuralLibrary";
import MuralSplash from "./components/MuralSplash";
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
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("paint");
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
  };
  
  // Progress and story modals
  const [progress, setProgress] = useState<number>(0);
  const [storyOpen, setStoryOpen] = useState<boolean>(false);
  const [hasOpenedStory, setHasOpenedStory] = useState<boolean>(false);
  const [libraryOpen, setLibraryOpen] = useState<boolean>(false);
  const [swipeLockTimer, setSwipeLockTimer] = useState<number>(0);
  const [tutorialOpen, setTutorialOpen] = useState<boolean>(false);
  const [resetKey, setResetKey] = useState<number>(0);

  const [showSplash, setShowSplash] = useState<boolean>(true);

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
            <div className="flex flex-col md:flex-row items-center justify-between border-b border-white/10 pb-6 mb-8 gap-4 select-none">
              <div className="text-left">
                <div className="flex items-center gap-2 mb-1.5 justify-center md:justify-start">
                  <Compass className="w-5 h-5 text-[#c5a059] animate-spin-slow" />
                  <span className="text-[10px] tracking-[0.34em] text-[#c5a059] uppercase font-serif font-semibold">
                    CLASSICAL DUNHUANG MURAL REPOSITORY
                  </span>
                </div>
                <h2 className="text-3xl font-serif text-[#f5f2ed] tracking-widest font-light text-center md:text-left">
                  敦古焕彩 · 数字化藏经阁素材库
                </h2>
                <p className="text-[#8b7e6a] text-xs mt-2 text-center md:text-left leading-relaxed max-w-xl">
                  精选莫高窟各朝代传世佳作与其历史典故。在此搜寻仙乐奇珍、品鉴骨法笔迹、赏析天然矿物色彩，挑选心仪画卷一键启封，步入互动修复。
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Audio controls for landing screen */}
                <button
                  type="button"
                  onClick={() => {
                    setAudioEnabled(prev => !prev);
                    audio.playGuzhengPluck(0.5);
                  }}
                  className={`p-2.5 rounded-xs border transition-all cursor-pointer ${
                    audioEnabled
                      ? "bg-[#c5a059]/15 border-[#c5a059]/40 text-[#c5a059]"
                      : "bg-[#1a1815] border-white/10 text-[#8b7e6a]"
                  }`}
                  title={audioEnabled ? "已启用民乐" : "已静音"}
                >
                  {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Filters and Search Bar Row */}
            <div className="bg-[#1a1815] border border-white/5 p-4 rounded-xs mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 select-none">
              <div className="flex flex-wrap items-center gap-2">
                {["全部", "北朝 (魏/晋)", "隋唐盛世", "五代西夏"].map((group) => (
                  <button
                    type="button"
                    key={group}
                    onClick={() => {
                      setLandingDynastyFilter(group);
                      if (audioEnabled) audio.playChimes();
                    }}
                    className={`px-4 py-2 text-xs font-serif rounded-xs border transition-all cursor-pointer ${
                      landingDynastyFilter === group
                        ? "bg-[#c5a059] border-[#c5a059] text-[#0f0e0c] font-semibold shadow-md"
                        : "bg-[#0f0e0c] border-white/10 text-[#8b7e6a] hover:text-[#f5f2ed] hover:border-[#c5a059]/40"
                    }`}
                  >
                    {group}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 md:max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                <input
                  type="text"
                  value={landingSearchQuery}
                  onChange={(e) => setLandingSearchQuery(e.target.value)}
                  placeholder="搜索壁画名、朝代、古窟或背景故事..."
                  className="w-full pl-10 pr-10 py-2 text-xs bg-[#0f0e0c] text-[#f5f2ed] border border-white/10 rounded-xs placeholder-stone-500 focus:outline-none focus:border-[#c5a059]/60 transition-colors font-sans"
                />
                {landingSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setLandingSearchQuery("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 p-0.5 rounded-full"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

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
                                ? "bg-[#14120f]/80 border-[#c5a059] shadow-[0_0_15px_rgba(197,160,89,0.1)]"
                                : "bg-[#100f0d] border-white/5 hover:border-[#c5a059]/40 hover:bg-[#12110e]"
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
                              <span className="text-[10px] font-sans text-[#c5a059] tracking-wider block">
                                {mural.dynasty} · {mural.cave}
                              </span>
                              <h3 className="text-sm sm:text-base font-serif font-light text-[#f5f2ed] group-hover:text-[#c5a059] transition-colors truncate mt-0.5 font-serif">
                                {mural.title}
                              </h3>
                              <p className="text-stone-500 text-[10px] truncate max-w-sm mt-0.5">
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
                  <div className="lg:col-span-7 bg-[#13110e] border border-white/5 rounded-xs overflow-hidden flex flex-col shadow-2xl h-[60vh] lg:h-[65vh]">
                    {previewMural ? (
                      <div className="flex flex-col h-full overflow-y-auto scrollbar-thin scrollbar-thumb-stone-800 scrollbar-track-stone-950 font-serif">
                        <div className="h-44 sm:h-52 w-full relative bg-stone-950 flex-shrink-0 border-b border-white/5 overflow-hidden">
                          <img
                            src={previewMural.imageSrc}
                            alt={previewMural.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#13110e] via-[#13110e]/30 to-transparent"></div>
                          
                          <div className="absolute bottom-4 left-6 right-6 text-left">
                            <span className="px-2.5 py-0.5 text-[9px] font-sans rounded-xs bg-[#c5a059]/20 border border-[#c5a059]/40 text-[#c5a059] uppercase">
                              {previewMural.dynasty} · {previewMural.cave}
                            </span>
                            <h2 className="text-xl sm:text-2xl font-serif text-[#f5f2ed] tracking-wider mt-1.5 drop-shadow-lg font-serif">
                              {previewMural.title}
                            </h2>
                          </div>
                        </div>

                        <div className="p-6 sm:p-8 flex-1 space-y-5 select-none text-left">
                          <div>
                            <div className="flex items-center gap-1.5 text-[#c5a059] font-serif text-xs mb-1.5 font-semibold font-serif">
                              <BookOpen className="w-4 h-4" />
                              <span>历史因缘 · {previewMural.storyTitle}</span>
                            </div>
                            <p className="text-stone-400 text-xs leading-relaxed text-justify font-sans">
                              {previewMural.storyContent}
                            </p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4 border-t border-white/5">
                            <div>
                              <span className="text-stone-500 text-[10px] uppercase font-serif tracking-widest block mb-1">🖌️ 艺术手法与画论</span>
                              <p className="text-stone-400 text-[11px] leading-relaxed text-justify font-sans">
                                {previewMural.artStyle}
                              </p>
                            </div>
                            <div>
                              <span className="text-[#c5a059] text-[10px] uppercase font-serif tracking-widest block mb-1">🎨 矿物色彩构成</span>
                              <p className="text-stone-400 text-[11px] leading-relaxed text-justify font-sans">
                                {previewMural.colorExplanation}
                              </p>
                            </div>
                          </div>

                          <div className="border-t border-white/5 pt-5 pb-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-stone-500 font-sans">
                              <span>修复区：</span>
                              {previewMural.restoredAreas.slice(0, 3).map((area, areaIdx) => (
                                <span key={areaIdx} className="px-2 py-0.5 bg-[#0f0e0c] border border-white/5 text-stone-400 rounded-sm">
                                  {area}
                                </span>
                              ))}
                              {previewMural.restoredAreas.length > 3 && <span>...</span>}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleStartRestorationFromLibrary(previewMural.originalIndex)}
                              className="px-6 py-2.5 bg-[#c5a059] hover:bg-[#c5a059]/90 text-[#0f0e0c] font-serif font-bold text-xs rounded-xs shadow-[0_4px_14px_rgba(197,160,89,0.25)] hover:shadow-[0_6px_20px_rgba(197,160,89,0.35)] active:scale-95 transition-all text-center flex items-center justify-center gap-2 cursor-pointer font-serif"
                            >
                              <Paintbrush className="w-3.5 h-3.5" />
                              <span>启封此卷 · 开始复原</span>
                            </button>
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
            <header className="relative z-20 border-b border-white/10 bg-[#0f0e0c]/90 backdrop-blur-md px-12 pt-8 pb-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Brand Calligraph and logo titles */}
        <div className="flex items-center gap-4">
          <div className="relative w-11 h-11 rounded-full bg-gradient-to-tr from-[#1a1815] to-[#0f0e0c] flex items-center justify-center border border-[#c5a059]/30 shadow-[0_0_15px_rgba(197,160,89,0.15)]">
            <Compass className="w-5.5 h-5.5 text-[#c5a059] animate-spin-slow" />
            <div className="absolute -inset-0.5 border border-[#c5a059]/10 rounded-full animate-pulse"></div>
          </div>
          <div>
            <div className="flex flex-col">
              <span className="text-[10px] tracking-[0.3em] uppercase text-[#c5a059] mb-0.5 font-serif select-none">
                DIGITAL PRESERVATION PROJECT
              </span>
              <h1 className="text-2xl font-light tracking-widest text-[#f5f2ed] flex items-center gap-3">
                敦煌遗响 <span className="text-sm text-[#8b7e6a] font-sans tracking-normal uppercase hidden sm:inline-block">Echoes of Dunhuang</span>
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
      <main className="flex-1 relative z-10 w-full max-w-7xl mx-auto px-12 py-8 flex flex-col lg:flex-row gap-8 items-start justify-center">
        
        {/* Left Column Section: Restoration Canvas Screen */}
        <div className="w-full lg:flex-1 flex flex-col gap-6">
          
          {/* Mural description card & active info banner */}
          <div className="bg-[#1a1815] border border-white/5 rounded-xs p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 select-none relative overflow-hidden shadow-xl">
            {/* Soft gold side strip */}
            <div className="absolute top-0 left-0 w-[3px] h-full bg-[#c5a059]"></div>
            
            <div className="pl-3">
              <p className="text-[10px] tracking-[0.25em] text-[#c5a059] font-serif uppercase font-semibold">
                CURRENT SCENE / 临摹复原空间
              </p>
              <h2 className="text-xl sm:text-2xl font-serif text-[#f5f2ed] mt-1.5 flex items-center gap-3">
                <span>{String(currentMuralIndex + 1).padStart(2, "0")} / {currentMural.title}</span>
                <span className="text-[11px] font-sans px-2.5 py-0.5 rounded border border-[#c5a059]/20 bg-[#c5a059]/5 text-[#c5a059]">
                  {currentMural.cave}
                </span>
              </h2>
            </div>
            
            {/* Real-time slider progress HUD component */}
            <div className="flex flex-col sm:items-end gap-2 pr-2">
              <div className="flex items-center gap-3 text-xs font-serif">
                <span className="text-[#8b7e6a] tracking-widest uppercase text-[10px]">Restoration Progress</span>
                <span className="text-lg font-light text-[#f5f2ed]">{progress}%</span>
              </div>
              <div className="w-full sm:w-48 bg-stone-950/80 h-[3px] rounded-full overflow-hidden p-0 border border-white/5 shadow-inner">
                <div
                  className="bg-[#c5a059] h-full transition-all duration-300 shadow-[0_0_8px_rgba(197,160,89,0.5)]"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* The interactive Compositor Canvas element */}
          <div className="relative overflow-hidden w-full rounded-xs">
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
          </div>

          {/* Quick interactive shortcuts beneath the screen */}
          <div className="flex flex-wrap gap-4 items-center justify-between mt-2 bg-[#1a1815] p-4 rounded-xs border border-white/5 shadow-md">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleRestartMural}
                className="px-4 py-2 bg-[#0f0e0c] hover:bg-[#c5a059]/15 border border-white/10 hover:border-[#c5a059]/40 rounded-xs text-[#b5a796] hover:text-[#f5f2ed] text-xs flex items-center gap-2 transition-all cursor-pointer font-serif"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                <span>重新上色复原</span>
              </button>
              
              <button
                onClick={() => {
                  setInteractionMode("paint");
                  if (audioEnabled) audio.playChimes();
                }}
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
                onClick={() => {
                  setInteractionMode("spotlight");
                  if (audioEnabled) audio.playChimes();
                }}
                className={`px-4 py-2 border rounded-xs text-xs flex items-center gap-2 transition-all cursor-pointer font-serif ${
                  interactionMode === "spotlight"
                    ? "bg-[#c5a059] border-[#c5a059] text-[#0f0e0c] font-bold"
                    : "bg-[#0f0e0c] border-white/10 text-[#b5a796] hover:text-[#f5f2ed] hover:border-[#c5a059]/40"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>聚光探索</span>
              </button>

              <button
                onClick={() => {
                  setInteractionMode("jigsaw");
                  if (audioEnabled) audio.playChimes();
                }}
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
              <button
                onClick={() => setStoryOpen(true)}
                className="px-5 py-2.5 bg-[#c5a059] hover:bg-[#c5a059]/90 text-[#0f0e0c] font-bold text-xs rounded-xs flex items-center gap-2 transition-all cursor-pointer tracking-wider"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>开启修复日志 · 《{currentMural.title}》</span>
              </button>
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

            <MediaPipeGestureTracker
              onHandUpdate={setActiveHand}
              isActive={isCameraEnabled}
            />
          </div>

          {/* Interactive options & parameters widget */}
          <div className="bg-[#1a1815] border border-white/5 rounded-xs p-6 flex flex-col gap-5 select-none shadow-lg">
            
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <Sliders className="w-4.5 h-4.5 text-[#c5a059]" />
              <h3 className="text-sm font-serif font-bold text-[#f5f2ed] tracking-wider">交互参数校准</h3>
            </div>

            {/* Brush restoration style selector */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-wider text-[#8b7e6a] font-serif">1. 交互核心模式</span>
              <div className="grid grid-cols-3 gap-1.5 bg-[#0f0e0c] p-1 rounded-xs border border-white/5">
                <button
                  onClick={() => {
                    setInteractionMode("paint");
                    if (audioEnabled) audio.playChimes();
                  }}
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
                  onClick={() => {
                    setInteractionMode("spotlight");
                    if (audioEnabled) audio.playChimes();
                  }}
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
                  onClick={() => {
                    setInteractionMode("jigsaw");
                    if (audioEnabled) audio.playChimes();
                  }}
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

            {/* Custom Transition Style Controller */}
            <div className="flex flex-col gap-2 border-t border-white/5 pt-4">
              <span className="text-[10px] uppercase tracking-wider text-[#8b7e6a] font-serif">3. 莫高变景画卷过渡 (探索转场特效)</span>
              <div className="grid grid-cols-3 gap-1.5 bg-[#0f0e0c] p-1 rounded-sm border border-white/5 font-sans">
                <button
                  onClick={() => {
                    setTransitionStyle("mist");
                    if (audioEnabled) audio.playChimes();
                  }}
                  className={`py-1.5 text-[10px] rounded-xs font-serif transition-colors flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    transitionStyle === "mist"
                      ? "bg-[#c5a059] text-[#0f0e0c] font-bold"
                      : "text-stone-400 hover:text-stone-200"
                  }`}
                  title="沙湮雾释：结合了金沙流转与雾气消解的华丽微缩粒子感与平滑高斯模糊"
                >
                  <span>雾消沙释</span>
                </button>
                <button
                  onClick={() => {
                    setTransitionStyle("zoom");
                    if (audioEnabled) audio.playChimes();
                  }}
                  className={`py-1.5 text-[10px] rounded-xs font-serif transition-colors flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    transitionStyle === "zoom"
                      ? "bg-[#c5a059] text-[#0f0e0c] font-bold"
                      : "text-stone-400 hover:text-stone-200"
                  }`}
                  title="极境深透：仿若移步走进深邃古窟，极具空间视差深度的缩放回旋"
                >
                  <span>极境深透</span>
                </button>
                <button
                  onClick={() => {
                    setTransitionStyle("parallax");
                    if (audioEnabled) audio.playChimes();
                  }}
                  className={`py-1.5 text-[10px] rounded-xs font-serif transition-colors flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    transitionStyle === "parallax"
                      ? "bg-[#c5a059] text-[#0f0e0c] font-bold"
                      : "text-stone-400 hover:text-stone-200"
                  }`}
                  title="丝卷平移：丝绸平滑倾斜滑卷，重现拉开历史长卷的视差卷轴感"
                >
                  <span>丝卷平移</span>
                </button>
              </div>
              <p className="text-[10px] text-[#8b7e6a] leading-normal font-sans text-stone-500">
                {transitionStyle === "mist" && "✨ 佛国金沙般高斯模糊溶散，还原敦煌特有的尘沙漫漫效果。"}
                {transitionStyle === "zoom" && "🔍 弹性镜头推拉与深邃回旋，如穿越佛龛古阁，神界呼之欲出。"}
                {transitionStyle === "parallax" && "📜 经典山水长卷平滑卷轴平移，附带倾斜视差，气势非凡。"}
              </p>
            </div>

            {/* Pentatonic Scale Synthesizer information */}
            <div className="bg-[#0f0e0c] border border-[#c5a059]/20 rounded-xs p-4 flex gap-3 items-start">
              <div className="text-lg">🏮</div>
              <div className="flex-1 text-[11px] text-[#b5a796] leading-relaxed font-sans">
                <span className="text-[#c5a059] font-semibold font-serif block mb-0.5">敦煌古风舒缓乐章合成室：</span>
                {audioEnabled ? (
                  "载入纯正五声音韵，已开启舒缓悠扬的莫高窟空灵背景乐。低沉佛堂木铎、古竹埙颤音与丝缕驼铃、古筝在耳边低吟，音律优雅，神迹随指勾彩。"
                ) : (
                  "古乐器鸣奏与背景乐已静音。可轻触上方提灯恢复空灵舒缓的敦煌丝竹声乐体验。"
                )}
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
              className="relative w-full max-w-lg bg-[#1a1815] border border-[#c5a059]/40 rounded-sm p-8 shadow-2xl text-[#e0d8cf] text-center"
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
              <h2 className="text-2xl font-serif text-[#f5f2ed] mb-3 font-light tracking-widest">
                莫高寻色 · 数字化互动指南
              </h2>
              <p className="text-[#b5a796] text-xs leading-relaxed max-w-sm mx-auto mb-6 font-sans">
                欢迎您化身为敦煌艺术数字化保护专家。由于古窟千载风沙浸润，经卷色泽渐归淡雅纯素。请以轻拂灵动之姿，挥手拨筝，临摹出古画本真辉煌色泽！
              </p>

              {/* Steps grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left max-w-md mx-auto mb-6">
                
                {/* Mode 1 */}
                <div className="bg-[#0f0e0c] p-4 border border-white/5 rounded-xs">
                  <div className="flex items-center gap-1.5 mb-2 text-[#c5a059] font-serif font-bold text-xs select-none">
                    <span>🖐️</span>
                    <span>神笔复原 (五指张开)</span>
                  </div>
                  <ul className="text-[11px] text-[#b5a796] space-y-1.5 list-disc pl-3 font-sans leading-relaxed">
                    <li>允许浏览器开启<b>摄像头</b>权限</li>
                    <li>在对焦点前<b>张开五指</b>并轻缓移动</li>
                    <li>拂去历史尘砂，唤醒敦煌本真矿彩</li>
                  </ul>
                </div>

                {/* Mode 2 */}
                <div className="bg-[#0f0e0c] p-4 border border-white/5 rounded-xs">
                  <div className="flex items-center gap-1.5 mb-2 text-[#c5a059] font-serif font-bold text-xs select-none">
                    <span>📜</span>
                    <span>隔空翻卷 (快速挥扫)</span>
                  </div>
                  <ul className="text-[11px] text-[#b5a796] space-y-1.5 list-disc pl-3 font-sans leading-relaxed">
                    <li>复原进度达到 <b>88%</b> 以上</li>
                    <li>通过手势<b>自右向左快速空挥</b></li>
                    <li>画卷随风平移，登临莫高窟下一景</li>
                  </ul>
                </div>
              </div>

              {/* Swipe transition visual tip */}
              <div className="bg-[#c5a059]/10 border border-[#c5a059]/30 p-3.5 rounded-xs max-w-md mx-auto mb-6 text-[11px] text-[#c5a059] leading-relaxed font-sans text-justify">
                <b>👉 挥云翻卷：</b>完成当卷（88%以上）即可于右下角切换下一窟，或通过<b>手势自右向左快速挥抹</b>，使古卷无缝翻卷，移步换景。
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

      {/* Hidden/Background gesture tracker during Splash or Landing mode to drive atmospheric gestures */}
      {(showSplash || showLanding) && isCameraEnabled && (
        <div className="hidden pointer-events-none w-0 h-0 overflow-hidden" style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}>
          <MediaPipeGestureTracker
            onHandUpdate={setActiveHand}
            isActive={true}
          />
        </div>
      )}

      {/* Absolute Bottom Decorative Border */}
      <footer className="mt-auto border-t border-white/10 bg-[#0f0e0c] py-6 text-center select-none flex flex-col items-center justify-center gap-1">
        <p className="text-[10px] font-serif text-[#8b7e6a] tracking-[0.3em] uppercase">
          ECHOES OF DUNHUANG · DIGITAL PRESERVATION GROUP
        </p>
        <p className="text-[9px] font-sans text-stone-600 tracking-wider">
          国家级数字资产传承示范系统 v2.0 · 莫高窟学术保护委员会监制
        </p>
      </footer>
    </div>
  );
}
