/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MuralInfo } from "../types";
import { muralsData } from "../data";
import { audio } from "../utils/audio";
import { 
  Search, 
  X, 
  Compass, 
  Sparkles, 
  BookOpen, 
  Paintbrush, 
  Calendar,
  Layers,
  Award,
  CheckCircle2,
  Check
} from "lucide-react";

interface MuralLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  currentMuralIndex: number;
  onSelectMural: (index: number) => void;
  audioEnabled: boolean;
}

export default function MuralLibrary({
  isOpen,
  onClose,
  currentMuralIndex,
  onSelectMural,
  audioEnabled
}: MuralLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDynastyFilter, setSelectedDynastyFilter] = useState("全部");

  // Play chimes on toggle
  const playSound = (isSelect = false) => {
    if (audioEnabled) {
      if (isSelect) {
        audio.playTempleBell();
      } else {
        audio.playChimes();
      }
    }
  };

  // Extract unique dynasties for quick filtering (or use normalized grouped ones)
  const dynastyGroups = ["全部", "北朝 (魏/晋)", "隋唐盛世", "五代西夏"];

  const getDynastyCategory = (dynasty: string): string => {
    if (dynasty.includes("魏") || dynasty.includes("北")) return "北朝 (魏/晋)";
    if (dynasty.includes("唐") || dynasty.includes("隋")) return "隋唐盛世";
    if (dynasty.includes("夏") || dynasty.includes("五") || dynasty.includes("宋")) return "五代西夏";
    return "其他";
  };

  // Filter murals based on search keyword and dynasty tab
  const filteredMurals = useMemo(() => {
    return muralsData.map((mural, originalIndex) => ({ ...mural, originalIndex }))
      .filter((m) => {
        // Dynasty check
        if (selectedDynastyFilter !== "全部") {
          const category = getDynastyCategory(m.dynasty);
          if (category !== selectedDynastyFilter) return false;
        }
        
        // Search query check
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
          m.title.toLowerCase().includes(query) ||
          m.cave.toLowerCase().includes(query) ||
          m.dynasty.toLowerCase().includes(query) ||
          m.storyTitle.toLowerCase().includes(query) ||
          m.storyContent.toLowerCase().includes(query) ||
          m.artStyle.toLowerCase().includes(query)
        );
      });
  }, [searchQuery, selectedDynastyFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#0f0e0c]/95 backdrop-blur-md overflow-hidden">
      {/* Decorative Outer Border */}
      <div className="absolute inset-4 pointer-events-none border border-[#c5a059]/20 rounded-xs z-10"></div>
      
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        transition={{ type: "spring", damping: 25, stiffness: 180 }}
        className="relative w-full max-w-5xl h-[90vh] bg-[#161411] border border-[#c5a059]/40 rounded-xs overflow-hidden flex flex-col shadow-2xl z-20"
      >
        {/* Calligraphic/Thematic Corner Elements */}
        <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-[#c5a059]/40 pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-[#c5a059]/40 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-[#c5a059]/40 pointer-events-none"></div>
        <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-[#c5a059]/40 pointer-events-none"></div>

        {/* Section Header */}
        <div className="border-b border-white/10 bg-[#0f0e0c]/85 p-6 sm:px-8 flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Compass className="w-4 h-4 text-[#c5a059] animate-spin-slow" />
              <span className="text-[10px] tracking-[0.3em] text-[#c5a059] uppercase font-serif font-semibold">
                Classical Fresco Collection
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif text-[#f5f2ed] tracking-wider font-light">
              敦古焕彩 · 千载壁画素材宝库
            </h2>
            <p className="text-[#8b7e6a] text-xs mt-1.5 font-sans">
              精选莫高佳品与榆林奇珍，供您自由阅览、探寻历史艺术底蕴并挑选载入修复画廊。
            </p>
          </div>

          <button
            onClick={() => {
              playSound();
              onClose();
            }}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 text-[#8b7e6a] hover:text-[#f5f2ed] hover:bg-[#0f0e0c] border border-white/5 rounded-full transition-all cursor-pointer"
            title="关闭素材库"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters and Search Bar Container */}
        <div className="bg-[#1a1815] border-b border-white/5 p-4 sm:px-8 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          
          {/* Dynasty Filter Categories */}
          <div className="flex flex-wrap items-center gap-2">
            {dynastyGroups.map((group) => (
              <button
                key={group}
                onClick={() => {
                  setSelectedDynastyFilter(group);
                  playSound();
                }}
                className={`px-3.5 py-1.5 text-xs font-serif rounded-xs border transition-all cursor-pointer ${
                  selectedDynastyFilter === group
                    ? "bg-[#c5a059] border-[#c5a059] text-[#0f0e0c] font-semibold shadow-md"
                    : "bg-[#0f0e0c] border-white/10 text-stone-400 hover:text-stone-200 hover:border-[#c5a059]/40"
                }`}
              >
                {group}
              </button>
            ))}
          </div>

          {/* Search Bar Input */}
          <div className="relative flex-1 md:max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索壁画名、朝代、古窟或背景故事..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-[#0f0e0c]/80 text-[#f5f2ed] border border-white/10 rounded-xs placeholder-stone-500 focus:outline-none focus:border-[#c5a059]/60 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-stone-500 hover:text-stone-300 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Gallery Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 scrollbar-thin scrollbar-thumb-stone-800 scrollbar-track-stone-950">
          <AnimatePresence mode="popLayout">
            {filteredMurals.length > 0 ? (
              filteredMurals.map((mural, index) => {
                const isSelected = currentMuralIndex === mural.originalIndex;
                
                return (
                  <motion.div
                    key={mural.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.25, delay: Math.min(index * 0.05, 0.2) }}
                    className={`group border rounded-xs overflow-hidden bg-[#100f0d] transition-all flex flex-col md:flex-row relative ${
                      isSelected 
                        ? "border-[#c5a059] shadow-[0_4px_24px_-4px_rgba(197,160,89,0.15)] bg-[#14120f]" 
                        : "border-white/5 hover:border-[#c5a059]/35 hover:shadow-lg bg-[#100f0d]"
                    }`}
                  >
                    {/* Selected Status Corner Badge */}
                    {isSelected && (
                      <div className="absolute top-0 right-0 bg-[#c5a059] text-[#0f0e0c] text-[10px] uppercase font-serif font-bold tracking-widest px-3 py-1 rounded-bl-sm z-10 flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>临摹中</span>
                      </div>
                    )}

                    {/* Mural Preview Gallery Image */}
                    <div className="w-full md:w-[280px] lg:w-[320px] aspect-[16:9] md:aspect-auto md:min-h-[220px] bg-[#0c0b09] relative flex items-center justify-center overflow-hidden border-b md:border-b-0 md:border-r border-white/5">
                      <img
                        src={mural.imageSrc}
                        alt={mural.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                      
                      {/* Meta Tags overlaid on image */}
                      <div className="absolute bottom-4 left-4 right-4">
                        <span className="px-2 py-0.5 text-[9px] font-sans rounded-xs bg-[#c5a059]/20 border border-[#c5a059]/40 text-[#c5a059] select-none">
                          {mural.dynasty}
                        </span>
                        <h4 className="text-sm font-serif text-[#f5f2ed] tracking-wider mt-1.5 drop-shadow-md">
                          {mural.cave}
                        </h4>
                      </div>
                    </div>

                    {/* Content & Descriptions details pane */}
                    <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between">
                      <div>
                        {/* Title Section */}
                        <div className="flex items-center justify-between gap-4 mb-2.5">
                          <h3 className="text-base sm:text-lg font-serif text-[#f5f2ed] tracking-wide font-medium">
                            {mural.title}
                          </h3>
                        </div>

                        {/* History Story Block */}
                        <div className="mb-4">
                          <div className="flex items-center gap-1.5 text-[#c5a059] font-serif text-xs mb-1.5 select-none">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>历史典故 · {mural.storyTitle}</span>
                          </div>
                          <p className="text-stone-400 text-[11px] leading-relaxed text-justify line-clamp-3 group-hover:line-clamp-none transition-all duration-300">
                            {mural.storyContent}
                          </p>
                        </div>

                        {/* Two Columns Grid for Style & Color explanations */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/5 pt-3 mb-4 text-[10px]">
                          <div>
                            <span className="text-[#8b7e6a] font-serif uppercase tracking-wider block mb-1">🖌️ 艺术手法与画论</span>
                            <p className="text-stone-400 leading-relaxed text-justify line-clamp-2 group-hover:line-clamp-none transition-all duration-300">
                              {mural.artStyle}
                            </p>
                          </div>
                          <div>
                            <span className="text-[#c5a059] font-serif uppercase tracking-wider block mb-1">🎨 矿物色彩构成</span>
                            <p className="text-stone-400 leading-relaxed text-justify line-clamp-2 group-hover:line-clamp-none transition-all duration-300">
                              {mural.colorExplanation}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Select and interact trigger */}
                      <div className="flex items-center justify-between gap-4 mt-2 border-t border-white/5 pt-3.5">
                        <div className="flex flex-wrap items-center gap-1.5 select-none text-[9px] text-[#8b7e6a]">
                          <span className="font-serif">主要复原区：</span>
                          {mural.restoredAreas.slice(0, 3).map((area, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-[#0f0e0c] border border-white/5 text-stone-400 rounded-sm">
                              {area}
                            </span>
                          ))}
                          {mural.restoredAreas.length > 3 && <span>...</span>}
                        </div>

                        <button
                          onClick={() => {
                            if (!isSelected) {
                              playSound(true);
                              onSelectMural(mural.originalIndex);
                              onClose();
                            }
                          }}
                          className={`px-4.5 py-1.5 text-xs font-serif rounded-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? "bg-transparent border border-[#c5a059]/20 text-[#c5a059] cursor-default select-none"
                              : "bg-[#c5a059] hover:bg-[#c5a059]/90 text-[#0f0e0c] font-bold shadow-[0_2px_8px_rgba(197,160,89,0.15)] hover:shadow-[0_4px_12px_rgba(197,160,89,0.25)]"
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>当前临摹中</span>
                            </>
                          ) : (
                            <>
                              <Paintbrush className="w-3.5 h-3.5" />
                              <span>载入此卷 · 开始修复馆阁</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="text-center py-20 bg-[#0f0e0c]/50 rounded-xs border border-white/5 flex flex-col items-center justify-center gap-3">
                <Compass className="w-8 h-8 text-[#8b7e6a] animate-spin-slow" />
                <p className="text-xs text-[#8b7e6a] font-serif tracking-widest">
                  未寻得契合之壁画。可换个词（如“魏”、“唐”、“琵琶”、“鹿”）再行探寻。
                </p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedDynastyFilter("全部");
                    playSound();
                  }}
                  className="px-3.5 py-1.5 mt-2 bg-[#1a1815] border border-[#c5a059]/30 text-xs text-[#c5a059] rounded-xs hover:bg-[#c5a059]/10 transition-colors cursor-pointer font-serif"
                >
                  重置筛选条件
                </button>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer info counts */}
        <div className="border-t border-white/10 bg-[#0f0e0c] px-8 py-3.5 flex items-center justify-between text-[11px] text-[#8b7e6a] select-none font-sans">
          <div className="flex items-center gap-2">
            <span>📊 馆藏合计: <strong>{muralsData.length}</strong> 幅经典壁画</span>
            <span className="text-stone-700">|</span>
            <span>筛选结果: <strong>{filteredMurals.length}</strong> 幅</span>
          </div>
          <div>
            <span>莫高窟学术保护委员会学术标准制式监修 v2.3</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
