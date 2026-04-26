import { useEffect, useRef } from 'react';

/**
 * Hook that makes the browser tab favicon spin when isProcessing is true.
 * Uses canvas to rotate the logo image and dynamically update the favicon.
 */
export function useSpinningFavicon(isProcessing: boolean) {
  const animationRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const rotationRef = useRef(0);
  const originalFaviconRef = useRef<string | null>(null);

  useEffect(() => {
    let disposed = false;

    // Create canvas once
    if (!canvasRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      canvasRef.current = canvas;
    }

    // Load image once
    if (!imageRef.current) {
      const image = new Image();
      image.src = 'claude-mem-logomark.webp';
      imageRef.current = image;
    }

    // Store original favicon
    if (!originalFaviconRef.current) {
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (link) {
        originalFaviconRef.current = link.href;
      }
    }

    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    const updateFavicon = (dataUrl: string) => {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = dataUrl;
    };

    const animate = () => {
      if (disposed || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const image = imageRef.current;
      if (!canvas || !image) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (!image.complete) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      // Rotate by ~4 degrees per frame (matches 1.5s for full rotation at 60fps)
      rotationRef.current += (2 * Math.PI) / 90;

      ctx.clearRect(0, 0, 32, 32);
      ctx.save();
      ctx.translate(16, 16);
      ctx.rotate(rotationRef.current);
      ctx.drawImage(image, -16, -16, 32, 32);
      ctx.restore();

      updateFavicon(canvas.toDataURL('image/png'));
      animationRef.current = requestAnimationFrame(animate);
    };

    if (isProcessing) {
      rotationRef.current = 0;
      animate();
    } else {
      // Stop animation and restore original favicon
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (originalFaviconRef.current) {
        updateFavicon(originalFaviconRef.current);
      }
    }

    return () => {
      disposed = true;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isProcessing]);
}
