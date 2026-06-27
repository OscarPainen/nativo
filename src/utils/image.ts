/**
 * Comprime una imagen en el navegador a un data-URI JPEG bajo un tamaño objetivo,
 * para poder guardarla en Firestore sin Firebase Storage.
 * Redimensiona a un lado máximo y baja la calidad iterativamente.
 */
const MAX_SIDE = 1200;
const TARGET_BYTES = 700 * 1024; // ~700 KB (límite doc Firestore: 1 MiB)

function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const b64 = dataUrl.slice(comma + 1);
  return Math.floor((b64.length * 3) / 4);
}

function readAsImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function compressImageToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo debe ser una imagen.');
  }
  const img = await readAsImage(file);

  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen.');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let quality = 0.82;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrlBytes(dataUrl) > TARGET_BYTES && quality > 0.3) {
    quality -= 0.12;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  if (dataUrlBytes(dataUrl) > TARGET_BYTES) {
    throw new Error('La imagen es demasiado pesada. Intenta con otra foto.');
  }
  return dataUrl;
}
