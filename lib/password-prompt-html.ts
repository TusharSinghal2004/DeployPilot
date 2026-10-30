export function renderPasswordPromptHtml(params: {
  token: string;
  errorMessage?: string;
}): string {
  const { token, errorMessage } = params;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DeployPilot Preview — Password Required</title>
  <style>
    :root {
      color-scheme: dark;
    }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #090d16;
      color: #f1f5f9;
      padding: 1.5rem;
      box-sizing: border-box;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 14px;
      padding: 2.25rem;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 0.25rem 0.65rem;
      border-radius: 9999px;
      background: #3b82f615;
      color: #60a5fa;
      border: 1px solid #3b82f635;
      margin-bottom: 1.25rem;
    }
    h1 {
      margin: 0 0 0.5rem 0;
      font-size: 1.35rem;
      font-weight: 600;
      color: #f8fafc;
    }
    p {
      margin: 0 0 1.5rem 0;
      color: #94a3b8;
      font-size: 0.92rem;
      line-height: 1.5;
    }
    .error-banner {
      background: #ef44441a;
      border: 1px solid #ef444440;
      color: #f87171;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.88rem;
      margin-bottom: 1.25rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    label {
      font-size: 0.85rem;
      font-weight: 500;
      color: #cbd5e1;
    }
    input[type="password"] {
      width: 100%;
      box-sizing: border-box;
      padding: 0.75rem 0.9rem;
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 8px;
      color: #f8fafc;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    input[type="password"]:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
    }
    button[type="submit"] {
      padding: 0.75rem 1rem;
      background: #2563eb;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.15s ease, transform 0.05s ease;
    }
    button[type="submit"]:hover {
      background: #1d4ed8;
    }
    button[type="submit"]:active {
      transform: scale(0.99);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">DeployPilot Layer 0</div>
    <h1>Protected Preview</h1>
    <p>This ephemeral preview deployment is password protected. Enter the password below to continue.</p>

    ${
      errorMessage
        ? `<div class="error-banner" role="alert"><span>•</span> <span>${errorMessage}</span></div>`
        : ""
    }

    <form method="POST" action="/api/preview/${encodeURIComponent(token)}/unlock">
      <div class="field">
        <label for="password">Preview Password</label>
        <input
          type="password"
          id="password"
          name="password"
          autocomplete="current-password"
          required
          autofocus
          placeholder="Enter password"
        />
      </div>
      <button type="submit">Unlock Preview</button>
    </form>
  </div>
</body>
</html>`;
}
