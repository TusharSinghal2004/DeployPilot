import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { EphemeralLink } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/preview-token";

export interface CreateLinkInput {
  frontendUrl: string;
  backendUrl: string;
  ttlSeconds: number;
  password?: string;
  createdBy?: string;
  deploymentId?: string;
}

export interface CreateLinkResult {
  link: EphemeralLink;
  rawToken: string;
  passwordSet: boolean;
}

export interface ExpiredRow {
  id: string;
  frontendUrl: string;
  backendUrl: string;
}

export interface ExpireResult {
  count: number;
  rows: ExpiredRow[];
}

export async function createLink(input: CreateLinkInput): Promise<CreateLinkResult> {
  const { frontendUrl, backendUrl, ttlSeconds, password, createdBy, deploymentId } = input;

  const rawToken = crypto.randomUUID() + crypto.randomBytes(32).toString("hex");
  const accessTokenHash = hashToken(rawToken);

  let passwordHash: string | null = null;
  if (password && password.trim().length > 0) {
    passwordHash = await bcrypt.hash(password, 10);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  const link = await prisma.ephemeralLink.create({
    data: {
      frontendUrl,
      backendUrl,
      accessTokenHash,
      passwordHash,
      state: "active",
      expiresAt,
      createdBy: createdBy || "demo", // default to "demo"
      deploymentId: deploymentId || null,
    },
  });

  return {
    link,
    rawToken,
    passwordSet: Boolean(passwordHash),
  };
}

export async function getActiveLink(id: string): Promise<EphemeralLink | null> {
  const link = await prisma.ephemeralLink.findUnique({
    where: { id },
  });

  if (!link || link.state !== "active") {
    return null;
  }

  return link;
}

export async function touchHit(id: string): Promise<EphemeralLink> {
  return await prisma.ephemeralLink.update({
    where: { id },
    data: {
      hitCount: {
        increment: 1,
      },
      lastHitAt: new Date(),
    },
  });
}

export async function extendLink(
  id: string,
  extraSeconds: number
): Promise<EphemeralLink> {
  const link = await prisma.ephemeralLink.findUnique({
    where: { id },
  });

  if (!link) {
    throw new Error(`Link not found: ${id}`);
  }

  const baseTime = link.expiresAt.getTime() > Date.now() ? link.expiresAt.getTime() : Date.now();
  const newExpiresAt = new Date(baseTime + extraSeconds * 1000);

  return await prisma.ephemeralLink.update({
    where: { id },
    data: {
      expiresAt: newExpiresAt,
      state: "active",
    },
  });
}

export async function destroyLink(id: string): Promise<EphemeralLink | null> {
  const link = await prisma.ephemeralLink.findUnique({
    where: { id },
  });

  if (!link) {
    return null;
  }

  if (link.state === "destroyed") {
    return link;
  }

  return await prisma.ephemeralLink.update({
    where: { id },
    data: {
      state: "destroyed",
      destroyedAt: new Date(),
    },
  });
}

/**
 * Atomically marks active links as expired if expiresAt <= now.
 * Wrapped in a prisma.$transaction to prevent concurrent cron invocations from double-emitting.
 */
export async function expireDueLinks(): Promise<ExpireResult> {
  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    // Find active links where expiresAt <= now within transaction
    const dueLinks = await tx.ephemeralLink.findMany({
      where: {
        state: "active",
        expiresAt: {
          lte: now,
        },
      },
      select: {
        id: true,
        frontendUrl: true,
        backendUrl: true,
      },
    });

    if (dueLinks.length === 0) {
      return { count: 0, rows: [] };
    }

    const ids = dueLinks.map((l) => l.id);

    // Update state to expired atomically
    await tx.ephemeralLink.updateMany({
      where: {
        id: { in: ids },
        state: "active",
      },
      data: {
        state: "expired",
      },
    });

    return {
      count: dueLinks.length,
      rows: dueLinks,
    };
  });
}

export async function listActiveLinks(createdBy?: string): Promise<EphemeralLink[]> {
  const now = new Date();
  return await prisma.ephemeralLink.findMany({
    where: {
      state: "active",
      expiresAt: {
        gt: now,
      },
      ...(createdBy ? { createdBy } : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}
