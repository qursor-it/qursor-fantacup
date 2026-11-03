import { afterEach, describe, expect, it, vi } from "vitest";
import { getClientIp } from "./rate-limit";

function headers(values: Record<string, string>) {
  return {
    get(name: string) {
      return values[name.toLowerCase()] ?? null;
    },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getClientIp", () => {
  it("returns the single forwarded value", () => {
    expect(getClientIp(headers({ "x-forwarded-for": "203.0.113.7" }))).toBe(
      "203.0.113.7"
    );
  });

  it("ignores client-spoofed values on the left", () => {
    expect(
      getClientIp(headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" }), 1)
    ).toBe("203.0.113.7");
  });

  it("with hops=0 uses the right-most entry as-is", () => {
    expect(
      getClientIp(
        headers({ "x-forwarded-for": "6.6.6.6, 198.51.100.9, 203.0.113.7" }),
        0
      )
    ).toBe("203.0.113.7");
  });

  it("skips trusted proxy hops from the right", () => {
    expect(
      getClientIp(
        headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.7, 198.51.100.9" }),
        2
      )
    ).toBe("203.0.113.7");
  });

  it("reads hops from TRUSTED_PROXY_HOPS when not passed", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "2");
    expect(
      getClientIp(
        headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.7, 198.51.100.9" })
      )
    ).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    expect(getClientIp(headers({ "x-real-ip": "198.51.100.9" }))).toBe(
      "198.51.100.9"
    );
  });

  it("returns unknown when no header is present", () => {
    expect(getClientIp(headers({}))).toBe("unknown");
  });
});
