const layerGizmos = document.getElementById('layer-gizmos');

function updateGizmos(selectedElement) {
    layerGizmos.innerHTML = '';
    if (!selectedElement) return;

    const bbox = selectedElement.getBBox();
    const transform = selectedElement.getAttribute('transform') || '';
    let tx = 0, ty = 0;
    
    const match = transform.match(/translate\(([^,]+)[,\s]+([^)]+)\)/);
    if (match) {
        tx = parseFloat(match[1]);
        ty = parseFloat(match[2]);
    }

    let rectX = bbox.x;
    let rectY = bbox.y;

    if (selectedElement.tagName === 'path') {
        rectX += tx;
        rectY += ty;
    }

    const box = document.createElementNS("http://www.w3.org/2000/svg", 'rect');
    box.setAttribute('x', rectX - 2);
    box.setAttribute('y', rectY - 2);
    box.setAttribute('width', bbox.width + 4);
    box.setAttribute('height', bbox.height + 4);
    box.setAttribute('fill', 'none');
    box.setAttribute('stroke', '#00aaff');
    box.setAttribute('stroke-width', '2');
    box.setAttribute('stroke-dasharray', '4');
    box.style.pointerEvents = 'none';
    
    layerGizmos.appendChild(box);
}

function clearGizmos() {
    layerGizmos.innerHTML = '';
}