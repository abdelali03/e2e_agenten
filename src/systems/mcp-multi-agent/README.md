# MCP Multi-Agent LangGraph System

This system is the fully agentic MCP comparison architecture.

It uses LangGraph as the workflow state machine and Playwright MCP as the only
browser control surface. All browser interaction happens through MCP tool calls.

## Agents

- `McpPlannerAgent`: chooses the next subgoal from the overall goal and current observations.
- `McpObserverAgent`: chooses perception tools such as `browser_snapshot`.
- `McpDomAnalystAgent`: reads MCP snapshots and selects the exact MCP tool call.
- `McpCriticAgent`: routes failed or looping steps to retry, observe, plan, verify, or blocked.
- `McpVerifierAgent`: decides whether the full user goal is complete.

## Graph

```text
connectMcp
  -> navigateStart
  -> observeForPlanning
  -> plan
  -> analyze
  -> executeTool
  -> observeAfterAction
  -> verify
  -> plan | END

Failures:
  analyze/execute -> critique -> analyze | observe | plan | verify | END
```

## Run

```bash
npm run ui:mcp-multi-agent
```
