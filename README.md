# AI Phishing Detector

A Chrome extension (Manifest V3) that scans your most recent Gmail messages
and uses Google's Gemini model to flag likely phishing attempts, with a score
and a short explanation for each email.

## How it works

1. Opening the popup starts a scan.
2. The background service worker gets an OAuth token through `chrome.identity`
   (read-only Gmail scope: `gmail.readonly`).
3. It fetches the 15 most recent messages from the Gmail API and extracts the
   sender, subject and snippet of each.
4. Each email is sent to Gemini (`gemini-2.5-flash`) with a prompt that asks for
   a strict JSON verdict: `isPhishing`, `score` (0-100) and `reason`. The prompt
   tells the model to avoid false positives unless it is quite certain.
5. Results stream back to the popup as they finish and are colour-coded:
   - **Dangerous:** score above 75
   - **Suspicious:** score above 40
   - **Safe:** everything else

## Tech

JavaScript, Chrome Extension APIs (MV3 service worker, `identity`, runtime
messaging), Gmail REST API, Google Gemini API.

## Setup

1. Clone the repo.
2. Create a Gemini API key and set `API_KEY` in `background.js`.
3. Replace `oauth2.client_id` in `manifest.json` with your own Google OAuth
   client ID (Chrome extension type) that has the Gmail API enabled.
4. Open `chrome://extensions`, enable **Developer mode**, click
   **Load unpacked** and select this folder.
5. Click the extension icon to scan your inbox.

## Limitations and next steps

- Only the Gmail snippet is analysed, not the full body, headers or links.
- Scans a fixed 15 messages and doesn't cache results.
- The API key lives in the extension source. A proxy backend would keep it
  out of the client.
- Email text is rendered in the popup with `innerHTML`; it should be switched
  to `textContent` so untrusted email content can't inject markup.
