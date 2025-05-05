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
  { id: "openHome", title: "Home", path: "/lightning/page/home" }
];

// Validate URL against Salesforce domains
function isValidSalesforceUrl(url) {
  return validUrlPatterns.some(pattern => new RegExp(pattern.replace(/\*/g, ".*")).test(url));
}

// Initialize Context Menu on Install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get("savedLinks", (data) => {
    let savedLinks = data.savedLinks || [];

    // Add hardcoded menu items only if they don't exist already
    menuItems.forEach(item => {
      if (!savedLinks.some(link => link.id === item.id)) {
        savedLinks.push({ id: item.id, title: item.title, path: item.path });
      }
    });

    chrome.storage.local.set({ savedLinks }, () => {
      createContextMenu(savedLinks);
    });
  });
});

// Function to Create Context Menu
function createContextMenu(savedLinks) {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "openMenu",
      title: "EasyLinks SF",
      contexts: ["all"],
      documentUrlPatterns: validUrlPatterns
    });

    savedLinks.forEach(({ id, title }) => {
      chrome.contextMenus.create({
        id,
        title,
        parentId: "openMenu",
        contexts: ["all"],
        documentUrlPatterns: validUrlPatterns
      });
    });
  });
}

// Handle Click Events
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.url) return;

  try {
    const baseUrl = new URL(tab.url).origin;
    chrome.storage.local.get("savedLinks", (data) => {
      const selectedItem = data.savedLinks?.find(link => link.id === info.menuItemId);

      if (selectedItem) {
        const url = selectedItem.path ? baseUrl + selectedItem.path : selectedItem.url;
        chrome.tabs.create({ url });
      }
    });
  } catch (error) {
    console.error("Error handling menu item click:", error);
  }
});

// Handle Adding Links
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "addLink") {
    chrome.storage.local.get("savedLinks", (data) => {
      let savedLinks = data.savedLinks || [];
      const newLink = { id: Date.now().toString(), title: message.title, path: message.path };

      savedLinks.push(newLink);
      chrome.storage.local.set({ savedLinks }, () => {
        createContextMenu(savedLinks);
        sendResponse({ success: true });
      });
    });
    return true;
  }
  if (message.action === "removeLink") {
    chrome.storage.local.get("savedLinks", (data) => {
        let savedLinks = data.savedLinks || [];
        const linkToRemove = savedLinks.find(link => link.id === message.id);

        if (!linkToRemove) {
            sendResponse({ success: false, error: "Link not found" });
            return;
        }

        savedLinks = savedLinks.filter(link => link.id !== message.id);

        chrome.storage.local.set({ savedLinks }, () => {
            createContextMenu(savedLinks);
            
            // Check if the menu item exists before removing it
            chrome.contextMenus.remove(message.id, () => {
                if (chrome.runtime.lastError) {
                    console.warn("Menu item not found:", chrome.runtime.lastError);
                }
                sendResponse({ success: true });
            });
        });
    });
    return true;
}

  if (message.action === "updateContextMenu") {
    chrome.storage.local.get("savedLinks", (data) => {
        createContextMenu(data.savedLinks || []);
    });
    return true;
}

  });

