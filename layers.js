const layersList = document.getElementById('layers-list');

window.updateTransform = function(g) {
    let sx = g.dataset.scaleX || 1;
    let sy = g.dataset.scaleY || 1;
    
    g.setAttribute('transform', `translate(${g.dataset.tx}, ${g.dataset.ty}) rotate(${g.dataset.rotate}) scale(${sx}, ${sy})`);
    
    const clipClone = document.getElementById('mask-clone-clip-' + g.id);
    if (clipClone) clipClone.setAttribute('transform', g.getAttribute('transform'));
    
    const cutClone = document.getElementById('mask-clone-cut-' + g.id);
    if (cutClone) cutClone.setAttribute('transform', g.getAttribute('transform'));
};

window.addLayerToUI = function(id, name) {
    const item = document.createElement('div');
    item.className = 'layer-item';
    item.dataset.id = id;
    item.dataset.type = name;
    item.dataset.locked = 'false';
    item.draggable = true;
    
    const expander = document.createElement('span');
    expander.className = 'layer-expander empty';
    expander.innerHTML = '<img src="img/arrow.svg" style="display:none;">';
    expander.onclick = (e) => {
        e.stopPropagation();
        item.dataset.collapsed = item.dataset.collapsed === 'true' ? 'false' : 'true';
        window.updateHierarchyVisibility();
    };

    const nameSpan = document.createElement('span');
    nameSpan.className = 'layer-name';
    nameSpan.textContent = name;
    
    const actions = document.createElement('div');
    actions.className = 'layer-actions';
    
    const btnVis = document.createElement('span');
    btnVis.className = 'layer-btn';
    btnVis.innerHTML = '<img src="img/view.svg" title="Toggle Visibility">';
    btnVis.onclick = (e) => {
        e.stopPropagation();
        const el = document.getElementById(id);
        if(el) {
            const isHidden = el.style.display === 'none';
            el.style.display = isHidden ? '' : 'none';
            btnVis.innerHTML = isHidden ? '<img src="img/view.svg">' : '<img src="img/hide.svg">';
            item.classList.toggle('layer-hidden', !isHidden);
        }
    };
    
    const btnLock = document.createElement('span');
    btnLock.className = 'layer-btn';
    btnLock.innerHTML = '<img src="img/lock.svg" style="opacity:0.3;" title="Lock/Unlock">';
    btnLock.onclick = (e) => {
        e.stopPropagation();
        const isLocked = item.dataset.locked === 'true';
        item.dataset.locked = isLocked ? 'false' : 'true';
        item.classList.toggle('locked', !isLocked);
        btnLock.innerHTML = !isLocked ? '<img src="img/lock.svg" style="opacity:1;">' : '<img src="img/lock.svg" style="opacity:0.3;">';
        
        const el = document.getElementById(id);
        if (el) el.dataset.locked = item.dataset.locked;

        if (!isLocked && window.selectedElements && window.selectedElements.some(sel => sel.id === id)) {
            window.selectElement(el, true); 
        }
    };

    actions.append(btnVis, btnLock);
    item.append(expander, nameSpan, actions);
    
    item.onclick = (e) => {
        if (item.dataset.locked === 'true') return; 
        window.selectElement(document.getElementById(id), e.shiftKey);
    };
    
    item.addEventListener('dragstart', function(e) {
        if (item.dataset.locked === 'true') { e.preventDefault(); return; }
        window.draggedLayer = item; 
        item.style.opacity = '0.5';
    });

    item.addEventListener('dragend', function() {
        item.style.opacity = '1';
        document.querySelectorAll('.layer-item').forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-center'));
    });

    item.addEventListener('dragover', function(e) {
        e.preventDefault();
        const bounding = this.getBoundingClientRect();
        const y = e.clientY - bounding.y;
        const h = bounding.height;
        this.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-center');
        
        if (y < h * 0.25) this.classList.add('drag-over-top');
        else if (y > h * 0.75) this.classList.add('drag-over-bottom');
        else this.classList.add('drag-over-center');
    });

    item.addEventListener('dragleave', function() {
        this.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-center');
    });

    item.addEventListener('drop', function(e) {
        e.preventDefault();
        const dropType = this.classList.contains('drag-over-top') ? 'top' :
                         this.classList.contains('drag-over-bottom') ? 'bottom' : 'center';
        
        this.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-center');
        const dragged = window.draggedLayer;
        
        if (dragged && dragged !== this && !window.isDescendantOf(this.dataset.id, dragged.dataset.id)) {
            const family = window.getFamilyDOM(dragged.dataset.id);
            window.removeMaskIfAny(dragged);
            delete dragged.dataset.parent;
            
            if (dropType === 'center') {
                if (this.dataset.type.includes('Group')) {
                    dragged.dataset.parent = this.dataset.id;
                } else {
                    dragged.dataset.maskFor = this.dataset.id;
                    window.refreshMasks(this.dataset.id); 
                }
                // CORREÇÃO CRÍTICA: Obriga a UI a descer o filho para debaixo do pai
                this.parentNode.insertBefore(dragged, this.nextSibling);
            } else { 
                if (this.dataset.parent) {
                    dragged.dataset.parent = this.dataset.parent;
                } else if (this.dataset.maskFor) {
                    dragged.dataset.maskFor = this.dataset.maskFor;
                    window.refreshMasks(this.dataset.maskFor);
                }
                
                if (dropType === 'top') {
                    this.parentNode.insertBefore(dragged, this);
                } else {
                    const thisFamily = window.getFamilyDOM(this.dataset.id);
                    const lastMember = thisFamily.length > 0 ? thisFamily[thisFamily.length - 1] : this;
                    this.parentNode.insertBefore(dragged, lastMember.nextSibling);
                }
            }
            
            // Move os filhos anexados ao objeto (se ele tiver) sem embaralhar a ordem deles
            let lastInserted = dragged;
            family.forEach(famItem => {
                if (famItem !== dragged) {
                    dragged.parentNode.insertBefore(famItem, lastInserted.nextSibling);
                    lastInserted = famItem;
                }
            });

            window.reorderSVGElements();
            window.updateHierarchyVisibility();
        }
    });

    layersList.prepend(item);
    window.updateHierarchyVisibility();
}

