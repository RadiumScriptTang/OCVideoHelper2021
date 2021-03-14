let xxxxxx = setInterval(function () {

    if (typeof webRTC !== "undefined") {
        webRTC.toolbarList = ['play', 'pause', 'stop', 'voice', 'split', 'sharp', 'times', 'scrren'];
        /**
         * @description: 加载操作栏, 增加了倍速可选类型
         */
        webRTC.getToolHtml = function (list) {
            var html = '<div class="tool-bar"><div class="tool-bar-sub">';
            var that = this;
            list.forEach(function (item) {
                switch (item) {
                    case 'stop':
                        html += '<div class="tool-bar-item tool-btn__' + item + '"></div><div class="tool-view-time"></div></div><div class="tool-bar-sub">';
                        break;
                    case 'voice':
                        html += '<div id="voiceContorl" class="tool-bar-item tool-btn__' + (that.isMuted ? 'muted' : 'voice') + '"></div>';
                        break;
                    case 'split':
                        html += '<div id="splitContorl" class="tool-bar-item tool-btn__' + item + '"></div>';
                        break;
                    case 'scrren':
                        html += '<div class="tool-bar-item tool-btn__' + item + '"></div>';
                        break;
                    case 'sharp':
                        html += '<div class="tool-bar-item tool-btn__' + item + '">高清</div>';
                        break;
                    case 'times':
                        html += '<div id="timesContorl" class="tool-bar-item tool-btn__' + item + '" style="width: 32px;text-align: center;border: 1px #ebe1e1 solid;border-radius: 2px;">倍速';
                        html += '<ul id="speed-select" style="display: none;  z-index: 1000  ;position: absolute;    bottom: 25px;    border-radius: 3px;    background-color: rgba(28,32,44,.9);"><li id="8">8倍</li><li id="4">4倍</li><li id="2">2倍</li><li id="1.5">1.5倍</li><li id="1.25">1.25倍</li><li id="1" class="times-active">正常倍速</li><li id="0.5">0.5倍</li></ul>';
                        html += '</div>';
                        break
                    default:
                        html += '<div class="tool-bar-item tool-btn__' + item + '"></div>';
                        break
                }
            })
            html += '</div>'
            return html
        }
        /**
         * @description: 倍速
         */
        webRTC.addTimesEvent = function () {
            var times = document.querySelector('#timesContorl');
            times.addEventListener('click', (e) => {
                document.getElementById("speed-select").style.display = 'block';
                if (e.target.tagName !== 'LI') return;
                document.getElementById("speed-select").style.display = 'none';

                var num = parseInt(e.target.id);
                document.querySelector('.times-active').className = '';
                e.target.className = 'times-active';
                for (let i = 0; i < this.ids.length; i++) {
                    this.allInstance['type' + (i + 1)].playbackRate(num);
                }
            })
        }
        /**
         * @description: 增加了按键快进快退方法
         */
        webRTC.addTouchEvent = function () {
            let that = this;
            document.onkeydown = function (keycode) {
                if (keycode.code === "ArrowRight") {
                    for (let i = 0; i < that.ids.length; i++) {
                        let currentTime = that.allInstance['type' + (i + 1)].currentTime();
                        that.allInstance['type' + (i + 1)].currentTime(currentTime + 5);
                    }
                } else if (keycode.code === "ArrowLeft") {
                    for (let i = 0; i < that.ids.length; i++) {
                        let currentTime = that.allInstance['type' + (i + 1)].currentTime();
                        that.allInstance['type' + (i + 1)].currentTime(currentTime - 5);
                    }
                }
            }
        }
        webRTC.setSpeedRate = function () {
            if (this.speedTime) return;
            var rtcMask = document.querySelector('.rtc-mask');
            var progress = document.querySelector('.tool-progress-rate');
            var progressRatio = document.querySelector('.clip-progress-ratio');
            var progressTimer = document.querySelector('.clip-progress-timer');

            var myVideo = document.querySelector('#rtcContent video');
            this.timeUpdateFlag = false;
            myVideo.addEventListener('timeupdate', () => {
                if (this.timeUpdateFlag) {
                    return;
                }
                this.timeUpdateFlag = true;
                var currentTime = myVideo.currentTime;
                this.speedTime = setTimeout(() => {
                    this.timeUpdateFlag = false;
                    this.senTime = currentTime;
                    if (this.senTime > this.duration.totalS) {
                        this.stop();
                        rtcMask.style.display = 'flex';
                        return;
                    }
                    this.setViewSenTime(this.senTime)
                    if (this.config.playType === 'liveStreaming' || this.config.playType === 'flv') return;
                    progress.style.width = this.senTime * 100 / this.duration.totalS + '%';
                    if (progressRatio) {
                        progressRatio.style.left = this.senTime * 100 / this.duration.totalS + '%';
                    }
                    if (progressTimer) {
                        this.setClipProgTimer(progressTimer, this.senTime);
                    }
                }, 100)
            })
        }
        /**
         * @description: 重写初始化方法
         */
        webRTC.init = function () {
            if (!this.creatMainHtml()) return;
            this.setVoiceContorl();
            this.setSplitContorl(this.config.styleList);
            this.setShowHide('.split-select', '#splitContorl');
            this.setShowHide('.voice-volume', '#voiceContorl');
            this.isAutoPlay();
            this.creatVideo();
            this.addTouchEvent();
            this.addTimesEvent();
        }
        webRTC.init();
        setTimeout(function (){
            webRTC.voice();
        },1000);
        clearInterval(xxxxxx);

    }

}, 100);
