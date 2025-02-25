document.addEventListener("DOMContentLoaded", () => {
    loadSavedLinks();
});

document.getElementById("addLink").addEventListener("click", () => {
    const title = document.getElementById("linkTitle").value;
    
    if (!title.trim()) {
        showMessage("Title is required!", "red");
        return;
    }

    chrome.runtime.sendMessage({ action: "addLink", title, url: "#" }, (response) => {
        if (response.success) {
            showMessage("Link added!", "green");
            loadSavedLinks();
        } else {
            showMessage(response.message || "Error adding link.", "red");
        }
    });
});

// Load and Display Saved Links
function loadSavedLinks() {
    chrome.storage.local.get("savedLinks", (data) => {
        const savedLinks = data.savedLinks || [];
        const listEl = document.getElementById("savedLinksList");
        listEl.innerHTML = "";

        savedLinks.forEach((link) => {
            const li = document.createElement("li");
            li.innerHTML = `
                <span>${link.title}</span>
                <button class="remove-btn" data-id="${link.id}">❌</button>
            `;
            listEl.appendChild(li);
        });

        document.querySelectorAll(".remove-btn").forEach(btn => {
            btn.addEventListener("click", (event) => {
                const linkId = event.target.getAttribute("data-id");
                removeLink(linkId);
            });
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
