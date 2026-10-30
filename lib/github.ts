export class GitHubRateLimitError extends Error {
  resetAt: number;

  constructor(resetAt: number) {
    super(`GitHub API rate limit exceeded. Resets at ${new Date(resetAt * 1000).toISOString()}`);
    this.name = "GitHubRateLimitError";
    this.resetAt = resetAt;
  }
}

export class GitHubNotFoundError extends Error {
  constructor(message = "Repository not found") {
    super(message);
    this.name = "GitHubNotFoundError";
  }
}

export interface RepoTreeItem {
  path: string;
  type: string;
  size?: number;
}

export type RepoTreeResult = RepoTreeItem[] & { truncated: boolean };

function getGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": "DeployPilot/0.1",
  };

  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error("GitHub API request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function checkRateLimit(res: Response): void {
  const remaining = res.headers.get("x-ratelimit-remaining");
  const reset = res.headers.get("x-ratelimit-reset");

  if (remaining === "0" && reset) {
    const resetEpoch = parseInt(reset, 10);
    throw new GitHubRateLimitError(resetEpoch);
  }
}

export function parseRepoUrl(repoUrl: string): { owner: string; name: string } {
  try {
    const url = new URL(repoUrl.trim());
    if (url.hostname !== "github.com") {
      throw new Error("Must be a github.com URL");
    }

    let pathname = url.pathname.replace(/^\/+|\/+$/g, "");
    if (pathname.endsWith(".git")) {
      pathname = pathname.slice(0, -4);
    }

    const segments = pathname.split("/");
    if (segments.length !== 2 || !segments[0] || !segments[1]) {
      throw new Error("Invalid GitHub repository path");
    }

    return {
      owner: segments[0],
      name: segments[1],
    };
  } catch (err: unknown) {
    throw new Error(`Invalid GitHub repository URL: ${(err as Error).message}`);
  }
}

export async function getRepoMeta(repoUrl: string): Promise<{
  owner: string;
  name: string;
  defaultBranch: string;
}> {
  const { owner, name } = parseRepoUrl(repoUrl);
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;

  const res = await fetchWithTimeout(endpoint, {
    headers: {
      ...getGitHubHeaders(),
      Accept: "application/vnd.github+json",
    },
  });

  checkRateLimit(res);

  if (res.status === 404) {
    throw new GitHubNotFoundError(`Repository ${owner}/${name} not found`);
  }

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`GitHub API error (${res.status}): ${errorBody || res.statusText}`);
  }

  const data = (await res.json()) as { default_branch?: string };
  return {
    owner,
    name,
    defaultBranch: data.default_branch || "main",
  };
}

export async function getLatestCommitSha(
  owner: string,
  name: string,
  branch: string
): Promise<string> {
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/commits/${encodeURIComponent(branch)}`;

  const res = await fetchWithTimeout(endpoint, {
    headers: {
      ...getGitHubHeaders(),
      Accept: "application/vnd.github+json",
    },
  });

  checkRateLimit(res);

  if (res.status === 404) {
    throw new GitHubNotFoundError(`Branch '${branch}' or repository ${owner}/${name} not found`);
  }

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`GitHub API error (${res.status}): ${errorBody || res.statusText}`);
  }

  const data = (await res.json()) as { sha?: string };
  if (!data.sha) {
    throw new Error("Missing commit SHA in GitHub API response");
  }

  return data.sha;
}

export async function getRepoTree(
  owner: string,
  name: string,
  ref: string
): Promise<RepoTreeResult> {
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/git/trees/${encodeURIComponent(ref)}?recursive=1`;

  const res = await fetchWithTimeout(endpoint, {
    headers: {
      ...getGitHubHeaders(),
      Accept: "application/vnd.github+json",
    },
  });

  checkRateLimit(res);

  if (res.status === 404) {
    throw new GitHubNotFoundError(`Tree for ref '${ref}' not found`);
  }

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`GitHub API error (${res.status}): ${errorBody || res.statusText}`);
  }

  const data = (await res.json()) as {
    tree?: Array<{ path: string; type: string; size?: number }>;
    truncated?: boolean;
  };

  const rawTree = data.tree || [];
  let wasCapped = false;
  let items: RepoTreeItem[] = rawTree;

  if (items.length > 2000) {
    items = items.slice(0, 2000);
    wasCapped = true;
  }

  const result = items as RepoTreeResult;
  result.truncated = Boolean(data.truncated || wasCapped);
  return result;
}

export async function getFileContent(
  owner: string,
  name: string,
  ref: string,
  path: string
): Promise<string> {
  const cleanPath = path.replace(/^\/+/, "");
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/contents/${cleanPath}?ref=${encodeURIComponent(ref)}`;

  const res = await fetchWithTimeout(endpoint, {
    headers: {
      ...getGitHubHeaders(),
      Accept: "application/vnd.github.raw",
    },
  });

  checkRateLimit(res);

  if (res.status === 404) {
    throw new GitHubNotFoundError(`File '${path}' not found at ref '${ref}'`);
  }

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`GitHub API error (${res.status}): ${errorBody || res.statusText}`);
  }

  return await res.text();
}
