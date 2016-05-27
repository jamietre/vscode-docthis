import * as vs from "vscode";
import * as openurl from "openurl";
import * as serializeError from "serialize-error";
import * as childProcess from "child_process";

import { Documenter } from "./documenter";
import { StringBuilder } from "./utilities";

let documenter: Documenter;

function lazyInitializeDocumenter() {
    if (!documenter) {
        documenter = new Documenter();
    }
}

function verifyLanguageSupport(document: vs.TextDocument, commandName: string) {
    if (document.languageId !== "javascript" &&
        document.languageId !== "typescript" &&
        document.languageId !== "javascriptreact" &&
        document.languageId !== "typescriptreact") {
            vs.window.showWarningMessage(`Sorry! '${commandName}' currently supports JavaScript and TypeScript only.`);
            return false;
        }

    return true;
}

function reportError(error: Error, action: string) {
     vs.window.showErrorMessage(`Sorry! '${action}' encountered an error.`, "Report Issue").then(() => {
        try {
            const sb = new StringBuilder();
            sb.appendLine("Platform: " + process.platform);
            sb.appendLine();
            sb.appendLine("Exception:");
            sb.appendLine(serializeError(error));

            const uri = `https://github.com/joelday/vscode-docthis/issues/new?title=${
                encodeURIComponent(`Exception thrown in '${action}': ${error.message}`)
            }&body=${
                encodeURIComponent(sb.toString())
            }`;

            if (process.platform !== "win32") {
                openurl.open(uri, openErr => { console.error("Failed to launch browser", openErr); });
            } else {
                const proc = childProcess.spawnSync("cmd", [
                    "/c",
                    "start",
                    uri.replace(/[&]/g, "^&")
                ]);
            }
        }
        catch (reportErr) {
            reportError(reportErr, "Report Error");
        }
    });
}

function runCommand(commandName: string, document: vs.TextDocument, implFunc: () => void) {
    if (!verifyLanguageSupport(document, commandName)) {
        return;
    }

    try {
        lazyInitializeDocumenter();
        implFunc();
    }
    catch (e) {
        reportError(e, commandName);
    }
}

function isNewline(text) {
    return text.startsWith('\n') || text.startsWith('\r\n');
}

function getLast3(range: vs.Range): vs.Range {
    let line = range.start.line;
    return new vs.Range(line, range.end.character-3, line, range.end.character);   
}

function isJsDocComment(e: vs.TextDocumentChangeEvent) {
    const change = e.contentChanges[0];
    if (isNewline(change.text)) {
        let range = e.contentChanges[0].range;
        if (range.end.character > 2) {            
            let last3 = e.document.getText(getLast3(range));

            if (last3 === '/**') {
                return true;
            }
        }
        return false;
    } 
}

export function activate(context: vs.ExtensionContext): void {
    context.subscriptions.push(vs.commands.registerTextEditorCommand("docthis.documentThis", (editor, edit) => {
        const commandName = "Document This";

        runCommand(commandName, editor.document, () => {
            documenter.documentThis(editor, edit, commandName);
        });
    }));

    context.subscriptions.push(vs.commands.registerTextEditorCommand("docthis.documentEverything", (editor, edit) => {
        const commandName = "Document Everything";

        runCommand(commandName, editor.document, () => {
            documenter.documentEverything(editor, edit, false, commandName);
        });
    }));

    context.subscriptions.push(vs.commands.registerTextEditorCommand("docthis.documentEverythingVisible", (editor, edit) => {
        const commandName = "Document Everything Visible";

        runCommand(commandName, editor.document, () => {
            documenter.documentEverything(editor, edit, true, commandName);
        });
    }));

    context.subscriptions.push(vs.commands.registerTextEditorCommand("docthis.traceTypeScriptSyntaxNode", (editor, edit) => {
        const commandName = "Trace TypeScript Syntax Node";

        runCommand(commandName, editor.document, () => {
            documenter.traceNode(editor, edit);
        });
    }));
    
    vs.workspace.onDidChangeTextDocument((e) => {
        if (isJsDocComment(e)) {
            let editor = vs.window.activeTextEditor; 
            editor.edit((edit) => {
                let range = e.contentChanges[0].range;
                let jsDocStartRange = getLast3(range);
                
                //edit.delete(jsDocStartRange);
                //edit.delete(range);
                documenter.documentThis(editor, edit, "Document This");
            }).then((e) => {
                console.log(e);  
            })
            
        }
    });
}