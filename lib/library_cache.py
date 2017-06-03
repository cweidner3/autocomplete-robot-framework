""" Converts robot framework keyword libraries into libdoc
and adds them into a directory cache, invalidated by their compilation time.
Parameters:
* library names: comma separated library names or absolute paths
* additional modules: comma separated list of additional search paths
* libdoc cache dir: path to store libdoc files
Outputs Json string with this format:
{
    libraries:{
        'libraryKey'{
          name: 'library_name',
          libraryKey: 'library name for normal libraries/library path for physical libraries',
          status: 'error/success',
          message: 'error or warning message',
          xmlLibdocPath: 'path of libdoc file',
          sourcePath: 'path of python file'
        },
        ...
    },
    'environment': {
        'pythonVersion': '',
        'moduleSearchPath': '',
        'pythonExecutable': '',
        'platform': ''
        'pythonPath': '',
        'jythonPath': '',
        'classPath': '',
        'ironpythonPath': '',
    }
}

"""
import importlib
import imp
import os
import sys
import json
import traceback
import inspect

STANDARD_LIBRARY_NAMES = ['BuiltIn', 'Collections', 'DateTime', 'Dialogs'
                          , 'OperatingSystem', 'Process', 'Remote'
                          , 'Screenshot', 'String', 'Telnet', 'XML']
STANDARD_LIBRARY_PACKAGE = 'robot.libraries'

def _is_robot_framework_available():
    try:
        importlib.import_module('robot')
        return True
    except ImportError:
        return False


def _import_libdoc_module():
    try:
        module = importlib.import_module('robot.libdocpkg')
        if hasattr(module, 'LibraryDocumentation'):
            return getattr(module, 'LibraryDocumentation')
        raise ValueError('robot.libdocpkg.LibraryDocumentation could not be found')
    except ImportError:
        raise ValueError('robot.libdocpkg could not be imported')

def _get_module_source(module):
    try:
        sourceFile = inspect.getsourcefile(module)
        if sourceFile is not None:
            return sourceFile
    except TypeError:
        pass

    try:
        sourceFile = inspect.getfile(module)
        if sourceFile is not None:
            return sourceFile
    except TypeError:
        pass

    try:
        sourceFile = getattr(module, '__file__')
        if sourceFile is not None:
            return sourceFile
    except AttributeError:
        pass

    return None

def _get_module_by_name(library_name):
    namespaces = library_name.split('.')
    try:
        return (importlib.import_module(library_name), None)
    except ImportError as e1:
        parent = '.'.join(namespaces[0:-1])
        if parent:
            try:
                module = importlib.import_module(parent)
                class_name = namespaces[-1]
                if hasattr(module, class_name):
                    return (module, None)
                return (None, str(e1))
            except ImportError as e2:
                return (None, str(e2))
        else:
            return (None, str(e1))

def _get_module_by_path(library_name, library_path):
    try:
        return (imp.load_source(library_name, library_path), None)
    except ImportError as e1:
        return (None, str(e1))

def _get_modified_time(file_path):
    try:
        return os.path.getmtime(file_path)
    except OSError:
        return 0

# Returns (chached, xml_libdoc_path) where
# * cached - True - libdoc exists and is valid4
#          - False - libdoc exists but is older than python lib
#          - False - libdoc does not exist
# * xml_libdoc_path - path to libdoc file if available
def _cached(library_file_name, module, cache_dir):
    library_file = library_file_name+'.xml'
    library_path = os.path.join(cache_dir, library_file)
    if not os.path.exists(library_path):
        return (False, None)
    module_modif_time = _get_modified_time(_get_module_source(module))
    chache_modif_time = _get_modified_time(library_path)
    if module_modif_time > chache_modif_time:
        return (False, None)
    return (True, library_path)

def _generate_libdoc_xml(library_name, library_file_name, cache_dir):
    library_file = library_file_name+'.xml'
    library_path = os.path.join(cache_dir, library_file)
    LibraryDocumentation = _import_libdoc_module()
    libdoc = LibraryDocumentation(library_or_resource=library_name)
    libdoc.save(library_path, 'XML')
    return library_path

def _library_file_name(library_info):
    if library_info.lower().endswith(".py"):
        # library specified by path
        library_path = library_info
        (root, _) = os.path.splitext(library_path)
        library_name = os.path.basename(root)
        return "{}-{}".format(library_name, hash(library_info))
    # library specified by name
    return library_info

