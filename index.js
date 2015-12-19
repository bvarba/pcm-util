/**
 * Utils to deal with pcm-buffers
 *
 * @module  pcm-util
 */

var os = require('os');


/**
 * Default input/output format
 */
var defaultFormat = {
	channels: 2,
	sampleRate: 44100,
	byteOrder: os.endianness instanceof Function ? os.endianness() : 'LE',
	bitDepth: 16,
	signed: true,
	float: false,
	interleaved: true,
	samplesPerFrame: 1024
};


/**
 * Just a list of reserved property names of format
 */
var formatProperties = [
	'channels',
	'sampleRate',
	'byteOrder',
	'bitDepth',
	'signed',
	'float',
	'interleaved',
	'samplesPerFrame',
	'sampleSize',
	'methodSuffix',
	'readMethodName',
	'writeMethodName',
	'maxInt'
];


/**
 * Return buffer method suffix for the format
 */
function getMethodSuffix (format) {
	return (format.float ? 'Float' : ((format.signed ? '' : 'U') + 'Int' + format.bitDepth)) + format.byteOrder;
};


/**
 * Get format info from any object
 */
function getFormat (obj) {
	var format = {};
	obj && formatProperties.forEach(function (key) {
		if (obj[key]) format[key] = obj[key];
	});
	return normalizeFormat(format);
};


/**
 * Normalize format, mutable.
 * Precalculate format params: sampleSize, suffix.
 */
function normalizeFormat (format) {
	if (!format) format = {};

	//ignore already normalized format
	if (format.sampleSize) return format;

	//bring default format values
	formatProperties.forEach(function (key) {
		if (format[key] == null) {
			format[key] = defaultFormat[key];
		}
	});

	//ensure float values
	if (format.float) {
		format.bitDepth = 32;
		format.signed = true;
	}

	if(format.bitDepth <= 8) format.byteOrder = '';

	//precalc other things
	format.sampleSize = format.bitDepth / 8;

	//method suffix/names
	format.methodSuffix = getMethodSuffix(format);
	format.readMethodName = 'read' + getMethodSuffix(format);
	format.writeMethodName = 'write' + getMethodSuffix(format);

	//max integer, e.g. 32768
	format.maxInt = Math.pow(2, format.bitDepth-1);


	return format;
};


/**
 * Calculate offset for the format
 */
function getOffset(channel, idx, format, len) {
	if (!len) len = format.samplesPerFrame;
	var offset = format.interleaved ? channel + idx * format.channels : channel * len + idx;
	return offset * format.sampleSize;
};


/**
 * Return parsed channel data for a buffer
 */
function getChannelData (buffer, channel, fromFormat, toFormat) {
	fromFormat = normalizeFormat(fromFormat);

	var method = fromFormat.readMethodName;
	var frameLength = getFrameLength(buffer, fromFormat);

	var data = [];
	var offset;

	for (var i = 0, value; i < frameLength; i++) {
		value = buffer[method](getOffset(channel, i, fromFormat, frameLength));
		if (toFormat) value = convertSample(value, fromFormat, toFormat);

		data.push(value);
	}

	return data;
};


/**
 * Get parsed buffer data, separated by channel arrays [[LLLL], [RRRR]]
 */
function getChannelsData (buffer, fromFormat, toFormat) {
	fromFormat = normalizeFormat(fromFormat);

	var data = [];

	for (var channel = 0; channel < fromFormat.channels; channel++) {
		data.push(getChannelData(buffer, channel, fromFormat, toFormat));
	}

	return data;
}


/**
 * Copy data to the buffer’s channel
 */
function copyToChannel (buffer, data, channel, toFormat) {
	toFormat = normalizeFormat(toFormat);

	data.forEach(function (value, i) {
		var offset = getOffset(channel, i, toFormat, data.length)
		if (!toFormat.float) value = Math.round(value);
		buffer[toFormat.writeMethodName](value, offset);
	});

	return buffer;
};


/**
 * Convert buffer from format A to format B.
 */
function convertFormat (buffer, from, to) {
	var value, channel, offset;

	from = normalizeFormat(from);
	to = normalizeFormat(to);

	//ignore needless conversion
	if ((from.methodSuffix === to.methodSuffix) &&
		(from.channels === to.channels) &&
		(from.interleaved === to.interleaved)) {
		return buffer;
	}

	var chunk = new Buffer(buffer.length * to.sampleSize / from.sampleSize);

	//get normalized data for channels
	getChannelsData(buffer, from).forEach(function (channelData, channel) {
		copyToChannel(chunk, channelData.map(function (value) {
			return convertSample(value, from, to);
		}), channel, to);
	});

	return chunk;
};


/**
 * Convert sample from format A to format B
 */
function convertSample (value, from, to) {
	from = normalizeFormat(from);
	to = normalizeFormat(to);

	//ignore not changed suffix
	if (from.methodSuffix === to.methodSuffix) return value;

	//normalize value to float form -1..1
	if (!from.float) {
		if (!from.signed) {
			value -= from.maxInt;
		}
		value = value / (from.maxInt - 1);
	}

	//clamp
	value = Math.max(-1, Math.min(1, value));

	//convert value to needed form
	if (!to.float) {
		if (to.signed) {
			value = value * (to.maxInt - 1);
		} else {
			value = (value + 1) * to.maxInt;
		}
		value = Math.floor(value);
	}

	return value;
}


/**
 * Transform from inverleaved form to planar
 */
function deinterleave (buffer, format) {
	xxx
};


/**
 * Convert buffer from planar to interleaved form
 */
function interleave (buffer, format) {
	xxx
};


/**
 * Downmix channels
 */
function downmix (buffer, format) {
	xxx
};


/**
 * Upmix channels
 */
function upmix (buffer, format) {
	xxx
};


/**
 * Resample buffer
 */
function resample (buffer, rateA, rateB, format) {
	xxx
};


/**
 * Remap channels not changing the format
 */
function mapChannels (buffer, channels, format) {
	xxx
};


/**
 * Slice audio buffer
 */
function slice (buffer, format) {
	xxx
};


/**
 * Map samples not changing the format
 */
function mapSamples (buffer, fn, format) {
	format = normalizeFormat(format);

	var samplesNumber = Math.floor(buffer.length / format.sampleSize);
	var value, offset;

	//don’t mutate the initial buffer
	var buf = new Buffer(buffer.length);

	for (var i = 0; i < samplesNumber; i++) {
		offset = i * format.sampleSize;

		//read value
		value = buffer[format.readMethodName](offset);

		//transform value
		value = fn(value);

		//avoid int outofbounds error
		if (!format.float) value = Math.round(value);

		//write value
		buf[format.writeMethodName](value, offset);
	}

	return buf;
}


/** Get frame size from the buffer, for a channel */
function getFrameLength (buffer, format) {
	format = normalizeFormat(format);

	return Math.floor(buffer.length / format.sampleSize / format.channels);
}


module.exports = {
	defaultFormat: defaultFormat,
	getFormat: getFormat,
	getMethodSuffix: getMethodSuffix,
	convertFormat: convertFormat,
	convertSample: convertSample,
	normalizeFormat: normalizeFormat,
	getChannelData: getChannelData,
	getChannelsData: getChannelsData,
	copyToChannel: copyToChannel,
	mapSamples: mapSamples,
	getFrameLength: getFrameLength,
	getOffset: getOffset
};