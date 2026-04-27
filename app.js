// ---------------------------------------------------------------------------
// Fraction arithmetic
// ---------------------------------------------------------------------------

function gcd(a, b) {
  a = Math.abs(Math.trunc(a));
  b = Math.abs(Math.trunc(b));
  while (b) { const t = b; b = a % b; a = t; }
  return a || 1;
}

/** Construct a reduced fraction {num, den} with den always positive. */
function makeFrac(num, den) {
  num = Math.trunc(num);
  den = Math.trunc(den);
  if (den === 0) return { num: 0, den: 1 };
  if (num === 0) return { num: 0, den: 1 };
  if (den < 0) { num = -num; den = -den; }
  const g = gcd(Math.abs(num), den);
  return { num: num / g, den: den / g };
}

function fracAdd(a, b) {
  return makeFrac(a.num * b.den + b.num * a.den, a.den * b.den);
}

function fracMul(a, b) {
  return makeFrac(a.num * b.num, a.den * b.den);
}

function fracNeg(f) {
  return { num: -f.num, den: f.den };
}

function fracIsZero(f) {
  return f.num === 0;
}

function fracToFloat(f) {
  return f.num / f.den;
}

function fracToString(f) {
  if (f.den === 1) return String(f.num);
  return `${f.num}/${f.den}`;
}

/**
 * Best rational approximation of a float via continued fractions.
 * Returns an exact fraction for integers and common decimals (0.5, 0.25,
 * 0.333…, etc.) and a close rational for everything else.
 */
function fracFromFloat(x) {
  if (!Number.isFinite(x)) return { num: 0, den: 1 };
  if (x === 0) return { num: 0, den: 1 };

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const MAX_DEN = 10000;
  const TOL = 1e-9;

  // Seed with the integer part
  let p0 = 1;
  let p1 = Math.floor(x);
  let q0 = 0;
  let q1 = 1;
  let remainder = x - Math.floor(x);

  if (remainder < TOL) return makeFrac(sign * p1, q1);

  for (let i = 0; i < 64; i++) {
    const nextB = 1 / remainder;
    const a = Math.floor(nextB);
    remainder = nextB - a;

    const pNext = a * p1 + p0;
    const qNext = a * q1 + q0;

    if (qNext > MAX_DEN) break;

    p0 = p1; p1 = pNext;
    q0 = q1; q1 = qNext;

    if (Math.abs(x - p1 / q1) < TOL || remainder < TOL) break;
  }

  return makeFrac(sign * p1, q1);
}

/**
 * Parse a user-typed string into a fraction.
 * Accepts: integers ("3"), decimals ("1.5"), fractions ("3/4", "-1/2").
 * Returns null for incomplete / invalid input.
 */
