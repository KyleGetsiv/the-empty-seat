type NotifyLevel = "info" | "warn" | "error";

const LEVEL_EMOJI: Record<NotifyLevel, string> = {
  info: "ℹ️",
  warn: "⚠️",
  error: "🚨",
};

export async function notifySlack(
  message: string,
  level: NotifyLevel = "info"
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[notify] SLACK_WEBHOOK_URL not set; skipping Slack notification");
    return;
  }

  const text = `${LEVEL_EMOJI[level]} *[${level.toUpperCase()}]* ${message}`;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error(`[notify] Slack webhook returned ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error("[notify] Failed to post to Slack:", err);
  }
}
