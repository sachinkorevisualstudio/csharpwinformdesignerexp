
const vscode = acquireVsCodeApi();
let currentFormData = null;
let selectedControl = null;
let selectedForm = false;
let isDragging = false;
let isResizing = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let copiedControl = null;
let resizeDirection = null;
let dragSource = null; // 'toolbox' or 'move'
let startX, startY, startWidth, startHeight, startLeft, startTop;
const TITLE_BAR_HEIGHT = 30;

// Initialize designer
window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
        case 'init':
            currentFormData = message.formData;
            renderForm(currentFormData);
            break;
        case 'codeChange':
            currentFormData = message.formData;
            renderForm(currentFormData);
            break;
    }
});

function renderForm(formData) {
    const designSurface = document.getElementById('designSurface');
    designSurface.innerHTML = ''; // Clear previous

    // Create form window
    const formWindow = document.createElement('div');
    formWindow.className = 'form-window';
    formWindow.id = 'formWindow';

    // Create title bar
    const titleBar = document.createElement('div');
    titleBar.className = 'title-bar';
    titleBar.id = 'titleBar';
    titleBar.style.backgroundColor = 'skyblue';
    titleBar.innerText = formData.text;
    formWindow.appendChild(titleBar);

    // Create form container (client area)
    const formContainer = document.createElement('div');
    formContainer.className = 'form-container';
    formContainer.id = 'formContainer';
    formContainer.style.width = formData.size.width + 'px';
    formContainer.style.height = formData.size.height + 'px';
    formWindow.appendChild(formContainer);

    designSurface.appendChild(formWindow);

    // Render controls in form container
    formData.controls.forEach(control => {
        createControlElement(control, formContainer);
    });

    // Set total height for form window
    formWindow.style.height = (formData.size.height + TITLE_BAR_HEIGHT) + 'px';
    formWindow.style.width = formData.size.width + 'px';

    setupToolboxDragAndDrop();
    setupKeyboardShortcuts();
    setupFormSelection();
    makeFormResizable();
    vscode.postMessage({ type: 'requestSave' });
}

function setupFormSelection() {
    const formWindow = document.getElementById('formWindow');
    const titleBar = document.getElementById('titleBar');
    const formContainer = document.getElementById('formContainer');

    titleBar.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        deselectAllControls();
        selectForm();
    });

    formContainer.addEventListener('mousedown', (e) => {
        if (e.target === formContainer) {
            e.stopPropagation();
            deselectAllControls();
            selectForm();
        }
    });
}

function deselectAllControls() {
    document.querySelectorAll('.control.selected').forEach(el => {
        el.classList.remove('selected');
    });
    selectedControl = null;
}

function selectForm() {
    const formWindow = document.getElementById('formWindow');
    formWindow.classList.add('selected');
    selectedForm = true;
    showFormProperties();
}

function deselectForm() {
    const formWindow = document.getElementById('formWindow');
    formWindow.classList.remove('selected');
    selectedForm = false;
}

function showFormProperties() {
    const propertiesContent = document.getElementById('propertiesContent');
    propertiesContent.innerHTML = `
        <div class="property-group">
            <h4>Form Properties</h4>
            <div class="property-row">
                <span class="property-label">Name:</span>
                <input class="property-input" type="text" value="${currentFormData.className}" 
                       onchange="updateFormProperty('className', this.value)">
            </div>
            <div class="property-row">
                <span class="property-label">Text:</span>
                <input class="property-input" type="text" value="${currentFormData.text}" 
                       onchange="updateFormProperty('text', this.value)">
            </div>
            <div class="property-row">
                <span class="property-label">Width:</span>
                <input class="property-input" type="number" value="${currentFormData.size.width}" 
                       onchange="updateFormProperty('width', parseInt(this.value))">
            </div>
            <div class="property-row">
                <span class="property-label">Height:</span>
                <input class="property-input" type="number" value="${currentFormData.size.height}" 
                       onchange="updateFormProperty('height', parseInt(this.value))">
            </div>
        </div>
    `;
}

