"use strict";
// properties.js - Motor Super Suave de Arrastar e Layout de Cores Inteligente

let isRatioLocked = true;
const btnLockRatio = document.getElementById('btn-lock-ratio');

if (btnLockRatio) {
    btnLockRatio.onclick = (e) => { isRatioLocked = !isRatioLocked; e.currentTarget.classList.toggle('active', isRatioLocked); };
}

let isPatRatioLocked = true;
const btnPatLockRatio = document.getElementById('btn-pat-lock-ratio');
if (btnPatLockRatio) {
    btnPatLockRatio.onclick = (e) => { isPatRatioLocked = !isPatRatioLocked; e.currentTarget.classList.toggle('active', isPatRatioLocked); };
}

window.updateSVGContentAttr = function(layer, attr, value) {
    if (!layer.svgContent) return;
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<svg>${layer.svgContent}</svg>`, 'image/svg+xml');
    const inner = doc.querySelector('.inner-shape');
    if (inner) {
        if (value === null) inner.removeAttribute(attr); else inner.setAttribute(attr, value);
        layer.svgContent = doc.querySelector('svg').innerHTML;
    }
};

window.updatePropsPanel = function() {
    const section = document.getElementById('obj-props-section');
    const textSection = document.getElementById('text-props-section');
    const fxSection = document.getElementById('fx-props-section');
    const patternSection = document.getElementById('pattern-props-section');
    const colorSection = document.getElementById('img-color-section');
    const btnToggleImg = document.getElementById('btn-toggle-image-vis');
    const imgSpacer = document.getElementById('fill-image-spacer');
    
    const textInput = document.getElementById('inp-text-content');
    const fillColor = document.getElementById('fill-color');

    if (window.selectedElementsIds.length > 0) {
        section.style.opacity = '1'; section.style.pointerEvents = 'all';
        fxSection.style.opacity = '1'; fxSection.style.pointerEvents = 'all';

        const id = window.selectedElementsIds[0];
        const layer = window.LayerTree.find(l => l.id === id);
        if (!layer) return;

        document.getElementById('inp-obj-x').value = Math.round(layer.tx);
        document.getElementById('inp-obj-y').value = Math.round(layer.ty);
        document.getElementById('inp-obj-w').value = Math.round(layer.scaleX * 64); 
        document.getElementById('inp-obj-h').value = Math.round(layer.scaleY * 64);
        document.getElementById('inp-obj-skew-x').value = Math.round(layer.skewX);
        document.getElementById('inp-obj-skew-y').value = Math.round(layer.skewY);
        document.getElementById('inp-obj-blur').value = Math.round(layer.blur || 0);

        if (layer.type === 'image') {
            fillColor.value = layer.color || '#ffffff';
        } else if (layer.type === 'shape' || layer.type === 'text') {
            fillColor.value = layer.fill || '#d9d9d9';
        }

        if (layer.patternImg) {
            patternSection.style.display = 'flex';
            colorSection.style.display = 'flex';
            btnToggleImg.style.display = 'flex';
            imgSpacer.style.display = 'none';
            
            document.getElementById('inp-pat-w').value = Math.round(layer.patternW !== undefined ? layer.patternW : 100);
            document.getElementById('inp-pat-h').value = Math.round(layer.patternH !== undefined ? layer.patternH : 100);
            document.getElementById('inp-pat-x').value = Math.round(layer.patternX || 0);
            document.getElementById('inp-pat-y').value = Math.round(layer.patternY || 0);
            document.getElementById('inp-pat-rotate').value = Math.round(layer.patternRotate || 0);
            document.getElementById('inp-pat-opacity').value = Math.round(layer.patternOpacity !== undefined ? layer.patternOpacity : 100);
            
            document.getElementById('inp-pat-bri').value = Math.round(layer.patBri || 0);
            document.getElementById('inp-pat-con').value = Math.round(layer.patCon !== undefined ? layer.patCon : 100);
            document.getElementById('inp-pat-sat').value = Math.round(layer.patSat !== undefined ? layer.patSat : 100);
            document.getElementById('inp-pat-hue').value = Math.round(layer.patHue || 0);
            document.getElementById('inp-pat-temp').value = Math.round(layer.patTemp || 0);

            btnToggleImg.innerHTML = layer.patternHidden ? '<img src="assets/img/hide.svg" alt="Hide">' : '<img src="assets/img/view.svg" alt="View">';
        } else {
            patternSection.style.display = 'none';
            colorSection.style.display = 'none';
            btnToggleImg.style.display = 'none';
            imgSpacer.style.display = 'block';
        }

        if (layer.type === 'text') {
            textSection.style.display = 'flex'; 
            const textMatch = layer.svgContent.match(/>([^<]+)<\/text>/);
            textInput.value = textMatch ? textMatch[1] : 'Text';
        } else {
            textSection.style.display = 'none';
        }
        
    } else {
        section.style.opacity = '0.3'; section.style.pointerEvents = 'none';
        fxSection.style.opacity = '0.3'; fxSection.style.pointerEvents = 'none';
        textSection.style.display = 'none'; patternSection.style.display = 'none';
        colorSection.style.display = 'none';
        btnToggleImg.style.display = 'none';
        imgSpacer.style.display = 'block';
    }
};

function applyObjProps(source) {
    if (window.selectedElementsIds.length === 0) return;
    
    let newX = parseFloat(document.getElementById('inp-obj-x').value);
    let newY = parseFloat(document.getElementById('inp-obj-y').value);
    let newW = parseFloat(document.getElementById('inp-obj-w').value);
    let newH = parseFloat(document.getElementById('inp-obj-h').value);
    let newSkX = parseFloat(document.getElementById('inp-obj-skew-x').value) || 0;
    let newSkY = parseFloat(document.getElementById('inp-obj-skew-y').value) || 0;
    let newBlur = parseFloat(document.getElementById('inp-obj-blur').value) || 0;

    if (isNaN(newW) || newW <= 0) newW = 1; if (isNaN(newH) || newH <= 0) newH = 1;
    if (newBlur < 0) { newBlur = 0; document.getElementById('inp-obj-blur').value = 0; }

    const topLevelIds = window.getTopLevelSelectedIds ? window.getTopLevelSelectedIds() : window.selectedElementsIds;

    topLevelIds.forEach(id => {
        const rootLayer = window.LayerTree.find(l => l.id === id);
        if (!rootLayer || rootLayer.locked) return;
        
        const rootBaseTx = rootLayer.tx; const rootBaseTy = rootLayer.ty;
        const oldW = rootLayer.scaleX * 64; const oldH = rootLayer.scaleY * 64;

        let localNewW = newW; let localNewH = newH;

        if (isRatioLocked && (source === 'w' || source === 'h')) {
            const ratio = oldW / oldH;
            if (source === 'w') { localNewH = Math.round(localNewW / ratio); document.getElementById('inp-obj-h').value = localNewH; } 
            else if (source === 'h') { localNewW = Math.round(localNewH * ratio); document.getElementById('inp-obj-w').value = localNewW; }
        }

        let deltaX = source === 'x' ? newX - rootBaseTx : 0; 
        let deltaY = source === 'y' ? newY - rootBaseTy : 0;
        let deltaFactorX = (source === 'w' || source === 'h') ? localNewW / oldW : 1;
        let deltaFactorY = (source === 'w' || source === 'h') ? localNewH / oldH : 1;

        const descendants = window.LayerTree.filter(l => window.isDescendantOfData && window.isDescendantOfData(l.id, rootLayer.id));

        const applyToEl = (layer) => {
            if (source === 'x' || source === 'y') { layer.tx += deltaX; layer.ty += deltaY; }
            if (source === 'w' || source === 'h') {
                if (layer.id !== rootLayer.id) {
                    const dx = layer.tx - rootBaseTx; const dy = layer.ty - rootBaseTy;
                    layer.tx = rootBaseTx + (dx * deltaFactorX); layer.ty = rootBaseTy + (dy * deltaFactorY);
                }
                layer.scaleX *= deltaFactorX; layer.scaleY *= deltaFactorY;
            }
            if (source === 'skew-x') layer.skewX = newSkX;
            if (source === 'skew-y') layer.skewY = newSkY;
            
            if (source === 'blur' && layer.id === rootLayer.id) {
                layer.blur = newBlur;
                if (newBlur > 0 || layer.color) layer.filterId = window.applyFilters(layer.id, layer.color, newBlur);
                else layer.filterId = null;
            }
        };

        applyToEl(rootLayer); descendants.forEach(child => applyToEl(child));
    });
    
    window.Render();
}

function applyPatProps(source) {
    if (window.selectedElementsIds.length === 0) return;
    
    let newW = parseFloat(document.getElementById('inp-pat-w').value) || 100;
    let newH = parseFloat(document.getElementById('inp-pat-h').value) || 100;

    window.selectedElementsIds.forEach(id => {
        const layer = window.LayerTree.find(l => l.id === id);
        if (layer && layer.patternImg) {
            const oldW = layer.patternW !== undefined ? layer.patternW : 100;
            const oldH = layer.patternH !== undefined ? layer.patternH : 100;

            let localNewW = newW; let localNewH = newH;

            if (isPatRatioLocked && (source === 'w' || source === 'h')) {
                const ratio = oldW / (oldH === 0 ? 1 : oldH);
                if (source === 'w') { localNewH = Math.round(localNewW / ratio); document.getElementById('inp-pat-h').value = localNewH; } 
                else if (source === 'h') { localNewW = Math.round(localNewH * ratio); document.getElementById('inp-pat-w').value = localNewW; }
            }

            layer.patternX = parseFloat(document.getElementById('inp-pat-x').value) || 0;
            layer.patternY = parseFloat(document.getElementById('inp-pat-y').value) || 0;
            layer.patternW = localNewW;
            layer.patternH = localNewH;
            layer.patternRotate = parseFloat(document.getElementById('inp-pat-rotate').value) || 0;
            
            let op = parseFloat(document.getElementById('inp-pat-opacity').value) || 100;
            if (op < 0) op = 0; if (op > 100) op = 100; 
            layer.patternOpacity = op;

            // Filtros de Cor
            let bri = parseFloat(document.getElementById('inp-pat-bri').value) || 0;
            if(bri < -100) bri = -100; if(bri > 100) bri = 100; layer.patBri = bri;

            let con = parseFloat(document.getElementById('inp-pat-con').value) || 0;
            if(con < 0) con = 0; if(con > 200) con = 200; layer.patCon = con;

            let sat = parseFloat(document.getElementById('inp-pat-sat').value) || 0;
            if(sat < 0) sat = 0; if(sat > 200) sat = 200; layer.patSat = sat;

            let hue = parseFloat(document.getElementById('inp-pat-hue').value) || 0;
            if(hue < -180) hue = -180; if(hue > 180) hue = 180; layer.patHue = hue;

            let tmp = parseFloat(document.getElementById('inp-pat-temp').value) || 0;
            if(tmp < -100) tmp = -100; if(tmp > 100) tmp = 100; layer.patTemp = tmp;
            
            if(window.updateLayerFill) window.updateLayerFill(layer);
        }
    });
    window.Render();
}

document.getElementById('btn-pat-flip-h').addEventListener('click', () => {
    window.selectedElementsIds.forEach(id => {
        const layer = window.LayerTree.find(l => l.id === id);
        if (layer && layer.patternImg) { layer.patternFlipX = !layer.patternFlipX; if(window.updateLayerFill) window.updateLayerFill(layer); }
    });
    window.Render(); window.saveState();
});

document.getElementById('btn-pat-flip-v').addEventListener('click', () => {
    window.selectedElementsIds.forEach(id => {
        const layer = window.LayerTree.find(l => l.id === id);
        if (layer && layer.patternImg) { layer.patternFlipY = !layer.patternFlipY; if(window.updateLayerFill) window.updateLayerFill(layer); }
    });
    window.Render(); window.saveState();
});

document.getElementById('btn-pat-rot-90').addEventListener('click', () => {
    window.selectedElementsIds.forEach(id => {
        const layer = window.LayerTree.find(l => l.id === id);
        if (layer && layer.patternImg) { 
            layer.patternRotate = (layer.patternRotate || 0) + 90; 
            if (layer.patternRotate >= 360) layer.patternRotate -= 360;
            document.getElementById('inp-pat-rotate').value = layer.patternRotate;
            if(window.updateLayerFill) window.updateLayerFill(layer); 
        }
    });
    window.Render(); window.saveState();
});

document.getElementById('btn-toggle-image-vis').addEventListener('click', () => {
    let toggled = false;
    window.selectedElementsIds.forEach(id => {
        const layer = window.LayerTree.find(l => l.id === id);
        if (layer && layer.patternImg) {
            layer.patternHidden = !layer.patternHidden;
            if(window.updateLayerFill) window.updateLayerFill(layer);
            toggled = true;
        }
    });
    if (toggled) { window.Render(); window.updatePropsPanel(); window.saveState(); }
});

function setupScrub(labelId, inputId, multiplier = 0.2) {
    const label = document.getElementById(labelId); 
    const input = document.getElementById(inputId);
    if (!label || !input) return;
    
    let isScrubbing = false; 
    let currentValue = 0;

    label.addEventListener('mousedown', (e) => {
        isScrubbing = true; 
        currentValue = parseFloat(input.value) || 0;
        
        // Bloqueia e oculta o mouse, destravando os limites do monitor
        label.requestPointerLock = label.requestPointerLock || label.mozRequestPointerLock;
        if (label.requestPointerLock) label.requestPointerLock();
        
        e.preventDefault();
    });
    
    window.addEventListener('mousemove', (e) => {
        if (!isScrubbing) return;
        
        // e.movementX pega a velocidade do mouse, ignorando as bordas da tela!
        currentValue += (e.movementX * multiplier); 
        input.value = Math.round(currentValue);
        input.dispatchEvent(new Event('input')); 
    });
    
    window.addEventListener('mouseup', () => {
        if (isScrubbing) { 
            isScrubbing = false; 
            
            // Libera o mouse. Ele reaparece no exato lugar onde você começou o click
            if (document.exitPointerLock) document.exitPointerLock();
            
            if(window.saveState) window.saveState(); 
        }
    });
}

['w', 'h'].forEach(axis => {
    setupScrub(`lbl-canvas-${axis}`, `inp-canvas-${axis}`, 0.5);
    document.getElementById(`inp-canvas-${axis}`).addEventListener('input', (e) => {
        let val = Math.max(1, parseInt(e.target.value) || 1);
        if (axis === 'w') document.getElementById('canvas').setAttribute('width', val);
        if (axis === 'h') document.getElementById('canvas').setAttribute('height', val);
    });
});

['x', 'y', 'w', 'h', 'skew-x', 'skew-y', 'blur'].forEach(axis => {
    setupScrub(`lbl-obj-${axis}`, `inp-obj-${axis}`, 0.2);
    document.getElementById(`inp-obj-${axis}`).addEventListener('input', () => applyObjProps(axis));
    document.getElementById(`inp-obj-${axis}`).addEventListener('change', () => { if(window.saveState) window.saveState(); });
});

['pat-x', 'pat-y', 'pat-w', 'pat-h', 'pat-rotate', 'pat-opacity', 'pat-bri', 'pat-con', 'pat-sat', 'pat-hue', 'pat-temp'].forEach(axis => {
    setupScrub(`lbl-${axis}`, `inp-${axis}`, 0.2);
    document.getElementById(`inp-${axis}`).addEventListener('input', () => applyPatProps(axis.replace('pat-', '')));
    document.getElementById(`inp-${axis}`).addEventListener('change', () => { if(window.saveState) window.saveState(); });
});

document.getElementById('inp-text-content').addEventListener('input', (e) => {
    window.selectedElementsIds.forEach(id => {
        const layer = window.LayerTree.find(l => l.id === id);
        if (layer && layer.type === 'text') layer.svgContent = layer.svgContent.replace(/(>)([^<]+)(<\/text>)/, `$1${e.target.value}$3`);
    });
    window.Render();
});

document.getElementById('inp-text-font').addEventListener('change', (e) => {
    window.selectedElementsIds.forEach(id => {
        const layer = window.LayerTree.find(l => l.id === id);
        if (layer && layer.type === 'text') window.updateSVGContentAttr(layer, 'font-family', e.target.value);
    });
    window.Render(); window.saveState();
});

document.getElementById('fill-color').addEventListener('input', (e) => {
    window.selectedElementsIds.forEach(id => {
        const layer = window.LayerTree.find(l => l.id === id);
        if (!layer || layer.locked) return;

        if (layer.type === 'image') {
            layer.color = e.target.value;
            layer.filterId = window.applyFilters(layer.id, layer.color, layer.blur);
        } else {
            layer.fill = e.target.value;
            if(window.updateLayerFill) window.updateLayerFill(layer);
            if (layer.blur > 0) layer.filterId = window.applyFilters(layer.id, null, layer.blur);
        }
    });
    window.Render();
});

document.getElementById('fill-color').addEventListener('change', () => window.saveState());

document.getElementById('fill-image').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file || window.selectedElementsIds.length === 0) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        const base64Url = event.target.result;
        
        window.selectedElementsIds.forEach(id => {
            const layer = window.LayerTree.find(l => l.id === id);
            if (layer && layer.type !== 'image') {
                layer.patternImg = base64Url;
                layer.patternX = 0; layer.patternY = 0;
                layer.patternW = 100; layer.patternH = 100;
                layer.patternOpacity = 100;
                layer.patternRotate = 0;
                layer.patternFlipX = false;
                layer.patternFlipY = false;
                layer.patternHidden = false;
                
                // Reseta os filtros de cor ao trocar de imagem
                layer.patBri = 0; layer.patCon = 100; layer.patSat = 100; layer.patHue = 0; layer.patTemp = 0;
                
                if(window.updateLayerFill) window.updateLayerFill(layer);
            }
        });
        window.Render(); window.updatePropsPanel(); window.saveState();
    };
    reader.readAsDataURL(file); e.target.value = '';
});