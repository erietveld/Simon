---
name: build-agent-ai-agent-install-issues
description: Recurring problems when ServiceNow Build Agent installs or updates an AI Agent — silent CRUD no-op writes, duplicate RAG retrievers. Detection queries and fix recipes via `simon`.
type: hint
---

# Build Agent — Recurring AI Agent Install Issues

Problems that reappear every time Build Agent installs or updates an AI Agent. Each entry has the **symptom**, a one-command **detection query**, a **fix recipe** using `simon`, and notes on the underlying cause so we can hand this to R&D later.

Issues are scoped to AI Agent configuration — `sn_aia_tool`, `sn_aia_agent_tool_m2m`, and the CRUD/script tool definitions Build Agent generates.

---

## 1. CRUD-tool field-value mapping not generated (silent no-op writes)

**Status:** open, first observed 2026-05-12.

### Symptom

A CRUD-type tool with `operation=update` reports `"X out of X record(s) updated"` with `status=success`, but the target field on the record is **unchanged**. The audit history shows no field change either. The agent moves on thinking the write succeeded.

### Why it happens

The tool's invocation `metadata.inputs.crudInputs` has `operation`, `table`, and `query` populated, but the **`fieldValues` array is missing entirely**. The CRUD tool boilerplate script (the one Build Agent generates verbatim) does:

```js
var fieldValues = inputs.crudInputs.fieldValues ? inputs.crudInputs.fieldValues : [];
```

So `fieldValues` becomes `[]`, the `setValue` loop runs zero times, and `gr.update()` still returns the record's sys_id (because the record was queried + writable) — which the script counts as a successful update. Hence "success" with no actual change.

The tool's `input_schema` declares the input variable (e.g. `new_state`), but Build Agent doesn't generate the mapping (e.g. `state ← {{new_state}}`) that the runtime needs to convert that input into a `fieldValues` entry. The mapping lives in CRUD-tool configuration on the agent↔tool m2m row.

### Detection

Inspect the most recent tool execution's metadata. If `crudInputs.fieldValues` is absent on an `update` operation, the bug is present:

```bash
simon query sn_aia_execution_task \
  -q "execution_plan=<plan_sys_id>^type=tool^descriptionLIKE<tool name>" \
  -f description,metadata,output --output stdout -i <instance>
```

Look at `metadata.inputs.crudInputs` — if it's `{operation, table, query}` without `fieldValues`, the mapping is missing.

A faster probe (no run needed): pull the tool record and check whether the agent↔tool m2m row has any field-value mapping in its `inputs` JSON.

### Fix recipe

The CRUD field-value mapping lives in **`sn_aia_agent_tool_m2m.inputs`** — a JSON-encoded string on the agent↔tool link row (NOT on the `sn_aia_tool` record itself). It's an array of input bindings; the `crudInputs` entry's `value` must include a `fieldValues` array. Each entry maps a record column to a value, with `{{var}}` templating into the tool's other inputs.

Generate the patch body, then PATCH the m2m row. Generic shape:

```bash
python3 <<'PY' > /tmp/patch_body.json
import json
crud_inputs = {
  "operation": "update",
  "table": {"value": "<target_table>", "displayValue": "<target_table>"},
  "query": "<encoded_query_with_{{input_var}}_templating>",
  "fieldValues": [
    {
      "field": {
        "excludedOperators": [], "extendedOperators": None,
        "name": "<field_name>", "label": "<Field Label>", "type": "choice",
        "referenceTable": None, "referenceTableDefaultField": None, "referenceKey": None,
        "dictionaryAttributes": [], "id": "<field_name>", "sublabel": "<field_name>"
      },
      "value": {"fieldValue": "{{<input_var>}}"}
    }
  ]
}
inputs = [
  {"name": "<input_var_1>", "value": "", "description": "...", "mandatory": True, "invalidMessage": None},
  {"name": "<input_var_2>", "value": "", "description": "...", "mandatory": True, "invalidMessage": None},
  {"name": "crudInputs",    "value": crud_inputs, "description": "Update operation configuration", "mandatory": True, "invalidMessage": None}
]
print(json.dumps({"inputs": json.dumps(inputs)}))
PY

simon update sn_aia_agent_tool_m2m <m2m_sys_id> -i <instance> --body @/tmp/patch_body.json
```

The `field` object shape (the verbose dict with `excludedOperators`, `dictionaryAttributes`, `sublabel`, etc.) mirrors the one Now Assist Studio generates for its CRUD `returnFields` entries — model new mappings on the structure seen in a known-working tool's `inputs` JSON (e.g. `Lookup KB Scope`).

For non-choice fields, change `field.type` to `"string"`, `"integer"`, or set `field.referenceTable` for references. The `parseValue` helper in the CRUD-tool script handles each branch.

### Reproducer / verification

After applying the fix, re-trigger the agent and verify the target field updated:

```bash
simon get <target_table> <record_sys_id> -f <field>,sys_updated_on,sys_updated_by -i <instance>
```

`sys_updated_by` should be the agent's run-as identity, not the original creator.

---

## 2. Duplicate AIA RAG Retriever attached to the agent

**Status:** intermittent, first observed 2026-05-12. The duplicate reappears after Build Agent re-runs.

### Symptom

The agent has the **same** RAG tool linked twice via `sn_aia_agent_tool_m2m`. Both rows point to the same `sn_aia_tool` (or two near-identical RAG tools with the same name "AIA RAG Retriever" and the same generic description "Use this tool to retrieve information"). The LLM can pick either, leading to inconsistent reasoning and wasted tokens.

### Why it happens

Hypothesis: Build Agent re-attaches the RAG retriever on every install/update without first checking if a tool with that name+type is already linked. Two near-simultaneous m2m rows result.

### Detection

```bash
simon query sn_aia_agent_tool_m2m \
  -q "agent=<agent_sys_id>^tool.type=rag" \
  -f sys_id,tool.sys_id,tool.name,sys_updated_on \
  -l 50 -i <instance>
```

If you see two rows where `tool.name` is "AIA RAG Retriever" (or any RAG tool name repeats), the bug is present. Note both the m2m `sys_id` and the `tool.sys_id` — they may be different tool records pointing at the same underlying RAG configuration.

### Fix recipe

Delete the **older** m2m link (keep the most recently created one in case Build Agent's latest version has the correct config). Identify the two m2m rows, then:

```bash
simon delete sn_aia_agent_tool_m2m <older_m2m_sys_id> -i <instance>
```

If both tools are genuinely separate `sn_aia_tool` records, also consider deleting the duplicate `sn_aia_tool` record itself once it's not referenced by any agent:

```bash
# Only after detaching from all agents:
simon delete sn_aia_tool <duplicate_tool_sys_id> -i <instance>
```

### Verification

```bash
simon query sn_aia_agent_tool_m2m -q "agent=<agent_sys_id>^tool.type=rag" \
  -f tool.name -i <instance>
```

Exactly one row should remain.

---

## How to use this doc

1. After Build Agent rebuilds/updates an AI Agent, run both detection queries before kicking off a test run.
2. Apply the fix recipes for any matches.
3. If a **new** recurring symptom appears, add a section here with the same shape: Symptom / Why / Detection / Fix / Verification.
4. When sharing with R&D: this file is the source of truth — point them at it via a PR or paste the relevant section into an internal ticket.
