class WebRtc {

    constructor(config, params) {
        this.config = config
        this.params = params
        this.allInstance = {}
        this.ids = this.config.ids.hd.length ? this.config.ids.hd : this.config.ids.sd
        this.tokens = this.config.tokens ? (this.config.ids.hd.length ? this.config.tokens.hdTokens : this.config.tokens.sdTokens) : null;
        this.toolbarList = this.config.toolbarList || ['play', 'pause', 'stop', 'voice', 'split', 'sharp', 'scrren']
        this.playStatus = config.autoplay ? 'play' : 'pause'
        this.isMuted = config.autoplay ? true : false
        this.sharpStatus = ''
        this.splitStatus = ''
        this.scrrenStatus = false
        // 视频播放时间每秒进度，节流参数
        this.timeUpdateFlag = false
        this.asyncs = new Array()
        this.speedTime = null
        this.duration = {}
        this.senTime = ''
        this.volume = 50
        this.isFull = false
        this.isFirst = true
        // count为已经加载完成的视频数量。
        this.count = 0
        this.clipSubObj = new Object()
        this.init()
    }

    init() {
        if (!this.creatMainHtml()) return
        this.setVoiceContorl()
        this.setSplitContorl(this.config.styleList)
        this.setShowHide('.split-select', '#splitContorl')
        this.setShowHide('.voice-volume', '#voiceContorl')
        this.isAutoPlay()
        this.creatVideo()
    }

    /**
     * @description: 是否自动播放
     */
    isAutoPlay() {
        var play = document.querySelector('.tool-btn__play')
        var pause = document.querySelector('.tool-btn__pause')
        if (this.config.autoplay) {
            play.style.display = 'none'
            pause.style.display = 'block'
        } else {
            play.style.display = 'block'
            pause.style.display = 'none'
        }
    }

    /**
     * @description: 生成播放器主体html
     */
    creatMainHtml() {
        var main = document.querySelector(this.config.app)
        if (!this.ids.length) {
            main.style.width = '100%'
            main.style.height = '100%'
            main.innerHTML = '<div class="rtc-not-data">无相关视频数据</div>'
            return false
        }
        var idx = this.config.styleList.length
        var style = this.config.size ? 'width: ' + this.config.size.width + ';height: ' + this.config.size.height : ''
        var html = '<div id="rtcContent" class="style-type-' + this.ids.length + '-1" style="' + style + '">'
        var isToolProgress = this.config.playType != 'liveStreaming' && this.config.playType != 'flv'
        html += this.getSplitHtml(this.ids.length)
        html += '</div><div id="rtcTool">' + (isToolProgress ? '<div class="tool-progress"><div class="tool-progress-rate"><div class="tool-progress-circle"></div></div></div>' : '')
        html += this.getToolHtml(this.toolbarList)
        html += '</div>'
        main.innerHTML = html
        return true
    }

    /**
     * @description: 加载分屏HTML结构
     */
    getSplitHtml(num) {
        var html = '<div class="rtc-mask"><div class="mask-repeat"></div>重播</div>';
        var state = this.isMuted ? 'off' : 'on';
        for (let i = 0; i < num; i++) {
            html += '<div class="rtc-cont-item cont-item-' + (i + 1) + '"><div class="voice-icon voice-' + state + '" id="' + (i + 1) + '"></div></div>'
        }
        return html
    }

    /**
     * @description: 实例化播放器
     */
    creatVideo() {
        var quote = null
        if (this.config.playType === 'liveStreaming') {
            quote = this.params.mediaInfo.liveStreaming
        }

        if (this.config.playType === 'nonLiveStreaming') {
            quote = this.params.mediaInfo.nonLiveStreaming
        }

        for (let i = 0; i < this.ids.length; i++) {
            if (this.config.playType === 'file' || this.config.playType === 'flv') {
                this.params.mediaUrl = this.ids[i]
            } else {
                quote.devId = this.ids[i]
                quote.accountToken = this.tokens[i]
            }
            this.params.selector = '.cont-item-' + (i + 1)
            this.allInstance['type' + (i + 1)] = new KMedia(this.params);
            if(this.config.autoplay) {
                this.asyncs.push(new Promise(resolve => {
                    this.allInstance['type' + (i + 1)].loadedmetaData(() => {
                        resolve()
                        if (this.isFirst) {
                            this.allInstance['type' + (i + 1)].muted(true)
                        } else {
                            this.voice(this.isMuted ? 'voice' : 'muted')
                        }
                        setTimeout(()=> {
                            this.allInstance['type' + (i + 1)].play()
                        })
                    })
                }))
            }
        }
        this.allLoading()
    }

    /**
     * @description: 全部加载完成后的事件
     */
    allLoading ()  {
        this.setViewTime()
        if (this.config.playType != 'liveStreaming' && this.config.playType != 'flv') {
            this.loadingDurationTime = new Promise( resolve => {
                this.getDurationTime()
                this.setToolProgress()
                resolve()
            })
        }
        if (this.config.autoplay) {
            Promise.race(this.asyncs).then(()=> {
                this.setSplitSelect()
                this.setContorlDrag()
                this.windowVoiceClick()
                this.setToolsClick()
                this.setRepeatPlay()
                this.dbClickFullScrren()
                this.play('play')
            })
        }
        if (this.config.enableClip) {
            this.initClipPlugin()
            this.config.clipInit(this)
        }
    }

