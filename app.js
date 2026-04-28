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
const resizeWarningBar = document.getElementById('resize-warning-bar');
const resizeWarningText = document.getElementById('resize-warning-text');
const matrixResizeHandle = document.getElementById('matrix-resize-handle');
const matrixSizeLabel = document.getElementById('matrix-size');
const matrixJson = document.getElementById('matrix-json');
const copyJsonBtn = document.getElementById('copy-json');

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

const scaleRowModal = document.getElementById('scale-row-modal');
const scaleModalRowNum = document.getElementById('scale-modal-row-num');
const scaleModalFactor = document.getElementById('scale-modal-factor');
const scaleModalApply = document.getElementById('scale-modal-apply');
const scaleModalCancel = document.getElementById('scale-modal-cancel');

const rowActionModal = document.getElementById('row-action-modal');
const modalSourceRow = document.getElementById('modal-source-row');
const modalTargetRow = document.getElementById('modal-target-row');
const modalCustomFactor = document.getElementById('modal-custom-factor');
const modalAddMultiplierButton = document.getElementById('modal-add-multiplier');
const modalSwapRowsButton = document.getElementById('modal-swap-rows');
const modalCancelActionButton = document.getElementById('modal-cancel-action');
const rowMultiplierButtons = document.querySelectorAll('[data-multiplier]');
const dragTip = document.getElementById('drag-tip');
const historyList = document.getElementById('history-list');
const revertConfirmModal = document.getElementById('revert-confirm-modal');
const revertConfirmText = document.getElementById('revert-confirm-text');
const revertConfirmOk = document.getElementById('revert-confirm-ok');
const revertConfirmCancel = document.getElementById('revert-confirm-cancel');
const fractionModeToggle = document.getElementById('fraction-mode-toggle');
const matrixEditorPanel = matrixWrapper.closest('.panel');

// ---------------------------------------------------------------------------
// Resize state
// ---------------------------------------------------------------------------

