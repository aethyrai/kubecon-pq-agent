---
title: MCP tool schema change
description: A tool schema change must update the web client call and the tool's test fixture
type: check
when: PRs that add or modify a tool definition, its input schema, or its output shape in apps/mcp-server/
actions: Verify the web client and the test fixture were updated; request changes if not
---

When a PR changes a tool in `apps/mcp-server/` (`search_sessions`, `get_schedule`, `recommend`,
`find_people`, `find_booths`, `side_events`, `room_accessibility`, `check_conflicts`, `whats_next`,
`logistics`) or a resource or
prompt:

- Check that the matching call in `apps/web/` sends the new input shape and renders the new output
  shape, including session id chips.
- Check that the tool's test fixture in `apps/mcp-server/` was updated to the new schema.
- Check that the shared types in `packages/schema/` were changed in the same PR, not hand-copied.
- Request changes if the client or the fixture is stale.
