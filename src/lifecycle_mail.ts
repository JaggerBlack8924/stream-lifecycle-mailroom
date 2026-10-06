import { z } from "zod";
import { infrai } from "./infrai_email";

export const lifecycleEventSchema = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("asset_ingested"),
    to: z.string().email(),
    assetId: z.string().min(1),
    creatorName: z.string().min(1),
    assetTitle: z.string().min(1),
  }),
  z.object({
    event: z.literal("processing_complete"),
    to: z.string().email(),
    assetId: z.string().min(1),
    creatorName: z.string().min(1),
    assetTitle: z.string().min(1),
    durationSeconds: z.number().int().positive(),
  }),
  z.object({
    event: z.literal("creator_delivery_ready"),
    to: z.string().email(),
    assetId: z.string().min(1),
    creatorName: z.string().min(1),
    assetTitle: z.string().min(1),
    downloadUrl: z.string().url(),
  }),
]);

export type LifecycleEvent = z.infer<typeof lifecycleEventSchema>;
export type Stage = LifecycleEvent["event"];

const templates = {
  asset_ingested: {
    subject: "{{assetTitle}} is safely ingested",
    html: "<p>Hi {{creatorName}},</p><p>We received <strong>{{assetTitle}}</strong>. Processing has started.</p>",
  },
  processing_complete: {
    subject: "{{assetTitle}} finished processing",
    html: "<p>Hi {{creatorName}},</p><p><strong>{{assetTitle}}</strong> is processed. Runtime: {{durationSeconds}} seconds.</p>",
  },
  creator_delivery_ready: {
    subject: "Your delivery of {{assetTitle}} is ready",
    html: "<p>Hi {{creatorName}},</p><p><a href=\"{{downloadUrl}}\">Download {{assetTitle}}</a></p>",
  },
} satisfies Record<Stage, { subject: string; html: string }>;

export const publishTemplatesSchema = z.object({
  releaseId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,39}$/),
});

export async function publishLifecycleTemplates(releaseId: string) {
  const entries = await Promise.all(
    Object.entries(templates).map(async ([stage, copy]) => {
      const name = `stream-lifecycle-${releaseId}-${stage}`;
      const data = await infrai.email.template.create({
        name,
        subject: copy.subject,
        html: copy.html,
        idempotency_key: `template:${name}`,
      });
      return [stage, data.template_id] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<Stage, string>;
}

export function templateVarsFor(event: LifecycleEvent): Record<string, string | number> {
  const common = {
    creatorName: event.creatorName,
    assetTitle: event.assetTitle,
  };
  if (event.event === "processing_complete") {
    return { ...common, durationSeconds: event.durationSeconds };
  }
  if (event.event === "creator_delivery_ready") {
    return { ...common, downloadUrl: event.downloadUrl };
  }
  return common;
}

export async function sendLifecycleMail(
  event: LifecycleEvent,
  templateIds: Record<Stage, string>,
) {
  const data = await infrai.email.send({
    to: event.to,
    template_id: templateIds[event.event],
    template_vars: templateVarsFor(event),
    idempotency_key: `lifecycle:${event.event}:${event.assetId}:${event.to}`,
  });
  return { event: event.event, assetId: event.assetId, message_id: data.message_id };
}