function createControlElement(control, parent) {
    const element = document.createElement('div');
    element.className = 'control';
    element.dataset.name = control.name;
    element.dataset.type = control.type;
    
    const x = Math.round(control.location.x);
    const y = Math.round(control.location.y);
    const width = Math.round(control.size.width);
    const height = Math.round(control.size.height);
    
    element.style.left = x + 'px';
    element.style.top = y + 'px';
    element.style.width = width + 'px';
    element.style.height = height + 'px';
    
    const foreColor = '#d4d4d4';
    let backColor;
    if (['Button', 'MenuStrip', 'GroupBox'].includes(control.type)) {
        backColor = '#333333';
    } else if (['Label', 'CheckBox', 'RadioButton'].includes(control.type)) {
        backColor = 'transparent';
    } else {
        backColor = '#2d2d2d';
    }
    
    control.location.x = x;
    control.location.y = y;
    control.size.width = width;
    control.size.height = height;
    
    switch (control.type) {
        case 'Button':
            element.innerHTML = `<button class="dark-button" style="background:${backColor};color:${foreColor};">${control.text}</button>`;
            break;
        case 'TextBox':
            element.innerHTML = `<input type="text" class="dark-textbox" value="${control.text}" style="background:${backColor};color:${foreColor};">`;
            break;
        case 'Label':
            element.innerHTML = `<div class="dark-label" style="background:${backColor};color:${foreColor};">${control.text}</div>`;
            break;
        case 'CheckBox':
            element.innerHTML = `<div style="width:100%;height:100%;padding:3px;display:flex;align-items:center;gap:5px;background:${backColor};color:${foreColor};">
                <input type="checkbox" class="dark-checkbox" ${control.checked ? 'checked' : ''}>
                <span>${control.text}</span>
            </div>`;
            break;
        case 'RadioButton':
            element.innerHTML = `<div style="width:100%;height:100%;padding:3px;display:flex;align-items:center;gap:5px;background:${backColor};color:${foreColor};">
                <input type="radio" class="dark-checkbox" name="radioGroup" ${control.checked ? 'checked' : ''}>
                <span>${control.text}</span>
            </div>`;
            break;
        case 'ComboBox':
            let optionsHTML = '';
            if (control.items && control.items.length > 0) {
                control.items.forEach(item => {
                    optionsHTML += `<option value="${item}">${item}</option>`;
                });
            } else {
                optionsHTML = '<option>Option 1</option><option>Option 2</option>';
            }
            element.innerHTML = `<select class="dark-combobox" style="background:${backColor};color:${foreColor};">
                ${optionsHTML}
            </select>`;
            break;
        case 'DateTimePicker':
            element.innerHTML = `<div class="dark-datetime" style="background:${backColor};color:${foreColor};">
                <span>${control.value || 'dd-mm-yyyy'}</span>
            </div>`;
            break;
        case 'DataGridView':
            element.innerHTML = `<div class="dark-grid" style="background:${backColor};color:${foreColor};">
                <div style="text-align:center;padding:10px;">DataGridView</div>
                <table style="width:100%;border-collapse:collapse;">
                    <tr><th style="border:1px solid #3c3c3c;padding:4px;">Column1</th><th style="border:1px solid #3c3c3c;padding:4px;">Column2</th></tr>
                    <tr><td style="border:1px solid #3c3c3c;padding:4px;">Data</td><td style="border:1px solid #3c3c3c;padding:4px;">Data</td></tr>
                </table>
            </div>`;
            break;
        case 'MenuStrip':
            element.innerHTML = `<div class="dark-menu" style="background:${backColor};color:${foreColor};">
                <button style="background:transparent;border:none;color:${foreColor};padding:3px 8px;cursor:pointer;">File</button>
                <button style="background:transparent;border:none;color:${foreColor};padding:3px 8px;cursor:pointer;">Edit</button>
                <button style="background:transparent;border:none;color:${foreColor};padding:3px 8px;cursor:pointer;">View</button>
                <button style="background:transparent;border:none;color:${foreColor};padding:3px 8px;cursor:pointer;">Help</button>
            </div>`;
            break;
        case 'GroupBox':
            element.innerHTML = `<div class="dark-groupbox" style="background:${backColor};color:${foreColor};">
                <div style="position:absolute;top:-10px;left:8px;background:${backColor};padding:0 5px;">${control.text}</div>
            </div>`;
            break;
        case 'ListBox':
            element.innerHTML = `<div class="dark-listbox" style="background:${backColor};color:${foreColor};">
                <div>Item 1</div>
                <div>Item 2</div>
                <div>Item 3</div>
            </div>`;
            break;
        case 'RichTextBox':
            element.innerHTML = `<div class="dark-richtextbox" style="background:${backColor};color:${foreColor};">
                ${control.text || 'RichTextBox'}
            </div>`;
            break;
    }
    
    const resizeHandles = [
        { class: 'nw', cursor: 'nwse-resize' },
        { class: 'n', cursor: 'ns-resize' },
        { class: 'ne', cursor: 'nesw-resize' },
        { class: 'e', cursor: 'ew-resize' },
        { class: 'se', cursor: 'nwse-resize' },
        { class: 's', cursor: 'ns-resize' },
        { class: 'sw', cursor: 'nesw-resize' },
        { class: 'w', cursor: 'ew-resize' }
    ];
    
    resizeHandles.forEach(handle => {
        const resizeHandle = document.createElement('div');
        resizeHandle.className = `resize-handle ${handle.class}`;
        resizeHandle.style.cursor = handle.cursor;
        element.appendChild(resizeHandle);
    });
    
    const moveHandle = document.createElement('div');
    moveHandle.className = 'move-handle';
    element.appendChild(moveHandle);
    
    const deleteHandle = document.createElement('div');
    deleteHandle.className = 'delete-handle';
    deleteHandle.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteControl(control);
    });
    element.appendChild(deleteHandle);
    
    makeDraggable(element, control, moveHandle);
    makeResizable(element, control);
    
    element.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        deselectForm();
        selectControl(element, control);
    });
    
    element.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e, control);
    });
    
    parent.appendChild(element);
    return element;
}

