const chai = require('chai');
const expect = chai.expect;
const mongoose = require('mongoose');
const startExpressServer = require('../express-backend');
const axios = require('axios');
const uuidv1 = require('uuid/v1');
const FormData = require('form-data');
const fs = require('fs');
const http = require('http');

describe('File explorer backend library with GridFS storage tests', function () {
  let expressServer;
  const host = 'localhost';
  const expressPort = 3030;
  const baseApiUrl = `http://${host}:${expressPort}`;
  const mongooseConnectionUrl = `mongodb://${host}/grid_fs_unit_test_db_${uuidv1()}`;

  function setupEnvironment() {
    expressServer = startExpressServer({
      mongooseConnectionUrl,
      expressPort,
      // namespaceHeader: 'userNamespace' // use this to enable namespace
    });
  }

  before(function () {
    setupEnvironment();
  });

  after(function () {
    expressServer.close(function () {
      mongoose.connection.db.dropDatabase();
      mongoose.connection.close();
    });
  });

  describe('createFolder API', function () {
    it('should return error if request body does not have folderName or folderPath', async function () {
      const reqBody1 = {folderPath: '/'};
      const reqBody2 = {folderName: 'documents'};
      const reqBody3 = {};

      try {
        await axios.post(`${baseApiUrl}/folders`, reqBody1);
        expect(1).to.equal(2); // code should not reach this line
      } catch (e) {
        expect(e.response.status).to.equal(400);
      }

      try {
        await axios.post(`${baseApiUrl}/folders`, reqBody2);
        expect(1).to.equal(2); // code should not reach this line
      } catch (e) {
        expect(e.response.status).to.equal(400);
      }

      try {
        await axios.post(`${baseApiUrl}/folders`, reqBody3);
        expect(1).to.equal(2); // code should not reach this line
      } catch (e) {
        expect(e.response.status).to.equal(400);
      }
    });

    it('should be able to create a folder if that folder\'s parent folder exists', async function () {
      const createFolderReqBody = {
        folderPath: '/',
        folderName: 'documents',
      };
      const createFolderResponse = await axios.post(`${baseApiUrl}/folders`, createFolderReqBody);
      const {status} = createFolderResponse;
      expect(status).to.equal(201);

      const folderListResponse = await axios.get(`${baseApiUrl}/folders?folderPath=${createFolderReqBody.folderPath}`);
      let {data} = folderListResponse;
      data = data.filter(e => e.folderPath === createFolderReqBody.folderPath && e.fileName === createFolderReqBody.folderName);
      expect(data).to.have.lengthOf(1);
    });

    it('should not be able to create a folder if that folder\'s parent folder does not exists', async function () {
      const createFolderReqBody = {
        folderPath: '/non-existent-folder',
        folderName: 'documents',
      };

      try {
        await axios.post(`${baseApiUrl}/folders`, createFolderReqBody);
        expect(1).to.equal(2); // code should not reach this line
      } catch (e) {
        expect(e.response.status).to.equal(400);
      }

      // parent folder should not be created either
      try {
        await axios.get(`${baseApiUrl}/folders?folderPath=${createFolderReqBody.folderPath}`);
        expect(1).to.equal(2); // code should not reach this line
      } catch (e) {
        expect(e.response.status).to.equal(400);
      }
    });
  });

  describe('uploadFile API', function () {
    async function getFileMetadataById(fileId) {
      const getFileReponse = await axios.get(`${baseApiUrl}/files-metadata/${fileId}`);
      return getFileReponse.data;
    }

    function downloadFile(fileFullPath) {
      return new Promise(resolve => {
        http.get(`${baseApiUrl}/files/${fileFullPath}`, function (res) {
          let fileContent = '';
          let chunkIndex = 0;

          res.on('data', function (buffer) {
            fileContent += buffer.toString();
            console.log(`Received chunk ${chunkIndex++}, length = ${buffer.length / 1024 / 1024} MB`);
          });

          res.on('end', function () {
            resolve(fileContent);
          });
        });
      });
    }

    it('should create a file if that file\'s folder exists', async function () {
      this.timeout(5000);
      // Generate a random string to test
      let testText = '';

      for (let i = 0; i < 200000; i++) {
        testText += uuidv1();
      }

      console.log(`test text length is ${Buffer.byteLength(testText, 'utf8') / 1024 / 1024} MB`);

      // Create a folder on server for the test file
      const createFolderReqBody = {
        folderPath: '/',
        folderName: 'test-upload-file',
      };

      await axios.post(`${baseApiUrl}/folders`, createFolderReqBody);

      // Test uploading file
      const fName = `temp-file-${uuidv1()}.txt`;
      fs.writeFileSync(fName, testText);
      const formData = new FormData();
      formData.append('files', fs.createReadStream(fName));

      const folderToUpload = `${createFolderReqBody.folderPath}${createFolderReqBody.folderName}/`;
      const uploadFileResponse = await axios.post(`${baseApiUrl}/files?folderPath=${folderToUpload}`, formData, {
        headers: formData.getHeaders(),
        maxContentLength: 524288000 // 500MB limit
      });
      fs.unlink(fName, () => {
      });
      const {data} = uploadFileResponse;
      const fileData = data[0]; // test with uploading 1 file only
      const {uploadSuccess, createdFile} = fileData;

      // Test returned metadata
      let {isFolder, fileName, folderPath} = createdFile;
      expect(uploadSuccess).to.equal(true);
      expect(isFolder).to.equal(false);
      expect(fileName).to.equal(fName);
      expect(folderPath).to.equal(folderToUpload);

      // Test stored metadata in database to make sure it matches returned metadata
      const fileMetadata = await getFileMetadataById(createdFile._id);
      ({isFolder, fileName, folderPath} = fileMetadata);
      expect(isFolder).to.equal(false);
      expect(fileName).to.equal(fName);
      expect(folderPath).to.equal(folderToUpload);

      // Download the uploaded file and test its content
      const fileFullPath = `${createFolderReqBody.folderPath}${createFolderReqBody.folderName}/${fName}`;
      const fileContent = await downloadFile(fileFullPath);
      expect(fileContent).to.equal(testText);
    });
  });
});
