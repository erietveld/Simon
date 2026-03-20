# ServiceNow Context — How to Handle Unrecognised Terms

## What ETool Is For

ETool is primarily a tool for interacting with **ServiceNow environments**. Most conversations will involve querying, updating, or investigating records on one or more ServiceNow instances.

## When You Don't Recognise Something — Check Instances First

If the user mentions a word or name you don't recognise (e.g. "erlab1", "erdev", "daantje1", "benoitit"), it is very likely a **ServiceNow instance name** registered in ETool. Do not treat it as an unknown or ask for clarification before checking.

**Always check first:**
```
sn_instance_info   ← lists all registered instances with their IDs, URLs, and login state
```

Then switch to the relevant instance:
```
sn_switch_instance  instance_id: <id from sn_instance_info>
```

## Using MCP Tools

The MCP server provides ServiceNow tools **directly in this conversation**. Always use them directly — never delegate to a subagent for ServiceNow operations.

| Tool | Use for |
|------|---------|
| `sn_instance_info` | List all instances, check active instance and login state |
| `sn_switch_instance` | Switch the active instance before querying |
| `sn_query` | Query records from any table |
| `sn_get_record` | Fetch a single record by sys_id |
| `sn_create_record` | Create a new record |
| `sn_update_record` | Update fields on an existing record |
| `sn_delete_record` | Delete a record |
| `sn_table_structure` | Explore a table's schema and relationships |
| `sn_rest_api` | Generic REST call for anything not covered above |
| `sn_switch_update_set` | Switch the active update set |
