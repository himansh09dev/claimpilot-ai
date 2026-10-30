# ClaimPilot AI — architecture diagram

Standalone documentation diagram. It is **not** part of the web app: nothing in `src/` imports, renders
or links these files.

| File | What it is |
|---|---|
| `claimpilot-architecture.excalidraw` | **Editable source** (native Excalidraw scene) |
| `claimpilot-architecture.pdf` | Vector PDF, for printing and sharing |
| `claimpilot-architecture.png` | 2783 × 1767 image, for slides and READMEs |
| `claimpilot-architecture.svg` | Vector image |

## Open and edit
- **Browser:** go to <https://excalidraw.com> → menu (☰) → **Open** → choose `claimpilot-architecture.excalidraw`.
  You can also drag the file onto the page. Nothing is uploaded unless you use Excalidraw's share or collaboration features.
- **VS Code:** install the *Excalidraw* extension (`pomdtr.excalidraw-editor`), then open the file.
- **Obsidian:** the *Excalidraw* plugin opens `.excalidraw` files too.

**Tips:**
- Cards, badges and arrow labels are grouped: click once to select the group, and double-click to edit text inside it.
- Arrows are bound to their cards and follow them when you move a card.

## Export after editing
In Excalidraw: menu → **Export image** → **PNG** or **SVG**.
For a PDF, open the exported SVG in a browser and **Print → Save as PDF**.
Save your changes back over the `.excalidraw` file with menu → **Save to…**.

## What the diagram shows
- **Four stages:** Customer Portal → AWS API & Storage → AI Verification Workflow → Results Dashboard.
- **15 numbered data flows:**
  - HTTPS requests
  - the direct presigned upload to S3
  - claim metadata
  - stream events
  - AI requests
  - processing results
  - the status and results read path
- **Status badges:**
  - **✓ Implemented & tested** (verified on real AWS)
  - **✋ Manual process** (the human reviewer)
  - **✕ Blocked on Free plan** (Amazon Textract)
  - **○ Optional · not used** (Step Functions, EventBridge, SQS, SNS, public hosting)
- **Cost badges:** *Always Free tier* vs *Uses credits* (Bedrock, API Gateway, S3). Nothing is presented
  as free unless it falls within an Always Free allowance.

The PDF, PNG and SVG were produced from the `.excalidraw` file with a small local renderer and Chrome's
print-to-PDF. They can differ very slightly from Excalidraw's own rendering, mainly in text spacing.