    /**
     * @description: 监听异步状态
     */
    watchAsync(i) {
        if (this.isCutover) {
            this.allInstance['type' + (i + 1)].muted(true)
        } else {
            this.count++
            var className = this.allInstance['type' + (i + 1)].container.firstChild.className
            var state = className.indexOf('-on') > -1 ? false : true
            this.allInstance['type' + (i + 1)].muted(state)
            if (this.count == this.ids.length) {
                this.isCutover = true
                setTimeout(() => {
                    this.play()
                })
                this.count = 0
            }
        }
    }

    /**
     * @description: 加载操作栏
     */
    getToolHtml(list) {
        var html = '<div class="tool-bar"><div class="tool-bar-sub">'
        var that = this
        list.forEach(function (item) {
            switch (item) {
                case 'stop':
                    html += '<div class="tool-bar-item tool-btn__' + item + '"></div><div class="tool-view-time"></div></div><div class="tool-bar-sub">'
                    break
                case 'voice':
                    html += '<div id="voiceContorl" class="tool-bar-item tool-btn__' + (that.isMuted ? 'muted' : 'voice') + '"></div>'
                    break
                case 'split':
                    html += '<div id="splitContorl" class="tool-bar-item tool-btn__' + item + '"></div>'
                    break
                case 'scrren':
                    html += '<div class="tool-bar-item tool-btn__' + item + '"></div>'
                    break
                case 'sharp':
                    html += '<div class="tool-bar-item tool-btn__' + item + '">高清</div>'
                    break
                default:
                    html += '<div class="tool-bar-item tool-btn__' + item + '"></div>'
                    break
            }
        })
        html += '</div>'
        return html
    }

    /**
     * @description: 加载时间显示控件
     */
    setViewTime() {
        var viewTime = document.querySelector('.tool-view-time')
        var html = '<span class="current-m">00</span> : <span class="current-s">00</span>' +
            (this.config.playType === 'liveStreaming' || this.config.playType === 'flv' ? '' : ' / <span class="duration-m">00</span> : <span class="duration-s">00</span></<span>')
        viewTime.innerHTML = html
    }

    /**
     * @description: 窗口声音图标点击事件
     */
    windowVoiceClick() {
        var that = this
        var rtcContent = document.querySelector('#rtcContent');
        rtcContent.addEventListener('click', function (e) {
            var re = new RegExp('voice-icon')
            if (re.test(e.target.className)) {
                var idx = e.target.id
                var instance = that.allInstance['type' + idx]
                var state = instance.volume()
                if (state) {
                    instance.muted(true)
                    e.target.className = 'voice-icon voice-off'
                } else {
                    instance.muted(false)
                    e.target.className = 'voice-icon voice-on'
                }
            }
        })
    }

    /**
     * @description: 加载声音控件
     */
    setVoiceContorl() {
        var voice = document.querySelector('#voiceContorl')
        var html = '<div class="voice-volume">' +
            '<div class="voice-max">' +
            '<div class="voice-rate" style="height:' + (this.isMuted ? '0' : this.volume) + 'px;">' +
            '<div class="tool-progress-circle tool-rate-tip">' +
            '</div></div></div></div>'
        voice.innerHTML = html
    }

    /**
     * @description: 加载分屏控件
     */
    setSplitContorl(list) {
        var split = document.querySelector('#splitContorl')
        var html = '<ul class="split-select">'
        for (let i = 0; i < this.ids.length; i++) {
            switch (i + 1) {
                case 1:
                    html += '<li class="style-type-' + list[i] + '">单屏</li>'
                    break;
                case 2:
                    html += '<li class="style-type-' + list[i] + '">双屏(一大一小)</li>'
                    if (list.indexOf('2-2') > -1) {
                        html += '<li class="style-type-' + list[i] + '">双屏(等分)</li>'
                    }
                    break;
                case 3:
                    html += '<li class="style-type-' + list[i] + '">三屏(一大两小)</li>'
                    if (list.indexOf('3-2') > -1) {
                        html += '<li class="style-type-' + list[i] + '">三屏(品字形)</li>'
                    }
                    break;
                case 4:
                    html += '<li class="style-type-' + list[i] + '">四屏(一大三小)</li>'
                    if (list.indexOf('4-2') > -1) {
                        html += '<li class="style-type-' + list[i] + '">四屏(田字形)</li>'
                    }
                    break;
                case 9:
                    html += '<li class="style-type-' + list[i] + '">九屏</li>'
                    break;
            }
        }
        split.innerHTML = html += '</ul>'
    }

    /**
     * @description: 设置进度条点击事件
     */
    setToolProgress() {
        var that = this
        var toolRate = document.querySelector('.tool-progress-rate')
        var re = new RegExp('tool-progress-circle')
        var toolProgress = document.querySelector('.tool-progress')
        toolProgress.addEventListener('click', function (ev) {
            if (ev.target.className === 'tool-progress' || ev.target.className === 'tool-progress-rate') {
                var width = toolProgress.offsetWidth
                var left = toolRate.getBoundingClientRect().left
                var rate = (ev.clientX - left) / width
                toolRate.style.width = rate * 100 + '%'
                that.senTime = rate * that.duration.totalS
                // 清除进度定时器，防止1s后进度条闪跳
                clearTimeout(that.speedTime)
                // 重置节流参数
                that.timeUpdateFlag = false
                that.setViewSenTime(that.senTime)
                that.setKMediaRate(that.senTime)
            }
        })
    }

    /**
     * @description: 设置播放器实例的播放进度
     */
    setKMediaRate(time) {
        var value = time / this.duration.totalS * 100
        value = value > 100 ? 100 : value
        for (let i = 0; i < this.ids.length; i++) {
            this.allInstance['type' + (i + 1)].progressConvertTime(value)
        }
    }

