"use strict";
// path-math.js - Motor Pathfinder Bruto (Fim do Transform Duplo - Manipulação de Vértices)

window.initPaperJS = function() {
    const hiddenCanvas = document.createElement('canvas');
    paper.setup(hiddenCanvas);
};

window.executeAdvancedBoolean = function(mode) {
    if (window.selectedElementsIds.length < 2) {
        alert("Selecione pelo menos 2 formas (Shift + Click) para aplicar o " + mode);
        return;
    }

    // Regra do Figma: A forma do fundo (menor Z-Index) é a base de cor e textura
    let sortedSelected = [...window.selectedElementsIds].sort((idA, idB) => {
        return window.LayerTree.findIndex(l => l.id === idA) - window.LayerTree.findIndex(l => l.id === idB);
    });

    const baseLayer = window.LayerTree.find(l => l.id === sortedSelected[0]);

    paper.project.clear(); // Limpa o simulador
    let paperItems = [];

    // --- 1. IMPORTAÇÃO LIMPA ---
    sortedSelected.forEach(id => {
        const layer = window.LayerTree.find(l => l.id === id);
        if (!layer || layer.type === 'image' || layer.type === 'group') return; 

        // Importa apenas o conteúdo SVG puro (As coordenadas estão em 0,0)
        const imported = paper.project.importSVG(layer.svgContent, { expandShapes: true });
        
        // Aplica a matriz de escala, rotação e transição diretamente na geometria
        let matrix = new paper.Matrix();
        matrix.translate(layer.tx, layer.ty);
        matrix.rotate(layer.rotate);
        matrix.scale(layer.scaleX, layer.scaleY);
        matrix.skew(layer.skewX, layer.skewY);

        imported.applyMatrix = true;
        if (imported.children) {
            imported.children.forEach(c => c.applyMatrix = true);
        }
        imported.transform(matrix);
        
        let pathsToMerge = [];
        
        function extractPaths(node) {
            if (node.clipMask) return;
            if (node instanceof paper.Path || node instanceof paper.CompoundPath) {
                node.applyMatrix = true; // Força a gravação
                pathsToMerge.push(node);
            } else if (node.children) {
                node.children.forEach(extractPaths);
            }
        }
        
        extractPaths(imported);

        // Se uma forma (ex: Letra O) tem várias partes, une elas antes
        if (pathsToMerge.length > 0) {
            let solidShape = pathsToMerge[0];
            for (let i = 1; i < pathsToMerge.length; i++) {
                let temp = solidShape.unite(pathsToMerge[i]);
                solidShape.remove();
                pathsToMerge[i].remove();
                solidShape = temp;
            }
            paperItems.push(solidShape);
        }
    });

    if (paperItems.length < 2) {
        alert("Não há vetores válidos o suficiente. Imagens e Pastas não suportam fusão matemática.");
        return;
    }

    // --- 2. O COMBATE BOOLEANO (PATHFINDER) ---
    let resultPath = paperItems[0];
    for (let i = 1; i < paperItems.length; i++) {
        let temp;
        if (mode === 'flatten' || mode === 'union') temp = resultPath.unite(paperItems[i]);
        else if (mode === 'subtract') temp = resultPath.subtract(paperItems[i]);
        else if (mode === 'intersect') temp = resultPath.intersect(paperItems[i]);
        else if (mode === 'exclude') temp = resultPath.exclude(paperItems[i]);
        
        if (temp) {
            resultPath.remove();
            resultPath = temp;
        }
    }

    if (!resultPath || resultPath.bounds.area === 0) {
        alert("A operação resultou em uma forma vazia ou invisível.");
        return;
    }

    // --- 3. A CURA DEFINITIVA DO PULO (VÉRTICE POR VÉRTICE) ---
    const cx = resultPath.bounds.center.x;
    const cy = resultPath.bounds.center.y;
    
    // Esta função entra na alma do vetor e altera os números manualmente
    function shiftPoints(node, dx, dy) {
        if (node instanceof paper.Path) {
            node.segments.forEach(seg => {
                seg.point.x += dx;
                seg.point.y += dy;
            });
        } else if (node.children) {
            node.children.forEach(c => shiftPoints(c, dx, dy));
        }
    }

    // Move os pontos fisicamente de volta para a origem (Zero)
    shiftPoints(resultPath, -cx, -cy);
    
    // O rawPathData gerado agora NUNCA MAIS terá números baseados na tela global!
    const rawPathData = resultPath.pathData;
    if (!rawPathData || rawPathData === "") return;

    const cleanSvgContent = `<path class="shape-element inner-shape" d="${rawPathData}" fill="${baseLayer.fill || '#d9d9d9'}"></path>`;

    let namePrefix = mode.charAt(0).toUpperCase() + mode.slice(1);
    if (mode === 'flatten') namePrefix = "Flattened";

    // --- 4. ATUALIZANDO O MOTOR DO EDITOR ---
    const newId = `id-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newLayer = {
        id: newId,
        name: window.getUniqueLayerName(namePrefix),
        type: 'shape',
        tx: cx, ty: cy, // O Canvas assume o controle posicional EXATO!
        scaleX: 1, scaleY: 1, rotate: 0, skewX: 0, skewY: 0, opacity: 1, // Matrix inteira limpa e pronta
        locked: false, hidden: false, collapsed: false,
        parentId: baseLayer.parentId || null,
        maskForId: null, boolMode: null,
        fill: baseLayer.fill, blur: baseLayer.blur || 0, filterId: baseLayer.filterId || null, color: null,
        svgContent: cleanSvgContent 
    };

    // Restaura as configurações de Imagem/Textura se existirem na base
    if (baseLayer.patternImg) {
        newLayer.patternImg = baseLayer.patternImg;
        newLayer.patternX = baseLayer.patternX; newLayer.patternY = baseLayer.patternY;
        newLayer.patternW = baseLayer.patternW; newLayer.patternH = baseLayer.patternH;
        newLayer.patternRotate = baseLayer.patternRotate; newLayer.patternOpacity = baseLayer.patternOpacity;
        newLayer.patternHidden = baseLayer.patternHidden;
        newLayer.patternFlipX = baseLayer.patternFlipX; newLayer.patternFlipY = baseLayer.patternFlipY;
        
        newLayer.patBri = baseLayer.patBri; newLayer.patCon = baseLayer.patCon;
        newLayer.patSat = baseLayer.patSat; newLayer.patHue = baseLayer.patHue;
        newLayer.patTemp = baseLayer.patTemp;
        
        if (window.updateLayerFill) window.updateLayerFill(newLayer);
    }

    // Apaga as vítimas
    sortedSelected.forEach(id => {
        const idx = window.LayerTree.findIndex(l => l.id === id);
        if(idx > -1) {
            let oldPat = document.getElementById(`pat-${id}`);
            if (oldPat) oldPat.remove();
            window.LayerTree.splice(idx, 1);
        }
    });

    // Injeta o Monstro
    window.LayerTree.push(newLayer);
    window.selectedElementsIds = [newId];

    window.Render();
    if (window.updatePropsPanel) window.updatePropsPanel();
    if (window.saveState) window.saveState();
};

window.initPaperJS();