function showContextMenu(e, control) {
    const contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';
    contextMenu.style.left = e.clientX + 'px';
    contextMenu.style.top = e.clientY + 'px';
    contextMenu.style.background = '#252526';
    contextMenu.style.border = '2px solid #3c3c3c';
    contextMenu.style.padding = '5px';
    contextMenu.style.zIndex = '10000';
    contextMenu.style.borderRadius = '0';
    contextMenu.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
    contextMenu.style.color = '#d4d4d4';
    
    const deleteOption = document.createElement('div');
    deleteOption.textContent = 'Delete';
    deleteOption.style.padding = '5px 10px';
    deleteOption.style.cursor = 'pointer';
    deleteOption.style.borderRadius = '0';
    deleteOption.addEventListener('mouseover', () => {
        deleteOption.style.background = '#007acc';
        deleteOption.style.color = '#ffffff';
    });
    deleteOption.addEventListener('mouseout', () => {
        deleteOption.style.background = 'transparent';
        deleteOption.style.color = '#d4d4d4';
    });
    deleteOption.addEventListener('click', () => {
        deleteControl(control);
        document.body.removeChild(contextMenu);
    });
    
    const copyOption = document.createElement('div');
    copyOption.textContent = 'Copy';
    copyOption.style.padding = '5px 10px';
    copyOption.style.cursor = 'pointer';
    copyOption.style.borderRadius = '0';
    copyOption.addEventListener('mouseover', () => {
        copyOption.style.background = '#007acc';
        copyOption.style.color = '#ffffff';
    });
    copyOption.addEventListener('mouseout', () => {
        copyOption.style.background = 'transparent';
        copyOption.style.color = '#d4d4d4';
    });
    copyOption.addEventListener('click', () => {
        copiedControl = JSON.parse(JSON.stringify(control));
        document.body.removeChild(contextMenu);
    });
    
    contextMenu.appendChild(copyOption);
    contextMenu.appendChild(deleteOption);
    document.body.appendChild(contextMenu);

    // Remove context menu on click outside
    const removeContextMenu = () => {
        if (contextMenu.parentNode) {
            document.body.removeChild(contextMenu);
        }
        document.removeEventListener('click', removeContextMenu);
    };
    document.addEventListener('click', removeContextMenu);
}

function selectControl(element, control) {
    deselectAllControls();
    element.classList.add('selected');
    selectedControl = control;
    showControlProperties(control, element);
}

