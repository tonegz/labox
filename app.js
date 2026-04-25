const state = {
  matrix: [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ],
};

const matrixContainer = document.getElementById('matrix-container');
const matrixWrapper = document.getElementById('matrix-wrapper');
const resizeOverlay = document.getElementById('resize-overlay');
const resizeDimensions = document.getElementById('resize-dimensions');
const resizeConfirmBackdrop = document.getElementById('resize-confirm-backdrop');
const resizeConfirmModal = document.getElementById('resize-confirm-modal');
const resizeConfirmDims = document.getElementById('resize-confirm-dims');
const resizeConfirmRemove = document.getElementById('resize-confirm-remove');
const resizeConfirmCancel = document.getElementById('resize-confirm-cancel');
const matrixResizeHandle = document.getElementById('matrix-resize-handle');
const matrixSizeLabel = document.getElementById('matrix-size');
const matrixJson = document.getElementById('matrix-json');

const addRowButton = document.getElementById('add-row');
const removeRowButton = document.getElementById('remove-row');
const addColButton = document.getElementById('add-col');
const removeColButton = document.getElementById('remove-col');

const swapRowA = document.getElementById('swap-row-a');
const swapRowB = document.getElementById('swap-row-b');
const swapRowsButton = document.getElementById('swap-rows');

const scaleRowSelect = document.getElementById('scale-row');
const scaleFactorInput = document.getElementById('scale-factor');
const scaleRowButton = document.getElementById('scale-row-btn');

const targetRowSelect = document.getElementById('target-row');
const sourceRowSelect = document.getElementById('source-row');
const addRowButtonTransform = document.getElementById('add-row-btn');
const addFactorInput = document.getElementById('add-factor');

const rowActionModal = document.getElementById('row-action-modal');
const modalSourceRow = document.getElementById('modal-source-row');
const modalTargetRow = document.getElementById('modal-target-row');
const modalCustomFactor = document.getElementById('modal-custom-factor');
const modalAddMultiplierButton = document.getElementById('modal-add-multiplier');
const modalSwapRowsButton = document.getElementById('modal-swap-rows');
const modalCancelActionButton = document.getElementById('modal-cancel-action');
const rowMultiplierButtons = document.querySelectorAll('[data-multiplier]');

let dragSourceRow = null;
let isResizing = false;
let resizeStartX = 0;
let resizeStartY = 0;
let resizeStartRows = 0;
let resizeStartCols = 0;
let currentResizeRows = 0;
let currentResizeCols = 0;
let pendingResize = null;

function renderMatrix() {
  const rows = state.matrix.length;
  const cols = state.matrix[0]?.length ?? 0;

  matrixContainer.innerHTML = '';

  state.matrix.forEach((row, rowIndex) => {
    const rowWrapper = document.createElement('div');
    rowWrapper.className = 'matrix-row';
    rowWrapper.style.gridTemplateColumns = `auto repeat(${cols}, minmax(72px, 1fr))`;
    rowWrapper.dataset.row = rowIndex;

    const rowHeader = document.createElement('div');
    rowHeader.className = 'matrix-cell row-header';
    rowHeader.textContent = `Row ${rowIndex + 1}`;
    rowHeader.draggable = true;
    rowHeader.dataset.row = rowIndex;
    rowHeader.setAttribute('aria-label', `Drag row ${rowIndex + 1}`);
    rowHeader.addEventListener('dragstart', onRowDragStart);
    rowHeader.addEventListener('dragover', onRowDragOver);
    rowHeader.addEventListener('drop', onRowDrop);
    rowHeader.addEventListener('dragenter', onRowDragEnter);
    rowHeader.addEventListener('dragleave', onRowDragLeave);
    rowWrapper.appendChild(rowHeader);

    row.forEach((value, colIndex) => {
      const cell = document.createElement('div');
      cell.className = 'matrix-cell';

      const input = document.createElement('input');
      input.type = 'number';
      input.step = 'any';
      input.value = value;
      input.dataset.row = rowIndex;
      input.dataset.col = colIndex;

      input.addEventListener('input', onCellChange);
      cell.appendChild(input);
      rowWrapper.appendChild(cell);
    });

    matrixContainer.appendChild(rowWrapper);
  });

  matrixSizeLabel.textContent = `Matrix size: ${rows} × ${cols}`;
  matrixJson.textContent = JSON.stringify(state.matrix, null, 2);

  const rowOptions = Array.from({ length: rows }, (_, index) => {
    return `<option value="${index}">Row ${index + 1}</option>`;
  }).join('');

  swapRowA.innerHTML = rowOptions;
  swapRowB.innerHTML = rowOptions;
  scaleRowSelect.innerHTML = rowOptions;
  targetRowSelect.innerHTML = rowOptions;
  sourceRowSelect.innerHTML = rowOptions;

  if (rows > 1) {
    swapRowA.value = '0';
    swapRowB.value = '1';
  } else {
    swapRowA.value = '0';
    swapRowB.value = '0';
  }

  updateButtons();
  updateResizeHandle();
}

