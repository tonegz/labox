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

function renderMatrix() {
  const rows = state.matrix.length;
  const cols = state.matrix[0]?.length ?? 0;

  matrixContainer.style.gridTemplateColumns = `repeat(${cols}, minmax(72px, 1fr))`;
  matrixContainer.innerHTML = '';

  state.matrix.forEach((row, rowIndex) => {
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
  if (Number.isNaN(factor) || target === source) return;

  state.matrix[target] = state.matrix[target].map((value, index) => {
    return value + state.matrix[source][index] * factor;
  });

  renderMatrix();
}

function updateButtons() {
  removeRowButton.disabled = state.matrix.length <= 1;
  removeColButton.disabled = state.matrix[0].length <= 1;

  const rows = state.matrix.length;
  if (swapRowA.value === swapRowB.value && rows > 1) {
    swapRowsButton.disabled = false;
  } else {
    swapRowsButton.disabled = false;
  }
}

addRowButton.addEventListener('click', addRow);
removeRowButton.addEventListener('click', removeRow);
addColButton.addEventListener('click', addColumn);
removeColButton.addEventListener('click', removeColumn);
swapRowsButton.addEventListener('click', swapRows);
scaleRowButton.addEventListener('click', scaleRow);
addRowButtonTransform.addEventListener('click', addScaledRow);

renderMatrix();
