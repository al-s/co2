#! /usr/bin/env node

var SerialPort = require("serialport").SerialPort;

function checksum(data) {
	var sum = 0;
	for (var i = 1; i < 8; i++)
		sum += data[i];
	return (((sum ^ 0xFF) + 1) & 0xFF) == data[8];
}

function parser() {
	var data = new Buffer(0);
	return function (emitter, buffer) {
		data = Buffer.concat([ data, buffer ]);
		while (true) {
			var idx = data.indexOf(0xFF);
			if (idx == -1) {
				data = new Buffer(0);
				return;
			}
			data = data.slice(idx);
			if (data.length < 9)
				return;
			if (checksum(data)) {
				emitter.emit('data', data.slice(0, 9));
				data = data.slice(9);
			} else {
				data = data.slice(1);
			}
		}
	};
}

var port = new SerialPort("/dev/ttyUSB1", {
	baudRate: 9600,
	parser: parser()
});

function read() {
	port.write(new Buffer([ 0xFF, 0x01, 0x86, 0x00, 0x00, 0x00, 0x00, 0x00, 0x79 ]));
}

port.once('open', function () {
	read();
	setInterval(read, 30000);
});

port.on('data', function (data) {
	var value = data[2] << 8 | data[3];
	console.log(new Date() + ': ' + value);
});
