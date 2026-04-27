import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";

/**
 * Reads a File and returns a JPEG data URL, resized so the largest
 * dimension is <= maxDim, encoded at the given quality.
 */
async function compressToDataUrl(file, maxDim = 1280, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not decode image"));
      img.onload = () => {
        const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Multi-photo uploader. Reads files, client-side resizes each to <=1280px,
 * encodes as JPEG quality 0.7. Caps total at maxPhotos.
 *
 * Props:
 *   value:    string[]                  (data URLs)
 *   onChange: (string[]) => void
 *   maxPhotos: number   default 4
 *   dataTestId: string  default "photo-uploader"
 */
export default function PhotoUploader({
  value = [],
  onChange,
  maxPhotos = 4,
  dataTestId = "photo-uploader",
}) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const remaining = Math.max(0, maxPhotos - value.length);

  const onPick = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, remaining);
    e.target.value = ""; // allow re-selecting the same file
    if (files.length === 0) return;
    setError("");
    setBusy(true);
    try {
      const next = [...value];
      for (const f of files) {
        if (!f.type.startsWith("image/")) continue;
        const dataUrl = await compressToDataUrl(f);
        next.push(dataUrl);
      }
      onChange?.(next);
    } catch (err) {
      setError(err.message || "Failed to read image");
    } finally {
      setBusy(false);
    }
  };

  const remove = (idx) => {
    const next = value.filter((_, i) => i !== idx);
    onChange?.(next);
  };

  return (
    <div className="space-y-2" data-testid={dataTestId}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        onChange={onPick}
        className="hidden"
        data-testid={`${dataTestId}-input`}
      />
      <div className="flex flex-wrap items-center gap-2">
        {value.map((url, idx) => (
          <div
            key={idx}
            className="group relative h-20 w-20 overflow-hidden rounded-sm border border-slate-200 bg-slate-100"
            data-testid={`${dataTestId}-thumb-${idx}`}
          >
            {/* eslint-disable-next-line */}
            <img src={url} alt={`Vehicle inspection ${idx + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove(idx)}
              className="absolute right-1 top-1 hidden rounded-full bg-slate-900/80 p-0.5 text-white hover:bg-red-600 group-hover:block"
              data-testid={`${dataTestId}-remove-${idx}`}
              aria-label={`Remove photo ${idx + 1}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {remaining > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            data-testid={`${dataTestId}-add`}
            className="flex h-20 w-20 flex-shrink-0 flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-slate-300 bg-white text-xs font-medium text-slate-500 hover:border-[#0055FF] hover:bg-blue-50 hover:text-[#0055FF] disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Camera className="h-5 w-5" />
                <span>Add</span>
              </>
            )}
          </button>
        )}
      </div>
      <div className="text-xs text-slate-400">
        {value.length}/{maxPhotos} photo{maxPhotos === 1 ? "" : "s"}
        {value.length > 0 && " · click a photo to remove"}
      </div>
      {error && (
        <div className="rounded-sm border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
