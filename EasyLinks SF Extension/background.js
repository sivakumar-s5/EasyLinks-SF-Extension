const validUrlPatterns = [
  "https://*.salesforce.com/*",
  "https://*.salesforce-setup.com/*",
  "https://*.force.com/*",
  "https://*.lightning.force.com/*",
  "https://*.cloudforce.com/*",
  "https://*.visualforce.com/*"
];

const menuItems = [
  { id: "openDevConsole", title: "Developer Console", path: "/_ui/common/apex/debug/ApexCSIPage" },
  { id: "openSetup", title: "Setup", path: "/lightning/setup/SetupOneHome/home" },
  { id: "openObjectManager", title: "Object Manager", path: "/lightning/setup/ObjectManager/home" },
  { id: "openFlows", title: "Flows", path: "/lightning/setup/Flows/home" },
  { id: "openProfiles", title: "Profiles", path: "/lightning/setup/EnhancedProfiles/home" },
  { id: "openUsers", title: "Users", path: "/lightning/setup/ManageUsers/home" },
  { id: "openHome", title: "Home", path: "/lightning/page/home" },
  { id: "logout", title: "Log Out", path: "/secur/logout.jsp" }
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "openMenu",
    title: "EasyLinks SF",
    contexts: ["all"],
    documentUrlPatterns: validUrlPatterns
  });

  menuItems.forEach(({ id, title }) => {
    chrome.contextMenus.create({
      id,
      title,
      parentId: "openMenu",
      contexts: ["all"],
      documentUrlPatterns: validUrlPatterns
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.url) return;

  try {
    const baseUrl = new URL(tab.url).origin;
    const selectedItem = menuItems.find(item => item.id === info.menuItemId);

    if (selectedItem) {
      chrome.tabs.create({ url: baseUrl + selectedItem.path });
    } else {
      // Open dynamically added links
      chrome.storage.local.get("savedLinks", (data) => {
        const savedLink = data.savedLinks?.find(link => link.id === info.menuItemId);
        if (savedLink) {
          chrome.tabs.create({ url: savedLink.url });
        }
      });
    }
  } catch (error) {
    console.error("Error handling menu item click:", error);
  }
});
