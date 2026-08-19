import { afterEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  realpathSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

import { builtinNames, typeBuiltin } from "../app/builtins/index.ts";
import { cdBuiltin } from "../app/builtins/cd.ts";
import { echoBuiltin } from "../app/builtins/echo.ts";
import { exitBuiltin } from "../app/builtins/exit.ts";
import { pwdBuiltin } from "../app/builtins/pwd.ts";
import { dispatch } from "../app/dispatch.ts";
import { findExecutable, runExecutable } from "../app/executable.ts";
import { parseInput } from "../app/parse.ts";
import type {
  OutputChannel,
  ParsedCommand,
  Redirection,
  ShellIO,
} from "../app/types.ts";

/**
 * These tests assert behavior at module boundaries rather than the code that
 * produces it, so internals stay free to change. They are guardrails, not a
 * shell conformance suite — CodeCrafters remains the acceptance suite.
 */

/**
 * A deliberately tiny fake: tests care about observable lines, not terminals.
 * Implementing ShellIO is cheaper and safer than monkey-patching console or
 * constructing readline, which is the payoff of depending on a small interface.
 */
class RecordingIO implements ShellIO {
  readonly writes: Array<{ line: string; channel: OutputChannel }> = [];
  closed = false;

  writeLine(line: string, channel: OutputChannel = "stdout"): void {
    this.writes.push({ line, channel });
  }

  close(): void {
    this.closed = true;
  }
}

/** Keep expected commands readable while still checking the whole contract. */
const command = (name: string, args: string[] = []): ParsedCommand => ({
  name,
  args,
  redirections: [],
});

const temporaryRoots: string[] = [];

function makeTemporaryRoot(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "cc-shell-refactor-")));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("parsing", () => {
  // These examples cover three state-machine decisions: ordinary separators,
  // quoted separators, and escaped separators. They leave the algorithm free.
  test("separates a command name from plain arguments", () => {
    expect(parseInput("echo hello world")).toEqual(
      command("echo", ["hello", "world"]),
    );
  });

  test("keeps quoted text in one argument", () => {
    expect(parseInput(`echo 'hello world' "from shell"`)).toEqual(
      command("echo", ["hello world", "from shell"]),
    );
  });

  test("preserves the argument boundaries around escaped spaces", () => {
    expect(parseInput("echo one\\ two three")).toEqual(
      command("echo", ["one two", "three"]),
    );
  });
});

describe("external executables", () => {
  // Supplying a temporary PATH proves our lookup rule rather than assumptions
  // about which programs happen to exist on the machine running the tests.
  test("finds the first executable file on a supplied PATH", () => {
    const root = makeTemporaryRoot();
    const firstDirectory = join(root, "first");
    const secondDirectory = join(root, "second");
    mkdirSync(firstDirectory);
    mkdirSync(secondDirectory);

    const nonExecutable = join(firstDirectory, "morning-tool");
    const executable = join(secondDirectory, "morning-tool");
    writeFileSync(nonExecutable, "not executable");
    writeFileSync(executable, "executable");
    chmodSync(executable, 0o755);

    expect(
      findExecutable(
        "morning-tool",
        `${firstDirectory}${delimiter}${secondDirectory}`,
      ),
    ).toBe(executable);
  });

  test("returns undefined when PATH has no matching executable", () => {
    const emptyDirectory = makeTemporaryRoot();
    expect(findExecutable("not-here", emptyDirectory)).toBeUndefined();
  });

  test("can launch a resolved executable without rebuilding a command string", () => {
    // process.execPath is a known executable in this runtime, so this is only a
    // lightweight boundary check—not a test of Bun or the operating system.
    expect(() =>
      runExecutable(process.execPath, ["-e", "process.exit(0)"], []),
    ).not.toThrow();
  });
});

describe("builtins", () => {
  // Calling handlers directly is useful because a builtin is ordinary in-process
  // behavior. Parser, PATH, and readline failures cannot obscure its contract.
  test("echo writes its joined arguments through ShellIO", () => {
    const io = new RecordingIO();
    echoBuiltin(["hello", "shell"], io);
    expect(io.writes).toEqual([{ line: "hello shell", channel: "stdout" }]);
  });

  test("pwd writes the shell process's current directory", () => {
    const io = new RecordingIO();
    pwdBuiltin([], io);
    expect(io.writes.map(({ line }) => line)).toEqual([process.cwd()]);
  });

  test("exit closes ShellIO", () => {
    const io = new RecordingIO();
    exitBuiltin([], io);
    expect(io.closed).toBe(true);
  });

  test("cd changes the shell process's directory", () => {
    const originalDirectory = process.cwd();
    const destination = makeTemporaryRoot();
    const io = new RecordingIO();

    try {
      cdBuiltin([destination], io);
      expect(process.cwd()).toBe(destination);
    } finally {
      // cd intentionally mutates global process state, so the test must restore
      // it even after a failed expectation to avoid misleading later failures.
      process.chdir(originalDirectory);
    }
  });

  test("type recognizes a registered builtin", () => {
    const io = new RecordingIO();
    typeBuiltin(["echo"], io);
    expect(io.writes.map(({ line }) => line)).toEqual([
      "echo is a shell builtin",
    ]);
  });

  test("the registry exposes one discoverable source of builtin names", () => {
    expect(builtinNames().sort()).toEqual([
      "cd",
      "echo",
      "exit",
      "pwd",
      "type",
    ]);
  });
});

describe("dispatch", () => {
  // These tests ask only "which branch wins and what data crosses it?" The
  // selected builtin or executable owns the behavior after that boundary.
  test("routes a builtin with its parsed arguments", () => {
    const io = new RecordingIO();
    dispatch(command("echo", ["through", "dispatch"]), io);
    expect(io.writes.map(({ line }) => line)).toEqual(["through dispatch"]);
  });

  test("routes an external command without losing args or redirections", () => {
    const io = new RecordingIO();
    const redirections: Redirection[] = [];
    const parsed = { ...command("morning-tool", ["one", "two"]), redirections };
    let received:
      | {
          executablePath: string;
          args: string[];
          redirections: Redirection[];
        }
      | undefined;

    dispatch(parsed, io, {
      // These substitutes are test doubles for side-effecting dependencies.
      // They make the routing decision observable without touching real PATH.
      pathValue: "/controlled/path",
      findExecutable: (name, pathValue) => {
        expect({ name, pathValue }).toEqual({
          name: "morning-tool",
          pathValue: "/controlled/path",
        });
        return "/controlled/path/morning-tool";
      },
      runExecutable: (executablePath, args, receivedRedirections) => {
        received = {
          executablePath,
          args,
          redirections: receivedRedirections,
        };
      },
    });

    expect(received).toEqual({
      executablePath: "/controlled/path/morning-tool",
      args: ["one", "two"],
      redirections: [],
    });
  });

  test("reports a command that is neither builtin nor executable", () => {
    const io = new RecordingIO();
    dispatch(command("definitely-not-a-command"), io, {
      pathValue: "",
      findExecutable: () => undefined,
    });
    expect(io.writes.map(({ line }) => line)).toEqual([
      "definitely-not-a-command: not found",
    ]);
  });
});
