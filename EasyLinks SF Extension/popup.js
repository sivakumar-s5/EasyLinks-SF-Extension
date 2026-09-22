const validHostSuffixes = [
    ".salesforce.com",
    ".salesforce-setup.com",
    ".force.com",
    ".cloudforce.com",
    ".visualforce.com"
];

// Static inline SVGs (no user data) for list item controls
const DRAG_ICON = '<svg width="10" height="14" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true"><circle cx="3" cy="3" r="1.5"/><circle cx="7" cy="3" r="1.5"/><circle cx="3" cy="8" r="1.5"/><circle cx="7" cy="8" r="1.5"/><circle cx="3" cy="13" r="1.5"/><circle cx="7" cy="13" r="1.5"/></svg>';
const CLOSE_ICON = '<svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

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
    showPageHint();
});

// Show which page will be saved, or a nudge if not on Salesforce
function showPageHint() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const hintEl = document.getElementById("pageHint");
        const input = document.getElementById("linkTitle");
        const url = tabs[0]?.url;

        if (!url || !isValidSalesforceUrl(url)) {
            hintEl.textContent = "Open a Salesforce page to save it";
            input.disabled = true;
            document.getElementById("addLink").disabled = true;
            return;
        }

        const { hostname, pathname } = new URL(url);
        hintEl.textContent = hostname + pathname;
        hintEl.title = url;
        input.focus();
    });
}

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

        document.getElementById("linkCount").textContent = savedLinks.length || "";
        document.getElementById("emptyState").hidden = savedLinks.length > 0;

        savedLinks.forEach((link) => {
            const li = document.createElement("li");
            li.setAttribute("draggable", "true");
            li.dataset.id = link.id;
            li.classList.add("draggable-item");

            const handle = document.createElement("span");
            handle.classList.add("drag-handle");
            handle.setAttribute("aria-hidden", "true");
            handle.innerHTML = DRAG_ICON;

            const text = document.createElement("span");
            text.classList.add("link-text");

            const titleEl = document.createElement("span");
            titleEl.classList.add("link-title");
            titleEl.textContent = link.title;

            const pathEl = document.createElement("span");
            pathEl.classList.add("link-path");
            pathEl.textContent = link.path || link.url || "";
            pathEl.title = pathEl.textContent;

            text.append(titleEl, pathEl);

            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.classList.add("remove-btn");
            removeBtn.title = `Remove "${link.title}"`;
            removeBtn.setAttribute("aria-label", `Remove ${link.title}`);
            removeBtn.innerHTML = CLOSE_ICON;
            removeBtn.addEventListener("click", () => removeLink(link.id));

            li.append(handle, text, removeBtn);
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
            event.target.classList.add("dragging");
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
            draggedItem.classList.remove("dragging");
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
let statusTimer = null;
function showMessage(text, color) {
    const statusEl = document.getElementById("status");
    statusEl.textContent = text;
    statusEl.classList.toggle("ok", color === "green");
    statusEl.classList.toggle("err", color === "red");
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
        statusEl.textContent = "";
    }, 3000);
}
