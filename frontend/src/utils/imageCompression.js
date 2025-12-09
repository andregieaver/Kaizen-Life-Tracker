/**
 * Image Compression Utility
 * Compresses images to WebP format with intelligent resizing
 * Achieves 70-90% size reduction with minimal quality loss
 */

export const compressImage = async (file, options = {}) => {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.85,
    outputFormat = 'image/webp',
    returnBlob = true // Return Blob by default for URL.createObjectURL compatibility
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }
        
        // Create canvas and compress
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to WebP with compression
        canvas.toBlob(
          (blob) => {
            if (blob) {
              if (returnBlob) {
                // Return blob directly for URL.createObjectURL compatibility
                // Create a File object to preserve the filename
                const compressedFile = new File(
                  [blob], 
                  file.name.replace(/\.[^/.]+$/, '.webp'), 
                  { type: outputFormat }
                );
                resolve(compressedFile);
              } else {
                // Return base64 for backward compatibility
                const base64Reader = new FileReader();
                base64Reader.onloadend = () => {
                  resolve(base64Reader.result);
                };
                base64Reader.onerror = reject;
                base64Reader.readAsDataURL(blob);
              }
            } else {
              reject(new Error('Canvas to Blob conversion failed'));
            }
          },
          outputFormat,
          quality
        );
      };
      
      img.onerror = reject;
      img.src = e.target.result;
    };
    
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Compress image for thumbnails (profile pictures, small icons)
 * Returns File/Blob for URL.createObjectURL and FormData upload
 */
export const compressThumbnail = async (file) => {
  return compressImage(file, {
    maxWidth: 400,
    maxHeight: 400,
    quality: 0.85,
    outputFormat: 'image/webp',
    returnBlob: true
  });
};

/**
 * Compress image for thumbnails and return base64 string
 * Use this for direct <img src={} /> display and API payloads
 */
export const compressThumbnailBase64 = async (file) => {
  return compressImage(file, {
    maxWidth: 400,
    maxHeight: 400,
    quality: 0.85,
    outputFormat: 'image/webp',
    returnBlob: false
  });
};

/**
 * Compress image for posts/events (larger images)
 * Returns File/Blob for URL.createObjectURL and FormData upload
 */
export const compressPostImage = async (file) => {
  return compressImage(file, {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.85,
    outputFormat: 'image/webp',
    returnBlob: true
  });
};

/**
 * Compress image for posts and return base64 string
 * Use this for direct <img src={} /> display and API payloads
 */
export const compressPostImageBase64 = async (file) => {
  return compressImage(file, {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.85,
    outputFormat: 'image/webp',
    returnBlob: false
  });
};

/**
 * Compress image for banners/cover photos
 * Returns File/Blob for URL.createObjectURL and FormData upload
 */
export const compressBannerImage = async (file) => {
  return compressImage(file, {
    maxWidth: 1600,
    maxHeight: 900,
    quality: 0.85,
    outputFormat: 'image/webp',
    returnBlob: true
  });
};

/**
 * Compress image for banners and return base64 string
 * Use this for direct <img src={} /> display and API payloads
 */
export const compressBannerImageBase64 = async (file) => {
  return compressImage(file, {
    maxWidth: 1600,
    maxHeight: 900,
    quality: 0.85,
    outputFormat: 'image/webp',
    returnBlob: false
  });
};