function updateResizeHandle() {
  const matrixRect = matrixContainer.getBoundingClientRect();
  matrixWrapper.style.width = `${matrixRect.width}px`;
}

function getResizeMetrics() {
  const firstRow = matrixContainer.querySelector('.matrix-row');
  const headerCell = firstRow?.querySelector('.row-header');
  const firstDataCell = firstRow?.querySelector('.matrix-cell:nth-child(2)');

  return {
    rowHeight: firstRow?.getBoundingClientRect().height || 0,
    colWidth: firstDataCell?.getBoundingClientRect().width || 0,
    headerWidth: headerCell?.getBoundingClientRect().width || 0,
  };
}

function updateResizeOverlay(newRows, newCols) {
  const { rowHeight, colWidth, headerWidth } = getResizeMetrics();
  const width = headerWidth + newCols * colWidth;
  const height = newRows * rowHeight;

  resizeOverlay.style.width = `${width}px`;
  resizeOverlay.style.height = `${height}px`;
  resizeDimensions.textContent = `${newRows}×${newCols}`;
  resizeOverlay.classList.remove('hidden');

  currentResizeRows = newRows;
  currentResizeCols = newCols;
}

function onResizeStart(event) {
  event.preventDefault();
  isResizing = true;
  matrixResizeHandle.setPointerCapture(event.pointerId);
  resizeStartX = event.clientX;
  resizeStartY = event.clientY;
  resizeStartRows = state.matrix.length;
  resizeStartCols = state.matrix[0]?.length ?? 0;
  updateResizeHandle();
  updateResizeOverlay(resizeStartRows, resizeStartCols);
}

function onResizeMove(event) {
  if (!isResizing) return;

  const { rowHeight, colWidth } = getResizeMetrics();
  if (!rowHeight || !colWidth) return;

  const deltaX = event.clientX - resizeStartX;
  const deltaY = event.clientY - resizeStartY;
  const rowDelta = Math.round(deltaY / rowHeight);
  const colDelta = Math.round(deltaX / colWidth);

  const newRows = Math.max(1, resizeStartRows + rowDelta);
  const newCols = Math.max(1, resizeStartCols + colDelta);
  updateResizeOverlay(newRows, newCols);
}

function onResizeEnd(event) {
  if (!isResizing) return;
  isResizing = false;
  matrixResizeHandle.releasePointerCapture(event.pointerId);
  resizeOverlay.classList.add('hidden');

  const newRows = currentResizeRows;
  const newCols = currentResizeCols;
  const oldRows = state.matrix.length;
  const oldCols = state.matrix[0]?.length ?? 0;

  if (newRows === oldRows && newCols === oldCols) return;

  if ((newRows < oldRows || newCols < oldCols) && hasNonZeroRemovedCells(newRows, newCols)) {
    pendingResize = { rows: newRows, cols: newCols };
    showResizeConfirm(newRows, newCols);
    return;
  }

  resizeMatrix(newRows, newCols);
}