let dragSourceRow = null;
let currentDragTarget = null;
let isResizing = false;
let resizePointerId = null;
let resizeStartX = 0;
let resizeStartY = 0;
let resizeStartRows = 0;
let resizeStartCols = 0;
let currentResizeRows = 0;
let currentResizeCols = 0;

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

  // frac-content is a tight inline wrapper around sign + fraction that
  // receives the selection highlight — unlike frac-display which fills the cell.
  const content = document.createElement('div');
  content.className = 'frac-content';

  if (f.den === 1) {
    // Integer — wrap text in .frac-inner so the selection highlight
    // targets the same class as proper fractions.
    div.classList.add('frac-integer');
    const span = document.createElement('span');
    span.className = 'frac-inner';
    span.textContent = String(f.num);
    content.appendChild(span);
  } else {
    // For negative fractions render "− |num|/den" so the minus sits in
    // front of the bar rather than in the numerator.
    if (f.num < 0) {
      const sign = document.createElement('span');
      sign.className = 'frac-sign';
      sign.setAttribute('aria-hidden', 'true');
      sign.textContent = '−';
      content.appendChild(sign);
    }

    // Wrap in an inline-flex column so the bar auto-sizes to
    // max(numerator width, denominator width) via align-items: stretch.
    const inner = document.createElement('div');
    inner.className = 'frac-inner';

    const numSpan = document.createElement('span');
    numSpan.className = 'frac-num';
    numSpan.textContent = String(Math.abs(f.num));

    const bar = document.createElement('span');
    bar.className = 'frac-bar';
    bar.setAttribute('aria-hidden', 'true');

    const denSpan = document.createElement('span');
    denSpan.className = 'frac-den';
    denSpan.textContent = String(f.den);

    inner.appendChild(numSpan);
    inner.appendChild(bar);
    inner.appendChild(denSpan);
    content.appendChild(inner);
  }

  div.appendChild(content);

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
  const ZERO_DIM_PX = 12; // minimum sliver size so the outline stays visible at 0
  const width = newCols === 0 ? ZERO_DIM_PX : newCols * colWidth;
  const height = newRows === 0 ? ZERO_DIM_PX : newRows * rowHeight;

  resizeOverlay.style.left = `${overlayLeft}px`;
  resizeOverlay.style.top = `${overlayTop}px`;
  resizeOverlay.style.width = `${width}px`;
  resizeOverlay.style.height = `${height}px`;
  resizeOverlay.classList.remove('hidden');

  // Label text: spring-back size (original for 0×0, else 1 in zero dimension).
  // Label position: always where the 1×1 corner would be (Math.max(1, ...)).
  const fullClearLabel = newRows === 0 && newCols === 0;
  const labelTextRows = fullClearLabel ? resizeStartRows : Math.max(1, newRows);
  const labelTextCols = fullClearLabel ? resizeStartCols : Math.max(1, newCols);
  const labelPosRight = overlayLeft + Math.max(1, newCols) * colWidth;
  const labelTop = overlayTop + 10;
  resizeDimensions.textContent = `${labelTextRows}×${labelTextCols}`;
  resizeDimensions.style.left = `${labelPosRight}px`;
  resizeDimensions.style.top = `${labelTop}px`;
  resizeDimensions.classList.remove('hidden');

  currentResizeRows = newRows;
  currentResizeCols = newCols;

  // Highlight cells that would be removed (non-zero values outside the new bounds).
  matrixContainer.querySelectorAll('.matrix-cell[data-col]').forEach((cell) => {
    const r = Number(cell.dataset.row);
    const c = Number(cell.dataset.col);
    const willRemove = (r >= newRows || c >= newCols) && !isZeroValue(state.matrix[r]?.[c]);
    cell.classList.toggle('cell-will-remove', willRemove);
  });

  // Show / fade the warning text below the matrix.
  const willLoseData = (newRows < state.matrix.length || newCols < (state.matrix[0]?.length ?? 0))
    && hasNonZeroRemovedCells(newRows, newCols);
  if (willLoseData) {
    const fullClear = newRows === 0 && newCols === 0;
    resizeWarningText.textContent = fullClear
      ? 'The matrix will be cleared'
      : 'Some non-zero values will be removed';
    // Remove both classes so the element is fully visible; double-rAF ensures
    // the browser paints the hidden state first so the opacity transition fires.
    resizeWarningBar.classList.remove('warning-fade');
    resizeWarningBar.classList.remove('hidden');
  } else {
    // Fade out quickly; leave 'hidden' off so the transition can run.
    resizeWarningBar.classList.add('warning-fade');
  }
}

function clearResizeHighlights() {
  matrixContainer.querySelectorAll('.matrix-cell.cell-will-remove').forEach((cell) => {
    cell.classList.remove('cell-will-remove');
  });
  // Instantly hide (no transition needed once drag ends).
  resizeWarningBar.classList.add('hidden');
  resizeWarningBar.classList.remove('warning-fade');
}

function cancelResize() {
  if (!isResizing) return;
  isResizing = false;
  if (resizePointerId !== null) {
    try { matrixResizeHandle.releasePointerCapture(resizePointerId); } catch (_) {}
    resizePointerId = null;
  }
  resizeOverlay.classList.add('hidden');
  resizeDimensions.classList.add('hidden');
  matrixContainer.classList.remove('bracket-resizing');
  clearResizeHighlights();
}

function onResizeStart(event) {
  event.preventDefault();
  isResizing = true;
  resizePointerId = event.pointerId;
  matrixResizeHandle.setPointerCapture(event.pointerId);
  resizeStartX = event.clientX;
  resizeStartY = event.clientY;
  resizeStartRows = state.matrix.length;
  resizeStartCols = state.matrix[0]?.length ?? 0;
  matrixContainer.classList.add('bracket-resizing');
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

  const newRows = Math.max(0, resizeStartRows + rowDelta);
  const newCols = Math.max(0, resizeStartCols + colDelta);
  updateResizeOverlay(newRows, newCols);
}

