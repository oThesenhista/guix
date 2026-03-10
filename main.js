const canvasContainer = document.getElementById('canvas-container');
const canvas = document.getElementById('canvas');
const layerObjects = document.getElementById('layer-objects');
const toggleSnap = document.getElementById('toggle-snap');
const snapValueInput = document.getElementById('snap-value');
const fillColor = document.getElementById('fill-color');

const shortcutsToggle = document.getElementById('shortcuts-toggle');
const shortcutsList = document.getElementById('shortcuts-list');
shortcutsToggle.addEventListener('click', () => {
    const isHidden = shortcutsList.style.display === 'none';
    shortcutsList.style.display = isHidden ? 'flex' : 'none';
    shortcutsToggle.classList.toggle('expanded', isHidden);
});

// === CARREGAMENTO DINÂMICO DE FONTES LOCAIS ===
fetch('fonts.json')
    .then(r => r.json())
    .then(list => {
        const fontSelect = document.getElementById('inp-text-font');
        const styleTag = document.createElement('style');
        let css = '';
        
        if(list.length > 0) {
            const separator = document.createElement('option');
            separator.disabled = true;
            separator.textContent = '─── Local Fonts ───';
            fontSelect.appendChild(separator);
        }

        list.forEach(file => {
            const fontName = file.replace(/\.[^/.]+$/, ""); // Remove extensão para usar como nome
            const ext = file.split('.').pop().toLowerCase();
            let format = 'truetype';
            if(ext === 'otf') format = 'opentype';
            if(ext === 'woff') format = 'woff';
            if(ext === 'woff2') format = 'woff2';

            css += `
                @font-face {
                    font-family: '${fontName}';
                    src: url('fonts/${file}') format('${format}');
                }
            `;

            const option = document.createElement('option');
            option.value = `'${fontName}', sans-serif`;
            option.textContent = fontName;
            fontSelect.appendChild(option);
        });

        styleTag.innerHTML = css;
        document.head.appendChild(styleTag);
    })
    .catch(err => console.log("Pasta fonts/ vazia ou fonts.json não encontrado. Usando apenas Google Fonts."));
// ==============================================

let canvasPanX = 0, canvasPanY = 0, canvasZoom = 1, isCanvasPanning = false, panStartX = 0, panStartY = 0;
function updateCanvasTransform() { canvas.style.transform = `translate(${canvasPanX}px, ${canvasPanY}px) scale(${canvasZoom})`; }
function centerCanvas() {
    const rect = canvasContainer.getBoundingClientRect();
    canvasPanX = (rect.width - parseFloat(canvas.getAttribute('width')||512)) / 2;
    canvasPanY = (rect.height - parseFloat(canvas.getAttribute('height')||512)) / 2;
    canvasZoom = 1; updateCanvasTransform();
}
window.addEventListener('resize', centerCanvas);
setTimeout(centerCanvas, 10);

canvasContainer.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.altKey || e.shiftKey) return; 
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    let newZoom = Math.max(0.1, Math.min(canvasZoom * Math.exp(delta), 10)); 
    const rect = canvasContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top;
    canvasPanX = mouseX - (mouseX - canvasPanX) * (newZoom / canvasZoom);
    canvasPanY = mouseY - (mouseY - canvasPanY) * (newZoom / canvasZoom);
    canvasZoom = newZoom; updateCanvasTransform();
}, { passive: false });

canvasContainer.addEventListener('mousedown', (e) => {
    if (e.button === 1 || (e.button === 0 && document.body.classList.contains('space-pressed'))) { 
        e.preventDefault(); isCanvasPanning = true;
        panStartX = e.clientX - canvasPanX; panStartY = e.clientY - canvasPanY;
        canvasContainer.style.cursor = 'grabbing'; return;
    }
});
document.addEventListener('keydown', (e) => { if(e.code === 'Space' && e.target === document.body) { e.preventDefault(); document.body.classList.add('space-pressed'); canvasContainer.style.cursor = 'grab'; }});
document.addEventListener('keyup', (e) => { if(e.code === 'Space') { document.body.classList.remove('space-pressed'); canvasContainer.style.cursor = 'default'; }});

