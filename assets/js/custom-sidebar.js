async function RunSideBar() {
    console.log("check");
    await fetchtanklist();
    let sidebar = document.getElementById("side-bar");
    if (!sidebar) {
        throw new Error(`Cannot find the sidebar element`);
    }
    if (tankList.length > 0) {
        for (const tank of tankList) {
            let oneTank = document.createElement('li');
            oneTank.className = 'menu-item has-submenu active';
            oneTank.innerHTML = `<a href="javascript:void(0);" class="menu-link menu-toggle" on>
              <div data-type="tank" id="${tank}">Oil tank ${tank}</div>
            </a>
            <ul class = "menu-sub" id = "submenu_tank-${tank}"> </ul>`
            sidebar.appendChild(oneTank);
            await populateServerSidebar(tank);
        }
    }
    else {
        throw new Error('Cannot find any tanks value');
    }
}
async function populateServerSidebar(tank) {
    await fetchServerList(tank);
    let SelectedTank = document.getElementById(`submenu_tank-${tank}`);
    if (!SelectedTank) {
        throw new Error("Cannot find html id of the tank");
    }
    if (serverList.length <= 0) {
        throw new Error(`The Server Array is having some error`);
    }
    //console.log(serverList);
    for (const server of serverList) {
        //console.log(server);
        let oneServer = document.createElement('li');
        oneServer.id = `menu-tank-${server.TANK_ID}`
        oneServer.className = "menu-item has-submenu";
        oneServer.innerHTML = `<a href="javascript:void(0);" class="menu-link menu-toggle">
                  <div data-type="server" id="tank-${server.TANK_ID}_${server.SERVER_ID}">${server.SERVER_ID}</div>
                </a>`;
        let VirtualList = document.createElement('ul');
        VirtualList.className = 'menu-sub';
        VirtualList.id = `virtual-menu-tank-${server.TANK_ID}-${server.SERVER_ID}`;
        oneServer.appendChild(VirtualList);
        SelectedTank.appendChild(oneServer);
        await populateVirtualServerSidebar(server.TANK_ID, server.SERVER_ID);
    };

}
async function populateVirtualServerSidebar(tank, serverId) {
    const VirtualElem = document.getElementById(`virtual-menu-tank-${tank}-${serverId}`);
    if (!VirtualElem) {
        throw new Error('Cannot Find the Virtual menu');
    }
    VirtualElem.innerHTML = '';

    // Find the submenu for the given physical server
    const $serverMenuSub = $(`#layout-menu .menu-link div[data-type="server"][id="tank-${tank}_${serverId}"]`)
        .closest('.menu-item')
        .children('.menu-sub');
    // Make sure the submenu is empty of any "No virtual servers found" messages or old dynamic content
    // but DO NOT clear the pre-defined static list items if they exist.
    // We only remove dynamically added "no items" messages if any.
    $serverMenuSub.find('.text-muted').remove(); // Remove 'No virtual servers found' placeholder if it exists
    try {
        if (allVirtualServers.length === 0) {
            await fetchVirtualServerList(tank, serverId);
        }
        /**
         * Create HTML element dynamically based on Virtual ServerList
         */
        if (allVirtualServers.length > 0) {
            for (let i = 0; i < allVirtualServers.length; i++) {
                //console.log(i);
                const temp = allVirtualServers[i];
                let OneVirtualServer = document.createElement('li');
                OneVirtualServer.id = `box_virtual-server-${temp.SERVER_VIRTUAL_NAME}-tank-${temp.TANK_NUM}-${temp.SERVER_NUM}`;
                OneVirtualServer.className = "menu-item";
                OneVirtualServer.innerHTML = `
                    <a href="javascript:void(0);" class="menu-link menu-item-content">
                      <div data-type="virtual-server" id="${temp.SERVER_VIRTUAL_NAME}_${temp.TANK_NUM}_${temp.SERVER_NUM}" data-name="Virtual Server ${temp.SERVER_VIRTUAL_NAME}">${temp.SERVER_VIRTUAL_NAME}</div>
                    </a> `;
                VirtualElem.appendChild(OneVirtualServer);
            }
        } else {
            // If no virtual servers are returned, hide all existing virtual server list items
            VirtualElem.append('<li class="menu-item"><div class="menu-link text-muted">No virtual servers found.</div></li>');
        }
    } catch (error) {
        console.error(`Error populating virtual servers for ${serverId}:`, error);
        VirtualElem.append('<li class="menu-item"><div class="menu-link text-danger">Failed to load virtual servers.</div></li>');
    }
}