const {getFileMetadataStorage} = require('../util/dependencies');
const {transformExternal} = require('../util/property-mapping');

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

async function findFileMetadataByNameAndFolder(fileName, folderPath, namespace) {
  if (!folderPath.endsWith('/')) folderPath += '/';

  return getFileMetadataStorage().findFileMetadata(transformExternal({
    fileName,
    folderPath,
    ...(namespace ? {namespace} : {}),
  }));
}

async function createUniqueFileName(file) {
  let newFileName = file.fileName;
  let f = await findFileMetadataByNameAndFolder(newFileName, file.folderPath, file.namespace);
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
    f = await findFileMetadataByNameAndFolder(newFileName, file.folderPath, file.namespace);
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

function deleteFileMetadataById(fileId, namespace) {
  return getFileMetadataStorage().deleteFileMetadata({
    _id: fileId,
    ...(namespace ? {namespace} : {}),
  });
}

async function editFileMetadataById(fileId, newValues, namespace) {
  // if fileName is edited -> check if new name has duplicates -> if yes return null to handle error
  if (newValues.fileName) {
    const filesWithSameName = await getFileMetadataStorage().findFileMetadatas(transformExternal({
      fileName: newValues.fileName,
      ...(namespace ? {namespace} : {}),
    }))

    if (filesWithSameName && filesWithSameName.length > 0) return null;
  }

  const editedFile = await getFileMetadataStorage().findFileMetadata({
    _id: fileId,
    ...(namespace ? {namespace} : {}),
  });

  const editResult = await getFileMetadataStorage().editFileMetadata({
    _id: fileId,
    ...(namespace ? {namespace} : {}),
  }, transformExternal(newValues));

  // if a folder name is edited -> update folderPath of children files
  if (editedFile.isFolder && newValues.fileName) {
    await getFileMetadataStorage().editFileMetadata(
        transformExternal({
          folderPath: editedFile.folderPath + editedFile.fileName + '/',
          ...(namespace ? {namespace} : {}),
        }),
        transformExternal({
          folderPath: editedFile.folderPath + newValues.fileName + '/',
        }));
  }

  return editResult
}

module.exports = {
  createFileMetadata,
  findFileMetadataById,
  deleteFileMetadataById,
  createUniqueFileName,
  findFileByFullPath,
  editFileMetadataById,
};
