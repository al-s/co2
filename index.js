#! /usr/bin/env node

var _ = require('lodash');

var express = require('express');
var app = express();

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

var port = new SerialPort("/dev/ttyUSB0", {
	baudRate: 9600,
	parser: parser()
});

function read() {
	port.write(new Buffer([ 0xFF, 0x01, 0x86, 0x00, 0x00, 0x00, 0x00, 0x00, 0x79 ]));
}

port.once('open', function () {
	read();
	setInterval(read, 30000);
	app.listen(3000, function () {
		console.log('Sensor app listening on port 3000!');
	});
});

var values = [];

port.on('data', function (data) {
	var date = new Date();
	var ppm = data[2] << 8 | data[3];
	console.log(date + ': ' + ppm);
	values.push({ date: date, ppm: ppm });
	if (values.length > 120) values.shift();
});

app.get('/', function (req, res) {
	var rows = _.reduceRight(values, function (r, v) {
		r.push('<tr><td>' + v.date + '</td><td>' + v.ppm + '</td></tr>');
		return r;
	}, []).join('');
	var s = '<!DOCTYPE html>' +
		'<html><head><title>Carbon dioxide sensor</title><style>' +
		'body { font-family: sans-serif; } ' +
		'table, th, td { border: 1px solid black; border-collapse: collapse; } ' +
		'th, td { padding: 10px; }' +
		'</style></head><body>' +
		'<table><tr><th>Date</th><th>CO<sub>2</sub> (ppm)</th></tr>' +
		rows + '</table>' +
		'</body></html>';
	res.send(s);
});
