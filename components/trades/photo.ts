import {
  TRADE_PHOTO_EDGE_STEPS,
  TRADE_PHOTO_MAX_CHARS,
  TRADE_PHOTO_MAX_FILE_BYTES,
  TRADE_PHOTO_QUALITIES,
} from '@/lib/trades/photo-limits';

/** Shrink a photo in the browser before it is stored on the job or request. */
export function readPhotoFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('Choose a photo.'));
  }
  if (file.size > TRADE_PHOTO_MAX_FILE_BYTES) {
    return Promise.reject(new Error('Photo is too large. Try a smaller picture.'));
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const longest = Math.max(img.width, img.height) || 1;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read that photo'));
        return;
      }
      let encoded = '';
      for (const edge of TRADE_PHOTO_EDGE_STEPS) {
        const scale = Math.min(1, edge / longest);
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        for (const quality of TRADE_PHOTO_QUALITIES) {
          encoded = canvas.toDataURL('image/jpeg', quality);
          if (encoded.length <= TRADE_PHOTO_MAX_CHARS) {
            URL.revokeObjectURL(url);
            resolve(encoded);
            return;
          }
        }
      }
      URL.revokeObjectURL(url);
      reject(new Error('Photo is too large. Try a smaller picture.'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that photo'));
    };
    img.src = url;
  });
}
