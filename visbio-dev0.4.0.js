(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        //Allow using this built library as an AMD module
        //in another project. That other project will only
        //see this AMD call, not the internal modules in
        //the closure below.
        define(factory);
    } else {
        //Browser globals case. Just assign the
        //result to a property on the global.
        root.visbio = factory();
    }
}(this, function () {
    //almond, and your modules will be inlined here

/**
 * almond 0.2.6 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        if (config.deps) {
            req(config.deps, config.callback);
        }
        return req;
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("almond", function(){});

define('lib/d3',[],function () {
    if (window.d3===undefined) console.error('d3 is not loaded.');
    return window.d3;
});

define('vis/scaffold',["lib/d3"], function(d3) {
    return {
        set_options: set_options,
        setup_svg: setup_svg,
	resize_svg: resize_svg,
        load_css: load_css,
        load_files: load_files,
        load_the_file: load_the_file,
	scale_and_axes: scale_and_axes,
	add_generic_axis: add_generic_axis
    };

    // definitions
    function height_width_style(selection, margins) {
        var width = parseFloat(selection.style('width')) - margins.left - margins.right,
        height = parseFloat(selection.style('height')) - margins.top - margins.bottom;
        return {'width': width, 'height': height};
    };
    function height_width_attr(selection, margins) {
        var width = parseFloat(selection.attr('width')) - margins.left - margins.right,
        height = parseFloat(selection.attr('height')) - margins.top - margins.bottom;
        return {'width': width, 'height': height};
    };
    function set_options(options, defaults) {
        if (options===undefined) return defaults;
        var i = -1,
        out = defaults,
        keys = window.Object.keys(options);
        while (++i < keys.length) out[keys[i]] = options[keys[i]];
        return out;
    };
    function setup_svg(selection, selection_is_svg, margins, fill_screen) {
        // sub selection places the graph in an existing svg environment
        var add_svg = function(f, s, m) {
            if (f) {
                d3.select("body")
                    .style("margin", "0")
                    .style("padding", "0");
                s.style('height', (window.innerHeight-m.top)+'px');
                s.style('width', (window.innerWidth-m.left)+'px');
                s.style("margin-left", m.left+"px");
                s.style("margin-top", m.top+"px");
            }
            var out = height_width_style(s, m);
            out.svg = s.append('svg')
                .attr("width", out.width)
                .attr("height", out.height)
                .attr('xmlns', "http://www.w3.org/2000/svg");
            return out;
        };

        // run
        var out;
        if (selection_is_svg) {
            out = height_width_attr(selection, margins);
            out.svg = selection;
        } else if (selection) {
            out = add_svg(fill_screen, selection, margins);
        } else {
            out = add_svg(fill_screen, d3.select('body').append('div'), margins);
        }
        if (out.height <= 0 || out.width <= 0) {
            console.warn("Container has invalid height or \
width. Try setting styles for height \
and width, or use the 'fill_screen' option.");
        }
        return out;
    };

    function resize_svg(selection, selection_is_svg, margins, fill_screen) {
        /** resize_svg(selection, selection_is_svg, margins, fill_screen)

	 Returns object with new 'height' and 'width' keys.

	 */
        var out;
        if (selection_is_svg) {
            out = height_width_attr(selection, margins);
        } else if (selection) {
            out = resize(fill_screen, selection, margins);
	} else console.warn('No selection');
        return out;

	// definitions
        function resize(f, s, m) {
            if (f) {
                s.style('height', (window.innerHeight-m.top)+'px');
                s.style('width', (window.innerWidth-m.left)+'px');
                s.style("margin-left", m.left+"px");
                s.style("margin-top", m.top+"px");
            }
            var out = height_width_style(s, margins);
	    s.select("svg")
		.attr("height", out.height)
		.attr("width", out.width);
            return out;
        };
    };

    function load_css(css_path, callback) {
        var css = "";
        if (css_path) {
            d3.text(css_path, function(error, text) {
                if (error) {
                    console.warn(error);
                }
                css = text;
                callback(css);
            });
        }
        return false;
    };
    function update() {
        return 'omg yes';
    };
    function load_the_file(file, callback, value) {
        // if the value is specified, don't even need to do the ajax query
        if (value) {
            if (file) console.warn('File ' + file + ' overridden by value.');
            callback(null, value, file);
            return;
        }
        if (!file) {
            callback("No filename", null, file);
            return;
        }
        if (ends_with(file, 'json'))
	    d3.json(file, function(e, d) { callback(e, d, file); });
        else if (ends_with(file, 'css'))
	    d3.text(file, function(e, d) { callback(e, d, file); });
        else
	    callback("Unrecognized file type", null, file);
        return;

        // definitions
        function ends_with(str, suffix) {
	    return str.indexOf(suffix, str.length - suffix.length) !== -1;
	}
    };
    function load_files(files_to_load, final_callback) {
        // load multiple files asynchronously
        // Takes a list of objects: { file: a_filename.json, callback: a_callback_fn }
        var i = -1, remaining = files_to_load.length, callbacks = {};
        while (++i < files_to_load.length) {
            var this_file = files_to_load[i].file;
            callbacks[this_file] = files_to_load[i].callback;
            load_the_file(this_file,
                          function(e, d, file) {
                              callbacks[file](e, d);
                              if (!--remaining) final_callback();
                          },
                          files_to_load[i].value);
        }
    };
    function scale_and_axes(x_domain, y_domain, width, height, options) {
	/* Generate generic x and y scales and axes for plots.

	   Returns object with keys x, y, x_axis, and y_axis.
	 */
	var o = set_options(options, {
	    padding: { left:0, right:0, top:0, bottom:0 },
	    x_is_log: false,
	    y_is_log: false,
	    y_ticks: null,
	    x_ticks: null,
	    x_nice: false,
	    y_nice: false,
	    x_tick_format: null,
	    y_tick_format: null }),
	out = {};
	
	// x scale
	if (o.x_is_log) out.x = d3.scale.log();
	else out.x = d3.scale.linear();
	out.x.range([o.padding.left, (width - o.padding.right)])
	    .domain(x_domain);

	if (y_domain) {
	    // y scale
	    if (o.y_is_log) out.y = d3.scale.log();
	    else out.y = d3.scale.linear();
	    out.y.range([(height - o.padding.bottom), 1+o.padding.top])
		.domain(y_domain);
	} else out.y = null;

	if (x_domain) {
	    // x axis
            out.x_axis = d3.svg.axis()
		.scale(out.x)
		.orient("bottom");
	    if (o.x_nice) out.x_axis.nice();
	    if (o.x_ticks) out.x_axis.ticks(o.x_ticks);
	    if (o.x_tick_format) out.x_axis.tickFormat(o.x_tick_format);
	} else out.x = null;

	// y axis
        out.y_axis = d3.svg.axis()
            .scale(out.y)
            .orient("left");
	if (o.y_nice) out.y_axis.nice();
	if (o.y_ticks) out.y_axis.ticks(o.y_ticks);
	if (o.y_tick_format) out.y_axis.tickFormat(o.y_tick_format);

	return out;
    }
    function add_generic_axis(type, text, sel, axis, width, height, padding) {
	/* Append a generic axis to /sel/, a d3 selection of an svg element

	 */
	var cls, translate, label_x, label_y, dx, dy, label_rotate;
	if (type=='x') {
	    cls = "x axis";
	    translate = [0, height - padding.bottom];
	    label_x = width;
	    label_y = -6;
	    label_rotate = 0,
	    dx = 0,
	    dy = 0;
	} else if (type=='y') {
	    cls = "y axis";
	    translate = [padding.left, 0],
	    label_x = 0;
	    label_y = 6;
	    label_rotate = -90;
	    dx = 0;
	    dy = ".71em";
	} else console.warn('Bad axis type');
	
        return sel.append("g")
	    .attr("class", cls)
	    .attr("transform", "translate("+translate+")")
	    .call(axis)
	    .append("text")
	    .attr("class", "label")
	    .attr("transform", "rotate("+label_rotate+")")
	    .attr("x", label_x)
	    .attr("y", label_y)
	    .attr("dx", dx)
	    .attr("dy", dy)
	    .style("text-anchor", "end")
	    .text(text);
    }
});

define('vis/bar',["./scaffold", "lib/d3"], function (scaffold, d3) {
    return function(options) {
        // set defaults
        var o = scaffold.set_options(options, {
            margins: {top: 10, right: 10, bottom: 10, left: 20},
            plot_padding: {left: 30, bottom: 30, top: 10, right: 10},
            selection_is_svg: false,
            fillScreen: false,
            x_axis_label: "",
            y_axis_label: "",
            x_data_label: '1',
            y_data_label: '2',
            x_shift: 4,
            data_is_object: true,
            color_scale: false,
            y_range: false,
            title: false,
            is_stacked: false,
            update_hook: false,
            css_path: '',
	    y_tick_format: d3.format("f") });

        var out = scaffold.setup_svg(o.selection, o.selection_is_svg,
                                     o.margins, o.fill_screen);
        o.svg = out.svg;
        o.height = out.height;
        o.width = out.width;

        // load the css
        o.ready = scaffold.load_css(o.css_path, function(css) {
            o.css = css;
            o.ready = true;
        });
        o.layers = [];

        return {
            update: update,
            collect_data: collect_data,
            update_hook: set_update_hook
        };

        // definitions
        function update_size() {
            out = scaffold.resize_svg(o.selection, o.selection_is_svg, o.margins, o.fill_screen);
            o.height = out.height;
            o.width = out.width;

            // o.x.range([0, o.width]);
            // o.y.range([o.height, 0]);

            // o.xAxiscale(x);
            // o.yAxiscale(y);

            // o.svg.select('.x.hist-axis')
            //     .attr("transform", "translate(0," + o.height + ")")
            //     .call(o.xAxis)
            //     .select('text')
            //     .attr("x", o.width);
            // o.svg.select('.y.hist-axis')
            //     .call(o.yAxis);

            // var bar_w = o.x(1) - o.diff - 8;

            // for (var i=0; i<json.length; i++) {
            //     selection.selectAll(".bar.bar"+String(i))
            //         .attr("transform", function(d) {
            //             return "translate(" + (x(d.x) + x_shift*i) + "," + y(d.y) + ")";
            //         })
            //         .select('rect')
            //         .attr("width", bar_w)
            //         .attr("height", function(d) { return height - y(d.y); });
            // }

            return this;
        };

        function update() {
            // check data
            var i=-1;
            while(++i < o.layers.length) {
                if (o.layers[i]===undefined) {
                    console.log('waiting for all indices');
                    return this;
                }
            }

            // clear the container and add again
            o.svg.select("#bar-container").remove();
            var container = o.svg.append("g").attr("id","bar-container");
            container.append("style")
                .attr('type', "text/css")
                .text(o.css);
            var sel = container.append("g")
                .attr("transform", "translate(" + o.margins.left + "," + o.margins.top + ")");

            // find x domain
            var x_dom = [0, d3.max(o.layers, function(a) { return a.data.length; })],
            y_dom;
            if (o.y_range) {
                y_dom = o.y_range;
            } else {
                if (o.is_stacked) {
                    // sum up each data point
                    var i=-1, max = 0;
                    while (++i<o.layers[0].data.length) {
                        var j=-1, t = 0;
                        while (++j<o.layers.length) t += o.layers[j].data[i].value;
                        if (t > max) max = t;
                    }
                    y_dom = [
                        d3.min(o.layers, function(a) {
                            return d3.min(a.data, function(d) { return d.value; });
                        }),
                        max
                    ];
                } else {
                    y_dom = [
                        d3.min(o.layers, function(a) {
                            return d3.min(a.data, function(d) { return d.value; });
                        }),
                        d3.max(o.layers, function(a) {
                            return d3.max(a.data, function(d) { return d.value; });
                        })
                    ];
                }
            }

            var dom = {'y': y_dom,
                       'x': x_dom},
            out = scaffold.scale_and_axes(dom.x, dom.y,
                                          o.width, o.height,
                                          { padding: o.plot_padding,
                                            x_ticks: 0,
                                            y_ticks: 5,
                                            y_tick_format: o.y_tick_format }),
            x = out.x, y = out.y;
            scaffold.add_generic_axis('x', o.x_axis_label, sel, out.x_axis,
                                      o.width, o.height, o.plot_padding);
            scaffold.add_generic_axis('y', o.y_axis_label, sel, out.y_axis,
                                      o.width, o.height, o.plot_padding);

            var diff = 0,
            bar_w = x(2) - x(1) - diff;

            for (var j = 0; j < o.layers.length; j++) {
                var cl = 'bar'+String(j);
                var bars = sel.selectAll("."+cl)
                    .data(o.layers[j].data)
                    .enter().append("g")
                    .attr("class", "bar "+cl);
                if (o.is_stacked) {
                    if (j > 0) {
                        bars.attr("transform", function(d, i) {
                            return "translate(" + x(i) + "," +
				(y(o.layers[j-1].data[i].value) - (y(dom.y[0]) - y(d.value))) + ")";
                        });
                    } else {
                        bars.attr("transform", function(d, i) {
                            return "translate(" + x(i) + "," +
                                y(d.value) + ")";
                        });
                    }
                } else {
                    bars.attr("transform", function(d, i) {
                        return "translate(" + (x(i) + o.x_shift*j) + "," +
			    y(d.value) + ")";
                    });
                }
                var rects = bars.append("rect")
                    .attr("x", 1)
                    .attr("width", bar_w)
                    .attr("height", function(d) { return y(dom.y[0]) - y(d.value); })
                    .style("fill", function(d) { if (o.color_scale) return o.color_scale(d.category);
                                                 else return null; });
            }

            if (o.title) {
                sel.append('text')
                    .attr('class', 'title')
                    .text(o.title)
                    .attr("transform", "translate("+o.width/2+",10)")
                    .attr("text-anchor", "middle");
            }

            if (o.update_hook) o.update_hook(sel);
            return this;
        };

        function collect_data(json, layer) {
            if (!o.ready) console.warn('Hasn\'t loaded css yet');
            if (o.data_is_object) {
                var objects = [];
                for (var key in json) objects.push({name: key, value: json[key]});
                o.layers[layer] = {data: objects};
            } else {
                o.layers[layer] = {data: json};
            }
            update();
            return this;
        };

        function set_update_hook(fn) {
            o.update_hook = fn;
            return this;
        };

    };
});

define('vis/box-and-whiskers',["./scaffold", "lib/d3"], function (scaffold, d3) {
    return function(options) {    
	// Data should have elements {min: 0.0, max: 5.0, Q1: 2.0, Q2: 3.0, Q3: 4.0}

        // set defaults
        var o = scaffold.set_options(options, {
            margins: {top: 10, right: 10, bottom: 10, left: 20},
	    plot_padding: {left: 30, bottom: 30, top: 10, right: 10},
            selection_is_svg: false,
            fillScreen: false,
            x_axis_label: "",
            y_axis_label: "",
            data_is_object: false,  // defines the data format, according to pandas.DataFrame.to_json()
            y_range: false,
            title: false,
            update_hook: false,
            css: '' });

        var out = scaffold.setup_svg(o.selection, o.selection_is_svg,
                                     o.margins, o.fill_screen);
        o.svg = out.svg;
        o.height = out.height;
        o.width = out.width;

        // load the css
        o.ready = scaffold.load_css(o.css_path, function(css) {
            o.css = css;
            o.ready = true;
        });
        o.layers = [];

        return {
            update: update,
            collect_data: collect_data,
            update_hook: set_update_hook
        };

	// definitions
        function update_size() {
            return this;
        };

        function update() {
            // add the styles
            o.svg.append("style")
                .attr('type', "text/css")
                .text(o.css);

            var f = o.data,
	    padding = o.plot_padding,
	    width = o.width,
	    height = o.height;

	    // scale and axes
	    var x_domain = [-0.5, f.length-0.5],
	    y_domain = [d3.min(f, function (d) { return d.min; }),
                        d3.max(f, function (d) { return d.max; }) ],
	    out = scaffold.scale_and_axes(x_domain, y_domain,
					  width, height,
					  {padding: padding,
					   x_is_log: false,
					   y_is_log: false,
					   x_ticks: 4,
					   y_ticks: 20}),
	    x = out.x, y = out.y;
	    scaffold.add_generic_axis('x', 'x axis', o.svg, out.x_axis, width, height, padding);
	    scaffold.add_generic_axis('y', 'y axis', o.svg, out.y_axis, width, height, padding);
	    
            var line = d3.svg.line()
                .x(function(d) { return d[0]; })
                .y(function(d) { return d[1] });

            var g = o.svg.append("g")
                .attr("class", "legend")
                .attr("transform", "translate(200, 80)")
                .attr("width", "300px")
                .attr("height", "200px");

            // add_legend(g, '10x', 'blue', 0);
            // add_legend(g, '100x', 'red', 1);
            // function add_legend(a, t, color, i) {
            //     var g = a.append("g")
            //             .attr("transform", "translate(0,"+i*40+")");
            //     g.append("text")
            //         .text(t)
            //         .attr("transform", "translate(30, 7)");
            //     g.append("circle")
            //         .attr("r", 10)
            //         .attr("style", "fill:"+color);
            // }

            // var g2 = g.append("g")
            //         .attr("transform", "translate(0,80)");
            // g2.append("path")
            //     .attr("class", "min-max-2")
            //     .attr("d", function (d) {
            //         return line([[0,0], [200, 0]]);
            //     })
            //     .style("stroke-width", "2px");
            // g2.append("path")
            //     .attr("class", "Q1-Q3-2")
            //     .attr("d", function (d) {
            //         return line([[60,0], [140, 0]]);
            //     })
            //     .style("stroke-width", "2px");
            // g2.append("path")
            //     .attr("class", "median-2")
            //     .attr("d", function (d) {
            //         return line([[90,0], [95, 0]]);
            //     })
            //     .style("stroke-width", "2px");
            // g2.append("text")
            //     .text("min")
            //     .attr("transform", "translate(-10,20)");
            // g2.append("text")
            //     .text("Q1")
            //     .attr("transform", "translate(50,20)");
            // g2.append("text")
            //     .text("med")
            //     .attr("transform", "translate(83,20)");
            // g2.append("text")
            //     .text("Q3")
            //     .attr("transform", "translate(130,20)");
            // g2.append("text")
            //     .text("max")
            //     .attr("transform", "translate(190,20)");

            o.svg.append('g')
                .selectAll("path")
                .data(f)
                .enter()
                .append("path")
                .attr("class", "min-max")
                .attr("d", function(d) {
                    return line([[x(d.rank), y(d.min)], [x(d.rank), y(d.max)]]);
                });

            // Q1 to Q3
            o.svg.append('g')
                .selectAll("path")
                .data(f)
                .enter()
                .append("path")
                .attr("class", "Q1-Q3")
                .attr("d", function (d) {
                    return line([[x(d.rank), y(d.Q1)], [x(d.rank), y(d.Q3)]]);
                });

            var m_l = 0;
            o.svg.append('g')
                .selectAll("path")
                .data(f)
                .enter()
                .append("path")
                .attr("class", "median")
                .attr("d", function (d) {
                    return line([[x(d.rank), y(d.median)-m_l], [x(d.rank), y(d.median)+m_l]]);
                });

            if (o.title) {
                o.svg.append('text')
                    .attr('class', 'title')
                    .text(o.title)
                    .attr("transform", "translate("+o.width/2+",10)")
                    .attr("text-anchor", "middle");
            }

            if (o.update_hook) o.update_hook(o.svg);
            return this;
        };

        function collect_data(json) {
            if (!o.ready) console.warn('Hasn\'t loaded css yet');
            // add ranks
            if (o.data_is_object) {
                var objects = [], i = -1, keys = Object.keys(json);
                while (++i < keys.length) {
                    var th = json[keys[i]];
                    th['rank'] = i;
                    objects.push(th);
                }
                o.data = objects;
            } else {
                var i = -1, objects = [];
                while (++i < json.length) {
                    var th = json[i];
                    th['rank'] = i;
                    objects.push(th);
                }
                o.data = objects;
            }
            update();
            return this;
        };

        function set_update_hook(fn) {
            o.update_hook = fn;
            return this;
        };
    };
});

define('vis/category-legend',["./scaffold", "lib/d3"], function (scaffold, d3) {
    return function(options) {
        // set defaults
        var o = scaffold.set_options(options, {
	    selection: d3.select("body"),
	    selection_is_svg: false,
            margins: {top: 20, right: 20, bottom: 30, left: 50},
            fill_screen: false,
            categories: [],
            css_path: "css/category-legend.css",
            update_hook: false,
            squares: true,
	    labels_align: 'right',
	    colors: d3.scale.category20() });

        var out = scaffold.setup_svg(o.selection, o.selection_is_svg,
                                     o.margins, o.fill_screen);
        o.svg = out.svg;
        o.height = out.height;
        o.width = out.width;

        // load the css
        o.ready = scaffold.load_css(o.css_path, function(css) {
            o.css = css;
            o.ready = true;
        });
        o.layers = [];

        o.color_scale = o.colors.domain(o.categories);

        // load the css
        d3.text(o.css_path, function(error, text) {
            if (error) {
                console.warn(error);
                o.css = "";
            } else {
                o.css = text;
            }
            update();
            return null;
        });

        return {
            update: update,
            get_scale: function () { return o.color_scale; },
            update_hook: set_update_hook
        };

        function update() {
	    var categories = o.categories;

            // clear the container and add again
            o.selection.select("#legend-container").remove();
            var container = o.selection.append("g").attr("id","legend-container");
            container.append("style")
                .attr('type', "text/css")
                .text(o.css);
            var svg = container.append("g")
                .attr("transform", "translate(" + o.margins.left + "," + o.margins.top + ")");


            // draw legend
            var radius = 10,
            legend_w = o.width;

	    var colors;
            if (o.squares) {
                colors = svg.selectAll('circle')
                    .data(o.categories)
                    .enter()
                    .append('rect')
                    .attr("class", "legend-circle")
                    .attr('width', radius*2)
                    .attr('height', radius*2)
                    .attr('fill', function (d) { return o.color_scale(d); });
            } else {
                colors = svg.selectAll('circle')
                    .data(o.categories)
                    .enter()
                    .append('circle')
                    .attr("class", "legend-circle")
                    .attr('r', radius)
                    .attr('fill', function (d) { return o.color_scale(d); });
            }
	  
            var text = svg.selectAll('text')
                .data(o.categories)
                .enter()
                .append('text')
                    .attr("class", "legend-text");

	    // align
	    if (o.labels_align=='left') {
                text.attr("text-anchor", "start")
                    .text(function (d) { return d; })
                    .attr('x', (4*radius))
                    .attr('y', function(d, i) {
			return (i*25)+30+radius/2;
                    });
		colors.attr("transform", function(d, i) {
                    return "translate("+(radius)+","+(i*25+20)+")";
                });
	    } else if (o.labels_align=='right') {
                text.attr("text-anchor", "end")
                    .text(function (d) { return d; })
                    .attr('x', legend_w/2 - (3*radius))
                    .attr('y', function(d, i) {
			return (i*25)+30+radius/2;
                    });
		colors.attr("transform", function(d, i) {
                    return "translate("+(legend_w/2 - radius)+","+(i*25+20)+")";
                });
	    }		
            if (o.update_hook) o.update_hook(svg);
            return this;
        };

        function height_width(fillScreen, sel, margins) {
            if (fillScreen==true) {
                sel.style('height', (window.innerHeight-margins.bottom)+'px');
                sel.style('width', (window.innerWidth-margins.right)+'px');
            }
            var width = parseFloat(sel.style('width')) - margins.left - margins.right,
            height = parseFloat(sel.style('height')) - margins.top - margins.bottom;
            return {'width': width, 'height': height};
        };
        function set_update_hook(fn) {
            o.update_hook = fn;
            return this;
        };

    };
});

