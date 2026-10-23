"use client";

import { useEffect, useState } from "react";

export default function Footer() {
  // Year resolved on the client (never read during prerender).
  const [year, setYear] = useState(2026);
  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="border-t border-white/10 bg-[#0b0e13]">
      <div className="max-w-6xl mx-auto px-4 py-6 text-center space-y-2">
        <p className="text-sm font-semibold text-zinc-200">
          Virtual points only. No real money. Points have no cash value and cannot be withdrawn or transferred.
          Entertainment only, 18+.
        </p>
        <p className="text-xs text-zinc-500 max-w-2xl mx-auto">
          CricPoints Arena is a prediction game. Betting odds include a published 1.5% margin. Casino games use
          cryptographically random outcomes with payout tables published on the Casino page — outcomes are never
          manipulated. Play for fun and take breaks.
        </p>
        <p className="text-[11px] text-zinc-600">© {year} CricPoints Arena</p>
      </div>
    </footer>
  );
}
