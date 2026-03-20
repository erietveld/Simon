# Update Set Import — Navigation Hints

## Direct Upload URL (with SN menu header)

Use the `now/nav/ui/classic/params/target/` wrapper to get the full SN menu header:

```
https://INSTANCE.service-now.com/now/nav/ui/classic/params/target/upload.do%3Fsysparm_referring_url%3Dsys_remote_update_set_list.do%253Fsysparm_fixed_query%253Dsys_class_name%253Dsys_remote_update_set%26sysparm_target%3Dsys_remote_update_set
```

## Navigate Active Chrome Tab

After hopping into an instance (which opens a new tab), navigate that same tab to the import screen:

```bash
osascript -e 'tell application "Google Chrome" to set URL of active tab of front window to "https://INSTANCE.service-now.com/now/nav/ui/classic/params/target/upload.do%3Fsysparm_referring_url%3Dsys_remote_update_set_list.do%253Fsysparm_fixed_query%253Dsys_class_name%253Dsys_remote_update_set%26sysparm_target%3Dsys_remote_update_set"'
```

## Gotchas

- Replace `INSTANCE` with the bare instance name (e.g. `myinstance`)
- The `now/nav/ui/classic/params/target/` wrapper preserves the SN menu header; the bare `upload.do?...` URL loses it
- After hopping, the new tab is the active tab — navigate it immediately before switching focus elsewhere
- After uploading, the update set lands in the Retrieved Update Sets list (`sys_remote_update_set_list.do`)
