// ===== battle_passive.js =====
// 敵ユニットのパッシブスキル定義と発動処理を担当する。

const ENEMY_PASSIVE_SKILLS = {
  spike_counter: {
    hook: 'onAfterPlayerAction',
    execute: ({ enemy, config, actorUnit, actorHp, result, state }) => {
      if (!result || result.targetEnemy !== enemy) return false;
      if (!actorHp || actorHp.dead) return false;
      if (actorUnit.id !== config.triggerUnitId) return false;

      let dmg = config.damage || 0;
      const logParts = [];

      if (!config.ignoreShield && state.shield > 0 && dmg > 0) {
        const absorbed = Math.min(state.shield, dmg);
        state.shield -= absorbed;
        dmg -= absorbed;
        updateShieldDisplay(state.shield);
        logParts.push(`シールド${absorbed}吸収`);
      }

      if (!config.ignoreArmor && dmg > 0) {
        const armorVal = actorHp.armor || 0;
        if (armorVal > 0) {
          const beforeArmor = dmg;
          dmg = Math.max(0, dmg - armorVal);
          logParts.push(`アーマー${armorVal}軽減(${beforeArmor}→${dmg})`);
        }
      }

      const actualDmg = Math.max(0, dmg);
      if (actualDmg > 0) {
        actorHp.hp = Math.max(0, actorHp.hp - actualDmg);
        if (actorHp.hp <= 0) actorHp.dead = true;
      }

      const detail = logParts.length > 0 ? `（${logParts.join('・')}）` : '';
      const deadMsg = actorHp.dead ? '　→ 撃破！' : `　→ 残HP${actorHp.hp}`;
      addLog(`　⚡ ${enemy.name}【${config.label || 'スパイクカウンター'}】${actorUnit.name}に${actualDmg}ダメージ${detail}${deadMsg}`, 'atk');
      renderMyUnits();
      return true;
    },
  },
};

function getEnemyPassiveConfig(enemy) {
  if (!enemy || !enemy.passiveSkill) return null;
  if (typeof enemy.passiveSkill === 'string') {
    return { id: enemy.passiveSkill };
  }
  return enemy.passiveSkill;
}

async function triggerEnemyPassives(hook, context) {
  for (const enemy of enemies.filter(e => !e.dead && !e.fled)) {
    const config = getEnemyPassiveConfig(enemy);
    if (!config || !config.id) continue;

    const passive = ENEMY_PASSIVE_SKILLS[config.id];
    if (!passive || passive.hook !== hook) continue;

    passive.execute({ ...context, enemy, config });
  }
}
