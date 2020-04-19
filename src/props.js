import {
  builtinPropSpecs, ManageableProps, PropLoader, makePropsWithPrefix,
  preprocessPropSpecs,
} from './scaffolding/lib/props';
import {tweenEases} from './scaffolding/lib/tweens';

const particleImages = [
  'imageCloud',
];

export const commands = {
  attack: { // ekks
    input: ['keyboard.Z', 'gamepad.A'],
  },
  shoot: { // circle
    input: ['keyboard.X', 'gamepad.B'],
  },
  dash: { // square
    input: ['keyboard.C', 'gamepad.X'],
  },
  /*
  : { // triangle
    input: ['keyboard.', 'gamepad.Y'],
  },
  */
  up: {
    input: ['keyboard.UP', 'gamepad.UP'],
  },
  down: {
    input: ['keyboard.DOWN', 'gamepad.DOWN'],
  },
  left: {
    input: ['keyboard.LEFT', 'gamepad.LEFT'],
  },
  right: {
    input: ['keyboard.RIGHT', 'gamepad.RIGHT'],
  },
  lstick: {
    input: ['gamepad.LSTICK.RAW'],
    joystick: true,
  },
  rstick: {
    input: ['gamepad.RSTICK.RAW'],
    joystick: true,
  },

  restart: {
    input: ['keyboard.R'],
    execute: (scene) => scene.replaceWithSelf(),
    debug: true,
    unignorable: true,
    unreplayable: true,
  },
  quit: {
    input: ['keyboard.Q'],
    execute: 'forceQuit',
    debug: true,
    unignorable: true,
    unreplayable: true,
  },
  recordCycle: {
    input: ['gamepad.R1'],
    unreplayable: true,
    debug: true,
    unignorable: true,
    execute: (scene, game) => {
      const {_replay, _recording} = game;
      if (_replay && _replay.timeSight) {
        game.stopReplay();
      } else if (_replay) {
        setTimeout(() => {
          game.stopReplay();
          game.beginReplay({..._replay, timeSight: true});
        });
      } else if (_recording) {
        game.stopRecording();
      } else {
        game.beginRecording();
      }
    },
  },
};

export const shaderCoordFragments = null;
/*
[
  'shockwave',

  // ['foo', {
  //   bar: ['float', 0, null],
  //   baz: ['vec2', [0.5, 0.5], null],
  //   quux: ['float', 10.0, 0, 500],
  //   blang: ['bool', true],
  // }, `
  //     ux.x += 0.0 + foo_bar;
  //     ux.y += 0.0 + foo_baz.x;
  // `],
];
*/

export const shaderColorFragments = [
  'blur',

  ['night', {
    color: ['rgb', [205 / 255, 67 / 255, 67 / 255]],
    alpha_factor: ['float', 0.31, 0, 1, 0.01],
    tint_factor: ['float', 0.36, 0, 1, 0.01],
    amount: ['float', 0, null],
  }, `
      c.r = c.r * (1.0 - night_alpha_factor) + c.r * night_alpha_factor * (1.0 - night_amount);
      c.g = c.g * (1.0 - night_alpha_factor) + c.g * night_alpha_factor * (1.0 - night_amount);
      c.b = c.b * (1.0 - night_alpha_factor) + c.b * night_alpha_factor * (1.0 - night_amount);

      c.r = c.r + night_amount * night_tint_factor * night_color.r;
      c.g = c.g + night_amount * night_tint_factor * night_color.g;
      c.b = c.b + night_amount * night_tint_factor * night_color.b;
  `],

  ['flock', {
    color: ['rgb', [1, 1, 1]],
    alpha_factor: ['float', 0.11, 0, 1, 0.01],
    tint_factor: ['float', 0.15, 0, 1, 0.01],
    amount: ['float', 0, null],
    // amount: ['float', 0, 0, 1, 0.01],
  }, `
      c.r = c.r * (1.0 - flock_alpha_factor) + c.r * flock_alpha_factor * (1.0 - flock_amount);
      c.g = c.g * (1.0 - flock_alpha_factor) + c.g * flock_alpha_factor * (1.0 - flock_amount);
      c.b = c.b * (1.0 - flock_alpha_factor) + c.b * flock_alpha_factor * (1.0 - flock_amount);

      c.r = c.r + flock_amount * flock_tint_factor * flock_color.r;
      c.g = c.g - flock_amount * flock_tint_factor * flock_color.g;
      c.b = c.b - flock_amount * flock_tint_factor * flock_color.b;
  `],
];

