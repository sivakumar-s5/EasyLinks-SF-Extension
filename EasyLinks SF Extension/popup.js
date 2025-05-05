document.addEventListener("DOMContentLoaded", () => {
    loadSavedLinks();
});

document.getElementById("addLink").addEventListener("click", () => {
    const title = document.getElementById("linkTitle").value;
    
    if (!title.trim()) {
        showMessage("Title is required!", "red");
        return;
    }

    // Get the current active tab's full URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs.length) {
            showMessage("No active tab found!", "red");
            return;
        }

        const currentTab = tabs[0];
        const url = new URL(currentTab.url);
        const customPath = url.pathname; // Capture base URL + pathname

        chrome.runtime.sendMessage({ action: "addLink", title, path: customPath }, (response) => {
            if (response.success) {
                showMessage("Link added!", "green");
                loadSavedLinks();
            } else {
                showMessage(response.message || "Error adding link.", "red");
            }
        });
    });
});

// Load and Display Saved Links
function loadSavedLinks() {

        // Get the current active tab's full URL
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs.length) {
                showMessage("No active tab found!", "red");
                return;
            }
    
            const currentTab = tabs[0];
            const baseUrl = new URL(currentTab.url).origin;

            chrome.storage.local.get("savedLinks", (data) => {
                const savedLinks = data.savedLinks || [];
                const listEl = document.getElementById("savedLinksList");
                listEl.innerHTML = "";
        
                savedLinks.forEach((link, index) => {
                    const li = document.createElement("li");
                    li.setAttribute("draggable", "true");
                    li.setAttribute("data-id", link.id);
                    li.classList.add("draggable-item");
                    li.innerHTML = `
                        <span>${link.title}</span>
                        <button class="remove-btn" data-id="${link.id}">❌</button>
                    `;
                    listEl.appendChild(li);
                });
        
                addDragAndDropEvents();
                
                document.querySelectorAll(".remove-btn").forEach(btn => {
                    btn.addEventListener("click", (event) => {
                        const linkId = event.target.getAttribute("data-id");
                        removeLink(linkId);
                    });
                });
            });

        });
}

// Add drag-and-drop functionality
function addDragAndDropEvents() {
    const listEl = document.getElementById("savedLinksList");
    let draggedItem = null;

    document.querySelectorAll(".draggable-item").forEach(item => {
        item.addEventListener("dragstart", (event) => {
            draggedItem = event.target;
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
            saveNewOrder();
        });
    });
}

// Save new order to storage and update context menu
function saveNewOrder() {
    const listEl = document.getElementById("savedLinksList");
    const newOrder = Array.from(listEl.children).map(item => ({
        id: item.getAttribute("data-id"),
        title: item.querySelector("span").textContent
    }));

    chrome.storage.local.get("savedLinks", (data) => {
        const savedLinksMap = new Map(data.savedLinks.map(link => [link.id, link]));
        const updatedLinks = newOrder.map(item => savedLinksMap.get(item.id));

        chrome.storage.local.set({ savedLinks: updatedLinks }, () => {
            chrome.runtime.sendMessage({ action: "updateContextMenu" });
        });
    });
}

// Remove a Link
function removeLink(linkId) {
    chrome.runtime.sendMessage({ action: "removeLink", id: linkId }, (response) => {
        if (response.success) {
            showMessage("Link removed!", "green");
            loadSavedLinks();
        } else {
            showMessage(response.message || "Error removing link.", "red");
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
