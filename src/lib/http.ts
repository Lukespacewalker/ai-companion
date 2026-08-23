export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function assertTrustedMutationOrigin(request: Request): void {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new HttpError("Cross-origin mutation rejected.", 403);
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return;
  }

  const requestOrigin = new URL(request.url).origin;
  if (origin !== requestOrigin) {
    throw new HttpError("Cross-origin mutation rejected.", 403);
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json(
      { error: error.message },
      { status: error.status },
    );
  }

  console.error(error);
  return Response.json(
    { error: "The server could not complete the Grok operation." },
    { status: 500 },
  );
}
