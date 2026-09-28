import { getPetStage } from '../core/engine.js';
import { petImageUrl } from '../ui/pet-assets.js';

let activeGame = null;

function drawImagePet(scene, state, x, y) {
  if (!scene.textures.exists('finny-image')) return drawPet(scene, state, x, y);
  const stage = getPetStage(state);
  const image = scene.add.image(0, 0, 'finny-image');
  image.setScale(Math.min(260 / image.width, 175 / image.height));
  const pet = scene.add.container(x, y, [image]);
  drawImageAccessory(scene, pet, state.profile?.accessory || 'leaf', state.profile?.accessoryColor || 'green', stage.id);
  pet.setScale(stage.scale);
  pet.setSize(260, 175).setInteractive({ useHandCursor: true });
  if (state.settings?.animations !== false) {
    scene.tweens.add({ targets: pet, y: y - 5, duration: 1450, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
  pet.on('pointerdown', () => {
    if (state.settings?.animations === false) return;
    scene.tweens.add({ targets: pet, scaleX: stage.scale * 1.05, scaleY: stage.scale * 0.95, duration: 110, yoyo: true });
  });
  return pet;
}

function drawImageAccessory(scene, container, type, colorName = 'green', stageId = 1) {
  // The stage PNGs have slightly different head positions. Keep each
  // accessory anchored to the head instead of using one coordinate for all stages.
  const anchors = {
    1: { leaf: [-57, -58], bow: [-48, -58], star: [-49, -58] },
    2: { leaf: [-54, -61], bow: [-46, -60], star: [-47, -60] },
    3: { leaf: [-53, -59], bow: [-45, -58], star: [-46, -58] }
  };
  const stage = anchors[stageId] || anchors[1];
  const colors = {
    green: { main: 0x56b77c, dark: 0x2f7048, accent: 0x3a9b68 },
    pink: { main: 0xf47b91, dark: 0xb83d58, accent: 0xe85d78 },
    blue: { main: 0x6fa8ff, dark: 0x3569b8, accent: 0x4d8fe8 }
  };
  const color = colors[colorName] || colors.green;

  if (type === 'leaf') {
    const [x, y] = stage.leaf;
    const stem = scene.add.rectangle(x + 7, y + 8, 3, 20, color.dark).setAngle(34);
    const leafA = scene.add.ellipse(x, y, 22, 10, color.accent).setAngle(-24).setStrokeStyle(1, color.dark);
    const leafB = scene.add.ellipse(x + 13, y - 6, 20, 9, color.main).setAngle(28).setStrokeStyle(1, color.dark);
    container.add([stem, leafA, leafB]);
  }

  if (type === 'bow') {
    const [x, y] = stage.bow;
    const left = scene.add.ellipse(x - 8, y, 18, 13, color.accent).setAngle(18).setStrokeStyle(2, color.dark);
    const right = scene.add.ellipse(x + 8, y, 18, 13, color.accent).setAngle(-18).setStrokeStyle(2, color.dark);
    const knot = scene.add.circle(x, y + 1, 6, color.main).setStrokeStyle(2, color.dark);
    container.add([left, right, knot]);
  }

  if (type === 'star') {
    const [x, y] = stage.star;
    const star = drawStar(scene, x, y, 10, color.main);
    star.lineStyle(2, color.dark, 1);
    container.add(star);
  }
}


const palettes = {
  sunset: { fur: 0xf47b45, dark: 0x342c2a, soft: 0xffeadc, ear: 0xc94f2e },
  honey: { fur: 0xe6a84a, dark: 0x4a3527, soft: 0xfff1d2, ear: 0xb8782f },
  berry: { fur: 0xa95d74, dark: 0x352a35, soft: 0xf9e4ea, ear: 0x7e4057 }
};

function drawStar(scene, x, y, radius, color) {
  const points = [];
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const size = index % 2 === 0 ? radius : radius * 0.45;
    points.push(new Phaser.Math.Vector2(x + Math.cos(angle) * size, y + Math.sin(angle) * size));
  }
  const star = scene.add.graphics();
  star.fillStyle(color, 1);
  star.fillPoints(points, true);
  return star;
}

function drawAccessory(scene, container, type, stage, colorName = 'green') {
  const colors = {
    green: { main: 0x56b77c, dark: 0x2f7048, accent: 0x3a9b68 },
    pink: { main: 0xf47b91, dark: 0xb83d58, accent: 0xe85d78 },
    blue: { main: 0x6fa8ff, dark: 0x3569b8, accent: 0x4d8fe8 }
  };
  const color = colors[colorName] || colors.green;
  if (type === 'leaf') {
    const stem = scene.add.rectangle(-45, -77, 3, 27, color.dark).setAngle(32);
    const leafA = scene.add.ellipse(-55, -88, 29, 13, color.accent).setAngle(-24).setStrokeStyle(1, color.dark);
    const leafB = scene.add.ellipse(-38, -96, 27, 12, color.main).setAngle(28).setStrokeStyle(1, color.dark);
    container.add([stem, leafA, leafB]);
  }
  if (type === 'bow') {
    const left = scene.add.ellipse(42, -80, 31, 22, color.accent).setAngle(18).setStrokeStyle(2, color.dark);
    const right = scene.add.ellipse(65, -80, 31, 22, color.accent).setAngle(-18).setStrokeStyle(2, color.dark);
    const knot = scene.add.circle(54, -79, 9, color.main).setStrokeStyle(2, color.dark);
    container.add([left, right, knot]);
  }
  if (type === 'star') {
    const star = drawStar(scene, -48, -72, 17, color.main);
    container.add(star);
  }

  if (stage.id === 2) {
    const badge = scene.add.circle(-66, 49, 15, 0x5a8dee).setStrokeStyle(3, 0xffffff);
    const dot = scene.add.circle(-66, 49, 5, 0xffffff);
    container.add([badge, dot]);
  }
  if (stage.id === 3) {
    const crown = scene.add.graphics();
    crown.fillStyle(0xf6c453, 1);
    crown.fillPoints([
      new Phaser.Math.Vector2(-31, -89),
      new Phaser.Math.Vector2(-22, -119),
      new Phaser.Math.Vector2(-4, -99),
      new Phaser.Math.Vector2(12, -122),
      new Phaser.Math.Vector2(31, -89)
    ], true);
    crown.lineStyle(3, 0xd49a26, 1);
    crown.strokePath();
    container.add(crown);
  }
}

function drawPet(scene, state, x, y) {
  const profile = state.profile || { fur: 'sunset', accessory: 'leaf' };
  const colors = palettes[profile.fur] || palettes.sunset;
  const stage = getPetStage(state);
  const pet = scene.add.container(x, y);

  const tail = scene.add.ellipse(-73, 50, 118, 42, colors.ear).setAngle(-24);
  const tailStripeA = scene.add.ellipse(-91, 43, 24, 40, colors.soft).setAngle(-24);
  const tailStripeB = scene.add.ellipse(-56, 54, 22, 38, colors.soft).setAngle(-24);
  const body = scene.add.ellipse(0, 49, 112, 132, colors.fur);
  const belly = scene.add.ellipse(0, 62, 63, 82, colors.soft);
  const leftLeg = scene.add.ellipse(-35, 108, 31, 42, colors.dark);
  const rightLeg = scene.add.ellipse(35, 108, 31, 42, colors.dark);
  const leftArm = scene.add.ellipse(-52, 55, 27, 63, colors.dark).setAngle(17);
  const rightArm = scene.add.ellipse(52, 55, 27, 63, colors.dark).setAngle(-17);
  const leftEar = scene.add.circle(-44, -48, 27, colors.ear);
  const rightEar = scene.add.circle(44, -48, 27, colors.ear);
  const leftEarInner = scene.add.circle(-44, -48, 14, 0xf4b39e);
  const rightEarInner = scene.add.circle(44, -48, 14, 0xf4b39e);
  const head = scene.add.ellipse(0, -8, 122, 104, colors.fur);
  const leftCheek = scene.add.ellipse(-33, 7, 49, 50, colors.soft).setAngle(14);
  const rightCheek = scene.add.ellipse(33, 7, 49, 50, colors.soft).setAngle(-14);
  const muzzle = scene.add.ellipse(0, 20, 46, 33, 0xfff8f2);
  const leftMask = scene.add.ellipse(-29, -9, 30, 40, colors.dark).setAngle(14);
  const rightMask = scene.add.ellipse(29, -9, 30, 40, colors.dark).setAngle(-14);
  const leftEye = scene.add.circle(-29, -10, 6, 0xffffff);
  const rightEye = scene.add.circle(29, -10, 6, 0xffffff);
  const leftPupil = scene.add.circle(-29, -9, 3.2, 0x151b18);
  const rightPupil = scene.add.circle(29, -9, 3.2, 0x151b18);
  const nose = scene.add.ellipse(0, 16, 13, 9, 0x24201f);
  const smile = scene.add.graphics();
  smile.lineStyle(3, 0x342c2a, 1);
  smile.beginPath();
  smile.arc(-8, 24, 9, 0.1, 1.3, false);
  smile.strokePath();
  smile.beginPath();
  smile.arc(8, 24, 9, 1.85, 3.04, false);
  smile.strokePath();

  pet.add([
    tail, tailStripeA, tailStripeB, body, belly, leftLeg, rightLeg, leftArm, rightArm,
    leftEar, rightEar, leftEarInner, rightEarInner, head, leftCheek, rightCheek,
    muzzle, leftMask, rightMask, leftEye, rightEye, leftPupil, rightPupil, nose, smile
  ]);
  drawAccessory(scene, pet, profile.accessory, stage, profile.accessoryColor || 'green');
  pet.setScale(stage.scale);
  pet.setSize(180, 230).setInteractive({ useHandCursor: true });

  if (state.settings?.animations !== false) {
    scene.tweens.add({ targets: pet, y: y - 5, duration: 1450, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    scene.tweens.add({ targets: [leftPupil, rightPupil], scaleY: 0.2, duration: 90, yoyo: true, repeat: -1, repeatDelay: 2600 });
  }
  pet.on('pointerdown', () => {
    if (state.settings?.animations === false) return;
    scene.tweens.add({ targets: pet, scaleX: stage.scale * 1.05, scaleY: stage.scale * 0.95, duration: 110, yoyo: true });
  });
  return pet;
}

function drawForestBackground(scene, width, height, highContrast) {
  const g = scene.add.graphics();
  g.fillStyle(highContrast ? 0xeef7df : 0xc9e4bb, 1);
  g.fillRoundedRect(4, 4, width - 8, height - 8, 28);

  // Distant misty hills and a sunny clearing; all decoration stays behind Finny.
  g.fillStyle(0xa1c99b, 1);
  g.fillEllipse(116, 115, 210, 105);
  g.fillEllipse(259, 114, 182, 122);
  g.fillStyle(0x7fae84, 1);
  g.fillEllipse(95, 152, 166, 114);
  g.fillEllipse(266, 153, 166, 104);
  g.fillStyle(0xfff0ba, 0.65);
  g.fillCircle(185, 45, 22);
  g.fillStyle(0xf0f8d8, 0.32);
  g.fillEllipse(182, 95, 228, 45);

  // Bamboo at the sides frames the character without covering the face.
  for (const [x, top, bottom, thickness] of [[24, 30, height - 34, 11], [47, 15, height - 29, 9], [72, 29, height - 47, 7], [329, 23, height - 29, 12], [306, 16, height - 38, 8]]) {
    g.fillStyle(0x39744e, 1);
    g.fillRoundedRect(x, top, thickness, bottom - top, 4);
    g.fillStyle(0x8db765, 1);
    g.fillRect(x + 2, top + 3, 2, bottom - top - 6);
    g.lineStyle(2, 0xb6d792, 0.9);
    for (let y = top + 26; y < bottom; y += 32) g.lineBetween(x, y, x + thickness, y);
    for (const y of [top + 25, top + 64]) {
      scene.add.ellipse(x - 7, y - 4, 25, 8, 0x326b45).setAngle(28);
      scene.add.ellipse(x + 16, y - 12, 28, 9, 0x568e4c).setAngle(-35);
    }
  }

  const ground = scene.add.graphics();
  ground.fillStyle(0x658e4f, 1);
  ground.fillRoundedRect(12, height - 64, width - 24, 53, 20);
  ground.fillStyle(0xa9bb71, 1);
  ground.fillEllipse(width / 2, height - 34, 238, 37);
  ground.fillStyle(0xdad2a1, 0.75);
  ground.fillEllipse(width / 2, height - 29, 175, 22);
  for (const [x, y] of [[32, height - 28], [65, height - 21], [298, height - 25], [322, height - 35]]) {
    ground.lineStyle(2, 0x315f39, 1);
    ground.lineBetween(x, y, x - 5, y - 10);
    ground.lineBetween(x, y, x + 2, y - 14);
    ground.lineBetween(x, y, x + 8, y - 8);
  }

  // Small wooden school board, purely decorative and non-interactive.
  const board = scene.add.graphics();
  board.lineStyle(2, 0x80633d, 1);
  board.lineBetween(254, 33, 254, 20);
  board.lineBetween(320, 33, 320, 20);
  board.fillStyle(0x234b3c, 0.15);
  board.fillRoundedRect(242, 35, 95, 64, 6);
  board.fillStyle(0x996b41, 1);
  board.fillRoundedRect(238, 30, 96, 64, 5);
  board.fillStyle(0x244d40, 1);
  board.fillRoundedRect(244, 36, 84, 51, 2);
  board.lineStyle(1, 0xd2ecd4, 0.55);
  board.lineBetween(254, 64, 316, 64);
  board.lineBetween(254, 74, 295, 74);
  board.fillStyle(0xc79b62, 1);
  board.fillRoundedRect(237, 89, 99, 6, 2);
  board.fillStyle(0xe9f0d8, 1);
  board.fillRect(301, 86, 13, 3);
  scene.add.text(255, 43, '1 + 2 = 3', {
    fontFamily: 'sans-serif', fontSize: '12px', color: '#edf6df'
  });

  const rim = scene.add.graphics();
  rim.lineStyle(2, highContrast ? 0x183d2c : 0x7caa75, 1);
  rim.strokeRoundedRect(4, 4, width - 8, height - 8, 28);
}

export function destroyPetScene() {
  if (activeGame) {
    activeGame.destroy(true);
    activeGame = null;
  }
}

export function mountPetScene(parentId, state, { preview = false } = {}) {
  destroyPetScene();
  const parent = document.getElementById(parentId);
  if (!parent || !window.Phaser) return;

  class FinnyScene extends Phaser.Scene {
    preload() {
      this.load.image('finny-image', petImageUrl(state));
    }

    create() {
      const width = 360;
      const height = preview ? 230 : 270;
      drawForestBackground(this, width, height, state.settings?.highContrast);

      drawImagePet(this, state, width / 2, preview ? 115 : 135);
    }
  }

  activeGame = new Phaser.Game({
    type: Phaser.CANVAS,
    width: 360,
    height: preview ? 230 : 270,
    parent: parentId,
    backgroundColor: 'transparent',
    transparent: true,
    render: { antialias: true, pixelArt: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: FinnyScene,
    banner: false
  });
}
