#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { GraphClient } from "./graph.js";
import { registerReadTools } from "./tools/read.js";
import { registerWriteTools } from "./tools/write.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const graph = new GraphClient(config.accessToken, config.apiVersion);

  const server = new McpServer({
    name: "meta-ads",
    version: "1.0.0",
  });

  registerReadTools(server, graph, config);
  registerWriteTools(server, graph, config);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout carries the MCP protocol — diagnostics must go to stderr only.
  console.error(
    `meta-ads MCP server running (Graph API ${config.apiVersion}, default account: ${config.defaultAdAccountId ?? "none"})`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
