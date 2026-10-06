import { createServer, type ServerResponse } from "node:http";
import { ZodError, z } from "zod";
import { InfraiError } from "./infrai_email";
import {
  lifecycleEventSchema,
  publishLifecycleTemplates,
  publishTemplatesSchema,
  sendLifecycleMail,
  type Stage,
} from "./lifecycle_mail";

const templateIdsSchema = z.object({
  asset_ingested: z.string().min(1),
  processing_complete: z.string().min(1),
  creator_delivery_ready: z.string().min(1),
});
const sendRequestSchema = z.object({
  lifecycle: lifecycleEventSchema,
  templateIds: templateIdsSchema,
});

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: AsyncIterable<Uint8Array>) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/templates/publish") {
      const input = publishTemplatesSchema.parse(await readJson(request));
      return json(response, 201, { templateIds: await publishLifecycleTemplates(input.releaseId) });
    }
    if (request.method === "POST" && request.url === "/lifecycle/send") {
      const input = sendRequestSchema.parse(await readJson(request));
      return json(
        response,
        202,
        await sendLifecycleMail(input.lifecycle, input.templateIds as Record<Stage, string>),
      );
    }
    return json(response, 404, { error: "route_not_found" });
  } catch (error) {
    if (error instanceof ZodError) return json(response, 400, { error: "invalid_request", issues: error.issues });
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return json(response, status, { error: error.detail.code ?? "email_request_rejected" });
    }
    console.error(error);
    return json(response, 500, { error: "internal_error" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`mailroom listening on http://localhost:${port}`));
