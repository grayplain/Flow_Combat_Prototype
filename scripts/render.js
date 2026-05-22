// ── ヒットエフェクト用 HP トラッキング ─────────────────────────
let _prevAllyHp  = new Map(); // index → { hp, dead }
let _prevEnemyHp = new Map(); // e.id  → { hp, dead }

// 現在実行中のプレイヤーユニットインデックス（ルンジ用）
let _currentActiveUnitIdx = -1;

/**
 * カード要素にヒットエフェクトを適用し、ダメージ数字をフロートさせる。
 * @param {HTMLElement} el    対象カード要素
 * @param {number}  dmg       ダメージ量（0 なら数字非表示）
 * @param {'hit'|'death'} kind
 */
function applyHitEffect(el, dmg, kind) {
  // アニメーションクラス付与（リセットして再トリガー）
  el.classList.remove('uc-hit', 'uc-death');
  void el.offsetWidth; // reflow
  el.classList.add(kind === 'death' ? 'uc-death' : 'uc-hit');
  el.addEventListener('animationend', () => el.classList.remove('uc-hit', 'uc-death'), { once: true });

  // ダメージフロート数字
  if (dmg > 0) {
    const float = document.createElement('span');
    float.className = 'dmg-float' + (kind === 'death' ? ' dmg-death' : dmg >= 10 ? ' dmg-crit' : '');
    float.textContent = kind === 'death' ? `💀 -${dmg}` : `-${dmg}`;
    // カード右上あたりにランダム配置
    float.style.right  = `${8 + Math.random() * 20}px`;
    float.style.top    = `${4 + Math.random() * 10}px`;
    el.appendChild(float);
    float.addEventListener('animationend', () => float.remove(), { once: true });
  }
}

/**
 * 攻撃ユニットのSVGアイコンをクローンし、対象カードまで飛翔させる。
 * @param {HTMLElement} fromEl  攻撃側カード要素
 * @param {HTMLElement} toEl    被弾側カード要素
 */
function playLungeAnimation(fromEl, toEl) {
  if (!fromEl || !toEl) return;
  const fromSvg = fromEl.querySelector('svg');
  if (!fromSvg) return;

  const fromRect = fromSvg.getBoundingClientRect();
  const toRect   = toEl.getBoundingClientRect();
  if (fromRect.width === 0 || toRect.width === 0) return;

  const isRightward = toRect.left > fromRect.left;

  // 移動量（translate で GPU合成）
  const dx = toRect.left + (toRect.width  - fromRect.width)  / 2 - fromRect.left;
  const dy = toRect.top  + (toRect.height - fromRect.height) / 2 - fromRect.top;

  // クローン生成・初期配置（攻撃方向に傾ける）
  const clone = fromSvg.cloneNode(true);
  clone.style.cssText = `
    position:fixed;
    left:${fromRect.left}px;
    top:${fromRect.top}px;
    width:${fromRect.width}px;
    height:${fromRect.height}px;
    pointer-events:none;
    z-index:9999;
    transform-origin:center;
    opacity:0.92;
    transform:scale(1.25) rotate(${isRightward ? 15 : -15}deg);
  `;
  document.body.appendChild(clone);

  // 1フレーム後にトランジション付きで目標へ移動＆フェードアウト
  requestAnimationFrame(() => requestAnimationFrame(() => {
    clone.style.transition = [
      'transform 0.28s cubic-bezier(0.4,0,1,1)',
      'opacity   0.08s ease 0.22s',
    ].join(',');
    clone.style.transform = `translate(${dx}px,${dy}px) scale(0.65) rotate(${isRightward ? -10 : 10}deg)`;
    clone.style.opacity   = '0';
  }));

  setTimeout(() => clone.remove(), 400);
}

function renderFlowViz(activeIdx = -1, doneSet = new Set(), jumpedSet = new Set()) {
  _currentActiveUnitIdx = activeIdx; // ルンジ用に実行中ユニットを記録
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

  if (typeof renderFlowGraph === 'function') renderFlowGraph();
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
    const meta = ENEMY_META[e.unitType] || ENEMY_META.none;
    card.className = 'unit-card uc-styled';
    card.style.background = `linear-gradient(135deg, ${meta.bgFrom} 0%, ${meta.bgTo} 100%)`;
    card.style.borderColor = meta.hexStroke;
    card.innerHTML = buildEnemyCardHtml(e, true);
    container.appendChild(card);
  });
}

function renderEnemies() {
  const container = document.getElementById('enemyUnits');

  // ── HP 変化を検出 ──
  const hitMap = new Map(); // e.id → { dmg, kind }
  enemies.forEach(e => {
    const prev = _prevEnemyHp.get(e.id);
    if (!prev) return;
    if (!prev.dead && e.dead) {
      hitMap.set(e.id, { dmg: prev.hp, kind: 'death' });
    } else if (!e.dead && e.hp < prev.hp) {
      hitMap.set(e.id, { dmg: prev.hp - e.hp, kind: 'hit' });
    }
  });

  container.innerHTML = '';
  enemies.forEach(e => {
    const card = document.createElement('div');
    const isFled = e.fled && !e.dead;
    const meta = ENEMY_META[e.unitType] || ENEMY_META.none;
    card.className = 'unit-card uc-styled' + (e.dead ? ' dead' : isFled ? ' fled' : '');
    card.style.background = `linear-gradient(135deg, ${meta.bgFrom} 0%, ${meta.bgTo} 100%)`;
    card.style.borderColor = meta.hexStroke;
    card.id = `enemy-${e.id}`;
    card.innerHTML = buildEnemyCardHtml(e, false);
    container.appendChild(card);

    // ── エフェクト適用 ──
    const hit = hitMap.get(e.id);
    if (hit) {
      applyHitEffect(card, hit.dmg, hit.kind);
      // 味方→敵ルンジ（現在実行中のプレイヤーユニットから飛翔）
      if (_currentActiveUnitIdx >= 0) {
        const fromEl = document.getElementById(`myunit-${_currentActiveUnitIdx}`);
        requestAnimationFrame(() => playLungeAnimation(fromEl, card));
      }
    }
  });

  // 前回HP を更新
  _prevEnemyHp = new Map(enemies.map(e => [e.id, { hp: e.hp, dead: e.dead }]));
}

