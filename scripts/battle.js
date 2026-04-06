function startBattle() {
  if (army.length === 0) return;
  battleRunning = true;
  battlePaused = false;
  const pauseBtn = document.getElementById('btnPause');
  pauseBtn.disabled = false;
  pauseBtn.textContent = '⏸ 一時停止';
  pauseBtn.style.borderColor = '';
  pauseBtn.style.color = '';
  loopCount = 0;
  turnCount = 0;
  document.getElementById('loopCount').textContent = '0';
  document.getElementById('turnCount').textContent = '0';
  const tl = document.getElementById('turnsLeft');
  if (tl) {
    tl.textContent = MAX_TURNS;
    tl.style.color = 'var(--gold-bright)';
  }

  enemies = getEnemyTemplate().map(e => ({ ...e, morale: e.maxMorale, fled: false }));
  enemyArmyShield = 0;
  updateEnemyShieldDisplay(0);
  const eidElReset = document.getElementById('enemyIntentAtkDisplay');
  if (eidElReset) eidElReset.textContent = '—';
  const UNIT_ARMOR = { spear: 1, crossbow: 1, heavy: 2, spear_knight: 2, heavy_knight: 2, cavalry_knight: 2 };
  myUnitsHp = army.map(u => {
    const armor = UNIT_ARMOR[u.id] || 0;
    return { ...u, hp: u.maxHp || 12, maxHp: u.maxHp || 12, armor, dead: false };
  });

  disabledNodeIdx = -1;
  if (restrictions.r1 && army.length > 0) {
    if (a2NodeTarget === 'random') {
      disabledNodeIdx = Math.floor(Math.random() * army.length);
    } else {
      const t = parseInt(a2NodeTarget, 10);
      disabledNodeIdx = (t >= 0 && t < army.length) ? t : Math.floor(Math.random() * army.length);
    }
    addLog(`⚠ [A2] ノード #${disabledNodeIdx + 1}「${army[disabledNodeIdx].name}」が機能停止！`, 'sys');
  }

  if (restrictions.r2) {
    addLog('⚠ [A3] フロー逆順実行！ENDからSTARTへ向かう', 'sys');
  }

  if (restrictions.r0) {
    addLog('⚠ [A1] 出力半減！全ノードの数値出力が½になる', 'sys');
  }

  lockRestrictions(true);
  clearLog();
  renderEnemies();
  renderMyUnits();
  setPhase('battle');
  renderFlowViz();

  battleState = {
    atk: 0,
    atkRear: 0,
    def: 0,
    supply: deadNodeSkip ? myUnitsHp.filter(u => !u.dead).length : army.length,
    shield: 0,
    lastOutput: 0,
    lastInstant: 0,
    lastType: null,
    nextBonus: 0,
    intimidate: 0,
    archerAtkDebuff: 0,
    carryOver: null,
    scoutInfo: null,
    pendingMoraleDamage: 0,
    archerCounterCount: 0,
    archerMaxCount: enemies.filter(e => e.unitType === 'archer').length * 3,
    archerAmmo: army.filter(u => u.id === 'archer' || u.id === 'longbow').length * 5,
    crossbowAmmo: army.filter(u => u.id === 'crossbow').length * 5,
    prevLoopAtk: 0,
    prevLoopDef: 0,
    resolvedJumps: {},
  };

  updateResources(0, 0, battleState.supply);
  updateAmmoDisplay(battleState.archerAmmo || 0, battleState.crossbowAmmo || 0);
  updateShieldDisplay(0);
  addLog(`=== 戦闘開始！ 初期補給：${army.length} ===`, 'sys');
  addLog(`敵ユニット ${enemies.length} 体`, 'sys');

  const activeR = [];
  if (restrictions.r0) activeR.push('A1:出力半減');
  if (restrictions.r1) activeR.push(`A2:機能停止(#${disabledNodeIdx + 1})`);
  if (restrictions.r2) activeR.push('A3:逆順');
  if (activeR.length) addLog(`📛 制限: ${activeR.join(' / ')}`, 'sys');

  setTimeout(() => runTurn(), 400);
}

