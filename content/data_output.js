'use strict';

CONTENT.data_output = {
    graphData: []
};

CONTENT.data_output.initialize = function (callback) {
    var self = this;
    self.ESCTelemetry = 0;
    self.startedUIupdate = 0;
    self.updateTimeout;
    self.motorTestEnabled = false;
    self.requestTelemetry = true;
    self.imuInitialized = false;
    self.telemetry = {};
    self.gps = {};
    self.homeinfo = {};
    self.telemCount = 0;
    self.config = {};
    self.motors = 4;
    
    self.curMapping = "";

       
    GUI.switchContent('data_output', function () {
    	 kissProtocol.send(kissProtocol.GET_SETTINGS, [kissProtocol.GET_SETTINGS], function () {
    		 self.config = kissProtocol.data[kissProtocol.GET_SETTINGS];
    		 // how many motors we have?
    		 var ct = kissProtocol.data[kissProtocol.GET_SETTINGS].CopterType;
    		 if (ct == 0) {
    			 self.motors = 3;
    		 } else if (ct >=1 && ct<=3 ) {
    			 self.motors = 4;
    		 } else if (ct >=4 && ct<=6 ) {
    			 self.motors = 6;
    		 } else if (ct >=7 && ct<=8 ) {
    			 self.motors = 5;
    		 } else {
    			 self.motors = 8;
    		 }
    		 kissProtocol.send(kissProtocol.GET_TELEMETRY, [kissProtocol.GET_TELEMETRY], function () {
    	         GUI.load("./content/data_output.html", htmlLoaded);
    	     });
         });
    });

    function deg2direction(val) {
        var dividor = 45 / 2;
        var retval = "";
        if (val > (360 - dividor) || val < (0 + dividor)) retval = "N";
        else if (val > (45 - dividor) || val < (45 + dividor)) retval = "NE"
        else if (val > (90 - dividor) || val < (90 + dividor)) retval = "E"
        else if (val > (135 - dividor) || val < (135 + dividor)) retval = "SE"
        else if (val > (180 - dividor) || val < (180 + dividor)) retval = "S"
        else if (val > (225 - dividor) || val < (225 + dividor)) retval = "SW"
        else if (val > (270 - dividor) || val < (270 + dividor)) retval = "W"
        else if (val > (315 - dividor) || val < (315 + dividor)) retval = "NW"
        return retval
    }

    function animateModel(timestamp) {
        if (GUI.activeContent == 'data_output') {
            requestAnimationFrame(animateModel);

            if (!self.lastTimestamp) {
                self.lastTimestamp = timestamp;
            }
            var frameTime = timestamp - self.lastTimestamp;
            self.lastTimestamp = timestamp;
            if (!self.imuInitialized) {
                imuInit(1 / 60, 0.1);
                self.imuInitialized = true;
            }

            if (frameTime > 0) {

                imuUpdate(+self.telemetry['GyroRaw'][0] * 2000 * Math.PI / 180,
                    -self.telemetry['GyroRaw'][1] * 2000 * Math.PI / 180,
                    +self.telemetry['GyroRaw'][2] * 2000 * Math.PI / 180,
                    +self.telemetry['ACCRaw'][0],
                    +self.telemetry['ACCRaw'][1],
                    +self.telemetry['ACCRaw'][2]);

                $("#model").kissModel('reset');
                var axisRate = { 'roll': 0, 'pitch': 0, 'yaw': 0 };
                if (!isNaN(Quaternion[0]) &&
                    !isNaN(Quaternion[1]) &&
                    !isNaN(Quaternion[2]) &&
                    !isNaN(Quaternion[3])) {
                    var q = new THREE.Quaternion(Quaternion[0], Quaternion[1], Quaternion[2], Quaternion[3]);
                    var rotation = new THREE.Euler().setFromQuaternion(q, "XYZ");
                    axisRate = { 'roll': rotation.z, 'pitch': rotation.y, 'yaw': -rotation.x };
                } else {
                    imuInit(1 / 60, 0.1);
                }
                $("#model").kissModel('updateRate', axisRate);
                $("#model").kissModel('refresh');
            }
        }
    }
    
    


    function htmlLoaded() {
        // generate receiver bars
        var receiverNames = [$.i18n('column.throttle'), $.i18n('column.roll'), $.i18n('column.pitch'), $.i18n('column.yaw'), 'AUX1', 'AUX2', 'AUX3', 'AUX4', 'AUX5', 'AUX6', 'AUX7'];
        var receiverContainer = $('#rbars');
        var receiverFillArray = [];
        var receiverLabelArray = [];
        self.ESCTelemetry = 0;
        self.startedUIupdate = 0;
        window.clearTimeout(self.updateTimeout);
        self.requestTelemetry = true;


        var data = kissProtocol.data[kissProtocol.GET_SETTINGS];


        $('.mixerPreview img').attr('src', './images/mixer/' + data['CopterType'] + (data['ESCOutputLayout'] > 0 && (data['CopterType'] == 1 || data['CopterType'] == 2) ? '_' + data['ESCOutputLayout'] : '') + (data['reverseMotors'] == 0 ? '' : '_inv') + ".png");



        for (var i = 0; i < receiverNames.length; i++) {
        	receiverContainer.append($.Mustache.render("receiver-bar-template", {'name':receiverNames[i]}));
        }

        $('.meter .fill', receiverContainer).each(function () {
            receiverFillArray.push($(this));
        });

        $('.meter', receiverContainer).each(function () {
            receiverLabelArray.push($('.label', this));
        });

        var octoCotperType = [9,10];

        var motorNames = [];
        
        for (var i=0; i<self.motors; i++) {
        	motorNames.push("M"+(i+1));
        }
        
        var motorContainer = $('#mbars');
        var motorFillArray = [];
        var motorLabelArray = [];
  
        for (var i = 0; i < motorNames.length; i++) {
            motorContainer.append($.Mustache.render("motor-bar-template", {'id':i, 'name':motorNames[i], 'outputs':self.config.ver >= 137}));
            // set default routes and remap handlers
            if (self.config.ver >= 137) {
            	$("select[name='mapping_m" + i + "']").val(self.config.dshotMapping[i]).change(function() {
            		var tmp = $(this).val();
            		$("select.motor-mapping").not(this).each(function(index) {
            			if ($(this).val() == tmp) {
            				$(this).val(self.curMapping);
            			}
            		});
            	}).click(function() {
            		self.curMapping = $(this).val();
            	});
            }
        }
        
        $('.motor .fill', motorContainer).each(function () {
            motorFillArray.push($(this));
        });

        $('.motor', motorContainer).each(function () {
            motorLabelArray.push($('.label', this));
        });
        
        $(".motor-test").on('change', function () {
            if (self.motorTestEnabled) {
                var motorTest = [0, 0, 0, 0, 0, 0, 0, 0];
                $(".motor-test").each(function (motor, elm) {
                    motorTest[motor] = $(elm).is(':checked') ? 1 : 0;
                });
                                
                var tmp = {
                    'buffer': new ArrayBuffer(9),
                    'motorTestEnabled': 1,
                    'motorTest': motorTest
                };
                kissProtocol.send(kissProtocol.MOTOR_TEST, kissProtocol.preparePacket(kissProtocol.MOTOR_TEST, tmp));
            }
        });

        
        $('.motor-test-enabled').on('change', function () {
            $(".motor-test").prop('checked', false);
            self.motorTestEnabled = this.checked;
            if (self.motorTestEnabled) {
                $(".motor-test").first().trigger('change');
            } else {
                $(".motor-test").prop("disabled", true);
                var tmp = {
                    'buffer': new ArrayBuffer(9),
                    'motorTestEnabled': 0,
                    'motorTest': [0, 0, 0, 0, 0, 0, 0, 0]
                };
                kissProtocol.send(kissProtocol.MOTOR_TEST, kissProtocol.preparePacket(kissProtocol.MOTOR_TEST, tmp));
            }
        });

        $(".motor-test-button").on("click", function () {
        	$(".test").show();
            $("#motor-test-disclaimer").show();
        });

        $(".warning-button").on("click", function () {
            $(".motor-test-button").hide();
            $(".motor-test, .motor-reverse, .motor-mapping").show();
            $(".motor-test-enabled").show();
            $("#motorTestTitle span").first().text($.i18n('text.enable-motor-test'));
            $("#motor-test-disclaimer").hide();
        });

        self.barResize = function () {
        	$(".meter-bar .label, .meter-bar .fill .label").each(function(index) {
        		$(this).css("margin-left",  ($(this).closest(".meter-bar").width() / 2) - ($(this).width() / 2));
        	});
        };
        
        $(window).on('resize', self.barResize).resize(); // trigger so labels
        // get correctly
        // aligned on
        // creation

        $('a.reset_model').click(function () {
            self.imuInitialized = false;
        });

        $('a.calibrateAccelerometer').click(function () {
            var config = kissProtocol.data[kissProtocol.GET_SETTINGS];
            var data = kissProtocol.data[kissProtocol.GET_TELEMETRY];

            self.requestTelemetry = false;

            // not a correct way to do it
            config['ACCZero'][0] = (data['ACCRaw'][0]) * 1000;
            config['ACCZero'][1] = (data['ACCRaw'][1]) * 1000;
            config['ACCZero'][2] = (data['ACCRaw'][2] - 1.0) * 1000;

            kissProtocol.send(kissProtocol.SET_SETTINGS, kissProtocol.preparePacket(kissProtocol.SET_SETTINGS, kissProtocol.data[kissProtocol.GET_SETTINGS]), function () {
                self.requestTelemetry = true;
                fastDataPoll();
            });
        });

        var legendItems = $('dl.legend dd');
        var meterScale = { 'min': 1000, 'max': 2000 };

        function updateUI() {
            var data = kissProtocol.data[kissProtocol.GET_TELEMETRY];
            var gps = kissProtocol.data[kissProtocol.GET_GPS];
            var homeinfo = kissProtocol.data[kissProtocol.GET_HOME_INFO];

            var useGraphData = parseInt($('select[name="graphTitle"]').val());

            if (!self.ESCTelemetry) {
                self.ESCTelemetry = 1;
                $('select[name="graphTitle"]').html('<option value="0" data-i18n="telemetry.0">Gyro &amp; ACC Data:</option><option value="1" data-i18n="telemetry.1">ESC Temperatures:</option><option id="ESCTelemetrie" value="2" data-i18n="telemetry.2">ESC Voltanges:</option><option value="3" data-i18n="telemetry.3">ESC Currents:</option><option value="4" data-i18n="telemetry.4">ESC used A/h</option><option value="5" data-i18n="telemetry.5">ESC E-RpM / 1000</option><option value="6" data-i18n="telemetry.6">ESC TLM Stats</option>' + (data.RXStats !== undefined ? '<option value="7" data-i18n="telemetry.7">RX Uplink</option><option value="8" data-i18n="telemetry.8">RX Downlink</option>' : '') + '<option value="9" data-i18n="telemetry.9">FC Stats</option>').children().i18n();
            }
            if (!data) {
                if (GUI.activeContent == 'data_output') self.updateTimeout = window.setTimeout(function () { updateUI(); }, 5);
                return;
            }

            if (data['RXcommands'][0] < 1020 && self.motorTestEnabled) {
                $(".motor-test, .motor-reverse, .motor-mapping").prop("disabled", false);
            } else {
                $(".motor-test, .motor-reverse, .motor-mapping").prop("disabled", true);
            }
            
            // set to empty
            for (var i=0; i<8; i++) {
       		 	$('#graph'+(i+1)).text('');
            }

            if (useGraphData == 0) {
                $('#graph1').text($.i18n('legend.1'));
                $('#graph2').text($.i18n('legend.2'));
                $('#graph3').text($.i18n('legend.3'));
                $('#graph4').text($.i18n('legend.4'));
                $('#graph5').text($.i18n('legend.5'));
                $('#graph6').text($.i18n('legend.6'));
            } else if (useGraphData == 6) {
                $('#graph1').text($.i18n('legend.7'));
                $('#graph2').text($.i18n('legend.8'));
                $('#graph3').text($.i18n('legend.9'));
                $('#graph4').text($.i18n('legend.10'));
                $('#graph5').text($.i18n('legend.11'));
                $('#graph6').text($.i18n('legend.12'));
            } else if (useGraphData == 7) {
                $('#graph1').text($.i18n('legend.19'));
                $('#graph2').text($.i18n('legend.20'));
                $('#graph3').text($.i18n('legend.21'));
                $('#graph4').text($.i18n('legend.22'));
                $('#graph5').text($.i18n('legend.23'));
                $('#graph6').text($.i18n('legend.24'));
            } else if (useGraphData == 8) {
                $('#graph1').text($.i18n('legend.25'));
                $('#graph2').text($.i18n('legend.26'));
                $('#graph3').text($.i18n('legend.27'));
                $('#graph4').text($.i18n('legend.28'));
                $('#graph5').text('');
                $('#graph6').text('');
            } else if (useGraphData == 9) {
                $('#graph1').text($.i18n('legend.29'));
                $('#graph2').text($.i18n('legend.30'));
                $('#graph3').text('');
                $('#graph4').text('');
                $('#graph5').text('');
                $('#graph6').text('');
            } else {
            	for (var i=0; i<self.motors; i++) {
            		var n = 'legend.'+(13+i);
            		if (i>5) n = 'legend.'+(i-6 + 40);
            		 $('#graph'+(i+1)).text($.i18n(n));
            	}
            }
            $('#idle').text(data['idleTime'] + ' %');
            $('#Vbat').text((data['LiPoVolt'] * 10).toFixed(2) + ' v');

            // update bars with latest data
            var receiverLabelArrayLength = receiverLabelArray.length;
            for (var i = 0; i < receiverLabelArrayLength; i++) {
                receiverFillArray[i].css('width', ((data['RXcommands'][i] - meterScale.min) / (meterScale.max - meterScale.min) * 100).clamp(0, 100) + '%');
                receiverLabelArray[i].text(data['RXcommands'][i]);
            
            }
            var motorLabelArrayLength = motorLabelArray.length;
            for (var i = 0; i < motorLabelArrayLength; i++) {
                motorFillArray[i].css('width', ((data['PWMOutVals'][i] - meterScale.min) / (meterScale.max - meterScale.min) * 100).clamp(0, 100) + '%');
                motorLabelArray[i].text(data['PWMOutVals'][i]);
            }
            
            self.barResize();

            // other
            if (data['mode'] == 0) $("#omode").text($.i18n('text.acro'));
            else if (data['mode'] == 1) $("#omode").text($.i18n('text.level'));
            else if (data['mode'] == 2) $("#omode").text($.i18n('text.3D'));
            else if (data['mode'] == 3) $("#omode").text($.i18n('text.turtle-mode'));
            else if (data['mode'] == 5) $("#omode").text($.i18n('text.rth'));
            else $("#omode").text(data['mode']);

            if (data['Armed'] == 0) $("#ostatus").text($.i18n('text.disarmed'));
            else if (data['Armed'] == 1) $("#ostatus").text($.i18n('text.armed'));
            else $("#ostatus").text(data['Armed']);

            $("#oanglex").text((data['angle'][0] * 10).toFixed(2));
            $("#oangley").text((data['angle'][1] * 10).toFixed(2));
            $("#oanglez").text((data['angle'][2] * 10).toFixed(2));


            if (data['Armed'] == 0) {
                $(".motor-test-enabled").prop("disabled", false);
            } else {
                $(".motor-test-enabled").prop("disabled", true);
            }

            // build sample block
            var sampleBlock = [];

            var midscale = 1.5;

            // update legend
            
            for (var i=0; i<8; i++) {
            	legendItems.eq(i).text('');
            }
            switch (useGraphData) {
                case 0:
                    legendItems.eq(0).text(data['GyroRaw'][0].toFixed(3));
                    legendItems.eq(1).text(data['GyroRaw'][1].toFixed(3));
                    legendItems.eq(2).text(data['GyroRaw'][2].toFixed(3));
                    legendItems.eq(3).text(data['ACCRaw'][0].toFixed(3));
                    legendItems.eq(4).text(data['ACCRaw'][1].toFixed(3));
                    legendItems.eq(5).text(data['ACCRaw'][2].toFixed(3));

                    for (var i = 0; i < 3; i++) {
                        sampleBlock.push(data['GyroRaw'][i] * 4 * (self.motorTestEnabled ? 100 : 1)); // to
                        // have
                        // it
                        // more
                        // visible
                        if (i == 0) {
                            if (data['GyroRaw'][i] * 2000 > parseInt($('#gxmax').text())) $('#gxmax').text(data['GyroRaw'][i] * 2000);
                            if (data['GyroRaw'][i] * 2000 < parseInt($('#gxmin').text())) $('#gxmin').text(data['GyroRaw'][i] * 2000);
                        }
                        if (i == 1) {
                            if (data['GyroRaw'][i] * 2000 > parseInt($('#gymax').text())) $('#gymax').text(data['GyroRaw'][i] * 2000);
                            if (data['GyroRaw'][i] * 2000 < parseInt($('#gymin').text())) $('#gymin').text(data['GyroRaw'][i] * 2000);
                        }
                        if (i == 2) {
                            if (data['GyroRaw'][i] * 2000 > parseInt($('#gzmax').text())) $('#gzmax').text(data['GyroRaw'][i] * 2000);
                            if (data['GyroRaw'][i] * 2000 < parseInt($('#gzmin').text())) $('#gzmin').text(data['GyroRaw'][i] * 2000);
                        }
                    }
                    for (var i = 0; i < 3; i++) {
                        sampleBlock.push(data['ACCRaw'][i]);
                    }

                    break;
                case 1:
                	for (var i=0; i<self.motors; i++) {
                		legendItems.eq(i).text(data['ESC_Telemetrie'+i][0].toFixed(3));
                		sampleBlock.push((data['ESC_Telemetrie'+i][0] / 35) - midscale);
                	}
                    break;
                case 2:
                 	for (var i=0; i<self.motors; i++) {
                 		legendItems.eq(i).text((data['ESC_Telemetrie'+i][1] / 100).toFixed(3));
                 		sampleBlock.push((data['ESC_Telemetrie'+i][1] / 1000) - midscale);
                 	}
                    break;
                case 3:
                	for (var i=0; i<self.motors; i++) {
                		legendItems.eq(i).text((data['ESC_Telemetrie'+i][2] / 100).toFixed(3));
                		sampleBlock.push((data['ESC_Telemetrie'+i][2] / 1000) - midscale);
                	}
                    break;
                case 4:
                	for (var i=0; i<self.motors; i++) {
                		legendItems.eq(i).text((data['ESC_Telemetrie'+i][3] / 1000).toFixed(3));
                		sampleBlock.push((data['ESC_Telemetrie'+i][3] / 5000) - midscale);
                	}
                    break;
                case 5:
                	for (var i=0; i<self.motors; i++) {
                		legendItems.eq(i).text((data['ESC_Telemetrie'+i][4] / 10).toFixed(3));
                		sampleBlock.push((data['ESC_Telemetrie'+i][4] / 1000) - midscale);
                	}
                    break;
                case 6:
                	for (var i=0; i<6; i++) {
                		legendItems.eq(i).text((data['ESC_TelemetrieStats'][i]).toFixed(3));
                		sampleBlock.push((data['ESC_TelemetrieStats'][i] / 35) - midscale);
                	}
                    break;
                case 7:
                    legendItems.eq(0).text(data['RXStats'].upRSSI1);
                    legendItems.eq(1).text(data['RXStats'].upRSSI2);
                    legendItems.eq(2).text(data['RXStats'].upLQ);
                    legendItems.eq(3).text(data['RXStats'].upSNR);
                    legendItems.eq(4).text(data['RXStats'].upAntenna + 1);
                    legendItems.eq(5).text(data['RXStats'].rfMode);

                    sampleBlock.push((data['RXStats'].upRSSI1 / 100) - midscale);
                    sampleBlock.push((data['RXStats'].upRSSI2 / 100) - midscale);
                    sampleBlock.push((data['RXStats'].upLQ / 100) - midscale);
                    sampleBlock.push((data['RXStats'].upSNR / 100) - midscale);
                    sampleBlock.push((data['RXStats'].upAntenna + 1) - midscale);
                    sampleBlock.push(data['RXStats'].rfMode - midscale);
                    break;
                case 8:
                    var powerNames = ['0', '10', '25', '100', '500', '1000', '2000'];

                    legendItems.eq(0).text(powerNames[data['RXStats'].upTXPower]);
                    legendItems.eq(1).text(data['RXStats'].downRSSI);
                    legendItems.eq(2).text(data['RXStats'].downLQ);
                    legendItems.eq(3).text(data['RXStats'].downSNR);
                    legendItems.eq(4).text('');
                    legendItems.eq(5).text('');

                    sampleBlock.push(data['RXStats'].upTXPower - midscale);
                    sampleBlock.push((data['RXStats'].downRSSI / 100) - midscale);
                    sampleBlock.push((data['RXStats'].downLQ / 100) - midscale);
                    sampleBlock.push((data['RXStats'].downSNR / 100) - midscale);
                    break;
                case 9:
                    legendItems.eq(0).text(data['idleTime']);
                    legendItems.eq(1).text((data['LiPoVolt'] * 10).toFixed(2));
                    legendItems.eq(2).text('');
                    legendItems.eq(3).text('');
                    legendItems.eq(4).text('');
                    legendItems.eq(5).text('');
                    sampleBlock.push(data['idleTime'] / 500);
                    sampleBlock.push((data['LiPoVolt'] / 2) - midscale);
                    break;
            }

            self.addSample(self.graphData, sampleBlock);
            self.renderGraph();

            if (gps !== undefined) {
                $("#gpsblock").show();
                $("#latitude").text(gps.latitude.toFixed(6));
                $("#longitude").text(gps.longitude.toFixed(6));
                $("#speed").text(gps.speed.toFixed(2) + " km/h");
                $("#altitude").text(gps.altitude.toFixed(2) + " m");
                $("#course").text(gps.course.toFixed(2) + " (" + deg2direction(gps.course.toFixed(2)) + ")");
                $("#satellites").text(gps.satellites + (gps.fix == 1 ? ' (fix)' : ''));
            }

            if (homeinfo !== undefined) {
                $("#homeblock").show();
                $("#homePointDistance").text(homeinfo.homeDistance.toFixed(2) + " m");
                $("#homePointDirection").text(homeinfo.homeDirection.toFixed(2));
                $("#homePointrelativeHeight").text(homeinfo.homeRelativeAltitude.toFixed(2) + " m");
            }
            // Update data
            if (GUI.activeContent == 'data_output') self.updateTimeout = window.setTimeout(function () { fastDataPoll(); }, 10);
        }

        // setup graph
        var mixedGraph = self.initializeGraph('graph', self.graphData);

        self.renderGraph = function () {
            self.drawGraph(mixedGraph, [3.5, -3.5]);
        };

        $(window).on('resize', self.resizeCanvas).resize();

        function fastDataPoll() {
            if (self.requestTelemetry) {
                kissProtocol.send(kissProtocol.GET_TELEMETRY, [kissProtocol.GET_TELEMETRY], function () {
                    if (GUI.activeContent == 'data_output') {
                        if (self.startedUIupdate == 0) {
                            self.telemetry = kissProtocol.data[kissProtocol.GET_TELEMETRY];
                            updateUI();
                        }
                    }
                });
                self.telemCount++;
                if (self.telemCount == 100) {
                    self.telemCount = 0;
                    if (data['ver'] >= 119)
                        kissProtocol.send(kissProtocol.GET_GPS, [kissProtocol.GET_GPS, 0, 0], function () { });
                    if (data['ver'] >= 121)
                        kissProtocol.send(kissProtocol.GET_HOME_INFO, [kissProtocol.GET_HOME_INFO, 0, 0], function () { });
                }
            }
        }

        $("#model").kissModel({
            'mixer': kissProtocol.data[kissProtocol.GET_SETTINGS].CopterType,
            'width': 190,
            'height': 190
        })



        animateModel();

        // start
        fastDataPoll();
        
        scrollTop();
    }
};