function showResizeConfirm(rows, cols) {
  resizeConfirmDims.textContent = `${rows}×${cols}`;
  resizeConfirmBackdrop.classList.remove('hidden');
}

function hideResizeConfirm() {
  resizeConfirmBackdrop.classList.add('hidden');
  pendingResize = null;
}

function applyPendingResize() {
  if (!pendingResize) return;
  resizeMatrix(pendingResize.rows, pendingResize.cols);
  pendingResize = null;
}

function resizeMatrix(rows, cols) {
  const currentRows = state.matrix.length;
  const currentCols = state.matrix[0]?.length ?? 0;

  state.matrix.forEach((row) => {
    if (cols > currentCols) {
      row.push(...Array.from({ length: cols - currentCols }, () => 0));
    } else if (cols < currentCols) {
      row.splice(cols);
    }
  });

  if (rows > currentRows) {
    for (let i = currentRows; i < rows; i += 1) {
      state.matrix.push(Array.from({ length: cols }, () => 0));
    }
  } else if (rows < currentRows) {
    state.matrix.splice(rows);
  }

  renderMatrix();
}

function hasNonZeroRemovedCells(rows, cols) {
  const currentRows = state.matrix.length;
  const currentCols = state.matrix[0]?.length ?? 0;

  for (let r = rows; r < currentRows; r += 1) {
    if (state.matrix[r].some((value) => value !== 0)) {
      return true;
    }
  }

  for (let r = 0; r < Math.min(rows, currentRows); r += 1) {
    for (let c = cols; c < currentCols; c += 1) {
      if (state.matrix[r][c] !== 0) {
        return true;
      }
    }
  }

  return false;
}

function onCellChange(event) {
  const input = event.target;
  const rowIndex = Number(input.dataset.row);
  const colIndex = Number(input.dataset.col);
  const numericValue = Number(input.value);

  if (!Number.isNaN(numericValue)) {
    state.matrix[rowIndex][colIndex] = numericValue;
  } else {
    state.matrix[rowIndex][colIndex] = 0;
  }

  matrixJson.textContent = JSON.stringify(state.matrix, null, 2);
}

function addRow() {
  const cols = state.matrix[0].length;
  const newRow = Array.from({ length: cols }, () => 0);
  state.matrix.push(newRow);
  renderMatrix();
}

function removeRow() {
  if (state.matrix.length <= 1) return;
  state.matrix.pop();
  renderMatrix();
}

function addColumn() {
  state.matrix.forEach((row) => row.push(0));
  renderMatrix();
}

function removeColumn() {
  const cols = state.matrix[0].length;
  if (cols <= 1) return;
  state.matrix.forEach((row) => row.pop());
  renderMatrix();
}

function swapRows() {
  const a = Number(swapRowA.value);
  const b = Number(swapRowB.value);
  if (a === b) return;
  swapRowsByIndex(a, b);
}

function ensureDistinctSwapSelection(changedSelect, otherSelect, otherOnRight = true) {
  if (state.matrix.length <= 1) return;
  if (changedSelect.value === otherSelect.value) {
    const currentIndex = Number(otherSelect.value);
    const rows = state.matrix.length;
    const nextIndex = otherOnRight
      ? (currentIndex + 1) % rows
      : (currentIndex - 1 + rows) % rows;
    otherSelect.value = String(nextIndex);
    flashSelect(otherSelect);
  }
}

function flashSelect(selectElement) {
  selectElement.classList.add('flash');
  window.setTimeout(() => {
    selectElement.classList.remove('flash');
  }, 500);
}

function scaleRow() {
  const rowIndex = Number(scaleRowSelect.value);
  const factor = Number(scaleFactorInput.value);
  if (Number.isNaN(factor)) return;

  state.matrix[rowIndex] = state.matrix[rowIndex].map((value) => value * factor);
  renderMatrix();
}

