// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

let commentId = 1;

const STORAGE_KEY = "struxt-code-comments.threads";
const COMMENT_ID_KEY = "struxt-code-comments.commentId";

interface PersistedComment {
  body: string;
  author: string;
}

interface PersistedThread {
  uri: string;
  line: number;
  comments: PersistedComment[];
}

class NoteComment implements vscode.Comment {
  id: number;
  label: string | undefined;
  savedBody: string | vscode.MarkdownString; // for the Cancel button
  constructor(
    public body: string | vscode.MarkdownString,
    public mode: vscode.CommentMode,
    public author: vscode.CommentAuthorInformation,
    public parent?: vscode.CommentThread,
    public contextValue?: string,
  ) {
    this.id = ++commentId;
    this.savedBody = this.body;
  }
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const commentController = vscode.comments.createCommentController(
    "struxt-code-comments",
    "Code Comments",
  );
  context.subscriptions.push(commentController);

  // Restore commentId so IDs stay unique across sessions
  commentId = context.workspaceState.get<number>(COMMENT_ID_KEY, 1);

  // Store threads so we can manage them
  const threads: vscode.CommentThread[] = [];

  function persistThreads() {
    const data: PersistedThread[] = threads.map((t) => ({
      uri: t.uri.toString(),
      line: t.range ? t.range.start.line : 0,
      comments: t.comments.map((c) => ({
        body: typeof c.body === "string" ? c.body : (c.body as vscode.MarkdownString).value,
        author: c.author.name,
      })),
    }));
    context.workspaceState.update(STORAGE_KEY, data);
    context.workspaceState.update(COMMENT_ID_KEY, commentId);
  }

  // Restore persisted threads
  const savedThreads = context.workspaceState.get<PersistedThread[]>(STORAGE_KEY, []);
  for (const saved of savedThreads) {
    const fileUri = vscode.Uri.parse(saved.uri);
    const range = new vscode.Range(saved.line, 0, saved.line, 0);
    const thread = commentController.createCommentThread(fileUri, range, []);
    thread.canReply = true;
    thread.comments = saved.comments.map((c) => {
      const note = new NoteComment(
        new vscode.MarkdownString(c.body),
        vscode.CommentMode.Preview,
        { name: c.author },
        thread,
      );
      return note;
    });
    threads.push(thread);
  }

