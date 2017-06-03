'use babel'
import util from 'util'
import pathUtils from 'path'
import fuzzaldrin from 'fuzzaldrin-plus'
import common from './common.js'
import * as pathResolver from './path-resolver'


/**
 *
 * Keywords mapped by Robot resource files
 * Resource key format:
 * * robot resource - normalized, lower case, absolute path to resource
 *   (ie. /a/b/resource.robot)
 * * physical library - normalized, lower case, absolute path to library
 *   (ie. /a/b/physical-library.py)
 * * normal library - lower case library name
 *   (ie. builtin)
 * Format:
 * {
 *     'builtin': {
 *         resourceKey: 'builtin',
 *         name: 'BuiltIn',
 *         extension: '.xml',
 *         path: '/dir1/dir2/BuiltIn.xml',  # normalized
 *         libraryPath: '/dir1/dir2/BuiltIn.py'
 *         hasTestCases: false,
 *         hasKeywords: true,
 *         isLibrary: true
 *         imports: {
 *           libraries: [{
 *             // 'path' and 'absolutePath' are defined only for physical libraries.
 *             // In addition, 'absolutePath' will not be available if the library
 *             // couldn't be identified on disk.
 *             physical: true/false,
 *             path: 'libraryName.py',    // as found in 'Library' declaration
 *             absolutePath: '/a/b/libraryName.py',
 *             name: 'libraryName',
 *             alias: 'withNameAlias'}, ...],
 *           resources: [{
 *             // 'resourceKey' is undefined if it could not be found in parsed
 *             // resourcesMap
 *             path: 'resource path'  // as found in 'Resource' declaration
 *             name: 'resourceName',
 *             extension: '.robot',
 *             resourceKey: 'resource key'}, ...]
 *         },
 *         keywords: [{
 *                 name: '',
 *                 documentation: '',
 *                 arguments: ['', '', ...],
 *                 rowNo: 0,
 *                 colNo: 0,
 *                 local: true/false # Whether keyword is only visible locally
 *                 resource:{resourceKey: '', ...} // parent resource
 *             }, ...
 *         ],
 *     },
 *     ...
 * }
 */
var resourcesMap = {};

// Keywords mapped by keyword name
var keywordsMap = {};

// Removes keywords depending on resourceFilter.
// Undefined resourceFilter will cause all keywords to be cleared.
var reset = function(resourceFilter) {
  if(resourceFilter){
    resourceFilter = common.getResourceKey(resourceFilter);
    for(var key in resourcesMap){
      if(key.indexOf(resourceFilter)===0){
        delete resourcesMap[key];
      }
    }
  } else{
    clearObj(resourcesMap);
  }
  rebuildKeywordsMap();
}

var resetKeywordsMap = function(resourceKey, keywords){
  resourceKey = common.getResourceKey(resourceKey);
  var newKwList;
  keywords.forEach(function(keyword){
    var kwname = keyword.name.toLowerCase();
    var kwList = keywordsMap[kwname];
    if(kwList){
      newKwList = [];
      kwList.forEach(function(kw){
        if(kw.resource.resourceKey!==resourceKey){
          newKwList.push(kw);
        }
      });
      if(newKwList.length>0){
        keywordsMap[kwname] = newKwList;
      } else{
        delete keywordsMap[kwname];
      }
    }
  });
}

var rebuildKeywordsMap = function(){
  var resourceKey, resource, keywordList;
  clearObj(keywordsMap);
  for(resourceKey in resourcesMap){
    resource = resourcesMap[resourceKey];
    addKeywordsToMap(resource.keywords);
  }
}

var addKeywordsToMap = function(keywords){
  var keywordList;
  keywords.forEach(function(keyword){
    var kwname = keyword.name.toLowerCase();
    keywordList = keywordsMap[kwname];
    if(!keywordList){
      keywordList = []
      keywordsMap[kwname] = keywordList;
    }
    keywordList.push(keyword);
  });
}

var addResource = function(parsedRobotInfo, resourcePath) {
  var resourceName = pathUtils.basename(resourcePath, pathUtils.extname(resourcePath));
  addKeywords(parsedRobotInfo, common.getResourceKey(resourcePath), resourcePath, resourceName)
}

var addLibrary = function(parsedRobotInfo, libdocPath, libraryName, resourceKey, sourcePath) {
  addKeywords(parsedRobotInfo, resourceKey, libdocPath, libraryName, true, sourcePath)
}

// Adds keywords to repository under resource specified by resourceKey.
var addKeywords = function(parsedRobotInfo, resourceKey, path, name, isLibrary = false, libraryPath = undefined) {
  path = pathUtils.normalize(path)
  const extension = pathUtils.extname(path);
  hasTestCases = parsedRobotInfo.testCases.length>0,
  hasKeywords = parsedRobotInfo.keywords.length>0
  const importedResources = parsedRobotInfo.resources.map(res => ({
    name: pathUtils.basename(res.path, pathUtils.extname(res.path)),
    extension: pathUtils.extname(res.path),
    path: res.path
  }))
  const importedLibraries = parsedRobotInfo.libraries.map(lib => {
    const dirname = pathUtils.dirname(path)
    const libPath =lib.physical && lib.path ? pathResolver.resolve(lib.path, dirname, true) : undefined
    return {physical: lib.physical, absolutePath: libPath, path: lib.path, name: lib.name, alias: lib.alias}
  })

  var resource = {
    resourceKey,
    path,
    libraryPath,
    name,
    extension,
    imports: {
      libraries: importedLibraries,
      resources: importedResources
    },
    hasTestCases,
    hasKeywords,
    isLibrary
  }

  // Add some helper properties to each keyword
  for(var i = 0; i<parsedRobotInfo.keywords.length; i++){
    parsedRobotInfo.keywords[i].resource = resource;
    parsedRobotInfo.keywords[i].local = hasTestCases;
  }

  // Populate keywordsMap
  if(resourcesMap[resourceKey]){
    resetKeywordsMap(resourceKey, resourcesMap[resourceKey].keywords);
  }
  addKeywordsToMap(parsedRobotInfo.keywords);

  // Populate resourcesMap
  resourcesMap[resourceKey] = {
    resourceKey,
    name,
    path,
    libraryPath,
    extension,
    keywords: parsedRobotInfo.keywords,
    imports: {
      libraries: importedLibraries,
      resources: importedResources
    },
    hasTestCases,
    hasKeywords,
    isLibrary
  };
  return
}

