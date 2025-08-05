let tankList = [];
let CurrentTank = "1";
let TankChart = {};
let tankUpdateInterval;
/**
 * There is an argument here for easier debugging and code understanding.
 * tankId argument can be got rid of , and every part
 * that uses tankId can be replaced by CurrentTank
 * @param tankId 
 * @returns 
 */
async function fetchtanktext(tankId) {
  try {
    const response = await fetch(`${API_BASE_URL}/text/${Tank_Location}/${tankId}`);
    if (!response.ok) {
      throw new Eror(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching CPU details for Virtual Server :${CurrentVirtualServer} of ${CurrentPhysicalServer}:`, error);
    return null; // Return null on error for robust handling
  }

}
/**
 * Function to fetch latest stats for each physical server card
 */
async function fetchlatestserver(tank, server) {
  try {
    const response = await fetch(`${API_BASE_URL}/overview/${Tank_Location}/${tank}/${server}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  }
  catch (error) {
    console.error(`Error fetching tank list`, error);
    return null; // Return null on error for robust handling
  }
}
async function fetchtanklist() {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/get_tank/${Tank_Location}`);
  }
  catch (error) {
    console.error(`Error fetching tank list`, error);
    return null; // Return null on error for robust handling
  }
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  data.forEach((tank) => {
    tankList.push(tank);
  });
}
async function fetchtanktemp(tankId) {
  try {
    const start = `${DayStart} ${TimeStart}`;
    const end = `${DayEnd} ${TimeEnd}`;
    const baseUrl = `${API_BASE_URL}/temp/${Tank_Location}/${tankId}`;
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
    console.error(`Error fetching temperature of tank ${tankId}`, error);
    return null;
  }
}
async function UpdateTemperatureChart(tankId) {
  const LineChartId = `${tankId}_Temperature_LineChart`;
  const Chart = document.getElementById(LineChartId);
  //const abc = parseInt(tankId);
  let TempData = await fetchtanktemp(tankId);
  if (TempData.length <= 0) {
    Chart.innerHTML = '<div class="alert alert-info text-center" role="alert" style = "height:100%">Loading Chart Data...</div>';
    return;
  }
  let Layer1temp = [];
  let Layer2temp = [];
  let Layer3temp = [];
  let categories = [];
  TempData = await filterByInterval(TempData, Timegap);
  for (const a of TempData) {
    if (typeof a["L1"] != undefined && typeof a["L2"] != undefined && typeof a["L3"] != undefined) {
      Layer1temp.push(a["L1"]);
      Layer2temp.push(a["L2"]);
      Layer3temp.push(a["L3"]);
      const TimeUST = a[`Timestamp`];
      const dateUST = new Date(TimeUST);
      const time = dateUST.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const date = dateUST.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
      categories.push(`${date} ${time}`);
    }
  }
  const RenderSeries = [
    { name: "Layer 1", data: Layer1temp },
    { name: "Layer 2", data: Layer2temp },
    { name: "Layer 3", data: Layer3temp }
  ];
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
            const clickedDataPoint = TempData[config.dataPointIndex];
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
    colors: ['#fff645ff', '#7745ffff', '#ff4545ff'], // A distinct color for the line
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 1 },
    title: {
      text: `Temperature`,
      align: 'left',
      style: { color: '#CCCCCC' },
    },
    offsetY: -5, // Light grey title
    grid: {
      row: { colors: ['#444444', 'transparent'], opacity: 0.5 }, // Darker grid rows for dark theme
      borderColor: '#555555' // Darker grid lines for dark background
    },
    legend: {
      show: true,
      position: 'top',
      labels: {
        colors: '#e3c0c0ff',   // ← Make legend text white
        useSeriesColors: false // ← Prevent overriding by series color
      },
      float: true,
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
      axisBorder: {
        show: true,
        color: '#BBBBBB', // Light grey for better contrast
        width: 2
      },
      axisTicks: {
        show: true,
        color: '#BBBBBB'
      },
      labels: {
        formatter: val => `${val.toFixed(1)} °C`,
        style: { colors: '#FFFFFF' }
      },
      title: {
        show: false
      },
      min: 20,
      max: 80,
      tickAmount: 6,
    },
    tooltip: {
      intersect: true,
      shared: false,
      enabled: true,
      y: { formatter: val => `${val.toFixed(1)} °C` },
      theme: 'dark' // Ensure tooltip is dark theme compatible
    }
  };
  if (TankChart[LineChartId]) {
    TankChart[LineChartId].updateOptions(commonOptions);
  } else {
    Chart.innerHTML = '';
    const chart = new ApexCharts(Chart, commonOptions);
    chart.render();
    TankChart[LineChartId] = chart;
  }
}
async function loadTankMenu(tankId) {
  resetTime();
  if (tankUpdateInterval) {
    clearInterval(tankUpdateInterval);
    tankUpdateInterval = null;
  }

  const content = `
      <div class="container-xxl flex-grow-1 container-p-y" id="tank-${tankId}-box">
        <div class="row mb-4" style = "padding-top:0px">
          <div class="col-8 col-sm-8 col-md-8 col-lg-8 col-xl-8 col-xxl-8" style = 
          "padding :0rem; margin:0rem;"> 
            <div class="card">
              <div class="card-body" style = "height : 150px">
                <div id= "${tankId}_Temperature_LineChart">
                  <div class = "alert alert-info text-center" style="display: flex; justify-content: center; align-items: center; margin:auto; padding-top:100px" role="alert">Loading Used Ram Line Chart</div>
                </div>
              </div>
            </div>
          </div>
          <div class="col-4 col-sm-4 col-md-4 col-lg-4 col-xl-4 col-xxl-4" style = 
          "padding :0rem; margin:0rem;">
            <div class="card" style = "height: 150px">
              <div class="card-header">
                <h5 class="card-title mb-0">Current Layer Temperatures</h5>
              </div>
              <div class="card-body" >
                <ul class="list-group list-group-flush">
                  <li class="list-group-item d-flex justify-content-between align-items-center">
                    Layer 1: <span class="badge bg-label-info" id = "${tankId}_Layer-1_temperature_text">N/A </span>
                  </li>
                  <li class="list-group-item d-flex justify-content-between align-items-center">
                    Layer 2: <span class="badge bg-label-info" id = "${tankId}_Layer-2_temperature_text">N/A </span>
                  </li>
                  <li class="list-group-item d-flex justify-content-between align-items-center">
                    Layer 3: <span class="badge bg-label-info"  id = "${tankId}_Layer-3_temperature_text">N/A</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        <div class="row" id="serversInTankContainer"></div>
      </div>
    `;
  await $('.content-wrapper').html(content);
  if (TankChart[`${tankId}_Temperature_LineChart`]) {
    TankChart[`${tankId}_Temperature_LineChart`].destroy();
    delete TankChart[`${tankId}_Temperature_LineChart`];
  }
  // Only populate physical server cards here
  await populateServersInTankCards(tankId);
  await UpdateTemperatureChart(tankId);
  await UpdateTankTemperatureText(tankId);
  tankUpdateInterval = setInterval(async () => {
    await updateTime();
    await UpdateTemperatureChart(CurrentTank);
    if (TimePicked) {
      await UpdateTankTemperatureText(tankId);
    }
  }, 1000);
}
function getColor(temp) {
  if (temp >= 80) return "#ff4e4e";      // Bright red
  if (temp >= 60) return "#ff80c0";      // Neon pink
  else return "#00ffa2";      // Bright green
}
async function UpdateTankTemperatureText(tankId) {
  const Layer1Span = document.getElementById(`${tankId}_Layer-1_temperature_text`);
  const Layer2Span = document.getElementById(`${tankId}_Layer-2_temperature_text`);
  const Layer3Span = document.getElementById(`${tankId}_Layer-3_temperature_text`);

  const info = await fetchtanktext(tankId);
  if (!info) return;
  let l1 = parseFloat(info['L1']).toFixed(2);
  let l2 = parseFloat(info['L2']).toFixed(2);
  let l3 = parseFloat(info['L3']).toFixed(2);
  Layer1Span.textContent = `${l1} °C`;
  Layer2Span.textContent = `${l2} °C`;
  Layer3Span.textContent = `${l3} °C`;

  // Apply wonderful text color based on thresholds

  Layer1Span.style.color = getColor(l1);
  Layer1Span.style.setProperty("color", getColor(l1), "important");
  Layer1Span.style.backgroundColor = getColor(l1);
  Layer2Span.style.color = getColor(l2);
  Layer2Span.style.setProperty("color", getColor(l2), "important");
  Layer2Span.style.backgroundColor = getColor(l2);
  Layer3Span.style.color = getColor(l3);
  Layer3Span.style.setProperty("color", getColor(l3), "important");
  Layer3Span.style.backgroundColor = getColor(l3);
}

function formatSizeSync(bytes) {
  if (typeof bytes !== "number" || isNaN(bytes)) {
    return;
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  // Upgrade until we have at most 2 digits before the dot
  while (value >= 100 && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex++;
  }

  // Format to max 2 digits before and after decimal
  let formatted;
  if (value >= 10) {
    formatted = value.toFixed(2 - Math.floor(Math.log10(value)));
  } else {
    formatted = value.toFixed(2);
  }

  return `${formatted} ${units[unitIndex]}`;
}

async function formatSize(bytes) {
  if (typeof bytes !== "number" || isNaN(bytes)) {
    return;
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  // Upgrade until we have at most 2 digits before the dot
  while (value >= 100 && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex++;
  }

  // Format to max 2 digits before and after decimal
  let formatted;
  if (value >= 10) {
    formatted = value.toFixed(2 - Math.floor(Math.log10(value)));
  } else {
    formatted = value.toFixed(2);
  }

  return `${formatted} ${units[unitIndex]}`;
}
function styleUsageText(spanElement, percent) {
  // Remove all potential conflict classes
  spanElement.classList.remove("text-success", "text-danger");
  spanElement.style.color = ""; // Reset inline style

  if (percent < 60) {
    spanElement.classList.add("text-success"); // Bootstrap green
  } else if (percent < 80) {
    spanElement.style.color = "#ed2f8eff"; // Custom pink
  } else {
    spanElement.classList.add("text-danger"); // Bootstrap red
  }
}
async function StopUpdateTank() {
  if (tankUpdateInterval) {
    clearInterval(tankUpdateInterval);
    tankUpdateInterval = null;
  }
}
async function populateServersInTankCards(tank) {
  const container = $('#serversInTankContainer');
  container.empty();
  const allphysicalservers = await fetchServerListOuter(tank);
  if (allphysicalservers.length <= 0) {
    console.log("Cannot Read array while populating Server Cards in tank menu");
    return;
  }
  let CardValues = [];
  for (const servers of allphysicalservers) {
    let k = await fetch(`${API_BASE_URL}/overview/${Tank_Location}/${servers.TANK_ID}/${servers.SERVER_ID}`);
    z = await k.json();
    z['SERVER_IP'] = servers['SERVER_IP'];
    CardValues.push(z);
  }
  console.log(CardValues);
  for (const server of CardValues) {
    const disk_used = await formatSize(server.Used_Disk);
    const disk_total = await formatSize(server.Total_Disk);
    const ram_total = await formatSize(server.total_ram);
    const ram_used = await formatSize(server.used_ram);
    const percent_used = (server.cpu_percent_used).toFixed(2);
    const num_cores = server.logical_cores;
    const cardHtml = `
        <div class="col-xxl-2 col-xl-2 col-lg-2 col-md-2 col-sm-2 col-2">
          <div class="card physical-server-card" data-server-id="${server.SERVER_ID}" >
            <div class="card-header py-1 px-2">
                <h6 class="mb-0 text-truncate">${server.SERVER_IP}</h6>
            </div>
            <div class="card-body">
              <ul class="list-unstyled mb-0">
                <li><strong>Temperature: </strong> <span id ="${server.SERVER_ID}_text_CPUtemp" class = "text-usage">${server.temperature}</span></li>
                <li><strong>CPU:</strong> <span id ="${server.SERVER_ID}_text_CPUUsage">${percent_used}% of ${num_cores} cores</span></li>
                <li><strong>RAM:</strong> <span id ="${server.SERVER_ID}_text_RamUsage">${ram_used}/${ram_total}</span></li>
                <li><strong>Disk:</strong> <span id ="${server.SERVER_ID}_text_DiskUsage">${disk_used}/${disk_total}</span></li>
              </ul>
            </div>
          </div>
      `;
    container.append(cardHtml);

    const temperature_span = document.getElementById(`${server.SERVER_ID}_text_CPUtemp`);
    temperature_span.style.color = getColor(server.temperature);

    const cpuUsage = parseFloat(percent_used); // Example: 72.5
    const cpuSpan = document.getElementById(`${server.SERVER_ID}_text_CPUUsage`);
    styleUsageText(cpuSpan, cpuUsage);

    // Similar for RAM
    const ramPercent = (ram_used / ram_total) * 100;
    const ramSpan = document.getElementById(`${server.SERVER_ID}_text_RamUsage`);
    styleUsageText(ramSpan, ramPercent);

    // And Disk
    const diskPercent = (disk_used / disk_total) * 100;
    const diskSpan = document.getElementById(`${server.SERVER_ID}_text_DiskUsage`);
    styleUsageText(diskSpan, diskPercent);
  };
  container.find('.physical-server-card').on('click', function () {
    const serverId = $(this).data('server-id');
    loadServerMenu(serverId);
  });

}