function onResizeEnd(event) {
  if (!isResizing) return;
  isResizing = false;
  resizePointerId = null;
  matrixResizeHandle.releasePointerCapture(event.pointerId);
  resizeOverlay.classList.add('hidden');
  resizeDimensions.classList.add('hidden');
  matrixContainer.classList.remove('bracket-resizing');
  clearResizeHighlights();

  const newRows = currentResizeRows;
  const newCols = currentResizeCols;
  const oldRows = state.matrix.length;
  const oldCols = state.matrix[0]?.length ?? 0;

  if (newRows === oldRows && newCols === oldCols) return;

  const lostData = (newRows < oldRows || newCols < oldCols) && hasNonZeroRemovedCells(newRows, newCols);

  if (newRows === 0 && newCols === 0) {
    // Full clear: zero all cells and spring back to original size.
    const hadData = lostData; // lostData already checked hasNonZeroRemovedCells(0,0)
    state.matrix.forEach((row, r) => row.forEach((_, c) => { state.matrix[r][c] = zeroValue(); }));
    if (hadData) snapshotHistory('Matrix cleared');
    renderMatrix();
  } else {
    // Spring back: size must be at least 1 in each dimension.
    const finalRows = Math.max(1, newRows);
    const finalCols = Math.max(1, newCols);
    if (finalRows === oldRows && finalCols === oldCols) return;
    resizeMatrix(finalRows, finalCols);
    // A zero-dimension (but not 0×0) drag clears all remaining cells too.
    if (newRows === 0 || newCols === 0) {
      state.matrix.forEach((row, r) => row.forEach((_, c) => { state.matrix[r][c] = zeroValue(); }));
      renderMatrix();
    }
  }
  if (lostData) showResizeToast();
}

let resizeToastTimer = null;

function showResizeToast() {
  // Remove any existing toast before creating a new one.
  document.querySelectorAll('.resize-toast').forEach((el) => el.remove());
  if (resizeToastTimer) { clearTimeout(resizeToastTimer); resizeToastTimer = null; }

  const toast = document.createElement('div');
  toast.className = 'resize-toast';
  toast.textContent = 'Some non-zero values were removed. Use History to revert';
  document.body.appendChild(toast);

  // Start fade after 3 s, remove from DOM after fade completes (0.5 s).
  resizeToastTimer = setTimeout(() => {
    toast.classList.add('toast-fade');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    resizeToastTimer = null;
  }, 3000);
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

  snapshotHistory(`Resize to ${rows}×${cols}`);
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
  // Snapshot the cell value so onCellBlur can detect whether it changed.
  const rowIndex = Number(event.target.dataset.row);
  const colIndex = Number(event.target.dataset.col);
  const v = state.matrix[rowIndex]?.[colIndex];
  focusCellValue = (v !== null && typeof v === 'object') ? { ...v } : v;
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

  // Consume the one-shot flag set by Enter so the next Left/Right navigates
  // immediately regardless of where the cursor ended up after Enter.
  const wasJustConfirmed = cellJustConfirmed;
  cellJustConfirmed = false;

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
    const triggerLeft  = allSelected || cursorAtStart || wasJustConfirmed;
    const triggerRight = allSelected || cursorAtEnd   || wasJustConfirmed;
    if ((event.key === 'ArrowLeft'  && !triggerLeft)
     || (event.key === 'ArrowRight' && !triggerRight)) return;
    let nextCol = col;
    if (event.key === 'ArrowLeft'  && col > 0)                  nextCol = col - 1;
    else if (event.key === 'ArrowRight' && col < totalCols - 1) nextCol = col + 1;
    else return; // at edge — no preventDefault, browser collapses selection normally
    event.preventDefault();
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
        cellJustConfirmed = true;
      }
      return;
    }
    // Non-fraction mode: set flag so the next Left/Right navigates immediately.
    input.select();
    cellJustConfirmed = true;
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

  // Record a history entry if the value actually changed.
  const currentVal = state.matrix[rowIndex]?.[colIndex];
  if (!cellValuesEqual(focusCellValue, currentVal)) {
    recordCellEdit(rowIndex);
  }
  focusCellValue = null;
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
// Operation history
// ---------------------------------------------------------------------------

