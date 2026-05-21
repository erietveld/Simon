# Creating Records in a Specific Scope (esp. sys_properties)

## The Gotcha

When the simon CLI (or any Table API caller) creates a record on a scope-aware table like `sys_properties`, the resulting `sys_scope` is determined by the **calling user's `apps.current_app` preference** — *not* by the request body.

Setting `"sys_scope": "global"` in the create body is **silently ignored**. The scope field is overwritten by ServiceNow based on the session's current application context. This is a security boundary, by design.

## Symptoms

- You POST `/api/now/table/sys_properties` with `sys_scope: "global"` and a `glide.*`-prefixed name.
- The record is created, but lands in whichever scoped app the API user was last working in (e.g. `x_snc_yourapp`, `x_snc_loanmanager`).
- Subsequent `update` setting `sys_scope` to `global` also reverts.

## Diagnosis

1. Find which user simon authenticates as on this instance:
   ```bash
   simon api '/api/now/table/sys_user?sysparm_query=user_name=javascript:gs.getUserName()&sysparm_limit=1&sysparm_fields=user_name,sys_id' -i <instance>
   ```
2. Check that user's current app preference:
   ```bash
   simon query sys_user_preference -q "name=apps.current_app^user=<user_sys_id>" -i <instance> -f sys_id,value
   ```
3. Resolve the scope sys_id → name:
   ```bash
   simon get sys_scope <value> -i <instance> -f scope,name
   ```

## Fix — flip the preference, create, flip back

```bash
# 1. Save the original preference value, then switch to global
simon update sys_user_preference <pref_sys_id> -i <instance> --body '{"value":"global"}'

# 2. Create the record (now lands in global)
simon create sys_properties -i <instance> --body - <<'EOF'
{
  "name": "glide.foo.bar",
  "value": "true",
  "type": "boolean",
  "description": "..."
}
EOF

# 3. Restore original preference
simon update sys_user_preference <pref_sys_id> -i <instance> --body '{"value":"<original_scope_sys_id>"}'
```

Verify with `simon get sys_properties <new_sys_id> -f sys_scope.scope` — should show `global`.

## Alternatives (when the preference flip is undesirable)

- **Update-set XML import** — `sys_scope="global"` in the XML manifest is preserved on import.
- **Background script via `/sys.scripts.do`** with the Application picker set to *Global* — works but requires form-auth (sysparm_ck), awkward from CLI.

## Why Build Agent Sometimes "Fixes" Property Names

If a property is created in a scoped app with a `glide.*` (global-style) name, Build Agent's automatic linting may rename it to `<scope>.*` to match the app prefix and avoid collision warnings. If you actually wanted it global, you have to recreate it in global scope (this hint) and delete the renamed scoped one.

## Sources

- [Using system properties in a scoped application](https://www.servicenow.com/community/developer-forum/using-system-properties-in-a-scoped-application/m-p/2025013)
- [Scoped Application Philosophy](https://www.servicenow.com/community/developer-blog/background-and-philosophy-of-scoped-applications/ba-p/2285076)
