function renderFlowViz(activeIdx = -1, doneSet = new Set(), jumpedSet = new Set()) {
  const viz = document.getElementById('flowViz');
  viz.innerHTML = '';

  if (army.length === 0) {
    viz.innerHTML = '<span style="color:var(--text-dim);font-size:0.8rem;margin:auto">ユニットを追加するとフローが表示されます</span>';
    return;
  }

  const activeBadges = [];
  if (restrictions.r0) activeBadges.push('<span class="active-restriction-badge">A1:出力½</span>');
  if (restrictions.r1 && disabledNodeIdx >= 0) activeBadges.push(`<span class="active-restriction-badge">A2:#${disabledNodeIdx + 1}停止</span>`);
  if (restrictions.r2) activeBadges.push('<span class="active-restriction-badge">A3:逆順</span>');
  if (activeBadges.length) {
    const badgeRow = document.createElement('div');
    badgeRow.style.cssText = 'position:absolute;top:4px;left:8px;display:flex;gap:4px;z-index:2;flex-wrap:wrap;';
    badgeRow.innerHTML = activeBadges.join('');
    viz.style.position = 'relative';
    viz.appendChild(badgeRow);
  }

  const displayOrder = Array.from({ length: army.length }, (_, i) => i);

  const start = document.createElement('div');
  start.className = 'flow-node';
  const startLabel = restrictions.r2 ? 'END' : 'START';
  const startTheme = restrictions.r2 ? 'theme-atk' : 'theme-sup';
  start.innerHTML = `<div class="node-box ${startTheme}" style="width:48px;min-height:36px;font-size:0.65rem;border-radius:50%">${startLabel}</div>`;
  viz.appendChild(start);

  let currentFlowBlockWrapper = null;
  let prevFlowBlockId = null;

  displayOrder.forEach(rawIdx => {
    const i = restrictions.r2 ? (army.length - 1 - rawIdx) : rawIdx;
    const u = army[i];
    const thisBlockId = u.blockId || null;

    const arr = document.createElement('div');
    arr.className = 'flow-arrow';
    arr.textContent = restrictions.r2 ? '←' : '→';

    if (thisBlockId !== prevFlowBlockId) {
      currentFlowBlockWrapper = null;
      viz.appendChild(arr);
      if (thisBlockId) {
        const bc = blockColor(thisBlockId);
        currentFlowBlockWrapper = document.createElement('div');
        currentFlowBlockWrapper.className = 'flow-block-group';
        currentFlowBlockWrapper.style.borderColor = bc.border;
        currentFlowBlockWrapper.style.background = bc.bg;
        const label = document.createElement('span');
        label.className = 'flow-block-group-label';
        label.style.color = bc.text;
        label.style.borderLeft = `2px solid ${bc.border}`;
        label.style.borderRight = `2px solid ${bc.border}`;
        label.textContent = blockLabel(thisBlockId);
        currentFlowBlockWrapper.appendChild(label);
        viz.appendChild(currentFlowBlockWrapper);
      }
    } else {
      (currentFlowBlockWrapper || viz).appendChild(arr);
    }
    prevFlowBlockId = thisBlockId;

    const node = document.createElement('div');
    node.className = 'flow-node';
    node.id = `flownode-${i}`;

    const isActive = activeIdx === i;
    const isDone = doneSet.has(i);
    const isJumped = jumpedSet.has(i);
    const isDisabled = restrictions.r1 && i === disabledNodeIdx;

    const cls = ['node-box', `theme-${u.theme}`, isActive ? 'active' : '', isDone ? 'done' : '']
      .filter(Boolean)
      .join(' ');

    let branchSummary = '';
    const isVizBlockHead = u.blockId && (i === 0 || army[i - 1]?.blockId !== u.blockId);
    if (isVizBlockHead) {
      const cnd = condNodes.find(c => c.blockId === u.blockId);
      if (cnd) {
        const varLabels = {
          enemyAtk: '敵ATK',
          enemyDef: '敵DEF',
          enemySpearCount: '敵槍兵数',
          enemyArcherCount: '敵弓兵数',
          enemyCavalryCount: '敵騎馬兵数',
          myArcherAmmo: '自軍弓兵残弾',
          enemyIntentAtk: '今ターン敵ATK予告',
        };
        const vl = varLabels[cnd.varType] || cnd.varType;
        const tLabel = cnd.trueBlock ? `Blk${cnd.trueBlock}` : 'END';
        const fLabel = cnd.falseBlock ? `Blk${cnd.falseBlock}` : 'END';
        branchSummary = `<div style="font-size:0.5rem;color:var(--teal);margin-top:2px;border-top:1px solid rgba(22,160,133,0.3);padding-top:2px;">⬡ ${vl}≥${cnd.threshold}<br>T→${tLabel} F→${fLabel}</div>`;
      }
    }

    const halfBadge = restrictions.r0 && !isDisabled
      ? '<div style="position:absolute;top:-6px;left:-6px;font-size:0.55rem;background:rgba(230,126,34,0.8);color:#000;border-radius:3px;padding:1px 3px;">½</div>'
      : '';
    const stopBadge = isDisabled ? '<div class="disabled-node-badge">✕</div>' : '';
    const modeBadge = u.option
      ? `<div style="position:absolute;top:-6px;right:-6px;font-size:0.5rem;padding:1px 3px;border-radius:3px;${u.useOption ? 'background:rgba(230,126,34,0.8);color:#000;' : 'background:rgba(46,109,164,0.7);color:#fff;'}">${u.useOption ? 'OPT' : 'CORE'}</div>`
      : '';
    const hpUnit = myUnitsHp && myUnitsHp[i];
    const crossbowStateBadge = (u.id === 'crossbow' && hpUnit && hpUnit.crossbowLoaded !== undefined)
      ? `<div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);font-size:0.5rem;padding:1px 4px;border-radius:3px;white-space:nowrap;${hpUnit.crossbowLoaded ? 'background:rgba(231,76,60,0.85);color:#fff;' : 'background:rgba(52,152,219,0.7);color:#fff;'}">${hpUnit.crossbowLoaded ? '発射準備完了' : '装填中'}</div>`
      : '';
    const abilityText = u.useOption ? (u.option || u.core) : u.core;

    node.innerHTML = `
      <div class="${cls}" style="${isJumped ? 'opacity:0.25;border-style:dashed' : ''}${isDisabled ? ';border-style:dashed;border-color:var(--orange);opacity:0.5' : ''}${u.useOption ? ';border-color:var(--orange);' : ''};position:relative;">
        ${halfBadge}
        ${stopBadge}
        ${modeBadge}
        ${crossbowStateBadge}
        <div class="node-name">${u.name}</div>
        <div class="node-ability" style="${u.useOption ? 'color:#fca;' : ''}">${abilityText}</div>
        ${branchSummary}
        ${u.blockId ? `<div style="position:absolute;bottom:-1px;left:0;right:0;height:3px;border-radius:0 0 4px 4px;background:${blockColor(u.blockId).border};opacity:0.7;"></div>` : ''}
        ${u.blockExit !== undefined ? `<div style="font-size:0.5rem;color:var(--gold);margin-top:2px;">EXIT→${u.blockExit === null ? 'END' : '#' + (u.blockExit + 1)}</div>` : ''}
        ${(u.blockExitBlock !== undefined && u.blockExitBlock !== null) ? `<div style="font-size:0.5rem;color:var(--gold);margin-top:2px;">EXIT→${u.blockExitBlock === 'flow' ? '続行' : u.blockExitBlock}</div>` : ''}
      </div>
      <div class="flow-label">#${i + 1}${isJumped ? ' ⟶スキップ' : ''}${isDisabled ? ' ⚡停止' : ''}${u.blockId ? ` [${u.blockId}]` : ''}</div>
    `;
    (currentFlowBlockWrapper || viz).appendChild(node);
  });

  const arr2 = document.createElement('div');
  arr2.className = 'flow-arrow';
  arr2.textContent = restrictions.r2 ? '←' : '→';
  viz.appendChild(arr2);

  const end = document.createElement('div');
  end.className = 'flow-node';
  const endLabel = restrictions.r2 ? 'START' : 'END';
  const endTheme = restrictions.r2 ? 'theme-sup' : 'theme-atk';
  end.innerHTML = `<div class="node-box ${endTheme}" style="width:48px;min-height:36px;font-size:0.65rem;border-radius:50%">${endLabel}</div>`;
  viz.appendChild(end);
}

