;
(function () {
    jsPlumbToolkitBrowserUI.ready(function () {

// ------------------------ toolkit setup ------------------------------------

        // get the various dom elements
        var mainElement = document.querySelector("#jtk-demo-dbase"),
            canvasElement = mainElement.querySelector(".jtk-demo-canvas"),
            miniviewElement = mainElement.querySelector(".miniview"),
            nodePalette = mainElement.querySelector(".node-palette"),
            controls = mainElement.querySelector(".controls");

        // Declare an instance of the Toolkit, and supply the functions we will use to get ids and types from nodes.
        var toolkit = jsPlumbToolkitBrowserUI.newInstance({
            nodeFactory: function (type, data, callback) {
                data.columns = [];
                dialogs.show({
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
            // the name of the property in each node's data that is the key for the data for the ports for that node.
            // for more complex setups you can use `portExtractor` and `portUpdater` functions - see the documentation for examples.
            portDataProperty:"columns",
            //
            // Prevent connections from a column to itself or to another column on the same table.
            //
            beforeConnect:function(source, target) {
                return source !== target && source.getParent() !== target.getParent();
            }
        });

// ------------------------ / toolkit setup ------------------------------------

// ------------------------- dialogs -------------------------------------
        var dialogs = jsPlumbToolkitDialogs.newInstance({
                selector: ".dlg"
            }
        );
// ------------------------- / dialogs ----------------------------------

// ------------------------ rendering ------------------------------------

        // Instruct the toolkit to render to the 'canvas' element. We pass in a model of nodes, edges and ports, which
        // together define the look and feel and behaviour of this renderer.  Note that we can have 0 - N renderers
        // assigned to one instance of the Toolkit..
        var renderer = toolkit.render(canvasElement, {
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
                            "dbltrap": function (params) {
                                _editEdge(params.edge);
                            }
                        },
                        overlays: [
                            {
                                type: "Label",
                                options:{
                                    cssClass: "delete-relationship",
                                    label: "<i class='fa fa-times'></i>",
                                    events: {
                                        "click": function (params) {
                                            toolkit.removeEdge(params.edge);
                                        }
                                    }
                                }
                            }
                        ]
                    },
                    // each edge type has its own overlays.
                    "1:1": {
                        parent: "common",
                        overlays: [
                            { type:"Label", options:{ label: "1", location: 0.1 }},
                            { type:"Label", options:{ label: "1", location: 0.9 }}
                        ]
                    },
                    "1:N": {
                        parent: "common",
                        overlays: [
                            { type:"Label", options:{ label: "1", location: 0.1 }},
                            { type:"Label", options:{ label: "N", location: 0.9 }}
                        ]
                    },
                    "N:M": {
                        parent: "common",
                        overlays: [
                            { type:"Label", options:{ label: "N", location: 0.1 }},
                            { type:"Label", options:{ label: "M", location: 0.9 }}
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
                            "dbltap": function () {
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
                padding: [150, 150]
            },
            plugins:[
                {
                    type: "miniview",
                    options: {
                        container: miniviewElement
                    }
                },
                "lasso"
            ],
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
            zoomToFit:true,
            consumeRightClick:false
        });

        // listener for mode change on renderer.
        renderer.bind("modeChanged", function (mode) {
            renderer.removeClass(controls.querySelectorAll("[mode]"), "selected-mode");
            renderer.addClass(controls.querySelectorAll("[mode='" + mode + "']"), "selected-mode");
        });

        var undoredo = jsPlumbToolkitUndoRedo.newInstance({
            surface:renderer,
            onChange:function(undo, undoSize, redoSize) {
                controls.setAttribute("can-undo", undoSize > 0);
                controls.setAttribute("can-redo", redoSize > 0);
            },
            compound:true
        });

// ------------------------- behaviour ----------------------------------

        renderer.on(controls, "tap", "[undo]", function () {
            undoredo.undo();
        });

        renderer.on(controls, "tap", "[redo]", function () {
            undoredo.redo();
        });


        // delete column button
        renderer.bindModelEvent("tap", ".table-column-delete, .table-column-delete i", function (event, els, info) {
            jsPlumbBrowserUI.consume(event);
            dialogs.show({
                id: "dlgConfirm",
                data: {
                    msg: "Delete column '" + info.obj.data.name + "'"
                },
                onOK: function (data) {
                    toolkit.removePort(info.obj.getParent(), info.id);
                }
            });
        });

        // add new column to table
        renderer.bindModelEvent("tap", ".new-column, .new-column i", function (event, els, info) {
            jsPlumbBrowserUI.consume(event);

            dialogs.show({
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
                                id: jsPlumb.uuid(),
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
        renderer.bindModelEvent("tap", ".delete, .view-delete", function (event, els, info) {
            jsPlumbBrowserUI.consume(event);

            dialogs.show({
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
        renderer.bindModelEvent("tap", ".view .view-edit i", function (event, els, info) {
            jsPlumbBrowserUI.consume(event);
            dialogs.show({
                id: "dlgViewQuery",
                data: info.obj.data,
                onOK: function (data) {
                    // update data, and UI (which works only if you use the Toolkit's default template engine, Rotors.
                    toolkit.updateNode(info.obj, data);
                }
            });
        });

        // change a view or table's name
        renderer.bindModelEvent("tap", ".edit-name", function (event, els, info) {
            jsPlumbBrowserUI.consume(event);
            dialogs.show({
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
            dialogs.show({
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
        renderer.bindModelEvent("tap", ".table-column-edit i", function (event, els, info) {
            jsPlumbBrowserUI.consume(event);
            dialogs.show({
                id: "dlgColumnEdit",
                title: "Column Details",
                data: info.obj.data,
                onOK: function (data) {
                    // if the user supplied a column name, tell the toolkit to add a new port, providing it the
                    // id and name of the new column.  This will result in a callback to the portFactory defined above.
                    if (data.name) {
                        if (data.name.length < 2)
                            dialogs.show({id: "dlgMessage", msg: "Column names must be at least 2 characters!"});
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
        renderer.on(controls, "tap", "[mode]", function () {
            renderer.setMode(this.getAttribute("mode"));
        });

        // on home button click, zoom content to fit.
        renderer.on(controls, "tap", "[reset]", function () {
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

        jsPlumbToolkitDrop.createSurfaceManager({
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

       jsPlumbToolkitSyntaxHighlighter.newInstance(toolkit, ".jtk-demo-dataset");

// ------------------------ loading  ------------------------------------

        // Load the data.
        toolkit.load({
            url: "../data/schema-1.json"
        });

// ------------------------ /loading  ------------------------------------



    });
})();
