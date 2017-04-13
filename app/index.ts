"use strict";

import * as PIXI from "pixi.js";
import "pixi-live2d";
import * as path from "path";
import * as models from "./utils/models";
import { WindowDragger } from "./uiElements/windowDragger";
import XfBase from "./xunfei/xfBase"

const renderer = new PIXI.WebGLRenderer(500, 800, { transparent: true });
const element = document.getElementById('app')
const dragger = new WindowDragger(element);
element!.appendChild(renderer.view);
const stage = new PIXI.Container();
const live2dSprite = new PIXI.Live2DSprite(models.blanc.data, { lipSyncWithSound: true, debugLog: true });

stage.addChild(live2dSprite);

live2dSprite.startRandomMotion('idle');
live2dSprite.adjustScale(0, 0, 0.7);
live2dSprite.adjustTranslate(models.blanc.translate.x, models.blanc.translate.y);

live2dSprite.on('click', (event: PIXI.interaction.InteractionEvent) => {
    const point: PIXI.Point = event.data.global;
    if (live2dSprite.hitTest('body', point.x, point.y)) {
        live2dSprite.startRandomMotionOnce('tap_body');
    }
});

live2dSprite.on('mousemove', (event: PIXI.interaction.InteractionEvent) => {
    const point: PIXI.Point = event.data.global;
    live2dSprite.setViewPoint(point.x, point.y);
});


renderer.view.addEventListener('mousewheel', event => {
    if (event.wheelDelta > 0) {
        live2dSprite.adjustScale(0, 0, 1 + 0.05);
    } else if (event.wheelDelta < 0) {
        live2dSprite.adjustScale(0, 0, 1 - 0.05);
    }
});

function animate() {
    requestAnimationFrame(animate);
    renderer.render(stage);
}

animate();
live2dSprite.setLipSync(0.5);

(function () {
    var test = new XfBase(live2dSprite.playSound.bind(live2dSprite));
    console.log("试问，汝是吾的Master吗？")
    test.tts("试问，汝是吾的Master吗？")
    test.iatBegin();
})();