const FileStorage = require('../interfaces/file-storage');
const AWS = require('aws-sdk');

class AwsS3FileStorage extends FileStorage {
  constructor(s3Config) {
    super();

    const {credentialConfig, storageConfig} = s3Config;
    AWS.config.update(credentialConfig);
    this.storageConfig = storageConfig;
    this.s3Storage = new AWS.S3({
      useAccelerateEndpoint: false,
      s3ForcePathStyle: true,
      apiVersion: '2006-03-01',
    });
  }

  getFileUploadUrl(fileName) {
    return new Promise((resolve, reject) => {
      this.s3Storage.createPresignedPost({
        Bucket: this.storageConfig.bucket,
        Expires: this.storageConfig.expiryTime,
        Fields: {
          Key: `${this.storageConfig.uploadFolder}/${fileName}`
        }
      }, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            generatedFileName: fileName,
            fileUrl: `${this.storageConfig.pullZone}/${fileName}`,
            awsS3Data: data,
          });
        }
      });
    });
  }

  deleteFile(file) {
    const {uploadedFileName} = file;
    const {bucket, uploadFolder} = this.storageConfig;

    return new Promise((resolve, reject) => {
      this.s3Storage.deleteObject({
        Bucket: bucket,
        Delete: {Objects: {Key: `${uploadFolder}/${uploadedFileName}`}},
      }, async (err, data) => err ? reject(err) : resolve(data))
    });
  }
}

module.exports = AwsS3FileStorage;

// credentialConfig format:
// {
//     accessKeyId: process.env.AWS_ACCESS_KEY,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//     region: process.env.AWS_REGION,
//     signatureVersion: process.env.AWS_SIGNATURE_VERSION || 'v4'
//   }

// storageConfig format:
// {
//   bucket: 'bucketName',
//   uploadFolder: 'folderName',
//   expiryTime: 3600,
//   pullZone: 'https://cdn-url.com',
// }
