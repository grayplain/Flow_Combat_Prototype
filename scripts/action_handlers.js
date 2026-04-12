// ===== アクション定義 =====
// 敵ユニットの行動パターンで使用するアクションの実装。
// enemy_actions.js の action フィールドと対応するキーで定義する。
// 各ハンドラは (enemy, values, battleState) を受け取り、intent オブジェクトを返す。

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

  // TBD: 特定ユニット対象攻撃（騎馬兵など）
  // targeted_atk: (enemy, values, battleState) => { ... },

  // TBD: 弓兵斉射ダメージ
  // volley: (enemy, values, battleState) => { ... },

  // TBD: バフ（味方全体ATK一時上昇など）
  // buff: (enemy, values, battleState) => { ... },

  // TBD: 行動なし（待機）
  // noop: (enemy, values, battleState) => { return { type: 'noop', value: 0 }; },
};
