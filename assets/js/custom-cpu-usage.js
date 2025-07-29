// js/cpu_stats.js

let cpuUsageChart = {}; // Using an object for easier chart management by ID
let usageUpdateInterval;
// New global variable to store all fetched CPU data for the selected date
let allCpuDataForSelectedDate = {}; // Stores data by serverId: [{timestamp, ...}, ...]
const TimePicked = document.getElementById('UsageTimePicker');
let TimeLastPicked;
const TimePickedLabel = document.getElementById('UsageTimeLabel');
let CanUpdate = true;
/**
 * Populates a specific time picker dropdown with timestamps from fetched data.
 * This function is designed to be reusable across different modules (e.g., disk, CPU).
 * @param {string} timePickerId - The HTML ID of the time picker select element.
 * @param {string} timePickerContainerId - The HTML ID of the time picker's container element (to show/hide it).
 * @param {Object} allData - The object containing all data for the day.
 * Expected structures:
 * - For Disk: {serverId: {diskname: [{timestamp, ...}, ...]}}
 * - For CPU/Memory: {serverId: [{timestamp, ...}, ...]}
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
    // This is important for initial load or when date picker changes
    if (selectedTimePoint || sortedTimestamps.length > 0) {
        document.getElementById(timePickerId).dispatchEvent(new Event('change'));
    }
}


/**
 * Fetches detailed information for a specific server from the backend.
 * This includes hostname and IP address.
 * @param {string} serverId - The unique identifier of the server (e.g., 'server-001').
 * @returns {Object|null} A Promise that resolves to the server details object, or null if an error occurs.
 */
