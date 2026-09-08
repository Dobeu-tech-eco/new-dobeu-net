export const TYPEFORM_WEBHOOK_MAX_BYTES = 256 * 1024;

export class TypeformWebhookBodyTooLargeError extends Error {
  constructor() {
    super("typeform_webhook_body_too_large");
    this.name = "TypeformWebhookBodyTooLargeError";
  }
}

/** Read and cap the exact wire bytes so signature verification precedes decode. */
export async function readTypeformWebhookBody(
  request: Request,
): Promise<Uint8Array> {
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (
      Number.isSafeInteger(contentLength) &&
      contentLength >= 0 &&
      contentLength > TYPEFORM_WEBHOOK_MAX_BYTES
    ) {
      throw new TypeformWebhookBodyTooLargeError();
    }
  }

  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > TYPEFORM_WEBHOOK_MAX_BYTES) {
      try {
        await reader.cancel("request_body_too_large");
      } catch {
        // The size violation is authoritative even if canceling the stream fails.
      }
      throw new TypeformWebhookBodyTooLargeError();
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
