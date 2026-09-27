import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, X } from 'lucide-react'
import Spinner from './Spinner'

// Must match the task-images bucket limits
export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

let nextId = 0
export function toScreenshot(blob, name) {
  return { id: ++nextId, blob, name: name || `screenshot-${nextId}.png`, url: URL.createObjectURL(blob) }
}

// Validates a blob against the bucket limits; returns an error string or null
export function validateScreenshot(blob) {
  if (!ALLOWED_TYPES.includes(blob.type)) return 'Only PNG, JPEG, GIF or WebP images are allowed.'
  if (blob.size > MAX_SCREENSHOT_BYTES) return 'Each image must be 5 MB or smaller.'
  return null
}

async function captureVisibleTab() {
  // PNG keeps screenshots crisp; fall back to JPEG if it exceeds the bucket limit
  let dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' })
  let blob = await (await fetch(dataUrl)).blob()
  if (blob.size > MAX_SCREENSHOT_BYTES) {
    dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 80 })
    blob = await (await fetch(dataUrl)).blob()
  }
  return blob
}

export default function ScreenshotPicker({ screenshots, onAdd, onRemove, onError }) {
  const fileRef = useRef(null)
  const [capturing, setCapturing] = useState(false)

  // Revoke preview URLs when the picker unmounts
  const latest = useRef(screenshots)
  latest.current = screenshots
  useEffect(() => () => latest.current.forEach(s => URL.revokeObjectURL(s.url)), [])

  async function handleCapture() {
    setCapturing(true)
    try {
      const blob = await captureVisibleTab()
      const ext = blob.type === 'image/jpeg' ? 'jpg' : 'png'
      onAdd([toScreenshot(blob, `tab-screenshot-${Date.now()}.${ext}`)])
    } catch (err) {
      onError(err.message || 'Could not capture this tab.')
    } finally {
      setCapturing(false)
    }
  }

  function handleFiles(fileList) {
    const files = Array.from(fileList || [])
    const valid = []
    for (const f of files) {
      const err = validateScreenshot(f)
      if (err) onError(`${f.name}: ${err}`)
      else valid.push(toScreenshot(f, f.name))
    }
    if (valid.length) onAdd(valid)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCapture}
          disabled={capturing}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg px-2 py-2 hover:bg-slate-50 disabled:opacity-60"
        >
          {capturing ? <Spinner size="sm" /> : <Camera className="w-3.5 h-3.5" />}
          Capture this tab
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg px-2 py-2 hover:bg-slate-50"
        >
          <ImagePlus className="w-3.5 h-3.5" />
          Upload images
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          multiple
          className="hidden"
          onChange={e => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {screenshots.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {screenshots.map(s => (
            <div key={s.id} className="relative group aspect-video rounded-md overflow-hidden border border-slate-200 bg-slate-50">
              <img src={s.url} alt={s.name} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(s.url)
                  onRemove(s.id)
                }}
                title="Remove"
                className="absolute top-1 right-1 p-0.5 rounded-full bg-slate-900/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400">Tip: you can also paste screenshots (Ctrl/⌘+V). They&apos;re added to the task&apos;s notes.</p>
      )}
    </div>
  )
}
