# Board log retention

Board event logs are retained for 90 days. Run `npm run db:logs:cleanup` from a deployment or maintenance job at least weekly to remove older rows in batches of at most 1,000. The cleanup only deletes `board_logs` rows and can be safely rerun; it does not affect tasks, comments, or board data.

MCP request events are throttled per board and action to one persisted entry per second per application process. The throttle is bounded in memory and intentionally process-local, so multi-instance deployments may still record one event per instance during a burst.

Board metadata caching is also bounded and process-local. Changes to column permissions or MCP settings may take up to 30 seconds to reach every application instance.