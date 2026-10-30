# AWS resources and cleanup

Everything was created by hand in the AWS Console, in **ap-southeast-2 (Sydney)**, account `590251390597`.
**Nothing here has been deleted.** Deleting is permanent: ask before deleting anything, and back up
anything you want to keep first.

## Inventory

| # | Service | Resource | Holds data? | Ongoing cost while idle |
|---|---|---|---|---|
| 1 | API Gateway | REST API `claimpilot-api`, stage `v1` | No | None (billed per request) |
| 2 | API Gateway | API key `claimpilot-web-server` | No | None |
| 3 | API Gateway | Usage plan `claimpilot-demo-plan` (5 req/s, 500/day) | No | None |
| 4 | Lambda | `claimpilot-api` | No | None (billed per invocation; Always Free tier) |
| 5 | Lambda | `claimpilot-processor` + DynamoDB stream trigger | No | None |
| 6 | DynamoDB | Table `claimpilots-claim` (provisioned 5 RCU / 5 WCU, stream on) | **Yes**: all claims, results, `USAGE#YYYY-MM` counters | Within Always Free (25 RCU/WCU, 25 GB) |
| 7 | S3 | Bucket `claim-pilot` (private, SSE-S3, CORS, HTTPS-only policy, 30-day lifecycle) | **Yes**: uploaded test PDFs under `uploads/` | A few KB of storage (fraction of a cent) |
| 8 | IAM | Role `claimpilot-api-lambda-role` + inline policy | No | None |
| 9 | IAM | Role `claimpilot-processor-role` + inline policy | No | None |
| 10 | CloudWatch Logs | `/aws/lambda/claimpilot-api`, `/aws/lambda/claimpilot-processor` (3-day retention) | Logs only | Within Always Free |
| 11 | CloudShell | Your home directory in ap-southeast-2 (used for the Textract/Bedrock checks) | Shell history | None |
| — | Bedrock | **No resources.** On-demand model calls only (Nova Lite, Nova Micro) | No | None while idle |
| — | Local | `.env.local` (holds the API key), `node_modules/`, `.next/` | Secret | — |

## Option A: Pause without deleting (reversible)

| To stop… | Do this | Undo |
|---|---|---|
| AI processing (all Bedrock usage) | Lambda `claimpilot-processor` → Configuration → Environment variables → `MONTHLY_LIMIT` = `0` | Set back to `50` |
| …or processing entirely | Lambda `claimpilot-processor` → Configuration → Triggers → select the DynamoDB trigger → **Disable** | **Enable** |
| All API traffic | API Gateway → API keys → `claimpilot-web-server` → **Edit** → set to **Inactive** (the portal then shows "temporarily unavailable") | Set back to **Active** |
| Browser uploads | S3 → `claim-pilot` → Permissions → CORS → remove the rule | Paste the rule from `docs/phase-2-aws-setup.md` back |

With A in place, nothing can generate new charges. Stored data stays, and costs essentially nothing.

## Option B: Delete everything (permanent)

**Before you start:**
- *Optional backup:* DynamoDB → `claimpilots-claim` → **Explore items** → select all → **Download** (CSV).
- **Replace or delete the API key first** if it has ever been shared. This one was pasted into a chat.

Delete in this order, so nothing is left calling something that's gone:

1. **Lambda `claimpilot-processor` → Configuration → Triggers:** delete the DynamoDB trigger.
2. **API Gateway → Usage plans → `claimpilot-demo-plan`:** remove the stage and the key, then delete the plan.
3. **API Gateway → API keys:** delete `claimpilot-web-server` (and any replacement key).
4. **API Gateway → APIs:** delete `claimpilot-api`.
5. **Lambda:** delete `claimpilot-processor` and `claimpilot-api`.
6. **DynamoDB → Tables → `claimpilots-claim`:**
   - if deletion protection is on, turn it off (*Additional settings*)
   - **Delete**, leaving "create a backup" **unticked** (backups cost money)
7. **S3 → `claim-pilot`:**
   - **Empty** (type *permanently delete*)
   - then **Delete** the bucket
8. **CloudWatch → Log groups:** delete `/aws/lambda/claimpilot-api` and `/aws/lambda/claimpilot-processor`.
9. **IAM → Roles:** delete `claimpilot-processor-role` and `claimpilot-api-lambda-role`.
10. *Optional:* **CloudShell → Actions → Delete** removes the home directory.
11. **Locally:** delete `.env.local`, so no key is left on disk.

**Afterwards:** check **Billing → Bills** the next day. There should be no new ClaimPilot usage.

> The Free plan account closes by itself on **2027-04-14** (or when credits run out), and every
> resource above goes with it. Deleting earlier only makes sense if you want the data gone sooner.