function generateEnemyIntents() {
  enemyIntents = [];
  enemies.filter(e => !e.dead && !e.fled).forEach(e => {
    const cfg = intentConfig[e.id] || { type: 'random', value: e.atk };

    if (cfg.type === 'atk') {
      enemyIntents.push({ enemyId: e.id, type: 'atk', value: cfg.value });
    } else if (cfg.type === 'def') {
      enemyIntents.push({ enemyId: e.id, type: 'def', value: cfg.value });
    } else {
      const defChance = e.position === 'rear' ? 0.4 : 0.2;
      if (Math.random() < defChance) {
        const defVal = Math.floor(Math.random() * 4) + 2;
        enemyIntents.push({ enemyId: e.id, type: 'def', value: defVal });
      } else {
        const atkVal = e.atk + Math.floor(Math.random() * 3) - 1;
        enemyIntents.push({ enemyId: e.id, type: 'atk', value: Math.max(1, atkVal) });
      }
    }
  });
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
    item.className = 'intent-item' + (intent.type === 'def' ? ' intent-def' : '');
    if (intent.type === 'atk') {
      item.innerHTML = `
        <span class="intent-icon">⚔</span>
        <span class="intent-name">${enemy.name}</span>
        <span class="intent-action">攻撃</span>
        <span class="intent-value">${intent.value} ダメージ</span>
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

async function runTurn() {
  if (!battleRunning) return;

  turnCount++;
  document.getElementById('turnCount').textContent = turnCount;
  loopCount = 0;
  document.getElementById('loopCount').textContent = '0';

  const left = Math.max(0, MAX_TURNS - turnCount + 1);
  const turnsLeftEl = document.getElementById('turnsLeft');
  turnsLeftEl.textContent = left;
  turnsLeftEl.style.color = left <= 3 ? 'var(--red-light)' : left <= 5 ? '#fca' : 'var(--gold-bright)';

  if (turnCount > MAX_TURNS) {
    addLog(`⌛ ${MAX_TURNS}ターン経過 → 時間切れ（引き分け）`, 'sys');
    endBattle(null);
    return;
  }

  const aliveCount = deadNodeSkip ? myUnitsHp.filter(u => !u.dead).length : army.length;
  battleState.supply = aliveCount;
  battleState.atk = 0;
  battleState.atkRear = 0;
  battleState.def = 0;
  battleState.shield = 0;
  updateShieldDisplay(0);
  enemyArmyShield = 0;
  updateEnemyShieldDisplay(0);

  if (battleState.carryOver) {
    battleState.atk += battleState.carryOver.atk;
    battleState.def += battleState.carryOver.def;
    addLog(`　↩ 重装歩兵の持越し：ATK+${battleState.carryOver.atk} DEF+${battleState.carryOver.def}`, 'amp');
    battleState.carryOver = null;
  }

  updateResources(0, 0, battleState.supply);
  updateAmmoDisplay(battleState.archerAmmo || 0, battleState.crossbowAmmo || 0);

  generateEnemyIntents();
  battleState.enemyIntentAtk = enemyIntents.reduce((s, i) => i.type === 'atk' ? s + i.value : s, 0);
  renderEnemyIntents();
  const eidEl = document.getElementById('enemyIntentAtkDisplay');
  if (eidEl) eidEl.textContent = battleState.enemyIntentAtk;
  addLog(`🔮 敵行動予告：合計ATK ${battleState.enemyIntentAtk}（${enemyIntents.filter(i => i.type === 'atk').length}体が攻撃予定）`, 'sys');

  setPhaseLabel('自軍攻撃フェーズ', '#f0d080');
  addLog(`━━ ターン ${turnCount}：自軍攻撃フェーズ（補給${battleState.supply}・最大${MAX_LOOPS}ループ）━━`, 'sys');

  const execOrder = restrictions.r2
    ? Array.from({ length: army.length }, (_, i) => army.length - 1 - i)
    : Array.from({ length: army.length }, (_, i) => i);

  if (restrictions.r2 && loopCount === 0) {
    addLog('📛 [A3] 逆順フロー実行中', 'sys');
  }

  while (battleRunning && loopCount < MAX_LOOPS && battleState.supply > 0) {
    loopCount++;
    document.getElementById('loopCount').textContent = loopCount;
    addLog(`── ループ ${loopCount}（補給残：${battleState.supply}）──`, 'sys');

    battleState.resolvedJumps = {};
    battleState.resolvedSpearMode = {};
    condNodes.forEach(cnd => {
      const alive = enemies.filter(e => !e.dead && !e.fled);
      let val;
      let label;
      if (cnd.varType === 'enemyAtk') {
        val = alive.reduce((s, e) => s + e.atk, 0);
        label = `敵ATK ${val}`;
      } else if (cnd.varType === 'enemyDef') {
        val = enemyArmyShield;
        label = `敵DEF(軍団シールド) ${val}`;
      } else if (cnd.varType === 'enemySpearCount') {
        val = alive.filter(e => e.unitType === 'spear').length;
        label = `敵槍兵 ${val}体`;
      } else if (cnd.varType === 'enemyArcherCount') {
        val = alive.filter(e => e.unitType === 'archer').length;
        label = `敵弓兵 ${val}体`;
      } else if (cnd.varType === 'enemyCavalryCount') {
        val = alive.filter(e => e.unitType === 'cavalry').length;
        label = `敵騎馬兵 ${val}体`;
      } else if (cnd.varType === 'myArcherAmmo') {
        val = battleState.archerAmmo || 0;
        label = `自軍弓兵残弾 ${val}`;
      } else if (cnd.varType === 'enemyIntentAtk') {
        val = battleState.enemyIntentAtk || 0;
        label = `今ターン敵ATK予告 ${val}`;
      } else {
        val = 0;
        label = '?';
      }
      const condMet = val >= cnd.threshold;
      const dest = condMet ? cnd.trueBlock : cnd.falseBlock;
      const destLabel = !dest ? '（通常フロー）' : dest === 'end' ? 'END' : `ブロック${dest}`;
      battleState.resolvedJumps[cnd.id] = dest || null;
      const spearMode = condMet ? (cnd.trueSpearMode || null) : (cnd.falseSpearMode || null);
      if (spearMode) {
        battleState.resolvedSpearMode = battleState.resolvedSpearMode || {};
        battleState.resolvedSpearMode[cnd.blockId] = spearMode;
      }
      const spearModeLabel = spearMode ? `　槍兵→${spearMode === 'core' ? 'コア' : 'オプション'}` : '';
      addLog(`　⬡ [条件ノード・${blockLabel(cnd.blockId)}前] ${label} ${condMet ? '≥' : '<'} ${cnd.threshold} → ${condMet ? 'TRUE' : 'FALSE'} → ${destLabel}${spearModeLabel}`, 'ctrl');
    });

    const doneSet = new Set();
    const jumpedSet = new Set();
    let orderPos = 0;

    if (!restrictions.r2 && condNodes.length > 0) {
      for (let pos = 0; pos < execOrder.length; pos++) {
        const idx = execOrder[pos];
        const u = army[idx];
        const isHead = u.blockId && (idx === 0 || army[idx - 1]?.blockId !== u.blockId);
        if (!isHead) continue;
        const cnd = condNodes.find(c => c.blockId === u.blockId);
        if (!cnd) continue;
        const dest = battleState.resolvedJumps[cnd.id];

        if (!dest) {
          addLog('　⬡ 条件ノード：通常フロー（先頭から実行）', 'ctrl');
        } else if (dest === 'end') {
          addLog('　⬡ 条件ノード：ENDへ（ループスキップ）', 'ctrl');
          for (let k = 0; k < execOrder.length; k++) jumpedSet.add(execOrder[k]);
          renderFlowViz(-1, doneSet, jumpedSet);
          await sleep(getSpeed());
          orderPos = execOrder.length;
        } else {
          const destIdx = army.findIndex((a, j) => a.blockId === dest && (j === 0 || army[j - 1].blockId !== dest));
          if (destIdx >= 0 && destIdx !== idx) {
            addLog(`　⬡ 条件ノード：ブロック${dest}（#${destIdx + 1}）から開始`, 'ctrl');
            const newPos = execOrder.indexOf(destIdx);
            for (let k = 0; k < destIdx; k++) jumpedSet.add(k);
            renderFlowViz(-1, doneSet, jumpedSet);
            await sleep(getSpeed());
            if (newPos >= 0) orderPos = newPos;
          } else if (destIdx === idx) {
            addLog(`　⬡ 条件ノード：ブロック${dest}（先頭）から実行`, 'ctrl');
          } else {
            addLog(`　⬡ 条件ノード：ブロック${dest}未設定 → 通常フロー`, 'ctrl');
          }
        }
        break;
      }
    }

    while (orderPos < execOrder.length) {
      if (!battleRunning) return;
      const i = execOrder[orderPos];
      const u = army[i];
      const nodeCost = u.supplyCost ?? 1;
      if (battleState.supply < nodeCost) {
        addLog('補給切れ → ループ終了', 'sys');
        break;
      }

      battleState.supply -= nodeCost;
      renderFlowViz(i, doneSet, jumpedSet);

      if (restrictions.r1 && i === disabledNodeIdx) {
        addLog(`📛 [A2] ${u.name}（#${i + 1}）は機能停止中 → スキップ`, 'sys');
        doneSet.add(i);
        renderFlowViz(-1, doneSet, jumpedSet);
        await sleep(getSpeed() * 0.5);
        orderPos++;
        continue;
      }

      if (deadNodeSkip && myUnitsHp[i] && myUnitsHp[i].dead) {
        battleState.supply += nodeCost;
        addLog(`💀 ${u.name}（#${i + 1}）は戦死 → ノードスキップ（補給消費なし）`, 'end');
        jumpedSet.add(i);
        renderFlowViz(-1, doneSet, jumpedSet);
        await sleep(getSpeed() * 0.4);
        orderPos++;
        continue;
      }

      const prevAtk = battleState.atk;
      let useOpt = u.useOption && u.executeOption;
      if (u.id === 'spear' && u.blockId && battleState.resolvedSpearMode && battleState.resolvedSpearMode[u.blockId]) {
        const forced = battleState.resolvedSpearMode[u.blockId];
        useOpt = (forced === 'option') && u.executeOption;
      }
      const pendingBonus = battleState.nextBonus || 0;
      battleState.nextBonus = 0;

      const result = useOpt
        ? u.executeOption(battleState, i, army, enemies, u, loopCount)
        : u.execute(battleState, i, army, enemies, u, loopCount);

      for (const enemy of enemies.filter(e => !e.dead && !e.fled)) {
        const counter = COUNTER_CONFIG[enemy.unitType];
        if (counter && u.id === counter.triggerUnitId && result.targetEnemy === enemy) {
          if (enemy.unitType === 'archer') {
            if (battleState.archerCounterCount >= battleState.archerMaxCount) {
              addLog(`　🏹 ${enemy.name}【${counter.label}】矢切れ（${battleState.archerMaxCount}回上限に達した）`, 'sys');
              continue;
            }
            battleState.archerCounterCount++;
          }
          const targetUnit = myUnitsHp.find(mu => mu.name === u.name && !mu.dead);
          if (targetUnit) {
            targetUnit.hp = Math.max(0, targetUnit.hp - counter.extraDmg);
            if (targetUnit.hp <= 0) targetUnit.dead = true;
          }
          const countMsg = enemy.unitType === 'archer'
            ? `（残り${battleState.archerMaxCount - battleState.archerCounterCount}回）`
            : '';
          addLog(`　⚡ ${enemy.name}【${counter.label}】割り込み！ ${u.name}に即時${counter.extraDmg}ダメージ${countMsg}`, 'atk');
          renderMyUnits();
        }
      }

      if (result.type === 'atk' || result.type === 'instant') {
        const meleeConf = MELEE_RETALIATION[u.id];
        if (meleeConf && meleeConf.isMelee && meleeConf.dmgTaken > 0) {
          const retaliator = enemies.find(e => !e.dead && !e.fled && ENEMY_MELEE_TYPES.has(e.unitType));
          if (retaliator) {
            const targetUnit = myUnitsHp.find(mu => mu.name === u.name && !mu.dead);
            if (targetUnit) {
              targetUnit.hp = Math.max(0, targetUnit.hp - meleeConf.dmgTaken);
              if (targetUnit.hp <= 0) targetUnit.dead = true;
              const deadMsg = targetUnit.dead ? '　→ 撃破！' : `　→ 残HP${targetUnit.hp}`;
              addLog(`　⚔ ${retaliator.name}【近接反撃】${u.name}に${meleeConf.dmgTaken}ダメージ${deadMsg}`, 'atk');
              renderMyUnits();
            }
          }
        }
      }

      if (pendingBonus > 0 && result.type === 'atk') {
        battleState.atk += pendingBonus;
        addLog(`　✨ 集中ボーナス +${pendingBonus} 適用`, 'amp');
      }

      battleState.lastType = result.type;

      if (restrictions.r0) {
        const deltaAtk = battleState.atk - prevAtk;
        if (deltaAtk > 0) {
          const halved = Math.floor(deltaAtk / 2);
          battleState.atk = prevAtk + halved;
          addLog(`📛 [A1] ATK出力が半減 (${deltaAtk}→${halved})`, 'sys');
        }
      }

      const delta = battleState.atk - prevAtk;
      battleState.lastOutput = Math.max(0, delta);
      if (!['spear', 'knight'].includes(u.id)) {
        battleState.lastInstant = 0;
      }

      addLog(result.msg, result.type);
      renderEnemies();
      updateResources(battleState.atk + battleState.atkRear, battleState.def, battleState.supply);
      updateAmmoDisplay(battleState.archerAmmo || 0, battleState.crossbowAmmo || 0);
      doneSet.add(i);

      if (!restrictions.r2 && result.jumpTo !== undefined) {
        const dest = result.jumpTo;
        if (dest === null) {
          addLog('　└ ENDへジャンプ', 'ctrl');
          for (let k = orderPos + 1; k < execOrder.length; k++) jumpedSet.add(execOrder[k]);
          renderFlowViz(-1, doneSet, jumpedSet);
          await sleep(getSpeed());
          break;
        } else if (dest !== execOrder[orderPos + 1]) {
          const newOrderPos = execOrder.indexOf(dest);
          const dir = dest > i ? `#${dest + 1}へジャンプ` : `#${dest + 1}へ戻り`;
          if (dest > i) {
            for (let k = i + 1; k < dest; k++) jumpedSet.add(k);
          }
          addLog(`　└ ${dir}`, 'ctrl');
          renderFlowViz(-1, doneSet, jumpedSet);
          await sleep(getSpeed());
          if (newOrderPos >= 0) {
            orderPos = newOrderPos;
            continue;
          }
          break;
        }
      }

      const isBlockTailExec = u.blockId && !army.slice(i + 1).some(a => a.blockId === u.blockId);
      if (!restrictions.r2 && isBlockTailExec) {
        const exitBlockId = u.blockExitBlock !== undefined ? u.blockExitBlock : null;
        if (exitBlockId === 'flow') {
          addLog(`　└ [${u.blockId}ブロック終端] 通常フロー（続行）`, 'ctrl');
        } else if (exitBlockId === null) {
          addLog(`　└ [${u.blockId}ブロック終端] ENDへ`, 'ctrl');
          for (let k = orderPos + 1; k < execOrder.length; k++) jumpedSet.add(execOrder[k]);
          renderFlowViz(-1, doneSet, jumpedSet);
          await sleep(getSpeed());
          break;
        } else {
          const destIdx = army.findIndex((a, j) => a.blockId === exitBlockId && (j === 0 || army[j - 1].blockId !== exitBlockId));
          if (destIdx >= 0 && destIdx !== i + 1) {
            const newOrderPos = execOrder.indexOf(destIdx);
            addLog(`　└ [${u.blockId}ブロック終端] ブロック${exitBlockId}（#${destIdx + 1}）へジャンプ`, 'ctrl');
            if (destIdx > i) {
              for (let k = i + 1; k < destIdx; k++) jumpedSet.add(k);
            }
            renderFlowViz(-1, doneSet, jumpedSet);
            await sleep(getSpeed());
            if (newOrderPos >= 0) {
              orderPos = newOrderPos;
              continue;
            }
            break;
          } else if (destIdx < 0) {
            addLog(`　└ [${u.blockId}ブロック終端] ブロック${exitBlockId}未設定 → ENDへ`, 'ctrl');
            for (let k = orderPos + 1; k < execOrder.length; k++) jumpedSet.add(execOrder[k]);
            renderFlowViz(-1, doneSet, jumpedSet);
            await sleep(getSpeed());
            break;
          }
        }
      }

      renderFlowViz(-1, doneSet, jumpedSet);
      await sleep(getSpeed());
      orderPos++;
    }

    const loopAtk = battleState.atk;
    const loopAtkRear = battleState.atkRear;
    const loopDef = battleState.def;
    const loopMorale = battleState.pendingMoraleDamage;
    addLog(`── END：蓄積ATK${loopAtk} DEF+${loopDef}${loopMorale > 0 ? ` 蓄積士気-${loopMorale}` : ''} ──`, 'end');

    // ATK・士気ダメージはターンENDで解放するためここでは適用しない

    if (loopDef > 0) {
      battleState.shield += loopDef;
      addLog(`　🛡 シールド +${loopDef} → 累計 ${battleState.shield}`, 'def');
      updateShieldDisplay(battleState.shield);
    }

    if (!enemies.some(e => !e.dead && !e.fled)) {
      endBattle(true);
      return;
    }

    if (battleState.supply <= 0) {
      addLog('補給0 → 自軍攻撃フェーズ終了', 'sys');
      await sleep(getSpeed() * 0.3);
      if (battleState.carryOver) {
        battleState.atk += battleState.carryOver.atk;
        addLog(`　↩ 重装歩兵の持越し適用（ターンEND）`, 'amp');
        battleState.carryOver = null;
      }
      const turnAtk = battleState.atk;
      const turnAtkRear = battleState.atkRear;
      addLog(`　⚔ ターンEND：蓄積ATK ${turnAtk} を解放`, 'atk');
      if (turnAtk > 0 || turnAtkRear > 0) {
        await applyPlayerDamage(turnAtk, turnAtkRear);
      }
      if (battleState.pendingMoraleDamage > 0) {
        await applyMoraleDamage(battleState.pendingMoraleDamage);
        battleState.pendingMoraleDamage = 0;
      }
      setPhaseLabel('敵攻撃', '#e74c3c');
      addLog(`━━ ループ ${loopCount}：敵攻撃 ━━`, 'sys');
      await applyEnemyAttack();
      enemyIntents = [];
      if (!myUnitsHp.some(u => !u.dead)) {
        endBattle(false);
        return;
      }
      break;
    }

    if (loopCount >= MAX_LOOPS) {
      addLog(`${MAX_LOOPS}ループ到達 → 自軍攻撃フェーズ終了`, 'sys');
      await sleep(getSpeed() * 0.3);
      if (battleState.carryOver) {
        battleState.atk += battleState.carryOver.atk;
        addLog(`　↩ 重装歩兵の持越し適用（ターンEND）`, 'amp');
        battleState.carryOver = null;
      }
      const turnAtk = battleState.atk;
      const turnAtkRear = battleState.atkRear;
      addLog(`　⚔ ターンEND：蓄積ATK ${turnAtk} を解放`, 'atk');
      if (turnAtk > 0 || turnAtkRear > 0) {
        await applyPlayerDamage(turnAtk, turnAtkRear);
      }
      if (battleState.pendingMoraleDamage > 0) {
        await applyMoraleDamage(battleState.pendingMoraleDamage);
        battleState.pendingMoraleDamage = 0;
      }
      setPhaseLabel('敵攻撃', '#e74c3c');
      addLog(`━━ ループ ${loopCount}：敵攻撃 ━━`, 'sys');
      await applyEnemyAttack();
      enemyIntents = [];
      if (!myUnitsHp.some(u => !u.dead)) {
        endBattle(false);
        return;
      }
      break;
    }

    const carry = battleState.carryOver;
    battleState.prevLoopAtk = loopAtk;
    battleState.prevLoopDef = loopDef;
    // atk・atkRear・pendingMoraleDamageはターンENDまで蓄積するためリセットしない
    battleState.def = 0;
    battleState.nextBonus = 0;
    battleState.lastType = null;
    battleState.lastInstant = 0;
    if (carry) {
      battleState.atk += carry.atk;
      battleState.carryOver = null;
      addLog('　↩ 重装歩兵の持越し適用', 'amp');
    }
  }

  await sleep(getSpeed() * 0.5);
  runTurn();
}

