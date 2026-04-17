function getSpeed() {
  return parseInt(document.getElementById('speedSlider').value, 10);
}

function updateRestriction(idx) {
  const cb = document.getElementById(`restrict-${idx}`);
  restrictions[`r${idx}`] = cb.checked;
  const opt = document.getElementById(`restrict-opt-${idx}`);
  opt.classList.toggle('selected', cb.checked);
  if (idx === 1) {
    const row = document.getElementById('a2NodeSelectRow');
    if (row) row.style.display = cb.checked ? 'flex' : 'none';
    if (cb.checked) refreshA2NodeSelect();
  }
}

function updateA2NodeTarget(value) {
  a2NodeTarget = value;
}

function setDeadMode(skip) {
  deadNodeSkip = skip;
  document.getElementById('dead-opt-0').classList.toggle('selected', !skip);
  document.getElementById('dead-opt-1').classList.toggle('selected', skip);
  document.getElementById('dead-0').checked = !skip;
  document.getElementById('dead-1').checked = skip;
}

function refreshA2NodeSelect() {
  const sel = document.getElementById('a2NodeSelect');
  if (!sel) return;
  const prev = a2NodeTarget;
  sel.innerHTML = '<option value="random">🎲 ランダム</option>';
  for (let i = 0; i < 10; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    const u = army[i];
    opt.textContent = u ? `#${i + 1} ${u.name}` : `#${i + 1} （未配置）`;
    if (!u) opt.style.color = '#6a7a90';
    if (String(i) === String(prev)) opt.selected = true;
    sel.appendChild(opt);
  }
  if (prev !== 'random') sel.value = String(prev);
}

function renderIntentConfigPanel() {
  const list = document.getElementById('intentConfigList');
  if (!list) return;
  list.innerHTML = '';

  getEnemyTemplate().forEach(e => {
    if (!intentConfig[e.id]) {
      intentConfig[e.id] = { type: 'random', value: e.atk };
    }
    const cfg = intentConfig[e.id];

    const row = document.createElement('div');
    row.className = 'intent-config-row';
    const posClass = e.position === 'front' ? 'pos-front' : 'pos-rear';
    const posLabel = e.position === 'front' ? '前' : '後';

    row.innerHTML = `
      <span class="pos-badge ${posClass}">${posLabel}</span>
      <span class="enemy-label">${e.name}</span>
      <select class="intent-type-select" id="ictype-${e.id}" onchange="updateIntentConfig('${e.id}','type',this.value)">
        <option value="random" ${cfg.type === 'random' ? 'selected' : ''}>🎲 ランダム</option>
        <option value="atk" ${cfg.type === 'atk' ? 'selected' : ''}>⚔ 攻撃</option>
        <option value="def" ${cfg.type === 'def' ? 'selected' : ''}>🛡 防御態勢</option>
      </select>
      <input class="intent-val-input" id="icval-${e.id}" type="number" min="1" max="20"
        value="${cfg.value}"
        ${cfg.type === 'random' ? 'disabled' : ''}
        onchange="updateIntentConfig('${e.id}','value',parseInt(this.value)||1)">
    `;
    list.appendChild(row);
  });
}

function updateIntentConfig(enemyId, key, value) {
  if (!intentConfig[enemyId]) intentConfig[enemyId] = { type: 'random', value: 4 };
  intentConfig[enemyId][key] = value;
  const valEl = document.getElementById(`icval-${enemyId}`);
  if (valEl) valEl.disabled = intentConfig[enemyId].type === 'random';
}

function lockIntentConfig(lock) {
  getEnemyTemplate().forEach(e => {
    const sel = document.getElementById(`ictype-${e.id}`);
    const val = document.getElementById(`icval-${e.id}`);
    if (sel) sel.disabled = lock;
    if (val) val.disabled = lock || (intentConfig[e.id] && intentConfig[e.id].type === 'random');
  });
}

function lockRestrictions(lock) {
  [0, 1, 2].forEach(i => {
    document.getElementById(`restrict-${i}`).disabled = lock;
    document.getElementById(`restrict-opt-${i}`).style.opacity = lock ? '0.7' : '1';
    document.getElementById(`restrict-opt-${i}`).style.cursor = lock ? 'default' : 'pointer';
  });
  const a2Sel = document.getElementById('a2NodeSelect');
  if (a2Sel) a2Sel.disabled = lock;
}

