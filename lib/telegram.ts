import "server-only";

/** Escape user-supplied text for Telegram's HTML parse mode. */
export const tgEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Sends an alert to the agent's Telegram chat. No-ops when not configured.
 * Never throws: a failed alert must not fail the buyer's request.
 */
export async function notifyAgent(html: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error("Telegram alert failed", res.status, await res.text());
  } catch (e) {
    console.error("Telegram alert error", e);
  }
}

export { siteUrl } from "./site";