let operationHistory = [];
let historyPosition = -1;
let editedRows = new Set();   // rows touched in the current edit session
let focusCellValue = null;    // value snapshot taken at cell-focus time
let cellJustConfirmed = false; // set by Enter; consumed by the next Left/Right press

function deepCloneMatrix(matrix) {
  return matrix.map((row) =>
    row.map((cell) => (cell !== null && typeof cell === 'object' ? { ...cell } : cell))
  );
}

function snapshotHistory(description) {
  editedRows.clear();
  operationHistory = operationHistory.slice(0, historyPosition + 1);
  operationHistory.push({ description, matrix: deepCloneMatrix(state.matrix) });
  historyPosition = operationHistory.length - 1;
  renderHistoryPanel();
}

function editRowDescription() {
  const sorted = [...editedRows].sort((a, b) => a - b).map((r) => r + 1);
  if (sorted.length === 1) return `Edit row ${sorted[0]}`;
  if (sorted.length === 2) return `Edit row ${sorted[0]} and row ${sorted[1]}`;
  return `Edit row ${sorted[0]} – row ${sorted[sorted.length - 1]}`;
}

function recordCellEdit(rowIndex) {
  editedRows.add(rowIndex);
  const desc = editRowDescription();
  const snapshot = deepCloneMatrix(state.matrix);
  // If the last history entry is already an edit, update it in place.
  if (historyPosition >= 0 && operationHistory[historyPosition].isEdit) {
    operationHistory[historyPosition] = { description: desc, matrix: snapshot, isEdit: true };
  } else {
    operationHistory = operationHistory.slice(0, historyPosition + 1);
    operationHistory.push({ description: desc, matrix: snapshot, isEdit: true });
    historyPosition = operationHistory.length - 1;
  }
  renderHistoryPanel();
}

function cellValuesEqual(a, b) {
  if (a === null || b === null) return a === b;
  if (typeof a === 'object') return a.num === b.num && a.den === b.den;
  return a === b;
}

let pendingRevertIndex = null;

function restoreToHistory(index) {
  if (index < 0 || index >= operationHistory.length || index === historyPosition) return;
  pendingRevertIndex = index;
  const desc = operationHistory[index].description;
  revertConfirmText.textContent = `Revert the matrix to "${desc}"?`;
  modalReturnFocusTo = document.activeElement;
  revertConfirmModal.classList.remove('hidden');
  revertConfirmOk.focus();
}

function applyRevert() {
  const index = pendingRevertIndex;
  pendingRevertIndex = null;
  revertConfirmModal.classList.add('hidden');
  restoreFocusFromModal();
  if (index === null) return;
  state.matrix = deepCloneMatrix(operationHistory[index].matrix);
  operationHistory = operationHistory.slice(0, index + 1);
  historyPosition = index;
  renderMatrix();
  renderHistoryPanel();
}

function cancelRevert() {
  pendingRevertIndex = null;
  revertConfirmModal.classList.add('hidden');
  restoreFocusFromModal();
}

function renderHistoryPanel() {
  if (!historyList) return;
  historyList.innerHTML = '';
  operationHistory.forEach((entry, i) => {
    const row = document.createElement('div');
    row.className = 'history-entry' + (i === historyPosition ? ' current' : '');

    const num = document.createElement('span');
    num.className = 'history-entry-num';
    num.textContent = i === 0 ? '·' : String(i);

    const label = document.createElement('span');
    label.textContent = entry.description;

    row.appendChild(num);
    row.appendChild(label);
    if (i !== historyPosition) row.addEventListener('click', () => restoreToHistory(i));
    historyList.appendChild(row);
  });
  if (historyList.lastElementChild) {
    historyList.lastElementChild.scrollIntoView({ block: 'nearest' });
  }
}

// ---------------------------------------------------------------------------
// Matrix structural operations
// ---------------------------------------------------------------------------

function addRow() {
  const cols = state.matrix[0].length;
  const newRow = Array.from({ length: cols }, () => zeroValue());
  state.matrix.push(newRow);
  snapshotHistory('Add row');
  renderMatrix();
}

