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
let Timegap = "900";//Cai nay la thoi gian ra giay (vdu 5 phut la 900 giay)
//let tank = null;
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
  document.getElementById('intervalSelect').value = "900";
}
// Your existing fetch functions
async function fetchOverview(tank, serverid, virtualid) {
  try {
    const response = await fetch(`${API_BASE_URL}/get_info/${Tank_Location}/${tank}/${serverid}/${virtualid}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching CPU details for Virtual Server :${virtual} of ${server}:`, error);
    return null; // Return null on error for robust handling
  }
}
async function fetchCpuUsageVirtualServer(tank, server, virtual) {
  try {
    const start = `${DayStart} ${TimeStart}`;
    const end = `${DayEnd} ${TimeEnd}`;
    const baseUrl = `${API_BASE_URL}/cpu-usage/virtual-server/${Tank_Location}/${tank}/${server}/${virtual}`;
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
    console.error(`Error fetching CPU details for Virtual Server :${virtual} of ${server}:`, error);
    return null; // Return null on error for robust handling
  }
}
async function fetchRamUsageVirtualServer(tank, server, virtual) {
  const start = `${DayStart} ${TimeStart}`;
  const end = `${DayEnd} ${TimeEnd}`;
  try {
    const baseUrl = `${API_BASE_URL}/ram-usage/virtual-server/${Tank_Location}/${tank}/${server}/${virtual}`;
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
    console.error(`Error fetching ram details for Virtual Server :${virtual} of ${server}:`, error);
    return null; // Return null on error for robust handling
  }
}
async function fetchDiskVirtualServer(tank, server, virtual) {
  try {
    const response = await fetch(`${API_BASE_URL}/disk-usage/by-virtual_server/${Tank_Location}/${tank}/${server}/${virtual}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching disk details for Virtual Server :${virtual} of ${server}:`, error);
    return null; // Return null on error for robust handling
  }
}

