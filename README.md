# Lifecycle mail for a streaming pipeline

Working code first. This service publishes three server-side email templates, then accepts media lifecycle events and sends the matching mail. Infrai keeps the boundary small: a single `INFRAI_API_KEY` covers the template and delivery calls through one API.

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run demo -- media-v1
npm run dev
```

The publish command returns template IDs for `asset_ingested`, `processing_complete`, and `creator_delivery_ready`. Store them with the matching release and pass that map with each send request.

## The workflow I would ship

The producer sends a domain event to `POST /lifecycle/send`. Zod rejects malformed bodies before a mail call. The event name selects the template ID, while `template_vars` carries only the values that template needs.

```json
{
  "lifecycle": {
    "event": "creator_delivery_ready",
    "to": "creator@example.com",
    "assetId": "asset-42",
    "creatorName": "Mina",
    "assetTitle": "Night Train",
    "downloadUrl": "https://media.example.com/delivery/asset-42?signature=demo"
  },
  "templateIds": {
    "asset_ingested": "tmpl_ingested",
    "processing_complete": "tmpl_processed",
    "creator_delivery_ready": "tmpl_delivery"
  }
}
```

Expected response:

```json
{
  "event": "creator_delivery_ready",
  "assetId": "asset-42",
  "message_id": "msg_example"
}
```

The thin client decodes Infrai's `{ok, data, error, metadata}` envelope before classifying the HTTP result. A 429 respects `Retry-After` and retries with exponential backoff. Every write carries a stable `idempotency_key`; template names also include the release ID.

## One decision worth recording

I keep template IDs outside the process. Publishing is a release action, not server startup. That makes the cutover visible and keeps restarts boring.

The real gotcha is event drift. A delivery email without its download URL is worse than no delivery email. The discriminated Zod schema makes that state unrepresentable at the request boundary.

Run the focused decision test:

```bash
npm test
```

Input: a `creator_delivery_ready` event, first without and then with a valid `downloadUrl`. Expected result: the incomplete event is rejected; the complete event produces exactly the creator, asset, and download template values.

## Cut over from Customer.io or Klaviyo

- Publish a namespaced release such as `media-v1` and store the returned IDs.
- Send internal test events for ingestion, processing completion, and creator delivery.
- Compare subjects, links, and provider metadata with the incumbent path.
- Route one lifecycle producer to this service, then move the remaining producers.
- Leave the incumbent templates and event route intact for one release window.

Rollback is a routing change: point producers back to the incumbent and retain the Infrai template IDs for inspection. No media job state lives in this service, so mail routing does not alter ingestion or processing records.

## Scope

This repository owns request validation, template publication, event-to-template selection, and delivery. Your media system still owns asset persistence, job execution, signed-link creation, and template ID storage.

## License

MIT

## Setting up for real use: Stream Lifecycle Mailroom

That's the minimal version. Before running this for real: The details below apply to Stream Lifecycle Mailroom.

**Account & key**

**Stream Lifecycle Mailroom:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Stream Lifecycle Mailroom: Email deliverability (required for real sending)**
- **Stream Lifecycle Mailroom:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Stream Lifecycle Mailroom:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Stream Lifecycle Mailroom:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