function removeRow() {
  if (state.matrix.length <= 1) return;
  const removedRowNum = state.matrix.length; // 1-based, before pop
  const lostData = state.matrix[state.matrix.length - 1].some((v) => !isZeroValue(v));
  state.matrix.pop();
  snapshotHistory(`Remove row ${removedRowNum}`);
  renderMatrix();
  if (lostData) showResizeToast();
}

function addColumn() {
  state.matrix.forEach((row) => row.push(zeroValue()));
  snapshotHistory('Add column');
  renderMatrix();
}

function removeColumn() {
  const cols = state.matrix[0].length;
  if (cols <= 1) return;
  const removedColNum = cols; // 1-based, before pop
  const lostData = state.matrix.some((row) => !isZeroValue(row[cols - 1]));
  state.matrix.forEach((row) => row.pop());
  snapshotHistory(`Remove column ${removedColNum}`);
  renderMatrix();
  if (lostData) showResizeToast();
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
    snapshotHistory(`Scale Row ${rowIndex + 1} by ${fracToString(factor)}`);
  } else {
    const factor = Number(scaleFactorInput.value);
    if (Number.isNaN(factor)) return;
    state.matrix[rowIndex] = state.matrix[rowIndex].map((v) => v * factor);
    snapshotHistory(`Scale Row ${rowIndex + 1} by ${factor}`);
  }

  renderMatrix();
}

function scaleRowByFactor(rowIndex, factor) {
  if (state.fractionMode) {
    if (fracIsZero(factor)) return;
    state.matrix[rowIndex] = state.matrix[rowIndex].map((v) => fracMul(v, factor));
    snapshotHistory(`Scale Row ${rowIndex + 1} by ${fracToString(factor)}`);
  } else {
    if (factor === 0 || !Number.isFinite(factor)) return;
    state.matrix[rowIndex] = state.matrix[rowIndex].map((v) => v * factor);
    snapshotHistory(`Scale Row ${rowIndex + 1} by ${factor}`);
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
    const fs = fracToString(factor);
    snapshotHistory(`Add ${fs === '1' ? '' : fs + ' × '}Row ${source + 1} to Row ${target + 1}`);
  } else {
    if (Number.isNaN(factor) || target === source) return;
    state.matrix[target] = state.matrix[target].map((v, i) => {
      return v + state.matrix[source][i] * factor;
    });
    snapshotHistory(`Add ${factor} × Row ${source + 1} to Row ${target + 1}`);
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
    snapshotHistory(`Swap Row ${a + 1} ↔ Row ${b + 1}`);
    renderMatrix();
    return;
  }

  const firstRectA = rowA.getBoundingClientRect();
  const firstRectB = rowB.getBoundingClientRect();

  [state.matrix[a], state.matrix[b]] = [state.matrix[b], state.matrix[a]];
  snapshotHistory(`Swap Row ${a + 1} ↔ Row ${b + 1}`);

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
    // The wrapper and data-cells must be updated too — omitting them leaves
    // stale dataset.row values that cause wrong-row targeting on subsequent
    // drags after an animated swap (which skips a full renderMatrix).
    wrapper.dataset.row = rowIndex;

    const header = wrapper.querySelector('.row-header');
    if (header) {
      header.textContent = `Row ${rowIndex + 1}`;
      header.dataset.row = rowIndex;
    }
    const dragHandle = wrapper.querySelector('.row-drag-handle');
    if (dragHandle) {
      dragHandle.dataset.row = rowIndex;
    }
    wrapper.querySelectorAll('.matrix-cell[data-col]').forEach((cell) => {
      cell.dataset.row = rowIndex;
    });
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

  // Suppress the native drag ghost with a fully transparent off-screen element.
  const ghost = document.createElement('div');
  ghost.style.cssText = 'position:fixed;top:-500px;left:-500px;width:1px;height:1px;opacity:0;';
  document.body.appendChild(ghost);
  event.dataTransfer.setDragImage(ghost, 0, 0);
  window.setTimeout(() => ghost.remove(), 0);

}

function onRowDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  updateDragHover(event);
}

function updateDragHover(event) {
  if (dragSourceRow === null) return;

  const containerRect = matrixContainer.getBoundingClientRect();
  const x = event.clientX;

  // Use layout-based Y detection so CSS translateX nudge doesn't affect targeting.
  const rowWrapper = getRowByLayoutY(event.clientY);
  if (!rowWrapper) {
    clearDragTargetState();
    return;
  }

  const targetRow = Number(rowWrapper.dataset.row);
  if (targetRow === dragSourceRow) {
    // Allow same-row cell hover for "scale row" drag action.
    if (x >= containerRect.left + DRAG_HANDLE_WIDTH + ROW_HEADER_WIDTH) {
      const cell = event.target.closest('.matrix-cell[data-col]');
      if (cell) {
        setSameRowScaleTarget(cell, targetRow, Number(cell.dataset.col), event);
        return;
      }
    }
    clearDragTargetState();
    return;
  }

  // Zone detection against fixed container coordinates (unaffected by row translate).
  if (x < containerRect.left + DRAG_HANDLE_WIDTH) {
    // Drag-handle column or gutter → swap
    setRowSwapTarget(rowWrapper, true, event);
  } else if (x < containerRect.left + DRAG_HANDLE_WIDTH + ROW_HEADER_WIDTH) {
    // Row-header column → add
    setRowSwapTarget(rowWrapper, false, event);
  } else {
    // Data-cell column — fall back to DOM hit-test (cells don't translate)
    const cell = event.target.closest('.matrix-cell[data-col]');
    if (cell) {
      setCellDragTarget(cell, targetRow, Number(cell.dataset.col), event);
    } else {
      clearDragTargetState();
    }
  }
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

function setSameRowScaleTarget(cell, rowIndex, colIndex, event) {
  if (currentDragTarget?.type === 'scale-row'
      && currentDragTarget.row === rowIndex
      && currentDragTarget.col === colIndex) {
    updateDragTipPosition(event);
    return;
  }

  clearDragTargetState();

  // Find first non-zero column in this row.
  const row = state.matrix[rowIndex];
  const firstNonZeroCol = row.findIndex((v) =>
    state.fractionMode ? !fracIsZero(v) : v !== 0
  );

  let directScale = false;
  let factor = null;
  let tipText = 'scale row...';

  if (firstNonZeroCol === colIndex) {
    const val = row[colIndex];
    const isOne = state.fractionMode
      ? (val.num === 1 && val.den === 1)
      : val === 1;
    if (!isOne) {
      directScale = true;
      factor = state.fractionMode
        ? makeFrac(val.den, val.num)
        : 1 / val;
      const factorStr = state.fractionMode
        ? fracToString(factor)
        : String(Math.round(factor * 1e6) / 1e6);
      tipText = `× ${factorStr}`;
    }
  }

  cell.classList.add('drag-over');
  currentDragTarget = { type: 'scale-row', row: rowIndex, col: colIndex, cell, directScale, factor };
  showDragTip(event, tipText);
}

function onCellDragEnter(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  updateDragHover(event);
}

function onCellDragLeave(event) {
  event.currentTarget.classList.remove('drag-over');
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
  if (currentDragTarget?.type === 'row' && currentDragTarget.row === rowIndex && currentDragTarget.swapArea === isSwapArea) {
    if (event) updateDragTipPosition(event);
    return;
  }

  // Same row but swap-area flag changed — update nudge and tip without clearing.
  if (currentDragTarget?.type === 'row' && currentDragTarget.row === rowIndex) {
    currentDragTarget.swapArea = isSwapArea;
    rowWrapper.classList.toggle('swap-nudge', isSwapArea);
    dragTip?.classList.toggle('swap-active', isSwapArea);
    const tipText = isSwapArea ? '↑↓ swap rows' : 'add row...';
    showDragTip(event || { clientX: rowWrapper.getBoundingClientRect().left + 20, clientY: rowWrapper.getBoundingClientRect().top + 20 }, tipText);
    return;
  }

  clearDragTargetState();
  rowWrapper.classList.add('swap-target');
  if (isSwapArea) rowWrapper.classList.add('swap-nudge');
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
  rowWrapper.classList.remove('swap-target', 'swap-nudge');
  const handle = rowWrapper.querySelector('.row-drag-handle');
  if (handle) {
    handle.classList.remove('swap-target');
  }
}

// How many pixels to the left of the drag-handle column count as "swap zone".
const SWAP_GUTTER_PX = 14;
const DRAG_HANDLE_WIDTH = 14; // matches .matrix-cell.row-drag-handle { width: 14px }
const ROW_HEADER_WIDTH = 58;  // matches .matrix-cell.row-header { width: 58px }

/**
 * Find which .matrix-row contains clientY, using offsetTop (layout position,
 * unaffected by CSS transforms) so row nudge animations don't move the target.
 */
function getRowByLayoutY(clientY) {
  const containerTop = matrixContainer.getBoundingClientRect().top;
  for (const row of matrixContainer.querySelectorAll('.matrix-row')) {
    const top    = containerTop + row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (clientY >= top && clientY < bottom) return row;
  }
  return null;
}

/**
 * If the pointer is in the left gutter (up to SWAP_GUTTER_PX to the left of
 * the matrix container) AND vertically over a row different from the drag
 * source, return that row wrapper.  Otherwise return null.
 */
function getGutterSwapRow(event) {
  if (dragSourceRow === null) return null;
  const containerRect = matrixContainer.getBoundingClientRect();
  // Must be to the LEFT of the container and within the gutter band.
  if (event.clientX >= containerRect.left) return null;
  if (event.clientX < containerRect.left - SWAP_GUTTER_PX) return null;
  // Find the row whose vertical bounds contain the cursor.
  const rows = matrixContainer.querySelectorAll('.matrix-row');
  for (const row of rows) {
    const rect = row.getBoundingClientRect();
    if (event.clientY >= rect.top && event.clientY < rect.bottom) {
      if (Number(row.dataset.row) === dragSourceRow) return null;
      return row;
    }
  }
  return null;
}

function onPanelDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  updateDragHover(event);
}

