/**
 * Minimalist HTML templates for Confidant web forms
 * Following PromptSafe-inspired design
 */

export interface RequestFormOptions {
  hash: string;
  label?: string;
  expiresAt: Date;
  type: 'form' | 'not-found' | 'expired' | 'completed';
}

/**
 * Generate minimalist HTML for secret request form
 */
export function getRequestFormHtml(options: RequestFormOptions): string {
  const { hash, label, expiresAt, type } = options;

  if (type === 'not-found') {
    return getNotFoundHtml();
  }

  if (type === 'expired') {
    return getExpiredHtml();
  }

  if (type === 'completed') {
    return getCompletedHtml();
  }

  return getFormHtml(hash, label, expiresAt);
}

/**
 * Not found page
 */
function getNotFoundHtml(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Request Not Found - Confidant</title>
  <style>
    :root {
      --bg-primary: #f8fafc;
      --bg-card: #ffffff;
      --text-primary: #1a202c;
      --text-secondary: #64748b;
      --text-muted: #94a3b8;
      --border-color: #e2e8f0;
      --accent: #1e293b;
      --accent-hover: #334155;
      --success: #10b981;
      --error: #ef4444;
      --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: var(--font-family);
      background: var(--bg-primary);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
    }
    .container {
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    header {
      margin-bottom: 32px;
    }
    .logo {
      font-size: 32px;
      display: block;
      margin-bottom: 8px;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 0;
    }
    p {
      color: var(--text-secondary);
      font-size: 16px;
      line-height: 1.5;
    }
    @media (max-width: 640px) {
      body {
        padding: 24px 16px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <span class="logo">🔐</span>
      <h1>Confidant</h1>
    </header>
    <p>The secret request you're looking for doesn't exist or has been removed.</p>
  </div>
</body>
</html>`;
}

/**
 * Expired page
 */
function getExpiredHtml(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Request Expired - Confidant</title>
  <style>
    :root {
      --bg-primary: #f8fafc;
      --bg-card: #ffffff;
      --text-primary: #1a202c;
      --text-secondary: #64748b;
      --text-muted: #94a3b8;
      --border-color: #e2e8f0;
      --accent: #1e293b;
      --accent-hover: #334155;
      --success: #10b981;
      --error: #ef4444;
      --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: var(--font-family);
      background: var(--bg-primary);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
    }
    .container {
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    header {
      margin-bottom: 32px;
    }
    .logo {
      font-size: 32px;
      display: block;
      margin-bottom: 8px;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 0;
    }
    p {
      color: var(--text-secondary);
      font-size: 16px;
      line-height: 1.5;
    }
    @media (max-width: 640px) {
      body {
        padding: 24px 16px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <span class="logo">🔐</span>
      <h1>Confidant</h1>
    </header>
    <p>This secret request has expired and is no longer available.</p>
  </div>
</body>
</html>`;
}

/**
 * Completed page
 */
function getCompletedHtml(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Secret Already Submitted - Confidant</title>
  <style>
    :root {
      --bg-primary: #f8fafc;
      --bg-card: #ffffff;
      --text-primary: #1a202c;
      --text-secondary: #64748b;
      --text-muted: #94a3b8;
      --border-color: #e2e8f0;
      --accent: #1e293b;
      --accent-hover: #334155;
      --success: #10b981;
      --error: #ef4444;
      --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: var(--font-family);
      background: var(--bg-primary);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
    }
    .container {
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    header {
      margin-bottom: 32px;
    }
    .logo {
      font-size: 32px;
      display: block;
      margin-bottom: 8px;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 0;
    }
    p {
      color: var(--text-secondary);
      font-size: 16px;
      line-height: 1.5;
    }
    @media (max-width: 640px) {
      body {
        padding: 24px 16px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <span class="logo">🔐</span>
      <h1>Confidant</h1>
    </header>
    <p>This request has already been completed and secret has been retrieved.</p>
  </div>
</body>
</html>`;
}

/**
 * Form page
 */
function getFormHtml(hash: string, label: string | undefined, expiresAt: Date): string {
  const labelHtml = label ? `<p class="label">${escapeHtml(label)}</p>` : '';
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Submit Secret - Confidant</title>
  <style>
    :root {
      --bg-primary: #f8fafc;
      --bg-card: #ffffff;
      --text-primary: #1a202c;
      --text-secondary: #64748b;
      --text-muted: #94a3b8;
      --border-color: #e2e8f0;
      --accent: #1e293b;
      --accent-hover: #334155;
      --success: #10b981;
      --error: #ef4444;
      --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: var(--font-family);
      background: var(--bg-primary);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 48px 24px;
    }
    .container {
      max-width: 480px;
      margin: 0 auto;
      width: 100%;
    }
    header {
      text-align: center;
      margin-bottom: 32px;
    }
    .logo {
      font-size: 32px;
      display: block;
      margin-bottom: 8px;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 0;
    }
    .label {
      font-size: 16px;
      color: var(--text-secondary);
      text-align: center;
      margin-bottom: 24px;
      font-weight: 500;
      word-wrap: break-word;
    }
    textarea {
      width: 100%;
      min-height: 160px;
      padding: 16px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      font-size: 16px;
      font-family: inherit;
      resize: vertical;
      outline: none;
      transition: border-color 0.2s;
    }
    textarea:focus {
      border-color: var(--accent);
    }
    button {
      width: 100%;
      padding: 14px 24px;
      background: var(--accent);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 16px;
      transition: background-color 0.2s;
    }
    button:hover {
      background: var(--accent-hover);
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    footer {
      text-align: center;
      margin-top: 24px;
      font-size: 14px;
      color: var(--text-muted);
    }
    .message {
      margin-top: 20px;
      padding: 16px;
      border-radius: 8px;
      text-align: center;
      font-weight: 500;
      display: none;
    }
    .message.success {
      display: block;
      background: var(--success);
      color: white;
    }
    .message.error {
      display: block;
      background: var(--error);
      color: white;
    }
    @media (max-width: 640px) {
      body {
        padding: 24px 16px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <span class="logo">🔐</span>
      <h1>Confidant</h1>
    </header>

    ${labelHtml}

    <form id="secretForm">
      <textarea 
        id="secret" 
        name="secret" 
        required 
        placeholder="Enter your secret..."
        maxlength="65536"
      ></textarea>
      
      <button type="submit" id="submitBtn">Submit Secret</button>
    </form>
    
    <footer>
      <span class="timer">⏱️ Expires in <span id="timeRemaining">calculating...</span></span>
    </footer>
    
    <div id="message" class="message"></div>
  </div>
  
  <script>
    const API_URL = window.location.origin;
    const hash = '${hash}';
    const expiresAt = new Date('${expiresAt.toISOString()}');
    
    // Update timer
    function updateTimer() {
      const now = new Date();
      const diff = expiresAt - now;
      
      if (diff <= 0) {
        document.getElementById('timeRemaining').textContent = 'expired';
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      let timeStr = '';
      if (hours > 0) {
        timeStr += \`\${hours}h \`;
      }
      if (minutes > 0 || hours > 0) {
        timeStr += \`\${minutes}m \`;
      }
      timeStr += \`\${seconds}s\`;
      
      document.getElementById('timeRemaining').textContent = timeStr;
    }
    
    updateTimer();
    setInterval(updateTimer, 1000);
    
    // Form submission
    document.getElementById('secretForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const secret = document.getElementById('secret').value.trim();
      const submitBtn = document.getElementById('submitBtn');
      const messageDiv = document.getElementById('message');
      
      if (!secret) {
        showMessage('Please enter a secret.', 'error');
        return;
      }
      
      if (secret.length > 65536) {
        showMessage('Secret is too large (max 64KB).', 'error');
        return;
      }
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
      
      try {
        const response = await fetch(\`\${API_URL}/requests/\${hash}\`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ secret })
        });
        
        const data = await response.json();
        
        if (response.status === 200) {
          showMessage('Secret submitted successfully!', 'success');
          document.getElementById('secret').value = '';
          submitBtn.style.display = 'none';
        } else if (response.status === 409) {
          showMessage('This request has already been completed.', 'error');
        } else if (response.status === 410) {
          showMessage('This request has expired.', 'error');
        } else {
          showMessage(data.error || 'Failed to submit secret. Please try again.', 'error');
        }
      } catch (error) {
        showMessage('Network error. Please check your connection and try again.', 'error');
      } finally {
        if (submitBtn.style.display !== 'none') {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Secret';
        }
      }
    });
    
    function showMessage(text, type) {
      const messageDiv = document.getElementById('message');
      messageDiv.textContent = text;
      messageDiv.className = \`message \${type}\`;
    }
  </script>
</body>
</html>`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
