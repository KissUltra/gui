'use strict';

/*
    I am using a 9ms timeout timer to protect from GUI reading / reacting to any data sent after status byte 2 arrives.
    The exact time should be 10ms, but consider that everything in js is asynchronous and the serial API will also create
    some delay, i think 9ms is a reasonable value to use.

    It might be worth nothing that there might be need for a special "enter" routine since after the serial connection
    is opened the protocol expects to receive the 1 status byte, if we are in a middle of transmission after status byte 2
    which we missed, this might create some problems.
*/

var usedVersion = 0;
var kissProtocol = {
    SET_SETTINGS: 0x10,
    MOTOR_TEST: 0x11,
    SET_ESC_SETTINGS: 0x12,
    GET_TELEMETRY_V2: 0x13,

    GET_TELEMETRY: 0x20,
    GET_INFO: 0x21,
    ESC_INFO: 0x22,
    GET_SETTINGS: 0x30,
    ESC_FLASHER: 0x41,
    GET_PIDS: 0x43,
    SET_PIDS: 0x44,
    GET_VTX: 0x45,
    SET_VTX: 0x46,
    GET_FILTERS: 0x47,
    SET_FILTERS: 0x48,
    GET_ALARM: 0x49,
    SET_ALARM: 0x4A,
    GET_TPA: 0x4B,
    SET_TPA: 0x4C,
    GET_RATES: 0x4D,
    SET_RATES: 0x4E,

    RDP_RESET: 0x4F,
    EMPTY_BUFFER: 0x51,
    GET_DSETPOINT: 0x52,
    SET_DSETPOINT: 0x53,

    GET_GPS: 0x54,
    SET_GPS: 0x55,
    GET_FFT_GRAPH: 0x56,
    GET_GYRO_GRAPH: 0x57,
    SET_TLM_PASSTHROUGH: 0x58,
    SET_GPS_PASSTHROUGH: 0x59,
    SET_CAM_PASSTHROUGH: 0x60,

    JOINED_REQUEST: 0x66,
    SCHEDULE_REQUEST: 0x67,
    GET_RGB_LED: 0x68,
    SET_RGB_LED: 0x69,

	GET_RTH_SETTINGS: 0x70,
	SET_RTH_SETTINGS: 0x71,

	GET_HOME_INFO: 0x72,
	
	GET_OSD: 0x7F,
	GET_HARDWARE_INFO: 0x75,
	GET_OSD_CONFIG: 0x76, // chunked
	SET_OSD_CONFIG: 0x77, // chunked

    block: false,
    ready: false,
    receiving: false,
    state: 0,
    packetLength: 0,
    packetBuffer: null,
    packetBufferU8: null,
    packetBytesReceived: 0,
    packetCrc: 0,
    packetCrc2: 0,
    packetCrcCounter: 0,
    processingRequest: null,
    data: [],
    requests: [],
    errCase: 0,
    RequestInterval: 0,
    ReceiveTimeout: 0,
};

kissProtocol.read = function (readInfo) {
    var self = this;
    var data = new Uint8Array(readInfo.data);
    var dataLength = data.length;
    for (var i = 0; i < dataLength; i++) {
        if (this.block) continue; // skip any data until the timeout expires

        if (this.receiving) {
            switch (this.state) {
                case 0:
                    // wait for start byte
                    if ((data[i] == 5) || (data[i] == kissProtocol.GET_GPS) || (data[i] == kissProtocol.GET_HARDWARE_INFO) || (data[i] == kissProtocol.GET_HOME_INFO) || (data[i] == kissProtocol.GET_OSD) || (data[i] == kissProtocol.GET_OSD_CONFIG)|| (data[i] == kissProtocol.SET_OSD_CONFIG)) this.state++;
                    else this.state = 0;
                    this.errCase++;
                    if (this.errCase > 3) {
                        this.receiving = false;
                        this.errCase = 0;
                        this.state = 0;
                        //console.loglog('kissProtocol: reset errCase');
                    }
                    break;
                case 1:
                    // amount of bytes, reset variables to default state and prepare buffers
                    this.packetLength = data[i];
                    this.packetBuffer = new ArrayBuffer(this.packetLength);
                    this.packetBufferU8 = new Uint8Array(this.packetBuffer);
                    this.packetBytesReceived = 0;
                    this.packetCrc = 0;
                    this.packetCrcCounter = 0;
                    this.packetCrc2 = 0;
                    this.state++;
                    break;
                case 2:
                    // save received data in buffer and increase crc
                    this.packetBufferU8[this.packetBytesReceived] = data[i];
                    this.packetBytesReceived++;
                    this.packetCrc += data[i];

                    this.packetCrc2 ^= data[i];
                    for (var j = 0; j < 8; j++) {
                        if ((this.packetCrc2 & 0x80) != 0) {
                            this.packetCrc2 = ((this.packetCrc2 << 1) ^ 0xD5) & 0xFF;
                        } else {
                            this.packetCrc2 <<= 1;
                        }
                    }

                    this.packetCrcCounter++;

                    if (this.packetBytesReceived >= this.packetLength) this.state++;
                    break;
                case 3:
                    // calculate crc, if crc matches -> process data, otherwise log an crc error
                    //console.log("Calculated crc: " + (Math.floor(this.packetCrc / this.packetCrcCounter)) + " real: " + data[i] + " crc2: " + this.packetCrc2);

                    if ((Math.floor(this.packetCrc / this.packetCrcCounter) == data[i]) || (this.packetCrc2 == data[i])) {
                        if (this.data[this.processingRequest.code]) {
                            this.data[this.processingRequest.code]['buffer'] = this.packetBuffer;
                            this.data[this.processingRequest.code]['callback'] = this.processingRequest.callback;
                        } else {
                            this.data[this.processingRequest.code] = { 'buffer': this.packetBuffer, 'callback': this.processingRequest.callback };
                        }

                        this.processPacket(this.processingRequest.code, this.data[this.processingRequest.code]);
                    } else {
                        this.receiving = false;
                        this.state = 0;
                        console.log('kissProtocol: CRC Failed for last operation');
                        return;
                    }

                    this.requests.splice(0, 1);
                    this.receiving = false;
                    this.state = 0;
                    break;

                default:
                    console.log('Unknown state detected: ' + this.state);
            }
        }
    }
    kissProtocol.proceedRequest();
};

kissProtocol.send = function (code, data, callback) {
    //console.log("Sending code: " + code);
    //console.log("Sending data: " + data);
    var bufferOut = new ArrayBuffer(data.length);
    var bufferView = new Uint8Array(bufferOut);

    bufferView.set(data, 0);

    this.requests.push({
        'code': code,
        'buffer': bufferOut,
        'callback': (callback) ? callback : false
    });
    kissProtocol.proceedRequest();
};

kissProtocol.init = function () {
    console.log("Init");
    this.requests = [];
    this.receiving = false;
    if (this.RequestInterval != 0) window.clearInterval(this.RequestInterval);
    if (this.RequestTimeout != 0) window.clearTimeout(this.RequestTimeout);
    this.RequestInterval = 0;
    this.RequestTimeout = 0;
    this.ready = false;
}

kissProtocol.removeRequests = function (reqId) {
    this.requests = [];
    kissProtocol.proceedRequest();
}

kissProtocol.removePendingRequests = function () {
    this.requests = [];
}