function addScaledRow() {
  const target = Number(targetRowSelect.value);
  const source = Number(sourceRowSelect.value);
  const factor = Number(addFactorInput.value);
  addScaledRowWithFactor(target, source, factor);
}

function addScaledRowWithFactor(target, source, factor) {
  if (Number.isNaN(factor) || target === source) return;

  state.matrix[target] = state.matrix[target].map((value, index) => {
    return value + state.matrix[source][index] * factor;
  });

  renderMatrix();
}

function swapRowsByIndex(a, b) {
  if (a === b) return;

  const rowWrappers = Array.from(matrixContainer.querySelectorAll('.matrix-row'));
  const rowA = rowWrappers[a];
  const rowB = rowWrappers[b];
  if (!rowA || !rowB) {
    [state.matrix[a], state.matrix[b]] = [state.matrix[b], state.matrix[a]];
    renderMatrix();
    return;
  }

  const firstRectA = rowA.getBoundingClientRect();
  const firstRectB = rowB.getBoundingClientRect();

  [state.matrix[a], state.matrix[b]] = [state.matrix[b], state.matrix[a]];

  const nextA = rowA.nextSibling;
  const nextB = rowB.nextSibling;

  if (nextA === rowB) {
    matrixContainer.insertBefore(rowB, rowA);
  } else if (nextB === rowA) {
    matrixContainer.insertBefore(rowA, rowB);
  } else {
    matrixContainer.insertBefore(rowB, nextA);
    matrixContainer.insertBefore(rowA, nextB);
  }

  updateButtons();

  const lastRectA = rowA.getBoundingClientRect();
  const lastRectB = rowB.getBoundingClientRect();

  const deltaA = {
    x: firstRectA.left - lastRectA.left,
    y: firstRectA.top - lastRectA.top,
  };
  const deltaB = {
    x: firstRectB.left - lastRectB.left,
    y: firstRectB.top - lastRectB.top,
  };

  rowA.style.transition = 'none';
  rowB.style.transition = 'none';
  rowA.style.transform = `translate(${deltaA.x}px, ${deltaA.y}px)`;
  rowB.style.transform = `translate(${deltaB.x}px, ${deltaB.y}px)`;

  requestAnimationFrame(() => {
    rowA.style.transition = 'transform 300ms ease';
    rowB.style.transition = 'transform 300ms ease';
    rowA.style.transform = '';
    rowB.style.transform = '';
  });

  function cleanup() {
    rowA.style.transition = '';
    rowA.style.transform = '';
    rowB.style.transition = '';
    rowB.style.transform = '';
    updateRowIndices();
    flashRowHeaders(rowA, rowB);
    rowA.removeEventListener('transitionend', cleanup);
    rowB.removeEventListener('transitionend', cleanup);
  }

  rowA.addEventListener('transitionend', cleanup);
  rowB.addEventListener('transitionend', cleanup);
}

function flashRowHeaders(...wrappers) {
  wrappers.forEach((wrapper) => {
    const header = wrapper.querySelector('.row-header');
    if (!header) return;
    header.classList.add('flash');
    window.setTimeout(() => {
      header.classList.remove('flash');
    }, 500);
  });
}

function updateRowIndices() {
  const rowWrappers = Array.from(matrixContainer.querySelectorAll('.matrix-row'));
  rowWrappers.forEach((wrapper, rowIndex) => {
    const header = wrapper.querySelector('.row-header');
    if (header) {
      header.textContent = `Row ${rowIndex + 1}`;
      header.dataset.row = rowIndex;
    }
    wrapper.querySelectorAll('input[type="number"]').forEach((input) => {
      input.dataset.row = rowIndex;
    });
  });
}

