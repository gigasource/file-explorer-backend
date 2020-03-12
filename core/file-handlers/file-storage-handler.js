const {getFileStorage} = require('../util/dependencies');

const fileStorage = getFileStorage();

function getFileUploadUrl() {
  return fileStorage.getFileUploadUrl();
}

function deleteFile(file) {
  const {uploadedFileName} = file;
  const s3 = getS3Sdk();
  const s3Config = getS3Config();

  return new Promise((resolve, reject) => {
    s3.deleteObjects({
      Bucket: s3Config.bucket,
      Delete: {Objects: [{Key: `${s3Config.uploadFolder}/${uploadedFileName}`}]},
    }, async (err, data) => err ? reject(err) : resolve(data))
  });
}

module.exports = {
  deleteFile,
};
