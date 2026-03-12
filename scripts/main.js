"use strict";
// main.js - Correção de Perda de Foco da Barra de Espaço

const canvasContainer = document.getElementById('canvas-container');
const canvas = document.getElementById('canvas');

const shortcutsToggle = document.getElementById('shortcuts-toggle');
const shortcutsList = document.getElementById('shortcuts-list');
shortcutsToggle.addEventListener('click', () => {
    const isHidden = shortcutsList.style.display === 'none';
    shortcutsList.style.display = isHidden ? 'flex' : 'none';
    shortcutsToggle.classList.toggle('expanded', isHidden);
});

const toggleSnapIcon = document.getElementById('toggle-snap-icon');
toggleSnapIcon.addEventListener('click', () => {
    window.isSnapEnabled = !window.isSnapEnabled;
    toggleSnapIcon.classList.toggle('active', window.isSnapEnabled);
});

fetch('assets/fonts.json').then(r => r.json()).then(list => {
    const fontSelect = document.getElementById('inp-text-font');
    const styleTag = document.createElement('style'); let css = '';
    if(list.length > 0) {
        const sep = document.createElement('option');
        sep.disabled = true; sep.textContent = '── Local Fonts ──'; fontSelect.appendChild(sep);
    }
    list.forEach(file => {
        const fontName = file.replace(/\.[^/.]+$/, ""); 
        const ext = file.split('.').pop().toLowerCase();
        let format = ext === 'otf' ? 'opentype' : ext === 'woff2' ? 'woff2' : ext === 'woff' ? 'woff' : 'truetype';
        css += `@font-face { font-family: '${fontName}'; src: url('assets/fonts/${file}') format('${format}'); }`;
        const opt = document.createElement('option');
        opt.value = `'${fontName}', sans-serif`; opt.textContent = fontName; fontSelect.appendChild(opt);
    });
    styleTag.innerHTML = css; document.head.appendChild(styleTag);
}).catch(err => {});

let canvasPanX = 0, canvasPanY = 0, canvasZoom = 1, isCanvasPanning = false, panStartX = 0, panStartY = 0;
function updateCanvasTransform() { canvas.style.transform = `translate(${canvasPanX}px, ${canvasPanY}px) scale(${canvasZoom})`; }
function centerCanvas() {
    const rect = canvasContainer.getBoundingClientRect();
    canvasPanX = (rect.width - parseFloat(canvas.getAttribute('width')||512)) / 2;
    canvasPanY = (rect.height - parseFloat(canvas.getAttribute('height')||512)) / 2;
    canvasZoom = 1; updateCanvasTransform();
}
window.addEventListener('resize', centerCanvas); setTimeout(centerCanvas, 10);

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

// A MÁGICA 1: O Spacebar agora ignora botões e trava o foco na tela pra você dar Pan em paz!
document.addEventListener('keydown', (e) => { 
    if(e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') { 
        e.preventDefault(); 
        document.body.classList.add('space-pressed'); 
        canvasContainer.style.cursor = 'grab'; 
    }
});
document.addEventListener('keyup', (e) => { 
    if(e.code === 'Space') { 
        document.body.classList.remove('space-pressed'); 
        canvasContainer.style.cursor = 'default'; 
    }
});

const resizer = document.getElementById('panel-resizer');
const shapesPanel = document.getElementById('shapes-panel');
const collapseBtn = document.getElementById('shapes-collapse-btn');
let isResizingPanel = false;

collapseBtn.addEventListener('click', (e) => {
    e.stopPropagation(); 
    shapesPanel.classList.toggle('collapsed');
    resizer.classList.toggle('collapsed');
    setTimeout(() => window.dispatchEvent(new Event('resize')), 10);
});

resizer.addEventListener('mousedown', (e) => {
    if (e.target === collapseBtn || collapseBtn.contains(e.target)) return;
    if (shapesPanel.classList.contains('collapsed')) {
        shapesPanel.classList.remove('collapsed');
        resizer.classList.remove('collapsed');
    }
    isResizingPanel = true; 
    document.body.style.cursor = 'ns-resize'; 
});

document.addEventListener('mousemove', (e) => {
    if (!isResizingPanel) return;
    const newHeight = window.innerHeight - e.clientY;
    if (newHeight > 60 && newHeight < window.innerHeight * 0.6) {
        shapesPanel.style.height = `${newHeight}px`;
    }
});

document.addEventListener('mouseup', () => { 
    if (isResizingPanel) { 
        isResizingPanel = false; 
        document.body.style.cursor = 'default'; 
        window.dispatchEvent(new Event('resize')); 
    } 
});

function getMousePos(evt) {
    const CTM = canvas.getScreenCTM();
    return { x: (evt.clientX - CTM.e) / CTM.a, y: (evt.clientY - CTM.f) / CTM.d };
}