function showControlProperties(control, element) {
    const propertiesContent = document.getElementById('propertiesContent');
    propertiesContent.innerHTML = '';

    // Basic properties
    const basicGroup = `
        <div class="property-group">
            <h4>Basic</h4>
            <div class="property-row">
                <span class="property-label">Name:</span>
                <input class="property-input" type="text" value="${control.name}" 
                       onchange="updateControlProperty('name', this.value)">
            </div>
            <div class="property-row">
                <span class="property-label">Text:</span>
                <input class="property-input" type="text" value="${control.text}" 
                       onchange="updateControlProperty('text', this.value)">
            </div>
            <div class="property-row">
                <span class="property-label">X:</span>
                <input class="property-input" type="number" value="${control.location.x}" 
                       onchange="updateControlProperty('x', parseInt(this.value))">
            </div>
            <div class="property-row">
                <span class="property-label">Y:</span>
                <input class="property-input" type="number" value="${control.location.y}" 
                       onchange="updateControlProperty('y', parseInt(this.value))">
            </div>
            <div class="property-row">
                <span class="property-label">Width:</span>
                <input class="property-input" type="number" value="${control.size.width}" 
                       onchange="updateControlProperty('width', parseInt(this.value))">
            </div>
            <div class="property-row">
                <span class="property-label">Height:</span>
                <input class="property-input" type="number" value="${control.size.height}" 
                       onchange="updateControlProperty('height', parseInt(this.value))">
            </div>
            <div class="property-row">
                <span class="property-label">TabIndex:</span>
                <input class="property-input" type="number" value="${control.tabIndex || 0}" 
                       onchange="updateControlProperty('tabIndex', parseInt(this.value))">
            </div>
        </div>
    `;
    propertiesContent.innerHTML += basicGroup;

    // Type-specific properties
    if (control.type === 'CheckBox' || control.type === 'RadioButton') {
        const checkedGroup = `
            <div class="property-group">
                <h4>State</h4>
                <div class="property-row">
                    <span class="property-label">Checked:</span>
                    <input class="property-input" type="checkbox" ${control.checked ? 'checked' : ''} 
                           onchange="updateControlProperty('checked', this.checked)">
                </div>
            </div>
        `;
        propertiesContent.innerHTML += checkedGroup;
    }

    if (control.type === 'ComboBox' || control.type === 'ListBox') {
        const itemsGroup = `
            <div class="property-group">
                <h4>Items</h4>
                <textarea class="property-input" rows="5" onchange="updateComboBoxItems(this.value)">${control.items ? control.items.join('\n') : ''}</textarea>
            </div>
        `;
        propertiesContent.innerHTML += itemsGroup;
    }

    if (control.type === 'DateTimePicker') {
        const dateGroup = `
            <div class="property-group">
                <h4>Date/Time</h4>
                <div class="property-row">
                    <span class="property-label">Value:</span>
                    <input class="property-input" type="date" value="${control.value || ''}" 
                           onchange="updateControlProperty('value', this.value)">
                </div>
                <div class="property-row">
                    <span class="property-label">Format:</span>
                    <select class="property-input" onchange="updateControlProperty('format', this.value)">
                        <option value="Long" ${control.format === 'Long' ? 'selected' : ''}>Long</option>
                        <option value="Short" ${control.format === 'Short' ? 'selected' : ''}>Short</option>
                        <option value="Time" ${control.format === 'Time' ? 'selected' : ''}>Time</option>
                        <option value="Custom" ${control.format === 'Custom' ? 'selected' : ''}>Custom</option>
                    </select>
                </div>
                <div class="property-row" style="${control.format === 'Custom' ? '' : 'display:none;'}">
                    <span class="property-label">Custom Format:</span>
                    <input class="property-input" type="text" value="${control.customFormat || ''}" 
                           onchange="updateControlProperty('customFormat', this.value)">
                </div>
            </div>
        `;
        propertiesContent.innerHTML += dateGroup;
    }

    if (control.type === 'DataGridView') {
        const gridGroup = `
            <div class="property-group">
                <h4>DataGridView</h4>
                <div class="property-row">
                    <span class="property-label">Columns:</span>
                    <textarea class="property-input" rows="5" onchange="updateGridColumns(this.value)">${control.columns ? control.columns.join('\n') : ''}</textarea>
                </div>
                <div class="property-row">
                    <span class="property-label">Allow Add:</span>
                    <input class="property-input" type="checkbox" ${control.allowUserToAddRows ? 'checked' : ''} 
                           onchange="updateControlProperty('allowUserToAddRows', this.checked)">
                </div>
                <div class="property-row">
                    <span class="property-label">Allow Delete:</span>
                    <input class="property-input" type="checkbox" ${control.allowUserToDeleteRows ? 'checked' : ''} 
                           onchange="updateControlProperty('allowUserToDeleteRows', this.checked)">
                </div>
                <div class="property-row">
                    <span class="property-label">Read Only:</span>
                    <input class="property-input" type="checkbox" ${control.readOnly ? 'checked' : ''} 
                           onchange="updateControlProperty('readOnly', this.checked)">
                </div>
            </div>
        `;
        propertiesContent.innerHTML += gridGroup;
    }

    // Events group
    let events = ['Click'];
    if (control.type === 'TextBox' || control.type === 'RichTextBox') {
        events = [...events, 'TextChanged', 'Enter', 'Leave'];
    }
    if (control.type === 'Button') {
        events = ['Click'];
    }
    if (control.type === 'CheckBox' || control.type === 'RadioButton') {
        events = ['CheckedChanged', 'Click'];
    }
    if (control.type === 'ComboBox') {
        events = ['SelectedIndexChanged', 'TextChanged'];
    }
    if (control.type === 'DateTimePicker') {
        events = ['ValueChanged'];
    }
    if (control.type === 'DataGridView') {
        events = ['CellContentClick', 'RowEnter'];
    }
    if (control.type === 'ListBox') {
        events = ['SelectedIndexChanged'];
    }

    const eventGroup = `
        <div class="property-group">
            <h4>Events</h4>
            ${events.map(eventName => `
                <div class="property-row">
                    <span class="property-label">${eventName}:</span>
                    <input class="property-input" type="text" value="${control.events[eventName] || ''}" 
                           onkeydown="handleEventKeydown(event, this)">
                </div>
            `).join('')}
        </div>
    `;
    propertiesContent.innerHTML += eventGroup;
}

