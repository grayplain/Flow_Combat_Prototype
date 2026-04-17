// ===== アクション定義 =====
// 敵ユニットの行動パターンで使用するアクションの実装。
// enemy_actions.js の action フィールドと対応するキーで定義する。
// 各ハンドラは (enemy, values) を受け取り、intent オブジェクトを返す。

// targeted_atk で使う兵種数値コード（プレイヤーユニット id と対応）
const TARGETED_ATK_UNIT_CODES = {
  1: 'spear',    // 槍兵
  2: 'heavy',    // 重装歩兵
  3: 'cavalry',  // 騎馬兵
  4: 'banner',   // 軍旗手
  5: 'archer',   // 弓兵
  6: 'crossbow', // 弩兵
  7: 'longbow',  // 長弓兵
};

// buff で使う兵種数値コード（敵ユニット unitType と対応）
const BUFF_TARGET_CODES = {
  0: 'none',      // 雑兵
  1: 'spear',     // 槍兵
  2: 'cavalry',   // 騎馬兵
  3: 'archer',    // 弓兵
  4: 'knight',    // 騎士
  5: 'crossbow',  // 弩兵
};

const ACTION_HANDLERS = {

  // ---- 攻撃：即時Nダメージ×M回を前衛に与える ----
  // value[0]: ダメージ（省略時は自身のatk）
  // value[1]: 攻撃回数（省略時1）
  // value[2]: applyBuff フラグ（省略時 true）
  //   true:  buff で上昇した ATK 差分を value[0] に上乗せする
  //   false: buff にかかわらず value[0] の値をそのまま使う
  atk: (enemy, values) => {
    const baseDmg   = values[0] || enemy.atk;
    const count     = values[1] || 1;
    const applyBuff = values[2] ?? true;
    const buffDelta = applyBuff ? Math.max(0, enemy.atk - (enemy.baseAtk ?? enemy.atk)) : 0;
    return { type: 'atk', value: baseDmg + buffDelta, atkCount: count };
  },

  // ---- 防御：軍団シールドに加算 ----
  // value: [N] → シールド+N
  def: (enemy, values) => {
    return { type: 'def', value: values[0] || 0 };
  },

  // ---- 特定ユニット対象攻撃 ----
  // value[0]: ダメージ（省略時は自身のatk）
  // value[1]: ターゲット指定
  //   文字列: 'rear'(最後尾) | 'max_hp'(最高HP) | 'min_hp'(最低HP) | 兵種ID('cavalry'など)
  //   数値:   TARGETED_ATK_UNIT_CODES のコード
  //   該当ユニット不在時は先頭にフォールバック
  // value[2]: 攻撃回数（省略時1）
  // value[3]: applyBuff フラグ（省略時 true）
  //   true:  buff で上昇した ATK 差分を value[0] に上乗せする
  //   false: buff にかかわらず value[0] の値をそのまま使う
  targeted_atk: (enemy, values) => {
    const baseDmg   = values[0] || enemy.atk;
    const targetSpec = values[1] ?? 'front';
    const count      = values[2] || 1;
    const applyBuff  = values[3] ?? true;
    const buffDelta  = applyBuff ? Math.max(0, enemy.atk - (enemy.baseAtk ?? enemy.atk)) : 0;
    return { type: 'targeted_atk', value: baseDmg + buffDelta, targetSpec, atkCount: count };
  },

  // ---- 斉射：指定位置の全体にNダメージ×M射 ----
  // value[0]: ダメージ（省略時は自身のatk）
  // value[1]: 射数（省略時1）
  // value[2]: 対象位置 'front' | 'rear' | 'random'（省略時 'random'）
  //   対象位置不在時は全体代替にフォールバック
  // value[3]: applyBuff フラグ（省略時 true）
  //   true:  buff で上昇した ATK 差分を value[0] に上乗せする
  //   false: buff にかかわらず value[0] の値をそのまま使う
  volley: (enemy, values) => {
    const baseDmg    = values[0] || enemy.atk;
    const count      = values[1] || 1;
    const targetPos  = values[2] ?? 'random';
    const applyBuff  = values[3] ?? true;
    const buffDelta  = applyBuff ? Math.max(0, enemy.atk - (enemy.baseAtk ?? enemy.atk)) : 0;
    return { type: 'volley', value: baseDmg + buffDelta, atkCount: count, targetPos };
  },

  // ---- バフ（敵ユニット強化）----
  // value[0]: 対象兵種（文字列: 'cavalry'など、数値: BUFF_TARGET_CODESのコード）
  // value[1]: ステータス ('atk' | 'armor' | 'hp')
  // value[2]: 増加量
  // value[3]: strict フラグ
  //   true:  対象兵種が存在しない場合はスキップ
  //   false: 対象兵種が存在しない場合は先頭ユニットを対象
  buff: (enemy, values) => {
    const targetSpec = values[0] ?? null;
    const stat       = values[1] || 'atk';
    const amount     = values[2] || 0;
    const strict     = values[3] ?? false;
    return { type: 'buff', targetSpec, stat, value: amount, strict };
  },

  // TBD: 行動なし（待機）
  // noop: (enemy, values, battleState) => { return { type: 'noop', value: 0 }; },
};
