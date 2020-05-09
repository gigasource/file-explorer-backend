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

async function listFoldersByFolder(folderPath, namespace) {
  if (!folderPath.endsWith('/')) folderPath += '/';

  return getFileMetadataStorage().findFileMetadatas(transformExternal(
      {
        folderPath,
        isFolder: true,
        ...(namespace ? {namespace} : {}),
      }
  ));
}

async function constructFolderTree(namespace) {
  const foldersAtRoot = await listFoldersByFolder('/', namespace);

  async function traverseFolderList(folderList) {
    const list = [];

    for (const f of folderList) {
      const folderName = f.fileName;
      const folderPath = f.folderPath;
      const childrenFolders = await listFoldersByFolder(folderPath + folderName, namespace);
      const folders = await traverseFolderList(childrenFolders);

      list.push({
        folderName, folderPath, folders,
      });
    }

    return list.sort((a, b) => a.folderName > b.folderName);
  }

  return [{
    folderName: '/',
    folders: await traverseFolderList(transformInternal(foldersAtRoot))
  }]
}

/* Keep the code for future use (append folder tree instead of generating the whole tree)
async function constructFolderTree2(folderPath, namespace) {
  if (!folderPath.endsWith('/')) folderPath += '/';

  const folderArray = [];
  const treePathIdentifier = 'folders';
  // let selectedTreePath = `${treePathIdentifier}.0`;
  let selectedFolder;

  const paths = folderPath.split('/');
  paths.pop();
  const currentPathArray = [];

  while (paths.length > 0) {
    currentPathArray.push(paths.shift());
    let currentPath = currentPathArray.join('/');
    if (!currentPath.endsWith('/')) currentPath += '/';

    let folders = await listFilesByFolder(currentPath, namespace);
    folders = folders.map((f, index) => {
      const folderNames = f.folderPath.split('/');
      const selected = f.folderPath + f.fileName + '/' === folderPath

      const folderInfo = {
        folderName: f.fileName,
        folderPath: f.folderPath,
        parentFolderName: f.folderPath === '/' ? '/' : folderNames[folderNames.length - 2],
        treePath: `${treePathIdentifier}.${index}`,
        ...(selected ? {selected} : {}),
      };

      if (selected) selectedFolder = folderInfo;

      return folderInfo;
    })

    folderArray.push(folders);
  }

  while (folderArray.length > 1) {
    let folders = folderArray.pop() || [];
    if (folders.length === 0) continue;

    const parentFolder = folderArray[folderArray.length - 1].find(f => f.folderName === folders[0].parentFolderName);
    folders = folders.forEach(f => {
    })
    parentFolder.folders = folders;
  }

  return {
    folderTree: [{
      folderName: '/',
      treePath: `${treePathIdentifier}.0`,
      folders: folderArray[0],
    }],
    selectedFolder,
    // selectedTreePath,
  };
}
*/

module.exports = {
  createFolder,
  listFilesByFolder,
  findFolder,
  constructFolderTree,
};
