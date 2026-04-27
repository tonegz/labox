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
const dragTip = document.getElementById('drag-tip');

let dragSourceRow = null;
let currentDragTarget = null;
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
    rowWrapper.style.gridTemplateColumns = `auto auto repeat(${cols}, minmax(72px, 1fr))`;
    rowWrapper.dataset.row = rowIndex;
    rowWrapper.addEventListener('dragover', onRowDragOver);
    rowWrapper.addEventListener('dragenter', onRowDragEnter);
    rowWrapper.addEventListener('dragleave', onRowDragLeave);

    const rowDragHandle = document.createElement('div');
    rowDragHandle.className = 'matrix-cell row-drag-handle';
    rowDragHandle.draggable = true;
    rowDragHandle.dataset.row = rowIndex;
    rowDragHandle.setAttribute('aria-label', `Drag row ${rowIndex + 1}`);
    rowDragHandle.addEventListener('dragstart', onRowDragStart);
    rowDragHandle.addEventListener('dragover', onRowDragOver);
    rowDragHandle.addEventListener('drop', onRowDrop);
    rowDragHandle.addEventListener('dragenter', onRowDragEnter);
    rowDragHandle.addEventListener('dragleave', onRowDragLeave);
    rowWrapper.appendChild(rowDragHandle);

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
      cell.dataset.row = rowIndex;
      cell.dataset.col = colIndex;
      cell.addEventListener('dragenter', onCellDragEnter);
      cell.addEventListener('dragleave', onCellDragLeave);
      cell.addEventListener('dragover', onRowDragOver);
      cell.addEventListener('drop', onRowDrop);

      const input = document.createElement('input');
      input.type = 'number';
      input.step = 'any';
      input.placeholder = '0';
      input.value = value;
      input.dataset.row = rowIndex;
      input.dataset.col = colIndex;

      input.addEventListener('input', onCellChange);
      input.addEventListener('focus', onCellFocus);
      input.addEventListener('blur', onCellBlur);
      input.addEventListener('wheel', onNumberInputWheel, { passive: false });
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
  const dragHandle = firstRow?.querySelector('.row-drag-handle');
  const headerCell = firstRow?.querySelector('.row-header');
  const firstDataCell = firstRow?.querySelector('.matrix-cell:nth-child(3)');

  return {
    rowHeight: firstRow?.getBoundingClientRect().height || 0,
    colWidth: firstDataCell?.getBoundingClientRect().width || 0,
    dragHandleWidth: dragHandle?.getBoundingClientRect().width || 0,
    headerWidth: headerCell?.getBoundingClientRect().width || 0,
  };
}

function updateResizeOverlay(newRows, newCols) {
  const { rowHeight, colWidth } = getResizeMetrics();
  const firstRow = matrixContainer.querySelector('.matrix-row');
  const firstDataCell = firstRow?.querySelector('.matrix-cell:nth-child(3)');
  const wrapperRect = matrixWrapper.getBoundingClientRect();
  const cellRect = firstDataCell?.getBoundingClientRect();

  const overlayLeft = cellRect ? cellRect.left - wrapperRect.left : 0;
  const overlayTop = cellRect ? cellRect.top - wrapperRect.top : 0;
  const width = newCols * colWidth;
  const height = newRows * rowHeight;

  resizeOverlay.style.left = `${overlayLeft}px`;
  resizeOverlay.style.top = `${overlayTop}px`;
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
  modalReturnFocusTo = document.activeElement;
  resizeConfirmBackdrop.classList.remove('hidden');
  resizeConfirmCancel.focus();
}