function updateControlProperty(prop, value) {
    if (!selectedControl) return;
    const element = document.querySelector(`.control[data-name="${selectedControl.name}"]`);

    switch (prop) {
        case 'name':
            if (currentFormData.controls.some(c => c.name === value && c !== selectedControl)) {
                alert('Name must be unique');
                return;
            }
            selectedControl.name = value;
            element.dataset.name = value;
            break;
        case 'text':
            selectedControl.text = value;
            break;
        case 'x':
            selectedControl.location.x = value;
            element.style.left = value + 'px';
            break;
        case 'y':
            selectedControl.location.y = value;
            element.style.top = value + 'px';
            break;
        case 'width':
            selectedControl.size.width = value;
            element.style.width = value + 'px';
            break;
        case 'height':
            selectedControl.size.height = value;
            element.style.height = value + 'px';
            break;
        case 'tabIndex':
            selectedControl.tabIndex = value;
            break;
        case 'checked':
            selectedControl.checked = value;
            break;
        case 'value':
            selectedControl.value = value;
            break;
        case 'format':
            selectedControl.format = value;
            showControlProperties(selectedControl, element); // Refresh to show/hide custom format
            break;
        case 'customFormat':
            selectedControl.customFormat = value;
            break;
        case 'allowUserToAddRows':
            selectedControl.allowUserToAddRows = value;
            break;
        case 'allowUserToDeleteRows':
            selectedControl.allowUserToDeleteRows = value;
            break;
        case 'readOnly':
            selectedControl.readOnly = value;
            break;
    }

    // Update visual
    const innerElement = element.firstChild;
    if (innerElement) {
        if (['Button', 'Label'].includes(selectedControl.type)) {
            innerElement.textContent = selectedControl.text;
        } else if (selectedControl.type === 'TextBox') {
            innerElement.value = selectedControl.text;
        } else if (selectedControl.type === 'CheckBox' || selectedControl.type === 'RadioButton') {
            innerElement.querySelector('input').checked = selectedControl.checked;
            innerElement.querySelector('span').textContent = selectedControl.text;
        } else if (selectedControl.type === 'DateTimePicker') {
            innerElement.querySelector('span').textContent = selectedControl.value || 'dd-mm-yyyy';
        } else if (selectedControl.type === 'GroupBox') {
            innerElement.querySelector('div').textContent = selectedControl.text;
        } else if (selectedControl.type === 'RichTextBox') {
            innerElement.innerHTML = selectedControl.text || 'RichTextBox';
        }
    }

    updateFormDesign();
}

