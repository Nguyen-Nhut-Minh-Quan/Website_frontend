let serverList = [];
let physicalserverchart = {};
let physicalserverUpdateInterval = null;
async function fetchServerList() {
  await fetchServerList(CurrentTank);
}
async function fetchPhysicalServerPickedOverview(tank, server) {
  console.log("TimePicked", TimePicked);
  try {
    const baseUrl = `${API_BASE_URL}/physical-server/overview/timepick/${Tank_Location}/${tank}/${server}`;
    const query = new URLSearchParams({
      Timepick: TimePicked
    }).toString();
    const apiUrl = `${baseUrl}?${query}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Eror(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`fetching error for timePicked part`, error);
    return null; // Return null on error for robust handling
  }
}
async function fetchRamPhysicalServer(tank, server) {
  try {
    const start = `${DayStart} ${TimeStart}`;
    const end = `${DayEnd} ${TimeEnd}`;
    const baseUrl = `${API_BASE_URL}/ram/physical-server/${Tank_Location}/${tank}/${server}`;
    const queryParams = new URLSearchParams({
      user_timezone: userTimeZone,
      start: start,
      end: end
    }).toString();
    const apiUrl = `${baseUrl}?${queryParams}`;
    const response = await fetch(apiUrl);
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
async function fetchCpuPhysicalServer(tank, server) {
  try {
    const start = `${DayStart} ${TimeStart}`;
    const end = `${DayEnd} ${TimeEnd}`;
    const baseUrl = `${API_BASE_URL}/cpu/physical-server/${Tank_Location}/${tank}/${server}`;
    const queryParams = new URLSearchParams({
      user_timezone: userTimeZone,
      start: start,
      end: end
    }).toString();
    const apiUrl = `${baseUrl}?${queryParams}`;
    const response = await fetch(apiUrl);
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
async function fetchDiskPhysicalServer(tank, server) {
  try {
    const response = await fetch(`${API_BASE_URL}/physical_server/disk/${Tank_Location}/${tank}/${server}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching Disk of tank ${CurrentTank} server ${CurrentPhysicalServer}`, error);
    return null; // Return null on error for robust handling
  }
}
async function fetchServerList(tank) {
  try {
    const response = await fetch(`${API_BASE_URL}/get_server_list/${Tank_Location}/${tank}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    data.forEach(server => {
      serverList.push(server);
    });
  } catch (error) {
    console.error(`Error fetching server List of ${CurrentTank}`, error);
    return null; // Return null on error for robust handling
  }
}
async function fetchServerListOuter(tank) {
  console.log(`${API_BASE_URL}/get_server_list/${Tank_Location}/${tank}`);
  try {
    const response = await fetch(`${API_BASE_URL}/get_server_list/${Tank_Location}/${tank}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching server List of ${CurrentTank}`, error);
    return null; // Return null on error for robust handling
  }
}
async function fetchPhysicaltemp(tank, server) {
  try {
    const start = `${DayStart} ${TimeStart}`;
    const end = `${DayEnd} ${TimeEnd}`;
    //console.log("day start", start);
    const baseUrl = `${API_BASE_URL}/temperature/physical-server/${Tank_Location}/${tank}/${server}`;
    const queryParams = new URLSearchParams({
      user_timezone: userTimeZone,
      start: start,
      end: end
    }).toString();
    const apiUrl = `${baseUrl}?${queryParams}`;
    const response = await fetch(apiUrl);
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
async function renderServerCards(allVirtualServers) {
  const container = document.getElementById("VirtualServersInServersContainer");
  container.innerHTML = ""; // clear old cards

  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight - 300; // Adjust for header/menus
  const totalCards = allVirtualServers;
  container.style.height = `${screenHeight}px`;
  container.style.display = "grid";
  container.style.overflow = "hidden";

  // Rough assumption for ideal card aspect ratio
  const cardAspectRatio = 3 / 2;

  // Try different row counts and pick the one that fits
  let bestRows = 1;
  let bestCols = totalCards;

  for (let rows = 1; rows <= totalCards; rows++) {
    const cols = Math.ceil(totalCards / rows);
    const cardWidth = screenWidth / cols;
    const cardHeight = screenHeight / rows;

    if (cardHeight * cardAspectRatio < cardWidth) {
      bestRows = rows;
      bestCols = cols;
      break;
    }
  }

  // Apply grid style
  container.style.gridTemplateColumns = `repeat(${bestCols}, 1fr)`;

  // Add cards
  for (let i = 0; i < allVirtualServers; i++) {
    const card = document.createElement("div");
    card.classList.add("virtual-server-card");
    card.style = "padding-bottom: 0";
    card.innerHTML = `
      <h6 class="mb-1 text-truncate">Server ${i + 1}</h6>
      <ul class="list-unstyled mb-0" >
        <li><strong>CPU:</strong> 300GB/1200GB</li>
        <li><strong>RAM:</strong>  N/A </li>
        <li><strong>Disk:</strong> N/A</li>
      </ul>
    `;
    container.appendChild(card);
  };
}

async function loadServerMenu(tank, serverId) {
  resetTime();
  if (physicalserverUpdateInterval) {
    clearInterval(physicalserverUpdateInterval);
    physicalserverUpdateInterval = null;
  }
  const content = `
  <div class="container-xxl flex-grow-1 container-p-y"style="display: flex; flex-direction: column; height: 100vh; padding-top:0;padding-bottom:0;padding-right:0" id="${tank}-${serverId}-menu">
    <div class="row m-0 p-0 g-0">
      <div class="col-lg-8 col-md-12 mb-4" style = "margin-block-end:0 !important;">
        <div class="card h-100">
          <div class="card-body">
            <div id="${tank}_${serverId}_TemperatureLineChart" style = "height:250px" >
              <div class="alert alert-info text-center" role="alert">Loading temperature line chart...</div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-4 col-md-6 mb-4" style = "margin-block-end:0 !important;">
        <div class="card h-100">
          <div class="card-body">
            <ul class="list-group list-group-flush">
              <li class="list-group-item d-flex justify-content-between align-items-center">
                <strong>Time:</strong> <span id="${tank}_${serverId}_stats_Time"
                  class="badge bg-label-primary">N/A</span>
              </li>
               <li class="list-group-item d-flex justify-content-between align-items-center">
                <strong>IP:</strong> <span id="${tank}_${serverId}_stats_IP"
                  class="badge bg-label-primary">N/A</span>
              </li>
              <li class="list-group-item d-flex justify-content-between align-items-center">
                <strong>Total RAM Use:</strong> <span id="${tank}_${serverId}_stats_RamUsage"
                  class="badge bg-label-primary">N/A</span>
              </li>
              <li class="list-group-item d-flex justify-content-between align-items-center">
                <strong>CPU Temperature:</strong> <span id="${tank}_${serverId}_stats_temp"
                  class="badge bg-label-info">N/A</span>
              </li>
              <li class="list-group-item d-flex justify-content-between align-items-center">
                <strong>Total CPU Usage:</strong> <span id="${tank}_${serverId}_stats_CPUUsage"
                  class="badge bg-label-success">N/A</span>
              </li>
              <li class="list-group-item d-flex justify-content-between align-items-center">
                <strong>Total Disk Usage:</strong> <span id="${tank}_${serverId}_stats_DiskUsage"
                  class="badge bg-label-success">N/A</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div class="col-lg-4 col-md-12 mb-4" style="margin-block-end:0 !important; padding :0 !important; max-height:175px">
        <div class="card h-100">
          <div class="card-body">
            <div id="${tank}-${serverId}_RamUsageLineChart">
              <div class="alert alert-info text-center" role="alert">Loading Free RAM line chart...</div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-4 col-md-12 mb-4" style="margin-block-end:0 !important; padding :0 !important; max-height :175px!important;">
        <div class="card h-100">
          <div class="card-header">
            <h5 class="card-title mb-0" id = "${tank}_${serverId}_title_disk_text">Total Disk Used</h5>
          </div>
          <div class="card-body">
            <div id="${tank}-${serverId}_DiskUsageBarChart" >
              <div class="alert alert-info text-center" role="alert">Loading Disk Usage line chart...</div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-4 col-md-12 mb-4" style="margin-block-end:0 !important; padding :0 !important;">
        <div class="card h-100">
          <div class="card-body">
            <div id="${tank}-${serverId}_CpUUsageLineChart" style="max-height : 175px!important;margin-block-end:0 !important; margin-bottom : 0 !important; padding : 0!important">
              <div class="alert alert-info text-center" role="alert">Loading CPU Usage Line Chart...</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div id="VirtualServersInServersContainer" class="server-grid"  style="flex: 1 1 auto; overflow-y: auto; padding:0!important;"></div>
    </div>
    `;
  // if (physicalserverchart[`${tank}-${serverId}_TemperatureLineChart`]) {
  //   physicalserverchart[`${tank}-${serverId}_TemperatureLineChart`].destroy();
  //   delete physicalserverchart[`${tank}-${serverId}_TemperatureLineChart`];
  // }
  await $('.content-wrapper').html(content);
  await resetChart(tank, serverId);
  await renderServerCards(18);
  physicalserverUpdateInterval = setInterval(async () => {
    if (CurrentPhysicalServer) {
      await updateTime();
      await updateServerTemp(tank, serverId);
      await updateServerDisk(tank, serverId);
      await updateServerRam(tank, serverId);
      await updateServerCpu(tank, serverId);
      if (TimePicked) {
        await updateOverviewPhysicalServer(tank, serverId);
      }
    }
  }, 1000);
  // THIS IS THE CORRECT PLACE for virtual server cards
}
async function updateServerCpu(tank, serverId) {
  //const TextElem = document.getElementById(`${tank}_${serverId}_title_disk_text`);
  const LineChartId = `${tank}-${serverId}_CpUUsageLineChart`;
  const Chart = document.getElementById(LineChartId);
  const RawCpuData = await fetchCpuPhysicalServer(tank, serverId);
  console.log(RawCpuData);
  const filteredCpuData = await filterByInterval(RawCpuData, Timegap);
  console.log('filtered data', filteredCpuData);
  const numCores = filteredCpuData[0]["logical_cores"];
  let dataSeries = [];
  let RenderCategories = [];
  for (const a of filteredCpuData) {
    dataSeries.push(a["cpu_percent_used"]);
    // console.log("Value push", a["cpu_percent_used"]);
    const TimeUST = a[`Timestamp`];
    const dateUST = new Date(TimeUST);
    const time = dateUST.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const date = dateUST.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    RenderCategories.push(`${date} ${time}`);
  }
  // console.log(dataSeries);
  // console.log(RenderCategories);
  let RenderSeries = [{ name: "CPU_USAGE", data: dataSeries }];
  // console.log(RenderSeries);
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
      // sparkline: {
      //   enabled: true
      // },
      // --- NEW: Add dataPointSelection event listener ---
      events: {
        dataPointSelection: function (event, chartContext, config) {
          // Check if a valid data point was clicked
          //console.log(`hahahafaseafasfesfaa`);

          if (config.dataPointIndex !== undefined && config.dataPointIndex !== -1) {
            const clickedDataPoint = filteredCpuData[config.dataPointIndex];
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
    colors: ['#931616ff'], // A distinct color for the line
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 1 },
    title: { text: `CPU_USAGE`, align: 'left', style: { color: '#CCCCCC' } }, // Light grey title
    legend: {
      show: false,
      // position: 'top',
      // floating: true,
      // itemMargin: { horizontal: 6, vertical: 0 },
      // offsetY: -15,
      // labels: {
      //   colors: '#e3c0c0ff',   // ← Make legend text white
      //   useSeriesColors: false // ← Prevent overriding by series color
      // },
    },
    xaxis: {
      categories: RenderCategories,
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
      labels: {
        formatter: val => `${val}% of ${numCores}`,
        style: { colors: '#FFFFFF' } // White labels for dark background
      },
    },
    tooltip: {
      show: false
    }
  };
  if (physicalserverchart[LineChartId]) {
    physicalserverchart[LineChartId].updateOptions(commonOptions);
  } else {
    Chart.innerHTML = '';
    const chart = new ApexCharts(Chart, commonOptions);
    chart.render();
    physicalserverchart[LineChartId] = chart;
  }
}
async function updateServerDisk(tank, serverId) {
  const TextElem = document.getElementById(`${tank}_${serverId}_title_disk_text`);
  const chartId = `${tank}-${serverId}_DiskUsageBarChart`;
  const ChartElem = document.getElementById(chartId);
  // if (physicalserverchart[chartId]) {
  //   physicalserverchart[chartId].destroy();
  //   delete physicalserverchart[chartId];
  // }
  const LatestData = await fetchDiskPhysicalServer(tank, serverId);
  const percentUsed = parseFloat(LatestData["percent_used"]);
  const percentAvail = 100.0 - percentUsed;
  const SeriesRender = [{ name: "Used", data: [percentUsed] }, { name: "Available", data: [percentAvail] }];
  const UsedText = await formatSize(parseFloat(LatestData["used_bytes"]));
  const TotalText = await formatSize(parseFloat(LatestData["total_bytes"]));
  let commonOptions = {
    series: SeriesRender,
    chart: {
      toolbar: {
        show: false,
      },
      type: 'bar',
      height: `100%`,
      stacked: true,
      stackType: `100%`
    },
    plotOptions: {
      bar: {
        horizontal: true,
      },
    },
    colors: ['#E74C3C', '#D3D3D3'],
    stroke: {
      show: false
    },
    title: {
      show: false
    },
    xaxis: {
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
    dataLabels: {
      maxItems: 1
    },
    tooltip: {
      show: false
    },
    legend: {
      show: false,
    },
  }
  if (physicalserverchart[chartId]) {
    physicalserverchart[chartId].updateSeries(SeriesRender);
    //physicalserverchart[chartId].highlightSeries("Used");
  } else {
    ChartElem.innerHTML = '';
    var chart = new ApexCharts(ChartElem, commonOptions);
    chart.render();
    chart.highlightSeries('Used');
    physicalserverchart[chartId] = chart;
  }
  TextElem.innerHTML = `${UsedText}/${TotalText}`;
}
async function updateServerRam(tank, serverId) {
  const LineChartId = `${tank}-${serverId}_RamUsageLineChart`;
  const Chart = document.getElementById(LineChartId);
  const RawRamData = await fetchRamPhysicalServer(tank, serverId);
  const FilterRamData = await filterByInterval(RawRamData, Timegap);
  //const RamText = document.getElementById(`${tank}_${serverId}_title_ram_text`);
  let dataSeries = [];
  let RenderCategories = [];
  for (const a of FilterRamData) {
    dataSeries.push(a["used_ram"]);
    const TimeUST = a[`Timestamp`];
    const dateUST = new Date(TimeUST);
    const time = dateUST.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const date = dateUST.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    RenderCategories.push(`${date} ${time}`);
  }
  let RenderSeries = [{ name: "Used_Ram", data: dataSeries }];
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
      // sparkline: {
      //   enabled: true
      // },
      // --- NEW: Add dataPointSelection event listener ---
      events: {
        dataPointSelection: function (event, chartContext, config) {
          // Check if a valid data point was clicked
          //console.log(`hahahafaseafasfesfaa`);

          if (config.dataPointIndex !== undefined && config.dataPointIndex !== -1) {
            const clickedDataPoint = FilterRamData[config.dataPointIndex];
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
    colors: ['#931616ff'], // A distinct color for the line
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 1 },
    title: { text: `RAM_USAGE`, align: 'left', style: { color: '#CCCCCC' } }, // Light grey title
    legend: {
      show: false,
      // position: 'top',
      // floating: true,
      // itemMargin: { horizontal: 6, vertical: 0 },
      // offsetY: -15,
      // labels: {
      //   colors: '#e3c0c0ff',   // ← Make legend text white
      //   useSeriesColors: false // ← Prevent overriding by series color
      // },
    },
    xaxis: {
      categories: RenderCategories,
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
      labels: {
        formatter: val => formatSizeSync(val),
        style: { colors: '#FFFFFF' } // White labels for dark background
      },
    },
    tooltip: {
      show: false
    }
  };
  if (physicalserverchart[LineChartId]) {
    physicalserverchart[LineChartId].updateOptions(commonOptions);
  } else {
    Chart.innerHTML = '';
    const chart = new ApexCharts(Chart, commonOptions);
    chart.render();
    physicalserverchart[LineChartId] = chart;
  }
}
async function resetChart(tank, server) {
  if (physicalserverchart[`${tank}_${server}_TemperatureLineChart`]) {
    physicalserverchart[`${tank}_${server}_TemperatureLineChart`].destroy();
    delete physicalserverchart[`${tank}_${server}_TemperatureLineChart`];
  }
  if (physicalserverchart[`${tank}-${server}_DiskUsageBarChart`]) {
    physicalserverchart[`${tank}-${server}_DiskUsageBarChart`].destroy();
    delete physicalserverchart[`${tank}-${server}_DiskUsageBarChart`];
  }
  if (physicalserverchart[`${tank}-${server}_RamUsageLineChart`]) {
    physicalserverchart[`${tank}-${server}_RamUsageLineChart`].destroy();
    delete physicalserverchart[`${tank}-${server}_RamUsageLineChart`];
  }
  if (physicalserverchart[`${tank}-${server}_CpUUsageLineChart`]) {
    physicalserverchart[`${tank}-${server}_CpUUsageLineChart`].destroy();
    delete physicalserverchart[`${tank}-${server}_CpUUsageLineChart`];
  }
}
async function updateOverviewPhysicalServer(tank, serverId) {
  const timetext = document.getElementById(`${tank}_${serverId}_stats_Time`);
  const iptext = document.getElementById(`${tank}_${serverId}_stats_IP`);
  const ramtext = document.getElementById(`${tank}_${serverId}_stats_RamUsage`);
  const temptext = document.getElementById(`${tank}_${serverId}_stats_temp`);
  const cputext = document.getElementById(`${tank}_${serverId}_stats_CPUUsage`);
  const disktext = document.getElementById(`${tank}_${serverId}_stats_DiskUsage`);
  const totalstats = await fetchPhysicalServerPickedOverview(tank, serverId);
  console.log(`stats`, totalstats);
  iptext.innerHTML = totalstats["SERVER_IP"];
  const dateUST = new Date(TimePicked);
  const time = dateUST.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const date = dateUST.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
  timetext.innerHTML = `At ${time} on ${date}`;
  temptext.innerHTML = totalstats["temp"];
  await updateColordynamic(temptext, totalstats["temp"]);
  cputext.innerHTML = totalstats["cpu_used"];
  await updateColordynamic(cputext, totalstats["cpu_used"]);
  usedramfiltered = await formatSize(totalstats["used_ram"]);
  totalramfiltered = await formatSize(totalstats["total_ram"]);
  ramtext.innerHTML = `${usedramfiltered}/${totalramfiltered}`;
  ram_percent = ((totalstats["used_ram"] * 1.0) / (totalstats["total_ram"] * 1.0)) * 100.0;
  await updateColordynamic(ramtext, ram_percent);
  used_disk = await formatSize(totalstats["used_disk"]);
  avail_disk = await formatSize(totalstats["avail_disk"]);
  disktext.innerHTML = `${used_disk}/${avail_disk}`;
  disk_percent = (totalstats["used_disk"] / (totalstats["avail_disk"] * 1.0)) * 100.0;
  await updateColordynamic(disktext, disk_percent);
}
async function updateColordynamic(elem, value) {
  if (!elem) {
    console.log("Cannot find Elemt to set color");
    return;
  }
  //elem.style.color = getColor(value);
  elem.style.setProperty("color", getColor(value), "important");
}
async function updateServerTemp(tank, serverId) {
  const LineChartId = `${tank}_${serverId}_TemperatureLineChart`;
  // if (physicalserverchart[LineChartId]) {
  //   physicalserverchart[LineChartId].destroy();
  //   delete physicalserverchart[LineChartId];
  // }
  const Chart = document.getElementById(`${LineChartId}`);
  const TemperatureData = await fetchPhysicaltemp(tank, serverId);
  let RenderCategories = [];
  let RenderSeries = [];
  const oneTime = TemperatureData[0].data;
  const filterData = await filterByInterval(oneTime, Timegap);
  for (const t of filterData) {
    const TimeUST = t[`Timestamp`];
    const dateUST = new Date(TimeUST);
    const time = dateUST.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const date = dateUST.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    RenderCategories.push(`${date} ${time}`);
  }
  for (const NameAndData of TemperatureData) {
    let DataRender = [];
    let CookedData = await filterByInterval(NameAndData.data, Timegap);
    for (const a of CookedData) {
      DataRender.push(a.temperature_celsius);
    }
    RenderSeries.push({ name: `${NameAndData.adapter}_${NameAndData.core}`, data: DataRender });
  }
  const generateColor = (index) => {
    // Large hue step to jump across the color wheel
    // This will hit reds, blues, greens, purples more directly
    const hueStep = 90; // Much larger jump: 0, 90, 180, 270, 360 (wraps to 0)
    const baseHue = 10; // Start slightly off pure red to get more vibrant first colors

    // Vary saturation and/or lightness for added distinctness,
    // making sure they don't flatten the colors.
    const saturation = 75 - (index % 3 * 5); // 75, 70, 65, 75, ...
    const lightness = 55 + (index % 2 * 5);  // 55, 60, 55, 60, ...

    const hue = (baseHue + index * hueStep) % 360;

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  // Example (hueStep=35, saturation/lightness variations):
  // index 0: hsl(0, 75%, 65%) - Red, slightly more saturated, lighter
  // index 1: hsl(35, 65%, 55%) - Orange-Red, less saturated, darker
  // index 2: hsl(70, 75%, 55%) - Yellow-Orange, more saturated, darker
  // index 3: hsl(105, 65%, 65%) - Green-Yellow, less saturated, lighter
  const seriesCount = RenderSeries.length;
  const colorsRender = Array.from({ length: seriesCount }, (_, i) => generateColor(i));
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
      // sparkline: {
      //   enabled: true
      // },
      // --- NEW: Add dataPointSelection event listener ---
      events: {
        dataPointSelection: function (event, chartContext, config) {
          // Check if a valid data point was clicked
          //console.log(`hahahafaseafasfesfaa`);

          if (config.dataPointIndex !== undefined && config.dataPointIndex !== -1) {
            const clickedDataPoint = filterData[config.dataPointIndex];
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
    colors: colorsRender, // A distinct color for the line
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 1 },
    title: { text: `Temperature`, align: 'left', style: { color: '#CCCCCC' } }, // Light grey title
    legend: {
      show: true,
      position: 'top',
      floating: true,
      itemMargin: { horizontal: 6, vertical: 0 },
      offsetY: -15,
      labels: {
        colors: '#e3c0c0ff',   // ← Make legend text white
        useSeriesColors: false // ← Prevent overriding by series color
      },
    },
    xaxis: {
      categories: RenderCategories,
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
      labels: {
        formatter: val => `${val.toFixed(1)} °C`,
        style: { colors: '#da1e1eff' } // White labels for dark background
      },

    },
    tooltip: {
      intersect: true,
      shared: false,
      enabled: true,
      y: { formatter: val => `${val.toFixed(1)} °C` },
      theme: 'dark' // Ensure tooltip is dark theme compatible
    }
  };
  if (physicalserverchart[LineChartId]) {
    physicalserverchart[LineChartId].updateOptions(commonOptions);
  } else {
    Chart.innerHTML = '';
    const chart = new ApexCharts(Chart, commonOptions);
    chart.render();
    physicalserverchart[LineChartId] = chart;
  }
}