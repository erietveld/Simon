# ServiceNow Product Documentation — Hints

Public product docs (the human-readable site at servicenow.com/docs) are mirrored as markdown in a public GitHub repo, **optimised for LLM consumption**. Use this when the user asks conceptual or product-feature questions ("how does MITRE ATT&CK work in SIR", "what is Vulnerability Response", "what's the canonical setup for X") — anything answered by product docs rather than by poking at their instance.

## Repo

```
https://github.com/ServiceNow/ServiceNowDocs
```

Branches are named after ServiceNow release families (e.g. `xanadu`, `yokohama`, `zurich`, `australia`, …). The repo holds the **three most recently released families**, plus a fourth if a new release is in early access. **The newest branch name rotates with each GA** — do not hardcode it.

## Step 1 — Discover the current latest branch

`llms.txt` at the root of any active branch tells you which family is latest and lists every publication folder.

```bash
# Pick any plausibly-current branch; the file itself names the latest one.
curl -s "https://raw.githubusercontent.com/ServiceNow/ServiceNowDocs/australia/llms.txt"
```

Look for the line `"<family>" : "<family>" -- <Family> family` marked as the latest, and the `## Documents` section which lists every publication folder with its display title. Treat that map as authoritative (it has more entries than the cheat sheet below).

Cache the branch name for the rest of the session.

## Step 2 — Find the right folder

Quick-lookup shortcuts for common areas (verify against `llms.txt` if anything seems off):

| Topic | Folder |
|---|---|
| SIR / MSIM / Threat Intel / Vuln Response | `security-management` |
| ITSM | `it-service-management` |
| GRC / Compliance | `governance-risk-compliance` |
| Flow Designer / Subflows | `build-workflows` |
| ACLs / Roles / Platform Security | `platform-security` |
| REST / Table API / scripting reference | `api-reference` |
| AI Agent / Now Assist / Virtual Agent | `conversational-interfaces` |
| Platform scripting (GlideRecord, business rules) | `now-platform` |
| Performance Analytics | `now-intelligence` |
| Mobile | `mobile` |
| PDI / Personal Developer Instance / dev sandbox | `application-development` |

The table is shortcuts for common questions, **not exhaustive**. Many topics live under a broader parent — e.g. PDI docs are under `application-development`, not a dedicated folder. If the topic isn't in `llms.txt`'s `## Documents` section as its own publication, guess the likely parent and list its files (Step 3).

## Step 3 — List files in the folder

```bash
# GitHub contents API — returns JSON array of files in the folder
curl -s -H "Authorization: Bearer $(cat .secrets/github-pat)" \
  "https://api.github.com/repos/ServiceNow/ServiceNowDocs/contents/markdown/<folder>?ref=<branch>"
```

Or fetch the folder's own `index.md` for a curated outline:

```bash
curl -s "https://raw.githubusercontent.com/ServiceNow/ServiceNowDocs/<branch>/markdown/<folder>/index.md"
```

**Filename grep pattern** (when you know the parent folder and want to scan filenames):

```bash
curl -s -H "Authorization: Bearer $(cat .secrets/github-pat)" \
  "https://api.github.com/repos/ServiceNow/ServiceNowDocs/contents/markdown/<folder>?ref=<branch>" \
  | grep -iE '"name".*(pdi|email|whatever)'
```

**Full-text search across the repo** (when you don't know which folder the topic lives in):

```bash
curl -s -H "Authorization: Bearer $(cat .secrets/github-pat)" \
  "https://api.github.com/search/code?q=%22domain+separation%22+repo:ServiceNow/ServiceNowDocs+path:markdown/application-development+extension:md" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); [print(i['path']) for i in d['items'][:20]]"
```

Useful query qualifiers: `"quoted phrase"`, `path:markdown/<folder>` (narrow scope), `extension:md`, `repo:ServiceNow/ServiceNowDocs`.

**Search gotchas:**
- **Hits every branch.** A file present on `xanadu`/`yokohama`/`zurich`/`australia` appears 3–4 times in results, inflating `total_count`. Dedupe on `path`, or filter `html_url` to the latest branch.
- **No `branch:` qualifier exists.** You can't pre-filter by branch in the query — filter client-side instead.
- Requires authentication (`/search/code` returns 401 unauth).

## Step 4 — Fetch the specific doc

```bash
curl -s "https://raw.githubusercontent.com/ServiceNow/ServiceNowDocs/<branch>/markdown/<folder>/<file>.md"
```

Each markdown file has YAML frontmatter:

```yaml
title: ...
release: australia
last_updated: "2026-03-12"
canonical_url: ...   # OPTIONAL — not always present
topic_type: concept | task | reference
```

When citing back to the user:
- If `canonical_url` is in the frontmatter, prefer it (links to the human-readable docs page).
- Otherwise just cite the raw URL you already fetched, or the equivalent `https://github.com/ServiceNow/ServiceNowDocs/blob/<branch>/markdown/<folder>/<file>.md` blob URL (GitHub renders the markdown nicely).

## Gotchas / Don'ts

- **Do NOT grep any local clone of ServiceNowDocs.** Always go live to GitHub — the docs are updated at least monthly and the local copy will drift.
- **Do NOT fetch from `servicenow.com/docs`.** It's a JavaScript SPA and returns no readable content.
- **Branch name will go stale.** When a new family GA's, the oldest branch is deleted. If a fetch 404s, re-read `llms.txt` to discover the new latest branch.
- **GitHub API rate limits.** A PAT is stored at `.secrets/github-pat` (gitignored, project-relative — run from Simon project root). Always pass it on `api.github.com` calls via `-H "Authorization: Bearer $(cat .secrets/github-pat)"`. Limits are tracked per resource:
  - **core** (contents, repo metadata): 5000/hr authenticated, 60/hr unauth.
  - **search** (`/search/code`): 30/min authenticated, blocked entirely unauth.
  - Raw `raw.githubusercontent.com` fetches don't need auth and don't count against either limit — use them freely once you know the file path.
- **HTML entities in titles.** Frontmatter `title` may contain `&amp;` etc. — decode before showing to the user.
- **Don't confuse with internal docs.** This repo is the public product documentation. Internal-only material (engineering wikis, internal runbooks) is not here.
