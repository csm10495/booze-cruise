// Cruise Highlights Exporter - Generates dynamic cruise summary images
class CruiseHighlightsExporter {
    constructor(storage, photoManager) {
        this.storage = storage;
        this.photoManager = photoManager;
        this.canvas = null;
        this.ctx = null;
        this.canvasWidth = 1200;
        this.canvasHeight = 3000; // Start with much larger height for more photos
        this.padding = 0;
        this.sectionSpacing = 0;
        this.currentY = this.padding;
        this.sections = []; // Track section heights for dynamic sizing
    }

    async generateHighlightsImage(cruiseId) {
        try {
            // Get cruise and analytics data
            const cruise = await this.storage.getCruise(cruiseId);
            const data = await this.storage.getAnalyticsData(cruiseId);

            if (!cruise || !data.records.length) {
                throw new Error('No data available for this cruise');
            }

            // Initialize canvas
            this.initializeCanvas();

            // Reset position
            this.currentY = this.padding;

            // Generate sections
            await this.drawCruiseHeader(cruise);
            await this.drawStatisticsSection(data);
            await this.drawFavoritesSection(data);
            await this.drawPhotoCollage(data);

            // Add extra space before finalizing
            this.currentY += this.sectionSpacing;

            // Adjust canvas height to fit content
            await this.finalizeCanvas();

            this.drawFooter();

            // Return canvas data URL
            return this.canvas.toDataURL('image/png', 1.0);
        } catch (error) {
            console.error('Error generating highlights image:', error);
            throw error;
        }
    }

    initializeCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.canvasWidth;
        this.canvas.height = this.canvasHeight;
        this.ctx = this.canvas.getContext('2d');

        // Set high DPI for better quality
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width *= dpr;
        this.canvas.height *= dpr;
        this.ctx.scale(dpr, dpr);

