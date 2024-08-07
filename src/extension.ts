import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('extension.typeText', async () => {
        const editor = vscode.window.activeTextEditor;

        if (editor) {
            const document = editor.document;
            let selection = editor.selection;

            // Check if there are any workspace folders open
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showErrorMessage('No workspace folder found.');
                return;
            }

            // Use the first workspace folder
            const workspaceFolder = workspaceFolders[0].uri.fsPath;
            console.log('Using workspace folder:', workspaceFolder);

            const tempFilePath = path.join(workspaceFolder, '.vscode', 'tempInput.txt');

            // Ensure the .vscode directory exists
            const vscodeDir = path.dirname(tempFilePath);
            if (!fs.existsSync(vscodeDir)) {
                console.log('Creating .vscode directory at:', vscodeDir);
                fs.mkdirSync(vscodeDir, { recursive: true });
            }

            // Create the temp file if it doesn't exist
            if (!fs.existsSync(tempFilePath)) {
                console.log('Creating temp file at:', tempFilePath);
                fs.writeFileSync(tempFilePath, '', 'utf8');  // Create an empty file
            }

            // Open the temporary text document
            const tempDoc = await vscode.workspace.openTextDocument(tempFilePath);
            await vscode.window.showTextDocument(tempDoc);

            vscode.window.showInformationMessage('Please enter your text here and save the file.');

            // Wait for the user to save the document
            const onDidSaveTextDocument = vscode.workspace.onDidSaveTextDocument(async (doc) => {
                console.log('Document saved:', doc.uri.fsPath);
                if (doc.uri.fsPath === tempFilePath) {
                    const userInput = doc.getText();
                    console.log('User input:', userInput);

                    // Optionally, delete the temporary file
                    fs.unlink(tempFilePath, (err) => {
                        if (err) {
                            console.error('Failed to delete temp file:', err);
                        } else {
                            console.log('Temp file deleted');
                        }
                    });

                    if (!userInput) {
                        vscode.window.showErrorMessage('No input provided.');
                        return;
                    }

                    // Read typing speed from configuration
                    const config = vscode.workspace.getConfiguration('humantyper');
                    const typingSpeed = config.get<number>('typingSpeed', 100);
                    console.log('Typing speed:', typingSpeed);

                    const lines = userInput.split('\n');
                    let currentLineIndex = 0;
                    let currentTextIndex = 0;

                    // Close the temporary document
                    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                    // Re-focus the original document
                    await vscode.window.showTextDocument(document);

                    let shouldStopTyping = false;

                       // Listen for escape or enter key presses to stop typing
                       const keyListener = vscode.window.onDidChangeTextEditorSelection(event => {
                        if (event.textEditor === editor) {
                            // Check if the Esc or Enter key is pressed
                            const selections = event.selections;
                            for (let sel of selections) {
                                const charBefore = document.getText(new vscode.Range(sel.active.translate(0, -1), sel.active));
                                if (charBefore === '\n') { // Enter key detection
                                    shouldStopTyping = true;
                                    break;
                                }
                            }

                            
                        }
                    });


                    function typeNextCharacter() {
                        if (shouldStopTyping) {
                            vscode.window.showInformationMessage('Typing simulation stopped.');
                            keyListener.dispose();
                            return;
                        }
                        if (currentLineIndex < lines.length) {
                            const currentLine = lines[currentLineIndex];
                            if (currentTextIndex < currentLine.length) {
                                const nextChar = currentLine[currentTextIndex];

                                console.log('Current line index:', currentLineIndex);
                                console.log('Current text index:', currentTextIndex);
                                console.log('Next char:', nextChar);

                                const currentEditor = vscode.window.activeTextEditor;
                                if (currentEditor && currentEditor.document === document) {
                                    currentEditor.edit(editBuilder => {
                                        editBuilder.insert(selection.active, nextChar);
                                    }).then(success => {
                                        if (success) {
                                            // Move the cursor forward after each character
                                            const newPosition = selection.active.translate(0, 1);
                                            selection = new vscode.Selection(newPosition, newPosition);
                                            currentEditor.selection = selection;

                                            currentTextIndex++;
                                            setTimeout(typeNextCharacter, typingSpeed);
                                        } else {
                                            vscode.window.showErrorMessage('Failed to insert text.');
                                        }
                                    });
                                } else {
                                    console.error('Editor is not valid or document is incorrect.');
                                    vscode.window.showErrorMessage('Editor is not valid or document is incorrect.');
                                    return;
                                }
                            } else {
                                // Move to the next line
                                currentLineIndex++;
                                currentTextIndex = 0;

                                const currentEditor = vscode.window.activeTextEditor;
                                if (currentEditor && currentEditor.document === document) {
                                    // Insert a new line
                                    currentEditor.edit(editBuilder => {
                                        editBuilder.insert(selection.active, '\n');
                                    }).then(success => {
                                        if (success) {
                                            // Move the cursor to the start of the next line
                                            const newLinePosition = new vscode.Position(selection.active.line + 1, 0);
                                            selection = new vscode.Selection(newLinePosition, newLinePosition);
                                            currentEditor.selection = selection;
                                            currentEditor.revealRange(new vscode.Range(newLinePosition, newLinePosition));
                                            setTimeout(typeNextCharacter, typingSpeed);
                                        } else {
                                            vscode.window.showErrorMessage('Failed to insert new line.');
                                        }
                                    });
                                } else {
                                    console.error('Editor is not valid or document is incorrect.');
                                    vscode.window.showErrorMessage('Editor is not valid or document is incorrect.');
                                    return;
                                }
                            }
                        } else {
                            console.log('All lines have been processed.');
                            vscode.window.showInformationMessage('Finished typing all lines.');
                        }
                    }

                    typeNextCharacter();

                    // Dispose of the event listener after handling the document
                    onDidSaveTextDocument.dispose();
                }
            });

        } else {
            vscode.window.showErrorMessage('No active editor found.');
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() { }