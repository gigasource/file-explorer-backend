const FileMetadataStorage = require('../../interfaces/file-metadata-storage');
const FileModel = require('./database/schema/file-metadata');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

class MongooseFileMetadataStorage extends FileMetadataStorage {
  constructor() {
    super();
  }

  createFolder(folder) {
    return FileModel.create({
      ...folder,
      isFolder: true,
    });
  }

  createFileMetadata(file) {
    return FileModel.create(file);
  }

  deleteFileMetadata(conditions) {
    if (conditions._id) conditions._id = ObjectId(conditions._id);

    return FileModel.findOneAndDelete(conditions);
  }

  findFileMetadatas(conditions) {
    if (conditions._id) conditions._id = ObjectId(conditions._id);

    return FileModel.find(conditions).lean();
  }

  findFileMetadata(conditions) {
    if (conditions._id) conditions._id = ObjectId(conditions._id);

    return FileModel.findOne(conditions).lean();
  }
}

module.exports = MongooseFileMetadataStorage;
