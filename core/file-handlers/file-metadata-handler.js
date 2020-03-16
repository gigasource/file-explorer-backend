const {getFileMetadataStorage} = require('../util/dependencies');
const {transformExternal} = require('../util/property-mapping');
const {ERROR_CODE, constructError} = require('../util/errors');

function findFileByFullPath(fullPath, namespace) {
  const paths = fullPath.split('/');
  let fileName = paths.pop();
  if (fileName.trim().length === 0) fileName = paths.pop();
  let folderPath = paths.join('/');
  if (!folderPath.endsWith('/')) folderPath += '/';

  return getFileMetadataStorage().findFileMetadata(transformExternal({
    fileName, folderPath,
    ...(namespace ? {namespace} : {}),
  }));
}

async function createUniqueFileName(file) {
  if (!file.folderPath.endsWith('/')) file.folderPath += '/';

  let newFileName = file.fileName;
  let f = await getFileMetadataStorage().findFileMetadata(transformExternal({
    fileName: newFileName,
    folderPath: file.folderPath,
  }), file.namespace);
  let duplicateIdentifier = 1;

  while (f) {
    const nameParts = file.fileName.split('.');
    if (nameParts.length > 1) {
      nameParts[nameParts.length - 2] += ` (${duplicateIdentifier++})`;
    } else {
      nameParts[0] += ` (${duplicateIdentifier++})`;
    }

    newFileName = nameParts.join('.');
    //example: test.png, test (1).png, test (2).png
    f = await getFileMetadataStorage().findFileMetadata(transformExternal({
      fileName: newFileName,
      folderPath: file.folderPath,
    }), file.namespace);
  }

  return newFileName
}

async function createFileMetadata(file) {
  if (!file.folderPath.endsWith('/')) file.folderPath += '/';
  file.fileName = await createUniqueFileName(file);
  return getFileMetadataStorage().createFileMetadata(transformExternal(file));
}

function findFileMetadataById(fileId, namespace) {
  const file = getFileMetadataStorage().findFileMetadata({
    _id: fileId,
    ...(namespace ? {namespace} : {}),
  });

  return file ? file : null;
}

async function deleteFileMetadataById(fileId, namespace) {
  const editedFile = await getFileMetadataStorage().findFileMetadata({
    _id: fileId,
    ...(namespace ? {namespace} : {}),
  });

  if (editedFile.isFolder) {
    await getFileMetadataStorage().deleteFileMetadata({
      folderPath: editedFile.folderPath + editedFile.fileName + '/',
      ...(namespace ? {namespace} : {}),
    });
  }

  return getFileMetadataStorage().deleteFileMetadata({
    _id: fileId,
    ...(namespace ? {namespace} : {}),
  });
}

async function editFileMetadataById(fileId, newValues, namespace) {
  if (newValues.fileName) await renameFileMetadata(fileId, newValues.fileName, namespace);
  if (newValues.folderPath) await moveFileMetadata(fileId, newValues.folderPath, namespace);

  return await getFileMetadataStorage().editFileMetadata({
    _id: fileId,
    ...(namespace ? {namespace} : {}),
  }, transformExternal(newValues));
}

async function renameFileMetadata(fileId, newFileName, namespace) {
  // check if new name has duplicates -> if yes throw an error
  const filesWithSameName = await getFileMetadataStorage().findFileMetadatas(transformExternal({
    fileName: newFileName,
    ...(namespace ? {namespace} : {}),
  }))

  if (filesWithSameName && filesWithSameName.length > 0) throw constructError(ERROR_CODE.RENAME_FILE_DUPLICATED_FILE)

  const editedFile = await getFileMetadataStorage().findFileMetadata({
    _id: fileId,
    ...(namespace ? {namespace} : {}),
  });

  // if a folder name is edited -> update folderPath of children files
  if (editedFile.isFolder) {
    await getFileMetadataStorage().editFileMetadata(
        transformExternal({
          folderPath: editedFile.folderPath + editedFile.fileName + '/',
          ...(namespace ? {namespace} : {}),
        }),
        transformExternal({
          folderPath: editedFile.folderPath + newFileName + '/',
        }));
  }
}

async function moveFileMetadata(fileId, newFolderPath, namespace) {
  const editedFile = await getFileMetadataStorage().findFileMetadata({
    _id: fileId,
    ...(namespace ? {namespace} : {}),
  });

  // check if new folder has duplicates -> if yes throw an error
  const filesWithSameName = await getFileMetadataStorage().findFileMetadatas(transformExternal({
    fileName: editedFile.fileName,
    folderPath: newFolderPath,
    ...(namespace ? {namespace} : {}),
  }));

  if (filesWithSameName && filesWithSameName.length > 0) throw constructError(ERROR_CODE.MOVE_FILE_DUPLICATED_FILE);

  // if a folder name is edited -> update folderPath of children files
  if (editedFile.isFolder) {
    await getFileMetadataStorage().editFileMetadata(
        transformExternal({
          folderPath: editedFile.folderPath + editedFile.fileName + '/',
          ...(namespace ? {namespace} : {}),
        }),
        transformExternal({
          folderPath: newFolderPath + editedFile.fileName + '/',
        }));
  }
}

module.exports = {
  createFileMetadata,
  findFileMetadataById,
  deleteFileMetadataById,
  createUniqueFileName,
  findFileByFullPath,
  editFileMetadataById,
  renameFileMetadata,
  moveFileMetadata,
};
