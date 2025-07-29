let diskCharts = {}; // Stores ApexCharts instances
let diskUpdateInterval; // Stores the interval ID
let CurrentPhysicalServer = null; // Store currently active server ID
let CurrentVirtualServer = null; // Store currently active virtual server ID
let TimePicked = null;
let allVirtualServers = [];
let DayStart = getToday();
let DayEnd = getToday();
let TimeStart = `00:00`
let TimeEnd = `23:59`;
let Timegap = "3600";
//let CurrentTank = null;
const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
function getToday() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
async function updateTime() {
  DayStart = document.getElementById(`startdate`).value;
  DayEnd = document.getElementById(`enddate`).value;
  TimeStart = document.getElementById(`starttime`).value;
  TimeEnd = document.getElementById(`endtime`).value;
  Timegap = document.getElementById('intervalSelect').value;
}
async function filterByInterval(data, intervalSeconds) {
  const filtered = [];
  let lastTime = null;
  for (const t of data) {
    const currentTime = new Date(t.Timestamp).getTime();
    if (!lastTime || (currentTime - lastTime) >= intervalSeconds * 1000) {
      filtered.push(t);
      lastTime = currentTime;
    }
  }
  return filtered;
}
async function resetTime() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(date.getDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;
  document.getElementById(`endtime`).value = `23:59`;
  document.getElementById(`starttime`).value = '00:00';
  document.getElementById(`enddate`).value = `${today}`;
  document.getElementById(`startdate`).value = `${today}`;
  document.getElementById('intervalSelect').value = "3600";
}
// Your existing fetch functions
async function fetchOverview() {
  try {
    const baseUrl = `${API_BASE_URL}/get_info/specific_time/${Tank_Location}/${CurrentTank}/${CurrentPhysicalServer}/${CurrentVirtualServer}`;
    const query = new URLSearchParams({
      user_timezone: userTimeZone,
      timepick: TimePicked
    }).toString();
    const apiUrl = `${baseUrl}?${query}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching CPU details for Virtual Server :${CurrentVirtualServer} of ${CurrentPhysicalServer}:`, error);
    return null; // Return null on error for robust handling
  }

}
async function fetchCpuUsageVirtualServer() {
  try {
    const start = `${DayStart} ${TimeStart}`;
    const end = `${DayEnd} ${TimeEnd}`;
    const baseUrl = `${API_BASE_URL}/cpu-usage/virtual-server/${Tank_Location}/${CurrentTank}/${CurrentPhysicalServer}/${CurrentVirtualServer}`;
    const queryParams = new URLSearchParams({
      user_timezone: userTimeZone,
      start: start,
      end: end
    }).toString();
    const apiUrl = `${baseUrl}?${queryParams}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching CPU details for Virtual Server :${VirtualId} of ${serverId}:`, error);
    return null; // Return null on error for robust handling
  }
}
async function fetchRamUsageVirtualServer() {
  const start = `${DayStart} ${TimeStart}`;
  const end = `${DayEnd} ${TimeEnd}`;
  try {
    const baseUrl = `${API_BASE_URL}/ram-usage/virtual-server/${Tank_Location}/${CurrentTank}/${CurrentPhysicalServer}/${CurrentVirtualServer}`;
    const queryParams = new URLSearchParams({
      user_timezone: userTimeZone,
      start: start,
      end: end
    }).toString();
    const apiUrl = `${baseUrl}?${queryParams}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching ram details for Virtual Server :${VirtualId} of ${serverId}:`, error);
    return null; // Return null on error for robust handling
  }
}
async function fetchDiskVirtualServer() {
  try {
    const response = await fetch(`${API_BASE_URL}/disk-usage/by-virtual_server/${Tank_Location}/${CurrentTank}/${CurrentPhysicalServer}/${CurrentVirtualServer}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching disk details for Virtual Server :${VirtualId} of ${serverId}:`, error);
    return null; // Return null on error for robust handling
  }
}

