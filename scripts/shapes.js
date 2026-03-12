"use strict";
// shapes.js - Construtor de Elementos (Clean Names)

const shapesDock = document.getElementById('shapes-dock');
const tabs = document.querySelectorAll('.asset-tab');

let currentTab = 'shapes';
const folders = ['shapes', 'gradients', 'textures', 'buttons', 'icons'];
const assetData = {};

Promise.all(folders.map(folder => 
    fetch(`assets/${folder}.json`)
        .then(r => r.ok ? r.json() : [])
        .then(data => assetData[folder] = data)
        .catch(() => assetData[folder] = [])
)).then(() => {
    renderDock(currentTab);
});

tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        tabs.forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentTab = e.currentTarget.dataset.tab;
        renderDock(currentTab);
    });
});

function renderDock(folder) {
    shapesDock.innerHTML = '';
    const list = assetData[folder] || [];
    
    if (list.length === 0) {
        shapesDock.innerHTML = `<div style="width:100%; text-align:center; color:#555; font-size:11px; margin-top:20px;">Pasta 'assets/${folder}' vazia.</div>`;
        return;
    }

    list.forEach(file => {
        const btn = document.createElement('button');
        btn.className = 'shape-btn';
        btn.innerHTML = `<img src="assets/${folder}/${file}" alt="${file}">`;
        
        btn.onclick = () => {
            const isSvg = file.toLowerCase().endsWith('.svg');
            const startX = window.snap ? window.snap(256) : 256;
            const startY = window.snap ? window.snap(256) : 256;

            if (isSvg) {
                createShape(folder, file, '#d9d9d9', startX, startY);
            } else {
                createImageAsset(folder, file, startX, startY);
            }
        };
        shapesDock.appendChild(btn);
    });
}

function createShape(folder, file, color, x, y) {
    const id = `id-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const baseName = file.replace(/\.[^/.]+$/, "").replace(/_/g, ' ');
    const friendlyName = window.getUniqueLayerName ? window.getUniqueLayerName(baseName) : baseName;

    fetch(`assets/${folder}/${file}`).then(r => r.text()).then(svg => {
        const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const node = doc.documentElement;
        node.setAttribute('class', 'shape-element inner-shape');
        
        if (!node.getAttribute('fill')?.startsWith('url')) {
            node.setAttribute('fill', color);
        }

        node.setAttribute('width', 64); node.setAttribute('height', 64);
        node.setAttribute('x', -32); node.setAttribute('y', -32);
        
        node.querySelectorAll('*').forEach(c => {
            c.setAttribute('vector-effect', 'non-scaling-stroke');
            const fillAttr = c.getAttribute('fill');
            if(fillAttr && fillAttr !== 'none' && !fillAttr.startsWith('url')) {
                c.removeAttribute('fill');
            }
        });

        const layerObj = {
            id: id, name: friendlyName, type: 'shape',
            tx: x, ty: y, scaleX: 1, scaleY: 1, rotate: 0, skewX: 0, skewY: 0, opacity: 1,
            locked: false, hidden: false, collapsed: false,
            parentId: null, maskForId: null, boolMode: null,
            fill: color, blur: 0, filterId: null, color: null,
            svgContent: node.outerHTML
        };

        window.LayerTree.push(layerObj);
        window.selectedElementsIds = [id];
        window.Render();
        window.saveState();
    });
}

function createImageAsset(folder, file, x, y) {
    const id = `id-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    
    // NOME LIMPO DA IMAGEM (SEM EMOJI)
    const baseName = file.replace(/\.[^/.]+$/, "").replace(/_/g, ' ');
    const friendlyName = window.getUniqueLayerName ? window.getUniqueLayerName(baseName) : baseName;

    const imgObj = new Image();
    imgObj.crossOrigin = 'Anonymous';
    imgObj.onload = function() {
        let w = imgObj.width; let h = imgObj.height;
        const maxDim = 128; 
        if (w > maxDim || h > maxDim) {
            const ratio = Math.min(maxDim / w, maxDim / h);
            w = w * ratio; h = h * ratio;
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgObj.naturalWidth || imgObj.width;
        tempCanvas.height = imgObj.naturalHeight || imgObj.height;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(imgObj, 0, 0);
        
        const base64Data = tempCanvas.toDataURL('image/png');

        const imageNode = document.createElementNS("http://www.w3.org/2000/svg", 'image');
        imageNode.setAttribute('class', 'shape-element inner-shape');
        imageNode.setAttribute('href', base64Data); 
        imageNode.setAttribute('width', w);
        imageNode.setAttribute('height', h);
        imageNode.setAttribute('x', -w / 2);
        imageNode.setAttribute('y', -h / 2);
        imageNode.setAttribute('preserveAspectRatio', 'none'); 

        const layerObj = {
            id: id, name: friendlyName, type: 'image',
            tx: x, ty: y, scaleX: 1, scaleY: 1, rotate: 0, skewX: 0, skewY: 0, opacity: 1,
            locked: false, hidden: false, collapsed: false,
            parentId: null, maskForId: null, boolMode: null,
            fill: null, blur: 0, filterId: null, color: null,
            svgContent: imageNode.outerHTML
        };

        window.LayerTree.push(layerObj);
        window.selectedElementsIds = [id];
        window.Render();
        window.saveState(); 
    }
    imgObj.src = `assets/${folder}/${file}`;
}

window.createGroup = (x, y) => {
    const id = `id-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const layerObj = {
        // NOME LIMPO DO GRUPO (SEM EMOJI)
        id: id, name: window.getUniqueLayerName ? window.getUniqueLayerName('Group') : 'Group', 
        type: 'group',
        tx: x, ty: y, scaleX: 1, scaleY: 1, rotate: 0, skewX: 0, skewY: 0, opacity: 1,
        locked: false, hidden: false, collapsed: false,
        parentId: null, maskForId: null, boolMode: null,
        fill: null, blur: 0, filterId: null, color: null,
        svgContent: '' 
    };
    return layerObj;
}