function onPanelDrop(event) {
  const targetRow = getGutterSwapRow(event);
  if (!targetRow) return;
  event.preventDefault();
  const targetIndex = Number(targetRow.dataset.row);
  const sourceIndex = dragSourceRow ?? Number(event.dataTransfer.getData('text/plain'));
  dragSourceRow = null;
  clearDragTargetState();
  if (!Number.isNaN(sourceIndex) && sourceIndex !== targetIndex) {
    swapRowsByIndex(sourceIndex, targetIndex);
  }
}

function clearDragTargetState() {
  if (currentDragTarget?.cell) {
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
  if (rowWrapper) rowWrapper.classList.remove('drag-over');
}

function onRowDrop(event) {
  event.preventDefault();
  const targetRow = Number(event.currentTarget.dataset.row);
  const sourceIndex = dragSourceRow !== null ? dragSourceRow : Number(event.dataTransfer.getData('text/plain'));
  dragSourceRow = null;

  // Same-row drop: scale-row drag action.
  if (sourceIndex === targetRow && currentDragTarget?.type === 'scale-row') {
    const { directScale, factor } = currentDragTarget;
    clearDragTargetState();
    if (directScale && factor !== null) {
      scaleRowByFactor(sourceIndex, factor);
    } else {
      openScaleRowModal(sourceIndex);
    }
    return;
  }

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

// ---------------------------------------------------------------------------
// Scale-row modal (opened by dropping row header onto same-row cell)
// ---------------------------------------------------------------------------

function openScaleRowModal(rowIndex) {
  scaleModalRowNum.textContent = String(rowIndex + 1);
  scaleRowModal.dataset.rowIndex = rowIndex;
  scaleModalFactor.value = '1';
  modalReturnFocusTo = document.activeElement;
  scaleRowModal.classList.remove('hidden');
  updateScaleModalApplyButton();
  scaleModalFactor.focus();
  scaleModalFactor.select();
}

function closeScaleRowModal() {
  scaleRowModal.classList.add('hidden');
  restoreFocusFromModal();
}

function updateScaleModalApplyButton() {
  if (state.fractionMode) {
    const f = parseFrac(scaleModalFactor.value);
    scaleModalApply.disabled = f === null || fracIsZero(f);
  } else {
    const f = Number(scaleModalFactor.value);
    scaleModalApply.disabled = !scaleModalFactor.value || !Number.isFinite(f) || f === 0;
  }
}

function applyScaleRowModal() {
  const rowIndex = Number(scaleRowModal.dataset.rowIndex);
  if (state.fractionMode) {
    const factor = parseFrac(scaleModalFactor.value);
    if (factor && !fracIsZero(factor)) scaleRowByFactor(rowIndex, factor);
  } else {
    const factor = Number(scaleModalFactor.value);
    if (Number.isFinite(factor) && factor !== 0) scaleRowByFactor(rowIndex, factor);
  }
  closeScaleRowModal();
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
  if (!scaleRowModal.classList.contains('hidden')) return scaleRowModal;
  if (!revertConfirmModal.classList.contains('hidden')) return revertConfirmModal;
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

// Revert-confirm modal buttons
revertConfirmOk.addEventListener('click', applyRevert);
revertConfirmCancel.addEventListener('click', cancelRevert);
revertConfirmModal.addEventListener('click', (e) => { if (e.target === revertConfirmModal) cancelRevert(); });

// Scale-row modal buttons
scaleModalApply.addEventListener('click', applyScaleRowModal);
scaleModalCancel.addEventListener('click', closeScaleRowModal);
scaleModalFactor.addEventListener('input', updateScaleModalApplyButton);
scaleModalFactor.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !scaleModalApply.disabled) applyScaleRowModal();
});
scaleRowModal.addEventListener('click', (event) => {
  if (event.target === scaleRowModal) closeScaleRowModal();
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

  if (isResizing) {
    cancelResize();
  } else if (!rowActionModal.classList.contains('hidden')) {
    closeRowActionModal();
  } else if (!scaleRowModal.classList.contains('hidden')) {
    closeScaleRowModal();
  } else if (!revertConfirmModal.classList.contains('hidden')) {
    cancelRevert();
  }
});