function updateFormProperty(prop, value) {
    switch (prop) {
        case 'className':
            vscode.postMessage({
                type: 'renameForm',
                newName: value
            });
            break;
        case 'text':
            currentFormData.text = value;
            document.getElementById('titleBar').innerText = value;
            break;
        case 'width':
            currentFormData.size.width = value;
            document.getElementById('formContainer').style.width = value + 'px';
            document.getElementById('formWindow').style.width = value + 'px';
            break;
        case 'height':
            currentFormData.size.height = value;
            document.getElementById('formContainer').style.height = value + 'px';
            document.getElementById('formWindow').style.height = (value + TITLE_BAR_HEIGHT) + 'px';
            break;
    }
    updateFormDesign();
}

function deleteControl(control) {
    vscode.postMessage({
        type: 'deleteControl',
        controlName: control.name
    });
    const index = currentFormData.controls.indexOf(control);
    if (index > -1) {
        currentFormData.controls.splice(index, 1);
    }
    updateFormDesign();
    showFormProperties();
}

function updateComboBoxItems(itemsText) {
    if (!selectedControl) return;
    selectedControl.items = itemsText.split('\n').filter(item => item.trim());
    updateFormDesign();
}

function updateGridColumns(columnsText) {
    if (!selectedControl) return;
    selectedControl.columns = columnsText.split('\n').filter(col => col.trim());
    updateFormDesign();
}

function handleEventKeydown(event, input) {
    if (event.key === 'Enter') {
        event.preventDefault();
        input.blur();

        let eventName = input.previousElementSibling.textContent.trim().replace(':', '');

        // Normalize to PascalCase
        if (eventName) {
            eventName = eventName.charAt(0).toUpperCase() + eventName.slice(1);
        }

        autoPopulateEvent(input, eventName);
        updateEventHandler(eventName, input.value);
    }
}

function autoPopulateEvent(input, eventName) {
    if (input.value.trim() === '') {
        input.value = `${selectedControl.name}_${eventName}`;
    }
}

function updateEventHandler(eventName, handlerName) {
    if (!selectedControl) return;
    if (!selectedControl.events) selectedControl.events = {};
    selectedControl.events[eventName] = handlerName;
    vscode.postMessage({
        type: 'addEventHandler',
        eventName,
        handlerName,
        controlName: selectedControl.name
    });
    updateFormDesign();
}

function updateFormDesign() {
    vscode.postMessage({
        type: 'update',
        formData: currentFormData
    });
}

function setupToolboxDragAndDrop() {
    const toolboxItems = document.querySelectorAll('.toolbox-item');
    const designSurface = document.getElementById('designSurface');
    const formContainer = document.getElementById('formContainer');
    
    toolboxItems.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('control-type', item.dataset.type);
            dragSource = 'toolbox';
        });
    });
    
    designSurface.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });
    
    designSurface.addEventListener('drop', (e) => {
        e.preventDefault();
        if (dragSource !== 'toolbox') return;
        
        const controlType = e.dataTransfer.getData('control-type');
        
        const designSurfaceRect = designSurface.getBoundingClientRect();
        
        const x = Math.round(e.clientX - designSurfaceRect.left);
        const y = Math.round(e.clientY - designSurfaceRect.top);
        
        const formRect = formContainer.getBoundingClientRect();
        const boundedX = Math.max(0, Math.min(x, formRect.width - 100));
        const boundedY = Math.max(0, Math.min(y, formRect.height - 30));
        
        const newControl = {
            name: generateControlName(controlType),
            type: controlType,
            text: controlType,
            location: { x: boundedX, y: boundedY },
            size: { width: 100, height: 30 },
            events: {},
            tabIndex: 0
        };
        
        if (controlType === 'CheckBox' || controlType === 'RadioButton') {
            newControl.checked = false;
        } else if (controlType === 'DateTimePicker') {
            newControl.value = 'dd-mm-yyyy';
            newControl.format = 'Custom';
            newControl.customFormat = 'dd-MM-yyyy';
        } else if (controlType === 'DataGridView') {
            newControl.columns = ['Column1', 'Column2'];
            newControl.allowUserToAddRows = true;
            newControl.allowUserToDeleteRows = true;
            newControl.readOnly = false;
        } else if (controlType === 'MenuStrip') {
            newControl.size = { width: 200, height: 24 };
        } else if (controlType === 'GroupBox') {
            newControl.size = { width: 200, height: 150 };
        } else if (controlType === 'ListBox') {
            newControl.size = { width: 120, height: 100 };
        } else if (controlType === 'RichTextBox') {
            newControl.size = { width: 200, height: 100 };
        }
        
        currentFormData.controls.push(newControl);
        
        const controlElement = createControlElement(newControl, formContainer);
        selectControl(controlElement, newControl);
        
        updateFormDesign();
        dragSource = null;
    });
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' && selectedControl) {
            deleteControl(selectedControl);
        }
        
        if (e.ctrlKey && e.key === 'c' && selectedControl) {
            copiedControl = JSON.parse(JSON.stringify(selectedControl));
            e.preventDefault();
        }
        
        if (e.ctrlKey && e.key === 'v' && copiedControl) {
            pasteControl();
            e.preventDefault();
        }
        
        if (e.ctrlKey && e.key === 's') {
            updateFormDesign();
            vscode.postMessage({ type: 'requestSave' });
            e.preventDefault();
        }
    });
}

