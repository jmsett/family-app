// Convert an uploaded image into a small, metadata-free JPEG stored with private JSON.
export async function prepareTripPhoto(file: File): Promise<string> {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 12000000
  )
    throw new Error('Choose a JPEG, PNG or WebP image under 12 MB.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      'This image could not be opened. Try a JPEG, PNG or WebP photo.',
    );
  }
  try {
    if (bitmap.width * bitmap.height > 40000000)
      throw new Error(
        'Choose a smaller destination image (under 40 megapixels).',
      );
    const canvas = document.createElement('canvas');
    for (const max of [640, 480, 320, 240]) {
      const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx)
        throw new Error('Photo processing is unavailable in this browser.');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.78, 0.62, 0.45]) {
        const result = canvas.toDataURL('image/jpeg', quality);
        if (
          result.length <= 60000 &&
          result.startsWith('data:image/jpeg;base64,')
        )
          return result;
      }
    }
    throw new Error(
      'This photo is too detailed. Try a smaller or simpler destination picture.',
    );
  } finally {
    bitmap.close();
  }
}
