import { describe, expect, it } from "vitest";
import {
  assertPublicHttpUrl,
  HttpError,
  isPrivateAddress,
  requiredString,
} from "./security";

describe("SSRF protection", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.10",
    "169.254.169.254",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("classifies %s as private", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "2001:4860:4860::8888"])(
    "classifies %s as public",
    (address) => {
      expect(isPrivateAddress(address)).toBe(false);
    },
  );

  it("rejects localhost and unsupported URL schemes", async () => {
    await expect(assertPublicHttpUrl("http://localhost/admin")).rejects.toBeInstanceOf(
      HttpError,
    );
    await expect(assertPublicHttpUrl("file:///etc/passwd")).rejects.toBeInstanceOf(
      HttpError,
    );
  });

  it("accepts a public HTTP address", async () => {
    await expect(assertPublicHttpUrl("https://8.8.8.8/")).resolves.toMatchObject({
      protocol: "https:",
      hostname: "8.8.8.8",
    });
  });
});

describe("requiredString", () => {
  it("validates presence and size", () => {
    expect(requiredString(" study ", "Text", 20)).toBe(" study ");
    expect(() => requiredString("", "Text", 20)).toThrow(HttpError);
    expect(() => requiredString("too long", "Text", 3)).toThrow(HttpError);
  });
});