define('vis/data-menu',["./scaffold", "lib/d3"], function(scaffold, d3) {
    return function(options) {
        var o = scaffold.set_options(options, {
            selection: d3.select("body"),
            getdatafiles: null,
            datafiles: null,
            update_callback: null });

        // setup dropdown menu
        // Append menu if it doesn't exist
        var menu = o.selection.select('.data-menu');
        if (menu.empty()) {
            menu = o.selection.append('div')
                .attr('class','data-menu');
        }
        var select_sel = menu.append('form')
            .append('select').attr('class','dropdown-menu');
        // TODO move this somewhere sensible
        // menu.append('div').style('width','100%').text("Press 's' to freeze tooltip");

        if (o.getdatafiles) {
            if (o.datafiles) {
                console.warn('DataMenu: getdatafiles option overrides datafiles');
            }
            d3.json(o.getdatafiles, function(error, d) {
                // returns json object:  { data: [file0, file1, ...] }
                if (error) {
                    return console.warn(error);
                } else {
                    load_with_files(d.data, select_sel, o.update_callback, o.selection);
                }
                return null;
            });
        } else if (o.datafiles) {
            load_with_files(o.datafiles, select_sel, o.update_callback, o.selection);
        } else {
            console.warn('DataMenu: No datafiles given');
        }

        return { update: update };

        // definitions
        function load_with_files(files, select_sel, update_callback, selection) {

            //when it changes
            select_sel.node().addEventListener("change", function() {
                load_datafile(this.value, selection, update_callback);
            }, false);

            var file = files[0];

            update(files, select_sel);
            load_datafile(file, selection, update_callback);
        };
        function load_datafile(this_file, selection, callback) {
            scaffold.load_the_file(this_file, function(error, data) {
                if (error) {
                    return console.warn(error);
                    selection.append('error loading');
                    o.data = null;
                } else {
                    o.data = data;
                    if (callback) {
                        callback(data);
                    }
                }
            });
        };

        function update(list, select_sel) {
            // update select element with d3 selection /select_sel/ to have options
            // given by /list/
            // TODO remove paths from file list
            select_sel.selectAll(".menu-option")
                .data(list)
                .enter()
                .append('option')
                .attr('value', function (d) { return d; } )
                .text(function (d) { return d; } );
            // TODO set value to default_filename_index
            select_sel.node().focus();
        };

        function get_data() {
            return o.data;
        };
    };
});

define('vis/epistasis',["./scaffold", "lib/d3"], function (scaffold, d3) {
    return function(options) {
        // set defaults
        var o = scaffold.set_options(options, {
            margins: {top: 0, right: 0, bottom: 0, left: 0},
            padding: {left: 70, bottom: 60, top: 10, right: 40},
            selection_is_svg: false,
            fillScreen: false,
            x_axis_label: "",
            y_axis_label: "",
            x_data_label: '1',
            y_data_label: '2',
            x_shift: 4,
            data_is_object: true,
            color_scale: false,
            y_range: false,
            title: false,
            is_stacked: false,
            update_hook: false,
            css_path: '' });

        var out = scaffold.setup_svg(o.selection, o.selection_is_svg,
                                     o.margins, o.fill_screen);
        o.svg = out.svg;
        o.height = out.height;
        o.width = out.width;

        // load the css
        o.ready = scaffold.load_css(o.css_path, function(css) {
            o.css = css;
            o.ready = true;
        });
        o.layers = [];

        return {
            update: update,
            collect_data: collect_data,
            update_size: update_size
        };

        // definitions

        o.data = [];
        o.selection = [];
        function update_size() {
            // var width = o.width,
            //     height = o.height;

            // var ns = o.selection.select("svg")
            //         .attr("width", width + o.margins.left + o.margins.right)
            //         .attr("height", height + o.margins.top + o.margins.bottom);
            // ns.select('g').attr("transform", "translate(" + o.margins.left + "," + o.margins.top + ")");

            // o.x.range([1, width]);
            // o.y.range([height, 1]);

            // o.xAxis.scale(o.x);
            // o.yAxis.scale(o.y);

            // o.selection.select('.x.axis')
            //     .attr("transform", "translate(0," + height + ")")
            //     .call(o.xAxis)
            //     .select('text')
            //     .attr("x", width);
            // o.selection.select('.y.axis')
            //     .call(o.yAxis);

            // o.selection.select(".points").selectAll('path')
            //     .attr("transform", function (d) {
            //         return "translate(" + o.x(d.f1) + "," + o.y(d.f2) + ")";
            //     });

            // o.selection.select(".trendline").select('path')
            //     .attr("d", o.line([[o.x(o.dom.x[0]), o.y(o.dom.y[0])],
            //                        [o.x(o.dom.x[1]), o.y(o.dom.y[1])]]));
            return this;
        }
        function update() {
            // load data
            var rxn_list = o.data.sorted_rxns,
                // name_function = function(x, i) { return {'name': x, 'index': i}; },
                name_function = function(x, i) { return {'name': 'enzyme '+(i+1), 'index': i}; },
                names = o.data.sorted_names.map(name_function),
                y_names = names,
                size = o.data.sorted_names.length,
                cases = o.data.cases,
                ep_type = 'ep_add',
                data = [];
            // generate box data
            for (var i=0; i<cases.length; i++) {
                var c = cases[i],
                    n = {};
                var index_1 = rxn_list.indexOf(c['rxn1']),
                    index_2 = rxn_list.indexOf(c['rxn2']),
                    p_1 = c['p1'],
                    p_2 = c['p2'],
                    min_max_diff = c['min_max_diff'];
                if (index_1==-1) console.warn('no match for ' + c['rxn1']);
                if (index_2==-1) console.warn('no match for ' + c['rxn2']);
                if (index_1 < index_2) {
                    n['index_x'] = index_1;
                    n['index_y'] = index_2; // y index start at 2nd entry
                    n['p_x'] = p_1;
                    n['p_y'] = p_2;
                } else {
                    n['index_x'] = index_2;
                    n['index_y'] = index_1;
                    n['p_x'] = p_2;
                    n['p_y'] = p_1;
                }
                n['ep'] = c[ep_type];
                n['empty'] = false;
                n['min_max_diff'] = min_max_diff;
                data.push(n);
            }

            // clear the container and add again
            o.svg.select("#container").remove();
            var sel = o.svg.append("g").attr("id","container")
                .attr("transform", "translate(" + o.margins.left + "," + o.margins.top + ")");

	    // size and scale
            var box_s = d3.min([Math.floor((o.width - o.padding.left -
					    o.padding.right)/size),
				Math.floor((o.height - o.padding.top -
					    o.padding.bottom)/size)]),
		rect_color = d3.scale.linear()
                    .domain([d3.min(data, function(x) {return x.ep;}),
                             0,
                             d3.max(data, function(x) {return x.ep;})])
                    .range(["#AF8DC3", "#F7F7F7", "#7FBF7B"]),
                rect_stroke = d3.scale.linear()
                    .domain([d3.min(data, function(x) {return x.min_max_diff;}),
                             d3.max(data, function(x) {return x.min_max_diff;})])
                    .range([1,4]);    // use .range([1,1]) for constant 1px borders

	    // add defs
	    o.svg.select("defs").remove();
            var defs = o.svg.append("defs");
	    defs.append("style")
                .attr('type', "text/css")
                .text(o.css);
            defs.append('clipPath')
                .attr('id', 'clip-top')
                .append('path')
                .attr('d', 'M 0 0 L 0 '+box_s+' L '+box_s+' 0 L 0 0');
            defs.append('clipPath')
                .attr('id', 'clip-bottom')
                .append('path')
                .attr('d', 'M 0 '+box_s+' L '+box_s+' 0 L '+box_s+' '+box_s+' L 0 '+box_s);

            // draw boxes
            var axis_disp = {'x': o.padding.left, 'y': o.padding.top};

            // make empty rects
            for (var i=0, empty_data = []; i<size; i++) {
                empty_data.push({ empty: true,
                                  index_x: i,
                                  index_y: i });
            }
            var empty = sel.append("g")
                    .attr("transform", "translate(" + o.padding.left + "," + o.padding.top + ")")
                    .selectAll('.cell')
                    .data(empty_data);
            empty.enter()
                .append('g')
                .attr('class', 'cell')
                .call(make_rect);
            // update
            empty.call(update_rect);

            // make filled rects
            var cells = sel.append("g")
                    .attr("transform", "translate(" + o.padding.left + "," + o.padding.top + ")")
                    .selectAll('.cell')
                    .data(data);
            cells.enter()
                .append('g')
                .attr('class', 'cell')
                .call(make_rect)
                .call(make_circles);
            // update
            cells.call(update_rect);

            // make rect outlines
            var empty_outline = sel.append("g")
                    .attr("transform", "translate(" + o.padding.left + "," + o.padding.top + ")")
                    .selectAll('.cell-outline')
                    .data(empty_data);
            empty_outline.enter()
                .append('g')
                .attr('class', 'cell-outline')
                .call(make_rect_outline);
            // update
            empty_outline.call(update_rect);
            var outline = sel.append("g")
                    .attr("transform", "translate(" + o.padding.left + "," + o.padding.top + ")")
                    .selectAll('.cell-outline')
                    .data(data);
            outline.enter()
                .append('g')
                .attr('class', 'cell-outline')
                .call(make_rect_outline);
            // update
            outline.call(update_rect);


            // make x labels
            var x_labels = sel.append('g')
                    .attr('class','labels')
                    .selectAll('.x-label')
                    .data(names);
            x_labels.enter()
                .append('text')
                .attr('class','x-label')
                .text(function (d) { return d.name; });
            x_labels.attr('transform', function(d) { return 'translate(' +
                                                     (d.index*box_s + box_s/3 + o.padding.left) + ',' +
                                                     (o.height - o.padding.bottom) + ') '+
                                                     'rotate(' + 45 + ')'; });

            // make xylabels
            var y_labels = sel.append('g')
                    .attr('class','labels')
                    .selectAll('.y-label')
                    .data(y_names);
            y_labels.enter()
                .append('text')
                .attr('class','y-label')
                .attr('text-anchor', 'end')
                .text(function (d) { return d.name; });
            y_labels.attr('transform', function(d) { return 'translate(' +
                                                     (o.padding.left - 3) + ',' +
                                                     (d.index*box_s + box_s/2 + o.padding.top) + ') '+
                                                     'rotate(' + 0 + ')'; });

            // make flux arrows
            var g = sel.append('g')
                    .attr('class', 'flux-arrows')
                    .attr('transform', 'translate('+(o.width/2+80)+','+(o.height/2-80)+')rotate(45)');
            g.append('text')
                .text('High flux')
                .attr('transform', 'translate('+(-(o.width-o.padding.left-o.padding.right)/2+50)+',0)');
            g.append('text')
                .text('Low flux')
                .attr('transform', 'translate('+((o.width-o.padding.left-o.padding.right)/2-50)+',0)');

            // make legend
            var legend = sel.append('g')
                    .attr('class', 'legend')
                    .attr('transform', 'translate('+(o.width-140)+','+(230)+')');
            var range = rect_color.range();
            var gradient = sel.append('defs')
                    .append('linearGradient')
                    .attr('id', 'gradient');
            gradient.append('stop')
                .attr('stop-color', range[0])
                .attr('offset', '0%');
            gradient.append('stop')
                .attr('stop-color', range[1])
                .attr('offset', '50%');
            gradient.append('stop')
                .attr('stop-color', range[2])
                .attr('offset', '100%');
            legend.append('rect')
                .attr('class', 'legend-gradient')
                .attr('width', 150)
                .attr('height', 30)
                .attr('fill', 'url(#gradient)')
                .attr('transform', 'rotate(-90)')
                .style('stroke', '#333')
                .style('stroke-width', '2px');
            legend.append('text').text('positive')
                .attr('transform', 'translate(40, -140)');
            legend.append('text').text('negative')
                .attr('transform', 'translate(40, 0)');

            return this;

            // update: definitions

            function make_rect(s) {
                s.append('rect')
                    .attr('class', 'square')
                    .attr('width', box_s)
                    .attr('height', box_s)
                    .attr('fill', function (d) {
                        if (d.empty==true) return '#fff';
                        else return rect_color(d.ep);
                    });
                s.append('line')
                    .attr('class', 'divider')
                // .attr('stroke-dasharray', '2')
                    .attr('x1', 0)
                    .attr('y1', box_s)
                    .attr('x2', box_s)
                    .attr('y2', 0);
            };
            function make_rect_outline(s) {
                s.append('rect')
                    .attr('class', 'square-outline')
                    .attr('width', function(d) {
                        if (d.empty==true) return box_s;
                        else return box_s - Math.floor(rect_stroke(d.min_max_diff)) + 1;
                    })
                    .attr('height', function(d) {
                        if (d.empty==true) return box_s;
                        else return box_s - Math.floor(rect_stroke(d.min_max_diff)) + 1;
                    })
                    .attr('transform', function(d) {
                        if (d.empty==true) return 'translate(0,0)';
                        else return 'translate(' + [Math.floor(rect_stroke(d.min_max_diff))/2 - 0.5,
                                                    Math.floor(rect_stroke(d.min_max_diff))/2 - 0.5] +
                            ')';
                    })
                    .style('stroke-width', function(d) {
                        if (d.empty==true) return 1;
                        else return Math.floor(rect_stroke(d.min_max_diff)); });
            };
            function update_rect(s) {
                // update
                s.attr('transform', function(d) { return 'translate(' +
                                                  (d.index_x*box_s) + ',' +
                                                  (d.index_y*box_s) + ')'; });
            }
            function make_circles(s) {
                var rad = Math.floor(box_s/4);
                s.append('g')
                    // .attr('height', box_s)
                    // .attr('width', box_s)
                    .attr('clip-path', 'url(#clip-top)')
                    .append('circle')
                    .attr('class', 'circle y-circle')
                    .attr('r', rad)
                    .attr('transform', function(d) {
                        // d.p2/100 = rad^2/2*(Math.PI/180*angle - Math.sin(angle)) / (Math.PI*rad^2)
                        // cos(angle/2) = d1 / rad
                        // d1 = sqrt(m_x^2 + m_y^2)

                        // groso.approximation
                        var dir = ((d.p_y-50.0)*rad/50.0) > 0,
                            m = Math.sqrt( Math.pow( ((d.p_y-50.0)*rad/50.0) , 2) / 2.0 );
                        if (dir) m = m * -1;
                        return 'translate('+(box_s/2+m)+','+(box_s/2+m)+')';
                    });
                s.append('g')
                    // .attr('height', box_s)
                    // .attr('width', box_s)
                    .attr('clip-path', 'url(#clip-bottom)')
                    .append('circle')
                    .attr('class', 'circle x-circle')
                    .attr('r', rad)
                    .attr('transform', function(d) {
                        // groso.approximation
                        var dir = ((d.p_x-50.0)*rad/50.0) > 0,
                            m = Math.sqrt( Math.pow( ((d.p_x-50.0)*rad/50.0) , 2) / 2.0 );
                        if (dir) m = m * -1;
                        return 'translate('+(box_s/2-m)+','+(box_s/2-m)+')';
                    });
            }
        }
        function collect_data(json) {
            if (!o.ready) console.warn('Hasn\'t loaded css yet');
            o.data = json;
            update();
            return this;
        }
    };
});

/**
 * vkBeautify - javascript plugin to pretty-print or minify text in XML, JSON, CSS and SQL formats.
 *
 * Version - 0.99.00.beta
 * Copyright (c) 2012 Vadim Kiryukhin
 * vkiryukhin @ gmail.com
 * http://www.eslinstructor.net/vkbeautify/
 *
 * Dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 *
 *   Pretty print
 *
 *        vkbeautify.xml(text [,indent_pattern]);
 *        vkbeautify.json(text [,indent_pattern]);
 *        vkbeautify.css(text [,indent_pattern]);
 *        vkbeautify.sql(text [,indent_pattern]);
 *
 *        @text - String; text to beatufy;
 *        @indent_pattern - Integer | String;
 *                Integer:  number of white spaces;
 *                String:   character string to visualize indentation ( can also be a set of white spaces )
 *   Minify
 *
 *        vkbeautify.xmlmin(text [,preserve_comments]);
 *        vkbeautify.jsonmin(text);
 *        vkbeautify.cssmin(text [,preserve_comments]);
 *        vkbeautify.sqlmin(text);
 *
 *        @text - String; text to minify;
 *        @preserve_comments - Bool; [optional];
 *                Set this flag to true to prevent removing comments from @text ( minxml and mincss functions only. )
 *
 *   Examples:
 *        vkbeautify.xml(text); // pretty print XML
 *        vkbeautify.json(text, 4 ); // pretty print JSON
 *        vkbeautify.css(text, '. . . .'); // pretty print CSS
 *        vkbeautify.sql(text, '----'); // pretty print SQL
 *
 *        vkbeautify.xmlmin(text, true);// minify XML, preserve comments
 *        vkbeautify.jsonmin(text);// minify JSON
 *        vkbeautify.cssmin(text);// minify CSS, remove comments ( default )
 *        vkbeautify.sqlmin(text);// minify SQL
 *
 */

