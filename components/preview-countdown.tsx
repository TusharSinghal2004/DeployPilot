"use client";

import React, { useEffect, useState, useRef } from "react";

export interface PreviewCountdownProps {
  expiresAt: string;
  onExpire?: () => void;
  className?: string;
}

export function PreviewCountdown({
  expiresAt,
  onExpire,
  className = "",
}: PreviewCountdownProps) {
  const [displayText, setDisplayText] = useState<string>("");
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const onExpireCalledRef = useRef<boolean>(false);

  useEffect(() => {
    function updateCountdown() {
      const targetTime = new Date(expiresAt).getTime();
      const now = Date.now();
      const diffSeconds = Math.floor((targetTime - now) / 1000);

      if (diffSeconds <= 0) {
        setIsExpired(true);
        setDisplayText("Expired");

        if (!onExpireCalledRef.current) {
          onExpireCalledRef.current = true;
          if (onExpire) {
            onExpire();
          }
        }
        return;
      }

      setIsExpired(false);
      const hours = Math.floor(diffSeconds / 3600);
      const minutes = Math.floor((diffSeconds % 3600) / 60);
      const seconds = diffSeconds % 60;

      if (hours > 0) {
        setDisplayText(`In ${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setDisplayText(`In ${minutes}m ${seconds}s`);
      } else {
        setDisplayText(`In ${seconds}s`);
      }
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  return (
    <span
      className={`${className} ${
        isExpired ? "text-red-400 font-semibold" : "text-slate-200"
      }`}
    >
      {displayText || "Calculating..."}
    </span>
  );
}
