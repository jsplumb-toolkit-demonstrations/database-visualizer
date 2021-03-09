;
(function () {
    jsPlumbToolkit.ready(function () {

// ------------------------ toolkit setup ------------------------------------

        // This function is what the toolkit will use to get an ID from a node.
        var idFunction = function (n) {
            return n.id;
        };

        // This function is what the toolkit will use to get the associated type from a node.
        var typeFunction = function (n) {
            return n.type;
        };

        // get the various dom elements
        var mainElement = document.querySelector("#jtk-demo-dbase"),
            canvasElement = mainElement.querySelector(".jtk-demo-canvas"),
            miniviewElement = mainElement.querySelector(".miniview"),
            nodePalette = mainElement.querySelector(".node-palette"),
            controls = mainElement.querySelector(".controls");

        // Declare an instance of the Toolkit, and supply the functions we will use to get ids and types from nodes.
        var toolkit = jsPlumbToolkit.newInstance({
            idFunction: idFunction,
            typeFunction: typeFunction,
            nodeFactory: function (type, data, callback) {
                data.columns = [];
                jsPlumbToolkit.Dialogs.show({
                    id: "dlgName",
                    title: "Enter " + type + " name:",
                    onOK: function (d) {
                        data.name = d.name;
                        // if the user entered a name...
                        if (data.name) {
                            if (data.name.length >= 2) {
                                // generate an id: replace spaces with underscores, and make lower case
                                data.id = data.name.replace(" ", "_").toLowerCase();
                                callback(data);
                            }
                            else
                                alert(type + " names must be at least 2 characters!");
                        }
                        // else...do not proceed.
                    }
                });
            },
            edgeFactory: function (params, data, callback) {
                // you must hit the callback if you provide the edgeFactory.
                callback(data);
                // unless you want to return false, to abandon the edge
                //return false;
            },
            // the name of the property in each node's data that is the key for the data for the ports for that node.
            // we used to use portExtractor and portUpdater in this demo, prior to the existence of portDataProperty.
            // for more complex setups, those functions may still be needed.
            portDataProperty:"columns",
            //
            // Prevent connections from a column to itself or to another column on the same table.
            //
            beforeConnect:function(source, target) {
                return source !== target && source.getNode() !== target.getNode();
            }
        });

// ------------------------ / toolkit setup ------------------------------------

// ------------------------- dialogs -------------------------------------

        jsPlumbToolkit.Dialogs.initialize({
            selector: ".dlg"
        });

// ------------------------- / dialogs ----------------------------------

        jsPlumb.on(controls, "tap", "[undo]", function () {
            undoredo.undo();
        });

        jsPlumb.on(controls, "tap", "[redo]", function () {
            undoredo.redo();
        });


// ------------------------ rendering ------------------------------------

        // Instruct the toolkit to render to the 'canvas' element. We pass in a model of nodes, edges and ports, which
        // together define the look and feel and behaviour of this renderer.  Note that we can have 0 - N renderers
        // assigned to one instance of the Toolkit..
        var renderer = window.renderer = toolkit.render({
            container: canvasElement,
            view: {
                // Two node types - 'table' and 'view'
                nodes: {
                    "table": {
                        template: "tmplTable"
                    },
                    "view": {
                        template: "tmplView"
                    }
                },
                // Three edge types  - '1:1', '1:N' and 'N:M',
                // sharing  a common parent, in which the connector type, anchors
                // and appearance is defined.
                edges: {
                    "common": {
                        detachable:false,
                        anchor: [ "Left", "Right" ], // anchors for the endpoints
                        connector: "StateMachine",  //  StateMachine connector type
                        cssClass:"common-edge",
                        events: {
                            "dbltap": function (params) {
                                _editEdge(params.edge);
                            }
                        },
                        overlays: [
                            [ "Label", {
                                cssClass: "delete-relationship",
                                label: "<i class='fa fa-times'></i>",
                                events: {
                                    "tap": function (params) {
                                        toolkit.removeEdge(params.edge);
                                    }
                                }
                            } ]
                        ]
                    },
                    // each edge type has its own overlays.
                    "1:1": {
                        parent: "common",
                        overlays: [
                            ["Label", { label: "1", location: 0.1 }],
                            ["Label", { label: "1", location: 0.9 }]
                        ]
                    },
                    "1:N": {
                        parent: "common",
                        overlays: [
                            ["Label", { label: "1", location: 0.1 }],
                            ["Label", { label: "N", location: 0.9 }]
                        ]
                    },
                    "N:M": {
                        parent: "common",
                        overlays: [
                            ["Label", { label: "N", location: 0.1 }],
                            ["Label", { label: "M", location: 0.9 }]
                        ]
                    }
                },
                // There is only one type of Port - a column - so we use the key 'default' for the port type
                // Here we define the appearance of this port,
                // and we instruct the Toolkit what sort of Edge to create when the user drags a new connection
                // from an instance of this port. Note that we here we tell the Toolkit to create an Edge of type
                // 'common' because we don't know the cardinality of a relationship when the user is dragging. Once
                // a new relationship has been established we can ask the user for the cardinality and update the
                // model accordingly.
                ports: {
                    "default": {
                        template: "tmplColumn",
                        paintStyle: { fill: "#f76258" },		// the endpoint's appearance
                        hoverPaintStyle: { fill: "#434343" }, // appearance when mouse hovering on endpoint or connection
                        edgeType: "common", // the type of edge for connections from this port type
                        maxConnections: -1, // no limit on connections
                        dropOptions: {  //drop options for the port. here we attach a css class.
                            hoverClass: "drop-hover"
                        },
                        events: {
                            "dblclick": function () {
                                console.log(arguments);
                            }
                        }
                    }
                }
            },
            // Layout the nodes using a 'Spring' (force directed) layout. This is the best layout in the jsPlumbToolkit
            // for an application such as this.
            layout: {
                type: "Spring",
                parameters: {
                    padding: [150, 150]
                }
            },
            miniview: {
                container: miniviewElement
            },
            // Register for certain events from the renderer. Here we have subscribed to the 'nodeRendered' event,
            // which is fired each time a new node is rendered.  We attach listeners to the 'new column' button
            // in each table node.  'data' has 'node' and 'el' as properties: node is the underlying node data,
            // and el is the DOM element. We also attach listeners to all of the columns.
            // At this point we can use our underlying library to attach event listeners etc.
            events: {
                edgeAdded: function (params) {
                    // Check here that the edge was not added programmatically, ie. on load.
                    if (params.addedByMouse) {
                        _editEdge(params.edge, true);
                    }
                },
                canvasClick: function (e) {
                    toolkit.clearSelection();
                }
            },
            dragOptions: {
                filter: "i, .view .buttons, .table .buttons, .table-column *, .view-edit, .edit-name, .delete, .add"
            },
            zoomToFit:true
        });

        // listener for mode change on renderer.
        renderer.bind("modeChanged", function (mode) {
            jsPlumb.removeClass(controls.querySelectorAll("[mode]"), "selected-mode");
            jsPlumb.addClass(controls.querySelectorAll("[mode='" + mode + "']"), "selected-mode");
        });

        var undoredo = window.undoredo = new jsPlumbToolkitUndoRedo({
            surface:renderer,
            onChange:function(undo, undoSize, redoSize) {
                controls.setAttribute("can-undo", undoSize > 0);
                controls.setAttribute("can-redo", redoSize > 0);
            },
            compound:true
        });

// ------------------------- behaviour ----------------------------------

        // delete column button
        jsPlumb.on(canvasElement, "tap", ".table-column-delete, .table-column-delete i", function (e) {
            jsPlumbUtil.consume(e);
            var info = renderer.getObjectInfo(this);
            jsPlumbToolkit.Dialogs.show({
                id: "dlgConfirm",
                data: {
                    msg: "Delete column '" + info.obj.data.name + "'"
                },
                onOK: function (data) {
                    toolkit.removePort(info.obj.getNode(), info.id);
                },
                onOpen:function(el) {
                    console.dir(el);
                }
            });
        });

        // add new column to table
        jsPlumb.on(canvasElement, "tap", ".new-column, .new-column i", function (e) {
            jsPlumbUtil.consume(e);
            var // getObjectInfo is a helper method that retrieves the node or port associated with some
                // element in the DOM.
                info = renderer.getObjectInfo(this);

            jsPlumbToolkit.Dialogs.show({
                id: "dlgColumnEdit",
                title: "Column Details",
                onOK: function (data) {
                    // if the user supplied a column name, tell the toolkit to add a new port, providing it the
                    // id and name of the new column.  This will result in a callback to the portFactory defined above.
                    if (data.name) {
                        if (data.name.length < 2)
                            alert("Column names must be at least 2 characters!");
                        else {
                            toolkit.addNewPort(info.id, "column", {
                                id: jsPlumbUtil.uuid(),
                                name: data.name.replace(" ", "_").toLowerCase(),
                                primaryKey: data.primaryKey,
                                datatype: data.datatype
                            });
                        }
                    }
                }
            });
        });

        // delete a table or view
        jsPlumb.on(canvasElement, "tap", ".delete, .view-delete", function (e) {
            jsPlumbUtil.consume(e);
            var info = renderer.getObjectInfo(this);

            jsPlumbToolkit.Dialogs.show({
                id: "dlgConfirm",
                data: {
                    msg: "Delete '" + info.id
                },
                onOK: function (data) {
                    toolkit.removeNode(info.id);
                }
            });

        });

        // edit a view's query
        jsPlumb.on(canvasElement, "tap", ".view .view-edit i", function (e) {
            jsPlumbUtil.consume(e);
            var info = renderer.getObjectInfo(this);
            jsPlumbToolkit.Dialogs.show({
                id: "dlgViewQuery",
                data: info.obj.data,
                onOK: function (data) {
                    // update data, and UI (which works only if you use the Toolkit's default template engine, Rotors.
                    toolkit.updateNode(info.obj, data);
                }
            });
        });

        // change a view or table's name
        jsPlumb.on(canvasElement, "tap", ".edit-name", function (e) {
            jsPlumbUtil.consume(e);
            // getObjectInfo is a method that takes some DOM element (this function's `this` is
            // set to the element that fired the event) and returns the toolkit data object that
            // relates to the element.
            var info = renderer.getObjectInfo(this);
            jsPlumbToolkit.Dialogs.show({
                id: "dlgName",
                data: info.obj.data,
                title: "Edit " + info.obj.data.type + " name",
                onOK: function (data) {
                    if (data.name && data.name.length > 2) {
                        // if name is at least 2 chars long, update the underlying data and
                        // update the UI.
                        toolkit.updateNode(info.obj, data);
                    }
                }
            });
        });

        // edit an edge's detail
        var _editEdge = function (edge, isNew) {
            jsPlumbToolkit.Dialogs.show({
                id: "dlgRelationshipType",
                data: edge.data,
                onOK: function (data) {
                    // update the type in the edge's data model...it will be re-rendered.
                    // `type` is set in the radio buttons in the dialog template.
                    toolkit.updateEdge(edge, data);
                },
                onCancel: function () {
                    // if the user pressed cancel on a new edge, delete the edge.
                    if (isNew) toolkit.removeEdge(edge);
                }
            });
        };

        // edit a column's details
        jsPlumb.on(canvasElement, "tap", ".table-column-edit i", function (e) {
            jsPlumbUtil.consume(e);
            var info = renderer.getObjectInfo(this);
            jsPlumbToolkit.Dialogs.show({
                id: "dlgColumnEdit",
                title: "Column Details",
                data: info.obj.data,
                onOK: function (data) {
                    // if the user supplied a column name, tell the toolkit to add a new port, providing it the
                    // id and name of the new column.  This will result in a callback to the portFactory defined above.
                    if (data.name) {
                        if (data.name.length < 2)
                            jsPlumbToolkit.Dialogs.show({id: "dlgMessage", msg: "Column names must be at least 2 characters!"});
                        else {
                            toolkit.updatePort(info.obj, {
                                name: data.name.replace(" ", "_").toLowerCase(),
                                primaryKey: data.primaryKey,
                                datatype: data.datatype
                            });
                        }
                    }
                }
            });
        });

// ------------------------- / behaviour ----------------------------------

        // pan mode/select mode
        jsPlumb.on(controls, "tap", "[mode]", function () {
            renderer.setMode(this.getAttribute("mode"));
        });

        // on home button click, zoom content to fit.
        jsPlumb.on(controls, "tap", "[reset]", function () {
            toolkit.clearSelection();
            renderer.zoomToFit();
        });

// ------------------------ / rendering ------------------------------------


// ------------------------ drag and drop new tables/views -----------------

        //
        // Here, we are registering elements that we will want to drop onto the workspace and have
        // the toolkit recognise them as new nodes.
        //
        //  typeExtractor: this function takes an element and returns to jsPlumb the type of node represented by
        //                 that element. In this application, that information is stored in the 'jtk-node-type' attribute.
        //
        //  dataGenerator: this function takes a node type and returns some default data for that node type.
        //

        new SurfaceDropManager({
            source:nodePalette,
            selector:"[data-node-type]",
            surface:renderer,
            dataGenerator: function (el) {
                return {
                    name:el.getAttribute("data-node-type"),
                    type:el.getAttribute("data-node-type")
                };
            },
            allowDropOnEdge:false
        });

// ------------------------ / drag and drop new tables/views -----------------

        var datasetView = new jsPlumbSyntaxHighlighter(toolkit, ".jtk-demo-dataset");

// ------------------------ loading  ------------------------------------

        // Load the data.
        toolkit.load({
            url: "schema-1.json"
        });

// ------------------------ /loading  ------------------------------------



    });
})();
