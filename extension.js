// extension.js
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

// Extension activation
function activate(context) {
    console.log('WinForms Designer extension is now active!');

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('winformsDesigner.openDesigner', openDesignerCommand)
    );

    // Register custom editor provider
    const provider = new WinFormsDesignerProvider(context);
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider('winformsDesigner.designer', provider)
    );

    // Register file watchers for two-way sync
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.Designer.cs');
    watcher.onDidChange(handleDesignerFileChange);
    context.subscriptions.push(watcher);
}

function deactivate() {}

// Command to open designer
function openDesignerCommand(uri) {
    vscode.commands.executeCommand('vscode.openWith', uri, 'winformsDesigner.designer');
}

// Handle changes in Designer.cs files for two-way sync
function handleDesignerFileChange(uri) {
    // This would parse the Designer.cs file and update the JSON representation
    console.log('Designer file changed:', uri.fsPath);
}

// Custom editor provider
class WinFormsDesignerProvider {
    constructor(context) {
        this.context = context;
    }

    async resolveCustomTextEditor(document, webviewPanel, _token) {
        // Set up webview
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'media')
            ]
        };

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        // Parse the C# file to extract form structure
        const formData = this.parseCSharpForm(document.getText(), document.fileName);
        
        // Send initial form data to webview
        webviewPanel.webview.postMessage({
            type: 'init',
            formData: formData,
            fileName: document.fileName
        });

        // Handle messages from webview
        webviewPanel.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'update':
                    await this.updateFormDesign(document, message.formData);
                    break;
                
                case 'addEventHandler':
                    await this.addEventHandler(document, message.eventName, message.handlerName, message.controlName);
                    break;
                
                case 'requestSave':
                    await document.save();
                    break;
                
                case 'deleteControl':
                    await this.deleteControlFromCodeBehind(document, message.controlName);
                    break;
                
                case 'renameForm':
                    await this.renameForm(document, message.newName);
                    break;
                
                case 'error':
                    vscode.window.showErrorMessage(message.message);
                    break;

                case 'goToHandler':
                    await this.goToHandler(document, message.handlerName);
                    break;
            }
        });

        // Handle document changes
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                const newFormData = this.parseCSharpForm(e.document.getText(), e.document.fileName);
                webviewPanel.webview.postMessage({
                    type: 'codeChange',
                    formData: newFormData
                });
            }
        });

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });
    }

    async goToHandler(document, handlerName) {
        const designerFile = document.uri.fsPath;
        const codeBehindFile = designerFile.replace('.Designer.cs', '.cs');

        if (!fs.existsSync(codeBehindFile)) {
            vscode.window.showErrorMessage('Code-behind file not found.');
            return;
        }

        const codeDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(codeBehindFile));
        const text = codeDoc.getText();
        const regex = new RegExp(`private\\s+void\\s+${handlerName}\\s*\\(`);
        let position = null;
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
                position = new vscode.Position(i, 0);
                break;
            }
        }

        if (position) {
            const editor = await vscode.window.showTextDocument(codeDoc);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
        } else {
            vscode.window.showInformationMessage(`Handler '${handlerName}' not found in code-behind.`);
        }
    }

    parseCSharpForm(text, fileName) {
        try {
            // Extract form class name from filename
            const className = path.basename(fileName, '.Designer.cs');
            
            // Simple parser to extract form properties and controls
            const formData = {
                className: className,
                namespace: 'DefaultNamespace',
                text: className,
                size: { width: 800, height: 600 },
                controls: [],
                theme: 'dark'
            };

            // Extract namespace
            const namespaceMatch = text.match(/namespace\s+(\w+)/);
            if (namespaceMatch) {
                formData.namespace = namespaceMatch[1];
            }

            // Extract form text
            const textMatch = text.match(/this\.Text\s*=\s*"([^"]*)"/);
            if (textMatch) {
                formData.text = textMatch[1];
            }

            // Extract form size
            const sizeMatch = text.match(/this\.ClientSize\s*=\s*new\s+System\.Drawing\.Size\((\d+),\s*(\d+)\)/);
            if (sizeMatch) {
                formData.size = { width: parseInt(sizeMatch[1]), height: parseInt(sizeMatch[2]) };
            }

            // Extract controls (simplified parsing)
            const controlRegex = /this\.(\w+)\s*=\s*new\s+System\.Windows\.Forms\.(\w+)\(\)/g;
            let match;
            while ((match = controlRegex.exec(text)) !== null) {
                const controlName = match[1];
                const controlType = match[2];
                
                const control = {
                    name: controlName,
                    type: controlType,
                    text: controlName,
                    location: { x: 0, y: 0 },
                    size: { width: 100, height: 23 },
                    tabIndex: 0,
                    events: {}
                };

                // Extract control properties
                const controlSection = text.substring(match.index);
                const endIndex = controlSection.indexOf('//') > -1 ? controlSection.indexOf('//') : controlSection.length;
                const controlText = controlSection.substring(0, endIndex);

                // Extract location
                const locMatch = controlText.match(/Location\s*=\s*new\s+System\.Drawing\.Point\((\d+),\s*(\d+)\)/);
                if (locMatch) {
                    control.location = { x: parseInt(locMatch[1]), y: parseInt(locMatch[2]) };
                }

                // Extract size
                const sizeMatchCtrl = controlText.match(/Size\s*=\s*new\s+System\.Drawing\.Size\((\d+),\s*(\d+)\)/);
                if (sizeMatchCtrl) {
                    control.size = { width: parseInt(sizeMatchCtrl[1]), height: parseInt(sizeMatchCtrl[2]) };
                }

                // Extract TabIndex
                const tabIndexMatch = controlText.match(/TabIndex\s*=\s*(\d+)/);
                if (tabIndexMatch) {
                    control.tabIndex = parseInt(tabIndexMatch[1]);
                }

                // Extract text if applicable
                const noTextTypes = ['DateTimePicker', 'DataGridView', 'MenuStrip'];
                if (!noTextTypes.includes(controlType)) {
                    const textMatchCtrl = controlText.match(/Text\s*=\s*"([^"]*)"/);
                    if (textMatchCtrl) {
                        control.text = textMatchCtrl[1];
                    }
                }

                // Extract Checked for CheckBox and RadioButton
                if (controlType === 'CheckBox' || controlType === 'RadioButton') {
                    const checkedMatch = controlText.match(/Checked\s*=\s*(true|false)/);
                    if (checkedMatch) {
                        control.checked = checkedMatch[1] === 'true';
                    }
                }

                // Extract Items for ComboBox
                if (controlType === 'ComboBox') {
                    const itemsMatch = controlText.match(/Items\.AddRange\(new object\[\]\s*{\s*"([^"]*)"\s*}\)/);
                    if (itemsMatch) {
                        control.items = itemsMatch[1].split('","');
                    }
                }

                // Extract properties for DateTimePicker
                if (controlType === 'DateTimePicker') {
                    const valueMatch = controlText.match(/Value\s*=\s*new\s+System\.DateTime\((\d+),\s*(\d+),\s*(\d+)/);
                    if (valueMatch) {
                        control.value = `${valueMatch[3]}-${valueMatch[2]}-${valueMatch[1]}`;
                    }

                    const formatMatch = controlText.match(/Format\s*=\s*System\.Windows\.Forms\.DateTimePickerFormat\.(\w+)/);
                    if (formatMatch) {
                        control.format = formatMatch[1];
                    }

                    const customFormatMatch = controlText.match(/CustomFormat\s*=\s*"([^"]*)"/);
                    if (customFormatMatch) {
                        control.customFormat = customFormatMatch[1];
                    }
                }

                // Extract properties for DataGridView
                if (controlType === 'DataGridView') {
                    const columnsMatch = controlText.match(/Columns\.AddRange\(new\s+System\.Windows\.Forms\.DataGridViewColumn\[\]\s*{([^}]*)}/);
                    if (columnsMatch) {
                        const columnsText = columnsMatch[1];
                        const columnNameRegex = /Name\s*=\s*"([^"]*)"/g;
                        let columnMatch;
                        control.columns = [];
                        while ((columnMatch = columnNameRegex.exec(columnsText)) !== null) {
                            control.columns.push(columnMatch[1]);
                        }
                    }

                    const allowUserToAddRowsMatch = controlText.match(/AllowUserToAddRows\s*=\s*(true|false)/);
                    if (allowUserToAddRowsMatch) {
                        control.allowUserToAddRows = allowUserToAddRowsMatch[1] === 'true';
                    }

                    const allowUserToDeleteRowsMatch = controlText.match(/AllowUserToDeleteRows\s*=\s*(true|false)/);
                    if (allowUserToDeleteRowsMatch) {
                        control.allowUserToDeleteRows = allowUserToDeleteRowsMatch[1] === 'true';
                    }

                    const readOnlyMatch = controlText.match(/ReadOnly\s*=\s*(true|false)/);
                    if (readOnlyMatch) {
                        control.readOnly = readOnlyMatch[1] === 'true';
                    }
                }

                // Extract events - including TextChanged, Enter, and Leave
                const eventRegex = /(\w+)\s*\+=\s*new\s+System\.EventHandler\(this\.(\w+)\)/g;
                let eventMatch;
                while ((eventMatch = eventRegex.exec(controlText)) !== null) {
                    control.events[eventMatch[1]] = eventMatch[2];
                }

                // Extract TextChanged event specifically
                const textChangedMatch = controlText.match(/TextChanged\s*\+=\s*new\s+System\.EventHandler\(this\.(\w+)\)/);
                if (textChangedMatch) {
                    control.events.TextChanged = textChangedMatch[1];
                }

                // Extract Enter event specifically
                const enterMatch = controlText.match(/Enter\s*\+=\s*new\s+System\.EventHandler\(this\.(\w+)\)/);
                if (enterMatch) {
                    control.events.Enter = enterMatch[1];
                }

                // Extract Leave event specifically
                const leaveMatch = controlText.match(/Leave\s*\+=\s*new\s+System\.EventHandler\(this\.(\w+)\)/);
                if (leaveMatch) {
                    control.events.Leave = leaveMatch[1];
                }

                formData.controls.push(control);
            }

            return formData;
        } catch (error) {
            console.error('Error parsing C# form:', error);
            return {
                className: 'NewForm',
                namespace: 'DefaultNamespace',
                text: 'New Form',
                size: { width: 800, height: 600 },
                controls: [],
                theme: 'dark'
            };
        }
    }

    async updateFormDesign(document, formData) {
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );
        
        const newCode = this.generateDesignerCode(formData);
        edit.replace(document.uri, fullRange, newCode);
        
        await vscode.workspace.applyEdit(edit);
    }

    generateDesignerCode(formData) {
        let code = `namespace ${formData.namespace}
{
    partial class ${formData.className}
    {
        private System.ComponentModel.IContainer components = null;

        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        private void InitializeComponent()
        {
            this.SuspendLayout();
            // 
            // ${formData.className}
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(${formData.size.width}, ${formData.size.height});
            this.Name = "${formData.className}";
            this.Text = "${formData.text}";
`;

        // Add fixed form colors (dark theme)
        code += `            this.BackColor = System.Drawing.Color.FromArgb(37, 37, 38);\n`;
        code += `            this.ForeColor = System.Drawing.Color.FromArgb(204, 204, 204);\n`;

        // Add controls
        formData.controls.forEach(control => {
            code += `            // 
            // ${control.name}
            // 
            this.${control.name} = new System.Windows.Forms.${control.type}();
            this.${control.name}.Location = new System.Drawing.Point(${control.location.x}, ${control.location.y});
            this.${control.name}.Name = "${control.name}";
            this.${control.name}.Size = new System.Drawing.Size(${control.size.width}, ${control.size.height});
            this.${control.name}.TabIndex = ${control.tabIndex || 0};
`;

            // Add fixed color properties based on type (dark theme)
            code += `            this.${control.name}.ForeColor = System.Drawing.Color.FromArgb(204, 204, 204);\n`;
            if (['Label', 'CheckBox', 'RadioButton'].includes(control.type)) {
                code += `            this.${control.name}.BackColor = System.Drawing.Color.Transparent;\n`;
            } else if (['Button', 'MenuStrip', 'GroupBox'].includes(control.type)) {
                code += `            this.${control.name}.BackColor = System.Drawing.Color.FromArgb(51, 51, 51);\n`;
            } else {
                code += `            this.${control.name}.BackColor = System.Drawing.Color.FromArgb(30, 30, 30);\n`;
            }

            // Add FlatStyle for buttons
            if (control.type === 'Button') {
                code += `            this.${control.name}.FlatStyle = System.Windows.Forms.FlatStyle.Flat;\n`;
            }

            // Add control-specific properties
            if (control.type === 'CheckBox' || control.type === 'RadioButton') {
                code += `            this.${control.name}.Checked = ${control.checked ? 'true' : 'false'};\n`;
                code += `            this.${control.name}.UseVisualStyleBackColor = false;\n`;
            }

            const noTextTypes = ['DateTimePicker', 'DataGridView', 'MenuStrip'];
            if (!noTextTypes.includes(control.type)) {
                code += `            this.${control.name}.Text = "${control.text}";\n`;
            }

            if (control.type === 'ComboBox' && control.items && control.items.length > 0) {
                code += `            this.${control.name}.Items.AddRange(new object[] { "${control.items.join('", "')}" });\n`;
            }

            if (control.type === 'DateTimePicker') {
                if (control.value) {
                    const [day, month, year] = control.value.split('-');
                    code += `            this.${control.name}.Value = new System.DateTime(${year}, ${month}, ${day});\n`;
                }
                if (control.format) {
                    code += `            this.${control.name}.Format = System.Windows.Forms.DateTimePickerFormat.${control.format};\n`;
                }
                if (control.customFormat) {
                    code += `            this.${control.name}.CustomFormat = "${control.customFormat}";\n`;
                }
            }

            if (control.type === 'DataGridView' && control.columns && control.columns.length > 0) {
                code += `            this.${control.name}.Columns.AddRange(new System.Windows.Forms.DataGridViewColumn[] {\n`;
                control.columns.forEach(col => {
                    code += `                new System.Windows.Forms.DataGridViewTextBoxColumn { Name = "${col}", HeaderText = "${col}" },\n`;
                });
                code += `            });\n`;
                code += `            this.${control.name}.AllowUserToAddRows = ${control.allowUserToAddRows ? 'true' : 'false'};\n`;
                code += `            this.${control.name}.AllowUserToDeleteRows = ${control.allowUserToDeleteRows ? 'true' : 'false'};\n`;
                code += `            this.${control.name}.ReadOnly = ${control.readOnly ? 'true' : 'false'};\n`;
            }

            // Add events
            Object.keys(control.events).forEach(eventName => {
                code += `            this.${control.name}.${eventName} += new System.EventHandler(this.${control.events[eventName]});\n`;
            });

            code += `            this.Controls.Add(this.${control.name});\n`;
        });

        code += `            // 
            // Form controls collection
            // 
            this.Controls.AddRange(new System.Windows.Forms.Control[] {
                ${formData.controls.map(c => `this.${c.name}`).join(',\n                ')}
            });
            this.ResumeLayout(false);
        }

        #endregion

        // Control declarations
        ${formData.controls.map(c => `private System.Windows.Forms.${c.type} ${c.name};`).join('\n        ')}
    }
}`;
        return code;
    }

    async addEventHandler(document, eventName, handlerName, controlName) {
        // Find the corresponding .cs file (not .Designer.cs)
        const designerFile = document.uri.fsPath;
        const codeBehindFile = designerFile.replace('.Designer.cs', '.cs');
        
        if (!fs.existsSync(codeBehindFile)) {
            // Create a new code-behind file if it doesn't exist
            const defaultCode = `namespace ${this.parseCSharpForm(document.getText(), document.fileName).namespace}
{
    public partial class ${path.basename(designerFile, '.Designer.cs')}
    {
        public ${path.basename(designerFile, '.Designer.cs')}()
        {
            InitializeComponent();
        }

        private void ${handlerName}(object sender, System.EventArgs e)
        {
            // TODO: Add event handler implementation
        }
    }
}`;
            fs.writeFileSync(codeBehindFile, defaultCode);
        }

        // Read the code-behind file
        const codeBehindText = fs.readFileSync(codeBehindFile, 'utf8');

        // Check if handler already exists
        if (!codeBehindText.includes(`private void ${handlerName}(object sender, System.EventArgs e)`)) {
            // Add the event handler
            const newHandler = `
        private void ${handlerName}(object sender, System.EventArgs e)
        {
            // TODO: Add event handler implementation
        }
`;
            // Insert before the last closing brace
            const lastBraceIndex = codeBehindText.lastIndexOf('}');
            const newCodeBehindText = codeBehindText.substring(0, lastBraceIndex) + newHandler + codeBehindText.substring(lastBraceIndex);
            fs.writeFileSync(codeBehindFile, newCodeBehindText);
        }

        // Update the designer file to include the event binding
        const edit = new vscode.WorkspaceEdit();
        let designerText = document.getText();
        const controlSectionRegex = new RegExp(`(this\\.${controlName}\\.[\\s\\S]*?)(?=\\s*//|this\\.Controls\\.Add\\(this\\.${controlName}\\))`, 'm');
        const match = designerText.match(controlSectionRegex);
        if (match) {
            let controlSection = match[1];
            if (!controlSection.includes(`${eventName} +=`)) {
                controlSection += `            this.${controlName}.${eventName} += new System.EventHandler(this.${handlerName});\n`;
                designerText = designerText.replace(controlSectionRegex, controlSection);
                const fullRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(designerText.length)
                );
                edit.replace(document.uri, fullRange, designerText);
                await vscode.workspace.applyEdit(edit);
            }
        }
    }

    async deleteControlFromCodeBehind(document, controlName) {
        const edit = new vscode.WorkspaceEdit();
        let text = document.getText();

        // Remove control declaration
        const declarationRegex = new RegExp(`private System\\.Windows\\.Forms\\.[\\w]+\\s+${controlName};\\s*\\n`);
        text = text.replace(declarationRegex, '');

        // Remove control initialization section
        const controlSectionRegex = new RegExp(`\\s*//\\s*\\n\\s*//\\s${controlName}\\s*\\n[\\s\\S]*?this\\.Controls\\.Add\\(this\\.${controlName}\\);\\s*\\n`);
        text = text.replace(controlSectionRegex, '');

        // Update Controls.AddRange
        const addRangeRegex = /this\.Controls\.AddRange\(new System\.Windows\.Forms\.Control\[\] \{([\s\S]*?)\}\);/;
        const addRangeMatch = text.match(addRangeRegex);
        if (addRangeMatch) {
            let controlsList = addRangeMatch[1];
            controlsList = controlsList.replace(new RegExp(`this\\.${controlName}\\s*,?\\s*`), '');
            controlsList = controlsList.replace(/,\s*,/, ',').replace(/,\s*\n\s*\}/, '\n            }');
            text = text.replace(addRangeRegex, `this.Controls.AddRange(new System.Windows.Forms.Control[] {${controlsList}});`);
        }

        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(text.length)
        );
        edit.replace(document.uri, fullRange, text);
        await vscode.workspace.applyEdit(edit);
    }

    async renameForm(document, newName) {
        const oldName = path.basename(document.uri.fsPath, '.Designer.cs');
        const designerFile = document.uri.fsPath;
        const codeBehindFile = designerFile.replace('.Designer.cs', '.cs');
        const designerCsProjFile = designerFile.replace('.Designer.cs', '.csproj');

        // Update Designer.cs
        const edit = new vscode.WorkspaceEdit();
        let designerText = document.getText();
        designerText = designerText.replace(new RegExp(`partial class ${oldName}`, 'g'), `partial class ${newName}`);
        designerText = designerText.replace(new RegExp(`this\\.Name = "${oldName}"`, 'g'), `this.Name = "${newName}"`);
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(designerText.length)
        );
        edit.replace(document.uri, fullRange, designerText);
        await vscode.workspace.applyEdit(edit);

        // Update code-behind file if it exists
        if (fs.existsSync(codeBehindFile)) {
            const codeBehindText = fs.readFileSync(codeBehindFile, 'utf8');
            const newCodeBehindText = codeBehindText.replace(new RegExp(`class ${oldName}`, 'g'), `class ${newName}`);
            fs.writeFileSync(codeBehindFile, newCodeBehindText);
        }

        // Update .csproj file if it exists
        if (fs.existsSync(designerCsProjFile)) {
            const csProjText = fs.readFileSync(designerCsProjFile, 'utf8');
            const newCsProjText = csProjText.replace(new RegExp(`${oldName}\\.Designer\\.cs`, 'g'), `${newName}.Designer.cs`);
            fs.writeFileSync(designerCsProjFile, newCsProjText);
        }

        // Rename files
        const newDesignerFile = designerFile.replace(`${oldName}.Designer.cs`, `${newName}.Designer.cs`);
        const newCodeBehindFile = codeBehindFile.replace(`${oldName}.cs`, `${newName}.cs`);
        
        await vscode.workspace.fs.rename(
            vscode.Uri.file(designerFile),
            vscode.Uri.file(newDesignerFile)
        );
        
        if (fs.existsSync(codeBehindFile)) {
            await vscode.workspace.fs.rename(
                vscode.Uri.file(codeBehindFile),
                vscode.Uri.file(newCodeBehindFile)
            );
        }
    }

    getHtmlForWebview(webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'designer.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'designer.css'));

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>WinForms Designer</title>
                <link href="${styleUri}" rel="stylesheet">
            </head>
            <body>
                <div class="designer-container">
                    <div class="toolbox">
                        <h3>Toolbox</h3>
                        <div class="toolbox-item" data-type="Button" draggable="true">Button</div>
                        <div class="toolbox-item" data-type="TextBox" draggable="true">TextBox</div>
                        <div class="toolbox-item" data-type="Label" draggable="true">Label</div>
                        <div class="toolbox-item" data-type="CheckBox" draggable="true">CheckBox</div>
                        <div class="toolbox-item" data-type="RadioButton" draggable="true">RadioButton</div>
                        <div class="toolbox-item" data-type="ComboBox" draggable="true">ComboBox</div>
                        <div class="toolbox-item" data-type="DateTimePicker" draggable="true">DateTimePicker</div>
                        <div class="toolbox-item" data-type="DataGridView" draggable="true">DataGridView</div>
                        <div class="toolbox-item" data-type="MenuStrip" draggable="true">MenuStrip</div>
                        <div class="toolbox-item" data-type="GroupBox" draggable="true">GroupBox</div>
                        <div class="toolbox-item" data-type="ListBox" draggable="true">ListBox</div>
                        <div class="toolbox-item" data-type="RichTextBox" draggable="true">RichTextBox</div>
                    </div>
                    <div class="design-surface" id="designSurface"></div>
                    <div class="properties-panel">
                        <h3>Properties</h3>
                        <div id="propertiesContent"></div>
                    </div>
                </div>
                <script src="${scriptUri}"></script>
            </body>
            </html>
        `;
    }
}

module.exports = {
    activate,
    deactivate
};
