// This script runs when the popup is opened.

const resultsContainer = document.getElementById('results-container');
const statusElement = document.getElementById('status');
let emailCount = 0;

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "addResult") {
        displayResult(request.data);
    }
    if (request.action === "scanComplete") {
        statusElement.textContent = `Scan complete! Analyzed ${emailCount} emails.`;
    }
});

function displayResult(result) {
    emailCount++;
    statusElement.textContent = `Scanning... (${emailCount}/15)`;

    const card = document.createElement('div');
    card.className = 'result-card';

    const score = result.analysis.score;
    if (score > 75) {
        card.classList.add('dangerous');
    } else if (score > 40) {
        card.classList.add('suspicious');
    } else {
        card.classList.add('safe');
    }

    card.innerHTML = `
        <p class="subject">${result.subject}</p>
        <p><strong>From:</strong> ${result.from}</p>
        <p class="score">Phishing Score: ${score}</p>
        <p><strong>Reason:</strong> ${result.analysis.reason}</p>
    `;

    // Add the new card to the top of the list
    resultsContainer.prepend(card);
}

// When the popup opens, immediately send a message to the background script to start the scan
document.addEventListener('DOMContentLoaded', () => {
    chrome.runtime.sendMessage({ action: "startScan" });
});