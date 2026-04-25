// ===== 敵ユニット =====
// プロトタイプ検証用。敵編成を変更する際はこのファイルを編集してください。
const PASSIVE_COUNTERS = {
  spear: { id: 'spike_counter', triggerUnitId: 'cavalry', damage: 6, label: '槍兵カウンター', ignoreShield: false, ignoreArmor: false },
  archer: { id: 'spike_counter', triggerUnitId: 'spear', damage: 4, label: '弓兵カウンター', ignoreShield: false, ignoreArmor: false },
  cavalry: { id: 'spike_counter', triggerUnitId: 'heavy', damage: 6, label: '騎馬兵カウンター', ignoreShield: false, ignoreArmor: false },
};

const ENEMY_FORMATIONS = {
  event1: {
    label: '襲撃1★',
    desc: 'Act1の序盤の襲撃イベント',
    hint: '槍兵を1~2体と民兵を置いておくだけで勝てる敵の想定',
    units: [
      { id: 'e1', name: '盗賊1', maxHp: 15, hp: 15, atk: 5, armor: 0, position: 'front', maxMorale: 3, morale: 3, unitType: 'none' },
      { id: 'e2', name: '盗賊2', maxHp: 35, hp: 35, atk: 4, armor: 0, position: 'front', maxMorale: 3, morale: 3, unitType: 'none' },
      { id: 'e3', name: '盗賊3', maxHp: 20, hp: 20, atk: 4, armor: 0, position: 'front', maxMorale: 3, morale: 3, unitType: 'none' },
    ]
  },
  event2: {
    label: '襲撃2★',
    desc: 'Act1の中盤の襲撃イベント',
    hint: '味方ユニットを3〜４体置いておけば勝てる敵の想定',
    units: [
      { id: 'e1', name: '逃亡騎士', maxHp: 80, hp: 100, atk: 10, armor: 2, position: 'front', maxMorale: 8, morale: 8, unitType: 'knight' },
    ]
  },
  event3: {
    label: '襲撃3',
    desc: 'Act1の中盤の襲撃イベント',
    hint: '味方ユニットを3〜４体置いておけば勝てる敵の想定',
    units: [
      { id: 'e1', name: '軽歩兵', maxHp: 20, hp: 20, atk: 6, armor: 0, position: 'front', maxMorale: 3, morale: 3, unitType: 'none' },
      { id: 'e2', name: '弩兵', maxHp: 15, hp: 15, atk: 10, armor: 0, position: 'front', maxMorale: 3, morale: 3, unitType: 'none' },
      { id: 'e3', name: '軽斧兵', maxHp: 30, hp: 30, atk: 4, armor: 0, position: 'front', maxMorale: 3, morale: 3, unitType: 'none' },
      { id: 'e4', name: '槍兵', maxHp: 40, hp: 40, atk: 4, armor: 1, position: 'rear', maxMorale: 3, morale: 3, unitType: 'none' },      
    ]
  },  
  event4: {
    label: '襲撃4',
    desc: 'Act1の中盤の襲撃イベント',
    hint: '味方ユニットを3〜４体置いておけば勝てる敵の想定',
    units: [
      { id: 'e1', name: 'クラーケン', maxHp: 100, hp: 100, atk: 1, armor: 2, position: 'front', maxMorale: 8, morale: 8, unitType: 'knight' },
    ]
  },    
  
  enemy1: {
    label: '拠点1★',
    desc: '最初の拠点の敵軍団',
    hint: '味方ユニットを3~4体集めるだけで普通に勝てる敵の想定',
    units: [
      { id: 'e1', name: '守備弓兵A', maxHp: 15, hp: 15, atk: 6, armor: 0, position: 'front', maxMorale: 5, morale: 5, unitType: 'archer', passiveSkill: PASSIVE_COUNTERS.archer },
      { id: 'e2', name: '守備弓兵B', maxHp: 15, hp: 15, atk: 6, armor: 0, position: 'front', maxMorale: 5, morale: 5, unitType: 'archer', passiveSkill: PASSIVE_COUNTERS.archer },
      { id: 'e3', name: '敵槍兵B', maxHp: 80, hp: 80, atk: 5, armor: 1, position: 'rear', maxMorale: 8, morale: 8, unitType: 'spear', passiveSkill: PASSIVE_COUNTERS.spear },
    ]
  },
  enemy2: {
    label: '拠点2★',
    desc: '2番目の拠点の敵軍団',
    hint: '味方ユニットを4~5体集めて何とか勝てる。フローを適切に組めば楽に勝てる敵の想定',
    units: [
      { id: 'e1', name: '敵グレイブ兵A', maxHp: 30, hp: 30, atk: 8, armor: 1, position: 'front', maxMorale: 8, morale: 8, unitType: 'spear', passiveSkill: PASSIVE_COUNTERS.spear },
      { id: 'e2', name: '敵重装槍兵B', maxHp: 40, hp: 40, atk: 6, armor: 1, position: 'front', maxMorale: 8, morale: 8, unitType: 'spear', passiveSkill: PASSIVE_COUNTERS.spear },
      { id: 'e3', name: '敵重装騎馬兵A', maxHp: 40, hp: 40, atk: 8, armor: 0, position: 'rear', maxMorale: 5, morale: 5, unitType: 'cavalry', passiveSkill: PASSIVE_COUNTERS.cavalry },
      { id: 'e4', name: '敵重装騎馬兵B', maxHp: 60, hp: 60, atk: 5, armor: 2, position: 'rear', maxMorale: 5, morale: 5, unitType: 'cavalry', passiveSkill: PASSIVE_COUNTERS.cavalry },
    ]
  },
  enemy3: {
    label: '拠点3★',
    desc: '2番目の拠点の敵軍団その２',
    hint: '味方ユニットを4~5体集めて何とか勝てる。フローを適切に組めば楽に勝てる敵の想定',
    units: [
      { id: 'e1', name: 'パヴィス盾兵', maxHp: 100, hp: 100, atk: 0, armor: 1, position: 'front', maxMorale: 8, morale: 8, unitType: 'shield' },
      { id: 'e2', name: '傭兵弓兵', maxHp: 15, hp: 15, atk: 6, armor: 0, position: 'rear', maxMorale: 5, morale: 5, unitType: 'archer', passiveSkill: PASSIVE_COUNTERS.archer },
      { id: 'e3', name: 'ジェノバ弩兵', maxHp: 20, hp: 20, atk: 13, armor: 1, position: 'rear', maxMorale: 5, morale: 5, unitType: 'crowwbowman' },      
    ]
  },  
  enemy4: {
    label: '拠点4',
    
    desc: 'ボス前の敵軍団',
    hint: '味方ユニットを6~7体集めてフローを適切に組んで初めて勝てる想定。',
    units: [
      { id: 'e1', name: '敵重装槍兵A', maxHp: 40, hp: 40, atk: 8, armor: 2, position: 'front', maxMorale: 8, morale: 8, unitType: 'spear', passiveSkill: PASSIVE_COUNTERS.spear },
      { id: 'e2', name: '敵重装槍兵B', maxHp: 40, hp: 40, atk: 8, armor: 2, position: 'front', maxMorale: 8, morale: 8, unitType: 'spear', passiveSkill: PASSIVE_COUNTERS.spear },
      { id: 'e3', name: '敵重装騎馬兵A', maxHp: 50, hp: 50, atk: 10, armor: 2, position: 'rear', maxMorale: 5, morale: 5, unitType: 'cavalry', passiveSkill: PASSIVE_COUNTERS.cavalry },
      { id: 'e4', name: '敵重装騎馬兵B', maxHp: 50, hp: 50, atk: 10, armor: 2, position: 'rear', maxMorale: 5, morale: 5, unitType: 'cavalry', passiveSkill: PASSIVE_COUNTERS.cavalry },
    ]
  },
  act1boss: {
    label: 'Act1ボスその１',
    desc: 'Act1のボス',
    hint: '味方ユニット8体(1軍団)でフローチャートを2~3ノード組めばなんとか勝てる想定',
    units: [
      { id: 'e1', name: '敵重装槍兵A', maxHp: 18, hp: 18, atk: 8, armor: 2, position: 'front', maxMorale: 8, morale: 8, unitType: 'spear', passiveSkill: PASSIVE_COUNTERS.spear },
      { id: 'e2', name: '敵重装槍兵B', maxHp: 18, hp: 18, atk: 8, armor: 2, position: 'front', maxMorale: 8, morale: 8, unitType: 'spear', passiveSkill: PASSIVE_COUNTERS.spear },
      { id: 'e3', name: '敵重装槍兵C', maxHp: 18, hp: 18, atk: 8, armor: 2, position: 'front', maxMorale: 8, morale: 8, unitType: 'spear', passiveSkill: PASSIVE_COUNTERS.spear },
      { id: 'e4', name: '敵重装騎馬兵', maxHp: 16, hp: 16, atk: 10, armor: 2, position: 'rear', maxMorale: 5, morale: 5, unitType: 'cavalry', passiveSkill: PASSIVE_COUNTERS.cavalry },
    ]
  },
  act1boss2: {
    label: 'Act1ボスその２',
    desc: 'Act1のボス',
    hint: '味方ユニット8体(1軍団)でフローチャートを2~3ノード組めばなんとか勝てる想定',
    units: [
      { id: 'e1', name: '敵重装槍兵A', maxHp: 18, hp: 18, atk: 8, armor: 2, position: 'front', maxMorale: 8, morale: 8, unitType: 'spear', passiveSkill: PASSIVE_COUNTERS.spear },
      { id: 'e2', name: '敵重装槍兵B', maxHp: 18, hp: 18, atk: 8, armor: 2, position: 'front', maxMorale: 8, morale: 8, unitType: 'spear', passiveSkill: PASSIVE_COUNTERS.spear },
      { id: 'e3', name: '敵重装槍兵C', maxHp: 18, hp: 18, atk: 8, armor: 2, position: 'front', maxMorale: 8, morale: 8, unitType: 'spear', passiveSkill: PASSIVE_COUNTERS.spear },
      { id: 'e4', name: '敵重装騎馬兵', maxHp: 16, hp: 16, atk: 10, armor: 2, position: 'rear', maxMorale: 5, morale: 5, unitType: 'cavalry', passiveSkill: PASSIVE_COUNTERS.cavalry },
    ]
  },  
  dummy: {
    label: '🎯 ダミー（火力測定用）',
    desc: 'HP300・ATK0・反撃なし',
    hint: 'カウンター・反撃なし。与ダメージの理論値測定専用',
    units: [
      { id: 'e1', name: 'ダミー', maxHp: 1000, hp: 1000, atk: 0, armor: 0, position: 'front', maxMorale: 999, morale: 999, unitType: 'dummy' },
    ]
  },
  experi: {
    label: '実験用',
    desc: 'Act1の中盤の襲撃イベント',
    hint: 'アクションを追加時の実験ユニット',
    units: [
      { id: 'e1', name: 'クラーケン', maxHp: 100, hp: 100, atk: 1, armor: 2, position: 'front', maxMorale: 8, morale: 8, unitType: 'knight' },
    ]
  },    
};

let currentFormationKey = 'event1';

function getEnemyTemplate() {
  const f = ENEMY_FORMATIONS[currentFormationKey];
  return f.units.map(u => ({ ...u }));
}
