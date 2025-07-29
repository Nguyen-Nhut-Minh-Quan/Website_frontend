
function handleTab() {
    // --- Helper function to get the currently selected global date ---
    function getGlobalSelectedDate(ChosenDate) {
        const globalDatePicker = document.getElementById(ChosenDate);
        // Ensure globalDatePicker exists before trying to get its value
        return globalDatePicker ? globalDatePicker.value : null;
    }

    // --- Centralized function to activate a tab and render its charts ---
    // This function now takes the tabText (e.g., 'Disk Monitor') and calls the appropriate init function with the date
    function activateAndRenderTabCharts(tabText) {
        const RamcurrentDate = getGlobalSelectedDate('RamDatePicker'); // Get the date from the global picker
        const TempcurrentDate = getGlobalSelectedDate('TempDatePicker');
        const UsagecurrentDate = getGlobalSelectedDate('UsageDatePicker');
        // Stop all existing intervals first to prevent conflicts
        // Ensure these stop functions are globally accessible or defined here if they aren't
        if (typeof stopDiskUpdates === 'function') stopDiskUpdates();
        if (typeof stopRamUpdates === 'function') stopRamUpdates();
        if (typeof stopCpuUpdates === 'function') stopCpuUpdates();
        if (typeof stopCpuUsage === 'function') stopCpuUsage(); // Assuming this is your CPU Usage stop function

        // Call the specific initialization function for the active tab, passing the date
        if (tabText === 'Disk Monitor') {
            if (typeof initializeDiskStats === 'function') {
                initializeDiskStats();
            }
        } else if (tabText === 'RAM Usage') {
            if (typeof initializeRamStats === 'function') {
                initializeRamStats(RamcurrentDate);
            }
        } else if (tabText === 'CPU Monitor') { // Assuming this is for CPU Temperature
            if (typeof initializeCpuStats === 'function') {
                initializeCpuStats(TempcurrentDate);
            }
        } else if (tabText === 'CPU Usage') {
            if (typeof intializeCpuUsage === 'function') { // Using your original function name 'intializeCpuUsage'
                intializeCpuUsage(UsagecurrentDate);
            }
        }
    }
    document.addEventListener('DOMContentLoaded', () => {
        for (elem of Elements_need_time) {
            const globalDatePicker = document.getElementById(`${elem}DatePicker`);
            const today = new Date();
            const formattedToday = today.toISOString().split('T')[0]; //IFORNIA-MM-DD

            // Initialize date picker value from localStorage or to today's date
            let selectedDate = localStorage.getItem(`${elem}DatePicker`) || formattedToday;
            if (globalDatePicker) {
                globalDatePicker.value = selectedDate;

            } else {
                console.error("Global Date Picker element not found! Ensure the HTML for #globalDatePicker is present.");
                // Don't return, as other parts of the script might still function
            }

            // --- Event Listener for globalDatePicker change ---
            if (globalDatePicker) { // Only attach if the element exists
                globalDatePicker.addEventListener('change', () => {
                    const newDate = globalDatePicker.value;
                    localStorage.setItem(`${elem}DatePicker`, newDate); // Store the selected date

                    // Find the currently active tab link and trigger its rendering
                    const activeMenuItem = document.querySelector('.menu-item.active');
                    const activeCustomTabLink = activeMenuItem ? activeMenuItem.querySelector('.custom-tab-link') : null;

                    // If the active link is found, simulate a click on it to re-render the current tab with the new date
                    if (activeCustomTabLink) {
                        // Use a small timeout to ensure the DOM is ready for re-rendering if needed
                        setTimeout(() => {
                            activeCustomTabLink.click();
                        }, 50); // Small delay to allow browser to process
                    }
                });
            }
        }

        // --- Existing .custom-tab-link click listener (original code, but calls new function) ---
        document.querySelectorAll('.custom-tab-link').forEach(tab => {
            tab.addEventListener('click', function (event) {
                event.preventDefault();

                // Remove 'active' from all menu items and tab panes
                document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('show', 'active'));

                // Add 'active' to the clicked menu item
                this.closest('.menu-item').classList.add('active');

                // Show the corresponding tab pane
                const targetTabPaneId = this.getAttribute('href').substring(1);
                document.getElementById(targetTabPaneId).classList.add('show', 'active');

                const tabText = this.querySelector('div[data-i18n]').textContent;
                activateAndRenderTabCharts(tabText); // Use the new centralized function
            });
        });

        // --- Existing DOMContentLoaded initial tab activation (original code, but calls new function) ---
        // This runs once when the page loads to activate the default tab
        const diskMonitorTab = document.getElementById('disk-monitor-tab');
        const ramUsageTab = document.getElementById('ram-usage-tab');
        const cpuMonitorTab = document.getElementById('cpu-monitor-tab');
        const cpuUsageTab = document.getElementById('cpu-usage-tab');

        // Find the initially active tab and click it to trigger its full initialization
        let initiallyActiveTabLink = null;
        if (diskMonitorTab && diskMonitorTab.closest('.menu-item').classList.contains('active')) {
            initiallyActiveTabLink = diskMonitorTab;
        } else if (ramUsageTab && ramUsageTab.closest('.menu-item').classList.contains('active')) {
            initiallyActiveTabLink = ramUsageTab;
        } else if (cpuMonitorTab && cpuMonitorTab.closest('.menu-item').classList.contains('active')) {
            initiallyActiveTabLink = cpuMonitorTab;
        } else if (cpuUsageTab && cpuUsageTab.closest('.menu-item').classList.contains('active')) {
            initiallyActiveTabLink = cpuUsageTab;
        }

        if (initiallyActiveTabLink) {
            // Use a small timeout to ensure all DOM elements are fully rendered before clicking
            setTimeout(() => {
                initiallyActiveTabLink.click();
            }, 100);
        } else {
            console.warn("No initially active tab found. Consider adding 'active' class to a default menu item.");
            // Fallback: If no tab is explicitly active, activate the first one (e.g., Disk Monitor)
            // if (diskMonitorTab) {
            //     setTimeout(() => { diskMonitorTab.click(); }, 100);
            // }
        }
    });
}