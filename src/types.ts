/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MuralInfo {
  id: string;
  title: string;
  dynasty: string;
  cave: string;
  imageSrc: string; // Colored image source
  storyTitle: string;
  storyContent: string;
  artStyle: string; // Historical style description
  colorExplanation: string; // Explaining the mineral colors used
  restoredAreas: string[]; // Key figures/parts to guide exploration
}

export interface HandData {
  x: number;
  y: number;
  isOpen: boolean;
  score: number;
  isSwipeLeft: boolean;
}

export type InteractionMode = "spotlight" | "paint" | "jigsaw";

export interface DunhuangDayInfo {
  heading: string;
  title: string;
  dynasty?: string;
  content: string;
  source?: string;
  tags?: string[];
}