const UNIT_META = {
  spear:         { label: 'SPEARMAN',    accentFrom: '#b8860b', accentTo: '#7a5808', hexFrom: '#243050', hexTo: '#151e30', hexStroke: '#4a6090' },
  heavy:         { label: 'HEAVY INF',   accentFrom: '#607090', accentTo: '#3a4a5a', hexFrom: '#252535', hexTo: '#141420', hexStroke: '#506070' },
  cavalry:       { label: 'CAVALRY',     accentFrom: '#7a5020', accentTo: '#4a3010', hexFrom: '#282015', hexTo: '#181008', hexStroke: '#7a6030' },
  banner:        { label: 'BANNERMAN',   accentFrom: '#1a7a50', accentTo: '#104830', hexFrom: '#152520', hexTo: '#0d1a14', hexStroke: '#3a7055' },
  archer:        { label: 'ARCHER',      accentFrom: '#2e7d32', accentTo: '#1a5c1e', hexFrom: '#182518', hexTo: '#0e1a0e', hexStroke: '#3a6535' },
  crossbow:      { label: 'CROSSBOW',    accentFrom: '#5a3a80', accentTo: '#3a2050', hexFrom: '#201828', hexTo: '#140f1a', hexStroke: '#5a4070' },
  engineer:      { label: 'ENGINEER',    accentFrom: '#4a7a3a', accentTo: '#2a4a20', hexFrom: '#182215', hexTo: '#0f1810', hexStroke: '#406035' },
  militia:       { label: 'MILITIA',     accentFrom: '#8a7050', accentTo: '#5a4830', hexFrom: '#221e14', hexTo: '#16130c', hexStroke: '#605040' },
  pike:          { label: 'PIKEMAN',     accentFrom: '#8a6020', accentTo: '#5a4010', hexFrom: '#221a10', hexTo: '#14100a', hexStroke: '#706030' },
  halberd:       { label: 'HALBERD',     accentFrom: '#7a5530', accentTo: '#4a3518', hexFrom: '#201a10', hexTo: '#14110a', hexStroke: '#606040' },
  longbow:       { label: 'LONGBOW',     accentFrom: '#3a7040', accentTo: '#204828', hexFrom: '#162018', hexTo: '#0e1610', hexStroke: '#406045' },
  spear_knight:  { label: 'SPEAR KNT',  accentFrom: '#c8a030', accentTo: '#8a6818', hexFrom: '#282015', hexTo: '#181308', hexStroke: '#806820' },
  heavy_knight:  { label: 'HEAVY KNT',  accentFrom: '#9090a8', accentTo: '#585870', hexFrom: '#202028', hexTo: '#141418', hexStroke: '#606080' },
  cavalry_knight:{ label: 'KNIGHT',      accentFrom: '#c08030', accentTo: '#805018', hexFrom: '#281e10', hexTo: '#1a130a', hexStroke: '#907040' },
};

function unitHexBadgeSvg(unitId, meta) {
  const { hexFrom, hexTo, hexStroke, accentFrom } = meta;
  // 六角形バッジ（横長・左右に頂点）内にユニットシンボル
  const symbols = {
    spear: `
      <line x1="24" y1="5" x2="24" y2="42" stroke="#8b7355" stroke-width="1.8"/>
      <polygon points="24,3 21,10 27,10" fill="#c8d8e8" stroke="#88a8c8" stroke-width="0.6"/>
      <path d="M10,18 L10,29 Q10,33 14,34 Q18,33 18,29 L18,18 Z" fill="#5c3d1a" stroke="${accentFrom}" stroke-width="0.8"/>
      <circle cx="24" cy="16" r="5" fill="#c8a96a" stroke="#8b6008" stroke-width="0.7"/>
      <ellipse cx="24" cy="13" rx="6" ry="1.8" fill="#7a6030" stroke="#5a4820" stroke-width="0.5"/>`,
    heavy: `
      <path d="M14,8 L34,8 L38,20 L34,38 L14,38 L10,20 Z" fill="#3a4555" stroke="#5a6575" stroke-width="1"/>
      <line x1="14" y1="20" x2="34" y2="20" stroke="#5a6575" stroke-width="0.8"/>
      <line x1="24" y1="8" x2="24" y2="38" stroke="#5a6575" stroke-width="0.6"/>
      <circle cx="24" cy="14" r="5" fill="#c8a96a" stroke="#7a7060" stroke-width="0.7"/>
      <ellipse cx="24" cy="11" rx="7" ry="2" fill="#555565" stroke="#404050" stroke-width="0.6"/>`,
    cavalry: `
      <ellipse cx="26" cy="28" rx="12" ry="7" fill="#6a5030" stroke="#8a6840" stroke-width="0.8"/>
      <circle cx="20" cy="22" r="5" fill="#c8a96a" stroke="#7a6030" stroke-width="0.7"/>
      <line x1="20" y1="27" x2="20" y2="36" stroke="#5a4020" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="14" y1="30" x2="10" y2="40" stroke="#7a6030" stroke-width="2" stroke-linecap="round"/>
      <line x1="22" y1="32" x2="20" y2="42" stroke="#7a6030" stroke-width="2" stroke-linecap="round"/>
      <line x1="28" y1="32" x2="30" y2="42" stroke="#7a6030" stroke-width="2" stroke-linecap="round"/>
      <line x1="34" y1="32" x2="38" y2="42" stroke="#7a6030" stroke-width="2" stroke-linecap="round"/>
      <line x1="15" y1="18" x2="22" y2="12" stroke="#8b7355" stroke-width="1.5"/>
      <polygon points="22,10 19,16 25,16" fill="#c8d8e8"/>`,
    banner: `
      <line x1="20" y1="8" x2="20" y2="44" stroke="#8b7355" stroke-width="2"/>
      <polygon points="20,9 36,16 20,23" fill="#c8a030" stroke="${accentFrom}" stroke-width="0.8"/>
      <circle cx="20" cy="32" r="5" fill="#c8a96a" stroke="#1a7a50" stroke-width="0.7"/>`,
    archer: `
      <path d="M14,8 Q14,28 14,42" fill="none" stroke="#6b5030" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="14" y1="8" x2="14" y2="42" stroke="#a08060" stroke-width="0.8" stroke-dasharray="2,2"/>
      <line x1="14" y1="25" x2="34" y2="25" stroke="#c8a060" stroke-width="1.5"/>
      <polygon points="34,25 30,23 30,27" fill="#d4b070"/>
      <circle cx="30" cy="16" r="5" fill="#c8a96a" stroke="#2e7d32" stroke-width="0.7"/>`,
    crossbow: `
      <rect x="12" y="22" width="22" height="5" rx="2" fill="#5a3a80" stroke="#7a5aaa" stroke-width="0.8"/>
      <line x1="23" y1="5" x2="23" y2="24" stroke="#8b7355" stroke-width="2"/>
      <line x1="12" y1="24" x2="34" y2="24" stroke="#c8a060" stroke-width="1.2"/>
      <polygon points="34,24 30,22 30,26" fill="#d4b070"/>
      <circle cx="23" cy="13" r="5" fill="#c8a96a" stroke="#5a3a80" stroke-width="0.7"/>`,
    engineer: `
      <circle cx="24" cy="24" r="10" fill="none" stroke="#4a7a3a" stroke-width="1.5" stroke-dasharray="4,2"/>
      <circle cx="24" cy="24" r="5" fill="#3a5a2a" stroke="#6aaa50" stroke-width="1"/>
      <line x1="24" y1="10" x2="24" y2="38" stroke="#4a7a3a" stroke-width="1.2"/>
      <line x1="10" y1="24" x2="38" y2="24" stroke="#4a7a3a" stroke-width="1.2"/>`,
  };
  const sym = symbols[unitId] || `
    <line x1="24" y1="8" x2="24" y2="38" stroke="#8b7355" stroke-width="2" stroke-linecap="round"/>
    <line x1="14" y1="20" x2="34" y2="20" stroke="#8b7355" stroke-width="1.5"/>
    <circle cx="24" cy="14" r="5" fill="#c8a96a" stroke="#8b6008" stroke-width="0.7"/>`;

  return `<svg width="48" height="52" viewBox="0 0 48 52" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0">
    <defs>
      <linearGradient id="hbg-${unitId}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${hexFrom}"/>
        <stop offset="100%" stop-color="${hexTo}"/>
      </linearGradient>
      <filter id="hglow-${unitId}">
        <feGaussianBlur stdDeviation="1.2" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <!-- 六角バッジ -->
    <polygon points="24,2 44,13 44,39 24,50 4,39 4,13"
             fill="url(#hbg-${unitId})" stroke="${hexStroke}" stroke-width="1.2"
             filter="url(#hglow-${unitId})"/>
    <!-- ユニットシンボル -->
    <g>${sym}</g>
  </svg>`;
}