export const propSpecs = {
  ...builtinPropSpecs(commands, shaderCoordFragments, shaderColorFragments),

  // 'command.ignore_all.intro': [false, null, (scene) => scene.command.ignoreAll(scene, 'intro')],
  // 'rules.base_gravity': [400, 0, 1000],

  'level.id': ['', null],
  'level.width': [0, null],
  'level.height': [0, null],

  'player.x': [0.1, null, 'level.player.x'],
  'player.y': [0.1, null, 'level.player.y'],
  'player.velocity_x': [0.1, null, 'level.player.body.velocity.x'],
  'player.velocity_y': [0.1, null, 'level.player.body.velocity.y'],
  'player.acceleration_x': [0.1, null, 'level.player.body.acceleration.x'],
  'player.acceleration_y': [0.1, null, 'level.player.body.acceleration.y'],
  'player.acceleration': [3000, 0, 5000],
  'player.mass': [1, 0, 100, (value, scene) => scene.level.player.body.setMass(value)],
  'player.drag': [0.8, 0, 1, (value, scene) => scene.level.player.setDrag(value)],
  'player.friction': [1, 0, 100, (value, scene) => scene.level.player.setFriction(value)],
  'player.bounce': [1, 0, 100, (value, scene) => scene.level.player.setBounce(value)],
  'player.maxVelocity': [200, 0, 1000, (value, scene) => scene.level.player.setMaxVelocity(value)],

  'player.dash.active': [false, null, 'level.player.dash.active'],
  'player.dash.cooldown': [false, null, 'level.player.dash.cooldown'],
  'player.dash.velocity': [500, 0, 1000],
  'player.dash.in_duration': [100, 0, 1000],
  'player.dash.sustain_duration': [200, 0, 1000],
  'player.dash.out_duration': [100, 0, 1000],
  'player.dash.in_ease': ['Cubic.easeIn', tweenEases],
  'player.dash.out_ease': ['Cubic.easeOut', tweenEases],
  'player.dash.cooldown_duration': [300, 0, 1000],

  'follower.mass': [1, 0, 100, (value, scene) => scene.level.followers.forEach((f) => f.body.setMass(value))],
  'follower.drag': [0.95, 0, 1, (value, scene) => scene.level.followers.forEach((f) => f.setDrag(value))],
  'follower.friction': [1, 0, 100, (value, scene) => scene.level.followers.forEach((f) => f.setFriction(value))],
  'follower.bounce': [1, 0, 100, (value, scene) => scene.level.followers.forEach((f) => f.setBounce(value))],
  'follower.maxVelocity': [50, 0, 1000, (value, scene) => scene.level.followers.forEach((f) => f.setMaxVelocity(value))],
  'follower.velocityLerp': [0.2, 0, 1],
  'follower.flockAcceleration': [75, 0, 1000],
  'follower.cohereRadius': [1000, 0, 1000],
  'follower.cohereFactor': [1, 0, 100],
  'follower.spreadRadius': [100, 0, 1000],
  'follower.spreadFactor': [15, 0, 100],
  'follower.playerRadius': [300, 0, 1000],
  'follower.playerFactor': [4, 0, 100],
  'follower.obstacleRadius': [100, 0, 1000],
  'follower.obstacleFactor': [1000, 0, 1000],
  'follower.enemyRadius': [200, 0, 1000],
  'follower.enemyFactor': [4, 0, 100],
  'follower.killerRadius': [200, 0, 1000],
  'follower.killerFactor': [200, 0, 1000],
  'follower.killerAcceleration': [1000, 0, 1000],
  'follower.killerVelocity': [20, 0, 1000],

  'enemy.mass': [1, 0, 100, (value, scene) => scene.level.enemies.forEach((f) => f.body.setMass(value))],
  'enemy.drag': [0.95, 0, 1, (value, scene) => scene.level.enemies.forEach((f) => f.setDrag(value))],
  'enemy.friction': [1, 0, 100, (value, scene) => scene.level.enemies.forEach((f) => f.setFriction(value))],
  'enemy.bounce': [4, 0, 100, (value, scene) => scene.level.enemies.forEach((f) => f.setBounce(value))],
  'enemy.maxVelocity': [100, 0, 1000, (value, scene) => scene.level.enemies.forEach((f) => f.setMaxVelocity(value))],
  'enemy.velocityLerp': [0.2, 0, 1],
  'enemy.flockAcceleration': [200, 0, 10000],
  'enemy.cohereRadius': [1000, 0, 1000],
  'enemy.cohereFactor': [20, 0, 100],
  'enemy.spreadRadius': [100, 0, 1000],
  'enemy.spreadFactor': [1000, 0, 1000],
  'enemy.avoidPlayerRadius': [100, 0, 1000],
  'enemy.avoidPlayerFactor': [500, 0, 100],
  'enemy.seekPlayerRadius': [1000, 0, 1000],
  'enemy.seekPlayerFactor': [1, 0, 100],
  'enemy.obstacleRadius': [80, 0, 1000],
  'enemy.obstacleFactor': [1000, 0, 1000],
  'enemy.followerRadius': [1000, 0, 1000],
  'enemy.followerFactor': [25, 0, 1000],
  'enemy.victimRadius': [300, 0, 1000],
  'enemy.victimFactor': [700, 0, 1000],
  'enemy.victimAcceleration': [1000, 0, 1000],
  'enemy.victimVelocity': [10, 0, 1000],

  'effects.sceneTransition.transition': [{
    animation: 'pushLeft',
    ease: 'Cubic.easeInOut',
  }],

  'effects.zoomOnLoss.distance': [15, 0, 1000],
  'effects.zoomOnLoss.pan_duration': [1000, 0, 1000],
  'effects.zoomOnLoss.pan_ease': ['Cubic.easeInOut', tweenEases],
  'effects.zoomOnLoss.zoom_duration': [1000, 0, 1000],
  'effects.zoomOnLoss.zoom_ease': ['Cubic.easeInOut', tweenEases],
  'effects.zoomOnLoss.zoom_scale': [1.2, 0, 10],
  'effects.zoomOnLoss.time_scale': [0.1, 0, 1],
  'effects.zoomOnLoss.recover_linger_duration': [100, 0, 10000],
  'effects.zoomOnLoss.recover_zoom_duration': [500, 0, 10000],
  'effects.zoomOnLoss.recover_zoom_ease': ['Cubic.easeInOut', tweenEases],
  'effects.zoomOnLoss.recover_pan_duration': [500, 0, 10000],
  'effects.zoomOnLoss.recover_pan_ease': ['Cubic.easeInOut', tweenEases],
  'effects.zoomOnLoss.recover_time_scale_duration': [100, 0, 10000],
  'effects.zoomOnLoss.recover_time_scale_ease': ['Cubic.easeInOut', tweenEases],

  'effects.followerDie.duration': [100, 0, 10000],

  'effects.dashPuff.particles': [{
    frequency: 50,
    lifespan: 500,
  }],
};

