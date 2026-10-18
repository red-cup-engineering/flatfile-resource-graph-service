#!/usr/bin/env node
// Physical process boundary for the existing FARS command family.
// Source observation and JSON admission stay with its original provider.
import { command } from "./flatfile-resource-graph.mjs";

try {
  const status = await command.run({
    argv: process.argv.slice(2),
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
  });
  process.exitCode = command.resultExitCode(status);
} catch (error) {
  process.stderr.write(command.formatError(error instanceof Error ? error : new Error(String(error))));
  process.exitCode = command.exitCode;
}
