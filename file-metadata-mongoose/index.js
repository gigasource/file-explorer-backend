const FileMetadataStorage = require('../interfaces/file-metadata-storage');
let FileModel = require('./schema/file-metadata');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

class MongooseFileMetadataStorage extends FileMetadataStorage {
  constructor(dataModel) {
    super();
    if (dataModel) FileModel = dataModel
  }

  createFolder(folder) {
    folder = this.transformObject(folder)

    return FileModel.create({
      ...folder,
      isFolder: true,
    });
  }

  async createFileMetadata(file) {
    file = this.transformObject(file)

    const doc = await FileModel.create(file);
    return doc._doc;
  }

  deleteFileMetadata(conditions) {
    conditions = this.transformObject(conditions)

    return FileModel.deleteMany(conditions);
  }

  findFileMetadatas(conditions) {
    conditions = this.transformObject(conditions)

    return FileModel.find(conditions).lean();
  }

  findFileMetadata(conditions) {
    conditions = this.transformObject(conditions)

    return FileModel.findOne(conditions).lean();
  }

  editFileMetadata(conditions, newValues) {
    conditions = this.transformObject(conditions)

    return FileModel.updateMany(conditions, newValues)
  }

  transformObject(obj) {
    if (obj._id) obj._id = ObjectId(obj._id);
    return obj
  }
}

module.exports = MongooseFileMetadataStorage;
