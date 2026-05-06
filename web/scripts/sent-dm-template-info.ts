/**
 * Print Sent.dm template metadata (category, variables, name) for SENT_DM_SMS_TEMPLATE_ID.
 *
 * Usage (from web/): npm run sms:sent-template
 *
 * AUTHENTICATION templates (e.g. sent_Verify_Code_2) only accept short numeric codes in var_1 —
 * not registration URLs or sentences (Sent returns VALIDATION_008).
 */
async function main() {
  const apiBase = (process.env.SENT_DM_API_BASE?.trim() || "https://api.sent.dm").replace(/\/+$/, "");
  const apiKey = process.env.SENT_DM_API_KEY?.trim() ?? "";
  const templateId = process.env.SENT_DM_SMS_TEMPLATE_ID?.trim() ?? "";
  const profileId = process.env.SENT_DM_PROFILE_ID?.trim() ?? "";
  if (!apiKey || !templateId) {
    console.error("Set SENT_DM_API_KEY and SENT_DM_SMS_TEMPLATE_ID in .env.local.");
    process.exit(1);
  }
  const headers: Record<string, string> = { "x-api-key": apiKey };
  if (profileId) headers["x-profile-id"] = profileId;

  const res = await fetch(`${apiBase}/v3/templates/${encodeURIComponent(templateId)}`, { headers });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    console.error("HTTP", res.status, text.slice(0, 500));
    process.exit(1);
  }
  console.log(JSON.stringify(json, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
