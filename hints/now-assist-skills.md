# Now Assist Skills — Query Hints

## Key Tables

| Table | Purpose |
|-------|---------|
| `sn_nowassist_skill_config` | Skill definitions — `skill_family`, `skill_id`, `state` (1=Published) |
| `sn_nowassist_skill_config_status` | **Live activation state** — written by Now Assist admin UI "Turn on"; has `active`, `in_product_active`, `in_product_roles` |
| `sn_nowassist_skill_family` | Skill family groupings (Creator, ITSM, Flow, Code, etc.) |
| `sys_now_assist_deployment` | Deployment channels (Developer panel, VA, UI Builder, etc.) |
| `sys_app_module` | Navigation menu items — useful for finding admin console URLs |

---

## Efficient Queries

### Find all inactive Creator skills (single query)
```
sn_query:
  table: sn_nowassist_skill_config
  query: active=false^skill_family.nameINCode,App,Flow,Playbook,UI Generation,Build Agent,Automated Testing,Mobile configuration,Service Catalog
  fields: name,active,skill_family,state
  display_value: true
  limit: 100
```

### Find all skills with active status across all families
```
sn_query:
  table: sn_nowassist_skill_config
  fields: name,active,skill_family,state
  display_value: true
  limit: 200
```
> Raise limit to 200+ — there are ~100 skill configs on a typical instance.

### Look up a skill family's sys_id
```
sn_query:
  table: sn_nowassist_skill_family
  query: name=Creator
  fields: name,sys_id,description
```

### Filter skills by family sys_id
```
sn_query:
  table: sn_nowassist_skill_config
  query: skill_family=<sys_id>^active=false
  fields: name,active,state
```

### Find the Now Assist Admin console URL
```
sn_query:
  table: sys_app_module
  query: titleLIKEnow assist
  fields: title,link_type,query
  display_value: true
```
Result: `query: now/now-assist-admin/home` → `https://<instance>/now/now-assist-admin/home`

### Get the skill activation URL for a given family
The Now Assist admin skill list URL uses the `sn_nowassist_skill_family` sys_id:
```
https://<instance>/now/now-assist-admin/skill-list/<sn_nowassist_skill_family.sys_id>
```
To get the sys_id:
```
sn_query:
  table: sn_nowassist_skill_family
  query: name=Creator
  fields: name,sys_id
```
Then open `https://<instance>/now/now-assist-admin/skill-list/<sys_id>` and click **Turn on** next to the skill.
Use `sys_metadata/<sys_id>` (returns `sys_class_name` + `sys_name`) to reverse-look up an unknown sys_id from a URL.

### List all deployment channels and active state
```
sn_query:
  table: sys_now_assist_deployment
  fields: name,active,description
  display_value: true
```

---

## Gotchas

- The **"Creator" skill family** (`name=Creator`) has **0 direct skills** assigned to it. Creator skills are spread across sub-families: `Code`, `App`, `Flow`, `Playbook`, `UI Generation`, `Build Agent`, `Automated Testing`, `Mobile configuration`, `Service Catalog`. Use `skill_family.nameIN` dot-walk to query across these.
- `sn_nowassist_skill_config` returns max 100 records by default — always set `limit: 200`.
- `sys_now_assist_deployment_config` fields are mostly reference links — the `sn_ns_config_m2m_skill` table maps deployments to skills but requires multiple joins.
- The Now Assist Admin UI URL is stored in `sys_app_module.query` as a relative path, not a full URL.
- **`sn_nowassist_skill_config.active` is deprecated.** The real activation state is in `sn_nowassist_skill_config_status` (`active` + `in_product_active`). The Now Assist admin "Turn on" button writes to `sn_nowassist_skill_config_status`, not `sn_nowassist_skill_config`.
- Required roles per skill are in `sn_nowassist_skill_config_status.in_product_roles` (comma-separated role names).

