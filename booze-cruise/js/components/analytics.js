// Analytics Component - Handles drink analytics and charts
class AnalyticsComponent {
    constructor(storage) {
        this.storage = storage;
        this.currentFilters = {
            startDate: null,
            endDate: null,
            personId: null
        };
        this.highlightsExporter = null;
    }

    async render() {
        const container = document.getElementById('analytics-content');
        const currentCruise = window.app?.getCurrentCruise();

        if (!currentCruise) {
            container.innerHTML = '<div class="message error">No cruise selected. Please go to Settings to create a cruise.</div>';
            return;
        }

        try {
            const analyticsData = await this.storage.getAnalyticsData(currentCruise.id);

            if (analyticsData.records.length === 0) {
                container.innerHTML = this.createEmptyStateHTML();
                return;
            }

            // Apply current filters to the data
            const filteredData = this.applyFiltersToData(analyticsData);

            if (filteredData.records.length === 0) {
                // Check if filters are active to show appropriate empty state
                if (this.hasActiveFilters()) {
                    container.innerHTML = this.createFilteredEmptyStateHTML();
                    this.setupClearFiltersHandler();
                } else {
                    container.innerHTML = this.createEmptyStateHTML();
                }
                return;
            }

            container.innerHTML = this.createAnalyticsHTML(filteredData);
            this.setupEventListeners();
            this.renderCharts(filteredData);
        } catch (error) {
            console.error('Error rendering analytics page:', error);
            container.innerHTML = '<div class="message error">Error loading analytics: ' + error.message + '</div>';
        }
    }

    createEmptyStateHTML() {
        return `
            <div class="analytics-empty-state">
                <div class="empty-icon">📊</div>
                <h3>No Drink Data Yet</h3>
                <p>Start adding drinks to see analytics and charts!</p>
                <button class="btn" onclick="window.app?.navigation?.navigateToPage('add-drink-page')">
                    Add First Drink
                </button>
            </div>
        `;
    }

    createFilteredEmptyStateHTML() {
        return `
            <div class="analytics-empty-state">
                <div class="empty-icon">🔍</div>
                <h3>No Results Found</h3>
                <p>No drink records match your current filters.</p>
                <button class="btn" id="clear-filters-btn">
                    Clear Filters
                </button>
            </div>
        `;
    }

    hasActiveFilters() {
        return this.currentFilters.startDate !== null ||
               this.currentFilters.endDate !== null ||
               this.currentFilters.personId !== null;
    }

