// Photo Manager - Handles image compression, resizing, and storage
class PhotoManager {
    constructor() {
        this.maxWidth = 1200;
        this.maxHeight = 1200;
        this.quality = 0.92;
        this.thumbnailSize = 150;
    }

    // Convert file to compressed base64
    async processPhoto(file) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type.startsWith('image/')) {
                reject(new Error('Invalid file type. Please select an image.'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const compressedData = this.compressImage(img);
                        resolve(compressedData);
                    } catch (error) {
                        reject(error);
                    }
                };
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    // Compress and resize image
    compressImage(img) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Calculate new dimensions
        const { width, height } = this.calculateDimensions(img.width, img.height);

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to base64 with compression
        return canvas.toDataURL('image/jpeg', this.quality);
    }

    // Create thumbnail
    createThumbnail(base64Data) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                const size = this.thumbnailSize;
                canvas.width = size;
                canvas.height = size;

                // Calculate crop area for square thumbnail
                const minDim = Math.min(img.width, img.height);
                const startX = (img.width - minDim) / 2;
                const startY = (img.height - minDim) / 2;

                ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, size, size);

                resolve(canvas.toDataURL('image/jpeg', this.quality));
            };
            img.onerror = () => reject(new Error('Failed to create thumbnail'));
            img.src = base64Data;
        });
    }

    // Calculate proportional dimensions
    calculateDimensions(originalWidth, originalHeight) {
        let { width, height } = { width: originalWidth, height: originalHeight };

        // Scale down if too large
        if (width > this.maxWidth) {
            height = (height * this.maxWidth) / width;
            width = this.maxWidth;
        }

        if (height > this.maxHeight) {
            width = (width * this.maxHeight) / height;
            height = this.maxHeight;
        }

        return { width: Math.round(width), height: Math.round(height) };
    }

    // Setup photo upload for an element
    setupPhotoUpload(fileInputId, previewElementId, callback) {
        const fileInput = document.getElementById(fileInputId);
        const previewElement = document.getElementById(previewElementId);

        if (!fileInput) {
            console.error('File input not found:', fileInputId);
            return;
        }

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                // Show loading state
                if (previewElement) {
                    previewElement.innerHTML = '⏳';
                    previewElement.style.display = 'flex';
                    previewElement.style.justifyContent = 'center';
                    previewElement.style.alignItems = 'center';
                }

                // Process the photo (high quality for full-screen)
                const fullSizePhoto = await this.processPhoto(file);

                // Create thumbnail for display
                const thumbnail = await this.createThumbnail(fullSizePhoto);

                // Update preview with thumbnail
                if (previewElement) {
                    const img = document.createElement('img');
                    img.src = thumbnail;
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = 'cover';
                    img.style.borderRadius = '50%';

                    previewElement.innerHTML = '';
                    previewElement.appendChild(img);
                }

                // Call callback with both versions
                if (callback) {
                    callback({
                        fullSize: fullSizePhoto,
                        thumbnail: thumbnail
                    });
                }

                window.showToast('Photo uploaded successfully!', 'success');
            } catch (error) {
                console.error('Photo processing error:', error);
                window.showToast(error.message, 'error');

                // Reset preview on error
                if (previewElement) {
                    previewElement.innerHTML = '📷';
                }
            }
        });
    }

    // Create photo preview element
    createPhotoPreview(photoData, size = '100px', onClick = null) {
        const container = document.createElement('div');
        container.className = 'photo-preview-container';
        container.style.cssText = `
            width: ${size};
            height: ${size};
            border-radius: 50%;
            overflow: hidden;
            border: 2px solid var(--border-color);
            cursor: ${onClick ? 'pointer' : 'default'};
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: var(--background-color);
        `;

        if (photoData) {
            const img = document.createElement('img');
            img.src = photoData;
            img.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
            `;
            container.appendChild(img);

            if (onClick) {
                container.addEventListener('click', () => onClick(photoData));
            }
        } else {
            container.innerHTML = '📷';
            container.style.fontSize = '2rem';
            container.style.color = 'var(--light-text-color)';
        }

        return container;
    }

    // Validate image file
    validateImageFile(file) {
        if (!file) {
            throw new Error('No file selected');
        }

        if (!file.type.startsWith('image/')) {
            throw new Error('File must be an image');
        }

        // Check file size (5MB limit)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            throw new Error('Image file too large. Maximum size is 5MB.');
        }

        return true;
    }

    // Get image dimensions from base64
    getImageDimensions(base64Data) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                resolve({ width: img.width, height: img.height });
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = base64Data;
        });
    }

    // Convert base64 to blob (for potential future use)
    base64ToBlob(base64Data) {
        const [header, data] = base64Data.split(',');
        const mimeMatch = header.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+)/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';

        const byteCharacters = atob(data);
        const byteNumbers = new Array(byteCharacters.length);

        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }

        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mime });
    }

    // Estimate storage size of base64 image
    getStorageSize(base64Data) {
        // Base64 encoding increases size by ~33%
        const bytes = (base64Data.length * 3) / 4;

        if (bytes < 1024) {
            return `${bytes.toFixed(0)} bytes`;
        } else if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        } else {
            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        }
    }
}

window.PhotoManager = PhotoManager;