    /**
     * @description: 设置操作栏点击事件
     */
    setToolsClick() {
        var toolBar = document.querySelector('.tool-bar')
        var that = this
        toolBar.addEventListener('click', function (e) {
            var re = new RegExp('tool-bar-item')
            if (re.test(e.target.className)) {
                var btn = e.target.className.slice(24)
                switch (btn) {
                    case 'play':
                    case 'pause':
                        that.play(btn)
                        break;
                    case 'stop':
                        that.stop(btn)
                        break;
                    case 'voice':
                    case 'muted':
                        that.voice(btn)
                        break;
                    case 'sharp':
                        that.sharp(btn)
                        break;
                    case 'scrren':
                        that.scrren(btn)
                        break;
                }
            }
        })
    }

    /**
     * @description: 设置分屏选项处理
     */
    setSplitSelect() {
        var select = document.querySelector('.split-select')
        var rtcContent = document.querySelector('#rtcContent')
        select.addEventListener('click', function (e) {
            rtcContent.className = e.target.className
        })
    }

    /**
     * @description: 设置元素的显示隐藏
     */
    setShowHide(cld, prd) {
        var cldDom = document.querySelector(cld)
        var prdDom = document.querySelector(prd)
        var timer = null
        prdDom.addEventListener('mouseover', function () {
            clearTimeout(timer)
            cldDom.style.display = 'block'
        })
        prdDom.addEventListener('mouseout', function () {
            timer = setTimeout(function () {
                cldDom.style.display = 'none'
            }, 500)
        })
    }

    /**
     * @description: 设置可以拖拽的控件
     */
    setContorlDrag() {
        var that = this
        var re = new RegExp('tool-progress-circle')
        var rex = new RegExp('tool-rate-tip')
        document.onmousedown = function (e) {
            if (!re.test(e.target.className)) return
            var lock = true;
            var target = e.target
            var isTarget = rex.test(target.className)
            var rateWidth = target.parentNode.parentNode.offsetWidth
            var eleTop = target.parentNode.offsetHeight
            var eleLeft = target.parentNode.offsetWidth
            var initialX = e.clientX
            var initialY = e.clientY
            document.onmousemove = function (event) {
                if (!lock) return
                // 进度条设置
                if (!isTarget) {
                    clearTimeout(that.speedTime)
                    that.speedTime = null;
                    // 当前进度位置
                    var totalW = event.clientX - initialX + eleLeft
                    // 当前进度位置
                    var realLeft = that.limit(totalW, rateWidth)
                    // 设置进度条位置
                    target.parentNode.style.width = realLeft + 'px'
                    // 拖拽位置对应的已播放时间
                    that.senTime = parseInt(realLeft / rateWidth * that.duration.totalS)
                    // 设置已播时间的显示
                    that.setViewSenTime(that.senTime)
                }
                // 声音设置
                if (isTarget && !that.disable) {
                    var fromY = initialY - event.clientY
                    var totalH = fromY + eleTop
                    that.volume = that.limit(totalH, 100)
                    target.parentNode.style.height = that.volume + 'px'
                    that.setVolume(that.volume)
                }
            }
            document.onmouseup = function (event) {
                lock = false
                if (!that.playStatus || isTarget) return
                that.setKMediaRate(that.senTime)
                if (that.playStatus === 'play') {
                    that.setSpeedRate()
                }
            }
        }
    }

    /**
     * @description: 播放/暂停
     */
    play(name) {
        this.playStatus = name ? name : this.playStatus
        var play = document.querySelector('.tool-btn__play')
        var pause = document.querySelector('.tool-btn__pause')
        var rtcMask = document.querySelector('.rtc-mask')
        rtcMask.style.display = 'none'
        if (this.playStatus === 'play') {
            play.style.display = 'none'
            pause.style.display = 'block'
            this.setSpeedRate()
        }
        if (this.playStatus === 'pause') {
            play.style.display = 'block'
            pause.style.display = 'none'
            clearTimeout(this.speedTime)
            this.speedTime = null
        }
        for (let i = 0; i < this.ids.length; i++) {
            if (this.playStatus === 'play') {
                this.allInstance['type' + (i + 1)].play()
            } else {
                this.allInstance['type' + (i + 1)].pause()
            }
        }
    }

    /**
     * @description: 停止播放
     */
    stop(name) {
        var play = document.querySelector('.tool-btn__play')
        var pause = document.querySelector('.tool-btn__pause')
        clearTimeout(this.speedTime)
        this.playStatus = 'pause'
        this.speedTime = null
        play.style.display = 'block'
        pause.style.display = 'none'
        this.senTime = 0
        for (let i = 0; i < this.ids.length; i++) {
            this.allInstance['type' + (i + 1)].stop()
        }
        this.setViewSenTime(0)
    }

    /**
     * @description: 设置重播事件
     */
    setRepeatPlay() {
        var repeat = document.querySelector('.mask-repeat')
        repeat.addEventListener('click', () => {
            this.play('play')
        })
    }

