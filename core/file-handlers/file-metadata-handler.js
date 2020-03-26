const {getFileMetadataStorage} = require('../util/dependencies');
const {transformExternal, transformInternal} = require('../util/property-mapping');
const {ERROR_CODE, constructError} = require('../util/errors');

async function findFileByFullPath(fullPath, namespace) {
  const paths = fullPath.split('/');
  let fileName = paths.pop();
  if (fileName.trim().length === 0) fileName = paths.pop();
  let folderPath = paths.join('/');
  if (!folderPath.endsWith('/')) folderPath += '/';

  let returnedFile = await getFileMetadataStorage().findFileMetadata(transformExternal({
    fileName, folderPath,
    ...(namespace ? {namespace} : {}),
  }));

  return transformInternal(returnedFile)
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
    f = transformInternal(f)
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
  return await getFileMetadataStorage().createFileMetadata(transformExternal(file));
}

async function findFileMetadataById(fileId, namespace) {
  const file = await getFileMetadataStorage().findFileMetadata(transformExternal({
    _id: fileId,
    ...(namespace ? {namespace} : {}),
  }));

  return file ? transformInternal(file) : null;
}

async function deleteFileMetadataById(fileId, namespace) {
  let editedFile = await getFileMetadataStorage().findFileMetadata({
    _id: fileId,
    ...(namespace ? {namespace} : {}),
  });
  editedFile = transformInternal(editedFile)

  if (editedFile.isFolder) {
    await getFileMetadataStorage().deleteFileMetadata(transformExternal({
      folderPath: editedFile.folderPath + editedFile.fileName + '/',
      ...(namespace ? {namespace} : {}),
    }));
  }

  return await getFileMetadataStorage().deleteFileMetadata(transformExternal({
    _id: fileId,
    ...(namespace ? {namespace} : {}),
  }));
}

async function editFileMetadataById(fileId, newValues, namespace) {
  if (newValues.fileName) await renameFileMetadata(fileId, newValues.fileName, namespace);
  if (newValues.folderPath) await moveFileMetadata(fileId, newValues.folderPath, namespace);

  return await getFileMetadataStorage().editFileMetadata(transformExternal({
    _id: fileId,
    ...(namespace ? {namespace} : {}),
  }), transformExternal(newValues));
}

async function renameFileMetadata(fileId, newFileName, namespace) {
  // check if new name has duplicates -> if yes throw an error
  let editedFile = await getFileMetadataStorage().findFileMetadata({
    _id: fileId,
    ...(namespace ? {namespace} : {}),
  });
  editedFile = transformInternal(editedFile)

  const filesWithSameName = await getFileMetadataStorage().findFileMetadatas(transformExternal({
    fileName: newFileName,
    folderPath: editedFile.folderPath,
    ...(namespace ? {namespace} : {}),
  }))

  if (filesWithSameName && filesWithSameName.length > 0) throw constructError(ERROR_CODE.RENAME_FILE_DUPLICATED_FILE)

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
  let editedFile = await getFileMetadataStorage().findFileMetadata({
    _id: fileId,
    ...(namespace ? {namespace} : {}),
  });
  editedFile = transformInternal(editedFile)

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
  createUniqueFileName,
  findFileMetadataById,
  deleteFileMetadataById,
  editFileMetadataById,
  findFileByFullPath,
  renameFileMetadata,
  moveFileMetadata,
};
