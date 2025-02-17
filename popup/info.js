browser.runtime.sendMessage({ action: "getText" }).then(response => {
    if (response && response.text) {
        document.getElementById("selected-text").textContent = response.text;
        document.getElementById("reading").textContent = response.re;
        document.getElementById("meaning").textContent = response.meaning;
        document.getElementById("tag").textContent = response.pos;
    } else {
        document.getElementById("selected-text").textContent = "";
    }
}).catch(error => console.error("Error retrieving text:", error));