CONTENT.data_output.addSample = function (data, sample, scale) {
    var arr = [];

    if (scale) {
        var SampleLength = sample.length;
        for (var i = 0; i < SampleLength; i++) {
            arr.push(sample[i] * scale);
        }
    } else {
        var SampleLength = sample.length;
        for (var i = 0; i < SampleLength; i++) {
            arr.push(sample[i]);
        }
    }

    data.push(arr);
};

CONTENT.data_output.initializeGraph = function (selector, data) {
    var canvas = document.getElementById(selector);
    var graph = {
        'selector': selector,
        'canvas': canvas,
        'context': canvas.getContext('2d'),
        'colors': ['#00A8F0', '#f02525', '#C0D800', '#9440ED', '#f8921a', '#147A66', '#fff', '#fff', '#fff', '#fff'],
        'ticks': [10, 8],
        'data': data
    };

    return graph;
};


CONTENT.data_output.drawGraph = function (graph, scale) {
    var canvas = graph.canvas;
    var ctx = graph.context;
    var data = graph.data;

    // if canvas doesn't exist we can't continue
    if (canvas.offsetWidth == 0) return;

    var margin = { top: 0, right: 0, bottom: 0, left: 0 };
    var width = canvas.offsetWidth;
    var height = canvas.offsetHeight;
    var middle = (height - 2) / 2;

    var renderSamples = Math.round((width - margin.left) / 500);
    if (renderSamples < 1) renderSamples = 1;

    var scaleFactor = height / scale[0];
    if (scaleFactor < 1) scaleFactor = parseFloat(scaleFactor.toFixed(2));
    else scaleFactor = Math.round(scaleFactor);

    while (data.length > width - margin.left) {
        for (var i = 0; i < renderSamples; i++) {
            data.shift();
        }
    }

    var startupOffset = width - (data.length * 1.5) + 1;

    // clean up
    ctx.clearRect(0, 0, width, height);


    // draw grid
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#dddddd';
    /*
     * // vertical var tickSize = width / graph.ticks[1]; for (var x = tickSize +
     * margin.left, pos; x < width; x += tickSize) { pos = Math.round(x) + 0.5;
     * 
     * ctx.moveTo(pos, 0); ctx.lineTo(pos, height); }
     */

    // horizontal
    var tickSize = (height - 2) / graph.ticks[0]; // -2px for bottom axis
    // outline
    for (var y = tickSize, pos; y < height; y += tickSize) {
        pos = Math.round(y) + 0.5;

        ctx.moveTo(margin.left, pos);
        ctx.lineTo(width, pos);
    }
    ctx.stroke();

    // draw data axis
    ctx.lineWidth = 1.5;
    if (data.length) { // only render if data is present
        var dLength = data.length;
        var d0Length = data[0].length;
        for (var axis = 0; axis < d0Length; axis++) {
            ctx.beginPath();
            ctx.strokeStyle = graph['colors'][axis];

            for (var i = 0, val; i < dLength; i += renderSamples) {
                val = -(data[i][axis] * scaleFactor) + middle;

                // clamp at limits
                if (val > height) {
                    val = height - 3;
                } else if (val < 0) {
                    val = 1;
                }

                ctx.lineTo((i * 1.5) + startupOffset, val);
            }

            ctx.stroke();
        }
    }
};

CONTENT.data_output.resizeCanvas = function () {
    var wrapper = $('.plot');
    var r = 0;
    if ($("#model").css("float") == "right") r = 190;
    $('#graph').prop('width', wrapper.width() - 160 - r); // -160px for legend

    CONTENT.data_output.renderGraph();
}

CONTENT.data_output.cleanup = function (callback) {
    $(window).off('resize', this.barResize);
    $(window).off('resize', this.resizeCanvas);
    if (this.motorTestEnabled) {
        console.log("For safety reasons, turning off the motors");
        var tmp = {
            'buffer': new ArrayBuffer(9),
            'motorTestEnabled': 0,
            'motorTest': [0, 0, 0, 0, 0, 0, 0, 0]
        };
        kissProtocol.send(kissProtocol.MOTOR_TEST, kissProtocol.preparePacket(kissProtocol.MOTOR_TEST, tmp))
    }
    if (callback) callback();
};


