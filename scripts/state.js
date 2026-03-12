"use strict";
// state.js - O Cérebro JSON e Motores de Render Dinâmicos

window.LayerTree = []; 
window.selectedElementsIds = []; 
window.historyStack = [];
window.historyIndex = -1;
window.pivotCache = window.pivotCache || {};
window.isSnapEnabled = false;

window.getUniqueLayerName = function(baseName) {
    let count = 0; let newName = baseName;
    const cleanBase = baseName.replace(/\s\d+$/, ''); 
    while(window.LayerTree.some(l => l.name === newName)) { count++; newName = `${cleanBase} ${count.toString().padStart(2, '0')}`; }
    return newName;
};

window.getHighestLogicalParent = function(id) {
    const layer = window.LayerTree.find(l => l.id === id); if (!layer) return id;
    const parentRef = layer.parentId || layer.maskForId;
    if (parentRef) return window.getHighestLogicalParent(parentRef);
    return id;
};

window.getAllLogicalDescendants = function(parentId) {
    let descendants = [];
    const children = window.LayerTree.filter(l => l.parentId === parentId || l.maskForId === parentId);
    children.forEach(child => { descendants.push(child.id); descendants = descendants.concat(window.getAllLogicalDescendants(child.id)); });
    return descendants;
};

window.getTopLevelSelectedIds = function() {
    return window.selectedElementsIds.filter(id => {
        let current = window.LayerTree.find(l => l.id === id);
        while (current && (current.parentId || current.maskForId)) {
            let parentId = current.parentId || current.maskForId;
            if (window.selectedElementsIds.includes(parentId)) return false; 
            current = window.LayerTree.find(l => l.id === parentId);
        }
        return true;
    });
};

window.saveState = function() {
    if (window.historyIndex < window.historyStack.length - 1) window.historyStack = window.historyStack.slice(0, window.historyIndex + 1);
    const treeSnapshot = JSON.parse(JSON.stringify(window.LayerTree));
    window.historyStack.push({ tree: treeSnapshot, defs: document.getElementById('canvas-defs').innerHTML });
    if (window.historyStack.length > 50) window.historyStack.shift(); else window.historyIndex++;
};

window.undo = function() {
    if (window.historyIndex > 0) {
        window.historyIndex--; const state = window.historyStack[window.historyIndex];
        window.LayerTree = JSON.parse(JSON.stringify(state.tree));
        document.getElementById('canvas-defs').innerHTML = state.defs; window.selectedElementsIds = [];
        if(window.Render) window.Render(); if(window.updatePropsPanel) window.updatePropsPanel();
    }
};

window.snap = function(value) {
    if (!window.isSnapEnabled) return value;
    const snapInput = document.getElementById('snap-value');
    return Math.round(value / (parseInt(snapInput ? snapInput.value : 16) || 16)) * (parseInt(snapInput ? snapInput.value : 16) || 16);
};

