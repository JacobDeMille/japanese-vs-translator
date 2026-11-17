# AI development disclosure

Japanese VS Dictionary was developed with the assistance of an AI coding agent.
This document records that provenance for users, contributors, and anyone
reviewing or redistributing the project.

## Agent and model

| Item | Value |
| --- | --- |
| Coding agent | [OpenCode](https://opencode.ai) |
| Model name | Big Pickle |
| Provider | `opencode` |
| Model ID | `opencode/big-pickle` |
| Development period | November 2026 |
| Human maintainer | Jacob DeMille (@JacobDeMille) |

The model name above is the identifier exposed by the development environment.
The provider does not expose a separate underlying LLM name in this setup, so
"Big Pickle" is the most specific model attribution available. Development
spanned multiple sessions; the current codebase was produced primarily with
this agent and model under the maintainer's direction.

## What the AI agent did

- Drafted and edited the TypeScript source, build scripts, tests, and
  documentation.
- Proposed the tokenizer, deinflection, dictionary-build, and hover-rendering
  designs and implemented them.
- Ran type checks, smoke tests, and packaging commands, and iterated on failures.
- Suggested the JMnedict proper-noun supplement and the katakana fallback.

## What the human maintainer did

- Set the requirements and product direction.
- Reviewed changes, tested the extension in VS Code, and reported failures.
- Made the final decisions about features, styling, licensing, and releases.
- Takes responsibility for the published code and its behaviour.

## Caveats

AI-generated code can contain mistakes, insecure patterns, or incorrect
assumptions. The project is provided "as is" without warranty, and users should
review it before relying on it for anything important. The license and data
attribution requirements in [`LICENSE`](LICENSE), [`data/NOTICE.md`](data/NOTICE.md),
and [`README.md`](README.md) still apply.

This disclosure is a statement of provenance, not a legal opinion about
copyright ownership or the copyrightability of AI-assisted output.
