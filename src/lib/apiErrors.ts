export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code = "api_error",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class DemoModeError extends ApiError {
  constructor() {
    super(
      "This AI feature requires Google sign-in. Demo mode keeps your data local.",
      403,
      "demo_auth_required",
    );
    this.name = "DemoModeError";
  }
}

export async function errorFromResponse(response: Response): Promise<ApiError> {
  let message = `Request failed with status ${response.status}`;
  let code = "api_error";

  try {
    const body = await response.json();
    if (body && typeof body === "object") {
      if ("error" in body && typeof body.error === "string") {
        message = body.error;
      }
      if ("code" in body && typeof body.code === "string") {
        code = body.code;
      }
    }
  } catch {
    // Preserve the status-based fallback for non-JSON proxy errors.
  }

  return new ApiError(message, response.status, code);
}
