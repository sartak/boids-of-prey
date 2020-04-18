import {
  builtinPropSpecs, ManageableProps, PropLoader, makePropsWithPrefix,
  preprocessPropSpecs,
} from './scaffolding/lib/props';

const particleImages = [
  '',
];

export const commands = {
  /*
  action: {
    input: ['keyboard.Z', 'keyboard.SPACE', 'gamepad.A', 'gamepad.B', 'gamepad.X', 'gamepad.Y'],
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

export const shaderCoordFragments = [
  'shockwave',

  /*
  ['foo', {
    bar: ['float', 0, null],
    baz: ['vec2', [0.5, 0.5], null],
    quux: ['float', 10.0, 0, 500],
    blang: ['bool', true],
  }, `
      ux.x += 0.0 + foo_bar;
      ux.y += 0.0 + foo_baz.x;
  `],
  */
];

export const shaderColorFragments = [
  'blur',
  'tint',

  /*
  ['blah', {
    color: ['rgba', [1, 1, 1, 1]],
  }, `
      c.r *= blah_color.r * blah_color.a;
      c.g *= blah_color.g * blah_color.a;
      c.b *= blah_color.b * blah_color.a;
  `],
  */
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
  'player.acceleration': [300, 0, 10000],
  'player.mass': [1, 0, 100, (value, scene) => scene.level.player.body.setMass(value)],
  'player.drag': [0.8, 0, 1, (value, scene) => scene.level.player.setDrag(value)],
  'player.friction': [1, 0, 100, (value, scene) => scene.level.player.setFriction(value)],
  'player.bounce': [1, 0, 100, (value, scene) => scene.level.player.setBounce(value)],
  'player.maxVelocity': [200, 0, 1000, (value, scene) => scene.level.player.setMaxVelocity(value)],

  'follower.mass': [5, 0, 100, (value, scene) => scene.level.followers.forEach((f) => f.body.setMass(value))],
  'follower.drag': [0.98, 0, 1, (value, scene) => scene.level.followers.forEach((f) => f.setDrag(value))],
  'follower.friction': [1, 0, 100, (value, scene) => scene.level.followers.forEach((f) => f.setFriction(value))],
  'follower.bounce': [1, 0, 100, (value, scene) => scene.level.followers.forEach((f) => f.setBounce(value))],
  'follower.maxVelocity': [100, 0, 1000, (value, scene) => scene.level.followers.forEach((f) => f.setMaxVelocity(value))],
  'follower.flockAcceleration': [150, 0, 1000],
  'follower.cohereRadius': [400, 0, 1000],
  'follower.spreadRadius': [100, 0, 1000],

  'effects.sceneTransition.transition': [{
    animation: 'pushLeft',
    ease: 'Cubic.easeInOut',
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
  },
  ',': {
    image: 'tileGrass',
    group: 'transition',
    isStatic: true, // for followers
  },
  '+': {
    image: 'tileGrass',
    // followers
  },
  /*
  '{': {
    _inherit: '#',
    leftEdge: true,
  },
  */
};

preprocessPropSpecs(propSpecs, particleImages);

export const manageableProps = new ManageableProps(propSpecs);
export const propsWithPrefix = makePropsWithPrefix(propSpecs, manageableProps);
export default PropLoader(propSpecs, manageableProps);