define('lib/vkbeautify',[],function() {

    function createShiftArr(step) {

        var space = '    ';

        if ( isNaN(parseInt(step)) ) {  // argument is string
            space = step;
        } else { // argument is integer
            switch(step) {
            case 1: space = ' '; break;
            case 2: space = '  '; break;
            case 3: space = '   '; break;
            case 4: space = '    '; break;
            case 5: space = '     '; break;
            case 6: space = '      '; break;
            case 7: space = '       '; break;
            case 8: space = '        '; break;
            case 9: space = '         '; break;
            case 10: space = '          '; break;
            case 11: space = '           '; break;
            case 12: space = '            '; break;
            }
        }

        var shift = ['\n']; // array of shifts
        for(ix=0;ix<100;ix++){
            shift.push(shift[ix]+space);
        }
        return shift;
    }

    function vkbeautify(){
        this.step = '    '; // 4 spaces
        this.shift = createShiftArr(this.step);
    };

    vkbeautify.prototype.xml = function(text,step) {

        var ar = text.replace(/>\s{0,}</g,"><")
                .replace(/</g,"~::~<")
                .replace(/\s*xmlns\:/g,"~::~xmlns:")
                .replace(/\s*xmlns\=/g,"~::~xmlns=")
                .split('~::~'),
            len = ar.length,
            inComment = false,
            deep = 0,
            str = '',
            ix = 0,
            shift = step ? createShiftArr(step) : this.shift;

        for(ix=0;ix<len;ix++) {
            // start comment or <![CDATA[...]]> or <!DOCTYPE //
            if(ar[ix].search(/<!/) > -1) {
                str += shift[deep]+ar[ix];
                inComment = true;
                // end comment  or <![CDATA[...]]> //
                if(ar[ix].search(/-->/) > -1 || ar[ix].search(/\]>/) > -1 || ar[ix].search(/!DOCTYPE/) > -1 ) {
                    inComment = false;
                }
            } else
                // end comment  or <![CDATA[...]]> //
                if(ar[ix].search(/-->/) > -1 || ar[ix].search(/\]>/) > -1) {
                    str += ar[ix];
                    inComment = false;
                } else
                    // <elm></elm> //
                    if( /^<\w/.exec(ar[ix-1]) && /^<\/\w/.exec(ar[ix]) &&
                        /^<[\w:\-\.\,]+/.exec(ar[ix-1]) == /^<\/[\w:\-\.\,]+/.exec(ar[ix])[0].replace('/','')) {
                        str += ar[ix];
                        if(!inComment) deep--;
                    } else
                        // <elm> //
                        if(ar[ix].search(/<\w/) > -1 && ar[ix].search(/<\//) == -1 && ar[ix].search(/\/>/) == -1 ) {
                            str = !inComment ? str += shift[deep++]+ar[ix] : str += ar[ix];
                        } else
                            // <elm>...</elm> //
                            if(ar[ix].search(/<\w/) > -1 && ar[ix].search(/<\//) > -1) {
                                str = !inComment ? str += shift[deep]+ar[ix] : str += ar[ix];
                            } else
                                // </elm> //
                                if(ar[ix].search(/<\//) > -1) {
                                    str = !inComment ? str += shift[--deep]+ar[ix] : str += ar[ix];
                                } else
                                    // <elm/> //
                                    if(ar[ix].search(/\/>/) > -1 ) {
                                        str = !inComment ? str += shift[deep]+ar[ix] : str += ar[ix];
                                    } else
                                        // <? xml ... ?> //
                                        if(ar[ix].search(/<\?/) > -1) {
                                            str += shift[deep]+ar[ix];
                                        } else
                                            // xmlns //
                                            if( ar[ix].search(/xmlns\:/) > -1  || ar[ix].search(/xmlns\=/) > -1) {
                                                str += shift[deep]+ar[ix];
                                            }

            else {
                str += ar[ix];
            }
        }

        return  (str[0] == '\n') ? str.slice(1) : str;
    }

    vkbeautify.prototype.json = function(text,step) {

        var step = step ? step : this.step;

        if (typeof JSON === 'undefined' ) return text;

        if ( typeof text === "string" ) return JSON.stringify(JSON.parse(text), null, step);
        if ( typeof text === "object" ) return JSON.stringify(text, null, step);

        return text; // text is not string nor object
    }

    vkbeautify.prototype.css = function(text, step) {

        var ar = text.replace(/\s{1,}/g,' ')
                .replace(/\{/g,"{~::~")
                .replace(/\}/g,"~::~}~::~")
                .replace(/\;/g,";~::~")
                .replace(/\/\*/g,"~::~/*")
                .replace(/\*\//g,"*/~::~")
                .replace(/~::~\s{0,}~::~/g,"~::~")
                .split('~::~'),
            len = ar.length,
            deep = 0,
            str = '',
            ix = 0,
            shift = step ? createShiftArr(step) : this.shift;

        for(ix=0;ix<len;ix++) {

            if( /\{/.exec(ar[ix]))  {
                str += shift[deep++]+ar[ix];
            } else
                if( /\}/.exec(ar[ix]))  {
                    str += shift[--deep]+ar[ix];
                } else
                    if( /\*\\/.exec(ar[ix]))  {
                        str += shift[deep]+ar[ix];
                    }
            else {
                str += shift[deep]+ar[ix];
            }
        }
        return str.replace(/^\n{1,}/,'');
    }

    //----------------------------------------------------------------------------

    function isSubquery(str, parenthesisLevel) {
        return  parenthesisLevel - (str.replace(/\(/g,'').length - str.replace(/\)/g,'').length )
    }

    function split_sql(str, tab) {

        return str.replace(/\s{1,}/g," ")

            .replace(/ AND /ig,"~::~"+tab+tab+"AND ")
            .replace(/ BETWEEN /ig,"~::~"+tab+"BETWEEN ")
            .replace(/ CASE /ig,"~::~"+tab+"CASE ")
            .replace(/ ELSE /ig,"~::~"+tab+"ELSE ")
            .replace(/ END /ig,"~::~"+tab+"END ")
            .replace(/ FROM /ig,"~::~FROM ")
            .replace(/ GROUP\s{1,}BY/ig,"~::~GROUP BY ")
            .replace(/ HAVING /ig,"~::~HAVING ")
        //.replace(/ SET /ig," SET~::~")
            .replace(/ IN /ig," IN ")

            .replace(/ JOIN /ig,"~::~JOIN ")
            .replace(/ CROSS~::~{1,}JOIN /ig,"~::~CROSS JOIN ")
            .replace(/ INNER~::~{1,}JOIN /ig,"~::~INNER JOIN ")
            .replace(/ LEFT~::~{1,}JOIN /ig,"~::~LEFT JOIN ")
            .replace(/ RIGHT~::~{1,}JOIN /ig,"~::~RIGHT JOIN ")

            .replace(/ ON /ig,"~::~"+tab+"ON ")
            .replace(/ OR /ig,"~::~"+tab+tab+"OR ")
            .replace(/ ORDER\s{1,}BY/ig,"~::~ORDER BY ")
            .replace(/ OVER /ig,"~::~"+tab+"OVER ")

            .replace(/\(\s{0,}SELECT /ig,"~::~(SELECT ")
            .replace(/\)\s{0,}SELECT /ig,")~::~SELECT ")

            .replace(/ THEN /ig," THEN~::~"+tab+"")
            .replace(/ UNION /ig,"~::~UNION~::~")
            .replace(/ USING /ig,"~::~USING ")
            .replace(/ WHEN /ig,"~::~"+tab+"WHEN ")
            .replace(/ WHERE /ig,"~::~WHERE ")
            .replace(/ WITH /ig,"~::~WITH ")

        //.replace(/\,\s{0,}\(/ig,",~::~( ")
        //.replace(/\,/ig,",~::~"+tab+tab+"")

            .replace(/ ALL /ig," ALL ")
            .replace(/ AS /ig," AS ")
            .replace(/ ASC /ig," ASC ")
            .replace(/ DESC /ig," DESC ")
            .replace(/ DISTINCT /ig," DISTINCT ")
            .replace(/ EXISTS /ig," EXISTS ")
            .replace(/ NOT /ig," NOT ")
            .replace(/ NULL /ig," NULL ")
            .replace(/ LIKE /ig," LIKE ")
            .replace(/\s{0,}SELECT /ig,"SELECT ")
            .replace(/\s{0,}UPDATE /ig,"UPDATE ")
            .replace(/ SET /ig," SET ")

            .replace(/~::~{1,}/g,"~::~")
            .split('~::~');
    }

    vkbeautify.prototype.sql = function(text,step) {

        var ar_by_quote = text.replace(/\s{1,}/g," ")
                .replace(/\'/ig,"~::~\'")
                .split('~::~'),
            len = ar_by_quote.length,
            ar = [],
            deep = 0,
            tab = this.step,//+this.step,
            inComment = true,
            inQuote = false,
            parenthesisLevel = 0,
            str = '',
            ix = 0,
            shift = step ? createShiftArr(step) : this.shift;;

        for(ix=0;ix<len;ix++) {
            if(ix%2) {
                ar = ar.concat(ar_by_quote[ix]);
            } else {
                ar = ar.concat(split_sql(ar_by_quote[ix], tab) );
            }
        }

        len = ar.length;
        for(ix=0;ix<len;ix++) {

            parenthesisLevel = isSubquery(ar[ix], parenthesisLevel);

            if( /\s{0,}\s{0,}SELECT\s{0,}/.exec(ar[ix]))  {
                ar[ix] = ar[ix].replace(/\,/g,",\n"+tab+tab+"")
            }

            if( /\s{0,}\s{0,}SET\s{0,}/.exec(ar[ix]))  {
                ar[ix] = ar[ix].replace(/\,/g,",\n"+tab+tab+"")
            }

            if( /\s{0,}\(\s{0,}SELECT\s{0,}/.exec(ar[ix]))  {
                deep++;
                str += shift[deep]+ar[ix];
            } else
                if( /\'/.exec(ar[ix]) )  {
                    if(parenthesisLevel<1 && deep) {
                        deep--;
                    }
                    str += ar[ix];
                }
            else  {
                str += shift[deep]+ar[ix];
                if(parenthesisLevel<1 && deep) {
                    deep--;
                }
            }
            var junk = 0;
        }

        str = str.replace(/^\n{1,}/,'').replace(/\n{1,}/g,"\n");
        return str;
    }


    vkbeautify.prototype.xmlmin = function(text, preserveComments) {

        var str = preserveComments ? text
                : text.replace(/\<![ \r\n\t]*(--([^\-]|[\r\n]|-[^\-])*--[ \r\n\t]*)\>/g,"")
                .replace(/[ \r\n\t]{1,}xmlns/g, ' xmlns');
        return  str.replace(/>\s{0,}</g,"><");
    }

    vkbeautify.prototype.jsonmin = function(text) {

        if (typeof JSON === 'undefined' ) return text;

        return JSON.stringify(JSON.parse(text), null, 0);

    }

    vkbeautify.prototype.cssmin = function(text, preserveComments) {

        var str = preserveComments ? text
                : text.replace(/\/\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*+\//g,"") ;

        return str.replace(/\s{1,}/g,' ')
            .replace(/\{\s{1,}/g,"{")
            .replace(/\}\s{1,}/g,"}")
            .replace(/\;\s{1,}/g,";")
            .replace(/\/\*\s{1,}/g,"/*")
            .replace(/\*\/\s{1,}/g,"*/");
    }

    vkbeautify.prototype.sqlmin = function(text) {
        return text.replace(/\s{1,}/g," ").replace(/\s{1,}\(/,"(").replace(/\s{1,}\)/,")");
    }

    return new vkbeautify();

});

define('vis/export-svg',["lib/d3", "lib/vkbeautify"], function (d3, vkbeautify) {
    return function() {
        var m = {};
        m.utf8_to_b64 = function(str) {
            return window.btoa(unescape(encodeURIComponent( str )));
        };
        m.download = function(name, selection, do_beautify) {
            var a = document.createElement('a'), xml, ev;
            a.download = name+'.svg'; // file name
            xml = (new XMLSerializer()).serializeToString(d3.select(selection).node()); // convert node to xml string
            if (do_beautify) xml = vkbeautify.xml(xml);
            xml = '<?xml version="1.0" encoding="utf-8"?>\n \
                <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN"\n \
            "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n' + xml;
            a.setAttribute("href-lang", "image/svg+xml");
            a.href = 'data:image/svg+xml;base64,' + m.utf8_to_b64(xml); // create data uri
            // <a> constructed, simulate mouse click on it
            ev = document.createEvent("MouseEvents");
            ev.initMouseEvent("click", true, false, self, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
            a.dispatchEvent(ev);
        };
        return {'download': m.download};
    };
});

define('vis/histogram',["./scaffold", "lib/d3"], function (scaffold, d3) {
    /** histogram.js

     (c) Zachary King 2013

     TODO add update_size function.
     
     */
    return function(options) {
        // set defaults
        var o = scaffold.set_options(options, {
            margins: {top: 10, right: 10, bottom: 10, left: 20},
            padding: {left: 30, bottom: 30, top: 10, right: 10},
            selection: d3.select('body').append('div'),
            selection_is_svg: false,
            fill_screen: false,
            title: false,
            update_hook: false,
            css_path: '',
            x_axis_label: "",
            y_axis_label: "",
            x_data_label: '1',
            y_data_label: '2',
            x_shift: 10 });

        var out = scaffold.setup_svg(o.selection, o.selection_is_svg,
                                     o.margins, o.fill_screen);
        o.svg = out.svg;
        o.height = out.height;
        o.width = out.width;

        // load the css
        o.ready = scaffold.load_css(o.css_path, function(css) {
            o.css = css;
            o.ready = true;
        });
        o.layers = [];

        return {
            update: update,
            collect_data: collect_data
        };

        // definitions
        function update() {
            // reset defs
            o.svg.select("defs").remove();
            o.svg.append("defs").append("style")
                .attr('type', "text/css")
                .text(o.css);

            // clear the container and add again
            o.svg.select("#scatter-container").remove();
            var container = o.svg.append("g").attr("id","scatter-container");
            o.sel = container.attr("transform", "translate(" + o.margins.left + "," + 
				   o.margins.top + ")");

            var layers = o.layers,
                height = o.height, width = o.width;

            // check data
            var i=-1;
            while(++i < layers.length) {
                if (layers[i]===undefined) {
                    console.log('waiting for all indices');
                    return this;
                }
            }

            // find x domain
            var x_dom = [
                d3.min(layers, function(a) {
                    return d3.min(a, function(d) { return d.x; });
                }),
                d3.max(layers, function(a) {
                    return d3.max(a, function(d) { return d.x; });
                })
            ];
            o.dom = {'x': x_dom};

            // generate x scale
	    var x_is_log = false, y_is_log = false,
		out = scaffold.scale_and_axes(o.dom.x, null, width, height,
                                              { padding: o.padding,
                                                x_is_log: x_is_log,
                                                x_ticks: 15});
            o.x = out.x;

            // Generate a histogram using twenty uniformly-spaced bins.
            var layout = [],
                hist = d3.layout.histogram()
                    .value(function (d) { return d.x; })
                    .bins(o.x.ticks(15));
            layout = layers.map(function(j) { return hist(j); });

            var y_dom = [
                0,
                d3.max(layout, function (a) {
                    return d3.max(a, function(d) { return d.y; });
                })
            ];
            o.dom.y = y_dom;

            // add scale and axes
            out = scaffold.scale_and_axes(o.dom.x, o.dom.y, width, height,
                                          { padding: o.padding,
                                            x_is_log: x_is_log,
                                            y_is_log: y_is_log,
                                            x_ticks: 15});
            o.x = out.x, o.y = out.y;
            scaffold.add_generic_axis('x', o.x_axis_label, o.sel, out.x_axis, width, height, o.padding);
            scaffold.add_generic_axis('y', o.y_axis_label, o.sel, out.y_axis, width, height, o.padding);

	    console.log(o.dom.x, o.dom.y);

            o.x_size_scale = d3.scale.linear()
                .range([0, width])
                .domain([0, o.dom.x[1] - o.dom.x[0]]);

            o.xAxis = d3.svg.axis()
                .scale(o.x)
                .orient("bottom")
                .ticks(15);         //TODO make sure this matches x_ticks

            o.yAxis = d3.svg.axis()
                .scale(o.y)
                .orient("left")
                .ticks(20);


            var legend = o.sel.append("g")
                    .attr("class", "legend")
                    .attr("transform", "translate(" + (width-300) + ", 80)")
                    .attr("width", "300px")
                    .attr("height", "200px");

            o.diff = 8;
            o.hist_dx = layout[0][0].dx;
            var bar_w = o.x_size_scale(o.hist_dx) - o.diff - o.x_shift;
	    console.log(o.y);

            for (var j=0; j<layout.length; j++) {
                var cl = 'hist-bar'+String(j);
                var bars = o.sel.selectAll("."+cl)
                        .data(layout[j])
                        .enter().append("g")
                        .attr("class", "hist-bar "+cl)
                        .attr("transform", function(d) { return "translate(" + (o.x(d.x)+o.x_shift*j-bar_w/2) + "," + o.y(d.y) + ")"; });
                bars.append("rect")
                    .attr("x", 1)
                    .attr("width", bar_w)
                    .attr("height", function(d) { return o.y(o.dom.y[0]) - o.y(d.y); });
                // add_legend(legend, layers[j].options.name, j, 'legend '+cl);
            }

            return this;

	    // definitions
            function add_legend(a, t, i, cl) {
                var g = a.append("g")
                        .attr("transform", "translate(0,"+i*40+")");
                g.append("text")
                    .text(t)
                    .attr("transform", "translate(30, 14)");
                g.append("rect")
                    .attr("width", 15)
                    .attr("height", 15)
                    .attr("class", cl);
            }
        }
        function update_size() {
            // // TODO inherit this function
            // var o = o.height_width(o.fillScreen, o.selection, o.margins);
            // var height = o.height, width = o.width;

            // var ns = o.selection.select("svg")
            //         .attr("width", width + o.margins.left + o.margins.right)
            //         .attr("height", height + o.margins.top + o.margins.bottom);
            // ns.select('g').attr("transform", "translate(" + o.margins.left + "," + o.margins.top + ")");

            // o.x.range([0, width]);
            // o.y.range([height, 0]);

            // o.x_size_scale.range([0, width]);

            // o.xAxis.scale(o.x);
            // o.yAxis.scale(o.y);

            // o.selection.select('.x.hist-axis')
            //     .attr("transform", "translate(0," + height + ")")
            //     .call(o.xAxis)
            //     .select('text')
            //     .attr("x", width);
            // o.selection.select('.y.hist-axis')
            //     .call(o.yAxis);

            // var bar_w = o.x_size_scale(o.hist_dx) - o.diff - 8;

            // for (var i=0; i<s.json.length; i++) {
            //     o.selection.selectAll(".hist-bar.hist-bar"+String(i))
            //         .attr("transform", function(d) {
            //             return "translate(" + (o.x(d.x) + o.x_shift*i) + "," + o.y(d.y) + ")";
            //         })
            //         .select('rect')
            //         .attr("width", bar_w)
            //         .attr("height", function(d) { return height - o.y(d.y); });
            // }

            // d3.select(".legend")     //TODO options for legend location
            //     .attr("transform", "translate(" + (width-300) + ", 80)");

            // return this;
        };
        function collect_data(json, layer) {
            o.layers[layer] = json.data;
            update();
	    return this;
        };
    };
});

define('vis/resize',[],function () {
    return { on_resize: on_resize };

    function on_resize(callback, interval) {
        if (typeof interval === 'undefined') interval = 1000;
        window.do_resize = false;
        window.onresize = function(event) {
            window.do_resize = true;
        };
        window.setInterval( function () {
            if (window.do_resize) {
                callback();
                window.do_resize = false;
            }
        }, interval);
    };
});

define('vis/scatter',["./scaffold", "lib/d3"], function (scaffold, d3) {
    return function(options) {
        // set defaults
        var o = scaffold.set_options(options, {
            margins: {top: 10, right: 10, bottom: 10, left: 20},
	    padding: {left: 30, bottom: 30, top: 10, right: 10},
            selection_is_svg: false,
	    selection: d3.select('body'),
            fillScreen: false,
            // data_is_object: true,
            title: false,
            update_hook: false,
            css_path: '',
	    tooltip: false,
	    x_is_log: true,
	    y_is_log: true });

        var out = scaffold.setup_svg(o.selection, o.selection_is_svg,
                                     o.margins, o.fill_screen);
        o.svg = out.svg;
        o.height = out.height;
        o.width = out.width;

        // load the css
        o.ready = scaffold.load_css(o.css_path, function(css) {
            o.css = css;
            o.ready = true;
        });
        o.layers = [];

        return {
            update: update,
	    update_size: update_size,
            collect_data: collect_data
        };

        // definitions
        function update_size() {
	    // update size
            var out = scaffold.resize_svg(o.selection, o.selection_is_svg,
					  o.margins, o.fill_screen);
            o.height = out.height;
            o.width = out.width;

	    // update scales and axes
	    out = scaffold.scale_and_axes(o.dom.x, o.dom.y, o.width, o.height,
					      { padding: o.padding,
						x_is_log: o.x_is_log,
						y_is_log: o.y_is_log });
	    o.x = out.x, o.y = out.y, o.x_axis = out.x_axis, o.y_axis = out.y_axis;

	    // redraw axes
            o.sel.select('.x.axis').remove();
            o.sel.select('.y.axis').remove();
	    scaffold.add_generic_axis('x', o.x_axis_label, o.sel, o.x_axis, o.width,
				      o.height, o.padding);
	    scaffold.add_generic_axis('y', o.y_axis_label, o.sel, o.y_axis, o.width,
				      o.height, o.padding);

	    // update points
            o.sel.select(".points").selectAll('path')
                .attr("transform", function (d) {
                    return "translate(" + o.x(d.f1) + "," + o.y(d.f2) + ")";
                });

	    // update trendline
            o.sel.select(".trendline").select('path')
                .attr("d", o.line([[o.x(o.dom.x[0]), o.y(o.dom.y[0])],
	    			   [o.x(o.dom.x[1]), o.y(o.dom.y[1])]]));
	    return this;
        }
        function update() {
	    // reset defs
	    o.svg.select("defs").remove();
            o.svg.append("defs").append("style")
                .attr('type', "text/css")
                .text(o.css);

            // clear the container and add again
            o.svg.select("#scatter-container").remove();
            var container = o.svg.append("g").attr("id","scatter-container");
            o.sel = container.attr("transform", "translate(" + o.margins.left + "," + o.margins.top + ")");

	    var height = o.height, width = o.width,
	    padding = o.padding;

            // assuming only a single layer for now
            // TODO allow for multiple layers
            if (o.layers.length==0) return null;
            var layer_0 = o.layers[0];
            if (layer_0.x===undefined || layer_0.y===undefined) {
		console.log("data hasn't finished loading");
		return null;
	    }

            var name_x, name_y, f = [], pushed = [];
            for (var i=0; i<layer_0.x.length; i++) {
                name_x = layer_0.x[i].name;
                for (var j=0; j<layer_0.y.length; j++) {
                    name_y = layer_0.y[j].name;
                    if (name_x == name_y && pushed.indexOf(name_x)==-1) {
                        f.push({'name': name_x, 'f1': layer_0.x[i].x, 'f2': layer_0.y[j].x});
                        pushed.push(name_x);
                    }
                }
            }

            // set zero values to min
            var f1nz = f.map(function (d) { // f1 not zero
                if (d.f1>0) { return d.f1; }
                else { return null; }
            });
            var f2nz = f.map(function (d) { // f2 not zero
                if (d.f2>0) { return d.f2; }
                else { return null; }
            });

            var equal_axes = false;
            if (equal_axes) {
                var a_dom = [d3.min([d3.min(f1nz), d3.min(f2nz)]) / 2,
                             d3.max([d3.max(f1nz), d3.max(f2nz)])];
                o.dom = {'x': a_dom, 'y': a_dom};
            }
            else {
                o.dom = {'x': [d3.min(f1nz) / 2,
                               d3.max(f1nz)],
                         'y': [d3.min(f2nz) / 2,
                               d3.max(f2nz)]};
            }

            f = f.map(function (d) {
                if (d.f1 < o.dom.x[0]) { d.f1 = o.dom.x[0];  }
                if (d.f2 < o.dom.y[0]) { d.f2 = o.dom.y[0];  }
                return d;
            });

	    // add scale and axes
	    var out = scaffold.scale_and_axes(o.dom.x, o.dom.y, width, height,
					      { padding: padding,
						x_is_log: o.x_is_log,
						y_is_log: o.y_is_log });
	    o.x = out.x, o.y = out.y, o.x_axis = out.x_axis, o.y_axis = out.y_axis;
	    scaffold.add_generic_axis('x', o.x_axis_label, o.sel, out.x_axis, width, height, padding);
	    scaffold.add_generic_axis('y', o.y_axis_label, o.sel, out.y_axis, width, height, padding);
	   
            o.line = d3.svg.line()
                .x(function(d) { return d[0]; })
                .y(function(d) { return d[1]; });

            var g = o.sel.append("g")
                .attr("class", "legend")
                .attr("transform", "translate(200, 80)")
                .attr("width", "300px")
                .attr("height", "200px");

            o.sel.append("g")
                .attr("class", "points")
                .selectAll("path")
                .data(f)
                .enter()
                .append("path")
                .attr("d", d3.svg.symbol().type('circle').size(28))
                .attr('class', 'point-circle')
                .style("fill", function(d) {
                    if (/.*/g.exec(d.name)) {
                        return 'red';
                    } else {
                        return 'none';
                    }
                })
                .attr("transform", function (d) {
                    return "translate(" + o.x(d.f1) + "," + o.y(d.f2) + ")";
                })
                .append("title")
                .text(function(d) { return d.name; });

            o.sel.append("g")
                .attr("class", "trendline")
                .append("path")
                .attr("d", o.line([[o.x(o.dom.x[0]), o.y(o.dom.y[0])], [o.x(o.dom.x[1]), o.y(o.dom.y[1])]]));


            // setup up cursor tooltip
            var save_key = 83;
            if (o.tooltip) o.tooltip.cursor_tooltip(o.sel, width+o.margins.left+o.margins.right,
						    height+o.margins.top+o.margins.bottom, o.x, o.y,
						    save_key);
            return this;
        }

        function collect_data(data, axis, layer) {
            if (axis!='x' && axis!='y') console.warn('bad axis: ' + axis);
            if (!o.layers[layer]) o.layers[layer] = {};
            o.layers[layer][axis] = data;
            update();
	    return this;
        }
    };
});

define('vis/subplot',["./scaffold", "lib/d3"], function (scaffold, d3) {
    return function(options) {
        var o = scaffold.set_options(options, {
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
	    spacing: 0,
            rows: 2,
            columns: 2,
            fill_screen: false,
            selection: d3.select('body') });

        var out = scaffold.setup_svg(o.selection, o.selection_is_svg,
                                     o.margins, o.fill_screen);
        o.svg = out.svg;
        o.height = out.height;
        o.width = out.width;

        // clear the container and add again
	// TODO add to scaffold.setup_svg
        o.svg.select("#subplot-container").remove();
        var container = o.svg.append("g").attr("id","subplot-container");
        o.sel = container.attr("transform", "translate(" + o.margins.left + "," + o.margins.top + ")");
        o.frames = [];
        for (var y=0; y<o.rows; y+=1) {
            // divide into rows
            var a_row = [];
            for (var x=0; x<o.columns; x+=1) {
                // divide into columns
                var fr = o.sel.append('g')
                        .attr('class', 'grid')
                        .datum({'x_i': x, 'y_i': y});
                a_row.push(fr);
            }
            o.frames.push(a_row);
        }
        update();

        return { get_frames: get_frames,
                 frame_by_row_col: get_frame,
                 update: update };

        // definitions
        function get_frames() {
            return o.frames;
            return this;
        }
        function get_frame(row, column) {
            return o.frames[row][column];
            return this;
        }
        function update() {
            var row_h = o.height/o.rows,
                col_w = o.width/o.columns;

            d3.selectAll('.grid')
                .attr('transform',   function(d) { return 'translate(' +
                                                   Math.floor(d.x_i * col_w) + ',' +
                                                   Math.floor(d.y_i * row_h) + ')';
                                                 })
                .attr('width',  function(d) { return Math.floor(col_w - o.spacing); })
                .attr('height', function(d) { return Math.floor(row_h - o.spacing); });
            return this;
        }
    };
});

define('vis/tooltip',["./scaffold", "lib/d3"], function (scaffold, d3) {
    /** tooltip.js

     (c) Zachary King 2013

     TODO fix to update based on vis/resize.js
     */

    return function(options) {
        // set defaults
        var o = scaffold.set_options(options, {
            text_height: 18 });

	return { cursor_tooltip: cursor_tooltip };

	// definitions
        function dist(x1, y1, x2, y2) {
            return Math.sqrt(Math.pow(x2-x1,2)+Math.pow(y2-y1,2));
        }

        function insert_linebreaks(t, text) {
            var words = text.split('\n');
            t.text('');

            for (var i = 0; i < words.length; i++) {
                var tspan = t.append('tspan').text(words[i]);
                if (i > 0)
                    tspan.attr('x', 0)
                    .attr('dy', o.text_height);
            }
            return words.length;
        };

        function create_textspans(tooltip, loc) {
            var texts = d3.selectAll('.point-circle')
                    .filter(function (d, i) {
                        var distance = dist(loc[0], loc[1], window.x_scale(d.f1), window.y_scale(d.f2));
                        return (distance < window.radius);
                    });
            if (texts[0].length > 0) {
                var this_text = "";
                texts.each(function(d) {
                    this_text += d.name + '\n';
                });
                var l = insert_linebreaks(tooltip, this_text.trim());
                tooltip.attr('dy', -l*o.text_height/2);
            } else {
                tooltip.text("");
                tooltip.attr('dy', '0');
            }
        }


        function cursor_tooltip(node, w, h, x_scale, y_scale, save_key) {
            /** cursor_tootip(node)

             Add a tooltip for any objects near the cursor.

             node - Append the SVG objects to this node.
             */
            var mouse_node = node.append('rect')
                    .attr("width", w)
                    .attr("height", h)
                    .attr('style', 'visibility: hidden')
                    .attr('pointer-events', 'all');

            window.x_scale = x_scale;
            window.y_scale = y_scale;
            window.radius = 10;
            var g = node
                    .append('g')
                    .attr('class', 'cursor-tooltip')
                    .attr('pointer-events', 'none');

            var circle = g.append('circle')
                    .attr('class','cursor-tooltip-circle')
                    .attr('r', window.radius);
            var tooltip = g.append('g')
                    .attr('transform', 'translate('+(window.radius+2)+',0)')
                    .append('text')
                    .attr('class', 'cursor-tooltip-text');
            var play = false;
            window.setInterval(function(){play=true;}, 100);
            mouse_node.on('mousemove', function (d, i) {
                window.loc = d3.mouse(this);
                if (play) {
                    g.attr('transform', 'translate('+loc[0]+','+loc[1]+')');
                    create_textspans(tooltip, loc);
                    play = false;
                }
            });

            var saved_locs = [];
            var saved_node = node.append('g').attr('id', 'saved_tooltips');
            function update_circles(s) {
                saved_node.selectAll('.saved_tooltip')
                    .data(s)
                    .enter()
                    .append('g')
                    .attr('class', 'saved_tooltip')
                    .attr('transform', function (d) {
                        return 'translate('+d[0]+','+d[1]+')';
                    })
                    .call(add_tooltip);
            }
            if (save_key>=0) {
                d3.select(window).on("keydown", function() {
                    if (d3.event.keyCode==save_key) {
                        saved_locs = saved_locs.concat([window.loc]);
                        update_circles(saved_locs);
                    }
                });
            }
        }

        function add_tooltip() {
            this.append('circle')
                .attr('class','cursor-tooltip-circle')
                .attr('r', window.radius);
            var tt = this.append('g')
                    .attr('transform', 'translate('+(window.radius+2)+',0)')
                    .append('text')
                    .attr('class', 'cursor-tooltip-text');
            create_textspans(tt, this.datum());
        }

    };
});

define('metabolic-map/utils',["lib/d3"], function (d3) {
    return { setup_zoom_container: setup_zoom_container,
             setup_defs: setup_defs,
	     draw_an_array: draw_an_array,
	     draw_an_object: draw_an_object,
	     make_array: make_array,
	     clone: clone,
	     c_plus_c: c_plus_c,
	     c_minus_c: c_minus_c,
	     download_json: download_json,
	     load_json: load_json,
	     define_scales: define_scales,
	     calculate_new_reaction_coordinates: calculate_new_reaction_coordinates,
	     calculate_new_metabolite_coordinates: calculate_new_metabolite_coordinates,
	     rotate_coords_recursive: rotate_coords_recursive,
	     rotate_coords: rotate_coords,
	     rotate_coords_relative: rotate_coords_relative,
	     rotate_coords_relative_recursive: rotate_coords_relative_recursive,
	     get_angle: get_angle,
	     to_degrees: to_degrees,
	     distance: distance };

    // definitions
    function setup_zoom_container(svg, w, h, scale_extent, callback, zoom_on_fn) {
	if (callback===undefined) callback = function() {};
	if (zoom_on_fn===undefined) zoom_on_fn = function() { return true; };
        // set up the container
        svg.select("#container").remove();
        var container = svg.append("g")
                .attr("id", "container"),
            sel = container.append("g"),
            zoom = function() {
		if (zoom_on_fn()) {
                    sel.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
		    callback(d3.event);
		}
            },
	    zoom_behavior = d3.behavior.zoom().scaleExtent(scale_extent).on("zoom", zoom);
        container.call(zoom_behavior);
        return {sel: sel,
		zoom: zoom_behavior,
		initial_zoom: 1.0 };
    }

    function setup_defs(svg, style) {
        // add stylesheet
        svg.select("defs").remove();
        var defs = svg.append("defs");
        defs.append("style")
            .attr("type", "text/css")
            .text(style);
        return defs;
    }

    function draw_an_array(sel_parent_node, sel_children, array, 
			   create_function, update_function) {
	/** Run through the d3 data binding steps for an array.
	 */
	var sel = d3.select(sel_parent_node)
            .selectAll(sel_children)
            .data(array);
	// enter: generate and place reaction
	sel.enter().call(create_function);
	// update: update when necessary
	sel.call(update_function);
	// exit
	sel.exit().remove();
    }

    function draw_an_object(sel_parent_node, sel_children, object, 
			    id_key, create_function, update_function) {
	/** Run through the d3 data binding steps for an object.
	 */
	var sel = d3.select(sel_parent_node)
            .selectAll(sel_children)
            .data(make_array(object, id_key), function(d) { return d[id_key]; });
	// enter: generate and place reaction
	sel.enter().call(create_function);
	// update: update when necessary
	sel.call(update_function);
	// exit
	sel.exit().remove();
    }

    function make_array(obj, id_key) { // is this super slow?
        var array = [];
        for (var key in obj) {
            // copy object
            var it = clone(obj[key]);
            // add key as 'id'
            it[id_key] = key;
            // add object to array
            array.push(it);
        }
        return array;
    }

    function clone(obj) {
	// Handles the array and object types, and null or undefined
	if (null == obj || "object" != typeof obj) return obj;
	// Handle Array
	if (obj instanceof Array) {
            var copy = [];
            for (var i = 0, len = obj.length; i < len; i++) {
		copy[i] = clone(obj[i]);
            }
            return copy;
	}
	// Handle Object
	if (obj instanceof Object) {
            var copy = {};
            for (var attr in obj) {
		if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
            }
            return copy;
	}
	throw new Error("Unable to copy obj! Its type isn't supported.");
    }

    function c_plus_c(coords1, coords2) {
	return { "x": coords1.x + coords2.x,
		 "y": coords1.y + coords2.y };
    }
    function c_minus_c(coords1, coords2) {
	return { "x": coords1.x - coords2.x,
		 "y": coords1.y - coords2.y };
    }

    function download_json(json, name) {
        var a = document.createElement('a');
        a.download = name+'.json'; // file name
        // xml = (new XMLSerializer()).serializeToString(d3.select(selection).node()); // convert node to xml string;
	var j = JSON.stringify(json);
        a.setAttribute("href-lang", "text/json");
        a.href = 'data:image/svg+xml;base64,' + utf8_to_b64(j); // create data uri
        // <a> constructed, simulate mouse click on it
        var ev = document.createEvent("MouseEvents");
        ev.initMouseEvent("click", true, false, self, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
        a.dispatchEvent(ev);

        function utf8_to_b64(str) {
            return window.btoa(unescape(encodeURIComponent( str )));
        }
    }

    function load_json(f, callback) {
	// Check for the various File API support.
	if (!(window.File && window.FileReader && window.FileList && window.Blob))
	    callback("The File APIs are not fully supported in this browser.", null);
	if (!f.type.match("application/json"))
	    callback("Not a json file.", null);

	var reader = new window.FileReader();
	// Closure to capture the file information.
	reader.onload = function(event) {
	    var json = JSON.parse(event.target.result);
	    callback(null, json);
        };
	// Read in the image file as a data URL.
	reader.readAsText(f);
    }

    function define_scales(map_w, map_h, w, h) {
        var factor = Math.min(w/map_w, h/map_h),
            scale = {};
        scale.x = d3.scale.linear()
            .domain([0, map_w])
            .range([(w - map_w*factor)/2, map_w*factor + (w - map_w*factor)/2]),
        scale.y = d3.scale.linear()
            .domain([0, map_h])
            .range([(h - map_h*factor)/2, map_h*factor + (h - map_h*factor)/2]),
        scale.x_size = d3.scale.linear()
            .domain([0, map_w])
            .range([0, map_w*factor]),
        scale.y_size = d3.scale.linear()
            .domain([0, map_h])
            .range([0, map_h*factor]),
        scale.size = d3.scale.linear()
            .domain([0, 1])
            .range([0, factor]),
        scale.flux = d3.scale.linear()
            .domain([0, 40])
            .range([6, 6]),
        scale.flux_fill = d3.scale.linear()
            .domain([0, 40, 200])
            .range([1, 1, 1]),
        scale.flux_color = d3.scale.linear()
            .domain([0, 0.000001, 1, 8, 50])
            .range(["rgb(200,200,200)", "rgb(190,190,255)", "rgb(100,100,255)", "blue", "red"]),
        scale.metabolite_concentration = d3.scale.linear()
            .domain([0, 10])
            .range([15, 200]),
        scale.metabolite_color = d3.scale.linear()
            .domain([0, 1.2])
            .range(["#FEF0D9", "#B30000"]);
        scale.scale_path = function(path) {
            var x_fn = scale.x, y_fn = scale.y;
            // TODO: scale arrow width
            var str = d3.format(".2f"),
                path = path.replace(/(M|L)([0-9-.]+),?\s*([0-9-.]+)/g, function (match, p0, p1, p2) {
                    return p0 + [str(x_fn(parseFloat(p1))), str(y_fn(parseFloat(p2)))].join(', ');
                }),
                reg = /C([0-9-.]+),?\s*([0-9-.]+)\s*([0-9-.]+),?\s*([0-9-.]+)\s*([0-9-.]+),?\s*([0-9-.]+)/g;
            path = path.replace(reg, function (match, p1, p2, p3, p4, p5, p6) {
                return 'C'+str(x_fn(parseFloat(p1)))+','+
                    str(y_fn(parseFloat(p2)))+' '+
                    str(x_fn(parseFloat(p3)))+','+
                    str(y_fn(parseFloat(p4)))+' '+
                    [str(x_fn(parseFloat(p5)))+','+str(y_fn(parseFloat(p6)))];
            });
            return path;
        };
        scale.scale_decimals = function(path, scale_fn, precision) {
            var str = d3.format("."+String(precision)+"f");
            path = path.replace(/([0-9.]+)/g, function (match, p1) {
                return str(scale_fn(parseFloat(p1)));
            });
            return path;
        };
        return scale;
    }

    function calculate_new_reaction_coordinates(reaction, coords) {
	/* Assign coordinates to a new reaction.
	 *	 
	 * Sets dis, main_axis, center, and coords.	 
	 *
	 * The coords are absolute; center and main_axis are relative.
	 */
        var dis = 120;

	// rotate main axis around angle with distance
        var main_axis = [{'x': 0, 'y': 0}, {'x': dis, 'y': 0}],
	    center = { 'x': (main_axis[0].x + main_axis[1].x)/2,   // for convenience
                       'y': (main_axis[0].y + main_axis[1].y)/2 };
        reaction.dis = dis;
        reaction.main_axis = main_axis;
        reaction.center = center;
	reaction.coords = coords;
        return reaction;
    }

    function calculate_new_metabolite_coordinates(met, primary_index, main_axis, center, dis) {
	/* Calculate metabolite coordinates for a new reaction metabolite.
	 */

        // basic constants
        met.text_dis = {'x': 0, 'y': -18}; // displacement of metabolite label
        met.dis = {'x': 0, 'y': 0}; // metabolite drag displacement

        // Curve parameters
        var w = 60,  // distance between reactants and between products
            b1_strength = 0.5,
            b2_strength = 0.2,
            w2 = w*0.7,
            secondary_dis = 20,
            num_slots = Math.min(2, met.count - 1);

        // size and spacing for primary and secondary metabolites
        var ds, draw_at_index;
        if (met.is_primary) { // primary
            met.r = 10;
            ds = 20;
        } else { // secondary
            met.r = 5;
            ds = 10;
            // don't use center slot
            if (met.index > primary_index) draw_at_index = met.index - 1;
            else draw_at_index = met.index;
        }

        var de = dis - ds, // distance between ends of line axis
            reaction_axis = [{'x': ds, 'y': 0},
                             {'x': de, 'y': 0}];

        // Define line parameters and axis.
        // Begin with unrotated coordinate system. +y = Down, +x = Right.
        var start = center,
            end, circle, b1, b2;
        // reactants
        if (met.coefficient < 0 && met.is_primary) {
            end = {'x': reaction_axis[0].x + met.dis.x,
                   'y': reaction_axis[0].y + met.dis.y};
            b1 = {'x': start.x*(1-b1_strength) + reaction_axis[0].x*b1_strength,
                  'y': start.y*(1-b1_strength) + reaction_axis[0].y*b1_strength};
            b2 = {'x': start.x*b2_strength + (end.x)*(1-b2_strength),
                  'y': start.y*b2_strength + (end.y)*(1-b2_strength)},
            circle = {'x': main_axis[0].x + met.dis.x,
                      'y': main_axis[0].y + met.dis.y};
        } else if (met.coefficient < 0) {
	    end = {'x': reaction_axis[0].x + secondary_dis + met.dis.x,
                   'y': reaction_axis[0].y + (w2*draw_at_index - w2*(num_slots-1)/2) + met.dis.y},
            b1 = {'x': start.x*(1-b1_strength) + reaction_axis[0].x*b1_strength,
                  'y': start.y*(1-b1_strength) + reaction_axis[0].y*b1_strength},
            b2 = {'x': start.x*b2_strength + end.x*(1-b2_strength),
                  'y': start.y*b2_strength + end.y*(1-b2_strength)},
            circle = {'x': main_axis[0].x + secondary_dis + met.dis.x,
                      'y': main_axis[0].y + (w*draw_at_index - w*(num_slots-1)/2) + met.dis.y};
        } else if (met.coefficient > 0 && met.is_primary) {        // products
            end = {'x': reaction_axis[1].x + met.dis.x,
                   'y': reaction_axis[1].y + met.dis.y};
            b1 = {'x': start.x*(1-b1_strength) + reaction_axis[1].x*b1_strength,
                  'y': start.y*(1-b1_strength) + reaction_axis[1].y*b1_strength};
            b2 = {'x': start.x*b2_strength + end.x*(1-b2_strength),
                  'y': start.y*b2_strength + end.y*(1-b2_strength)},
            circle = {'x': main_axis[1].x + met.dis.x,
                      'y': main_axis[1].y + met.dis.y};
        } else if (met.coefficient > 0) {
            end = {'x': reaction_axis[1].x - secondary_dis + met.dis.x,
                   'y': reaction_axis[1].y + (w2*draw_at_index - w2*(num_slots-1)/2) + met.dis.y},
            b1 = {'x': start.x*(1-b1_strength) + reaction_axis[1].x*b1_strength,
                  'y': start.y*(1-b1_strength) + reaction_axis[1].y*b1_strength};
            b2 = {'x': start.x*b2_strength + end.x*(1-b2_strength),
                  'y': start.y*b2_strength + end.y*(1-b2_strength)},
            circle = {'x': main_axis[1].x - secondary_dis + met.dis.x,
                      'y': main_axis[1].y + (w*draw_at_index - w*(num_slots-1)/2) + met.dis.y};
        }
	met.end = end; met.b1 = b1; met.b2 = b2; met.circle = circle; met.start = start;
        return met;
    }

    function rotate_coords_recursive(coords_array, angle, center) {
	var rot = function(c) { return rotate_coords(c, angle, center); };
        return coords_array.map(rot);
    }

    function rotate_coords(c, angle, center) {
        var dx = Math.cos(-angle) * (c.x - center.x) +
                Math.sin(-angle) * (c.y - center.y) +
                center.x,
            dy = - Math.sin(-angle) * (c.x - center.x) +
                Math.cos(-angle) * (c.y - center.y) +
                center.y;
        return {'x': dx, 'y': dy};
    }

    function rotate_coords_relative(coord, angle, center, displacement) {
	// convert to absolute coords, rotate, then convert back
	var abs = c_plus_c(coord, displacement);
	return c_minus_c(rotate_coords(abs, angle, center), displacement);
    }
    function rotate_coords_relative_recursive(coords, angle, center, displacement) {
	// convert to absolute coords, rotate, then convert back
	var to_abs = function(c) { return c_plus_c(c, displacement); };
	var to_rel = function(c) { return c_minus_c(c, displacement); };
	return rotate_coords_recursive(coords.map(to_abs), angle, center).map(to_rel);
    }

    function get_angle(coords) {
	/* Takes an array of 2 coordinate objects {"x": 1, "y": 1}
	 *
	 * Returns angle between 0 and 2PI.
	 */
	var denominator = coords[1].x - coords[0].x,
	    numerator = coords[1].y - coords[0].y;
	if (denominator==0 && numerator >= 0) return Math.PI/2;
	else if (denominator==0 && numerator < 0) return 3*Math.PI/2;
	else if (denominator >= 0 && numerator >= 0) return Math.atan(numerator/denominator);
	else if (denominator >= 0) return (Math.atan(numerator/denominator) + 2*Math.PI);
	else return (Math.atan(numerator/denominator) + Math.PI);
    }

    function to_degrees(radians) { return radians*180/Math.PI; }

    function distance(start, end) { return Math.sqrt(Math.pow(end.y-start.y, 2) + Math.pow(end.x-start.x, 2)); }

});

define('metabolic-map/main',["vis/scaffold", "metabolic-map/utils", "lib/d3"], function (scaffold, utils, d3) {
    return function(options) {
        // set defaults
        var o = scaffold.set_options(options, {
            margins: {top: 10, right: 10, bottom: 10, left: 20},
            selection_is_svg: false,
            fillScreen: false,
            update_hook: false,
            css_path: "css/metabolic-map.css",
            map_path: null,
            map_json: null,
            flux_path: null,
            flux: null,
            flux2_path: null,
            flux2: null,
            flux_source: function() {},
            css: '',
            metabolite_zoom_threshold: 0,
            reaction_zoom_threshold: 0,
            label_zoom_threshold: 0,
            zoom_bounds: [0, 25] });

        var out = scaffold.setup_svg(o.selection, o.selection_is_svg,
                                     o.margins, o.fill_screen);
        o.svg = out.svg;
        o.height = out.height;
        o.width = out.width;

        // listeners
        o.listeners = {};

        var files_to_load = [
            { file: o.map_path, callback: set_map, value: o.map_json },
            { file: o.css_path, callback: set_css, value: o.css },
            { file: o.flux_path,
              callback: function(e, f) { set_flux(e, f, 0); },
              value: o.flux },
            { file: o.flux2_path,
              callback: function(e, f) { set_flux(e, f, 1); },
              value: o.flux2 } ];

        if (!o.map_json && !o.map_path) {
            return console.warn("No map provided. Set either map_json or map_path");
        }
        scaffold.load_files(files_to_load, setup);

        return { set_flux_source: set_flux_source,
                 add_listener: add_listener,
                 remove_listener: remove_listener,
                 reload_flux: reload_flux,
                 set_status: set_status,
		 set_update_hook: set_update_hook };

        // Definitions
        function set_css(error, css) {
            if (error) console.warn(error);
            o.css = css;
        };
        function set_map(error, map_data) {
            if (error) console.warn(error);
            o.map_data = map_data;
        };
        function set_flux(error, flux, index) {
            if (error) console.warn("Flux" + index + ": " + error);
            if (index==0) o.flux = flux;
            else if (index==1) o.flux2 = flux;
        };
        function set_flux_source(fn) {
            o.flux_source = fn;
            return this;
        };
        function set_update_hook(fn) {
            o.update_hook = fn;
            return this;
        };
        function reload_flux() {
            o.flux_source(function (fluxes, is_viable, objective) {
                if (!is_viable) {
                    set_status('cell is dead :\'(');
                    fluxes = [];
                } else if (objective) {
                    set_status('objective: ' + d3.format('.3f')(objective) + "    (HINT: Click a reaction)");
                }
                o.map_data = flux_to_data(o.map_data, fluxes, null, null);
                o.has_metabolites = false; o.has_metabolite_deviation = false;
                update();
            });
            return this;
        }
        function remove_listener(target, type) {
            /**
             * Remove a listener.
             */

            // delete the saved listener
            delete o.listeners[target][type];
            // removed from selection by applying null
            apply_a_listener(target, type, null);
            return this;
        }
        function apply_a_listener(target, type, callback, context) {
            /**
             Apply a single listener. To register multiple listeners for the same
             event type, the type may be followed by an optional namespace, such
             as "click.foo" and "click.bar".

             */

            // If callback is null, pass the null through to remove the listener.
            var new_callback = callback;
            if (callback!=null) new_callback = function(d) { callback.call(context, d.id); };
            d3.selectAll(target).on(type, new_callback);
        }
        function apply_listeners() {
            /**
             Update all saved listeners.

             */

            for (var target in o.listeners)
                for (var type in o.listeners[target])
                    apply_a_listener(target, type,
                                     o.listeners[target][type].callback,
                                     o.listeners[target][type].context);
        }
        function add_listener(target, type, callback) {
            /**
             Save a new listener, and apply it.

             */
            // save listener
            if (!o.listeners.hasOwnProperty(target))
                o.listeners[target] = {};
            o.listeners[target][type] = {'callback': callback, 'context': this};
            // apply the listener
            apply_a_listener(target, type, callback, this);
            return this;
        }
        function set_status(status) {
            var t = d3.select('body').select('#status');
            if (t.empty()) t = d3.select('body')
                .append('text')
                .attr('id', 'status');
            t.text(status);
            return this;
        }
        function setup() {
            o.decimal_format = d3.format('.4g');
            o.style_variables = get_style_variables(o.style);

            // set up svg and svg definitions
            o.scale = utils.define_scales(o.map_data.max_map_w,
					  o.map_data.max_map_h,
					  o.width, o.height);
            var defs = utils.setup_defs(o.svg, o.css);
            generate_markers(defs);

            var out = utils.setup_zoom_container(o.svg, o.width, o.height, o.zoom_bounds, function(ev) {
                o.zoom = ev.scale;
                update_visibility();
            });
            o.sel = out.sel,
            o.zoom = out.initial_zoom;

            // parse the data objects
            o.has_flux = false; o.has_flux_comparison = false;
            o.has_metabolites = false; o.has_metabolite_deviation = false;
            if (o.flux) {
                o.has_flux = true;
                o.map_data = parse_flux_1(o.map_data, o.flux);
                if (o.flux2) {
                    o.has_flux_comparison = true;
                    o.map_data = parse_flux_2(o.map_data, o.flux2);
                }
            }
            if (o.metabolites) {
                o.has_metabolites = true;
                o.map_data = parse_metabolites_1(o.map_data, o.metabolites);
                if (o.metabolites2) {
                    o.has_metabolite_deviation = true;
                    o.map_data = parse_metabolites_2(o.map_data, o.metabolites2);
                }
            }

            reload_flux();
            update();

            // setup() definitions
            function get_style_variables(style) {
                return [];

                // var r = new RegExp("/\*(a-zA-Z)+\*/");
            }
            function generate_markers(defs) {
                var g = defs.append('g')
                        .attr('id', 'markers');

                g.append("marker")
                    .attr("id", "end-triangle-path-color")
                    .attr("markerHeight", 2.1)
                    .attr("markerUnits", "strokeWidth")
                    .attr("markerWidth", 2.1)
                    .attr("orient", "auto")
                    .attr("refX", 0)
                    .attr("refY", 6)
                    .attr("viewBox", "0 0 12 12")
                    .append("path")
                    .attr("d", "M 0 0 L 12 6 L 0 12 z")
                    .attr("class", "marker");

                g.append("marker")
                    .attr("id", "start-triangle-path-color")
                    .attr("markerHeight", 2.0)
                    .attr("markerUnits", "strokeWidth")
                    .attr("markerWidth", 2.0)
                    .attr("orient", "auto")
                    .attr("refX", 12)
                    .attr("refY", 6)
                    .attr("viewBox", "0 0 12 12")
                    .append("path")
                    .attr("d", "M 12 0 L 0 6 L 12 12 z")
                    .attr("class", "marker");
                return defs;
            }
        }
        function update() {
            // remove everything from container
            o.sel.selectAll("*").remove();

            // add overlay
            o.sel.append("rect")
                .attr("class", "overlay")
                .attr("width", o.width)
                .attr("height", o.height)
                .attr("style", "stroke:black;fill:none;");

            // generate map

            // always show these elements
            draw_membranes();
            draw_misc_labels();

            // draw these based on zoom thresholds
            draw_metabolites();
            draw_reaction_labels();
            draw_metabolite_labels();
            draw_reaction_paths();
            update_visibility();

            apply_listeners();

	    o.update_hook(o.sel);
        }
        function draw_membranes() {

            draw_these_membranes(o.sel, o.map_data.membrane_rectangles, o.scale);
        }
        function draw_these_membranes(selection, membrane_rectangles, scale) {
            selection.append("g")
                .attr("id", "membranes")
                .selectAll("rect")
                .data(membrane_rectangles)
                .enter().append("rect")
                .attr("class", function(d){ return d.class; })
                .attr("width", function(d){ return scale.x_size(d.width); })
                .attr("height", function(d){ return scale.y_size(d.height); })
                .attr("transform", function(d){return "translate("+scale.x(d.x)+","+scale.y(d.y)+")";})
                .style("stroke-width", function(d) { return scale.size(10); })
                .attr('rx', function(d){ return scale.x_size(20); })
                .attr('ry', function(d){ return scale.x_size(20); });
        }

        function draw_metabolites() {
            if (o.map_data.hasOwnProperty("metabolite_circles")) {
                draw_these_metabolite_circles(o.sel, o.map_data.metabolite_circles, o.scale,
                                              o.has_metabolites, o.has_metabolite_deviation);
            } else if (o.map_data.hasOwnProperty("metabolite_paths")) {
                if (o.has_metabolites) { alert('metabolites do not render w simpheny maps'); }
                draw_these_metabolite_paths(o.sel, o.map_data.metabolite_paths, o.scale);
            }
        }
        function draw_these_metabolite_circles(selection, metabolite_circles, scale,
                                               has_metabolites, has_metabolite_deviation) {
            selection.append("g")
                .attr("id", "metabolite-circles")
                .selectAll("circle")
                .data(data.metabolite_circles)
                .enter().append("circle")
                .attr("r", function (d) {
                    var sc = scale.metabolite_concentration;
                    if (d.metabolite_concentration) {
                        var s;
                        if (d.should_size) s = scale.size(sc(d.metabolite_concentration));
                        else s = scale.size(0);
                        return s;
                    } else if (has_metabolites) {
                        return scale.size(10);
                    } else {
                        return scale.size(d.r);
                    }
                })
                .attr("style", function (d) {
                    var sc = scale.metabolite_color;
                    if (d.metabolite_concentration) {
                        var a;
                        if (d.should_color) a = "fill:"+sc(d.metabolite_concentration) + ";" +
                            "stroke:black;stroke-width:0.5;";
                        else a = "fill:none;stroke:black;stroke-width:0.5;";
                        return a;
                    }
                    else if (has_metabolites) {
                        return "fill:grey;stroke:none;stroke-width:0.5;";
                    }
                    else { return ""; }
                })
                .attr("transform", function(d){
                    return "translate("+scale.x(d.cx)+","+scale.y(d.cy)+")";
                });
            if (has_metabolite_deviation) {
                append_deviation_arcs(selection, metabolite_circles);
            }

            // definitions
            function append_deviation_arcs(selection, metabolite_circles) {
                var arc_data = metabolite_circles.filter( function(o) {
                    return (o.hasOwnProperty('metabolite_deviation') &&
                            o.hasOwnProperty('metabolite_concentration'));
                });
                var arc = d3.svg.arc()
                        .startAngle(function(d) { return -d.metabolite_deviation/100/2*2*Math.PI; })
                        .endAngle(function(d) { return d.metabolite_deviation/100/2*2*Math.PI; })
                        .innerRadius(function(d) { return 0; })
                        .outerRadius(function(d) {
                            var s;
                            if (d.should_size) s = scale.size(scale.metabolite_concentration(d.metabolite_concentration));
                            else s = scale.size(0);
                            return s;
                        });
                selection.append("g")
                    .attr("id", "metabolite-deviation-arcs")
                    .selectAll("path")
                    .data(arc_data)
                    .enter().append("path")
                    .attr('d', arc)
                    .attr('style', "fill:black;stroke:none;opacity:0.4;")
                    .attr("transform", function(d) {
                        return "translate("+scale.x(d.cx)+","+scale.y(d.cy)+")";
                    });
            }
        }
        function draw_these_metabolite_paths(selection, metabolite_paths, scale) {
            selection.append("g")
                .attr("id", "metabolite-paths")
                .selectAll("path")
                .data(metabolite_paths)
                .enter().append("path")
                .attr("d", function(d) { return scale.scale_path(d.d); })
                .style("fill", "rgb(224, 134, 91)")
                .style("stroke", "rgb(162, 69, 16)")
                .style("stroke-width", String(scale.size(2))+"px");
        }
        function draw_reaction_labels() {
            draw_these_reaction_labels(o.sel, o.map_data.reaction_labels, o.scale, o.has_flux,
                                       o.has_flux_comparison, o.style_variables, o.decimal_format);
        }
        function draw_these_reaction_labels(selection, reaction_labels, scale, has_flux,
                                            has_flux_comparison, style_variables, decimal_format) {
            selection.append("g")
                .attr("id", "reaction-labels")
                .selectAll("text")
                .data(reaction_labels)
                .enter().append("text")
                .attr("class", "reaction-label")
                .text(function(d) {
                    var t = d.text;
                    if (has_flux_comparison)
                        t += " ("+decimal_format(d.flux1)+"/"+decimal_format(d.flux2)+": "+decimal_format(d.flux)+")";
                    else if (d.flux) t += " ("+decimal_format(d.flux)+")";
                    else if (has_flux) t += " (0)";
                    return t;
                })
                .attr("text-anchor", "start")
                .attr("font-size", function(d) {
                    var s;
                    if (style_variables.hasOwnProperty('reaction_label_size')) {
                        s = style_variables['reaction_label_size'];
                    }
                    else { s = 15; }
                    return scale.size(s);
                })
            // .attr("style", function(d){ if(!d.flux) return "visibility:hidden;"; else return ""; })
                .attr("transform", function(d){return "translate("+scale.x(d.x)+","+scale.y(d.y)+")";});
        }

        function draw_misc_labels() {
            draw_these_labels(o.sel, "misc-labels", o.map_data.misc_labels, o.scale);
        };
        function draw_these_labels(selection, id, labels, scale) {
            selection.append("g")
                .attr("id", id)
                .selectAll("text")
                .data(labels)
                .enter().append("text")
                .text(function(d) { return d.text; })
                .attr("font-size", scale.size(60))
                .attr("transform", function(d){return "translate("+scale.x(d.x)+","+scale.y(d.y)+")";});
        }

        function draw_metabolite_labels() {
            draw_these_metabolite_labels(o.sel, o.map_data.metabolite_labels, o.scale,
                                         o.has_metabolites, o.has_metabolite_deviation, o.decimal_format);
        };
        function draw_these_metabolite_labels(selection, metabolite_labels, scale,
                                              has_metabolites, has_metabolite_deviation,
                                              decimal_format) {
            selection.append("g")
                .attr("id", "metabolite-labels")
                .selectAll("text")
                .data(metabolite_labels)
                .enter().append("text")
                .text(function(d) {
                    var t = d.text;
                    if (isNaN(d.metabolite_concentration)) {}
                    else if (has_metabolite_deviation) {
                        var a = (isNaN(d.metabolite_concentration) ? "-" : decimal_format(d.metabolite_concentration));
                        var b = (isNaN(d.metabolite_deviation) ? "-" : decimal_format(d.metabolite_deviation));
                        t += " ("+a+" \xB1 "+b+"%)";
                    }
                    else if (d.metabolite_concentration) {
                        var a = (isNaN(d.metabolite_concentration) ? "-" : decimal_format(d.metabolite_concentration));
                        t += " ("+a+")";
                    }
                    else if (has_metabolites) t += " (0)";
                    return t;
                })
                .attr("font-size", function(d) {
                    if (d.metabolite_concentration) return scale.size(30);
                    else if (has_metabolites) return scale.size(20);
                    else return scale.size(20);
                })
                .attr("transform", function(d){return "translate("+scale.x(d.x)+","+scale.y(d.y)+")";});
        }
        function draw_reaction_paths() {
            draw_these_reaction_paths(o.sel, o.map_data.reaction_paths, o.scale, o.has_flux);
        }
        function draw_these_reaction_paths(selection, reaction_paths, scale, has_flux) {
            selection.append("g")
                .attr("id", "reaction-paths")
                .selectAll("path")
                .data(reaction_paths)
                .enter().append("path")
                .attr("d", function(d) { return scale.scale_path(d.d); })
                .attr("class", function(d) { return d["class"] + " reaction-path"; })
                .attr("style", function(d) {
                    var s = "", sc = scale.flux;
                    // .fill-arrow is for simpheny maps where the path surrounds line and
                    // arrowhead
                    // .line-arrow is for bigg maps were the line is a path and the
                    // arrowhead is a marker
                    if (d["class"]=="fill-arrow") sc = scale.flux_fill;
                    if (d.flux) {
                        s += "stroke-width:"+String(scale.size(sc(Math.abs(d.flux))))+";";
                        s += "stroke:"+scale.flux_color(Math.abs(d.flux))+";";
                        if (d["class"]=="fill-arrow") { s += "fill:"+scale.flux_color(Math.abs(d.flux))+";"; }
                        else if (d["class"]=="line-arrow") { make_arrowhead_for_fill(); }
                        else s += "fill:none";
                    }
                    else if (has_flux) {
                        s += "stroke-width:"+String(scale.size(sc(0)))+";";
                        s += "stroke:"+scale.flux_color(Math.abs(0))+";";
                        if (d["class"]=="fill-arrow") s += "fill:"+scale.flux_color(0)+";";
                        else s += "fill:none";
                    }
                    else {
                        s += "stroke-width:"+String(scale.size(1))+";";
                    }
                    return s;
                })
                .style('marker-end', function (d) {
                    if (!/end/.test(d.class)) return '';
                    if (d.flux) return make_arrowhead_for_fill(scale.flux_color(d.flux));
                    else if (has_flux) return make_arrowhead_for_fill(scale.flux_color(0));
                    else return "url(#end-triangle-path-color)";
                })
                .style('marker-start', function (d) {
                    if (!/start/.test(d.class)) return '';
                    if (d.flux) return make_arrowhead_for_fill(scale.flux_color(d.flux));
                    else if (has_flux) return make_arrowhead_for_fill(scale.flux_color(0));
                    else return "url(#start-triangle-path-color)";
                });
        }
        function update_visibility() {
            /* Update the visibility of element based on zoom thresholds.
             */
            if (o.is_visible===undefined)
                o.is_visible = { metabolites: true, reactions: true, labels: true };
            if (o.hidden_dom===undefined)
                o.hidden_dom = {};
            if (o.zoom < o.reaction_zoom_threshold) hide_reactions();
            else show_reactions();
            if (o.zoom < o.metabolite_zoom_threshold) hide_metabolites();
            else show_metabolites();
            if (o.zoom < o.label_zoom_threshold) hide_labels();
            else show_labels();

            // definitions
            function hide_metabolites() {
                if (!o.is_visible.metabolites) return;
                var t = o.sel.select("#metabolite-circles");
                if (!t.empty()) {
                    o.hidden_dom.metabolite_circles = t.node();
                    t.remove();
                    o.is_visible.metabolites = false;
                    return;
                }
                t = o.sel.select("#metabolite-paths");
                if (!t.empty()) {
                    o.hidden_dom.metabolite_paths = t.node();
                    t.remove();
                    o.is_visible.metabolites = false;
                    return;
                }
            }
            function show_metabolites() {
                if (o.is_visible.metabolites) return;
                if (!o.hidden_dom.metabolite_circles && !o.hidden_dom.metabolite_paths) {
                    console.warn("couldn't find hidden metabolites.");
                } else if (o.hidden_dom.metabolite_circles) {
                    o.sel.node().appendChild(o.hidden_dom.metabolite_circles);
                    o.is_visible.metabolites = true;
                } else {
                    o.sel.node().appendChild(o.hidden_dom.metabolite_paths);
                    o.is_visible.metabolites = true;
                }
            }
            function hide_reactions() {
                if (!o.is_visible.reactions) return;
                var t = o.sel.select("#reaction-paths");
                if (!t.empty()) {
                    o.hidden_dom.reactions = t.node();
                    t.remove();
                    o.is_visible.reactions = false;
                }
            }
            function show_reactions() {
                if (o.is_visible.reactions) return;
                if (!o.hidden_dom.reactions) {
                    console.warn("couldn't find hidden reactions.");
                } else {
                    o.sel.node().appendChild(o.hidden_dom.reactions);
                    o.is_visible.reactions = true;
                }
            }
            function hide_labels() {
                if (!o.is_visible.labels) return;
                var t = o.sel.select("#metabolite-labels");
                if (!t.empty()) {
                    o.hidden_dom.metabolite_labels = t.node();
                    t.remove();
                }
                t = o.sel.select("#reaction-labels");
                if (!t.empty()) {
                    o.hidden_dom.reaction_labels = t.node();
                    t.remove();
                }
                o.is_visible.labels = false;
            }
            function show_labels() {
                if (o.is_visible.labels) return;
                if (!o.hidden_dom.metabolite_labels || !o.hidden_dom.reaction_labels) {
                    console.warn("couldn't find hidden metabolite or reaction labels.");
                } else {
                    o.sel.node().appendChild(o.hidden_dom.metabolite_labels);
                    o.sel.node().appendChild(o.hidden_dom.reaction_labels);
                    o.is_visible.labels = true;
                }
            }
        }
        function make_arrowhead_for_fill(fill) {
            d3.select('#markers').selectAll("marker");
            return "";
        }
        function flux_to_data (data, fluxes, metabolites, metabolites2) {
            o.has_flux = false;
            o.has_flux_comparison = false;
            o.has_metabolites = false;
            o.has_metabolite_deviation = false;

            var remove_fluxes_from_data = function(d) {
                d.reaction_paths.map(function(o) {
                    delete o.flux;
                    return o;
                });
                d.reaction_labels.map(function(o) {
                    delete o.flux;
                    return o;
                });
                return d;
            };

            // parse the data objects and attach values to map objects
            if (fluxes.length > 0) {
                var flux = fluxes[0];
                o.has_flux = true;
                data = parse_flux_1(data, flux);
                if (fluxes.length > 1) {
                    var flux2 = fluxes[1];
                    o.has_flux_comparison = true;
                    data = parse_flux_2(data, flux2);
                }
            } else {
                remove_fluxes_from_data(data);
            }
            if (metabolites) {
                o.has_metabolites = true;
                data = parse_metabolites_1(data, metabolites);
                if (metabolites2) {
                    o.has_metabolite_deviation = true;
                    data = parse_metabolites_2(data, metabolites2);
                }
            }
            return data;
        }

        function parse_flux_1(data, flux) {

	    // fix metabolite labels that shoule be reaction labels
	    data.metabolite_labels = data.metabolite_labels.filter(function(d) {
		if (d.text in flux) {
		    data.reaction_labels.push(d);
		    return false;
		} else {
		    return true;
		}
	    });

            data.reaction_paths = data.reaction_paths.map( function(o) {
                if (o.id in flux) {
                    o.flux = parseFloat(flux[o.id]);
                }
                // else { console.log(o.id) }
                return o;
            });
            data.reaction_labels = data.reaction_labels.map( function(o) {
                if (o.text in flux) {
                    // TODO: make sure text==id
                    o.flux = parseFloat(flux[o.text]);
                }
                return o;
            });
            return data;
        }

        function parse_flux_2(data, flux2) {
            data.reaction_paths = data.reaction_paths.map( function(o) {
                if (o.id in flux2 && o.flux) {
                    o.flux = (parseFloat(flux2[o.id]) - o.flux);
                }
                return o;
            });
            data.reaction_labels = data.reaction_labels.map( function(o) {
                if (o.flux) o.flux1 = o.flux;
                else o.flux1 = 0;
                if (o.text in flux2) o.flux2 = parseFloat(flux2[o.text]);
                else o.flux2 = 0;
                o.flux = (o.flux2 - o.flux1);
                return o;
            });
            return data;
        }
        function parse_metabolites_1(data, metabolites) {
            var skip_these_metabolites = []; //
            var do_not_size_these_metabolites = ['nad','nadp','nadh','nadph','atp','adp','coa','accoa'];
            data.metabolite_circles = data.metabolite_circles.map( function(o) {
                if (o.id in metabolites && skip_these_metabolites.indexOf(o.id)==-1) {
                    o.metabolite_concentration = parseFloat(metabolites[o.id]);
                    if (do_not_size_these_metabolites.indexOf(o.id)>=0) {
                        o.should_size = false;
                        o.should_color = true;
                    } else {
                        o.should_size = true;
                        o.should_color = false;
                    }
                }
                return o;
            });
            data.metabolite_labels = data.metabolite_labels.map( function(o) {
                if (o.text in metabolites) {
                    o.metabolite_concentration = parseFloat(metabolites[o.text]);
                }
                return o;
            });
            return data;
        }

        function parse_metabolites_2(data, metabolites) {
            data.metabolite_circles = data.metabolite_circles.map( function(o) {
                if (o.id in metabolites) {
                    o.metabolite_deviation = parseFloat(metabolites[o.id]);
                }
                return o;
            });
            data.metabolite_labels = data.metabolite_labels.map( function(o) {
                if (o.text in metabolites) {
                    o.metabolite_deviation = parseFloat(metabolites[o.text]);
                }
                return o;
            });
            return data;
        }
    };
});

define('metabolic-map/knockout',["vis/scaffold", "lib/d3"], function (scaffold, d3) {
    return function(options) {
        // set defaults
        var o = scaffold.set_options(options, {});
        o.reactions = {};
        o.latest_flux = [];
        o.latest_objective_value = [];

        return {
            add_reaction: add_reaction,
            get_flux: get_flux
        };

	// definitions
        function add_reaction(reaction) {
            o.reactions[reaction] = true;
        }
        function get_flux(callback) {
            var url = "/knockout-map/";
            var i = -1, start="?",
                k = Object.keys(o.reactions);
            while (++i < k.length) {
                if (i>0) start = "&";
                url += start + "reactions[]=" + encodeURIComponent(k[i]);
                console.log(url);
            }
            d3.json(url, function(error, json) {
                if (error) return console.warn(error);
                var flux = json.x,
                    objective = json.f;
                o.latest_flux = flux;
                o.latest_objective_value = objective;
                callback([flux], objective > 1e-7, objective);
		return null;
            });
        }
    };
});

define('builder/draw',["metabolic-map/utils", "lib/d3"], function(utils, d3) {
    return { setup_containers: setup_containers,
	     draw: draw,
	     reset: reset,
	     draw_specific_reactions: draw_specific_reactions,
	     draw_specific_nodes: draw_specific_nodes
	   };

    // definitions
    function setup_containers(sel) {
        sel.append('g')
            .attr('id', 'membranes');
        sel.append('g')
            .attr('id', 'reactions');
        sel.append('g')
            .attr('id', 'nodes');
        sel.append('g')
            .attr('id', 'text-labels');
    }
    function draw(membranes, reactions, nodes, text_labels, scale,
		  show_beziers, arrow_displacement, defs, arrowheads,
		  default_reaction_color, has_flux, 
		  node_click_fn, node_drag_fn, node_dragstart_fn) {
        /** Draw the reactions and membranes
         */

	utils.draw_an_array('#membranes' ,'.membrane', membranes, create_membrane, 
			     function(sel) { return update_membrane(sel, scale); });

	utils.draw_an_object('#reactions', '.reaction', reactions,
			     'reaction_id', create_reaction, 
			     function(sel) { return update_reaction(sel, scale, 
								    nodes,
								    show_beziers, 
								    arrow_displacement,
								    defs, arrowheads,
								    default_reaction_color,
								    has_flux); });

	utils.draw_an_object('#nodes', '.node', nodes, 'node_id', 
			     function(sel) { return create_node(sel, scale, nodes, reactions,
								node_click_fn, node_drag_fn, node_dragstart_fn); },
			     function(sel) { return update_node(sel, scale); });

	utils.draw_an_object('#text-labels', '.text-label', text_labels,
			     'text_label_id', create_text_label, 
			     function(sel) { return update_text_label(sel, scale); });
    }
    function reset() {
	d3.select('#membranes')
            .selectAll('.membrane')
            .remove();
	d3.select('#reactions')
            .selectAll('.reaction')
            .remove();
	d3.select('#nodes')
            .selectAll('.node')
            .remove();
	d3.select('#text-labels')
            .selectAll('.text-label')
            .remove();
    }

    function draw_specific_reactions(reaction_ids, reactions, nodes, scale, show_beziers,
				     arrow_displacement, defs, arrowheads, default_reaction_color, 
				     has_flux) {
        // find reactions for reaction_ids
        var reaction_subset = {},
            i = -1;
        while (++i<reaction_ids.length) {
            reaction_subset[reaction_ids[i]] = utils.clone(reactions[reaction_ids[i]]);
        }
        if (reaction_ids.length != Object.keys(reaction_subset).length) {
            console.warn('did not find correct reaction subset');
        }

        // generate reactions for o.drawn_reactions
        // assure constancy with cobra_id
        var sel = d3.select('#reactions')
                .selectAll('.reaction')
                .data(utils.make_array(reaction_subset, 'reaction_id'),
                      function(d) { return d.reaction_id; });

        // enter: generate and place reaction
        sel.enter().call(create_reaction);

        // update: update when necessary
        sel.call(function(sel) { return update_reaction(sel, scale, 
							nodes,
							show_beziers, 
							arrow_displacement,
							defs, arrowheads,
							default_reaction_color,
							has_flux); });

        // exit
        sel.exit();
    }

    function draw_specific_nodes(node_ids, nodes, reactions, scale, click_fn, drag_fn, dragstart_fn) {
        // find nodes for node_ids
        var node_subset = {},
            i = -1;
        while (++i<node_ids.length) {
            node_subset[node_ids[i]] = utils.clone(nodes[node_ids[i]]);
        }
        if (node_ids.length != Object.keys(node_subset).length) {
            console.warn('did not find correct node subset');
        }

        // generate nodes for o.drawn_nodes
        // assure constancy with cobra_id
        var sel = d3.select('#nodes')
                .selectAll('.node')
                .data(utils.make_array(node_subset, 'node_id'),
                      function(d) { return d.node_id; });

        // enter: generate and place node
        sel.enter().call(function(sel) { return create_node(sel, scale, nodes, reactions, 
							    click_fn, drag_fn, dragstart_fn); });

        // update: update when necessary
        sel.call(function(sel) { return update_node(sel, scale); });

        // exit
        sel.exit();
    }

    function create_membrane(enter_selection) {
	enter_selection.append('rect')
	    .attr('class', 'membrane');
    }

    function update_membrane(update_selection, scale) {
        update_selection
            .attr("width", function(d){ return scale.x_size(d.width); })
            .attr("height", function(d){ return scale.y_size(d.height); })
            .attr("transform", function(d){return "translate("+scale.x(d.x)+","+scale.y(d.y)+")";})
            .style("stroke-width", function(d) { return scale.size(10); })
            .attr('rx', function(d){ return scale.x_size(20); })
            .attr('ry', function(d){ return scale.x_size(20); });
    }

    function create_reaction(enter_selection) {
        // attributes for new reaction group

        var t = enter_selection.append('g')
                .attr('id', function(d) { return d.reaction_id; })
                .attr('class', 'reaction')
                .call(create_reaction_label);
        return;
    }

    function update_reaction(update_selection, scale, drawn_nodes, show_beziers, arrow_displacement, defs, arrowheads,
			     default_reaction_color, has_flux) {
        // update reaction label
        update_selection.select('.reaction-label')
            .call(function(sel) { return update_reaction_label(sel, scale); });

        // select segments
        var sel = update_selection
                .selectAll('.segment-group')
                .data(function(d) {
                    return utils.make_array(d.segments, 'segment_id');
                }, function(d) { return d.segment_id; });

        // new segments
        sel.enter().call(create_segment);

        // update segments
        sel.call(function(sel) { 
	    return update_segment(sel, scale, drawn_nodes, show_beziers, arrow_displacement, defs, arrowheads, 
				  default_reaction_color, has_flux);

	});

        // old segments
        sel.exit().remove();
    }

    function create_reaction_label(sel) {
        /* Draw reaction label for selection.
	 */
        sel.append('text')
	    .text(function(d) { return d.abbreviation; })
            .attr('class', 'reaction-label label')
            .attr('pointer-events', 'none');
    }

    function update_reaction_label(sel, scale) {
	sel.attr('transform', function(d) {
            return 'translate('+scale.x(d.label_x)+','+scale.y(d.label_y)+')';
	}).style("font-size", function(d) {
	    return String(scale.size(30))+"px";
        });
    }

    function create_segment(enter_selection) {
        // create segments
        var g = enter_selection
                .append('g')
                .attr('class', 'segment-group')
                .attr('id', function(d) { return d.segment_id; });

        // create reaction arrow
        g.append('path')
            .attr('class', 'segment');

	g.append('g')
	    .attr('class', 'beziers');

	// THE FOLLOWING IS ALL TERRIBLE


	// g.append('circle')
	// 	.attr('class', 'bezier bezier1')
	// 	.style('stroke-width', String(o.scale.size(1))+'px') 
	// 	.call(d3.behavior.drag()
	// 	      .on("dragstart", drag_silence)
	// 	      .on("drag", drag_move_1))		
	// 	.on("mouseover", function(d) {
	// 	    d3.select(this).style('stroke-width', String(o.scale.size(2))+'px');
	// 	})
	// 	.on("mouseout", function(d) {
	// 	    d3.select(this).style('stroke-width', String(o.scale.size(1))+'px');
	// 	});

	// // TODO fix this hack
	// g.append('circle')
	// 	.attr('class', 'bezier bezier2')
	// 	.style('stroke-width', String(o.scale.size(1))+'px') 
	// 	.call(d3.behavior.drag()
	// 	      .on("dragstart", drag_silence)
	// 	      .on("drag", drag_move_2))
	// 	.on("mouseover", function(d) {
	// 	    d3.select(this).style('stroke-width', String(o.scale.size(2))+'px');
	// 	})
	// 	.on("mouseout", function(d) {
	// 	    d3.select(this).style('stroke-width', String(o.scale.size(1))+'px');
	// 	});

	// // definitions
	// function drag_silence() {
	// 	// silence other listeners
        //     d3.event.sourceEvent.stopPropagation();
	// }
	// function drag_move_1() { 
	// 	// TODO fix this hack too
	// 	var segment_id = d3.select(this.parentNode.parentNode).datum().segment_id,
	// 	    reaction_id = d3.select(this.parentNode.parentNode.parentNode).datum().reaction_id;
	// 	var seg = o.drawn_reactions[reaction_id].segments[segment_id],
	// 	    dx = o.scale.x_size.invert(d3.event.dx),
	// 	    dy = o.scale.y_size.invert(d3.event.dy);
	// 	seg.b1.x = seg.b1.x + dx;
	// 	seg.b1.y = seg.b1.y + dy;
	// 	draw_specific_reactions([reaction_id]);
	// }
	// function drag_move_2() { 
	// 	// TODO fix this hack too
	// 	var segment_id = d3.select(this.parentNode.parentNode).datum().segment_id,
	// 	    reaction_id = d3.select(this.parentNode.parentNode.parentNode).datum().reaction_id;
	// 	var seg = o.drawn_reactions[reaction_id].segments[segment_id],
	// 	    dx = o.scale.x_size.invert(d3.event.dx),
	// 	    dy = o.scale.y_size.invert(d3.event.dy);
	// 	seg.b2.x = seg.b2.x + dx;
	// 	seg.b2.y = seg.b2.y + dy;
	// 	draw_specific_reactions([reaction_id]);
	// }
    }
    
    function update_segment(update_selection, scale, drawn_nodes, show_beziers, 
			    arrow_displacement, defs, arrowheads, default_reaction_color,
			    has_flux) {
        // update segment attributes
        // update arrows
        update_selection
            .selectAll('.segment')
            .datum(function() {
                return this.parentNode.__data__;
            })
            .attr('d', function(d) {
		if (d.from_node_id==null || d.to_node_id==null)
		    return null;
		var start = drawn_nodes[d.from_node_id],
		    end = drawn_nodes[d.to_node_id],
		    b1 = d.b1,
		    b2 = d.b2;
		// if metabolite, then displace the arrow
		if (start['node_type']=='metabolite') {
		    start = displaced_coords(arrow_displacement, start, end, 'start');
		    b1 = displaced_coords(arrow_displacement, b1, end, 'start');
		}
		if (end['node_type']=='metabolite') {
		    end = displaced_coords(arrow_displacement, start, end, 'end');
		    b2 = displaced_coords(arrow_displacement, start, b2, 'end');
		}
		if (d.b1==null || d.b2==null) {
		    return 'M'+scale.x(start.x)+','+scale.y(start.y)+' '+
			scale.x(end.x)+','+scale.y(end.y);
		} else {
		    return 'M'+scale.x(start.x)+','+scale.y(start.y)+
                        'C'+scale.x(b1.x)+','+scale.y(b1.y)+' '+
                        scale.x(b2.x)+','+scale.y(b2.y)+' '+
                        scale.x(end.x)+','+scale.y(end.y);
		}
            }) // TODO replace with d3.curve or equivalent
            .attr("marker-start", function (d) {
		var start = drawn_nodes[d.from_node_id];
		if (start['node_type']=='metabolite') {
		    var c = d.flux ? scale.flux_color(Math.abs(d.flux)) :
			    default_reaction_color;
		    // generate arrowhead for specific color
		    var arrow_id = generate_arrowhead_for_color(defs, arrowheads, c, false);
		    return "url(#" + arrow_id + ")";
		} else { return null; };
            })     
	    .attr("marker-end", function (d) {
		var end = drawn_nodes[d.to_node_id];
		if (end['node_type']=='metabolite') {
		    var c = d.flux ? scale.flux_color(Math.abs(d.flux)) :
			    default_reaction_color;
		    // generate arrowhead for specific color
		    var arrow_id = generate_arrowhead_for_color(defs, arrowheads, c, true);
		    return "url(#" + arrow_id + ")";
		} else { return null; };
            })
            .style('stroke', function(d) {
		if (has_flux) 
		    return d.flux ? scale.flux_color(Math.abs(d.flux)) : scale.flux_color(0);
		else
		    return default_reaction_color;
	    })
	    .style('stroke-width', function(d) {
		return d.flux ? scale.size(scale.flux(Math.abs(d.flux))) :
		    scale.size(scale.flux(1));
            });

	// new bezier points
	var bez = update_selection.select('.beziers')
		.selectAll('.bezier')
		.data(function(d) {
		    var beziers = [];
		    if (d.b1!=null && d.b1.x!=null && d.b1.y!=null)
			beziers.push({'bezier': 1, x:d.b1.x, y:d.b1.y});
		    if (d.b2!=null && d.b2.x!=null && d.b2.y!=null)
			beziers.push({'bezier': 2, x:d.b2.x, y:d.b2.y});
		    return beziers;
		}, function(d) { return d.bezier; });
	bez.enter().call(create_bezier);
	// update bezier points
	bez.call(function(sel) { return update_bezier(sel, show_beziers); });
	// remove
	bez.exit().remove();

	function create_bezier(enter_selection) {
	    enter_selection.append('circle')
	    	.attr('class', function(d) { return 'bezier bezier'+d.bezier; })
	    	.style('stroke-width', String(scale.size(1))+'px')	
    		.attr('r', String(scale.size(5))+'px');
	}
	function update_bezier(update_selection, show_beziers) {
	    if (show_beziers) {
	    	// draw bezier points
		update_selection
		    .attr('visibility', 'visible')
		    .attr('transform', function(d) {
	    		if (d.x==null || d.y==null) return ""; 
			return 'translate('+scale.x(d.x)+','+scale.y(d.y)+')';
		    });
	    } else {
	    	update_selection.attr('visibility', 'hidden');
	    }
	}
    }

    function create_node(enter_selection, scale, drawn_nodes, drawn_reactions, 
			 click_fn, drag_fn, dragstart_fn) {
        // create nodes
        var g = enter_selection
                .append('g')
                .attr('class', 'node')
                .attr('id', function(d) { return d.node_id; });

        // create metabolite circle and label
        g.append('circle')
	    .attr('class', function(d) {
		if (d.node_type=='metabolite') return 'node-circle metabolite-circle';
		else return 'node-circle';
	    })		
            .style('stroke-width', String(scale.size(2))+'px')
	    .on("mouseover", function(d) {
		d3.select(this).style('stroke-width', String(scale.size(3))+'px');
	    })
	    .on("mouseout", function(d) {
		d3.select(this).style('stroke-width', String(scale.size(2))+'px');
	    })
            .call(d3.behavior.drag()
                  .on("dragstart", dragstart_fn)
                  .on("drag", drag_fn))
            .on("click", click_fn);

        g.append('text')
            .attr('class', 'node-label label')
            .text(function(d) { return d.metabolite_simpheny_id; })
            .attr('pointer-events', 'none');
    }

    function update_node(update_selection, scale) {
        // update circle and label location
        var mg = update_selection
                .select('.node-circle')
                .attr('transform', function(d) {
                    return 'translate('+scale.x(d.x)+','+scale.y(d.y)+')';
                })
		.attr('r', function(d) { 
		    if (d.node_type!='metabolite') return scale.size(5);
		    else return scale.size(d.node_is_primary ? 15 : 10); 
		});
                // .classed('selected', function(d) {
		//     if (is_sel(d)) return true;
		//     return false;
                // });

        update_selection
            .select('.node-label')
            .attr('transform', function(d) {
                return 'translate('+scale.x(d.label_x)+','+scale.y(d.label_y)+')';
            })
            .style("font-size", function(d) {
		return String(scale.size(20))+"px";
            });

	// definitions
        // function is_sel(d) {	//FIX
        //     if (d.node_id==o.selected_node.node_id &&
        //         o.selected_node.is_selected)
        //         return true;
        //     return false;
        // };
    }

    function create_text_label(enter_selection) {
	enter_selection.append('text')
	    .attr('class', 'text-label label')
	    .text(function(d) { return d.text; });
    }

    function update_text_label(update_selection, scale) {
        update_selection
            .attr("transform", function(d) { return "translate("+scale.x(d.x)+","+scale.y(d.y)+")";});
    }

    function displaced_coords(reaction_arrow_displacement, start, end, displace) {
	var length = reaction_arrow_displacement,
	    hyp = utils.distance(start, end),
	    new_x, new_y;
	if (displace=='start') {
	    new_x = start.x + length * (end.x - start.x) / hyp,
	    new_y = start.y + length * (end.y - start.y) / hyp;
	} else if (displace=='end') {
	    new_x = end.x - length * (end.x - start.x) / hyp,
	    new_y = end.y - length * (end.y - start.y) / hyp;
	} else { console.error('bad displace value: ' + displace); }
	return {x: new_x, y: new_y};
    }

    function generate_arrowhead_for_color(defs, arrowheads_generated, color, is_end) {

	var pref = is_end ? 'start-' : 'end-';

        var id = String(color).replace('#', pref);
        if (arrowheads_generated.indexOf(id) < 0) {
            arrowheads_generated.push(id);

            var markerWidth = 5,
                markerHeight = 5,
                // cRadius = 0, // play with the cRadius value
                // refX = cRadius + (markerWidth * 2),
                // refY = -Math.sqrt(cRadius),
                // drSub = cRadius + refY;
                refX,
                refY = markerWidth/2,
                d;

            if (is_end) refX = 0;
            else        refX = markerHeight;
            if (is_end) d = 'M0,0 V'+markerWidth+' L'+markerHeight/2+','+markerWidth/2+' Z';
            else        d = 'M'+markerHeight+',0 V'+markerWidth+' L'+(markerHeight/2)+','+markerWidth/2+' Z';

            // make the marker
            defs.append("svg:marker")
                .attr("id", id)
                .attr("class", "arrowhead")
                .attr("refX", refX)
                .attr("refY", refY)
                .attr("markerWidth", markerWidth)
                .attr("markerHeight", markerHeight)
                .attr("orient", "auto")
                .append("svg:path")
                .attr("d", d)
                .style("fill", color);
        }
        return id;
    }

});

define('builder/input',["lib/d3", "metabolic-map/utils"], function(d3, utils) {
    return { reload_at_selected: reload_at_selected,
	     place_at_selected: place_at_selected,
	     is_visible: is_visible };

    // definitions
    function reload_at_selected(input, x_scale, y_scale, window_scale, window_translate, width, height,
				flux, drawn_reactions, cobra_reactions, 
				enter_callback) {
        /** Reload data for autocomplete box and redraw box at the first
	 * selected node.
	 *
	 * enter_callback(reaction_id, coords)
	 *
         */
	d3.select('.selected').each(function(d) {
	    // unselect all but one (chosen by d3.select)
	    d3.selectAll('.selected').classed('selected', function(e) {
		return d === e;
	    });
	    // reload the reaction input
	    reload(input, {x: d.x, y: d.y}, x_scale, y_scale, window_scale, window_translate, width, height,
		   flux, drawn_reactions, cobra_reactions, 
		   enter_callback);
	});
    }

    function place_at_selected(input, x_scale, y_scale, window_scale, window_translate, width, height) {
        /** Place autocomplete box at the first selected node.
         */
	d3.select('.selected').each(function(d) {
	    place(input, {x: d.x, y: d.y}, x_scale, y_scale, window_scale, window_translate, width, height);
	});
    }

    function place(input, coords, x_scale, y_scale, window_scale, window_translate, width, height) {
	var d = {'x': 200, 'y': 0};
        var left = Math.max(20, Math.min(width-270, (window_scale * x_scale(coords.x) + window_translate.x - d.x)));
        var top = Math.max(20, Math.min(height-40, (window_scale * y_scale(coords.y) + window_translate.y - d.y)));
        input.selection.style('position', 'absolute')
            .style('display', 'block')
            .style('left',left+'px')
            .style('top',top+'px');
    }

    function reload(input, coords, x_scale, y_scale, window_scale, window_translate, width, height,
		    flux, drawn_reactions, cobra_reactions, 
		    enter_callback) {
        /** Reload data for autocomplete box and redraw box at the new
         * coordinates.
	 *
	 * enter_callback(reaction_id, coords)
	 *
         */ 

	var decimal_format = d3.format('.3g');

	place(input, coords, x_scale, y_scale, window_scale, window_translate, width, height);
        // blur
        input.completely.input.blur();
        input.completely.repaint(); //put in place()?

	// make sure only one node is selected
	var selected_nodes = d3.selectAll('.selected'), 
	    count = 0,
	    selected_met;
	selected_nodes.each(function(d) { 
	    count++; 
	    selected_met = d;
	});
	if (count > 1) { console.error('Too many selected nodes'); return; }
	else if (count < 1) { console.error('No selected node'); return; }


	    // // make a list of reactions
	    // o.sorted_reaction_suggestions = [];
	    // for (var reaction_id in o.cobra_reactions) {
	    // 	o.sorted_reaction_suggestions.push({
	    // 	    label: reaction_id,
	    // 	    cobra_id: reaction_id,
	    // 	    flux: 0
            //     });
	    // } 
	    // if (o.flux) {
	    // 	// reactions with flux
	    // 	for (var flux_reaction_id in o.flux) {
            //         // fix reaction ids
            //         var fixed_id = flux_reaction_id.replace('(', '_').replace(')', ''),
	    // 		flux = parseFloat(o.flux[flux_reaction_id]);
            //         // update model with fluxes. if not found, add the empty reaction to the list
	    // 	    var found = false;
	    // 	    o.sorted_reaction_suggestions.map(function(x) {
	    // 		if (fixed_id == x.cobra_id) {
	    // 		    // update label
	    // 		    x.label = x.label+": "+o.decimal_format(flux);
	    // 		    x.flux = flux;
	    // 		    // set flux for reaction
            //                 o.cobra_reactions[fixed_id].flux = flux;
            //                 // also set flux for segments (for simpler drawing)
            //                 for (var metabolite_id in o.cobra_reactions[fixed_id].segments)
	    // 			o.cobra_reactions[fixed_id].segments[metabolite_id].flux = flux;
	    // 		    // this reaction has been found
	    // 		}
            //         });
	    // 	}
	    // 	// sort the reactions by flux
	    // 	o.sorted_reaction_suggestions.sort(function(a, b) { 
	    // 	    return Math.abs(b.flux) - Math.abs(a.flux); 
	    // 	});
	    // }


        // Find selected reaction
        var suggestions = [];
        for (var reaction_abbreviation in cobra_reactions) {
            var reaction = cobra_reactions[reaction_abbreviation];

            // ignore drawn reactions
            if (already_drawn(reaction_abbreviation, drawn_reactions)) continue;

	    // check segments for match to selected metabolite
	    for (var metabolite_id in reaction.metabolites) {
		var metabolite = reaction.metabolites[metabolite_id]; 
		//TODO sort out node __data__.compartment_id vs. _c and _p in model.reaction.metabolite_id
                if (selected_met.metabolite_simpheny_id_compartmentalized == metabolite_id) {
		    if (reaction_abbreviation in suggestions) continue;
		    // reverse for production
		    var this_flux, this_string;
		    if (flux) {
			if (reaction_abbreviation in flux) 
			    this_flux = flux[reaction_abbreviation] * (metabolite.coefficient < 1 ? 1 : -1);
			else
			    this_flux = 0;
			this_string = string_for_flux(reaction_abbreviation, this_flux, decimal_format);
	    		suggestions[reaction_abbreviation] = { flux: this_flux,
							       string: this_string };
		    } else {
	    		suggestions[reaction_abbreviation] = { string: reaction_abbreviation };
		    }
		}
	    }
        }

        // Generate the array of reactions to suggest and sort it
	var strings_to_display = [],
	    suggestions_array = utils.make_array(suggestions, 'reaction_abbreviation');
	if (flux)
	    suggestions_array.sort(function(x, y) { return Math.abs(x.flux) > Math.abs(y.flux); });
	suggestions_array.map(function(x) {
	    strings_to_display.push(x.string);
	});

        // set up the box with data, searching for first num results
        var num = 20;
        var complete = input.completely;
        complete.options = strings_to_display;
        if (strings_to_display.length==1) complete.setText(strings_to_display[0]);
        else complete.setText("");
        complete.onEnter = function() {
	    var text = this.getText();
	    this.setText("");
	    suggestions_array.map(function(x) {
		if (x.string==text)
                    enter_callback(x.reaction_abbreviation, selected_met);
	    });
        };
        complete.repaint();
        input.completely.input.focus();

	//definitions
	function already_drawn(cobra_id, drawn_reactions) {
            for (var drawn_id in drawn_reactions) {
		if (drawn_reactions[drawn_id].abbreviation==cobra_id) 
		    return true;
	    }
            return false;
	};
	function string_for_flux(reaction_abbreviation, flux, decimal_format) {
	    return reaction_abbreviation + ": " + decimal_format(flux);
	}
    }

    function is_visible(input) {
        return input.selection.style("display") != "none";
    }
});

/**
 * complete.ly 1.0.0
 * MIT Licensing
 * Copyright (c) 2013 Lorenzo Puccetti
 * 
 * This Software shall be used for doing good things, not bad things.
 * 
**/  
define('lib/complete.ly',[],function() {
return function(container, config) {
    config = config || {};
    config.fontSize =                       config.fontSize   || '16px';
    config.fontFamily =                     config.fontFamily || 'sans-serif';
    config.promptInnerHTML =                config.promptInnerHTML || ''; 
    config.color =                          config.color || '#333';
    config.hintColor =                      config.hintColor || '#aaa';
    config.backgroundColor =                config.backgroundColor || '#fff';
    config.dropDownBorderColor =            config.dropDownBorderColor || '#aaa';
    config.dropDownZIndex =                 config.dropDownZIndex || '100'; // to ensure we are in front of everybody
    config.dropDownOnHoverBackgroundColor = config.dropDownOnHoverBackgroundColor || '#ddd';
    
    var txtInput = document.createElement('input');
    txtInput.type ='text';
    txtInput.spellcheck = false; 
    txtInput.style.fontSize =        config.fontSize;
    txtInput.style.fontFamily =      config.fontFamily;
    txtInput.style.color =           config.color;
    txtInput.style.backgroundColor = config.backgroundColor;
    txtInput.style.width = '100%';
    txtInput.style.outline = '0';
    txtInput.style.border =  '0';
    txtInput.style.margin =  '0';
    txtInput.style.padding = '0';
    
    var txtHint = txtInput.cloneNode(); 
    txtHint.disabled='';        
    txtHint.style.position = 'absolute';
    txtHint.style.top =  '0';
    txtHint.style.left = '0';
    txtHint.style.borderColor = 'transparent';
    txtHint.style.boxShadow =   'none';
    txtHint.style.color = config.hintColor;
    
    txtInput.style.backgroundColor ='transparent';
    txtInput.style.verticalAlign = 'top';
    txtInput.style.position = 'relative';
    
    var wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.outline = '0';
    wrapper.style.border =  '0';
    wrapper.style.margin =  '0';
    wrapper.style.padding = '0';
    
    var prompt = document.createElement('div');
    prompt.style.position = 'absolute';
    prompt.style.outline = '0';
    prompt.style.margin =  '0';
    prompt.style.padding = '0';
    prompt.style.border =  '0';
    prompt.style.fontSize =   config.fontSize;
    prompt.style.fontFamily = config.fontFamily;
    prompt.style.color =           config.color;
    prompt.style.backgroundColor = config.backgroundColor;
    prompt.style.top = '0';
    prompt.style.left = '0';
    prompt.style.overflow = 'hidden';
    prompt.innerHTML = config.promptInnerHTML;
    prompt.style.background = 'transparent';
    if (document.body === undefined) {
        throw 'document.body is undefined. The library was wired up incorrectly.';
    }
    document.body.appendChild(prompt);            
    var w = prompt.getBoundingClientRect().right; // works out the width of the prompt.
    wrapper.appendChild(prompt);
    prompt.style.visibility = 'visible';
    prompt.style.left = '-'+w+'px';
    wrapper.style.marginLeft= w+'px';
    
    wrapper.appendChild(txtHint);
    wrapper.appendChild(txtInput);
    
    var dropDown = document.createElement('div');
    dropDown.style.position = 'absolute';
    dropDown.style.visibility = 'hidden';
    dropDown.style.outline = '0';
    dropDown.style.margin =  '0';
    dropDown.style.padding = '0';  
    dropDown.style.textAlign = 'left';
    dropDown.style.fontSize =   config.fontSize;      
    dropDown.style.fontFamily = config.fontFamily;
    dropDown.style.backgroundColor = config.backgroundColor;
    dropDown.style.zIndex = config.dropDownZIndex; 
    dropDown.style.cursor = 'default';
    dropDown.style.borderStyle = 'solid';
    dropDown.style.borderWidth = '1px';
    dropDown.style.borderColor = config.dropDownBorderColor;
    dropDown.style.overflowX= 'hidden';
    dropDown.style.whiteSpace = 'pre';
    dropDown.style.overflowY = 'scroll';  // note: this might be ugly when the scrollbar is not required. however in this way the width of the dropDown takes into account
    
    
    var createDropDownController = function(elem) {
        var rows = [];
        var ix = 0;
        var oldIndex = -1;
        
        var onMouseOver =  function() { this.style.outline = '1px solid #ddd'; }
        var onMouseOut =   function() { this.style.outline = '0'; }
        var onMouseDown =  function() { p.hide(); p.onmouseselection(this.__hint); }
        
        var p = {
            hide :  function() { elem.style.visibility = 'hidden'; }, 
            refresh : function(token, array) {
                elem.style.visibility = 'hidden';
                ix = 0;
                elem.innerHTML ='';
                var vph = (window.innerHeight || document.documentElement.clientHeight);
                var rect = elem.parentNode.getBoundingClientRect();
                var distanceToTop = rect.top - 6;                        // heuristic give 6px 
                var distanceToBottom = vph - rect.bottom -6;  // distance from the browser border.
                
                rows = [];
                for (var i=0;i<array.length;i++) {
                    if (array[i].indexOf(token)!==0) { continue; }
                    var divRow =document.createElement('div');
                    divRow.style.color = config.color;
                    divRow.onmouseover = onMouseOver; 
                    divRow.onmouseout =  onMouseOut;
                    divRow.onmousedown = onMouseDown; 
                    divRow.__hint =    array[i];
                    divRow.innerHTML = token+'<b>'+array[i].substring(token.length)+'</b>';
                    rows.push(divRow);
                    elem.appendChild(divRow);
                }
                if (rows.length===0) {
                    return; // nothing to show.
                }
                if (rows.length===1 && token === rows[0].__hint) {
                    return; // do not show the dropDown if it has only one element which matches what we have just displayed.
                }
                
                if (rows.length<2) return; 
                p.highlight(0);
                
                if (distanceToTop > distanceToBottom*3) {        // Heuristic (only when the distance to the to top is 4 times more than distance to the bottom
                    elem.style.maxHeight =  distanceToTop+'px';  // we display the dropDown on the top of the input text
                    elem.style.top ='';
                    elem.style.bottom ='100%';
                } else {
                    elem.style.top = '100%';  
                    elem.style.bottom = '';
                    elem.style.maxHeight =  distanceToBottom+'px';
                }
                elem.style.visibility = 'visible';
            },
            highlight : function(index) {
                if (oldIndex !=-1 && rows[oldIndex]) { 
                    rows[oldIndex].style.backgroundColor = config.backgroundColor;
                }
                rows[index].style.backgroundColor = config.dropDownOnHoverBackgroundColor; // <-- should be config
                oldIndex = index;
            },
            move : function(step) { // moves the selection either up or down (unless it's not possible) step is either +1 or -1.
                if (elem.style.visibility === 'hidden')             return ''; // nothing to move if there is no dropDown. (this happens if the user hits escape and then down or up)
                if (ix+step === -1 || ix+step === rows.length) return rows[ix].__hint; // NO CIRCULAR SCROLLING. 
                ix+=step; 
                p.highlight(ix);
                return rows[ix].__hint;//txtShadow.value = uRows[uIndex].__hint ;
            },
            onmouseselection : function() {} // it will be overwritten. 
        };
        return p;
    }
    
    var dropDownController = createDropDownController(dropDown);
    
    dropDownController.onmouseselection = function(text) {
        txtInput.value = txtHint.value = leftSide+text; 
        rs.onChange(txtInput.value); // <-- forcing it.
        registerOnTextChangeOldValue = txtInput.value; // <-- ensure that mouse down will not show the dropDown now.
        setTimeout(function() { txtInput.focus(); },0);  // <-- I need to do this for IE 
    }
    
    wrapper.appendChild(dropDown);
    container.appendChild(wrapper);
    
    var spacer; 
    var leftSide; // <-- it will contain the leftSide part of the textfield (the bit that was already autocompleted)
    
    
    function calculateWidthForText(text) {
        if (spacer === undefined) { // on first call only.
            spacer = document.createElement('span'); 
            spacer.style.visibility = 'hidden';
            spacer.style.position = 'fixed';
            spacer.style.outline = '0';
            spacer.style.margin =  '0';
            spacer.style.padding = '0';
            spacer.style.border =  '0';
            spacer.style.left = '0';
            spacer.style.whiteSpace = 'pre';
            spacer.style.fontSize =   config.fontSize;
            spacer.style.fontFamily = config.fontFamily;
            spacer.style.fontWeight = 'normal';
            document.body.appendChild(spacer);    
        }        
        
        // Used to encode an HTML string into a plain text.
        // taken from http://stackoverflow.com/questions/1219860/javascript-jquery-html-encoding
        spacer.innerHTML = String(text).replace(/&/g, '&amp;')
                                       .replace(/"/g, '&quot;')
                                       .replace(/'/g, '&#39;')
                                       .replace(/</g, '&lt;')
                                       .replace(/>/g, '&gt;');
        return spacer.getBoundingClientRect().right;
    }
    
    
    var rs = { 
        onArrowDown : function() {},               // defaults to no action.
        onArrowUp :   function() {},               // defaults to no action.
        onEnter :     function() {},               // defaults to no action.
        onTab :       function() {},               // defaults to no action.
        onChange:     function() { rs.repaint() }, // defaults to repainting.
        startFrom:    0,
        options:      [],
        wrapper : wrapper,      // Only to allow  easy access to the HTML elements to the final user (possibly for minor customizations)
        input :  txtInput,      // Only to allow  easy access to the HTML elements to the final user (possibly for minor customizations) 
        hint  :  txtHint,       // Only to allow  easy access to the HTML elements to the final user (possibly for minor customizations)
        dropDown :  dropDown,         // Only to allow  easy access to the HTML elements to the final user (possibly for minor customizations)
        prompt : prompt,
        setText : function(text) {
            txtHint.value = text;
            txtInput.value = text; 
        },
        getText : function() {
        	return txtInput.value; 
        },
        hideDropDown : function() {
        	dropDownController.hide();
        },
        repaint : function() {
            var text = txtInput.value;
            var startFrom =  rs.startFrom; 
            var options =    rs.options;
            var optionsLength = options.length; 
            
            // breaking text in leftSide and token.
            var token = text.substring(startFrom);
            leftSide =  text.substring(0,startFrom);
            
            // updating the hint. 
            txtHint.value ='';
            for (var i=0;i<optionsLength;i++) {
                var opt = options[i];
                if (opt.indexOf(token)===0) {         // <-- how about upperCase vs. lowercase
                    txtHint.value = leftSide +opt;
                    break;
                }
            }
            
            // moving the dropDown and refreshing it.
            dropDown.style.left = calculateWidthForText(leftSide)+'px';
            dropDownController.refresh(token, rs.options);
        }
    };
    
    var registerOnTextChangeOldValue;

    /**
     * Register a callback function to detect changes to the content of the input-type-text.
     * Those changes are typically followed by user's action: a key-stroke event but sometimes it might be a mouse click.
    **/
    var registerOnTextChange = function(txt, callback) {
        registerOnTextChangeOldValue = txt.value;
        var handler = function() {
            var value = txt.value;
            if (registerOnTextChangeOldValue !== value) {
                registerOnTextChangeOldValue = value;
                callback(value);
            }
        };

        //  
        // For user's actions, we listen to both input events and key up events
        // It appears that input events are not enough so we defensively listen to key up events too.
        // source: http://help.dottoro.com/ljhxklln.php
        //
        // The cost of listening to three sources should be negligible as the handler will invoke callback function
        // only if the text.value was effectively changed. 
        //  
        // 
        if (txt.addEventListener) {
            txt.addEventListener("input",  handler, false);
            txt.addEventListener('keyup',  handler, false);
            txt.addEventListener('change', handler, false);
        } else { // is this a fair assumption: that attachEvent will exist ?
            txt.attachEvent('oninput', handler); // IE<9
            txt.attachEvent('onkeyup', handler); // IE<9
            txt.attachEvent('onchange',handler); // IE<9
        }
    };
    
    
    registerOnTextChange(txtInput,function(text) { // note the function needs to be wrapped as API-users will define their onChange
        rs.onChange(text);
    });
    
    
    var keyDownHandler = function(e) {
        e = e || window.event;
        var keyCode = e.keyCode;
        
        if (keyCode == 33) { return; } // page up (do nothing)
        if (keyCode == 34) { return; } // page down (do nothing);
        
        if (keyCode == 27) { //escape
            dropDownController.hide();
            txtHint.value = txtInput.value; // ensure that no hint is left.
            txtInput.focus(); 
            return; 
        }
        
        if (keyCode == 39 || keyCode == 35 || keyCode == 9) { // right,  end, tab  (autocomplete triggered)
        	if (keyCode == 9) { // for tabs we need to ensure that we override the default behaviour: move to the next focusable HTML-element 
           	    e.preventDefault();
                e.stopPropagation();
                if (txtHint.value.length == 0) {
                	rs.onTab(); // tab was called with no action.
                	            // users might want to re-enable its default behaviour or handle the call somehow.
                }
            }
            if (txtHint.value.length > 0) { // if there is a hint
                dropDownController.hide();
                txtInput.value = txtHint.value;
                var hasTextChanged = registerOnTextChangeOldValue != txtInput.value
                registerOnTextChangeOldValue = txtInput.value; // <-- to avoid dropDown to appear again. 
                                                          // for example imagine the array contains the following words: bee, beef, beetroot
                                                          // user has hit enter to get 'bee' it would be prompted with the dropDown again (as beef and beetroot also match)
                if (hasTextChanged) {
                    rs.onChange(txtInput.value); // <-- forcing it.
                }
            }
            return; 
        }
        
        if (keyCode == 13) {       // enter  (autocomplete triggered)
            if (txtHint.value.length == 0) { // if there is a hint
                rs.onEnter();
            } else {
                var wasDropDownHidden = (dropDown.style.visibility == 'hidden');
                dropDownController.hide();
                
                if (wasDropDownHidden) {
                    txtHint.value = txtInput.value; // ensure that no hint is left.
                    txtInput.focus();
                    rs.onEnter();    
                    return; 
                }
                
                txtInput.value = txtHint.value;
                var hasTextChanged = registerOnTextChangeOldValue != txtInput.value
                registerOnTextChangeOldValue = txtInput.value; // <-- to avoid dropDown to appear again. 
                                                          // for example imagine the array contains the following words: bee, beef, beetroot
                                                          // user has hit enter to get 'bee' it would be prompted with the dropDown again (as beef and beetroot also match)
                if (hasTextChanged) {
                    rs.onChange(txtInput.value); // <-- forcing it.
                }
                
            }
            return; 
        }
        
        if (keyCode == 40) {     // down
            var m = dropDownController.move(+1);
            if (m == '') { rs.onArrowDown(); }
            txtHint.value = leftSide+m;
            return; 
        } 
            
        if (keyCode == 38 ) {    // up
            var m = dropDownController.move(-1);
            if (m == '') { rs.onArrowUp(); }
            txtHint.value = leftSide+m;
            e.preventDefault();
            e.stopPropagation();
            return; 
        }
            
        // it's important to reset the txtHint on key down.
        // think: user presses a letter (e.g. 'x') and never releases... you get (xxxxxxxxxxxxxxxxx)
        // and you would see still the hint
        txtHint.value =''; // resets the txtHint. (it might be updated onKeyUp)
        
    };
    
    if (txtInput.addEventListener) {
        txtInput.addEventListener("keydown",  keyDownHandler, false);
    } else { // is this a fair assumption: that attachEvent will exist ?
        txtInput.attachEvent('onkeydown', keyDownHandler); // IE<9
    }
    return rs;
}
});

define('builder/main',["vis/scaffold", "metabolic-map/utils", "builder/draw", "builder/input", "lib/d3", 
	"lib/complete.ly"],
       function(scaffold, utils, draw, input, d3, completely) {
    // NOTE
    // see this thread: https://groups.google.com/forum/#!topic/d3-js/Not1zyWJUlg
    // only necessary for selectAll()
    // .datum(function() {
    //     return this.parentNode.__data__;
    // })
    return function(options) {
        // set defaults
        var o = scaffold.set_options(options, {
            margins: {top: 10, right: 10, bottom: 10, left: 20},
            selection: d3.select("body").append("div"),
            selection_is_svg: false,
            fillScreen: false,
            update_hook: false,
            map_path: null,
            map: null,
            cobra_model_path: null,
            cobra_model: null,
            css_path: null,
            css: null,
            flux_path: null,
            flux: null,
            flux2_path: null,
            flux2: null,
	    show_beziers: false,
	    debug: false,
	    starting_reaction: 'ACALDtex',
	    reaction_arrow_displacement: 35 });

        if (o.selection_is_svg) {
            console.error("Builder does not support placement within svg elements");
            return null;
        }

        var files_to_load = [{ file: o.map_path, value: o.map, callback: set_map },
                             { file: o.cobra_model_path, value: o.cobra_model, callback: set_cobra_model },
                             { file: o.css_path, value: o.css, callback: set_css },
                             { file: o.flux_path, value: o.flux,
                               callback: function(e, f) { set_flux(e, f, 0); } },
                             { file: o.flux2_path, value: o.flux2,
                               callback: function(e, f) { set_flux(e, f, 1); } } ];
        scaffold.load_files(files_to_load, setup);
        return {};

        // Definitions
        function set_map(error, map) {
            if (error) console.warn(error);
            o.map = map;
        };
        function set_cobra_model(error, cobra_model) {
            if (error) console.warn(error);
            o.cobra_model = cobra_model;
        }
        function set_css(error, css) {
            if (error) console.warn(error);
            o.css = css;
        };
        function set_flux(error, flux, index) {
            if (error) console.warn(error);
            if (index==0) o.flux = flux;
            else if (index==1) o.flux2 = flux;
        };
        function setup() {
            /* Load the svg container and draw a loaded map if provided.
             */

            // Begin with some definitions
            // o.selected_node = {'node_id': '',
            //                    'is_selected': false};
            o.drawn_reactions = {};
            o.arrowheads_generated = [];
            o.default_reaction_color = '#505050';
            o.window_translate = {'x': 0, 'y': 0};
            o.window_scale = 1;
	    o.zoom_enabled = true;
	    o.shift_key_on = false;

	    // Check the cobra model
	    if (o.cobra_model) {
		// TODO better checks
		o.cobra_reactions = o.cobra_model.reactions;
	    }

	    // set up the svg
            var out = scaffold.setup_svg(o.selection, o.selection_is_svg,
                                         o.margins, o.fill_screen);
            o.svg = out.svg;
            o.height = out.height;
            o.width = out.width;

            // setup menu and status bars
            o.menu = setup_menu(o.selection);
            o.status = setup_status(o.selection);

            // setup the reaction input with complete.ly
            o.reaction_input = setup_reaction_input(o.selection);


            // set up keyboard listeners
            setup_key_listeners();

	    // import map
	    var max_w = o.width, max_h = o.height;
	    if (o.map) {
		import_and_load_map(o.map, o.height, o.width);
	    } else {
		o.drawn_membranes = [];
		o.map_info = { max_map_w: o.width, max_map_h: o.height };

		// set up svg and svg definitions
		o.scale = utils.define_scales(o.map_info.max_map_w, o.map_info.max_map_h,
					      o.width, o.height);
	    }

            o.defs = utils.setup_defs(o.svg, o.css);
            var out = utils.setup_zoom_container(o.svg, o.width, o.height, [0.05, 15], 
						 function(ev) {
						     o.window_translate = {'x': ev.translate[0], 'y': ev.translate[1]};
						     o.window_scale = ev.scale;
						     input.place_at_selected(o.reaction_input, o.scale.x, o.scale.y, 
									     o.window_scale, o.window_translate, 
									     o.width, o.height);
						 }, 
						 function() { return o.zoom_enabled; });
	    // TODO fix like this http://jsfiddle.net/La8PR/5/
            o.sel = out.sel,
            o.zoom = out.zoom;

            var extent = {"x": o.width*3, "y": o.height*3},
		mouse_node = o.sel.append('rect')
                    .attr("width", extent.x)
                    .attr("height", extent.y)
		    .attr("transform",
			  "translate("+(-extent.x/3)+","+(-extent.y/3)+")")
                    .attr("style", "stroke:black;fill:none;")
                    .attr('pointer-events', 'all');

            o.sel.append('g')
                .attr('id', 'brush-container');
	    draw.setup_containers(o.sel);

            // setup selection box
            if (!o.map) {
		// TEST case
		var start_coords = {'x': o.width/2, 'y': 40};
                new_reaction(o.starting_reaction, start_coords);
            } else {
		draw_everything();
	    }

	    // turn off loading message
            d3.select('#loading').style("display", "none");

            // definitions
            function setup_menu(selection) {
                var sel = selection.append("div").attr("id", "menu");
                new_button(sel, cmd_hide_show_input, "New reaction (/)");
                // new_button(sel, cmd_cycle_primary_metabolite, "Cycle primary metabolite (p)");
                // new_button(sel, cmd_left, "Left (←)");
                // new_button(sel, cmd_right, "Right (→)");
                // new_button(sel, cmd_up, "Up (↑)");
                // new_button(sel, cmd_down, "Down (↓)");
                new_button(sel, cmd_save, "Save (^s)");
                o.load_input_click_fn = new_input(sel, load_map_for_file, "Load (^o)");
                o.load_flux_input_click_fn = new_input(sel, load_flux_for_file, "Load flux (^f)");
		if (o.show_beziers) new_button(sel, cmd_hide_beziers, "Hide control points");
		else new_button(sel, cmd_show_beziers, "Show control points");

		var z;
		if (o.zoom_enabled) z = new_button(sel, cmd_zoom_off, "Enable select (v)");
		else z = new_button(sel, cmd_zoom_on, "Enable pan+zoom (z)");
		z.attr('id', 'zoom-button');

                return sel;

		// definitions
		function load_map_for_file(error, data) {
                    if (error) console.warn(error);
                    import_and_load_map(data);
                    draw.reset();
                    draw_everything();
                }
		function load_flux_for_file(error, data) {
                    set_flux(error, data, 0);
		    apply_flux_to_map();
                    draw_everything();
                }
                function new_button(s, fn, name) {
                    return s.append("button").attr("class", "command-button")
                        .text(name).on("click", fn);
                }
                function new_input(s, fn, name) {
                    /* 
		     * Returns a function that can be called to programmatically
                     * load files.
                     */
                    var input = s.append("input").attr("class", "command-button")
                            .attr("type", "file")
                            .style("display", "none")
                            .on("change", function() { utils.load_json(this.files[0], fn); });
                    new_button(sel, function(e) {
                        input.node().click();
                    }, name);
                    return function() { input.node().click(); };
                }
            }
            function setup_reaction_input(selection) {
                // set up container
                var sel = selection.append("div").attr("id", "rxn-input");
                sel.style("display", "none");
                // set up complete.ly
                var complete = completely(sel.node(), { backgroundColor: "#eee" });
                d3.select(complete.input)
                // .attr('placeholder', 'Reaction ID -- Flux')
                    .on('input', function() {
                        this.value = this.value.replace("/","")
                            .replace(" ","")
                            .replace("\\","")
                            .replace("<","");
                    });
                return { selection: sel,
                         completely: complete };
            }
            function setup_status(selection) {
                return selection.append("div").attr("id", "status");
            }
        }

	// drawing
	function node_click_function(sel, data) {
	}
	function has_flux() {
	    return o.flux ? true : false;
	}
	function node_click(d) {
	    return select_metabolite(this, d, o.sel.select('#nodes').selectAll('.node'), o.shift_key_on);
	}
	function node_dragstart() {
	    // silence other listeners
            d3.event.sourceEvent.stopPropagation();
	}
	function node_drag() {
	    var grabbed_id = this.parentNode.__data__.node_id,		    
                selected_ids = [];
	    d3.select('#nodes').selectAll('.selected').each(function(d) { selected_ids.push(d.node_id); });
	    if (selected_ids.indexOf(grabbed_id)==-1) { 
		console.log('Dragging unselected node');
		return;
	    }

	    var reaction_ids = [];
	    // update node positions
	    d3.selectAll('.node').each(function(d) {
		if (selected_ids.indexOf(d.node_id)==-1) return;
		// update data
                var node = o.drawn_nodes[d.node_id],
		    dx = o.scale.x_size.invert(d3.event.dx),
		    dy = o.scale.y_size.invert(d3.event.dy);
                node.x = node.x + dx; 
		node.y = node.y + dy;
		// update node labels
                node.label_x = node.label_x + dx;
		node.label_y = node.label_y + dy;

		// update connected reactions
		d.connected_segments.map(function(segment_object) {
		    shift_beziers_for_segment(segment_object.reaction_id, segment_object.segment_id, 
					      d.node_id, dx, dy);
		    reaction_ids.push(segment_object.reaction_id);
		});
	    });

	    draw_specific_nodes(selected_ids);
	    draw_specific_reactions(reaction_ids);

	    // definitions
	    function shift_beziers_for_segment(reaction_id, segment_id, node_id, dx, dy) {
		var seg = o.drawn_reactions[reaction_id].segments[segment_id];
		if (seg.from_node_id==node_id && seg.b1) {
		    seg.b1.x = seg.b1.x + dx;
		    seg.b1.y = seg.b1.y + dy;
		}
		if (seg.to_node_id==node_id && seg.b2) {
		    seg.b2.x = seg.b2.x + dx;
		    seg.b2.y = seg.b2.y + dy;
		}
	    }
	}
	function draw_everything() {
	    draw.draw(o.drawn_membranes, o.drawn_reactions, o.drawn_nodes, o.drawn_text_labels, o.scale, 
		      o.show_beziers, o.reaction_arrow_displacement, o.defs, o.arrowheads_generated,
		      o.default_reaction_color, has_flux(), 
		      node_click, node_drag, node_dragstart);
	}
	function draw_specific_reactions(reaction_ids) {
	    draw.draw_specific_reactions(reaction_ids, o.drawn_reactions, o.drawn_nodes, o.scale, o.show_beziers,
					 o.reaction_arrow_displacement, o.defs, o.arrowheads_generated, 
					 o.default_reaction_color, has_flux());
	}
	function draw_specific_nodes(node_ids) {
	    draw.draw_specific_nodes(node_ids, o.drawn_nodes, o.drawn_reactions, o.scale, 
				     node_click, node_drag, node_dragstart);
	}    
	function apply_flux_to_map() {
	    for (var reaction_id in o.drawn_reactions) {
		var reaction = o.drawn_reactions[reaction_id];
		if (reaction.abbreviation in o.flux) {
		    var flux = parseFloat(o.flux[reaction.abbreviation]);
		    reaction.flux = flux;
		    for (var segment_id in reaction.segments) {
			var segment = reaction.segments[segment_id];
			segment.flux = flux;
		    }
		}
	    }
	}

	// brushing
	function enable_brush(on) {
	    var brush_sel = o.sel.select('#brush-container');
	    if (on) {
		o.selection_brush = setup_selection_brush(brush_sel, 
							  d3.select('#nodes').selectAll('.node'),
							  o.width, o.height);
	    } else {
		brush_sel.selectAll('.brush').remove();
	    }

	    // definitions
	    function setup_selection_brush(selection, node_selection, width, height) {
		var node_ids = [];
		node_selection.each(function(d) { node_ids.push(d.node_id); });
		var brush_fn = d3.svg.brush()
			.x(d3.scale.identity().domain([0, width]))
			.y(d3.scale.identity().domain([0, height]))
			.on("brush", function() {
			    var extent = d3.event.target.extent();
			    node_selection
				.classed("selected", function(d) { 
				    var sx = o.scale.x(d.x), sy = o.scale.y(d.y);
				    return extent[0][0] <= sx && sx < extent[1][0]
					    && extent[0][1] <= sy && sy < extent[1][1];
				});
			})        
			.on("brushend", function() {
			    d3.event.target.clear();
			    d3.select(this).call(d3.event.target);
			}),
		    brush = selection.append("g")
			.attr("class", "brush")
			.call(brush_fn);
		return brush;
	    }
	}

	function import_map(map) {
	    /*
	     * Load a json map and add necessary fields for rendering.
	     *
	     * The returned value will be o.drawn_reactions.
	     */
	    if (o.debug) {
		var required_node_props = ['node_type', 'x', 'y',
					   'connected_segments'],
		    required_reaction_props = ["segments", 'name', 'direction', 'abbreviation'],
		    required_segment_props = ['from_node_id', 'to_node_id'],
		    required_text_label_props = ['text', 'x', 'y'];
		for (var node_id in map.nodes) {
		    var node = map.nodes[node_id];
		    node.selected = false; node.previously_selected = false;
		    required_node_props.map(function(req) {
			if (!node.hasOwnProperty(req)) console.error("Missing property " + req);
		    });
		}
		for (var reaction_id in map.reactions) {
		    var reaction = map.reactions[reaction_id];
		    required_reaction_props.map(function(req) {
			if (!reaction.hasOwnProperty(req)) console.error("Missing property " + req);
		    });
		    for (var segment_id in reaction.segments) {
			var metabolite = reaction.segments[segment_id];
			required_segment_props.map(function(req) {
			    if (!metabolite.hasOwnProperty(req)) console.error("Missing property " + req);
			});
		    }
		}
		for (var text_label_id in map.text_labels) {
		    var text_label = map.text_labels[text_label_id];
		    required_text_label_props.map(function(req) {
			if (!text_label.hasOwnProperty(req)) console.error("Missing property " + req);
		    });
		}
	    }
	    return map;
	}
	function import_and_load_map(map) {
	    map = import_map(map);
	    o.drawn_reactions = map.reactions ? map.reactions : {};
	    o.drawn_nodes = map.nodes ? map.nodes : {};
	    o.drawn_membranes = map.membranes ? map.membranes : [];
	    o.drawn_text_labels = map.text_labels ? map.text_labels : {};
	    o.map_info = map.info ? map.info : {};
	    // set up svg and svg definitions
	    o.scale = utils.define_scales(o.map_info.max_map_w, o.map_info.max_map_h,
					  o.width, o.height);
	    // reset zoom
	    if (o.zoom) {
		o.window_translate.x = 0; o.window_translate.y = 0; o.window_scale = 1.0;
                o.zoom.translate([o.window_translate.x, o.window_translate.y]);
                o.zoom.scale(o.window_scale);
                o.sel.attr('transform', 'translate('+o.window_translate.x+','+o.window_translate.y+')scale('+o.window_scale+')');
	    }
	    // flux onto existing map reactions
	    if (o.flux) apply_flux_to_map();
	}
	function map_for_export() {
	    // var exported_node_props = ['node_type', 'x', 'y', TODO make minimal map for export
	    // 			       'connected_segments'],
	    // 	exported_reaction_props = ["segments", 'name', 'direction', 'abbreviation'],
	    // 	exported_segment_props = ['from_node_id', 'to_node_id'],
	    // 	exported_text_label_props = ['text', 'x', 'y'];
	    var membranes = utils.clone(o.drawn_membranes),
		nodes = utils.clone(o.drawn_nodes),
		reactions = utils.clone(o.drawn_reactions),
		text_labels = utils.clone(o.drawn_text_labels),
		info = utils.clone(o.map_info);
	    return { membranes: membranes, nodes: nodes, reactions: reactions, text_labels: text_labels, info: info };
	}   

        function set_status(status) {
            // TODO put this in js/metabolic-map/utils.js
            var t = d3.select('body').select('#status');
            if (t.empty()) t = d3.select('body')
                .append('text')
                .attr('id', 'status');
            t.text(status);
            return this;
        }

        function new_reaction(reaction_id, selected_met) {
            /* New reaction at x, y coordinates.
	     */

            // If reaction id is not new, then return:
            if (o.drawn_reactions.hasOwnProperty(reaction_id)) {
                console.warn('reaction is already drawn');
                return;
            }

            // set reaction coordinates and angle
            // be sure to copy the reaction recursively
            var reaction = utils.clone(o.cobra_reactions[reaction_id]);
            // calculate coordinates of reaction
            reaction = utils.calculate_new_reaction_coordinates(reaction, coords);

            // set primary metabolites and count reactants/products
            var primary_reactant_index = 0,
                primary_product_index = 0,
                reactant_count = 0, product_count = 0,
                newest_primary_product_id = "";

            for (var metabolite_id in reaction.segments) {
                var metabolite = reaction.segments[metabolite_id];
                if (metabolite.coefficient < 0) {
                    metabolite.index = reactant_count;
                    if (reactant_count==primary_reactant_index) metabolite.is_primary = true;
                    reactant_count++;
                } else {
                    metabolite.index = product_count;
                    if (product_count==primary_product_index) {
                        metabolite.is_primary = true;
                        newest_primary_product_id = metabolite_id;
                    };
                    product_count++;
                }
            }

            // keep track of total reactants and products
            for (metabolite_id in reaction.metabolites) {
                metabolite = reaction.metabolites[metabolite_id];
                var primary_index;
                if (metabolite.coefficient < 0) {
                    metabolite.count = reactant_count + 1;
                    primary_index = primary_reactant_index;
                } else {
                    metabolite.count = product_count + 1;
                    primary_index = primary_product_index;
                }

                // record reaction_id with each metabolite
                metabolite.reaction_id = reaction_id;

                // calculate coordinates of metabolite components
                metabolite = utils.calculate_new_metabolite_coordinates(metabolite,
									primary_index,
									reaction.main_axis,
									reaction.center,
									reaction.dis);
	    }

	    // rotate the new reaction
	    var angle = Math.PI / 2; // default angle
	    reaction = rotate_reaction(reaction, angle, coords);

            // append the new reaction
            o.drawn_reactions[reaction_id] = reaction;

            // draw, and set the new coords
            // o.selected_node = {'reaction_id': reaction_id,
            //                    'direction': "product",
            //                    'metabolite_id': newest_primary_product_id,
            //                    'is_selected': true};
            draw_everything();
            var new_coords;
	    d3.select('.selected').each(function(d) { new_coords = {x: d.x, y: d.y}; });
            translate_off_screen(new_coords);
            if (input.is_visible(o.reaction_input)) cmd_show_input();
        }

        function translate_off_screen(coords) {
            // shift window if new reaction will draw off the screen
            // TODO BUG not accounting for scale correctly
            var margin = 200,
                new_pos,
                current = {'x': {'min': -o.window_translate.x,
                                 'max': (o.width-o.window_translate.x)/o.window_scale},
                           'y': {'min': -o.window_translate.y,
                                 'max': (o.height-o.window_translate.y)/o.window_scale} },
                go = function() {
                    o.zoom.translate([o.window_translate.x, o.window_translate.y]);
                    o.zoom.scale(o.window_scale);
                    o.sel.transition()
                        .attr('transform', 'translate('+o.window_translate.x+','+o.window_translate.y+')scale('+o.window_scale+')');
                };
            if (coords.x < current.x.min + margin) {
                new_pos = -(coords.x - current.x.min - margin) * o.window_scale + o.window_translate.x;
                o.window_translate.x = new_pos;
                go();
            } else if (coords.x > current.x.max - margin) {
                new_pos = -(coords.x - current.x.max + margin) * o.window_scale + o.window_translate.x;
                o.window_translate.x = new_pos;
                go();
            }
            if (coords.y < current.y.min + margin) {
                new_pos = -(coords.y - current.y.min - margin) * o.window_scale + o.window_translate.y;
                o.window_translate.y = new_pos;
                go();
            } else if (coords.y > current.y.max - margin) {
                new_pos = -(coords.y - current.y.max + margin) * o.window_scale + o.window_translate.y;
                o.window_translate.y = new_pos;
                go();
            }
        }

        function get_coords_for_node(node_id) {
            var node = o.drawn_nodes[node_id],
                coords = {'x': node.x, 'y': node.y};
            return coords;
        }

        // function cycle_primary_key() {
        //     /* Cycle the primary metabolite among the products of the selected reaction.
	//      *
	//      */

        //     // if (!o.selected_node.is_selected) {
        //     //     console.log('no selected node');
        //     //     return;
        //     // }

        //     // get last index
        //     var last_index, count;
        //     var reaction = o.drawn_reactions[o.selected_node.reaction_id];
        //     for (var metabolite_id in reaction.segments) {
        //         var metabolite = reaction.segments[metabolite_id];
        //         if ((metabolite.coefficient > 0 && o.selected_node.direction=="product") ||
        //             (metabolite.coefficient < 0 && o.selected_node.direction=="reactant")) {
        //             if (metabolite.is_primary) {
        //                 last_index = metabolite.index;
        //                 count = metabolite.count;
        //             }
        //         }
        //     }
        //     // rotate to new index
        //     var index = last_index + 1 < count - 1 ? last_index + 1 : 0;
        //     rotate_primary_key(index);
        // }

        // function rotate_primary_key(index) {
        //     /* Switch the primary metabolite to the index of a particular product.
	//      */

        //     if (!o.selected_node.is_selected) {
        //         console.warn('no selected node');
        //         return;
        //     }

        //     // update primary in o.drawn_reactions
        //     var new_primary_metabolite_id;
        //     var reaction = o.drawn_reactions[o.selected_node.reaction_id];

        //     // if primary is selected, then maintain that selection
        //     var sel_is_primary = reaction.segments[o.selected_node.metabolite_id].is_primary,
        //         should_select_primary = sel_is_primary ? true : false;

        //     for (var metabolite_id in reaction.segments) {
        //         var metabolite = reaction.segments[metabolite_id];
        //         if ((metabolite.coefficient > 0 && o.selected_node.direction=="product") ||
        //             (metabolite.coefficient < 0 && o.selected_node.direction=="reactant")) {
        //             if (metabolite.index == index) {
        //                 metabolite.is_primary = true;
        //                 new_primary_metabolite_id = metabolite_id;
        //             } else {
        //                 metabolite.is_primary = false;
        //             }
        //             // calculate coordinates of metabolite components
        //             metabolite = utils.calculate_new_metabolite_coordinates(metabolite,
	// 								    index,
        //                                                                     reaction.main_axis,
	// 								    reaction.center,
	// 								    reaction.dis);
        //         }
        //     }

        //     var coords;
        //     if (should_select_primary) {
        //         o.selected_node.node_id = new_primary_node_id;
        //         coords = get_coords_for_node(o.selected_node.node_id);
        //     } else {
        //         coords = get_coords_for_node(o.selected_node.node_id);
        //     }

        //     draw_specific_reactions([o.selected_node.reaction_id]);
        // }

        function select_metabolite(sel, d, node_selection, shift_key_on) {
	    if (shift_key_on) d3.select(sel.parentNode).classed("selected", !d3.select(sel.parentNode).classed("selected")); //d.selected = !d.selected);
            else node_selection.classed("selected", function(p) { return d === p; });
	    var selected_nodes = d3.select('.selected'),
		count = 0;
	    selected_nodes.each(function() { count++; });
	    if (input.is_visible(o.reaction_input)) {
		if (count == 1) cmd_show_input();
		else cmd_hide_input();
	    }
	}

	function rotate_reaction_id(cobra_id, angle, center) {
	    /* Rotate reaction with cobra_id in o.drawn_reactions around center.
	     */

	    var reaction = o.drawn_reactions[cobra_id];
	    o.drawn_reactions[cobra_id] = rotate_reaction(reaction,
							  angle, center);
	}
	
        function rotate_reaction(reaction, angle, center_absolute) {
	    /* Rotate reaction around center.
	     */

	    // functions
	    var rotate_around = function(coord) {
		return utils.rotate_coords(coord, angle, center_absolute);
	    };
	    var rotate_around_recursive = function(coords) {
		return utils.rotate_coords_recursive(coords, angle, center_absolute);
	    };
	    var rotate_around_rel = function(coord) {
		// convert to absolute coords, rotate, then convert back
		return utils.rotate_coords_relative(coord, angle, 
						    center_absolute, reaction.coords);
	    };
	    var rotate_around_rel_recursive = function(coords) {
		// convert to absolute coords, rotate, then convert back, recursively
		return utils.rotate_coords_relative_recursive(coords, angle,
							      center_absolute,
							      reaction.coords);
	    };

	    // recalculate: reaction.main_axis, reaction.coords
	    reaction.coords = rotate_around(reaction.coords);
	    reaction.center = rotate_around_rel(reaction.center);
	    reaction.main_axis = rotate_around_rel_recursive(reaction.main_axis);

	    // recalculate: metabolite.*
	    for (var met_id in reaction.segments) {
		var metabolite = reaction.segments[met_id];
		metabolite.b1 = rotate_around_rel(metabolite.b1);
		metabolite.b2 = rotate_around_rel(metabolite.b2);
		metabolite.start = rotate_around_rel(metabolite.start);
		metabolite.end = rotate_around_rel(metabolite.end);
		metabolite.circle = rotate_around_rel(metabolite.circle);
	    }
	    return reaction;
        }
	
        // -----------------------------------------------------------------------------------
        // KEYBOARD

        function setup_key_listeners() {
            var held_keys = reset_held_keys(),
                modifier_keys = { command: 91,
                                  control: 17,
                                  option: 18,
                                  shift: 16},
                primary_cycle_key= { key: 80 }, // 'p'
                hide_show_input_key = { key: 191 }, // forward slash '/'
                rotate_keys = {'left':  { key: 37 },
                               'right': { key: 39 },
                               'up':    { key: 38 },
                               'down':  { key: 40 } },
                control_key = { key: 17 },
                save_key = { key: 83, modifiers: { control: true } },
                load_key = { key: 79, modifiers: { control: true } },
		load_flux_key = { key: 70, modifiers: { control: true } },
		pan_and_zoom_key = { key: 90 },
		brush_key = { key: 86 };

            d3.select(window).on("keydown", function() {
                var kc = d3.event.keyCode,
                    reaction_input_visible = input.is_visible(o.reaction_input);

                held_keys = toggle_modifiers(modifier_keys, held_keys, kc, true);
		o.shift_key_on = held_keys.shift;
		if (check_key(hide_show_input_key, kc, held_keys)) {
                    cmd_hide_show_input();
                    held_keys = reset_held_keys();
                // } else if (check_key(primary_cycle_key, kc, held_keys) && !reaction_input_visible) {
                //     cmd_cycle_primary_metabolite();
                //     held_keys = reset_held_keys();
                // } else if (check_key(rotate_keys.left, kc, held_keys) && !reaction_input_visible) {
                //     cmd_left();
                //     held_keys = reset_held_keys();
                // } else if (check_key(rotate_keys.right, kc, held_keys) && !reaction_input_visible) {
                //     cmd_right();
                //     held_keys = reset_held_keys();
                // } else if (check_key(rotate_keys.up, kc, held_keys) && !reaction_input_visible) {
                //     cmd_up();
                //     held_keys = reset_held_keys();
                // } else if (check_key(rotate_keys.down, kc, held_keys) && !reaction_input_visible) {
                //     cmd_down();
                //     held_keys = reset_held_keys();
                } else if (check_key(save_key, kc, held_keys) && !reaction_input_visible) {
                    held_keys = reset_held_keys();
                    cmd_save();
                } else if (check_key(load_key, kc, held_keys) && !reaction_input_visible) {
                    cmd_load();
                    held_keys = reset_held_keys();
                } else if (check_key(load_flux_key, kc, held_keys) && !reaction_input_visible) {
                    cmd_load_flux();
                    held_keys = reset_held_keys();
                } else if (check_key(pan_and_zoom_key, kc, held_keys) && !reaction_input_visible) {
                    cmd_zoom_on();
                    held_keys = reset_held_keys();
                } else if (check_key(brush_key, kc, held_keys) && !reaction_input_visible) {
                    cmd_zoom_off();
                    held_keys = reset_held_keys();
                }
            }).on("keyup", function() {
                held_keys = toggle_modifiers(modifier_keys, held_keys, d3.event.keyCode, false);
		o.shift_key_on = held_keys.shift;
            });

            function reset_held_keys() {
                return { command: false,
                         control: false,
                         option: false,
                         shift: false };
            }
            function toggle_modifiers(mod, held, kc, on_off) {
                for (var k in mod)
                    if (mod[k] == kc)
                        held[k] = on_off;
                return held;
            }
            function check_key(key, pressed, held) {
                if (key.key != pressed) return false;
                var mod = key.modifiers;
                if (mod === undefined)
                    mod = { control: false,
                            command: false,
                            option: false,
                            shift: false };
                for (var k in held) {
                    if (mod[k] === undefined) mod[k] = false;
                    if (mod[k] != held[k]) return false;
                }
                return true;
            }
        }
        // Commands
        function cmd_hide_show_input() {
            if (input.is_visible(o.reaction_input)) cmd_hide_input();
            else cmd_show_input();
        }
        function cmd_hide_input() {
            o.reaction_input.selection.style("display", "none");
            o.reaction_input.completely.input.blur();
            o.reaction_input.completely.hideDropDown();
        }
        function cmd_show_input() {
	    input.reload_at_selected(o.reaction_input, o.scale.x, o.scale.y, o.window_scale, 
				     o.window_translate, o.width, o.height, o.flux, 
				     o.drawn_reactions, o.cobra_reactions, new_reaction);
        }
        function cmd_cycle_primary_metabolite() {
            // cmd_hide_input();
            // cycle_primary_key();
        }
        function cmd_left() {
            // cmd_hide_input();
            // rotate_reaction_id(o.selected_node.reaction_id, 'angle', 270*(Math.PI/180));
            // draw_specific_reactions_with_location(o.selected_node.reaction_id);
        }
        function cmd_right() {
            // cmd_hide_input();
            // rotate_reaction_id(o.selected_node.reaction_id, 'angle', 90*(Math.PI/180));
            // draw_specific_reactions_with_location(o.selected_node.reaction_id);
        }
        function cmd_up() {
            // cmd_hide_input();
            // rotate_reaction_id(o.selected_node.reaction_id, 'angle', 180*(Math.PI/180));
            // draw_specific_reactions_with_location(o.selected_node.reaction_id);
        }
        function cmd_down() {
            // cmd_hide_input();
            // rotate_reaction_id(o.selected_node.reaction_id, 'angle', 0);
            // draw_specific_reactions_with_location(o.selected_node.reaction_id);
        }
        function cmd_save() {
            console.log("Saving");
            utils.download_json(map_for_export(), "saved_map");
        }
        function cmd_load() {
            console.log("Loading");
            o.load_input_click_fn();
        }
	function cmd_load_flux() {
	    console.log("Loading flux");
	    o.load_flux_input_click_fn();
	}
	function cmd_show_beziers() {
	    o.show_beziers = true;
	    d3.select(this).text('Hide control points')
		.on('click', cmd_hide_beziers);
	    draw_everything();
	}
	function cmd_hide_beziers() {
	    o.show_beziers = false;
	    d3.select(this).text('Show control points')
		.on('click', cmd_show_beziers);
	    draw_everything();
	}
	function cmd_zoom_on() {
	    o.zoom_enabled = true;
	    enable_brush(false);
	    d3.select('#zoom-button').text('Enable select (v)')
		.on('click', cmd_zoom_off);
	}
	function cmd_zoom_off() {
	    o.zoom_enabled = false;
	    enable_brush(true);
	    d3.select('#zoom-button').text('Enable pan+zoom (z)')
		.on('click', cmd_zoom_on);
	}
    };
});

define('main',["vis/bar", "vis/box-and-whiskers", "vis/category-legend",
        "vis/data-menu", "vis/epistasis", "vis/export-svg",
        "vis/histogram", "vis/resize", "vis/scatter",
        "vis/subplot", "vis/tooltip", "metabolic-map/main",
	"metabolic-map/knockout", "builder/main"],
       function(bar, baw, cl, dm, ep, ev, hist, re, sc, sp, tt, mm, ko, bu) {
           return { bar: bar,
                    box_and_whiskers: baw,
                    category_legend: cl,
                    data_menu: dm,
                    epistasis: ep,
                    export_svg: ev,
                    histogram: hist,
                    resize: re,
                    scatter: sc,
                    subplot: sp,
                    tooltip: tt,
		    metabolic_map: mm,
		    builder: bu,
		    knockout: ko };
       });

    //The modules for your project will be inlined above
    //this snippet. Ask almond to synchronously require the
    //module value for 'main' here and return it as the
    //value to use for the public API for the built file.
    return require('main');
}));