# Saves libraries into cache_dir as libdoc files.
# * libraries - list of library names (for normal libraries) or paths (for physical libraries)
# * cache_dir - path to store libdoc files; acts like a cache: libdoc is
#               updated when newer python library is available
def _store_libraries(libraries, cache_dir):
    library_map = {}
    if not os.path.exists(cache_dir):
        os.mkdir(cache_dir)
    for library_info in libraries:
        physical = library_info.lower().endswith(".py")
        library_map[library_info] = {
            'name': library_info,
            'libraryKey': library_info,
            'status': 'pending',
            'message': 'To be imported',
            'physical': physical,
            'sourcePath': library_info if physical else None
            }
        try:
            library_file_name = _library_file_name(library_info)
            if physical:
                # library specified by path
                library_path = library_info
                (root, _) = os.path.splitext(library_path)
                library_name = os.path.basename(root)
                (module, error) = _get_module_by_path(library_name, library_path)
            else:
                # library specified by name
                library_name = library_info
                # Fix library name for standard robot libraries
                if library_name in STANDARD_LIBRARY_NAMES:
                    full_library_name = '{}.{}'.format(STANDARD_LIBRARY_PACKAGE, library_name)
                else:
                    full_library_name = library_name
                (module, error) = _get_module_by_name(full_library_name)
            if not module:
                library_map[library_info] = {
                    'name': library_name,
                    'libraryKey': library_info,
                    'status': 'error',
                    'message': "Could not import '%s': '%s'" % (library_name, error),
                    'physical': physical,
                    'sourcePath': library_info if physical else None
                    }
                continue
            (cached, xml_libdoc_path) = _cached(library_file_name, module, cache_dir)
            if not cached:
                xml_libdoc_path = _generate_libdoc_xml(library_info, library_file_name, cache_dir)
                library_map[library_info] = {
                    'name': library_name,
                    'libraryKey': library_info,
                    'status': 'success',
                    'xmlLibdocPath': xml_libdoc_path,
                    'sourcePath': library_info if physical else _get_module_source(module),
                    'physical': physical
                    }
            else:
                library_map[library_info] = {
                    'name': library_name,
                    'libraryKey': library_info,
                    'status': 'success',
                    'xmlLibdocPath': xml_libdoc_path,
                    'sourcePath': library_info if physical else _get_module_source(module),
                    'physical': physical
                    }
            # cleanup module; avoid keyword clashes between physical and normal
            # modules with identical names.
            try:
                if library_name in sys.modules:
                    del sys.modules[library_name]
            except Exception as exc:
                pass
        except Exception as exc:
            error = "Unexpected error: %s, %s" % (exc, traceback.format_exc())
            library_map[library_info] = {'name': library_name, 'libraryKey': library_info, 'status': 'error', 'message': error}
    return {
        'libraries': library_map,
        'environment': {
            'pythonVersion': sys.version,
            'pythonExecutable': sys.executable,
            'platform': sys.platform,
            'pythonPath':     os.getenv('PYTHONPATH', 'n/a'),
            'jythonPath':     os.getenv('JYTHONPATH', 'n/a'),
            'classPath':      os.getenv('CLASSPATH', 'n/a'),
            'ironpythonPath': os.getenv('IRONPYTHONPATH', 'n/a'),
            'moduleSearchPath': sys.path,
        }}

def _main():
    required_argument_no = 4
    if len(sys.argv) != required_argument_no:
        print("Wrong arguments. Required %d arguments. Received %d" %(required_argument_no, len(sys.argv)))
        exit(1)

    library_names = sys.argv[1].split(',')
    additional_module_search_paths = sys.argv[2].split(',')
    cache_dir = sys.argv[3]

    sys.path.extend(additional_module_search_paths)

    if not _is_robot_framework_available():
        print("Robot framework is not installed.")
        exit(1)

    # Redirect output so that various module initialization do not polute our Json result.
    null_stream = open(os.devnull, "w")
    orig_stdout = sys.stdout
    sys.stdout = null_stream

    result = _store_libraries(library_names, cache_dir)

    sys.stdout = orig_stdout
    print(json.dumps(result))

_main()
exit(0)
