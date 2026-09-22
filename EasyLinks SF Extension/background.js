const validUrlPatterns = [
  "https://*.salesforce.com/*",
  "https://*.salesforce-setup.com/*",
  "https://*.force.com/*",
  "https://*.lightning.force.com/*",
  "https://*.cloudforce.com/*",
  "https://*.visualforce.com/*"
];

// Hostname suffixes derived from validUrlPatterns, used for strict origin checks
const validHostSuffixes = [
  ".salesforce.com",
  ".salesforce-setup.com",
  ".force.com",
  ".cloudforce.com",
  ".visualforce.com"
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

// Validate URL against Salesforce domains (https only, hostname suffix match)
function isValidSalesforceUrl(url) {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && validHostSuffixes.some(suffix => hostname.endsWith(suffix));
  } catch {
    return false;
  }
}

// Merge hardcoded menu items into storage and (re)build the context menu
function initMenus() {
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
}

chrome.runtime.onInstalled.addListener(initMenus);
chrome.runtime.onStartup.addListener(initMenus);

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

//extracting the common logic of opening salesforce link
function openSalesforceLink(tab, menuItemId) {
  if (!tab?.url) return;
  if (!isValidSalesforceUrl(tab.url)) return;

  try {
    const baseUrl = new URL(tab.url).origin;
    const currentGroupId = tab.groupId;

    chrome.storage.local.get("savedLinks", (data) => {
      const selectedItem = data.savedLinks?.find(
        link => link.id === menuItemId
      );

      if (!selectedItem) return;

      const url = selectedItem.path
        ? baseUrl + selectedItem.path
        : selectedItem.url;

      chrome.tabs.create({ url }, (newTab) => {
        if (chrome.runtime.lastError || !newTab) return;

        if (currentGroupId !== -1) {
          chrome.tabs.group({
            tabIds: newTab.id,
            groupId: currentGroupId
          });
        }
      });
    });
  } catch (e) {
    console.error("Error opening Salesforce link:", e);
  }
}

// Handle Click Events
chrome.contextMenus.onClicked.addListener((info, tab) => {
  openSalesforceLink(tab, info.menuItemId);
});

// Handle Hot-key commands
chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs.length) return;

    // command name = menu item id
    openSalesforceLink(tabs[0], command);
  });
});

// Handle Adding / Removing / Reordering Links
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "addLink") {
    chrome.storage.local.get("savedLinks", (data) => {
      let savedLinks = data.savedLinks || [];
      const newLink = { id: crypto.randomUUID(), title: message.title, path: message.path };

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

      if (!savedLinks.some(link => link.id === message.id)) {
        sendResponse({ success: false, message: "Link not found" });
        return;
      }

      savedLinks = savedLinks.filter(link => link.id !== message.id);

      chrome.storage.local.set({ savedLinks }, () => {
        // createContextMenu does removeAll + rebuild, so the item is gone
        createContextMenu(savedLinks);
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (message.action === "updateContextMenu") {
    chrome.storage.local.get("savedLinks", (data) => {
      createContextMenu(data.savedLinks || []);
      sendResponse({ success: true });
    });
    return true;
  }
});
