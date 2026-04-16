// ===== battle_action.js =====
// action_handlers.js で定義されたアクション（atk / def / targeted_atk / buff など）を
// 実際の戦場で解決する処理を担当する。敵の intent 生成と、そこから派生する
// プレイヤー側・敵側のダメージ/士気/バフ適用をまとめる。

function generateEnemyIntents() {
  enemyIntents = [];
  const patterns = ENEMY_ACTION_PATTERNS[currentFormationKey] || {};

  enemies.filter(e => !e.dead && !e.fled).forEach(e => {
    const pattern = patterns[e.id];

    if (pattern && pattern.length > 0) {
      // 行動パターン定義あり → パターンに従う（ループ）
      const current = pattern[e.patternIndex % pattern.length];
      const handler = ACTION_HANDLERS[current.action];
      if (handler) {
        const intent = handler(e, current.value);
        enemyIntents.push({ enemyId: e.id, ...intent });
      } else {
        // 未定義アクション → デフォルト攻撃にフォールバック
        enemyIntents.push({ enemyId: e.id, type: 'atk', value: e.atk, atkCount: e.atkCount || 1 });
      }
      e.patternIndex++;
    } else {
      // 行動パターン未定義 → 即時atkダメージ
      enemyIntents.push({ enemyId: e.id, type: 'atk', value: e.atk, atkCount: e.atkCount || 1 });
    }
  });
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

  function selectTargetedTarget(targetSpec) {
    const alive = myUnitsHp.filter(mu => !mu.dead);
    if (alive.length === 0) return null;
    // タントと軍旗手は優先度を維持
    if (battleState.tauntUnitIdx !== undefined && battleState.tauntUnitIdx !== null) {
      const taunt = myUnitsHp[battleState.tauntUnitIdx];
      if (taunt && !taunt.dead) return taunt;
    }
    const banner = alive.find(mu => mu.id === 'banner');
    if (banner) return banner;

    const specStr = typeof targetSpec === 'number'
      ? (TARGETED_ATK_UNIT_CODES[targetSpec] || String(targetSpec))
      : String(targetSpec);

    if (specStr === 'rear')   return alive[alive.length - 1];
    if (specStr === 'max_hp') return alive.slice().sort((a, b) => b.hp - a.hp)[0];
    if (specStr === 'min_hp') return alive.slice().sort((a, b) => a.hp - b.hp)[0];
    // 兵種指定：不在時は先頭にフォールバック
    return alive.find(mu => mu.id === specStr) || alive[0];
  }

  for (const intent of enemyIntents) {
    const enemy = enemies.find(e => e.id === intent.enemyId);
    if (!enemy || enemy.dead || enemy.fled) continue;
    if (intent.type === 'def') {
      enemyArmyShield += intent.value;
      addLog(`　🛡 ${enemy.name}：防御態勢 → 軍団シールド +${intent.value}（累計${enemyArmyShield}）`, 'def');
      updateEnemyShieldDisplay(enemyArmyShield);
    } else if (intent.type === 'buff') {
      const aliveEnemies = enemies.filter(e => !e.dead && !e.fled);
      const specStr = typeof intent.targetSpec === 'number'
        ? (BUFF_TARGET_CODES[intent.targetSpec] || String(intent.targetSpec))
        : String(intent.targetSpec);

      // 対象兵種を前から探す（position:'front'優先、同順位は配列順）
      const frontFirst = [
        ...aliveEnemies.filter(e => e.position === 'front'),
        ...aliveEnemies.filter(e => e.position !== 'front'),
      ];
      let target = frontFirst.find(e => e.unitType === specStr);

      if (!target) {
        if (intent.strict) {
          addLog(`　✨ ${enemy.name}【バフ】：対象兵種（${specStr}）不在 → スキップ`, 'sys');
          continue;
        }
        target = aliveEnemies[0]; // 先頭にフォールバック
      }
      if (!target) continue;

      const statLabel = { atk: 'ATK', armor: 'アーマー', hp: 'HP' }[intent.stat] || intent.stat;
      if (intent.stat === 'atk') {
        target.atk += intent.value;
      } else if (intent.stat === 'armor') {
        target.armor = (target.armor || 0) + intent.value;
      } else if (intent.stat === 'hp') {
        target.hp    += intent.value;
        target.maxHp += intent.value;
      }
      addLog(`　✨ ${enemy.name}【バフ】→ ${target.name}：${statLabel}+${intent.value}`, 'amp');
      renderEnemies();
    }
  }

  let totalDealt = 0;

  // 通常攻撃を行わない敵ID（targeted_atk / buff は自前ループで処理するため除外）
  const nonDefaultAtkIds = new Set(
    enemyIntents.filter(it => it.type === 'targeted_atk' || it.type === 'buff').map(it => it.enemyId)
  );

  const aliveEnemyArchers = enemies.filter(e => !e.dead && !e.fled && e.unitType === 'archer' && !nonDefaultAtkIds.has(e.id));
  if (aliveEnemyArchers.length > 0) {
    const maxAtkCount = aliveEnemyArchers.reduce((max, e) => Math.max(max, e.atkCount || 1), 1);
    for (let hit = 1; hit <= maxAtkCount; hit++) {
      const hitArchers = aliveEnemyArchers.filter(e => (e.atkCount || 1) >= hit);
      if (hitArchers.length === 0) continue;
      const hitDmg = hitArchers.reduce((sum, e) => sum + e.atk, 0);
      const targetPos = Math.random() < 0.5 ? 'front' : 'rear';
      const targetPosLabel = targetPos === 'front' ? '前衛' : '後衛';
      const posTargets = myUnitsHp.filter((mu, idx) => !mu.dead && army[idx] && (army[idx].position || 'front') === targetPos);
      const allAlive = myUnitsHp.filter(mu => !mu.dead);
      const shotTargets = posTargets.length > 0 ? posTargets : allAlive;
      const fallbackMsg = posTargets.length === 0 ? `【${targetPosLabel}不在→全体代替】` : '';
      const hitLabel = maxAtkCount > 1 ? `（${hit}/${maxAtkCount}回目）` : '';
      addLog(`　🏹 敵弓兵【斉射×${hitArchers.length}】${fallbackMsg}${hitLabel}→ ${targetPosLabel}全体に${hitDmg}ダメージ`, 'atk');
      let archerTotalDealt = 0;
      for (const mu of shotTargets) {
        if (mu.dead) continue;
        let dmg = hitDmg;
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
  }

  const aliveEnemySpears = enemies.filter(e => !e.dead && !e.fled && e.unitType === 'spear').length;
  const enemySpearBonus = aliveEnemySpears >= 3 ? 2 : aliveEnemySpears === 2 ? 1 : 0;
  const attackers = enemies.filter(e => !e.dead && !e.fled && e.unitType !== 'archer' && !nonDefaultAtkIds.has(e.id)).map(e => {
    const intent = enemyIntents.find(it => it.enemyId === e.id && it.type === 'atk');
    const baseAtk = intent ? intent.value : e.atk;
    const bonus = e.unitType === 'spear' ? enemySpearBonus : 0;
    return { enemy: e, atkVal: baseAtk + bonus, spearBonus: bonus };
  });

  for (const { enemy, atkVal, spearBonus } of attackers) {
    const atkCount = enemy.atkCount || 1;
    let retaliationDone = false;

    for (let hit = 1; hit <= atkCount; hit++) {
      if (enemy.dead || enemy.fled) break;
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
      const hitLabel = atkCount > 1 ? `（${hit}/${atkCount}回目）` : '';
      addLog(`　${typeIcon} ${enemy.name} → ${target.name}：${actualDmg}ダメージ${spearBonusMsg}${hitLabel}${deadMsg}`, 'atk');

      if (target.hp <= 0) {
        target.dead = true;
        renderMyUnits();
      }

      if (!retaliationDone && ENEMY_MELEE_TYPES.has(enemy.unitType) && actualDmg > 0) {
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
          retaliationDone = true;
        }
      }
    }
  }

  // ---- targeted_atk（特定ユニット狙い撃ち）----
  for (const intent of enemyIntents.filter(it => it.type === 'targeted_atk')) {
    const enemy = enemies.find(e => e.id === intent.enemyId);
    if (!enemy || enemy.dead || enemy.fled) continue;

    const atkCount = intent.atkCount || 1;
    let retaliationDone = false;

    for (let hit = 1; hit <= atkCount; hit++) {
      if (enemy.dead || enemy.fled) break;
      const target = selectTargetedTarget(intent.targetSpec);
      if (!target) break;

      let dmg = intent.value;
      if (battleState.shield > 0) {
        const absorbed = Math.min(battleState.shield, dmg);
        battleState.shield -= absorbed;
        dmg -= absorbed;
        addLog(`　🛡 シールドが ${absorbed} 吸収（${enemy.name}の攻撃、残シールド：${battleState.shield}）`, 'def');
        updateShieldDisplay(battleState.shield);
      }

      if (dmg <= 0) {
        addLog(`　🎯 ${enemy.name} → ${target.name}：シールドが完全防御`, 'def');
        continue;
      }

      const armorVal = target.armor || 0;
      const actualDmg = Math.max(0, dmg - armorVal);
      if (armorVal > 0) addLog(`　🛡 ${target.name}【アーマー${armorVal}】ダメージ軽減`, 'def');

      target.hp = Math.max(0, target.hp - actualDmg);
      totalDealt += actualDmg;

      const hitLabel = atkCount > 1 ? `（${hit}/${atkCount}回目）` : '';
      const deadMsg = target.hp <= 0 ? '　→ 撃破！' : `　→ 残HP${target.hp}`;
      addLog(`　🎯 ${enemy.name}【狙い撃ち】→ ${target.name}：${actualDmg}ダメージ${hitLabel}${deadMsg}`, 'atk');

      if (target.hp <= 0) {
        target.dead = true;
        renderMyUnits();
      }

      if (!retaliationDone && ENEMY_MELEE_TYPES.has(enemy.unitType) && actualDmg > 0) {
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
          retaliationDone = true;
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
