import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

describe("conversations", () => {
  it("creates a conversation and queries it by userId", async () => {
    const t = convexTest(schema);
    const timestamp = Date.now();

    await t.withIdentity({ subject: "test-user-123" }).mutation(api.conversations.addUserMessage, {
      content: "Hello, Dr. Poo!",
      timestamp,
    });

    const messages = await t
      .withIdentity({ subject: "test-user-123" })
      .query(api.conversations.list, {});
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe("Hello, Dr. Poo!");
    expect(messages[0].role).toBe("user");
  });

  it("throws when querying without auth identity", async () => {
    const t = convexTest(schema);
    await expect(t.query(api.conversations.list, {})).rejects.toThrow("Not authenticated");
  });

  it("throws when adding a message without auth identity", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(api.conversations.addUserMessage, {
        content: "test",
        timestamp: Date.now(),
      }),
    ).rejects.toThrow("Not authenticated");
  });
});
