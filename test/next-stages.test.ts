import { expect, test } from "bun:test";

import { builtinNames } from "../app/builtins/index.ts";
import { parseInput } from "../app/parse.ts";

/**
 * Dormant specs for stages that have not started yet. When a matching stage
 * begins, remove `.todo` from just that test and let its expected object drive
 * the change.
 *
 * They target the parsed shape first: once syntax becomes structured data,
 * builtin and external redirection can share its meaning without either layer
 * parsing operator spellings of its own.
 */

test.todo("next: redirect stdout", () => {
  expect(parseInput("echo hello > output.txt")).toEqual({
    name: "echo",
    args: ["hello"],
    redirections: [
      { channel: "stdout", mode: "overwrite", target: "output.txt" },
    ],
  });
});

test.todo("next: redirect stderr", () => {
  expect(parseInput("missing 2> errors.txt")).toEqual({
    name: "missing",
    args: [],
    redirections: [
      { channel: "stderr", mode: "overwrite", target: "errors.txt" },
    ],
  });
});

test.todo("next: append stdout", () => {
  expect(parseInput("echo hello >> output.txt")).toEqual({
    name: "echo",
    args: ["hello"],
    redirections: [
      { channel: "stdout", mode: "append", target: "output.txt" },
    ],
  });
});

test.todo("next: append stderr", () => {
  expect(parseInput("missing 2>> errors.txt")).toEqual({
    name: "missing",
    args: [],
    redirections: [
      { channel: "stderr", mode: "append", target: "errors.txt" },
    ],
  });
});

test.todo("next section: builtin command names are completion candidates", () => {
  // Completion and dispatch should derive from the same registry. Otherwise a
  // newly added builtin can run but mysteriously fail to autocomplete.
  const currentFragment = "e";
  const matches = builtinNames().filter((name) =>
    name.startsWith(currentFragment),
  );

  expect(matches.sort()).toEqual(["echo", "exit"]);
});