    setupClearFiltersHandler() {
        const clearFiltersBtn = document.getElementById('clear-filters-btn');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => this.clearFilters());
        }
    }

    createAnalyticsHTML(data) {
        const dateRange = this.getDateRange(data.records);

        return `
            <div class="analytics-container">
                <!-- Filter and Export Header -->
                <div class="analytics-filter-header">
                    <button class="btn btn-outline" id="export-highlights-btn" title="Export Cruise Highlights">
                        🎉 Export Highlights
                    </button>
                    <button class="filter-toggle-btn" id="filter-toggle-btn" title="Filter Analytics">
                        ${this.getActiveFilterSummary(data)}
                    </button>
                </div>

                <!-- Filter Modal -->
                <div id="filter-modal" class="modal" style="display: none;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>📅 Filter Analytics</h3>
                            <span class="close" id="close-filter-modal">&times;</span>
                        </div>
                        <div class="modal-body">
                            <div class="form-group">
                                <label for="modal-start-date">Start Date</label>
                                <input type="date" id="modal-start-date" value="${this.currentFilters.startDate || dateRange.start}">
                            </div>
                            <div class="form-group">
                                <label for="modal-end-date">End Date</label>
                                <input type="date" id="modal-end-date" value="${this.currentFilters.endDate || dateRange.end}">
                            </div>
                            <div class="form-group">
                                <label for="modal-person-filter">Person</label>
                                <select id="modal-person-filter">
                                    <option value="">All People</option>
                                    ${data.people.map(person =>
                                        `<option value="${person.id}" ${this.currentFilters.personId === person.id ? 'selected' : ''}>${person.name}</option>`
                                    ).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <button class="btn btn-outline" id="clear-all-filters">Clear All Filters</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Summary Cards -->
                <div class="analytics-summary">
                    <div class="summary-card">
                        <div class="summary-number">${data.records.length}</div>
                        <div class="summary-label">Total Drinks</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-number">${this.calculateFilteredPeopleCount(data)}</div>
                        <div class="summary-label">People</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-number">${this.calculateFilteredDrinkTypesCount(data)}</div>
                        <div class="summary-label">Drink Types</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-number">${this.calculateDaysSpan(data.records)}</div>
                        <div class="summary-label">Days</div>
                    </div>
                </div>

                <!-- Charts Section -->
                <div class="analytics-charts">
                    <div class="chart-container card">
                        <h3>🍹 Drinks by Person</h3>
                        <canvas id="drinks-by-person-chart"></canvas>
                    </div>

                    <div class="chart-container card">
                        <h3>📊 Drinks by Type</h3>
                        <canvas id="drinks-by-type-chart"></canvas>
                    </div>

                    <div class="chart-container card">
                        <h3>📅 Drinks Over Time</h3>
                        <canvas id="drinks-over-time-chart"></canvas>
                    </div>
                </div>

                <!-- Per-Person Charts Section -->
                <div class="per-person-charts">
                    <h3>👥 Individual Person Analytics</h3>
                    <div id="person-charts-container">
                        ${this.createPersonChartsHTML(data)}
                    </div>
                </div>

                <!-- Detailed Data Table -->
                <div class="analytics-table card">
                    <h3>📋 Detailed Records</h3>
                    <div class="table-container">
                        ${this.createDataTable(data)}
                    </div>
                </div>
            </div>
        `;
    }

    createDataTable(data) {
        const recordsWithDetails = data.records.map(record => {
            const person = data.people.find(p => p.id === record.personId);
            const drink = data.drinks.find(d => d.id === record.drinkId);
            return { ...record, person, drink };
        });

        // Sort by timestamp (newest first)
        recordsWithDetails.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Person</th>
                        <th>Drink</th>
                        <th>Photo</th>
                    </tr>
                </thead>
                <tbody>
                    ${recordsWithDetails.map(record => `
                        <tr class="table-row" data-record-id="${record.id}">
                            <td>${new Date(record.timestamp).toLocaleDateString()}</td>
                            <td>${new Date(record.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                            <td class="person-cell">
                                ${record.person?.photo ?
                                    (record.person.photo.startsWith('data:') ?
                                        `<img src="${record.person.photo}" class="table-photo clickable-photo"
                                              onclick="window.showModal('${record.person.photoFull || record.person.photo}', '${record.person?.name || 'Person'}')"
                                              alt="${record.person?.name}">` :
                                        `<span class="table-emoji">${record.person.photo}</span>`) :
                                    '👤'
                                }
                                <span>${record.person?.name || 'Unknown'}</span>
                            </td>
                            <td class="drink-cell">
                                ${record.drink?.photo ?
                                    (record.drink.photo.startsWith('data:') ?
                                        `<img src="${record.drink.photo}" class="table-photo clickable-photo"
                                              onclick="window.showModal('${record.drink.photoFull || record.drink.photo}', '${record.drink?.name || 'Drink'}')"
                                              alt="${record.drink?.name}">` :
                                        `<span class="table-emoji">${record.drink.photo}</span>`) :
                                    '🍹'
                                }
                                <span>${record.drink?.name || 'Unknown'}</span>
                            </td>
                            <td class="photo-cell">
                                ${record.photo ?
                                    `<img src="${record.photo}" class="table-photo clickable-photo"
                                          onclick="window.showModal('${record.photoFull || record.photo}', 'Drink Photo - ${new Date(record.timestamp).toLocaleString()}')"
                                          alt="Drink photo">` :
                                    '—'
                                }
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    createPersonChartsHTML(data) {
        if (data.people.length === 0) {
            return '<p class="text-muted">No people added yet.</p>';
        }

        // Only show people who have records in the filtered data
        const peopleWithRecords = data.people.filter(person => {
            const personRecords = data.records.filter(record => record.personId === person.id);
            return personRecords.length > 0;
        });

        if (peopleWithRecords.length === 0) {
            return '<p class="text-muted">No people have drinks matching the current filters.</p>';
        }

        return peopleWithRecords.map(person => {
            const personRecords = data.records.filter(record => record.personId === person.id);

            return `
                <div class="person-chart-container card">
                    <h4>${person.photo ?
                        (person.photo.startsWith('data:') ?
                            `<img src="${person.photo}" class="person-chart-photo" alt="${person.name}">` :
                            `<span class="person-chart-emoji">${person.photo}</span>`) :
                        '👤'
                    } ${person.name} (${personRecords.length} drinks)</h4>
                    <canvas id="person-chart-${person.id}" class="person-chart"></canvas>
                </div>
            `;
        }).join('');
    }

    getDateRange(records) {
        if (records.length === 0) {
            const today = new Date().toISOString().split('T')[0];
            return { start: today, end: today };
        }

        const dates = records.map(r => r.date).sort();
        return {
            start: dates[0],
            end: dates[dates.length - 1]
        };
    }

    calculateDaysSpan(records) {
        if (records.length === 0) return 0;

        const uniqueDates = [...new Set(records.map(r => r.date))];
        return uniqueDates.length;
    }

    setupEventListeners() {
        // Initialize highlights exporter
        if (!this.highlightsExporter && window.CruiseHighlightsExporter) {
            this.highlightsExporter = new CruiseHighlightsExporter(this.storage, window.app?.photoManager);
        }

        // Export highlights button
        const exportBtn = document.getElementById('export-highlights-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportCruiseHighlights());
        }

        // Filter modal controls
        const filterToggleBtn = document.getElementById('filter-toggle-btn');
        const filterModal = document.getElementById('filter-modal');
        const closeFilterModal = document.getElementById('close-filter-modal');
        const clearAllFiltersBtn = document.getElementById('clear-all-filters');

        // Modal open/close
        if (filterToggleBtn) {
            filterToggleBtn.addEventListener('click', () => {
                filterModal.style.display = 'flex';
            });
        }

        if (closeFilterModal) {
            closeFilterModal.addEventListener('click', () => {
                filterModal.style.display = 'none';
            });
        }

        // Close modal when clicking outside
        if (filterModal) {
            filterModal.addEventListener('click', (e) => {
                if (e.target === filterModal) {
                    filterModal.style.display = 'none';
                }
            });
        }

        // Auto-apply filters on change
        const startDateInput = document.getElementById('modal-start-date');
        const endDateInput = document.getElementById('modal-end-date');
        const personFilterSelect = document.getElementById('modal-person-filter');

        if (startDateInput) {
            startDateInput.addEventListener('change', () => this.autoApplyFilters());
        }

        if (endDateInput) {
            endDateInput.addEventListener('change', () => this.autoApplyFilters());
        }

        if (personFilterSelect) {
            personFilterSelect.addEventListener('change', () => this.autoApplyFilters());
        }

        // Clear all filters
        if (clearAllFiltersBtn) {
            clearAllFiltersBtn.addEventListener('click', () => this.clearFilters());
        }

        // Add click handlers for table rows
        document.querySelectorAll('.table-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (!e.target.classList.contains('clickable-photo')) {
                    this.showRecordDetails(row.dataset.recordId);
                }
            });
        });

        // Add click handler for delete button in record details modal
        // This needs to be delegated or attached after the modal is created
        // For now, we'll attach it directly in showRecordDetails
    }

    async autoApplyFilters() {
        const startDate = document.getElementById('modal-start-date')?.value;
        const endDate = document.getElementById('modal-end-date')?.value;
        const personId = document.getElementById('modal-person-filter')?.value;

        this.currentFilters = {
            startDate: startDate || null,
            endDate: endDate || null,
            personId: personId || null
        };

        await this.render();
    }

    async applyFilters() {
        // This method is kept for compatibility but now just calls autoApplyFilters
        await this.autoApplyFilters();
        window.showToast('Filters applied', 'success');
    }

    async clearFilters() {
        this.currentFilters = {
            startDate: null,
            endDate: null,
            personId: null
        };

        await this.render();
        window.showToast('Filters cleared', 'success');
    }

    async showRecordDetails(recordId) {
        try {
            const record = await this.storage.getDrinkRecord(recordId);
            const person = await this.storage.getPerson(record.personId);
            const drink = await this.storage.getDrink(record.drinkId);

            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.innerHTML = `
                <div class="modal-content">
                    <span class="close">&times;</span>
                    <h3>Drink Record Details</h3>
                    <div class="record-details">
                        <div class="detail-item">
                            <strong>Person:</strong> ${person?.name || 'Unknown'}
                            ${person?.photo ?
                                (person.photo.startsWith('data:') ?
                                    `<img src="${person.photo}" class="detail-photo" alt="${person.name}">` :
                                    `<span class="detail-emoji">${person.photo}</span>`) :
                                `<span class="detail-emoji">👤</span>`
                            }
                        </div>
                        <div class="detail-item">
                            <strong>Drink:</strong> ${drink?.name || 'Unknown'}
                            ${drink?.photo ?
                                (drink.photo.startsWith('data:') ?
                                    `<img src="${drink.photo}" class="detail-photo" alt="${drink.name}">` :
                                    `<span class="detail-emoji">${drink.photo}</span>`) :
                                `<span class="detail-emoji">🍹</span>`
                            }
                        </div>
                        <div class="detail-item">
                            <strong>Date:</strong> ${new Date(record.timestamp).toLocaleDateString()}
                        </div>
                        <div class="detail-item">
                            <strong>Time:</strong> ${new Date(record.timestamp).toLocaleTimeString()}
                        </div>
                        ${record.photo ? `
                            <div class="detail-item">
                                <strong>Photo:</strong><br>
                                <img src="${record.photo}" class="detail-large-photo"
                                     onclick="this.closest('.modal').remove(); window.showModal('${record.photoFull || record.photo}', 'Drink Photo');"
                                     alt="Drink photo">
                            </div>
                        ` : ''}
                        <div class="detail-item">
                            <strong>Record Photo:</strong>
                            <div class="photo-actions">
                                ${record.photo ? `
                                    <button class="btn" id="change-record-photo-btn" data-record-id="${record.id}">Change Photo</button>
                                    <button class="btn btn-outline" id="remove-record-photo-btn" data-record-id="${record.id}">Remove Photo</button>
                                ` : `
                                    <button class="btn" id="add-record-photo-btn" data-record-id="${record.id}">Add Photo</button>
                                `}
                                <input type="file" accept="image/*;capture=camera" id="record-photo-input-${record.id}" style="display:none">
                            </div>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-danger" id="delete-record-btn" data-record-id="${record.id}">Delete Record</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Close handlers
            const closeBtn = modal.querySelector('.close');
            closeBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                }
            });

            // Delete button handler
            const deleteBtn = modal.querySelector('#delete-record-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async (e) => {
                    const recordIdToDelete = e.target.dataset.recordId;
                    if (confirm('Are you sure you want to delete this drink record?')) {
                        await this.deleteDrinkRecordAndRefresh(recordIdToDelete);
                        document.body.removeChild(modal); // Close modal after deletion
                    }
                });
            }

            // Photo add/change/remove handlers
            const fileInput = modal.querySelector(`#record-photo-input-${record.id}`);
            const addBtn = modal.querySelector('#add-record-photo-btn');
            const changeBtn = modal.querySelector('#change-record-photo-btn');
            const removeBtn = modal.querySelector('#remove-record-photo-btn');

            const triggerFileSelect = () => fileInput && fileInput.click();

            if (addBtn) addBtn.addEventListener('click', triggerFileSelect);
            if (changeBtn) changeBtn.addEventListener('click', triggerFileSelect);

            if (fileInput) {
                fileInput.addEventListener('change', async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    try {
                        const pm = window.app?.photoManager || new PhotoManager();
                        if (pm.validateImageFile) pm.validateImageFile(file);

                        const full = await pm.processPhoto(file);
                        const thumb = await pm.createThumbnail(full);

                        const updated = { ...record, photo: thumb, photoFull: full };
                        await this.storage.saveDrinkRecord(updated);

                        window.showToast('Photo saved to record', 'success');
                        document.body.removeChild(modal);
                        await this.render();
                    } catch (err) {
                        console.error('Error updating record photo:', err);
                        window.showToast(err?.message || 'Failed to update photo', 'error');
                    } finally {
                        e.target.value = '';
                    }
                });
            }

            if (removeBtn) {
                removeBtn.addEventListener('click', async () => {
                    try {
                        const updated = { ...record, photo: null, photoFull: null };
                        await this.storage.saveDrinkRecord(updated);
                        window.showToast('Photo removed from record', 'success');
                        document.body.removeChild(modal);
                        await this.render();
                    } catch (err) {
                        console.error('Error removing record photo:', err);
                        window.showToast(err?.message || 'Failed to remove photo', 'error');
                    }
                });
            }

        } catch (error) {
            console.error('Error showing record details:', error);
            window.showToast('Error loading record details', 'error');
        }
    }

    async deleteDrinkRecordAndRefresh(recordId) {
        try {
            await this.storage.deleteDrinkRecord(recordId);
            window.showToast('Drink record deleted successfully!', 'success');
            await this.render(); // Re-render analytics to update the table and charts
        } catch (error) {
            console.error('Error deleting drink record:', error);
            window.showToast('Error deleting drink record: ' + error.message, 'error');
        }
    }

    async renderCharts(data) {
        // Clear any existing charts
        this.destroyExistingCharts();

        // Render all charts
        this.renderDrinksByPersonChart(data);
        this.renderDrinksByTypeChart(data);
        this.renderDrinksOverTimeChart(data);
        this.renderPersonDrinkTypeCharts(data);
    }

    destroyExistingCharts() {
        // Store chart instances to properly destroy them
        if (this.chartInstances) {
            Object.values(this.chartInstances).forEach(chart => {
                if (chart && typeof chart.destroy === 'function') {
                    chart.destroy();
                }
            });
        }
        this.chartInstances = {};
    }

    renderDrinksByPersonChart(data) {
        const canvas = document.getElementById('drinks-by-person-chart');
        if (!canvas || !window.Chart) return;

        // Aggregate drinks by person
        const personCounts = {};
        data.records.forEach(record => {
            const person = data.people.find(p => p.id === record.personId);
            const personName = person?.name || 'Unknown';
            personCounts[personName] = (personCounts[personName] || 0) + 1;
        });

        const labels = Object.keys(personCounts);
        const counts = Object.values(personCounts);

        // Generate colors for each person
        const colors = this.generateColors(labels.length);

        this.chartInstances.personChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Number of Drinks',
                    data: counts,
                    backgroundColor: colors.backgrounds,
                    borderColor: colors.borders,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Drinks by Person'
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                layout: {
                    padding: 10
                }
            }
        });
    }

    renderDrinksByTypeChart(data) {
        const canvas = document.getElementById('drinks-by-type-chart');
        if (!canvas || !window.Chart) return;

        // Aggregate drinks by type
        const typeCounts = {};
        data.records.forEach(record => {
            const drink = data.drinks.find(d => d.id === record.drinkId);
            const drinkName = drink?.name || 'Unknown';
            typeCounts[drinkName] = (typeCounts[drinkName] || 0) + 1;
        });

        const labels = Object.keys(typeCounts);
        const counts = Object.values(typeCounts);

        // Generate colors for each drink type
        const colors = this.generateColors(labels.length);

        this.chartInstances.typeChart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Number of Drinks',
                    data: counts,
                    backgroundColor: colors.backgrounds,
                    borderColor: colors.borders,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Drinks by Type'
                    },
                    legend: {
                        position: 'bottom'
                    }
                },
                layout: {
                    padding: 10
                }
            }
        });
    }

    renderDrinksOverTimeChart(data) {
        const canvas = document.getElementById('drinks-over-time-chart');
        if (!canvas || !window.Chart) return;

        // Get all unique dates from records using timestamp converted to local date
        const allDates = [...new Set(data.records.map(record => new Date(record.timestamp).toLocaleDateString()))].sort();

        if (allDates.length === 0) {
            return; // No data to display
        }

        // Only show people who have records in the filtered data
        const peopleWithRecords = data.people.filter(person => {
            const personRecords = data.records.filter(record => record.personId === person.id);
            return personRecords.length > 0;
        });

        // Create datasets for each person with records
        const datasets = [];
        const personColors = this.generateColors(peopleWithRecords.length + 1); // +1 for potential total line

        // Individual person lines (only for people with records)
        peopleWithRecords.forEach((person, index) => {
            const personRecords = data.records.filter(record => record.personId === person.id);
            const personCountsByDate = {};

            // Initialize all dates with 0
            allDates.forEach(date => {
                personCountsByDate[date] = 0;
            });

            // Count drinks by date for this person using timestamp converted to local date
            personRecords.forEach(record => {
                const localDate = new Date(record.timestamp).toLocaleDateString();
                personCountsByDate[localDate] = (personCountsByDate[localDate] || 0) + 1;
            });

            const personData = allDates.map(date => personCountsByDate[date]);

            datasets.push({
                label: person.name,
                data: personData,
                backgroundColor: personColors.backgrounds[index],
                borderColor: personColors.borders[index],
                borderWidth: 2,
                fill: false,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6
            });
        });

        // Only add total line if no person filter is applied (showing multiple people)
        const isPersonFiltered = this.currentFilters.personId !== null;
        if (!isPersonFiltered && peopleWithRecords.length > 1) {
            const totalCountsByDate = {};
            allDates.forEach(date => {
                totalCountsByDate[date] = 0;
            });

            data.records.forEach(record => {
                const localDate = new Date(record.timestamp).toLocaleDateString();
                totalCountsByDate[localDate] = (totalCountsByDate[localDate] || 0) + 1;
            });

            const totalData = allDates.map(date => totalCountsByDate[date]);

            datasets.push({
                label: 'Total (All People)',
                data: totalData,
                backgroundColor: 'rgba(255, 193, 7, 0.1)',
                borderColor: 'rgba(255, 193, 7, 1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointHoverRadius: 7,
                borderDash: [5, 5] // Dashed line to distinguish total
            });
        }

        // Format dates for display
        const labels = allDates.map(date => {
            const d = new Date(date);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });

        this.chartInstances.timeChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Drinks Over Time (By Person + Total)'
                    },
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            font: {
                                size: 11
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                layout: {
                    padding: 10
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                }
            }
        });
    }

    renderPersonDrinkTypeCharts(data) {
        if (!window.Chart) return;

        data.people.forEach(person => {
            const canvas = document.getElementById(`person-chart-${person.id}`);
            if (!canvas) return;

            // Get records for this person
            const personRecords = data.records.filter(record => record.personId === person.id);
            if (personRecords.length === 0) return;

            // Aggregate drinks by type for this person
            const drinkCounts = {};
            personRecords.forEach(record => {
                const drink = data.drinks.find(d => d.id === record.drinkId);
                const drinkName = drink?.name || 'Unknown';
                drinkCounts[drinkName] = (drinkCounts[drinkName] || 0) + 1;
            });

            const labels = Object.keys(drinkCounts);
            const counts = Object.values(drinkCounts);

            // Generate colors for each drink type
            const colors = this.generateColors(labels.length);

            // Store chart instance for proper cleanup
            this.chartInstances[`person-${person.id}`] = new Chart(canvas, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Number of Drinks',
                        data: counts,
                        backgroundColor: colors.backgrounds,
                        borderColor: colors.borders,
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: `${person.name}'s Drink Preferences`
                        },
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 12,
                                font: {
                                    size: 11
                                }
                            }
                        }
                    },
                    layout: {
                        padding: 10
                    }
                }
            });
        });
    }

    applyFiltersToData(data) {
        // Create a copy of the data to avoid mutating the original
        const filteredData = {
            people: [...data.people],
            drinks: [...data.drinks],
            records: [...data.records]
        };

        // Apply person filter
        if (this.currentFilters.personId) {
            filteredData.records = filteredData.records.filter(record =>
                record.personId === this.currentFilters.personId
            );
        }

        // Apply date filters
        if (this.currentFilters.startDate) {
            filteredData.records = filteredData.records.filter(record =>
                record.date >= this.currentFilters.startDate
            );
        }

        if (this.currentFilters.endDate) {
            filteredData.records = filteredData.records.filter(record =>
                record.date <= this.currentFilters.endDate
            );
        }

        return filteredData;
    }

    calculateFilteredPeopleCount(data) {
        if (this.currentFilters.personId) {
            // If filtering by a specific person, always return 1
            return 1;
        }
        // Otherwise, return the number of unique people who have records
        const uniquePeople = [...new Set(data.records.map(record => record.personId))];
        return uniquePeople.length;
    }

    calculateFilteredDrinkTypesCount(data) {
        // Get unique drink types from the filtered records
        const uniqueDrinkIds = [...new Set(data.records.map(record => record.drinkId))];
        return uniqueDrinkIds.length;
    }

    getActiveFilterSummary(data) {
        const filters = [];

        if (this.currentFilters.personId) {
            // Find the person name
            const person = data?.people?.find(p => p.id === this.currentFilters.personId);
            if (person) {
                filters.push(person.name);
            } else {
                filters.push('Person');
            }
        }

        if (this.currentFilters.startDate || this.currentFilters.endDate) {
            const dateStrings = [];
            if (this.currentFilters.startDate) {
                dateStrings.push(new Date(this.currentFilters.startDate).toLocaleDateString());
            }
            if (this.currentFilters.endDate) {
                dateStrings.push(new Date(this.currentFilters.endDate).toLocaleDateString());
            }
            filters.push(dateStrings.join(' - '));
        }

        if (filters.length === 0) {
            return 'Filter';
        }

        return `🔍 ${filters.join(' | ')}`;
    }

    generateColors(count) {
        const hueStep = 360 / count;
        const backgrounds = [];
        const borders = [];

        for (let i = 0; i < count; i++) {
            const hue = i * hueStep;
            backgrounds.push(`hsla(${hue}, 70%, 60%, 0.6)`);
            borders.push(`hsla(${hue}, 70%, 50%, 1)`);
        }

        return { backgrounds, borders };
    }

    async exportCruiseHighlights() {
        const currentCruise = window.app?.getCurrentCruise();
        if (!currentCruise) {
            window.showToast('No cruise selected', 'error');
            return;
        }

        if (!this.highlightsExporter) {
            window.showToast('Export feature not available', 'error');
            return;
        }

        try {
            // Show loading state
            const exportBtn = document.getElementById('export-highlights-btn');
            const originalText = exportBtn.textContent;
            exportBtn.textContent = '⏳ Generating...';
            exportBtn.disabled = true;

            // Generate highlights image
            const imageDataUrl = await this.highlightsExporter.generateHighlightsImage(currentCruise.id);

            // Show preview modal
            this.showHighlightsPreview(imageDataUrl, currentCruise.name);

        } catch (error) {
            console.error('Error exporting cruise highlights:', error);
            window.showToast('Failed to generate highlights: ' + error.message, 'error');
        } finally {
            // Reset button state
            const exportBtn = document.getElementById('export-highlights-btn');
            if (exportBtn) {
                exportBtn.textContent = '🎉 Export Highlights';
                exportBtn.disabled = false;
            }
        }
    }

    showHighlightsPreview(imageDataUrl, cruiseName) {
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal highlights-preview-modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content highlights-modal-content">
                <div class="modal-header">
                    <h3>🎉 ${cruiseName} Highlights</h3>
                    <span class="close" id="close-highlights-modal">&times;</span>
                </div>
                <div class="modal-body highlights-modal-body">
                    <div class="highlights-preview-container">
                        <img src="${imageDataUrl}" alt="Cruise Highlights" class="highlights-preview-image">
                    </div>
                    <div class="highlights-actions">
                        <a href="${imageDataUrl}" download="${cruiseName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_highlights.png" class="btn" id="download-highlights-btn">
                            📥 Download PNG
                        </a>
                        <button class="btn btn-secondary" id="regenerate-highlights-btn">
                            🔄 Regenerate
                        </button>
                        <button class="btn btn-outline" id="close-highlights-btn">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        const closeBtn = modal.querySelector('#close-highlights-modal');
        const closeBtn2 = modal.querySelector('#close-highlights-btn');
        const downloadBtn = modal.querySelector('#download-highlights-btn');
        const regenerateBtn = modal.querySelector('#regenerate-highlights-btn');

        const closeModal = () => {
            document.body.removeChild(modal);
        };

        closeBtn.addEventListener('click', closeModal);
        closeBtn2.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // Download click handler with toast notification
        downloadBtn.addEventListener('click', () => {
            window.showToast('Highlights downloaded successfully!', 'success');
        });

        regenerateBtn.addEventListener('click', async () => {
            try {
                // Update button state
                regenerateBtn.textContent = '⏳ Generating...';
                regenerateBtn.disabled = true;

                // Generate new highlights image
                const currentCruise = window.app?.getCurrentCruise();
                const newImageDataUrl = await this.highlightsExporter.generateHighlightsImage(currentCruise.id);

                // Update the image in the modal
                const previewImage = modal.querySelector('.highlights-preview-image');
                previewImage.src = newImageDataUrl;

                // Update download link to use new image
                const newFilename = `${cruiseName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_highlights.png`;
                downloadBtn.href = newImageDataUrl;
                downloadBtn.download = newFilename;

                window.showToast('New highlights generated!', 'success');

            } catch (error) {
                console.error('Error regenerating highlights:', error);
                window.showToast('Failed to regenerate highlights: ' + error.message, 'error');
            } finally {
                // Reset button state
                regenerateBtn.textContent = '🔄 Regenerate';
                regenerateBtn.disabled = false;
            }
        });
    }

}

window.AnalyticsComponent = AnalyticsComponent;