let isDragging = false;
window.selectedElements = []; 
let draggingElement = null;
let offset = { x: 0, y: 0 };
let draggingChildren = [];
let parentBaseTx = 0, parentBaseTy = 0;

const shapesPanel = document.getElementById('shapes-panel');
const resizer = document.getElementById('panel-resizer');
let isResizingPanel = false;

resizer.addEventListener('mousedown', () => { isResizingPanel = true; document.body.style.cursor = 'ns-resize'; });
document.addEventListener('mousemove', (e) => {
    if (!isResizingPanel) return;
    const newHeight = window.innerHeight - e.clientY;
    if (newHeight > 60 && newHeight < window.innerHeight * 0.6) shapesPanel.style.height = `${newHeight}px`;
});
document.addEventListener('mouseup', () => { if (isResizingPanel) { isResizingPanel = false; document.body.style.cursor = 'default'; } });

function getMousePos(evt) {
    const CTM = canvas.getScreenCTM();
    return { x: (evt.clientX - CTM.e) / CTM.a, y: (evt.clientY - CTM.f) / CTM.d };
}
window.snap = function(value) {
    if (!toggleSnap.checked) return value;
    const s = parseInt(snapValueInput.value) || 16;
    return Math.round(value / s) * s;
}

let isRatioLocked = true;
document.getElementById('btn-lock-ratio').onclick = (e) => {
    isRatioLocked = !isRatioLocked;
    e.currentTarget.classList.toggle('active', isRatioLocked);
};

window.updatePropsPanel = function() {
    const section = document.getElementById('obj-props-section');
    const textSection = document.getElementById('text-props-section');
    const textInput = document.getElementById('inp-text-content');
    const fontInput = document.getElementById('inp-text-font');

    if (window.selectedElements.length > 0) {
        section.style.opacity = '1';
        section.style.pointerEvents = 'all';
        const el = window.selectedElements[0];
        document.getElementById('inp-obj-x').value = Math.round(parseFloat(el.dataset.tx));
        document.getElementById('inp-obj-y').value = Math.round(parseFloat(el.dataset.ty));
        
        let sx = parseFloat(el.dataset.scaleX || 1);
        let sy = parseFloat(el.dataset.scaleY || 1);
        document.getElementById('inp-obj-w').value = Math.round(sx * 64);
        document.getElementById('inp-obj-h').value = Math.round(sy * 64);

        const textNode = el.querySelector('text');
        if (textNode) {
            textSection.style.display = 'flex';
            textInput.value = textNode.textContent;
            fontInput.value = textNode.getAttribute('font-family') || "'Inter', sans-serif";
        } else {
            textSection.style.display = 'none';
        }

    } else {
        section.style.opacity = '0.3';
        section.style.pointerEvents = 'none';
        document.getElementById('inp-obj-x').value = ''; document.getElementById('inp-obj-y').value = '';
        document.getElementById('inp-obj-w').value = ''; document.getElementById('inp-obj-h').value = '';
        textSection.style.display = 'none';
    }
}

document.getElementById('inp-text-content').addEventListener('input', (e) => {
    if (window.selectedElements.length > 0) {
        const textNode = window.selectedElements[0].querySelector('text');
        if (textNode) textNode.textContent = e.target.value;
    }
});

document.getElementById('inp-text-font').addEventListener('change', (e) => {
    if (window.selectedElements.length > 0) {
        window.selectedElements.forEach(el => {
            if(el.dataset.locked !== 'true') {
                const textNode = el.querySelector('text');
                if (textNode) textNode.setAttribute('font-family', e.target.value);
            }
        });
    }
});