    /**
     * @description: 静音/启音
     */
    voice(name) {
        var ele = document.querySelector('#voiceContorl')
        var voiceRate = document.querySelector('.voice-rate')
        var voiceIcons = document.querySelectorAll('.voice-icon')
        if (name === 'voice') {
            this.isMuted = true
            voiceRate.style.height = 0;
            ele.className = 'tool-bar-item tool-btn__muted'
        } else {
            this.isMuted = false
            voiceRate.style.height = this.volume + '%'
            ele.className = 'tool-bar-item tool-btn__voice'
        }
        for(let i = 0; i < this.ids.length; i++) {
            this.allInstance['type' + (i + 1)].muted(this.isMuted)
            voiceIcons[i].className = this.isMuted ? 'voice-icon voice-off' : 'voice-icon voice-on'
            if (!this.isMuted) {
                this.allInstance['type' + (i + 1)].volume(this.volume)
            }
        }
    }

    /**
     * @description: 清晰度选择
     */
    sharp() {
        this.isFirst = false
        var btn = document.querySelector('.tool-btn__sharp')
        var data = btn.innerHTML === '高清' ? this.config.ids.sd : this.config.ids.hd
        btn.innerHTML = btn.innerHTML === '高清' ? '标清' : '高清'
        for(let i = 0; i < data.length; i++) {
            var params = {
                src: data[i],
                type: this.config.playType,
                websocketUrl: this.config.mediaServer
            }
            if (this.config.playType != 'file' && this.config.playType != 'flv') {
                var tokens = btn.innerHTML === '高清' ? this.config.tokens.sdTokens : this.config.tokens.hdTokens
                params.accountToken = tokens[i]
            }
            if (this.config.playType === 'nonLiveStreaming') {
                params.startTime = this.config.time.startTime
                params.endTime = this.config.time.endTime
                params.mode = 'nomal'
            }
            this.allInstance['type' + (i + 1)].src(params)
        }
    }

    /**
     * @description: 全屏
     */
    scrren() {
        var ele = document.querySelector('#rtcContent')
        var rtcTool = document.querySelector('#rtcTool')
        var rtcMain = document.querySelector(this.config.app)
        var fullMethod = ele.requestFullScreen || //W3C
            ele.webkitRequestFullScreen //Chrome等
        var exitMethod = document.exitFullscreen ||
            document.webkitExitFullscreen //Chrome等
        window.onresize = () => {
            this.isFull = !this.isFull
            if (!this.isFull) {
                var clipNode = document.querySelector('.clip-container')
                if (clipNode) {
                    rtcMain.insertBefore(rtcTool, clipNode)
                } else {
                    rtcMain.appendChild(rtcTool)
                }
                rtcTool.className = ''
            }
        }
        ele.onmousemove = function () {
            var rangeY = window.screen.height * 0.5
            var tool = document.querySelector('.fixed-tool')
            if (tool) {
                if (event.clientY > rangeY) {
                    tool.style.bottom = 0
                } else {
                    tool.style.bottom = -32 + 'px'
                }
            }
        }
        if (!this.isFull) {
            fullMethod.call(ele)
            ele.appendChild(rtcTool)
            rtcTool.className = 'fixed-tool'
            return
        }
        if (this.isFull && exitMethod) {
            exitMethod.call(document)
            return
        }
        if (this.isFull && typeof window.ActiveXObject) {
            var wscript = new ActiveXObject('WScript.Shell')
            wscript.SendKeys('{F11}');
        }
    }

    /**
     * @description: 极限值内的返回值
     */
    limit(value, max) {
        if (value > max) {
            return max
        }
        if (value < 2) {
            return 2
        }
        return value
    }

    /**
     * @description: 计算视频总时长
     */
    getDurationTime() {
        var durationM = document.querySelector('.duration-m')
        var durationS = document.querySelector('.duration-s')
        var sTime = new Date(this.config.time.startTime)
        var eTime = new Date(this.config.time.endTime)
        var totalS = (eTime - sTime) / 1000
        if (this.config.playType === 'file' && this.config.time.totalS) {
            totalS = this.config.time.totalS
        }
        var min = parseInt(totalS / 60)
        var sec = totalS % 60
        durationM.innerHTML = min < 10 ? '0' + min : min
        durationS.innerHTML = sec < 10 ? '0' + sec : sec
        this.duration = {
            min,
            sec,
            totalS
        }
    }

    /**
     * @description: 设置视频已播放时间显示
     * @params {second} 时间 单位/秒
     */
    setViewSenTime(second) {
        var currentM = document.querySelector('.current-m')
        var currentS = document.querySelector('.current-s')
        var m = parseInt(second / 60)
        var s = parseInt(second % 60)
        currentM.innerHTML = m < 10 ? '0' + m : m
        currentS.innerHTML = s < 10 ? '0' + s : s
    }

    /**
     * @description: 设置已播放时间进度
     */
    setSpeedRate() {
        if (this.speedTime) return
        var rtcMask = document.querySelector('.rtc-mask')
        var progress = document.querySelector('.tool-progress-rate')
        var progressRatio = document.querySelector('.clip-progress-ratio')
        var progressTimer = document.querySelector('.clip-progress-timer')

        var myVideo = document.querySelector('#rtcContent video')
        this.timeUpdateFlag = false
        myVideo.addEventListener('timeupdate', ()=>{
            if(this.timeUpdateFlag) {
                return
            }
            this.timeUpdateFlag = true
            var currentTime = myVideo.currentTime
            this.speedTime = setTimeout(()=> {
                this.timeUpdateFlag = false
                this.senTime = currentTime
                if (this.senTime > this.duration.totalS) {
                    this.stop()
                    rtcMask.style.display = 'flex'
                    return
                }
                this.setViewSenTime(this.senTime)
                if (this.config.playType === 'liveStreaming' || this.config.playType === 'flv') return
                progress.style.width = this.senTime * 100 / this.duration.totalS + '%'
                if (progressRatio) {
                    progressRatio.style.left = this.senTime * 100 / this.duration.totalS + '%'
                }
                if (progressTimer) {
                    this.setClipProgTimer(progressTimer, this.senTime)
                }
            }, 1000)
        })
    }