function onFormationChange(key) {
  currentFormationKey = key;
  updateFormationHint();
  if (!battleRunning) {
    renderEnemyPreview();
  }
}

function updateFormationHint() {
  const el = document.getElementById('formationHint');
  if (!el) return;
  const f = ENEMY_FORMATIONS[currentFormationKey];
  el.textContent = f ? f.hint : '';
}

function renderEnemyPreview() {
  const container = document.getElementById('enemyUnits');
  container.innerHTML = '';
  const units = ENEMY_FORMATIONS[currentFormationKey].units;
  units.forEach(e => {
    const card = document.createElement('div');
    card.className = 'unit-card';
    card.innerHTML = `
      <span style="font-size:0.72rem;min-width:28px;color:${e.position === 'front' ? '#f88' : '#fca'}">${e.position === 'front' ? '前' : '後'}</span>
      <span style="font-size:0.8rem;flex:1">${e.name}</span>
      <span style="font-size:0.68rem;color:var(--text-dim)">ATK${e.atk} 🛡${e.armor}</span>
      <div class="hp-bar"><div class="hp-fill" style="width:100%"></div></div>
      <span class="hp-text">${e.maxHp}/${e.maxHp}</span>
    `;
    container.appendChild(card);
  });
}

function renderEnemies() {
  const container = document.getElementById('enemyUnits');
  container.innerHTML = '';
  enemies.forEach(e => {
    const card = document.createElement('div');
    const isFled = e.fled && !e.dead;
    card.className = 'unit-card' + (e.dead ? ' dead' : isFled ? ' fled' : '');
    card.id = `enemy-${e.id}`;
    const hpRatio = Math.max(0, e.hp / e.maxHp);
    const moraleRatio = Math.max(0, e.morale / e.maxMorale);
    const moraleClass = moraleRatio > 0.6 ? 'high' : moraleRatio > 0.3 ? 'mid' : 'low';
    const fledBadge = isFled ? '<span class="fled-badge">💨 離脱</span>' : '';

    card.innerHTML = `
      <span style="font-size:0.72rem;min-width:28px;color:${e.position === 'front' ? '#f88' : '#fca'}">${e.position === 'front' ? '前' : '後'}</span>
      <span style="font-size:0.8rem;flex:1">${e.name}</span>
      ${fledBadge}
      <div class="hp-bar"><div class="hp-fill" style="width:${hpRatio * 100}%"></div></div>
      <span class="hp-text">${e.hp}/${e.maxHp}</span>
      <div class="morale-bar-wrap" title="士気 ${e.morale}/${e.maxMorale}">
        <div class="morale-bar"><div class="morale-fill ${moraleClass}" style="width:${moraleRatio * 100}%"></div></div>
        <span class="morale-text">⚑${e.morale}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderMyUnits() {
  const container = document.getElementById('myUnits');
  container.innerHTML = '';
  myUnitsHp.forEach((u, i) => {
    const card = document.createElement('div');
    card.className = 'unit-card' + (u.dead ? ' dead' : '');
    card.id = `myunit-${i}`;
    const ratio = Math.max(0, u.hp / u.maxHp);
    const armorBadge = (u.armor && u.armor > 0)
      ? `<span style="font-size:0.7rem;color:var(--gold);margin-left:4px">🛡${u.armor}</span>`
      : '';
    card.innerHTML = `
      <span style="font-size:0.8rem;flex:1;color:${themeColor(u.theme)}">${u.name}${armorBadge}</span>
      <div class="hp-bar"><div class="hp-fill" style="width:${ratio * 100}%;background:var(--blue-light)"></div></div>
      <span class="hp-text">${u.hp}/${u.maxHp}</span>
    `;
    container.appendChild(card);
  });
}

function addLog(msg, cls = '') {
  const panel = document.getElementById('logPanel');
  const entry = document.createElement('div');
  entry.className = 'log-entry' + (cls ? ` log-${cls}` : '');
  entry.textContent = msg;
  panel.appendChild(entry);
  panel.scrollTop = panel.scrollHeight;
}

function clearLog() {
  document.getElementById('logPanel').innerHTML = '';
}

function updateResources(atk, def, sup) {
  document.getElementById('resAtk').textContent = atk;
  document.getElementById('resDef').textContent = def;
  document.getElementById('resSup').textContent = sup;
}

function updateAmmoDisplay(ammo, crossbowAmmo) {
  const el = document.getElementById('resAmmo');
  if (el) {
    const hasArcher = army.some(u => u.id === 'archer');
    el.textContent = hasArcher ? ammo : '—';
    el.style.color = (hasArcher && ammo === 0) ? '#f66' : '#fc9';
  }
  const el2 = document.getElementById('resCrossbowAmmo');
  if (el2) {
    const hasCrossbow = army.some(u => u.id === 'crossbow');
    el2.textContent = hasCrossbow ? (crossbowAmmo ?? '—') : '—';
    el2.style.color = (hasCrossbow && crossbowAmmo === 0) ? '#f66' : '#fc9';
  }
}

function updateShieldDisplay(val) {
  const el = document.getElementById('shieldDisplay');
  if (el) el.textContent = val;
  document.getElementById('resDef').textContent = val;
}

function updateEnemyShieldDisplay(val) {
  const el = document.getElementById('enemyShieldDisplay');
  if (el) el.textContent = val;
}

function setPhase(phase) {
  ['build', 'flow', 'battle'].forEach(p => {
    document.getElementById(`ph-${p}`).classList.toggle('active', p === phase);
  });
}

function renderAll() {
  renderRoster();
  renderArmySlots();
  renderFlowViz();
  updateResources(0, 0, army.length);
  refreshA2NodeSelect();
}