function unitSvgIcon(unitId) {
  const meta = UNIT_META[unitId];
  if (!meta) return '';
  return unitHexBadgeSvg(unitId, meta);
}

// ── 敵ユニットメタ ──────────────────────────────────────────
const ENEMY_META = {
  none:        { label: 'SOLDIER',    accent: '#a07050', bgFrom: '#261510', bgTo: '#160d08', hexFrom: '#2a1a10', hexTo: '#180f08', hexStroke: '#6a4020' },
  knight:      { label: 'KNIGHT',     accent: '#d04848', bgFrom: '#2a1015', bgTo: '#1a080d', hexFrom: '#2e1010', hexTo: '#1c0a0a', hexStroke: '#8a2020' },
  archer:      { label: 'ARCHER',     accent: '#80a040', bgFrom: '#181f10', bgTo: '#0f1508', hexFrom: '#1c2210', hexTo: '#12180a', hexStroke: '#507030' },
  spear:       { label: 'SPEAR',      accent: '#c05828', bgFrom: '#281510', bgTo: '#180d08', hexFrom: '#2c1408', hexTo: '#1a0c04', hexStroke: '#7a3818' },
  cavalry:     { label: 'CAVALRY',    accent: '#c08030', bgFrom: '#261a08', bgTo: '#161004', hexFrom: '#2a1c08', hexTo: '#1a1204', hexStroke: '#806020' },
  shield:      { label: 'SHIELDMAN',  accent: '#5888b8', bgFrom: '#101828', bgTo: '#080f1a', hexFrom: '#121a2c', hexTo: '#0a1020', hexStroke: '#304870' },
  crowwbowman: { label: 'CROSSBOW',   accent: '#9060c0', bgFrom: '#1a1025', bgTo: '#100815', hexFrom: '#1e1228', hexTo: '#12091a', hexStroke: '#603890' },
  dummy:       { label: 'DUMMY',      accent: '#606060', bgFrom: '#1a1a1a', bgTo: '#101010', hexFrom: '#1e1e1e', hexTo: '#121212', hexStroke: '#404040' },
};

