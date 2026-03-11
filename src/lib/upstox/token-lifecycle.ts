const IST_OFFSET_MINUTES = 330;
const IST_TOKEN_EXPIRY_HOUR = 3;
const IST_TOKEN_EXPIRY_MINUTE = 30;

export function computeUpstoxAccessTokenExpiry(from = new Date()) {
  const istNow = new Date(from.getTime() + IST_OFFSET_MINUTES * 60_000);

  const expiryIst = new Date(
    Date.UTC(
      istNow.getUTCFullYear(),
      istNow.getUTCMonth(),
      istNow.getUTCDate(),
      IST_TOKEN_EXPIRY_HOUR,
      IST_TOKEN_EXPIRY_MINUTE,
      0,
      0
    )
  );

  if (istNow >= expiryIst) {
    expiryIst.setUTCDate(expiryIst.getUTCDate() + 1);
  }

  return new Date(expiryIst.getTime() - IST_OFFSET_MINUTES * 60_000).toISOString();
}

export function isExpiredIsoDate(isoDate: string | undefined, now = new Date()) {
  if (!isoDate) {
    return false;
  }

  const ts = new Date(isoDate).getTime();
  if (!Number.isFinite(ts)) {
    return false;
  }

  return ts <= now.getTime();
}

export function isUpstoxTokenErrorMessage(message: string | undefined) {
  const value = message?.toLowerCase() ?? "";
  return (
    value.includes("invalid token") ||
    value.includes("token expired") ||
    value.includes("expired token") ||
    value.includes("access token expired")
  );
}
