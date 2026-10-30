"use client";

import React, { useState } from "react";

export interface PasswordPromptProps {
  token: string;
  onSuccess?: () => void;
  initialError?: string;
}

export function PasswordPrompt({
  token,
  onSuccess,
  initialError,
}: PasswordPromptProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError || null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append("password", password);

      const response = await fetch(`/api/preview/${encodeURIComponent(token)}/unlock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      if (response.status === 401) {
        setError("Incorrect password. Access denied.");
        setLoading(false);
        return;
      }

      if (!response.ok) {
        setError("Authentication failed. Please try again.");
        setLoading(false);
        return;
      }

      if (onSuccess) {
        onSuccess();
      } else {
        // Normal browser navigation to gate which will now pass cookie
        window.location.href = `/api/preview/${encodeURIComponent(token)}`;
      }
    } catch {
      setError("Network error while verifying password.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl text-slate-100">
      <div className="mb-4">
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">
          DeployPilot Layer 0
        </span>
        <h2 className="text-xl font-bold mt-3 text-white">Protected Preview</h2>
        <p className="text-sm text-slate-400 mt-1">
          This preview deployment is password protected. Enter the password to continue.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2"
        >
          <span aria-hidden="true">•</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="preview-password-input"
            className="block text-sm font-medium text-slate-300 mb-1"
          >
            Password
          </label>
          <input
            id="preview-password-input"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            disabled={loading}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter preview password"
            className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-sm transition-colors duration-150 shadow-md"
        >
          {loading ? "Unlocking..." : "Unlock Preview"}
        </button>
      </form>
    </div>
  );
}
