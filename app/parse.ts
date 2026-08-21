import type { ParsedCommand } from "./types.ts";

const DBL_QUOTE_ESCAPABLES = new Set(['"', "\\", "$", "`", "\n"]);

/**
 * Convert one terminal line into a command name, its arguments, and any
 * redirections.
 *
 * The character walk is stateful because whether a space or a backslash is
 * syntax or data depends on the surrounding quote context: a space separates
 * arguments normally, but is literal text inside quotes.
 *
 * This module is pure — it knows nothing about readline, the filesystem, or
 * command execution — so its behavior is fully determined by the input string.
 *
 * TODO(redirection): recognize `>`, `>>`, `2>` and `2>>` when unquoted, drop the
 * operator and its target from `args`, and return them as `redirections`.
 */
export function parseInput(input: string): ParsedCommand {
  const words: string[] = [];

  let currentWord = "",
    currentQuote: string | null = null,
    currentlyEscaping = false;

  for (let i = 0; i < input.length; i++) {
    const currentChar = input[i],
      isSpace = currentChar === " ",
      isQuote = currentChar === "'" || currentChar === '"',
      isSlash = currentChar === "\\";

    if (currentlyEscaping) {
      currentWord += currentChar;
      currentlyEscaping = false;
      continue;
    }

    if (isSlash) {
      const escapeNextChar =
        currentQuote === null ||
        (currentQuote === '"' && DBL_QUOTE_ESCAPABLES.has(input[i + 1]));
      if (escapeNextChar) {
        currentlyEscaping = true;
        continue;
      }
    }

    if (isSpace) {
      if (currentQuote === null) {
        if (currentWord) {
          words.push(currentWord);
        }
        currentWord = "";
      } else {
        currentWord += " ";
      }
      continue;
    }

    if (isQuote) {
      if (currentQuote === null) {
        currentQuote = currentChar;
      } else if (currentChar === currentQuote) {
        currentQuote = null;
      } else {
        currentWord += currentChar;
      }
    } else {
      currentWord += currentChar;
    }
  }

  if (currentWord) {
    words.push(currentWord);
  }

  return {
    name: words[0] ?? "",
    args: words.slice(1),
    redirections: [],
  };
}
