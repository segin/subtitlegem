"use client";

import React from "react";
import { TrackStyle } from "@/types/subtitle";
import {
  assFontName,
  getTrackMetrics,
  getTrackPreviewCss,
  scaleTrackMetrics,
} from "@/lib/subtitle-render-style";
import { useExportFonts } from "@/hooks/useExportFonts";

/** A 1080p video in either orientation, as the style dialogs simulate it */
const SIMULATED_VIDEO = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
} as const;

/**
 * Sample text in a track style, drawn the way the export draws it
 * (size, margins, outline and background box), on a simulated video frame.
 */
export function StyleSamplePreview({ style, aspect, width, text }: {
  style: TrackStyle;
  aspect: '16:9' | '9:16';
  width: number;
  text: string;
}) {
  const video = SIMULATED_VIDEO[aspect];
  const height = width * (video.height / video.width);
  const fontName = assFontName(style.fontFamily);
  const exportFont = useExportFonts([fontName])[fontName];
  const css = getTrackPreviewCss(
    scaleTrackMetrics(getTrackMetrics(style, video.width, video.height), height / video.height),
    exportFont,
  );

  return (
    <div className="space-y-1">
      <div
        data-testid="style-sample-frame"
        className="bg-[#1e1e1e] border border-[#3e3e42] rounded-sm relative overflow-hidden shrink-0 mx-auto transition-all"
        style={{ width, height }}
      >
        {/* Simulated video background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#4a5a6a] to-[#2a2a2a] pointer-events-none" />

        {/* Reference Grid */}
        <div className="absolute inset-0 opacity-10 pointer-events-none grid grid-cols-3 grid-rows-3">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="border border-white/20"></div>
          ))}
        </div>

        <div style={css.wrapper}>
          <div style={css.text}>{text}</div>
        </div>
      </div>
      <p className="text-[10px] text-[#555] text-center">
        Preview ({aspect}, as exported at {video.width}×{video.height})
      </p>
    </div>
  );
}
