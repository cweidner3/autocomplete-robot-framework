autocomplete-robot-framework
==========
An [autocomplete-plus](https://github.com/atom/autocomplete-plus) provider for [Robot Framework](http://robotframework.org/).

![Demo](https://raw.githubusercontent.com/gliviu/autocomplete-robot-framework/master/anim.gif)

**Check out this [package](https://atom.io/packages/hyperclick-robot-framework) that uses new  [robot provider API](#API) to  enable 'go to definition' functionality**

## Install
```shell
apm install language-robot-framework
apm install autocomplete-robot-framework
```

## Usage
Add your robot project folder in Atom then open a robot file and the whole project will be scanned for keywords.

Space separated **.robot** and **.txt** files are supported. Libdoc xml files should work as well.

Official [libraries](http://robotframework.org/#test-libraries) are included for convenience.
*  Standard - BuiltIn, Collections, DateTime, Dialogs, OperatingSystem, Process, Screenshot, String, Telnet, XML
*  External - FtpLibrary, HttpLibrary.HTTP, MongoDBLibrary, Rammbock, RemoteSwingLibrary, RequestsLibrary, Selenium2Library, SeleniumLibrary, SSHLibrary, SwingLibrary
External libraries suggestions are disabled by default. They can be toggled in package settings.

If you have your own xml libdoc library, add it together with the other robot files to have it parsed for keywords.

Troubleshooting
*  Works only for files that are inside an Atom project. Opening an independent Robot file won't provide any suggestions.
*  When files are modified outside Atom, autocomplete index may become invalid. Use Command Pallete (ctrl+shift+p) and choose 'Robot Framework:Reload autocomplete data'. Restarting Atom would have the same effect.
*  .txt files are not detected as Robot format automatically. Work around by manually choosing the grammar (open Grammar Selector ctrl-shift-L and pick Robot Framework).
*  Keywords are global to all projects opened in Atom. To mitigate this use [project-viewer](https://atom.io/packages/project-viewer) package or equivalent.
*  Should anything else go wrong, use 'Robot Framework:Print autocomplete debug info' to display internal state in developer console  - 'Window: Toggle dev tools' (ctrl-shift-i on Linux or ctrl-alt-i on Windows).
*  More information can be shown by enabling debug mode in package configuration.

<a name="API"></a>

##API
An API is available to enable cooperation with other packages by providing access to underlying keyword repository.
* getKeywordNames()
* getResourcePaths()
* getKeywordsByName(name)
* getResourceByPath(path)

Keyword
```json
  {
    name: 'keyword name',
    documentation : 'documentation',
    arguments : ['arg1', ...],
    startRowNo : 0,
    startColNo : 0,
    resource : {
      path : 'resource path',
      hasTestCases : true/false,
      hasKeywords : true/false
  }
```

Resource
```json
  {
    path: 'resource path',
    hasTestCases: true/false,
    hasKeywords: true/false,
    keywords: [keyword1, ...]
  }
```


## Changelog
*  v2.0.0
	* Bug fixes
	* Added provider API
*  v1.1.0
  *  Use dot notation to have all suggestions inside single library
  *  Better suggestions are provided by [fuzzaldrin-plus](https://www.npmjs.com/package/fuzzaldrin-plus)
*  v1.0.1
  *  Added Atom commands for data reload and debug info
  *  Debug config option is now available in GUI
  * bug fixes
