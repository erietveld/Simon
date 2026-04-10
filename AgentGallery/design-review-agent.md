# Design Review Agent

Reviews a citizen developer's application or solution design against the organization's architectural guidelines and produces an improvement report.

## How it works

1. The user provides an incident number that contains their design proposal.
2. The agent fetches the design details from the incident (short description + description).
3. The agent fetches the architectural guidelines from a Knowledge Base article.
4. The agent compares the design against the guidelines and produces a report highlighting shortcomings and improvement suggestions.

## Agent configuration

| Setting | Value |
|---|---|
| **Strategy** | ReAct |
| **Channel** | NAP + Virtual Agent |
| **Execution mode** | Supervised (copilot) |
| **Triggers** | None — manually invoked via chat |

### Role

> You help the citizen developer to review their design by referencing the architectural guidelines.

### Instructions (Steps)

1. Open the design suggestion provided by the user (from an incident).
2. Read the architectural guidelines (from a KB article).
3. Compare the design against the guidelines and create a report about architectural shortcomings with improvement suggestions.

## Tools

### Tool 1: Load Design Request

| Setting | Value |
|---|---|
| **Type** | Record Lookup (CRUD) |
| **Table** | `incident` |
| **Query** | `number={{number}}` |
| **Returned fields** | `short_description`, `description` |
| **Description** | Loads the design proposal from an incident record |

The `{{number}}` placeholder is filled by the agent from the user's input (e.g. "INC0010042").

### Tool 2: Load Architecture Document

| Setting | Value |
|---|---|
| **Type** | Record Lookup (CRUD) |
| **Table** | `kb_knowledge` |
| **Query** | `short_description=Architecture` |
| **Returned fields** | `wiki` (article body) |
| **Description** | Loads the architectural guidelines from a KB article |

This tool uses a fixed query — it always fetches the KB article whose short description is "Architecture". A `LIKE` operator (`short_descriptionLIKEarchitecture`) is a valid alternative if the exact title may vary.

## Prerequisites

- **Incident with design proposal** — the user must have created an incident where:
  - `short_description` contains a summary of the design
  - `description` contains the full design details
- **KB article titled "Architecture"** — a Knowledge Base article with `short_description` = "Architecture" containing the organization's architectural guidelines in the `wiki` field

## Tips

- Using `LIKE` instead of exact match on the KB lookup (`short_descriptionLIKEarchitecture`) makes the tool more resilient to minor title variations.
- Explicitly asking for "a structured report about architectural shortcomings" in the instructions produces better formatted output from the agent.
