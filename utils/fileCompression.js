// Try to require sharp, but handle gracefully if it fails
let sharp;
try {
  sharp = require('sharp');
} catch (error) {
  console.warn('⚠️ Sharp library not available. Image compression will be disabled.');
  console.warn('To enable compression, run: npm install sharp');
  sharp = null;
}
const fs = require('fs');
const path = require('path');

/**
 * Compress image file using Sharp
 * @param {Buffer} imageBuffer - Image buffer to compress
 * @param {string} mimetype - MIME type of the image
 * @param {number} maxWidth - Maximum width (default: 1920)
 * @param {number} maxHeight - Maximum height (default: 1920)
 * @param {number} quality - Quality 1-100 (default: 85)
 * @returns {Promise<Buffer>} Compressed image buffer
 */
const compressImage = async (imageBuffer, mimetype, maxWidth = 1920, maxHeight = 1920, quality = 85) => {
  // If Sharp is not available, return original buffer
  if (!sharp) {
    console.warn('Sharp not available, skipping image compression');
    return imageBuffer;
  }
  
  try {
    let sharpInstance = sharp(imageBuffer);

    // Get image metadata
    const metadata = await sharpInstance.metadata();
    const { width, height, format } = metadata;

    // Determine output format based on mimetype
    let outputFormat = format;
    if (mimetype.includes('jpeg') || mimetype.includes('jpg')) {
      outputFormat = 'jpeg';
    } else if (mimetype.includes('png')) {
      outputFormat = 'png';
    } else if (mimetype.includes('webp')) {
      outputFormat = 'webp';
    }

    // Calculate new dimensions if image is too large
    let newWidth = width;
    let newHeight = height;
    
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      newWidth = Math.round(width * ratio);
      newHeight = Math.round(height * ratio);
    }

    // Compress based on format
    if (outputFormat === 'jpeg' || outputFormat === 'jpg') {
      return await sharpInstance
        .resize(newWidth, newHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ 
          quality,
          progressive: true,
          mozjpeg: true
        })
        .toBuffer();
    } else if (outputFormat === 'png') {
      return await sharpInstance
        .resize(newWidth, newHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .png({ 
          quality,
          compressionLevel: 9,
          adaptiveFiltering: true
        })
        .toBuffer();
    } else if (outputFormat === 'webp') {
      return await sharpInstance
        .resize(newWidth, newHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ 
          quality,
          effort: 6
        })
        .toBuffer();
    } else {
      // For other formats, just resize
      return await sharpInstance
        .resize(newWidth, newHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .toBuffer();
    }
  } catch (error) {
    console.error('Image compression error:', error.message);
    // Return original buffer if compression fails
    console.warn('Returning original image without compression');
    return imageBuffer;
  }
};

/**
 * Compress PDF file (basic optimization - PDF compression requires specialized libraries)
 * For now, we'll return the original buffer as PDF compression is complex
 * Cloudinary will handle PDF optimization on their end
 * @param {Buffer} pdfBuffer - PDF buffer
 * @returns {Promise<Buffer>} PDF buffer (currently returns original)
 */
const compressPDF = async (pdfBuffer) => {
  try {
    // PDF compression is complex and requires specialized libraries
    // For now, we rely on Cloudinary's optimization
    // If file is too large (>10MB), we can add PDF compression library later
    if (pdfBuffer.length > 10 * 1024 * 1024) {
      console.warn('PDF file is large (>10MB). Consider compressing before upload.');
    }
    return pdfBuffer;
  } catch (error) {
    console.error('PDF compression error:', error);
    return pdfBuffer;
  }
};

/**
 * Main compression function that routes to appropriate compressor
 * @param {Buffer} fileBuffer - File buffer to compress
 * @param {string} mimetype - MIME type of the file
 * @param {Object} options - Compression options
 * @returns {Promise<Buffer>} Compressed file buffer
 */
const compressFile = async (fileBuffer, mimetype, options = {}) => {
  try {
    const {
      maxWidth = 1920,
      maxHeight = 1920,
      quality = 85,
      maxFileSize = 5 * 1024 * 1024 // 5MB default max
    } = options;

    // If file is already small enough, skip compression
    if (fileBuffer.length <= maxFileSize) {
      console.log(`File size (${(fileBuffer.length / 1024).toFixed(2)}KB) is within limit, skipping compression`);
      return fileBuffer;
    }

    // Check if it's an image
    if (mimetype.startsWith('image/')) {
      console.log(`Compressing image: ${mimetype}, Original size: ${(fileBuffer.length / 1024).toFixed(2)}KB`);
      const compressed = await compressImage(fileBuffer, mimetype, maxWidth, maxHeight, quality);
      console.log(`Compressed size: ${(compressed.length / 1024).toFixed(2)}KB (${((1 - compressed.length / fileBuffer.length) * 100).toFixed(1)}% reduction)`);
      return compressed;
    }

    // Check if it's a PDF
    if (mimetype === 'application/pdf') {
      console.log(`PDF file detected: ${(fileBuffer.length / 1024).toFixed(2)}KB`);
      // For now, return original - Cloudinary will optimize
      return await compressPDF(fileBuffer);
    }

    // For other file types, return as-is
    console.log(`File type ${mimetype} not compressed, returning original`);
    return fileBuffer;
  } catch (error) {
    console.error('File compression error:', error);
    // Return original buffer if compression fails
    return fileBuffer;
  }
};

module.exports = {
  compressFile,
  compressImage,
  compressPDF
};

