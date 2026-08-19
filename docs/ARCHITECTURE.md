# Shell architecture

## The shape

```text
terminal line
    -> parse.ts          raw text becomes ParsedCommand
    -> dispatch.ts       choose builtin or external command
       -> builtins/*     shell-owned behavior
       -> executable.ts  PATH lookup and child execution
    -> repl.ts           readline lifecycle and the next prompt
```

`app/main.ts` is a composition root and nothing else: it calls `startRepl()`.

| Boundary | Question it answers | Idea it applies |
| --- | --- | --- |
| `parse.ts` | What did the user type? | Pure transformation into an intermediate representation |
| `dispatch.ts` | Which kind of command wins? | Policy separated from mechanism |
| `builtins/*` | What must this shell process do itself? | Parent-process state behind a uniform handler contract |
| `executable.ts` | Where is a program, and how is it launched? | Query separated from side effect |
| `ShellIO` | What output ability does a command need? | Dependency inversion through a small interface |
| `repl.ts` | How is all of it connected to the terminal? | Adapter plus composition root |

## Why there is not more architecture

Most modules export functions because they transform input or perform one
operation; they do not need identity, inheritance, or a long-lived object. The
one class, `ReadlineShellIO`, is an adapter holding related runtime state: a
readline instance and its output streams.

Abstractions exist only where variation is already real:

- `ShellIO` varies between a real terminal, a recording test fake, and soon a
  redirected destination.
- dispatch's dependencies vary between real PATH/process operations and test
  doubles.
- the `type` factory prevents a concrete import cycle.

By contrast, `pwd` and `cd` call `process.cwd()` and `process.chdir()` directly.
Wrapping every Node API would add names and indirection without removing any
friction that currently exists. That is the abstraction budget: introduce a seam
when it makes a behavior independently understandable or replaceable.

## Contracts that anticipate the next stages

`ParsedCommand.redirections` and `ShellIO`'s channel argument exist before
redirection is implemented. The parser returns `redirections: []` and builtin
output defaults to stdout.

Those two choices keep the four upcoming redirection stages — redirect stdout,
redirect stderr, append stdout, append stderr — from forcing another
cross-project refactor. They do not implement the features early.

Likewise, builtin names come from one exported registry. Dispatch uses its
values; command completion can use its keys.

## Adding a builtin

Write the handler in `app/builtins/`, matching `BuiltinHandler` — it receives
already-parsed `args` and a `ShellIO`, and must not call `console.log`. Add one
entry to the registry in `app/builtins/index.ts`. Nothing in `dispatch.ts` or
`parse.ts` changes.

## The next stages

`test/next-stages.test.ts` holds five written but dormant tests. When a matching
stage begins, remove `.todo` from that one test.

For redirection:

- teach the parser to recognize an operator only when it is unquoted;
- remove the operator and its target from `args` and add a `Redirection`;
- substitute or wrap `ShellIO` in dispatch for builtins; and
- translate redirections into child stdio inside `runExecutable`.

The lesson is the transition from syntax to data: `2>>` is spelling, while
`{ channel: "stderr", mode: "append" }` is meaning. Once the parser makes that
translation, builtins and external execution share one model even though they
apply it through different mechanisms.

For completion, `builtinNames()` is already the first candidate source and
`repl.ts` marks where readline's `completer` belongs. When executable-name
completion arrives, add a function that lists PATH candidates; do not distort
`findExecutable`, whose job is to return one exact match. The registry matters
here because dispatch and completion need two views of the same truth — handlers
for execution, names for discovery — and a duplicated list would drift.

## Testing

`test/shell.test.ts` asserts one representative behavior per seam. It is a set
of guardrails, not a shell conformance suite; CodeCrafters remains the
feature-level acceptance suite. Typechecking is complementary: the tests
exercise selected runtime examples, while the compiler verifies that every
module still agrees on the contracts.

```sh
npm test
npm run typecheck
printf 'echo hello world\ntype echo\npwd\nexit\n' | ./your_program.sh
```