function initFormationSelect() {
  const sel = document.getElementById('formationSelect');
  if (!sel) return;
  sel.innerHTML = '';
  Object.entries(ENEMY_FORMATIONS).forEach(([key, f]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = f.label || key;
    sel.appendChild(opt);
  });
  sel.value = currentFormationKey;
}

function init() {
  initFormationSelect();
  renderRoster();
  renderArmySlots();
  renderFlowViz();
  updateFormationHint();
  renderEnemyPreview();
  updateSupplyDisplay();
  refreshA2NodeSelect();
}

let currentRosterTab = '傭兵';

function switchRosterTab(tab, el) {
  currentRosterTab = tab;
  document.querySelectorAll('.roster-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderRoster();
}

function renderRoster() {
  const grid = document.getElementById('rosterGrid');
  grid.innerHTML = '';
  const tabUnits = currentRosterTab === '傭兵'
    ? UNITS.filter(u => !u.faction)
    : UNITS.filter(u => u.faction === currentRosterTab);
  if (tabUnits.length === 0) {
    grid.innerHTML = '<span style="color:var(--text-dim);font-size:0.75rem;grid-column:1/-1;padding:8px 0;">（準備中）</span>';
    return;
  }
  tabUnits.forEach(u => {
    const disabled = army.length >= 10;
    const btn = document.createElement('button');
    btn.className = 'unit-btn' + (disabled ? ' disabled' : '');
    btn.innerHTML = `
      <span class="uname">${u.name}</span>
      <span class="ucore">${u.core}</span>
      <span class="utag ${u.tag}">${u.tagLabel}</span>
    `;
    if (!disabled) btn.onclick = () => addUnit(u);
    grid.appendChild(btn);
  });
}

function addUnit(unit) {
  if (army.length >= 10) return;
  if (unit.isKnightRank) {
    const knightCount = army.filter(u => u.isKnightRank).length;
    if (knightCount >= 2) {
      alert('精鋭枠は★版合算で最大2体までです（槍騎士・重装騎士・騎士の合計）');
      return;
    }
  }
  const entry = { ...unit, useOption: false, blockId: null, blockExit: undefined };
  army.push(entry);
  renderAll();
}

function updateBlockId(idx, val) {
  army[idx].blockId = val === 'none' ? null : val;
  renderAll();
}

function updateBlockExitBlock(idx, val) {
  army[idx].blockExitBlock = val === 'end' ? null : val;
  renderFlowViz();
}

function updateBlockExit(idx, val) {
  army[idx].blockExit = val === 'none' ? undefined : (val === 'end' ? null : parseInt(val, 10));
  renderFlowViz();
}

function addCondNode(blockId) {
  if (condNodes.find(c => c.blockId === blockId)) return;
  condNodeCounter++;
  condNodes.push({
    id: `cond_${condNodeCounter}`,
    blockId,
    varType: 'enemySpearCount',
    threshold: 1,
    trueBlock: null,
    falseBlock: null,
    trueSpearMode: null,
    falseSpearMode: null,
  });
  renderAll();
}

function removeCondNode(condId) {
  condNodes = condNodes.filter(c => c.id !== condId);
  renderAll();
}

function updateCondNode(condId, key, value) {
  const c = condNodes.find(c => c.id === condId);
  if (c) {
    c[key] = value;
    renderFlowViz();
  }
}

function addCondNodeAndOpen(blockId) {
  addCondNode(blockId);
  const created = condNodes.find(c => c.blockId === blockId);
  if (created) openCondOverlay(created.id);
}

function openCondOverlay(condId) {
  const cnd = condNodes.find(c => c.id === condId);
  if (!cnd) return;
  const box = document.getElementById('condOverlayBox');
  if (!box) return;
  const headColor = blockColor(cnd.blockId);
  const varOptions = `
    <option value="enemySpearCount" ${cnd.varType === 'enemySpearCount' ? 'selected' : ''}>敵槍兵の数</option>
    <option value="enemyArcherCount" ${cnd.varType === 'enemyArcherCount' ? 'selected' : ''}>敵弓兵の数</option>
    <option value="enemyCavalryCount" ${cnd.varType === 'enemyCavalryCount' ? 'selected' : ''}>敵騎馬兵の数</option>
    <option value="enemyAtk" ${cnd.varType === 'enemyAtk' ? 'selected' : ''}>敵ATK合計</option>
    <option value="enemyDef" ${cnd.varType === 'enemyDef' ? 'selected' : ''}>敵DEF合計</option>
    <option value="enemyIntentAtk" ${cnd.varType === 'enemyIntentAtk' ? 'selected' : ''}>🔮 今ターン敵ATK予告</option>
    <option value="myArcherAmmo" ${cnd.varType === 'myArcherAmmo' ? 'selected' : ''}>自軍弓兵残弾数</option>
  `;
  const blockOpts = sel => `
    <option value="" ${!sel ? 'selected' : ''}>→ 分岐なし（通常フロー）</option>
    <option value="end" ${sel === 'end' ? 'selected' : ''}>→ ENDへ</option>
    <option value="A" ${sel === 'A' ? 'selected' : ''}>→ ブロックA</option>
    <option value="B" ${sel === 'B' ? 'selected' : ''}>→ ブロックB</option>
    <option value="C" ${sel === 'C' ? 'selected' : ''}>→ ブロックC</option>
    <option value="D" ${sel === 'D' ? 'selected' : ''}>→ ブロックD</option>
  `;
  const hasSpear = army.some(unit => unit.blockId === cnd.blockId && unit.id === 'spear');
  box.style.borderColor = headColor.border;
  box.innerHTML = `
    <div class="cond-overlay-header">
      <span class="cond-overlay-title" style="color:${headColor.text};">⬡ ${blockLabel(cnd.blockId)}の前の条件ノード</span>
      <button type="button" class="cond-overlay-close" onclick="closeCondOverlay()">閉じる</button>
    </div>
    <div style="font-size:0.7rem;color:var(--text-dim);line-height:1.5;">
      フロー開始時に評価されます。条件式が TRUE / FALSE のときの分岐先をそれぞれ指定してください。
    </div>
    <div class="branch-row">
      <label style="min-width:64px;">変数：</label>
      <select class="branch-select" onchange="updateCondNode('${cnd.id}','varType',this.value)">
        ${varOptions}
      </select>
    </div>
    <div class="branch-row">
      <label style="min-width:64px;">しきい値：</label>
      <span style="color:var(--text-dim);">≥</span>
      <input class="branch-input" type="number" min="0" max="999" value="${cnd.threshold}"
        onchange="updateCondNode('${cnd.id}','threshold',parseInt(this.value)||0)">
    </div>
    <div class="branch-dest-row">
      <span class="branch-true">TRUE：</span>
      <select class="branch-select" onchange="updateCondNode('${cnd.id}','trueBlock',this.value||null)">
        ${blockOpts(cnd.trueBlock)}
      </select>
    </div>
    <div class="branch-dest-row">
      <span class="branch-false">FALSE：</span>
      <select class="branch-select" onchange="updateCondNode('${cnd.id}','falseBlock',this.value||null)">
        ${blockOpts(cnd.falseBlock)}
      </select>
    </div>
    ${hasSpear ? `
      <div class="cond-overlay-section">
        <div class="cond-overlay-section-title">⚔ 槍兵の能力切替（このブロック内）</div>
        <div class="branch-dest-row">
          <span class="branch-true">TRUE：</span>
          <select class="branch-select" onchange="updateCondNode('${cnd.id}','trueSpearMode',this.value||null)">
            <option value="" ${!cnd.trueSpearMode ? 'selected' : ''}>→ 変更なし</option>
            <option value="core" ${cnd.trueSpearMode === 'core' ? 'selected' : ''}>→ コア（突撃）</option>
            <option value="option" ${cnd.trueSpearMode === 'option' ? 'selected' : ''}>→ オプション（陣形）</option>
          </select>
        </div>
        <div class="branch-dest-row">
          <span class="branch-false">FALSE：</span>
          <select class="branch-select" onchange="updateCondNode('${cnd.id}','falseSpearMode',this.value||null)">
            <option value="" ${!cnd.falseSpearMode ? 'selected' : ''}>→ 変更なし</option>
            <option value="core" ${cnd.falseSpearMode === 'core' ? 'selected' : ''}>→ コア（突撃）</option>
            <option value="option" ${cnd.falseSpearMode === 'option' ? 'selected' : ''}>→ オプション（陣形）</option>
          </select>
        </div>
      </div>
    ` : ''}
    <button type="button" class="cond-overlay-remove" onclick="removeCondNodeFromOverlay('${cnd.id}')">この条件ノードを削除</button>
  `;
  document.getElementById('condOverlay').classList.add('show');
}

function closeCondOverlay() {
  const ov = document.getElementById('condOverlay');
  if (ov) ov.classList.remove('show');
}

function onCondOverlayBackdropClick(event) {
  if (event.target && event.target.id === 'condOverlay') {
    closeCondOverlay();
  }
}

function removeCondNodeFromOverlay(condId) {
  removeCondNode(condId);
  closeCondOverlay();
}

function shiftCondNodesAfterRemove(removedIdx) {
  const removedBlockId = army[removedIdx]?.blockId;
  if (removedBlockId) {
    const remainsInBlock = army.some((u, i) => i !== removedIdx && u.blockId === removedBlockId);
    if (!remainsInBlock) {
      condNodes = condNodes.filter(c => c.blockId !== removedBlockId);
    }
  }
}

function blockLabel(blockId) {
  if (!blockId) return '—';
  const labels = { A: 'ブロックA', B: 'ブロックB', C: 'ブロックC', D: 'ブロックD' };
  return labels[blockId] || blockId;
}

function blockColor(blockId) {
  const colors = {
    A: { bg: 'rgba(46,109,164,0.25)', border: '#2e6da4', text: '#4a9fd4' },
    B: { bg: 'rgba(192,57,43,0.25)', border: '#c0392b', text: '#e74c3c' },
    C: { bg: 'rgba(142,68,173,0.25)', border: '#8e44ad', text: '#bb8fce' },
    D: { bg: 'rgba(39,174,96,0.2)', border: '#27ae60', text: '#5cba68' },
  };
  return colors[blockId] || { bg: 'rgba(100,100,100,0.15)', border: '#666', text: '#aaa' };
}

let dragIdx = null;

function getDropZone(e, slot) {
  const rect = slot.getBoundingClientRect();
  const ratio = (e.clientY - rect.top) / rect.height;
  if (ratio < 0.2) return 'upper';
  if (ratio > 0.8) return 'lower';
  return 'middle';
}

function resolveDropAction(srcIdx, destIdx, zone) {
  if (srcIdx === null || srcIdx === destIdx) return null;
  const srcB = army[srcIdx] ? (army[srcIdx].blockId || null) : null;
  const destB = army[destIdx] ? (army[destIdx].blockId || null) : null;

  if (destB && destB !== srcB) {
    return { type: 'endOfBlock', blockId: destB };
  }

  if (zone === 'middle') return null;

  return {
    type: 'relative',
    destIdx,
    position: zone === 'upper' ? 'before' : 'after',
    newBlockId: destB,
  };
}

function applyDropIndicator(slot, action) {
  if (!action) return;
  if (action.type === 'relative') {
    slot.classList.add(action.position === 'before' ? 'drop-before' : 'drop-after');
  } else if (action.type === 'endOfBlock') {
    const wrapper = slot.closest('.block-group');
    if (wrapper) wrapper.classList.add('drop-into');
  }
}

function clearDropIndicators() {
  document.querySelectorAll('.slot.drop-before, .slot.drop-after').forEach(el => {
    el.classList.remove('drop-before', 'drop-after');
  });
  document.querySelectorAll('.block-group.drop-into').forEach(el => {
    el.classList.remove('drop-into');
  });
  const c = document.getElementById('armySlots');
  if (c) c.classList.remove('drop-end');
}

function executeDropAction(srcIdx, action) {
  if (!action || srcIdx === null) return;
  if (action.type === 'relative') {
    moveUnitRelative(srcIdx, action.destIdx, action.position, action.newBlockId);
  } else if (action.type === 'endOfBlock') {
    moveUnitToEndOfBlock(srcIdx, action.blockId);
  }
}

function moveUnitRelative(srcIdx, destIdx, position, newBlockId) {
  const [item] = army.splice(srcIdx, 1);
  item.blockId = newBlockId;
  let insertAt;
  if (position === 'before') {
    insertAt = srcIdx < destIdx ? destIdx - 1 : destIdx;
  } else {
    insertAt = srcIdx < destIdx ? destIdx : destIdx + 1;
  }
  army.splice(insertAt, 0, item);
  cleanupEmptyBlocks();
  renderAll();
}

function moveUnitToEndOfBlock(srcIdx, blockId) {
  const [item] = army.splice(srcIdx, 1);
  item.blockId = blockId;
  let insertAt = army.length;
  for (let i = army.length - 1; i >= 0; i--) {
    if (army[i].blockId === blockId) {
      insertAt = i + 1;
      break;
    }
  }
  army.splice(insertAt, 0, item);
  cleanupEmptyBlocks();
  renderAll();
}

function moveUnitToEnd(srcIdx) {
  const [item] = army.splice(srcIdx, 1);
  item.blockId = null;
  army.push(item);
  cleanupEmptyBlocks();
  renderAll();
}

function cleanupEmptyBlocks() {
  condNodes = condNodes.filter(c => army.some(u => u.blockId === c.blockId));
}

function renderArmySlots() {
  const container = document.getElementById('armySlots');
  container.innerHTML = '';

  if (!container._dragBound) {
    container._dragBound = true;
    container.addEventListener('dragover', e => {
      if (dragIdx === null) return;
      if (e.target !== container) return;
      e.preventDefault();
      clearDropIndicators();
      container.classList.add('drop-end');
    });
    container.addEventListener('dragleave', e => {
      if (container.contains(e.relatedTarget)) return;
      clearDropIndicators();
    });
    container.addEventListener('drop', e => {
      if (e.target !== container) return;
      e.preventDefault();
      const src = dragIdx;
      clearDropIndicators();
      dragIdx = null;
      if (src !== null) moveUnitToEnd(src);
    });
  }

  let currentBlockWrapper = null;
  let currentBlockIdInRender = null;

  army.forEach((u, i) => {
    const thisBlockId = u.blockId || null;
    if (thisBlockId !== currentBlockIdInRender) {
      currentBlockIdInRender = thisBlockId;
      if (thisBlockId) {
        const bc = blockColor(thisBlockId);
        currentBlockWrapper = document.createElement('div');
        currentBlockWrapper.className = 'block-group';
        currentBlockWrapper.style.borderColor = bc.border;
        currentBlockWrapper.style.background = bc.bg;
        const label = document.createElement('span');
        label.className = 'block-group-label';
        label.style.color = bc.text;
        label.style.borderLeft = `2px solid ${bc.border}`;
        label.style.borderRight = `2px solid ${bc.border}`;
        label.textContent = blockLabel(thisBlockId);
        currentBlockWrapper.appendChild(label);
        container.appendChild(currentBlockWrapper);
      } else {
        currentBlockWrapper = null;
      }
    }

    const slot = document.createElement('div');
    slot.className = 'slot filled';
    slot.style.flexDirection = 'column';
    slot.style.alignItems = 'stretch';
    slot.style.cursor = 'default';
    slot.dataset.idx = i;

    const mainRow = document.createElement('div');
    mainRow.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:grab;';
    mainRow.draggable = true;
    const modeLabel = u.useOption
      ? '<span style="font-size:0.6rem;color:#fca;background:rgba(230,126,34,0.2);border:1px solid rgba(230,126,34,0.4);border-radius:3px;padding:1px 4px;">OPT</span>'
      : '<span style="font-size:0.6rem;color:#9cf;background:rgba(46,109,164,0.2);border:1px solid rgba(46,109,164,0.4);border-radius:3px;padding:1px 4px;">CORE</span>';
    const abilityText = u.useOption ? (u.option || 'オプションなし') : u.core;
    mainRow.innerHTML = `
      <span class="slot-num">${i + 1}</span>
      <span class="slot-name" style="color:${themeColor(u.theme)}">${u.name}</span>
      ${modeLabel}
      <span style="font-size:0.62rem;color:var(--text-dim);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${abilityText}</span>
      <span class="slot-remove" onclick="removeUnit(${i})" style="cursor:pointer;flex-shrink:0;">✕</span>
    `;
    mainRow.addEventListener('dragstart', e => {
      dragIdx = i;
      mainRow.style.opacity = '0.4';
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      e.stopPropagation();
    });
    mainRow.addEventListener('dragend', () => {
      dragIdx = null;
      mainRow.style.opacity = '1';
      clearDropIndicators();
    });
    slot.addEventListener('dragover', e => {
      if (dragIdx === null) return;
      e.preventDefault();
      e.stopPropagation();
      const zone = getDropZone(e, slot);
      const action = resolveDropAction(dragIdx, i, zone);
      clearDropIndicators();
      applyDropIndicator(slot, action);
    });
    slot.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      const zone = getDropZone(e, slot);
      const action = resolveDropAction(dragIdx, i, zone);
      const src = dragIdx;
      clearDropIndicators();
      dragIdx = null;
      executeDropAction(src, action);
    });

    slot.appendChild(mainRow);

    const blockRow = document.createElement('div');
    blockRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;';
    const bc = blockColor(u.blockId);
    const blockSel = document.createElement('select');
    blockSel.style.cssText = `font-size:0.62rem;padding:1px 4px;border-radius:3px;border:1px solid ${bc.border};background:${bc.bg};color:${bc.text};cursor:pointer;`;
    blockSel.innerHTML = `
      <option value="none" ${!u.blockId ? 'selected' : ''}>ブロック未設定</option>
      <option value="A" ${u.blockId === 'A' ? 'selected' : ''}>ブロックA</option>
      <option value="B" ${u.blockId === 'B' ? 'selected' : ''}>ブロックB</option>
      <option value="C" ${u.blockId === 'C' ? 'selected' : ''}>ブロックC</option>
      <option value="D" ${u.blockId === 'D' ? 'selected' : ''}>ブロックD</option>
    `;
    blockSel.onchange = () => updateBlockId(i, blockSel.value);
    blockRow.appendChild(blockSel);

    const isBlockTail = u.blockId && !army.slice(i + 1).some(a => a.blockId === u.blockId);
    if (isBlockTail) {
      const exitLabel = document.createElement('span');
      exitLabel.style.cssText = 'font-size:0.6rem;color:var(--text-dim);';
      exitLabel.textContent = 'EXIT→';
      blockRow.appendChild(exitLabel);
      const exitSel = document.createElement('select');
      exitSel.style.cssText = 'font-size:0.62rem;padding:1px 4px;border-radius:3px;border:1px solid var(--gold-dim);background:rgba(201,168,76,0.1);color:var(--gold);cursor:pointer;';
      exitSel.innerHTML = `
        <option value="end" ${(!u.blockExitBlock && u.blockExitBlock !== 'flow') ? 'selected' : ''}>→ END</option>
        <option value="flow" ${u.blockExitBlock === 'flow' ? 'selected' : ''}>→ 通常フロー（続行）</option>
        <option value="A" ${u.blockExitBlock === 'A' ? 'selected' : ''}>→ ブロックA</option>
        <option value="B" ${u.blockExitBlock === 'B' ? 'selected' : ''}>→ ブロックB</option>
        <option value="C" ${u.blockExitBlock === 'C' ? 'selected' : ''}>→ ブロックC</option>
        <option value="D" ${u.blockExitBlock === 'D' ? 'selected' : ''}>→ ブロックD</option>
      `;
      exitSel.onchange = () => updateBlockExitBlock(i, exitSel.value);
      blockRow.appendChild(exitSel);
    }
    slot.appendChild(blockRow);

    if (u.option) {
      const toggleBtn = document.createElement('button');
      toggleBtn.style.cssText = `display:block;width:100%;font-size:0.6rem;padding:2px 6px;border-radius:3px;border:1px solid ${u.useOption ? 'rgba(230,126,34,0.5)' : 'rgba(46,109,164,0.5)'};background:${u.useOption ? 'rgba(230,126,34,0.15)' : 'rgba(46,109,164,0.15)'};color:${u.useOption ? '#fca' : '#9cf'};cursor:pointer;white-space:nowrap;margin-top:3px;text-align:center;`;
      toggleBtn.textContent = u.useOption ? '▶ コアに切替' : '▶ オプションに切替';
      toggleBtn.onclick = () => toggleOptionMode(i);
      slot.appendChild(toggleBtn);
    }

    if (u.id === 'crossbow') {
      const cbUI = document.createElement('div');
      cbUI.className = 'branch-config';
      const cur = u.crossbowTarget || 'spear';
      cbUI.innerHTML = `
        <div class="branch-config-title">🎯 狙う敵兵種</div>
        <div class="branch-row">
          <select class="branch-select" onchange="updateCrossbowTarget(${i}, this.value)">
            <option value="spear" ${cur === 'spear' ? 'selected' : ''}>敵槍兵</option>
            <option value="archer" ${cur === 'archer' ? 'selected' : ''}>敵弓兵</option>
            <option value="cavalry" ${cur === 'cavalry' ? 'selected' : ''}>敵騎馬兵</option>
          </select>
          <span style="font-size:0.7rem;color:var(--text-dim);margin-left:6px">に即時ダメージ</span>
        </div>
      `;
      slot.appendChild(cbUI);
    }

    if (u.id === 'archer' || u.id === 'longbow') {
      const archerUI = document.createElement('div');
      archerUI.className = 'branch-config';
      const cur = u.archerTarget || 'rear';
      archerUI.innerHTML = `
        <div class="branch-config-title">🏹 狙う対象</div>
        <div class="branch-row">
          <select class="branch-select" onchange="updateArcherTarget(${i}, this.value)">
            <option value="rear" ${cur === 'rear' ? 'selected' : ''}>後衛（デフォルト）</option>
            <option value="front" ${cur === 'front' ? 'selected' : ''}>前衛</option>
          </select>
          <span style="font-size:0.7rem;color:var(--text-dim);margin-left:6px">を狙う</span>
        </div>
      `;
      slot.appendChild(archerUI);
    }

    const isBlockHead = u.blockId && (i === 0 || army[i - 1].blockId !== u.blockId);
    if (isBlockHead) {
      const headColor = blockColor(u.blockId);
      const existingCond = condNodes.find(c => c.blockId === u.blockId);
      if (existingCond) {
        const summary = document.createElement('div');
        summary.className = 'cond-summary-row';
        summary.style.borderColor = headColor.border;
        summary.innerHTML = `
          <span class="cond-summary-label" style="color:${headColor.text};">⬡ ${blockLabel(u.blockId)}の条件分岐</span>
          <span class="cond-summary-status">設定あり</span>
          <button type="button" class="cond-summary-edit" onclick="openCondOverlay('${existingCond.id}')">編集</button>
        `;
        slot.insertBefore(summary, slot.firstChild);
      } else {
        const addCondBtn = document.createElement('button');
        addCondBtn.style.cssText = `display:block;width:100%;font-size:0.6rem;padding:2px 6px;border-radius:3px;border:1px dashed ${headColor.border};background:rgba(22,160,133,0.05);color:${headColor.text};cursor:pointer;margin-bottom:4px;text-align:center;`;
        addCondBtn.textContent = `⬡ ${blockLabel(u.blockId)}の前に条件分岐を追加`;
        addCondBtn.onclick = () => addCondNodeAndOpen(u.blockId);
        slot.insertBefore(addCondBtn, slot.firstChild);
      }
    }

    (currentBlockWrapper || container).appendChild(slot);
  });

  document.getElementById('armyCount').textContent = `${army.length} / 10 体`;
  document.getElementById('btnStartBattle').disabled = army.length === 0;
  updateSupplyDisplay();
}

function updateCrossbowTarget(idx, value) {
  if (army[idx] && army[idx].id === 'crossbow') {
    army[idx].crossbowTarget = value;
    renderFlowViz();
  }
}

function updateArcherTarget(idx, value) {
  if (army[idx] && (army[idx].id === 'archer' || army[idx].id === 'longbow')) {
    army[idx].archerTarget = value;
    renderFlowViz();
  }
}

function toggleOptionMode(idx) {
  if (army[idx] && army[idx].option) {
    army[idx].useOption = !army[idx].useOption;
    renderAll();
  }
}

function removeUnit(idx) {
  shiftCondNodesAfterRemove(idx);
  army.splice(idx, 1);
  renderAll();
}

function updateSupplyDisplay() {
  const sup = army.length;
  const pips = document.getElementById('supplyPips');
  pips.innerHTML = '';
  for (let i = 0; i < sup; i++) {
    const pip = document.createElement('div');
    pip.className = 'pip';
    pips.appendChild(pip);
  }
  document.getElementById('supplyNum').textContent = sup;
}

function themeColor(theme) {
  const map = { atk: '#f88', def: '#8af', sup: '#8f8', ctrl: '#d8a', amp: '#fca', info: '#7dd' };
  return map[theme] || '#fff';
}
