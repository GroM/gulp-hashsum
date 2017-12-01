'use strict';

var crypto = require('crypto');
var gutil = require('gulp-util');
var _ = require('lodash');
var mkdirp = require('mkdirp');
var slash = require('slash');
var through = require('through');

var fs = require('fs');
var path = require('path');

var compareBuffer = typeof Buffer.compare !== 'undefined'
		? Buffer.compare
		: function (a, b) {
			// Naive implementation of Buffer comparison for older
			// Node versions. Doesn't follow the same spec as
			// Buffer.compare, but we're only interested in equality.
			if (a.length !== b.length) {
				return -1;
			}
			for (var i = 0; i < a.length; i++) {
				if (a[i] !== b[i]) {
					return -1;
				}
			}
			return 0;
		};

function hashsum(options) {
	options = _.defaults(options || {}, {
		dest: process.cwd(),
		hash: 'sha1',
		force: false,
		delimiter: '  ',
		outputMode: 'classic'
	});
	options = _.defaults(options, { filename: options.hash.toUpperCase() + 'SUMS' });

	var hashesFilePath = path.resolve(options.dest, options.filename);
	var hashes = {};

	function processFile(file) {
		if (file.isNull()) {
			return;
		}
		if (file.isStream()) {
			this.emit('error', new gutil.PluginError('gulp-hashsum', 'Streams not supported'));
			return;
		}
		var filePath = path.resolve(options.dest, file.path);
		hashes[slash(path.relative(path.dirname(hashesFilePath), filePath))] = crypto
			.createHash(options.hash)
			.update(file.contents, 'binary')
			.digest('hex');

		this.push(file);
	}

	function writeSums() {
		var contents;
		switch(options.outputMode)
		{
			case 'json':
				contents = JSON.stringify(hashes);
				break;
			case 'php':
				var lines = ['<?php\nreturn array('];
				_.toPairs(hashes).forEach(function (v) {
					lines.push(v[0] + ' => ' + v[1] + ',');
				});
				lines.push(');\n')
				contents = lines.join('\n');
				break;
			default:
				var lines = _.keys(hashes).sort().map(function (key) {
					return hashes[key] + options.delimiter + key;
				});
				contents = lines.join('\n');
		}
		var data = new Buffer(contents);

		if (options.force || !fs.existsSync(hashesFilePath) || compareBuffer(fs.readFileSync(hashesFilePath), data) !== 0) {
			mkdirp(path.dirname(hashesFilePath));
			fs.writeFileSync(hashesFilePath, data);
		}
		this.emit('end');
	}

	return through(processFile, writeSums);
}

module.exports = hashsum;