    /**
     * @description: 设置音量
     */
    setVolume(value) {
        for (let i = 0; i < this.ids.length; i++) {
            if (this.allInstance['type' + (i + 1)].volume()) {
                this.allInstance['type' + (i + 1)].volume(value)
            }
        }
    }

    /**
     * @description: 双击全屏事件
     */
    dbClickFullScrren () {
        var rtcContent = document.querySelector('#rtcContent')
        rtcContent.addEventListener('dblclick', function (e) {
            if (e.target.nodeName != 'VIDEO') return
            e.target.requestFullscreen()
        })
    }

    /**
     * @description: 销毁实例
     */
    destoryKmedia() {
        clearTimeout(this.speedTime)
        this.speedTime = null;
        for (let i = 0; i < this.ids.length; i++) {
            if (this.allInstance['type' + (i + 1)]) {
                this.allInstance['type' + (i + 1)].closeMedia()
                this.allInstance['type' + (i + 1)] = null
            }
        }
    }

    /**
     * @description: 对服务器返回的已剪辑部分进行回显
     */
    initEcho(list) {
        list.forEach((item, i) => {
            var id = 1000 + i
            this.clipSubObj['subId_' + id] = {sTime: item.vetaBeginTime, eTime: item.vetaEndTime}
            item.vetaBeginTime = this.getTimeText(item.vetaBeginTime)
            item.vetaEndTime = this.getTimeText(item.vetaEndTime)
            this.creatClipsItem(id, item)
            this.creatSelectShadow(id, item)
        })
    }

    /**
     * @description: 元素相对浏览器视口的水平偏移量
     */
    getEleOffsetLeft (ele) {
        var left = ele.offsetLeft
        var current = ele.offsetParent
        while (current != null) {
            left += current.offsetLeft
            current = current.offsetParent
        }
        return left
    }

    /**
     * @description: 构建剪辑工具
     */
    initClipPlugin() {
        // 播放器main
        var main = document.querySelector(this.config.app)

        // 剪辑工具容器
        var clipContainer = document.createElement('div')
        clipContainer.className = 'clip-container'
        main.appendChild(clipContainer)

        // 剪辑工具进度相关控件
        var clipProgress = document.createElement('div')
        clipProgress.className = 'clip-progress'
        clipContainer.appendChild(clipProgress)

        // 剪辑工具进度标尺
        var clipRuler = document.createElement('div')
        clipRuler.className = 'clip-ruler'
        clipProgress.appendChild(clipRuler)

        // 剪辑工具光标触发的悬浮层
        var clipRulerLayer = document.createElement('div')
        clipRulerLayer.className = 'clip-ruler-layer'
        clipProgress.appendChild(clipRulerLayer)
        var progOffsetLeft = this.getEleOffsetLeft(clipProgress)
        clipRulerLayer.onmousemove = (e) => {
            var left = e.clientX - progOffsetLeft
            if (left < 0) left = 0
            if (left > clipProgress.offsetWidth) left = clipProgress.offsetWidth
            jumpTo.style.left = left + 'px'
        }

        // 剪辑工具光标
        var jumpTo = document.createElement('div')
        jumpTo.className = 'clip-jump-to'
        clipRulerLayer.appendChild(jumpTo)
        jumpTo.onclick = (e) => {
            progress.style.left = e.target.offsetLeft + 'px'
            this.senTime = Math.round(e.target.offsetLeft * this.duration.totalS / clipProgress.offsetWidth)
            this.setViewSenTime(this.senTime)
            this.setKMediaRate(this.senTime)
        }

        // 剪辑工具进度光标
        var progress = document.createElement('div')
        progress.className = 'clip-progress-ratio'
        clipProgress.appendChild(progress)

        // 剪辑工具光标对应时间显示
        var progressTimer = document.createElement('div')
        progressTimer.className = 'clip-progress-timer'
        progressTimer.innerText = this.config.time.startTime
        progress.appendChild(progressTimer)

        // 剪辑工具区间选择器的背景
        var clipSelectBg = document.createElement('div')
        clipSelectBg.className = 'clip-select-bg'
        clipProgress.appendChild(clipSelectBg)

        // 剪辑工具的区间选择器
        var clipRulerSelect = document.createElement('div')
        clipRulerSelect.className = 'clip-ruler-select'
        clipRuler.appendChild(clipRulerSelect)

        // 剪辑工具区间选择器的左侧拖拽箭头
        var arrowItemLeft = document.createElement('span')
        arrowItemLeft.className = 'arrow-item arrow-item-left'
        arrowItemLeft.innerHTML = '<i class="iconfont icon-jiantouzuo"></i>'
        clipRulerSelect.appendChild(arrowItemLeft)

        // 剪辑工具区间选择器的右侧拖拽箭头
        var arrowItemRight = document.createElement('span')
        arrowItemRight.className = 'arrow-item arrow-item-right'
        arrowItemRight.innerHTML = '<i class="iconfont icon-jiantouyou"></i>'
        clipRulerSelect.appendChild(arrowItemRight)

        // 剪辑工具区间选择器的时间显示
        var clipSelectText = document.createElement('span')
        clipSelectText.className = 'clip-select-text'
        clipRulerSelect.appendChild(clipSelectText)

        // 剪辑工具控制按钮
        var clipControls = document.createElement('div')
        clipControls.className = 'clip-controls'
        clipContainer.appendChild(clipControls)

        // 剪辑工具控制按钮-添加剪辑
        var clipControlAdd = document.createElement('button')
        clipControlAdd.className = 'kd-btn kd-btn-default btn-add-clip'
        clipControlAdd.innerHTML = '<i class="iconfont icon-add"></i><span>添加剪辑</span>'
        clipControls.appendChild(clipControlAdd)
        clipControlAdd.onclick = () => {
            if(Object.values(this.clipSubObj).length >= 6) return
            document.querySelector('.clip-ruler-select').style.display = 'block'
            document.querySelector('.clips-list #subId_0').style.display = 'block'
        }

        // 剪辑工具控制按钮-立即导出
        var clipControlExport = document.createElement('button')
        clipControlExport.className = 'kd-btn kd-btn-primary btn-submit-clip'
        clipControlExport.innerHTML = '<span>立即导出</span>'
        clipControls.appendChild(clipControlExport)
        clipControlExport.onclick = () => {
            this.config.clipExport(this.clipSubObj, 3)
        }

        // 剪辑工具控制按钮-完成
        var clipControlComplete = document.createElement('button')
        clipControlComplete.className = 'kd-btn kd-btn-primary btn-submit-clip'
        clipControlComplete.innerHTML = '<span>完成</span>'
        clipControls.appendChild(clipControlComplete)
        clipControlComplete.onclick = () => {
            this.config.clipExport(this.clipSubObj, 2)
        }

        // 剪辑工具片段列表
        var clipsList = document.createElement('div')
        clipsList.className = 'clips-list'
        clipContainer.appendChild(clipsList)
        this.creatClipsItem()
        this.creatScaleLine(clipRuler)

        // 剪辑区间选择的默认长度
        var defaultWidth = clipProgress.offsetWidth;
        this.clipSelectTotalTime(0, defaultWidth)
        this.clipInputTimeOnblur()
    }

