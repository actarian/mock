const fs = require('fs'),
	path = require('path'),
	mv = require('mv');

function upload(temporaryFolder) {
	const instance = {};
	instance.temporaryFolder = temporaryFolder;
	instance.maxFileSize = null;
	instance.fileParameterName = 'file';
	try {
		fs.mkdirSync(instance.temporaryFolder);
	} catch (e) { }
	function cleanIdentifier(identifier) {
		return identifier.replace(/[^0-9A-Za-z_-]/g, '');
	}
	function getChunkFilename(chunkNumber, identifier) {
		// Clean up the identifier
		identifier = cleanIdentifier(identifier);
		// What would the file name be?
		return path.resolve(instance.temporaryFolder, './chunk-' + identifier + '.' + chunkNumber);
	}
	function validateRequest(chunkNumber, chunkSize, totalSize, identifier, filename, fileSize) {
		// Clean up the identifier
		identifier = cleanIdentifier(identifier);
		// Check if the request is sane
		if (chunkNumber == 0 || chunkSize == 0 || totalSize == 0 || identifier.length == 0 || filename.length == 0) {
			return 'non_flow_request';
		}
		const numberOfChunks = Math.max(Math.floor(totalSize / (chunkSize * 1.0)), 1);
		if (chunkNumber > numberOfChunks) {
			return 'invalid_flow_request1';
		}
		// Is the file too big?
		if (instance.maxFileSize && totalSize > instance.maxFileSize) {
			return 'invalid_flow_request2';
		}
		if (typeof (fileSize) != 'undefined') {
			if (chunkNumber < numberOfChunks && fileSize != chunkSize) {
				// The chunk in the POST request isn't the correct size
				return 'invalid_flow_request3';
			}
			if (numberOfChunks > 1 && chunkNumber == numberOfChunks && fileSize != ((totalSize % chunkSize) + parseInt(chunkSize))) {
				// The chunks in the POST is the last one, and the fil is not the correct size
				return 'invalid_flow_request4';
			}
			if (numberOfChunks == 1 && fileSize != totalSize) {
				// The file is only a single chunk, and the data size does not fit
				return 'invalid_flow_request5';
			}
		}
		return 'valid';
	}
	//'found', filename, original_filename, identifier
	//'not_found', null, null, null
	instance.get = function(req, callback) {
		const chunkNumber = req.param('flowChunkNumber', 0);
		const chunkSize = req.param('flowChunkSize', 0);
		const totalSize = req.param('flowTotalSize', 0);
		const identifier = req.param('flowIdentifier', "");
		const filename = req.param('flowFilename', "");
		if (validateRequest(chunkNumber, chunkSize, totalSize, identifier, filename) == 'valid') {
			const chunkFilename = getChunkFilename(chunkNumber, identifier);
			// console.log('test chunkFilename', chunkFilename);
			fs.access(chunkFilename, fs.constants.F_OK, (error) => {
				if (error) {
					callback('not_found', null, null, null);
				} else {
					callback('found', chunkFilename, filename, identifier);
				}
			});
		} else {
			callback('not_found', null, null, null);
		}
	};
	//'partly_done', filename, original_filename, identifier
	//'done', filename, original_filename, identifier
	//'invalid_flow_request', null, null, null
	//'non_flow_request', null, null, null
	instance.post = function(req, callback) {
		const fields = req.body;
		const files = req.files;
		const chunkNumber = fields['flowChunkNumber'];
		const chunkSize = fields['flowChunkSize'];
		const totalSize = fields['flowTotalSize'];
		const identifier = cleanIdentifier(fields['flowIdentifier']);
		const filename = fields['flowFilename'];
		if (!files[instance.fileParameterName] || !files[instance.fileParameterName].size) {
			callback('invalid_flow_request', null, null, null);
			return;
		}
		const original_filename = files[instance.fileParameterName]['originalFilename'];
		const validation = validateRequest(chunkNumber, chunkSize, totalSize, identifier, filename, files[instance.fileParameterName].size);
		if (validation == 'valid') {
			const chunkFilename = getChunkFilename(chunkNumber, identifier);
			// Save the chunk (TODO: OVERWRITE)
			mv(files[instance.fileParameterName].path, chunkFilename, function() {
				// Do we have all the chunks?
				let currentTestChunk = 1;
				const numberOfChunks = Math.max(Math.floor(totalSize / (chunkSize * 1.0)), 1);
				const testChunkExists = function() {
					const chunkFilename = getChunkFilename(currentTestChunk, identifier);
					// console.log('test chunkFilename', chunkFilename);
					fs.access(chunkFilename, fs.constants.F_OK, (error) => {
						if (error) {
							callback('partly_done', filename, original_filename, identifier);
						} else {
							currentTestChunk++;
							if (currentTestChunk > numberOfChunks) {
								callback('done', filename, original_filename, identifier);
							} else {
								// Recursion
								testChunkExists();
							}
						}
					});
				};
				testChunkExists();
			});
		} else {
			callback(validation, filename, original_filename, identifier);
		}
	};
	// Pipe chunks directly in to an existsing WritableStream
	//   r.write(identifier, response);
	//   r.write(identifier, response, {end:false});
	//
	//   const stream = fs.createWriteStream(filename);
	//   r.write(identifier, stream);
	//   stream.on('data', function(data){...});
	//   stream.on('finish', function(){...});
	instance.write = function(identifier, stream, options) {
		options = options || {};
		options.end = (typeof options['end'] == 'undefined' ? true : options['end']);
		// Iterate over each chunk
		const pipeChunk = function(number) {
			const chunkFilename = getChunkFilename(number, identifier);
			fs.access(chunkFilename, fs.constants.F_OK, (error) => {
				if (error) {
					// When all the chunks have been piped, end the stream
					if (options.end) {
						stream.end();
						instance.clean(identifier, options);
					}
					// if (options.onDone) options.onDone();
				} else {
					// If the chunk with the current number exists,
					// then create a ReadStream from the file
					// and pipe it to the specified stream.
					const source = fs.createReadStream(chunkFilename);
					source.pipe(stream, {
						end: false
					});
					source.on('end', function() {
						// When the chunk is fully streamed,
						// jump to the next one
						pipeChunk(number + 1);
					});
				}
			});
		};
		pipeChunk(1);
	};
	instance.clean = function(identifier, options) {
		options = options || {};
		// Iterate over each chunk
		const pipeChunkRm = function(number) {
			const chunkFilename = getChunkFilename(number, identifier);
			//console.log('removing pipeChunkRm ', number, 'chunkFilename', chunkFilename);
			fs.access(chunkFilename, fs.constants.F_OK, (error) => {
				if (error) {
					if (options.onDone) options.onDone();
				} else {
					console.log('exist removing ', chunkFilename);
					fs.unlink(chunkFilename, function(err) {
						if (err && options.onError) options.onError(err);
					});
					pipeChunkRm(number + 1);
				}
			});
		};
		pipeChunkRm(1);
	};
	return instance;
}

module.exports = {
	upload: upload,
};
