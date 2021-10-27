'use strict';

function setBackground(background) {
	if (window.localStorage) {
		window.localStorage.setItem('background', background);
	} else {
		chrome.storage.local.set({'background': background});
	}
}

function getBackground(callback) {
	if (window.localStorage) {
		var result = window.localStorage.getItem('background');
		if ((result != null)) {
            callback(result);
        } else {
            callback('images/osd/video1.mp4');
        }
	} else {
	  chrome.storage.local.get('background', function (result) {
          if ((result !== undefined) && (result.background !== undefined)) {
              callback(result.background);
          } else {
              callback('images/osd/video1.mp4');
          }
      });
	}
}


CONTENT.osd = {

};



CONTENT.osd.initialize = function (callback) {
    var self = this;

    self.startedUIupdate = 0;
    self.updateTimeout;
    self.interval;
    self.frame = 0;
    self.address = 0xffff;
    self.chunkSize = 240;
    self.flags = 0;
    self.nvcounter = 0;
    self.videoRunning = true;
  
    
    self.events = new Queue();
    	    
	var Buffer = require('buffer').Buffer
	self.compressedBuffer = Buffer.alloc(128*288); // max osd in bytes
	
	
	GUI.switchContent('osd', function () {
		GUI.load("./content/osd.html", function () {
			htmlLoaded({});
			
			while (!self.events.isEmpty()) { self.events.dequeue(); };
		
			$(window).on("keydown", function(e) {
				e.stopPropagation();
				if (!event.repeat) {
					self.events.enqueue({e:1, x:e.keyCode, y:0});
				}
			});
			
			$(window).on("keyup", function(e) {
				e.stopPropagation();
				self.events.enqueue({e:2, x:e.keyCode, y:0});
			});
				
			$(window).on("keypress", function(e) {
				e.stopPropagation();
			});
			
			if (kissProtocol.data[kissProtocol.GET_SETTINGS].ver > 127) {
				$("#osdkc").show();
			}
			
			if (kissProtocol.data[kissProtocol.GET_SETTINGS].ver > 126) {
				var tmp = {
						'buffer': new ArrayBuffer(1),
						'chunk': 0
				};
				kissProtocol.send(kissProtocol.GET_OSD_CONFIG, kissProtocol.preparePacket(kissProtocol.GET_OSD_CONFIG, tmp), function () {
					console.log("Loaded OSD config");
					console.log(JSON.stringify(kissProtocol.data[kissProtocol.GET_OSD_CONFIG]));
				});
				
				
			} else {
				console.log("OSD config is not supported");
			}
		});
	});
	

	self.interval = window.setInterval(function() { self.nvcounter = 1 - self.nvcounter }, 500);
	
	/*
	 * ffmpeg -i src.m4v -vf scale=-1:288 tmp1.mp4
	 * ffmpeg -i tmp1.mp4 -filter:v "crop=370:288:64:0" dst.mp4	
	 */
	self.backgrounds = [
		"images/osd/video1.mp4",
		"images/osd/video3.mp4",
		"images/osd/video2.mp4",
		"images/osd/video4.mp4"
	];

	function htmlLoaded(data) {
		
		
		getBackground(function(bg) {
			
			self.video = new BackgroundVideo({
				container: "osdframe",
				zIndex: "1000",
			    video: [
			        {
			        	file: bg
			        }
			    ]
			});
			
			self.playing = true;
			$.each(self.backgrounds, function( index, value ) {
				 $(".osd-backgrounds-thimbnails").append('<li><img data-idx="'+index+'" src="'+value.replace('.mp4','.png')+'" '+(value === bg ? 'class="bgtn active"' : 'class="bgtn"')+'></li>');
			});

			$("img.bgtn").on('click', function() {
				$("img.bgtn").removeClass('active');
				$(this).addClass('active');
				var src = self.backgrounds[$(this).data('idx')];
				setBackground(src);
				
				$("#BackgroundVideo-0").remove();
				
				self.video = new BackgroundVideo({
					container: "osdframe",
					zIndex: "1000",
				    video: [
				        {
				        	file: src
				        }
				    ]
				});
				
				if (self.videoRunning) self.video.play(); else self.video.pause();
			});
		});

		self.startedUIupdate = 0;
		window.clearTimeout(self.updateTimeout);

		$(window).on('resize', self.osdResize).resize();

		function updateUI() {
			//console.log("Update UI");
			var osd = kissProtocol.data[kissProtocol.GET_OSD];

			if (osd) {
				var lineData = new Uint8Array(osd.buffer);
				var addr = 256*lineData[0] + lineData[1];
				var len  = 256*lineData[2] + lineData[3];
				
				if (addr == 0xffff) {
					self.compressedSize = len;
					self.address = 0;
					self.flags  = lineData[16];
				} else {
					if (len == 0) {
						
						self.address = 0xffff; // Info request
						
						var LZ4 = require('lz4');
						var uncompressedBuffer = Buffer.alloc(128*288);
						var decoded = LZ4.decodeBlock(self.compressedBuffer, uncompressedBuffer, 0, self.compressedSize);
						
						if (decoded >0) {
							
						var c = document.getElementById("osd");
						var ctx = c.getContext("2d");

						var p = ctx.createImageData(512, 288);

						var scr = new Uint8Array(uncompressedBuffer);

						for (var y=0; y<288; y++) {
							for (var x=0; x<512; x++) {
								var pixaddr = y*128 + (x >> 2);
								var dstaddr = 4* (y*512 + x);
								var c = scr[pixaddr];
								c <<= (2*(x & 3));
								var col = c & 0xc0;

								if (col == 0x80) {
									p.data[dstaddr + 0]	=	255;
									p.data[dstaddr + 1]	=	255;
									p.data[dstaddr + 2]	=	255;
									p.data[dstaddr + 3]	=	255;
								} else if (col == 0x40) {
									p.data[dstaddr + 0]	=	0;
									p.data[dstaddr + 1]	=	0;
									p.data[dstaddr + 2]	=	0;
									p.data[dstaddr + 3]	=	255;
								} else if (col == 0xc0) {
									p.data[dstaddr + 0]	=	0;
									p.data[dstaddr + 1]	=	0;
									p.data[dstaddr + 2]	=	0;
									p.data[dstaddr + 3]	=	127;
								}
							}
						}
						
						ctx.putImageData(p, -36, 3);
					
						if ((self.flags & 0x2) == 0) { // updateTimeout
							
							ctx.font="20px Monaco";
							ctx.fillStyle = "lime";
							ctx.textAlign = "center";
							ctx.globalAlpha = 0.4;
							ctx.fillText("NO SIGNAL", 185, 270);
						}
						
						var inFlight = true;
						if ((self.flags & 0x4) == 0x4) { // menu
							inFlight = false;
						}
						
						if (self.videoRunning) {
							if (inFlight != self.playing) {
								self.playing = inFlight;
								if (self.playing) {
									self.video.play();
								} else {
									self.video.pause();
								}
							}
						}
					}
						
					} else {
						for (var i=0; i<len; i++) {
							self.compressedBuffer.writeUInt8(lineData[i + 4], addr + i );
						}
						self.address = addr + len; // next one
					}
				}
			}
		}
		
		$("#osd_block").on("click", function() {
			self.videoRunning = !self.videoRunning;
			if (self.videoRunning) self.video.play(); else self.video.pause();
		});

		// setup graph
		$(window).on('resize', self.resizeCanvas).resize();

		function fastDataPoll() {
			self.updateTimeout = window.setTimeout(function () {
				fastDataPoll();
			}, 50); // Just restart if needed
			var tmp = {
					 'buffer': new ArrayBuffer(3),
	                 'address': self.address,
	                 'chunkSize': self.chunkSize
	        };
			
			if (kissProtocol.data[kissProtocol.GET_SETTINGS].ver > 127) {
				if (!self.events.isEmpty()) {
					tmp.event = self.events.dequeue();
					console.log("Dequeue " + JSON.stringify(tmp.event)); 
				}
			}
				             
			kissProtocol.send(kissProtocol.GET_OSD, kissProtocol.preparePacket(kissProtocol.GET_OSD, tmp), function () {
				if (GUI.activeContent == 'osd') {
					if (self.startedUIupdate == 0) {
						updateUI();
					}
					window.clearTimeout(self.updateTimeout);
					self.updateTimeout = window.setTimeout(function () {
						fastDataPoll();
					}, 1);
				}
			});
		}

		$(window).on('resize', self.resizeOSD).resize();

		fastDataPoll();
		
	    scrollTop();
	}
};


CONTENT.osd.resizeOSD = function () {

}

CONTENT.osd.cleanup = function (callback) {
  //  $(window).off('resize', this.osdResize);
    window.clearTimeout(this.updateTimeout);
	window.clearInterval(this.interval);
	$(window).off("keydown,keyup,keypress");
    if (callback) callback();
    
    
};