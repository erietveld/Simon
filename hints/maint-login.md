# MAINT Login (hop.do) — Navigation Hints

> **Note:** This hint only applies to authorized ServiceNow employees. It may not work or may not be permitted depending on your role and permissions.

## Overview

ServiceNow instances can be accessed as the MAINT user via the `hop.do` endpoint on the `hihop.service-now.com` host. This is useful for administrative access that bypasses normal instance authentication.

## URL Pattern

```
http://hihop.service-now.com/hop.do?sysparm_instance=INSTANCENAME&mode=readwrite
```

- `sysparm_instance` — the instance name (e.g. `myinstance` for `myinstance.service-now.com`)
- `mode` — use `readwrite` for full access, or `readonly` for read-only access

## Example

For an instance named `myinstance`:
```
http://hihop.service-now.com/hop.do?sysparm_instance=myinstance&mode=readwrite
```

To open directly in the browser, use:
```bash
open "http://hihop.service-now.com/hop.do?sysparm_instance=INSTANCENAME&mode=readwrite"
```

## Gotchas

- Only works if you have MAINT-level access credentials on `hihop.service-now.com`
- Use the bare instance name, not the full hostname (drop `.service-now.com`)
- `readwrite` mode is required if you need to make changes; `readonly` is safer for browsing
