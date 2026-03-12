"use strict";
// export.js - Motor de Salvamento e Exportação (Fundo Transparente no PNG/SVG)

async function saveFileWithDialog(defaultName, content, mimeType, extension, description) {
    try {
        if (window.showSaveFilePicker) {
            const handle = await window.showSaveFilePicker({
                suggestedName: defaultName,
                types: [{
                    description: description,
                    accept: { [mimeType]: [extension] }
                }]
            });
            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();
            return;
        }
    } catch (err) {
        if (err.name === 'AbortError') return;
        console.error("API falhou, usando fallback...", err);
    }

    let url;
    if (content instanceof Blob) {
        url = URL.createObjectURL(content);
    } else {
        url = `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`;
    }
    
    const a = document.createElement("a");
    a.href = url;
    a.download = defaultName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (content instanceof Blob) URL.revokeObjectURL(url);
}

// --- SAVE PROJECT (.viep) ---
document.getElementById('btn-save-project').addEventListener('click', async () => {
    const projectData = {
        version: "2.0",
        canvas: {
            w: document.getElementById('inp-canvas-w').value,
            h: document.getElementById('inp-canvas-h').value
        },
        layers: window.LayerTree,
        defs: document.getElementById('canvas-defs').innerHTML
    };

    const contentStr = JSON.stringify(projectData, null, 2);
    await saveFileWithDialog("project.viep", contentStr, "application/json", ".viep", "Vector Icon Editor Pro Project");
});

// --- OPEN PROJECT (.viep) ---
document.getElementById('btn-open-project').addEventListener('click', () => {
    document.getElementById('inp-open-project').click();
});

document.getElementById('inp-open-project').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const projectData = JSON.parse(e.target.result);
            
            if (projectData.version === "2.0" && projectData.layers) {
                window.LayerTree = projectData.layers;
                
                if (projectData.canvas) {
                    document.getElementById('inp-canvas-w').value = projectData.canvas.w;
                    document.getElementById('inp-canvas-h').value = projectData.canvas.h;
                    document.getElementById('canvas').setAttribute('width', projectData.canvas.w);
                    document.getElementById('canvas').setAttribute('height', projectData.canvas.h);
                }
                
                if (projectData.defs) {
                    document.getElementById('canvas-defs').innerHTML = projectData.defs;
                }

                window.selectedElementsIds = [];
                window.historyStack = [];
                window.historyIndex = -1;
                
                window.Render();
                window.saveState();
                if (window.updatePropsPanel) window.updatePropsPanel();
            } else {
                alert("⚠️ Este arquivo .viep foi salvo com a engine antiga (DOM) e não é mais compatível com o novo sistema de dados.");
            }
        } catch (err) {
            alert("Erro ao abrir o projeto. O arquivo pode estar corrompido.");
            console.error(err);
        }
    };
    reader.readAsText(file);
    e.target.value = ''; 
});

// --- GERADOR DE SVG LIMPO (CORREÇÃO DE CÂMERA, ESCALA E TRANSPARÊNCIA) ---
function getCleanSVG(canvasW, canvasH) {
    const svgClone = document.getElementById('canvas').cloneNode(true);
    
    // Remove o Transform (Pan e Zoom) da Câmera
    svgClone.removeAttribute('style');
    
    // A MÁGICA: Limpa a sujeira de UI e remove o FUNDO ESCURO do Workspace!
    const grid = svgClone.querySelector('#bg-grid'); if (grid) grid.remove();
    const guide = svgClone.querySelector('#axis-guide'); if (guide) guide.remove();
    const bgCanvas = svgClone.querySelector('#bg-canvas'); if (bgCanvas) bgCanvas.remove(); 
    
    svgClone.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    
    // Trava as proporções exatas no viewBox
    if (canvasW && canvasH) {
        svgClone.setAttribute('width', canvasW);
        svgClone.setAttribute('height', canvasH);
        svgClone.setAttribute('viewBox', `0 0 ${canvasW} ${canvasH}`); 
    }
    
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgClone);
    
    if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    
    return '<?xml version="1.0" standalone="no"?>\r\n' + source;
}

// --- EXPORT SVG ---
document.getElementById('btn-export-svg').addEventListener('click', async () => {
    const canvasW = parseInt(document.getElementById('canvas').getAttribute('width')) || 512;
    const canvasH = parseInt(document.getElementById('canvas').getAttribute('height')) || 512;
    
    const source = getCleanSVG(canvasW, canvasH);
    await saveFileWithDialog("export.svg", source, "image/svg+xml", ".svg", "SVG Vector Graphic");
});

// --- EXPORT PNG / JPG ---
function exportRaster(format) {
    const canvasW = parseInt(document.getElementById('canvas').getAttribute('width')) || 512;
    const canvasH = parseInt(document.getElementById('canvas').getAttribute('height')) || 512;

    const svgString = getCleanSVG(canvasW, canvasH);
    const img = new Image();
    
    const svgBlob = new Blob([svgString], {type: "image/svg+xml;charset=utf-8"});
    const url = URL.createObjectURL(svgBlob);

    img.onload = function() {
        const expCanvas = document.createElement("canvas");
        expCanvas.width = canvasW;
        expCanvas.height = canvasH;
        const ctx = expCanvas.getContext("2d");
        
        // JPG não tem transparência, então nós pintamos o fundo da cor do workspace manualmente
        if (format === 'jpeg') {
            ctx.fillStyle = document.getElementById('bg-canvas').getAttribute('fill') || '#1a1a1a';
            ctx.fillRect(0, 0, canvasW, canvasH);
        }
        
        // Desenha a imagem (O PNG manterá a transparência intocada)
        ctx.drawImage(img, 0, 0, canvasW, canvasH);
        URL.revokeObjectURL(url);
        
        expCanvas.toBlob(async (blob) => {
            const ext = format === 'jpeg' ? '.jpg' : '.png';
            const mime = `image/${format}`;
            const desc = format === 'jpeg' ? "JPG Image" : "PNG Image";
            
            await saveFileWithDialog(`export${ext}`, blob, mime, ext, desc);
            
        }, `image/${format}`, format === 'jpeg' ? 0.95 : 1.0);
    };
    img.src = url;
}

document.getElementById('btn-export-png').addEventListener('click', () => exportRaster('png'));
document.getElementById('btn-export-jpg').addEventListener('click', () => exportRaster('jpeg'));