  // Tool to add a comment
  const addCommentTool = vscode.lm.registerTool(
    "struxt-code-comments_addComment",
    {
      async invoke(options, token) {
        const { filePath, line, body, username } = options.input as {
          filePath: string;
          line: number;
          body: string;
          username?: string;
        };
        const fileUri = vscode.Uri.file(filePath);
        const range = new vscode.Range(line - 1, 0, line - 1, 0);

        const thread = commentController.createCommentThread(
          fileUri,
          range,
          [],
        );
        thread.canReply = true;

        const comment = new NoteComment(
          new vscode.MarkdownString(body),
          vscode.CommentMode.Preview,
          { name: username ?? "User" },
          thread,
        );

        thread.comments = [comment];
        threads.push(thread);
        persistThreads();

        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `Comment added to ${filePath} at line ${line}`,
          ),
        ]);
      },
      prepareInvocation(options, token) {
        const input = options.input as { filePath: string; line: number; username?: string };
        return {
          invocationMessage: `Adding comment to ${input.filePath} at line ${input.line}`,
        };
      },
    },
  );
  context.subscriptions.push(addCommentTool);

  // Tool to add a reply to an existing comment thread
  const addReplyTool = vscode.lm.registerTool(
    "struxt-code-comments_addReply",
    {
      async invoke(options, token) {
        const { filePath, line, body, username } = options.input as {
          filePath: string;
          line: number;
          body: string;
          username?: string;
        };
        const fileUri = vscode.Uri.file(filePath);

        const thread = threads.find(
          (t) =>
            t.uri.toString() === fileUri.toString() &&
            t.range &&
            t.range.start.line === line - 1,
        );

        if (!thread) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(
              `No comment thread found at ${filePath} line ${line}`,
            ),
          ]);
        }

        const comment = new NoteComment(
          new vscode.MarkdownString(body),
          vscode.CommentMode.Preview,
          { name: username ?? "User" },
          thread,
        );

        thread.comments = [...thread.comments, comment];
        persistThreads();

        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `Reply added to thread at ${filePath} line ${line}`,
          ),
        ]);
      },
      prepareInvocation(options, token) {
        const input = options.input as { filePath: string; line: number; username?: string };
        return {
          invocationMessage: `Adding reply to thread at ${input.filePath} line ${input.line}`,
        };
      },
    },
  );
  context.subscriptions.push(addReplyTool);

  // Tool to get comments
  const getCommentsTool = vscode.lm.registerTool(
    "struxt-code-comments_getComments",
    {
      async invoke(options, token) {
        const { filePath } = options.input as { filePath: string };
        const fileUri = vscode.Uri.file(filePath);

        const fileThreads = threads.filter(
          (t) => t.uri.toString() === fileUri.toString(),
        );

        if (fileThreads.length === 0) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart("No comments found."),
          ]);
        }

        const commentsList = fileThreads
          .map((t) => {
            const line = t.range ? t.range.start.line + 1 : "unknown";
            const comments = t.comments
              .map((c) => (typeof c.body === "string" ? c.body : c.body.value))
              .join("\n");
            return `Line ${line}:\n${comments}`;
          })
          .join("\n\n");

        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(commentsList),
        ]);
      },
      prepareInvocation(options, token) {
        const input = options.input as { filePath: string };
        return {
          invocationMessage: `Getting comments for ${input.filePath}`,
        };
      },
    },
  );
  context.subscriptions.push(getCommentsTool);

  // Tool to delete comments
  const deleteCommentTool = vscode.lm.registerTool(
    "struxt-code-comments_deleteComment",
    {
      async invoke(options, token) {
        const { filePath, line } = options.input as {
          filePath: string;
          line: number;
        };
        const fileUri = vscode.Uri.file(filePath);

        const threadIndex = threads.findIndex(
          (t) =>
            t.uri.toString() === fileUri.toString() &&
            t.range &&
            t.range.start.line === line - 1,
        );

        if (threadIndex >= 0) {
          const thread = threads[threadIndex];
          thread.dispose();
          threads.splice(threadIndex, 1);
          persistThreads();
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(
              `Comment deleted from ${filePath} at line ${line}`,
            ),
          ]);
        }

        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `No comment found at ${filePath} line ${line}`,
          ),
        ]);
      },
      prepareInvocation(options, token) {
        const input = options.input as { filePath: string; line: number };
        return {
          invocationMessage: `Deleting comment from ${input.filePath} at line ${input.line}`,
        };
      },
    },
  );
  context.subscriptions.push(deleteCommentTool);

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand(
    "struxt-code-comments.helloWorld",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage("Hello World from Code Comments!");
    },
  );

  context.subscriptions.push(disposable);

  const addCommentCommand = vscode.commands.registerCommand(
    "struxt-code-comments.addComment",
    async (args?: any) => {
      let uri: vscode.Uri | undefined;
      let line: number | undefined;

      if (args && args.uri && typeof args.lineNumber === "number") {
        uri = args.uri;
        line = args.lineNumber;
      } else {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          uri = editor.document.uri;
          line = editor.selection.active.line + 1;
        }
      }

      if (!uri || line === undefined) {
        vscode.window.showErrorMessage("Could not determine file or line number for comment.");
        return;
      }

      const body = await vscode.window.showInputBox({
        prompt: `Enter comment for line ${line}`,
        placeHolder: "Comment body...",
      });

      if (!body) {
        return; // User cancelled
      }

      const range = new vscode.Range(line - 1, 0, line - 1, 0);
      const thread = commentController.createCommentThread(uri, range, []);
      thread.canReply = true;

      const comment = new NoteComment(
        new vscode.MarkdownString(body),
        vscode.CommentMode.Preview,
        { name: (args && args.username) ? args.username : "User" },
        thread,
      );

      thread.comments = [comment];
      threads.push(thread);
      persistThreads();
    },
  );

  context.subscriptions.push(addCommentCommand);

  const deleteCommentThreadCommand = vscode.commands.registerCommand(
    "struxt-code-comments.deleteCommentThread",
    (thread: vscode.CommentThread) => {
      const index = threads.indexOf(thread);
      if (index > -1) {
        threads.splice(index, 1);
      }
      thread.dispose();
      persistThreads();
    },
  );
  context.subscriptions.push(deleteCommentThreadCommand);

  const deleteCommentCommand = vscode.commands.registerCommand(
    "struxt-code-comments.deleteComment",
    (comment: NoteComment) => {
      const thread = comment.parent;
      if (!thread) {
        return;
      }

      thread.comments = thread.comments.filter((c) => (c as NoteComment).id !== comment.id);

      if (thread.comments.length === 0) {
        const index = threads.indexOf(thread);
        if (index > -1) {
          threads.splice(index, 1);
        }
        thread.dispose();
      }
      persistThreads();
    },
  );
  context.subscriptions.push(deleteCommentCommand);

  function sortedThreads(): vscode.CommentThread[] {
    return [...threads].sort((a, b) => {
      const uriCmp = a.uri.toString().localeCompare(b.uri.toString());
      if (uriCmp !== 0) { return uriCmp; }
      return (a.range?.start.line ?? 0) - (b.range?.start.line ?? 0);
    });
  }

  function navigateToThread(from: vscode.CommentThread, target: vscode.CommentThread) {
    from.collapsibleState = vscode.CommentThreadCollapsibleState.Collapsed;
    target.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
    vscode.window.showTextDocument(target.uri).then(editor => {
      editor.revealRange(target.range!, vscode.TextEditorRevealType.InCenter);
    });
  }

  const nextCommentThreadCommand = vscode.commands.registerCommand(
    "struxt-code-comments.nextCommentThread",
    (thread: vscode.CommentThread) => {
      const sorted = sortedThreads();
      if (sorted.length === 0) { return; }
      const currentIndex = sorted.indexOf(thread);
      const nextIndex = (currentIndex + 1) % sorted.length;
      navigateToThread(thread, sorted[nextIndex]);
    }
  );
  context.subscriptions.push(nextCommentThreadCommand);

  const previousCommentThreadCommand = vscode.commands.registerCommand(
    "struxt-code-comments.previousCommentThread",
    (thread: vscode.CommentThread) => {
      const sorted = sortedThreads();
      if (sorted.length === 0) { return; }
      const currentIndex = sorted.indexOf(thread);
      const prevIndex = (currentIndex - 1 + sorted.length) % sorted.length;
      navigateToThread(thread, sorted[prevIndex]);
    }
  );
  context.subscriptions.push(previousCommentThreadCommand);

  const replyCommentCommand = vscode.commands.registerCommand(
    "struxt-code-comments.replyComment",
    (reply: vscode.CommentReply) => {
      const thread = reply.thread;
      const text = reply.text;
      if (!text) {
        return;
      }
      const username = (reply as any).username;
      const comment = new NoteComment(
        new vscode.MarkdownString(text),
        vscode.CommentMode.Preview,
        { name: username ?? "User" },
        thread,
      );
      thread.comments = [...thread.comments, comment];
      persistThreads();
    },
  );
  context.subscriptions.push(replyCommentCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}