// 敵ユニットSVGシンボル（`en-` プレフィックスでエイリアスIDを分離）
function enemyHexBadgeSvg(unitType, meta) {
  const { hexFrom, hexTo, hexStroke, accent } = meta;
  const key = `en-${unitType}`;

  const symbols = {
    // 雑兵：粗削りなダガー＋ボロ盾
    none: `
      <path d="M16,8 L16,36 L19,40 L22,36 L22,8 Z" fill="#5a4020" stroke="#8a6030" stroke-width="0.7"/>
      <polygon points="19,5 16,11 22,11" fill="#a09080" stroke="#808070" stroke-width="0.5"/>
      <path d="M26,16 L26,36 Q26,40 30,41 Q34,40 34,36 L34,16 Z" fill="#3a2e1a" stroke="${accent}" stroke-width="0.7" opacity="0.7"/>`,
    // 騎士：フルプレート兜＋大剣
    knight: `
      <rect x="14" y="6" width="14" height="14" rx="2" fill="#3a1010" stroke="${accent}" stroke-width="1"/>
      <rect x="15" y="10" width="12" height="6" rx="1" fill="#1a0808"/>
      <line x1="21" y1="20" x2="21" y2="44" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="14" y1="30" x2="28" y2="30" stroke="${accent}" stroke-width="2"/>
      <polygon points="21,20 18,26 24,26" fill="#c04040"/>`,
    // 弓兵：弓＋矢（反転で敵感）
    archer: `
      <path d="M30,6 Q22,26 30,46" fill="none" stroke="#5a4020" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="30" y1="6" x2="30" y2="46" stroke="#806040" stroke-width="0.8" stroke-dasharray="2,2"/>
      <line x1="30" y1="26" x2="10" y2="26" stroke="#a08040" stroke-width="1.5"/>
      <polygon points="10,26 14,24 14,28" fill="#c0a040"/>
      <circle cx="14" cy="14" r="5" fill="#908060" stroke="${accent}" stroke-width="0.8"/>`,
    // 槍兵：長槍（赤みの強い穂先）
    spear: `
      <line x1="24" y1="5" x2="24" y2="44" stroke="#6a4020" stroke-width="2"/>
      <polygon points="24,3 20,12 28,12" fill="#c06040" stroke="#a04020" stroke-width="0.8"/>
      <path d="M8,18 L8,30 Q8,34 12,35 Q16,34 16,30 L16,18 Z" fill="#3a2010" stroke="${accent}" stroke-width="0.8"/>
      <circle cx="24" cy="18" r="5" fill="#806050" stroke="${accent}" stroke-width="0.7"/>
      <rect x="17" y="10" width="14" height="4" rx="1" fill="#5a3020" opacity="0.8"/>`,
    // 騎馬兵：馬体＋騎乗シルエット（赤みあり）
    cavalry: `
      <ellipse cx="26" cy="32" rx="13" ry="7" fill="#4a3010" stroke="#8a5820" stroke-width="1"/>
      <circle cx="20" cy="22" r="5" fill="#806050" stroke="${accent}" stroke-width="0.8"/>
      <line x1="20" y1="27" x2="20" y2="36" stroke="#4a2808" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="13" y1="34" x2="10" y2="44" stroke="#6a4818" stroke-width="2" stroke-linecap="round"/>
      <line x1="20" y1="36" x2="18" y2="44" stroke="#6a4818" stroke-width="2" stroke-linecap="round"/>
      <line x1="26" y1="36" x2="28" y2="44" stroke="#6a4818" stroke-width="2" stroke-linecap="round"/>
      <line x1="32" y1="34" x2="36" y2="44" stroke="#6a4818" stroke-width="2" stroke-linecap="round"/>`,
    // パヴィス盾兵：巨大盾
    shield: `
      <path d="M10,6 L38,6 L42,22 L38,40 L24,48 L10,40 L6,22 Z"
            fill="#1a2a40" stroke="${accent}" stroke-width="1.2"/>
      <line x1="24" y1="6" x2="24" y2="48" stroke="${accent}" stroke-width="0.6" opacity="0.5"/>
      <line x1="6" y1="22" x2="42" y2="22" stroke="${accent}" stroke-width="0.6" opacity="0.5"/>
      <circle cx="24" cy="26" r="5" fill="#243548" stroke="${accent}" stroke-width="0.8"/>`,
    // 弩兵：弩＋短矢
    crowwbowman: `
      <rect x="10" y="24" width="26" height="5" rx="2" fill="#3a2060" stroke="${accent}" stroke-width="0.8"/>
      <line x1="23" y1="8" x2="23" y2="26" stroke="#5a4060" stroke-width="2"/>
      <line x1="10" y1="26" x2="36" y2="26" stroke="#a080c0" stroke-width="1.2"/>
      <polygon points="36,26 32,24 32,28" fill="#c0a0d0"/>
      <circle cx="23" cy="15" r="5" fill="#6a5080" stroke="${accent}" stroke-width="0.8"/>
      <line x1="12" y1="22" x2="34" y2="22" stroke="${accent}" stroke-width="0.6" opacity="0.6"/>`,
    // ダミー：×マーク
    dummy: `
      <line x1="12" y1="10" x2="36" y2="42" stroke="#505050" stroke-width="3" stroke-linecap="round"/>
      <line x1="36" y1="10" x2="12" y2="42" stroke="#505050" stroke-width="3" stroke-linecap="round"/>
      <circle cx="24" cy="26" r="10" fill="none" stroke="#404040" stroke-width="1.5"/>`,
  };

  const sym = symbols[unitType] || `
    <line x1="24" y1="8" x2="24" y2="38" stroke="#804040" stroke-width="2" stroke-linecap="round"/>
    <line x1="14" y1="22" x2="34" y2="22" stroke="#804040" stroke-width="1.5"/>`;

  return `<svg width="48" height="52" viewBox="0 0 48 52" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0">
    <defs>
      <linearGradient id="hbg-${key}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${hexFrom}"/>
        <stop offset="100%" stop-color="${hexTo}"/>
      </linearGradient>
      <filter id="hglow-${key}">
        <feGaussianBlur stdDeviation="1.2" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <polygon points="24,2 44,13 44,39 24,50 4,39 4,13"
             fill="url(#hbg-${key})" stroke="${hexStroke}" stroke-width="1.2"
             filter="url(#hglow-${key})"/>
    <g>${sym}</g>
  </svg>`;
}

// 敵カードHTML共通ビルダー（プレビュー兼戦闘中）
function buildEnemyCardHtml(e, isPreview) {
  const meta      = ENEMY_META[e.unitType] || ENEMY_META.none;
  const svgIcon   = enemyHexBadgeSvg(e.unitType || 'none', meta);
  const hpCurr    = isPreview ? e.maxHp : e.hp;
  const hpRatio   = Math.max(0, hpCurr / e.maxHp);
  const posColor  = e.position === 'front' ? '#e06060' : '#e0a060';
  const posLabel  = e.position === 'front' ? '前衛' : '後衛';

  // ステータスチップ
  const chips = [];
  chips.push({ icon: '⚔', val: e.atk,              color: '#e06060', bg: 'rgba(180,40,40,0.2)',  border: 'rgba(180,40,40,0.4)' });
  if (e.armor > 0)
    chips.push({ icon: '🛡', val: e.armor,           color: '#7090d0', bg: 'rgba(50,80,160,0.2)',  border: 'rgba(50,80,160,0.35)' });
  if (!isPreview) {
    const moraleRatio = Math.max(0, e.morale / e.maxMorale);
    const moraleColor = moraleRatio > 0.6 ? '#88c060' : moraleRatio > 0.3 ? '#c0b040' : '#c04040';
    chips.push({ icon: '⚑', val: e.morale,           color: moraleColor, bg: 'rgba(80,80,40,0.2)', border: 'rgba(80,80,40,0.35)' });
  }

  const chipsHtml = chips.map(c =>
    `<span class="uc-chip" style="color:${c.color};background:${c.bg};border:1px solid ${c.border}">${c.icon} ${c.val}</span>`
  ).join('');

  const fledBadge = (!isPreview && e.fled && !e.dead)
    ? `<span class="fled-badge">💨 離脱</span>` : '';

  return `
    ${svgIcon}
    <div class="uc-info">
      <div style="display:flex;align-items:baseline;gap:5px">
        <div class="uc-name" style="color:${meta.accent}">${e.name}</div>
        <span style="font-size:0.6rem;color:${posColor};font-family:monospace">${posLabel}</span>
        ${fledBadge}
      </div>
      <div class="uc-sub">${meta.label}</div>
      <div class="uc-hp-row">
        <div class="uc-hp-bar">
          <div class="uc-hp-fill" style="width:${hpRatio * 100}%;background:linear-gradient(90deg,#8b1a1a,#c03030)"></div>
        </div>
        <span style="font-size:0.6rem;color:#a06060;margin-left:4px;white-space:nowrap">${hpCurr}/${e.maxHp}</span>
      </div>
      <div class="uc-chips">${chipsHtml}</div>
    </div>
  `;
}