function setPhaseLabel(text, color) {
  const el = document.getElementById('phaseLabel');
  el.textContent = text;
  el.style.color = color;
}

async function applyPlayerDamage(totalAtk, totalAtkRear) {
  const totalIncoming = totalAtk + totalAtkRear;

  if (enemyArmyShield > 0 && totalIncoming > 0) {
    const absorbed = Math.min(enemyArmyShield, totalIncoming);
    enemyArmyShield -= absorbed;
    const remaining = totalIncoming - absorbed;
    addLog(`　🛡 敵軍団シールドが ${absorbed} 吸収（残シールド：${enemyArmyShield}）`, 'def');
    updateEnemyShieldDisplay(enemyArmyShield);
    renderEnemies();
    if (remaining <= 0) {
      addLog('　敵シールドが全ダメージを防いだ！', 'def');
      renderEnemies();
      updateResources(0, battleState.shield, battleState.supply);
      await sleep(getSpeed() * 0.4);
      return;
    }
    const ratio = remaining / totalIncoming;
    totalAtk = Math.round(totalAtk * ratio);
    totalAtkRear = remaining - totalAtk;
  }

  if (totalAtk > 0) {
    let rem = totalAtk;
    const frontTargets = enemies.filter(e => !e.dead && !e.fled && e.position === 'front');
    const fallbackTargets = enemies.filter(e => !e.dead && !e.fled && e.position === 'rear');
    const atkTargets = frontTargets.length > 0 ? frontTargets : fallbackTargets;
    const atkLabel = frontTargets.length > 0 ? '前衛攻撃' : '前衛攻撃（後衛へ突撃）';
    for (let i = 0; i < atkTargets.length && rem > 0; i++) {
      const dmg = Math.min(rem, atkTargets[i].hp);
      atkTargets[i].hp -= dmg;
      rem -= dmg;
      if (atkTargets[i].hp <= 0) {
        atkTargets[i].dead = true;
        addLog(`　${atkTargets[i].name} 撃破！（HP0・永久消滅）`, 'dmg');
        await triggerDeathMorale(atkTargets[i]);
      }
    }
    addLog(`　⚔ ${atkLabel}：${totalAtk} ダメージ`, 'atk');
  }

  if (totalAtkRear > 0) {
    let rem = totalAtkRear;
    const targets = enemies.filter(e => !e.dead && !e.fled && e.position === 'rear');
    const fallback = enemies.filter(e => !e.dead && !e.fled && e.position === 'front');
    const tgts = targets.length > 0 ? targets : fallback;
    for (let i = 0; i < tgts.length && rem > 0; i++) {
      const dmg = Math.min(rem, tgts[i].hp);
      tgts[i].hp -= dmg;
      rem -= dmg;
      if (tgts[i].hp <= 0) {
        tgts[i].dead = true;
        addLog(`　${tgts[i].name} 撃破！（後衛攻撃・HP0・永久消滅）`, 'dmg');
        await triggerDeathMorale(tgts[i]);
      }
    }
    addLog(`　🏹 後衛攻撃：${totalAtkRear} ダメージ`, 'atk');
  }

  renderEnemies();
  updateResources(0, battleState.shield, battleState.supply);
  await sleep(getSpeed() * 0.4);
}