function onRowDragStart(event) {
  const rowIndex = Number(event.currentTarget.dataset.row);
  dragSourceRow = rowIndex;
  event.dataTransfer.setData('text/plain', String(rowIndex));
  event.dataTransfer.effectAllowed = 'move';
}

function onRowDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
}

function onRowDragEnter(event) {
  event.currentTarget.classList.add('drag-over');
}

function onRowDragLeave(event) {
  event.currentTarget.classList.remove('drag-over');
}

function onRowDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  const rowIndex = Number(event.currentTarget.dataset.row);
  const sourceIndex = dragSourceRow !== null ? dragSourceRow : Number(event.dataTransfer.getData('text/plain'));
  dragSourceRow = null;
  if (Number.isNaN(sourceIndex) || sourceIndex === rowIndex) return;
  openRowActionModal(sourceIndex, rowIndex);
}

function openRowActionModal(source, target) {
  modalSourceRow.textContent = String(source + 1);
  modalTargetRow.textContent = String(target + 1);
  modalSourceRow.dataset.source = source;
  modalTargetRow.dataset.target = target;
  modalCustomFactor.value = '1';
  rowActionModal.classList.remove('hidden');
}

function closeRowActionModal() {
  rowActionModal.classList.add('hidden');
}

function applyRowAction(action, factor) {
  const source = Number(modalSourceRow.dataset.source);
  const target = Number(modalTargetRow.dataset.target);
  if (action === 'add') {
    addScaledRowWithFactor(target, source, factor);
  } else if (action === 'swap') {
    swapRowsByIndex(source, target);
  }
  closeRowActionModal();
}

rowMultiplierButtons.forEach((button) => {
  button.addEventListener('click', () => {
    applyRowAction('add', Number(button.dataset.multiplier));
  });
});

modalAddMultiplierButton.addEventListener('click', () => {
  applyRowAction('add', Number(modalCustomFactor.value));
});

modalSwapRowsButton.addEventListener('click', () => {
  applyRowAction('swap');
});

modalCancelActionButton.addEventListener('click', closeRowActionModal);

rowActionModal.addEventListener('click', (event) => {
  if (event.target === rowActionModal) {
    closeRowActionModal();
  }
});

resizeConfirmRemove.addEventListener('click', () => {
  applyPendingResize();
  hideResizeConfirm();
});

resizeConfirmCancel.addEventListener('click', () => {
  hideResizeConfirm();
});

resizeConfirmBackdrop.addEventListener('click', (event) => {
  if (event.target === resizeConfirmBackdrop) {
    hideResizeConfirm();
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;

  if (!rowActionModal.classList.contains('hidden')) {
    closeRowActionModal();
  } else if (!resizeConfirmBackdrop.classList.contains('hidden')) {
    hideResizeConfirm();
  }
});

matrixResizeHandle.addEventListener('pointerdown', onResizeStart);
window.addEventListener('pointermove', onResizeMove);
window.addEventListener('pointerup', onResizeEnd);
window.addEventListener('pointercancel', onResizeEnd);

function updateButtons() {
  removeRowButton.disabled = state.matrix.length <= 1;
  removeColButton.disabled = state.matrix[0].length <= 1;

  const sameRowSelected = swapRowA.value === swapRowB.value;
  swapRowsButton.disabled = sameRowSelected || state.matrix.length <= 1;
}

swapRowA.addEventListener('change', () => {
  ensureDistinctSwapSelection(swapRowA, swapRowB, true);
  updateButtons();
});

swapRowB.addEventListener('change', () => {
  ensureDistinctSwapSelection(swapRowB, swapRowA, false);
  updateButtons();
});

addRowButton.addEventListener('click', addRow);
removeRowButton.addEventListener('click', removeRow);
addColButton.addEventListener('click', addColumn);
removeColButton.addEventListener('click', removeColumn);
swapRowsButton.addEventListener('click', swapRows);
scaleRowButton.addEventListener('click', scaleRow);
addRowButtonTransform.addEventListener('click', addScaledRow);

renderMatrix();
