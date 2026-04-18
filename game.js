(() => {
  if (window.SSS_BOOTSTRAPPED) return;
  window.SSS_BOOTSTRAPPED = true;
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");

  const DATA = window.SSS_DATA;
  if (!DATA) throw new Error("gameData.js is missing.");

  const S = DATA.settings;
  const state = {
    scene: "credits",
    mode: null,
    difficulty: 5,
    selectedMapIndex: 0,
    p1CharIndex: null,
    p2CharIndex: null,
    players: [],
    map: null,
    winner: null,
    confetti: [],
    koBursts: []
  };

  const keys = new Set();
  window.addEventListener("keydown", (e) => keys.add(e.code));
  window.addEventListener("keyup", (e) => keys.delete(e.code));

  function setOverlay(html) {
    overlay.innerHTML = html;
    overlay.classList.add("show");
  }

  function hideOverlay() {
    overlay.classList.remove("show");
    overlay.innerHTML = "";
  }

  function createMenuButton(label, onClick) {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  async function playCredits() {
    state.scene = "credits";
    hideOverlay();
    const timeline = [
      { text: "SUPER SCHOOL SMASH", ms: 1300, size: 46, color: "#ffcf56" },
      { text: "Created by", ms: 900, size: 28, color: "#ffffff" },
      { text: "Math Helper", ms: 1300, size: 38, color: "#89f0ff" },
      { text: "&", ms: 700, size: 34, color: "#ffffff" },
      { text: "Drywater", ms: 1300, size: 38, color: "#ff8ef0" }
    ];

    for (const step of timeline) {
      await new Promise((resolve) => {
        const start = performance.now();
        function draw(now) {
          const t = Math.min(1, (now - start) / 350);
          const alpha = Math.sin(t * Math.PI);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "#070a1a";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.globalAlpha = alpha;
          ctx.fillStyle = step.color;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `900 ${step.size}px Trebuchet MS`;
          ctx.fillText(step.text, canvas.width / 2, canvas.height / 2);
          ctx.globalAlpha = 1;
          if (now - start < step.ms) requestAnimationFrame(draw);
          else resolve();
        }
        requestAnimationFrame(draw);
      });
    }

    showModeSelect();
  }

  function showModeSelect() {
    state.scene = "menu";
    setOverlay(`
      <div class="panel">
        <h1>Super School Smash</h1>
        <p>Select a mode:</p>
        <div class="button-list" id="modeButtons"></div>
      </div>
    `);
    const box = document.getElementById("modeButtons");
    box.append(
      createMenuButton("1 Player", () => {
        state.mode = 1;
        showDifficultySelect();
      }),
      createMenuButton("2 Players", () => {
        state.mode = 2;
        showCharacterSelect(1);
      })
    );
  }

  function showDifficultySelect() {
    setOverlay(`
      <div class="panel">
        <h2>CPU Difficulty (1-9)</h2>
        <p class="small">1 = easiest, 9 = hardest</p>
        <div class="button-list" id="difficultyButtons"></div>
      </div>
    `);
    const box = document.getElementById("difficultyButtons");
    for (let i = 1; i <= 9; i++) {
      box.append(
        createMenuButton(`${i}`, () => {
          state.difficulty = i;
          showCharacterSelect(1);
        })
      );
    }
  }

  function showCharacterSelect(playerNumber) {
    const label = state.mode === 2 ? `Player ${playerNumber}` : "Player 1";
    setOverlay(`
      <div class="panel">
        <h2>${label} - Select Character</h2>
        <div class="button-list" id="characterButtons"></div>
        <p class="small">Custom characters are editable in <code>gameData.js</code>.</p>
      </div>
    `);

    const box = document.getElementById("characterButtons");
    DATA.characters.forEach((char, idx) => {
      box.append(
        createMenuButton(char.name, () => {
          if (playerNumber === 1) {
            state.p1CharIndex = idx;
            if (state.mode === 1) {
              state.p2CharIndex = Math.floor(Math.random() * DATA.characters.length);
              showMapSelect();
            } else {
              showCharacterSelect(2);
            }
          } else {
            state.p2CharIndex = idx;
            showMapSelect();
          }
        })
      );
    });
  }

  function showMapSelect() {
    setOverlay(`
      <div class="panel">
        <h2>Select Map</h2>
        <div class="button-list" id="mapButtons"></div>
        <p class="small">Add maps in <code>gameData.js</code> with custom backgrounds/platforms.</p>
      </div>
    `);
    const box = document.getElementById("mapButtons");
    DATA.maps.forEach((map, idx) => {
      box.append(
        createMenuButton(map.name, () => {
          state.selectedMapIndex = idx;
          startBattle();
        })
      );
    });
  }

  function playerTemplate(slot, character, x, y) {
    return {
      slot,
      c: character,
      x,
      y,
      w: 34,
      h: 46,
      vx: 0,
      vy: 0,
      facing: slot === 1 ? 1 : -1,
      onGround: false,
      jumpsLeft: S.maxJumps,
      attackTimer: 0,
      cooldown: 0,
      hitbox: null,
      percent: 0,
      stocks: S.stocks,
      dead: false,
      aiTimer: 0,
      aiIntent: { move: 0, jump: false, attack: null }
    };
  }

  function startBattle() {
    hideOverlay();
    state.scene = "battle";
    state.winner = null;
    state.koBursts = [];
    state.map = DATA.maps[state.selectedMapIndex];

    const p1Char = DATA.characters[state.p1CharIndex];
    const p2Char = DATA.characters[state.p2CharIndex];
    const sp1 = state.map.spawn[0];
    const sp2 = state.map.spawn[1] || state.map.spawn[0];

    state.players = [
      playerTemplate(1, p1Char, sp1.x, sp1.y),
      playerTemplate(2, p2Char, sp2.x, sp2.y)
    ];

    requestAnimationFrame(battleLoop);
  }

  function getDirectionalInput(p, control) {
    let horizontal = 0;
    let vertical = 0;
    if (keys.has(control.left)) horizontal -= 1;
    if (keys.has(control.right)) horizontal += 1;
    if (keys.has(control.up)) vertical -= 1;
    if (keys.has(control.down)) vertical += 1;
    return { horizontal, vertical };
  }

  const controls = {
    1: {
      left: "KeyA", right: "KeyD", up: "KeyW", down: "KeyS",
      smash: "KeyE", special: "KeyQ"
    },
    2: {
      left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown",
      smash: "ShiftRight", special: "ControlRight"
    }
  };

  function attackTypeFromInput(direction) {
    if (direction.vertical < 0) return "up";
    if (direction.vertical > 0) return "down";
    if (direction.horizontal !== 0) return "side";
    return "neutral";
  }

  function tryAttack(p, kind, direction) {
    if (p.cooldown > 0 || p.attackTimer > 0) return;
    const key = attackTypeFromInput(direction);
    const data = p.c.attacks[kind][key];
    p.attackTimer = data.duration;
    p.cooldown = data.cooldown;
    const dir = direction.horizontal !== 0 ? Math.sign(direction.horizontal) : p.facing;
    p.facing = dir || p.facing;
    p.hitbox = {
      x: p.x + (p.facing === 1 ? p.w : -26),
      y: p.y + 8,
      w: 26,
      h: 24,
      data,
      from: p.slot,
      ttl: Math.max(4, Math.floor(data.duration * 0.55))
    };
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function applyPhysics(p, map) {
    p.vy += S.gravity;
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= p.onGround ? S.friction : S.airFriction;

    const surfaces = [map.floor, ...map.platforms];
    p.onGround = false;
    for (const platform of surfaces) {
      if (
        p.x + p.w > platform.x &&
        p.x < platform.x + platform.w &&
        p.vy >= 0 &&
        p.y + p.h >= platform.y &&
        p.y + p.h - p.vy <= platform.y + 4
      ) {
        p.y = platform.y - p.h;
        p.vy = 0;
        p.onGround = true;
        p.jumpsLeft = S.maxJumps;
      }
    }

    if (p.cooldown > 0) p.cooldown -= 1;
    if (p.attackTimer > 0) p.attackTimer -= 1;
    if (p.hitbox) {
      p.hitbox.x = p.x + (p.facing === 1 ? p.w : -p.hitbox.w);
      p.hitbox.y = p.y + 8;
      p.hitbox.ttl -= 1;
      if (p.hitbox.ttl <= 0) p.hitbox = null;
    }
  }

  function handleInputs() {
    const [p1, p2] = state.players;
    const c1 = controls[1];
    const d1 = getDirectionalInput(p1, c1);

    if (d1.horizontal !== 0) {
      p1.vx += d1.horizontal * S.moveSpeed * p1.c.stats.speed;
      p1.facing = Math.sign(d1.horizontal);
    }
    if (keys.has(c1.up) && p1.jumpsLeft > 0 && (p1.onGround || p1.vy > -2)) {
      p1.vy = -S.jumpPower * p1.c.stats.jump;
      p1.jumpsLeft -= 1;
      keys.delete(c1.up);
    }
    if (keys.has(c1.smash)) {
      tryAttack(p1, "smash", d1);
      keys.delete(c1.smash);
    }
    if (keys.has(c1.special)) {
      tryAttack(p1, "special", d1);
      keys.delete(c1.special);
    }

    if (state.mode === 2) {
      const c2 = controls[2];
      const d2 = getDirectionalInput(p2, c2);
      if (d2.horizontal !== 0) {
        p2.vx += d2.horizontal * S.moveSpeed * p2.c.stats.speed;
        p2.facing = Math.sign(d2.horizontal);
      }
      if (keys.has(c2.up) && p2.jumpsLeft > 0 && (p2.onGround || p2.vy > -2)) {
        p2.vy = -S.jumpPower * p2.c.stats.jump;
        p2.jumpsLeft -= 1;
        keys.delete(c2.up);
      }
      if (keys.has(c2.smash)) {
        tryAttack(p2, "smash", d2);
        keys.delete(c2.smash);
      }
      if (keys.has(c2.special)) {
        tryAttack(p2, "special", d2);
        keys.delete(c2.special);
      }
    } else {
      runCpuAI(p2, p1);
    }
  }

  function runCpuAI(cpu, target) {
    cpu.aiTimer -= 1;
    if (cpu.aiTimer <= 0) {
      const d = state.difficulty;
      const reaction = Math.max(7, 30 - d * 2);
      cpu.aiTimer = reaction;
      const dx = target.x - cpu.x;
      cpu.aiIntent.move = Math.abs(dx) < 20 ? 0 : Math.sign(dx);
      cpu.aiIntent.jump = target.y + 20 < cpu.y && Math.random() < 0.8;
      const attackChance = 0.15 + d * 0.08;
      if (Math.abs(dx) < 140 && Math.random() < attackChance) {
        const attacks = ["smash", "special"];
        cpu.aiIntent.attack = attacks[Math.floor(Math.random() * attacks.length)];
      } else {
        cpu.aiIntent.attack = null;
      }
    }

    cpu.vx += cpu.aiIntent.move * S.moveSpeed * cpu.c.stats.speed * 0.85;
    if (cpu.aiIntent.move !== 0) cpu.facing = cpu.aiIntent.move;
    if (cpu.aiIntent.jump && cpu.jumpsLeft > 0 && (cpu.onGround || cpu.vy > -2)) {
      cpu.vy = -S.jumpPower * cpu.c.stats.jump;
      cpu.jumpsLeft -= 1;
      cpu.aiIntent.jump = false;
    }
    if (cpu.aiIntent.attack) {
      const dir = {
        horizontal: Math.sign(target.x - cpu.x),
        vertical: target.y + target.h < cpu.y ? -1 : 0
      };
      tryAttack(cpu, cpu.aiIntent.attack, dir);
      cpu.aiIntent.attack = null;
    }
  }

  function resolveCombat() {
    const [a, b] = state.players;

    for (const attacker of [a, b]) {
      const defender = attacker.slot === 1 ? b : a;
      if (!attacker.hitbox) continue;
      const hb = attacker.hitbox;
      const rect = { x: defender.x, y: defender.y, w: defender.w, h: defender.h };
      if (rectsOverlap(hb, rect)) {
        const kbScale = 1 + defender.percent / 100;
        const dirXBase = hb.data.knockbackX;
        const dirX = attacker.facing === 1 ? dirXBase : -dirXBase;
        defender.vx += dirX * kbScale / defender.c.stats.weight;
        defender.vy += hb.data.knockbackY * kbScale / defender.c.stats.weight;
        defender.percent = Math.min(S.maxPercent, defender.percent + hb.data.damage);
        attacker.hitbox = null;
      }
    }
  }

  function spawnKoBurst(x, y) {
    state.koBursts.push({ x, y, t: 40 });
  }

  function checkKO() {
    const bz = state.map.blastZone;
    for (const p of state.players) {
      if (p.dead) continue;
      if (p.x < bz.left || p.x > bz.right || p.y < bz.top || p.y > bz.bottom) {
        p.stocks -= 1;
        spawnKoBurst(Math.max(0, Math.min(canvas.width, p.x)), Math.max(0, Math.min(canvas.height, p.y)));
        if (p.stocks <= 0) {
          p.dead = true;
        } else {
          const spawn = state.map.spawn[p.slot - 1] || state.map.spawn[0];
          p.x = spawn.x;
          p.y = spawn.y;
          p.vx = 0;
          p.vy = 0;
          p.percent = 0;
          p.jumpsLeft = S.maxJumps;
        }
      }
    }

    const alive = state.players.filter((p) => !p.dead);
    if (alive.length <= 1) {
      state.winner = alive[0] ? `Player ${alive[0].slot}` : "No one";
      endBattle();
    }
  }

  function endBattle() {
    state.scene = "results";
    state.confetti = Array.from({ length: 160 }, () => ({
      x: Math.random() * canvas.width,
      y: -Math.random() * canvas.height,
      vy: 2 + Math.random() * 4,
      vx: -2 + Math.random() * 4,
      color: ["#ff6b6b", "#ffd93d", "#6bff95", "#6bd5ff", "#d08bff"][Math.floor(Math.random() * 5)],
      s: 4 + Math.random() * 6
    }));

    setOverlay(`
      <div class="panel">
        <h1>${state.winner} Wins!</h1>
        <p>Battle complete. Great smash!</p>
        <div class="button-list" id="resultButtons"></div>
        <p class="small">
          Controls:<br>
          P1 <kbd>WASD</kbd> + <kbd>E</kbd> Smash + <kbd>Q</kbd> Special<br>
          P2 <kbd>Arrows</kbd> + <kbd>Right Shift</kbd> Smash + <kbd>Right Ctrl</kbd> Special
        </p>
      </div>
    `);
    const box = document.getElementById("resultButtons");
    box.append(
      createMenuButton("Play Again", () => showModeSelect())
    );
  }

  function drawPixelCharacter(p) {
    // Minimal 8-bit style body if no gif sprite is provided
    const base = p.c.color || "#4cc9f0";
    ctx.fillStyle = base;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.w, p.h);
    ctx.fillStyle = "#0d1026";
    ctx.fillRect(Math.round(p.x + (p.facing === 1 ? 23 : 7)), Math.round(p.y + 10), 6, 6);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(Math.round(p.x + (p.facing === 1 ? 24 : 8)), Math.round(p.y + 11), 2, 2);

    if (p.attackTimer > 0) {
      ctx.fillStyle = "#ffdf5a";
      const ax = p.facing === 1 ? p.x + p.w : p.x - 8;
      ctx.fillRect(Math.round(ax), Math.round(p.y + 16), 8, 6);
    }
  }

  function drawMap() {
    const map = state.map;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Sky
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#2f4ca1");
    grad.addColorStop(1, "#12182f");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid for retro style
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    for (let x = 0; x < canvas.width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Platforms
    const drawPlat = (p, color = "#5f6cae") => {
      ctx.fillStyle = color;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = "#2f3766";
      ctx.fillRect(p.x, p.y + p.h - 4, p.w, 4);
    };
    drawPlat(map.floor, "#7587de");
    map.platforms.forEach((p) => drawPlat(p));
  }

  function drawHUD() {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(10, 10, 280, 72);
    ctx.fillRect(canvas.width - 290, 10, 280, 72);

    const [p1, p2] = state.players;
    ctx.fillStyle = "#fff";
    ctx.font = "bold 20px Trebuchet MS";
    ctx.fillText(`P1 ${p1.c.name}`, 20, 34);
    ctx.fillText(`${Math.floor(p1.percent)}% | Lives ${p1.stocks}`, 20, 62);

    const rightLabel = `P2 ${p2.c.name}`;
    const rightStats = `${Math.floor(p2.percent)}% | Lives ${p2.stocks}`;
    ctx.fillText(rightLabel, canvas.width - 280, 34);
    ctx.fillText(rightStats, canvas.width - 280, 62);

    if (state.mode === 1) {
      ctx.fillStyle = "#ffcf56";
      ctx.fillText(`CPU Lv.${state.difficulty}`, canvas.width / 2 - 54, 34);
    }
  }

  function drawKoBursts() {
    for (const b of state.koBursts) {
      const h = 120 + (40 - b.t) * 7;
      const alpha = b.t / 40;
      ctx.globalAlpha = alpha;
      const grad = ctx.createLinearGradient(0, b.y, 0, b.y + h);
      grad.addColorStop(0, "#fff4aa");
      grad.addColorStop(0.4, "#ff8f3f");
      grad.addColorStop(1, "#e63d1e");
      ctx.fillStyle = grad;
      ctx.fillRect(b.x - 10, b.y - 20, 20, h);
      ctx.globalAlpha = 1;
      b.t -= 1;
    }
    state.koBursts = state.koBursts.filter((b) => b.t > 0);
  }

  function drawConfetti() {
    for (const c of state.confetti) {
      c.x += c.vx;
      c.y += c.vy;
      if (c.y > canvas.height + 30) c.y = -10;
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, c.s, c.s);
    }
  }

  function battleLoop() {
    if (state.scene !== "battle") return;
    handleInputs();
    for (const p of state.players) applyPhysics(p, state.map);
    resolveCombat();
    checkKO();

    drawMap();
    state.players.forEach(drawPixelCharacter);
    drawKoBursts();
    drawHUD();

    requestAnimationFrame(battleLoop);
  }

  function generalLoop() {
    if (state.scene === "results") {
      drawMap();
      drawConfetti();
    }
    requestAnimationFrame(generalLoop);
  }

  playCredits();
  requestAnimationFrame(generalLoop);
})();
