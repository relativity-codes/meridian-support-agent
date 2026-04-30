/** Meridian Electronics customer-support prototype — single source for product copy. */

export const MERIDIAN_COMPANY_NAME = "Meridian Electronics";

export const MERIDIAN_SUPPORT_TITLE = "Meridian Support";

export const MERIDIAN_TAGLINE =
  "Customer support preview — ask about products, availability, orders, and your order history.";

export const MERIDIAN_METADATA_TITLE = `${MERIDIAN_COMPANY_NAME} — ${MERIDIAN_SUPPORT_TITLE}`;

export const MERIDIAN_METADATA_DESCRIPTION =
  "Internal prototype: AI-assisted support for Meridian Electronics (monitors, keyboards, printers, networking, and accessories). Sign in with your authorized Google account.";

export const MERIDIAN_PROTOTYPE_DISCLAIMER =
  "Internal evaluation only. Not a production system. Responses may use live business tools when configured; do not enter real customer secrets.";

export const MERIDIAN_AUTH_HINT =
  "Sign in with your authorized Google account to open the support workspace.";

export const MERIDIAN_CHAT_SUBTITLE =
  "Answers may use live catalog and order tools when your administrator has connected them. Conversations are saved on the server.";

export const MERIDIAN_ASSISTANT_LABEL = "Meridian";

export const MERIDIAN_EMPTY_STATE_HEADING = "How can we help today?";

export const MERIDIAN_EMPTY_STATE_BODY =
  "Try one of the suggestions below, or describe what you need — for example stock checks, placing an order, or looking up a past purchase.";

export const MERIDIAN_COMPOSER_PLACEHOLDER =
  "Ask about product availability, an order, or your order history… (Enter to send, Shift+Enter for newline)";

export const MERIDIAN_COMPOSER_HELPER =
  "Your message is sent securely to Meridian’s support assistant. For sensitive account issues, follow your team’s escalation process.";

export const MERIDIAN_SCRATCHPAD_SUMMARY = "How the agent decided (demo)";

export const MERIDIAN_CAPABILITIES = [
  "Product availability and catalog questions",
  "Help placing or updating an order",
  "Order history and status lookups",
  "Guidance for returning customers (when tools are connected)",
] as const;

/** Short prompts for empty-state chips (set into the composer on click). */
export const MERIDIAN_SAMPLE_PROMPTS = [
  "Do you have the Meridian 27-inch USB-C monitor in stock?",
  "I’d like to place an order for a wireless keyboard and a laser printer.",
  "What’s the status of my order #ME-10432?",
  "Show my recent orders under my account.",
] as const;
