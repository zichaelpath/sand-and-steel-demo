/* Offline reference simulation. Coordinates are source pixels; time is milliseconds.
 * Uses the same JSON tags, frame durations, anchors and events as the artwork.
 * No dependencies or engine bindings. Also usable by Node for deterministic checks.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GladiatorCombat = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const reach = {freed_rebel: 52, retiarius: 62, thraex: 36, murmillo: 36, secutor: 40, rebel_champion: 44};
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  class Animation {
    constructor(data, direction = 'right') {
      this.data = data; this.direction = direction; this.start('Idle');
    }
    start(action, reverse = false, last = false) {
      const tag = this.data.meta.frameTags.find(t => t.name === this.direction + '_' + action);
      if (!tag) throw new Error('Missing animation: ' + this.direction + '_' + action);
      this.action = action; this.tag = tag; this.reverse = reverse;
      this.frame = reverse || last ? tag.to : tag.from;
      this.elapsed = 0; this.ended = last; this.initial = !last;
    }
    face(direction) {
      if (direction === this.direction) return;
      const relative = this.frame - this.tag.from;
      this.direction = direction;
      this.tag = this.data.meta.frameTags.find(t => t.name === direction + '_' + this.action);
      this.frame = this.tag.from + relative;
    }
    events(callback) {
      if (this.reverse) return;
      for (const e of this.data.meta.events || []) if (e.frame === this.frame) callback(e);
    }
    tick(ms, onEvent, onEnd) {
      if (this.ended) return;
      if (this.initial) { this.initial = false; this.events(onEvent); }
      this.elapsed += ms;
      while (this.elapsed >= this.data.frames[this.frame].duration) {
        this.elapsed -= this.data.frames[this.frame].duration;
        const next = this.frame + (this.reverse ? -1 : 1);
        if (next < this.tag.from || next > this.tag.to) {
          if (this.tag.loop && !this.reverse) this.frame = this.tag.from;
          else { this.ended = true; this.elapsed = 0; onEnd(); return; }
        } else this.frame = next;
        this.events(onEvent);
      }
    }
  }
  class Arena {
    constructor(pack, options = {}) {
      this.pack = pack; this.time = 0; this.accumulator = 0; this.events = [];
      this.mode = options.mode || 'sparring'; this.projectiles = []; this.landings = [];
      this.actors = [this.create(options.player || 'retiarius', 140, 1), this.create(options.enemy || 'murmillo', 300, -1)];
      this.input = {}; this.stats = {attacks: 0, hits: 0, blocks: 0, dodges: 0, nets: 0, captures: 0};
    }
    create(id, x, facing) {
      const unit = [...this.pack.units, ...this.pack.variants].find(u => u.id === id);
      if (!unit) throw new Error('Unknown fighter ' + id);
      return {unit, id: unit.baseId || unit.id, x, y: 216, facing, hp: 100, action: 'Idle',
        animation: new Animation(unit.animation, facing === 1 ? 'right' : 'left'),
        active: false, invulnerable: false, hitTargets: new Set(), netReady: true,
        netReturnsAt: 0, boundUntil: 0, nextAttack: 0, control: {}, deaths: 0};
    }
    note(type, actor, extra = {}) {
      this.events.push({time: this.time, type, actor: this.actors.indexOf(actor), ...extra});
      if (this.events.length > 100) this.events.shift();
    }
    face(actor, sign) {
      actor.facing = sign; actor.animation.face(sign === 1 ? 'right' : 'left');
    }
    set(actor, action, last = false) {
      actor.action = action; actor.active = false; actor.invulnerable = false;
      actor.animation.start(action === 'BlockRelease' ? 'Block' : action, action === 'BlockRelease', last);
      if (action === 'Attack') { actor.hitTargets.clear(); this.stats.attacks++; }
      if (action === 'Death') actor.deaths++;
    }
    free(actor) { return ['Idle', 'Walk', 'Charge'].includes(actor.action); }
    act(actor, action) {
      if (actor.hp <= 0 || !this.free(actor)) return false;
      if (action === 'NetCast' && (actor.id !== 'retiarius' || !actor.netReady)) return false;
      if (action === 'Dodge' && actor.boundUntil > this.time) return false;
      if (!['Attack', 'Block', 'Dodge', 'NetCast'].includes(action)) return false;
      this.set(actor, action); this.note(action, actor);
      if (action === 'Dodge') this.stats.dodges++;
      return true;
    }
    command(action) { return this.act(this.actors[0], action); }
    guarding(actor, attackerX) {
      const facingAttack = (attackerX - actor.x) * actor.facing >= 0;
      return facingAttack && (actor.action === 'BlockHit' ||
        (actor.action === 'Block' && actor.animation.frame >= actor.animation.tag.from + 2));
    }
    move(actor, amount) {
      const other = this.actors.find(a => a !== actor);
      let x = clamp(actor.x + amount, 36, 444);
      if (other.hp > 0) x = actor.x < other.x ? Math.min(x, other.x - 22) : Math.max(x, other.x + 22);
      actor.x = x;
    }
    control(actor, input, ms) {
      actor.control = input;
      if (actor.hp <= 0) return;
      if (actor.action === 'Block' && !input.block) this.set(actor, 'BlockRelease');
      if (!this.free(actor)) return;
      if (input.block) { this.act(actor, 'Block'); return; }
      const axis = Math.sign(input.axis || 0);
      if (axis && actor.boundUntil <= this.time) {
        this.face(actor, axis);
        const action = input.charge ? 'Charge' : 'Walk';
        if (actor.action !== action) this.set(actor, action);
        const motion = actor.animation.tag.motion;
        this.move(actor, axis * motion.stridePixels / motion.cycleMs * ms);
      } else if (actor.action !== 'Idle') this.set(actor, 'Idle');
    }
    enemyInput() {
      const enemy = this.actors[1], player = this.actors[0];
      if (this.mode === 'passive' || player.hp <= 0 || enemy.hp <= 0) return {};
      if (this.free(enemy)) this.face(enemy, player.x >= enemy.x ? 1 : -1);
      if (this.mode === 'guard') return {block: true};
      const distance = Math.abs(player.x - enemy.x);
      if (distance > reach[enemy.id] - 4) return {axis: enemy.facing};
      if (this.time >= enemy.nextAttack && this.free(enemy)) {
        this.act(enemy, 'Attack'); enemy.nextAttack = this.time + 1750;
      }
      // Telegraph attack, recover, then briefly guard: deliberately slow sparring.
      return {block: enemy.action !== 'Attack' && enemy.nextAttack - this.time > 320};
    }
    onEvent(actor, e) {
      if (e.event === 'attack_active_start') actor.active = true;
      if (e.event === 'attack_active_end') actor.active = false;
      if (e.event === 'dodge_active_start') actor.invulnerable = true;
      if (e.event === 'dodge_active_end') actor.invulnerable = false;
      if (e.event === 'spawn_net' && actor.netReady && actor.hp > 0) {
        const anchor = actor.animation.data.frames[actor.animation.frame].anchors[e.anchor];
        actor.netReady = false; actor.netReturnsAt = this.time + 4000;
        this.projectiles.push({owner: actor, x: actor.x + anchor.x - 64, y: actor.y + anchor.y - 114,
          facing: actor.facing, age: 0, distance: 0});
        this.stats.nets++; this.note('net_released', actor);
      }
    }
    onEnd(actor) {
      if (actor.action === 'Death' || actor.action === 'Block') return;
      if (actor.action === 'BlockHit') {
        this.set(actor, actor.control.block ? 'Block' : 'BlockRelease', !!actor.control.block);
      } else this.set(actor, 'Idle');
    }
    strike(actor, target) {
      if (!actor.active || actor.hp <= 0 || target.hp <= 0 || actor.hitTargets.has(target)) return;
      const distance = (target.x - actor.x) * actor.facing;
      if (distance < 0 || distance > reach[actor.id]) return;
      if (target.invulnerable) return;
      actor.hitTargets.add(target);
      if (this.guarding(target, actor.x)) {
        this.stats.blocks++; this.set(target, 'BlockHit'); this.note('blocked', target); return;
      }
      target.hp = Math.max(0, target.hp - 20); this.stats.hits++;
      this.set(target, target.hp ? 'Hit' : 'Death'); this.note(target.hp ? 'hit' : 'defeated', target);
    }
    step(ms) {
      this.time += ms;
      this.control(this.actors[0], this.input, ms);
      this.control(this.actors[1], this.enemyInput(), ms);
      for (const actor of this.actors) {
        if (!actor.netReady && this.time >= actor.netReturnsAt && actor.hp > 0) {
          actor.netReady = true; this.note('net_recovered', actor);
        }
        if (actor.action === 'Dodge' && actor.boundUntil <= this.time) this.move(actor, -actor.facing * ms * 0.045);
        actor.animation.tick(ms, e => this.onEvent(actor, e), () => this.onEnd(actor));
      }
      this.strike(this.actors[0], this.actors[1]); this.strike(this.actors[1], this.actors[0]);
      this.projectiles = this.projectiles.filter(net => {
        const previous = net.x; net.age += ms;
        net.x += net.facing * ms * 0.19; net.distance += ms * 0.19;
        const target = this.actors.find(a => a !== net.owner);
        const crossed = Math.min(previous, net.x) <= target.x + 10 && Math.max(previous, net.x) >= target.x - 10;
        const hit = target.hp > 0 && !target.invulnerable && crossed;
        if (hit || net.distance > 250 || net.x < 20 || net.x > 460) {
          if (hit) { target.boundUntil = this.time + 1600; this.stats.captures++; this.note('net_capture', target); }
          this.landings.push({x: hit ? target.x : net.x, y: target.y, age: 0, target: hit ? target : null});
          return false;
        }
        return true;
      });
      this.landings = this.landings.filter(n => { n.age += ms; if (n.target) n.x = n.target.x; return n.age < 1600; });
    }
    advance(ms, input = {}) {
      this.input = input; this.accumulator += ms;
      // Fixed 10ms steps prevent skipped events and make collision deterministic.
      while (this.accumulator >= 10) { this.accumulator -= 10; this.step(10); }
    }
  }
  return {Animation, Arena, reach};
});
