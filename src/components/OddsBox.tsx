"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  kind: "back" | "lay";
  price: number;
  suspended?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

/** Exchange-style Back (Lagai, blue) / Lay (Khai, pink) price box with movement flash. */
export default function OddsBox({ kind, price, suspended, selected, onClick }: Props) {
  const [flash, setFlash] = useState("");
  const prev = useRef(price);

  useEffect(() => {
    if (price > prev.current) setFlash("flash-up");
    else if (price < prev.current) setFlash("flash-down");
    prev.current = price;
    const t = setTimeout(() => setFlash(""), 900);
    return () => clearTimeout(t);
  }, [price]);

  const base =
    kind === "back"
      ? "bg-[#a9d7f8] hover:bg-[#93cdf7] text-[#0b3556]"
      : "bg-[#f6c3d5] hover:bg-[#f3aeca] text-[#571231]";

  return (
    <button
      type="button"
      disabled={suspended}
      onClick={onClick}
      className={`relative w-full rounded-md px-2 py-1.5 text-center transition ${base} ${flash} ${
        selected ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-black" : ""
      } ${suspended ? "opacity-40 cursor-not-allowed" : "cursor-pointer active:scale-[0.98]"}`}
    >
      <span className="block text-[15px] font-extrabold leading-tight">{suspended ? "—" : price.toFixed(2)}</span>
      <span className="block text-[9px] font-bold uppercase tracking-wider opacity-70">
        {kind === "back" ? "Back · Lagai" : "Lay · Khai"}
      </span>
    </button>
  );
}
