# IDE File Index Crash (syncStepsV2 / readFile / .slice()) — Troubleshooting Guide

## Symptom

The ServiceNow web IDE (Studio / Glider IDE) fails to load with this console error:

```
workbench.web.main.js TypeError (FileSystemError): Cannot read properties of undefined (reading 'slice')
  at $Y$b.e (extensionHostWorker.js)
  at Object.readFile (extensionHostWorker.js)
  at async vt.getFiles (sn_glider_app/extensions/synchrotron/dist/web/extension.js)
  at async Dt.syncStepsV2 (...)
```

The IDE shows a blank workspace or never finishes loading. Shift-refresh does not help.

## Key Tables

| Table | Purpose |
|---|---|
| `sn_glider_ide_file_index` | Virtual filesystem index — one record per file/dir. Has `type` (file/dir), `content` (reference to file_content), `dtime` (deletion timestamp, non-empty = soft-deleted "tombstone"), `uri` (path) |
| `sn_glider_ide_file_content` | Actual file content blobs, referenced by `file_index.content` |

Both tables are in the `sn_glider` scope and protected by a **cross-scope ACL** that only allows the `sn_glider` scope itself to write/delete.

## Root Cause

The synchrotron extension's `syncStepsV2 → getFiles` iterates ALL `sn_glider_ide_file_index` entries including "tombstones" — records where `dtime` is set (soft-deleted) but `content` is empty or references a missing `sn_glider_ide_file_content` record. When `readFile` is called on such a record, it returns `undefined`, and the subsequent `.slice()` call crashes.

**Common cause of tombstones:** deleting files or directories (including HiddenWorkspace directories) through the IDE. The IDE soft-deletes by setting `dtime` rather than removing the record. Over time, these tombstones accumulate — particularly from HiddenWorkspace dirs that were created but never properly cleaned up. Despite the name, HiddenWorkspace directories are visible in the file index and their tombstones are iterated by the sync engine like any other record.

## How to Diagnose

### 1. Check for tombstoned file records

```bash
simon api '/api/now/stats/sn_glider_ide_file_index?sysparm_count=true&sysparm_query=type%3Dfile%5Edtime%21%3D' -i <instance>
```

Any count > 0 means tombstones exist.

### 2. List the tombstones

```
https://<instance>.service-now.com/sn_glider_ide_file_index_list.do?sysparm_query=type%3Dfile%5Edtime%21%3D
```

### 3. Also check for tombstoned directories

```bash
simon api '/api/now/stats/sn_glider_ide_file_index?sysparm_count=true&sysparm_query=dtime%21%3D' -i <instance>
```

## Resolution

### Step 1 — Delete tombstone records via MAINT

Normal admin access **cannot** delete from `sn_glider_ide_file_index` due to the cross-scope ACL. You must use MAINT:

```
http://hihop.service-now.com/hop.do?sysparm_instance=<instance>&mode=readwrite
```

Once logged in as MAINT, navigate to the tombstone list and bulk-delete:

```
https://<instance>.service-now.com/sn_glider_ide_file_index_list.do?sysparm_query=dtime%21%3D
```

Select all → right-click → **Delete**.

### Step 2 — Clear browser sync state

The synchrotron extension caches its sync checkpoint in the browser (IndexedDB / localStorage). Even after deleting the tombstones on the server, the browser may still try to process them from its local cache.

In Chrome: **F12 → Application → Storage → Clear site data** (check all boxes). Then reload the IDE.

### Step 3 (nuclear) — Wipe both IDE tables if crash persists

If the crash continues after Steps 1-2, there may be orphaned content references or other data corruption. Nuke both tables via MAINT:

```
https://<instance>.service-now.com/sn_glider_ide_file_index_list.do
https://<instance>.service-now.com/sn_glider_ide_file_content_list.do
```

Delete **all** records in both tables. These are a cache — the IDE rebuilds the full index from the actual application files on next sync.

## What Does NOT Work (Dead Ends)

| Approach | Why it fails |
|---|---|
| REST DELETE via Table API | 403 — cross-scope ACL blocks `sn_glider` table writes from any external scope |
| Background script `gr.deleteRecord()` | Blocked: cross-scope policy (`rhino.global` → `sn_glider`) |
| REST PATCH to clear `dtime` or change `type` | 403 — same ACL |
| Creating a Script Include in `sn_glider` scope | Scope assignment is ignored by REST; record lands in your active scope instead |
| Adding `sys_scope_privilege` for global→delete | Blocked by a business rule on the privilege table |
| `sys_trigger` scheduled jobs | Only works if the scheduler is running on the instance; on dev/POV instances it often isn't |
| Shift-refresh / hard reload in browser | Does not clear IndexedDB/localStorage where synchrotron stores its checkpoint |

## Gotchas

- **MAINT is the only reliable write path** to `sn_glider_ide_file_index`. All REST, background script, and scope-privilege workarounds fail.
- **Browser cache must also be cleared** — server-side cleanup alone may not be sufficient because the synchrotron extension caches sync state client-side.
- **HiddenWorkspace directories** are visible in the file index despite their name. Their tombstones cause the same crash as regular file tombstones.
- The `sn_glider` scope sys_id is `fd254d9443a161100967247e6bb8f200` — useful when inspecting ACL and cross-scope privilege records.
