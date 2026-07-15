// Compresses an uploaded image down to a target file size (default ~50 KB).
//
// How it works: the image is first resized to fit `maxDim` (longest side), then
// re-encoded as WebP (JPEG fallback for old browsers). If the result is still
// bigger than the target, the quality is stepped down; if it is STILL too big
// at the lowest allowed quality, the dimension is reduced and it tries again.
//
// Safety: both loops are hard-capped, so it can never run forever, and it never
// rejects for "too big" — it just returns the smallest result it could reach.
// Output is always a base64 data URL (same as before), so ID cards, vouchers
// and everything else keep working unchanged.
export const compressImage = (file, { maxDim = 400, targetKB = 50, minQuality = 0.4, minDim = 220, startQuality = 0.82 } = {}) =>
  new Promise((resolve, reject) => {
    const targetBytes = targetKB * 1024;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Draw the image scaled to fit within `dim` (longest side, never upscaled).
        const drawAt = (dim) => {
          const scale = Math.min(1, dim / Math.max(img.width, img.height));
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };

        // Encode the current canvas as WebP, falling back to JPEG.
        const encode = (q) => {
          let url = canvas.toDataURL('image/webp', q);
          if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', q);
          return url;
        };

        // Actual byte size of a base64 data URL's image payload.
        const sizeOf = (url) => {
          const b64 = url.slice(url.indexOf(',') + 1);
          const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
          return Math.floor((b64.length * 3) / 4) - pad;
        };

        let dim = maxDim;
        let best = null;

        // Outer loop shrinks the dimension — capped at 4 steps.
        for (let step = 0; step < 4; step++) {
          drawAt(dim);
          let quality = startQuality;
          best = encode(quality);
          // Inner loop lowers quality — capped at 6 drops.
          for (let i = 0; i < 6 && sizeOf(best) > targetBytes && quality > minQuality; i++) {
            quality = Math.max(minQuality, quality - 0.12);
            best = encode(quality);
          }
          if (sizeOf(best) <= targetBytes || dim <= minDim) break;
          dim = Math.max(minDim, Math.round(dim * 0.8));
        }

        resolve(best);
      };
      img.onerror = () => reject(new Error('Invalid image file'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