async function triggerDeathMorale(deadUnit) {
  const alive = enemies.filter(e => !e.dead && !e.fled);
  if (alive.length === 0) return;
  addLog(`　💀 ${deadUnit.name} 死亡 → 生存敵の士気 -2（死亡連鎖）`, 'morale');
  for (const e of alive) {
    e.morale = Math.max(0, e.morale - 2);
    if (e.morale <= 0 && !e.fled) {
      e.fled = true;
      addLog(`　⚠ ${e.name} 士気0 → 離脱！（HPは残存）`, 'morale');
    }
  }
  renderEnemies();
  await sleep(getSpeed() * 0.3);
}

async function applyMoraleDamage(totalMoraleDmg) {
  const targets = enemies.filter(e => !e.dead && !e.fled && e.position === 'front');
  const fallback = enemies.filter(e => !e.dead && !e.fled && e.position === 'rear');
  const tgts = targets.length > 0 ? targets : fallback;

  addLog(`　⚑ 士気攻撃：-${totalMoraleDmg}（騎馬突撃）`, 'morale');
  let rem = totalMoraleDmg;
  for (const e of tgts) {
    if (rem <= 0) break;
    const dmg = Math.min(rem, e.morale);
    e.morale -= dmg;
    rem -= dmg;
    addLog(`　　${e.name}：士気 -${dmg} → 残${e.morale}/${e.maxMorale}`, 'morale');
    if (e.morale <= 0 && !e.fled) {
      e.fled = true;
      addLog(`　　⚠ ${e.name} 士気0 → 離脱！（HPは残存）`, 'morale');
    }
  }
  renderEnemies();
  await sleep(getSpeed() * 0.4);
}