window.selectElement = function(id, multi = false) {
    if (!multi) window.selectedElementsIds = [];
    if (id) {
        const index = window.selectedElementsIds.indexOf(id);
        if (multi && index > -1) window.selectedElementsIds.splice(index, 1);
        else if (index === -1) window.selectedElementsIds.push(id);
    }
    
    document.querySelectorAll('.bool-btn[data-bool]').forEach(b => b.classList.remove('active'));
    if (window.selectedElementsIds.length === 1) {
        const layer = window.LayerTree.find(l => l.id === window.selectedElementsIds[0]);
        if (layer && layer.maskForId) {
            const mode = layer.boolMode || 'intersect';
            const btn = document.querySelector(`.bool-btn[data-bool="${mode}"]`);
            if (btn) btn.classList.add('active');
        } else { 
            const btn = document.querySelector('.bool-btn[data-bool="union"]');
            if(btn) btn.classList.add('active'); 
        }
    }
    window.Render();
    if(window.updatePropsPanel) window.updatePropsPanel();
};

let isDragging = false; let hasDragged = false;
let draggingElementId = null; let offset = { x: 0, y: 0 };
let draggingChildren = []; let parentBaseTx = 0, parentBaseTy = 0;
let dragStartX = 0, dragStartY = 0; let dragAxis = null;

canvas.addEventListener('mousedown', (e) => {
    if (isCanvasPanning || e.button !== 0) return; 

    let target = e.target.closest('.draggable');
    if (target) {
        let dragTargetId = target.id;

        if (e.ctrlKey && !e.altKey) {
            dragTargetId = window.getHighestLogicalParent(target.id);
            window.selectElement(dragTargetId, e.shiftKey);
        } else {
            if (!window.selectedElementsIds.includes(dragTargetId)) {
                window.selectElement(dragTargetId, e.shiftKey);
            }
        }

        const dragLayer = window.LayerTree.find(l => l.id === dragTargetId);
        if (!dragLayer || dragLayer.locked) return;

        if (e.ctrlKey && e.altKey) {
            if(window.duplicateSelection) window.duplicateSelection();
            dragTargetId = window.selectedElementsIds[0]; 
            if(window.saveState) window.saveState();
        }

        isDragging = true; hasDragged = false; draggingElementId = dragTargetId;
        const pos = getMousePos(e);
        dragStartX = pos.x; dragStartY = pos.y; dragAxis = null;
        
        const dragRoot = window.LayerTree.find(l => l.id === dragTargetId);
        offset.x = pos.x - dragRoot.tx; offset.y = pos.y - dragRoot.ty;
        parentBaseTx = dragRoot.tx; parentBaseTy = dragRoot.ty;
        
        let allIds = new Set();
        const topLevelIds = window.getTopLevelSelectedIds ? window.getTopLevelSelectedIds() : window.selectedElementsIds;
        topLevelIds.forEach(selId => {
            allIds.add(selId);
            window.getAllLogicalDescendants(selId).forEach(id => allIds.add(id));
        });

        draggingChildren = Array.from(allIds).map(id => {
            const layer = window.LayerTree.find(l => l.id === id);
            return { id: id, bX: layer.tx, bY: layer.ty };
        });
        
    } else if (e.target.id === 'bg-grid' || e.target.id === 'bg-canvas') {
        window.selectElement(null, false);
    }
});

window.addEventListener('mousemove', (e) => {
    if (isCanvasPanning) {
        canvasPanX = e.clientX - panStartX; canvasPanY = e.clientY - panStartY; updateCanvasTransform(); return; 
    }

    if (isDragging && draggingElementId) {
        hasDragged = true; const pos = getMousePos(e);
        let sX = window.snap ? window.snap(pos.x - offset.x) : (pos.x - offset.x); 
        let sY = window.snap ? window.snap(pos.y - offset.y) : (pos.y - offset.y);

        const guide = document.getElementById('axis-guide');
        
        if (e.shiftKey) {
            if (!dragAxis) dragAxis = Math.abs(pos.x - dragStartX) > Math.abs(pos.y - dragStartY) ? 'x' : 'y';
            if (guide) guide.style.display = 'block';
            
            if (dragAxis === 'x') {
                sY = parentBaseTy; 
                if(guide) { guide.setAttribute('x1', '-10000'); guide.setAttribute('x2', '10000'); guide.setAttribute('y1', sY); guide.setAttribute('y2', sY); }
            } else if (dragAxis === 'y') {
                sX = parentBaseTx;
                if(guide) { guide.setAttribute('x1', sX); guide.setAttribute('x2', sX); guide.setAttribute('y1', '-10000'); guide.setAttribute('y2', '10000'); }
            }
        } else { dragAxis = null; if(guide) guide.style.display = 'none'; }

        const dX = sX - parentBaseTx; const dY = sY - parentBaseTy;
        
        draggingChildren.forEach(c => {
            const layer = window.LayerTree.find(l => l.id === c.id);
            if (layer) { layer.tx = c.bX + dX; layer.ty = c.bY + dY; }
        });
        
        window.Render();
        if(window.updatePropsPanel) window.updatePropsPanel();
    }
});

