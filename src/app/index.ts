import * as PIXI from "pixi.js";
import "pixi-live2d";
import * as path from "path";
import models from "./utils/models";
import { ModelLoader, ModelDescription } from "./utils/modelLoader";
import { WindowDragger } from "./uiElements/windowDragger";
import XfBase from "./xunfei/xfBase";
import { ipcRenderer, webFrame, remote } from "electron";
import { randomTips } from "./utils/randomTips";
import MainRobot from './robot/mainRobot'
import OfflineRecognizer from './xunfei/offlineRecognizer'
import * as dialog from "./utils/dialog";

var loader = remote.getGlobal('pluginLoader');
console.log(loader);


webFrame.setVisualZoomLevelLimits(1, 1);
webFrame.setLayoutZoomLevelLimits(1, 1);

const initSize = { width: 300, height: 400 }
const renderer = new PIXI.WebGLRenderer(initSize.width, initSize.height, { transparent: true, autoResize: true });
const element = document.getElementById('app')
const dragger = new WindowDragger(element);
element!.appendChild(renderer.view);
const stage = new PIXI.Container();
const defaultModel = models[0];
var xf: XfBase = new XfBase();;
var mainRobot: MainRobot;
var live2dSprite: PIXI.Live2DSprite | null = null;

var resizable = false;

async function createModelAsync(modelDescription: ModelDescription) {
    try {
        var model = await ModelLoader.loadModel(modelDescription);
        if (live2dSprite !== null) {
            stage.removeChild(live2dSprite);
        }

        live2dSprite = new PIXI.Live2DSprite(model, {
            lipSyncWithSound: true,
            debugLog: true,
            modelBasePath: modelDescription.basePath,
        });

        live2dSprite.on("removed", obj => {
            if (live2dSprite) {
                live2dSprite.removeAllListeners("click");
                live2dSprite.removeAllListeners("mousemove");
                live2dSprite.destroy();
            }
        })

        live2dSprite.on("added", obj => {
            if (live2dSprite == null) {
                return;
            }
            var sprite: PIXI.Live2DSprite = live2dSprite;

            resizable = true;
            sprite.on('click', (event: PIXI.interaction.InteractionEvent) => {
                const point: PIXI.Point = event.data.global;
                if (sprite.hitTest('body', point.x, point.y)) {
                    sprite.startRandomMotionOnce('tap_body');
                } else if (sprite.hitTest("head", point.x, point.y)) {
                    sprite.startRandomMotionOnce('flick_head');
                }
            });

            sprite.on('mousemove', (event: PIXI.interaction.InteractionEvent) => {
                const point: PIXI.Point = event.data.global;
                sprite.setViewPoint(point.x, point.y);
            });
        });

        stage.addChild(live2dSprite);

        live2dSprite.startRandomMotion('idle');

        mainRobot = new MainRobot(xf);
        xf.audioplay = live2dSprite.playSound.bind(live2dSprite!);
        xf.tts("试问，汝是吾的Master吗？");
    } catch (err) {
        ipcRenderer.send("loadModelFailed");
    }
}

renderer.view.addEventListener('mousewheel', event => {
    var currentSize = { width: renderer.width, height: renderer.height }
    var scale = 1
    if ((event as any).wheelDelta < 0) {
        scale -= 0.05;
    } else if ((event as any).wheelDelta > 0) {
        scale += 0.05;
    }

    if (scale != 1 && resizable) {
        var newSize = { width: currentSize.width * scale, height: currentSize.height * scale }
        renderer.resize(newSize.width, newSize.height);
        live2dSprite && live2dSprite.resize(newSize.width, newSize.height);
        ipcRenderer.send("resize", newSize);
    }
});

ipcRenderer.on("loadModel", loadModel)

function loadModel(event: any, name: string, buildIn: boolean): void {
    console.log(name, buildIn);
    let model: ModelDescription | null = null;
    if (buildIn) {
        let findedModels = models.filter(i => i.name == name);
        if (findedModels.length > 0) {
            model = findedModels[0];
        }
    } else {
        model = ModelLoader.parseModelPath(name);
    }
    model && createModelAsync(model);
}


// 响应主进程中的全局快捷键事件，开始响应用户语音，再按第二下快捷会即刻停止语音输入
ipcRenderer.on("start-listening", startListening);
async function startListening() {
    if (!xf) return;
    if (xf.isListening()) xf.iatEnd();
    try {
        await xf.tts(randomTips());
        let text = await xf.iatBegin();
        return mainRobot.input(text);
    } catch (e) {
        console.log('IAT error:', e);
        return;
    }
}

createModelAsync(defaultModel).catch(console.error);

function animate() {
    requestAnimationFrame(animate);
    renderer.render(stage);
}

animate();

var offlineRecognizer = OfflineRecognizer.create()
offlineRecognizer.then((e) => {
    console.log("初始化完成")
    xf.offlineRecognizer = e;
    e.startRecording();
    e.nameCallback = async (name) => {
        return startListening();
    }
})
