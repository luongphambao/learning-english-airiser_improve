const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * For interpolating untrusted text into an HTML template we build ourselves
 * (app/api/gmail/send-reminder/route.ts). The text there comes from a chain that
 * starts at an uploaded document and passes through the model, so it is attacker
 * -influenced even though the user uploaded it themselves.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ENTITIES[ch]!);
}
