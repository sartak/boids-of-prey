import SuperScene from './scaffolding/SuperScene';
import prop from './props';
import analytics from './scaffolding/lib/analytics';

export default class PlayScene extends SuperScene {
  constructor() {
    super({
      input: {
        gamepad: true,
      },
      physics: {
        arcade: {
          fps: 60,
        },
      },
    });

    this.performanceProps = [];
    this.mapsAreRectangular = true;
  }

  initialSaveState() {
    return {
      createdAt: Date.now(),
    };
  }

  saveStateVersion() {
    return 1;
  }

  migrateSaveStateVersion1(save) {
  }

  init(config) {
    super.init(config);
  }

  preload() {
    super.preload();
  }

  create(config) {
    super.create(config);

    this.loadLevel('test');
  }

  loadLevel(id) {
    const level = super.loadLevel(id);
    const {tileWidth, tileHeight} = this.game.config;

    level.map.forEach((row, y) => {
      row.forEach((tile, x) => {
        tile.object = this.add.image(x * tileWidth, y * tileHeight, tile.image);
      });
    });

    this.level = level;

    this.level.player = this.createPlayer();

    return level;
  }

  createPlayer() {
    const {level} = this;
    const tile = level.mapLookups['@'][0];
    const {tileWidth, tileHeight} = this.game.config;

    const player = this.physics.add.sprite(tileWidth * tile.x, tileHeight * tile.y, 'spriteThing');

    this.cameraFollow(player);

    return player;
  }

  setupAnimations() {
  }

  musicName() {
  }

  firstUpdate(time, dt) {
    super.firstUpdate(time, dt);
  }

  processInput(time, dt) {
    const {command, level} = this;
    const {player} = level;

    if (command.up.held) {
      player.y -= 1;
    }
    if (command.down.held) {
      player.y += 1;
    }
    if (command.right.held) {
      player.x += 1;
    }
    if (command.left.held) {
      player.x -= 1;
    }
  }

  fixedUpdate(time, dt) {
    this.processInput();
  }

  willTransitionTo(newScene, transition) {
    super.willTransitionTo(newScene, transition);
  }

  willTransitionFrom(oldScene, transition) {
    super.willTransitionFrom(oldScene, transition);
  }

  didTransitionTo(newScene, transition) {
    super.didTransitionTo(newScene, transition);
  }

  didTransitionFrom(oldScene, transition) {
    super.didTransitionFrom(oldScene, transition);
  }

  launchTimeSight() {
    super.launchTimeSight();
  }

  renderTimeSightFrameInto(scene, phantomDt, time, dt, isLast) {
    const objects = [];

    return objects;
  }

  debugHandlePointerdown(event) {
    let {x, y} = event;

    x += this.camera.scrollX;
    y += this.camera.scrollY;
  }

  _hotReloadCurrentLevel() {
    super._hotReloadCurrentLevel({
    }, {
      animation: 'crossFade',
      duration: 200,
      delayNewSceneShader: true,
      removeOldSceneShader: true,
    }).then((scene) => {
    });
  }

  _hot() {
  }
}
