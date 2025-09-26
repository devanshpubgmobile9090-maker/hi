const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const Vec3 = require('vec3');

let bot;
let delivering = false;
let paused = false;
let operatorName = '.SKMHunterYT'; // Operator name

function createBot() {
  bot = mineflayer.createBot({
    host: 'DevanshXT01.aternos.me', // Server IP
    port: 16894,                     // Server port
    username: 'WoodBot123',          // Bot name
    version: '1.21.8'                // Server version
  });

  bot.loadPlugin(pathfinder);

  bot.on('login', () => console.log('✅ Bot joined the server!'));

  bot.once('spawn', () => {
    const mcData = require('minecraft-data')(bot.version);
    const defaultMove = new Movements(bot, mcData);

    // ⚡ Ultra-fast movement
    defaultMove.allowSprinting = true;
    defaultMove.allowParkour = true;
    defaultMove.canDig = true;
    bot.pathfinder.setMovements(defaultMove);

    mineWood();
  });

  bot.on('error', (err) => console.log('❌ Error:', err));
  bot.on('end', () => {
    console.log('❌ Disconnected, reconnecting in 5s...');
    setTimeout(createBot, 5000);
  });

  // ✅ Operator chat command
  bot.on('chat', (username, message) => {
    if (username !== operatorName) return;

    if (message.toLowerCase() === 'deliver') {
      if (paused && getWoodCount() > 0) {
        console.log('📦 Deliver command received!');
        deliverWood(operatorName);
      } else {
        bot.chat(`/msg ${operatorName} Inventory not full yet!`);
      }
    }
  });

  // Tick-based delivery drop
  bot.on('physicsTick', () => {
    if (delivering) {
      const target = bot.players[operatorName]?.entity;
      if (target) {
        const dist = bot.entity.position.distanceTo(target.position);
        if (dist < 2) {
          delivering = false;
          dropWood(() => {
            console.log('✅ Delivered wood, mining again!');
            paused = false;
            mineWood();
          });
        }
      }
    }
  });
}

// 🪵 Continuous multi-log mining
function mineWood() {
  if (paused) return;

  const mcData = require('minecraft-data')(bot.version);

  // 🔹 All log types
  const logIds = Object.values(mcData.blocks)
    .filter(b => b.name.includes('_log'))
    .map(b => b.id);

  const block = bot.findBlock({
    matching: b => logIds.includes(b.type),
    maxDistance: 32
  });

  if (!block) {
    setTimeout(mineWood, 200); // retry fast
    return;
  }

  // Inventory check
  if (getWoodCount() >= 64) {
    console.log('📦 Inventory full, pausing...');
    paused = true;
    bot.chat(`/msg ${operatorName} Inventory full! Type deliver to collect.`);
    return;
  }

  bot.pathfinder.setGoal(new goals.GoalBlock(block.position.x, block.position.y, block.position.z));

  bot.once('goal_reached', () => {
    bot.dig(block, (err) => {
      if (err) console.log('❌ Dig error:', err);
      else console.log(`🪵 Mined ${block.name}`);
      setTimeout(mineWood, 50); // ultra fast next mining
    });
  });
}

// 📦 Count total wood logs
function getWoodCount() {
  return bot.inventory.items().reduce((total, item) => {
    if (item.name.includes('_log')) total += item.count;
    return total;
  }, 0);
}

// 🚶 Deliver wood to operator
function deliverWood(name) {
  const target = bot.players[name]?.entity;
  if (!target) {
    console.log('❌ Operator not online, waiting...');
    setTimeout(() => deliverWood(name), 2000);
    return;
  }

  console.log('🚶 Moving to operator...');
  delivering = true;
  bot.pathfinder.setGoal(new goals.GoalFollow(target, 1));
}

// 📤 Drop all wood logs
function dropWood(callback) {
  const woodItems = bot.inventory.items().filter(item => item.name.includes('_log'));
  if (woodItems.length === 0) {
    console.log('❌ No wood to drop');
    callback();
    return;
  }

  let i = 0;
  function tossNext() {
    if (i >= woodItems.length) {
      callback();
      return;
    }
    const item = woodItems[i++];
    bot.tossStack(item, (err) => {
      if (err) console.log('❌ Drop error:', err);
      else console.log(`✅ Dropped ${item.count} ${item.name}`);
      tossNext();
    });
  }
  tossNext();
}

createBot();
