"use strict";

var Fs   = require("fs");
var Path = require("path");

var Optimist = require("optimist");
var Util     = require("./util");

var IndexTpl        = Fs.readFileSync(__dirname + "/templates/index.js.tpl", "utf8");
var SectionTpl      = Fs.readFileSync(__dirname + "/templates/section.js.tpl", "utf8");
var HandlerTpl      = Fs.readFileSync(__dirname + "/templates/handler.js.tpl", "utf8");
var AfterRequestTpl = Fs.readFileSync(__dirname + "/templates/after_request.js.tpl", "utf8");
var TestSectionTpl  = Fs.readFileSync(__dirname + "/templates/test_section.js.tpl", "utf8");
var TestHandlerTpl  = Fs.readFileSync(__dirname + "/templates/test_handler.js.tpl", "utf8");

var main = module.exports = function (routes, tests) {
    Util.log("Generating files");

    var dir = Path.join(__dirname, "api");

    var defines = routes.defines;
    delete routes.defines;
    var headers = defines["response-headers"];
    // cast header names to lowercase.
    if (headers && headers.length)
        headers = headers.map(function (header) {
            return header.toLowerCase();
        });
    var sections     = {};
    var testSections = {};

    function createComment(paramsStruct, section, funcName, indent) {
        var params  = Object.keys(paramsStruct);
        var comment = [
            indent + "/** section: codefresh",
            indent + " *  " + section + "#" + funcName + "(msg, callback) -> null",
            indent + " *      - msg (Object): Object that contains the parameters and their values to be sent to the server.",
            indent + " *      - callback (Function): function to call when the request is finished " +
            "with an error as first argument and result data as second argument.",
            indent + " *",
            indent + " *  ##### Params on the `msg` object:",
            indent + " *"
        ];
        comment.push(indent + " *  - headers (Object): Optional. Key/ value pair " +
            "of request headers to pass along with the HTTP request. Valid headers are: " +
            "'" + defines["request-headers"].join("', '") + "'.");
        if (!params.length)
            comment.push(indent + " *  No other params, simply pass an empty Object literal `{}`");
        var paramName, def, line;
        for (var i = 0, l = params.length; i < l; ++i) {
            paramName = params[i];
            if (paramName.charAt(0) === "$") {
                paramName = paramName.substr(1);
                if (!defines.params[paramName]) {
                    Util.log("Invalid variable parameter name substitution; param '" +
                        paramName + "' not found in defines block", "fatal");
                    process.exit(1);
                }
                else
                    def = defines.params[paramName];
            }
            else
                def = paramsStruct[paramName];

            line = indent + " *  - " + paramName + " (" + (def.type || "mixed") + "): " +
                (def.required ? "Required. " : "Optional. ");
            if (def.description)
                line += def.description;
            if (def.validation)
                line += " Validation rule: ` " + def.validation + " `.";

            comment.push(line);
        }

        return comment.join("\n") + "\n" + indent + " **/";
    }

    function getParams(paramsStruct, indent) {
        var params = Object.keys(paramsStruct);
        if (!params.length)
            return "{}";
        var values = [];
        var paramName, def;
        for (var i = 0, l = params.length; i < l; ++i) {
            paramName = params[i];
            if (paramName.charAt(0) === "$") {
                paramName = paramName.substr(1);
                if (!defines.params[paramName]) {
                    Util.log("Invalid variable parameter name substitution; param '" +
                        paramName + "' not found in defines block", "fatal");
                    process.exit(1);
                }
                else
                    def = defines.params[paramName];
            }
            else
                def = paramsStruct[paramName];

            values.push(indent + "    " + paramName + ": \"" + def.type + "\"");
        }
        return "{\n" + values.join(",\n") + "\n" + indent + "}";
    }

    function prepareApi(struct, baseType) {
        if (!baseType)
            baseType = "";

        Object.keys(struct).forEach(function (routePart) {
            var block = struct[routePart];
            if (!block)
                return;
            var messageType = baseType + "/" + routePart;
            if (block.url && block.params) {
                // we ended up at an API definition part!
                var parts    = messageType.split("/");
                var section  = Util.toCamelCase(parts[1].toLowerCase());
                if (!block.method) {
                    throw new Error("No HTTP method specified for " + messageType +
                        "in section " + section);
                }

                parts.splice(0, 2);
                var funcName = Util.toCamelCase(parts.join("-"));
                var comment  = createComment(block.params, section, funcName, "    ");

                // add the handler to the sections
                if (!sections[section])
                    sections[section] = [];

                var afterRequest = "";
                if (headers && headers.length) {
                    afterRequest = AfterRequestTpl.replace("<%headers%>", "\"" +
                        headers.join("\", \"") + "\"");
                }
                sections[section].push(HandlerTpl
                        .replace("<%funcName%>", funcName)
                        .replace("<%comment%>", comment)
                        .replace("<%afterRequest%>", afterRequest)
                );

                // add test to the testSections
                if (!testSections[section])
                    testSections[section] = [];
                testSections[section].push(TestHandlerTpl
                        .replace("<%name%>", block.method + " " + block.url + " (" + funcName + ")")
                        .replace("<%funcName%>", section + "." + funcName)
                        .replace("<%params%>", getParams(block.params, "            "))
                );
            }
            else {
                // recurse into this block next:
                prepareApi(block, messageType);
            }
        });
    }

    Util.log("Converting routes to functions");
    prepareApi(routes);

    Util.log("Writing files");
    var sectionNames = Object.keys(sections);

    Util.log("Writing index.js file");
    Fs.writeFileSync(Path.join(dir, "index.js"),
        IndexTpl
            .replace("<%name%>", defines.constants.name)
            .replace("<%description%>", defines.constants.description)
            .replace("<%scripts%>", "\"" + sectionNames.join("\", \"") + "\""),
        "utf8");

    Object.keys(sections).forEach(function (section) {
        var def = sections[section];
        Util.log("Writing '" + section + ".js' file");
        Fs.writeFileSync(Path.join(dir, section + ".js"), SectionTpl
                .replace(/<%sectionName%>/g, section)
                .replace("<%sectionBody%>", def.join("\n")),
            "utf8"
        );

        // When we don't need to generate tests, bail out here.
        if (!tests)
            return;

        def      = testSections[section];
        var body = TestSectionTpl
            .replace(/<%sectionName%>/g, section)
            .replace("<%testBody%>", def.join("\n\n"));
        var path = Path.join(dir, section + "unit.spec.js");
        Util.log("Writing test file for " + section);
        Fs.writeFileSync(path, body, "utf8");
    });
};

if (!module.parent) {
    var argv = Optimist
        .wrap(80)
        .usage("Generate the implementation of the codefresh module, including " +
        "unit-test scaffolds.\nUsage: $0 [-t]")
        .alias("t", "tests")
        .describe("t", "Also generate unit test scaffolds")
        .alias("h", "help")
        .describe("h", "Display this usage information")
        .boolean(["t", "h"])
        .argv;

    if (argv.help) {
        Util.log(Optimist.help());
        process.exit();
    }

    var routesJson = Path.join(__dirname, "api", "routes.json");
    var routes;
    try {
        routes = JSON.parse(Fs.readFileSync(routesJson, "utf8"));
    }
    catch (ex) {
        return;
    }
    if (!routes.defines)
        return;

    Util.log("Starting up...");
    main(routes, argv.tests, argv.restore);
}
