"use strict";
// layers.js - Motor de Interface (Especialista em UI HTML e Drag & Drop)

// --- A PONTE GERAL DO SISTEMA ---
window.Render = function() {
    if (window.Renderer) window.Renderer.renderCanvas(); // 1. Manda desenhar a imagem
    if (window.UILayers) window.UILayers.renderList();   // 2. Manda desenhar os botões HTML
};

window.UILayers = {
    renderList: function() {
        const layerListUI = document.getElementById('layers-list');
        layerListUI.style.paddingBottom = "100px"; 
        layerListUI.innerHTML = '';

        const rootItems = window.LayerTree.filter(l => !l.parentId && !l.maskForId);
        
        rootItems.slice().reverse().forEach(layer => {
            this.buildLayerItem(layer, layerListUI, 0);
        });
        
        this.bindEvents();
    },

    buildLayerItem: function(layer, container, depth) {
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
            children.slice().reverse().forEach(child => this.buildLayerItem(child, container, depth + 1));
        }
    },

    bindEvents: function() {
        const layersList = document.getElementById('layers-list');
        const layersPanel = document.getElementById('layers-panel');

        layersPanel.ondragover = (e) => { e.preventDefault(); };
        layersPanel.ondrop = (e) => {
            e.preventDefault();
            const draggedId = window.draggedLayerId;
            if (draggedId && (e.target.id === 'layers-list' || e.target.id === 'layers-panel')) {
                const draggedIndex = window.LayerTree.findIndex(l => l.id === draggedId);
                const draggedItem = window.LayerTree[draggedIndex];
                
                draggedItem.parentId = null; draggedItem.maskForId = null; draggedItem.boolMode = null;
                
                window.LayerTree.splice(draggedIndex, 1); 
                window.LayerTree.unshift(draggedItem); 
                window.Render(); if(window.saveState) window.saveState();
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

            item.querySelector('.layer-name').ondblclick = (e) => {
                e.stopPropagation();
                if (layerData.locked) return;
                const nameSpan = e.currentTarget; const currentName = layerData.name;
                if (nameSpan.querySelector('input')) return;
                
                const input = document.createElement('input');
                input.type = 'text'; input.className = 'layer-rename-input'; input.value = currentName;
                
                nameSpan.innerHTML = ''; nameSpan.appendChild(input); input.focus(); input.select();
                
                const finishRename = () => { layerData.name = input.value.trim() || 'Layer'; window.Render(); if (window.saveState) window.saveState(); };
                input.onblur = finishRename;
                input.onkeydown = (k) => { k.stopPropagation(); if (k.key === 'Enter') finishRename(); if (k.key === 'Escape') { layerData.name = currentName; window.Render(); } };
            };

            item.ondragstart = (e) => { if (layerData.locked) { e.preventDefault(); return; } window.draggedLayerId = id; item.style.opacity = '0.5'; };
            item.ondragend = () => { item.style.opacity = '1'; document.querySelectorAll('.layer-item').forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-center')); };

            item.ondragover = (e) => {
                e.preventDefault();
                const bounding = item.getBoundingClientRect(); const y = e.clientY - bounding.y; const h = bounding.height;
                item.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-center');
                if (y < h * 0.25) item.classList.add('drag-over-top'); else if (y > h * 0.75) item.classList.add('drag-over-bottom'); else item.classList.add('drag-over-center');
            };
            item.ondragleave = () => { item.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-center'); };

            item.ondrop = (e) => {
                e.preventDefault(); e.stopPropagation(); 
                let dropType = item.classList.contains('drag-over-top') ? 'top' : item.classList.contains('drag-over-bottom') ? 'bottom' : 'center';
                const draggedId = window.draggedLayerId;
                
                if (draggedId && draggedId !== id && !window.isDescendantOfData(id, draggedId)) {
                    const draggedIndex = window.LayerTree.findIndex(l => l.id === draggedId);
                    const draggedItem = window.LayerTree[draggedIndex];
                    
                    draggedItem.parentId = null; draggedItem.maskForId = null; draggedItem.boolMode = null;
                    
                    window.LayerTree.splice(draggedIndex, 1);
                    let targetIndex = window.LayerTree.findIndex(l => l.id === id);

                    if (dropType === 'center') {
                        if (layerData.type === 'group') draggedItem.parentId = id;
                        else { draggedItem.maskForId = id; draggedItem.boolMode = null; } // O ARRASTE GERA UMA MÁSCARA LIMPA (Sem Booleana!)
                        window.LayerTree.push(draggedItem);
                    } else {
                        if (layerData.parentId) draggedItem.parentId = layerData.parentId;
                        else if (layerData.maskForId) { draggedItem.maskForId = layerData.maskForId; draggedItem.boolMode = layerData.boolMode; }

                        if (dropType === 'top') window.LayerTree.splice(targetIndex + 1, 0, draggedItem);
                        else window.LayerTree.splice(targetIndex, 0, draggedItem);
                    }
                    window.Render(); if(window.saveState) window.saveState();
                }
            };
        });
    }
};

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