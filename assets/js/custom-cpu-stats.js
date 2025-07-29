// js/custom-cpu-stats.js

// --- Global Variables ---
var cpuCharts = {}; // Stores ApexCharts instances for CPU temperature
var cpuUpdateInterval; // Holds the interval ID for continuous updates

// Assumed global from config.js: API_BASE_URL, SERVER_IDS
const CPU_ADAPTERS = ['coretemp-isa-0000', 'coretemp-isa-0001'];
const CPU_CORES = ['0', '1', '9', '10']; // Cores are strings based on the MongoDB format

console.log("custom-cpu-stats.js loaded.");

// --- API Fetching Functions ---
async function fetchServerDetails(serverId) {
    try {
        const response = await fetch(`${API_BASE_URL}/server-details/${serverId}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching server details for ${serverId}:`, error);
        return null;
    }
}

/**
 * Fetches CPU temperature data for a specific server, adapter, and core for a given date.
 * @param {string} serverId - The ID of the server.
 * @param {string} adapterName - The name of the CPU adapter (e.g., 'coretemp-isa-0000').
 * @param {string} coreNumber - The core number (e.g., '0', '1').
 * @param {string} selectedDate - The date for which to fetch data (YYYY-MM-DD format).
 * @param {string} userTimeZone - The user's current timezone string (e.g., 'Asia/Ho_Chi_Minh').
 * @returns {Promise<Array>} A promise that resolves to an array of temperature data.
 */
async function fetchCpuTemperatureData(serverId, adapterName, coreNumber, selectedDate, userTimeZone) {
    try {
        // Construct the URL with date and user_timezone query parameters
        const url = new URL(`${API_BASE_URL}/cpu-temperature/by-server/${serverId}`);
        url.searchParams.append('adapter', adapterName);
        url.searchParams.append('core', coreNumber);
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
        return await response.json();
    } catch (error) {
        console.error(`Error fetching CPU temperature data for ${serverId}, Adapter ${adapterName}, Core ${coreNumber} on ${selectedDate}:`, error);
        return [];
    }
}

// --- Chart Rendering Function ---
/**
 * Renders or updates an ApexCharts line chart for CPU temperature.
 * Uses 'datetime' x-axis for robust time series handling.
 * @param {string} chartId - The ID of the HTML element where the chart will be rendered.
 * @param {Array<Object>} temperatureData - An array of temperature data objects.
 * @param {string} errorElementId - The ID of the HTML element to display error messages.
 * @param {string} titleSuffix - Suffix for the chart title (e.g., 'Core X Temperature').
 */
