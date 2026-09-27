"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, MonitorUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MAX_SCREENSHOT_BYTES,
  SCREENSHOT_TYPES,
  toScreenshot,
  validateScreenshot,
} from "@/lib/screenshots";

// Grabs one frame via the browser's screen-share picker
async function captureScreen() {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    // Give the first frame a moment to render
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 150)));
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    let blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
    if (blob.size > MAX_SCREENSHOT_BYTES) {
      blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.8));
    }
    return blob;
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

// Parent owns the screenshots list (and must revoke preview URLs when discarding it)
export default function ScreenshotPicker({ screenshots, onAdd, onRemove, onError }) {
  const fileRef = useRef(null);
  const [capturing, setCapturing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [canCapture, setCanCapture] = useState(false);

  useEffect(() => {
    setCanCapture(!!navigator.mediaDevices?.getDisplayMedia);
  }, []);

  function addFiles(fileList) {
    const valid = [];
    for (const f of Array.from(fileList || [])) {
      const err = validateScreenshot(f);
      if (err) onError(`${f.name}: ${err}`);
      else valid.push(toScreenshot(f, f.name));
    }
    if (valid.length) onAdd(valid);
  }

  async function handleCapture() {
    setCapturing(true);
    try {
      const blob = await captureScreen();
      const ext = blob.type === "image/jpeg" ? "jpg" : "png";
      onAdd([toScreenshot(blob, `screen-${Date.now()}.${ext}`)]);
    } catch (err) {
      // User closing the share picker isn't an error
      if (err?.name !== "NotAllowedError") onError(err.message || "Screen capture failed.");
    } finally {
      setCapturing(false);
    }
  }

  const btnClass =
    "flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-60";

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        addFiles(e.dataTransfer.files);
      }}
      className={cn(
        "rounded-xl border border-dashed border-slate-200 dark:border-slate-600 p-3 space-y-3 transition-colors",
        dragging && "border-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20",
      )}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => fileRef.current?.click()} className={btnClass}>
          <ImagePlus className="h-3.5 w-3.5" />
          Upload images
        </button>
        {canCapture && (
          <button type="button" onClick={handleCapture} disabled={capturing} className={btnClass}>
            <MonitorUp className="h-3.5 w-3.5" />
            {capturing ? "Capturing…" : "Capture screen"}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={SCREENSHOT_TYPES.join(",")}
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {screenshots.length > 0 ? (
        <div className="grid grid-cols-4 gap-2">
          {screenshots.map((s) => (
            <div
              key={s.id}
              className="relative group aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt={s.name} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(s.url);
                  onRemove(s.id);
                }}
                title="Remove"
                className="absolute top-1 right-1 p-0.5 rounded-full bg-slate-900/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          Drop, paste (Ctrl/⌘+V) or upload images. They&apos;re added to the task&apos;s notes.
        </p>
      )}
    </div>
  );
}
