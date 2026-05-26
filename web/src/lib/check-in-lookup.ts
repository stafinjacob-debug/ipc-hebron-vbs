/** Parse scanned QR text or manual entry into a check-in token or plain registration code. */
export function parseCheckInLookupInput(raw: string): {
  checkInToken: string | null;
  plainCode: string | null;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { checkInToken: null, plainCode: null };

  const tokenFromQuery = extractTicketToken(trimmed);
  if (tokenFromQuery) return { checkInToken: tokenFromQuery, plainCode: null };

  if (/^[a-f0-9]{36}$/i.test(trimmed)) {
    return { checkInToken: trimmed.toLowerCase(), plainCode: null };
  }

  return { checkInToken: null, plainCode: trimmed };
}

function extractTicketToken(input: string): string | null {
  const tryUrl = (value: string): string | null => {
    try {
      const url = new URL(value);
      const t = url.searchParams.get("t")?.trim();
      if (t) return t;
      if (url.pathname.includes("/register/ticket")) {
        const match = /[?&]t=([^&]+)/i.exec(value);
        return match?.[1]?.trim() ?? null;
      }
    } catch {
      /* not a URL */
    }
    return null;
  };

  const direct = tryUrl(input);
  if (direct) return direct;

  const embedded = /[?&]t=([a-f0-9]{36})/i.exec(input);
  if (embedded?.[1]) return embedded[1].toLowerCase();

  return null;
}

export type CheckInLookupMatch = {
  id: string;
  studentName: string;
  className: string;
  checkedIn: boolean;
  registrationNumber: string | null;
  submissionCode: string | null;
  guardianName: string | null;
  dateOfBirth: string | null;
  allergiesNotes: string | null;
  registrationStatus: string;
};
