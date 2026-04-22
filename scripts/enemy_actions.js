// ===== 敵ユニット行動パターン =====
// フォーメーションkey → 敵ユニットid → 行動パターン配列 の構造で定義する。
// 配列の順序がそのままターン毎の実行順序（末尾到達後は先頭にループ）。
//
// action: action_handlers.js で定義したアクション名
// value:  アクションに渡すパラメータ（常に配列）
//
// ここに定義されていない敵ユニットは、デフォルトで毎ターン atk（自身のatk値）を実行する。

const ENEMY_ACTION_PATTERNS = {

  // --- 襲撃2：逃亡騎士（サンプルパターン） ---
  event2: {
    'e1': [
      { action: 'atk', value: [8] },     // ターン1: 108ダメージ×1回
      { action: 'def', value: [5] },       // ターン2: シールド+5
      { action: 'atk', value: [5, 2] },    // ターン3: 5ダメージ×2回
      { action: 'atk', value: [10] },      // ターン4: 10ダメージ×1回
    ],
  },
  
  // 新規追加アクションのテスト用
  event3: {
    'e1': [
      { action: 'atk', value: [3,2] },
      { action: 'def', value: [4] },
    ],
    'e2': [
    { action: 'noop', value: [] },
    { action: 'targeted_atk', value: [12, 'min_hp'] },
    ],
    'e3': [
      { action: 'atk', value: [7] },
    ],           
  },  
  
  // 拠点3
  enemy3: {
    'e2': [
    { action: 'volley', value: [4, 2, 'front'] }, 
    ],
    'e3': [
    { action: 'noop', value: [] },
    { action: 'targeted_atk', value: [20, 'min_hp'] },
    ],
    
  },  
  
  // 新規追加アクションのテスト用
  experi: {
    'e1': [
      { action: 'armor_break', value: [2,2] },
    ],        
  },    
  

};



