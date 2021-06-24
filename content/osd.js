'use strict';

CONTENT.osd = {

};

CONTENT.osd.initialize = function (callback) {
    var self = this;

    self.startedUIupdate = 0;
    self.updateTimeout;
    self.frame = 0;
    self.address = 0xffff;
    self.chunkSize = 240;
   
	var Buffer = require('buffer').Buffer
	self.compressedBuffer = Buffer.alloc(128*288); // max osd in bytes
	
	GUI.switchContent('osd', function () {
		GUI.load("./content/osd.html", function () {
			htmlLoaded({});
		});
	});


	function htmlLoaded(data) {

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

				//console.log("addr= " + addr + " len= " + len);
				
				
				if (addr == 0xffff) {
					self.compressedSize = len;
					// get thew rest of the data here
					//console.log("Got INFO frame. Packet contains " + len + " bytes");
					self.address = 0;
				} else {
					if (len == 0) {
						
						self.address = 0xffff; // Info request
						
						var LZ4 = require('lz4');
						var uncompressedBuffer = Buffer.alloc(128*288);
						var decoded = LZ4.decodeBlock(self.compressedBuffer, uncompressedBuffer);
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

						ctx.putImageData(p, 0, 0);
					} else {
						for (var i=0; i<len; i++) {
							self.compressedBuffer.writeUInt8(lineData[i + 4], addr + i );
						}
						self.address = addr + len; // next one
					}
				}
			}
		}

		// setup graph
		$(window).on('resize', self.resizeCanvas).resize();

		function fastDataPoll() {
			//console.log("FDP");
			self.updateTimeout = window.setTimeout(function () {
				fastDataPoll();
			}, 50); // Just restart if needed
			
			 var tmp = {
					 'buffer': new ArrayBuffer(3),
	                 'address': self.address,
	                 'chunkSize': self.chunkSize
	         };
	             
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
	}
};


CONTENT.osd.resizeOSD = function () {
//    var wrapper = $('#charts');
//    console.log("resize chart");
////    $('#tpa_chart').kissTPAChart('resize', { width: wrapper.width() });
}

CONTENT.osd.cleanup = function (callback) {
  //  $(window).off('resize', this.osdResize);
    window.clearTimeout(this.updateTimeout);
    if (callback) callback();
};