function parseFrac(s) {
  s = (s ?? '').trim();
  if (s === '' || s === '-' || s === '+') return null;

  const slashIdx = s.lastIndexOf('/');
  if (slashIdx > 0) {
    const numStr = s.slice(0, slashIdx).trim();
    const denStr = s.slice(slashIdx + 1).trim();
    const num = Number(numStr);
    const den = Number(denStr);
    if (!Number.isInteger(num) || !Number.isInteger(den) || den === 0) return null;
    return makeFrac(num, den);
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (Number.isInteger(n)) return makeFrac(n, 1);
  return fracFromFloat(n);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state = {
  matrix: [
    [makeFrac(1, 1), makeFrac(2, 1), makeFrac(3, 1)],
    [makeFrac(4, 1), makeFrac(5, 1), makeFrac(6, 1)],
    [makeFrac(7, 1), makeFrac(8, 1), makeFrac(9, 1)],
  ],
  fractionMode: true,
};

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------

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
const fractionModeToggle = document.getElementById('fraction-mode-toggle');

// ---------------------------------------------------------------------------
// Resize state
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Mode-aware value helpers
// ---------------------------------------------------------------------------

function zeroValue() {
  return state.fractionMode ? { num: 0, den: 1 } : 0;
}

function isZeroValue(v) {
  return state.fractionMode ? fracIsZero(v) : v === 0;
}

function cellDisplayValue(v) {
  return state.fractionMode ? fracToString(v) : String(v);
}

function updateMatrixJson() {
  if (state.fractionMode) {
    const display = state.matrix.map((row) => row.map(fracToString));
    matrixJson.textContent = JSON.stringify(display, null, 2);
  } else {
    matrixJson.textContent = JSON.stringify(state.matrix, null, 2);
  }
}

/**
 * Build the static (non-editing) fraction display element for a cell.
 * Integers show as plain text; proper fractions show num / bar / den.
 */
function createFracDisplay(f) {
  const div = document.createElement('div');
  div.className = 'frac-display';

  if (f.den === 1) {
    // Integer — wrap text in .frac-inner so the selection highlight
    // targets the same class as proper fractions.
    div.classList.add('frac-integer');
    const span = document.createElement('span');
    span.className = 'frac-inner';
    span.textContent = String(f.num);
    div.appendChild(span);
  } else {
    // Wrap in an inline-flex column so the bar auto-sizes to
    // max(numerator width, denominator width) via align-items: stretch.
    const inner = document.createElement('div');
    inner.className = 'frac-inner';

    const numSpan = document.createElement('span');
    numSpan.className = 'frac-num';
    numSpan.textContent = String(f.num);

    const bar = document.createElement('span');
    bar.className = 'frac-bar';
    bar.setAttribute('aria-hidden', 'true');

    const denSpan = document.createElement('span');
    denSpan.className = 'frac-den';
    denSpan.textContent = String(f.den);

    inner.appendChild(numSpan);
    inner.appendChild(bar);
    inner.appendChild(denSpan);
    div.appendChild(inner);
  }

  return div;
}

/** Replace the frac-display in a single cell without re-rendering the whole matrix. */
function updateCellFracDisplay(rowIndex, colIndex) {
  if (!state.fractionMode) return;
  const cell = matrixContainer.querySelector(
    `.matrix-cell[data-row="${rowIndex}"][data-col="${colIndex}"]`
  );
  if (!cell) return;
  const existing = cell.querySelector('.frac-display');
  if (existing) existing.remove();
  cell.appendChild(createFracDisplay(state.matrix[rowIndex][colIndex]));
}

/**
 * In fraction mode, the elimination factor for zeroing out column `col` of
 * `targetRow` using `sourceRow` is always exact: -(target/source).
 * In float mode we only offer the shortcut when the ratio is an integer.
 * Returns null if the operation is not applicable.
 */
function computeCellFactor(sourceRow, targetRow, col) {
  if (state.fractionMode) {
    const sv = state.matrix[sourceRow][col];
    const tv = state.matrix[targetRow][col];
    if (fracIsZero(sv) || fracIsZero(tv)) return null;
    // -(tv / sv) = -(tv.num * sv.den) / (tv.den * sv.num)
    return fracNeg(makeFrac(tv.num * sv.den, tv.den * sv.num));
  }

  const sv = state.matrix[sourceRow][col];
  const tv = state.matrix[targetRow][col];
  if (sv === 0 || tv === 0 || !Number.isFinite(sv) || !Number.isFinite(tv)) return null;
  if (!Number.isInteger(tv / sv)) return null;
  return -(tv / sv);
}

// ---------------------------------------------------------------------------
// Fraction-mode toggle
// ---------------------------------------------------------------------------

function updateFractionModeUI() {
  const on = state.fractionMode;
  fractionModeToggle.textContent = on ? 'Fraction mode: On' : 'Fraction mode: Off';
  fractionModeToggle.classList.toggle('fraction-mode-active', on);
  matrixContainer.classList.toggle('fraction-mode', on);

  const hint = on ? 'e.g. 1/3' : '';
  [scaleFactorInput, addFactorInput, modalCustomFactor].forEach((input) => {
    input.placeholder = hint;
  });
}

function toggleFractionMode() {
  if (state.fractionMode) {
    // Fraction → float
    state.matrix = state.matrix.map((row) => row.map(fracToFloat));
    state.fractionMode = false;
  } else {
    // Float → fraction
    state.matrix = state.matrix.map((row) => row.map(fracFromFloat));
    state.fractionMode = true;
  }
  updateFractionModeUI();
  renderMatrix();
}

fractionModeToggle.addEventListener('click', toggleFractionMode);

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderMatrix() {
  const rows = state.matrix.length;
  const cols = state.matrix[0]?.length ?? 0;

  matrixContainer.innerHTML = '';

  state.matrix.forEach((row, rowIndex) => {
    const rowWrapper = document.createElement('div');
    rowWrapper.className = 'matrix-row';
    rowWrapper.style.gridTemplateColumns = `auto auto repeat(${cols}, minmax(58px, 1fr))`;
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
      input.type = 'text';
      input.inputMode = state.fractionMode ? 'text' : 'decimal';
      input.placeholder = '0';
      input.value = cellDisplayValue(value);
      input.dataset.row = rowIndex;
      input.dataset.col = colIndex;

      input.addEventListener('input', onCellChange);
      input.addEventListener('focus', onCellFocus);
      input.addEventListener('blur', onCellBlur);
      input.addEventListener('keydown', onCellKeyDown);
      input.addEventListener('wheel', onNumberInputWheel, { passive: false });
      // In fraction mode a click on the cell should switch to plain-text edit view.
      // mousedown fires before focus, so the cell is already .cell-editing when
      // onCellFocus runs and the input becomes visible immediately.
      input.addEventListener('mousedown', onCellMouseDown);
      cell.appendChild(input);

      if (state.fractionMode) {
        cell.appendChild(createFracDisplay(value));
      }

      rowWrapper.appendChild(cell);
    });

    matrixContainer.appendChild(rowWrapper);
  });

  matrixSizeLabel.textContent = `Matrix size: ${rows} × ${cols}`;
  updateMatrixJson();

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

// ---------------------------------------------------------------------------
// Resize handle
// ---------------------------------------------------------------------------

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
      row.push(...Array.from({ length: cols - currentCols }, () => zeroValue()));
    } else if (cols < currentCols) {
      row.splice(cols);
    }
  });

  if (rows > currentRows) {
    for (let i = currentRows; i < rows; i += 1) {
      state.matrix.push(Array.from({ length: cols }, () => zeroValue()));
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
    if (state.matrix[r].some((value) => !isZeroValue(value))) {
      return true;
    }
  }

  for (let r = 0; r < Math.min(rows, currentRows); r += 1) {
    for (let c = cols; c < currentCols; c += 1) {
      if (!isZeroValue(state.matrix[r][c])) {
        return true;
      }
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Cell event handlers
// ---------------------------------------------------------------------------

function onNumberInputWheel(event) {
  if (document.activeElement !== event.currentTarget) return;
  event.preventDefault();
  event.currentTarget.blur();
}

/** Switch a fraction-mode cell into edit view (show plain-text input). */
function enterCellEditing(input) {
  if (!state.fractionMode) return;
  const cell = input.closest('.matrix-cell');
  if (!cell) return;
  cell.classList.remove('cell-selected');
  cell.classList.add('cell-editing');
}

/**
 * Validate and commit the current input value, update the frac display, then
 * return the cell to the "selected" state (stacked view + blue highlight).
 * Called when Enter is pressed while a cell is in cell-editing mode.
 */
function exitCellEditing(input) {
  if (!state.fractionMode) return;
  const cell = input.closest('.matrix-cell');
  if (!cell) return;

  const rowIndex = Number(input.dataset.row);
  const colIndex = Number(input.dataset.col);

  if (input.value === '') {
    state.matrix[rowIndex][colIndex] = zeroValue();
    input.value = '0';
    updateMatrixJson();
  } else {
    const f = parseFrac(input.value);
    if (f === null) {
      // Restore last committed value
      input.value = fracToString(state.matrix[rowIndex][colIndex]);
    } else {
      state.matrix[rowIndex][colIndex] = f;
      input.value = fracToString(f); // normalize (e.g. "2/4" → "1/2")
      updateMatrixJson();
    }
  }

  updateCellFracDisplay(rowIndex, colIndex);
  cell.classList.remove('cell-editing');
  cell.classList.add('cell-selected');
}

/** Called on mousedown so the input is visible before focus fires.
 *  First click → focus will add cell-selected.
 *  Second click on an already-selected cell → promote to editing. */
function onCellMouseDown(event) {
  if (!state.fractionMode) return;
  const cell = event.currentTarget.closest('.matrix-cell');
  if (cell?.classList.contains('cell-selected')) {
    enterCellEditing(event.currentTarget);
  }
  // First click: leave it to onCellFocus to add cell-selected.
}

function onCellFocus(event) {
  event.target.select();
  // In fraction mode, mark the cell as "selected" (stacked view + highlight)
  // unless we're already in full editing mode (e.g. clicked directly to edit).
  if (state.fractionMode) {
    const cell = event.target.closest('.matrix-cell');
    if (cell && !cell.classList.contains('cell-editing')) {
      cell.classList.add('cell-selected');
    }
  }
}

function onCellKeyDown(event) {
  if (event.key === ' ') {
    event.preventDefault();
    return;
  }

  // In fraction mode, switch to edit view when the user types a content-changing
  // key.  Navigation keys (Arrow*, Enter, Tab, Escape, modifier combos) are
  // excluded so arrow-key traversal keeps the stacked fraction visible.
  if (state.fractionMode) {
    const isEditKey = !event.ctrlKey && !event.metaKey
      && (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete');
    if (isEditKey) enterCellEditing(event.target);
  }

  const input = event.target;
  const row = Number(input.dataset.row);
  const col = Number(input.dataset.col);
  const totalRows = state.matrix.length;
  const totalCols = state.matrix[0]?.length ?? 0;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const len = input.value.length;
  const allSelected = start === 0 && end === len;
  const cursorAtStart = start === 0 && end === 0;
  const cursorAtEnd = start === len && end === len;

  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault();
    let nextRow = row;
    if (event.key === 'ArrowUp' && row > 0) nextRow = row - 1;
    else if (event.key === 'ArrowDown' && row < totalRows - 1) nextRow = row + 1;
    else return;
    focusCellAt(nextRow, col);
    return;
  }

  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    const triggerLeft = allSelected || cursorAtStart;
    const triggerRight = allSelected || cursorAtEnd;
    if ((event.key === 'ArrowLeft' && !triggerLeft)
        || (event.key === 'ArrowRight' && !triggerRight)) return;
    event.preventDefault();
    let nextCol = col;
    if (event.key === 'ArrowLeft' && col > 0) nextCol = col - 1;
    else if (event.key === 'ArrowRight' && col < totalCols - 1) nextCol = col + 1;
    else return;
    focusCellAt(row, nextCol);
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    if (state.fractionMode) {
      const cell = input.closest('.matrix-cell');
      if (cell?.classList.contains('cell-selected')) {
        // Enter on selected → go to plain-text editing, cursor at end.
        enterCellEditing(input);
        input.setSelectionRange(input.value.length, input.value.length);
      } else if (cell?.classList.contains('cell-editing')) {
        // Enter on editing → validate, commit, return to selected (stacked) view.
        exitCellEditing(input);
      }
      return;
    }
    // Non-fraction mode: toggle between all-selected and cursor-at-end.
    if (allSelected) {
      input.setSelectionRange(input.value.length, input.value.length);
    } else {
      input.select();
    }
  }
}

function focusCellAt(row, col) {
  const nextInput = matrixContainer.querySelector(
    `input[data-row="${row}"][data-col="${col}"]`
  );
  if (nextInput) nextInput.focus();
}

function onCellBlur(event) {
  const input = event.target;
  // Always clear both states on blur so the stacked display returns cleanly.
  const blurCell = input.closest('.matrix-cell');
  if (blurCell) {
    blurCell.classList.remove('cell-editing');
    blurCell.classList.remove('cell-selected');
  }

  const rowIndex = Number(input.dataset.row);
  const colIndex = Number(input.dataset.col);

  if (input.value === '') {
    state.matrix[rowIndex][colIndex] = zeroValue();
    input.value = '0';
    updateMatrixJson();
    if (state.fractionMode) updateCellFracDisplay(rowIndex, colIndex);
    return;
  }

  if (state.fractionMode) {
    const f = parseFrac(input.value);
    if (f === null) {
      // Restore the last good value
      input.value = fracToString(state.matrix[rowIndex][colIndex]);
    }
    // State was already updated on each valid keystroke in onCellChange
    updateCellFracDisplay(rowIndex, colIndex);
  } else {
    const numericValue = Number(input.value);
    if (!Number.isFinite(numericValue)) {
      input.value = String(state.matrix[rowIndex][colIndex]);
    }
  }
}

function onCellChange(event) {
  const input = event.target;
  const rowIndex = Number(input.dataset.row);
  const colIndex = Number(input.dataset.col);

  if (input.value === '') {
    state.matrix[rowIndex][colIndex] = zeroValue();
    updateMatrixJson();
    return;
  }

  if (state.fractionMode) {
    const f = parseFrac(input.value);
    if (f === null) return; // mid-typing (e.g. "1/"), don't clobber state
    state.matrix[rowIndex][colIndex] = f;
    updateMatrixJson();
  } else {
    const numericValue = Number(input.value);
    if (!Number.isFinite(numericValue)) return;
    state.matrix[rowIndex][colIndex] = numericValue;
    updateMatrixJson();
  }
}

// ---------------------------------------------------------------------------
// Matrix structural operations
// ---------------------------------------------------------------------------

function addRow() {
  const cols = state.matrix[0].length;
  const newRow = Array.from({ length: cols }, () => zeroValue());
  state.matrix.push(newRow);
  renderMatrix();
}

function removeRow() {
  if (state.matrix.length <= 1) return;
  state.matrix.pop();
  renderMatrix();
}

function addColumn() {
  state.matrix.forEach((row) => row.push(zeroValue()));
  renderMatrix();
}

function removeColumn() {
  const cols = state.matrix[0].length;
  if (cols <= 1) return;
  state.matrix.forEach((row) => row.pop());
  renderMatrix();
}

// ---------------------------------------------------------------------------
// Row transformations
// ---------------------------------------------------------------------------

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

  if (state.fractionMode) {
    const factor = parseFrac(scaleFactorInput.value);
    if (factor === null || fracIsZero(factor)) return;
    state.matrix[rowIndex] = state.matrix[rowIndex].map((v) => fracMul(v, factor));
  } else {
    const factor = Number(scaleFactorInput.value);
    if (Number.isNaN(factor)) return;
    state.matrix[rowIndex] = state.matrix[rowIndex].map((v) => v * factor);
  }

  renderMatrix();
}

function addScaledRow() {
  const target = Number(targetRowSelect.value);
  const source = Number(sourceRowSelect.value);

  if (state.fractionMode) {
    const factor = parseFrac(addFactorInput.value);
    if (factor !== null) addScaledRowWithFactor(target, source, factor);
  } else {
    const factor = Number(addFactorInput.value);
    addScaledRowWithFactor(target, source, factor);
  }
}

function addScaledRowWithFactor(target, source, factor) {
  if (state.fractionMode) {
    if (fracIsZero(factor) || target === source) return;
    state.matrix[target] = state.matrix[target].map((v, i) => {
      return fracAdd(v, fracMul(state.matrix[source][i], factor));
    });
  } else {
    if (Number.isNaN(factor) || target === source) return;
    state.matrix[target] = state.matrix[target].map((v, i) => {
      return v + state.matrix[source][i] * factor;
    });
  }

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
    wrapper.querySelectorAll('input[type="text"]').forEach((input) => {
      input.dataset.row = rowIndex;
    });
  });
}

