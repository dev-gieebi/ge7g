import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export interface SignaturePadRef {
  clear: () => void;
  dataUrl: () => string | null;
  isEmpty: () => boolean;
}

/** Zone de signature tactile/souris pour la réception des livraisons. */
export const SignaturePad = forwardRef<SignaturePadRef, { height?: number }>(function SignaturePad({ height = 160 }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const drawn = useRef(false);

  useImperativeHandle(ref, () => ({
    clear: () => {
      const canvas = canvasRef.current;
      canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      drawn.current = false;
    },
    dataUrl: () => (drawn.current ? (canvasRef.current?.toDataURL("image/png") ?? null) : null),
    isEmpty: () => !drawn.current,
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * 2));
      canvas.height = Math.round(height * 2);
      ctx.scale(2, 2);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#1a1a1a";
    };
    resize();

    const pos = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const down = (e: PointerEvent) => {
      drawing.current = true;
      const { x, y } = pos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drawing.current) return;
      const { x, y } = pos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      drawn.current = true;
    };
    const up = () => (drawing.current = false);

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointerleave", up);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointerleave", up);
    };
  }, [height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ height, touchAction: "none" }}
      className="w-full cursor-crosshair rounded-xl border border-dashed border-ge7-black/30 bg-white"
    />
  );
});
