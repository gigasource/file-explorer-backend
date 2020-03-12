class FileStorage {

  /**
   * only for Amazon S3 since its file-uploading mechanism is indirect
   * (client will upload the file directly to S3 instead of to server)
   * @param fileName the name is used for registering with S3
   */
  getFileUploadUrl(fileName) {
  }

  /**
   * for direct storage such as GridFS, BunnyCDN (client file is uploaded to server then server sends file to storage)
   * @param file the file used for uploading
   */
  uploadFile(file) {
  }

  /**
   * This must returns a Readable stream of the file instead of the whole file to avoid large memory consumption
   */
  downloadFile(fileMetadata) {
  }

  deleteFile(fileMetadata) {
  }
}

module.exports = FileStorage;
