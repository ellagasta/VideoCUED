var CONFIDENCE_THRESH = 0.5;
var FIST_THRESH = 10;
var ctracker;
var playing = true;
var missed_iters = 0;
var skip_length = 10;
var video;
var vid;
var capture;
var detector;
var force_stopped = false;
var last_fists = [0, 0, 0, 0, 0];
var canvasInput;
var cc;




function loop(){
    // just keep calling itself
    requestAnimationFrame(loop);

    // draw on camera input
    cc.clearRect(0, 0, canvasInput.width, canvasInput.height);
    ctracker.draw(canvasInput);

        var score = ctracker.getScore();
    $("#confidence").text(score);

    // update playback based on face score
    if (score > CONFIDENCE_THRESH) {
        $("#status").text("Recognized");
        $("#status").css("background-color", "blue");
        if (!playing && !force_stopped) resumePlayback();
    } else {
        $("#status").text("Not recognized");
        $("#status").css("background-color", "red");
        //      if (missed_iters++ > PAUSE_THRESH){
        missed_iters++;
        if (playing) pausePlayback();
    }

    // fist recognition

    if (capture.readyState === capture.HAVE_ENOUGH_DATA && capture.videoWidth > 0) {
        if (!detector){ 
            var width = ~~(80 * capture.videoWidth / capture.videoHeight);
            var height = 80;
            detector = new objectdetect.detector(width, height, 1.1, objectdetect.handfist);
        }
        var coords = detector.detect(capture, 1);
        // console.log(coords);
        if (coords[0]) {
            console.log(coords[0][4])
            if (coords[0][4] > FIST_THRESH){
                last_fists.splice(0,1);
                last_fists.push(1);
                if (last_fists[0] === 0 && last_fists[1]*last_fists[2]*last_fists[3]*last_fists[4] === 1){
                    force_stopped = !force_stopped;
                    if (force_stopped) {
                        pausePlayback();
                    }
                    else {
                        resumePlayback();
                    }
                    fist_continuing = true;
                }
            } else {
                last_fists.splice(0,1);
                last_fists.push(0);
            }
        } else {
            last_fists = [0,0,0,0,0];
        }
    }
}

function ctrackerInit() {
    var videoInput = document.getElementById('inputVideo');

    ctracker = new clm.tracker();
    ctracker.init(pModel);
    ctracker.start(videoInput);
    ctracker.setResponseMode("single", ["lbp"]);

    canvasInput = document.getElementById('drawCanvas');
    cc = canvasInput.getContext('2d');
}

function gestInit() {
    var messageContainer = $("#gesture");
    gest.options.subscribeWithCallback(function(gesture) {
        var message = '';
        if (gesture.direction) {
            if (gesture.direction == "Left") {
                skipPlayback(-skip_length);
                message = gesture.direction;
            } else if (gesture.direction == "Right") {
                skipPlayback(skip_length);
                message = gesture.direction;
            } else if (gesture.direction == "Up") {
                force_stopped = false;
                resumePlayback();
                message = gesture.direction;
            }

        } else {
            message = gesture.error.message;
        }
        messageContainer.text(message);
        messageContainer.show();
        window.setTimeout(function() {
            messageContainer.hide();
        }, 3000);
    });
    gest.start();

}


var resumePlayback = function() {
    playing = true;
    video.trigger("play");
    missed_iters = 0;
};

var pausePlayback = function() {
    playing = false;
    video.trigger("pause");
};

var skipPlayback = function(duration) {
    vid.currentTime = vid.currentTime + duration;
};

window.onload = function() {
    navigator.getUserMedia = (navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia);

    if (navigator.getUserMedia) {
        // Request the camera.
        navigator.getUserMedia(
            // Constraints
            {
                video: true
            },

            // Success Callback
            function(localMediaStream) {
                // Get a reference to the video element on the page.
                var vid = document.getElementById('inputVideo');

                // Create an object URL for the video stream and use this 
                // to set the video source.
                vid.src = window.URL.createObjectURL(localMediaStream);

            },

            // Error Callback
            function(err) {
                // Log the error to the console.
                console.log('The following error occurred when trying to use getUserMedia: ' + err);
            }
        );
        video = $("#video");
        vid = video.get(0);
        capture = document.createElement('video');

        ctrackerInit();
        gestInit();

        try {
            navigator.getUserMedia({video: true}, function(stream) {
                try {
                    capture.src = window.URL.createObjectURL(stream);
                } catch (error) {
                    capture.src = stream;
                }
                requestAnimationFrame(loop);
            }, function (error) {
                alert("WebRTC not available");
            });
        } catch (error) {
            alert(error);
        }




    } else {
        alert('Sorry, your browser does not support getUserMedia');
    }

}
