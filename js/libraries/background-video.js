function BackgroundVideo(options) {
    if (options.container === undefined) {
        this.container = document.body;
    } else {
        this.container = document.getElementById(options.container);
		this.container.style.position = "relative";
    }
    this.currentItem = -1;
    this.videoCounter = 0;
    this.videos = new Array();

    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        if (options.mobileImg !== undefined) {
            this.container.style.backgroundImage = "url(" + options.mobileImg + ")";
            this.container.style.backgroundSize = "cover";
        }
        this.isMobile = true;
        return;
    } else {
        this.isMobile = false;
    }
    if (options.video === undefined) {
        return;
    }
    for (var i = 0; i < options.video.length; i++) {
        this.addVideo(options.video[i]);
    }
    if (options.overlay !== undefined) {
        var overlayDiv = document.createElement("div");
        overlayDiv.className = "bgv-overlay";
        overlayDiv.style.backgroundImage = "url(" + options.overlay + ")";
        this.container.appendChild(overlayDiv);
    }
}
;

BackgroundVideo.prototype = {
    // Implement the `EventListener` interface   
    handleEvent: function (event) {
        switch (event.type) {
            case "ended":
                return this.playNextItem();
                break;
            case "canplaythrough":
                if (this.videos[this.currentItem].readyState != 4) {
                    return true;
                }
                var i = this.currentItem;
                do {
                    i++;
                } while (i < this.videos.length && this.videos[i].readyState == 4);
                if (i < this.videos.length) {
                    this.videos[i].load();
                }
                break;
        }
    },
    initVideoTag: function (e, name, formats, poster) {
        var base = name.substring(0, name.lastIndexOf("."));
        if (poster !== undefined) {
            e.poster = poster;
        }
        e.setAttribute("id", "BackgroundVideo-" + this.videoCounter++);
        e.className = "flexible";
        e.preload = "none";
        e.loop = false;
        e.muted = true;
        if (this.videoCounter > 1) {
            e.style.display = "none";
        }
        var source = document.createElement('source');
        source.src = name;
        source.type = "video/" + name.substr(name.lastIndexOf(".") + 1);
        e.appendChild(source);
        if (formats != undefined) {
            // Add formats
            for (var i = 0; i < formats.length; i++) {
                source = document.createElement('source');
                source.src = base + "." + formats[i];
                source.type = "video/" + formats[i];
                e.appendChild(source);
            }
        }
    },
    addVideo: function (item) {
        if (this.isMobile) {
            return;
        }
        if (item.file === undefined) {
            return;
        }
        var newVideo = document.createElement("video");
        this.initVideoTag(newVideo, item.file, item.formats, item.poster);
        newVideo.addEventListener("ended", this);
        newVideo.addEventListener("canplaythrough", this);
        this.addToDOM(newVideo);
        this.videos.push(newVideo);
        if (this.videos.length == 1) {
            // First video added - play it
            this.playNextItem();
        }
    },
    addToDOM: function (e) {
        if (this.container.firstChild == null) {
            this.container.appendChild(e);
        } else {
            this.container.insertBefore(e, this.container.firstChild);
        }
    },
    play: function() {
        var item = this.videos[this.currentItem];
        if (item.readyState == 4) { // 4 - HAVE_ENOUGH_DATA
            item.play();
        } else {
            this.currentItem = 0;
            this.videos[0].play();
        }
    },
    pause: function() {
    	  var item = this.videos[this.currentItem];
    	  item.pause();
    },
    playNextItem: function () {
        var prevItem = this.currentItem;
        this.currentItem++;
        if (this.currentItem >= this.videos.length) {
            this.currentItem = 0;
        }
        var item = this.videos[this.currentItem];
        if (item.readyState == 4) { // 4 - HAVE_ENOUGH_DATA
            item.play();
        } else {
            this.currentItem = 0;
            this.videos[0].play();
        }
        if (prevItem != undefined && this.videos[prevItem] != undefined && prevItem != this.currentItem) {
            document.getElementById(this.videos[prevItem].id).style.display = "none";
            document.getElementById(this.videos[this.currentItem].id).style.display = "";
        }
    }

}

/**
 Usage:
 
 container [optional]: id of the element, where to add video background. 
 If ommited video background is added to the BODY element.
 
 video: list of video files
 Note: If you have one video in different formats (mp4, webm, ogv, etc)
 you can add them all to ensure browser compatibility.
 Use 'formats' option to list all additional formats.
 
 mobileImg: image file for mobile users. To save traffic mobile users see a still image instead of video.
 
 
 new BackgroundVideo({
 // container: "myId",
 
 video: [
 {
 file: "video/SampleVideo_1280x720_1mb.mp4"
 },
 {
 file: "video/Hello-World.ogv",
 formats: [ "mp4", "webm" ]
 },
 {
 file: "video/OneBigCircle-HD.mp4.mp4"
 }
 ],
 
 mobileImg: "img/Hello-World.jpg"
 });
 
 */