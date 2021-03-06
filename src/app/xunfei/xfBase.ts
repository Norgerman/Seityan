import { xunfeiAppId, xunfeiAppKey } from '../utils/conf';
import OfflineRecognizer from './offlineRecognizer';
export default class XfBase {
    public callback!: (value: any) => void
    public audioplay?: (url: string, host?: string) => Promise<void>;
    public offlineRecognizer!: OfflineRecognizer;

    private _audioPlayUrl = "http://h5.xf-yun.com/audioStream/";

    /**
     * 初始化Session会话
     * url                 连接的服务器地址（可选）
     * reconnection        客户端是否支持断开重连
     * reconnectionDelay   重连支持的延迟时间   
     */
    private session = new IFlyTtsSession({
        'url': 'ws://h5.xf-yun.com/tts.do',
        'reconnection': true,
        'reconnectionDelay': 30000
    });
    /* 音频播放对象 */
    private _audioElement!: HTMLAudioElement;
    /* 音频播放状态 0:未播放且等待音频数据状态，1:正播放且等待音频数据状态，2：未播放且不等待音频数据*/
    private _audioState = 0;
    private _iatResult = "";
    private _micOpen = false;
    private _micResolve!: (value?: string | PromiseLike<string>) => void
    private _micReject!: (reason?: any) => void
    private _iatSession: any;

    constructor(audioplay?: (url: string, host?: string) => Promise<void>) {
        this.audioplay = audioplay;
        this.onError = this.onError.bind(this);
        this.onProcess = this.onProcess.bind(this);
        this.onResult = this.onResult.bind(this);
        this.onVolume = this.onVolume.bind(this);
        this._iatSession = new IFlyIatSession({
            "callback": {
                "onResult": this.onResult,
                "onVolume": this.onVolume,
                "onError": this.onError,
                "onProcess": this.onProcess
            }
        });
    }

    public async tts(data: string) {
        return this.play(data, 'vixy', '9');
    }
    public isListening(): boolean {
        return this._micOpen;
    }

    public async iatBegin() {
        return new Promise<string>((resolve, reject) => {
            var ssb_param = {
                "grammar_list": null,
                "params": `appid=${xunfeiAppId},appidkey=${xunfeiAppKey}, lang = sms, acous = anhui, aue=speex-wb;-1, usr = mkchen, ssm = 1, sub = iat, net_type = wifi, rse = utf8, ent =sms16k, rst = plain, auf  = audio/L16;rate=16000, vad_enable = 1, vad_timeout = 5000, vad_speech_tail = 500, compress = igzip`
            };
            this._iatResult = '';
            /* 调用开始录音接口，通过function(volume)和function(err, obj)回调音量和识别结果 */

            this._micResolve = resolve
            this._micReject = reject
            this._iatSession.start(ssb_param);
            this._micOpen = true;
            this.offlineRecognizer && this.offlineRecognizer.stopVADRecording();
            // volumeEvent.start();
            console.log('开始录音...');
        });
    }

    public iatEnd() {
        this._iatSession.stop();
        this._micOpen = false;
        this.offlineRecognizer && this.offlineRecognizer.startVADRecording();
        console.log('结束录音');
    }

    /***********************************************local Variables**********************************************************/

    /**
     * @content 播放的语音内容
     * @vcn 播音员
     * @spd 速度，1-9，不过怎么感觉没啥用呢
     */
    private async play(content: string, vcn: string, spd: string) {
        return new Promise<void>((resolve, reject) => {
            // this.reset();

            var ssb_param = { "appid": xunfeiAppId, "appkey": xunfeiAppKey, "synid": "12345", "params": `ent=aisound,aue=lame,vcn=${vcn},spd=${spd}` };
            var audioPalyUrl = this._audioPlayUrl;
            var iaudio = this._audioElement;
            var audioplay = this.audioplay;
            var session = this.session;
            session.stop();
            session.start(ssb_param, content, function (err, obj) {
                var audio_url = obj.audio_url;
                if (audio_url != null && audio_url != undefined) {
                    if (audioplay) {
                        session.stop();
                        resolve(audioplay(audio_url, audioPalyUrl));
                    } else {
                        iaudio.src = audioPalyUrl + audio_url;
                        iaudio.play();
                        iaudio.onended = () => {
                            resolve();
                        }
                    }
                }
            });
        });
    };
    /**
     * 停止播放音频
     *
     */
    private stop() {
        this._audioState = 2;
        this._audioElement.pause();
    }

    private start() {
        this._audioState = 1;
        this._audioElement.play();
    }

    /**
     * 重置音频缓存队列和播放对象
     * 若音频正在播放，则暂停当前播放对象，创建并使用新的播放对象.
     */
    private reset() {
        var audio_array = [];
        this._audioState = 0;
        if (this._audioElement != null) {
            this._audioElement.pause();
        }
        this._audioElement = new Audio();
        this._audioElement.src = '';
        //window.iaudio.play();
    };

    /************** iat  ******************/

    private onResult(err: any, result: any) {
        var error: number | string = 0;
        /* 若回调的err为空或错误码为0，则会话成功，可提取识别结果进行显示*/
        if (err == null || err == undefined || err == 0) {
            if (result == '' || result == null)
                error = "没有获取到识别结果";
            else
                this._iatResult = result;
            /* 若回调的err不为空且错误码不为0，则会话失败，可提取错误码 */
        } else {
            error = 'error code : ' + err + ", error description : " + result;
        }
        this._micOpen = false;
        console.log('Result: ' + this._iatResult);
        this._iatSession.stop();
        this.offlineRecognizer && this.offlineRecognizer.startVADRecording();
        this.callback && this.callback(this._iatResult);
        if (error == 0) {
            this._micResolve(this._iatResult);
        }
        else {
            this._micReject(error);
        }
        // volumeEvent.stop();
    }
    private onProcess(status: string) {
        switch (status) {
            case 'onStart':
                // tip.innerHTML = "服务初始化...";
                break;
            case 'normalVolume':
            case 'started':
                // tip.innerHTML = "倾听中...";
                break;
            case 'onStop':
                // tip.innerHTML = "等待结果...";
                break;
            case 'onEnd':
                // tip.innerHTML = oldText;
                break;
            case 'lowVolume':
                // tip.innerHTML = "倾听中...(声音过小)";
                break;
            default:
            // tip.innerHTML = status;
        }
    }

    private onError() {
        this._micOpen = false;
        // volumeEvent.stop();
    }
    private onVolume(volume: any) {
        // volumeEvent.listen(volume);
    }
}

