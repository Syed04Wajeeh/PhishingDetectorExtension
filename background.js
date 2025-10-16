
// Listen for the "startScan" message from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "startScan") {
        scanEmails();
    }
});

async function scanEmails() {
    console.log("Scan initiated from popup.");
    try {
        const token = await getAuthToken();
        await fetchAndAnalyzeEmails(token);
        chrome.runtime.sendMessage({ action: "scanComplete" });
        console.log("Scan process has finished.");
    } catch (error) {
        console.error("A critical error occurred during the scan:", error);
    }
}

// Function to get the authentication token
function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(token);
      }
    });
  });
}

// Function to fetch emails and analyze them one by one
async function fetchAndAnalyzeEmails(token) {
  try {
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
      console.error("Gmail API Error: Could not fetch message list.", await response.json());
      return;
    }

    const data = await response.json();
    if (!data.messages || data.messages.length === 0) {
      console.log("No messages found to analyze.");
      return;
    }

    for (const message of data.messages) {
      const result = await fetchEmailDetailsAndAnalyze(token, message.id);
      if (result) {
        chrome.runtime.sendMessage({ action: "addResult", data: result });
      }
    }
  } catch (error) {
    console.error("Error in fetchAndAnalyzeEmails:", error);
  }
}

// Function to fetch details and return a result object
async function fetchEmailDetailsAndAnalyze(token, messageId) {
  try {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
        console.error(`Could not fetch details for message ${messageId}.`, await response.json());
        return null;
    }

    const emailData = await response.json();
    const headers = emailData.payload.headers;
    const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
    const from = headers.find(h => h.name === 'From')?.value || 'Unknown Sender';
    const snippet = emailData.snippet;
    
    const contentToAnalyze = JSON.stringify({ sender: from, subject: subject, body_snippet: snippet });
    const analysisResult = await analyzeEmailWithGemini(contentToAnalyze);

    if (analysisResult) {
      return { from: from, subject: subject, analysis: analysisResult };
    }
    return null;
  } catch (error) {
    console.error(`Caught error in fetchEmailDetailsAndAnalyze for message ${messageId}:`, error);
    return null;
  }
}

// Function to analyze email content 
async function analyzeEmailWithGemini(emailContent) {
  const API_KEY = ''; 
  //TODO: Add api key here
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
  
  // --- THIS IS YOUR FULL, CORRECT PROMPT ---
  const prompt = `
    You are an advanced phishing and scam detection AI.
    Analyze the following email content and determine if it is a phishing attempt.
    Try to not mark it as phishing unless you are quite certain.
    The content is provided in JSON format.
    
    Email Content: ${emailContent}
    
    Respond with ONLY a JSON object in the following format, with no other text before or after it:
    {
      "isPhishing": boolean,
      "score": number (a score from 0 to 100, where 100 is a definite phishing attempt),
      "reason": "A brief explanation for your decision."
    }
  `;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (!response.ok) {
        console.error("Gemini API Error:", await response.json());
        return null;
    }
    const geminiResponse = await response.json();
    const rawText = geminiResponse.candidates[0].content.parts[0].text;
    const startIndex = rawText.indexOf('{');
    const endIndex = rawText.lastIndexOf('}');
    const jsonString = rawText.substring(startIndex, endIndex + 1);
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Caught error in analyzeEmailWithGemini:", error);
    return null;
  }
}