window.deleteRecursive = function(id) {
    const ui = document.querySelector(`.layer-item[data-id="${id}"]`);
    const baseId = ui ? ui.dataset.maskFor : null;
    
    window.getAllLogicalDescendants(id).forEach(childId => window.deleteRecursive(childId));
    
    const el = document.getElementById(id);
    if (el) {
        if (el.parentNode.classList.contains('mask-wrapper') || el.parentNode.classList.contains('base-cut-wrapper')) {
            el.parentNode.remove();
        } else {
            el.remove();
        }
    }
    if (ui) ui.remove();
    
    if (window.selectedElements) {
        window.selectedElements = window.selectedElements.filter(sel => sel.id !== id);
    }
    
    if (baseId) window.refreshMasks(baseId);
    window.updateHierarchyVisibility();
    if(window.updatePropsPanel) window.updatePropsPanel();
};

window.updateHierarchyVisibility = function() {
    const items = [...document.querySelectorAll('.layer-item')];
    items.forEach(item => {
        let depth = 0, current = item.dataset.parent || item.dataset.maskFor;
        let hidden = false;
        while(current) {
            depth++;
            const p = document.querySelector(`.layer-item[data-id="${current}"]`);
            if (p?.dataset.collapsed === 'true') hidden = true;
            current = p?.dataset.parent || p?.dataset.maskFor;
        }
        item.style.paddingLeft = `${16 + (depth * 15)}px`;
        item.classList.toggle('layer-child-hidden', hidden);
        
        const has = items.some(c => c.dataset.parent === item.dataset.id || c.dataset.maskFor === item.dataset.id);
        const ex = item.querySelector('.layer-expander');
        const img = ex.querySelector('img');
        
        if (has) {
            ex.classList.remove('empty');
            if(img) img.style.display = 'block';
            if (item.dataset.collapsed === 'true') {
                ex.classList.remove('expanded');
            } else {
                ex.classList.add('expanded');
            }
        } else {
            ex.classList.add('empty');
            if(img) img.style.display = 'none';
        }
    });
}

