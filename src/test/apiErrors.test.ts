import { describe, expect, it } from "vitest";
import {
  ApiError,
  DemoModeError,
  errorFromResponse,
} from "../lib/apiErrors";

describe("API errors", () => {
  it("preserves structured server messages and codes", async () => {
    const error = await errorFromResponse(
      new Response(
        JSON.stringify({ error: "Payload is too large", code: "payload_limit" }),
        { status: 413, headers: { "Content-Type": "application/json" } },
      ),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 413,
      message: "Payload is too large",
      code: "payload_limit",
    });
  });

  it("uses a status fallback for non-JSON proxy failures", async () => {
    const error = await errorFromResponse(
      new Response("Bad gateway", { status: 502 }),
    );
    expect(error.message).toBe("Request failed with status 502");
  });

  it("provides an explicit local-demo explanation", () => {
    const error = new DemoModeError();
    expect(error).toMatchObject({
      status: 403,
      code: "demo_auth_required",
    });
    expect(error.message).toContain("requires Google sign-in");
  });
});
