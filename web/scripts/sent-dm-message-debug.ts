/**
 * Print Sent.dm message status + activity log for a failed (or any) message_id from the dashboard.
 *
 * Usage (from web/):
 *   npm run sms:sent-debug -- 52e4d2ea-89bd-4a08-b29e-596d37e9f553
 *
 * Uses SENT_DM_API_KEY, optional SENT_DM_API_BASE and SENT_DM_PROFILE_ID from .env.local.
 *
 * @see https://docs.sent.dm/start/guides/message-status-tracking
 */
async function main() {
  const messageId = process.argv[2]?.trim();
  if (!messageId) {
    console.error("Usage: npm run sms:sent-debug -- <message_id_uuid>");
    process.exit(1);
  }

  const apiBase = (process.env.SENT_DM_API_BASE?.trim() || "https://api.sent.dm").replace(/\/+$/, "");
  const apiKey = process.env.SENT_DM_API_KEY?.trim() ?? "";
  const profileId = process.env.SENT_DM_PROFILE_ID?.trim() ?? "";
  if (!apiKey) {
    console.error("Set SENT_DM_API_KEY in .env.local.");
    process.exit(1);
  }

  const hdrs: Record<string, string> = { "x-api-key": apiKey };
  if (profileId) hdrs["x-profile-id"] = profileId;

  const statusUrl = `${apiBase}/v3/messages/${encodeURIComponent(messageId)}`;
  const activitiesUrl = `${apiBase}/v3/messages/${encodeURIComponent(messageId)}/activities`;

  const [statusRes, actRes] = await Promise.all([
    fetch(statusUrl, { headers: hdrs }),
    fetch(activitiesUrl, { headers: hdrs }),
  ]);

  let statusJson: unknown;
  let actJson: unknown;
  try {
    statusJson = await statusRes.json();
  } catch {
    statusJson = { parse_error: true };
  }
  try {
    actJson = await actRes.json();
  } catch {
    actJson = { parse_error: true };
  }

  console.log("--- GET /v3/messages/{id} --- HTTP", statusRes.status);
  console.log(JSON.stringify(statusJson, null, 2));
  console.log("\n--- GET /v3/messages/{id}/activities --- HTTP", actRes.status);
  console.log(JSON.stringify(actJson, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
