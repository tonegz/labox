const state = {
  matrix: [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ],
};

const matrixContainer = document.getElementById('matrix-container');
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

function renderMatrix() {
  const rows = state.matrix.length;
  const cols = state.matrix[0]?.length ?? 0;

  matrixContainer.style.gridTemplateColumns = `auto repeat(${cols}, minmax(72px, 1fr))`;
  matrixContainer.innerHTML = '';

  state.matrix.forEach((row, rowIndex) => {
    const rowHeader = document.createElement('div');
    rowHeader.className = 'matrix-cell row-header';
    rowHeader.textContent = `Row ${rowIndex + 1}`;
    rowHeader.draggable = true;
    rowHeader.dataset.row = rowIndex;
    rowHeader.setAttribute('aria-label', `Drag row ${rowIndex + 1}`);
    rowHeader.addEventListener('dragstart', (event) => onRowDragStart(event, rowIndex));
    rowHeader.addEventListener('dragover', onRowDragOver);
    rowHeader.addEventListener('drop', (event) => onRowDrop(event, rowIndex));
    rowHeader.addEventListener('dragenter', onRowDragEnter);
    rowHeader.addEventListener('dragleave', onRowDragLeave);
    matrixContainer.appendChild(rowHeader);

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
      matrixContainer.appendChild(cell);
    });
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
  [state.matrix[a], state.matrix[b]] = [state.matrix[b], state.matrix[a]];
  renderMatrix();
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
  [state.matrix[a], state.matrix[b]] = [state.matrix[b], state.matrix[a]];
  renderMatrix();
}

function onRowDragStart(event, rowIndex) {
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

function onRowDrop(event, rowIndex) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
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