function applyObjProps(source) {
    if (window.selectedElements.length === 0) return;
    
    let newX = parseFloat(document.getElementById('inp-obj-x').value);
    let newY = parseFloat(document.getElementById('inp-obj-y').value);
    let newW = parseFloat(document.getElementById('inp-obj-w').value);
    let newH = parseFloat(document.getElementById('inp-obj-h').value);

    if (isNaN(newW) || newW <= 0) newW = 1;
    if (isNaN(newH) || newH <= 0) newH = 1;

    if (isRatioLocked && (source === 'w' || source === 'h')) {
        const firstEl = window.selectedElements[0];
        const oldW = parseFloat(firstEl.dataset.scaleX || 1) * 64;
        const oldH = parseFloat(firstEl.dataset.scaleY || 1) * 64;
        const ratio = oldW / oldH;

        if (source === 'w') { newH = Math.round(newW / ratio); document.getElementById('inp-obj-h').value = newH; } 
        else if (source === 'h') { newW = Math.round(newH * ratio); document.getElementById('inp-obj-w').value = newW; }
    }

    window.selectedElements.forEach(el => {
        if (el.dataset.locked === 'true') return;
        if (!isNaN(newX) && source === 'x') el.dataset.tx = newX;
        if (!isNaN(newY) && source === 'y') el.dataset.ty = newY;
        if (source === 'w' || source === 'h') {
            el.dataset.scaleX = newW / 64;
            el.dataset.scaleY = newH / 64;
        }
        window.updateTransform(el);
    });
}

function setupScrub(labelId, inputId, isCanvasSize) {
    const label = document.getElementById(labelId);
    const input = document.getElementById(inputId);
    let isScrubbing = false; let startX, startVal;

    label.addEventListener('mousedown', (e) => {
        isScrubbing = true; startX = e.clientX;
        startVal = parseFloat(input.value) || 0;
        document.body.style.cursor = 'ew-resize';
        e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
        if (!isScrubbing) return;
        const delta = e.clientX - startX;
        input.value = Math.round(startVal + delta);
        input.dispatchEvent(new Event('input')); 
    });
    window.addEventListener('mouseup', () => {
        if (isScrubbing) { isScrubbing = false; document.body.style.cursor = 'default'; }
    });
}

['w', 'h'].forEach(axis => {
    setupScrub(`lbl-canvas-${axis}`, `inp-canvas-${axis}`, true);
    document.getElementById(`inp-canvas-${axis}`).addEventListener('input', (e) => {
        let val = Math.max(1, parseInt(e.target.value) || 1);
        if (axis === 'w') canvas.setAttribute('width', val);
        if (axis === 'h') canvas.setAttribute('height', val);
    });
});

['x', 'y', 'w', 'h'].forEach(axis => {
    setupScrub(`lbl-obj-${axis}`, `inp-obj-${axis}`, false);
    document.getElementById(`inp-obj-${axis}`).addEventListener('input', () => applyObjProps(axis));
});

window.selectElement = function(el, multi = false) {
    if (!multi) {
        window.selectedElements.forEach(item => item.classList.remove('selected'));
        window.selectedElements = [];
    }
    if (el) {
        const index = window.selectedElements.indexOf(el);
        if (multi && index > -1) {
            el.classList.remove('selected'); window.selectedElements.splice(index, 1);
        } else if (index === -1) {
            el.classList.add('selected'); window.selectedElements.push(el);
        }
    }
    document.querySelectorAll('.layer-item').forEach(item => item.classList.remove('active'));
    window.selectedElements.forEach(item => {
        const layerUi = document.querySelector(`.layer-item[data-id="${item.id}"]`);
        if (layerUi) layerUi.classList.add('active');
    });

    if (window.selectedElements.length > 0) {
        const first = window.selectedElements[0];
        const inner = first.querySelector('.inner-shape');
        if (inner && inner.getAttribute('fill') && inner.getAttribute('fill').startsWith('#')) {
            fillColor.value = inner.getAttribute('fill');
        }
    }
    window.updatePropsPanel();
}

