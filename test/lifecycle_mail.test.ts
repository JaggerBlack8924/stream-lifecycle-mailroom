import assert from "node:assert/strict";
import test from "node:test";
import { lifecycleEventSchema, templateVarsFor } from "../src/lifecycle_mail";

test("creator delivery requires a valid download URL and exposes only delivery variables", () => {
  const rejected = lifecycleEventSchema.safeParse({
    event: "creator_delivery_ready",
    to: "creator@example.com",
    assetId: "asset-42",
    creatorName: "Mina",
    assetTitle: "Night Train",
  });
  assert.equal(rejected.success, false);

  const accepted = lifecycleEventSchema.parse({
    event: "creator_delivery_ready",
    to: "creator@example.com",
    assetId: "asset-42",
    creatorName: "Mina",
    assetTitle: "Night Train",
    downloadUrl: "https://media.example.com/delivery/asset-42?signature=demo",
  });
  assert.deepEqual(templateVarsFor(accepted), {
    creatorName: "Mina",
    assetTitle: "Night Train",
    downloadUrl: "https://media.example.com/delivery/asset-42?signature=demo",
  });
});
