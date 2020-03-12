function initHandlers(options) {
  const {getFileStorage} = require('../util/dependencies');
  const fileStorage = getFileStorage();
  const {pullZone} = options;
  const {createFolder, listFilesByFolder, findFolder} = require('../file-handlers/folder-handler');
  const {createFileWithMappings} = require('../util/property-mapping');
  const {createFileMetadata, getFileMetadataById, deleteFileMetadataById, getFileByFullPath} = require('../file-handlers/file-metadata-handler');
  const path = require('path');
  const uuidv1 = require('uuid/v1');

  const MulterStorageEngine = require('../multer-storage-engine');
  const multerStorageEngine = new MulterStorageEngine(options);
  const upload = require('multer')({storage: multerStorageEngine});

  async function validateFolderPath(folderPath, namespace, res) {
    if (!folderPath || folderPath.trim().length === 0) {
      res.status(400).json({error: `Invalid request: missing folder path in request`});
      return false;
    }
    if (!(await findFolder(folderPath, namespace))) {
      res.status(400).json({error: `Invalid request: folder ${folderPath} does not exist`});
      return false;
    }

    return true;
  }

  async function uploadFile(req, res) {
    const folderPath = req.query.folderPath || req.body.folderPath;
    if (!(await validateFolderPath(folderPath, req.namespace, res))) return;

    upload.any()(req, res, async function () {
      let uploadResults = [];
      let successCount = 0;

      for (const file of req.files) {
        const {fileId, filePath, chunksInfo, storageErrors} = file;
        const createdFile = await createFileMetadata(file);

        if (file.uploadSuccess) {
          successCount++;
          uploadResults.push({uploadSuccess: true, createdFile});
        } else uploadResults.push({uploadSuccess: false, file: file.originalname});
      }

      const statusCode = successCount > 0 ? 200 : 500;
      if (successCount === 0) uploadResults = {
        success: false,
        message: 'No file was uploaded'
      };

      res.status(statusCode).json(uploadResults);
    });
  }

  async function downloadFile(req, res) {
    const {filePath} = req.params;
    let fileMetadata = await getFileByFullPath(filePath, req.namespace);
    fileMetadata = createFileWithMappings(fileMetadata);

    if (!fileMetadata) {
      return res.status(404).json({error: `File with path ${filePath} not found`});
    }

    const fileReadStream = await getFileStorage().downloadFile(fileMetadata.fileId);

    res.setHeader('Content-Type', fileMetadata.mimeType);
    res.setHeader('Content-Length', fileMetadata.sizeInBytes);
    res.status(200);

    fileReadStream.pipe(res);
  }

  async function getUploadFileUrl(req, res) {
    if (!(await validateFolderPath(req.query.folderPath, req.namespace, res))) return;

    let {fileName} = req.query;
    if (!fileName || fileName.trim().length === 0) return res.status(400).json({error: 'Invalid request: file name can not be empty'});

    fileName = `${uuidv1()}${path.extname(fileName)}`;

    try {
      const uploadData = fileStorage.getFileUploadUrl(fileName);
      res.send(200).json(uploadData);
    } catch (e) {
      console.error(e);
      res.send(500).send();
    }
  }

  async function createFile(req, res) {
    if (!(await validateFolderPath(req.body.folderPath, req.namespace, res))) return;

    // req.body:
    // {
    //   fileName, folderPath, mimeType, sizeInBytes
    // }

    try {
      await createFileMetadata({
        ...req.body,
        ...(req.namespace ? {namespace: req.namespace} : {}),
      });

      res.status(201).send();
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  }

  async function removeFile(req, res) {
    const {fileId} = req.params;
    const file = await getFileMetadataById(fileId, req.namespace);

    if (!file) return res.status(404).json({error: `No file with ID ${fileId} found`});

    try {
      await fileStorage.deleteFile(createFileWithMappings(file));
      await deleteFileMetadataById(fileId, req.namespace);
      res.status(204).send();
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  }

  async function getFileMetadata(req, res) {
    const {fileId} = req.params;
    const file = await getFileMetadataById(fileId, req.namespace);
    file.fileUrl = `${pullZone}/${file.uploadedFileName}`;

    if (!file) res.status(404).json({error: `No file with ID ${fileId} found`});
    else res.status(200).json(file);
  }

  async function createFolderHandler(req, res) {
    let {folderName, folderPath} = req.body;
    if (!folderName || !folderPath) return res.status(400).json({error: 'folderName and folderPath can not be empty'});

    if (folderName !== '/' && folderPath !== '/') {
      const existingFolder = await findFolder(folderPath, req.namespace);
      if (!existingFolder) return res.status(400).json({error: `Invalid request: folder ${folderPath} does not exist`});
    }

    try {
      const result = await createFolder(folderName, folderPath, req.namespace);

      if (!result) return res.status(400).json({error: `Folder ${folderName} already existed in path ${folderPath}`});
      else return res.status(201).json();
    } catch (e) {
      res.status(500).send(e);
    }
  }

  async function listFilesByFolderHandler(req, res) {
    let {folderPath} = req.query;
    if (!(await validateFolderPath(req.query.folderPath, req.namespace, res))) return;

    try {
      let files = (await listFilesByFolder(folderPath, req.namespace)) || [];

      files = files.map(file => {
        const fileUrl = `${pullZone}/${file.uploadedFileName}`;
        return {...file, fileUrl};
      });

      res.status(200).json(files);
    } catch (e) {
      console.error(e);
      res.status(500).send(e);
    }
  }

  return {
    getUploadFileUrl,
    removeFile,
    createFileMetadata: createFile,
    getFileMetadata,
    createFolder: createFolderHandler,
    listFilesByFolder: listFilesByFolderHandler,
    uploadFile,
    downloadFile,
  }
}

module.exports = initHandlers;