async function fetchServerDetails(serverId) {
    try {
        const response = await fetch(`${API_BASE_URL}/server-details/${serverId}`);
        if (!response.ok) {
            throw new Error(`The response from fetchingServerDetails is not ok for server ${serverId}. Status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Fetching server details for ${serverId} failed:`, error);
        return null;
    }
}

/**
 * Fetches CPU usage data for a specific server, optionally filtered by date.
 * @param {string} serverId - The ID of the server.
 * @param {string} [date] - Optional date in YYYY-MM-DD format for filtering historical data.
 * @param {string} [userTimeZone] - Optional user's IANA timezone for date filtering.
 * @returns {Array} A Promise that resolves to an array of CPU usage statistics.
 */
async function fetchCpuUsageData(serverId, date, userTimeZone) {
    try {
        let apiUrl = `${API_BASE_URL}/cpu-usage/by-server/${serverId}`;

        const params = new URLSearchParams();
        if (date) {
            params.append('date', date);
        }
        if (userTimeZone) {
            params.append('user_timezone', userTimeZone);
        }

        if (params.toString()) {
            apiUrl += `?${params.toString()}`;
        }

        const response = await fetch(apiUrl);
        if (!response.ok) {
            const errorDetail = await response.json().catch(() => ({ detail: 'Unknown error' }));
            throw new Error(`The response for fetchCpuUsageData is not ok for server ${serverId}. Status: ${response.status}, Detail: ${errorDetail.detail}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Error at fetchCpuUsageData method for server ${serverId}:`, error);
        return [];
    }
}

/**
 * Renders or updates a CPU usage bar chart using ApexCharts.
 * @param {string} chartId - The HTML ID of the div where the chart will be rendered.
 * @param {number} percentUsed - The current CPU percentage used.
 * @param {number} min_1 - 1-minute load average.
 * @param {number} min_5 - 5-minute load average.
 * @param {number} min_15 - 15-minute load average.
 */
function renderCpuUsageBarChart(chartId, percentUsed, min_1, min_5, min_15) {
    const chartElement = document.getElementById(chartId);
    if (!chartElement) {
        console.error(`Chart element with ID '${chartId}' not found for CPU bar chart.`);
        return;
    }

    const isValidData = percentUsed >= 0 && !isNaN(percentUsed) && !isNaN(min_1) && !isNaN(min_5) && !isNaN(min_15);

    if (!isValidData) {
        console.warn(`Invalid CPU usage data for bar chart ID '${chartId}'. Displaying no data message.`);
        if (cpuUsageChart[chartId]) {
            cpuUsageChart[chartId].destroy();
            delete cpuUsageChart[chartId]; // Remove reference
        }
        // Applying the dark theme alert styling here as well
        chartElement.innerHTML = '<div class="alert alert-info text-center py-1 bg-dark text-info border-info" role="alert">No data available for CPU bar chart on selected date.</div>';
        return;
    }

    const free = 100 - percentUsed;
    const RenderSeries = [{ name: `Used`, data: [percentUsed.toFixed(2)] }, { name: `Free`, data: [free.toFixed(2)] }];
    const RenderCategories = [`%USED`];

    if (cpuUsageChart[chartId]) {
        cpuUsageChart[chartId].updateSeries(RenderSeries); // No need for `true` as second argument here
    } else {
        chartElement.innerHTML = ''; // Clear any fallback messages or previous content
        const options = {
            series: RenderSeries,
            chart: {
                height: 150, // Keep this reasonable for bar chart
                type: 'bar',
                stacked: true,
                toolbar: { show: false },
                animations: {
                    enabled: true,
                    easing: 'easeinout',
                    speed: 800,
                    animateGradually: { enabled: true, delay: 0 },
                    dynamicAnimation: { enabled: true, speed: 350 }
                }
            },
            plotOptions: {
                bar: {
                    horizontal: true,
                    barHeight: '80%',
                    endingShape: 'flat',
                    startingShape: 'flat',
                }
            },
            xaxis: {
                categories: RenderCategories,
                min: 0,
                max: 100,
                labels: {
                    formatter: val => `${parseFloat(val).toFixed(0)}%`, // Ensure parsing float
                    style: { fontSize: '10px', colors: '#FFFFFF' } // White labels for dark background
                },
                title: { text: 'CPU Usage', style: { color: '#CCCCCC' } } // Light grey title
            },
            yaxis: {
                title: { show: false },
                labels: { style: { colors: '#FFFFFF' } } // White labels for dark background
            },
            dataLabels: { enabled: false },
            colors: ['#E74C3C', '#D3D3D3'], // Red for Used, Light Grey for Free
            legend: {
                position: 'bottom',
                labels: { colors: '#FFFFFF' } // White legend text for dark background
            },
            grid: {
                borderColor: '#555555' // Darker grid lines for dark background
            }
        };

        const chart = new ApexCharts(chartElement, options);
        chart.render();
        cpuUsageChart[chartId] = chart;
    }
}

/**
 * Renders or updates CPU load average line charts using ApexCharts.
 * @param {string} serverId - The ID of the server.
 * @param {Array<Object>} load1minData - Array of {value, timestamp} for 1-min load.
 * @param {Array<Object>} load5minData - Array of {value, timestamp} for 5-min load.
 * @param {Array<Object>} load15minData - Array of {value, timestamp} for 15-min load.
 */
function renderLineCharts(serverId, load1minData, load5minData, load15minData) {
    const periods = ["1", "5", "15"];
    const allLoadData = {
        "1": load1minData,
        "5": load5minData,
        "15": load15minData
    };

    for (const num of periods) {
        if (num === "1" || num === "15") {
            continue;
        }
        const mainData = allLoadData[num];
        const chartID = `${num}cpuusageLineChart_${serverId}`;
        const chartElement = document.getElementById(chartID);

        if (!chartElement) {
            console.warn(`Chart element with ID '${chartID}' not found for CPU line chart.`);
            continue;
        }

        if (!mainData || mainData.length === 0) {
            console.log(`No data found for line chart ID: ${chartID}. Displaying 'No data available'.`);
            if (cpuUsageChart[chartID]) {
                cpuUsageChart[chartID].destroy();
                delete cpuUsageChart[chartID]; // Ensure chart instance is removed
            }
            // Styled for dark background
            chartElement.innerHTML = '<div class="alert alert-info text-center py-1 bg-dark text-info border-info" role="alert">No historical data available for this date.</div>';
            continue; // Go to the next period
        }

        mainData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        const RenderCategories = mainData.map(d => {
            const date = new Date(d.timestamp);
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        });

        const DataSeries = mainData.map(d => parseFloat(d.value)); // Ensure value is float

        const RenderSeries = [{ name: `${num} min Load`, data: DataSeries }]; // Changed name for clarity
        console.log(`hahaha`);
        const commonOptions = {
            series: RenderSeries,
            chart: {
                height: 250,
                type: 'line',
                zoom: { enabled: false },
                toolbar: { show: true },
                animations: {
                    enabled: true, easing: 'linear',
                    dynamicAnimation: { speed: 500 }
                },
                // --- NEW: Add dataPointSelection event listener ---
                events: {
                    dataPointSelection: function (event, chartContext, config) {
                        // Check if a valid data point was clicked
                        //console.log(`hahahafaseafasfesfaa`);

                        if (config.dataPointIndex !== undefined && config.dataPointIndex !== -1) {
                            const clickedDataPoint = mainData[config.dataPointIndex];
                            if (clickedDataPoint && clickedDataPoint.timestamp) {
                                if (TimeLastPicked !== clickedDataPoint.timestamp) {
                                    TimeLastPicked = clickedDataPoint.timestamp;
                                    const selectedTime = new Date(clickedDataPoint.timestamp).toLocaleTimeString('en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit',
                                        hour12: false // Use 24-hour format
                                    });
                                    TimePicked.innerHTML = selectedTime;

                                }
                            }
                            else {
                                console.log(`Please pick a new Point`);
                            }
                        }
                    }
                }
                // --- END NEW ---
            },
            markers: {
                size: 0.5
            },
            colors: ['#FF4560'], // A distinct color for the line
            dataLabels: { enabled: false },
            stroke: { curve: 'smooth', width: 1 },
            title: { text: `Load Average (${num} min)`, align: 'left', style: { color: '#CCCCCC' } }, // Light grey title
            grid: {
                row: { colors: ['#444444', 'transparent'], opacity: 0.5 }, // Darker grid rows for dark theme
                borderColor: '#555555' // Darker grid lines for dark background
            },
            xaxis: {
                categories: RenderCategories,
                tickAmount: 'dataAndLabels',
                type: 'category',
                labels: {
                    style: { colors: '#FFFFFF' } // White labels for dark background
                }
            },
            yaxis: {
                title: { text: 'Load Average', style: { color: '#CCCCCC' } }, // Light grey title
                min: 0,
                labels: {
                    formatter: function (val) { return val.toFixed(2); },
                    style: { colors: '#FFFFFF' } // White labels for dark background
                }
            },
            tooltip: {
                intersect: true,
                shared: false,
                enabled: true,
                y: { formatter: function (val) { return val.toFixed(2); } },
                theme: 'dark' // Ensure tooltip is dark theme compatible
            }
        };
        //console.log(`[DEBUG] Options for chart ${chartID} BEFORE render/update:`, JSON.parse(JSON.stringify(commonOptions.chart.events)));
        if (cpuUsageChart[chartID]) {
            cpuUsageChart[chartID].updateOptions(commonOptions);
        } else {
            chartElement.innerHTML = '';
            const chart = new ApexCharts(chartElement, commonOptions);
            chart.render();
            cpuUsageChart[chartID] = chart;
        }
    }
}

/**
 * Renders the CPU bar charts and updates text for the currently selected time point.
 */
function renderCpuChartsForSelectedTime() {
    // Assuming 'UsageTimePicker' is the ID
    const selectedTime = TimeLastPicked ? TimeLastPicked : null;
    if (!selectedTime) {
        // If no time is selected, clear bar charts and text for all servers
        if (typeof SERVER_IDS !== 'undefined') {
            SERVER_IDS.forEach(serverId => {
                const BarChartId = `cpu_usage_barchart_${serverId}`;
                const chartElementBar = document.getElementById(BarChartId);
                if (cpuUsageChart[BarChartId]) {
                    cpuUsageChart[BarChartId].destroy();
                    delete cpuUsageChart[BarChartId];
                }
                // Styled for dark background
                if (chartElementBar) chartElementBar.innerHTML = '<div class="alert alert-info text-center py-1 bg-dark text-info border-info" role="alert">No data for selected time.</div>';

                const CpuNumtext = document.getElementById(`cpunum_${serverId}`);
                const perUsedtext = document.getElementById(`cpuusagetext_${serverId}`);
                const min1loadtext = document.getElementById(`1text_${serverId}`);
                const min5loadtext = document.getElementById(`5text_${serverId}`);
                const min15loadtext = document.getElementById(`15text_${serverId}`);

                if (CpuNumtext) CpuNumtext.textContent = 'N/A';
                if (perUsedtext) perUsedtext.textContent = 'N/A';
                if (min1loadtext) min1loadtext.textContent = 'N/A';
                if (min5loadtext) min5loadtext.textContent = 'N/A';
                if (min15loadtext) min15loadtext.textContent = 'N/A';
            });
        }
        return;
    }
    if (typeof SERVER_IDS !== 'undefined') {
        SERVER_IDS.forEach(serverId => {
            const BarChartId = `cpu_usage_barchart_${serverId}`;
            const serverCpuData = allCpuDataForSelectedDate[serverId] || [];
            let dataPointAtSelectedTime = null;

            if (serverCpuData.length > 0) {
                // Find the exact data point or the closest one before the selected time
                dataPointAtSelectedTime = serverCpuData.find(d => d.timestamp === selectedTime);
                // Fallback: If exact match not found (e.g., due to slight time differences),
                // find the latest point up to or before the selected time.
                // This can happen if the time picker is populated with rounded times or similar.
                if (!dataPointAtSelectedTime) {
                    const selectedDateObj = new Date(selectedTime);
                    const filteredData = serverCpuData.filter(d => new Date(d.timestamp) <= selectedDateObj);
                    if (filteredData.length > 0) {
                        dataPointAtSelectedTime = filteredData[filteredData.length - 1]; // Get the latest of these
                    }
                }
            }

            if (dataPointAtSelectedTime) {
                const latestCpuPercentUsed = parseFloat(dataPointAtSelectedTime.cpu_percent_used);
                const latestCoresNum = dataPointAtSelectedTime.logical_cores;
                const latestLoadArray = dataPointAtSelectedTime.load_average.split(', ').map(parseFloat);
                const latestMin1Val = latestLoadArray[0];
                const latestMin5Val = latestLoadArray[1];
                const latestMin15Val = latestLoadArray[2];

                // Update text elements for selected time
                const CpuNumtext = document.getElementById(`cpunum_${serverId}`);
                const perUsedtext = document.getElementById(`cpuusagetext_${serverId}`);
                const min1loadtext = document.getElementById(`1text_${serverId}`);
                const min5loadtext = document.getElementById(`5text_${serverId}`);
                const min15loadtext = document.getElementById(`15text_${serverId}`);

                if (CpuNumtext) CpuNumtext.textContent = `${latestCoresNum}`;
                if (perUsedtext) perUsedtext.textContent = `${latestCpuPercentUsed.toFixed(2)} %`;
                if (min1loadtext) min1loadtext.textContent = `${latestMin1Val.toFixed(2)}`;
                if (min5loadtext) min5loadtext.textContent = `${latestMin5Val.toFixed(2)}`;
                if (min15loadtext) min15loadtext.textContent = `${latestMin15Val.toFixed(2)}`;

                // Render/update the bar chart for the selected time
                renderCpuUsageBarChart(BarChartId, latestCpuPercentUsed, latestMin1Val, latestMin5Val, latestMin15Val);
            } else {
                // If no data for the specific time, clear chart/text
                const chartElementBar = document.getElementById(BarChartId);
                if (cpuUsageChart[BarChartId]) {
                    cpuUsageChart[BarChartId].destroy();
                    delete cpuUsageChart[BarChartId];
                }
                // Styled for dark background
                if (chartElementBar) chartElementBar.innerHTML = '<div class="alert alert-info text-center py-1 bg-dark text-info border-info" role="alert">No data for selected time.</div>';

                const CpuNumtext = document.getElementById(`cpunum_${serverId}`);
                const perUsedtext = document.getElementById(`cpuusagetext_${serverId}`);
                const min1loadtext = document.getElementById(`1text_${serverId}`);
                const min5loadtext = document.getElementById(`5text_${serverId}`);
                const min15loadtext = document.getElementById(`15text_${serverId}`);

                if (CpuNumtext) CpuNumtext.textContent = 'N/A';
                if (perUsedtext) perUsedtext.textContent = 'N/A';
                if (min1loadtext) min1loadtext.textContent = 'N/A';
                if (min5loadtext) min5loadtext.textContent = 'N/A';
                if (min15loadtext) min15loadtext.textContent = 'N/A';
            }
        });
    }
}


/**
 * Fetches and updates CPU statistics for all configured servers.
 * This function is called both on initial load and by the periodic interval.
 * It now fetches data for a specific date from the GLOBAL date picker.
 */
async function updateUsage() {
    if (TimePicked.classList.contains('d-none') && TimePickedLabel.classList.contains('d-none') && TimePicked.innerHTML !== '') {
        TimePicked.classList.remove('d-none');
        TimePickedLabel.classList.remove('d-none');
    }
    // Get the selected date from the GLOBAL date picker
    const selectedDateInput = document.getElementById('UsageDatePicker'); // Changed from 'globalDatePicker' to 'UsageDatePicker' as per your HTML
    const selectedDate = selectedDateInput ? selectedDateInput.value : '';

    // Get the user's local timezone
    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!selectedDate) {
        console.warn("No date selected from global date picker for CPU stats. Please select a date.");
        // Clear all CPU charts and display a message if no date is selected
        if (typeof SERVER_IDS !== 'undefined') {
            SERVER_IDS.forEach(serverId => {
                const BarChartId = `cpu_usage_barchart_${serverId}`;
                const chartElementBar = document.getElementById(BarChartId);
                if (cpuUsageChart[BarChartId]) {
                    cpuUsageChart[BarChartId].destroy();
                    delete cpuUsageChart[BarChartId];
                }
                if (chartElementBar) chartElementBar.innerHTML = '<div class="alert alert-info text-center py-1 bg-dark text-info border-info" role="alert">Please select a date.</div>';

                const periods = ["1", "5", "15"];
                for (const num of periods) {
                    const lineChartID = `${num}cpuusageLineChart_${serverId}`;
                    const lineChartElement = document.getElementById(lineChartID);
                    if (cpuUsageChart[lineChartID]) {
                        cpuUsageChart[lineChartID].destroy();
                        delete cpuUsageChart[lineChartID];
                    }
                    if (lineChartElement) lineChartElement.innerHTML = '<div class="alert alert-info text-center py-1 bg-dark text-info border-info" role="alert">Please select a date.</div>';
                }

                // Also clear text fields if no data
                const CpuNumtext = document.getElementById(`cpunum_${serverId}`);
                const perUsedtext = document.getElementById(`cpuusagetext_${serverId}`);
                const min1loadtext = document.getElementById(`1text_${serverId}`);
                const min5loadtext = document.getElementById(`5text_${serverId}`);
                const min15loadtext = document.getElementById(`15text_${serverId}`);

                if (CpuNumtext) CpuNumtext.textContent = 'N/A';
                if (perUsedtext) perUsedtext.textContent = 'N/A';
                if (min1loadtext) min1loadtext.textContent = 'N/A';
                if (min5loadtext) min5loadtext.textContent = 'N/A';
                if (min15loadtext) min15loadtext.textContent = 'N/A';
            });
        }
        document.getElementById('UsageTimePickerContainer').style.display = 'none'; // Hide CPU time picker
        allCpuDataForSelectedDate = {}; // Clear stored data
        return; // Stop execution if no date is selected
    }
    let hasAnyCpuData = false;
    allCpuDataForSelectedDate = {}; // Reset for the new fetch

    if (typeof SERVER_IDS !== 'undefined') {
        for (const id of SERVER_IDS) {
            // Fetch CPU usage data for the selected date and timezone
            const allCpuData = await fetchCpuUsageData(id, selectedDate, userTimeZone);
            allCpuDataForSelectedDate[id] = allCpuData; // Store all data for this server

            const load1min = [];
            const load5min = [];
            const load15min = [];
            if (allCpuData && allCpuData.length > 0) {
                hasAnyCpuData = true; // Mark that we have at least some data

                // Sort data to ensure it's in chronological order for line charts
                allCpuData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                // Populate arrays for line charts with all historical data for the day
                for (const dataPoint of allCpuData) {
                    const load_array = dataPoint.load_average.split(', ').map(parseFloat);
                    const time = dataPoint.timestamp;
                    if (time) {
                        load1min.push({ value: load_array[0], timestamp: time });
                        load5min.push({ value: load_array[1], timestamp: time });
                        load15min.push({ value: load_array[2], timestamp: time });
                    }
                }

                // Render/update the line charts with all historical data
                renderLineCharts(id, load1min, load5min, load15min);
            } else {
                console.log(`No CPU data found for server: ${id} for date: ${selectedDate}.`);
                // Clear existing charts and display 'No data' message if no data is found
                const barChartElement = document.getElementById(`cpu_usage_barchart_${id}`);
                if (cpuUsageChart[`cpu_usage_barchart_${id}`]) {
                    cpuUsageChart[`cpu_usage_barchart_${id}`].destroy();
                    delete cpuUsageChart[`cpu_usage_barchart_${id}`];
                }
                // Styled for dark background
                if (barChartElement) barChartElement.innerHTML = '<div class="alert alert-info text-center py-1 bg-dark text-info border-info" role="alert">No CPU data available for this date.</div>';

                const periods = ["1", "5", "15"];
                for (const num of periods) {
                    const lineChartID = `${num}cpuusageLineChart_${id}`;
                    const lineChartElement = document.getElementById(lineChartID);
                    if (cpuUsageChart[lineChartID]) {
                        cpuUsageChart[lineChartID].destroy();
                        delete cpuUsageChart[lineChartID];
                    }
                    // Styled for dark background
                    if (lineChartElement) lineChartElement.innerHTML = '<div class="alert alert-info text-center py-1 bg-dark text-info border-info" role="alert">No historical data available for this date.</div>';
                }

                // Also clear text fields if no data
                const CpuNumtext = document.getElementById(`cpunum_${id}`);
                const perUsedtext = document.getElementById(`cpuusagetext_${id}`);
                const min1loadtext = document.getElementById(`1text_${id}`);
                const min5loadtext = document.getElementById(`5text_${id}`);
                const min15loadtext = document.getElementById(`15text_${id}`);

                if (CpuNumtext) CpuNumtext.textContent = 'N/A';
                if (perUsedtext) perUsedtext.textContent = 'N/A';
                if (min1loadtext) min1loadtext.textContent = 'N/A';
                if (min5loadtext) min5loadtext.textContent = 'N/A';
                if (min15loadtext) min15loadtext.textContent = 'N/A';
            }
            console.log(id);
        }

    }
    console.log(CanUpdate);
    if (CanUpdate) {
        renderCpuChartsForSelectedTime();
    }
    else {
        console.log(`Please select a new Time`);
    }

}