function hideResizeConfirm() {
  resizeConfirmBackdrop.classList.add('hidden');
  pendingResize = null;
  restoreFocusFromModal();
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

function onNumberInputWheel(event) {
  if (document.activeElement !== event.currentTarget) return;
  event.preventDefault();
  event.currentTarget.blur();
}

function onCellFocus(event) {
  event.target.select();
}

function onCellBlur(event) {
  const input = event.target;
  const rowIndex = Number(input.dataset.row);
  const colIndex = Number(input.dataset.col);
  if (input.value === '') {
    state.matrix[rowIndex][colIndex] = 0;
    input.value = '0';
    matrixJson.textContent = JSON.stringify(state.matrix, null, 2);
  }
}

function onCellChange(event) {
  const input = event.target;
  const rowIndex = Number(input.dataset.row);
  const colIndex = Number(input.dataset.col);

  if (input.value === '') {
    state.matrix[rowIndex][colIndex] = 0;
    matrixJson.textContent = JSON.stringify(state.matrix, null, 2);
    return;
  }

  const numericValue = Number(input.value);
  if (!Number.isFinite(numericValue)) return;

  state.matrix[rowIndex][colIndex] = numericValue;
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
    const dragHandle = wrapper.querySelector('.row-drag-handle');
    if (dragHandle) {
      dragHandle.dataset.row = rowIndex;
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

  const rowWrapper = event.currentTarget.closest('.matrix-row');
  if (!rowWrapper) return;

  const dragImage = rowWrapper.cloneNode(true);
  dragImage.style.position = 'absolute';
  dragImage.style.top = '-9999px';
  dragImage.style.left = '-9999px';
  dragImage.style.margin = '0';
  dragImage.style.opacity = '0.95';
  dragImage.style.pointerEvents = 'none';
  dragImage.style.zIndex = '9999';

  const sourceCells = Array.from(rowWrapper.querySelectorAll('.matrix-cell'));
  const cloneCells = Array.from(dragImage.querySelectorAll('.matrix-cell'));
  sourceCells.forEach((sourceCell, index) => {
    const cloneCell = cloneCells[index];
    if (!cloneCell) return;
    const rect = sourceCell.getBoundingClientRect();
    cloneCell.style.width = `${rect.width}px`;
    cloneCell.style.minWidth = `${rect.width}px`;
    cloneCell.style.maxWidth = `${rect.width}px`;
    cloneCell.style.height = `${rect.height}px`;
    cloneCell.style.boxSizing = 'border-box';
  });

  const inputs = dragImage.querySelectorAll('input');
  const sourceInputs = rowWrapper.querySelectorAll('input');
  inputs.forEach((input, index) => {
    input.value = sourceInputs[index]?.value ?? input.value;
  });

  document.body.appendChild(dragImage);
  const rowRect = rowWrapper.getBoundingClientRect();
  dragImage.style.width = `${rowRect.width}px`;
  dragImage.style.height = `${rowRect.height}px`;

  const anchorX = event.clientX - rowRect.left;
  const anchorY = event.clientY - rowRect.top;
  event.dataTransfer.setDragImage(dragImage, anchorX, anchorY);

  window.setTimeout(() => {
    if (dragImage.parentNode) {
      dragImage.parentNode.removeChild(dragImage);
    }
  }, 0);
}

function onRowDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  updateDragHover(event);
}

function updateDragHover(event) {
  if (dragSourceRow === null) return;

  const cell = event.target.closest('.matrix-cell');
  const rowWrapper = event.target.closest('.matrix-row');
  if (!rowWrapper) {
    clearDragTargetState();
    return;
  }

  const targetRow = Number(rowWrapper.dataset.row);
  if (targetRow === dragSourceRow) {
    clearDragTargetState();
    return;
  }

  if (cell && (cell.classList.contains('row-header') || cell.classList.contains('row-drag-handle'))) {
    setRowSwapTarget(rowWrapper, cell.classList.contains('row-drag-handle'), event);
    return;
  }

  if (cell && typeof cell.dataset.col !== 'undefined') {
    setCellDragTarget(cell, targetRow, Number(cell.dataset.col), event);
    return;
  }

  clearDragTargetState();
}

function setCellDragTarget(cell, targetRow, targetCol, event) {
  if (dragSourceRow === null) return;
  if (currentDragTarget?.type === 'cell'
      && currentDragTarget.row === targetRow
      && currentDragTarget.col === targetCol) {
    updateDragTipPosition(event);
    return;
  }

  clearDragTargetState();

  const sourceValue = Number(state.matrix[dragSourceRow][targetCol]);
  const targetValue = Number(state.matrix[targetRow][targetCol]);
  const isValidMultiple = sourceValue !== 0
    && targetValue !== 0
    && Number.isFinite(sourceValue)
    && Number.isFinite(targetValue)
    && Number.isInteger(targetValue / sourceValue);

  let tipText = '?';
  let factor = null;
  if (isValidMultiple) {
    const ratio = targetValue / sourceValue;
    factor = -ratio;
    tipText = `${factor >= 0 ? '+' : ''}${factor}`;
  }

  currentDragTarget = {
    type: 'cell',
    row: targetRow,
    col: targetCol,
    valid: isValidMultiple,
    factor,
    cell,
  };

  cell.classList.add('drag-over');
  showDragTip(event, tipText);
}

function onCellDragEnter(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  updateDragHover(event);
}

function onCellDragLeave(event) {
  const currentRow = event.currentTarget.closest('.matrix-row');
  if (currentRow && currentRow.contains(event.relatedTarget)) return;
  event.currentTarget.classList.remove('drag-over');
  clearDragTargetState();
}

function updateDragTipPosition(event) {
  if (!dragTip) return;
  const rect = matrixWrapper.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  dragTip.style.left = `${x}px`;
  dragTip.style.top = `${y - 12}px`;
}

function showDragTip(event, text) {
  if (!dragTip) return;
  dragTip.textContent = text;
  dragTip.classList.remove('hidden');
  updateDragTipPosition(event);
}

function hideDragTip() {
  if (!dragTip) return;
  dragTip.classList.add('hidden');
  dragTip.classList.remove('swap-active');
}

function setRowSwapTarget(rowWrapper, isSwapArea = false, event = null) {
  const rowIndex = Number(rowWrapper.dataset.row);
  if (dragSourceRow === null || rowIndex === dragSourceRow) return;
  if (currentDragTarget?.type === 'row' && currentDragTarget.row === rowIndex && currentDragTarget.swapArea === isSwapArea) return;

  clearDragTargetState();
  rowWrapper.classList.add('swap-target');
  const handle = rowWrapper.querySelector('.row-drag-handle');
  if (handle) {
    handle.classList.add('swap-target');
  }

  currentDragTarget = { type: 'row', row: rowIndex, rowWrapper, swapArea: isSwapArea };
  const tipText = isSwapArea ? '↕ swap now' : '↕ swap';
  if (isSwapArea) {
    dragTip?.classList.add('swap-active');
  } else {
    dragTip?.classList.remove('swap-active');
  }
  const tipEvent = event || { clientX: rowWrapper.getBoundingClientRect().left + 20, clientY: rowWrapper.getBoundingClientRect().top + 20 };
  showDragTip(tipEvent, tipText);
}

function clearRowSwapTarget(rowWrapper) {
  rowWrapper.classList.remove('swap-target');
  const handle = rowWrapper.querySelector('.row-drag-handle');
  if (handle) {
    handle.classList.remove('swap-target');
  }
}

function clearDragTargetState() {
  if (currentDragTarget?.type === 'cell' && currentDragTarget.cell) {
    currentDragTarget.cell.classList.remove('drag-over');
  }
  currentDragTarget = null;
  hideDragTip();
  matrixContainer.querySelectorAll('.matrix-row.swap-target').forEach(clearRowSwapTarget);
}

function onRowDragEnter(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  updateDragHover(event);
}

function onRowDragLeave(event) {
  const rowWrapper = event.currentTarget.closest('.matrix-row');
  if (!rowWrapper) return;
  if (rowWrapper.contains(event.relatedTarget)) return;
  rowWrapper.classList.remove('drag-over');
  clearDragTargetState();
}

function onRowDrop(event) {
  event.preventDefault();
  const targetRow = Number(event.currentTarget.dataset.row);
  const sourceIndex = dragSourceRow !== null ? dragSourceRow : Number(event.dataTransfer.getData('text/plain'));
  dragSourceRow = null;

  if (Number.isNaN(sourceIndex) || sourceIndex === targetRow) {
    clearDragTargetState();
    return;
  }

  if (event.currentTarget.classList.contains('row-drag-handle')) {
    swapRowsByIndex(sourceIndex, targetRow);
    clearDragTargetState();
    return;
  }

  if (event.currentTarget.classList.contains('row-header')) {
    openRowActionModal(sourceIndex, targetRow);
    clearDragTargetState();
    return;
  }

  const targetColAttr = event.currentTarget.dataset.col;
  if (typeof targetColAttr !== 'undefined') {
    const targetCol = Number(targetColAttr);
    const sourceValue = Number(state.matrix[sourceIndex][targetCol]);
    const targetValue = Number(state.matrix[targetRow][targetCol]);
    const isValidMultiple = sourceValue !== 0 && targetValue !== 0 && Number.isFinite(sourceValue) && Number.isFinite(targetValue) && Number.isInteger(targetValue / sourceValue);

    if (isValidMultiple) {
      const factor = -(targetValue / sourceValue);
      addScaledRowWithFactor(targetRow, sourceIndex, factor);
      clearDragTargetState();
      return;
    }

    openRowActionModal(sourceIndex, targetRow);
    clearDragTargetState();
    return;
  }

  swapRowsByIndex(sourceIndex, targetRow);
  clearDragTargetState();
}

function openRowActionModal(source, target) {
  modalSourceRow.textContent = String(source + 1);
  modalTargetRow.textContent = String(target + 1);
  modalSourceRow.dataset.source = source;
  modalTargetRow.dataset.target = target;
  modalCustomFactor.value = '1';
  updateModalAddButton();
  modalReturnFocusTo = document.activeElement;
  rowActionModal.classList.remove('hidden');
  modalCancelActionButton.focus();
}

function updateModalAddButton() {
  const factor = Number(modalCustomFactor.value);
  modalAddMultiplierButton.disabled = modalCustomFactor.value === ''
    || !Number.isFinite(factor)
    || factor === 0;
}

function closeRowActionModal() {
  rowActionModal.classList.add('hidden');
  restoreFocusFromModal();
}

let modalReturnFocusTo = null;

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter((el) => !el.hasAttribute('hidden') && el.offsetParent !== null);
}