        // Fill background with gradient
        this.drawBackground();
    }

    drawBackground() {
        // Create a more dynamic gradient background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvasHeight);
        gradient.addColorStop(0, '#f0f8ff');
        gradient.addColorStop(0.3, '#f8f9fa');
        gradient.addColorStop(0.7, '#e3f2fd');
        gradient.addColorStop(1, '#e8eaf6');

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        // Add decorative geometric shapes for infographic feel
        this.addBackgroundDecorations();
    }

    addBackgroundDecorations() {
        this.ctx.save();

        // Add scattered circles
        const colors = ['#FF6B3520', '#4CAF5020', '#9C27B020', '#FF980020', '#2196F320'];

        for (let i = 0; i < 8; i++) {
            const x = Math.random() * this.canvasWidth;
            const y = Math.random() * this.canvasHeight;
            const radius = 30 + Math.random() * 80;
            const color = colors[i % colors.length];

            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Add some triangular shapes
        for (let i = 0; i < 5; i++) {
            const x = Math.random() * this.canvasWidth;
            const y = Math.random() * this.canvasHeight;
            const size = 20 + Math.random() * 40;
            const color = colors[i % colors.length];

            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.moveTo(x, y);
            this.ctx.lineTo(x + size, y + size);
            this.ctx.lineTo(x - size, y + size);
            this.ctx.closePath();
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    async drawCruiseHeader(cruise) {
        const headerHeight = 140;

        // Draw dynamic header background with angled design
        this.ctx.save();

        // Main header rectangle with slight angle
        const headerGradient = this.ctx.createLinearGradient(0, this.currentY, 0, this.currentY + headerHeight);
        headerGradient.addColorStop(0, '#FF6B35');
        headerGradient.addColorStop(0.5, '#2196F3');
        headerGradient.addColorStop(1, '#1976D2');

        this.ctx.fillStyle = headerGradient;

        // Create angled header shape
        this.ctx.beginPath();
        this.ctx.moveTo(this.padding, this.currentY);
        this.ctx.lineTo(this.canvasWidth - this.padding, this.currentY);
        this.ctx.lineTo(this.canvasWidth - this.padding - 20, this.currentY + headerHeight);
        this.ctx.lineTo(this.padding + 20, this.currentY + headerHeight);
        this.ctx.closePath();
        this.ctx.fill();

        // Add decorative elements
        this.ctx.fillStyle = 'rgba(255,255,255,0.1)';
        this.ctx.beginPath();
        this.ctx.arc(this.canvasWidth - 80, this.currentY + 30, 50, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.restore();

        // Draw cruise cover photo if available
        if (cruise.coverPhoto) {
            try {
                const img = await this.loadImage(cruise.coverPhoto);
                const photoSize = 80;
                const photoX = this.padding + 20;
                const photoY = this.currentY + (headerHeight - photoSize) / 2;

                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.arc(photoX + photoSize/2, photoY + photoSize/2, photoSize/2, 0, Math.PI * 2);
                this.ctx.clip();
                this.ctx.drawImage(img, photoX, photoY, photoSize, photoSize);
                this.ctx.restore();
            } catch (error) {
                console.warn('Failed to load cruise cover photo:', error);
            }
        }

        // Draw cruise name
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 36px Arial, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(cruise.name, this.canvasWidth / 2, this.currentY + 45);

        // Draw cruise dates
        this.ctx.font = '20px Arial, sans-serif';
        const startDate = new Date(cruise.startDate).toLocaleDateString();
        const endDate = new Date(cruise.endDate).toLocaleDateString();
        this.ctx.fillText(`${startDate} - ${endDate}`, this.canvasWidth / 2, this.currentY + 75);

        this.currentY += headerHeight + this.sectionSpacing;
    }

    async drawStatisticsSection(data) {
        const sectionHeight = 200;
        const cardWidth = (this.canvasWidth - 2 * this.padding - 3 * 20) / 4; // 4 cards with spacing

        // Section title
        this.ctx.fillStyle = '#333';
        this.ctx.font = 'bold 28px Arial, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('📊 Cruise Statistics', this.padding, this.currentY + 30);

        this.currentY += 50;

        // Calculate statistics
        const stats = this.calculateStatistics(data);

        // Draw infographic-style stat cards with varied heights and decorations
        const statCards = [
            { label: 'Total Drinks', value: stats.totalDrinks, color: '#FF6B35', icon: '🍹' },
            { label: 'People', value: stats.totalPeople, color: '#4CAF50', icon: '👥' },
            { label: 'Drink Types', value: stats.drinkTypes, color: '#9C27B0', icon: '🎯' },
            { label: 'Days Active', value: stats.daysActive, color: '#FF9800', icon: '📅' }
        ];

        for (let i = 0; i < statCards.length; i++) {
            const x = this.padding + i * (cardWidth + 20);
            const y = this.currentY;
            const cardHeight = 120 + (i % 2) * 20; // Vary heights slightly

            await this.drawInfographicStatCard(x, y, cardWidth, cardHeight, statCards[i], i);
        }

        this.currentY += 140 + this.sectionSpacing;
    }

    async drawStatCard(x, y, width, height, stat) {
        // Card background
        this.ctx.fillStyle = 'white';
        this.ctx.shadowColor = 'rgba(0,0,0,0.1)';
        this.ctx.shadowBlur = 10;
        this.ctx.shadowOffsetY = 2;
        this.ctx.fillRect(x, y, width, height);
        this.ctx.shadowColor = 'transparent';

        // Card border
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, width, height);

        // Stat value
        this.ctx.fillStyle = stat.color;
        this.ctx.font = 'bold 32px Arial, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(stat.value.toString(), x + width/2, y + 45);

        // Stat label
        this.ctx.fillStyle = '#666';
        this.ctx.font = '16px Arial, sans-serif';
        this.ctx.fillText(stat.label, x + width/2, y + 75);
    }

    async drawFavoritesSection(data) {
        const favorites = this.calculateFavorites(data);

        if (favorites.length === 0) {
            return; // Skip if no favorites
        }

        // Add decorative section divider
        this.drawSectionDivider();

        // Section title with decorative background
        this.ctx.save();

        // Title background shape
        this.ctx.fillStyle = '#FFE082';
        this.ctx.beginPath();
        this.ctx.moveTo(this.padding - 10, this.currentY + 10);
        this.ctx.lineTo(this.padding + 350, this.currentY + 5);
        this.ctx.lineTo(this.padding + 360, this.currentY + 45);
        this.ctx.lineTo(this.padding, this.currentY + 50);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.fillStyle = '#333';
        this.ctx.font = 'bold 28px Arial, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('🌟 Personal Favorites', this.padding, this.currentY + 35);

        this.ctx.restore();

        this.currentY += 70;

        // Draw favorites in dynamic layout
        for (let i = 0; i < Math.min(favorites.length, 3); i++) {
            const favorite = favorites[i];
            await this.drawInfographicFavoriteItem(favorite, i);
        }

        this.currentY += this.sectionSpacing;
    }

    drawSectionDivider() {
        // Add a decorative wavy line divider
        this.ctx.save();
        this.ctx.strokeStyle = '#E0E0E0';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();

        const startX = this.padding;
        const endX = this.canvasWidth - this.padding;
        const y = this.currentY - 10;

        for (let x = startX; x <= endX; x += 20) {
            const waveY = y + Math.sin((x - startX) * 0.02) * 5;
            if (x === startX) {
                this.ctx.moveTo(x, waveY);
            } else {
                this.ctx.lineTo(x, waveY);
            }
        }
        this.ctx.stroke();
        this.ctx.restore();
    }

    async drawInfographicFavoriteItem(favorite, index) {
        const itemHeight = 80;
        const y = this.currentY + index * (itemHeight + 15);
        const colors = ['#FF6B35', '#4CAF50', '#9C27B0'];
        const color = colors[index % colors.length];

        // Dynamic background shape
        this.ctx.save();
        this.ctx.fillStyle = color + '20';

        if (index % 2 === 0) {
            // Rounded rectangle for even items
            this.ctx.beginPath();
            this.ctx.roundRect(this.padding - 10, y - 10, this.canvasWidth - 2 * this.padding + 20, itemHeight + 20, 15);
            this.ctx.fill();
        } else {
            // Angled shape for odd items
            this.ctx.beginPath();
            this.ctx.moveTo(this.padding + 10, y - 5);
            this.ctx.lineTo(this.canvasWidth - this.padding, y - 10);
            this.ctx.lineTo(this.canvasWidth - this.padding - 10, y + itemHeight + 5);
            this.ctx.lineTo(this.padding, y + itemHeight + 10);
            this.ctx.closePath();
            this.ctx.fill();
        }

        // Person photo with decorative frame
        let textStartX = this.padding + 20;
        if (favorite.person.photo && favorite.person.photo.startsWith('data:')) {
            try {
                const img = await this.loadImage(favorite.person.photo);
                const photoSize = 50;
                const photoX = this.padding + 15;
                const photoY = y + (itemHeight - photoSize) / 2;

                // Decorative photo frame
                this.ctx.fillStyle = color;
                this.ctx.fillRect(photoX - 5, photoY - 5, photoSize + 10, photoSize + 10);

                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.arc(photoX + photoSize/2, photoY + photoSize/2, photoSize/2, 0, Math.PI * 2);
                this.ctx.clip();
                this.ctx.drawImage(img, photoX, photoY, photoSize, photoSize);
                this.ctx.restore();

                textStartX = photoX + photoSize + 20;
            } catch (error) {
                console.warn('Failed to load person photo:', error);
            }
        }

        // Favorite text with dynamic styling
        this.ctx.fillStyle = '#333';
        this.ctx.font = 'bold 22px Arial, sans-serif';
        this.ctx.textAlign = 'left';
        const text = `${favorite.person.name}'s favorite`;
        this.ctx.fillText(text, textStartX, y + itemHeight/2 - 5);

        this.ctx.fillStyle = color;
        this.ctx.font = '18px Arial, sans-serif';
        this.ctx.fillText(`${favorite.drink.name} (${favorite.count}x)`, textStartX, y + itemHeight/2 + 20);

        // Add count badge
        const badgeX = this.canvasWidth - this.padding - 60;
        const badgeY = y + itemHeight/2 - 15;
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(badgeX, badgeY, 20, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 16px Arial, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(favorite.count.toString(), badgeX, badgeY + 5);

        this.ctx.restore();

        if (index === Math.min(favorites.length - 1, 2)) {
            this.currentY += (index + 1) * (itemHeight + 15);
        }
    }

    async drawFavoriteItem(favorite, index) {
        const itemHeight = 60;
        const y = this.currentY + index * (itemHeight + 10);

        // Background
        this.ctx.fillStyle = index % 2 === 0 ? '#f8f9fa' : 'white';
        this.ctx.fillRect(this.padding, y, this.canvasWidth - 2 * this.padding, itemHeight);

        // Person photo if available
        let textStartX = this.padding + 20;
        if (favorite.person.photo && favorite.person.photo.startsWith('data:')) {
            try {
                const img = await this.loadImage(favorite.person.photo);
                const photoSize = 40;
                const photoX = this.padding + 10;
                const photoY = y + (itemHeight - photoSize) / 2;

                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.arc(photoX + photoSize/2, photoY + photoSize/2, photoSize/2, 0, Math.PI * 2);
                this.ctx.clip();
                this.ctx.drawImage(img, photoX, photoY, photoSize, photoSize);
                this.ctx.restore();

                textStartX = photoX + photoSize + 15;
            } catch (error) {
                console.warn('Failed to load person photo:', error);
            }
        }

        // Favorite text
        this.ctx.fillStyle = '#333';
        this.ctx.font = '20px Arial, sans-serif';
        this.ctx.textAlign = 'left';
        const text = `${favorite.person.name}'s favorite: ${favorite.drink.name} (${favorite.count}x)`;
        this.ctx.fillText(text, textStartX, y + itemHeight/2 + 7);

        // Drink photo if available
        if (favorite.drink.photo && favorite.drink.photo.startsWith('data:')) {
            try {
                const img = await this.loadImage(favorite.drink.photo);
                const photoSize = 30;
                const photoX = this.canvasWidth - this.padding - photoSize - 10;
                const photoY = y + (itemHeight - photoSize) / 2;

                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.arc(photoX + photoSize/2, photoY + photoSize/2, photoSize/2, 0, Math.PI * 2);
                this.ctx.clip();
                this.ctx.drawImage(img, photoX, photoY, photoSize, photoSize);
                this.ctx.restore();
            } catch (error) {
                console.warn('Failed to load drink photo:', error);
            }
        }

        if (index === Math.min(favorites.length - 1, 2)) {
            this.currentY += (index + 1) * (itemHeight + 10);
        }
    }

    async drawPhotoCollage(data) {
        // Get all available photos - both record photos and drink photos
        const allRecordsWithPhotos = data.records.filter(record =>
            record.photo && record.photo.startsWith('data:')
        );

        // Get drink photos as well
        const drinkPhotos = data.drinks.filter(drink =>
            drink.photo && drink.photo.startsWith('data:')
        ).map(drink => ({
            type: 'drink',
            photo: drink.photo,
            drinkId: drink.id,
            drinkName: drink.name
        }));

        // Prioritize record photos over drink photos
        const recordPhotos = allRecordsWithPhotos;
        const prioritizedPhotoSources = [...recordPhotos, ...drinkPhotos];

        if (prioritizedPhotoSources.length === 0) {
            return; // Skip if no photos
        }

        // Deduplicate photos by photo content, prioritizing record photos
        const uniquePhotos = [];
        const seenPhotoHashes = new Set();

        for (const item of prioritizedPhotoSources) {
            // Create a better hash using a portion from the middle of the base64 data
            const base64Start = item.photo.indexOf(',') + 1;
            const base64Data = item.photo.substring(base64Start);

            // Use a portion from the middle of the base64 data (more unique than start)
            const hashStart = Math.floor(base64Data.length * 0.3);
            const hashEnd = Math.floor(base64Data.length * 0.7);
            const photoHash = base64Data.substring(hashStart, hashEnd);

            if (!seenPhotoHashes.has(photoHash)) {
                seenPhotoHashes.add(photoHash);
                uniquePhotos.push(item);
            }
        }

        // Add decorative section divider
        this.drawSectionDivider();

        // Section title with dynamic background
        this.ctx.save();

        // Scattered background elements for memories section
        for (let i = 0; i < 5; i++) {
            const x = this.padding + Math.random() * (this.canvasWidth - 2 * this.padding);
            const y = this.currentY + Math.random() * 40;
            const size = 5 + Math.random() * 10;

            this.ctx.fillStyle = '#FF6B3540';
            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Title with colorful background
        this.ctx.fillStyle = '#E1F5FE';
        this.ctx.beginPath();
        this.ctx.moveTo(this.padding - 5, this.currentY + 15);
        this.ctx.lineTo(this.padding + 320, this.currentY + 10);
        this.ctx.lineTo(this.padding + 330, this.currentY + 45);
        this.ctx.lineTo(this.padding + 5, this.currentY + 50);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.fillStyle = '#333';
        this.ctx.font = 'bold 28px Arial, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('📸 Cruise Memories', this.padding, this.currentY + 35);

        this.ctx.restore();

        // If we have very few photos, skip the collage section to save space
        if (uniquePhotos.length < 3) {
            console.log('Too few photos for collage section, skipping to save space');
            return;
        }

        this.currentY += 50;

        // Infographic-style scattered photo layout with aggressive space filling and regeneration
        await this.generateOptimalPhotoCollage(uniquePhotos, data);
    }

    async drawPhotoWithLabel(record, x, y, size, data) {
        try {
            // Load and draw photo
            const img = await this.loadImage(record.photoFull || record.photo);

            // Photo background/border
            this.ctx.fillStyle = 'white';
            this.ctx.shadowColor = 'rgba(0,0,0,0.2)';
            this.ctx.shadowBlur = 8;
            this.ctx.shadowOffsetY = 4;
            this.ctx.fillRect(x - 4, y - 4, size + 8, size + 8);
            this.ctx.shadowColor = 'transparent';

            // Calculate aspect ratio preserving dimensions
            const aspectRatio = img.width / img.height;
            let drawWidth = size;
            let drawHeight = size;
            let drawX = x;
            let drawY = y;

            if (aspectRatio > 1) {
                // Landscape: fit height, center horizontally
                drawHeight = size;
                drawWidth = size * aspectRatio;
                drawX = x + (size - drawWidth) / 2;
            } else {
                // Portrait or square: fit width, center vertically
                drawWidth = size;
                drawHeight = size / aspectRatio;
                drawY = y + (size - drawHeight) / 2;
            }

            // Draw photo with preserved aspect ratio
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.roundRect(x, y, size, size, 8);
            this.ctx.clip();
            this.ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
            this.ctx.restore();

            // Label background
            const labelY = y + size + 10;
            const labelHeight = 40;
            this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
            this.ctx.fillRect(x, labelY, size, labelHeight);

            // Photo label
            const person = data.people.find(p => p.id === record.personId);
            const drink = data.drinks.find(d => d.id === record.drinkId);
            const date = new Date(record.timestamp).toLocaleDateString();

            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 14px Arial, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`${person?.name || 'Unknown'}`, x + size/2, labelY + 16);

            this.ctx.font = '12px Arial, sans-serif';
            this.ctx.fillText(`${drink?.name || 'Unknown'} • ${date}`, x + size/2, labelY + 32);

        } catch (error) {
            console.warn('Failed to load photo for collage:', error);

            // Draw placeholder
            this.ctx.fillStyle = '#e0e0e0';
            this.ctx.fillRect(x, y, size, size);
            this.ctx.fillStyle = '#999';
            this.ctx.font = '24px Arial, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('📷', x + size/2, y + size/2 + 8);
        }
    }

    async finalizeCanvas() {
        // Calculate actual content height with generous padding for footer
        const contentHeight = this.currentY + 100; // More generous footer space

        console.log(`Finalizing canvas: currentY=${this.currentY}, contentHeight=${contentHeight}, originalHeight=${this.canvasHeight}`);

        // Always resize if content height is different
        if (contentHeight !== this.canvasHeight) {
            // Create new canvas with correct height
            const newCanvas = document.createElement('canvas');
            const dpr = window.devicePixelRatio || 1;
            newCanvas.width = this.canvasWidth * dpr;
            newCanvas.height = contentHeight * dpr;

            const newCtx = newCanvas.getContext('2d');
            newCtx.scale(dpr, dpr);

            // Draw the background first
            const gradient = newCtx.createLinearGradient(0, 0, 0, contentHeight);
            gradient.addColorStop(0, '#f8f9fa');
            gradient.addColorStop(1, '#e9ecef');
            newCtx.fillStyle = gradient;
            newCtx.fillRect(0, 0, this.canvasWidth, contentHeight);

            // Copy existing content to new canvas - copy the full original canvas
            newCtx.drawImage(this.canvas, 0, 0);

            // Replace canvas
            this.canvas = newCanvas;
            this.ctx = newCtx;
            this.canvasHeight = contentHeight;

            console.log(`Canvas resized to: ${this.canvasWidth}x${this.canvasHeight}`);
        }
    }

    drawFooter() {
        const footerY = this.canvasHeight - 60;

        // Footer background
        this.ctx.fillStyle = 'rgba(0,0,0,0.05)';
        this.ctx.fillRect(0, footerY, this.canvasWidth, 60);

        // Footer text
        this.ctx.fillStyle = '#666';
        this.ctx.font = '16px Arial, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Generated by Booze Cruise App', this.canvasWidth / 2, footerY + 35);
    }

    calculateStatistics(data) {
        const uniquePeople = [...new Set(data.records.map(r => r.personId))];
        const uniqueDrinks = [...new Set(data.records.map(r => r.drinkId))];
        const uniqueDates = [...new Set(data.records.map(r => r.date))];

        return {
            totalDrinks: data.records.length,
            totalPeople: uniquePeople.length,
            drinkTypes: uniqueDrinks.length,
            daysActive: uniqueDates.length
        };
    }

    calculateFavorites(data) {
        const personDrinkCounts = {};

        // Count drinks per person
        data.records.forEach(record => {
            const key = `${record.personId}-${record.drinkId}`;
            personDrinkCounts[key] = (personDrinkCounts[key] || 0) + 1;
        });

        // Find each person's favorite
        const personFavorites = {};
        Object.entries(personDrinkCounts).forEach(([key, count]) => {
            const [personId, drinkId] = key.split('-');
            if (!personFavorites[personId] || count > personFavorites[personId].count) {
                personFavorites[personId] = { drinkId, count };
            }
        });

        // Convert to array with full data
        return Object.entries(personFavorites).map(([personId, favorite]) => {
            const person = data.people.find(p => p.id === personId);
            const drink = data.drinks.find(d => d.id === favorite.drinkId);
            return {
                person,
                drink,
                count: favorite.count
            };
        }).filter(f => f.person && f.drink)
          .sort((a, b) => b.count - a.count);
    }

    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    // Helper for rounded rectangles
    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + width, y, x + width, y + height, radius);
        ctx.arcTo(x + width, y + height, x, y + height, radius);
        ctx.arcTo(x, y + height, x, y, radius);
        ctx.arcTo(x, y, x + width, y, radius);
        ctx.closePath();
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    calculateOverlapArea(pos1, pos2) {
        // Calculate the actual rectangular overlap area between two photos
        const left1 = pos1.x;
        const right1 = pos1.x + pos1.size;
        const top1 = pos1.y;
        const bottom1 = pos1.y + pos1.size;

        const left2 = pos2.x;
        const right2 = pos2.x + pos2.size;
        const top2 = pos2.y;
        const bottom2 = pos2.y + pos2.size;

        // Find the overlapping rectangle
        const overlapLeft = Math.max(left1, left2);
        const overlapRight = Math.min(right1, right2);
        const overlapTop = Math.max(top1, top2);
        const overlapBottom = Math.min(bottom1, bottom2);

        // Check if there's any overlap
        if (overlapLeft >= overlapRight || overlapTop >= overlapBottom) {
            return 0; // No overlap
        }

        // Calculate overlap area
        const overlapWidth = overlapRight - overlapLeft;
        const overlapHeight = overlapBottom - overlapTop;
        return overlapWidth * overlapHeight;
    }


    generateEdgeBleedingPositions(count, width, height, minSize, maxSize) {
        const positions = [];
        const attempts = 300; // More attempts for edge bleeding
        const labelSpace = 0; // Very minimal label space
        const padding = this.padding;

        for (let i = 0; i < count; i++) {
            let position = null;
            let attempt = 0;

            while (!position && attempt < attempts) {
                // Favor larger sizes for better space filling
                const sizeVariation = Math.random();
                let size;

                if (count > 20) {
                    // Many photos: still favor larger sizes but with more variety
                    const largeBias = Math.pow(sizeVariation, 0.7); // Slight bias to larger
                    size = minSize + largeBias * (maxSize - minSize);
                } else if (count > 10) {
                    // Medium photos: heavily favor larger sizes
                    const largeBias = Math.pow(sizeVariation, 0.5); // Strong bias to larger
                    size = minSize + largeBias * (maxSize - minSize);
                } else {
                    // Few photos: maximize size
                    size = minSize + sizeVariation * (maxSize - minSize);
                }

                // 25% chance for extra large photos
                if (Math.random() < 0.25) {
                    size = Math.max(size, minSize + 0.8 * (maxSize - minSize));
                }

                // Allow positions that extend well beyond canvas edges for spreading
                const minX = -size * 0.5; // Allow 50% bleed on left for more spreading
                const maxX = width - size * 0.5; // Allow 50% bleed on right for more spreading
                const x = minX + Math.random() * (maxX - minX);

                // Looser Y positioning to allow more spreading
                const maxY = height - size - labelSpace;
                const y = Math.random() * maxY; // Use full available height for spreading
                const rotation = (Math.random() - 0.5) * 0.6; // More rotation for interest

                const newPosition = { x, y, size, rotation };

                // Check for excessive overlap using actual area calculation
                const hasExcessiveOverlap = positions.some(pos => {
                    const overlapArea = this.calculateOverlapArea(newPosition, pos);

                    if (overlapArea === 0) return false;

                    const area1 = newPosition.size * newPosition.size;
                    const area2 = pos.size * pos.size;
                    const smallerArea = Math.min(area1, area2);

                    const overlapPercentage = (overlapArea / smallerArea) * 100;
                    return overlapPercentage > 10; // Allow max 10% overlap
                });

                if (!hasExcessiveOverlap) {
                    position = newPosition;
                }
                attempt++;
            }

            // Aggressive fallback with edge bleeding
            if (!position) {
                const strategies = [
                    // Strategy 1: Edge bleeding grid
                    () => {
                        const size = minSize + (Math.random() * 0.7) * (maxSize - minSize); // Larger fallback sizes (already using doubled minSize/maxSize)
                        const cols = Math.ceil(Math.sqrt(count * 1.2)); // Fewer columns for larger photos
                        const row = Math.floor(i / cols);
                        const col = i % cols;
                        const cellWidth = width / cols;
                        const cellHeight = (height - labelSpace) / Math.ceil(count / cols);

                        // Allow grid positions to bleed off edges
                        const baseX = col * cellWidth - size * 0.15; // Start 15% off left
                        const baseY = row * cellHeight;

                        return {
                            x: baseX + Math.random() * (cellWidth * 0.3), // Some randomness
                            y: baseY + Math.random() * Math.max(0, cellHeight - size),
                            size,
                            rotation: (Math.random() - 0.5) * 0.6
                        };
                    },

                    // Strategy 2: Random edge bleeding placement
                    () => {
                        const size = minSize + (Math.random() * 0.6) * (maxSize - minSize); // Using doubled sizes
                        return {
                            x: -size * 0.2 + Math.random() * (width - size * 0.6), // Allow edge bleeding
                            y: Math.random() * (height - size - labelSpace),
                            size,
                            rotation: (Math.random() - 0.5) * 0.6
                        };
                    },

                    // Strategy 3: Force large photos for space filling
                    () => {
                        const size = minSize + 0.8 * (maxSize - minSize); // Very large (using doubled sizes)
                        return {
                            x: -size * 0.25 + Math.random() * (width - size * 0.5),
                            y: Math.random() * (height - size - labelSpace),
                            size,
                            rotation: (Math.random() - 0.5) * 0.4
                        };
                    }
                ];

                // Try each strategy
                for (const strategy of strategies) {
                    const candidate = strategy();
                    // Check for excessive overlap using actual area calculation in fallback too
                    const hasExcessiveOverlap = positions.some(pos => {
                        const overlapArea = this.calculateOverlapArea(candidate, pos);

                        if (overlapArea === 0) return false;

                        const area1 = candidate.size * candidate.size;
                        const area2 = pos.size * pos.size;
                        const smallerArea = Math.min(area1, area2);

                        const overlapPercentage = (overlapArea / smallerArea) * 100;
                        return overlapPercentage > 10;
                    });

                    if (!hasExcessiveOverlap) {
                        position = candidate;
                        break;
                    }
                }

                // Final fallback: force placement with tight edge bleeding and minimal Y
                if (!position) {
                    const size = Math.max(minSize, maxSize * 0.7);
                    const maxFallbackY = (height - size - labelSpace) * 0.8; // Use only 80% of available Y space
                    position = {
                        x: -size * 0.2 + (i * size * 0.8) % (width - size * 0.6),
                        y: ((Math.floor(i * size * 0.8 / width)) * size * 0.7) % maxFallbackY,
                        size,
                        rotation: (Math.random() - 0.5) * 0.5
                    };
                }
            }

            positions.push(position);
        }

        return positions;
    }

    async generateOptimalPhotoCollage(uniquePhotos, data) {
        const maxPhotos = Math.min(uniquePhotos.length, 100); // Allow more photos for better coverage

        // Prioritize record photos: put them first, then shuffle the selection
        const recordPhotosPriority = uniquePhotos.filter(item => !item.type || item.type !== 'drink');
        const drinkPhotosPriority = uniquePhotos.filter(item => item.type === 'drink');
        const prioritizedPhotos = [...recordPhotosPriority, ...drinkPhotosPriority].slice(0, maxPhotos);

        let bestLayout = null;
        let bestUtilization = 0;
        const maxAttempts = 3; // Try multiple layouts to find optimal one

        console.log(`Generating optimal photo collage with ${maxPhotos} photos...`);

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const shuffledPhotos = this.shuffleArray([...prioritizedPhotos]);

            // Ultra-aggressive photo sizing - 50% bigger photos with edge bleeding
            const minPhotoSize = Math.max(180, 300 - maxPhotos * 5.5); // 50% larger minimum sizes
            const maxPhotoSize = Math.max(270, 525 - maxPhotos * 7.5); // 50% larger maximum sizes
            const availableWidth = this.canvasWidth - 2 * this.padding;
            const bleedWidth = this.canvasWidth; // Allow full width including padding for edge bleeding

            // Calculate very tight height to minimize Y-space and white space
            const avgPhotoSize = (minPhotoSize + maxPhotoSize) / 2;
            const photosPerRow = Math.ceil(Math.sqrt(maxPhotos * 1.8)); // Even wider layout for less height
            const estimatedRows = Math.ceil(maxPhotos / photosPerRow);
            const effectiveHeight = Math.max(
                400, // Even more minimal height
                estimatedRows * (avgPhotoSize * 0.6 + 20) // Ultra-tight packing
            );

            // Create positions with edge bleeding and maximum density
            const photoPositions = this.generateEdgeBleedingPositions(shuffledPhotos.length, bleedWidth, effectiveHeight, minPhotoSize, maxPhotoSize);

            // Calculate proper coverage using a pixel grid sampling approach
            const sampleWidth = Math.ceil(availableWidth / 10); // Sample every 10 pixels
            const sampleHeight = Math.ceil(effectiveHeight / 10);
            let coveredPixels = 0;
            let totalPixels = sampleWidth * sampleHeight;

            // Sample the area to see what's covered by photos
            for (let sx = 0; sx < sampleWidth; sx++) {
                for (let sy = 0; sy < sampleHeight; sy++) {
                    const x = (sx * 10) + this.padding;
                    const y = sy * 10;

                    // Check if this point is covered by any photo
                    const isCovered = photoPositions.some(pos => {
                        const photoX = this.padding + pos.x;
                        const photoY = pos.y;
                        const halfSize = pos.size / 2;

                        // Check if point is within photo bounds (accounting for rotation)
                        const dx = x - (photoX + halfSize);
                        const dy = y - (photoY + halfSize);
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        return distance <= halfSize * Math.sqrt(2); // Account for rotation with diagonal
                    });

                    if (isCovered) coveredPixels++;
                }
            }

            const utilization = (coveredPixels / totalPixels) * 100;
            const backgroundVisibility = 100 - utilization;

            console.log(`Attempt ${attempt + 1}: ${utilization.toFixed(1)}% utilization, ${backgroundVisibility.toFixed(1)}% background visible`);

            // Check if this layout meets our criteria (less than 5% background visible)
            if (backgroundVisibility < 5 && utilization > bestUtilization) {
                bestLayout = {
                    photos: shuffledPhotos,
                    positions: photoPositions,
                    effectiveHeight,
                    utilization,
                    backgroundVisibility
                };
                bestUtilization = utilization;

                // If we found an excellent layout, use it immediately
                if (backgroundVisibility < 3) {
                    console.log(`Excellent layout found on attempt ${attempt + 1}!`);
                    break;
                }
            }
        }

        // If no layout meets criteria, use the best one we found but increase photo sizes
        if (!bestLayout || bestLayout.backgroundVisibility >= 5) {
            console.log('No layout met 5% background criteria, generating enlarged photo layout...');

            const shuffledPhotos = this.shuffleArray([...prioritizedPhotos]);

            // Increase photo sizes even more to reduce background visibility
            const enlargedMinSize = Math.max(220, 360 - maxPhotos * 6); // Larger sizes
            const enlargedMaxSize = Math.max(320, 600 - maxPhotos * 9); // Much larger sizes
            const availableWidth = this.canvasWidth - 2 * this.padding;
            const bleedWidth = this.canvasWidth;

            // Reduce height further for tighter packing
            const avgPhotoSize = (enlargedMinSize + enlargedMaxSize) / 2;
            const photosPerRow = Math.ceil(Math.sqrt(maxPhotos * 2.0)); // Ultra-wide layout
            const estimatedRows = Math.ceil(maxPhotos / photosPerRow);
            const effectiveHeight = Math.max(
                180, // Ultra-minimal height
                estimatedRows * (avgPhotoSize * 0.5 + 15) // Extreme tight packing
            );

            const photoPositions = this.generateEdgeBleedingPositions(shuffledPhotos.length, bleedWidth, effectiveHeight, enlargedMinSize, enlargedMaxSize);

            // Calculate proper coverage using pixel grid sampling
            const sampleWidth = Math.ceil(availableWidth / 10);
            const sampleHeight = Math.ceil(effectiveHeight / 10);
            let coveredPixels = 0;
            let totalPixels = sampleWidth * sampleHeight;

            for (let sx = 0; sx < sampleWidth; sx++) {
                for (let sy = 0; sy < sampleHeight; sy++) {
                    const x = (sx * 10) + this.padding;
                    const y = sy * 10;

                    const isCovered = photoPositions.some(pos => {
                        const photoX = this.padding + pos.x;
                        const photoY = pos.y;
                        const halfSize = pos.size / 2;

                        const dx = x - (photoX + halfSize);
                        const dy = y - (photoY + halfSize);
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        return distance <= halfSize * Math.sqrt(2);
                    });

                    if (isCovered) coveredPixels++;
                }
            }

            const utilization = (coveredPixels / totalPixels) * 100;
            const backgroundVisibility = 100 - utilization;

            bestLayout = {
                photos: shuffledPhotos,
                positions: photoPositions,
                effectiveHeight,
                utilization,
                backgroundVisibility
            };

            console.log(`Enlarged layout: ${utilization.toFixed(1)}% utilization, ${backgroundVisibility.toFixed(1)}% background visible`);
        }

        // Draw the best layout
        const { photos, positions, effectiveHeight, utilization, backgroundVisibility } = bestLayout;

        console.log(`Final layout: ${photos.length} photos, ${utilization.toFixed(1)}% utilization, ${backgroundVisibility.toFixed(1)}% background visible`);

        // Draw photos without any section borders
        for (let i = 0; i < photos.length; i++) {
            const position = positions[i];
            const x = this.padding + position.x; // Keep padding for positioning reference
            const y = this.currentY + position.y;

            await this.drawInfographicPhoto(photos[i], x, y, position.size, position.rotation, data);
        }

        // Update currentY to account for actual used space with no label padding
        const maxUsedY = Math.max(...positions.map(pos => pos.y + pos.size)); // No label space needed
        this.currentY += Math.min(maxUsedY, effectiveHeight * 0.9) + (this.sectionSpacing * 0.3); // Even more minimal section spacing

        console.log(`Photo collage completed: ${backgroundVisibility.toFixed(1)}% background visible (target: <5%)`);
    }

    async drawInfographicStatCard(x, y, width, height, stat, index) {
        // Add decorative background shapes
        this.ctx.save();

        // Decorative circle behind card
        this.ctx.fillStyle = stat.color + '20';
        this.ctx.beginPath();
        this.ctx.arc(x + width + 15, y - 10, 30, 0, Math.PI * 2);
        this.ctx.fill();

        // Main card with slight rotation for variety
        this.ctx.translate(x + width/2, y + height/2);
        this.ctx.rotate((index % 2 === 0 ? 1 : -1) * 0.02); // Slight tilt
        this.ctx.translate(-width/2, -height/2);

        // Card shadow
        this.ctx.fillStyle = 'rgba(0,0,0,0.15)';
        this.ctx.fillRect(3, 3, width, height);

        // Card background
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, width, height);

        // Colored accent bar
        this.ctx.fillStyle = stat.color;
        this.ctx.fillRect(0, 0, width, 8);

        // Icon
        this.ctx.font = '24px Arial, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(stat.icon, width/2, 35);

        // Stat value
        this.ctx.fillStyle = stat.color;
        this.ctx.font = 'bold 28px Arial, sans-serif';
        this.ctx.fillText(stat.value.toString(), width/2, 65);

        // Stat label
        this.ctx.fillStyle = '#666';
        this.ctx.font = '14px Arial, sans-serif';
        this.ctx.fillText(stat.label, width/2, 85);

        this.ctx.restore();
    }

    async drawInfographicPhoto(item, x, y, size, rotation, data) {
        try {
            const img = await this.loadImage(item.photoFull || item.photo);

            this.ctx.save();

            // Apply rotation and position
            this.ctx.translate(x + size/2, y + size/2);
            this.ctx.rotate(rotation);

            // Photo shadow
            this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
            this.ctx.fillRect(-size/2 + 3, -size/2 + 3, size, size);

            // White photo border
            this.ctx.fillStyle = 'white';
            this.ctx.fillRect(-size/2 - 4, -size/2 - 4, size + 8, size + 8);

            // Calculate aspect ratio preserving dimensions
            const aspectRatio = img.width / img.height;
            let drawWidth = size;
            let drawHeight = size;
            let drawX = -size/2;
            let drawY = -size/2;

            if (aspectRatio > 1) {
                drawHeight = size;
                drawWidth = size * aspectRatio;
                drawX = -drawWidth/2;
            } else {
                drawWidth = size;
                drawHeight = size / aspectRatio;
                drawY = -drawHeight/2;
            }

            // Clip to square and draw photo
            this.ctx.beginPath();
            this.ctx.rect(-size/2, -size/2, size, size);
            this.ctx.clip();
            this.ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

            this.ctx.restore();

            // Labels removed per user request - photos only, no text

        } catch (error) {
            console.warn('Failed to load photo for infographic:', error);

            // Fun placeholder
            this.ctx.save();
            this.ctx.translate(x + size/2, y + size/2);
            this.ctx.rotate(rotation);

            this.ctx.fillStyle = '#f0f0f0';
            this.ctx.fillRect(-size/2, -size/2, size, size);
            this.ctx.fillStyle = '#999';
            this.ctx.font = `${Math.min(32, size/3)}px Arial, sans-serif`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(item.type === 'drink' ? '🍹' : '📷', 0, 8);

            this.ctx.restore();
        }
    }
}

// Add roundRect support to canvas context if not available
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
        this.beginPath();
        this.moveTo(x + radius, y);
        this.arcTo(x + width, y, x + width, y + height, radius);
        this.arcTo(x + width, y + height, x, y + height, radius);
        this.arcTo(x, y + height, x, y, radius);
        this.arcTo(x, y, x + width, y, radius);
        this.closePath();
    };
}

window.CruiseHighlightsExporter = CruiseHighlightsExporter;