/**
 * Initializes the CPU Monitor charts and text displays.
 * This function is called when the CPU Monitor tab becomes active.
 * It sets up the initial date and fetches data, and starts the refresh interval.
 */
async function intializeCpuUsage() {
    // Clear any existing interval to prevent multiple loops
    if (usageUpdateInterval) {
        clearInterval(usageUpdateInterval);
        usageUpdateInterval = null;
    }

    // Set default date for the GLOBAL date picker on initial load if it's empty
    const usageDatePicker = document.getElementById('UsageDatePicker'); // Corrected ID as per your implied HTML
    if (usageDatePicker && !usageDatePicker.value) { // Only set if no date is already selected
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        usageDatePicker.value = `${year}-${month}-${day}`;
    }
    await updateUsage();

    usageUpdateInterval = setInterval(async () => {
        console.log("Refetching CPU data via interval for selected date (CPU Monitor)...");
        await updateUsage();
    }, 2000); // Refresh every 15 seconds. Adjust as needed.
}

/**
 * Stops the continuous update interval for CPU statistics.
 * This is called when switching away from the CPU Monitor tab.
 */
function stopCpuUsage() {
    if (usageUpdateInterval) {
        clearInterval(usageUpdateInterval);
        usageUpdateInterval = null;
        console.log("Stopped CPU update interval.");
    }
    // Also, clear or destroy existing charts when leaving the tab
    // (This part is already handled by updateUsage if no date is selected, or can be added explicitly here)
}