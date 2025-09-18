Overview (free opensource designer developed purely on javascript html css)
WinForms Designer is a VS Code extension that provides a visual designer for C# Windows Forms applications. It supports two-way editing, meaning changes in the visual designer are reflected in the .Designer.cs code, and vice versa. The designer uses a dark theme by default, with drag-and-drop support for adding controls, property editing, event handler generation, and real-time synchronization with your code.
This extension is ideal for .NET developers working with WinForms in VS Code, offering a modern alternative to traditional designers like Visual Studio's. It supports .NET 8 and focuses on ease of use with a dark mode interface.
Key Features:

Drag-and-drop control placement from the toolbox.
Real-time property editing in a dedicated panel.
Automatic event handler generation in the code-behind file (.cs).
Two-way sync: Edit code manually, and the designer updates automatically (via file watchers).
Keyboard shortcuts for common actions (e.g., copy/paste controls, delete).
Default dark theme for the designer and generated forms.
Context menu for quick actions like copy/delete.
Resizable form and controls with handles.
Support for renaming forms (updates files and code).

Keywords: dotnet8, winform, winform designer, dark mode, drag and drop, vs code winform designer, c# winform designer.
Installation

Open VS Code.
Go to the Extensions view (Ctrl+Shift+X or Cmd+Shift+X on macOS).
Search for "WinForms Designer".
Install the extension published by atkivisolutioninstadotnetmodelgenerator.
Reload VS Code if prompted.

Alternatively, download the .vsix file from the releases page and install it manually via VS Code's "Install from VSIX" command.
##Usage
terminal to create winform project 

    dotnet new winforms -n MyWinFormsApp 
    cd MyWinFormsApp

Opening the Designer

Right-click on a *.Designer.cs file in the Explorer and select Open with WinForms Designer.
Use the command palette (Ctrl+Shift+P or Cmd+Shift+P on macOS): Search for Open with WinForms Designer and select your file.
The extension automatically activates for *.Designer.cs files, opening them in the custom editor.

If the file doesn't exist, create a new one (e.g., MyForm.Designer.cs) with basic WinForms code to start.
Designer Interface
The designer is divided into three panels:

Toolbox (Left): List of available controls. Drag them onto the form.
Design Surface (Center): The visual representation of your form. Drop controls here, resize/move them, and select for editing.
Properties Panel (Right): Edit properties of the selected control or form. Includes groups for appearance, behavior, and events.

Adding Controls

Drag a control from the Toolbox to the Design Surface.
Position it by dragging (use the blue move handle for precise movement).
Resize using the resize handles (corners and sides).
Select the control to view/edit properties.

Editing Properties

Select a control or the form (click the title bar or empty space on the form).
In the Properties Panel:

Update values like Name, Text, Width, Height.
For controls with items (e.g., ComboBox), add/edit in a dedicated editor.
Changes are applied in real-time and synced to code.



Adding Events

In the Properties Panel, under Events, enter a handler name (auto-suggested as <ControlName>_<EventName>).
Press Enter to generate the handler in the code-behind file (e.g., MyForm.cs).
If the code-behind doesn't exist, it's created automatically.
Supported events include Click, TextChanged, Enter, Leave, and more (depending on control type).

Form Editing

Click the title bar or empty form area to select the form.
Edit form properties like Name, Text, Width, Height.
Resize the form using the bottom-right handle.

Keyboard Shortcuts

Delete: Remove the selected control.
Ctrl+C: Copy the selected control.
Ctrl+V: Paste a copied control (offset by 10px).
Ctrl+S: Save changes (updates the .Designer.cs file).

Context Menu

Right-click a control for options: Copy or Delete.

Two-Way Sync

Edit the .Designer.cs file manually in VS Code—the designer updates automatically.
Changes in the designer update the code file.
Event handlers are added to the code-behind (.cs) file.

Saving and Renaming

Use Ctrl+S to save (or via VS Code's save command).
Renaming the form in properties updates the class name, files (.Designer.cs and .cs), and references in the project (if a .csproj exists).

Supported Controls (Toolbox Widgets)
The Toolbox includes the following WinForms controls:

Button: A clickable button.
TextBox: Single-line text input.
Label: Static text display.
CheckBox: Toggleable checkbox with label.
RadioButton: Toggleable radio button with label (groups not auto-managed).
ComboBox: Dropdown list with items.
DateTimePicker: Date/time selector.
DataGridView: Grid for tabular data.
MenuStrip: Horizontal menu bar.
GroupBox: Container with border and title.
ListBox: Scrollable list of items.
RichTextBox: Multi-line text editor with formatting.

Default sizes and properties are applied on drag (e.g., Button: 100x30px).
Properties and Events
Properties and events vary by control. Common ones are listed below; the Properties Panel dynamically shows relevant options.
Common Properties (All Controls)

Name: Unique identifier (e.g., button1).
Text: Display text (not applicable for some like DateTimePicker).
Location: X/Y position on the form.
Size: Width/Height.
TabIndex: Focus order.

Control-Specific Properties

CheckBox/RadioButton:

Checked: Boolean (true/false).


ComboBox:

Items: Array of strings (editable in a list editor).


DateTimePicker:

Value: Date string (e.g., dd-mm-yyyy).
Format: Enum (e.g., Long, Short, Time, Custom).
CustomFormat: String (e.g., dd-MM-yyyy).


DataGridView:

Columns: Array of column names.
AllowUserToAddRows: Boolean.
AllowUserToDeleteRows: Boolean.
ReadOnly: Boolean.


Others: Default to basic text/size/location.

Events
Events are added via the Properties Panel. Common events:

Click: For Button, CheckBox, RadioButton, etc.
TextChanged: For TextBox, RichTextBox, ComboBox.
Enter/Leave: For focus events on inputs.
CheckedChanged: For CheckBox/RadioButton.
ValueChanged: For DateTimePicker.
CellContentClick: For DataGridView.

Entering a handler name generates a method in the code-behind (e.g., private void button1_Click(object sender, EventArgs e) { }).
Dark Mode (Default Theme)

The designer interface is dark-themed by default (e.g., #1e1e1e background, #d4d4d4 text).
Generated forms use dark colors:

Form BackColor: #252526 (dark gray).
Control BackColor: #333333 (buttons/menus) or #2d2d2d (inputs/grids).
ForeColor: #d4d4d4 (light gray text).
Borders: Dark grooves (#3c3c3c).


No light theme support currently—dark mode is enforced for consistency.

Limitations

No support for custom controls or third-party components.
Grouping for RadioButtons is not visually enforced (manual in code).
MenuStrip and DataGridView are preview-only (no full editing of sub-items in designer).
No undo/redo stack.
Limited parsing for complex code—assumes standard WinForms structure.
No runtime preview (design-time only).
Events are basic; advanced delegates not supported.
Tested on .NET 8; may work with older versions but not guaranteed.



Repository: https://github.com/yourusername/winforms-designer 


blue square to move option
red square to delete option 

License
freeware opensource 

Glitch:
every time when you move to other tabs you will need to close designer windows close and reopen .
youcan develop it by using localstorage functionality.

it is useful for beginer leaner who has low end machine so user can learn basic things,for advance he can go for visual studio ide

Thanks for supporting my extension have fun!!! sk Miraj Maharashtra 