    /**
     * @description: 创建剪辑列表片段
     */
    creatClipsItem (id = 0, time) {
        var clipsList = document.querySelector('.clips-list')
        if (clipsList.childNodes.length >= 9) return
        var item = document.createElement('div')
        var name = document.createElement('span')
        var to = document.createElement('span')
        var inputStart = document.createElement('input')
        var inputEnd = document.createElement('input')
        item.id = 'subId_' + id
        name.innerText = '片段'
        to.innerText = '-'
        inputStart.className = 'start-time'
        inputEnd.className = 'end-time'
        inputStart.setAttribute('placeholder', '开始时间');
        inputEnd.setAttribute('placeholder', '结束时间');
        item.appendChild(name)
        item.appendChild(inputStart)
        item.appendChild(to)
        item.appendChild(inputEnd)
        // 如果存在time参数，则属于新增剪辑片段
        if (time) {
            inputStart.value = time.vetaBeginTime
            inputEnd.value = time.vetaEndTime
            inputStart.setAttribute('disabled', true)
            inputEnd.setAttribute('disabled', true)
            var delBtn = document.createElement('button')
            delBtn.className = 'kd-btn kd-btn-text'
            delBtn.innerText = '删除'
            item.appendChild(delBtn)
            clipsList.insertBefore(item, clipsList.lastChild)
            delBtn.onclick = (e) => {
                var parentNode = e.target.parentNode
                delete this.clipSubObj[parentNode.id]
                var shadowId = '#segId_' + parentNode.id.substr(6)
                var clipSelectBg = document.querySelector('.clip-select-bg')
                clipsList.removeChild(parentNode)
                clipSelectBg.removeChild(document.querySelector(shadowId))
            }
            return
        }
        var addBtn = document.createElement('button')
        addBtn.className = 'kd-btn clip-btn-save'
        addBtn.innerText = '确定'
        item.appendChild(addBtn)
        clipsList.appendChild(item)
        addBtn.onclick = ()=> {
            id++
            this.clipConfirm(id)
        }
    }

    /**
     * @description: 确定剪辑区间
     */
    clipConfirm (id) {
        var inputStart = document.querySelector('#subId_0 .start-time').value
        var inputEnd = document.querySelector('#subId_0 .end-time').value
        if (!this.isTime(inputStart)) {
            alert('开始时间格式错误')
            return
        }
        if (!this.isTime(inputEnd)) {
            alert('结束时间格式错误')
            return
        }
        var vodStartDate = this.config.time.startTime.substr(0, 10)
        var sTime = new Date(vodStartDate + ' ' + inputStart).getTime()
        var eTime = new Date(vodStartDate + ' ' + inputEnd).getTime()
        if (!this.checkIsOverlap({sTime, eTime})) {
            alert('当前剪辑时间与其它剪辑时间重叠，请重新选择！')
            return
        }
        this.clipSubObj['subId_' + id] = {sTime, eTime}
        this.creatClipsItem(id, {vetaBeginTime: inputStart, vetaEndTime: inputEnd})
        this.creatSelectShadow(id, {vetaBeginTime: inputStart, vetaEndTime: inputEnd})
        document.querySelector('#subId_0 .end-time').value = ''
        document.querySelector('#subId_0 .start-time').value = ''
        document.querySelector('.clip-ruler-select').style.display = 'none'
        document.querySelector('.clips-list #subId_0').style.display = 'none'
    }

