"use strict";
// shortcuts.js - Nudge (Setas), Clone Perfeito e Escala Blindada

document.addEventListener('wheel', (e) => {
    if (window.selectedElementsIds.length === 0) return;
    if (!e.ctrlKey && !e.altKey && !e.shiftKey) return; 
    e.preventDefault();

    let mode = null; let delta = 0;
    if (e.ctrlKey) { mode = 'scale'; delta = e.deltaY < 0 ? 0.1 : -0.1; } 
    else if (e.altKey) { mode = 'rotate'; delta = e.deltaY < 0 ? 5 : -5; } 
    else if (e.shiftKey) { mode = 'opacity'; delta = e.deltaY < 0 ? 0.1 : -0.1; }

    if (!mode) return;

    const topLevelIds = window.getTopLevelSelectedIds ? window.getTopLevelSelectedIds() : window.selectedElementsIds;

    topLevelIds.forEach(id => {
        const rootLayer = window.LayerTree.find(l => l.id === id);
        if (!rootLayer || rootLayer.locked) return;

        const descendants = window.LayerTree.filter(l => window.isDescendantOfData && window.isDescendantOfData(l.id, rootLayer.id));

        if (mode === 'opacity') {
            rootLayer.opacity = Math.min(1, Math.max(0, rootLayer.opacity + delta));
            window.Render(); 
            return; 
        }

        let pX, pY;
        if (window.pivotCache[rootLayer.id]) {
            pX = window.pivotCache[rootLayer.id].x; pY = window.pivotCache[rootLayer.id].y;
        } else {
            if (descendants.length > 0) {
                const renderGroup = document.getElementById('render-group-' + rootLayer.id);
                if (renderGroup && (mode === 'scale' || mode === 'rotate')) {
                    try { const bbox = renderGroup.getBBox(); pX = bbox.x + bbox.width / 2; pY = bbox.y + bbox.height / 2;
                    } catch(err) { pX = rootLayer.tx; pY = rootLayer.ty; }
                } else { pX = rootLayer.tx; pY = rootLayer.ty; }
            } else { pX = rootLayer.tx; pY = rootLayer.ty; }
            window.pivotCache[rootLayer.id] = { x: pX, y: pY };
        }

        const apply = (layer) => {
            if (!layer) return;
            if (mode === 'scale') {
                const mainScale = Math.max(layer.scaleX, layer.scaleY); 
                const newScale = Math.max(0.1, mainScale + delta);
                const factor = newScale / mainScale;
                const dx = layer.tx - pX; const dy = layer.ty - pY;
                layer.tx = pX + (dx * factor); layer.ty = pY + (dy * factor);
                layer.scaleX *= factor; layer.scaleY *= factor;
            } else if (mode === 'rotate') {
                const dx = layer.tx - pX; const dy = layer.ty - pY;
                const rad = delta * Math.PI / 180;
                const cos = Math.cos(rad); const sin = Math.sin(rad);
                layer.tx = pX + (dx * cos - dy * sin); layer.ty = pY + (dx * sin + dy * cos);
                layer.rotate += delta;
            }
        };
        apply(rootLayer); descendants.forEach(child => apply(child));
    });
    
    window.Render(); if(window.updatePropsPanel) window.updatePropsPanel();
    clearTimeout(window.wheelTimeout);
    window.wheelTimeout = setTimeout(() => { if (window.saveState) window.saveState(); window.pivotCache = {}; }, 500);
}, { passive: false });

