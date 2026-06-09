/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { MuralInfo } from "../types";
import { BookOpen, MapPin, Sparkles, Paintbrush, ArrowLeft, RotateCcw, X, Compass } from "lucide-react";
import { useEffect, useState } from "react";
import { audio } from "../utils/audio";

interface StoryPopupProps {
  mural: MuralInfo;
  isOpen: boolean;
  onClose: () => void;
  onNext: () => void;
  onRestart: () => void;
  isLastMural: boolean;
  swipeLockTimer?: number;
  onReturnToLibrary: () => void;
}

export default function StoryPopup({
  mural,
  isOpen,
  onClose,
  onNext,
  onRestart,
  isLastMural,
  swipeLockTimer = 0,
  onReturnToLibrary
}: StoryPopupProps) {
  const [countdown, setCountdown] = useState<number>(4);
  
  // Trigger bell chimes when popup slides open
  useEffect(() => {
    if (isOpen) {
      audio.playTempleBell();
      setCountdown(4);
    }
  }, [isOpen]);

  // Handle countdown decrement
  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [countdown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f0e0c]/90 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ scale: 0.92, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: -20, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 140 }}
        className="relative w-full max-w-2xl bg-[#1a1815] border border-[#c5a059]/40 rounded-sm p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.85)] text-[#e0d8cf] overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Decorative Golden Corner Borders */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#c5a059]/40"></div>
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#c5a059]/40"></div>
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#c5a059]/40"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#c5a059]/40"></div>

        {/* Absolute top-right Close button */}
        {countdown === 0 && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-[#8b7e6a] hover:text-[#f5f2ed] p-1.5 hover:bg-[#0f0e0c]/80 border border-white/5 rounded-full transition-all cursor-pointer z-10"
            title="关闭弹出层，继续欣赏临上色古卷"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Top Celebration Aura */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-[#c5a059]/5 rounded-full blur-2xl pointer-events-none"></div>

        {/* Scroll Heading Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-sm bg-[#c5a059]/10 border border-[#c5a059]/30 text-[#c5a059] text-[11px] font-serif uppercase tracking-widest mb-3 select-none">
            <Sparkles className="w-3" />
            <span>敦煌壁画数字化复原成功</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif text-[#f5f2ed] tracking-widest leading-relaxed mt-1 flex items-center justify-center gap-2 dunhuang-title-lg">
            《{mural.title}》
          </h2>
          <p className="text-[#8b7e6a] text-[12px] flex items-center justify-center gap-2 mt-3 font-serif">
            <MapPin className="w-3.5 h-3.5 text-[#c5a059]" />
            <span className="tracking-widest">{mural.cave}</span>
            <span className="text-stone-600">|</span>
            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-sans tracking-wide border font-semibold ${
              mural.dynasty.includes("唐") || mural.dynasty.includes("隋")
                ? "bg-[#b3322a]/15 text-[#e15b53] border-[#b3322a]/30"
                : mural.dynasty.includes("魏") || mural.dynasty.includes("北")
                ? "bg-[#2f7a5b]/15 text-[#59cba6] border-[#2f7a5b]/30"
                : "bg-[#c5a059]/15 text-[#e5c17d] border-[#c5a059]/30"
            }`}>
              {mural.dynasty}期
            </span>
          </p>
        </div>

        {/* Main Scrolling Content (Scrollable segment) */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-6 leading-relaxed text-sm select-text scrollbar-thin scrollbar-thumb-[#c5a059]/30 scrollbar-track-[#0f0e0c]/20">
          
          {/* Classical Legend Story section */}
          <div className="bg-[#0f0e0c] p-6 rounded-sm border border-[#c5a059]/20 shadow-inner">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-[1px] flex-1 bg-[#c5a059]/20"></div>
              <span className="text-[#c5a059] text-xs tracking-[0.2em] font-serif uppercase">修复日志: {mural.storyTitle}</span>
              <div className="h-[1px] flex-1 bg-[#c5a059]/20"></div>
            </div>
            <p className="text-[#b5a796] text-sm leading-relaxed text-justify font-serif break-all">
              {mural.storyContent}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Style detail analysis */}
            <div className="bg-[#0f0e0c]/60 p-5 rounded-sm border border-white/5">
              <div className="flex items-center gap-2 mb-2 text-[#e0d8cf] font-serif">
                <Paintbrush className="w-4 h-4 text-[#c5a059]" />
                <span className="text-xs font-semibold text-[#c5a059] tracking-wider">千载骨法用笔</span>
              </div>
              <p className="text-[#8b7e6a] text-xs leading-relaxed text-justify font-sans">
                {mural.artStyle}
              </p>
            </div>

            {/* Mineral paint pigment analysis */}
            <div className="bg-[#0f0e0c]/60 p-5 rounded-sm border border-white/5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2 text-[#e0d8cf] font-serif">
                  <div className="w-2 h-2 rounded-full bg-red-600/70"></div>
                  <div className="w-2 h-2 rounded-full bg-orange-500/75"></div>
                  <div className="w-2 h-2 rounded-full bg-[#c5a059]"></div>
                  <span className="text-xs font-semibold text-[#c5a059] tracking-wider">重彩千载：天然矿物颜料</span>
                </div>
                <p className="text-[#8b7e6a] text-xs leading-relaxed text-justify font-sans">
                  {mural.colorExplanation}
                </p>
              </div>
            </div>
          </div>

          {/* Key landmarks checklist */}
          <div className="p-4 bg-[#0f0e0c]/30 rounded-sm border border-[#c5a059]/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <span className="text-xs text-[#8b7e6a] font-serif tracking-widest uppercase">细节鉴赏特征：</span>
            <div className="flex flex-wrap gap-2 animate-pulse">
              {mural.restoredAreas.map((area, index) => (
                <div key={index} className="flex items-center gap-1.5 bg-[#0f0e0c] px-3 py-1 rounded-sm text-xs border border-[#c5a059]/30 text-[#f5f2ed] font-serif">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#c5a059]"></div>
                  <span>{area}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Call to action Transition footer */}
        <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <button
            onClick={onRestart}
            disabled={countdown > 0}
            className={`w-full sm:w-auto px-5 py-2.5 bg-[#0f0e0c] border border-white/10 text-[#b5a796] text-xs rounded-xs flex items-center justify-center gap-2 transition-all font-serif ${
              countdown > 0 ? "opacity-40 cursor-not-allowed" : "hover:bg-[#c5a059]/15 hover:border-[#c5a059]/40 hover:text-[#f5f2ed] cursor-pointer"
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>重新临摹此卷</span>
          </button>

          <div className="w-full sm:w-auto flex flex-col items-center sm:items-end gap-2">
            <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2.5 items-center">
              <button
                onClick={onClose}
                disabled={countdown > 0}
                className={`w-full sm:w-auto px-4 py-2.5 bg-[#1a1815] border text-xs rounded-xs flex items-center justify-center gap-1.5 transition-colors font-serif select-none ${
                  countdown > 0 
                    ? "opacity-40 text-stone-600 border-white/5 cursor-not-allowed" 
                    : "text-[#c5a059] border-[#c5a059]/30 hover:bg-[#c5a059]/10 cursor-pointer"
                }`}
                title="关闭此面板，返回古卷素材库"
              >
                <span>返回素材库</span>
              </button>

              <button
                onClick={onReturnToLibrary}
                disabled={countdown > 0}
                className={`w-full sm:w-auto px-6 py-2.5 text-xs rounded-xs flex items-center justify-center gap-2 font-serif font-bold transition-all tracking-widest ${
                  countdown > 0 
                    ? "bg-[#c5a059]/15 text-stone-500 border border-[#c5a059]/10 cursor-not-allowed shadow-none" 
                    : "bg-[#c5a059] hover:bg-[#c5a059]/90 text-[#0f0e0c] cursor-pointer shadow-[0_4px_12px_rgba(197,160,89,0.25)] hover:shadow-[0_6px_18px_rgba(197,160,89,0.4)] active:scale-95 animate-pulse"
                }`}
              >
                {countdown > 0 ? (
                  <span>品鉴因缘历史 ({countdown}s)...</span>
                ) : (
                  <>
                    <Compass className="w-4 h-4 animate-spin-slow" />
                    <span>完成修复 · 返回藏经阁</span>
                  </>
                )}
              </button>

              {!isLastMural && (
                <button
                  onClick={onNext}
                  disabled={countdown > 0}
                  className={`w-full sm:w-auto px-5 py-2.5 text-xs rounded-xs flex items-center justify-center gap-2 transition-all font-serif ${
                    countdown > 0 
                      ? "bg-[#1a1815] border border-white/5 text-stone-600 cursor-not-allowed" 
                      : "bg-[#0f0e0c] border border-[#c5a059]/40 text-[#c5a059] hover:bg-[#c5a059]/10 cursor-pointer"
                  }`}
                >
                  <span>进入下一卷</span>
                  <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              )}
            </div>

            {/* Hint details under the buttons */}
            {countdown > 0 ? (
              <div className="text-[10px] text-[#8b7e6a] font-serif tracking-widest animate-pulse mt-1 select-none text-center sm:text-right">
                ✨ 千年壁画拂去沙尘，还原重彩。请静心品鉴莫高经典之历史缘起...
              </div>
            ) : (
              <div className="text-[10px] text-[#c5a059] tracking-wider font-serif mt-1 select-none flex items-center gap-1 text-center sm:text-right">
                <span>妙法入库：点击 [完成修复] 返回素材库，品评更多传世画卷</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
