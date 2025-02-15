browser.runtime.sendMessage({ action: "getText" }).then(response => {
    if (response && response.text) {
        document.getElementById("selected-text").textContent = response.text;
    } else {
        document.getElementById("selected-text").textContent = "";
    }
}).catch(error => console.error("Error retrieving text:", error));
