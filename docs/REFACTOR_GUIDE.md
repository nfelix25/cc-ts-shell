# Refactoring the shell without stopping the course

## The goal

Turn `app/main.ts` from the whole shell into a small composition root while keeping the shell working after every step.

This is a structural refactor. Do not add the next CodeCrafters feature at the same time. A good end state is one where you can answer "where should this code go?" quickly when later stages introduce redirection, pipes, and more builtins.

The intended command flow is:

```text
terminal line
    -> parse.ts          (text becomes a ParsedCommand)
    -> dispatch.ts       (choose builtin or external command)
       -> builtins/*     (shell-owned commands)
       -> executable.ts  (PATH lookup and child process execution)
    -> repl.ts           (print the next prompt)
```

`main.ts` should eventually do little more than call `startRepl()`.

## Why refactor now

`app/main.ts` currently has several independent reasons to change:

- readline setup and prompt lifecycle
- tokenizing quotes and escapes
- selecting a command handler
- implementing five builtins
- looking up and launching external programs
- defining shared contracts

That makes each new course stage risky: a parsing change can accidentally affect execution or prompt behavior. The existing empty files already point toward good boundaries. The job is to move behavior into them incrementally, not redesign the shell all at once.

## Target layout

```text
app/
  main.ts                  # composition root; starts the shell
  repl.ts                  # readline setup, prompt, and close lifecycle
  parse.ts                 # raw input -> ParsedCommand; no I/O
  dispatch.ts              # builtin vs external routing
  executable.ts            # PATH lookup and spawnSync
  types.ts                 # small shared contracts only
  builtins/
    index.ts               # builtin registry and lookup
    cd.ts                  # changes the shell process's directory
    echo.ts                # writes joined arguments
    exit.ts                # closes ShellIO
    pwd.ts                 # writes the current directory
    type.ts                # describes a builtin or executable
test/
  parse.test.ts            # quote/escape characterization tests
  dispatch.test.ts         # routing tests with fake I/O
  executable.test.ts       # PATH lookup tests using a temporary directory
```

This is intentionally flat. Do not add classes, dependency-injection containers, command objects, or a generic plugin system yet. Add another layer only when a real course feature makes the current structure painful.

## Boundary rules

Use these rules to decide where code belongs:

| Module | Knows about | Must not own |
| --- | --- | --- |
| `main.ts` | `startRepl` | parsing, command behavior |
| `repl.ts` | `readline`, prompt/close events | quote rules, builtin implementations |
| `parse.ts` | characters, quotes, escapes, `ParsedCommand` | `process`, filesystem, output |
| `dispatch.ts` | builtin registry, external execution | parsing details, readline |
| `executable.ts` | `PATH`, executable permissions, child processes | builtin behavior, prompting |
| `builtins/*` | one builtin's behavior | dispatch switch, readline internals |
| `types.ts` | shared data/function shapes | runtime behavior |

Two dependency rules matter most:

1. Pure code must not depend on side effects. `parse.ts` should never import `process`, `readline`, filesystem, or child-process APIs.
2. Builtins should receive the small `ShellIO` interface. They should not receive the raw readline interface, so they cannot change listeners or prompt state accidentally.

It is fine for `cd.ts` and `pwd.ts` to use `process.chdir()` and `process.cwd()` for now. Wrapping every Node API would create more abstraction than this project currently earns.

## Before step 1: establish a baseline

Run these before and after every step:

```sh
bunx tsc --noEmit
printf 'echo hello world\ntype echo\ntype sh\npwd\nexit\n' | ./your_program.sh
```

Also run the CodeCrafters suite at each checkpoint:

```sh
codecrafters submit
```

Make one commit per step. If a stage fails, the diff stays small enough to reason about.

## Step 1: define the contracts

Work in `app/types.ts`.

Define only these concepts:

- `ParsedCommand`: a command `name` and an `args: string[]`
- `ShellIO`: `write(line)` and `close()`
- `BuiltinHandler`: receives `args` and `ShellIO`, and returns `void`

Prefer `name` over `candidateCommand`: after parsing, it is no longer merely a candidate. Prefer `close()` over `exit(code)`: the current behavior closes readline; it does not directly terminate with a supplied status code.

Stop here and typecheck. Nothing needs to import the contracts yet.

## Step 2: extract parsing and characterize it

Move `parseInput` from `main.ts` to `parse.ts`, export it, and make it return `ParsedCommand`. Do not clean up its algorithm during the move.

Add `test/parse.test.ts` using Bun's built-in test runner. First preserve cases the course has already made you support:

- `echo hello world` -> name `echo`, args `hello`, `world`
- `echo 'hello world'` -> one argument
- `echo "hello world"` -> one argument
- adjacent quoted and unquoted text stays in one argument where required
- backslashes outside quotes
- the supported escapes inside double quotes
- a quoted executable name

Then document unresolved edge cases as skipped tests or TODOs rather than silently changing them:

- empty input
- whitespace-only input
- empty quoted arguments such as `echo ""`
- unmatched quotes
- tabs between arguments

Run:

```sh
bun test
bunx tsc --noEmit
```

Why parsing comes first: it is already almost pure, has the most intricate behavior, and later refactors can trust its output instead of handling raw strings.

## Step 3: extract executable lookup

Move `parsePath`, `findExecInPath`, and `parseExecutablePath` into `executable.ts`. Rename while moving only when the new name removes ambiguity:

- `parseExecutablePath(command)` -> `findExecutable(command, pathValue)`
- pass `process.env.PATH ?? ""` from the caller, or use it as a default
- `runExecutable(command, args)` owns `spawnSync`

Keep lookup and execution as separate exported functions. `type` needs lookup without execution, while dispatch needs both.

Avoid carrying `ColonPath`/`IsColonPath` forward. Environment variables are runtime strings; a recursive compile-time test cannot prove that a runtime `PATH` is valid. A simple `string` parameter is more honest.

Useful tests:

- finds an executable in the second PATH directory
- skips an empty PATH entry according to the behavior you intend to preserve
- ignores a non-executable file
- returns `undefined` when nothing matches

Use a temporary directory in tests rather than relying on whether `/bin/sh` exists on a particular machine.

## Step 4: extract the simple builtins

Move one builtin at a time, in this order:

1. `echo`
2. `pwd`
3. `exit`
4. `cd`
5. `type`

Each file should export one `BuiltinHandler`. The handler accepts the already-tokenized `string[]`; it should not parse the original command line.

Notes for the less simple handlers:

- `exit` calls `io.close()`. The REPL owns what closing means.
- `cd` can keep `expandTilde` private in `cd.ts`. Preserve the current missing-path message before improving error distinctions.
- `type` may import `findExecutable`. It should format the result itself; the current name `handleExecutableCommand` hides that it only prints a description.

After each builtin moves, register it in `builtins/index.ts`, remove its old inline implementation, and rerun the baseline.

## Step 5: replace the switch with a registry

In `builtins/index.ts`, create a record whose keys are builtin names and whose values are `BuiltinHandler`s. Export:

- the registry (if useful for tests)
- `findBuiltin(name)`, returning a handler or `undefined`
- optionally `isBuiltin(name)` if `type` reads more clearly with it

Then create `dispatch.ts`. Its decision should be small:

```text
if a builtin exists
    call it with args and io
else if an executable exists
    run it with the original args
else
    write "<name>: not found"
```

Do not retain both the registry and the large `switch`; two sources of truth will eventually disagree.

This step removes the need for the current `Directory` type and its unused `executables` object.

## Step 6: extract the REPL last

Move the `ShellIO` class, readline creation, listeners, and prompt logic to `repl.ts`. This file adapts readline to your small `ShellIO` contract:

- `write(line)` writes one output line
- `close()` closes the readline interface

Keep the useful guard that prompts only while a `line` listener remains. `startRepl()` should create the interface, parse each incoming line, dispatch the result, and manage the next prompt.

At this point `main.ts` should be approximately:

```ts
import { startRepl } from "./repl.ts";

startRepl();
```

That tiny file is the result of the preceding extractions, not a starting point.

## Step 7: cleanup pass

Only after behavior is green:

- delete moved code from `main.ts`
- remove `parseArgs`; handlers can use `args.join(" ")` when that is their behavior
- replace `Function` with the specific `BuiltinHandler` type everywhere
- remove stale comments that describe old stage failures
- use one import style for `node:path`
- decide whether errors are written to stdout or stderr, but treat that as a separate behavior change if CodeCrafters currently expects stdout

Run all three checks again: Bun tests, TypeScript, and CodeCrafters.

## Commit-sized checklist

- [ ] Baseline recorded and current CodeCrafters stage passes
- [ ] Shared contracts defined
- [ ] Parser moved without algorithm changes
- [ ] Parser characterization tests added
- [ ] Executable lookup/execution moved
- [ ] `echo` moved and registered
- [ ] `pwd` moved and registered
- [ ] `exit` moved and registered
- [ ] `cd` moved and registered
- [ ] `type` moved and registered
- [ ] Dispatch switch replaced by registry lookup
- [ ] REPL lifecycle moved
- [ ] `main.ts` reduced to wiring
- [ ] Cleanup completed only after green tests

## When a future feature arrives

Put it at the narrowest fitting boundary:

- New builtin: add one file and one registry entry.
- New quoting rule: change parser tests and `parse.ts` only.
- Different command-not-found behavior: change `dispatch.ts` only.
- PATH lookup rule: change `executable.ts` only.
- Pipe or redirection syntax: first evolve the parsed command model; do not teach builtins to parse operators.

Pipes and redirection will eventually require a richer parser result than `{ name, args }`. That is expected. The point of this refactor is that you will be able to evolve that model without reopening every builtin and readline callback.

## Definition of done

The refactor is done when:

- `main.ts` contains wiring, not behavior
- every current CodeCrafters test still passes
- parsing can be tested without starting a REPL
- builtin output can be tested with a fake `ShellIO`
- adding a builtin does not require editing a dispatch switch
- no module has more than one of the responsibilities listed above

