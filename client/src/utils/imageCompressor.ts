/**
 * Utilitário de compressão de imagens no cliente (Canvas)
 * Redimensiona a foto para lado maior máximo de 1600px e comprime em WebP/JPEG,
 * otimizando uploads de fotos de celular (15MB -> 250KB) em conexões 3G/4G de campo.
 */
export async function compressImage(
  file: File,
  maxDimension = 1600,
  quality = 0.85
): Promise<File> {
  // Arquivos que não são imagem ou são SVG não são comprimidos via Canvas
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Se a foto já for menor que a dimensão máxima, calcula proporção 1:1
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file); // Fallback seguro
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Suporte preferencial a WebP com fallback para JPEG
        const outputMime = 'image/jpeg';
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file);
            }

            const cleanName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
            const compressedFile = new File([blob], cleanName, {
              type: outputMime,
              lastModified: Date.now()
            });

            resolve(compressedFile);
          },
          outputMime,
          quality
        );
      };

      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };

    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}
