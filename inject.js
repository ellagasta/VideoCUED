chrome.extension.sendMessage({}, function(response) {
    var CANVAS_HEIGHT = 200;
    var CANVAS_WIDTH = 266;
    var CONFIDENCE_THRESH = 0.5;
    var FIST_THRESH = 10;
    var GREEN = "rgb(130,255,50)";
    var RED = "rgb(255,0,50)";


    var div = $('<div id="debug" style="display:none"></div>').get(0);
    var canvasProto = '<canvas id="clm_canvas" style="position: fixed; z-index: 19999999999;top: 10px; right: 10px; opacity: 0.9">';
    var objCanvas = $(canvasProto).get(0),
        objContext = objCanvas.getContext('2d'),
        video = document.createElement('video'),
        fistPosOld,
        detector;
    var clmCanvas = $(canvasProto).get(0),
        clmContext = clmCanvas.getContext('2d');
    var gestCanvas = $(canvasProto).get(0),
        gestContext = gestCanvas.getContext('2d');

    div.appendChild(objCanvas);
    div.appendChild(clmCanvas);
    div.appendChild(gestCanvas);

    video.setAttribute("width", CANVAS_WIDTH);
    video.setAttribute("height", CANVAS_HEIGHT);

    var ctracker;
    var isFirstStart = true;
    var forceStopped = false;
    var debug_on = false;
    var toggle_on = false;
    var missedIters = 0;
    var lastFists = [0, 0, 0, 0, 0];

    var tc = {
        settings: {

            toggleKeyCode: 84, // T
            debugKeyCode: 68, // D
            skipTime: 10,
            blacklist: `
        www.instagram.com
        twitter.com
        vine.co
        imgur.com
      `.replace(/^\s+|\s+$/gm, '')
        }
    };

    chrome.storage.sync.get(tc.settings, function(storage) {
        tc.settings.toggleKeyCode = Number(storage.toggleKeyCode);
        tc.settings.debugKeyCode = Number(storage.debugKeyCode);
        tc.settings.skipTime = Number(storage.skipTime);
        tc.settings.blacklist = String(storage.blacklist);
        initializeWhenReady(document);
    });

    // for performance reasons
    var forEach = Array.prototype.forEach;

    function initializeWhenReady(document) {
        escapeStringRegExp.matchOperatorsRe = /[|\\{}()[\]^$+*?.]/g;

        function escapeStringRegExp(str) {
            return str.replace(escapeStringRegExp.matchOperatorsRe, '\\$&');
        }

        var blacklisted = false;
        tc.settings.blacklist.split("\n").forEach(match => {
            match = match.replace(/^\s+|\s+$/g, '')
            if (match.length == 0) {
                return;
            }

            var regexp = new RegExp(escapeStringRegExp(match));
            if (regexp.test(location.href)) {
                blacklisted = true;
                return;
            }
        })

        if (blacklisted)
            return;

        var readyStateCheckInterval = setInterval(function() {
            if (document && document.readyState === 'complete') {
                clearInterval(readyStateCheckInterval);
                initializeNow(document);
            }
        }, 10);

    }

    function initializeSystem(){
        createDebug();
        ctrackerInit();
        gestInit();
        loop();
    }

    function initializeNow(document) {
        document.addEventListener('keydown', function(event) {
            var keyCode = event.keyCode;

            // Ignore if following modifier is active.
            if (event.getModifierState("Alt") || event.getModifierState("Control") || event.getModifierState("Fn") || event.getModifierState("Meta") || event.getModifierState("Hyper") || event.getModifierState("OS")) {
                return;
            }

            // Ignore keydown event if typing in an input box
            if ((document.activeElement.nodeName === 'INPUT' && document.activeElement.getAttribute('type') === 'text') || document.activeElement.nodeName === 'TEXTAREA' || document.activeElement.isContentEditable) {
                return false;
            }

            if (keyCode == tc.settings.toggleKeyCode) {
                toggle_on = !toggle_on;
                console.log("toggle", toggle_on);
                if (toggle_on) {
                    if (isFirstStart) {
                        initializeSystem();
                    } else {
                        loop();
                    }
                } else {
                    debug_on = false;
                    $("#debug").hide();
                }
            } else if (keyCode == tc.settings.debugKeyCode) {
                if (toggle_on){
                    debug_on = !debug_on;
                    console.log("debug", debug_on);
                    if (debug_on) {
                        $("#debug").show();
                    } else {
                        $("#debug").hide();
                    }
                }
            }

            return false;
        }, true);
    }


    // create debug overlay
    function createDebug(){        
        document.getElementsByTagName('body')[0].appendChild(div);
        
        try {
            navigator.getUserMedia({video: true}, function(stream) {
                try {
                    video.src = URL.createObjectURL(stream);
                } catch (error) {
                    video.src = stream;
                }
            }, function (error) {
                alert("WebRTC not available");
            });
        } catch (error) {
            alert(error);
        }
    }

    function ctrackerInit() {
        ctracker = new clm.tracker();
        ctracker.init(pModel);
        ctracker.start(video);
        ctracker.setResponseMode("single", ["lbp"]);

    }

    function gestInit() {
        gestCanvas.width = CANVAS_WIDTH;
        gestCanvas.height = CANVAS_HEIGHT;
        gestContext.font = "40px Georgia";

        gest.options.subscribeWithCallback(function(gesture) {
            var message = '';
            if (gesture.direction && toggle_on) {
                if (gesture.direction == "Left") {
                    skipPlaybackBackward();
                    message = gesture.direction;
                } else if (gesture.direction == "Right") {
                    skipPlaybackForward();
                    message = gesture.direction;
                } 
            }
            gestContext.clearRect(0, 0, gestCanvas.width, gestCanvas.height);
            gestContext.fillText(message, 10,30);
            window.setTimeout(function() {
                gestContext.clearRect(0, 0, gestCanvas.width, gestCanvas.height);
            }, 1000);
        });
        gest.start();
    }

    // core inner loop
    function loop() {
        requestAnimationFrame(loop);

        // draw on camera input
        clmCanvas.width = CANVAS_WIDTH;
        clmCanvas.height = CANVAS_HEIGHT;

        clmContext.clearRect(0, 0, clmCanvas.width, clmCanvas.height);

        // update playback based on face score
        var score = ctracker.getScore();

        var videoTags = document.getElementsByTagName('video');
        videoTags.forEach = Array.prototype.forEach;

        // check playing/paused status because users might have manually paused/played
        videoTags.forEach(function(v){
            playing = !v.paused;
        });

        if (score > CONFIDENCE_THRESH) {
            ctracker.draw(clmCanvas, GREEN);
            if (!playing && toggle_on) resumePlayback();
        } else {
            missedIters++;
            ctracker.draw(clmCanvas, RED);
            if (playing && toggle_on) pausePlayback();
        }

        if (video.paused) video.play();
        
        if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
            // Prepare the detector once the video dimensions are known
            if (!detector) {
                var width = ~~(80 * video.videoWidth / video.videoHeight);
                var height = 80;
                detector = new objectdetect.detector(width, height, 1.1, objectdetect.handfist);
            }
        
            // Draw video overlay
            objCanvas.width = CANVAS_WIDTH
            objCanvas.height = CANVAS_HEIGHT;
            objContext.drawImage(video, 0, 0, objCanvas.clientWidth, objCanvas.clientHeight);
            
            var coords = detector.detect(video, 1);
            if (coords[0]) {
                var coord = coords[0]
                // Rescale coordinates from detector to video coordinate space:
                coord[0] *= video.videoWidth / detector.canvas.width;
                coord[1] *= video.videoHeight / detector.canvas.height;
                coord[2] *= video.videoWidth / detector.canvas.width;
                coord[3] *= video.videoHeight / detector.canvas.height;
            
                // Find coordinates with maximum confidence:
                for (var i = coords.length - 1; i >= 0; --i)
                    if (coords[i][4] > coord[4]) coord = coords[i];

                // coord[4] is the confidence
                if (coord[4] > FIST_THRESH) {
                    lastFists.splice(0,1);
                    lastFists.push(1);
                    if (lastFists[0] === 0 && lastFists[1]*lastFists[2]*lastFists[3]*lastFists[4] === 1){
                        console.log("fist");
                        toggle_on = !toggle_on;
                        if (toggle_on) {
                            console.log("resume");
                        }
                        else {
                            console.log("stop");
                        }
                    }

                    // Draw coordinates on video overlay
                    objContext.beginPath();
                    objContext.lineWidth = '2';
                    objContext.fillStyle = 'rgba(0, 255, 255, 0.5)';
                    objContext.fillRect(
                        coord[0] / video.videoWidth * objCanvas.clientWidth,
                        coord[1] / video.videoHeight * objCanvas.clientHeight,
                        coord[2] / video.videoWidth * objCanvas.clientWidth,
                        coord[3] / video.videoHeight * objCanvas.clientHeight);
                    objContext.stroke();
                } else {
                    lastFists.splice(0,1);
                    lastFists.push(0);
                }
            } else fistPosOld = null;
        }
    }

    var resumePlayback = function() {
        runAction("play", document, true);
        missedIters = 0;
    };

    var pausePlayback = function() {
        runAction("pause", document, true);
    };

    var skipPlaybackForward = function() {
        runAction("forward", document, true);
    };

    var skipPlaybackBackward = function() {
        runAction("backward", document, true);
    };


    function runAction(action, document, keyboard) {
        var videoTags = document.getElementsByTagName('video');
        videoTags.forEach = Array.prototype.forEach;

        // will control all the videos at once, if for some reason you have multiple videos playing
        videoTags.forEach(function(v) {
            if (action == 'play') {
                v.play();
            } else if (action == 'pause') {
                v.pause();
            } else if (action == 'forward') {
                v.currentTime = v.currentTime + tc.settings.skipTime;
            } else if (action == 'backward') {
                v.currentTime = v.currentTime - tc.settings.skipTime;
            }
        });
    }
});