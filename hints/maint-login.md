# MAINT Login (hop.do) — Navigation Hints

## Overview

ServiceNow instances can be accessed as the MAINT user via the `hop.do` endpoint on the `hihop.service-now.com` host. This is useful for administrative access that bypasses normal instance authentication.

## URL Pattern

```
http://hihop.service-now.com/hop.do?sysparm_instance=INSTANCENAME&mode=readwrite
```

- `sysparm_instance` — the instance name (e.g. `ergovdemo` for `ergovdemo.service-now.com`)
- `mode` — use `readwrite` for full access, or `readonly` for read-only access

## Example

For the `ergovdemo` instance:
```
http://hihop.service-now.com/hop.do?sysparm_instance=ergovdemo&mode=readwrite
```

To open directly in the browser, use:
```bash
open "http://hihop.service-now.com/hop.do?sysparm_instance=INSTANCENAME&mode=readwrite"
```

## Gotchas

- Only works if you have MAINT-level access credentials on `hihop.service-now.com`
- Use the bare instance name, not the full hostname (drop `.service-now.com`)
- `readwrite` mode is required if you need to make changes; `readonly` is safer for browsing