    /**
     * @description 生成已选择剪辑区域的阴影
     * @param {String} id 片段Dom的ID属性
     * @param {Object} segment 片段开始时间和结束时间
     */
    creatSelectShadow (id, segment) {
        // 总长度
        var parentWidth = document.querySelector('.clip-ruler').offsetWidth
        // 视频开始日期
        var vodStartDate = this.config.time.startTime.substr(0, 10)
        // 视频开始时间戳
        var vodStartTime = new Date(this.config.time.startTime).getTime()
        // 新增剪辑开始时间
        var sTime = new Date(vodStartDate + ' ' + segment.vetaBeginTime).getTime()
        // 新增剪辑结束时间
        var eTime = new Date(vodStartDate + ' ' + segment.vetaEndTime).getTime()
        // 起始位置比例
        var leftRatio = (sTime - vodStartTime) / (this.duration.totalS * 1000)
        // 剪辑长度比例
        var widthRatio = (eTime - sTime) / (this.duration.totalS * 1000)
        // 生成剪辑片段阴影
        var segEle = document.createElement('div')
        segEle.id = 'segId_' + id
        segEle.className = 'segment-item'
        segEle.style.left = (leftRatio * parentWidth) + 15 +'px'
        segEle.style.width = (widthRatio * parentWidth) +'px'
        document.querySelector('.clip-select-bg').appendChild(segEle)
    }

    /**
     * @description 设置进度光标对应的时间显示
     * @param {Element} ele
     * @param {Number} time
     */
    setClipProgTimer(ele, time) {
        var timeStamp = new Date(this.config.time.startTime).getTime() + (time * 1000)
        var date = this.config.time.startTime.substr(0, 10) + ' ' + this.getTimeText(timeStamp)
        ele.innerHTML = date
    }

    isTime (str) {
        var ary = str.match(/^(\d{1,2})(:)?(\d{1,2})\2(\d{1,2})$/)
        if (ary == null) return false
        if (ary[1]>24 || ary[3]>60 || ary[4]>60) return false
        return true
    }

    /**
     * @description: 构建剪辑工具刻度线
     */
    creatScaleLine (ele) {
        var stepS = new Date(this.config.time.startTime).getTime()
        var unit = Math.ceil(this.duration.totalS / 100)
        var count = Math.floor(this.duration.totalS / unit) + this.duration.totalS % unit
        for (let i = 0; i < count; i++) {
            var scaleLine = document.createElement('span')
            scaleLine.className = 'clip-ruler-peg'

            if((i%10) === 0) {
                var clipRulerTime = document.createElement('span')
                var date = new Date(stepS)
                var h = date.getHours()
                var m = date.getMinutes()
                var s = date.getSeconds()
                clipRulerTime.className = 'clip-ruler-time'
                clipRulerTime.innerText =  (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s)
                scaleLine.appendChild(clipRulerTime)
            }
            ele.appendChild(scaleLine)
            stepS += unit*1000
        }
        this.addEventDragRange()
    }

    /**
     * @description: 添加剪辑区间的拖拽事件
     */
    addEventDragRange () {
        var ele = document.querySelector('.clip-ruler-select')
        var isDown = false
        var that = this
        ele.onmousedown = function(e) {
            var className =  ''
            if (e.target.className === 'clip-ruler-select') {
                className = e.target.className
            } else {
                className = e.target.parentNode.className
            }
            isDown = true
            var left = ele.offsetLeft
            var downX = e.clientX
            var width = ele.offsetWidth
            var offsetRight = ele.parentNode.offsetWidth - left -  width

            window.onmousemove = function(e) {
                if (!isDown) return
                var dragX = e.clientX - downX
                // 选择区间拖拽
                if (className === 'clip-ruler-select') {
                    if (dragX < -left) {
                        dragX = 0
                        ele.style.left = '0px'
                        return
                    }
                    if (dragX > offsetRight) {
                        dragX = offsetRight
                    }
                    ele.style.left = (dragX + left) + 'px'
                    that.clipSelectTotalTime((dragX + left), ele.offsetWidth)
                    return
                }
                // 区间左箭头拖拽
                if (className.indexOf('arrow-item-left') >-1) {
                    if (dragX < -left) {
                        dragX = -left
                    }
                    if (dragX >= width) {
                        dragX = width
                    }
                    ele.style.left = (dragX + left) + 'px'
                    ele.style.width = (width - dragX) + 'px'
                    that.clipSelectTotalTime((dragX + left), (width - dragX))
                    return
                }
                // 区间右箭头拖拽
                if (className.indexOf('arrow-item-right') >-1) {
                    if(dragX > offsetRight) {
                        dragX = offsetRight
                    }
                    if (dragX < -width) {
                        dragX = -width
                    }
                    ele.style.width = (width + dragX) + 'px'
                    that.clipSelectTotalTime(ele.offsetLeft, (width + dragX))
                }
            }

            window.onmouseup = function (e) {
                isDown = false
            }
        }
    }

    /**
     * @description: 拖拽区间设置时间显示
     */
    clipDragSetTime (sTime, eTime) {
        var inputStart = document.querySelector('#subId_0 .start-time')
        var inputEnd = document.querySelector('#subId_0 .end-time')
        inputStart.value = this.getTimeText(sTime)
        inputEnd.value = this.getTimeText(eTime)
    }

    /**
     * @description: 时间戳转化成h:m:s
     */
    getTimeText (time) {
        var date = new Date(time)
        var h = date.getHours()
        var m = date.getMinutes()
        var s = date.getSeconds()
        var timeText =  (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s)
        return timeText
    }