async function applyEnemyAttack() {
  const commander = enemies.find(e => !e.dead && !e.fled && e.isCommander);
  if (commander) {
    const recoveryTargets = enemies.filter(e => !e.dead && !e.fled);
    let recovered = false;
    recoveryTargets.forEach(e => {
      const gain = Math.min(2, e.maxMorale - e.morale);
      if (gain > 0) {
        e.morale += gain;
        recovered = true;
      }
    });
    if (recovered) {
      addLog('　🏳 敵司令官（常駐）：生存敵全体 士気 +2 回復', 'morale');
      renderEnemies();
    }
  }

  if (battleState.intimidate > 0) {
    enemies.filter(e => !e.dead && !e.fled).forEach(e => {
      e.atk = Math.max(0, e.atk - battleState.intimidate);
    });
    addLog(`　😤 威圧効果：敵全体ATK -${battleState.intimidate}`, 'def');
    battleState.intimidate = 0;
  }

  if (battleState.archerAtkDebuff > 0) {
    enemies.filter(e => !e.dead && !e.fled && (e.unitType === 'archer' || e.unitType === 'crossbow')).forEach(e => {
      e.atk = Math.max(0, e.atk - battleState.archerAtkDebuff);
    });
    addLog(`　🏇 射撃牽制効果：敵弓兵・弩兵ATK -${battleState.archerAtkDebuff}`, 'def');
    battleState.archerAtkDebuff = 0;
  }

  function selectTarget(enemy) {
    const alive = myUnitsHp.filter(mu => !mu.dead);
    if (alive.length === 0) return null;
    if (battleState.tauntUnitIdx !== undefined && battleState.tauntUnitIdx !== null) {
      const taunt = myUnitsHp[battleState.tauntUnitIdx];
      if (taunt && !taunt.dead) return taunt;
    }
    const banner = alive.find(mu => mu.id === 'banner');
    if (banner) return banner;
    if (enemy.unitType === 'cavalry') {
      const archerTarget = alive.find(mu => mu.id === 'archer');
      if (archerTarget) return archerTarget;
      const xbowTarget = alive.find(mu => mu.id === 'crossbow');
      if (xbowTarget) return xbowTarget;
      return alive[0];
    }
    if (enemy.unitType === 'archer') {
      return alive.slice().sort((a, b) => a.hp - b.hp)[0];
    }
    return alive[0];
  }

  for (const intent of enemyIntents) {
    const enemy = enemies.find(e => e.id === intent.enemyId);
    if (!enemy || enemy.dead || enemy.fled) continue;
    if (intent.type === 'def') {
      enemyArmyShield += intent.value;
      addLog(`　🛡 ${enemy.name}：防御態勢 → 軍団シールド +${intent.value}（累計${enemyArmyShield}）`, 'def');
      updateEnemyShieldDisplay(enemyArmyShield);
    }
  }

  let totalDealt = 0;

  const aliveEnemyArchers = enemies.filter(e => !e.dead && !e.fled && e.unitType === 'archer');
  if (aliveEnemyArchers.length > 0) {
    const archerCount = aliveEnemyArchers.length;
    const totalArcherDmg = aliveEnemyArchers.reduce((sum, e) => sum + e.atk, 0);
    const targetPos = Math.random() < 0.5 ? 'front' : 'rear';
    const targetPosLabel = targetPos === 'front' ? '前衛' : '後衛';
    const posTargets = myUnitsHp.filter((mu, idx) => !mu.dead && army[idx] && (army[idx].position || 'front') === targetPos);
    const allAlive = myUnitsHp.filter(mu => !mu.dead);
    const shotTargets = posTargets.length > 0 ? posTargets : allAlive;
    const fallbackMsg = posTargets.length === 0 ? `【${targetPosLabel}不在→全体代替】` : '';
    addLog(`　🏹 敵弓兵【斉射×${archerCount}】${fallbackMsg}→ ${targetPosLabel}全体に${totalArcherDmg}ダメージ`, 'atk');
    let archerTotalDealt = 0;
    for (const mu of shotTargets) {
      if (mu.dead) continue;
      let dmg = totalArcherDmg;
      if (battleState.shield > 0) {
        const absorbed = Math.min(battleState.shield, dmg);
        battleState.shield -= absorbed;
        dmg -= absorbed;
        addLog(`　　🛡 シールドが ${absorbed} 吸収（残シールド：${battleState.shield}）`, 'def');
        updateShieldDisplay(battleState.shield);
      }
      if (dmg <= 0) {
        addLog(`　　${mu.name}：シールドが完全防御`, 'def');
        continue;
      }
      const armorVal = mu.armor || 0;
      const actualDmg = Math.max(0, dmg - armorVal);
      if (armorVal > 0) addLog(`　　🛡 ${mu.name}【アーマー${armorVal}】軽減`, 'def');
      mu.hp = Math.max(0, mu.hp - actualDmg);
      archerTotalDealt += actualDmg;
      const deadMsg = mu.hp <= 0 ? '　→ 撃破！' : `　→ 残HP${mu.hp}`;
      addLog(`　　→ ${mu.name}：${actualDmg}ダメージ${deadMsg}`, 'atk');
      if (mu.hp <= 0) {
        mu.dead = true;
        renderMyUnits();
      }
    }
    if (archerTotalDealt > 0) totalDealt += archerTotalDealt;
    renderMyUnits();
  }

  const aliveEnemySpears = enemies.filter(e => !e.dead && !e.fled && e.unitType === 'spear').length;
  const enemySpearBonus = aliveEnemySpears >= 3 ? 2 : aliveEnemySpears === 2 ? 1 : 0;
  const attackers = enemies.filter(e => !e.dead && !e.fled && e.unitType !== 'archer').map(e => {
    const intent = enemyIntents.find(it => it.enemyId === e.id && it.type === 'atk');
    const baseAtk = intent ? intent.value : e.atk;
    const bonus = e.unitType === 'spear' ? enemySpearBonus : 0;
    return { enemy: e, atkVal: baseAtk + bonus, spearBonus: bonus };
  });

  for (const { enemy, atkVal, spearBonus } of attackers) {
    const target = selectTarget(enemy);
    if (!target) break;

    let dmg = atkVal;
    if (battleState.shield > 0) {
      const absorbed = Math.min(battleState.shield, dmg);
      battleState.shield -= absorbed;
      dmg -= absorbed;
      addLog(`　🛡 シールドが ${absorbed} 吸収（${enemy.name}の攻撃、残シールド：${battleState.shield}）`, 'def');
      updateShieldDisplay(battleState.shield);
    }

    if (dmg <= 0) {
      addLog(`　⚔ ${enemy.name} → ${target.name}：シールドが完全防御`, 'def');
      continue;
    }

    const armorVal = target.armor || 0;
    const actualDmg = Math.max(0, dmg - armorVal);
    if (armorVal > 0) addLog(`　🛡 ${target.name}【アーマー${armorVal}】ダメージ軽減`, 'def');

    target.hp = Math.max(0, target.hp - actualDmg);
    totalDealt += actualDmg;

    const typeIcon = { spear: '⚔', archer: '🏹', cavalry: '🐴' }[enemy.unitType] || '⚔';
    const deadMsg = target.hp <= 0 ? '　→ 撃破！' : `　→ 残HP${target.hp}`;
    const spearBonusMsg = spearBonus > 0 ? `【槍衾×${aliveEnemySpears} +${spearBonus}】` : '';
    addLog(`　${typeIcon} ${enemy.name} → ${target.name}：${actualDmg}ダメージ${spearBonusMsg}${deadMsg}`, 'atk');

    if (target.hp <= 0) {
      target.dead = true;
      renderMyUnits();
    }

    if (ENEMY_MELEE_TYPES.has(enemy.unitType) && actualDmg > 0) {
      const retConf = MELEE_RETALIATION[target.id];
      if (retConf && retConf.isMelee && retConf.dmgDealt > 0 && !target.dead) {
        const armorEnemy = enemy.armor || 0;
        const retDmg = Math.max(0, retConf.dmgDealt - armorEnemy);
        if (retDmg > 0) {
          enemy.hp = Math.max(0, enemy.hp - retDmg);
          if (enemy.hp <= 0) enemy.dead = true;
          const retDeadMsg = enemy.dead ? '　→ 撃破！' : `　→ 残HP${enemy.hp}`;
          const armorMsg = armorEnemy > 0 ? `（アーマー${armorEnemy}軽減）` : '';
          addLog(`　↩ ${target.name}【近接反撃】${enemy.name}に${retDmg}ダメージ${armorMsg}${retDeadMsg}`, 'atk');
          renderEnemies();
        }
      }
    }
  }

  battleState.tauntUnitIdx = null;
  addLog(`　敵攻撃フェーズ完了（合計${totalDealt}ダメージ、残シールド：${battleState.shield}）`, 'end');
  renderMyUnits();
  renderEnemies();
  updateResources(0, battleState.shield, battleState.supply);
  await sleep(getSpeed() * 0.5);
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

function resetAll() {
  battleRunning = false;
  battlePaused = false;
  const pauseBtn = document.getElementById('btnPause');
  if (pauseBtn) {
    pauseBtn.disabled = true;
    pauseBtn.textContent = '⏸ 一時停止';
    pauseBtn.style.borderColor = '';
    pauseBtn.style.color = '';
  }
  army = [];
  condNodes = [];
  condNodeCounter = 0;
  enemies = [];
  myUnitsHp = [];
  loopCount = 0;
  turnCount = 0;
  enemyIntents = [];
  enemyArmyShield = 0;
  updateEnemyShieldDisplay(0);
  const eidElR = document.getElementById('enemyIntentAtkDisplay');
  if (eidElR) eidElR.textContent = '—';
  disabledNodeIdx = -1;
  document.getElementById('loopCount').textContent = '0';
  document.getElementById('turnCount').textContent = '0';
  const tl = document.getElementById('turnsLeft');
  if (tl) {
    tl.textContent = MAX_TURNS;
    tl.style.color = 'var(--gold-bright)';
  }
  document.getElementById('phaseLabel').textContent = '';
  document.getElementById('shieldDisplay').textContent = '0';
  if (document.getElementById('resLoopDef')) document.getElementById('resLoopDef').textContent = '0';
  document.getElementById('resultOverlay').classList.remove('show');
  const ip = document.getElementById('enemyIntentPanel');
  if (ip) ip.classList.remove('show');
  const a2Row = document.getElementById('a2NodeSelectRow');
  if (a2Row) a2Row.style.display = restrictions.r1 ? 'flex' : 'none';
  lockRestrictions(false);
  clearLog();
  addLog('— ユニットを選択してフローを組んでください —', 'sys');
  updateResources(0, 0, 0);
  updateAmmoDisplay(0, 0);
  setPhase('build');
  renderAll();
  renderMyUnits();
  renderEnemyPreview();
}

function sleep(ms) {
  return new Promise(resolve => {
    const start = Date.now();
    const tick = () => {
      if (!battleRunning) {
        resolve();
        return;
      }
      if (battlePaused) {
        setTimeout(tick, 80);
        return;
      }
      const elapsed = Date.now() - start;
      if (elapsed >= ms) resolve();
      else setTimeout(tick, Math.min(80, ms - elapsed));
    };
    setTimeout(tick, 0);
  });
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