window.duplicateSelection = function() {
    if (window.selectedElementsIds.length === 0) return;
    const originalIds = window.getTopLevelSelectedIds ? window.getTopLevelSelectedIds() : window.selectedElementsIds;
    const newSelection = []; const offset = 16;

    const cloneHierarchy = (layer, parentId = null, maskForId = null, boolMode = null) => {
        const newId = `id-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const clone = JSON.parse(JSON.stringify(layer));
        clone.id = newId; clone.name = window.getUniqueLayerName ? window.getUniqueLayerName(layer.name) : (layer.name + ' Clone');

        clone.tx += offset; clone.ty += offset;

        if (parentId) clone.parentId = parentId;
        if (maskForId) { clone.maskForId = maskForId; clone.boolMode = boolMode; }

        if (clone.patternImg && window.updateLayerFill) {
            window.updateLayerFill(clone); 
        }

        if (clone.blur > 0 || (clone.type === 'image' && clone.color)) {
            clone.filterId = window.applyFilters(newId, clone.type === 'image' ? clone.color : null, clone.blur);
            if(window.updateSVGContentAttr) window.updateSVGContentAttr(clone, 'filter', `url(#${clone.filterId})`);
        }

        const targetIndex = window.LayerTree.findIndex(l => l.id === layer.id);
        window.LayerTree.splice(targetIndex + 1, 0, clone);

        const children = window.LayerTree.filter(l => l.parentId === layer.id);
        const masks = window.LayerTree.filter(l => l.maskForId === layer.id);

        children.forEach(c => cloneHierarchy(c, newId, null, null));
        masks.forEach(m => cloneHierarchy(m, null, newId, m.boolMode));
        return clone.id;
    };

    originalIds.forEach(id => { const layer = window.LayerTree.find(l => l.id === id); if (layer && !layer.locked) newSelection.push(cloneHierarchy(layer)); });
    window.Render(); window.selectElement(null, false); newSelection.forEach(id => window.selectElement(id, true));
};

let nudgeTimeout;
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault(); if (window.selectedElementsIds.length === 0) return;

        const step = e.ctrlKey ? 10 : 1; let dx = 0, dy = 0;
        if (e.key === 'ArrowUp') dy = -step; if (e.key === 'ArrowDown') dy = step;
        if (e.key === 'ArrowLeft') dx = -step; if (e.key === 'ArrowRight') dx = step;

        let allIdsToMove = new Set();
        const topLevelIds = window.getTopLevelSelectedIds ? window.getTopLevelSelectedIds() : window.selectedElementsIds;
        topLevelIds.forEach(id => {
            const layer = window.LayerTree.find(l => l.id === id);
            if (layer && !layer.locked) {
                allIdsToMove.add(id);
                if(window.getAllLogicalDescendants) window.getAllLogicalDescendants(id).forEach(descId => allIdsToMove.add(descId));
            }
        });

        allIdsToMove.forEach(id => { const layer = window.LayerTree.find(l => l.id === id); if (layer) { layer.tx += dx; layer.ty += dy; } });
        window.Render(); if(window.updatePropsPanel) window.updatePropsPanel();
        clearTimeout(nudgeTimeout); nudgeTimeout = setTimeout(() => { if (window.saveState) window.saveState(); }, 400);
        return;
    }

    if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); if(window.undo) window.undo(); return; }
    if (e.ctrlKey && e.key.toLowerCase() === 'g') {
        e.preventDefault(); let tx = 256, ty = 256;
        if (window.selectedElementsIds.length > 0) { const firstLayer = window.LayerTree.find(l => l.id === window.selectedElementsIds[0]); if (firstLayer) { tx = firstLayer.tx; ty = firstLayer.ty; } }
        if (window.createGroup) {
            const gLayer = window.createGroup(window.snap(tx), window.snap(ty));
            window.LayerTree.push(gLayer);
            const topLevelIds = window.getTopLevelSelectedIds ? window.getTopLevelSelectedIds() : window.selectedElementsIds;
            topLevelIds.forEach(id => { const childLayer = window.LayerTree.find(l => l.id === id); if (childLayer && id !== gLayer.id) { childLayer.maskForId = null; childLayer.boolMode = null; childLayer.parentId = gLayer.id; } });
            window.Render(); window.selectElement(gLayer.id, false); window.saveState();
        }
    }
    
    if (e.key === 'Delete' && window.selectedElementsIds.length > 0) {
        const toDelete = [...window.selectedElementsIds];
        toDelete.forEach(id => { const layer = window.LayerTree.find(l => l.id === id); if(layer && !layer.locked && window.deleteRecursive) window.deleteRecursive(id); });
        window.Render(); window.saveState();
    }
    
    if (e.key === 'Escape') { if(window.selectElement) window.selectElement(null, false); }
    if (e.ctrlKey && e.key.toLowerCase() === 'd') { e.preventDefault(); if(window.duplicateSelection) window.duplicateSelection(); if(window.saveState) window.saveState(); }
});