propSpecs['scene.camera.lerp'][0] = 0.05;
propSpecs['scene.camera.deadzoneX'][0] = 200;
propSpecs['scene.camera.deadzoneY'][0] = 200;

export const tileDefinitions = {
  '.': {
    image: 'tileGrass',
  },
  '@': {
    image: 'tileGrass',
  },
  '*': {
    image: 'tileGrassRock',
    group: 'rock',
    isStatic: true,
    isCircle: true,
    isObstacle: true,
  },
  ',': {
    image: 'tileGrass',
    group: 'transition',
    isStatic: true, // for followers
    isObstacle: true, // for followers
  },
  '+': {
    image: 'tileGrass',
    // followers
  },
  '[': {
    image: 'tileCoop',
    above: 'tileGrass',
    group: 'coop',
    isStatic: true,
    isObstacle: true,
    isCoop: true,
    health: 4,
  },
  ']': {
    _inherit: '[',
  },
  A: {
    image: 'tileGrass',
    enemy: 'spriteEnemyA',
  },
};

preprocessPropSpecs(propSpecs, particleImages);

export const manageableProps = new ManageableProps(propSpecs);
export const propsWithPrefix = makePropsWithPrefix(propSpecs, manageableProps);
export default PropLoader(propSpecs, manageableProps);
