function triggerDownload(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function getSvgString() {
    const svgClone = document.getElementById('canvas').cloneNode(true);
    svgClone.getElementById('bg-grid').setAttribute('fill', 'transparent');
    
    const selected = svgClone.querySelector('.selected');
    if (selected) {
        selected.classList.remove('selected');
    }
    
    return new XMLSerializer().serializeToString(svgClone);
}

function exportImage(type) {
    const svgStr = getSvgString();
    const img = new Image();
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 512;
        tempCanvas.height = 512;
        const ctx = tempCanvas.getContext('2d');
        
        if (type === 'image/jpeg') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 512, 512);
        }
        
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        
        if (type === 'ico') {
            const icoCanvas = document.createElement('canvas');
            icoCanvas.width = 256;
            icoCanvas.height = 256;
            icoCanvas.getContext('2d').drawImage(tempCanvas, 0, 0, 256, 256);
            triggerDownload(icoCanvas.toDataURL('image/png'), 'icon.ico');
        } else {
            const ext = type === 'image/jpeg' ? 'jpg' : 'png';
            triggerDownload(tempCanvas.toDataURL(type), `icon.${ext}`);
        }
    };
    img.src = url;
}

document.getElementById('btn-export-svg').addEventListener('click', () => {
    const svgBlob = new Blob([getSvgString()], { type: 'image/svg+xml;charset=utf-8' });
    triggerDownload(URL.createObjectURL(svgBlob), 'icon.svg');
});
document.getElementById('btn-export-png').addEventListener('click', () => exportImage('image/png'));
document.getElementById('btn-export-jpg').addEventListener('click', () => exportImage('image/jpeg'));
document.getElementById('btn-export-ico').addEventListener('click', () => exportImage('ico'));