canvas.addEventListener('mousedown', (e) => {
    if (isCanvasPanning || e.button !== 0) return; 

    let target = e.target.closest('.draggable');
    if (target) {
        let dragTarget = null;
        let current = target.id;

        while (current) {
            const el = document.getElementById(current);
            if (window.selectedElements.includes(el)) { dragTarget = el; break; }
            const ui = document.querySelector(`.layer-item[data-id="${current}"]`);
            current = ui ? (ui.dataset.parent || ui.dataset.maskFor) : null;
        }

        if (e.ctrlKey) {
            let highest = document.getElementById(window.getHighestLogicalParent(target.id)) || target;
            if (highest.dataset.locked === 'true') return;
            window.selectElement(highest, e.shiftKey);
            dragTarget = highest;
        }

        if (!dragTarget || dragTarget.dataset.locked === 'true') return;

        isDragging = true; draggingElement = dragTarget;
        const pos = getMousePos(e);
        offset.x = pos.x - parseFloat(dragTarget.dataset.tx);
        offset.y = pos.y - parseFloat(dragTarget.dataset.ty);
        parentBaseTx = parseFloat(dragTarget.dataset.tx);
        parentBaseTy = parseFloat(dragTarget.dataset.ty);
        
        let allIds = new Set();
        window.selectedElements.forEach(sel => {
            allIds.add(sel.id);
            window.getAllLogicalDescendants(sel.id).forEach(id => allIds.add(id));
        });

        draggingChildren = Array.from(allIds).map(id => {
            const el = document.getElementById(id);
            return { el, bX: parseFloat(el.dataset.tx), bY: parseFloat(el.dataset.ty) };
        });
        
    } else if (e.target.id === 'bg-grid' || e.target.id === 'bg-canvas') {
        window.selectElement(null, false);
    }
});

window.addEventListener('mousemove', (e) => {
    if (isCanvasPanning) {
        canvasPanX = e.clientX - panStartX;
        canvasPanY = e.clientY - panStartY;
        updateCanvasTransform();
        return; 
    }

    if (isDragging && draggingElement) {
        const pos = getMousePos(e);
        const sX = window.snap(pos.x - offset.x);
        const sY = window.snap(pos.y - offset.y);
        const dX = sX - parentBaseTx, dY = sY - parentBaseTy;
        
        draggingChildren.forEach(c => {
            c.el.dataset.tx = c.bX + dX;
            c.el.dataset.ty = c.bY + dY;
            window.updateTransform(c.el);
        });
        window.updatePropsPanel();
    }
});

window.addEventListener('mouseup', (e) => {
    if (e.button === 1 || isCanvasPanning) {
        isCanvasPanning = false;
        canvasContainer.style.cursor = document.body.classList.contains('space-pressed') ? 'grab' : 'default';
    }
    isDragging = false;
});

fillColor.addEventListener('input', (e) => {
    window.selectedElements.forEach(el => {
        if(el.dataset.locked !== 'true') {
            const inner = el.querySelector('.inner-shape');
            if (inner && inner.tagName !== 'image') inner.setAttribute('fill', e.target.value);
        }
    });
});

let toolCounter = 0;

document.getElementById('btn-add-text').addEventListener('click', () => {
    toolCounter++;
    const id = `text-${toolCounter}`;
    const g = document.createElementNS("http://www.w3.org/2000/svg", 'g');
    g.id = id; 
    g.setAttribute('class', 'draggable'); 
    g.dataset.tx = window.snap(256); 
    g.dataset.ty = window.snap(256); 
    g.dataset.scaleX = 1; 
    g.dataset.scaleY = 1; 
    g.dataset.rotate = 0;
    window.updateTransform(g);

    const textNode = document.createElementNS("http://www.w3.org/2000/svg", 'text');
    textNode.setAttribute('class', 'shape-element inner-shape'); 
    textNode.setAttribute('fill', document.getElementById('fill-color').value);
    textNode.setAttribute('font-size', '48');
    textNode.setAttribute('font-family', "'Inter', sans-serif");
    textNode.setAttribute('text-anchor', 'middle');
    textNode.setAttribute('dominant-baseline', 'middle');
    textNode.textContent = "Text";
    
    g.appendChild(textNode);
    document.getElementById('layer-objects').appendChild(g);
    window.addLayerToUI(id, 'T Text');
    window.selectElement(g);
});

