const {getFileStorage} = require('../util/dependencies');
const {checkFileExisted} = require('../file-handlers/file-metadata-handler');

const fileStorage = getFileStorage();

class MulterStorageEngine {
  constructor(options) {
    this.options = options;
  }

  async _handleFile(req, file, cb) {
    // req.on('close', () => this.cleanUploadedFiles(file, cb));
    let {folderPath, ignoreDuplicate, overwrite} = req.query;
    if (!folderPath.endsWith('/')) folderPath += '/';

    const fullFilePath = folderPath + file.originalname;

    if (!ignoreDuplicate && !overwrite) {
      const fileExisted = await checkFileExisted(fullFilePath);
      if (fileExisted) {
        file.uploadSuccess = false;
        return cb(`File ${fullFilePath} already existed, other files will be skipped`);
      }
    }

    if (req.namespace) file.namespace = req.namespace;
    file.fileName = file.originalname;
    file.mimeType = file.mimetype;
    file.folderPath = req.query.folderPath;
    if (!file.folderPath.endsWith('/')) file.folderPath += '/';
    file.host = req.headers.host;
    file.origin = req.headers.origin;

    const uploadResult = await fileStorage.uploadFile(file);
    const {sizeInBytes, fileSource} = uploadResult
    if (sizeInBytes) file.sizeInBytes = sizeInBytes;
    if (fileSource) file.fileSource = fileSource;

    //todo: handle upload error
    file.uploadSuccess = true; // this is used in handler to return result to client

    cb(null);
  }

  _removeFile(req, file, cb) {
    // this.cleanUploadedFiles(file, cb);
  }

  // cleanUploadedFiles(file, cb) {
  //   //todo: implement a logging system to detect delete errors
  //   const promises = [];
  //   if (!file.stream.destroyed) file.stream.destroy();
  //
  //   if (file.fileUrl) promises.push(deleteFile(file, this.options));
  //   if (file.chunks) promises.push(deleteFileChunks(file, this.options));
  //
  //   if (promises.length > 0) {
  //     Promise.all(promises)
  //         .catch(() => console.error(`Error occurred while trying to delete file ${file.fileUrl}`))
  //         .finally(() => cb && cb(null));
  //   }
  // }
}

module.exports = MulterStorageEngine;