function pasteControl() {
    if (!copiedControl || !currentFormData) return;
    
    const newControl = JSON.parse(JSON.stringify(copiedControl));
    newControl.name = generateControlName(newControl.type);
    
    newControl.location.x += 10;
    newControl.location.y += 10;
    
    currentFormData.controls.push(newControl);
    
    const formContainer = document.getElementById('formContainer');
    const controlElement = createControlElement(newControl, formContainer);
    selectControl(controlElement, newControl);
    
    updateFormDesign();
}

function generateControlName(type) {
    const baseName = type.toLowerCase();
    let counter = 1;
    let name = baseName + counter;
    
    while (currentFormData.controls.some(c => c.name === name)) {
        counter++;
        name = baseName + counter;
    }
    
    return name;
}

function makeDraggable(element, control, moveHandle) {
    moveHandle.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle') || 
            e.target.classList.contains('delete-handle') ||
            e.target.tagName === 'INPUT' || 
            e.target.tagName === 'SELECT' ||
            e.target.tagName === 'BUTTON' ||
            e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        isDragging = true;
        dragSource = 'move';
        selectControl(element, control);
        
        const rect = element.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        
        element.style.cursor = 'grabbing';
        element.style.zIndex = '1000';
        
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragUp);
        
        e.preventDefault();
        e.stopPropagation();
    });
    
    function onDragMove(e) {
        if (!isDragging) return;
        
        const formContainer = document.getElementById('formContainer');
        const formRect = formContainer.getBoundingClientRect();
        
        let newX = Math.round(e.clientX - formRect.left - dragOffsetX);
        let newY = Math.round(e.clientY - formRect.top - dragOffsetY);
        
        newX = Math.max(0, Math.min(newX, formRect.width - element.offsetWidth));
        newY = Math.max(0, Math.min(newY, formRect.height - element.offsetHeight));
        
        element.style.left = newX + 'px';
        element.style.top = newY + 'px';
        
        control.location.x = newX;
        control.location.y = newY;
    }
    
    function onDragUp() {
        isDragging = false;
        element.style.cursor = '';
        element.style.zIndex = '';
        
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('mouseup', onDragUp);
        
        updateFormDesign();
    }
}

