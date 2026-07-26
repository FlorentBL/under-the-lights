export const DEFAULT_MAX_JSON_BYTES = 16_384;

export class JsonRequestError extends Error {
  readonly status: 400 | 413 | 415;

  constructor(
    message: string,
    status: 400 | 413 | 415,
  ) {
    super(message);
    this.name = "JsonRequestError";
    this.status = status;
  }
}

async function readLimitedBody(request: Request, maxBytes: number) {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxBytes)) {
    throw new JsonRequestError("Request body is too large", 413);
  }

  if (!request.body) throw new JsonRequestError("JSON request body required", 400);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new JsonRequestError("Request body is too large", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(body);
}

export async function readJsonObject(
  request: Request,
  maxBytes = DEFAULT_MAX_JSON_BYTES,
): Promise<Record<string, unknown>> {
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    throw new JsonRequestError("Content-Type must be application/json", 415);
  }

  let text: string;
  try {
    text = await readLimitedBody(request, maxBytes);
  } catch (error) {
    if (error instanceof JsonRequestError) throw error;
    throw new JsonRequestError("Request body must be valid UTF-8", 400);
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new JsonRequestError("Request body must contain valid JSON", 400);
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new JsonRequestError("Request body must be a JSON object", 400);
  }
  return value as Record<string, unknown>;
}

export function jsonRequestErrorResponse(error: unknown) {
  if (!(error instanceof JsonRequestError)) throw error;
  return Response.json({ error: error.message }, { status: error.status });
}