function renderMyUnits() {
  const container = document.getElementById('myUnits');

  // ── HP 変化を検出（再描画前に前回値と比較）──
  const hitMap = new Map(); // index → { dmg, kind }
  myUnitsHp.forEach((u, i) => {
    const prev = _prevAllyHp.get(i);
    if (!prev) return;
    if (!prev.dead && u.dead) {
      hitMap.set(i, { dmg: prev.hp, kind: 'death' });
    } else if (!u.dead && u.hp < prev.hp) {
      hitMap.set(i, { dmg: prev.hp - u.hp, kind: 'hit' });
    }
  });

  container.innerHTML = '';
  myUnitsHp.forEach((u, i) => {
    const card = document.createElement('div');
    card.className = 'unit-card uc-styled' + (u.dead ? ' dead' : '');
    card.id = `myunit-${i}`;

    const ratio    = Math.max(0, u.hp / u.maxHp);
    const meta     = UNIT_META[u.id] || {};
    if (meta.hexFrom) {
      card.style.background = `linear-gradient(135deg, ${meta.hexFrom}cc 0%, ${meta.hexTo}cc 100%)`;
      card.style.borderColor = meta.hexStroke;
    }
    const svgIcon  = unitSvgIcon(u.id);
    const label    = meta.label || u.name.toUpperCase();
    const accent   = meta.accentFrom || '#b8860b';

    const chips = [];
    if (u.armor > 0) chips.push({ icon: '🛡', val: u.armor, color: '#7090d0', bg: 'rgba(70,100,160,0.2)', border: 'rgba(70,100,160,0.4)' });
    chips.push({ icon: '❤', val: `${u.hp}/${u.maxHp}`, color: '#e87060', bg: 'rgba(192,57,43,0.2)', border: 'rgba(192,57,43,0.4)' });
    const chipsHtml = chips.map(c =>
      `<span class="uc-chip" style="color:${c.color};background:${c.bg};border:1px solid ${c.border}">${c.icon} ${c.val}</span>`
    ).join('');

    card.innerHTML = `
      ${svgIcon}
      <div class="uc-info">
        <div class="uc-name" style="color:${accent}">${u.name}</div>
        <div class="uc-sub">${label}</div>
        <div class="uc-hp-row">
          <div class="uc-hp-bar">
            <div class="uc-hp-fill" style="width:${ratio * 100}%"></div>
          </div>
        </div>
        <div class="uc-chips">${chipsHtml}</div>
      </div>
    `;
    container.appendChild(card);

    // ── エフェクト適用 ──
    const hit = hitMap.get(i);
    if (hit) applyHitEffect(card, hit.dmg, hit.kind);
  });

  // 前回HP を更新
  _prevAllyHp = new Map(myUnitsHp.map((u, i) => [i, { hp: u.hp, dead: u.dead }]));
}

