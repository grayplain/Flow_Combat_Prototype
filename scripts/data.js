// ===== ユニット定義 =====
const UNITS = [
  {
    id: 'spear', name: '槍兵', cost: 1, supplyCost: 1, maxHp: 28, theme: 'atk', tag: 'tag-atk', tagLabel: '攻撃',
    core: '前衛1体に即時6ダメージ（先頭の前衛槍兵のみ：前衛槍兵3体で+2）',
    option: '陣形：DEF+5',
    execute: (state, _i, _a, enemies) => {
      const myPosition = (_a[_i] && _a[_i].position) || 'front';
      const firstFrontSpearIdx = _a.findIndex(
        (u, idx) => u.id === 'spear'
          && (u.position || 'front') === 'front'
          && !(deadNodeSkip && myUnitsHp[idx] && myUnitsHp[idx].dead)
      );
      const isFirstFrontSpear = myPosition === 'front' && _i === firstFrontSpearIdx;
      const frontSpearCount = isFirstFrontSpear
        ? (deadNodeSkip
            ? _a.filter((u, idx) => u.id === 'spear'
                && (u.position || 'front') === 'front'
                && !(myUnitsHp[idx] && myUnitsHp[idx].dead)).length
            : _a.filter(u => u.id === 'spear' && (u.position || 'front') === 'front').length)
        : 0;
      const bonus = frontSpearCount >= 3 ? 2 : frontSpearCount === 2 ? 1 : 0;
      const frontTargets = enemies.filter(e => !e.dead && !e.fled && e.position === 'front');
      const allTargets = frontTargets.length > 0 ? frontTargets : enemies.filter(e => !e.dead && !e.fled);
      if (allTargets.length === 0) return { type: 'ctrl', msg: '槍兵：敵なし（スキップ）' };
      const target = allTargets[0];
      const dmg = 6 + bonus;
      const armorVal = target.armor || 0;
      const actualDmg = Math.max(0, dmg - armorVal);
      target.hp = Math.max(0, target.hp - actualDmg);
      if (target.hp <= 0) target.dead = true;
      const deadMsg = target.dead ? '　→ 撃破！' : `　→ 残HP${target.hp}`;
      const armorMsg = armorVal > 0 ? `（アーマー${armorVal}で軽減）` : '';
      const bonusMsg = bonus > 0 ? `【槍衾×${frontSpearCount}(先頭) +${bonus}】` : '';
      state.lastInstant = actualDmg;
      return { type: 'atk', msg: `槍兵【突撃】${bonusMsg}：${target.name}に即時${actualDmg}ダメージ${armorMsg}${deadMsg}` };
    },
    executeOption: (state) => {
      state.def += 5;
      state.lastInstant = 0;
      return { type: 'def', msg: `槍兵［陣形］：DEF +5　→ 累計DEF ${state.def}` };
    }
  },
  {
    id: 'heavy', name: '重装歩兵', cost: 2, supplyCost: 1, maxHp: 40, theme: 'ctrl', tag: 'tag-atk', tagLabel: '破砕',
    core: 'アーマー破砕：即時7ダメ＋敵前衛アーマー-1（永続）',
    option: '盾壁：DEF+4・次の敵ターン攻撃を自身に集中',
    execute: (state, _i, _a, enemies) => {
      const frontTargets = enemies.filter(e => !e.dead && !e.fled && e.position === 'front');
      const allTargets = frontTargets.length > 0 ? frontTargets : enemies.filter(e => !e.dead && !e.fled);
      if (allTargets.length === 0) return { type: 'ctrl', msg: '重装歩兵：敵なし（スキップ）' };
      const target = allTargets[0];
      const armorVal = target.armor || 0;
      const actualDmg = Math.max(0, 7 - armorVal);
      target.hp = Math.max(0, target.hp - actualDmg);
      if (target.hp <= 0) target.dead = true;
      const armorBefore = target.armor || 0;
      target.armor = Math.max(0, armorBefore - 1);
      const armorMsg = armorBefore > 0 ? `（アーマー${armorBefore}→${target.armor}）` : '（アーマーなし）';
      const deadMsg = target.dead ? '　→ 撃破！' : `　→ 残HP${target.hp}`;
      const dmgMsg = armorVal > 0 ? `アーマー${armorVal}軽減で実${actualDmg}ダメ` : '即時7ダメ（アーマーなし）';
      return { type: 'instant', msg: `重装歩兵【アーマー破砕】：${target.name}に${dmgMsg}＋アーマー破砕${armorMsg}${deadMsg}` };
    },
    executeOption: (state, i) => {
      state.def += 4;
      state.tauntUnitIdx = i;
      return { type: 'def', msg: `重装歩兵［盾壁］：DEF+4　→ 累計DEF ${state.def}　※次の敵ターンは自身が攻撃対象` };
    }
  },
  {
    id: 'cavalry', name: '騎馬兵', cost: 2, supplyCost: 1, maxHp: 28, theme: 'amp', tag: 'tag-amp', tagLabel: '突撃',
    core: 'ATK+6・士気-3を出力（突撃）',
    option: '跳躍：ATK+6、次ノードをスキップ',
    execute: (state) => {
      state.atk += 6;
      const moraleDmg = 3;
      state.pendingMoraleDamage = (state.pendingMoraleDamage || 0) + moraleDmg;
      return { type: 'amp', msg: `騎馬兵（突撃）：ATK +6　＋ 士気攻撃 -${moraleDmg} を予約　累計ATK ${state.atk}` };
    },
    executeOption: (state, idx, army) => {
      state.atk += 6;
      const nextIdx = idx + 1;
      const destLabel = nextIdx < army.length ? `#${nextIdx + 2}` : 'END';
      return { type: 'amp', msg: `騎馬兵［跳躍］：ATK +6、次ノードをスキップ → ${destLabel}へ`, jumpTo: nextIdx + 1 < army.length ? nextIdx + 1 : null };
    }
  },
  {
    id: 'banner', name: '軍旗手', cost: 1, supplyCost: 1, maxHp: 20, theme: 'amp', tag: 'tag-amp', tagLabel: '鼓舞',
    core: '隣接ノードの出力値+2上乗せ',
    option: null,
    execute: (state, idx, army) => {
      let bonus = 0;
      if (idx > 0) bonus += 2;
      if (idx < army.length - 1) bonus += 2;
      state.atk += bonus;
      const parts = [];
      if (idx > 0) parts.push(`前 #${idx} へ+2`);
      if (idx < army.length - 1) parts.push(`後 #${idx + 2} へ+2`);
      return { type: 'amp', msg: `軍旗手（鼓舞）：隣接ノード上乗せ ${parts.join('・')}　ATK +${bonus}` };
    }
  },
  {
    id: 'spear_knight', name: '槍騎士', cost: 2, supplyCost: 1, maxHp: 40, theme: 'atk', tag: 'tag-atk', tagLabel: '精鋭攻撃',
    core: '前衛1体に即時9ダメージ（アーマー1・精鋭枠）',
    option: '陣形：DEF+4',
    isKnightRank: true,
    execute: (state, _i, _a, enemies) => {
      const frontTargets = enemies.filter(e => !e.dead && !e.fled && e.position === 'front');
      const allTargets = frontTargets.length > 0 ? frontTargets : enemies.filter(e => !e.dead && !e.fled);
      if (allTargets.length === 0) return { type: 'ctrl', msg: '槍騎士：敵なし（スキップ）' };
      const target = allTargets[0];
      const baseDmg = 9;
      const armorVal = target.armor || 0;
      const actualDmg = Math.max(0, baseDmg - armorVal);
      const armorMsg = armorVal > 0 ? `（アーマー${armorVal}軽減）` : '';
      target.hp = Math.max(0, target.hp - actualDmg);
      if (target.hp <= 0) target.dead = true;
      const deadMsg = target.dead ? '　→ 撃破！' : `　→ 残HP${target.hp}`;
      state.lastInstant = actualDmg;
      return { type: 'instant', msg: `槍騎士【精鋭突撃】：${target.name}に即時${actualDmg}ダメージ${armorMsg}${deadMsg}` };
    },
    executeOption: (state) => {
      state.def = (state.def || 0) + 4;
      return { type: 'def', msg: `槍騎士［陣形］：DEF +4　→ 累計DEF ${state.def}` };
    }
  },
  {
    id: 'heavy_knight', name: '重装騎士', cost: 3, supplyCost: 1, maxHp: 52, theme: 'ctrl', tag: 'tag-atk', tagLabel: '強化持越',
    core: '蓄積ATK/DEFに+3上乗せして次ループへ持越し（アーマー1・精鋭枠）',
    option: 'アーマー破砕：前衛1体に即時3ダメージ＋アーマー-1',
    isKnightRank: true,
    execute: (state) => {
      const bonus = 3;
      state.carryOver = state.carryOver || { atk: 0, def: 0 };
      state.carryOver.atk = (state.carryOver.atk || 0) + state.atk + bonus;
      state.carryOver.def = (state.carryOver.def || 0) + state.def;
      const atkMsg = state.atk > 0 ? `ATK${state.atk}+${bonus}` : `ATK+${bonus}`;
      const defMsg = state.def > 0 ? `・DEF${state.def}` : '';
      state.atk = 0;
      state.def = 0;
      state.lastInstant = 0;
      return { type: 'ctrl', msg: `重装騎士【強化持越し】：${atkMsg}${defMsg} を次ループへ（+${bonus}上乗せ）` };
    },
    executeOption: (state, _i, _a, enemies) => {
      const frontTargets = enemies.filter(e => !e.dead && !e.fled && e.position === 'front');
      const allTargets = frontTargets.length > 0 ? frontTargets : enemies.filter(e => !e.dead && !e.fled);
      if (allTargets.length === 0) return { type: 'ctrl', msg: '重装騎士：敵なし（スキップ）' };
      const target = allTargets[0];
      const dmg = 3;
      const armorVal = target.armor || 0;
      const actualDmg = Math.max(0, dmg - armorVal);
      target.hp = Math.max(0, target.hp - actualDmg);
      if (target.armor > 0) target.armor -= 1;
      if (target.hp <= 0) target.dead = true;
      const deadMsg = target.dead ? '　→ 撃破！' : `　→ 残HP${target.hp}`;
      state.lastInstant = actualDmg;
      return { type: 'instant', msg: `重装騎士［アーマー破砕］：${target.name}に即時${actualDmg}ダメージ＋アーマー破砕${deadMsg}` };
    }
  },
  {
    id: 'cavalry_knight', name: '騎士', cost: 3, supplyCost: 1, maxHp: 40, theme: 'amp', tag: 'tag-amp', tagLabel: '重騎士突撃',
    core: 'ATK+9・士気攻撃-5（先制攻撃・アーマー1・精鋭枠）',
    option: '跳躍：ATK+2、次ノードをスキップ',
    isKnightRank: true,
    execute: (state) => {
      state.atk = (state.atk || 0) + 9;
      state.pendingMoraleDmg = (state.pendingMoraleDmg || 0) + 5;
      state.lastInstant = 0;
      return { type: 'amp', msg: `騎士【重騎士突撃】：ATK +9　＋ 士気攻撃 -5 を予約　累計ATK ${state.atk}` };
    },
    executeOption: (state, i, army) => {
      state.atk = (state.atk || 0) + 2;
      state.lastInstant = 0;
      const nextIdx = i + 1;
      const destIdx = nextIdx + 1;
      const destLabel = destIdx < army.length ? army[destIdx].name : 'END';
      return { type: 'amp', msg: `騎士［跳躍］：ATK +2、次ノードをスキップ → ${destLabel}へ`, jumpTo: destIdx < army.length ? destIdx : null };
    }
  },
  {
    id: 'archer', name: '弓兵', cost: 1, supplyCost: 1, maxHp: 28, theme: 'atk', tag: 'tag-atk', tagLabel: '斉射',
    core: '後衛全体に6ダメージ（残弾制限：弓兵1体あたり5回/戦闘）',
    option: '略奪：ATK+1、補給+1',
    execute: (state, _i, _a, enemies, unit) => {
      if ((state.archerAmmo || 0) <= 0) {
        const meleePool = enemies.filter(e => !e.dead && !e.fled && e.position === 'front');
        const allAlive = enemies.filter(e => !e.dead && !e.fled);
        const target = meleePool.length > 0 ? meleePool[0] : (allAlive.length > 0 ? allAlive[0] : null);
        if (!target) return { type: 'ctrl', msg: '弓兵：残弾なし・攻撃対象なし（スキップ）' };
        const dmg = 4;
        target.hp = Math.max(0, target.hp - dmg);
        if (target.hp <= 0) target.dead = true;
        const deadMsg = target.dead ? '　→ 撃破！' : `　→ 残HP${target.hp}`;
        return { type: 'atk', msg: `弓兵【近接】${target.name}に即時${dmg}ダメージ（残弾なし）${deadMsg}` };
      }
      const targetPos = (unit && unit.archerTarget) || 'rear';
      const targetLabel = targetPos === 'front' ? '前衛' : '後衛';
      const targetPool = enemies.filter(e => !e.dead && !e.fled && e.position === targetPos);
      const fallbackPool = enemies.filter(e => !e.dead && !e.fled);
      const pool = targetPool.length > 0 ? targetPool : fallbackPool;
      const fallbackMsg = targetPool.length === 0 ? `【${targetLabel}不在→前列代替】` : '';
      if (pool.length === 0) {
        return { type: 'ctrl', msg: '弓兵：攻撃対象なし（スキップ）' };
      }
      const shots = 6;
      let totalHit = 0;
      const hitResults = [];
      for (const target of pool) {
        if (target.dead) continue;
        const armorVal = target.armor || 0;
        const actualDmg = Math.max(0, shots - armorVal);
        if (actualDmg > 0) {
          target.hp = Math.max(0, target.hp - actualDmg);
          if (target.hp <= 0) target.dead = true;
          totalHit += actualDmg;
        }
        const armorNote = armorVal > 0 ? `（armor${armorVal}）` : '';
        const deadNote = target.dead ? '撃破' : `残HP${target.hp}`;
        hitResults.push(`${target.name}:${actualDmg}dmg${armorNote}[${deadNote}]`);
      }
      state.archerAmmo = Math.max(0, (state.archerAmmo || 0) - 1);
      const ammoMsg = `　残弾${state.archerAmmo}`;
      const detail = hitResults.join('　');
      return { type: 'atk', msg: `弓兵【斉射】${fallbackMsg}${targetLabel}全体：合計${totalHit}ダメージ　${detail}${ammoMsg}` };
    },
    executeOption: (state) => {
      state.atk += 1;
      state.supply += 1;
      return { type: 'sup', msg: `弓兵［略奪］：ATK +1、補給 +1　→ ATK累計 ${state.atk}　補給残 ${state.supply}` };
    }
  },
  {
    id: 'crossbow', name: '弩兵', cost: 1, supplyCost: 1, maxHp: 20, theme: 'atk', tag: 'tag-atk', tagLabel: '精密射撃',
    core: '敵兵種指定・即時14ダメージ（アーマー貫通、残弾制限：1体あたり5回/戦闘）',
    option: '貫通射撃：シールド無視で即時3ダメージ',
    crossbowTarget: 'spear',
    execute: (state, idx, army, enemies) => {
      if ((state.crossbowAmmo || 0) <= 0) {
        const meleePool = enemies.filter(e => !e.dead && !e.fled && e.position === 'front');
        const allAlive = enemies.filter(e => !e.dead && !e.fled);
        const target = meleePool.length > 0 ? meleePool[0] : (allAlive.length > 0 ? allAlive[0] : null);
        if (!target) return { type: 'ctrl', msg: '弩兵：残弾なし・攻撃対象なし（スキップ）' };
        const dmg = 4;
        target.hp = Math.max(0, target.hp - dmg);
        if (target.hp <= 0) target.dead = true;
        const deadMsg = target.dead ? '　→ 撃破！' : `　→ 残HP${target.hp}`;
        return { type: 'atk', msg: `弩兵【近接】${target.name}に即時${dmg}ダメージ（残弾なし）${deadMsg}` };
      }
      const unit = army[idx];
      const target = unit.crossbowTarget || 'spear';
      const targetLabel = { spear: '槍兵', archer: '弓兵', cavalry: '騎馬兵' }[target] || target;
      const dmg = 14;
      const targetEnemies = enemies.filter(e => !e.dead && !e.fled && e.unitType === target);
      const fallbackEnemies = enemies.filter(e => !e.dead && !e.fled && e.position === 'front');
      const allAlive = enemies.filter(e => !e.dead && !e.fled);
      const pool = targetEnemies.length > 0 ? targetEnemies
        : fallbackEnemies.length > 0 ? fallbackEnemies
        : allAlive;
      if (pool.length === 0) return { type: 'ctrl', msg: '弩兵：全敵撃破済み（スキップ）' };
      const victim = pool.slice().sort((a, b) => a.hp - b.hp)[0];
      victim.hp = Math.max(0, victim.hp - dmg);
      if (victim.hp <= 0) victim.dead = true;
      state.crossbowAmmo = Math.max(0, (state.crossbowAmmo || 0) - 1);
      const deadMsg = victim.dead ? '　→ 撃破！' : `　→ 残HP${victim.hp}`;
      const fallbackMsg = targetEnemies.length === 0 ? `【${targetLabel}不在→前衛代替】` : '';
      return { type: 'atk', msg: `弩兵${fallbackMsg}：${victim.name}に即時 ${dmg} ダメージ【アーマー貫通】${deadMsg}　残弾${state.crossbowAmmo}` };
    },
    executeOption: (state, idx, army, enemies) => {
      const unit = army[idx];
      const target = unit.crossbowTarget || 'spear';
      const targetLabel = { spear: '槍兵', archer: '弓兵', cavalry: '騎馬兵' }[target] || target;
      const dmg = 14;
      const targetEnemies = enemies.filter(e => !e.dead && !e.fled && e.unitType === target);
      const fallbackEnemies = enemies.filter(e => !e.dead && !e.fled && e.position === 'front');
      const allAlive = enemies.filter(e => !e.dead && !e.fled);
      const pool = targetEnemies.length > 0 ? targetEnemies
        : fallbackEnemies.length > 0 ? fallbackEnemies
        : allAlive;
      if (pool.length === 0) return { type: 'ctrl', msg: '弩兵［貫通］：全敵撃破済み（スキップ）' };
      const victim = pool.slice().sort((a, b) => a.hp - b.hp)[0];
      victim.hp = Math.max(0, victim.hp - dmg);
      if (victim.hp <= 0) victim.dead = true;
      const deadMsg = victim.dead ? '　→ 撃破！' : `　→ 残HP${victim.hp}`;
      const fallbackMsg = targetEnemies.length === 0 ? `【${targetLabel}不在→前衛代替】` : '';
      return { type: 'atk', msg: `弩兵［貫通］${fallbackMsg}：${victim.name}にシールド無視で即時 ${dmg} ダメージ【アーマー貫通】${deadMsg}` };
    }
  },
  {
    id: 'engineer', name: '補給兵', cost: 1, supplyCost: 1, maxHp: 16, theme: 'sup', tag: 'tag-sup', tagLabel: '補給',
    core: '補給+2を獲得',
    option: '陣地構築：DEF+2',
    execute: (state) => {
      state.supply += 2;
      return { type: 'sup', msg: `補給兵：補給 +2　→ 残補給 ${state.supply}` };
    },
    executeOption: (state) => {
      state.def += 2;
      return { type: 'def', msg: `補給兵［陣地構築］：DEF +2　→ 累計DEF ${state.def}` };
    }
  },
  {
    id: 'militia', name: '民兵', cost: 1, supplyCost: 1, maxHp: 20, theme: 'atk', tag: 'tag-atk', tagLabel: '攻撃',
    core: '前衛1体に即時4ダメージ',
    option: '陣形：DEF+3',
    execute: (state, _i, _a, enemies) => {
      const frontTargets = enemies.filter(e => !e.dead && !e.fled && e.position === 'front');
      const allTargets = frontTargets.length > 0 ? frontTargets : enemies.filter(e => !e.dead && !e.fled);
      if (allTargets.length === 0) return { type: 'ctrl', msg: '民兵：敵なし（スキップ）' };
      const target = allTargets[0];
      const dmg = 4;
      const armorVal = target.armor || 0;
      const actualDmg = Math.max(0, dmg - armorVal);
      target.hp = Math.max(0, target.hp - actualDmg);
      if (target.hp <= 0) target.dead = true;
      const deadMsg = target.dead ? `　→ ${target.name}撃破！` : '';
      const armorMsg = armorVal > 0 ? `（装甲${armorVal}軽減→実${actualDmg}）` : '';
      return { type: 'atk', msg: `民兵【攻撃】：${target.name}に${dmg}ダメージ${armorMsg}${deadMsg}` };
    },
    executeOption: (state) => {
      state.def += 3;
      return { type: 'def', msg: `民兵［陣形］：DEF +3　→ 累計DEF ${state.def}` };
    }
  },
];