window.updateLayerFill = function(layer) {
    if (!layer.svgContent) return;
    let fillValue = layer.fill || '#d9d9d9';

    if (layer.patternImg) {
        let defs = document.getElementById('canvas-defs');
        let patId = `pat-${layer.id}`;
        let pattern = document.getElementById(patId);
        
        if (!pattern) {
            pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
            pattern.setAttribute('id', patId); 
            pattern.setAttribute('patternUnits', 'objectBoundingBox');
            pattern.setAttribute('patternContentUnits', 'objectBoundingBox');
            pattern.setAttribute('width', 1); pattern.setAttribute('height', 1);
            defs.appendChild(pattern);
        }
        
        pattern.innerHTML = ''; 
        
        const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bgRect.setAttribute('width', 1); bgRect.setAttribute('height', 1);
        bgRect.setAttribute('fill', layer.fill || 'transparent');
        pattern.appendChild(bgRect);

        // MÁGICA DE CORREÇÃO DE COR DA IMAGEM
        let hasImageFilters = layer.patBri !== undefined || layer.patCon !== undefined || layer.patSat !== undefined || layer.patHue !== undefined || layer.patTemp !== undefined;
        let imgFilterId = `img-flt-${layer.id}`;
        
        if (hasImageFilters && !layer.patternHidden) {
            let imgFilter = document.getElementById(imgFilterId);
            if (!imgFilter) {
                imgFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
                imgFilter.setAttribute('id', imgFilterId);
                defs.appendChild(imgFilter);
            }
            imgFilter.innerHTML = '';
            
            let b = (layer.patBri || 0) / 100; 
            let c = (layer.patCon !== undefined ? layer.patCon : 100) / 100; 
            let s = (layer.patSat !== undefined ? layer.patSat : 100) / 100; 
            let h = layer.patHue || 0; 
            let t = (layer.patTemp || 0) / 200; 
            
            let intercept = -(0.5 * c) + 0.5 + b;
            const feComp = document.createElementNS('http://www.w3.org/2000/svg', 'feComponentTransfer');
            ['R', 'G', 'B'].forEach(chan => {
                const feFunc = document.createElementNS('http://www.w3.org/2000/svg', `feFunc${chan}`);
                feFunc.setAttribute('type', 'linear');
                feFunc.setAttribute('slope', c);
                feFunc.setAttribute('intercept', intercept);
                feComp.appendChild(feFunc);
            });
            imgFilter.appendChild(feComp);
            
            if (s !== 1) {
                const feSat = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
                feSat.setAttribute('type', 'saturate'); feSat.setAttribute('values', s);
                imgFilter.appendChild(feSat);
            }
            
            if (h !== 0) {
                const feHue = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
                feHue.setAttribute('type', 'hueRotate'); feHue.setAttribute('values', h);
                imgFilter.appendChild(feHue);
            }
            
            if (t !== 0) {
                const feTemp = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
                feTemp.setAttribute('type', 'matrix');
                feTemp.setAttribute('values', `${1+t} 0 0 0 0  0 1 0 0 0  0 0 ${1-t} 0 0  0 0 0 1 0`);
                imgFilter.appendChild(feTemp);
            }
        } else {
            let imgFilter = document.getElementById(imgFilterId);
            if (imgFilter) imgFilter.remove();
        }

        if (!layer.patternHidden) {
            const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            img.setAttribute('href', layer.patternImg);
            img.setAttribute('width', 1); img.setAttribute('height', 1);
            img.setAttribute('preserveAspectRatio', 'xMidYMid meet'); 
            img.setAttribute('opacity', (layer.patternOpacity !== undefined ? layer.patternOpacity : 100) / 100);
            if (hasImageFilters) img.setAttribute('filter', `url(#${imgFilterId})`);
            pattern.appendChild(img);
        }

        const tx = (layer.patternX || 0) / 100;
        const ty = (layer.patternY || 0) / 100;
        const sx = (layer.patternW !== undefined ? layer.patternW : 100) / 100;
        const sy = (layer.patternH !== undefined ? layer.patternH : 100) / 100;
        const rot = layer.patternRotate || 0;
        let flipX = layer.patternFlipX ? -1 : 1;
        let flipY = layer.patternFlipY ? -1 : 1;
        
        pattern.setAttribute('patternTransform', 
            `translate(${tx + 0.5}, ${ty + 0.5}) rotate(${rot}) scale(${sx * flipX}, ${sy * flipY}) translate(-0.5, -0.5)`
        );

        fillValue = `url(#${patId})`;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<svg>${layer.svgContent}</svg>`, 'image/svg+xml');
    const inner = doc.querySelector('.inner-shape');
    if (inner) {
        inner.setAttribute('fill', fillValue);
        layer.svgContent = doc.querySelector('svg').innerHTML;
    }
};

window.applyFilters = function(elementId, color, blurVal) {
    let defs = document.getElementById('canvas-defs');
    let filterId = `filter-fx-${elementId}`;
    let filter = document.getElementById(filterId);

    if (!filter) {
        filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filter.setAttribute('id', filterId); filter.setAttribute('color-interpolation-filters', 'sRGB');
        filter.setAttribute('x', '-50%'); filter.setAttribute('y', '-50%');
        filter.setAttribute('width', '200%'); filter.setAttribute('height', '200%');
        defs.appendChild(filter);
    }
    
    filter.innerHTML = ''; let currentSource = 'SourceGraphic';

    if (color && color !== 'none') {
        const feFlood = document.createElementNS('http://www.w3.org/2000/svg', 'feFlood');
        feFlood.setAttribute('result', 'flood'); feFlood.setAttribute('flood-color', color); filter.appendChild(feFlood);

        const feBlend = document.createElementNS('http://www.w3.org/2000/svg', 'feBlend');
        feBlend.setAttribute('mode', 'multiply'); feBlend.setAttribute('in', 'flood'); feBlend.setAttribute('in2', currentSource); feBlend.setAttribute('result', 'blend'); filter.appendChild(feBlend);

        const feComposite = document.createElementNS('http://www.w3.org/2000/svg', 'feComposite');
        feComposite.setAttribute('in', 'blend'); feComposite.setAttribute('in2', 'SourceAlpha'); feComposite.setAttribute('operator', 'in'); feComposite.setAttribute('result', 'colorized'); filter.appendChild(feComposite);

        currentSource = 'colorized';
    }

    if (blurVal > 0) {
        const feBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
        feBlur.setAttribute('in', currentSource); feBlur.setAttribute('stdDeviation', blurVal * 0.1); feBlur.setAttribute('result', 'blurred'); filter.appendChild(feBlur);
    }
    return filterId;
};