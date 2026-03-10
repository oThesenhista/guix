document.addEventListener('wheel', (e) => {
    if (e.ctrlKey) e.preventDefault();
    if (window.selectedElements.length === 0) return;
    if (e.ctrlKey || e.altKey || e.shiftKey) e.preventDefault();

    let mode = null;
    let delta = 0;

    if (e.ctrlKey) { mode = 'scale'; delta = e.deltaY < 0 ? 0.1 : -0.1; } 
    else if (e.altKey) { mode = 'rotate'; delta = e.deltaY < 0 ? 15 : -15; } 
    else if (e.shiftKey) { mode = 'opacity'; delta = e.deltaY < 0 ? 0.1 : -0.1; }
    else return;

    window.selectedElements.forEach(root => {
        if(root.dataset.locked === 'true') return;

        const pX = parseFloat(root.dataset.tx), pY = parseFloat(root.dataset.ty);

        const apply = (el) => {
            if (mode === 'scale') {
                const oldSx = parseFloat(el.dataset.scaleX || 1);
                const oldSy = parseFloat(el.dataset.scaleY || 1);
                
                const mainScale = Math.max(oldSx, oldSy);
                const newScale = Math.max(0.1, mainScale + delta);
                const factor = newScale / mainScale;

                if (el !== root) {
                    const dx = parseFloat(el.dataset.tx) - pX, dy = parseFloat(el.dataset.ty) - pY;
                    el.dataset.tx = pX + (dx * factor); el.dataset.ty = pY + (dy * factor);
                } 
                el.dataset.scaleX = oldSx * factor;
                el.dataset.scaleY = oldSy * factor;
                
            } else if (mode === 'rotate') {
                if (el !== root) {
                    const dx = parseFloat(el.dataset.tx) - pX, dy = parseFloat(el.dataset.ty) - pY;
                    const rad = delta * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
                    el.dataset.tx = pX + (dx * cos - dy * sin); el.dataset.ty = pY + (dx * sin + dy * cos);
                }
                el.dataset.rotate = parseFloat(el.dataset.rotate) + delta;
            } else if (mode === 'opacity') {
                el.style.opacity = Math.min(1, Math.max(0, parseFloat(el.style.opacity || 1) + delta));
            }
            window.updateTransform(el);
            window.getAllLogicalDescendants(el.id).forEach(id => apply(document.getElementById(id)));
        };

        apply(root);
    });
    if(window.updatePropsPanel) window.updatePropsPanel();
}, { passive: false });

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        let tx = 256, ty = 256;
        
        if (window.selectedElements.length > 0) {
            tx = parseFloat(window.selectedElements[0].dataset.tx);
            ty = parseFloat(window.selectedElements[0].dataset.ty);
        }
        
        const g = window.createGroup(window.snap(tx), window.snap(ty));
        document.getElementById('layer-objects').appendChild(g);
        
        let lastInserted = document.querySelector(`.layer-item[data-id="${g.id}"]`);
        
        window.selectedElements.forEach(el => {
            const ui = document.querySelector(`.layer-item[data-id="${el.id}"]`);
            if (ui && lastInserted && el.id !== g.id) {
                window.removeMaskIfAny(ui);
                delete ui.dataset.parent;
                ui.dataset.parent = g.id;
                // CORREÇÃO: Respeita a ordem dos múltiplos itens agrupados
                lastInserted.parentNode.insertBefore(ui, lastInserted.nextSibling);
                lastInserted = ui; 
            }
        });
        
        window.reorderSVGElements();
        window.updateHierarchyVisibility();
        window.selectElement(g, false);
    }
    
    if (e.key === 'Delete' && window.selectedElements.length > 0) {
        const toDelete = [...window.selectedElements];
        toDelete.forEach(el => {
            if(el.dataset.locked !== 'true') window.deleteRecursive(el.id);
        });
    }
    
    if (e.key === 'Escape') {
        window.selectElement(null, false);
    }

    if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (window.selectedElements.length === 0) return;

        const originalRoots = [...window.selectedElements];
        const newSelection = [];
        const offset = 16;

        const cloneHierarchy = (el, parentId = null) => {
            const clone = el.cloneNode(true);
            const newId = `shape-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            clone.id = newId;

            if (!parentId) {
                clone.dataset.tx = parseFloat(el.dataset.tx) + offset;
                clone.dataset.ty = parseFloat(el.dataset.ty) + offset;
            }

            document.getElementById('layer-objects').appendChild(clone);
            window.updateTransform(clone);

            const originalLayer = document.querySelector(`.layer-item[data-id="${el.id}"]`);
            const name = originalLayer.querySelector('.layer-name').textContent;
            window.addLayerToUI(newId, name);

            const newLayer = document.querySelector(`.layer-item[data-id="${newId}"]`);
            if (parentId) newLayer.dataset.parent = parentId;

            document.querySelectorAll(`.layer-item[data-parent="${el.id}"]`).forEach(childItem => {
                const childEl = document.getElementById(childItem.dataset.id);
                cloneHierarchy(childEl, newId);
            });

            return clone;
        };

        originalRoots.forEach(root => {
            if(root.dataset.locked !== 'true') {
                const newRoot = cloneHierarchy(root);
                newSelection.push(newRoot);
            }
        });

        window.reorderSVGElements();
        window.updateHierarchyVisibility();
        
        window.selectElement(null, false);
        newSelection.forEach(el => window.selectElement(el, true));
    }
});