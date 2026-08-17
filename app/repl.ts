/**
 * Owns the interactive terminal lifecycle.
 *
 * This should be the only module that imports readline. It adapts readline to
 * ShellIO, parses each line, dispatches it, and decides when to show a prompt.
 *
 * TODO (refactor step 6): Export startRepl after the other modules have been
 * extracted. Move this coupling last.
 */
