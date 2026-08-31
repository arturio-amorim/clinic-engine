import { describe, expect, it } from "vitest";

import { createHttpAuth } from "../src/http-auth.js";

function requestWithAuthorization(value: string | null) {
  return {
    path: "/mcp",
    method: "POST",
    signal: new AbortController().signal,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "authorization" ? value : null,
      has: (name: string) =>
        name.toLowerCase() === "authorization" && value !== null,
    },
  };
}

describe("http auth", () => {
  it("returns the clinic principal for a matching bearer token", () => {
    const auth = createHttpAuth("clinic-secret");
    if (auth.mode !== "required") {
      throw new Error("expected required auth");
    }

    expect(
      auth.authenticate(requestWithAuthorization("Bearer clinic-secret")),
    ).toEqual({ id: "http:clinic-agent" });
  });

  it("rejects a missing or wrong credential", () => {
    const auth = createHttpAuth("clinic-secret");
    if (auth.mode !== "required") {
      throw new Error("expected required auth");
    }

    expect(auth.authenticate(requestWithAuthorization(null))).toBeNull();
    expect(auth.authenticate(requestWithAuthorization("Bearer other"))).toBeNull();
  });
});