function focusFirstIn(container) {
  const focusable = getFocusable(container);
  if (focusable.length > 0) focusable[0].focus();
}

function getActiveModal() {
  if (!rowActionModal.classList.contains('hidden')) return rowActionModal;
  if (!resizeConfirmBackdrop.classList.contains('hidden')) return resizeConfirmBackdrop;
  return null;
}

function restoreFocusFromModal() {
  const target = modalReturnFocusTo;
  modalReturnFocusTo = null;
  if (target && typeof target.focus === 'function' && document.body.contains(target)) {
    target.focus();
  }
}

function trapTab(event) {
  if (event.key !== 'Tab') return;
  const modal = getActiveModal();
  if (!modal) return;
  const focusable = getFocusable(modal);
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
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

modalCustomFactor.addEventListener('input', updateModalAddButton);

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
  if (event.key === 'Tab') {
    trapTab(event);
    return;
  }
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
window.addEventListener('dragend', clearDragTargetState);

function updateButtons() {
  removeRowButton.disabled = state.matrix.length <= 1;
  removeColButton.disabled = state.matrix[0].length <= 1;

  const sameRowSelected = swapRowA.value === swapRowB.value;
  swapRowsButton.disabled = sameRowSelected || state.matrix.length <= 1;

  const scaleFactor = Number(scaleFactorInput.value);
  scaleRowButton.disabled = scaleFactorInput.value === ''
    || !Number.isFinite(scaleFactor)
    || scaleFactor === 0;

  const addFactor = Number(addFactorInput.value);
  const sameAddRow = targetRowSelect.value === sourceRowSelect.value;
  addRowButtonTransform.disabled = addFactorInput.value === ''
    || !Number.isFinite(addFactor)
    || addFactor === 0
    || sameAddRow
    || state.matrix.length <= 1;
}

swapRowA.addEventListener('change', () => {
  ensureDistinctSwapSelection(swapRowA, swapRowB, true);
  updateButtons();
});

swapRowB.addEventListener('change', () => {
  ensureDistinctSwapSelection(swapRowB, swapRowA, false);
  updateButtons();
});

scaleFactorInput.addEventListener('input', updateButtons);
addFactorInput.addEventListener('input', updateButtons);
targetRowSelect.addEventListener('change', updateButtons);
sourceRowSelect.addEventListener('change', updateButtons);

addRowButton.addEventListener('click', addRow);
removeRowButton.addEventListener('click', removeRow);
addColButton.addEventListener('click', addColumn);
removeColButton.addEventListener('click', removeColumn);
swapRowsButton.addEventListener('click', swapRows);
scaleRowButton.addEventListener('click', scaleRow);
addRowButtonTransform.addEventListener('click', addScaledRow);

renderMatrix();
