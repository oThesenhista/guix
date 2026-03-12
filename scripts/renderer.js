"use strict";
// renderer.js - Motor Gráfico Modular (Fábrica de SVG Isolada)

window.Renderer = {
    renderCanvas: function() {
        const canvasObjects = document.getElementById('layer-objects');
        canvasObjects.innerHTML = '';
        
        let defs = document.getElementById('canvas-defs');
        if (!defs) { 
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); 
            defs.id = 'canvas-defs'; 
            document.getElementById('canvas').appendChild(defs); 
        } else {
            defs.innerHTML = ''; // Limpa as memórias velhas a cada render
        }

        const rootItems = window.LayerTree.filter(l => !l.parentId && !l.maskForId);
        rootItems.forEach(layer => {
            canvasObjects.appendChild(this.buildLayer(layer, defs)); 
        });
    },

    // O ORQUESTRADOR DE SISTEMAS
    buildLayer: function(layer, defs) {
        const renderGroup = document.createElementNS("http://www.w3.org/2000/svg", 'g');
        renderGroup.id = 'render-group-' + layer.id;
        renderGroup.style.opacity = layer.opacity;

        if (layer.hidden) {
            renderGroup.style.display = 'none';
            return renderGroup;
        }

        // 1. GERA A FORMA BASE
        let baseElement = this.createBaseShape(layer);

        // 2. SEPARA OS DEPENDENTES POR DEPARTAMENTO
        const children = window.LayerTree.filter(l => l.parentId === layer.id);
        const allMasks = window.LayerTree.filter(l => l.maskForId === layer.id);
        
        const boolModifiers = allMasks.filter(m => ['union', 'subtract', 'intersect', 'exclude'].includes(m.boolMode));
        const clippedChildren = allMasks.filter(m => !m.boolMode || m.boolMode === 'clip');

        let compositeElements = [];

        // --- DEPARTAMENTO BOOLEANO ---
        if (boolModifiers.length > 0) {
            baseElement = this.applyBooleanSystem(layer, baseElement, boolModifiers, compositeElements, defs);
        }

        let parentGeomContainer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        parentGeomContainer.appendChild(baseElement);
        compositeElements.forEach(el => parentGeomContainer.appendChild(el));

        // --- DEPARTAMENTO DE MÁSCARA/CLIPPING ---
        if (clippedChildren.length > 0) {
            const clippedWrap = this.applyClippingSystem(layer, parentGeomContainer, clippedChildren, defs);
            renderGroup.appendChild(parentGeomContainer); 
            renderGroup.appendChild(clippedWrap);         
        } else {
            renderGroup.appendChild(parentGeomContainer);
        }

        // --- DEPARTAMENTO DE GRUPOS ---
        children.forEach(childLayer => {
            renderGroup.appendChild(this.buildLayer(childLayer, defs));
        });

        return renderGroup;
    },

    // CRIADOR DO NÓ PRIMITIVO
    createBaseShape: function(layer) {
        const g = document.createElementNS("http://www.w3.org/2000/svg", 'g');
        g.id = layer.id;
        g.setAttribute('class', 'draggable');
        if (window.selectedElementsIds.includes(layer.id)) g.classList.add('selected');
        
        g.setAttribute('transform', `translate(${layer.tx}, ${layer.ty}) rotate(${layer.rotate}) scale(${layer.scaleX}, ${layer.scaleY}) skewX(${layer.skewX}) skewY(${layer.skewY})`);

        if (layer.svgContent) {
            g.innerHTML = layer.svgContent;
            const inner = g.querySelector('.inner-shape');
            if (inner && layer.filterId) inner.setAttribute('filter', `url(#${layer.filterId})`);
        }
        return g;
    },

    // LÓGICA DO PATHFINDER VISUAL (NÃO-DESTRUTIVO)
    applyBooleanSystem: function(layer, baseElement, modifiers, compositeElements, defs) {
        let isIntersect = modifiers.some(m => m.boolMode === 'intersect');
        let parentMask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
        parentMask.id = 'mask-parent-' + layer.id;
        parentMask.setAttribute('maskUnits', 'userSpaceOnUse');

        let bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bgRect.setAttribute('x', '-5000'); bgRect.setAttribute('y', '-5000');
        bgRect.setAttribute('width', '10000'); bgRect.setAttribute('height', '10000');
        bgRect.setAttribute('fill', isIntersect ? '#000000' : '#ffffff');
        parentMask.appendChild(bgRect);

        modifiers.forEach(maskData => {
            if (maskData.hidden) return;
            let maskNode = this.buildLayer(maskData, defs);

            maskNode.querySelectorAll('.inner-shape, .inner-shape *').forEach(s => { s.setAttribute('stroke', 'none'); s.removeAttribute('filter'); });

            if (maskData.boolMode === 'subtract') {
                let m = maskNode.cloneNode(true);
                m.querySelectorAll('.inner-shape, .inner-shape *').forEach(s => { s.setAttribute('fill', '#000000'); });
                parentMask.appendChild(m);

            } else if (maskData.boolMode === 'intersect') {
                let m = maskNode.cloneNode(true);
                m.querySelectorAll('.inner-shape, .inner-shape *').forEach(s => { s.setAttribute('fill', '#ffffff'); });
                parentMask.appendChild(m);

            } else if (maskData.boolMode === 'exclude') {
                let m = maskNode.cloneNode(true);
                m.querySelectorAll('.inner-shape, .inner-shape *').forEach(s => { s.setAttribute('fill', '#000000'); });
                parentMask.appendChild(m);

                let childMask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
                childMask.id = 'mask-child-' + maskData.id;
                childMask.setAttribute('maskUnits', 'userSpaceOnUse');
                
                let childBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                childBg.setAttribute('x', '-5000'); childBg.setAttribute('y', '-5000');
                childBg.setAttribute('width', '10000'); childBg.setAttribute('height', '10000');
                childBg.setAttribute('fill', '#ffffff');
                childMask.appendChild(childBg);

                let pMaskShape = this.createBaseShape(layer); 
                pMaskShape.querySelectorAll('.inner-shape, .inner-shape *').forEach(s => { s.setAttribute('fill', '#000000'); });
                childMask.appendChild(pMaskShape);
                defs.appendChild(childMask);

                let childWrap = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                childWrap.setAttribute('mask', `url(#${childMask.id})`);
                let cNode = this.buildLayer(maskData, defs);
                cNode.querySelectorAll('.inner-shape, .inner-shape *').forEach(s => { s.setAttribute('fill', layer.fill || '#d9d9d9'); });
                childWrap.appendChild(cNode);
                compositeElements.push(childWrap);

            } else if (maskData.boolMode === 'union') {
                let cNode = this.buildLayer(maskData, defs);
                cNode.querySelectorAll('.inner-shape, .inner-shape *').forEach(s => { s.setAttribute('fill', layer.fill || '#d9d9d9'); });
                compositeElements.push(cNode);
                if (isIntersect) {
                     let m = maskNode.cloneNode(true);
                     m.querySelectorAll('.inner-shape, .inner-shape *').forEach(s => { s.setAttribute('fill', '#ffffff'); });
                     parentMask.appendChild(m);
                }
            }
        });

        defs.appendChild(parentMask);
        let parentWrap = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        parentWrap.setAttribute('mask', `url(#${parentMask.id})`);
        parentWrap.appendChild(baseElement);
        return parentWrap;
    },

    // LÓGICA DE JANELA (MÁSCARA DE IMAGEM/ARRASTAR)
    applyClippingSystem: function(layer, parentGeomContainer, clippedChildren, defs) {
        let standardMask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
        standardMask.id = 'mask-standard-' + layer.id;
        standardMask.setAttribute('maskUnits', 'userSpaceOnUse');

        let parentClone = parentGeomContainer.cloneNode(true);
        parentClone.querySelectorAll('.inner-shape, .inner-shape *').forEach(s => {
            s.setAttribute('stroke', 'none'); s.removeAttribute('filter');
            if (s.tagName === 'image') { s.style.filter = 'brightness(0) invert(1)'; } 
            else { s.setAttribute('fill', '#ffffff'); s.style.fill = '#ffffff'; s.style.filter = 'none'; }
        });
        
        standardMask.appendChild(parentClone);
        defs.appendChild(standardMask);

        let clippedWrap = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        clippedWrap.setAttribute('mask', `url(#${standardMask.id})`);

        clippedChildren.forEach(childLayer => {
            clippedWrap.appendChild(this.buildLayer(childLayer, defs));
        });
        
        return clippedWrap;
    }
};