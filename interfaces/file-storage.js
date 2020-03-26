class FileStorage {

  /**
   * only for Amazon S3 since its file-uploading mechanism is indirect
   * (client will upload the file directly to S3 instead of to server)
   * @param fileName the name is used for registering with S3
   */
  async getFileUploadUrl(fileName) {
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

  /**
   * Delete many files with a list of file identifiers
   * @param fileSourceList file source can be ObjectId in case of GridFS or file URL in case of Amazon S3 or BunnyCDN
   */
  deleteFiles(fileSourceList) {
  }
}

module.exports = FileStorage;
