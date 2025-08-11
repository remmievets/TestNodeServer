let activeSpace = null;
let offsetX = 0;
let offsetY = 0;
let wasDragged = false;

/*
const map = document.getElementById('board');
const container = document.getElementById('tokens');
*/

const map = document.getElementById('map');
const container = document.getElementById('markers');

map.addEventListener('click', on_space_click);
document.addEventListener('mousemove', on_handle_move);
document.addEventListener('mouseup', on_drag_ends);

function on_space_click(e) {
    if (activeSpace) return;
    if (wasDragged) {
        console.log('ignored container click');
        wasDragged = false;
        return;
    }
    console.log('container click');
    const { x, y } = getRelativeClickPosition(e);
    const space = on_create_space(x, y);
    container.appendChild(space);
}

function getRelativeClickPosition(e) {
    const rect = container.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
    };
}

function on_create_space(x, y) {
    console.log('create space');
    const space = document.createElement('div');
    space.classList.add('space');
    space.style.left = `${x}px`;
    space.style.top = `${y}px`;
    space.style.width = '58px';
    space.style.height = '58px';

    space.addEventListener('mousedown', on_drag_start);
    return space;
}

function on_handle_move(e) {
    if (!activeSpace) return;
    console.log('handle move');
    wasDragged = true;
    const { x, y } = getRelativeClickPosition(e);
    activeSpace.style.left = `${x - offsetX}px`;
    activeSpace.style.top = `${y - offsetY}px`;
}

function on_drag_start(e) {
    console.log('drag start');
    activeSpace = e.target;
    offsetX = e.offsetX;
    offsetY = e.offsetY;
    activeSpace.style.cursor = 'grabbing';
}

function on_drag_ends(e) {
    console.log('drag end');
    if (activeSpace) {
        activeSpace.style.cursor = 'grab';
        activeSpace = null;
    }
}

