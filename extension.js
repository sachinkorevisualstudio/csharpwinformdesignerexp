const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const glob = require('glob');

let modelFieldsCache = {};
let attributeToModelMap = {};
let scanInterval;

function activate(context) {
    console.log('✅ Model IntelliSense for Thymeleaf activated!');

    // Register rescan command
    context.subscriptions.push(vscode.commands.registerCommand('modelIntellisense.rescanModels', rescanModels));

    // Register completion provider
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(
        [{ language: 'html' }, { language: 'plaintext' }],
        { provideCompletionItems },
        '.' // Trigger after dot
    ));

    // Initial scan
    if (vscode.workspace.workspaceFolders) {
        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        scanJavaFiles(workspacePath, false);
        
        // Setup periodic scanning
        scanInterval = setInterval(() => scanJavaFiles(workspacePath, false), 10000);
        context.subscriptions.push({ dispose: () => clearInterval(scanInterval) });
    }
}

function rescanModels() {
    if (!vscode.workspace.workspaceFolders) {
        vscode.window.showErrorMessage('❌ No workspace folder open.');
        return;
    }
    const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    scanJavaFiles(workspacePath, true);
}

function provideCompletionItems(document, position) {
    const linePrefix = document.lineAt(position).text.substring(0, position.character);
    const completions = [];

    // Match all Thymeleaf expression types
    const match = linePrefix.match(/(?:\$|@|\*|~)\{\s*([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]*)$/);
    if (!match) return completions;

    const modelVar = match[1];
    const typedPrefix = match[2] || '';

    // Find fields for the model variable
    const fields = getFieldsForModelVar(modelVar);
    
    // Create completion items
    fields.forEach(field => {
        if (field.toLowerCase().startsWith(typedPrefix.toLowerCase())) {
            const item = new vscode.CompletionItem(field, vscode.CompletionItemKind.Field);
            item.insertText = field;
            item.detail = `Field from ${modelVar}`;
            item.documentation = new vscode.MarkdownString(`**${field}**\n\n*(Model field)*`);
            completions.push(item);
        }
    });
    
    return completions;
}

function getFieldsForModelVar(modelVar) {
    // Direct match
    if (modelFieldsCache[modelVar]) {
        return modelFieldsCache[modelVar];
    }
    
    // Mapped model variable
    if (attributeToModelMap[modelVar]) {
        const mappedClass = attributeToModelMap[modelVar];
        const cacheKey = mappedClass.charAt(0).toLowerCase() + mappedClass.slice(1);
        return modelFieldsCache[cacheKey] || [];
    }
    
    return [];
}

function scanJavaFiles(rootPath, showMsg) {
    const pattern = path.join(rootPath, 'src', '**', '*.java');
    const ignorePatterns = ['**/target/**', '**/test/**', '**/build/**'];
    const files = glob.sync(pattern, { ignore: ignorePatterns });

    let updatedCache = {};
    attributeToModelMap = {};

    files.forEach(file => {
        try {
            let content = fs.readFileSync(file, 'utf-8');
            processJavaFileContent(content, updatedCache);
        } catch (error) {
            console.error(`Error processing file ${file}:`, error);
        }
    });

    modelFieldsCache = updatedCache;

    if (showMsg) {
        vscode.window.showInformationMessage(
            `✅ Loaded ${Object.keys(modelFieldsCache).length} models, mapped ${Object.keys(attributeToModelMap).length} template variables.`
        );
    }
}

function processJavaFileContent(content, updatedCache) {
    content = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ''); // Remove comments
    content = content.replace(/@\w+(\([^)]*\))?/g, ''); // Remove annotations

    // Detect class name
    const classMatch = content.match(/public\s+(?:class|record|interface)\s+([A-Za-z0-9_]+)/);
    if (!classMatch) return;
    const className = classMatch[1];

    // Detect model attributes
    detectModelAttributes(content, className);

    // Extract fields
    const fields = extractFieldsFromContent(content);
    if (fields.length === 0) return;

    // Cache key: className in lowerCamelCase
    const cacheKey = className.charAt(0).toLowerCase() + className.slice(1);
    updatedCache[cacheKey] = fields;
}

function detectModelAttributes(content, className) {
    const attrPatterns = [
        /model\.addAttribute\s*\(\s*"([a-zA-Z0-9_]+)"\s*,\s*([a-zA-Z0-9_.]+)\s*\)/g,
        /model\.addAttribute\s*\(\s*"([a-zA-Z0-9_]+)"\s*,\s*new\s+([A-Za-z0-9_]+)/g,
        /model\.addAttribute\s*\(\s*"([a-zA-Z0-9_]+)"\s*,\s*\w+\.getContent\s*\(/g,
        /model\.addAttribute\s*\(\s*"([a-zA-Z0-9_]+)"\s*,\s*([a-zA-Z0-9_]+)\s*\)/g,
        /ModelAndView\.addObject\s*\(\s*"([a-zA-Z0-9_]+)"\s*,\s*([a-zA-Z0-9_.]+)\s*\)/g
    ];
    
    attrPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const varName = match[1];
            let modelClass = match[2] || '';
            
            if (modelClass.includes('.')) {
                modelClass = modelClass.split('.')[0];
            }
            
            if (modelClass) {
                attributeToModelMap[varName] = modelClass;
            }
        }
    });
}

function extractFieldsFromContent(content) {
    const fields = new Set();

    // Field declarations
    const fieldRegex = /(?:private|protected|public)\s+(?!static|final)[\w<>]+\s+([a-zA-Z0-9_]+)\s*[;=]/g;
    let match;
    while ((match = fieldRegex.exec(content)) !== null) {
        fields.add(match[1]);
    }

    // Getter methods
    const getterRegex = /public\s+[\w<>]+\s+get([A-Z][a-zA-Z0-9_]+)\s*\(\)/g;
    while ((match = getterRegex.exec(content)) !== null) {
        const propName = match[1].charAt(0).toLowerCase() + match[1].slice(1);
        fields.add(propName);
    }

    // Boolean getters
    const boolGetterRegex = /public\s+boolean\s+is([A-Z][a-zA-Z0-9_]+)\s*\(\)/g;
    while ((match = boolGetterRegex.exec(content)) !== null) {
        const propName = match[1].charAt(0).toLowerCase() + match[1].slice(1);
        fields.add(propName);
    }

    // Record components
    const recordMatch = content.match(/record\s+\w+\s*\(([^)]*)\)/);
    if (recordMatch) {
        recordMatch[1].split(',')
            .map(field => field.trim().split(/\s+/).pop())
            .filter(Boolean)
            .forEach(field => fields.add(field));
    }

    // Lombok detection
    if (/(@Getter|@Data|@Value)/.test(content)) {
        const lombokFieldRegex = /(?:private|protected|public)\s+([\w<>]+)\s+([a-zA-Z0-9_]+)\s*;/g;
        while ((match = lombokFieldRegex.exec(content)) !== null) {
            fields.add(match[2]);
        }
    }

    return Array.from(fields);
}

function deactivate() {
    if (scanInterval) clearInterval(scanInterval);
}

module.exports = {
    activate,
    deactivate
};