const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const glob = require('glob');

let modelFieldsCache = {};
let attributeToModelMap = {};
let scanInterval;

function activate(context) {
    console.log('✅ Model IntelliSense for Thymeleaf activated!');

    // Manual rescan command
    const rescanCommand = vscode.commands.registerCommand('modelIntellisense.rescanModels', () => {
        if (!vscode.workspace.workspaceFolders) {
            vscode.window.showErrorMessage('❌ No workspace folder open.');
            return;
        }
        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        scanJavaFiles(workspacePath, true);
    });

    // Enhanced IntelliSense provider
    const completionProvider = vscode.languages.registerCompletionItemProvider(
        [{ language: 'html' }, { language: 'plaintext' }],
        {
            provideCompletionItems(document, position) {
                const linePrefix = document.lineAt(position).text.substring(0, position.character);
                const completions = [];

                // Match Thymeleaf expressions: ${var.}, *{var.}, @{var.}, ~{var.}
                const match = linePrefix.match(/(?:\$|@|\*|~)\{\s*([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]*)$/);
                if (match) {
                    const modelVar = match[1];
                    const typedPrefix = match[2] || '';

                    // Try direct match
                    let fields = modelFieldsCache[modelVar] || [];

                    // Try mapped model variable
                    if (fields.length === 0 && attributeToModelMap[modelVar]) {
                        const mappedClass = attributeToModelMap[modelVar];
                        const key = mappedClass.charAt(0).toLowerCase() + mappedClass.slice(1);
                        fields = modelFieldsCache[key] || [];
                    }

                    // Create completion items
                    fields.forEach(field => {
                        if (field.startsWith(typedPrefix)) {
                            const item = new vscode.CompletionItem(field, vscode.CompletionItemKind.Field);
                            item.insertText = field;
                            item.detail = `Field from ${modelVar}`;
                            item.documentation = new vscode.MarkdownString(`**${field}**\n\n*(Model field)*`);
                            completions.push(item);
                        }
                    });
                }
                return completions;
            }
        },
        '.' // Trigger after dot
    );

    context.subscriptions.push(rescanCommand, completionProvider);

    // Auto-scan setup
    if (vscode.workspace.workspaceFolders) {
        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        scanJavaFiles(workspacePath, false);

        scanInterval = setInterval(() => {
            scanJavaFiles(workspacePath, false);
        }, 10000);

        context.subscriptions.push({ dispose: () => clearInterval(scanInterval) });
    }
}

// Enhanced Java file scanner
function scanJavaFiles(rootPath, showMsg) {
    const pattern = path.join(rootPath, 'src', '**', '*.java');
    const files = glob.sync(pattern, { ignore: ['**/target/**', '**/test/**'] });

    let updatedCache = {};
    attributeToModelMap = {};

    files.forEach(file => {
        let content = fs.readFileSync(file, 'utf-8');
        content = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ''); // Remove comments
        content = content.replace(/@\w+(\([^)]*\))?/g, ''); // Remove annotations

        // Detect class name
        const classMatch = content.match(/public\s+(?:class|record)\s+([A-Za-z0-9_]+)/);
        const className = classMatch ? classMatch[1] : null;

        // Detect model attributes with various patterns
        const attrPatterns = [
            /model\.addAttribute\s*\(\s*"([a-zA-Z0-9_]+)"\s*,\s*([a-zA-Z0-9_.]+)\s*\)/g,
            /model\.addAttribute\s*\(\s*"([a-zA-Z0-9_]+)"\s*,\s*new\s+([A-Za-z0-9_]+)/g,
            /model\.addAttribute\s*\(\s*"([a-zA-Z0-9_]+)"\s*,\s*\w+\.getContent\s*\(/g,
            /model\.addAttribute\s*\(\s*"([a-zA-Z0-9_]+)"\s*,\s*([a-zA-Z0-9_]+)\s*\)/g
        ];
        
        attrPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const varName = match[1];
                let modelClass = match[2] || '';
                
                // Handle method calls like getContent()
                if (modelClass.includes('.')) {
                    modelClass = modelClass.split('.').shift();
                }
                
                if (modelClass) {
                    attributeToModelMap[varName] = modelClass;
                }
            }
        });

        // Extract fields from models
        if (className) {
            const fields = [];

            // Field declarations
            const fieldRegex = /(?:private|protected|public)\s+(?!static|final)[\w<>]+\s+([a-zA-Z0-9_]+)\s*[;=]/g;
            let match;
            while ((match = fieldRegex.exec(content)) !== null) {
                if (!fields.includes(match[1])) fields.push(match[1]);
            }

            // Getter methods
            const getterRegex = /public\s+[\w<>]+\s+get([A-Z][a-zA-Z0-9_]+)\s*\(/g;
            while ((match = getterRegex.exec(content)) !== null) {
                const propName = match[1].charAt(0).toLowerCase() + match[1].slice(1);
                if (!fields.includes(propName)) fields.push(propName);
            }

            // Boolean getters
            const boolGetterRegex = /public\s+boolean\s+is([A-Z][a-zA-Z0-9_]+)\s*\(/g;
            while ((match = boolGetterRegex.exec(content)) !== null) {
                const propName = match[1].charAt(0).toLowerCase() + match[1].slice(1);
                if (!fields.includes(propName)) fields.push(propName);
            }

            // Record components
            const recordMatch = content.match(/record\s+\w+\s*\(([^)]*)\)/);
            if (recordMatch) {
                recordMatch[1].split(',')
                    .map(field => field.trim().split(/\s+/).pop())
                    .filter(Boolean)
                    .forEach(field => {
                        if (!fields.includes(field)) fields.push(field);
                    });
            }

            // Lombok-generated methods
            const lombokRegex = /(?:@Getter|@Data|@Value|@AllArgsConstructor|@NoArgsConstructor|@ToString)/;
            if (lombokRegex.test(content)) {
                const lombokFieldRegex = /(?:private|protected|public)\s+([\w<>]+)\s+([a-zA-Z0-9_]+)\s*;/g;
                while ((match = lombokFieldRegex.exec(content)) !== null) {
                    if (!fields.includes(match[2])) fields.push(match[2]);
                }
            }

            // Cache key: className in lowerCamelCase
            const cacheKey = className.charAt(0).toLowerCase() + className.slice(1);
            updatedCache[cacheKey] = fields;
        }
    });

    modelFieldsCache = updatedCache;

    if (showMsg) {
        vscode.window.showInformationMessage(
            `✅ Loaded ${Object.keys(modelFieldsCache).length} models, mapped ${Object.keys(attributeToModelMap).length} template variables.`
        );
    }
}

function deactivate() {
    if (scanInterval) clearInterval(scanInterval);
}

module.exports = {
    activate,
    deactivate
};