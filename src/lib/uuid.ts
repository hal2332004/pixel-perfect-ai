function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function uuidV4FromRandomBytes(bytes: Uint8Array): string {
  // Per RFC 4122: set version=4 and variant=10
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytesToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function randomUUID(): string {
  const cryptoObj = (globalThis as typeof globalThis & { crypto?: Crypto }).crypto;

  if (cryptoObj) {
    if (typeof cryptoObj.randomUUID === "function") {
      return cryptoObj.randomUUID();
    }

    if (typeof cryptoObj.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      cryptoObj.getRandomValues(bytes);
      return uuidV4FromRandomBytes(bytes);
    }
  }

  // Last-resort fallback (non-cryptographic).
  const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  return template.replace(/[xy]/g, (ch) => {
    const rand = Math.floor(Math.random() * 16);
    const value = ch === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}
