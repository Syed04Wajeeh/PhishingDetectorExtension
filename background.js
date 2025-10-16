//Function to get the authentication token
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

//Function to fetch email messages using the token
async function fetchEmails(token) {
  //fetch the X most recent emails in the inbox
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    console.error("Failed to fetch message list:", response.statusText);
    return;
  }

  const data = await response.json();
  if (data.messages && data.messages.length > 0) {
    console.log("Successfully fetched email IDs:", data.messages);
    
    //for each message fetch its full content
    data.messages.forEach(async (message) => {
      await fetchEmailDetails(token, message.id);
    });
  }
}

// Function to fetch the full details of a single email
async function fetchEmailDetails(token, messageId) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    console.error(`Failed to fetch details for message ${messageId}:`, response.statusText);
    return;
  }

  const emailData = await response.json();
  
  // Extract useful information
  const headers = emailData.payload.headers;
  const subject = headers.find(header => header.name === 'Subject')?.value || 'No Subject';
  const from = headers.find(header => header.name === 'From')?.value || 'Unknown Sender';
  const snippet = emailData.snippet;

  //Log the email details
  console.log(`--- Analyzing Email from: ${from} ---`);
  console.log(`Subject: ${subject}`);
  console.log(`snippet: ${snippet}`);
  
  // Create a JSON string of the email content to send to the AI
  const contentToAnalyze = JSON.stringify({
    sender: from,
    subject: subject,
    body_snippet: snippet
  });
  
  const analysisResult = await analyzeEmailWithGemini(contentToAnalyze);

  // Log the result from the AI
  if (analysisResult) {
    console.log('AI Analysis Result:', analysisResult);
  }
  console.log('---------------------------------');
}

// Function to analyze email content using Gemini API
async function analyzeEmailWithGemini(emailContent) {
  const API_KEY = ''; // Make sure your key is here
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      console.error("API Error Body:", errorBody);
      throw new Error(`API call failed with status: ${response.status}`);
    }

    const geminiResponse = await response.json();
    const rawText = geminiResponse.candidates[0].content.parts[0].text;
    
    // Cleanup logic to handle markdown code blocks from the AI
    const startIndex = rawText.indexOf('{');
    const endIndex = rawText.lastIndexOf('}');
    const jsonString = rawText.substring(startIndex, endIndex + 1);
    
    const analysisResult = JSON.parse(jsonString);
    
    return analysisResult;

  } catch (error) {
    console.error("Error analyzing email with Gemini:", error);
    return null;
  }
}

// Main execution block
async function main() {
  try {
    console.log("Attempting to get auth token...");
    const token = await getAuthToken();
    console.log("Auth token acquired successfully!");
    await fetchEmails(token);
  } catch (error) {
    console.error("Authentication failed:", error.message);
  }
}

// You can trigger this process when the user clicks the extension icon,
// or have it run periodically. For now, let's trigger it on install/startup.
chrome.runtime.onStartup.addListener(main);
chrome.runtime.onInstalled.addListener(main);