    /**
     * @description: 计算剪辑区间所选时长
     */
    clipSelectTotalTime (left, width) {
        // 总长度
        var parentWidth = document.querySelector('.clip-ruler').offsetWidth
        // 所选区间比例
        var ratio = width / parentWidth
        // 区间开始位置的比例
        var startRatio = left / parentWidth
        // 所选区间比例对应的时段（单位：千毫秒）
        var totalTime = this.duration.totalS * 1000 * ratio
        totalTime = Math.round(totalTime / 1000) * 1000
        // 区间开始位置的比例对应时间点（单位：千毫秒）
        var startTime = new Date(this.config.time.startTime).getTime() + this.duration.totalS * 1000 * startRatio
        startTime = Math.round(startTime / 1000) * 1000
        // 区间结束位置的比例对应时间点
        var endTime = startTime + totalTime
        // 所选区间比例转化成分钟数
        var min = Math.floor(totalTime / 1000 / 60)
        // 时长显示节点
        var clipSelectText = document.querySelector('.clip-select-text')
        if (width > 70) {
            clipSelectText.className = 'clip-select-text clip-select-text--embd'
        } else {
            clipSelectText.className = 'clip-select-text'
        }
        clipSelectText.innerText = min + '分' + (totalTime / 1000)%60 + '秒'
        this.clipDragSetTime(startTime, endTime)
    }

    /**
     * @description: 通过输入框输入时间
     */
    clipInputTimeOnblur() {
        var inputStart = document.querySelector('#subId_0 .start-time')
        var inputEnd = document.querySelector('#subId_0 .end-time')
        inputStart.onfocus = (ev) => {
            // 获取初始值
            var value = ev.target.value
            inputStart.onblur = (e) => {
                if(!this.isTime(e.target.value)) {
                    e.target.value = value
                    alert('时间格式错误！')
                    return
                }
                this.setClipSelect(e.target.value, inputEnd.value, value, e.target)
            }
        }
        inputEnd.onfocus = (ev) => {
            // 获取初始值
            var value = ev.target.value
            inputEnd.onblur = (e) => {
                if(!this.isTime(e.target.value)) {
                    e.target.value = value
                    alert('时间格式错误！')
                    return
                }
                this.setClipSelect(inputStart.value, e.target.value, value, e.target)
            }
        }
    }

    /**
     * @description 通过input设置剪辑时间时，映射至剪辑拖拽选择控件
     * @param {Number} sTime
     * @param {Number} eTime
     * @param {Number} value
     * @param {Element} input
     */
    setClipSelect(sTime, eTime, value, input) {
        // 总长度
        var parentWidth = document.querySelector('.clip-ruler').offsetWidth
        // 剪辑区间控件
        var clipSelect = document.querySelector('.clip-ruler-select')
        // 视频开始时间戳
        var vodStartTime = new Date(this.config.time.startTime).getTime()
        // 视频结束时间戳
        var vodEndTime = new Date(this.config.time.endTime).getTime()
        // 视频开始日期
        var vodStartDate = this.config.time.startTime.substr(0, 10)
        // 剪辑区间开始时间戳
        sTime = new Date(vodStartDate + ' ' + sTime).getTime()
        // 剪辑区间结束时间戳
        eTime = new Date(vodStartDate + ' ' + eTime).getTime()
        if (sTime < vodStartTime || sTime > vodEndTime) {
            alert('当前剪辑开始时间超出视频可剪辑时间！')
            input.value = value
            return
        }

        if (eTime < vodStartTime || eTime > vodEndTime) {
            alert('当前剪辑结束时间超出视频可剪辑时间！')
            input.value = value
            return
        }

        if (sTime > eTime) {
            alert('剪辑开始时间不能大于剪辑结束时间！')
            input.value = value
            return
        }
        var startRatio = (sTime - vodStartTime) / this.duration.totalS / 1000
        var endRatio = (eTime - sTime) / this.duration.totalS / 1000
        var clipSelectText = document.querySelector('.clip-select-text')
        var totalTime = (eTime - sTime) / 1000
        var min = Math.floor(totalTime / 60)
        clipSelect.style.left = (parentWidth * startRatio) + 'px'
        clipSelect.style.width = (parentWidth * endRatio) + 'px'
        clipSelectText.innerText = min + '分' + totalTime%60 + '秒'
    }

    /**
     * @description 检查剪辑片段时间是否重叠
     * @param {Object} segment 片段开始时间和结束时间
     */
    checkIsOverlap (segment) {
        // 对象转数组
        var clipSubAry = Object.values(this.clipSubObj)
        if (!clipSubAry.length) return true
        // 对数组进行排序
        for (let i = 1; i < clipSubAry.length; i++) {
            var preInt = i - 1
            var current = clipSubAry[i]
            while (preInt >= 0 && current.sTime < clipSubAry[preInt].sTime) {
                var item = clipSubAry[preInt]
                clipSubAry[preInt] = clipSubAry[preInt + 1]
                clipSubAry[preInt + 1] = item
                preInt --
            }
        }
        // 如果新增剪辑片段位于最前端
        if (segment.sTime < clipSubAry[0].sTime && segment.eTime < clipSubAry[0].sTime) return true
        // 如果新增剪辑片段位于最后端
        if (segment.sTime > clipSubAry[clipSubAry.length - 1].eTime) return true
        for (let j = 0; j < clipSubAry.length; j++) {
            // 如果新增剪辑片段位于中间部分，则判断是否处于两个已剪辑片段之间
            if ( clipSubAry[j].eTime < segment.sTime && segment.eTime < clipSubAry[j + 1].sTime) return true
        }

        return false
    }

}
