// js/ram_stats.js

let ramCharts = {}; // Stores ApexCharts instances for all RAM charts (pie and line charts)
let ramUpdateInterval; // Variable to store the interval ID for RAM updates
// New global variable to store all fetched RAM data for the selected date
let allRamDataForSelectedDate = {}; // Stores data by serverId: [{timestamp, ...}, ...]


/**
 * Populates a specific time picker dropdown with timestamps from fetched data.
 * This function is designed to be reusable across different modules (e.g., disk, CPU, RAM).
 * @param {string} timePickerId - The HTML ID of the time picker select element.
 * @param {string} timePickerContainerId - The HTML ID of the time picker's container element (to show/hide it).
 * @param {Object} allData - The object containing all data for the day.
 * Expected structures:
 * - For Disk: {serverId: {diskname: [{timestamp, ...}, ...]}}
 * - For CPU/Memory/RAM: {serverId: [{timestamp, ...}, ...]}
 * @param {string} [selectedTimePoint] - The currently selected time point, if any, to re-select.
 */
function populateSpecificTimePicker(timePickerId, timePickerContainerId, allData, selectedTimePoint = null) {
    const timePicker = document.getElementById(timePickerId);
    const timePickerContainer = document.getElementById(timePickerContainerId);
    if (!timePicker || !timePickerContainer) {
        console.warn(`Time picker or container not found: ${timePickerId}, ${timePickerContainerId}`);
        return;
    }

    const timestamps = new Set();
    // Assuming SERVER_IDS is globally defined
    if (typeof SERVER_IDS !== 'undefined') {
        SERVER_IDS.forEach(serverId => {
            if (allData[serverId]) {
                // Check if it's disk data (object with disk names) or CPU/memory data (array)
                if (typeof allData[serverId] === 'object' && !Array.isArray(allData[serverId])) { // Disk data {diskname: {...}}
                    // Iterate over disk names to get timestamps
                    for (const diskName in allData[serverId]) {
                        if (allData[serverId][diskName] && Array.isArray(allData[serverId][diskName])) {
                            allData[serverId][diskName].forEach(dataPoint => {
                                if (dataPoint.timestamp) timestamps.add(dataPoint.timestamp);
                            });
                        }
                    }
                } else if (Array.isArray(allData[serverId])) { // CPU or Memory data: [{...}, ...]
                    allData[serverId].forEach(dataPoint => {
                        if (dataPoint.timestamp) timestamps.add(dataPoint.timestamp);
                    });
                }
            }
        });
    } else {
        console.warn("SERVER_IDS not defined. Cannot populate time picker without server IDs.");
    }

    const sortedTimestamps = Array.from(timestamps).sort();

    timePicker.innerHTML = ''; // Clear existing options

    if (sortedTimestamps.length === 0) {
        timePickerContainer.style.display = 'none';
        return;
    }

    timePickerContainer.style.display = 'block';

    let defaultSelectedTimestamp = selectedTimePoint;
    if (!defaultSelectedTimestamp && sortedTimestamps.length > 0) {
        defaultSelectedTimestamp = sortedTimestamps[sortedTimestamps.length - 1]; // Default to latest
    }

    sortedTimestamps.forEach(ts => {
        const option = document.createElement('option');
        option.value = ts;
        const date = new Date(ts);
        option.textContent = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        if (ts === defaultSelectedTimestamp) {
            option.selected = true;
        }
        timePicker.appendChild(option);
    });

    // Manually trigger change to update charts if default or existing time is set
    if (selectedTimePoint || sortedTimestamps.length > 0) {
        document.getElementById(timePickerId).dispatchEvent(new Event('change'));
    }
}


async function fetchServerDetails(serverId) {
    try {
        const response = await fetch(`${API_BASE_URL}/server-details/${serverId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Error fetching server details for ${serverId}:`, error);
        return null;
    }
}

/**
 * Fetches RAM usage data for a specific server for a given date.
 * @param {string} serverId - The ID of the server.
 * @param {string} selectedDate - The date for which to fetch data (YYYY-MM-DD format).
 * @param {string} userTimeZone - The user's current timezone string (e.g., 'Asia/Ho_Chi_Minh').
 * @returns {Promise<Array>} A promise that resolves to an array of RAM usage data.
 */