const COUNTER_CONFIG = {
  spear: { triggerUnitId: 'cavalry', extraDmg: 6, atkDebuff: 0, label: '槍兵カウンター' },
  archer: { triggerUnitId: 'spear', extraDmg: 4, atkDebuff: 0, label: '弓兵カウンター' },
  cavalry: { triggerUnitId: 'heavy', extraDmg: 6, atkDebuff: 0, label: '騎馬兵カウンター' },
};

const MELEE_RETALIATION = {
  spear: { isMelee: true, dmgTaken: 2, dmgDealt: 2 },
  shield: { isMelee: true, dmgTaken: 2, dmgDealt: 2 },
  heavy: { isMelee: true, dmgTaken: 2, dmgDealt: 4 },
  cavalry: { isMelee: true, dmgTaken: 4, dmgDealt: 2 },
  knight: { isMelee: true, dmgTaken: 0, dmgDealt: 4 },
  militia: { isMelee: true, dmgTaken: 4, dmgDealt: 2 },
};

const ENEMY_MELEE_TYPES = new Set(['spear', 'cavalry']);

// ===== 状態 =====
let army = [];
let condNodes = [];
let condNodeCounter = 0;
let enemies = [];
let myUnitsHp = [];
let battleState = null;
let battleRunning = false;
let battlePaused = false;
let loopCount = 0;
let turnCount = 0;
const MAX_LOOPS = 5;
const MAX_TURNS = 10;

const restrictions = { r0: false, r1: false, r2: false };
let disabledNodeIdx = -1;
let a2NodeTarget = 'random';
let deadNodeSkip = true;

const intentConfig = {};
let enemyIntents = [];
let enemyArmyShield = 0;
