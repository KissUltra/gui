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
    self.blackLevel = 0;
    self.whiteLevel = 255;
  
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
	
	function grabData() {
		
	}
	
	function saveOSDConfig(json, callback) {
		// check versions?
		console.log("SAVING");
		
		kissProtocol.sendChunked(kissProtocol.SET_OSD_CONFIG, json, 0,  function() {
			console.log("Send complete!");
			callback(true);
		});
	}
	
	function handleFileSelect(evt) {
		var files = evt.target.files; 
		for (var i = 0, f; f = files[i]; i++) {
			var reader = new FileReader();
			reader.onload = (function(theFile) {
				return function(e) {
					var json = JSON.parse(e.target.result);
					console.log(json);
					if (json.kissultraosd) {
						saveOSDConfig(json, function(status) {
							console.log("Saved: " + status);
						});
					} else {
						console.log("Old kiss osd backup detected!");
						$(".modal-overlay").off('click');
						$(".modal-overlay").on('click', function() {
							hideModal();
						});
						$(".modal-body").html("<p class='header'>This backup is outdated.</p>For safety reasons, importing of the old backups is prohibited.");
						$(".modal-footer").html("");
						$(".modal-overlay").show();
						$(".modal").show();                            	
						return;
					}
				};
			})(f);
			reader.readAsText(f);
		}
	}

	  
	function backupConfig() {
		if (isNative()) {
			var chosenFileEntry = null;

			var accepts = [{
				extensions: ['txt']
			}];

			chrome.fileSystem.chooseEntry({
				type: 'saveFile',
				suggestedName: 'kissultra-osd-backup',
				accepts: accepts
			}, function (fileEntry) {
				if (chrome.runtime.lastError) {
					console.error(chrome.runtime.lastError.message);
					return;
				}

				if (!fileEntry) {
					console.log('No file selected.');
					return;
				}

				chosenFileEntry = fileEntry;

				chrome.fileSystem.getDisplayPath(chosenFileEntry, function (path) {
					console.log('Export to file: ' + path);
				});

				chrome.fileSystem.getWritableEntry(chosenFileEntry, function (fileEntryWritable) {

					chrome.fileSystem.isWritableEntry(fileEntryWritable, function (isWritable) {
						if (isWritable) {
							chosenFileEntry = fileEntryWritable;
							var config = kissProtocol.data[kissProtocol.GET_OSD_CONFIG];
							config.kissultraosd = true;
							config.ver = +kissProtocol.data[kissProtocol.GET_SETTINGS]['ver'];
							var json = JSON.stringify(config, function (k, v) {
								if (k === 'dont_export_me' ) {
									return undefined;
								} else {
									return v;
								}
							}, 2);
							var blob = new Blob([json], {
								type: 'text/plain'
							});

							chosenFileEntry.createWriter(function (writer) {
								writer.onerror = function (e) {
									console.error(e);
								};

								var truncated = false;
								writer.onwriteend = function () {
									if (!truncated) {
										truncated = true;
										writer.truncate(blob.size);
										return;
									}
									console.log('Config has been exported');
								};

								writer.write(blob);
							}, function (e) {
								console.error(e);
							});
						} else {
							console.log('Cannot write to read only file.');
						}
					});
				});
			});
		} else {
			// web
			var config = kissProtocol.data[kissProtocol.GET_OSD_CONFIG];
			config.kissultraosd = true;
			config.ver = +kissProtocol.data[kissProtocol.GET_SETTINGS]['ver'];
			var json = JSON.stringify(config, function (k, v) {
				if (k === 'dont_export_me' ) {
					return undefined;
				} else {
					return v;
				}
			}, 2);
			var blob = new Blob([json], {
				type: 'text/plain;charset=utf-8'
			});
			//Check the Browser.
			var isIE = false || !!document.documentMode;
			if (isIE) {
				window.navigator.msSaveBlob(blob, "kissultra-osd-backup.txt");
			} else {
				var url = window.URL || window.webkitURL;
				var link = url.createObjectURL(blob);
				var a = $("<a />");
				a.attr("download", "kissultra-osd-backup.txt");
				a.attr("href", link);
				$("body").append(a);
				a[0].click();
				a.remove();	
			}
		}
	};
	
	function restoreConfig(callback) {

		if (isNative()) {
			var chosenFileEntry = null;

			var accepts = [{
				extensions: ['txt']
			}];

			chrome.fileSystem.chooseEntry({
				type: 'openFile',
				accepts: accepts
			}, function (fileEntry) {
				if (chrome.runtime.lastError) {
					console.error(chrome.runtime.lastError.message);
					return;
				}

				if (!fileEntry) {
					console.log('No file selected, restore aborted.');
					return;
				}

				chosenFileEntry = fileEntry;

				chrome.fileSystem.getDisplayPath(chosenFileEntry, function (path) {
					console.log('Import config from: ' + path);
				});

				chosenFileEntry.file(function (file) {
					var reader = new FileReader();

					reader.onprogress = function (e) {
						if (e.total > 16384) {
							console.log('File limit (16k KB) exceeded, aborting');
							reader.abort();
						}
					};

					reader.onloadend = function (e) {
						if (e.total != 0 && e.total == e.loaded) {
							console.log('Read OK');
							try {
								var json = JSON.parse(e.target.result);

								console.log(json);
								
								if (json.kissultraosd) {
									if (callback) callback(json);
								} else {
									console.log("Old kiss backup detected!");
									$(".modal-overlay").off('click');
									$(".modal-overlay").on('click', function() {
										hideModal();
									});
									$(".modal-body").html("<p class='header'>This backup is invalid.</p>For safety reasons, import of invalid backups is prohibited.");
									$(".modal-footer").html("");
									$(".modal-overlay").show();
									$(".modal").show();                            	
									return;
								}
							} catch (e) {
								console.log('Wrong file');
								return;
							}
						}
					};
					reader.readAsText(file);
				});
			});
		} else {
			// web
		}
	};

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
					self.whiteLevel = lineData[15]; // + 256 * lineData[14];
					self.blackLevel = lineData[13]; // + 256 * lineDara[12];
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
						
						var wl = (self.whiteLevel - 60) * 1.83; if (wl>255) wl = 255; if (wl<0) wl = 0;
						var bl = (self.blackLevel - 60) * 1.83; if (bl>255) bl = 255; if (bl<0) bl = 0;
						
						for (var y=0; y<288; y++) {
							for (var x=0; x<512; x++) {
								var pixaddr = y*128 + (x >> 2);
								var dstaddr = 4* (y*512 + x);
								var c = scr[pixaddr];
								c <<= (2*(x & 3));
								var col = c & 0xc0;

								if (col == 0x80) {
									p.data[dstaddr + 0]	=	wl;
									p.data[dstaddr + 1]	=	wl;
									p.data[dstaddr + 2]	=	wl;
									p.data[dstaddr + 3]	=	255;
								} else if (col == 0x40) {
									p.data[dstaddr + 0]	=	bl;
									p.data[dstaddr + 1]	=	bl;
									p.data[dstaddr + 2]	=	bl;
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
		
		if (+kissProtocol.data[kissProtocol.GET_SETTINGS]['ver'] > 129) {
			$(".footer").show();
			$('#backup').on('click', function () {

				$(this).blur();

				if (kissProtocol.data[kissProtocol.GET_SETTINGS].ver > 126) { // TODO: 129
					var tmp = {
							'buffer': new ArrayBuffer(1),
							'chunk': 0
					};
					kissProtocol.send(kissProtocol.GET_OSD_CONFIG, kissProtocol.preparePacket(kissProtocol.GET_OSD_CONFIG, tmp), function () {
						console.log("Loaded OSD config");
						grabData();
						backupConfig();
					});
				} 
			});

			$('#restore').on('click', function () {
				if (isNative()) {
					restoreConfig(function (json) {
						saveOSDConfig(json, function(status) {
							console.log("Saved: " + status);
						});
					});
				} else {
					document.getElementById('files').files = new DataTransfer().files;
					$("#files").click();
				}
				$(this).blur();
			});

			if (!isNative()) {
				document.getElementById('files').addEventListener('change', handleFileSelect, false);
			}
		} else {
			$(".footer").hide();
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