kissProtocol.clearPendingRequests = function (callback) {
    if (this.requests.length > 0) {
        setTimeout(function () {
            kissProtocol.clearPendingRequests(callback);
        }, 100);
    } else {
        callback();
    }
}

kissProtocol.proceedRequest = function () {
   //console.log("process request: " + this.receiving);
    if (!this.receiving) {
        //console.log("Not receiving");

        this.ready = true;
        if (this.requests.length > 0) {
            this.receiving = true;
            this.errCase = 0;
            this.processingRequest = this.requests[0];
            //console.log("Got request to send");
            //console.log(this.processingRequest);
            serialDevice.send(this.processingRequest.buffer, function (sendInfo) {
//            	if ( this.processingRequest.callback)  {
//            		console.log("Calling callback");
//            		this.processingRequest.callback();
//            	}
                kissProtocol.proceedRequest();
            });

        }
        if (this.ReceiveTimeout != 0) {
            clearTimeout(this.ReceiveTimeout);
            this.ReceiveTimeout = 0;
        }
        this.ReceiveTimeout = window.setTimeout(function () {
            kissProtocol.receiving = false;
        }, 500);
    }
    if (this.RequestInterval == 0) {
        this.RequestInterval = window.setInterval(function () { kissProtocol.proceedRequest(); }, 10);
    }
}

