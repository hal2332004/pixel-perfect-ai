export function isAbortError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  // DOMException in browsers
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "AbortError";
  }

  // Fallback: many environments surface AbortError as Error
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return true;
    }
    const message = (error.message || "").toLowerCase();
    return message.includes("abort") && message.includes("signal");
  }

  // Last resort: duck-typing
  if (typeof error === "object") {
    const maybeName = (error as { name?: unknown }).name;
    if (typeof maybeName === "string" && maybeName === "AbortError") {
      return true;
    }
  }

  return false;
}
