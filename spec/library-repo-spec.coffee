libRepo = require('../lib/library-repo')
fs = require 'fs'
pathUtils = require 'path'
os = require 'os'

describe "Library repository", ->
  pythonExecutable = 'python'
  libDir = pathUtils.join(os.tmpdir(), 'robot-lib-cache')
  process.env.PYTHONPATH=pathUtils.join(__dirname, '../fixtures/libraries')
  beforeEach ->
    libRepo.reset()
  it 'should load robot keywords from module', ->
    waitsForPromise ->
      libRepo.importLibraries(['package.modules.TestModule'], libDir, [], pythonExecutable)
    runs ->
      libraries = libRepo.getLibrariesByKey()
      library = libraries.get('package.modules.TestModule')
      expect(library).toBeDefined()
      expect(library.status).toEqual('success')
      expect(library.name).toEqual('package.modules.TestModule')
  it 'should load robot keywords from class with shorthand notation', ->
    waitsForPromise ->
      libRepo.importLibraries(['package.classes.TestClass'], libDir, [], pythonExecutable)
    runs ->
      libraries = libRepo.getLibrariesByKey()
      library = libraries.get('package.classes.TestClass')
      expect(library).toBeDefined()
      expect(library.status).toEqual('success')
      expect(library.name).toEqual('package.classes.TestClass')
  it 'should load robot keywords from class with long notation', ->
    waitsForPromise ->
      libRepo.importLibraries(['package.classes.TestClass.TestClass'], libDir, [], pythonExecutable)
    runs ->
      libraries = libRepo.getLibrariesByKey()
      library = libraries.get('package.classes.TestClass.TestClass')
      expect(library).toBeDefined()
      expect(library.status).toEqual('success')
      expect(library.name).toEqual('package.classes.TestClass.TestClass')
  it 'should load Robot Framework builtin libraries', ->
    waitsForPromise ->
      libRepo.importLibraries(['robot.libraries.OperatingSystem'], libDir, [], pythonExecutable)
    runs ->
      libraries = libRepo.getLibrariesByKey()
      library = libraries.get('robot.libraries.OperatingSystem')
      expect(library).toBeDefined()
      expect(library.status).toEqual('success')
      expect(library.name).toEqual('robot.libraries.OperatingSystem')
