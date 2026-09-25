# n8n-nodes-smtping

n8n community node for [SMTPing](https://smtping.com): verify email addresses inside any workflow, before they reach your CRM, ESP or database.

## Install

In n8n: **Settings > Community Nodes > Install**, then enter `n8n-nodes-smtping`.

Self-hosted from source:

```bash
npm install
npm run build
npm link
# in your n8n custom folder (~/.n8n/custom)
npm link n8n-nodes-smtping
```

## Credentials

Create an API key in the [SMTPing dashboard](https://app.smtping.com/), then add an **SMTPing API** credential in n8n. The credential test calls `GET /credits`.

## Operations

| Resource | Operation | Endpoint | Output |
|---|---|---|---|
| Email | Verify | `POST /verify/single` | Full verdict, flags, `band` |
| Check | Spamtrap, Disposable, Spambot, Complainer | `POST /checks/{check}` | `matched` true or false |
| Bulk Job | Submit | `POST /verify/bulk` | `jobId`, or one item per address when "Wait for Results" is on |
| Bulk Job | Get Status | `GET /verify/bulk/{jobId}` | `status`, `processedEmails` |
| Bulk Job | Get Results | `GET /verify/bulk/{jobId}/result` | One item per address |
| Account | Get Credits | `GET /credits` | Remaining balance |

### The `band` field

Verify and bulk results get an extra `band` field so routing needs a single Switch node:

| band | Verdicts |
|---|---|
| `safe` | valid, alias |
| `avoid` | invalid, spamtrap, disposable, blacklisted, complainer, spambot, inbox_full |
| `judgement` | catchall, valid_catchall, unknown |

Turn it off in **Options > Add Band Field**.

## Example workflows

**Clean new form leads**: Webhook (Typeform, Tally...) > SMTPing Verify > Switch on `band` > `safe` to HubSpot, `avoid` to a Slack alert.

**Nightly list hygiene**: Schedule > Google Sheets (read) > SMTPing Bulk Submit (Wait for Results, 30 min) > Google Sheets (update verdict column).

**Large lists**: submit without waiting, store the `jobId`, then a second workflow on a schedule runs Get Status and, once `Succeeded`, Get Results.

## Credits and limits

One credit per address; `unknown` verdicts are free. Each fast check costs one credit. Rate limits follow your SMTPing plan; the bulk poller retries automatically on 409, 429 and 5xx responses.

## License

MIT
