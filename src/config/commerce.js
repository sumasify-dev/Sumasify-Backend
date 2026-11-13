import "dotenv/config";

function readInteger(name, fallback) {
  const raw = process.env[name];

  if (raw === undefined || raw === "") {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function readDecimalString(name, fallback) {
  const raw = process.env[name];

  if (raw === undefined || raw === "") {
    return fallback;
  }

  return /^\d+(\.\d{1,2})?$/.test(raw) ? raw : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export const commerceConfig = Object.freeze({
  currency: "NGN",
  orderTimezone: process.env.ORDER_TIMEZONE || "Africa/Lagos",

  // Global, flat percentage commission. 500 basis points = 5.00%.
  commissionRateBps: clamp(
    readInteger("COMMISSION_RATE_BPS", 500),
    0,
    10000,
  ),

  // Flat amount charged per DELIVERY vendor group in V1.
  deliveryFeeAmount: readDecimalString("DELIVERY_FEE_AMOUNT", "2000.00"),

  // How long reserved stock is held before Phase 2 release logic can reclaim it.
  stockReservationMinutes: Math.max(
    readInteger("STOCK_RESERVATION_MINUTES", 30),
    1,
  ),

  platformBank: Object.freeze({
    bankname: process.env.PLATFORM_BANK_NAME || "",
    accountname: process.env.PLATFORM_BANK_ACCOUNT_NAME || "",
    accountnumber: process.env.PLATFORM_BANK_ACCOUNT_NUMBER || "",
  }),
});