"use client";

import { useState } from "react";

type Props = {
  checkoutUrl: string;
  amountLabel: string;
};

export function EmbeddedPayClient({ checkoutUrl, amountLabel }: Props) {
  const [opening, setOpening] = useState(false);

  return (
    <div className="mt-6 space-y-4">
      <a
        href={checkoutUrl}
        onClick={() => setOpening(true)}
        className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-5 py-3 text-base font-semibold text-white hover:bg-indigo-700"
      >
        {opening ? "Opening secure checkout…" : `Pay ${amountLabel}`}
      </a>
      <p className="text-xs leading-relaxed text-slate-500">
        Card payment opens on Stripe’s secure page. If that page does not load, open this site in
        Safari, Chrome, or Edge and tap the button again.
      </p>
    </div>
  );
}
