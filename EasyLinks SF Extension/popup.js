const validHostSuffixes = [
    ".salesforce.com",
    ".salesforce-setup.com",
    ".force.com",
    ".cloudforce.com",
    ".visualforce.com"
];

function isValidSalesforceUrl(url) {
    try {
        const { protocol, hostname } = new URL(url);
        return protocol === "https:" && validHostSuffixes.some(suffix => hostname.endsWith(suffix));
    } catch {
        return false;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadSavedLinks();
});

document.getElementById("addLinkForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const titleInput = document.getElementById("linkTitle");
    const title = titleInput.value.trim();

    if (!title) {
        showMessage("Title is required!", "red");
        return;
    }

    // Get the current active tab's URL and store its path (incl. query string)
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        if (!currentTab?.url || !isValidSalesforceUrl(currentTab.url)) {
            showMessage("Open a Salesforce page first!", "red");
            return;
        }

        const url = new URL(currentTab.url);
        const customPath = url.pathname + url.search;

        chrome.runtime.sendMessage({ action: "addLink", title, path: customPath }, (response) => {
            if (response?.success) {
                titleInput.value = "";
                showMessage("Link added!", "green");
                loadSavedLinks();
            } else {
                showMessage(response?.message || chrome.runtime.lastError?.message || "Error adding link.", "red");
            }
        });
    });
});

// Load and Display Saved Links
function loadSavedLinks() {
    chrome.storage.local.get("savedLinks", (data) => {
        const savedLinks = data.savedLinks || [];
        const listEl = document.getElementById("savedLinksList");
        listEl.replaceChildren();

        savedLinks.forEach((link) => {
            const li = document.createElement("li");
            li.setAttribute("draggable", "true");
            li.dataset.id = link.id;
            li.classList.add("draggable-item");

            const titleEl = document.createElement("span");
            titleEl.textContent = link.title;

            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.classList.add("remove-btn");
            removeBtn.dataset.id = link.id;
            removeBtn.textContent = "❌";
            removeBtn.addEventListener("click", () => removeLink(link.id));

            li.append(titleEl, removeBtn);
            listEl.appendChild(li);
        });

        addDragAndDropEvents();
    });
}

// Add drag-and-drop functionality
function addDragAndDropEvents() {
    const listEl = document.getElementById("savedLinksList");
    let draggedItem = null;
    let originalOrder = [];

    document.querySelectorAll(".draggable-item").forEach(item => {
        item.addEventListener("dragstart", (event) => {
            draggedItem = event.target;
            originalOrder = Array.from(listEl.children).map(el => el.dataset.id);
            event.target.style.opacity = "0.5";
        });

        item.addEventListener("dragover", (event) => {
            event.preventDefault();
            const draggingOver = event.target.closest(".draggable-item");
            if (draggingOver && draggingOver !== draggedItem) {
                const bounding = draggingOver.getBoundingClientRect();
                const offset = bounding.y + bounding.height / 2;
                if (event.clientY < offset) {
                    listEl.insertBefore(draggedItem, draggingOver);
                } else {
                    listEl.insertBefore(draggedItem, draggingOver.nextSibling);
                }
            }
        });

        item.addEventListener("dragend", () => {
            draggedItem.style.opacity = "1";
            const newOrder = Array.from(listEl.children).map(el => el.dataset.id);
            // Only persist when the order actually changed
            if (newOrder.some((id, i) => id !== originalOrder[i])) {
                saveNewOrder(newOrder);
            }
        });
    });
}

// Save new order to storage and update context menu
function saveNewOrder(newOrder) {
    chrome.storage.local.get("savedLinks", (data) => {
        const savedLinksMap = new Map((data.savedLinks || []).map(link => [link.id, link]));
        const updatedLinks = newOrder.map(id => savedLinksMap.get(id)).filter(Boolean);

        chrome.storage.local.set({ savedLinks: updatedLinks }, () => {
            chrome.runtime.sendMessage({ action: "updateContextMenu" });
        });
    });
}

// Remove a Link
function removeLink(linkId) {
    chrome.runtime.sendMessage({ action: "removeLink", id: linkId }, (response) => {
        if (response?.success) {
            showMessage("Link removed!", "green");
            loadSavedLinks();
        } else {
            showMessage(response?.message || chrome.runtime.lastError?.message || "Error removing link.", "red");
        }
    });
}

// Utility Function to Show Messages
function showMessage(text, color) {
    const statusEl = document.getElementById("status");
    statusEl.textContent = text;
    statusEl.style.color = color;
    setTimeout(() => {
        statusEl.textContent = "";
    }, 3000);
}