kissProtocol.processPacket = function (code, obj) {
    var data = new DataView(obj.buffer, 0);
    
     switch (code) {
        case this.GET_TELEMETRY:
            if (!obj.RXcommands) {
                obj.RXcommands = [];
                obj.GyroXYZ = [];
                obj.ACCXYZ = [];
                obj.angle = [];
                obj.GyroRaw = [];
                obj.ACCRaw = [];
                obj.ACCtrim = [];
                obj.ACCAng = [];
                obj.PWMOutVals = [];
                obj.ESC_Telemetrie0 = [];
                obj.ESC_Telemetrie1 = [];
                obj.ESC_Telemetrie2 = [];
                obj.ESC_Telemetrie3 = [];
                obj.ESC_Telemetrie4 = [];
                obj.ESC_Telemetrie5 = [];
                	obj.ESC_Telemetrie6 = [];// TODO
                	obj.ESC_Telemetrie7 = [];// TODO
                obj.ESC_TelemetrieStats = [];
                obj.adaptiveFilter = 0;
                obj.RXStats = undefined;
            }

            obj.RXcommands[0] = 1000 + ((data.getInt16(0, 0) / 1000) * 1000);
            obj.RXcommands[1] = 1500 + ((data.getInt16(2, 0) / 1000) * 500);
            obj.RXcommands[2] = 1500 + ((data.getInt16(4, 0) / 1000) * 500);
            obj.RXcommands[3] = 1500 + ((data.getInt16(6, 0) / 1000) * 500);
            obj.RXcommands[4] = 1500 + ((data.getInt16(8, 0) / 1000) * 500);
            obj.RXcommands[5] = 1500 + ((data.getInt16(10, 0) / 1000) * 500);
            obj.RXcommands[6] = 1500 + ((data.getInt16(12, 0) / 1000) * 500);
            obj.RXcommands[7] = 1500 + ((data.getInt16(14, 0) / 1000) * 500);
            obj.Armed = data.getUint8(16);
            obj.LiPoVolt = data.getInt16(17, 0) / 1000;
            obj.GyroXYZ[0] = data.getInt16(19, 0);
            obj.GyroXYZ[1] = data.getInt16(21, 0);
            obj.GyroXYZ[2] = data.getInt16(23, 0);
            obj.ACCXYZ[0] = data.getInt16(25, 0);
            obj.ACCXYZ[1] = data.getInt16(27, 0);
            obj.ACCXYZ[2] = data.getInt16(29, 0);
            obj.angle[0] = data.getInt16(31, 0) / 1000;
            obj.angle[1] = data.getInt16(33, 0) / 1000;
            obj.angle[2] = data.getInt16(35, 0) / 1000;
            obj.I2C_Errors = data.getInt16(37, 0);
            obj.calibGyroDone = data.getInt16(39, 0);
            obj.failsave = data.getUint8(41);
            obj.debug = data.getUint16(42, 0) / 1000;
            obj.foundRX = data.getUint8(44);

            obj.GyroRaw[0] = data.getInt16(45, 0) / 1000;
            obj.GyroRaw[1] = data.getInt16(47, 0) / 1000;
            obj.GyroRaw[2] = data.getInt16(49, 0) / 1000;
            obj.ACCRaw[0] = data.getInt16(51, 0) / 1000;
            obj.ACCRaw[1] = data.getInt16(53, 0) / 1000;
            obj.ACCRaw[2] = data.getInt16(55, 0) / 1000;
            obj.ACCtrim[0] = data.getInt16(57, 0) / 1000;
            obj.ACCtrim[1] = data.getInt16(59, 0) / 1000;
            obj.ACCAng[0] = data.getInt16(61, 0) / 1000;
            obj.ACCAng[1] = data.getInt16(63, 0) / 1000;
            obj.mode = data.getUint8(65);
            obj.debug = data.getUint16(66, 0) / 1000;
            obj.PWMOutVals[0] = data.getInt16(68, 0);
            obj.PWMOutVals[1] = data.getInt16(70, 0);
            obj.PWMOutVals[2] = data.getInt16(72, 0);
            obj.PWMOutVals[3] = data.getInt16(74, 0);
            obj.PWMOutVals[4] = data.getInt16(76, 0);
            obj.PWMOutVals[5] = data.getInt16(78, 0);
            	
            obj.debug2 = data.getUint16(80, 0) / 1000;
            obj.idleTime = data.getUint8(82);

            obj.ESC_Telemetrie0[0] = data.getInt16(83, 0);
            obj.ESC_Telemetrie0[1] = data.getInt16(85, 0);
            obj.ESC_Telemetrie0[2] = data.getInt16(87, 0);
            obj.ESC_Telemetrie0[3] = data.getInt16(89, 0);
            obj.ESC_Telemetrie0[4] = data.getInt16(91, 0);

            obj.ESC_Telemetrie1[0] = data.getInt16(93, 0);
            obj.ESC_Telemetrie1[1] = data.getInt16(95, 0);
            obj.ESC_Telemetrie1[2] = data.getInt16(97, 0);
            obj.ESC_Telemetrie1[3] = data.getInt16(99, 0);
            obj.ESC_Telemetrie1[4] = data.getInt16(101, 0);

            obj.ESC_Telemetrie2[0] = data.getInt16(103, 0);
            obj.ESC_Telemetrie2[1] = data.getInt16(105, 0);
            obj.ESC_Telemetrie2[2] = data.getInt16(107, 0);
            obj.ESC_Telemetrie2[3] = data.getInt16(109, 0);
            obj.ESC_Telemetrie2[4] = data.getInt16(111, 0);

            obj.ESC_Telemetrie3[0] = data.getInt16(113, 0);
            obj.ESC_Telemetrie3[1] = data.getInt16(115, 0);
            obj.ESC_Telemetrie3[2] = data.getInt16(117, 0);
            obj.ESC_Telemetrie3[3] = data.getInt16(119, 0);
            obj.ESC_Telemetrie3[4] = data.getInt16(121, 0);

            obj.ESC_Telemetrie4[0] = data.getInt16(123, 0);
            obj.ESC_Telemetrie4[1] = data.getInt16(125, 0);
            obj.ESC_Telemetrie4[2] = data.getInt16(127, 0);
            obj.ESC_Telemetrie4[3] = data.getInt16(129, 0);
            obj.ESC_Telemetrie4[4] = data.getInt16(131, 0);

            obj.ESC_Telemetrie5[0] = data.getInt16(133, 0);
            obj.ESC_Telemetrie5[1] = data.getInt16(135, 0);
            obj.ESC_Telemetrie5[2] = data.getInt16(137, 0);
            obj.ESC_Telemetrie5[3] = data.getInt16(139, 0);
            obj.ESC_Telemetrie5[4] = data.getInt16(141, 0);
             
            	obj.ESC_Telemetrie6[0] = 0;// TODO
            	obj.ESC_Telemetrie6[1] = 0;// TODO
            	obj.ESC_Telemetrie6[2] = 0;// TODO
            	obj.ESC_Telemetrie6[3] = 0;// TODO
            	obj.ESC_Telemetrie6[4] = 0;// TODO
            	
            	obj.ESC_Telemetrie7[0] = 0;// TODO
            	obj.ESC_Telemetrie7[1] = 0;// TODO
            	obj.ESC_Telemetrie7[2] = 0;// TODO
            	obj.ESC_Telemetrie7[3] = 0;// TODO
            	obj.ESC_Telemetrie7[4] = 0;// TODO

            obj.ESC_TelemetrieStats[0] = data.getInt16(142, 0);
            obj.ESC_TelemetrieStats[1] = data.getInt16(144, 0);
            obj.ESC_TelemetrieStats[2] = data.getInt16(146, 0);
            obj.ESC_TelemetrieStats[3] = data.getInt16(148, 0);
            obj.ESC_TelemetrieStats[4] = data.getInt16(150, 0);
            obj.ESC_TelemetrieStats[5] = data.getInt16(152, 0);
            
            	obj.ESC_TelemetrieStats[6] = 0;// TODO
            	obj.ESC_TelemetrieStats[7] = 0;// TODO

            obj.RXcommands[8] = 1500 + ((data.getInt16(154, 0) / 1000) * 500);
            obj.RXcommands[9] = 1500 + ((data.getInt16(156, 0) / 1000) * 500);
            obj.RXcommands[10] = 1500 + ((data.getInt16(158, 0) / 1000) * 500);
            
            obj.RXStats = {
            		upRSSI1 : -data.getUint8(160, 0),
            		upRSSI2 : -data.getUint8(161, 0),
            		upLQ : data.getUint8(162, 0),
            		upSNR : data.getInt8(163, 0), 
            		upAntenna : data.getUint8(164, 0),
            		rfMode : data.getUint8(165, 0),
            		upTXPower : data.getUint8(166, 0),
            		downRSSI : -data.getUint8(167, 0),
            		downLQ : data.getUint8(168, 0),
            		downSNR : data.getInt8(169, 0)
            };
            
            obj.PWMOutVals[6] = data.getInt16(170, 0);
            obj.PWMOutVals[7] = data.getInt16(172, 0);
            
            // TODO: Add here extra ESC telemetry!
            
            break;
        case this.GET_SETTINGS:
            if (!obj.G_P) {
                obj.G_P = [];
                obj.G_I = [];
                obj.G_D = [];
                obj.ACCtrim = [];
                obj.RC_Rate = [];
                obj.RPY_Expo = [];
                obj.RPY_Curve = [];
                obj.ACCZero = [];
                obj.SN = [];
                obj.TPA = [];
                obj.RGB = [];
                obj.CBO = [];
                obj.AUX = [];
                obj.DB = [];
                obj.NFE = [];
                obj.NFCF = [];
                obj.NFCO = [];
                obj.ver = 0;
                obj.reverseMotors = 0;
                obj.launchMode = 0;
                obj.dshotMapping = [0, 1, 2, 3, 4, 5, 6, 7];
                obj.altLimit = 0;
            }

            obj.G_P[0] = data.getUint16(0, 0) / 1000;
            obj.G_P[1] = data.getUint16(2, 0) / 1000;
            obj.G_P[2] = data.getUint16(4, 0) / 1000;

            obj.G_I[0] = data.getUint16(6, 0) / 1000;
            obj.G_I[1] = data.getUint16(8, 0) / 1000;
            obj.G_I[2] = data.getUint16(10, 0) / 1000;

            obj.G_D[0] = data.getUint16(12, 0) / 1000;
            obj.G_D[1] = data.getUint16(14, 0) / 1000;
            obj.G_D[2] = data.getUint16(16, 0) / 1000;

            obj.A_P = data.getUint16(18, 0) / 1000;
            obj.A_I = data.getUint16(20, 0) / 1000;
            obj.A_D = data.getUint16(22, 0) / 1000;
            obj.ACCtrim[0] = data.getInt16(24, 0) / 1000;
            obj.ACCtrim[1] = data.getInt16(26, 0) / 1000;

            obj.RC_Rate[0] = data.getInt16(28, 0) / 1000;
            obj.RC_Rate[1] = data.getInt16(30, 0) / 1000;
            obj.RC_Rate[2] = data.getInt16(32, 0) / 1000;
            obj.RPY_Expo[0] = data.getInt16(34, 0) / 1000;
            obj.RPY_Expo[1] = data.getInt16(36, 0) / 1000;
            obj.RPY_Expo[2] = data.getInt16(38, 0) / 1000;
            obj.RPY_Curve[0] = data.getInt16(40, 0) / 1000;
            obj.RPY_Curve[1] = data.getInt16(42, 0) / 1000;
            obj.RPY_Curve[2] = data.getInt16(44, 0) / 1000;
            obj.ver = data.getUint8(92);
            usedVersion = obj.ver;


            try {

                obj.RXType = data.getInt16(46, 0);
                obj.PPMchanOrder = data.getInt16(48, 0);
                obj.CopterType = data.getInt16(50, 0);
                obj.Active3DMode = data.getInt16(52, 0);
                obj.ESConeshot125 = data.getInt16(54, 0);
                obj.MinCommand16 = data.getInt16(56, 0) + 1000;
                obj.MidCommand16 = data.getInt16(58, 0) + 1000;
                obj.MinThrottle16 = data.getInt16(60, 0) + 1000;
                obj.MaxThrottle16 = data.getInt16(62, 0) + 1000;
                obj.TYmid16 = data.getInt16(64, 0);
                obj.TYinv8 = data.getUint8(66, 0);
                obj.ACCZero[0] = data.getInt16(67, 0);
                obj.ACCZero[1] = data.getInt16(69, 0);
                obj.ACCZero[2] = data.getInt16(71, 0);
                obj.AUX[0] = data.getUint8(73);
                obj.AUX[1] = data.getUint8(74);
                obj.AUX[2] = data.getUint8(75);
                obj.AUX[3] = data.getUint8(76);
              
                obj.maxAng = data.getUint16(77) / 14.3;
                obj.LPF = data.getUint8(79);

                obj.SN[0] = data.getUint8(80);
                obj.SN[1] = data.getUint8(81);
                obj.SN[2] = data.getUint8(82);
                obj.SN[3] = data.getUint8(83);
                obj.SN[4] = data.getUint8(84);
                obj.SN[5] = data.getUint8(85);
                obj.SN[6] = data.getUint8(86);
                obj.SN[7] = data.getUint8(87);
                obj.SN[8] = data.getUint8(88);
                obj.SN[9] = data.getUint8(89);
                obj.SN[10] = data.getUint8(90);
                obj.SN[11] = data.getUint8(91);

                obj.TPA[0] = data.getUint16(93, 0) / 1000;
                obj.TPA[1] = data.getUint16(95, 0) / 1000;
                obj.TPA[2] = data.getUint16(97, 0) / 1000;
                                
                obj.failsaveseconds = data.getUint8(100);

                obj.BoardRotation = data.getUint8(101);
                obj.isActive = data.getUint8(102);
                obj.actKey = 0;

                obj.CustomTPAInfluence = data.getUint8(103);
                obj.TPABP1 = data.getUint8(104);
                obj.TPABP2 = data.getUint8(105);
                obj.TPABPI1 = data.getUint8(106);
                obj.TPABPI2 = data.getUint8(107);
                obj.TPABPI3 = data.getUint8(108);
                obj.TPABPI4 = data.getUint8(109);

                obj.BatteryInfluence = data.getUint8(110);
                obj.voltage1 = data.getInt16(111, 0) / 10;
                obj.voltage2 = data.getInt16(113, 0) / 10;
                obj.voltage3 = data.getInt16(115, 0) / 10;
                obj.voltgePercent1 = data.getUint8(117);
                obj.voltgePercent2 = data.getUint8(118);
                obj.voltgePercent3 = data.getUint8(119);

                obj.loggerConfig = 0;
                obj.vtxChannel = 32;
                obj.vbatAlarm = 0;
                obj.debugVariables = 0;
                obj.mahAlarm = 0;
                obj.lipoConnected = 0;

                obj.vtxChannel = data.getUint8(120);
                obj.loggerConfig = data.getUint8(121);
                obj.RGB[0] = data.getUint8(122);
                obj.RGB[1] = data.getUint8(123);
                obj.RGB[2] = data.getUint8(124);
                obj.vbatAlarm = data.getUint16(125, 0) / 10;

                obj.CBO[0] = data.getInt16(127, 0);
                obj.CBO[1] = data.getInt16(129, 0);
                obj.CBO[2] = data.getInt16(131, 0);

                obj.AUX[4] = data.getUint8(133);

                obj.lapTimerTypeAndInterface = data.getUint8(134);
                obj.lapTimerTransponderId = data.getUint16(135, 0);

                obj.loggerDebugVariables = data.getUint8(137);


                obj.NFE[0] = data.getUint8(138);
                obj.NFCF[0] = data.getUint16(139, 0);
                obj.NFCO[0] = data.getUint16(141, 0);

                obj.NFE[1] = data.getUint8(143);
                obj.NFCF[1] = data.getUint16(144, 0);
                obj.NFCO[1] = data.getUint16(146, 0);

                obj.YawCfilter = data.getUint8(148);

                obj.vtxType = data.getUint8(149);
                obj.vtxPowerLow = data.getUint16(150, 0);
                obj.vtxPowerHigh = data.getUint16(152, 0);
                obj.AUX[5] = data.getUint8(154);
                obj.AUX[6] = data.getUint8(155);
                obj.AUX[7] = data.getUint8(156);

                obj.mahAlarm = data.getUint16(157, 0);
                obj.lipoConnected = data.getUint8(159, 0);

                obj.DB[0] = data.getUint8(160, 0);
                obj.DB[1] = data.getUint8(161, 0);
                obj.DB[2] = data.getUint8(162, 0);

                obj.motorBuzzer = data.getUint8(163, 0);

                obj.loopTimeDivider = data.getUint8(164, 0);
                obj.yawLpF = data.getUint8(165, 0);
                obj.DLpF = data.getUint8(166, 0);
                obj.reverseMotors = data.getUint8(167, 0);
                obj.AUX[8] = data.getUint8(168, 0);
                obj.adaptiveFilter = data.getUint8(169, 0);
                obj.AUX[9] = data.getUint8(170, 0);
                obj.AUX[10] = data.getUint8(171, 0);
                obj.ledBrightness = data.getUint8(172, 0);
                obj.AUX[11] = data.getUint8(174, 0);
                obj.setpointIntoD = data.getUint8(175, 0); // DTerm Weight
                obj.ESCOutputLayout = 0;
                obj.ESCOutputLayout = data.getUint8(176, 0); // Custom ESC Orientation
                obj.SerialSetup = 0xFFFFFFFF;
                obj.SerialSetup = data.getUint32(177, 0);   // Serial mapping
                obj.AUX[12] = data.getUint8(181, 0); // realpit
                obj.launchMode = data.getUint8(182, 0); // launchmode
                obj.osdConfig = data.getUint16(183, 0); // DJI
                obj.AUX[13] = data.getUint8(185, 0); // RTH
                obj.rthReturnAltitude = data.getUint16(186, 0);
                obj.rthHomeAltitude = data.getUint16(188, 0);
                obj.rthDescentRadius = data.getUint16(190, 0);
                obj.rthHoverThrottle = data.getUint16(192, 0);
                obj.rthMaxThrottle = data.getUint16(194, 0);
                obj.rthMinThrottle = data.getUint16(196, 0);
                obj.rthHomeAction = data.getUint8(198, 0);
                obj.rthReturnSpeed = data.getUint8(199, 0);
                
                if (obj.ver >= 129) {
                	obj.dshotMapping[0] = data.getUint8(200, 0);
                	obj.dshotMapping[1] = data.getUint8(201, 0);
                	obj.dshotMapping[2] = data.getUint8(202, 0);
                	obj.dshotMapping[3] = data.getUint8(203, 0);
                	obj.dshotMapping[4] = data.getUint8(204, 0);
                	obj.dshotMapping[5] = data.getUint8(205, 0);
                	obj.dshotMapping[6] = data.getUint8(206, 0);
                	obj.dshotMapping[7] = data.getUint8(207, 0);
                	obj.loggerSpeed = data.getUint8(208, 0);
                	obj.ccPadMode = data.getUint8(209, 0);
                	obj.currentSensorDivider = data.getUint16(210, 0);
                	obj.mspCanvas = data.getUint8(212, 0);
                	obj.brakingFactor = data.getUint8(213, 0);
                	obj.gimbalPTMode = data.getUint8(214, 0);
                	obj.throttleScaling = data.getUint8(215, 0);
                	obj.tzIndex = data.getUint8(216, 0);
                	obj.gpsOptions = data.getUint8(217, 0);
                }
                
                if (obj.ver >= 131) {
                	obj.altLimit = data.getUint16(218, 0);
                }
                
                if (obj.ver >= 132) {
                	obj.AUX[14] = data.getUint8(220, 0); // PREARM
                }
                
                if (obj.ver >= 133) {
                	obj.voltageSensorOffset = data.getUint8(221, 0);
                }
                
                if (obj.ver >= 134) {
                	obj.prearm_mode = data.getUint8(222, 0);
                }
                
                console.log(obj);
                
                // ??? blen = 208;
                // next free 200
            } catch (Exception) {
                console.log("Exception while reading packet");
                console.log(Exception);
            }
            break;

        case this.SET_SETTINGS:
            console.log('Settings saved');
            break;
            
        case this.SET_OSD_CONFIG:
            console.log('OSD settings saved');
            break;

        case this.MOTOR_TEST:
            console.log('Motor test');
            break;

        case this.GET_INFO:
            var p = 0;
            obj.escInfo = [];
            obj.escInfoCount = 0;
            if (usedVersion >= 116)
                obj.defaultSerialConfig = 0;
            obj.firmvareVersion = kissProtocol.readString(data, p);
            p += obj.firmvareVersion.length + 1;

            if (p < data.byteLength) {
                // if we have data left
                obj.escInfoCount = data.getUint8(p++);
                for (var i = 0; i < obj.escInfoCount; i++) {
                    var info = { SN: '', version: 0, type: 'UNKNOWN ESC', Settings: [0, 0, 0, 0] };
                    var SN = [];
                    var CPUID = '';
                    for (var j = 0; j < 12; j++) SN[j] = data.getUint8(p++);

                    for (var r = 0; r < 4; r++) {
                        CPUID += ((SN[r] < 16) ? '0' : '') + SN[r].toString(16).toUpperCase();
                    }
                    CPUID += '-';
                    for (var r = 4; r < 8; r++) {
                        CPUID += ((SN[r] < 16) ? '0' : '') + SN[r].toString(16).toUpperCase();
                    }
                    CPUID += '-';
                    for (var r = 8; r < 12; r++) {
                        CPUID += ((SN[r] < 16) ? '0' : '') + SN[r].toString(16).toUpperCase();
                    }
                    info.SN = CPUID;
                    info.version = data.getUint8(p++) / 100;
                    var found = info.version != 0;
                    info.version += String.fromCharCode(data.getUint8(p++));
                    var type = +data.getUint8(p++);
                    if (type == 1) {
                        info.type = 'KISS 8A';
                    } else if (type == 2) {
                        info.type = 'KISS 16A';
                    } else if (type == 3) {
                        info.type = 'KISS 24A';
                    } else if (type == 5) {
                        info.type = 'KISS 24 Ultralite';
                    } else if (type == 7) {
                        info.type = 'KISS 32A';
                    } else if (type == 9) {
                        info.type = 'KISS 25A';
                    } else if (type == 20) {
                        info.type = 'KISS 50A';
                    } else if (type == 21) {
                        info.type = 'KISS MINI 40A';
                    } else {
                        info.type = 'ESC ID: ' + type;
                    }
                    if (data.byteLength / 6 > 15) { // check if we got the new protocol
                        for (var r = 0; r < 4; r++) info.Settings[r] = data.getUint8(p++);
                    }
                    if (!found) info = undefined;
                    obj.escInfo[i] = info;
                }
                if (usedVersion >= 116)
                    obj.defaultSerialConfig = data.getUint32(p++);
            }

            break;

        case this.ESC_INFO:
            break;
            
        case this.GET_GPS:
        	obj.latitude =  data.getInt32(0, 0) / 10000000;  
        	obj.longitude = data.getInt32(4, 0) / 10000000;
        	obj.speed = data.getUint16(8, 0) / 100;
        	obj.course = data.getUint16(10, 0) / 100;
        	obj.altitude =  data.getInt16(12, 0);
        	obj.satellites =  data.getUint8(14, 0) & 127;
        	obj.fix =  data.getUint8(14, 0) >> 7;        	
            break;
            
        case this.GET_HOME_INFO:
            obj.homeDistance =  data.getUint16(0, 0);
            obj.homeDirection = data.getUint16(2, 0);
            obj.homeRelativeAltitude = data.getUint16(4, 0);
            break;
            
        case this.GET_HARDWARE_INFO:
            obj.hardwareVersion =  data.getUint16(0, 0);
            obj.bootloaderVersion = data.getUint16(2, 0);
            break;
        	
        case this.SCHEDULE_REQUEST:
        	break;
        	
        case this.GET_OSD:
        	break;
        	
        case this.GET_OSD_CONFIG:
            try {
            	var chunk = data.getUint8(0, 0);
              	var chunksLeft = data.getUint8(1, 0);
              
              	obj.chunk = chunk;
              	obj.chunksLeft = chunksLeft;
              	
            	if (chunk == 0) {
            		console.log("Received first chunk, cleanup");
            	   	obj.chunkBuffer = new ArrayBuffer(1024); // should be enough for now
                	var chunkData = new DataView(obj.chunkBuffer, 0);
                	for (var i=0; i<1024; i++) {
                		chunkData.setUint8(i, 0);
                	}
                	obj.delayedCallback = obj.callback;
                	obj.callback = null;
            	}

            	var crcOk = false;
            	
            	if (obj.buffer.byteLength > 2) {
            		var chunkData = new DataView(obj.chunkBuffer, 0);
                	var idx = 200 * chunk; 
                	for (var i = 0; i<(obj.buffer.byteLength - 2); i++) {
                		chunkData.setUint8(i + idx, data.getUint8(2 + i, 0));
            		}
                	
                	if (chunksLeft == 0) {
                		var chunkData = new DataView(obj.chunkBuffer, 0);
                		var len = chunk  * 200 +  obj.buffer.byteLength - 2;
                		var crc1 = chunkData.getUint8(len - 1, 0);
                		var crc2 = 0;
                		for (var i=0; i<(len - 1); i++) {
                			crc2 = kissProtocol.updateCRC(crc2, chunkData.getUint8(i, 0));
                		}
                		if (crc1 == crc2) {
                			crcOk = true;
                		} else {
                    		console.log("CRC error: " + crc1 + " != " + crc2);
                		}
                	}
            	}	
            	            	
            	if (chunksLeft == 0) {

            		if (crcOk) {

            			// begin parsing
            			var chunkData = new DataView(obj.chunkBuffer, 0);
            			var p = 0;
            			obj.eepromVersion =  chunkData.getUint16(p, 0); p+=2;
            			obj.syncLevel =  chunkData.getUint16(p, 0); p+=2;
            			obj.blackLevel =  chunkData.getUint16(p, 0); p+=2;
            			obj.whiteLevel =  chunkData.getUint16(p, 0); p+=2;
            			obj.options1 =  chunkData.getUint8(p, 0); p+=1;
            			obj.options2 =  chunkData.getUint8(p, 0); p+=1;
            			obj.options3 =  chunkData.getUint8(p, 0); p+=1;
            			obj.callsign = "";
            			for (var i=0; i<16; i++) { obj.callsign += String.fromCharCode(chunkData.getUint8(p, 0)); p+=1; }
            			obj.ccRestVoltage = chunkData.getUint16(p, 0) / 1000; p+=2;
            			obj.ccLeftVoltage = chunkData.getUint16(p, 0) / 1000; p+=2;
            			obj.ccRightVoltage = chunkData.getUint16(p, 0) / 1000; p+=2;
            			obj.ccUpVoltage = chunkData.getUint16(p, 0) / 1000; p+=2;
            			obj.ccDownVoltage = chunkData.getUint16(p, 0) / 1000; p+=2;
            			obj.ccSelectVoltage = chunkData.getUint16(p, 0) / 1000; p+=2;
            			obj.hdFrameOptions = chunkData.getUint8(p, 0);  p+=1;
            			obj.hdFrameLeft = chunkData.getUint16(p, 0); p+=2;
            			obj.hdFrameTop = chunkData.getUint16(p, 0); p+=2;
            			obj.hdFrameRight = chunkData.getUint16(p, 0); p+=2;
            			obj.hdFrameBottom = chunkData.getUint16(p, 0); p+=2;
            			obj.rssiWarning = chunkData.getUint16(p, 0); p+=2;
            			obj.lqWarning = chunkData.getUint16(p, 0); p+=2;
            			obj.satWarning = chunkData.getUint16(p, 0); p+=2;
            			obj.altitudeWarning = chunkData.getUint16(p, 0); p+=2;
            			obj.snrWarning = chunkData.getUint16(p, 0); p+=2;
            			obj.currentWarning = chunkData.getUint16(p, 0); p+=2;
            			obj.lipoSize = chunkData.getUint16(p, 0); p+=2;
            			obj.lipoWarning = chunkData.getUint8(p, 0);  p+=1;
            			obj.cellWarning = chunkData.getUint16(p, 0) / 100; p+=2;
            		
            			obj.customLayout = [];

            			for (var i=0; i<28; i++) {
            				var sensor = {};
            				sensor.x =  chunkData.getUint16(p, 0); p+=2;
            				sensor.y =  chunkData.getUint16(p, 0); p+=2;
            				sensor.visible =  chunkData.getUint8(p, 0);  p+=1;
            				sensor.align =  chunkData.getUint8(p, 0);  p+=1;
            				sensor.font =  chunkData.getUint8(p, 0);  p+=1;
            				sensor.proportional =  chunkData.getUint8(p, 0);  p+=1;
            				sensor.style =  chunkData.getUint8(p, 0);  p+=1;
            				obj.customLayout.push(sensor);
            			}
            			
            			obj.stickOverlay = chunkData.getUint8(p, 0);  p+=1;

            			// end parsing
            			obj.callback = obj.delayedCallback;
            			delete obj.buffer;
            			delete obj.chunkBuffer;
            			delete obj.chunk;
            			delete obj.chunksLeft;
            			delete obj.delayedCallback;
            		} else {
            			var tmp = {
            					'buffer': new ArrayBuffer(1),
            					'chunk': 0
            			};
            			kissProtocol.send(kissProtocol.GET_OSD_CONFIG, kissProtocol.preparePacket(kissProtocol.GET_OSD_CONFIG, tmp), function () {
            				console.log("First chunk loaded");
            			});
            		}
            	} else {
            		var tmp = {
       					 'buffer': new ArrayBuffer(1),
       	                 'chunk': chunk + 1
            		};
            		kissProtocol.send(kissProtocol.GET_OSD_CONFIG, kissProtocol.preparePacket(kissProtocol.GET_OSD_CONFIG, tmp), function () {
            			console.log("Next chunk loaded");
            		});
            	}
         
            } catch (Exception) {
                console.log("Exception while reading packet");
                console.log(Exception);
            }
            break;

        default:
            console.log('Unknown code received: ' + code);
    }

    if (obj.callback) obj.callback();
};