window.refreshMasks = function(baseId) {
    const baseEl = document.getElementById(baseId);
    if (!baseEl) return;
    
    const childrenUis = document.querySelectorAll(`.layer-item[data-mask-for="${baseId}"]`);
    
    let clipMaskId = 'mask-clip-' + baseId;
    let clipMask = document.getElementById(clipMaskId);
    if (!clipMask) {
        clipMask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
        clipMask.id = clipMaskId;
        clipMask.setAttribute('maskUnits', 'userSpaceOnUse');
        document.getElementById('canvas-defs').appendChild(clipMask);
    }
    clipMask.innerHTML = ''; 
    const baseCloneForClip = baseEl.cloneNode(true);
    baseCloneForClip.id = 'mask-clone-clip-' + baseId;
    baseCloneForClip.querySelectorAll('.inner-shape, .inner-shape *').forEach(s => {
        s.setAttribute('fill', '#ffffff'); s.style.fill = '#ffffff'; s.setAttribute('stroke', 'none');
    });
    clipMask.appendChild(baseCloneForClip);
    
    let cutMaskId = 'mask-cut-' + baseId;
    let cutMask = document.getElementById(cutMaskId);
    if (!cutMask) {
        cutMask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
        cutMask.id = cutMaskId;
        cutMask.setAttribute('maskUnits', 'userSpaceOnUse');
        document.getElementById('canvas-defs').appendChild(cutMask);
    }
    cutMask.innerHTML = '';
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('x', '-5000'); bgRect.setAttribute('y', '-5000');
    bgRect.setAttribute('width', '10000'); bgRect.setAttribute('height', '10000');
    bgRect.setAttribute('fill', '#ffffff'); 
    cutMask.appendChild(bgRect);
    
    let hasSubtract = false;
    
    childrenUis.forEach(layerUi => {
        const childId = layerUi.dataset.id;
        const childEl = document.getElementById(childId);
        const mode = layerUi.dataset.booleanMode || 'union';
        
        if (!childEl) return;
        
        if (childEl.parentNode.classList.contains('mask-wrapper')) {
            const wrap = childEl.parentNode;
            wrap.parentNode.insertBefore(childEl, wrap);
            wrap.remove();
        }
        
        childEl.style.display = ''; 
        
        if (mode === 'subtract') {
            childEl.style.display = 'none';
            const cutClone = childEl.cloneNode(true);
            cutClone.id = 'mask-clone-cut-' + childId;
            cutClone.style.display = ''; 
            cutClone.querySelectorAll('.inner-shape, .inner-shape *').forEach(s => {
                s.setAttribute('fill', '#000000'); s.style.fill = '#000000'; s.setAttribute('stroke', 'none');
            });
            cutMask.appendChild(cutClone);
            hasSubtract = true;
        } else {
            const wrap = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            wrap.setAttribute('class', 'mask-wrapper');
            childEl.parentNode.insertBefore(wrap, childEl);
            wrap.appendChild(childEl);
            wrap.setAttribute('mask', `url(#${clipMaskId})`);
        }
    });
    
    if (hasSubtract) {
        let wrap = baseEl.parentNode;
        if (!wrap.classList.contains('base-cut-wrapper')) {
            wrap = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            wrap.setAttribute('class', 'base-cut-wrapper');
            baseEl.parentNode.insertBefore(wrap, baseEl);
            wrap.appendChild(baseEl);
        }
        wrap.setAttribute('mask', `url(#${cutMaskId})`);
    } else {
        if (baseEl.parentNode.classList.contains('base-cut-wrapper')) {
            const wrap = baseEl.parentNode;
            wrap.removeAttribute('mask');
            wrap.parentNode.insertBefore(baseEl, wrap);
            wrap.remove();
        }
    }
};

window.removeMaskIfAny = function(ui) {
    const el = document.getElementById(ui.dataset.id);
    const baseId = ui.dataset.maskFor;
    
    if (el?.parentNode.classList.contains('mask-wrapper')) {
        const wrap = el.parentNode;
        wrap.parentNode.insertBefore(el, wrap);
        wrap.remove();
    }
    
    if (el) el.style.display = ''; 
    
    delete ui.dataset.parent; delete ui.dataset.maskFor;
    if (baseId) window.refreshMasks(baseId); 
}

window.reorderSVGElements = function() {
    const items = [...document.querySelectorAll('.layer-item')].reverse();
    const layerObjects = document.getElementById('layer-objects');

    items.forEach(item => {
        if (item.dataset.maskFor) return; 

        const svgEl = document.getElementById(item.dataset.id);
        if (svgEl) {
            const baseNode = (svgEl.parentNode && svgEl.parentNode.classList.contains('base-cut-wrapper')) 
                           ? svgEl.parentNode : svgEl;
            layerObjects.appendChild(baseNode); 
            
            const maskedByThis = document.querySelectorAll(`.layer-item[data-mask-for="${item.dataset.id}"]`);
            [...maskedByThis].reverse().forEach(maskItem => {
                const mEl = document.getElementById(maskItem.dataset.id);
                if (mEl) {
                    const nodeToMove = (mEl.parentNode && mEl.parentNode.classList.contains('mask-wrapper')) 
                                       ? mEl.parentNode : mEl;
                    layerObjects.appendChild(nodeToMove);
                }
            });
        }
    });
}

window.getFamilyDOM = function(parentId) {
    let family = [];
    document.querySelectorAll('.layer-item').forEach(item => {
        if (window.isDescendantOf(item.dataset.id, parentId) && item.dataset.id !== parentId) family.push(item);
    });
    return family;
}

window.isDescendantOf = function(childId, parentId) {
    if (childId === parentId) return true;
    const child = document.querySelector(`.layer-item[data-id="${childId}"]`);
    if (!child) return false;
    const parentRef = child.dataset.parent || child.dataset.maskFor;
    if (!parentRef) return false;
    return window.isDescendantOf(parentRef, parentId);
}