import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { Eraser } from "lucide-react";

/**
 * Canvas-based signature pad. Supports mouse + touch.
 * Imperative API via ref:
 *   ref.current.getDataURL()  -> string | null  (PNG data URL or null if empty)
 *   ref.current.clear()
 *   ref.current.isEmpty()     -> boolean
 *
 * Optional onChange(dataUrl|null) fires after each stroke / clear.
 */
const SignaturePad = forwardRef(function SignaturePad(
  { onChange, dataTestId = "signature-pad", height = 140 },
  ref,
) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const empty = useRef(true);
  const [, force] = useState(0); // re-render trigger for "Clear" button enable

  // Resize canvas to its rendered width with DPR scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const setupCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = "#0f172a"; // slate-900
    };
    setupCanvas();
    const ro = new ResizeObserver(setupCanvas);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  const getCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const t = e.touches?.[0] || e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (empty.current) {
      empty.current = false;
      force((n) => n + 1);
    }
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange?.(getDataUrl());
  };

  const getDataUrl = () => {
    const canvas = canvasRef.current;
    if (!canvas || empty.current) return null;
    return canvas.toDataURL("image/png");
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    empty.current = true;
    force((n) => n + 1);
    onChange?.(null);
  };

  useImperativeHandle(ref, () => ({
    getDataURL: getDataUrl,
    clear,
    isEmpty: () => empty.current,
  }));

  return (
    <div className="space-y-1.5" data-testid={dataTestId}>
      <div
        className="relative rounded-sm border border-dashed border-slate-300 bg-slate-50"
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
          data-testid={`${dataTestId}-canvas`}
        />
        {empty.current && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400">
            Sign with your finger or mouse
          </div>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{empty.current ? "Empty" : "Signature captured"}</span>
        <button
          type="button"
          onClick={clear}
          disabled={empty.current}
          data-testid={`${dataTestId}-clear`}
          className="inline-flex items-center gap-1 rounded-sm border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <Eraser className="h-3 w-3" /> Clear
        </button>
      </div>
    </div>
  );
});

export default SignaturePad;
