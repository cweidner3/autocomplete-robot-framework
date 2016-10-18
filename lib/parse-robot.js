var namedRegexp = require("named-js-regexp");
var fs = require('fs');

var multilineRegExp = function(regs, options) {
    return new RegExp(regs.map(function(reg) {
        return reg.source;
    }).join(''), options);
}


//Used to determine if this is a text robot file
var textRobotFileRegexp = namedRegexp(/^((:<leadingWhiteSpaces>[ \t\r\n])|(:<leadingComments>#+[^\r\n]*[\r\n]))*[*]+[ \t]*((Test cases)|(Keywords)|(Variables)|(Settings))[ \t]*[*]*/i);

// Matches whole *** ... *** sections
var sectionRegexp = namedRegexp(/(^|[\r\n]) ?[*]+ ?(:<sectionName>(Test cases)|(Keywords)|(Variables)|(Settings)) ?[*]*(\t.*?)?(?=[\r\n])/ig);

// Matches keyword or test case name
var nameRegexp = namedRegexp(/^(:<name>[\w\d\\\[\]\/\^\$\*\(\)-_;=~`!@#%&'"{} ]+)\t?$/);

// Given content of *** Keywords *** or *** Test case ***, matches the name and content of each keyword/testcase and returns them as groups.
var individualKeywordOrTestCaseRegexp = namedRegexp(multilineRegExp([/[\r\n](:<name>[\w\d\\\[\]\/\^\$\*\(\)-_;=~`!@#%&'"{} ]+)\t?(?=[\r\n])/,
                                                                     /(:<content>([\r\n]+\t[^\r\n]*)*)/], 'gi'));

// Matches [Documentation] section
var documentationRegexp = namedRegexp(multilineRegExp([/\t\[Documentation\]\t(:<documentation>.*(:<multilineDoc>([\r\n]+\t\.\.\.\t.*)*))/], 'i'));

// Matches '...    ' line-joining so it can be cleaned out.
var cleanMultilineReplaceRegexp = /[\r\n]+\t\.\.\.\t/g;

// Matches [Arguments] section
var argumentsRegexp = namedRegexp(multilineRegExp([/\t\[Arguments\](:<arguments>.*(:<multilineArgs>([\r\n]+\t\.\.\..*)*))/], 'i'));

// Matches ${arguments} globally
var argumentRegexp = namedRegexp(/[$@&]{(:<argument>[\w\d\\\[\]\/\^\$\*\(\)-_;=~`!@#%&'" ]+)}(:<defaultValue>=.*?((\t)|$))?/gi);

// Used to normalize multiple spaces and tabs into robot framework delimiters; ie. 'a b  c\td\t\te\t \t  \t\t   e' wll become 'a b\tc\td\te\te'
var tabRegexp = /[ \t]{2,}/g;

// Matches single line comments
var singleLineCommentRegexp = /#[^\r\n]*/g;

// Matches empty lines
var emptyLineRegexp = /([\r\n])([ \t]+[\r\n])/g;

/**
 * Returns sections in form of map - ie: {
 *  "keywords": "content",
 *  "test cases": "content"
 *  "variables": "content"
 *  ...
 *  }
 */
var getSections = function(fileContent){
  var sectionArray = [];
  while(match = sectionRegexp.exec(fileContent)){
    sectionArray.push({
      name: match.group('sectionName'),
      start: match.index,
      end: match.index + match[0].length
    });
  }
  
  var sections = {};
  for (var i = 0; i < sectionArray.length; i++) {
    var currentSection = sectionArray[i];
    var nextSection;
    if(i<sectionArray.length-1){
      nextSection = sectionArray[i+1];
    } else{
      nextSection = {
        name: undefined,
        start: fileContent.length,
        end: fileContent.length
      }
    }
    
    sections[currentSection.name.toLowerCase()] = fileContent.substring(currentSection.end, nextSection.start);
  }
  return sections;
}

/**
 * True/false if file is recognized as robot or not.
 *
 */
var isRobot = function(fileContent){
  return textRobotFileRegexp.test(fileContent);
}

/**
 * Parses robot text files.
 * Returns result in this form:
 *  {
 *      "testCases": [
 *          {name: '', documentation: ''},
 *          ...
 *      ],
 *      "keywords": [
 *          {name: '', documentation: '', arguments: ['', '', ...], rowNo: 0, colNo: 0},
 *          ...
 *      ],
 *      "hasTestCases": true/false
 *      "hasKeywords": true/false
 *  }
 */
var parse = function(fileContentOrig) {
    var keywords = [];
    var testCases = [];
    var keywordsMatch;

    // Clean file (remove comments, remove empty lines, replace tabs with spaces, ...)
    var fileContentTabs = fileContentOrig.replace(tabRegexp, '\t');
    fileContent = fileContentTabs.replace(singleLineCommentRegexp, '');
    fileContent = fileContent.replace(emptyLineRegexp, '$1');

    var sections = getSections(fileContent);

    var keywordsSection = sections['keywords'];

    if (keywordsSection) {
        keywords = parseKeywordOrTestCase(keywordsSection, true)
    }
    var testCasesSection = sections['test cases'];

    if (testCasesSection) {
        testCases = parseKeywordOrTestCase(testCasesSection, false)
    }
    fillLineNumbers(fileContentTabs, keywords);
    return {
        keywords: keywords,
        testCases: testCases,
        hasTestCases: testCases.length>0?true:false,
        hasKeywords: keywords.length>0?true:false
    };

}

var parseKeywordOrTestCase = function(section, processArguments){
    var documentation, arguments;
    var name, content;
    var result = [];
    var match;
    while(match = individualKeywordOrTestCaseRegexp.exec(section)){
        name = match.group('name').trim();
        content = match.group('content');
        nameStart = match.index;
        nameEnd = nameStart + name.length;
        contentStart = nameEnd;
        contentEnd = contentStart + content.length;
        documentationMatch = documentationRegexp.execGroups(content);
        documentation = "";
        if(documentationMatch){
            documentation = documentationMatch['documentation'];
            documentation = documentation.replace(cleanMultilineReplaceRegexp, ' ');
        }
        if(processArguments){
            arguments = [];
            argumentsMatch = argumentsRegexp.execGroups(content);
            if(argumentsMatch){
                keywordArgsStr = argumentsMatch['arguments']
                while(argMatch = argumentRegexp.execGroups(keywordArgsStr)){
                    arguments.push(argMatch['argument']);
                }
            }
        } else{
            arguments = undefined
        }

        result.push({
            name: name,
            documentation: documentation,
            arguments: arguments
        });
    }
    return result;
}

var fillLineNumbers = function(fileContentTabs, keywords){
    var kwMap = {}, match, keyword, keywordName;
    
    for(var i = 0; i<keywords.length; i++){
        var keyword = keywords[i];
        kwMap[keyword.name] = keyword;
    }
    var lines = fileContentTabs.split(/\r\n|\n|\r/);
    for(var i = 0; i<lines.length; i++){
        var line = lines[i];
        match = nameRegexp.exec(line);
        keywordName = match?match.group('name').trim():undefined;
        keyword = kwMap[keywordName];
        if(keyword){
            keyword.rowNo = i;
            keyword.colNo = 0;
        }
    }
}


module.exports = {
  parse: parse,
  isRobot: isRobot
}
