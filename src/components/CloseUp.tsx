import { useEffect, useState } from "react";

/** Screenshot shapes (width / height), so each close-up doesn't load the picture again. */
const aspects = new Map<string, number>();

/**
 * What a marked thing looks like (markers v2, Nov 2026): a square close-up of the answer's screenshot around it, drawn
 * from the screenshot the Deck already has (nothing extra is fetched or stored). The square is 12% of its width, the
 * same as the desktop app's list.
 */
export function CloseUp({ src, x, y, size = 44 }: { src: string; x: number; y: number; size?: number }) {
  const [aspect, setAspect] = useState<number | null>(aspects.get(src) ?? null);
  useEffect(() => {
    if (aspect) return;
    let live = true;
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      const a = img.naturalWidth / img.naturalHeight;
      aspects.set(src, a);
      if (live) setAspect(a);
    };
    img.src = src;
    return () => {
      live = false;
    };
  }, [src, aspect]);
  const box = { width: size, height: size };
  if (!aspect) return <span className="qc-closeup" style={box} />;
  const side = Math.min(0.12, 0.3 / aspect);
  const bgW = size / side;
  const bgH = bgW / aspect;
  const left = Math.max(0, Math.min(bgW - size, x * bgW - size / 2));
  const top = Math.max(0, Math.min(bgH - size, y * bgH - size / 2));
  return (
    <span
      className="qc-closeup"
      style={{ ...box, backgroundImage: `url("${src}")`, backgroundSize: `${bgW}px ${bgH}px`, backgroundPosition: `${-left}px ${-top}px` }}
    />
  );
}
