"use strict";
// layers.js - Renderizador com Ícones Customizados e Duplo Clique para Renomear

window.Render = function() {
    const layerListUI = document.getElementById('layers-list');
    const canvasObjects = document.getElementById('layer-objects');
    
    layerListUI.style.paddingBottom = "100px"; 
    layerListUI.innerHTML = '';
    canvasObjects.innerHTML = '';

    const rootItems = window.LayerTree.filter(l => !l.parentId && !l.maskForId);
    
    rootItems.slice().reverse().forEach(layer => {
        renderLayerUI(layer, layerListUI, 0);
    });

    rootItems.forEach(layer => {
        canvasObjects.appendChild(buildCompleteNode(layer)); 
    });
    
    bindAllLayerEvents();
};

function renderLayerUI(layer, container, depth) {
    const item = document.createElement('div');
    item.className = 'layer-item';
    item.dataset.id = layer.id;
    if (window.selectedElementsIds.includes(layer.id)) item.classList.add('active');
    if (layer.locked) item.classList.add('locked');
    if (layer.hidden) item.classList.add('layer-hidden');
    
    item.style.paddingLeft = `${16 + (depth * 15)}px`;
    item.draggable = true;

    const children = window.LayerTree.filter(l => l.parentId === layer.id || l.maskForId === layer.id);
    const hasChildren = children.length > 0;
    
    const expanderClass = hasChildren ? (layer.collapsed ? '' : 'expanded') : 'empty';
    const arrowDisplay = hasChildren ? 'block' : 'none';
    const visIcon = layer.hidden ? 'hide.svg' : 'view.svg';
    const lockOp = layer.locked ? '1' : '0.3';

    let iconHtml = '';
    if (layer.type === 'group') iconHtml = `<img src="assets/img/group.svg" class="layer-type-icon">`;
    else if (layer.type === 'image') iconHtml = `<img src="assets/img/image.svg" class="layer-type-icon">`;
    else if (layer.type === 'text') iconHtml = `<img src="assets/img/text.svg" class="layer-type-icon">`;
    else if (layer.type === 'shape') {
        iconHtml = `<svg class="layer-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect></svg>`;
    }

    item.innerHTML = `
        <span class="layer-expander ${expanderClass}"><img src="assets/img/arrow.svg" style="display:${arrowDisplay};"></span>
        ${iconHtml}
        <span class="layer-name" title="Double click to rename">${layer.name}</span>
        <div class="layer-actions">
            <span class="layer-btn btn-vis"><img src="assets/img/${visIcon}" title="Toggle Visibility"></span>
            <span class="layer-btn btn-lock"><img src="assets/img/lock.svg" style="opacity:${lockOp};" title="Lock/Unlock"></span>
        </div>
    `;

    container.appendChild(item);

    if (hasChildren && !layer.collapsed) {
        children.slice().reverse().forEach(child => renderLayerUI(child, container, depth + 1));
    }
}