document.getElementById('btn-add-image').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const imgObj = new Image();
        imgObj.onload = function() {
            let w = imgObj.width; let h = imgObj.height;
            const maxDim = 300; 
            if (w > maxDim || h > maxDim) {
                const ratio = Math.min(maxDim / w, maxDim / h);
                w = w * ratio; h = h * ratio;
            }

            toolCounter++;
            const id = `image-${toolCounter}`;
            const g = document.createElementNS("http://www.w3.org/2000/svg", 'g');
            g.id = id; g.setAttribute('class', 'draggable'); 
            g.dataset.tx = window.snap(256); g.dataset.ty = window.snap(256); 
            g.dataset.scaleX = 1; g.dataset.scaleY = 1; g.dataset.rotate = 0;
            window.updateTransform(g);

            const imageNode = document.createElementNS("http://www.w3.org/2000/svg", 'image');
            imageNode.setAttribute('class', 'shape-element inner-shape');
            imageNode.setAttribute('href', event.target.result);
            imageNode.setAttribute('width', w); imageNode.setAttribute('height', h);
            imageNode.setAttribute('x', -w / 2); imageNode.setAttribute('y', -h / 2);
            imageNode.setAttribute('preserveAspectRatio', 'none'); 
            
            g.appendChild(imageNode);
            document.getElementById('layer-objects').appendChild(g);
            window.addLayerToUI(id, '🖼️ Image');
            window.selectElement(g);
        }
        imgObj.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = ''; 
});

document.getElementById('fill-image').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file || window.selectedElements.length === 0) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        const base64Url = event.target.result;
        const patternId = 'img-' + Date.now();
        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute('id', patternId); pattern.setAttribute('patternUnits', 'objectBoundingBox');
        pattern.setAttribute('width', 1); pattern.setAttribute('height', 1);
        
        const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        image.setAttribute('href', base64Url); image.setAttribute('width', '100%');
        image.setAttribute('height', '100%'); image.setAttribute('preserveAspectRatio', 'none');
        
        pattern.appendChild(image);
        document.getElementById('canvas-defs').appendChild(pattern);
        
        window.selectedElements.forEach(el => {
            if(el.dataset.locked !== 'true') {
                const innerShape = el.querySelector('.inner-shape');
                if (innerShape && innerShape.tagName !== 'image') innerShape.setAttribute('fill', `url(#${patternId})`);
            }
        });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
});

document.querySelectorAll('.bool-btn[data-bool]').forEach(btn => {
    btn.addEventListener('click', (e) => { alert("Pathfinder Engine is being rebuilt for Multi-Selection. Coming soon!"); });
});

window.getAllLogicalDescendants = function(parentId) {
    let descendants = [];
    document.querySelectorAll('.layer-item').forEach(item => {
        if (item.dataset.parent === parentId || item.dataset.maskFor === parentId) {
            descendants.push(item.dataset.id);
            descendants = descendants.concat(window.getAllLogicalDescendants(item.dataset.id));
        }
    });
    return descendants;
}

window.getHighestLogicalParent = function(elementId) {
    const layerItem = document.querySelector(`.layer-item[data-id="${elementId}"]`);
    if (!layerItem) return elementId;
    if (layerItem.dataset.parent) return window.getHighestLogicalParent(layerItem.dataset.parent);
    return elementId;
};