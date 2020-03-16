const FileStorage = require('../interfaces/file-storage');
const {GridFSBucket} = require('mongodb');
const md5 = require('md5');
const path = require('path');
const mongoose = require('mongoose');

class GridFsFileStorage extends FileStorage {
  constructor(db, options) {
    super();

    this.db = db;
    this.chunkCollectionName = `${options.bucketName}.chunks`;
    this.fileCollectionName = `${options.bucketName}.files`;

    this.bucket = new GridFSBucket(db, {
      bucketName: options.bucketName,
      chunkSizeBytes: options.chunkSizeBytes || 1024 * 1024
    })
  }

  uploadFile(file) {
    return new Promise((resolve, reject) => {
      // const uploadStream = this.bucket.openUploadStream(file.folderPath + file.fileName, {metadata: file});
      const uploadStream = this.bucket.openUploadStream('', {metadata: {}});
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
          fileId: uploadedFileId,
          filePath: `http://${file.host}/file/${file.fileName}`,
          chunksInfo,
          sizeInBytes: uploadedFile.length,
        });
      });

      file.stream.pipe(uploadStream);
    });
  }

  async deleteFile(fileMetadata) {
    const fileObjectId = mongoose.Types.ObjectId(fileMetadata.fileId);
    return this.bucket.delete(fileObjectId);
  }

  async downloadFile(fileMetadata) {
    const fileObjectId = mongoose.Types.ObjectId(fileMetadata.fileId);
    return this.bucket.openDownloadStream(fileObjectId);
  }
}

module.exports = GridFsFileStorage;