function makeResizable(element, control) {
    const handles = element.querySelectorAll('.resize-handle');
    
    handles.forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            selectControl(element, control);
            
            startX = e.clientX;
            startY = e.clientY;
            startWidth = parseInt(element.offsetWidth);
            startHeight = parseInt(element.offsetHeight);
            startLeft = parseInt(element.style.left);
            startTop = parseInt(element.style.top);
            
            const handleClass = handle.className.split(' ')[1];
            resizeDirection = handleClass;
            
            document.addEventListener('mousemove', onResizeMove);
            document.addEventListener('mouseup', onResizeUp);
            
            e.preventDefault();
            e.stopPropagation();
        });
    });
    
    function onResizeMove(e) {
        if (!isResizing) return;
        
        const formContainer = document.getElementById('formContainer');
        const formRect = formContainer.getBoundingClientRect();
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newLeft = startLeft;
        let newTop = startTop;
        
        switch (resizeDirection) {
            case 'e':
                newWidth = Math.max(50, startWidth + deltaX);
                break;
            case 'w':
                newWidth = Math.max(50, startWidth - deltaX);
                newLeft = startLeft + deltaX;
                break;
            case 's':
                newHeight = Math.max(20, startHeight + deltaY);
                break;
            case 'n':
                newHeight = Math.max(20, startHeight - deltaY);
                newTop = startTop + deltaY;
                break;
            case 'se':
                newWidth = Math.max(50, startWidth + deltaX);
                newHeight = Math.max(20, startHeight + deltaY);
                break;
            case 'sw':
                newWidth = Math.max(50, startWidth - deltaX);
                newHeight = Math.max(20, startHeight + deltaY);
                newLeft = startLeft + deltaX;
                break;
            case 'ne':
                newWidth = Math.max(50, startWidth + deltaX);
                newHeight = Math.max(20, startHeight - deltaY);
                newTop = startTop + deltaY;
                break;
            case 'nw':
                newWidth = Math.max(50, startWidth - deltaX);
                newHeight = Math.max(20, startHeight - deltaY);
                newLeft = startLeft + deltaX;
                newTop = startTop + deltaY;
                break;
        }
        
        if (resizeDirection.includes('w') && newLeft < 0) {
            newWidth += newLeft;
            newLeft = 0;
        }
        
        if (resizeDirection.includes('n') && newTop < 0) {
            newHeight += newTop;
            newTop = 0;
        }
        
        if (newLeft + newWidth > formRect.width) {
            newWidth = formRect.width - newLeft;
        }
        
        if (newTop + newHeight > formRect.height) {
            newHeight = formRect.height - newTop;
        }
        
        newWidth = Math.round(newWidth);
        newHeight = Math.round(newHeight);
        newLeft = Math.round(newLeft);
        newTop = Math.round(newTop);
        
        newWidth = Math.max(50, newWidth);
        newHeight = Math.max(20, newHeight);
        
        element.style.width = newWidth + 'px';
        element.style.height = newHeight + 'px';
        element.style.left = newLeft + 'px';
        element.style.top = newTop + 'px';
        
        control.size.width = newWidth;
        control.size.height = newHeight;
        control.location.x = newLeft;
        control.location.y = newTop;
    }
    
    function onResizeUp() {
        isResizing = false;
        resizeDirection = null;
        document.removeEventListener('mousemove', onResizeMove);
        document.removeEventListener('mouseup', onResizeUp);
        
        updateFormDesign();
    }
}

function makeFormResizable() {
    const formWindow = document.getElementById('formWindow');
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'form-resize-handle';
    
    formWindow.appendChild(resizeHandle);
    
    let isResizingForm = false;
    let startWidth, startHeight, startX, startY;
    
    resizeHandle.addEventListener('mousedown', (e) => {
        isResizingForm = true;
        startWidth = parseInt(formWindow.offsetWidth);
        startHeight = parseInt(formWindow.offsetHeight);
        startX = e.clientX;
        startY = e.clientY;
        
        document.addEventListener('mousemove', onFormResizeMove);
        document.addEventListener('mouseup', onFormResizeUp);
        
        e.preventDefault();
        e.stopPropagation();
    });
    
    function onFormResizeMove(e) {
        if (!isResizingForm) return;
        
        let newWidth = Math.round(startWidth + (e.clientX - startX));
        let newHeight = Math.round(startHeight + (e.clientY - startY));
        
        newWidth = Math.max(200, newWidth);
        newHeight = Math.max(150 + TITLE_BAR_HEIGHT, newHeight);
        
        formWindow.style.width = newWidth + 'px';
        formWindow.style.height = newHeight + 'px';
        
        const formContainer = document.getElementById('formContainer');
        formContainer.style.width = newWidth + 'px';
        formContainer.style.height = (newHeight - TITLE_BAR_HEIGHT) + 'px';
        
        currentFormData.size.width = newWidth;
        currentFormData.size.height = newHeight - TITLE_BAR_HEIGHT;
    }
    
    function onFormResizeUp() {
        isResizingForm = false;
        document.removeEventListener('mousemove', onFormResizeMove);
        document.removeEventListener('mouseup', onFormResizeUp);
        
        updateFormDesign();
    }
}

window.updateControlProperty = updateControlProperty;
window.updateFormProperty = updateFormProperty;
window.updateEventHandler = updateEventHandler;
window.updateComboBoxItems = updateComboBoxItems;
window.updateGridColumns = updateGridColumns;
window.handleEventKeydown = handleEventKeydown;
window.autoPopulateEvent = autoPopulateEvent;
