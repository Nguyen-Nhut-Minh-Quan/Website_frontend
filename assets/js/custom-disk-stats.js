// js/custom-disk-stats.js

// --- Global Variables ---
// `diskCharts` stores ApexCharts instances. This allows us to update existing charts
// without re-creating them, which is crucial for smooth, dynamic updates.
let diskCharts = [];
// `diskUpdateInterval` will hold the ID returned by `setInterval`. This allows us
// to clear the interval later (e.g., when switching tabs) to stop continuous sets).
let diskUpdateInterval;
// `diskLastKnownData` stores the last successfully updated numerical data for each disk.
// This is used to maintain chart state and prevent flickering if a data point is temporarily missing.
const diskList = ["local", "local-lvm"];
const MIN_VISIBLE_USED_PERCENT = 1.0;
/**
 * Fetches detailed information for a specific server from the backend.
 * This includes hostname, IP address, and a map of its disks.
 * @param {string} serverId - The unique identifier of the server (e.g., 'server-001').
 * @returns {Object|null} A Promise that resolves to the server details object, or null if an error occurs.
 */
async function fetchServerDetails(serverId) {
    try {
        // Construct the API endpoint URL for server details.
        const response = await fetch(`${API_BASE_URL}/server-details/${serverId}`);
        // Check if the HTTP response was successful (status code 200-299).
        if (!response.ok) {
            // If not successful, throw an error with the HTTP status.
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        // Parse the JSON response body.
        const data = await response.json();
        return data; // Return the server details object.
    } catch (error) {
        // Log any errors that occur during the fetch operation.
        console.error(`Error fetching server details for ${serverId}:`, error);
        return null; // Return null to indicate failure.
    }
}

async function fetchDiskStatDetails(serverId, diskname) {
    try {
        const response = await fetch(`${API_BASE_URL}/disk-stats/by-server-and-disk/${serverId}/${diskname}`)
        if (!response.ok) {
            throw new Error(`HTTP error at fetchingDiskStatDetails ! status :${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.log(`error at fetchingDiskStatDetails for server ${serverId}, error is :`, error);
        return [];
    }
}
// --- Utility Functions ---
/**
 * Converts a byte value (as a number/float) into a human-readable format (MB, GB, or TB).
 * It automatically chooses the most appropriate unit.
 * @param {number} bytesVal - The byte value as a number/float.
 * @returns {string} Formatted size (e.g., "100.5 GB", "1.2 TB", "500.00 MB"). Returns "N/A" for invalid input.
 */
function bytesToAppropriateUnit(bytesVal) {
    // bytesVal is expected to be raw bytes (a float or integer) here.
    const bytes = bytesVal;
    // Check if the conversion resulted in a valid number.
    if (isNaN(bytes)) {
        return "N/A";
    }
    // Handle explicit zero bytes
    if (bytes === 0) {
        return "0.00 B";
    }

    // Define conversion constants.
    const KB = 1024;
    const MB = KB * 1024;
    const GB = MB * 1024;
    const TB = GB * 1024;

    // Determine the most appropriate unit and format the value.
    // Order conditions from largest unit to smallest.
    if (bytes >= TB) {
        return (bytes / TB).toFixed(2) + " TB";
    } else if (bytes >= GB) {
        return (bytes / GB).toFixed(2) + " GB";
    } else if (bytes >= MB) {
        return (bytes / MB).toFixed(2) + "MB";
    } else if (bytes >= KB) { // This now correctly handles values between 1KB and 1MB
        return (bytes / KB).toFixed(2) + " KB";
    } else { // Handle values less than 1KB, but greater than 0
        // Display with a minimum precision for very small numbers (e.g., "0.01 B")
        return bytes.toFixed(2) + " B";
    }
}


// --- Chart Rendering Function ---

/**
 * Renders or updates a disk usage bar chart using ApexCharts.
 * This function handles both the initial creation and subsequent smooth updates.
 * The chart will visually represent the 'Used' space within the 'Total' (Used + Available) space,
 * similar to a "pipe filled with water".
 * @param {string} chartId - The HTML ID of the div where the chart will be rendered (e.g., 'diskChart1_server-001').
 * @param {number} usedBytes - The used disk space in bytes (as a number/float).
 * @param {number} availableBytes - The available disk space in bytes (as a number/float).
 * @param {string} diskLabel - The label for the disk, e.g., 'sda1'.
 */
function renderDiskBarChart(chartId, diskLabel, usedBytes, availableBytes, totalBytes) {
    const chartElement = document.getElementById(chartId);
    // Basic validation: ensure the chart container exists

    // Clear any previous error message displayed in the dedicated error element.
    let seriesToRender = [];
    let categoriesToRender = [diskLabel]; // Category will be the disk label
    let dataLabelsFormatter, tooltipFormatter;
    // Determine if data is valid for chart rendering
    const isValidData = !(isNaN(usedBytes) || isNaN(availableBytes) || totalBytes === 0);
    if (!isValidData) {
        console.log('Invalid disk usage data (used or available bytes are not numbers).');
        // For invalid data, display 'Used: 0', 'Available: 0'
        seriesToRender = [
            { name: 'Used', data: [0], showInLegend: true },
            { name: 'Available', data: [0], showInLegend: false } // Still need 'Available' for stacking, but hide from legend
        ];
        dataLabelsFormatter = function () { return 'N/A'; };
        tooltipFormatter = function () { return 'N/A'; };
    } else {
        // Normal data processing if data is valid
        let currentUsedBytes = usedBytes;
        let currentAvailableBytes = availableBytes;

        // Calculate actual utilization percentage
        const actualUsedPercent = (totalBytes > 0) ? (usedBytes / totalBytes) * 100 : 0;

        // Apply minimum visible percentage for 'Used' segment if it's very small but not zero
        if (actualUsedPercent > 0 && actualUsedPercent < MIN_VISIBLE_USED_PERCENT) {
            currentUsedBytes = (MIN_VISIBLE_USED_PERCENT / 100) * totalBytes;
            currentAvailableBytes = totalBytes - currentUsedBytes;
            // Ensure currentAvailableBytes doesn't go negative due to float math
            if (currentAvailableBytes < 0) currentAvailableBytes = 0;
        } else if (usedBytes === 0 && totalBytes > 0) {
            // If used bytes is exactly 0, ensure currentUsedBytes is 0 and availableBytes is totalBytes
            currentUsedBytes = 0;
            currentAvailableBytes = totalBytes;
        }
        // If usedBytes === totalBytes (100% full), currentUsedBytes remains usedBytes, currentAvailableBytes remains 0.
        // No adjustment needed for 100% full or large usage.

        seriesToRender = [
            { name: 'Used', data: [currentUsedBytes], showInLegend: true },
            { name: 'Available', data: [currentAvailableBytes], showInLegend: false } // Hide 'Available' from legend
        ];

        // Define formatters for valid data. IMPORTANT: Use original values for display.
        dataLabelsFormatter = function (val, opts) {
            const seriesName = opts.w.globals.seriesNames[opts.seriesIndex];
            // Use the original value for formatting, not the adjusted one
            const originalVal = opts.seriesIndex === 0 ? usedBytes : availableBytes;
            return `${seriesName}: ${bytesToAppropriateUnit(originalVal)}`;
        };
        tooltipFormatter = function (value, { seriesIndex, w }) {
            const seriesName = w.globals.seriesNames[seriesIndex];
            // Use the original value for formatting, not the adjusted one
            const originalVal = seriesIndex === 0 ? usedBytes : availableBytes;
            return `${seriesName}: ${bytesToAppropriateUnit(originalVal)}`;
        };
    }
    if (diskCharts[chartId]) {
        diskCharts[chartId].updateSeries(seriesToRender);
    } else {
        // If chart doesn't exist yet, create it or render the "No data available" HTML message
        if (isValidData) {
            chartElement.innerHTML = ''; // Clear any fallback messages or previous content
            const options = {
                series: seriesToRender,
                chart: {
                    height: 100, // Increased height for better visibility
                    type: 'bar', // Bar chart type
                    stacked: true, // Crucial: Stacks Used and Available to form one total bar
                    toolbar: {
                        show: true // Show chart toolbar (e.g., download image).
                    },
                    animations: {
                        enabled: true,
                        easing: 'easeinout',
                        speed: 800,
                        animateGradually: {
                            enabled: true,
                            delay: 0
                        },
                        dynamicAnimation: {
                            enabled: true,
                            speed: 350
                        }
                    }
                },
                plotOptions: {
                    bar: {
                        horizontal: true, // Make it a horizontal bar chart
                        barHeight: '50%', // Increased bar height for better visibility
                        endingShape: 'rounded', // Rounded ends for the bar for a "pipe" feel
                        startingShape: 'rounded',
                        borderWidth: 0, // Added border width
                        borderColor: '#4a4a4a', // Added border color for better visibility
                        dataLabels: {
                            position: 'center', // Position data labels in the center of each segment (if enabled)
                        }
                    },
                },
                xaxis: {
                    categories: categoriesToRender, // Y-axis (now categories) for horizontal bar
                    labels: {
                        show: false
                    },
                    min: 0, // Ensure min is 0
                    max: totalBytes, // Set max to totalBytes for consistent scalin
                },
                yaxis: {
                    labels: {
                        show: true, // Show disk label on Y-axis
                        formatter: function (val) {
                            return String(val); // Y-axis label will be the disk name
                        }
                    },
                    title: {
                        text: 'Disk'
                    }
                },
                // Colors: Stronger for Used, Less strong for Available to represent "water in pipe"
                colors: ['#E74C3C', '#D3D3D3'], // Red for Used, Lighter Grey for Available
                dataLabels: {
                    enabled: false, // Hide data labels on the bar itself, as per image
                    formatter: dataLabelsFormatter // Keep formatter for potential re-enabling or debugging
                },
                tooltip: { // <--- ADD THIS TOOLTIP CONFIGURATION
                    y: {
                        formatter: function (val) {
                            return bytesToAppropriateUnit(val);
                        }
                    }
                },
                legend: {
                    position: 'bottom', // Position the legend at the bottom.
                    // Directly rely on showInLegend: false on the series for hiding "Available"
                },
                responsive: [{ // Responsive options for smaller screens.
                    breakpoint: 480,
                    options: {
                        chart: {
                            width: 200
                        },

                        legend: {
                            position: 'bottom'
                        }
                    }
                }]
            };

            // Create and render the new ApexCharts instance.
            const chart = new ApexCharts(chartElement, options);
            chart.render();
            // Store the chart instance in the global `diskCharts` object for future updates.
            diskCharts[chartId] = chart;
        } else {
            // If data is invalid and chart doesn't exist yet, show the HTML fallback message
            console.log(`Data is not valid`);
        }
    }
}


// --- Initialization Function ---

/**
 * Initializes the Disk Monitor charts and text displays for the first time.
 * This function sets up the initial rendering of the charts and then starts
 * the continuous update interval.
 */
async function initializeDiskStats() {

    // Clear any existing interval just in case, to prevent multiple loops
    if (diskUpdateInterval) {
        clearInterval(diskUpdateInterval);
        diskUpdateInterval = null; // Reset the variable
    }

    await updateDiskStatsDisplay(); // Perform an immediate initial update

    // Set up a recurring interval to fetch and update disk data every 30 seconds.
    diskUpdateInterval = setInterval(async () => {
        await updateDiskStatsDisplay(); // Call the dedicated update function
    }, 5000); // Poll every 30 seconds
}

/**
 * Fetches and updates disk statistics for all configured servers.
 * This function is called both on initial load and by the periodic interval.
 */
function renderDiskLineCharts(chartID, diskData) {
    if (!diskData) {
        console.log(`No data is found for the chart`);
        return;
    }
    const chartElement = document.getElementById(chartID);
    if (!chartElement) {
        console.log(`Cannot find the chart`);
        return;
    }
    diskData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const Rendercategories = diskData.map(d => {
        const date = new Date(d.timestamp);
        // Format to include seconds for more granularity on x-axis if needed
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    });
    let DataSeries = [];
    //console.log(DataSeries);
    for (const d of diskData) {
        if (d !== NaN) {
            DataSeries.push(d.value);
        }
        else {
            console.log(`Data passing when constructing the series is invalid`);
        }
    }
    const RenderSeries = [{ name: `disk Usage Percent`, data: DataSeries }];
    if (diskCharts[chartID]) {
        const options = {
            series: RenderSeries,
            chart: {
                height: 250,
                type: 'line',
                zoom: {
                    enabled: false
                },
                toolbar: {
                    show: true
                },
                animations: { // Enable animations for the initial render
                    enabled: true,
                    easing: 'linear',
                    dynamicAnimation: {
                        speed: 500 // Animation speed in milliseconds
                    }
                }
            },
            colors: ['#FF4560'],
            dataLabels: {
                enabled: false
            },
            stroke: {
                curve: 'smooth',
                width: 2
            },
            title: {
                text: `Disk Usage`,
                align: 'left'
            },
            grid: {
                row: {
                    colors: ['#f3f3f3'],
                    opacity: 0.5
                },
            },
            xaxis: {
                categories: Rendercategories,
                title: {
                    text: 'Time'
                },
                tickAmount: 'dataAndLabels' // Forces ApexCharts to consider both data points and labels
            },
            yaxis: {
                title: {
                    text: 'Percent used'
                },
                min: 0,
                labels: {
                    formatter: function (val) {
                        return val.toFixed(2);
                    }
                }
            },
            tooltip: {
                y: {
                    formatter: function (val) {
                        return val.toFixed(2);
                    }
                }
            }
        };
        diskCharts[chartID].updateOptions(options);
    }
    else {
        const options = {
            series: RenderSeries,
            chart: {
                height: 250,
                type: 'line',
                zoom: {
                    enabled: false
                },
                toolbar: {
                    show: true
                },
                animations: { // Enable animations for the initial render
                    enabled: true,
                    easing: 'linear',
                    dynamicAnimation: {
                        speed: 500 // Animation speed in milliseconds
                    }
                }
            },
            colors: ['#FF4560'],
            dataLabels: {
                enabled: false
            },
            stroke: {
                curve: 'smooth',
                width: 2
            },
            title: {
                text: `Cpu Usage`,
                align: 'left'
            },
            grid: {
                row: {
                    colors: ['#f3f3f3'],
                    opacity: 0.5
                },
            },
            xaxis: {
                categories: Rendercategories,
                title: {
                    text: 'Time'
                },
                tickAmount: 'dataAndLabels' // Forces ApexCharts to consider both data points and labels
            },
            yaxis: {
                title: {
                    text: 'Load Average'
                },
                min: 0,
                labels: {
                    formatter: function (val) {
                        return val.toFixed(2);
                    }
                }
            },
            tooltip: {
                y: {
                    formatter: function (val) {
                        return val.toFixed(2);
                    }
                }
            }
        };
        const chart = new ApexCharts(chartElement, options);
        chart.render();
        diskCharts[chartID] = chart;
    }

}
async function updateDiskStatsDisplay() {
    //console.log(diskCharts);
    for (const serverId of SERVER_IDS) {
        const serverDetails = await fetchServerDetails(serverId);
        const hostnameElement = document.getElementById(`serverHostname_${serverId}`);
        const ipElement = document.getElementById(`serverIp_${serverId}`);
        if (serverDetails) {
            if (hostnameElement) hostnameElement.textContent = serverDetails.hostname || 'N/A';
            if (ipElement) ipElement.textContent = serverDetails.ip_address;
        }
        for (const disk of diskList) {
            let LatestData;
            let Data;
            Data = await fetchDiskStatDetails(serverId, disk);
            console.log()
            const chartname = `${disk}-barChart_${serverId}`;
            let temp = [];
            if (Data) {
                /**
                 * Update Pie Chart
                 */
                LatestData = Data[0];
                console.log(LatestData);
                if (typeof LatestData === 'undefined') {
                    console.log(`Cannot find the latest data for disk ${disk} of server ${serverId}`);
                    continue;
                }
                const LatestTotal = parseFloat(LatestData.total_bytes);
                const LatestUsed = parseFloat(LatestData.used_bytes);
                const LatestAvail = parseFloat(LatestData.available_bytes);
                const LatestPercent = parseFloat(LatestData.percent_used);
                const ValForChart = LatestTotal - LatestUsed;
                const Totaltext = document.getElementById(`${disk}_totaltext_${serverId}`);
                const Usedtext = document.getElementById(`${disk}_usedtext_${serverId}`);
                const availtext = document.getElementById(`${disk}_availtext_${serverId}`);
                const percenttext = document.getElementById(`${disk}_percenttext_${serverId}`);
                if (Totaltext) { Totaltext.textContent = `${bytesToAppropriateUnit(LatestTotal)}` };
                if (Usedtext) { Usedtext.textContent = `${bytesToAppropriateUnit(LatestUsed)}` };
                if (availtext) { availtext.textContent = `${bytesToAppropriateUnit(LatestAvail)}` };
                if (percenttext) { percenttext.textContent = `${LatestPercent}%` };
                renderDiskBarChart(chartname, disk, LatestUsed, ValForChart, LatestTotal);
                /**
                 * Update LineCharts
                 */
                for (a of Data) {
                    const time = a.timestamp;
                    const value = parseFloat(a.percent_used);
                    temp.push({ value: value, timestamp: time });
                }
            }
            else {
                console.log(`The data read from fecth cannot be detected for disk: ${disk} of server : ${serverId}`);
                if (cpuUsageChart[chartname]) {
                    cpuUsageChart[chartname].destroy();
                    cpuUsageChart[chartname] = null;
                } if (cpuUsageChart[LineChartsName]) {
                    cpuUsageChart[LineChartsName].destroy();
                    cpuUsageChart[LineChartsName] = null;
                }
                continue;
            }
        }
    }
}


// --- Cleanup Function ---

/**
 * Stops the continuous update interval for disk statistics.
 * This is called when switching away from the Disk Monitor tab
 * to optimize performance and prevent unnecessary background polling.
 */
function stopDiskUpdates() {
    if (diskUpdateInterval) {
        clearInterval(diskUpdateInterval); // Clear the interval using its ID.
        diskUpdateInterval = null; // Reset the variable.
        //console.log("Stopped Disk update interval.");
    }
}
