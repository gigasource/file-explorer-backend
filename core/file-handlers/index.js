function initHandlers(options) {
  const {getFileStorage} = require('../util/dependencies');
  const fileStorage = getFileStorage();
  const {createFolder, listFilesByFolder, findFolder, constructFolderTree} = require('../file-handlers/folder-handler');
  const {transformExternal} = require('../util/property-mapping');
  const {
    createFileMetadata, findFileMetadataById, deleteFileMetadataById,
    findFileByFullPath, editFileMetadataById
  } = require('../file-handlers/file-metadata-handler');
  const path = require('path');
  const uuidv1 = require('uuid/v1');

  const MulterStorageEngine = require('../multer-storage-engine');
  const multerStorageEngine = new MulterStorageEngine(options);
  const upload = require('multer')({storage: multerStorageEngine});

  // helper functions
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

  // 1. functions used specifically for indirect storage like Amazon S3 since client does the file uploading instead of server
  async function getUploadFileUrl(req, res) {
    if (!(await validateFolderPath(req.query.folderPath, req.namespace, res))) return;

    let {fileName} = req.query;
    if (!fileName || fileName.trim().length === 0) return res.status(400).json({error: 'Invalid request: file name can not be empty'});

    fileName = `${uuidv1()}${path.extname(fileName)}`;

    try {
      const uploadData = await fileStorage.getFileUploadUrl(fileName);
      res.send(200).json(uploadData);
    } catch (e) {
      console.error(e);
      res.send(500).send();
    }
  }

  // This function is used after the file is uploaded to S3 successfully to insert file metadata into database
  async function createFileMetadataHandler(req, res) {
    if (!(await validateFolderPath(req.body.folderPath, req.namespace, res))) return;

    try {
      await createFileMetadata({
        ...req.body,
        ...(req.namespace ? {namespace: req.namespace} : {}),
      });

      res.status(201).send();
    } catch (e) {
      console.error(e);
      res.status(500).send();
    }
  }

  // 2. functions used specifically for direct storage such as BunnyCDN or GridFS, the file goes through the server so Multer is needed
  async function uploadFile(req, res) {
    const folderPath = req.query.folderPath;
    if (!(await validateFolderPath(folderPath, req.namespace, res))) return;

    upload.any()(req, res, async function () {
      let uploadResults = [];
      let successCount = 0;

      for (const file of req.files) {
        // const {fileId, filePath, chunksInfo, storageErrors} = file;
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

  async function downloadFileByFilePath(req, res) {
    const {filePath} = req.params;
    let fileMetadata = await findFileByFullPath(filePath, req.namespace);

    if (!fileMetadata) return res.status(404).json({error: `File with path ${filePath} not found`});

    const fileReadStream = await getFileStorage().downloadFile(transformExternal(fileMetadata));

    res.setHeader('Content-Type', fileMetadata.mimeType);
    res.setHeader('Content-Length', fileMetadata.sizeInBytes);
    res.status(200);

    fileReadStream.pipe(res);
  }

  // 3. common functions
  async function listFilesByFolderHandler(req, res) {
    let {folderPath} = req.query;
    if (!(await validateFolderPath(req.query.folderPath, req.namespace, res))) return;

    try {
      let files = (await listFilesByFolder(folderPath, req.namespace)) || [];
      res.status(200).json(transformExternal(files));
    } catch (e) {
      console.error(e);
      res.status(500).send();
    }
  }

  async function getFileMetadata(req, res) {
    const {id} = req.params;
    const file = await findFileMetadataById(id, req.namespace);

    if (!file) res.status(404).json({error: `No file with ID ${id} found`});
    else res.status(200).json(file);
  }

  async function createFolderHandler(req, res) {
    let {folderName, folderPath} = req.body;
    if (!folderName || !folderPath) return res.status(400).json({error: 'folder name and folder path can not be empty'});

    if (folderName !== '/' && folderPath !== '/') {
      const existingFolder = await findFolder(folderPath, req.namespace);
      if (!existingFolder) return res.status(400).json({error: `Invalid request: folder ${folderPath} does not exist`});
    }

    try {
      const result = await createFolder(folderName, folderPath, req.namespace);

      if (!result) return res.status(400).json({error: `Folder ${folderName} already existed in path ${folderPath}`});
      else return res.status(201).send();
    } catch (e) {
      res.status(500).send();
    }
  }

  async function deleteFileHandler(req, res) {
    const {id} = req.params;
    const fileMetadata = await findFileMetadataById(id, req.namespace);

    if (!fileMetadata) return res.status(404).json({error: `No file with ID ${id} found`});

    try {
      if (fileMetadata.isFolder) {
        const filesInFolder = await listFilesByFolder(fileMetadata.folderPath + fileMetadata.fileName + '/', req.namespace);
        for (let f of filesInFolder) {
          await fileStorage.deleteFile(transformExternal(f));
        }
      } else {
        await fileStorage.deleteFile(transformExternal(fileMetadata));
      }

      await deleteFileMetadataById(id, req.namespace);
      res.status(204).send();
    } catch (e) {
      console.error(e);
      res.status(500).send();
    }
  }

  async function fileExists(id, req, res) {
    const file = await findFileMetadataById(id, req.namespace);
    if (!file) {
      res.status(404).json({error: 'Requested file does not exist'});
      return false;
    }
    return true;
  }

  async function renameFileMetadata(req, res) {
    const {newFileName} = req.body;
    const {id} = req.params;

    if (!id || !newFileName) return res.status(400).json({error: 'Missing required property: file ID or new file name not found'})

    if (!(await fileExists(id, req, res))) return

    try {
      const result = await editFileMetadataById(id, {fileName: newFileName});
      res.status(200).json(result);
    } catch (e) {
      handleError(e, res);
    }
  }

  async function moveFileMetadata(req, res) {
    const {newFolderPath} = req.body;
    const {id} = req.params;

    if (!id || !newFolderPath) return res.status(400).json({error: 'Missing required property: file ID or new folder path not found'})

    if (!(await fileExists(id, req, res))) return

    try {
      const result = await editFileMetadataById(id, {folderPath: newFolderPath});
      res.status(200).json(result);
    } catch (e) {
      handleError(e, res);
    }
  }

  async function getFolderTree(req, res) {
    try {
      const folderTree = await constructFolderTree(req.namespace);
      res.status(200).json(folderTree);
    } catch (e) {
      console.error(e);
      res.status(500).send();
    }
  }

  function handleError(e, res) {
    console.error(e);
    e.code
        ? res.status(500).json({
          error: e.message
        })
        : res.status(500).send();
  }

  return {
    getUploadFileUrl,
    deleteFile: deleteFileHandler,
    createFileMetadata: createFileMetadataHandler,
    getFileMetadata,
    createFolder: createFolderHandler,
    listFilesByFolder: listFilesByFolderHandler,
    uploadFile,
    downloadFileByFilePath,
    getFolderTree,
    renameFileMetadata,
    moveFileMetadata,
  }
}

module.exports = initHandlers;