window.addEventListener('mouseup', (e) => {
    if (e.button === 1 || isCanvasPanning) {
        isCanvasPanning = false; canvasContainer.style.cursor = document.body.classList.contains('space-pressed') ? 'grab' : 'default';
    }
    if (isDragging) {
        const guide = document.getElementById('axis-guide');
        if (guide) guide.style.display = 'none';
        if (hasDragged && window.saveState) window.saveState();
    }
    isDragging = false;
});

document.getElementById('btn-add-text').addEventListener('click', () => {
    const id = `id-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const color = document.getElementById('fill-color').value;
    
    const textNode = document.createElementNS("http://www.w3.org/2000/svg", 'text');
    textNode.setAttribute('class', 'shape-element inner-shape'); 
    textNode.setAttribute('fill', color);
    textNode.setAttribute('font-size', '48'); 
    textNode.setAttribute('font-family', "'Inter', sans-serif");
    textNode.setAttribute('text-anchor', 'middle'); 
    textNode.setAttribute('dominant-baseline', 'middle');
    textNode.textContent = "Text";

    const layerObj = {
        id: id, name: window.getUniqueLayerName ? window.getUniqueLayerName('Text') : 'Text', type: 'text',
        tx: window.snap ? window.snap(256) : 256, ty: window.snap ? window.snap(256) : 256, 
        scaleX: 1, scaleY: 1, rotate: 0, skewX: 0, skewY: 0, opacity: 1,
        locked: false, hidden: false, collapsed: false,
        parentId: null, maskForId: null, boolMode: null,
        fill: color, blur: 0, filterId: null, color: null,
        svgContent: textNode.outerHTML
    };

    window.LayerTree.push(layerObj); window.selectElement(id, false); if(window.saveState) window.saveState();
});

document.getElementById('btn-add-image').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        const imgObj = new Image();
        imgObj.onload = function() {
            let w = imgObj.width; let h = imgObj.height; const maxDim = 300; 
            if (w > maxDim || h > maxDim) { const ratio = Math.min(maxDim / w, maxDim / h); w *= ratio; h *= ratio; }

            const id = `id-${Date.now()}-${Math.floor(Math.random()*1000)}`;
            
            const imageNode = document.createElementNS("http://www.w3.org/2000/svg", 'image');
            imageNode.setAttribute('class', 'shape-element inner-shape');
            imageNode.setAttribute('href', event.target.result);
            imageNode.setAttribute('width', w); imageNode.setAttribute('height', h);
            imageNode.setAttribute('x', -w / 2); imageNode.setAttribute('y', -h / 2);
            imageNode.setAttribute('preserveAspectRatio', 'none'); 

            const layerObj = {
                id: id, name: window.getUniqueLayerName ? window.getUniqueLayerName('Image') : 'Image', type: 'image',
                tx: window.snap ? window.snap(256) : 256, ty: window.snap ? window.snap(256) : 256, 
                scaleX: 1, scaleY: 1, rotate: 0, skewX: 0, skewY: 0, opacity: 1,
                locked: false, hidden: false, collapsed: false,
                parentId: null, maskForId: null, boolMode: null,
                fill: null, blur: 0, filterId: null, color: null,
                svgContent: imageNode.outerHTML
            };
            
            window.LayerTree.push(layerObj); window.selectElement(id, false); if(window.saveState) window.saveState();
        }
        imgObj.src = event.target.result;
    };
    reader.readAsDataURL(file); e.target.value = ''; 
});

document.querySelectorAll('.bool-btn[data-bool]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.getAttribute('data-bool');
        
        // UNION, SUBTRACT, INTERSECT E EXCLUDE: Organização Não-Destrutiva nas Layers!
        if (window.selectedElementsIds.length === 0) return;

        if (window.selectedElementsIds.length > 1) {
            
            let sortedSelected = [...window.selectedElementsIds].sort((idA, idB) => {
                return window.LayerTree.findIndex(l => l.id === idA) - window.LayerTree.findIndex(l => l.id === idB);
            });

            const baseId = sortedSelected[0]; 

            for (let i = 1; i < sortedSelected.length; i++) {
                const childId = sortedSelected[i];
                const childIndex = window.LayerTree.findIndex(l => l.id === childId);
                if(childIndex === -1) continue;

                const childLayer = window.LayerTree[childIndex];
                childLayer.parentId = null;
                childLayer.maskForId = baseId;
                childLayer.boolMode = mode; // Pode ser union, subtract, intersect ou exclude

                window.LayerTree.splice(childIndex, 1);
                const newBaseIndex = window.LayerTree.findIndex(l => l.id === baseId);
                window.LayerTree.splice(newBaseIndex + 1, 0, childLayer);
            }
            
            window.Render();
            window.selectElement(baseId, false); 
            if(window.saveState) window.saveState();
            
        } else if (window.selectedElementsIds.length === 1) {
            const elId = window.selectedElementsIds[0];
            const layer = window.LayerTree.find(l => l.id === elId);
            
            if (layer && layer.maskForId) {
                layer.boolMode = mode;
                window.Render();
                if(window.saveState) window.saveState();
            } else { 
                alert("Selecione múltiplas camadas com Shift para Criar uma booleana. Ou selecione um Sub-Layer para alterar sua regra de corte."); 
            }
        }
    });
});