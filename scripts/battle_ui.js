// ===== battle_ui.js =====
// 一時停止・結果ダイアログなどのユーザ操作、敵行動予告パネルや
// フェーズラベルといった戦闘中のUI表示を扱う。

function setPhaseLabel(text, color) {
  const el = document.getElementById('phaseLabel');
  el.textContent = text;
  el.style.color = color;
}

function targetSpecToLabel(targetSpec) {
  const UNIT_NAMES = {
    spear: '槍兵', heavy: '重装歩兵', cavalry: '騎馬兵',
    banner: '軍旗手', archer: '弓兵', crossbow: '弩兵', longbow: '長弓兵',
  };
  const specStr = typeof targetSpec === 'number'
    ? (TARGETED_ATK_UNIT_CODES[targetSpec] || String(targetSpec))
    : String(targetSpec);
  if (specStr === 'rear')   return '最後尾';
  if (specStr === 'max_hp') return '最高HP';
  if (specStr === 'min_hp') return '最低HP';
  return UNIT_NAMES[specStr] || specStr;
}

function renderEnemyIntents() {
  const panel = document.getElementById('enemyIntentPanel');
  const list = document.getElementById('intentList');
  if (!panel || !list) return;
  if (enemyIntents.length === 0) {
    panel.classList.remove('show');
    return;
  }

  panel.classList.add('show');
  list.innerHTML = '';
  enemyIntents.forEach(intent => {
    const enemy = enemies.find(e => e.id === intent.enemyId);
    if (!enemy || enemy.dead) return;

    const item = document.createElement('div');
    item.className = 'intent-item' + (intent.type === 'def' || intent.type === 'buff' ? ' intent-def' : '');
    if (intent.type === 'atk') {
      const atkCount = intent.atkCount || 1;
      const totalDmg = intent.value * atkCount;
      const atkCountLabel = atkCount > 1 ? `×${atkCount}回` : '';
      item.innerHTML = `
        <span class="intent-icon">⚔</span>
        <span class="intent-name">${enemy.name}</span>
        <span class="intent-action">攻撃${atkCountLabel}</span>
        <span class="intent-value">${totalDmg} ダメージ</span>
      `;
    } else if (intent.type === 'targeted_atk') {
      const atkCount = intent.atkCount || 1;
      const totalDmg = intent.value * atkCount;
      const atkCountLabel = atkCount > 1 ? `×${atkCount}回` : '';
      const targetLabel = targetSpecToLabel(intent.targetSpec);
      item.innerHTML = `
        <span class="intent-icon">🎯</span>
        <span class="intent-name">${enemy.name}</span>
        <span class="intent-action">狙い撃ち${atkCountLabel}（${targetLabel}）</span>
        <span class="intent-value">${totalDmg} ダメージ</span>
      `;
    } else if (intent.type === 'buff') {
      const statLabel = { atk: 'ATK', armor: 'アーマー', hp: 'HP' }[intent.stat] || intent.stat;
      const specStr = typeof intent.targetSpec === 'number'
        ? (BUFF_TARGET_CODES[intent.targetSpec] || String(intent.targetSpec))
        : String(intent.targetSpec);
      const BUFF_UNIT_NAMES = {
        none: '雑兵', spear: '槍兵', cavalry: '騎馬兵',
        archer: '弓兵', knight: '騎士', crossbow: '弩兵',
      };
      const targetLabel = BUFF_UNIT_NAMES[specStr] || specStr;
      item.innerHTML = `
        <span class="intent-icon">✨</span>
        <span class="intent-name">${enemy.name}</span>
        <span class="intent-action">バフ（${targetLabel}）</span>
        <span class="intent-value">${statLabel}+${intent.value}</span>
      `;
    } else {
      item.innerHTML = `
        <span class="intent-icon">🛡</span>
        <span class="intent-name">${enemy.name}</span>
        <span class="intent-action">防御態勢（次ターン）</span>
        <span class="intent-value">+${intent.value} シールド</span>
      `;
    }
    list.appendChild(item);
  });
}

function endBattle(victory) {
  battleRunning = false;
  battlePaused = false;
  const pauseBtn = document.getElementById('btnPause');
  pauseBtn.disabled = true;
  pauseBtn.textContent = '⏸ 一時停止';
  pauseBtn.style.borderColor = '';
  pauseBtn.style.color = '';
  setPhase('flow');
  const overlay = document.getElementById('resultOverlay');
  overlay.classList.add('show');
  if (victory === null) {
    document.getElementById('resultTitle').textContent = '時間切れ…';
    document.getElementById('resultTitle').style.color = '#aaa';
    document.getElementById('resultSub').textContent = `${MAX_TURNS}ターン経過 — 決着がつきませんでした`;
    addLog('=== 時間切れ（引き分け） ===', 'sys');
  } else {
    document.getElementById('resultTitle').textContent = victory ? '勝利！' : '敗北…';
    document.getElementById('resultTitle').style.color = victory ? 'var(--gold-bright)' : 'var(--red-light)';
    document.getElementById('resultSub').textContent = victory
      ? `${loopCount} ループで敵を撃破・離脱させました（死亡${enemies.filter(e => e.dead).length}・離脱${enemies.filter(e => e.fled).length}体）`
      : `補給または兵力が尽きました（${loopCount} ループ）`;
    addLog(victory ? '=== 勝利！ ===' : '=== 敗北 ===', 'sys');
  }
}

function closeResult() {
  document.getElementById('resultOverlay').classList.remove('show');
}

function togglePause() {
  if (!battleRunning) return;
  battlePaused = !battlePaused;
  const btn = document.getElementById('btnPause');
  if (battlePaused) {
    btn.textContent = '▶ 再開';
    btn.style.borderColor = 'var(--green)';
    btn.style.color = 'var(--green-light)';
    addLog('⏸ 一時停止中…', 'sys');
  } else {
    btn.textContent = '⏸ 一時停止';
    btn.style.borderColor = '';
    btn.style.color = '';
    addLog('▶ 再開', 'sys');
  }
}
