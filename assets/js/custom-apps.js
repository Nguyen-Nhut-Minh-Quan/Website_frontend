$(async function () {
  console.log(API_BASE_URL);
  console.log(CurrentTank);
  await loadTankMenu(CurrentTank);
  await RunSideBar();
  // Centralized click listener for menu items (the 'box' part)
  $('body').on('click', '.menu-link div[data-type]', async function (e) {
    e.stopPropagation(); // Prevent the click from bubbling up and triggering the menu-toggle for parent <a>
    const $this = $(this);
    const type = $this.data('type');
    const id = $this.attr('id');
    // Remove active class from all menu items
    $('.menu-item').removeClass('active open'); // Also remove 'open'
    // Add active class to the clicked item's parent .menu-item
    $this.closest('.menu-item').addClass('active open'); // Add 'open'
    // For deeper levels, also ensure parent menu-items are active/open
    $this.parents('.menu-item.has-submenu').addClass('active open');
    // Based on the type, load the appropriate content
    switch (type) {
      case 'server':
        await StopUpdateTank();
        const temp = id.split('_');
        const tank_char = temp[0];
        CurrentTank = tank_char.split('-')[1];
        CurrentPhysicalServer = temp[1];
        console.log("Start loading Server Menu");
        await loadServerMenu(CurrentTank, CurrentPhysicalServer);
        physicalserverUpdateInterval = null;
        clearInterval(diskUpdateInterval);
        clearInterval(tankUpdateInterval);
        break;
      case 'virtual-server':
        await StopUpdateTank();
        const dum = id.split('_');
        CurrentTank = dum[1];
        CurrentPhysicalServer = dum[2];
        CurrentVirtualServer = dum[0];
        allVirtualServers = [];
        console.log("Before Loading Page: ", CurrentVirtualServer);
        clearInterval(physicalserverUpdateInterval);
        clearInterval(tankUpdateInterval);
        await fetchVirtualServerList(CurrentTank, CurrentPhysicalServer);
        await loadVirtualServerMenu(CurrentVirtualServer);
        break;
      default:
        console.log("Start loading Tank Menu");
        CurrentTank = id;
        loadTankMenu(id);
        break;
    }
  });

  // Click listener for physical server links in the toolbar
  $('body').on('click', '.server-toolbar-link', async function (e) {
    e.preventDefault();

    const serverId = $this.attr('id');                    // Get the ID directly
    const escapedId = CSS.escape(serverId);       // Escape for jQuery selector safety

    // Clear current selections
    $('.menu-item').removeClass('active open');

    // Find the corresponding sidebar server item
    const $sidebarServerItem = $(`#layout-menu .menu-link div[data-type="server"]#${escapedId}`).closest('.menu-item');

    // Activate and expand it
    $sidebarServerItem.addClass('active open');
    $sidebarServerItem.parents('.menu-item.has-submenu').addClass('active open');
  });


  // NEW: Click listener for virtual server links in the toolbar
  $('body').on('click', '.virtual-server-toolbar-link', async function (e) {
    e.preventDefault(); // Prevent default link behavior
    const virtualServerId = $this.attr('id');

    // Remove active class from all menu items in sidebar
    $('.menu-item').removeClass('active open');
    const escapedVirtualId = CSS.escape(virtualServerId);
    // Find the corresponding virtual server in the sidebar and make it active/open
    const $sidebarVirtualItem = $(`#layout-menu .menu-link div[data-type="virtual-server"]#${escapedVirtualId}`).closest('.menu-item');
    $sidebarVirtualItem.addClass('active open');
    // Also ensure its parent physical server and tank are open
    $sidebarVirtualItem.parents('.menu-item.has-submenu').addClass('active open');

    //loadVirtualServerMenu(CurrentVirtualServer);
  });


  // --- CONTENT LOADING FUNCTIONS ---

  // Function to populate Physical Server Cards (for a specific Tank)
  // Function to load the Server Menu content (Physical Server)
  // Initial load: Load the Oil Tank 1 menu on page load
  // Simulate a click on "Oil Tank 1" to load its content by default
  setTimeout(() => {
    // Select the div with data-type="tank" and data-id="oil-tank-1" and trigger a click
    $('.menu-link div[data-type="tank"][data-id="oil-tank-1"]').trigger('click');
  }, 100); // Small delay to ensure the DOM is ready and template's menu.js has initialized.

});