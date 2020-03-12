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
      const uploadStream = this.bucket.openUploadStream(file.fileName, {metadata: file});
      const uploadStreamId = uploadStream.id;

      uploadStream.once('finish', async (uploadedFile) => {
        const uploadedFileId = uploadedFile._id;
        const chunksInfo = [];
        const chunks = await this.db.collection(this.chunkCollectionName).find({files_id: uploadStreamId}).toArray();

        chunks.forEach(chunk => {
          const chunkMd5 = md5(chunk.data.buffer);
          chunksInfo.push({path: `http://${file.host}/chunk/${chunk._id.toHexString()}`, n: chunk.n, md5: chunkMd5});
        });

        file.chunksInfo = chunksInfo;
        this.db.collection(this.fileCollectionName).updateOne({_id: uploadStreamId}, {$set: {metadata: file}});

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

  async deleteFile(file) {
    const fileParts = path.parse(file);
    const filename = fileParts.base;
    const fileInfo = await this.db.collection(this.fileCollectionName).findOne({filename});
    this.bucket.delete(fileInfo._id);
  }

  async downloadFile(fileMetadata) {
    const fileObjectId = mongoose.Types.ObjectId(fileMetadata.fileId);
    // return this.db.collection(this.chunkCollectionName).findOne({files_id: fileObjectId});
    return this.bucket.openDownloadStream(fileObjectId);
  }
}

module.exports = GridFsFileStorage;
