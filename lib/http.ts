import { NextResponse } from "next/server";

export function jsonOk<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export function jsonErr(
  code: string,
  message: string,
  status: number = 400
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
      code,
      message,
    },
    {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

export function plainHtml(status: number, message: string): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${status} - DeployPilot Gateway</title>
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
      background: #0f172a;
      color: #f8fafc;
      padding: 1.5rem;
      box-sizing: border-box;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 2rem;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
    }
    .badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      background: ${status >= 400 ? "#ef444420" : "#3b82f620"};
      color: ${status >= 400 ? "#f87171" : "#60a5fa"};
      border: 1px solid ${status >= 400 ? "#ef444440" : "#3b82f640"};
      margin-bottom: 1rem;
    }
    h1 {
      margin: 0 0 0.75rem 0;
      font-size: 1.25rem;
      font-weight: 600;
    }
    p {
      margin: 0;
      color: #94a3b8;
      font-size: 0.95rem;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">HTTP ${status}</div>
    <h1>DeployPilot Gateway</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