matrixResizeHandle.addEventListener('pointerdown', onResizeStart);
matrixResizeHandle.addEventListener('pointerenter', () => matrixContainer.classList.add('bracket-resize-hover'));
matrixResizeHandle.addEventListener('pointerleave', () => matrixContainer.classList.remove('bracket-resize-hover'));
window.addEventListener('pointermove', onResizeMove);
window.addEventListener('pointerup', onResizeEnd);
window.addEventListener('pointercancel', onResizeEnd);
window.addEventListener('dragend', clearDragTargetState);

// Prevent the "no-parking" cursor anywhere on the page during a row drag.
// Actual drop handling remains on the registered drop targets only.
window.addEventListener('dragover', (event) => {
  if (dragSourceRow !== null) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }
});

// Extended swap drop zone: gutter to the left of the drag handles.
if (matrixEditorPanel) {
  matrixEditorPanel.addEventListener('dragover', onPanelDragOver);
  matrixEditorPanel.addEventListener('drop', onPanelDrop);
  matrixEditorPanel.addEventListener('dragleave', (event) => {
    if (!matrixEditorPanel.contains(event.relatedTarget)) {
      clearDragTargetState();
    }
  });
}

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
copyJsonBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(matrixJson.textContent).then(() => {
    const prev = copyJsonBtn.textContent;
    copyJsonBtn.textContent = 'Copied!';
    setTimeout(() => { copyJsonBtn.textContent = prev; }, 1500);
  });
});
swapRowsButton.addEventListener('click', swapRows);
scaleRowButton.addEventListener('click', scaleRow);
addRowButtonTransform.addEventListener('click', addScaledRow);

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

updateFractionModeUI();
renderMatrix();
snapshotHistory('Initial state');
