const dependencies = {
  fileMetadataStorage: null,
  fileStorage: null,
};

module.exports = {
  setFileMetadataStorage(fileMetadataStorage) {
    dependencies.fileMetadataStorage = fileMetadataStorage
  },
  getFileMetadataStorage() {
    const {fileMetadataStorage} = dependencies;
    if (!fileMetadataStorage) throw new Error('Missing implementation for FileMetadataStorage');
    else return fileMetadataStorage;
  },
  setFileStorage(fileStorage) {
    dependencies.fileStorage = fileStorage
  },
  getFileStorage() {
    const {fileStorage} = dependencies;
    if (!fileStorage) throw new Error('Missing implementation for FileStorage');
    else return fileStorage;
  }
};