function addLog(msg, cls = '') {
  const panel = document.getElementById('logPanel');
  const entry = document.createElement('div');
  entry.className = 'log-entry' + (cls ? ` log-${cls}` : '');
  entry.textContent = msg;
  panel.appendChild(entry);
  panel.scrollTop = panel.scrollHeight;

  // ── 敵→味方ルンジ検出 ────────────────────────────────────────
  // 攻撃ログ（cls:'atk'）に "name → name：Nダメージ" パターンがあれば飛翔
  if (cls === 'atk' && typeof enemies !== 'undefined' && typeof myUnitsHp !== 'undefined') {
    const arrowIdx = msg.indexOf('→');
    if (arrowIdx > 1) { // → の前に何かある（攻撃者名）
      const beforeArrow = msg.substring(0, arrowIdx).trim();
      const afterArrow  = msg.substring(arrowIdx + 1);
      const targetPart  = afterArrow.split('：')[0].trim();

      // 名前が長い敵を優先してマッチ（部分一致防止）
      const sortedEnemies = [...enemies].sort((a, b) => b.name.length - a.name.length);
      const attEnemy = sortedEnemies.find(e => !e.dead && !e.fled && beforeArrow.includes(e.name));
      const tgtIdx   = myUnitsHp.findIndex(u => !u.dead && u.name === targetPart);

      if (attEnemy && tgtIdx >= 0) {
        const fromEl = document.getElementById(`enemy-${attEnemy.id}`);
        const toEl   = document.getElementById(`myunit-${tgtIdx}`);
        requestAnimationFrame(() => playLungeAnimation(fromEl, toEl));
      }
    }
  }
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

// ── フロー構造サイドパネル（参照ビュー） ───────────────
function toggleFlowGraph(force) {
  const panel = document.getElementById('flowGraphPanel');
  const btn = document.getElementById('btnFlowGraph');
  if (!panel) return;
  const wantOpen = (typeof force === 'boolean') ? force : !panel.classList.contains('open');
  panel.classList.toggle('open', wantOpen);
  panel.setAttribute('aria-hidden', wantOpen ? 'false' : 'true');
  if (btn) btn.classList.toggle('is-active', wantOpen);
  if (wantOpen) renderFlowGraph();
}

const FLOW_GRAPH_VAR_LABELS = {
  enemyAtk: '敵ATK', enemyDef: '敵DEF',
  enemySpearCount: '敵槍兵数', enemyArcherCount: '敵弓兵数', enemyCavalryCount: '敵騎馬兵数',
  myArcherAmmo: '自軍弓兵残弾', enemyIntentAtk: '今ターン敵ATK予告',
};

const FLOW_GRAPH_UNIT_SHORT = {
  spear: '槍', heavy: '重歩', cavalry: '騎', banner: '旗',
  spear_knight: '槍騎', heavy_knight: '重騎', cavalry_knight: '騎士',
  archer: '弓', longbow: '長弓', crossbow: '弩',
  engineer: '補', militia: '民', pike: '槍兵', halberd: 'ハル',
};

function _fgEscape(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderFlowGraph() {
  const panel = document.getElementById('flowGraphPanel');
  if (!panel || !panel.classList.contains('open')) return;
  const container = document.getElementById('flowGraphContent');
  if (!container) return;

  if (!army || army.length === 0) {
    container.innerHTML = '<div class="flow-graph-empty">ユニットを追加すると<br>フロー構造が表示されます</div>';
    return;
  }

  // セグメント分割（連続する同一blockIdをひとまとめ）
  const segs = [];
  army.forEach(u => {
    const bid = u.blockId || null;
    let last = segs[segs.length - 1];
    if (!last || last.blockId !== bid) {
      last = { blockId: bid, units: [] };
      segs.push(last);
    }
    last.units.push(u);
  });
  segs.forEach(seg => {
    if (seg.blockId) {
      seg.cond = condNodes.find(c => c.blockId === seg.blockId) || null;
      const lastU = seg.units[seg.units.length - 1];
      // 未設定（undefined）→ 次のブロックへ続行として描画。明示的に null（ユーザーがENDを選択）の場合のみ END。
      if (lastU.blockExitBlock === null) seg.exit = 'end';
      else if (lastU.blockExitBlock === undefined) seg.exit = 'flow';
      else if (lastU.blockExitBlock === 'flow') seg.exit = 'flow';
      else seg.exit = lastU.blockExitBlock;
    } else {
      seg.cond = null;
      seg.exit = 'flow';
    }
  });

  // レイアウト
  const PANEL_W = 296;
  const NODE_X = 30;
  const NODE_W = 180;
  const COL_CX = NODE_X + NODE_W / 2;
  const ENDPT_W = 90;
  const ENDPT_H = 34;
  const COND_H = 70;
  const VGAP_MAIN = 32;
  const VGAP_COND = 16;
  const TITLE_H = 22;
  const CHIP_H = 18;
  const CHIP_GAP = 4;
  const CHIPS_PER_ROW = 3;
  const BLOCK_PAD_BOTTOM = 10;
  const SIDE_LEFT_X = NODE_X - 14;
  const SIDE_RIGHT_X = NODE_X + NODE_W + 14;

  let y = 14;
  const startBox = { x: COL_CX - ENDPT_W / 2, y, w: ENDPT_W, h: ENDPT_H, label: 'START' };
  y += ENDPT_H + VGAP_MAIN;

  segs.forEach(seg => {
    if (seg.cond) {
      seg.condBox = { x: NODE_X, y, w: NODE_W, h: COND_H };
      y += COND_H + VGAP_COND;
    }
    const chipRows = Math.max(1, Math.ceil(seg.units.length / CHIPS_PER_ROW));
    const h = TITLE_H + chipRows * (CHIP_H + CHIP_GAP) + BLOCK_PAD_BOTTOM;
    seg.box = { x: NODE_X, y, w: NODE_W, h };
    y += h + VGAP_MAIN;
  });

  const endBox = { x: COL_CX - ENDPT_W / 2, y, w: ENDPT_W, h: ENDPT_H, label: 'END' };
  y += ENDPT_H + 14;
  const totalH = y;

  const segByBlockId = {};
  segs.forEach(seg => { if (seg.blockId) segByBlockId[seg.blockId] = seg; });

  const segEntryPoint = seg => seg.condBox
    ? { x: seg.condBox.x + seg.condBox.w / 2, y: seg.condBox.y }
    : { x: seg.box.x + seg.box.w / 2, y: seg.box.y };

  const resolveTarget = (val, fallbackSeg) => {
    if (val === null || val === undefined) {
      return fallbackSeg ? { x: fallbackSeg.box.x + fallbackSeg.box.w / 2, y: fallbackSeg.box.y } : null;
    }
    if (val === 'end') return { x: endBox.x + endBox.w / 2, y: endBox.y };
    const s = segByBlockId[val];
    if (!s) return null;
    return segEntryPoint(s);
  };

  // 障害物ボックス（直線矢印の貫通判定用）
  const allBoxes = [startBox, endBox];
  segs.forEach(seg => {
    if (seg.condBox) allBoxes.push(seg.condBox);
    allBoxes.push(seg.box);
  });

  // 出力バッファをレイヤごとに分ける（z順制御）
  const arrowParts = [];
  const endpointParts = [];
  const condParts = [];
  const blockParts = [];
  const labelParts = [];

  // 端点（START / END）
  const drawEndpoint = b => {
    endpointParts.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.h / 2}" fill="#1e2535" stroke="#6a7a90" stroke-width="1.4"/>`);
    endpointParts.push(`<text x="${b.x + b.w / 2}" y="${b.y + b.h / 2 + 5}" text-anchor="middle" font-family="Cinzel,serif" font-size="13" font-weight="700" fill="#d4c4a0" letter-spacing="3">${b.label}</text>`);
  };
  drawEndpoint(startBox);
  drawEndpoint(endBox);

  // 条件ノード
  segs.forEach(seg => {
    if (!seg.cond) return;
    const b = seg.condBox;
    const bc = blockColor(seg.blockId);
    const vlbl = FLOW_GRAPH_VAR_LABELS[seg.cond.varType] || seg.cond.varType;
    condParts.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="5" fill="${bc.bg}" stroke="${bc.border}" stroke-width="1.4" stroke-dasharray="5 3"/>`);
    condParts.push(`<text x="${b.x + 8}" y="${b.y + 14}" font-family="Cinzel,serif" font-size="10" fill="${bc.text}" letter-spacing="1">⬡ COND ${_fgEscape(blockLabel(seg.blockId))}</text>`);
    condParts.push(`<text x="${b.x + b.w / 2}" y="${b.y + 38}" text-anchor="middle" font-family="Crimson Text,serif" font-size="13" font-weight="600" fill="#f0e8d0">${_fgEscape(vlbl)} ≥ ${seg.cond.threshold}</text>`);
    const tLbl = seg.cond.trueBlock === null ? '通常' : (seg.cond.trueBlock === 'end' ? 'END' : blockLabel(seg.cond.trueBlock));
    const fLbl = seg.cond.falseBlock === null ? '通常' : (seg.cond.falseBlock === 'end' ? 'END' : blockLabel(seg.cond.falseBlock));
    condParts.push(`<text x="${b.x + 10}" y="${b.y + b.h - 8}" font-family="Crimson Text,serif" font-size="10" fill="#5cba68">T→${_fgEscape(tLbl)}</text>`);
    condParts.push(`<text x="${b.x + b.w - 10}" y="${b.y + b.h - 8}" text-anchor="end" font-family="Crimson Text,serif" font-size="10" fill="#e74c3c">F→${_fgEscape(fLbl)}</text>`);
  });

  // ブロックセグメント
  segs.forEach(seg => {
    const b = seg.box;
    let title;
    let bc;
    if (seg.blockId) {
      bc = blockColor(seg.blockId);
      title = blockLabel(seg.blockId);
    } else {
      bc = { bg: 'rgba(100,110,130,0.10)', border: '#3a4458', text: '#a0acc0' };
      title = '未設定 / 条件なし';
    }
    blockParts.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6" fill="${bc.bg}" stroke="${bc.border}" stroke-width="1.5"/>`);
    blockParts.push(`<text x="${b.x + 10}" y="${b.y + 15}" font-family="Cinzel,serif" font-size="11" font-weight="700" fill="${bc.text}" letter-spacing="1.5">${_fgEscape(title)}</text>`);

    seg.units.forEach((u, ui) => {
      const row = Math.floor(ui / CHIPS_PER_ROW);
      const col = ui % CHIPS_PER_ROW;
      const cw = (b.w - 16 - CHIP_GAP * (CHIPS_PER_ROW - 1)) / CHIPS_PER_ROW;
      const cx = b.x + 8 + col * (cw + CHIP_GAP);
      const cy = b.y + TITLE_H + row * (CHIP_H + CHIP_GAP);
      const hasOpt = !!u.option;
      const isOpt = !!u.useOption;
      const chipFill = isOpt ? 'rgba(230,126,34,0.22)' : 'rgba(46,109,164,0.22)';
      const chipStroke = isOpt ? '#e67e22' : '#4a9fd4';
      const chipText = isOpt ? '#fca' : '#9cf';
      const short = FLOW_GRAPH_UNIT_SHORT[u.id] || (u.name || u.id).slice(0, 2);
      const mark = hasOpt ? (isOpt ? '◆' : '○') : '';
      blockParts.push(`<rect x="${cx}" y="${cy}" width="${cw}" height="${CHIP_H}" rx="3" fill="${chipFill}" stroke="${chipStroke}" stroke-width="1"/>`);
      blockParts.push(`<text x="${cx + cw / 2}" y="${cy + CHIP_H / 2 + 4}" text-anchor="middle" font-family="Crimson Text,serif" font-size="10" fill="${chipText}">${_fgEscape(mark + short)}</text>`);
    });
  });

  // 同列の直線が他ボックスを貫通するか
  const isLineObstructed = (lineX, y1, y2) => {
    const lo = Math.min(y1, y2) + 0.5;
    const hi = Math.max(y1, y2) - 0.5;
    return allBoxes.some(b => {
      if (hi <= b.y || lo >= b.y + b.h) return false;
      if (lineX <= b.x || lineX >= b.x + b.w) return false;
      return true;
    });
  };

  // 矢印描画（直線 or 直角ルート）
  // opts.enterFrom: 'top' (default) | 'left' | 'right' — ターゲットのどの辺に進入するか
  const drawArrow = (sx, sy, tx, ty, opts) => {
    const color = opts.color;
    const marker = opts.marker;
    const dashed = !!opts.dashed;
    const label = opts.label;
    const sideHint = opts.side; // 'left' | 'right'
    const enterFrom = opts.enterFrom || 'top';

    let d;
    let labelX;
    let labelY;

    if (enterFrom === 'top') {
      const endX = tx;
      const endY = ty - 5;
      const sameCol = Math.abs(tx - sx) < 2;
      const downward = endY > sy + 2;
      if (sameCol && downward && !isLineObstructed(sx, sy, endY)) {
        // 直線（同列・障害物なし）
        d = `M ${sx} ${sy} L ${endX} ${endY}`;
        labelX = sx + 22;
        labelY = (sy + endY) / 2;
      } else {
        // 直角ルート（サイドレーン経由）：最後に縦の進入セグメントを足して矢印を下向きに揃える
        const useLeft = sideHint === 'left' || (sideHint == null && tx < sx);
        const apex = useLeft ? SIDE_LEFT_X : SIDE_RIGHT_X;
        const approachY = endY - 6;
        d = `M ${sx} ${sy} L ${apex} ${sy} L ${apex} ${approachY} L ${endX} ${approachY} L ${endX} ${endY}`;
        labelX = apex;
        labelY = (sy + approachY) / 2;
      }
    } else {
      // 横入り：ノード左端 or 右端で終端、矢じりも横向き
      const useLeft = enterFrom === 'left';
      const apex = useLeft ? SIDE_LEFT_X : SIDE_RIGHT_X;
      const endX = useLeft ? (tx - 5) : (tx + 5);
      const endY = ty;
      d = `M ${sx} ${sy} L ${apex} ${sy} L ${apex} ${endY} L ${endX} ${endY}`;
      labelX = apex;
      labelY = (sy + endY) / 2;
    }

    const dashAttr = dashed ? ' stroke-dasharray="5 4"' : '';
    arrowParts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="1.7" stroke-linejoin="miter" stroke-linecap="butt"${dashAttr} marker-end="url(#${marker})"/>`);

    if (label) {
      labelParts.push(`<rect x="${labelX - 17}" y="${labelY - 8}" width="34" height="14" rx="3" fill="#0a0d12" stroke="${color}" stroke-width="1"/>`);
      labelParts.push(`<text x="${labelX}" y="${labelY + 3}" text-anchor="middle" font-family="Cinzel,serif" font-size="9" font-weight="700" fill="${color}" letter-spacing="0.5">${label}</text>`);
    }
  };

  // 条件分岐の終端を「ノード左端 / 右端」に変換するヘルパー
  // val: trueBlock or falseBlock の値、fromSide: 'left' or 'right'
  // 戻り値: { x, y, enterFrom } または null
  const getCondSideEntry = (val, fallbackSeg, fromSide) => {
    if (val === 'end') {
      // END は小さく中央寄せなので上端進入のまま
      return { x: endBox.x + endBox.w / 2, y: endBox.y, enterFrom: 'top' };
    }
    const targetSeg = (val === null || val === undefined) ? fallbackSeg : segByBlockId[val];
    if (!targetSeg) return null;
    const targetBox = targetSeg.condBox || targetSeg.box;
    if (fromSide === 'left') {
      return { x: targetBox.x, y: targetBox.y + targetBox.h / 2, enterFrom: 'left' };
    }
    return { x: targetBox.x + targetBox.w, y: targetBox.y + targetBox.h / 2, enterFrom: 'right' };
  };

  // START → 先頭セグメント（または END）
  if (segs.length === 0) {
    drawArrow(startBox.x + startBox.w / 2, startBox.y + startBox.h, endBox.x + endBox.w / 2, endBox.y,
      { color: '#c9a84c', marker: 'fg-ah-gold' });
  } else {
    const first = segs[0];
    const tgt = segEntryPoint(first);
    drawArrow(startBox.x + startBox.w / 2, startBox.y + startBox.h, tgt.x, tgt.y,
      { color: '#c9a84c', marker: 'fg-ah-gold' });
  }

  // condの TRUE/FALSE 両方が自ブロック以外を指す＝そのブロックは実行されない（バイパスされる）
  const segIsBypassedByCond = seg => {
    if (!seg.cond) return false;
    const c = seg.cond;
    const tEntersOwn = (c.trueBlock === null || c.trueBlock === seg.blockId);
    const fEntersOwn = (c.falseBlock === null || c.falseBlock === seg.blockId);
    return !tEntersOwn && !fEntersOwn;
  };

  // 各セグメントの出力エッジ
  segs.forEach((seg, si) => {
    if (seg.cond) {
      const cb = seg.condBox;
      const cy = cb.y + cb.h;
      const tTarget = resolveTarget(seg.cond.trueBlock, seg);
      const fTarget = resolveTarget(seg.cond.falseBlock, seg);
      // 自分のブロック（=condが付いている当該ブロック）を指しているかどうか
      const tIsOwn = (seg.cond.trueBlock === null || seg.cond.trueBlock === seg.blockId);
      const fIsOwn = (seg.cond.falseBlock === null || seg.cond.falseBlock === seg.blockId);
      const bothOwn = tIsOwn && fIsOwn;

      if (tTarget) {
        if (tIsOwn && !bothOwn) {
          // 自分のブロックへ直進（cond中央から直下、上端進入）
          drawArrow(cb.x + cb.w / 2, cy, tTarget.x, tTarget.y, {
            color: '#5cba68', marker: 'fg-ah-green', label: 'TRUE',
          });
        } else {
          // サイドレーン経由→ノード左端で終端
          const entry = getCondSideEntry(seg.cond.trueBlock, seg, 'left') || tTarget;
          drawArrow(cb.x + 28, cy, entry.x, entry.y, {
            color: '#5cba68', marker: 'fg-ah-green', label: 'TRUE',
            side: 'left', enterFrom: entry.enterFrom,
          });
        }
      }
      if (fTarget) {
        if (fIsOwn && !bothOwn) {
          drawArrow(cb.x + cb.w / 2, cy, fTarget.x, fTarget.y, {
            color: '#e74c3c', marker: 'fg-ah-red', label: 'FALSE', dashed: true,
          });
        } else {
          // サイドレーン経由→ノード右端で終端
          const entry = getCondSideEntry(seg.cond.falseBlock, seg, 'right') || fTarget;
          drawArrow(cb.x + cb.w - 28, cy, entry.x, entry.y, {
            color: '#e74c3c', marker: 'fg-ah-red', label: 'FALSE', dashed: true,
            side: 'right', enterFrom: entry.enterFrom,
          });
        }
      }
    }
    // condのT/Fが両方とも自ブロックを通らない場合、このブロックは実行されないのでEXIT通常フローは描かない
    if (segIsBypassedByCond(seg)) return;

    const ep = { x: seg.box.x + seg.box.w / 2, y: seg.box.y + seg.box.h };
    let tgt;
    let color = '#c9a84c';
    let marker = 'fg-ah-gold';
    let side;
    if (seg.exit === 'end') {
      tgt = { x: endBox.x + endBox.w / 2, y: endBox.y };
    } else if (seg.exit === 'flow') {
      if (si + 1 < segs.length) {
        tgt = segEntryPoint(segs[si + 1]);
      } else {
        tgt = { x: endBox.x + endBox.w / 2, y: endBox.y };
      }
    } else {
      tgt = resolveTarget(seg.exit, null) || { x: endBox.x + endBox.w / 2, y: endBox.y };
      color = '#8aa0c0';
      marker = 'fg-ah-dim';
      side = 'right';
    }
    drawArrow(ep.x, ep.y, tgt.x, tgt.y, { color, marker, side });
  });

  // 組み立て（z順: defs → 矢印 → 端点 → 条件 → ブロック → 矢印ラベル）
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PANEL_W} ${totalH}" width="${PANEL_W}" height="${totalH}">`);
  parts.push(`
    <defs>
      <marker id="fg-ah-gold" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#c9a84c"/></marker>
      <marker id="fg-ah-green" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#5cba68"/></marker>
      <marker id="fg-ah-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#e74c3c"/></marker>
      <marker id="fg-ah-dim" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#8aa0c0"/></marker>
    </defs>
  `);
  parts.push(...arrowParts, ...endpointParts, ...condParts, ...blockParts, ...labelParts);
  parts.push('</svg>');
  container.innerHTML = parts.join('');
}