kissProtocol.updateCRC = function(crc, byte) {
	crc ^= byte;
	for (var j = 0; j < 8; j++) {
		if ((crc & 0x80) != 0) {
			crc = ((crc << 1) ^ 0xD5) & 0xFF;
		} else {
			crc <<= 1;
		}
	}
	return crc;
}

kissProtocol.preparePacket = function (code, obj) {
    var buffer = new ArrayBuffer(255); // clean buffer!
    var blen = 0;

    var data = new DataView(buffer, 0);

    var crc = 0;
    var crcCounter = 0;
    
    switch (code) {
    
    	case this.GET_OSD:
    		data.setUint16(0, obj.address, 0);
    		data.setUint16(2, obj.chunkSize, 0);
    		
    		if (obj.event !== undefined) {
    			data.setUint8( 4, obj.event.e, 0);
    			data.setUint16(5, obj.event.x, 0);
    			data.setUint16(7, obj.event.y, 0);
        		blen = 9;
    		} else {
        		blen = 4;
     		}
    	break;
    	
    	case this.GET_OSD_CONFIG:
    		data.setUint8(0, obj.chunk, 0);
    		blen = 1;
    	break;

  
        case this.SET_SETTINGS:

            data.setUint16(0, obj.G_P[0] * 1000, 0);
            data.setUint16(2, obj.G_P[1] * 1000, 0);
            data.setUint16(4, obj.G_P[2] * 1000, 0);

            data.setUint16(6, obj.G_I[0] * 1000, 0);
            data.setUint16(8, obj.G_I[1] * 1000, 0);
            data.setUint16(10, obj.G_I[2] * 1000, 0);

            data.setUint16(12, obj.G_D[0] * 1000, 0);
            data.setUint16(14, obj.G_D[1] * 1000, 0);
            data.setUint16(16, obj.G_D[2] * 1000, 0);

            data.setUint16(18, obj.A_P * 1000, 0);
            data.setUint16(20, obj.A_I * 1000, 0);
            data.setUint16(22, obj.A_D * 1000, 0);
            data.setInt16(24, obj.ACCtrim[0] * 1000, 0);
            data.setInt16(26, obj.ACCtrim[1] * 1000, 0);

            data.setInt16(28, obj.RC_Rate[0] * 1000, 0);
            data.setInt16(30, obj.RC_Rate[1] * 1000, 0);
            data.setInt16(32, obj.RC_Rate[2] * 1000, 0);
            data.setInt16(34, obj.RPY_Expo[0] * 1000, 0);
            data.setInt16(36, obj.RPY_Expo[1] * 1000, 0);
            data.setInt16(38, obj.RPY_Expo[2] * 1000, 0);
            data.setInt16(40, obj.RPY_Curve[0] * 1000, 0);
            data.setInt16(42, obj.RPY_Curve[1] * 1000, 0);
            data.setInt16(44, obj.RPY_Curve[2] * 1000, 0);

            data.setInt16(46, obj.RXType, 0);
            data.setInt16(48, obj.PPMchanOrder, 0);
            data.setInt16(50, obj.CopterType, 0);
            data.setInt16(52, obj.Active3DMode, 0);
            data.setInt16(54, obj.ESConeshot125, 0);
            data.setInt16(56, obj.MinCommand16 - 1000, 0);
            data.setInt16(58, obj.MidCommand16 - 1000, 0);
            data.setInt16(60, obj.MinThrottle16 - 1000, 0);
            data.setInt16(62, obj.MaxThrottle16 - 1000, 0);
            data.setInt16(64, obj.TYmid16, 0);
            data.setUint8(66, obj.TYinv8, 0);
            data.setInt16(67, obj.ACCZero[0], 0);
            data.setInt16(69, obj.ACCZero[1], 0);
            data.setInt16(71, obj.ACCZero[2], 0);

            if (obj.ver > 103) {
                data.setUint8(73, obj.AUX[0]);
                data.setUint8(74, obj.AUX[1]);
                data.setUint8(75, obj.AUX[2]);
                data.setUint8(76, obj.AUX[3]);
            } else {
                data.setUint8(73, obj.aux1Funk);
                data.setUint8(74, obj.aux2Funk);
                data.setUint8(75, obj.aux3Funk);
                data.setUint8(76, obj.aux4Funk);
            }
            data.setUint16(77, obj.maxAng * 14.3);
            data.setUint8(79, obj.LPF);

            data.setUint16(80, obj.TPA[0] * 1000, 0);
            data.setUint16(82, obj.TPA[1] * 1000, 0);
            data.setUint16(84, obj.TPA[2] * 1000, 0);
            data.setUint8(86, obj.ESConeshot42, 0);
            data.setUint8(87, obj.failsaveseconds, 0);



            if (!obj.isActive) {
                console.log('The controller is not activated, let activate it with ' + obj.actKey);
                data.setUint16(88, obj.actKey >> 16, 0);
                data.setUint16(90, (obj.actKey & 0xFFFF), 0);
            } else {
                console.log('The controller is active');
                data.setUint16(88, 0, 0);
                data.setUint16(90, 0, 0);
            }
            data.setUint8(92, obj.BoardRotation, 0);
            data.setUint8(93, obj.CustomTPAInfluence);
            data.setUint8(94, obj.TPABP1);
            data.setUint8(95, obj.TPABP2);
            data.setUint8(96, obj.TPABPI1);
            data.setUint8(97, obj.TPABPI2);
            data.setUint8(98, obj.TPABPI3);
            data.setUint8(99, obj.TPABPI4);
            data.setUint8(100, obj.BatteryInfluence);
            data.setUint16(101, obj.voltage1 * 10, 0);
            data.setUint16(103, obj.voltage2 * 10, 0);
            data.setUint16(105, obj.voltage3 * 10, 0);
            data.setUint8(107, obj.voltgePercent1);
            data.setUint8(108, obj.voltgePercent2);
            data.setUint8(109, obj.voltgePercent3);
            data.setUint8(110, obj.vtxChannel);
            data.setUint8(111, obj.loggerConfig);
            data.setUint8(112, obj.RGB[0]);
            data.setUint8(113, obj.RGB[1]);
            data.setUint8(114, obj.RGB[2]);
            data.setUint16(115, obj.vbatAlarm * 10, 0);
            data.setInt16(117, obj.CBO[0]);
            data.setInt16(119, obj.CBO[1]);
            data.setInt16(121, obj.CBO[2]);
            data.setUint8(123, obj.AUX[4]);
            data.setUint8(124, obj.lapTimerTypeAndInterface);
            data.setUint16(125, obj.lapTimerTransponderId, 0);
            data.setUint8(127, obj.loggerDebugVariables);
            data.setUint8(128, obj.NFE[0]);
            data.setUint16(129, obj.NFCF[0], 0);
            data.setUint16(131, obj.NFCO[0], 0);
            data.setUint8(133, obj.NFE[1]);
            data.setUint16(134, obj.NFCF[1], 0);
            data.setUint16(136, obj.NFCO[1], 0);
            data.setUint8(138, obj.YawCfilter);
            data.setUint8(139, obj.vtxType);
            data.setUint16(140, obj.vtxPowerLow, 0);
            data.setUint16(142, obj.vtxPowerHigh, 0);
            data.setUint8(144, obj.AUX[5]);
            data.setUint8(145, obj.AUX[6]);
            data.setUint8(146, obj.AUX[7]);

            data.setUint16(147, obj.mahAlarm, 0);

            data.setUint8(149, obj.DB[0]);
            data.setUint8(150, obj.DB[1]);
            data.setUint8(151, obj.DB[2]);

            data.setUint8(152, obj.motorBuzzer);

            blen = 161;

            if (obj.ver >= 109) {
                data.setUint8(153, obj.loopTimeDivider);
                data.setUint8(154, obj.yawLpF);
                data.setUint8(155, obj.DLpF);
                data.setUint8(156, obj.reverseMotors);
                data.setUint8(157, obj.AUX[8]); // turtle mode
                data.setUint8(158, obj.adaptiveFilter); // adaptive filter
                blen = 167;
            }

            if (obj.ver >= 110) {
                data.setUint8(159, obj.AUX[9]); // runcam
                data.setUint8(160, obj.AUX[10]); // led brightness
                data.setUint8(161, obj.ledBrightness);  // max brightness
                var tmp = 0;
                data.setUint8(162, tmp);
                blen = 171;
            }
            if (obj.ver >= 111) {
                data.setUint8(163, obj.AUX[11]); //pentathrottle
                data.setUint8(164, obj.setpointIntoD);
                blen = 173;
            }
            if (obj.ver >= 113) {
                data.setUint8(165, obj.ESCOutputLayout); // ESC output orientation
                blen = 174;
            }
            if (obj.ver >= 116) {
                data.setUint32(166, obj.SerialSetup); // Serialconfig
                blen = 178;
            }
            if (obj.ver >= 117) {
                data.setUint8(170, obj.AUX[12]); //realpit
                blen = 179;
            }
            if (obj.ver >= 119) {
                data.setUint8(171, obj.launchMode); //Launchmode
                blen = 180;
            }
            if (obj.ver >= 121) {
            	data.setUint16(172, obj.osdConfig, 0); // DJI
                data.setUint8(174, obj.AUX[13]); //RTH
                blen = 183;
            }
            
            if (obj.ver >= 122) { // RTH
                data.setUint16(175, obj.rthReturnAltitude);
                data.setUint16(177, obj.rthHomeAltitude);
                data.setUint16(179, obj.rthDescentRadius);
                data.setUint16(181, obj.rthHoverThrottle);
                data.setUint16(183, obj.rthMaxThrottle);
                data.setUint16(185, obj.rthMinThrottle);
                data.setUint8(187,  obj.rthHomeAction);
                data.setUint8(188,  obj.rthReturnSpeed);
                blen = 197;
            }
            
            if (obj.ver >= 129) { // Ultra
            	data.setUint8(189,  obj.dshotMapping[0]);
            	data.setUint8(190,  obj.dshotMapping[1]);
            	data.setUint8(191,  obj.dshotMapping[2]);
            	data.setUint8(192,  obj.dshotMapping[3]);
            	data.setUint8(193,  obj.dshotMapping[4]);
            	data.setUint8(194,  obj.dshotMapping[5]);
            	data.setUint8(195,  obj.dshotMapping[6]);
            	data.setUint8(196,  obj.dshotMapping[7]);
             	data.setUint8(197,  obj.loggerSpeed);
            	data.setUint8(198,  obj.ccPadMode);
            	data.setUint16(199, obj.currentSensorDivider);
                data.setUint8(201,  obj.mspCanvas);
                data.setUint8(202,  obj.brakingFactor);
                data.setUint8(203,  obj.gimbalPTMode);
                data.setUint8(204,  obj.throttleScaling);
                data.setUint8(205,  obj.tzIndex);
                data.setUint8(206,  obj.gpsOptions);
                blen = 215;
            }
            
            if (obj.ver >= 131) { 
            	data.setUint16(207,  obj.altLimit);
            	blen = 217;
            }
            
            if (obj.ver >= 132) { 
            	data.setUint8(209,  obj.AUX[14]);
            	blen = 218;
            }
            
            if (obj.ver >= 133) { 
            	data.setUint8(210,  obj.voltageSensorOffset);
            	blen = 219;
            }
            
            if (obj.ver >= 134) { 
            	data.setUint8(211,  obj.prearm_mode);
            	blen = 220;
            }

            break;

        case this.MOTOR_TEST:
            var ver = +kissProtocol.data[kissProtocol.GET_SETTINGS].ver;

            data.setUint8(0, obj.motorTestEnabled, 0);
            data.setUint8(1, obj.motorTest[0], 0);
            data.setUint8(2, obj.motorTest[1], 0);
            data.setUint8(3, obj.motorTest[2], 0);
            data.setUint8(4, obj.motorTest[3], 0);
            data.setUint8(5, obj.motorTest[4], 0);
            data.setUint8(6, obj.motorTest[5], 0);
            blen = 7;
            if (ver >= 131) {
                data.setUint8(7, obj.motorTest[6], 0);
                data.setUint8(8, obj.motorTest[7], 0);
                blen = 9;
            } 
            break;

        case this.SET_ESC_SETTINGS:
        	var ver = +kissProtocol.data[kissProtocol.GET_SETTINGS].ver;
            data.setUint8(0, obj.escSettings[0], 0);
            data.setUint8(1, obj.escSettings[1], 0);
            data.setUint8(2, obj.escSettings[2], 0);
            data.setUint8(3, obj.escSettings[3], 0);
            data.setUint8(4, obj.escSettings[4], 0);
            data.setUint8(5, obj.escSettings[5], 0);
            blen = 6;
            if (ver >= 131) {
                data.setUint8(6, obj.escSettings[6], 0);
                data.setUint8(7, obj.escSettings[7], 0);
                blen = 8;
            }
            break;

        case this.ESC_INFO:

            break;
    }

    var bufferU8 = new Uint8Array(buffer);
    var outputBuffer = new ArrayBuffer(blen + 4);
    var outputU8 = new Uint8Array(outputBuffer);

    outputU8[0] = code; // was 0x10
    outputU8[1] = 5;
    outputU8[2] = blen;

    //var ver = +kissProtocol.data[kissProtocol.GET_SETTINGS].ver;
    //console.log("using version: " + ver);

    for (var i = 0; i < blen; i++) {
        outputU8[i + 3] = bufferU8[i];


            // new crc
            crc ^= bufferU8[i];
            for (var j = 0; j < 8; j++) {
                if ((crc & 0x80) != 0) {
                    crc = ((crc << 1) ^ 0xD5) & 0xFF;
                } else {
                    crc <<= 1;
                }
            }
    }

        outputU8[outputU8.length - 1] = crc & 0xFF;

    //console.log("Calculated crc: " + outputU8[outputU8.length - 1]);

    return outputU8;
};

