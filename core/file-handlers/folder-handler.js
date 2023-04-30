const {getFileMetadataStorage} = require('../util/dependencies');
const {transformExternal, transformInternal} = require('../util/property-mapping');
const {createUniqueFileName} = require('./file-metadata-handler');
const {extractFilePath} = require('../util/file-path');

async function findFolder(fullPath, namespace) {
  const {fileName: folderName, folderPath} = extractFilePath(fullPath)

  return await _findFolder(folderName, folderPath, namespace);
}

async function _findFolder(folderName, folderPath, namespace) {
  if (!folderPath.endsWith('/')) folderPath += '/';
  folderName = folderName.replace(/\//g, '');

  if (folderName.trim() === '' && folderPath === '/') return true; // special case: root folder '/' is always considered existed

  const existingFile = await getFileMetadataStorage().findFileMetadata(transformExternal({
    fileName: folderName,
    folderPath,
    ...(namespace ? {namespace} : {}),
  }));
  if (existingFile && existingFile.isFolder) return existingFile;
  else return null;
}


async function createFolder(folderName, folderPath, namespace) {
  if (!folderPath.endsWith('/')) folderPath += '/';
  folderName = folderName.replace(/\//g, '');
  folderName = await createUniqueFileName({fileName: folderName, folderPath, namespace});

  const existingFolder = await _findFolder(folderName, folderPath, namespace);
  if (existingFolder) return false;
  else return getFileMetadataStorage().createFolder(transformExternal({
    fileName: folderName,
    folderPath,
    ...(namespace ? {namespace} : {}),
  }));
}

async function listFilesByFolder(folderPath, namespace) {
  if (!folderPath.endsWith('/')) folderPath += '/';

  return getFileMetadataStorage().findFileMetadatas(transformExternal({
    folderPath,
    ...(namespace ? {namespace} : {}),
  }));
}

async function constructFolderTree(namespace) {
  const maps = {
    '/': {folderName: '/', folderPath: '/', folders: [] }
  }
  const folders = await getFileMetadataStorage().findFileMetadatas(transformInternal({
    isFolder: true,
    ...(namespace ? {namespace} : {})
  }))
  for (const folder of folders) {
    const myPath = `${folder.folderPath}${folder.fileName}/`;
    if (!maps[myPath]) {
      maps[myPath] = {
        folderName: folder.fileName,
        folderPath: folder.folderPath,
        folders: []
      }
    }
    const myNode = maps[myPath]
    // for some reasons, the parent folder record is lie after the child
    // so when we visit the child, the parent node is not exist yet
    // that why we need to placeholder first, then refill the data later
    if (myNode.isPlaceholder) {
      myNode.folderName = folder.fileName
      myNode.folderPath = folder.folderPath
      delete myNode.isPlaceholder
    }
    if (!maps[folder.folderPath]) {
      maps[folder.folderPath] = {
        isPlaceholder: true,
        folders: []
      }
    }
    const parentNode = maps[folder.folderPath]
    parentNode.folders.push(myNode)
  }
  return [maps['/']]
}

module.exports = {
  createFolder,
  listFilesByFolder,
  findFolder,
  constructFolderTree,
};
