const pathUtils = require('path');
module.exports = {
  getResourceKey(resourcePath){
    return pathUtils.normalize(resourcePath).toLowerCase();
  },
  getLibraryName(libraryKey){
    if(libraryKey.toLowerCase().endsWith('.py')){
      return pathUtils.basename(libraryKey, pathUtils.extname(libraryKey))
    }
    return libraryKey
  },
  eqSet(set1, set2) {
    if (set1.size !== set2.size) return false;
    for (var a of set1) if (!set2.has(a)) return false;
    return true;
  },
  // https://stackoverflow.com/questions/122102/what-is-the-most-efficient-way-to-deep-clone-an-object-in-javascript/122190#122190
  deepClone(obj) {
      if (obj === null || typeof(obj) !== 'object' || 'isActiveClone' in obj)
        return obj;

      if (obj instanceof Date)
        var temp = new obj.constructor(); //or new Date(obj);
      else
        var temp = obj.constructor();

      for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          obj['isActiveClone'] = null;
          temp[key] = this.deepClone(obj[key]);
          delete obj['isActiveClone'];
        }
      }

      return temp;
    }
}