kissProtocol.prepareChunkedPacket = function (code, obj, chunk) {
    var buffer = new ArrayBuffer(1024); // clean buffer!
    var data = new DataView(buffer, 0);
    var blen = 0;

    var crc = 0;
    var crcCounter = 0;
    
    switch (code) {

    case this.SET_OSD_CONFIG:
    	var p = 0;
    	data.setUint16(p, obj.syncLevel, 0); p+=2;
    	data.setUint16(p, obj.blackLevel, 0); p+=2;
    	data.setUint16(p, obj.whiteLevel, 0); p+=2;
    	data.setUint8(p, obj.options1, 0); p+=1;
    	data.setUint8(p, obj.options2, 0); p+=1;
    	data.setUint8(p, obj.options3, 0); p+=1;
    	for (var i=0; i<16; i++) { 
    		data.setUint8(p, obj.callsign.charCodeAt(i), 0); p+=1;
    	}
    	data.setUint16(p, obj.ccRestVoltage * 1000, 0); p+=2;
    	data.setUint16(p, obj.ccLeftVoltage * 1000, 0); p+=2;
    	data.setUint16(p, obj.ccRightVoltage * 1000, 0); p+=2;
    	data.setUint16(p, obj.ccUpVoltage * 1000, 0); p+=2;
    	data.setUint16(p, obj.ccDownVoltage * 1000, 0); p+=2;
    	data.setUint16(p, obj.ccSelectVoltage * 1000, 0); p+=2;

    	data.setUint8(p, obj.hdFrameOptions, 0); p+=1;
    	data.setUint16(p, obj.hdFrameLeft, 0); p+=2;
    	data.setUint16(p, obj.hdFrameTop, 0); p+=2;
    	data.setUint16(p, obj.hdFrameRight, 0); p+=2;
    	data.setUint16(p, obj.hdFrameBottom, 0); p+=2;

    	data.setUint16(p, obj.rssiWarning, 0); p+=2;
    	data.setUint16(p, obj.lqWarning, 0); p+=2;
    	data.setUint16(p, obj.satWarning, 0); p+=2;
    	data.setUint16(p, obj.altitudeWarning, 0); p+=2;
    	data.setUint16(p, obj.snrWarning, 0); p+=2;
    	data.setUint16(p, obj.currentWarning, 0); p+=2;
    	data.setUint16(p, obj.lipoSize, 0); p+=2;
    	data.setUint8(p, obj.lipoWarning, 0); p+=1;
    	data.setUint16(p, obj.cellWarning * 100, 0); p+=2;

    	for (var i=0; i<28; i++) {
    		var sensor = obj.customLayout[i];
    		data.setUint16(p, sensor.x, 0); p+=2;
    		data.setUint16(p, sensor.y, 0); p+=2;
    		data.setUint8(p, sensor.visible, 0); p+=1;
    		data.setUint8(p, sensor.align, 0); p+=1;
    		data.setUint8(p, sensor.font, 0); p+=1;
    		data.setUint8(p, sensor.proportional, 0); p+=1;
    		data.setUint8(p, sensor.style, 0); p+=1;
    	}
    	
    	data.setUint8(p, obj.stickOverlay, 0); p+=1;

    	// all crc
    	var allcrc = 0;
    	for (var i = 0; i < p; i++) {
    		allcrc = kissProtocol.updateCRC(allcrc, data.getUint8(i, 0));
    	}
    	data.setUint8(p, allcrc, 0); p+=1;

    	blen = p;
    	break;    	
    }

	var idx = 200 * chunk; 
	var len = blen - idx;
	
	var left = Math.floor(len / 200); 
	if ((len % 200) > 0) left++;
	if (left > 0) left--;
	
	if (len > 200) len = 200;
	
	var outputBuffer = new ArrayBuffer(len + 6);
	var outputU8 = new Uint8Array(outputBuffer);
	
    outputU8[0] = code;
    outputU8[1] = 5;
    outputU8[2] = len + 2; // +2 for chunk info
    outputU8[3] = chunk;
    outputU8[4] = left;
    
    crc = kissProtocol.updateCRC(crc, chunk);
    crc = kissProtocol.updateCRC(crc, left);
      
	for (var i = 0; i < len; i++) {
		outputU8[5 + i] = data.getUint8(idx + i, 0);
		crc = kissProtocol.updateCRC(crc, outputU8[5 + i]);
	}
	
    outputU8[outputU8.length - 1] = crc & 0xFF;
    
    console.log(outputU8);

    return { 'data':outputU8, 'left': left, 'chunk': chunk };
};


kissProtocol.sendChunked = function(code, json, chunk, callback) {

	console.log("Sending " + code + " chunk " + chunk);
	var packet = kissProtocol.prepareChunkedPacket(code, json, chunk);
	
	kissProtocol.send(kissProtocol.SET_OSD_CONFIG, packet.data, function() {
		console.log('SEND');
		if (packet.left == 0) {
			console.log("No more chunks to send, callback called");
			if (callback) {
				callback();
			}
		} else {
			kissProtocol.sendChunked(code, json, packet.chunk + 1, callback);
		}
	});
};


kissProtocol.readString = function (buffer, offset) {
    var ret = "";
    for (var i = offset; i < buffer.byteLength; i++) {
        if (buffer.getUint8(i, 0) != 0) ret += String.fromCharCode(buffer.getUint8(i)); else break;
    }
    return ret;
};

kissProtocol.readBytesAsString = function (buffer, offset, len) {
    var ret = "";
    for (var i = offset; i < (offset + len); i++) {
        ret += String.fromCharCode(buffer.getUint8(i));
    }
    return ret;
};


kissProtocol.disconnectCleanup = function () {
    console.log('Disconnect cleanup');
    kissProtocol.init();
};