async function fetchVirtualServerList(tank, physical) {
  allVirtualServers = [];
  //console.log(CurrentTank);
  //console.log(CurrentPhysicalServer);
  try {
    const response = await fetch(`${API_BASE_URL}/virtual_server/${Tank_Location}/${tank}/${physical}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    for (const s of data) {
      allVirtualServers.push(s);
    }
    return;
  } catch (error) {
    console.error(`Error fetching server details for ${serverId}:`, error);
    return;
  }
}
async function StopUpdateServerMenu() {
  if (diskUpdateInterval) {
    clearInterval(diskUpdateInterval);
    diskUpdateInterval = null;
  }
}
async function loadVirtualServerMenu(virtualServerId) {
  resetTime();

  // Define the chartID based on the currently active virtual server
  const barID = `${CurrentTank}_${CurrentPhysicalServer}_${CurrentVirtualServer}_barchart_diskUsage`;
  const LineId = `${CurrentTank}_${CurrentPhysicalServer}_${CurrentVirtualServer}_linechart_ramusage`;
  const CpuId = `${CurrentTank}_${CurrentPhysicalServer}_${CurrentVirtualServer}_linechart_cpuUsage`;
  // 1. Clear any *previous* interval that might be running for a different (or old) virtual server
  if (diskUpdateInterval) {
    clearInterval(diskUpdateInterval);
    diskUpdateInterval = null;
  }

  // 2. Destroy the *existing* chart instance for this chartID if it already exists.
  // This is crucial when navigating back to the same page, as the HTML elements
  // are being replaced.
  // THIS IS THE CORRECT PLACE FOR CHART DESTRUCTION
  if (diskCharts[barID]) {
    diskCharts[barID].destroy();
    delete diskCharts[barID];
  }
  if (diskCharts[LineId]) {
    diskCharts[LineId].destroy();
    delete diskCharts[LineId];
  }
  if (diskCharts[CpuId]) {
    diskCharts[CpuId].destroy();
    delete diskCharts[CpuId];
  }

  // 3. Render the HTML content first.
  // This ensures the target HTML element for the chart exists *before* we try to create the chart.
  const content = `
        <div class="container-xxl flex-grow-1 container-p-y" id="${CurrentVirtualServer}-menu">
            <h4 class="py-4 mb-6">Virtual Machine: ${CurrentVirtualServer} Details</h4>
            <h6 class="text-muted mb-4">Running on ${CurrentPhysicalServer}</h6>

             <div class="row">
                <div class="col-lg-6 col-md-3 mb-3">
                    <div class="card h-100">
                        <div class="card-body">
                            <div id ="${barID}">
                                <div class = "alert alert-info text-center" role = "alert"> Loading Bar Chart for disk Usage </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-6 col-md-3 mb-3">
                    <div class="card h-100" style="max-height: 200px !important">
                        <div class="card-header">
                            <h5 class="card-title mb-0">Current Status & Details</h5>
                        </div>
                        <div class="card-body">
                            <ul class="list-group list-group-flush">
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    <strong>Date Selected:</strong> <span id="${CurrentTank}_${CurrentPhysicalServer}_${CurrentVirtualServer}_Date">N/A</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    <strong>Time Selected:</strong> <span id="${CurrentTank}_${CurrentPhysicalServer}_${CurrentVirtualServer}_Time">N/A</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    <strong>Status:</strong> <span id="${CurrentTank}_${CurrentPhysicalServer}_${CurrentVirtualServer}_status">N/A</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    <strong>Used RAM:</strong> <span id="${CurrentTank}_${CurrentPhysicalServer}_${CurrentVirtualServer}_ram">N/A</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    <strong>Used CPU:</strong> <span id="${CurrentTank}_${CurrentPhysicalServer}_${CurrentVirtualServer}_cpu">N/A</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
                <div class="col-lg-12 col-md-3 mb-3">
                    <div class="card h-100" style="max-height: 200px !important">
                        <div class="card-body">
                            <div id= "${CurrentTank}_${CurrentPhysicalServer}_${CurrentVirtualServer}_linechart_ramusage">
                                <div class = "alert alert-info text-center" role="alert">Loading Used Ram Line Chart</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-lg-12 col-md-3 mb-3">
                    <div class="card h-100" style="max-height: 200px !important">
                        <div class="card-body">
                            <div id ="${CurrentTank}_${CurrentPhysicalServer}_${CurrentVirtualServer}_linechart_cpuUsage">
                                <div class = "alert alert-info text-center" role = "alert"> Loading Line Chart for CPU Usage </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
  await $('.content-wrapper').html(content);

  // 4. Perform an immediate initial update for the disk chart.
  // This will *create* the chart instance because diskCharts[chartID] is currently empty.
  await UpdateDiskStatsDisplay(barID);
  await updateRamStatsDisplay(LineId);
  await updateCpuDisplay(CpuId);
  // 5. Set up a recurring interval to fetch and update disk data.
  // This time, when UpdateDiskStatsDisplay is called, diskCharts[chartID] will exist,
  // and it will *update* the existing chart without re-rendering.
  diskUpdateInterval = setInterval(async () => {
    // Ensure context is still available (important if navigation happens quickly)
    if (CurrentPhysicalServer && CurrentVirtualServer) {
      await UpdateDiskStatsDisplay(barID);
      await updateRamStatsDisplay(LineId);
      await updateCpuDisplay(CpuId);
      await updateTime();
      await UpdateOverview();
    }
  }, 1000); // Update every 5 seconds
}

// Modified UpdateDiskStatsDisplay to always fetch the latest data itself
async function UpdateDiskStatsDisplay(chartID) {
  const elem = document.getElementById(chartID);

  // THIS IS THE CRITICAL CHANGE: The 'elem' check must be before any chart operations
  // or data fetching, because if the element is not there, nothing else matters.
  if (!elem) {
    console.error(`Element with ID ${chartID} not found in the DOM. Stopping update interval.`);
    if (diskUpdateInterval) {
      clearInterval(diskUpdateInterval);
      diskUpdateInterval = null;
    }
    return; // Exit if element not found (e.g., page changed again)
  }

  // Fetch the latest data inside the update function
  const latest_disk_stat = await fetchDiskVirtualServer();

  if (!latest_disk_stat) {
    elem.innerHTML = "No current data available for Disk Usage";
    return;
  }
  //console.log(latest_disk_stat);
  const disk_usage = latest_disk_stat["Disk_Usage"];
  const temp = disk_usage.split(`/`);
  const usedBytes = parseFloat(temp[0]);
  const totalBytes = parseFloat(temp[1]);
  const availBytes = totalBytes - usedBytes;

  if (isNaN(usedBytes) || isNaN(availBytes) || isNaN(totalBytes)) {
    elem.innerHTML = "Invalid disk usage data.";
    return;
  }

  // Update the text display
  const textDisplayElem = document.getElementById(`${CurrentPhysicalServer}}_${CurrentVirtualServer}_text_diskUsage`);
  if (textDisplayElem) {
    textDisplayElem.innerText = `${usedBytes.toFixed(2)} GB / ${totalBytes.toFixed(2)} GB`;
  }

  const seriesToRender = [
    { name: "Used", data: [usedBytes], showInLegend: true },
    { name: "Available", data: [availBytes], showInLegend: false }
  ];
  if (diskCharts[chartID]) {
    // If chart already exists, just update its series and options
    diskCharts[chartID].updateSeries(seriesToRender);
  } else {
    // If chart does not exist, create it for the first time
    elem.innerHTML = ''; // Clear the "Loading" message (or any previous content)

    const options = {
      series: seriesToRender,
      chart: {
        type: `bar`,
        height: 150,
        stacked: true,
        toolbar: {
          show: true
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
      dataLabels: {
        enabled: false,
      },
      plotOptions: {
        bar: {
          horizontal: true,
          borderWidth: 0, // Corrected typo
          dataLabels: {
            position: 'center',
          }
        },
      },
      xaxis: {
        categories: ["test"],
        labels: {
          show: true
        },
        min: 0,
        max: totalBytes, // Set initial max value
      },
      yaxis: {
        labels: {
          show: false,
        }
      },
      colors: ['#E74C3C', '#D3D3D3'],
      tooltip: {
        y: {
          formatter: function (val) {
            return `${val} GB`
          }
        }
      },
      legend: {
        position: 'bottom',
      },
      responsive: [{
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
    const chart = new ApexCharts(elem, options);
    chart.render();
    diskCharts[chartID] = chart; // Store the new chart instance
  }
}

async function updateCpuDisplay(chartid) {
  if (chartid === null || CurrentPhysicalServer === null || CurrentVirtualServer === null) {
    throw new Error("No Valid Data for Ram Chart");
  }
  console.log("Update CPU boiz");
  const elem = document.getElementById(chartid);
  if (!elem) {
    throw new Error("Cannot find the id of CPU Chart");
  }
  let CPUdata = await fetchCpuUsageVirtualServer();
  console.log(CPUdata);
  if (!CPUdata || CPUdata.length === 0) {
    elem.innerHTML = '<div class="alert alert-info text-center" role="alert">Loading Chart Data...</div>';
    return;
  }
  let dataseries = [];
  let categories = [];
  for (const DataPoint of CPUdata) {
    const use = parseFloat(DataPoint[`CPU_USAGE`]);
    dataseries.push(use);
    const TimeUST = DataPoint[`Timestamp`];
    const dateUST = new Date(TimeUST);
    const time = dateUST.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const date = dateUST.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    categories.push(`${date} ${time}`);
  }
  const numCores = CPUdata[0]["NUM_CORES"];
  RenderSeries = [{ name: `CPU_USAGE`, data: dataseries }];
  const commonOptions = {
    series: RenderSeries,
    chart: {
      height: "100%",
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
            const clickedDataPoint = CPUdata[config.dataPointIndex];
            //debugger;
            if (clickedDataPoint && clickedDataPoint.Timestamp) {
              if (TimePicked !== clickedDataPoint.Timestamp) {
                TimePicked = clickedDataPoint.Timestamp;
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
    stroke: { curve: 'smooth', width: 1 },
    title: { text: `Ram Usage`, align: 'left', style: { color: '#CCCCCC' } }, // Light grey title
    grid: {
      row: { colors: ['#444444', 'transparent'], opacity: 0.5 }, // Darker grid rows for dark theme
      borderColor: '#555555' // Darker grid lines for dark background
    },
    xaxis: {
      categories: categories,
      tickAmount: 'dataAndLabels',
      type: 'category',
      labels: {
        show: false,
      }
    },
    yaxis: {
      title: { show: false }, // Light grey title
      min: 0,
      labels: {
        formatter: function (val) { return `${val.toFixed(2)}% of ${numCores} cores`; },
        style: { colors: '#FFFFFF' } // White labels for dark background
      }
    },
    tooltip: {
      intersect: true,
      shared: false,
      enabled: true,
      y: { formatter: function (val) { return `${val.toFixed(2)}% of ${numCores} cores`; } },
      theme: 'dark' // Ensure tooltip is dark theme compatible
    }
  };
  if (diskCharts[chartid]) {
    diskCharts[chartid].updateOptions(commonOptions);
  } else {
    const chart = new ApexCharts(elem, commonOptions);
    chart.render();
    diskCharts[chartid] = chart;
  }
}
async function updateRamStatsDisplay(chartid) {
  if (chartid === null) {

    throw new Error("No Valid Data for Ram Chart");
  }
  const elem = document.getElementById(chartid);
  if (!elem) {
    elem.innerHTML = '<div class="alert alert-info text-center" role="alert">Loading Chart Data...</div>';
    return;
  }
  let RamData = await fetchRamUsageVirtualServer();
  //console.log(RamData);
  if (!RamData || RamData.length === 0) {
    elem.innerHTML = '<div class="alert alert-info text-center" role="alert">Loading Chart Data...</div>';
    return;
  }
  let dataseries = [];
  let categories = [];
  for (const DataPoint of RamData) {
    const temp = DataPoint['Ram_Usage'];
    const UsedVal = parseFloat(temp.split(`/`)[0]);
    const totalVal = parseFloat(temp.split(`/`)[1]);
    const TimeUST = DataPoint['Timestamp'];
    const USTdate = new Date(TimeUST);
    dataseries.push(UsedVal);
    const time = USTdate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const date = USTdate.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', date: '2-digit' });
    categories.push(`${date} ${time}`);
    //debugger;
  }
  //console.log(dataseries);
  const RenderSeries = [{ name: "Ram Usage OverTime", data: dataseries }];
  const commonOptions = {
    series: RenderSeries,
    chart: {
      height: "100%",
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
            const clickedDataPoint = RamData[config.dataPointIndex];
            //debugger;
            if (clickedDataPoint && clickedDataPoint.Timestamp) {
              if (TimePicked !== clickedDataPoint.Timestamp) {
                TimePicked = clickedDataPoint.Timestamp;
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
    title: { text: `Ram Usage`, align: 'left', style: { color: '#CCCCCC' } }, // Light grey title
    grid: {
      row: { colors: ['#444444', 'transparent'], opacity: 0.5 }, // Darker grid rows for dark theme
      borderColor: '#555555' // Darker grid lines for dark background
    },
    xaxis: {
      categories: categories,
      tickAmount: 'dataAndLabels',
      type: 'category',
      labels: {
        show: false,
      }
    },
    yaxis: {
      title: { text: 'Ram Usage', style: { color: '#CCCCCC' } }, // Light grey title
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
  if (diskCharts[chartid]) {
    diskCharts[chartid].updateOptions(commonOptions);
  } else {
    const chart = new ApexCharts(elem, commonOptions);
    chart.render();
    diskCharts[chartid] = chart;
  }
}
async function UpdateOverview() {
  const Date_text = document.getElementById(`${CurrentTank}_${CurrentPhysicalServer}_${CurrentVirtualServer}_Date`);
  const Time_text = document.getElementById(`${CurrentTank}_${CurrentPhysicalServer}_${CurrentVirtualServer}_Time`);
  const ram_text = document.getElementById(`${CurrentTank}_${CurrentPhysicalServer}_${CurrentVirtualServer}_ram`);
  const cpu_text = document.getElementById(`${CurrentTank}_${CurrentPhysicalServer}_${CurrentVirtualServer}_cpu`);
  const status_text = document.getElementById(`${CurrentTank}_${CurrentPhysicalServer}_${CurrentVirtualServer}_status`);
  const overview = await fetchOverview();
  ram_text.innerHTML = `${overview['Ram_Usage ']} MB`;
  cpu_text.innerHTML = `${overview[`CPU_USAGE`]} % of ${overview['NUM_CORES']}`;
  status_text.innerHTML = `${overview['status']}`;
  const temp = overview['Timestamp'];
  const dateUST = new Date(temp);
  const Time = dateUST.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const date = dateUST.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
  Date_text.innerHTML = date;
  Time_text.innerHTML = Time;
}