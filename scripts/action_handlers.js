// ===== アクション定義 =====
// 敵ユニットの行動パターンで使用するアクションの実装。
// enemy_actions.js の action フィールドと対応するキーで定義する。
// 各ハンドラは (enemy, values) を受け取り、intent オブジェクトを返す。

// targeted_atk で使う兵種数値コード（文字列でも数値でも指定可）
const TARGETED_ATK_UNIT_CODES = {
  1: 'spear',    // 槍兵
  2: 'heavy',    // 重装歩兵
  3: 'cavalry',  // 騎馬兵
  4: 'banner',   // 軍旗手
  5: 'archer',   // 弓兵
  6: 'crossbow', // 弩兵
  7: 'longbow',  // 長弓兵
};

const ACTION_HANDLERS = {

  // ---- 攻撃：即時Nダメージ×M回を前衛に与える ----
  // value: [N]    → Nダメージ×1回
  // value: [N, M] → Nダメージ×M回
  atk: (enemy, values) => {
    const dmg   = values[0] || enemy.atk;
    const count = values[1] || 1;
    return { type: 'atk', value: dmg, atkCount: count };
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
  targeted_atk: (enemy, values) => {
    const dmg        = values[0] || enemy.atk;
    const targetSpec = values[1] ?? 'front';
    const count      = values[2] || 1;
    return { type: 'targeted_atk', value: dmg, targetSpec, atkCount: count };
  },

  // TBD: 弓兵斉射ダメージ
  // volley: (enemy, values, battleState) => { ... },

  // TBD: バフ（味方全体ATK一時上昇など）
  // buff: (enemy, values, battleState) => { ... },

  // TBD: 行動なし（待機）
  // noop: (enemy, values, battleState) => { return { type: 'noop', value: 0 }; },
};
