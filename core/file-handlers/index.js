function initHandlers(options) {
  const {getFileStorage} = require('../util/dependencies');
  const fileStorage = getFileStorage();
  const {createFolder, listFilesByFolder, findFolder, constructFolderTree} = require('../file-handlers/folder-handler');
  const {transformExternal} = require('../util/property-mapping');
  const {
    createFileMetadata, findFileMetadataById, findFileMetadataByFilePath, deleteFileMetadataById,
    findFileByFullPath, editFileMetadataById, createUniqueFileName,
  } = require('../file-handlers/file-metadata-handler');
  const path = require('path');
  const uuidv1 = require('uuid/v1');

  const MulterStorageEngine = require('../multer-storage-engine');
  const multerStorageEngine = new MulterStorageEngine(options);
  const upload = require('multer')({storage: multerStorageEngine});
  const sharp = require('sharp');
  const fresh = require('fresh');

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
  async function getFileUploadUrl(req, res) {
    const folderPath = req.query.folderPath;
    if (!(await validateFolderPath(folderPath, req.namespace, res))) return;

    let {fileName} = req.query;
    if (!fileName || fileName.trim().length === 0) return res.status(400).json({error: 'Invalid request: file name can not be empty'});

    const generatedFileName = `${uuidv1()}${path.extname(fileName)}`;

    try {
      const uploadData = await fileStorage.getFileUploadUrl(generatedFileName);
      res.status(200).json({
        generatedFileName,
        originalFileName: await createUniqueFileName({fileName, folderPath}),
        ...uploadData
      });
    } catch (e) {
      console.error(e);
      res.status(500).send();
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

  // 2. functions used specifically for direct storage such as BunnyCDN or GridFS, the files goes through the server so Multer is needed
  async function uploadFile(req, res) {
    const folderPath = req.query.folderPath;
    if (!(await validateFolderPath(folderPath, req.namespace, res))) return;

    upload.any()(req, res, async function () {
      let uploadResults = [];
      let successCount = 0;

      for (const file of req.files) {
        const createdFile = await createFileMetadata(file, req.query.overwrite);

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
    await getFileByFilePath(req, res, 'download')
  }

  async function viewFileByFilePath(req, res) {
    await getFileByFilePath(req, res, 'view')
  }

  async function getFileByFilePath(req, res, action) {
    let {w, h, cacheMaxAge = 86400 * 3} = req.query;
    let {filePath} = req.params;
    const responseHeaders = {};
    const requestHeaders = req.headers;
    if (!filePath.startsWith('/')) filePath = '/' + filePath

    let fileMetadata = await findFileByFullPath(filePath, req.namespace);
    if (!fileMetadata) return res.status(404).json({error: `File with path ${filePath} not found`});

    const fileMd5 = await getFileStorage().getFileMd5(transformExternal(fileMetadata));
    const fileReadStream = await getFileStorage().downloadFile(transformExternal(fileMetadata));

    responseHeaders['Etag'] = fileMd5;
    responseHeaders['Accept-Ranges'] = 'bytes';
    responseHeaders['Content-Type'] = fileMetadata.mimeType;
    responseHeaders['X-Content-Type-Options'] = 'nosniff';
    if (fileMetadata.updatedAt) responseHeaders['Last-Modified'] = fileMetadata.updatedAt;
    if (action === 'download') responseHeaders['Content-disposition'] = 'attachment; filename=' + fileMetadata.fileName;
    if (fresh(requestHeaders, responseHeaders)) return res.status(304).end()

    if (fileMetadata.mimeType && fileMetadata.mimeType.startsWith('image/')) {
      if (cacheMaxAge > 0) res.setHeader('Cache-Control', `public, max-age=${cacheMaxAge}`);
      else res.setHeader('Cache-Control', 'no-store');

      const resizeOptions = {fit: 'fill'};

      if (w || h) {
        if (w) {
          w = parseInt(w);
          if (isNaN(w)) return res.status(400).json({error: 'w query must be a number'});
          resizeOptions.width = w;
        }

        if (h) {
          h = parseInt(h);
          if (isNaN(h)) return res.status(400).json({error: 'h query must be a number'});
          resizeOptions.height = h;
        }

        Object.keys(responseHeaders).forEach(key => res.setHeader(key, responseHeaders[key]));
        res.status(200);
        fileReadStream.pipe(sharp().resize(resizeOptions)).pipe(res);
        return;
      }
    }

    Object.keys(responseHeaders).forEach(key => res.setHeader(key, responseHeaders[key]));
    res.status(200);
    res.setHeader('Content-Length', fileMetadata.sizeInBytes);
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

  async function deleteFileByFilePath(req, res) {
    const {filePath} = req.params;
    const fileMetadata = await findFileMetadataByFilePath(filePath, req.namespace);
    if (!fileMetadata) return res.status(404).json({error: `No file with path ${filePath} found`});

    try {
      if (fileMetadata.isFolder) {
        const filesInFolder = await listFilesByFolder(fileMetadata.folderPath + fileMetadata.fileName + '/', req.namespace);
        for (let f of filesInFolder) {
          await fileStorage.deleteFile(transformExternal(f));
        }
      } else {
        await fileStorage.deleteFile(transformExternal(fileMetadata));
      }

      await deleteFileMetadataById(fileMetadata._id.toString(), req.namespace);
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

  function getPropertyMappings(req, res) {
    res.status(200).json(options.propertyMappings || {})
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
    createFileMetadata: createFileMetadataHandler,
    createFolder: createFolderHandler,
    deleteFile: deleteFileHandler,
    deleteFileByFilePath,
    downloadFileByFilePath,
    getFileMetadata,
    getFileUploadUrl,
    getFolderTree,
    listFilesByFolder: listFilesByFolderHandler,
    moveFileMetadata,
    renameFileMetadata,
    uploadFile,
    viewFileByFilePath,
    getPropertyMappings,
  }
}

module.exports = initHandlers;
