'use strict';


CONTENT.advanced = {
    USER_PIDs: [],
    PRESET_PIDs: [],
};

CONTENT.advanced.initialize = function (callback) {
    var self = this;
    var settingsFilled = 0;

    GUI.switchContent('advanced', function () {
        kissProtocol.send(kissProtocol.GET_SETTINGS, [kissProtocol.GET_SETTINGS], function () {
            GUI.load("./content/advanced.html", function () {
                htmlLoaded(kissProtocol.data[kissProtocol.GET_SETTINGS]);
            });
        });
    });

    self.isUltra2 = function() {
    	if (kissProtocol.data[kissProtocol.GET_HARDWARE_INFO] != undefined) {
        	  var info = kissProtocol.data[kissProtocol.GET_HARDWARE_INFO];
        	  var hw = info.hardwareVersion & 0xFF00;
        	  if (hw >= 0x0300) {
        		  return true;
        	  }
    	} 
    	return false;
    } 
    
    function htmlLoaded(data) {
        validateBounds('#content input[type="number"]');

        // serial warning
        $(".warning-disclaimer").hide();
        $(".warning-button").on("click", function () {
            $(".warning-disclaimer").hide();
        });

        $('input[name="mahAlarm"]').val(data['mahAlarm']);

        $('input[name="DB0"]').val(+data['DB'][0]);
        $('input[name="DB1"]').val(+data['DB'][1]);
        $('input[name="DB2"]').val(+data['DB'][2]);

        if (data['motorBuzzer']) {
            $('input[name="motorBuzzer"]').prop('checked', 1);
        }
        if (data['ver'] >= 109) { // remove serial vtx from 109..
            $("select[name='loggerConfig'] option[value='11']").remove();
            if (data['loggerConfig'] > 10) {
                data['loggerConfig'] = 0; // osd!
            }
            if (data['reverseMotors'] == "1") {
                $('input[name="reverseMotors"]').prop('checked', 1);
            }
            if (data['adaptiveFilter'] == "1") {
                $('input[name="adaptiveFilter"]').prop('checked', 1);
            }
            if (data['launchMode'] == "1") {
                $('input[name="launchMode"]').prop('checked', 1);
            }
            $('input[name="ledBrightness"]').val(+data['ledBrightness']);
        } else {
            $("select[name='vtxType'] option[value='3']").remove(); // no unify on 108
            $("#reverseMotors").hide();
            $("#AdaptiveFilter").hide();
            $("#ledBrightness").hide();
        }
        if (data['ver'] >= 111 && (data['CopterType'] == 7 || data['CopterType'] == 8)) {
            $("#reverseMotorsTitle").removeAttr("data-i18n"); // needs to be done clean
            $("#reverseMotorsTitle").text("Foward Motors 3D use");
            $("#reverseMotorsText").removeAttr("data-i18n");
            $("#reverseMotorsText").text("Use Forward Motors for bidirectional thrust");
        }
        if (data['ver'] >= 111) {
            $('input[name="SID"]').removeAttr("disabled");
            $('input[name="SID"]').val(data['setpointIntoD']);
        }
 
        if (data['loggerConfig'] > 0 && data['loggerConfig'] < 11) {
            $("#loggerDebug").show();
        	if (data['ver'] >= 129) {
        		$("#loggerSpeed").show();
        	}
        } else {
            $("#loggerDebug").hide();
        	if (data['ver'] >= 129) {
        		$("#loggerSpeed").hide();
        	}
        }
    		

        $('select[name="loggerConfig"]').val(data['loggerConfig']);

        $('select[name="vtxType"]').val(data['vtxType']);
        $('input[name="vtxPowerLow"]').val(+data['vtxPowerLow']);
        $('input[name="vtxPowerHigh"]').val(+data['vtxPowerHigh']);

        if (data['ver'] < 117) { // Remove TBS EVO
            $("#vtxType > option[value='4']").remove();
        }

        if (data['ver'] < 119) { // Hide Launchmode
            $("#launchMode").hide();
        }
        
        $("#mspCanvas").hide();
        if (data['ver'] >= 129) {
        	
        	$('input[name="currentSensorDivider"]').val(+data['currentSensorDivider']);
        	
        	if (self.isUltra2()) {
        		$("#currentSensorDivider").show();
        		$('select[name="ccPadMode"]').val(0).hide();
        		$("#ccpadmodediv").hide();
        		$("#analogCurrent > .title").attr('data-i18n', 'title.analog-current2');
        		changeLanguage();
        	} else {
        		if (data['ccPadMode'] == 0) {
        			$("#currentSensorDivider").hide();
        		} else {
        			$("#currentSensorDivider").show();
        		}
        	}
        	$("#mspCanvas").show();
        	
        	$('select[name="mspCanvas"]').val(data['mspCanvas']);
        	if (data['mspCanvas'] != 0) {
        		$(".msposd").hide();
        	} else {
        		$(".msposd").show();
        	}
        }
       
        $('select[name="mspCanvas"]').on('change', function() {
        	if ($(this).val() != 0) {
        		$(".msposd").hide();
        	} else {
        		$(".msposd").show();
        	}
        });
    	
        $('select[name="loggerConfig"]').on('change', function () {
            var tmp = +$(this).val();
            if (tmp < 11) {
                if (tmp > 0) {
                    $("#loggerDebug").show();
                	if (data['ver']>=129) {
                		$("#loggerSpeed").show();
                	}
                } else {
                    $("#loggerDebug").hide();
                	if (data['ver']>=129) {
                		$("#loggerSpeed").hide();
                	}
                }
                if (data['ver'] == 108) {
                    if ($("select[name='vtxType']").val() == "2") {
                        $("select[name='vtxType']").val("0").trigger("change");
                    }
                }
            } else {
                $("#loggerDebug").hide();
            	if (data['ver']>=129) {
            		$("#loggerSpeed").hide();
            	}
            }
        });

        $('input[name="CBO0"]').val(+data['CBO'][0]);
        $('input[name="CBO1"]').val(+data['CBO'][1]);
        $('input[name="CBO2"]').val(+data['CBO'][2]);

        var cbo = false;
        $('input[name="CBO"]').removeAttr("disabled");
        if (+data['CBO'][0] != 0 || +data['CBO'][1] != 0 || +data['CBO'][2] != 0) {
            cbo = true;
        }

        $('input[name="CBO"]').prop('checked', cbo);
        if (cbo) {
        	$("#CBODATA").show();
            $('input[name="CBO0"]').removeAttr("disabled");
            $('input[name="CBO1"]').removeAttr("disabled");
            $('input[name="CBO2"]').removeAttr("disabled");
        } else {
         	$("#CBODATA").hide();
            $('input[name="CBO0"]').prop('disabled', 'true');
            $('input[name="CBO1"]').prop('disabled', 'true');
            $('input[name="CBO2"]').prop('disabled', 'true');
        }

        $('input[name="CBO"]').on('change', function () {
            if ($('input[name="CBO"]').prop('checked')) {
                $('input[name="CBO0"]').removeAttr("disabled");
                $('input[name="CBO1"]').removeAttr("disabled");
                $('input[name="CBO2"]').removeAttr("disabled");
             	$("#CBODATA").show();
            } else {
                $('input[name="CBO0"]').prop('disabled', 'true');
                $('input[name="CBO1"]').prop('disabled', 'true');
                $('input[name="CBO2"]').prop('disabled', 'true');
             	$("#CBODATA").hide();
            }
        });

//        for (var i = 0; i < 64; i++) {
//            $("select[name='lapTimerTransponderId']").append("<option value='" + i + "'>" + ((i == 0) ? '--' : i) + "</option>");
//        }

        $("select[name='vtxChannel']").val(data['vtxChannel']);

        $('input[name="NFE0"]').removeAttr("disabled");
        $('input[name="NFCF0"]').removeAttr("disabled");
        $('input[name="NFCO0"]').removeAttr("disabled");
        $('input[name="NFE1"]').removeAttr("disabled");
        $('input[name="NFCF1"]').removeAttr("disabled");
        $('input[name="NFCO1"]').removeAttr("disabled");
        $('input[name="YCF"]').removeAttr("disabled");

        if (data['NFE'][0] == 1) {
            $('input[name="NFE0"]').prop('checked', 1);
            $('input[name="NFCF0"]').removeAttr("disabled");
            $('input[name="NFCO0"]').removeAttr("disabled");
        } else {
            $('input[name="NFCF0"]').prop("disabled", true);
            $('input[name="NFCO0"]').prop("disabled", true);
        }
        if (data['NFE'][1] == 1) {
            $('input[name="NFE1"]').prop('checked', 1);
            $('input[name="NFCF1"]').removeAttr("disabled");
            $('input[name="NFCO1"]').removeAttr("disabled");
        } else {
            $('input[name="NFCF1"]').prop("disabled", true);
            $('input[name="NFCO1"]').prop("disabled", true);
        }

        $('input[name="NFCF0"]').val(data['NFCF'][0]);
        $('input[name="NFCO0"]').val(data['NFCO'][0]);
        $('input[name="NFCF1"]').val(data['NFCF'][1]);
        $('input[name="NFCO1"]').val(data['NFCO'][1]);

        $('input[name="NFE0"]').on("change", function () {
            if ($('input[name="NFE0"]').prop('checked')) {
                $('input[name="NFCF0"]').removeAttr("disabled");
                $('input[name="NFCO0"]').removeAttr("disabled");
            } else {
                $('input[name="NFCF0"]').prop("disabled", true);
                $('input[name="NFCO0"]').prop("disabled", true);
            }
        });

        $('input[name="NFE1"]').on("change", function () {
            if ($('input[name="NFE1"]').prop('checked')) {
                $('input[name="NFCF1"]').removeAttr("disabled");
                $('input[name="NFCO1"]').removeAttr("disabled");
            } else {
                $('input[name="NFCF1"]').prop("disabled", true);
                $('input[name="NFCO1"]').prop("disabled", true);
            }
        });

        if (data['YawCfilter']) $('input[name="YCF"]').val(data['YawCfilter']);

        $("#dialogSerial").hide(); // hide dialog by default


        if (data['ver'] >= 109) {
            if (data['ver'] >= 114) {
                $("#loopD").remove() // remove looptime on >=114
            } else {
                kissProtocol.send(kissProtocol.GET_INFO, [kissProtocol.GET_INFO], function () {
                    var info = kissProtocol.data[kissProtocol.GET_INFO];
                    var FCinfo = info.firmvareVersion.split(/-/g);
                    if ((info.firmvareVersion.indexOf("KISSFC") != -1 && FCinfo[0].length < 7) || (info.firmvareVersion.indexOf("KISSCC") != -1 && FCinfo[0].length < 7)) {
                        $("select[name='loopTimeDivider'] option[value='8']").remove();
                    }
                });

                $('select[name="loopTimeDivider"]').val(data['loopTimeDivider']);
                $('select[name="loopTimeDivider"]').removeAttr("disabled");
                if (data['loopTimeDivider'] != 1) {
                    $('input[name="adaptiveFilter"]').prop('checked', 0);
                    $('input[name="adaptiveFilter"]').prop("disabled", true);
                } else {
                    $('input[name="adaptiveFilter"]').removeAttr("disabled");
                }

                $('select[name="loopTimeDivider"]').on("change", function () {
                    if ($(this).val() != 1) {
                        $('input[name="adaptiveFilter"]').prop('checked', 0);
                        $('input[name="adaptiveFilter"]').prop("disabled", true);
                    } else {
                        $('input[name="adaptiveFilter"]').removeAttr("disabled");
                    }
                });

            }
            $('select[name="yawlpf"]').removeAttr("disabled");
            $('select[name="yawlpf"]').val(data['yawLpF']);
            $('select[name="mainlpf"]').removeAttr("disabled");
            $('select[name="mainlpf"]').val(data['LPF']);
            $('select[name="Dlpf"]').removeAttr("disabled");
            $('select[name="Dlpf"]').val(data['DLpF']);
        }

        $('select[name="lapTimerTypeAndInterface"]').on("change", function () {
            if ($(this).val() == 0)
                $("select[name='lapTimerTransponderId']").hide();
            else
                $("select[name='lapTimerTransponderId']").show();
        });
        

        if (data['ver'] >= 129) {
        	$('select[name="ccPadMode"]').val(data['ccPadMode']);

        	$('select[name="ccPadMode"]').on("change", function () {
        		if ($(this).val() == 0)
        			$("#currentSensorDivider").hide();
        		else
        			$("#currentSensorDivider").show();
        	});
        }
        
        if (data.CopterType > 3) {
            if (data.lapTimerTypeAndInterface == 18 || data.lapTimerTypeAndInterface == 19) {
                data.lapTimerTypeAndInterface = 0;
            }
            $("select[name='lapTimerTypeAndInterface'] option[value='18']").remove();
            $("select[name='lapTimerTypeAndInterface'] option[value='19']").remove();
        }

        // Implementation of enhanced serial ports
        if (data['ver'] >= 116) {
            $('#serialnew').css('display', 'inline-block'); //unhide serial section
            $('input[name="CSC"]').removeAttr("disabled"); //make checkbox changeable
            $("select[name='loggerConfig'] option[value='0']").html("disabled"); // remove logger option 0

            var serialsFunctions = []; //initialize serial array
            var defaultSerialConfig;
            readSerials(); // read serial from data and populate array

            // Check for default and either reset or show
            kissProtocol.send(kissProtocol.GET_INFO, [kissProtocol.GET_INFO], function () {
                var info = kissProtocol.data[kissProtocol.GET_INFO];
                defaultSerialConfig = info.defaultSerialConfig;

                if (data['SerialSetup'] == 0) {
                    data['SerialSetup'] = defaultSerialConfig;
                    contentChange();
                }

                if (defaultSerialConfig != data['SerialSetup']) {
                    $('input[name="CSC"]').prop('checked', 1);
                    populateSerialFields();
                }
            });

            
            if (data['ver'] >= 121) {
                // set osd data
                var osdConfig = +data['osdConfig'];
                // crosshair
                if ((osdConfig & 256) == 256) $('input[name="djiCrosshair"]').prop('checked', 1);
                if ((osdConfig & 512) == 512) $('input[name="djiGPS"]').prop('checked', 1);
                if ((osdConfig & 1024) == 1024) $("select[name='djiUnits']").val(1); else $("select[name='djiUnits']").val(0);
                $("select[name='djiLayout']").val(osdConfig & 7);
                // check do we have msp enabled or not
                $("#serial,#rth,#gps,#rthaltsource").hide();
                for (i = 0; i < serialsFunctions.length; i++) {
                    if (serialsFunctions[i] == 8) {
                        $("#djiosd").show();
                    }
                    if (serialsFunctions[i] == 1) {
                        $("#serial,#loggerDebug").show();
                    }
                    if (serialsFunctions[i] == 7) {
                    	$("#rth").show();
                    	if (data['ver']>=129) {
                    		$("#gps,#rthaltsource").show()
                    	}
                    }
                }
            }

            if (data['ver'] >= 122) {
//                $("#rth").show()
                $('input[name="rthReturnAltitude"]').val(+data['rthReturnAltitude']);
                $('input[name="rthHomeAltitude"]').val(+data['rthHomeAltitude']);
                $('input[name="rthDescentRadius"]').val(+data['rthDescentRadius']);
                $('input[name="rthHoverThrottle"]').val(+data['rthHoverThrottle']);
                $('input[name="rthMaxThrottle"]').val(+data['rthMaxThrottle']);
                $('input[name="rthMinThrottle"]').val(+data['rthMinThrottle']);
                $('input[name="rthReturnSpeed"]').val(+data['rthReturnSpeed']);

                if (data['ver'] >= 126) {
                    $('select[name="rthHomeAction"]').val(data['rthHomeAction'] & 0x07);
                    if ((data['rthHomeAction'] >> 7) == 1) $('input[name="rtfFailsafeAction"]').prop('checked', 1);
                } else {
                    $('select[name="rthHomeAction"]').val(+data['rthHomeAction']);
                    $("#rthfailsafe").hide();
                }
            }

            if (data['ver'] >= 125) {
                // remove Laptimer
                $('#lapTimer').hide();
            }
            
            if (data['ver'] >= 129) {
            	$('input[name="CDR"]').removeAttr("disabled"); //make checkbox changeable
            	$('select[name="loggerSpeed"]').val(data['loggerSpeed']);
            	 
            	$('input[name="brakingFactor"]').removeAttr("disabled");
                $('input[name="brakingFactor"]').val(data['brakingFactor']);
            	$('#brakingFactor').show();
            	$("#analogCurrent").show();
            	$('select[name="tzIndex"]').val(data['tzIndex']);
            	$('select[name="gpsprotocol"]').val((+data['gpsOptions'] >> 0) & 1);
            	$('select[name="rthaltsource"]').val((+data['gpsOptions'] >> 1) & 1);
            	$('select[name="loggerSpeed"]').val(data['loggerSpeed']);
            } else {
            	$('#brakingFactor').hide();
            	$("#loggerSpeed").hide();
            	$("#analogCurrent").hide();
            }

          
            // Function for CSC changebox changes
            $('input[name="CSC"]').on('change', function () {
                if ($('input[name="CSC"]').prop('checked') ? 1 : 0 == 1) {
                    populateSerialFields();
                    $("#newserial").show();
                    $("#serialDisclaimer").show();
                } else {
                    data['SerialSetup'] = defaultSerialConfig; // reset to default
                    $("#newserial").hide();
                    contentChange();
                }

            });
            
            if (data['ver'] >= 129) {
            	
            	var changed = false;
            	for (var i=0; i<8; i++) {
            		if (i != data['dshotMapping'][i]) {
            			changed = true;
            		}
            		$("select[name='ds"+(i+1)+"']").val(data['dshotMapping'][i]);
            	}

            	if (changed) {
            		$('input[name="CDR"]').prop('checked', 1);
            		$("#drouter").show();
            	} else {
            		$('input[name="CDR"]').prop('checked', 0);
            		$("#drouter").hide();
            	}
            } else {
            	$("#dshotRouter").hide();
            }

            
            if (data['ver'] >= 131) {
            	$("#limits").show();
                $('input[name="altLimit"]').val(+data['altLimit']);
            }
            
            if (data['ver'] >= 133) {
            	$("#adjustments").show();
                $('select[name="voltageSensorOffset"]').val(+data['voltageSensorOffset']);
            }
            
            // Function for CDR changebox changes
            $('input[name="CDR"]').on('change', function () {
                if ($('input[name="CDR"]').prop('checked') ? 1 : 0 == 1) {
                    //populateSerialFields();
                    $("#drouter").show();
                    $("#dshotDisclaimer").show();
                } else {
                	for (var i=0; i<8; i++) {
                		$("select[name='ds"+(i+1)+"']").val(i);
                	}
                    $("#drouter").hide();
                    contentChange();
                }

            });
            
            function populateSerialFields() {
                for (i = 0; i < serialsFunctions.length; i++) {
                    $("#serial" + i).kissSerial({
                        name: $.i18n("title.serial") + ' ' + i,
                        change: function () { updateSerials(); },
                        value: serialsFunctions[i],
                        version: data['ver']
                    });
                }

                // check if we have non crossfire receiver,
                // if so, remove receivers from all but 2 and 
                // disable ser2 change
                if (+data['RXType'] != 17) {
                	  for (i = 0; i < serialsFunctions.length; i++) {
                		  if (i != 2) {
                			  $("#serial" + i + " select option[value='2']").remove();
                		  } else {
                			  $("#serial2 select").prop("disabled", true);
                		  }
                	  }
                }
                
                if (data.lipoConnected == 1) {
                    $(".unsafe").addClass("unsafe_active");
                } else {
                    $(".unsafe").removeClass("unsafe_active");
                }
                $(".unsafe_active").prop('disabled', true);
            }
            function readSerials() {
                for (i = 0; i < 8; i++) {
                    serialsFunctions[i] = (data['SerialSetup'] >> (28 - (i * 4))) & 0x0F;
                }
            }
            function updateSerials() {
                serialsFunctions = []; // reset array
                data['SerialSetup'] = 0; // reset serialsetup
                var bitShiftCounter = 28;
                var foundDJI = false;
                var foundLogger = false;
                var foundGPS = false;
                for (i = 0; i < 8; i++) {
                    // update serialFunctions
                    serialsFunctions[i] = $("#serial" + i).kissSerial('value');
                    // update SerialSetup
                    data['SerialSetup'] += serialsFunctions[i] << bitShiftCounter;
                    bitShiftCounter -= 4;
                    // Set Logger to 100% if disabled but logger is set at least one serial
                    if (serialsFunctions[i] == 1) {
                    	foundLogger = true;
                        if ($('select[name="loggerConfig"]').val() == 0)
                            $('select[name="loggerConfig"]').val(10);
                    }
                    if (serialsFunctions[i] == 8) {
                        foundDJI = true;
                    }
                    if (serialsFunctions[i] == 7) {
                        foundGPS = true;
                    }
                }
                if (foundDJI) $("#djiosd").show(); else $("#djiosd").hide();
                if (foundLogger) $("#serial").show(); else $("#serial").hide();
                if (foundGPS) {
                	$("#rth").show();
                	if (data['ver']>=129) {
                		$("#gps,#rthaltsource").show();
                	}
                } else {
                	$("#rth,#gps,#rthaltsource").hide();
                }
                contentChange();
            }
        }

        var MCUid = '';
        for (var i = 0; i < 4; i++) {
            if (data['SN'][i] < 16)
                MCUid += '0';
            MCUid += data['SN'][i].toString(16).toUpperCase();
        }
        MCUid += '-';
        for (var i = 4; i < 8; i++) {
            if (data['SN'][i] < 16)
                MCUid += '0';
            MCUid += data['SN'][i].toString(16).toUpperCase();
        }
        MCUid += '-';
        var SSID = 'KISS-';
        for (var i = 8; i < 12; i++) {
            if (data['SN'][i] < 16) {
                MCUid += '0';
                SSID += '0'
            }
            MCUid += data['SN'][i].toString(16).toUpperCase();
            SSID += data['SN'][i].toString(16).toUpperCase();
        }

        $(".ssid").text(SSID);
        $('select[name="lapTimerTransponderId"]').val(data.lapTimerTransponderId);
        $('select[name="lapTimerTypeAndInterface"]').val(data.lapTimerTypeAndInterface);

        if (data.lapTimerTypeAndInterface == 0) {
            $("select[name='lapTimerTransponderId']").hide();
        } else {
            $("select[name='lapTimerTransponderId']").show();
        }

        $('select[name="loggerDebugVariables"]').val(data['loggerDebugVariables']);


        $('input[name="vbatAlarm"]').val(data['vbatAlarm']);

        $('#colorPicker').minicolors({
            format: 'rgb',
            change: function (value, opacity) {
                var rgb = value.slice(4, -1).replace(/\s+/g, '');
                var found = false;
                $('select[name="RGBSelector"] > option').each(function () {
                    if (this.value == rgb) {
                        $('select[name="RGBSelector"]').val(this.value);
                        found = true;
                    }
                });
                if (!found)
                    $('select[name="RGBSelector"]').val('');
                $('input[name="RGB"]').val(rgb);
            },
            hide: function () {

            },
            show: function () {

            }
        });
        var rgb = data['RGB'][0] + ',' + data['RGB'][1] + ',' + data['RGB'][2];
        $('input[name="RGB"]').val(rgb);
        $('#colorPicker').minicolors('value', {
            color: 'rgb(' + rgb + ')',
            opacity: 1,
            position: 'bottom right'
        });
        $('select[name="RGBSelector"] > option').each(function () {
            if (this.value == rgb) {
                $('select[name="RGBSelector"]').val(this.value);
            }
        });
        $('select[name="RGBSelector"]').removeAttr("disabled");

        if (data['vtxType'] == 0) {
            $(".vtx_opts").hide();
        } else {
            $(".vtx_opts").show();
        }


        $('select[name="RGBSelector"]').on('change', function () {
            if (this.value !== '') {
                $('input[name="RGB"]').val(this.value);
            } else {
                // custom
                $('input[name="RGB"]').val('10,20,30');
            }
            var rgb = $('input[name="RGB"]').val();
            $('#colorPicker').minicolors('value', {
                color: 'rgb(' + rgb + ')',
                opacity: 1
            });
        });

        $('select[name="vtxType"]').on('change', function () {
            if (this.value == "0") {
                $(".vtx_opts").hide();
                if (data['ver'] == 108) {
                    if ($("#loggerConfig").val() == "11") {
                        $("#loggerConfig").val("0").trigger("change");
                    }
                }
            } else {
                if (data['ver'] == 108) {
                    if (this.value == "2") {
                        $("#loggerConfig").val("11").trigger("change");
                    } else {
                        $("#loggerConfig").val("0").trigger("change");
                    }
                }
                $(".vtx_opts").show();
            }
        });

        if (data.lipoConnected == 1) {
            $(".unsafe").addClass("unsafe_active");
        } else {
            $(".unsafe").removeClass("unsafe_active");
        }
        $(".unsafe_active").prop('disabled', true);

        $("input,select").on("change", function () {
            contentChange();
        });

        settingsFilled = 1;


        function grabData() {
            data['BoardRotation'] = 0;
            if ($('input[name="CBO"]').prop('checked') ? 1 : 0 == 1) {
                data['CBO'][0] = parseInt($('input[name="CBO0"]').val());
                data['CBO'][1] = parseInt($('input[name="CBO1"]').val());
                data['CBO'][2] = parseInt($('input[name="CBO2"]').val());
            } else {
                data['CBO'] = [0, 0, 0];
            }

            data['lapTimerTypeAndInterface'] = parseInt($('select[name="lapTimerTypeAndInterface"]').val());
            data['lapTimerTransponderId'] = parseInt($('select[name="lapTimerTransponderId"]').val());
            data['loggerDebugVariables'] = parseInt($('select[name="loggerDebugVariables"]').val());
            data['loggerConfig'] = parseInt($('select[name="loggerConfig"]').val());

            var rgb = $('input[name="RGB"]').val();
            if (rgb == '')
                rgb = '0,0,0';
            var rgbArray = rgb.split(',');
            data['RGB'][0] = parseInt(rgbArray[0]);
            data['RGB'][1] = parseInt(rgbArray[1]);
            data['RGB'][2] = parseInt(rgbArray[2]);

            data['vbatAlarm'] = parseFloat($('input[name="vbatAlarm"]').val());

            data['NFE'][0] = $('input[name="NFE0"]').prop('checked') ? 1 : 0;
            data['NFCF'][0] = $('input[name="NFCF0"]').val();
            data['NFCO'][0] = $('input[name="NFCO0"]').val();
            data['NFE'][1] = $('input[name="NFE1"]').prop('checked') ? 1 : 0;
            data['NFCF'][1] = $('input[name="NFCF1"]').val();
            data['NFCO'][1] = $('input[name="NFCO1"]').val();

            data['YawCfilter'] = $('input[name="YCF"]').val();
            data['vtxType'] = parseInt($('select[name="vtxType"]').val());
            data['vtxPowerLow'] = $('input[name="vtxPowerLow"]').val();
            data['vtxPowerHigh'] = $('input[name="vtxPowerHigh"]').val();
            data['vtxChannel'] = parseInt($('select[name="vtxChannel"]').val());

            data['mahAlarm'] = parseInt($('input[name="mahAlarm"]').val());

            data['DB'][0] = parseInt($('input[name="DB0"]').val());
            data['DB'][1] = parseInt($('input[name="DB1"]').val());
            data['DB'][2] = parseInt($('input[name="DB2"]').val());

            data['loopTimeDivider'] = parseInt($('select[name="loopTimeDivider"]').val());
            data['yawLpF'] = parseInt($('select[name="yawlpf"]').val());
            data['DLpF'] = parseInt($('select[name="Dlpf"]').val());
            data['LPF'] = parseInt($('select[name="mainlpf"]').val());
            data['setpointIntoD'] = parseInt($('input[name="SID"]').val());

            if ($('input[name="motorBuzzer"]').prop('checked') ? 1 : 0 == 1) {
                data['motorBuzzer'] = 1;
            } else {
                data['motorBuzzer'] = 0;
            }

            if ($('input[name="reverseMotors"]').prop('checked') ? 1 : 0 == 1) {
                data['reverseMotors'] = 1;
            } else {
                data['reverseMotors'] = 0;
            }

            if ($('input[name="adaptiveFilter"]').prop('checked') ? 1 : 0 == 1) {
                data['adaptiveFilter'] = 1;
            } else {
                data['adaptiveFilter'] = 0;
            }

            if ($('input[name="launchMode"]').prop('checked') ? 1 : 0 == 1) {
                data['launchMode'] = 1;
            } else {
                data['launchMode'] = 0;
            }

            data['ledBrightness'] = +$('input[name="ledBrightness"]').val();

            var osdConfig = $("select[name='djiLayout']").val() & 7;
            if ($('input[name="djiCrosshair"]').prop('checked') ? 1 : 0 == 1) osdConfig |= 256;
            if ($('input[name="djiGPS"]').prop('checked') ? 1 : 0 == 1) osdConfig |= 512;
            if (+$("select[name='djiUnits']").val() == 1) osdConfig |= 1024;

            console.log("Set osd config: " + osdConfig);

            data['osdConfig'] = osdConfig;

            // RTH
            data['rthReturnAltitude'] = +$('input[name="rthReturnAltitude"]').val();
            data['rthHomeAltitude'] = +$('input[name="rthHomeAltitude"]').val();
            data['rthDescentRadius'] = +$('input[name="rthDescentRadius"]').val();
            data['rthHoverThrottle'] = +$('input[name="rthHoverThrottle"]').val();
            data['rthMaxThrottle'] = +$('input[name="rthMaxThrottle"]').val();
            data['rthMinThrottle'] = +$('input[name="rthMinThrottle"]').val();
            data['rthReturnSpeed'] = +$('input[name="rthReturnSpeed"]').val();

            var rthAction = $('select[name="rthHomeAction"]').val();
            if (($('input[name="rtfFailsafeAction"]').prop('checked') ? 1 : 0 == 1) && data['ver'] >= 126) {
                rthAction |= 128;
            }

            console.log("Set rthHomeAction: " + rthAction);

            data['rthHomeAction'] = rthAction;

            
            if (data['ver'] >= 129) {
            	data['tzIndex'] = $('select[name="tzIndex"]').val();
            	data['gpsOptions'] = 0;
            	data['gpsOptions']  |= (+$('select[name="gpsprotocol"]').val() << 0);
            	data['gpsOptions']  |= (+$('select[name="rthaltsource"]').val() << 1);

            	data['brakingFactor'] = parseInt($('input[name="brakingFactor"]').val());
            	data['loggerSpeed'] = parseInt($('select[name="loggerSpeed"]').val());

            	data['currentSensorDivider'] = $('input[name="currentSensorDivider"]').val();
            	data['ccPadMode'] = $('select[name="ccPadMode"]').val();
            	data['mspCanvas'] = $('select[name="mspCanvas"]').val();

            	for (var i=0; i<8; i++) {
            		data['dshotMapping'][i] = $("select[name='ds"+(i+1)+"']").val();
            	}
            }
            
            if (data['ver'] >= 131) {
            	data['altLimit'] = +$("input[name='altLimit']").val();
            }
            
            if (data['ver'] >= 133) {
            	data['voltageSensorOffset'] = +$("select[name='voltageSensorOffset']").val();
            }
        }

        function contentChange() {
            $('#save').removeAttr("data-i18n");
            $('#save').attr('data-i18n', 'button.save');
            $('#save').text($.i18n("button.save"));
            if (settingsFilled) {
                $('#save').addClass("saveAct");

            }
        }

        if (!data['isActive']) {
            $.ajax({
                url: 'http://ultraesc.de/KISSFC/getActivation/index.php?SN=' + MCUid + '&VER=' + data['ver'],
                cache: false,
                dataType: "text",
                success: function (key) {
                    console.log('Got activation code ' + key);
                    data['actKey'] = parseInt(key);
                },
                error: function () {
                    console.log('getting activation code failed');
                    data['actKey'] = 0;
                }

            });
        }

        $('#save').on('click', function () {
            grabData();
            $('#save').removeClass("saveAct");
            $('#save').html($.i18n("button.saving"));
            kissProtocol.send(kissProtocol.SET_SETTINGS, kissProtocol.preparePacket(kissProtocol.SET_SETTINGS, kissProtocol.data[kissProtocol.GET_SETTINGS]));
            kissProtocol.send(kissProtocol.GET_SETTINGS, [kissProtocol.GET_SETTINGS], function () {
                GUI.load("./content/advanced.html", function () {
                    htmlLoaded(kissProtocol.data[kissProtocol.GET_SETTINGS]);
                    $('#save').removeAttr("data-i18n");
                    $('#save').attr('data-i18n', 'button.saved');

                });
            });

        });
        
        scrollTop();

    }
};

CONTENT.advanced.cleanup = function (callback) {
    if (callback)
        callback();
};