function renderCpuLineChart(chartId, temperatureData, errorElementId, titleSuffix) {
    const chartElement = document.getElementById(chartId);
    const errorElement = document.getElementById(errorElementId);

    if (!chartElement) {
        console.error(`renderCpuLineChart: Chart element with ID '${chartId}' not found. Cannot render.`);
        return;
    }

    // Always hide previous error messages
    errorElement.style.display = 'none';

    if (!temperatureData || temperatureData.length === 0) {
        // If no data, display message and destroy any existing chart
        errorElement.textContent = `No historical data available for ${titleSuffix} on the selected date.`;
        errorElement.style.display = 'block';

        if (cpuCharts[chartId]) {
            console.log(`renderCpuLineChart: Destroying existing chart ${chartId} due to no data.`); // THIS LOG IS INTENTIONAL HERE
            cpuCharts[chartId].destroy();
            cpuCharts[chartId] = null;
            delete cpuCharts[chartId]; // Also remove from the object
        } else {
            // Ensure the chart container is empty if there was no chart instance
            chartElement.innerHTML = '';
        }
        return; // Stop here if no data
    }

    // Sort data by timestamp for correct chart rendering
    temperatureData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // IMPORTANT: For 'datetime' x-axis, the 'x' value in seriesData should be a Unix timestamp (milliseconds)
    const seriesData = temperatureData.map(d => ({
        x: new Date(d.timestamp).getTime(), // Convert to Unix timestamp in milliseconds
        y: parseFloat(d.temperature_celsius)
    }));

    const newSeries = [{ name: 'CPU Temperature', data: seriesData }];

    if (cpuCharts[chartId]) {
        // If a chart instance already exists, attempt to update its series
        console.log(`renderCpuLineChart: Chart ${chartId} exists. Attempting to update series.`);
        try {
            cpuCharts[chartId].updateSeries(newSeries, false); // `false` prevents animation for the series update
            // Also update the x-axis range in case the date has changed significantly
            // This is crucial for past dates vs. current date if min/max needs adjustment.
            cpuCharts[chartId].updateOptions({
                xaxis: {
                    min: seriesData.length > 0 ? seriesData[0].x : undefined,
                    max: seriesData.length > 0 ? seriesData[seriesData.length - 1].x : undefined,
                }
            }, false, false); // No redraw, no animation for options update
            console.log(`renderCpuLineChart: Successfully updated chart ${chartId}.`);
            return; // Exit as chart was updated
        } catch (err) {
            // If update fails, destroy the old chart and proceed to create a new one
            console.warn(`renderCpuLineChart: Chart update failed for ${chartId}. Recreating chart. Error:`, err); // THIS LOG IS INTENTIONAL HERE
            cpuCharts[chartId].destroy();
            cpuCharts[chartId] = null;
            delete cpuCharts[chartId]; // Also remove from the object
            // IMPORTANT: Clear the chart element's content to ensure a clean slate for the new chart
            chartElement.innerHTML = '';
        }
    }

    // If chart doesn't exist or update failed (and was destroyed), create a new one
    console.log(`renderCpuLineChart: Creating new chart ${chartId}.`); // THIS LOG IS INTENTIONAL HERE

    const options = {
        series: newSeries,
        chart: {
            height: 200,
            type: 'line',
            animations: { enabled: false }, // Keep animations disabled for potentially smoother updates
            toolbar: { show: true },
            zoom: { enabled: false }
        },
        colors: ['#3498DB'],
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 2 },
        title: {
            text: `${titleSuffix} Over Time`,
            align: 'left',
            style: { fontSize: '14px', fontWeight: 'bold', color: '#333' }
        },
        grid: { row: { colors: ['#f3f3f3', 'transparent'], opacity: 0.5 } },
        xaxis: {
            type: 'datetime', // IMPORTANT CHANGE: Set x-axis type to 'datetime'
            title: { text: 'Time' },
            labels: {
                formatter: function (val, timestamp) {
                    // Formatter to display timestamps as HH:mm:ss
                    return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                }
            },
            // Set min/max to cover the entire data range for the selected date
            min: seriesData.length > 0 ? seriesData[0].x : undefined,
            max: seriesData.length > 0 ? seriesData[seriesData.length - 1].x : undefined,
        },
        yaxis: {
            title: { text: 'Temperature (°C)' },
            labels: { formatter: val => `${val.toFixed(1)} °C` },
            min: 0
        },
        tooltip: {
            x: {
                format: 'HH:mm:ss' // Format for tooltip's X-axis value
            },
            y: { formatter: val => `${val.toFixed(1)} °C` }
        },
        responsive: [{ breakpoint: 480, options: { chart: { width: 200 }, legend: { position: 'bottom' } } }]
    };

    const chart = new ApexCharts(chartElement, options);
    chart.render();
    cpuCharts[chartId] = chart; // Store the new chart instance
    console.log(`renderCpuLineChart: New chart ${chartId} rendered and stored.`);
}

// --- Initialization Function ---
/**
 * Initializes the CPU Monitor charts and text displays for a given date.
 * @param {string} selectedDate - The date selected from the global date picker (YYYY-MM-DD format).
 */
async function initializeCpuStats(selectedDate) {
    if (cpuUpdateInterval) {
        clearInterval(cpuUpdateInterval);
        cpuUpdateInterval = null;
    }
    // Pass the selectedDate to the display update function
    await updateCpuStatsDisplay(selectedDate);
    // Continue periodic updates with the selected date
    cpuUpdateInterval = setInterval(() => updateCpuStatsDisplay(selectedDate), 5000);
}

/**
 * Fetches and updates CPU statistics for all configured servers for a given date.
 * This function is optimized to only create HTML elements once.
 * Subsequent calls will trigger updates within existing chart instances.
 * @param {string} selectedDate - The date selected from the global date picker (YYYY-MM-DD format).
 */
