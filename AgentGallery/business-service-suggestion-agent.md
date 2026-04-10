# Business Service Suggestion Agent

Helps users find an existing business service in the CMDB that matches their needs, or guides them to request a new one via a catalog item.

## How it works

1. The user describes what business service they need (or provides a catalog item description).
2. The agent extracts keywords and queries the CMDB for existing business services with matching names.
3. If a match is found, the agent suggests it. If no match exists, the agent helps the user submit a request for a new business service through a catalog item.

## Agent configuration

| Setting | Value |
|---|---|
| **Strategy** | ReAct |
| **Channel** | NAP + Virtual Agent |
| **Execution mode** | Supervised (copilot) or Autonomous |
| **Triggers** | None — manually invoked via chat |

### Role

> You are an expert in comparing keywords in catalog item descriptions and suggesting a suitable business service. You compare user input against existing business service data and suggest matches or help create new ones.

### Instructions (Steps)

1. Understand the user's needs — take the catalog item description or keywords they provide.
2. Query existing business services by keyword match.
3. If a matching business service exists, suggest it to the user. If none match, help the user submit a request for a new business service.

## Tools

### Tool 1: Get Existing Business Services

| Setting | Value |
|---|---|
| **Type** | Record Lookup (CRUD) |
| **Table** | `cmdb_ci_service_business` |
| **Query** | `short_descriptionLIKE{{keyword}}` |
| **Returned fields** | `number`, `short_description` |
| **Record limit** | 3–5 |
| **Description** | Searches for business services whose short description contains the given keyword |

The `LIKE` operator enables fuzzy matching. The `{{keyword}}` placeholder is extracted by the agent from the user's description.

> **Table choice:** `cmdb_ci_service_business` is the specific Business Service table. The parent `cmdb_ci_service` also works but returns all service types (technical, application, etc.) — use the more specific table when only business services are relevant.

### Tool 2: Request New Business Service

| Setting | Value |
|---|---|
| **Type** | Catalog Item / Subflow |
| **Description** | Submits a catalog request for a new business service when no existing match is found |

This tool invokes a catalog item (or a subflow wrapping one) for creating new business service requests. No query inputs are needed — the agent passes context from the conversation.

## Prerequisites

- **Business services in CMDB** — existing records in `cmdb_ci_service_business` with meaningful `short_description` values that the keyword search can match against
- **Catalog item for new requests** — a catalog item that allows users to request a new business service. This must be published and accessible to the agent's run-as user

## Design considerations

- **LIKE vs exact match** — use `LIKE` for the lookup query. Exact match (`short_description={{keyword}}`) will miss partial matches and require the user to know the exact service name. `LIKE` is more forgiving.
- **Record limit** — returning 3–5 results gives the agent enough options to suggest without overwhelming the user.
- **Returned fields** — include both `number` and `short_description` so the agent can reference the service precisely.
- **Execution mode** — Supervised is safer for initial deployment (user confirms before the catalog request is submitted). Autonomous works well once the pattern is proven.

## Tips

- Use `cmdb_ci_service_business` (the specific Business Service table) rather than the broader parent `cmdb_ci_service`, which returns all service types.
- Use the `LIKE` operator for the lookup query — exact match requires the user to know the precise service name.
- The "Request New Business Service" tool can be shared across multiple agents since it references the same catalog item.
