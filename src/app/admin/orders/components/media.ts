"use client"

import { isStageImageFilename } from "@/lib/stage-file-helpers"

export const isVideoFilename = (name: string) => /\.(mp4|webm|mov)$/i.test(name.replace(/^🎬\s*/, ""))

export function isMediaFilename(filename: string) {
  return isStageImageFilename(filename) || isVideoFilename(filename)
}
