const shapesDock = document.getElementById('shapes-dock');
let shapeCounter = 0;

fetch('shapes.json')
    .then(r => r.json())
    .then(list => {
        list.forEach(file => {
            const btn = document.createElement('button');
            btn.className = 'shape-btn';
            btn.innerHTML = `<img src="shapes/${file}">`;
            btn.onclick = () => {
                const color = '#d9d9d9'; 
                const el = createShape(file, color, window.snap(256), window.snap(256));
                document.getElementById('layer-objects').appendChild(el);
                window.selectElement(el);
            };
            shapesDock.appendChild(btn);
        });
    })
    .catch(err => console.error("Run update_shapes.bat to map the shapes folder!", err));

function createShape(file, color, x, y) {
    shapeCounter++;
    const id = `shape-${shapeCounter}`;
    const g = document.createElementNS("http://www.w3.org/2000/svg", 'g');
    g.id = id; 
    g.setAttribute('class', 'draggable'); 
    g.dataset.tx = x; g.dataset.ty = y; g.dataset.scaleX = 1; g.dataset.scaleY = 1; g.dataset.rotate = 0;
    window.updateTransform(g);
    
    fetch(`shapes/${file}`).then(r => r.text()).then(svg => {
        const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const node = doc.documentElement;
        node.setAttribute('class', 'shape-element inner-shape');
        node.setAttribute('fill', color);
        node.setAttribute('width', 64); node.setAttribute('height', 64);
        node.setAttribute('x', -32); node.setAttribute('y', -32);
        node.querySelectorAll('*').forEach(c => {
            c.setAttribute('vector-effect', 'non-scaling-stroke');
            if(c.getAttribute('fill') && c.getAttribute('fill') !== 'none') c.removeAttribute('fill');
        });
        g.appendChild(node);
    });
    window.addLayerToUI(id, file.replace('.svg', '').replace(/_/g, ' '));
    return g;
}

window.createGroup = (x, y) => {
    shapeCounter++;
    const id = `shape-${shapeCounter}`;
    const g = document.createElementNS("http://www.w3.org/2000/svg", 'g');
    g.id = id; 
    g.setAttribute('class', 'draggable'); 
    g.dataset.tx = x; g.dataset.ty = y; g.dataset.scaleX = 1; g.dataset.scaleY = 1; g.dataset.rotate = 0;
    window.updateTransform(g);
    window.addLayerToUI(id, '📁 Group');
    return g;
}