// ---------------------------------------------------------------------------
// Drag and drop
// ---------------------------------------------------------------------------

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

  const factor = computeCellFactor(dragSourceRow, targetRow, targetCol);
  const isValid = factor !== null;

  let tipText = `add to row ${targetRow + 1}...`;
  if (isValid) {
    if (state.fractionMode) {
      const fs = fracToString(factor);
      tipText = `add ${fs == '1' ? '' : '' + fs + ' × '}to row ${targetRow + 1}`;
    } else {
      tipText = `${factor >= 0 ? '+' : ''}${factor}`;
    }
  }

  currentDragTarget = {
    type: 'cell',
    row: targetRow,
    col: targetCol,
    valid: isValid,
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
  const tipText = isSwapArea ? '↑↓ swap rows' : 'add row...';
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
    const factor = computeCellFactor(sourceIndex, targetRow, targetCol);

    if (factor !== null) {
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

// ---------------------------------------------------------------------------
// Row-action modal
// ---------------------------------------------------------------------------

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
  if (state.fractionMode) {
    const factor = parseFrac(modalCustomFactor.value);
    modalAddMultiplierButton.disabled = factor === null || fracIsZero(factor);
  } else {
    const factor = Number(modalCustomFactor.value);
    modalAddMultiplierButton.disabled = modalCustomFactor.value === ''
      || !Number.isFinite(factor)
      || factor === 0;
  }
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
    const n = Number(button.dataset.multiplier);
    const factor = state.fractionMode ? makeFrac(n, 1) : n;
    applyRowAction('add', factor);
  });
});