async function fetchRamUsageData(serverId, selectedDate, userTimeZone) {
    try {
        const url = new URL(`${API_BASE_URL}/ram-usage/by-server/${serverId}`);
        if (selectedDate) {
            url.searchParams.append('date', selectedDate);
        }
        if (userTimeZone) {
            url.searchParams.append('user_timezone', userTimeZone);
        }

        const response = await fetch(url.toString());
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Error fetching RAM usage for ${serverId} on ${selectedDate}:`, error);
        return [];
    }
}

/**
 * Converts megabytes (MB) to gigabytes (GB).
 * @param {number} mb - The value in megabytes.
 * @returns {number} The value in gigabytes, rounded to 2 decimal places.
 */
function mbToGb(mb) {
    const numMb = parseFloat(mb);
    if (isNaN(numMb)) {
        console.warn(`Invalid number passed to mbToGb: ${mb}. Returning 0.`);
        return 0;
    }
    return (numMb / 1024).toFixed(2);
}

// Renders a single line chart for either Used or Free RAM for a specific date
function renderRamLineChartForDaily(chartId, ramData, dataType, errorElementId, titleSuffix) {
    const chartElement = document.getElementById(chartId);
    const errorElement = document.getElementById(errorElementId);

    if (!chartElement) {
        console.error(`Chart element with ID '${chartId}' not found.`);
        return;
    }

    errorElement.style.display = 'none';

    if (!ramData || ramData.length === 0) {
        errorElement.textContent = `No historical data available for ${titleSuffix} on the selected date.`;
        errorElement.style.display = 'block';
        if (ramCharts[chartId]) {
            ramCharts[chartId].destroy();
            ramCharts[chartId] = null;
            delete ramCharts[chartId];
        }
        chartElement.innerHTML = '<div class="alert alert-info text-center" role="alert">No historical data available for this RAM line chart on the selected date.</div>';
        return;
    }

    // Sort data by timestamp to ensure chronological order
    ramData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    let seriesData = [];
    let seriesName = '';
    let seriesColor = '';

    if (dataType === 'used') {
        seriesData = ramData.map(d => ({
            x: new Date(d.timestamp).getTime(),
            y: (d.used_ram_mb !== undefined && d.used_ram_mb !== null) ? parseFloat(mbToGb(d.used_ram_mb)) : 0
        }));
        seriesName = 'Used RAM (GB)';
        seriesColor = '#FF4560'; // Red
    } else if (dataType === 'free') {
        seriesData = ramData.map(d => ({
            x: new Date(d.timestamp).getTime(),
            y: (d.free_ram_mb !== undefined && d.free_ram_mb !== null) ? parseFloat(mbToGb(d.free_ram_mb)) : 0
        }));
        seriesName = 'Free RAM (GB)';
        seriesColor = '#00E396'; // Green
    } else {
        console.error("Invalid dataType for renderRamLineChartForDaily. Use 'used' or 'free'.");
        return;
    }

    const newSeries = [{ name: seriesName, data: seriesData }];

    if (ramCharts[chartId]) {
        // Update existing chart
        chartElement.innerHTML = ''; // Clear previous content
        const options = {
            series: newSeries,
            chart: {
                height: 250,
                type: 'line',
                zoom: { enabled: false },
                toolbar: { show: true },
                animations: { enabled: false } // Disable animation for smoother updates/initial render
            },
            colors: [seriesColor],
            dataLabels: { enabled: false },
            stroke: { curve: 'smooth', width: 2 },
            title: {
                text: `${titleSuffix} Over Time`,
                align: 'left'
            },
            grid: { row: { colors: ['#f3f3f3', 'transparent'], opacity: 0.5 } },
            xaxis: {
                type: 'datetime', // Use datetime axis
                title: { text: 'Time' },
                labels: {
                    formatter: function (val, timestamp) {
                        return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                    }
                },
                min: seriesData.length > 0 ? seriesData[0].x : undefined,
                max: seriesData.length > 0 ? seriesData[seriesData.length - 1].x : undefined,
            },
            yaxis: {
                title: { text: 'RAM (GB)' },
                min: 0,
                labels: { formatter: function (val) { return val.toFixed(2) + " GB"; } }
            },
            tooltip: {
                x: { format: 'HH:mm:ss' }, // Tooltip X format
                y: { formatter: function (val) { return val.toFixed(2) + " GB"; } }
            }
        };
        ramCharts[chartId].updateOptions(options);
    } else {
        // Create new chart if it doesn't exist
        chartElement.innerHTML = ''; // Clear previous content like "Loading..."
        const options = {
            series: newSeries,
            chart: {
                height: 250,
                type: 'line',
                zoom: { enabled: false },
                toolbar: { show: true },
                animations: { enabled: false } // Disable animation for smoother updates/initial render
            },
            colors: [seriesColor],
            dataLabels: { enabled: false },
            stroke: { curve: 'smooth', width: 2 },
            title: {
                text: `${titleSuffix} Over Time`,
                align: 'left'
            },
            grid: { row: { colors: ['#f3f3f3', 'transparent'], opacity: 0.5 } },
            xaxis: {
                type: 'datetime', // Use datetime axis
                title: { text: 'Time' },
                labels: {
                    formatter: function (val, timestamp) {
                        return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                    }
                },
                min: seriesData.length > 0 ? seriesData[0].x : undefined,
                max: seriesData.length > 0 ? seriesData[seriesData.length - 1].x : undefined,
            },
            yaxis: {
                title: { text: 'RAM (GB)' },
                min: 0,
                labels: { formatter: function (val) { return val.toFixed(2) + " GB"; } }
            },
            tooltip: {
                x: { format: 'HH:mm:ss' }, // Tooltip X format
                y: { formatter: function (val) { return val.toFixed(2) + " GB"; } }
            }
        };

        const chart = new ApexCharts(chartElement, options);
        chart.render();
        ramCharts[chartId] = chart;
    }
}

function renderRamPieChart(chartId, totalRamMb, usedRamMb, freeRamMb, errorElementId) {
    const chartElement = document.getElementById(chartId);
    const errorElement = document.getElementById(errorElementId);

    if (!chartElement) {
        console.error(`Chart element with ID '${chartId}' not found.`);
        return;
    }

    // Clear any previous error message
    errorElement.style.display = 'none';

    // Convert MB values to GB for display
    const totalRamGb = parseFloat(mbToGb(totalRamMb));
    const usedRamGb = parseFloat(mbToGb(usedRamMb));
    const freeRamGb = parseFloat(mbToGb(freeRamMb));

    if (totalRamGb === 0 || isNaN(totalRamGb) || isNaN(usedRamGb) || isNaN(freeRamGb)) {
        errorElement.textContent = 'No valid RAM data found for pie chart. Total, Used, or Free RAM is invalid.';
        errorElement.style.display = 'block';
        // Destroy existing chart if data becomes invalid
        if (ramCharts[chartId]) {
            ramCharts[chartId].destroy();
            ramCharts[chartId] = null;
        }
        chartElement.innerHTML = '<div class="alert alert-info text-center" role="alert">No data available for RAM pie chart.</div>';
        return;
    }

    const usedPercent = (usedRamGb / totalRamGb) * 100;
    const freePercent = (freeRamGb / totalRamGb) * 100;

    const newSeries = [parseFloat(usedPercent.toFixed(2)), parseFloat(freePercent.toFixed(2))];

    if (ramCharts[chartId]) {
        ramCharts[chartId].updateSeries(newSeries, true);
    } else {
        // Create new chart if it doesn't exist
        chartElement.innerHTML = ''; // Clear previous content like "Loading..."
        const options = {
            series: newSeries,
            chart: {
                height: 200,
                type: 'pie',
                toolbar: { show: true },
                animations: {
                    enabled: true,
                    easing: 'easeinout',
                    speed: 800,
                    animateGradually: { enabled: true, delay: 150 },
                    dynamicAnimation: { enabled: true, speed: 350 }
                }
            },
            labels: ['Used RAM', 'Free RAM'],
            colors: ['#FF4560', '#00E396'], // Red for used, Green for free
            dataLabels: {
                enabled: true,
                formatter: function (val, opts) {
                    const name = opts.w.globals.labels[opts.seriesIndex];
                    const value = opts.w.globals.series[opts.seriesIndex];
                    const actualValueGb = opts.seriesIndex === 0 ? usedRamGb : freeRamGb;
                    return `${name}: ${value.toFixed(1)}% (${actualValueGb.toFixed(2)} GB)`;
                }
            },
            legend: { position: 'bottom' },
            tooltip: {
                y: {
                    formatter: function (value, { seriesIndex, w }) {
                        const actualValueGb = seriesIndex === 0 ? usedRamGb : freeRamGb;
                        return `${value.toFixed(1)}% (${actualValueGb.toFixed(2)} GB)`;
                    }
                }
            },
            responsive: [{ breakpoint: 480, options: { chart: { width: 5000 }, legend: { position: 'bottom' } } }]
        };

        const chart = new ApexCharts(chartElement, options);
        chart.render();
        ramCharts[chartId] = chart;
    }
}

/**
 * Renders the RAM pie charts and updates text for the currently selected time point.
 */
function renderRamChartsForSelectedTime() {
    const timePicker = document.getElementById('RamTimePicker'); // Assuming 'RamTimePicker' is the ID
    const selectedTime = timePicker ? timePicker.value : null;

    if (!selectedTime) {
        // If no time is selected, clear pie charts and text for all servers
        if (typeof SERVER_IDS !== 'undefined') {
            SERVER_IDS.forEach(serverId => {
                const ramPieChartDivId = `ramPieChart_${serverId}`;
                const ramPieErrorId = `ramPieError_${serverId}`;
                const chartElement = document.getElementById(ramPieChartDivId);

                if (ramCharts[ramPieChartDivId]) {
                    ramCharts[ramPieChartDivId].destroy();
                    delete ramCharts[ramPieChartDivId];
                }
                if (chartElement) chartElement.innerHTML = '<div class="no-data-message">No data for selected time.</div>';

                const ramUsedTextElement = document.getElementById(`ramUsedText_${serverId}`);
                const ramFreeTextElement = document.getElementById(`ramFreeText_${serverId}`);
                const ramTotalTextElement = document.getElementById(`ramTotalText_${serverId}`);
                const ramUtilizationTextElement = document.getElementById(`ramUtilizationText_${serverId}`);

                if (ramUsedTextElement) ramUsedTextElement.textContent = 'N/A';
                if (ramFreeTextElement) ramFreeTextElement.textContent = 'N/A';
                if (ramTotalTextElement) ramTotalTextElement.textContent = 'N/A';
                if (ramUtilizationTextElement) ramUtilizationTextElement.textContent = 'N/A';

                const errorP = document.getElementById(ramPieErrorId);
                if (errorP) {
                    errorP.textContent = `No RAM data available for the selected time.`;
                    errorP.style.display = 'block';
                }
            });
        }
        return;
    }

    if (typeof SERVER_IDS !== 'undefined') {
        SERVER_IDS.forEach(serverId => {
            const ramPieChartDivId = `ramPieChart_${serverId}`;
            const ramPieErrorId = `ramPieError_${serverId}`;
            const serverRamData = allRamDataForSelectedDate[serverId] || [];
            let dataPointAtSelectedTime = null;

            if (serverRamData.length > 0) {
                dataPointAtSelectedTime = serverRamData.find(d => d.timestamp === selectedTime);
            }

            if (dataPointAtSelectedTime) {
                const totalRamMb = parseFloat(dataPointAtSelectedTime.total_ram_mb);
                const usedRamMb = parseFloat(dataPointAtSelectedTime.used_ram_mb);
                const freeRamMb = parseFloat(dataPointAtSelectedTime.free_ram_mb);
                const utilization = totalRamMb > 0 ? ((usedRamMb / totalRamMb) * 100).toFixed(2) : 0;

                // Update text elements for selected time
                const ramUsedTextElement = document.getElementById(`ramUsedText_${serverId}`);
                const ramFreeTextElement = document.getElementById(`ramFreeText_${serverId}`);
                const ramTotalTextElement = document.getElementById(`ramTotalText_${serverId}`);
                const ramUtilizationTextElement = document.getElementById(`ramUtilizationText_${serverId}`);

                if (ramUsedTextElement) ramUsedTextElement.textContent = `${mbToGb(usedRamMb)} GB`;
                if (ramFreeTextElement) ramFreeTextElement.textContent = `${mbToGb(freeRamMb)} GB`;
                if (ramTotalTextElement) ramTotalTextElement.textContent = `${mbToGb(totalRamMb)} GB`;
                if (ramUtilizationTextElement) ramUtilizationTextElement.textContent = `${utilization} %`;

                // Render/update the pie chart for the selected time
                renderRamPieChart(ramPieChartDivId, totalRamMb, usedRamMb, freeRamMb, ramPieErrorId);
            } else {
                // If no data for the specific time, clear chart/text
                const chartElement = document.getElementById(ramPieChartDivId);
                if (ramCharts[ramPieChartDivId]) {
                    ramCharts[ramPieChartDivId].destroy();
                    delete ramCharts[ramPieChartDivId];
                }
                if (chartElement) chartElement.innerHTML = '<div class="no-data-message">No data for selected time.</div>';

                const ramUsedTextElement = document.getElementById(`ramUsedText_${serverId}`);
                const ramFreeTextElement = document.getElementById(`ramFreeText_${serverId}`);
                const ramTotalTextElement = document.getElementById(`ramTotalText_${serverId}`);
                const ramUtilizationTextElement = document.getElementById(`ramUtilizationText_${serverId}`);

                if (ramUsedTextElement) ramUsedTextElement.textContent = 'N/A';
                if (ramFreeTextElement) ramFreeTextElement.textContent = 'N/A';
                if (ramTotalTextElement) ramTotalTextElement.textContent = 'N/A';
                if (ramUtilizationTextElement) ramUtilizationTextElement.textContent = 'N/A';

                const errorP = document.getElementById(ramPieErrorId);
                if (errorP) {
                    errorP.textContent = `No RAM data available for the selected time.`;
                    errorP.style.display = 'block';
                }
            }
        });
    }
}


/**
 * Fetches and updates RAM statistics for all configured servers for a given date.
 * This function handles both the real-time/latest data (for pie chart if 'today' is selected)
 * and the historical line charts (data for selectedDate).
 * @param {string} selectedDate - The date selected from the global date picker (YYYY-MM-DD format).
 */
async function updateRamStatsDisplay(selectedDate) {
    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (!selectedDate) {
        console.warn("No date provided to updateRamStatsDisplay. Please ensure a date is selected from the global date picker.");
        // Clear all charts and hide time picker if no date is selected
        for (const chartId in ramCharts) {
            if (ramCharts[chartId]) {
                ramCharts[chartId].destroy();
                delete ramCharts[chartId];
                const element = document.getElementById(chartId);
                if (element) element.innerHTML = '<div class="no-data-message">Please select a date from the global date picker.</div>';
            }
        }
        document.getElementById('RamTimePickerContainer').style.display = 'none';
        allRamDataForSelectedDate = {}; // Clear stored data
        return;
    }

    let hasAnyRamData = false;
    allRamDataForSelectedDate = {}; // Reset for the new fetch

    if (typeof SERVER_IDS !== 'undefined') {
        for (const serverId of SERVER_IDS) {
            const ramDataForDisplay = await fetchRamUsageData(serverId, selectedDate, userTimeZone);
            allRamDataForSelectedDate[serverId] = ramDataForDisplay; // Store all data for this server

            const hostnameElement = document.getElementById(`ramHostname_${serverId}`);
            const ipElement = document.getElementById(`ramIp_${serverId}`);

            const serverDetails = await fetchServerDetails(serverId);
            if (serverDetails) {
                if (hostnameElement) hostnameElement.textContent = serverDetails.hostname;
                if (ipElement) ipElement.textContent = serverDetails.ip_address;
            } else {
                if (hostnameElement) hostnameElement.textContent = 'N/A';
                if (ipElement) ipElement.textContent = 'N/A';
            }

            // --- Handle Historical Data for Line Charts ---
            const ramChartsContainer = document.getElementById(`ramChartsContainer_${serverId}`);
            if (ramChartsContainer && ramChartsContainer.childElementCount === 0) {
                const lineChartsRow = document.createElement('div');
                lineChartsRow.className = 'row mt-4'; // Add some top margin
                lineChartsRow.innerHTML = `
                    <div class="col-lg-6 col-md-12 mb-4">
                        <div class="card">
                            <div class="card-header">
                                <h6 class="card-title mb-0">Used RAM Historical Data</h6>
                            </div>
                            <div class="card-body">
                                <div id="ramUsedLineChart_${serverId}" style="height: 250px;"></div>
                                <p id="ramUsedLineError_${serverId}" class="text-danger text-center" style="display: none;"></p>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-6 col-md-12 mb-4">
                        <div class="card">
                            <div class="card-header">
                                <h6 class="card-title mb-0">Free RAM Historical Data</h6>
                            </div>
                            <div class="card-body">
                                <div id="ramFreeLineChart_${serverId}" style="height: 250px;"></div>
                                <p id="ramFreeLineError_${serverId}" class="text-danger text-center" style="display: none;"></p>
                            </div>
                        </div>
                    </div>
                `;
                ramChartsContainer.appendChild(lineChartsRow);
            }

            if (ramDataForDisplay && ramDataForDisplay.length > 0) {
                hasAnyRamData = true;

                const ramUsedLineChartDivId = `ramUsedLineChart_${serverId}`;
                const ramUsedLineErrorId = `ramUsedLineError_${serverId}`;
                renderRamLineChartForDaily(ramUsedLineChartDivId, ramDataForDisplay, 'used', ramUsedLineErrorId, 'Used RAM');

                const ramFreeLineChartDivId = `ramFreeLineChart_${serverId}`;
                const ramFreeLineErrorId = `ramFreeLineError_${serverId}`;
                renderRamLineChartForDaily(ramFreeLineChartDivId, ramDataForDisplay, 'free', ramFreeLineErrorId, 'Free RAM');
            } else {
                console.log(`No RAM data found for server: ${serverId} for date: ${selectedDate}.`);
                // Clear existing line charts and display 'No data' message if no data is found
                const ramUsedLineChartDivId = `ramUsedLineChart_${serverId}`;
                const ramFreeLineChartDivId = `ramFreeLineChart_${serverId}`;

                if (ramCharts[ramUsedLineChartDivId]) {
                    ramCharts[ramUsedLineChartDivId].destroy();
                    delete ramCharts[ramUsedLineChartDivId];
                }
                const usedChartElement = document.getElementById(ramUsedLineChartDivId);
                if (usedChartElement) usedChartElement.innerHTML = '<div class="no-data-message">No historical data available for this RAM line chart on the selected date.</div>';

                if (ramCharts[ramFreeLineChartDivId]) {
                    ramCharts[ramFreeLineChartDivId].destroy();
                    delete ramCharts[ramFreeLineChartDivId];
                }
                const freeChartElement = document.getElementById(ramFreeLineChartDivId);
                if (freeChartElement) freeChartElement.innerHTML = '<div class="no-data-message">No historical data available for this RAM line chart on the selected date.</div>';
            }
        }
    }

    // After fetching all data, populate the time picker for RAM
    const currentTimeSelected = document.getElementById('RamTimePicker')?.value;
    populateSpecificTimePicker('RamTimePicker', 'RamTimePickerContainer', allRamDataForSelectedDate, currentTimeSelected);

    // If there's no data at all for the selected date, ensure all pie charts/text are cleared.
    if (!hasAnyRamData) {
        if (typeof SERVER_IDS !== 'undefined') {
            SERVER_IDS.forEach(serverId => {
                const ramPieChartDivId = `ramPieChart_${serverId}`;
                const ramPieErrorId = `ramPieError_${serverId}`;
                const chartElement = document.getElementById(ramPieChartDivId);

                if (ramCharts[ramPieChartDivId]) {
                    ramCharts[ramPieChartDivId].destroy();
                    delete ramCharts[ramPieChartDivId];
                }
                if (chartElement) chartElement.innerHTML = '<div class="no-data-message">No data available for RAM pie chart.</div>';

                const ramUsedTextElement = document.getElementById(`ramUsedText_${serverId}`);
                const ramFreeTextElement = document.getElementById(`ramFreeText_${serverId}`);
                const ramTotalTextElement = document.getElementById(`ramTotalText_${serverId}`);
                const ramUtilizationTextElement = document.getElementById(`ramUtilizationText_${serverId}`);

                if (ramUsedTextElement) ramUsedTextElement.textContent = 'N/A';
                if (ramFreeTextElement) ramFreeTextElement.textContent = 'N/A';
                if (ramTotalTextElement) ramTotalTextElement.textContent = 'N/A';
                if (ramUtilizationTextElement) ramUtilizationTextElement.textContent = 'N/A';

                const errorP = document.getElementById(ramPieErrorId);
                if (errorP) {
                    errorP.textContent = `No RAM data available for the selected date.`;
                    errorP.style.display = 'block';
                }
            });
        }
        document.getElementById('RamTimePickerContainer').style.display = 'none';
    }

    const mountPathDisplay = document.getElementById('mountPathDisplay');
    if (mountPathDisplay) {
        mountPathDisplay.value = 'N/A (RAM is not mounted)';
    }
}

/**
 * Initializes the RAM Monitor charts and text displays for a given date.
 * This will also set up an interval for continuous updates of the real-time pie chart.
 * @param {string} selectedDate - The date selected from the global date picker (YYYY-MM-DD format).
 */
async function initializeRamStats() {
    if (ramUpdateInterval) {
        clearInterval(ramUpdateInterval);
        ramUpdateInterval = null;
    }

    // Set default date for the GLOBAL date picker on initial load if it's empty
    const globalDatePicker = document.getElementById('RamDatePicker');
    if (globalDatePicker && !globalDatePicker.value) { // Only set if no date is already selected
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        globalDatePicker.value = `${year}-${month}-${day}`;
    }

    // Add event listener for global date picker change
    if (globalDatePicker && !globalDatePicker.dataset.listenerAddedRam) {
        globalDatePicker.addEventListener('change', async () => {
            console.log("Global date picker changed for RAM Stats.");
            await updateRamStatsDisplay(globalDatePicker.value);
            // If you have a global refresh function that also updates other tabs, call it here:
            // if (typeof updateDiskStatsDisplay === 'function') updateDiskStatsDisplay();
            // if (typeof updateUsage === 'function') updateUsage(); // For CPU
        });
        globalDatePicker.dataset.listenerAddedRam = 'true';
    }

    const ramTimePicker = document.getElementById('RamTimePicker');
    // Add event listener for RAM time picker change
    if (ramTimePicker && !ramTimePicker.dataset.listenerAddedRam) {
        ramTimePicker.addEventListener('change', () => {
            console.log("RAM time picker changed for RAM Stats.");
            renderRamChartsForSelectedTime(); // Re-render pie chart (snapshot)
        });
        ramTimePicker.dataset.listenerAddedRam = 'true';
    }

    const manualRefreshBtn = document.getElementById('manualRefreshBtn');
    if (manualRefreshBtn && !manualRefreshBtn.dataset.listenerAddedRam) {
        manualRefreshBtn.addEventListener('click', async () => {
            console.log("Manual refresh button clicked (RAM Stats).");
            await updateRamStatsDisplay(globalDatePicker.value); // Refresh RAM data and re-populate time picker
        });
        manualRefreshBtn.dataset.listenerAddedRam = 'true';
    }

    // Perform an immediate initial update using the date from the global picker
    await updateRamStatsDisplay(globalDatePicker.value);

    // Set up continuous updates. This interval will now primarily ensure
    // that `updateRamStatsDisplay` is called to refetch the latest data for the
    // currently selected date, which in turn will update the time picker and pie chart.
    ramUpdateInterval = setInterval(async () => {
        console.log("Refetching RAM data via interval for selected date (RAM Monitor)...");
        await updateRamStatsDisplay(globalDatePicker.value);
    }, 15000); // Recommended: 15-30 seconds for historical data refresh.
}


/**
 * Stops the continuous update interval for RAM statistics.
 * This is called when switching away from the RAM Monitor tab.
 */
function stopRamUpdates() {
    if (ramUpdateInterval) {
        clearInterval(ramUpdateInterval);
        ramUpdateInterval = null;
        console.log("Stopped RAM update interval.");
    }
    // Destroy all charts when navigating away from the tab to free up memory
    for (const chartId in ramCharts) {
        if (ramCharts[chartId]) {
            ramCharts[chartId].destroy();
            ramCharts[chartId] = null;
        }
        const chartElement = document.getElementById(chartId);
        if (chartElement) {
            chartElement.innerHTML = '';
        }
    }
    ramCharts = {}; // Reset to an empty object
    // Hide and clear the specific time picker for RAM
    document.getElementById('RamTimePickerContainer').style.display = 'none';
    document.getElementById('RamTimePicker').innerHTML = '';
    allRamDataForSelectedDate = {}; // Clear stored data
}