async function fetchVirtualServerList(tank, physical) {
  allVirtualServers = [];
  //console.log(tank);
  //console.log(server);
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
    console.error(`Error fetching server details for ${server}:`, error);
    return;
  }
}
async function StopUpdateServerMenu() {
  if (diskUpdateInterval) {
    clearInterval(diskUpdateInterval);
    diskUpdateInterval = null;
  }
}
async function loadVirtualServerMenu(tank, server, virtual) {
  resetTime();
  // Define the chartID based on the currently active virtual server
  // 1. Clear any *previous* interval that might be running for a different (or old) virtual server
  if (diskUpdateInterval) {
    clearInterval(diskUpdateInterval);
    diskUpdateInterval = null;
  }
  // 3. Render the HTML content first.
  // This ensures the target HTML element for the chart exists *before* we try to create the chart.
  const content = `
        <div class="container-xxl flex-grow-1 container-p-y" id="${virtual}-menu">
             <div class="row">
                <div class="col-xxl-8 col-xl-8 col-lg-8 col-md-8 col-sm-8 col-8">
                    <div class="card h-100">
                        <div class="card-body">
                            <div id ="${tank}_${server}_${virtual}_barchart_diskUsage">
                                <div class = "alert alert-info text-center" role = "alert"> Loading Bar Chart for disk Usage </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-xxl-4 col-xl-4 col-lg-4 col-md-4 col-sm-4 col-4">
                    <div class="card h-100" style="height: 200px !important">
                        <div class="card-header">
                            <h5 class="card-title mb-0">Current Status & Details</h5>
                        </div>
                        <div class="card-body">
                            <ul class="list-group list-group-flush">
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    <strong>Status:</strong> <span id="${tank}_${server}_${virtual}_status">N/A</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    <strong>Used RAM:</strong> <span id="${tank}_${server}_${virtual}_ram">N/A</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    <strong>Used CPU:</strong> <span id="${tank}_${server}_${virtual}_cpu">N/A</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
                <div class="col-xxl-12 col-xl-12 col-lg-12 col-md-12 col-sm-12 col-12">
                    <div class="card h-100" style = "height:225px!important;">
                        <div class="card-body" style = "height: 100% ; max-height:250px;">
                            <div id= "${tank}_${server}_${virtual}_linechart_ramusage" style="height : 100%; max-height: 250px;">
                                <div class = "alert alert-info text-center" role="alert">Loading Used Ram Line Chart</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-xxl-12 col-xl-12 col-lg-12 col-md-12 col-sm-12 col-12">
                    <div class="card h-100" style="height:225px !important;">
                        <div class="card-body" style = "height: 100% ; max-height:250px;">
                            <div id ="${tank}_${server}_${virtual}_linechart_cpuUsage" style="height : 100%; max-height: 250px;">
                                <div class = "alert alert-info text-center" role = "alert"> Loading Line Chart for CPU Usage </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
  await $('.content-wrapper').html(content);
  if (diskCharts[`${tank}_${server}_${virtual}_barchart_diskUsage`]) {
    diskCharts[`${tank}_${server}_${virtual}_barchart_diskUsage`].destroy();
    delete diskCharts[`${tank}_${server}_${virtual}_barchart_diskUsage`];
  }
  if (diskCharts[`${tank}_${server}_${virtual}_linechart_ramusage`]) {
    diskCharts[`${tank}_${server}_${virtual}_linechart_ramusage`].destroy();
    delete diskCharts[`${tank}_${server}_${virtual}_linechart_ramusage`];
  }
  if (diskCharts[`${tank}_${server}_${virtual}_linechart_cpuUsage`]) {
    diskCharts[`${tank}_${server}_${virtual}_linechart_cpuUsage`].destroy();
    delete diskCharts[`${tank}_${server}_${virtual}_linechart_cpuUsage`];
  }
  await updateTime();
  await UpdateDiskStatsDisplay(tank, server, virtual);
  await updateRamStatsDisplay(tank, server, virtual);
  await updateCpuDisplay(tank, server, virtual);
  await UpdateOverview(tank, server, virtual);
  diskUpdateInterval = setInterval(async () => {
    // Ensure context is still available (important if navigation happens quickly)
    await updateTime();
    await UpdateDiskStatsDisplay(tank, server, virtual);
    await updateRamStatsDisplay(tank, server, virtual);
    await updateCpuDisplay(tank, server, virtual);
    await UpdateOverview(tank, server, virtual);
  }, 30000); // Update every 5 seconds
}

// Modified UpdateDiskStatsDisplay to always fetch the latest data itself
async function UpdateDiskStatsDisplay(tank, server, virtual) {
  chartID = `${tank}_${server}_${virtual}_barchart_diskUsage`;
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
  const latest_disk_stat = await fetchDiskVirtualServer(tank, server, virtual);

  if (!latest_disk_stat) {
    elem.innerHTML = `<div class="alert alert-info text-center" role="alert"> Loading Line Chart for CPU Usage </div>`;
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
  const textDisplayElem = document.getElementById(`${server}}_${virtual}_text_diskUsage`);
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
          show: false
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
          borderWidth: 0,
          dataLabels: {
            position: 'center',
          }
        },
      },
      xaxis: {
        categories: ["Disk Usage"],
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
        show: false,
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

async function updateCpuDisplay(tank, server, virtual) {
  chartid = `${tank}_${server}_${virtual}_linechart_cpuUsage`;
  if (chartid === null || server === null || virtual === null) {
    throw new Error("No Valid Data for Ram Chart");
  }
  const elem = document.getElementById(chartid);
  if (!elem) {
    throw new Error("Cannot find the id of CPU Chart");
  }
  let CPUdata = await fetchCpuUsageVirtualServer(tank, server, virtual);
  if (!CPUdata || CPUdata.length === 0) {
    elem.innerHTML = '<div class="alert alert-info text-center" role="alert">Loading Chart Data...</div>';
    return;
  }
  let dataseries = [];
  let categories = [];
  CPUdata = await filterByInterval(CPUdata, Timegap);
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
      toolbar: { show: false },
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
    title: { text: `CPU Usage`, align: 'left', style: { color: '#CCCCCC' } }, // Light grey title
    grid: {
      row: { colors: ['#444444', 'transparent'], opacity: 0.5 }, // Darker grid rows for dark theme
      borderColor: '#555555' // Darker grid lines for dark background
    },
    xaxis: {
      categories: categories,
      tickAmount: 'dataAndLabels',
      type: 'category',
      labels: {
        show: false  // 💥 This removes label space entirely
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    yaxis: {
      title: { show: false }, // Light grey title
      min: 0,
      max: 100 * parseFloat(numCores),
      tickAmount: 10,
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
    elem.innerHTML = '';
    const chart = new ApexCharts(elem, commonOptions);
    chart.render();
    diskCharts[chartid] = chart;
  }
}
async function updateRamStatsDisplay(tank, server, virtual) {
  chartid = `${tank}_${server}_${virtual}_linechart_ramusage`;
  if (chartid === null) {
    throw new Error("No Valid Data for Ram Chart");
  }
  const elem = document.getElementById(chartid);
  let RamData = await fetchRamUsageVirtualServer(tank, server, virtual);
  //console.log(RamData);
  if (!RamData || RamData.length === 0) {
    elem.innerHTML = '<div class="alert alert-info text-center" role="alert">Loading Chart Data...</div>';
    return;
  }
  RamData = await filterByInterval(RamData, Timegap);
  let dataseries = [];
  let categories = [];
  for (const DataPoint of RamData) {
    const temp = DataPoint['Ram_Usage'];
    const UsedVal = parseFloat(temp.split(`/`)[0]);
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
      toolbar: { show: false },
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
        show: false  // 💥 This removes label space entirely
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    yaxis: {
      title: { show: false }, // Light grey title
      tickAmount: 10,
      min: 0,
      max: 20000,
      labels: {
        formatter: function (val) { return formatSizeSync(val); },
        style: { colors: '#FFFFFF' } // White labels for dark background
      }
    },
    tooltip: {
      intersect: true,
      shared: false,
      enabled: true,
      y: { formatter: function (val) { return formatSizeSync(val); } },
      theme: 'dark' // Ensure tooltip is dark theme compatible
    }
  };
  if (diskCharts[chartid]) {
    diskCharts[chartid].updateOptions(commonOptions);
  } else {
    elem.innerHTML = '';
    const chart = new ApexCharts(elem, commonOptions);
    chart.render();
    diskCharts[chartid] = chart;
  }
}
async function UpdateOverview(tank, server, virtual) {
  const ram_text = document.getElementById(`${tank}_${server}_${virtual}_ram`);
  const cpu_text = document.getElementById(`${tank}_${server}_${virtual}_cpu`);
  const status_text = document.getElementById(`${tank}_${server}_${virtual}_status`);
  const overview = await fetchOverview(tank, server, virtual);
  ram_text.innerHTML = `${overview['Ram_Usage']} MB`;
  const dum = overview['Ram_Usage'].split('/');
  const percentcpu = (parseFloat(dum[0]) / parseFloat(dum[1])) * 100;
  updateColordynamic(ram_text, percentcpu);
  cpu_text.innerHTML = `${overview[`CPU_USAGE`]} of ${overview['NUM_CORES']}`;
  updateColordynamic(cpu_text, parseFloat(overview[`CPU_USAGE`]));
  status_text.innerHTML = `${overview['status']}`;
  if (overview['status'] === 'running') {
    status_text.style.color = '#45ff80ff';
  } else {
    status_text.style.color = '#777472ff';
  }
}