# VsCode Comments

**VsCode Comments** is a VS Code extension that lets you add, reply to, navigate, and manage inline code comment threads — both manually and programmatically via Language Model (LM) tools.

Comments are attached to specific lines in files, displayed using VS Code's native Comments UI, and persisted across sessions in workspace state.

---

## Features

- **Inline comment threads** — attach comments to any line in any file using VS Code's built-in comment controller
- **Replies** — add threaded replies to existing comment threads
- **Thread navigation** — jump to the next or previous comment thread across all open files
- **Delete comments** — remove individual comments or entire threads
- **Persistent storage** — comments survive editor restarts; they are saved in workspace state
- **Markdown support** — comment bodies are rendered as Markdown
- **LM Tool integration** — exposes tools to the VS Code Language Model API so AI agents can read and write comments programmatically

---

## Language Model Tools

This extension registers the following tools with the VS Code LM API, making them available to Copilot agents and other LLM integrations:

| Tool | Reference Name | Description |
|------|----------------|-------------|
| `struxt-code-comments_addComment` | `#addComment` | Add a new comment thread to a specific line in a file |
| `struxt-code-comments_addReply` | `#addReply` | Reply to an existing comment thread at a given line |
| `struxt-code-comments_getComments` | `#getComments` | Retrieve all comment threads for a given file |
| `struxt-code-comments_deleteComment` | `#deleteComment` | Delete the comment thread at a specific line |

All tools accept a `filePath` (absolute path) and `line` (1-based line number). `addComment` and `addReply` also accept a `body` (Markdown string) and an optional `username` to identify the comment author.

---

## Commands

| Command | Description |
|---------|-------------|
| `Add Comment` | Add a comment at the current cursor line (also available via the line number context menu) |
| `Reply` | Add a reply to an existing comment thread |
| `Delete Comment` | Delete a single comment from a thread |
| `Delete Comment Thread` | Delete an entire comment thread |
| `Next Comment` | Navigate to the next comment thread |
| `Previous Comment` | Navigate to the previous comment thread |

---

## Usage

### Manually

Right-click a line number in any editor and select **Add Comment**, or place your cursor on a line and run the **Add Comment** command from the Command Palette.

### Via Copilot / LLM Agent

Ask a Copilot agent to review your code, and it can use `#addComment` to leave inline feedback directly on the relevant lines without leaving the editor.

---

## Ideas

This extension is designed with LLM-driven workflows in mind. Here are some ways it can be used:

- **AI code review agent** — give an agent access to your codebase and ask it to review a file or PR diff; it leaves structured inline comments just like a human reviewer would
- **Multi-agent review** — run multiple specialized agents (security, performance, style) in sequence, each leaving named comments attributed to their role
- **Iterative feedback loops** — an agent reviews code, a developer responds via reply threads, and the agent follows up — all within the VS Code Comments UI
- **Automated TODO tracking** — an agent scans for code smells or incomplete logic and annotates them as comment threads for later resolution
- **PR pre-check** — before opening a pull request, have an agent review the diff and surface issues as inline comments for the author to address first
- **Documentation gaps** — an agent identifies undocumented functions and leaves comment prompts asking the developer to add docs
- **Onboarding annotations** — use an agent to annotate unfamiliar codebases with explanatory comments to help new team members get up to speed

---

## Release Notes

### 0.0.1

Initial release — inline comment threads, LM tool registration, thread navigation, and workspace-state persistence.