async function updateCpuStatsDisplay(selectedDate) {
    // Get the user's local timezone
    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (!selectedDate) {
        console.warn("No date provided to updateCpuStatsDisplay. Please ensure a date is selected from the global date picker.");
        for (const serverId of SERVER_IDS) {
            const adaptersContainer = document.getElementById(`cpuAdaptersContainer_${serverId}`);
            if (adaptersContainer) {
                // This clears the container and destroys charts ONLY if no date is selected.
                // This is an intentional reset for an "empty state".
                console.log(`Clearing (No Date): Clearing adaptersContainer for server ${serverId}.`); // THIS LOG IS INTENTIONAL HERE
                adaptersContainer.innerHTML = `<div class="col-12"><div class="alert alert-warning" role="alert">Please select a date from the global date picker to view CPU temperature data.</div></div>`;
            }
            // Destroy all charts associated with this server when no date is selected
            for (const chartId in cpuCharts) {
                if (chartId.startsWith(`cpuChart_${serverId}_`)) {
                    if (cpuCharts[chartId]) {
                        console.log(`Clearing (No Date): Destroying chart ${chartId} due to no selected date.`); // THIS LOG IS INTENTIONAL HERE
                        cpuCharts[chartId].destroy();
                        cpuCharts[chartId] = null;
                        delete cpuCharts[chartId];
                    }
                }
            }
        }
        return;
    }


    for (const serverId of SERVER_IDS) {
        const hostnameElement = document.getElementById(`cpuHostname_${serverId}`);
        const ipElement = document.getElementById(`cpuIp_${serverId}`);
        const adaptersContainer = document.getElementById(`cpuAdaptersContainer_${serverId}`);

        const serverDetails = await fetchServerDetails(serverId);
        if (serverDetails) {
            if (hostnameElement) hostnameElement.textContent = serverDetails.hostname || 'N/A';
            if (ipElement) ipElement.textContent = serverDetails.ip_address;

            // THIS IS THE CRUCIAL BLOCK: It ensures the HTML structure is created ONLY ONCE.
            // This prevents the "reloading" effect you observed.
            if (adaptersContainer && adaptersContainer.childElementCount === 0) {
                console.log(`Creating initial HTML structure for server ${serverId}.`); // THIS LOG SHOULD ONLY APPEAR ONCE ON INITIAL LOAD
                for (const adapterName of CPU_ADAPTERS) {
                    const adapterCardId = `cpuAdapterCard_${serverId}_${adapterName.replace(/[^a-zA-Z0-9]/g, '-')}`;
                    const adapterCard = document.createElement('div');
                    adapterCard.className = 'col-lg-6 col-md-12 mb-4';
                    adapterCard.id = adapterCardId;
                    adapterCard.innerHTML = `
                        <div class="card">
                            <div class="card-header">
                                <h6 class="card-title mb-0">CPU Adapter: ${adapterName}</h6>
                            </div>
                            <div class="card-body" id="cpuCoresContainer_${adapterCardId}"></div>
                        </div>`;
                    adaptersContainer.appendChild(adapterCard);

                    // Now create chart divs inside the newly created adapter card's body
                    const coresContainer = document.getElementById(`cpuCoresContainer_${adapterCardId}`);
                    if (coresContainer) {
                        for (const coreNumber of CPU_CORES) {
                            const chartDivId = `cpuChart_${serverId}_${adapterName.replace(/[^a-zA-Z0-9]/g, '-')}_core${coreNumber}`;
                            const errorDivId = `cpuError_${serverId}_${adapterName.replace(/[^a-zA-Z0-9]/g, '-')}_core${coreNumber}`;
                            const wrapper = document.createElement('div');
                            wrapper.innerHTML = `
                                <h6 class="text-muted mt-4">Core ${coreNumber} Temperature</h6>
                                <div id="${chartDivId}" style="height: 200px;"></div>
                                <p id="${errorDivId}" class="text-danger text-center" style="display: none;"></p>`;
                            coresContainer.appendChild(wrapper);
                        }
                    }
                }
            }

            // After ensuring HTML structure exists, fetch and render/update data for all charts.
            // renderCpuLineChart will now attempt to update existing charts or create new ones if they don't exist.
            for (const adapterName of CPU_ADAPTERS) {
                for (const coreNumber of CPU_CORES) {
                    const chartDivId = `cpuChart_${serverId}_${adapterName.replace(/[^a-zA-Z0-9]/g, '-')}_core${coreNumber}`;
                    const errorDivId = `cpuError_${serverId}_${adapterName.replace(/[^a-zA-Z0-9]/g, '-')}_core${coreNumber}`;

                    fetchCpuTemperatureData(serverId, adapterName, coreNumber, selectedDate, userTimeZone)
                        .then(data => renderCpuLineChart(chartDivId, data, errorDivId, `Core ${coreNumber} Temperature`));
                }
            }
        } else {
            // Handle case where server details are not available
            if (hostnameElement) hostnameElement.textContent = 'N/A';
            if (ipElement) ipElement.textContent = 'N/A';
            if (adaptersContainer) {
                // This clears the container and destroys charts ONLY if server details are unavailable.
                console.log(`Clearing (Server Details Unavailable): Clearing adaptersContainer for server ${serverId}.`); // THIS LOG IS INTENTIONAL HERE
                adaptersContainer.innerHTML = `<div class="col-12"><div class="alert alert-warning" role="alert">Server details not available for ${serverId}. Cannot fetch CPU data.</div></div>`;
            }
            // Clear any charts related to this server if details are missing, for good measure
            for (const chartId in cpuCharts) {
                if (chartId.startsWith(`cpuChart_${serverId}_`)) {
                    if (cpuCharts[chartId]) {
                        console.log(`Clearing (Server Details Unavailable): Destroying chart ${chartId} due to missing server details.`); // THIS LOG IS INTENTIONAL HERE
                        cpuCharts[chartId].destroy();
                        cpuCharts[chartId] = null;
                        delete cpuCharts[chartId];
                    }
                }
            }
        }
    }
}

function stopCpuUpdates() {
    if (cpuUpdateInterval) {
        clearInterval(cpuUpdateInterval);
        cpuUpdateInterval = null;
    }
    // Destroy all charts when navigating away from the tab to free up memory
    for (const chartId in cpuCharts) {
        if (cpuCharts[chartId]) {
            cpuCharts[chartId].destroy();
            cpuCharts[chartId] = null;
            delete cpuCharts[chartId];
        }
    }
}