// MÁSCARAS EM CASCATA
function buildCompleteNode(layer) {
    const renderGroup = document.createElementNS("http://www.w3.org/2000/svg", 'g');
    renderGroup.id = 'render-group-' + layer.id;
    renderGroup.style.opacity = layer.opacity;

    if (layer.hidden) {
        renderGroup.style.display = 'none';
        return renderGroup;
    }

    const children = window.LayerTree.filter(l => l.parentId === layer.id);
    const masks = window.LayerTree.filter(l => l.maskForId === layer.id);

    let baseElement = buildSVGNode(layer);
    
    let currentComposite = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    currentComposite.setAttribute('class', 'boolean-composite');
    currentComposite.appendChild(baseElement);

    if (masks.length > 0) {
        let defs = document.getElementById('canvas-defs');

        masks.forEach(maskData => {
            if (maskData.hidden) return;

            let maskLayerNode = buildCompleteNode(maskData); 

            if (maskData.boolMode === 'union') {
                currentComposite.appendChild(maskLayerNode);
                
            } else if (maskData.boolMode === 'subtract' || maskData.boolMode === 'intersect') {
                
                let maskId = 'mask-bool-' + layer.id + '-' + maskData.id;
                let oldMask = document.getElementById(maskId);
                if (oldMask) oldMask.remove();

                let mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
                mask.id = maskId;
                mask.setAttribute('maskUnits', 'userSpaceOnUse');

                let bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                bgRect.setAttribute('x', '-5000');
                bgRect.setAttribute('y', '-5000');
                bgRect.setAttribute('width', '10000');
                bgRect.setAttribute('height', '10000');
                
                bgRect.setAttribute('fill', maskData.boolMode === 'subtract' ? '#ffffff' : '#000000');
                mask.appendChild(bgRect);

                let fillColor = maskData.boolMode === 'subtract' ? '#000000' : '#ffffff';

                maskLayerNode.querySelectorAll('.inner-shape, .inner-shape *').forEach(s => {
                    s.setAttribute('fill', fillColor);
                    s.style.fill = fillColor;
                    s.setAttribute('stroke', 'none');
                    s.removeAttribute('filter');
                    
                    if (s.tagName === 'image') {
                        s.style.filter = maskData.boolMode === 'subtract' ? 'brightness(0)' : 'brightness(0) invert(1)';
                    } else {
                        s.style.filter = 'none';
                    }
                });

                mask.appendChild(maskLayerNode);
                defs.appendChild(mask);

                let wrap = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                wrap.setAttribute('mask', `url(#${maskId})`);
                wrap.appendChild(currentComposite);
                
                currentComposite = wrap;
            }
        });
    }

    renderGroup.appendChild(currentComposite);

    children.forEach(childLayer => {
        renderGroup.appendChild(buildCompleteNode(childLayer));
    });

    return renderGroup;
}

function buildSVGNode(layer) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", 'g');
    g.id = layer.id;
    g.setAttribute('class', 'draggable');
    if (window.selectedElementsIds.includes(layer.id)) g.classList.add('selected');
    
    g.setAttribute('transform', `translate(${layer.tx}, ${layer.ty}) rotate(${layer.rotate}) scale(${layer.scaleX}, ${layer.scaleY}) skewX(${layer.skewX}) skewY(${layer.skewY})`);

    if (layer.svgContent) {
        g.innerHTML = layer.svgContent;
        const inner = g.querySelector('.inner-shape');
        if (inner && layer.filterId) {
             inner.setAttribute('filter', `url(#${layer.filterId})`);
        }
    }
    return g;
}

