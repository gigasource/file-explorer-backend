const FileStorage = require('../interfaces/file-storage');
const {GridFSBucket} = require('mongodb');
const md5 = require('md5');
const mongoose = require('mongoose');

class GridFsFileStorage extends FileStorage {
  constructor(db, options) {
    super();

    this.db = db;
    this.chunkCollectionName = `${options.bucketName}.chunks`;
    this.fileCollectionName = `${options.bucketName}.files`;
    this.options = options;

    this.bucket = new GridFSBucket(db, {
      bucketName: options.bucketName,
      chunkSizeBytes: options.chunkSizeBytes || 1024 * 1024
    })
  }

  uploadFile(file) {
    return new Promise(resolve => {
      const uploadStreamOpts = {
        contentType: file.mimeType,
        ...this.options.writeConcern ? {writeConcern: this.options.writeConcern} : {},
      };
      const uploadStream = this.bucket.openUploadStream(file.originalname, uploadStreamOpts);
      const uploadStreamId = uploadStream.id;

      uploadStream.once('finish', async (uploadedFile) => {
        const uploadedFileId = uploadedFile._id;
        const chunksInfo = [];
        const chunks = await this.db.collection(this.chunkCollectionName).find({files_id: uploadStreamId}).toArray();

        chunks.forEach(chunk => {
          const chunkMd5 = md5(chunk.data.buffer);
          chunksInfo.push({chunkId: chunk._id, n: chunk.n, md5: chunkMd5});
        });

        this.db.collection(this.fileCollectionName).updateOne({_id: uploadStreamId}, {$set: {metadata: {chunks: chunksInfo}}});

        resolve({
          fileSource: uploadedFileId,
          filePath: `${file.origin}/file/${file.fileName}`,
          chunksInfo,
          sizeInBytes: uploadedFile.length,
        });
      });

      file.stream.pipe(uploadStream);
    });
  }

  async deleteFile(fileMetadata) {
    const fileObjectId = mongoose.Types.ObjectId(fileMetadata.fileSource);
    return this.bucket.delete(fileObjectId);
  }

  getFileMd5(fileMetadata) {
    return new Promise(async (resolve, reject) => {
      try {
        const fileObjectId = mongoose.Types.ObjectId(fileMetadata.fileSource);
        const file = (await this.db.collection(this.fileCollectionName).find({_id: fileObjectId}).toArray())[0];
        resolve(file.md5);
      } catch (e) {
        reject(e);
      }
    })
  }

  async downloadFile(fileMetadata) {
    const fileObjectId = mongoose.Types.ObjectId(fileMetadata.fileSource);
    return this.bucket.openDownloadStream(fileObjectId);
  }

  async cloneFile(fileId) {
    const ObjectId = mongoose.Types.ObjectId;
    if (!(fileId instanceof ObjectId)) fileId = ObjectId(fileId);

    const fileInfo = await this.db.collection(this.fileCollectionName).findOne({_id: fileId});
    const downloadStream = this.bucket.openDownloadStream(fileId);

    const file = {
      mimeType: fileInfo.contentType,
      originalname: fileInfo.filename,
      stream: downloadStream,
    }

    return await this.uploadFile(file);
  }
}

module.exports = GridFsFileStorage;