// Returns a list of keywords scored by query string.
// resourceKeys - Set: limits suggestions to only these resources
// If 'query' is not defined or is '', returns all keywords. Scores will be identical for each entry.
var score = function(query, resourceKeys) {
  query = query || '';
  query = query.trim().toLowerCase();
  var suggestions = [];
  var prepQuery = fuzzaldrin.prepQuery(query);
  for ( var resourceKey in resourcesMap) {
    if(resourceKeys.size>0 && !resourceKeys.has(resourceKey)){
      continue;
    }
    var resource = resourcesMap[resourceKey];
    if (resource) {
      for (var i = 0; i < resource.keywords.length; i++) {
        var keyword = resource.keywords[i];
        var score = query===''?1:fuzzaldrin.score(keyword.name, query, prepQuery); // If query is empty string, we will show all keywords.
        if (score) {
          suggestions.push({
            keyword : keyword,
            score: score
          });
        }
      }
    }
  }

  return suggestions;
};

function printDebugInfo(options) {
  options = options || {
    showLibdocFiles: true,
    showRobotFiles: true,
    showSuggestions: false
  };
  var robotFiles = [], libdocFiles = [];
  var ext;
  for(key in resourcesMap){
    ext = pathUtils.extname(key);
    if(ext==='.xml' || ext==='.html'){
      libdocFiles.push(pathUtils.basename(key));
    } else{
      robotFiles.push(pathUtils.basename(key));
    }
  }
  if(options.showRobotFiles){
    console.log('Autocomplete robot files:' + robotFiles);
  }
  if(options.showLibdocFiles){
    console.log('Autocomplete libdoc files:' + libdocFiles);
  }
  if(options.showSuggestions){
    if(options.resourceKey){
      const resource = resourcesMap[options.resourceKey]
      const suggestions = resource?JSON.stringify(resource, null, 2):`Not found - ${options.resourceKey}`
      console.log(`Suggestions: ${suggestions}`);
    } else {
      console.log('Suggestions: ' + JSON.stringify(resourcesMap, null, 2));
    }
  }
}

var clearObj = function(obj){
  for (var key in obj){
    if (obj.hasOwnProperty(key)){
      delete obj[key];
    }
  }
}

/**
 * Returns Maps of resources grouped by path and by name:
 * {resourcesByName: Map(name, [resources]), resourcesByPath: Map(path, resource)}
 * lowerCase: if true, all names will be lowercased.
 * Path is normalized in both key and value.
 */
var computeGroupedResources = function(lowerCaseName = false){
  const resourcesByName = new Map()
  const resourcesByPath = new Map()
  for(const resourceKey in resourcesMap){
    const resource = resourcesMap[resourceKey]
    const resourceName = lowerCaseName?resource.name.toLowerCase():resource.name

    // group by name
    let names = resourcesByName.get(resourceName)
    if(!names){
      names = []
      resourcesByName.set(resourceName, names)
    }
    names.push(resource)

    // group by path
    const resourcePath = resource.path
    resourcesByPath.set(resource.path, resource)
  }
  return {resourcesByName, resourcesByPath};
}

/**
 * Updates imports with corresponding parsed robot resource files.
 * {... imports:{
 *   resources: [{path, name, extenaion, resourceKey}]  // 'resourceKey' element will be added if import is resolved.
 * }}
 * Returns Set of valid imported robot paths that are not found in this project.
 * These cross project resources could be parsed and resolved as imports in a
 * second pass.
 */
function resolveImports(resource){
  const resourcePath = pathUtils.dirname(resource.path)
  let res = new Set()
  if(resource){
    for(const importedResourceInfo of resource.imports.resources){
      const importedPath = pathResolver.resolve(importedResourceInfo.path, resourcePath)
      if(importedPath){
        // import path points to valid robot resource
        const importedResourceKey = common.getResourceKey(importedPath)
        const importedResource = resourcesMap[importedResourceKey]
        if(importedResource){
          // resource is already parsed
          importedResourceInfo.resourceKey = importedResourceKey
        } else{
          // resource missing. probably is not part of this project.
          res.add(importedPath)
        }
      }
    }
  }
  return res
}

function resolveAllImports(){
  let res = new Set()
  for(const resourceKey in resourcesMap){
    resource = resourcesMap[resourceKey]
    const missingRessourcePaths = resolveImports(resource)
    missingRessourcePaths.forEach(path => res.add(path))
  }
  return res
}


module.exports = {
  reset,
  addResource,
  addLibrary,
  score,
  printDebugInfo,
  resourcesMap,
  keywordsMap,
  computeGroupedResources,
  resolveImports,
  resolveAllImports
}