function bindAllLayerEvents() {
    const layersList = document.getElementById('layers-list');

    layersList.ondragover = (e) => { e.preventDefault(); };
    layersList.ondrop = (e) => {
        e.preventDefault();
        const draggedId = window.draggedLayerId;
        if (draggedId && (e.target === layersList || e.target.id === 'layers-panel')) {
            const draggedIndex = window.LayerTree.findIndex(l => l.id === draggedId);
            const draggedItem = window.LayerTree[draggedIndex];
            
            draggedItem.parentId = null;
            draggedItem.maskForId = null;
            draggedItem.boolMode = null;
            
            window.LayerTree.splice(draggedIndex, 1);
            window.LayerTree.push(draggedItem); 
            
            window.Render();
            if(window.saveState) window.saveState();
        }
    };

    document.querySelectorAll('.layer-item').forEach(item => {
        const id = item.dataset.id;
        const layerData = window.LayerTree.find(l => l.id === id);
        if (!layerData) return;

        item.querySelector('.layer-expander').onclick = (e) => { e.stopPropagation(); layerData.collapsed = !layerData.collapsed; window.Render(); };
        item.querySelector('.btn-vis').onclick = (e) => { e.stopPropagation(); layerData.hidden = !layerData.hidden; window.Render(); };
        item.querySelector('.btn-lock').onclick = (e) => { e.stopPropagation(); layerData.locked = !layerData.locked; window.Render(); };
        item.onclick = (e) => { e.stopPropagation(); if (layerData.locked) return; if(window.selectElement) window.selectElement(id, e.shiftKey); };

        // SISTEMA DE DUPLO CLIQUE PARA RENOMEAR (A SALVAÇÃO DOS EMOJIS ANTIGOS)
        item.querySelector('.layer-name').ondblclick = (e) => {
            e.stopPropagation();
            if (layerData.locked) return;
            
            const nameSpan = e.currentTarget;
            const currentName = layerData.name;
            
            // Evita criar múltiplos inputs se der clique frenético
            if (nameSpan.querySelector('input')) return;
            
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'layer-rename-input';
            input.value = currentName;
            
            nameSpan.innerHTML = '';
            nameSpan.appendChild(input);
            input.focus();
            input.select();
            
            const finishRename = () => {
                layerData.name = input.value.trim() || 'Layer';
                window.Render();
                if (window.saveState) window.saveState();
            };
            
            input.onblur = finishRename;
            input.onkeydown = (k) => {
                k.stopPropagation(); // Impede que o Delete ou Backspace apague a camada sem querer!
                if (k.key === 'Enter') finishRename();
                if (k.key === 'Escape') { layerData.name = currentName; window.Render(); }
            };
        };

        item.ondragstart = (e) => {
            if (layerData.locked) { e.preventDefault(); return; }
            window.draggedLayerId = id; item.style.opacity = '0.5';
        };

        item.ondragend = () => {
            item.style.opacity = '1';
            document.querySelectorAll('.layer-item').forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-center'));
        };

        item.ondragover = (e) => {
            e.preventDefault();
            const bounding = item.getBoundingClientRect(); const y = e.clientY - bounding.y; const h = bounding.height;
            item.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-center');
            if (y < h * 0.25) item.classList.add('drag-over-top');
            else if (y > h * 0.75) item.classList.add('drag-over-bottom');
            else item.classList.add('drag-over-center');
        };

        item.ondragleave = () => { item.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-center'); };

        item.ondrop = (e) => {
            e.preventDefault();
            e.stopPropagation(); 
            
            let dropType = item.classList.contains('drag-over-top') ? 'top' : item.classList.contains('drag-over-bottom') ? 'bottom' : 'center';
            const draggedId = window.draggedLayerId;
            
            if (draggedId && draggedId !== id && !window.isDescendantOfData(draggedId, id)) {
                const draggedIndex = window.LayerTree.findIndex(l => l.id === draggedId);
                const draggedItem = window.LayerTree[draggedIndex];
                
                draggedItem.parentId = null; draggedItem.maskForId = null; draggedItem.boolMode = null;

                window.LayerTree.splice(draggedIndex, 1);
                let targetIndex = window.LayerTree.findIndex(l => l.id === id);

                if (dropType === 'center') {
                    if (layerData.type === 'group') draggedItem.parentId = id;
                    else { draggedItem.maskForId = id; draggedItem.boolMode = 'intersect'; }
                    window.LayerTree.push(draggedItem);
                } else {
                    if (layerData.parentId) draggedItem.parentId = layerData.parentId;
                    else if (layerData.maskForId) { draggedItem.maskForId = layerData.maskForId; draggedItem.boolMode = layerData.boolMode; }

                    if (dropType === 'top') window.LayerTree.splice(targetIndex + 1, 0, draggedItem);
                    else window.LayerTree.splice(targetIndex, 0, draggedItem);
                }

                window.Render();
                if(window.saveState) window.saveState();
            }
        };
    });
}

window.isDescendantOfData = function(childId, parentId) {
    const child = window.LayerTree.find(l => l.id === childId);
    if (!child) return false;
    const parentRef = child.parentId || child.maskForId;
    if (!parentRef) return false;
    if (parentRef === parentId) return true;
    return window.isDescendantOfData(parentRef, parentId);
}

window.deleteRecursive = function(id) {
    const index = window.LayerTree.findIndex(l => l.id === id);
    if (index > -1) {
        window.LayerTree.splice(index, 1);
        window.selectedElementsIds = window.selectedElementsIds.filter(sel => sel !== id);
        const children = window.LayerTree.filter(l => l.parentId === id || l.maskForId === id);
        children.forEach(child => window.deleteRecursive(child.id));
    }
};