modalAddMultiplierButton.addEventListener('click', () => {
  if (state.fractionMode) {
    const factor = parseFrac(modalCustomFactor.value);
    if (factor !== null && !fracIsZero(factor)) applyRowAction('add', factor);
  } else {
    applyRowAction('add', Number(modalCustomFactor.value));
  }
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

// ---------------------------------------------------------------------------
// Resize-confirm modal
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Global keyboard / pointer listeners
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Button state
// ---------------------------------------------------------------------------

function updateButtons() {
  removeRowButton.disabled = state.matrix.length <= 1;
  removeColButton.disabled = state.matrix[0].length <= 1;

  const sameRowSelected = swapRowA.value === swapRowB.value;
  swapRowsButton.disabled = sameRowSelected || state.matrix.length <= 1;

  // Scale factor
  if (state.fractionMode) {
    const sf = parseFrac(scaleFactorInput.value);
    scaleRowButton.disabled = sf === null || fracIsZero(sf);
  } else {
    const scaleFactor = Number(scaleFactorInput.value);
    scaleRowButton.disabled = scaleFactorInput.value === ''
      || !Number.isFinite(scaleFactor)
      || scaleFactor === 0;
  }

  // Add-scaled factor
  const sameAddRow = targetRowSelect.value === sourceRowSelect.value;
  if (state.fractionMode) {
    const af = parseFrac(addFactorInput.value);
    addRowButtonTransform.disabled = af === null
      || fracIsZero(af)
      || sameAddRow
      || state.matrix.length <= 1;
  } else {
    const addFactor = Number(addFactorInput.value);
    addRowButtonTransform.disabled = addFactorInput.value === ''
      || !Number.isFinite(addFactor)
      || addFactor === 0
      || sameAddRow
      || state.matrix.length <= 1;
  }
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

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

updateFractionModeUI();
renderMatrix();
