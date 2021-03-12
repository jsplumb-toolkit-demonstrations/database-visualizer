import {ready, newInstance, MiniviewPlugin, consume} from "@jsplumbtoolkit/browser-ui"
import { createDialogManager } from "@jsplumbtoolkit/dialogs"
import {Edge, isPort, Vertex, uuid, EVENT_CLICK, SpringLayout, forEach} from "@jsplumbtoolkit/core"
import { createUndoRedoManager } from "@jsplumbtoolkit/undo-redo"
import {createSurfaceManager} from "@jsplumbtoolkit/drop"

ready(() => {

// ------------------------ toolkit setup ------------------------------------

    // get the various dom elements
    const mainElement = document.querySelector("#jtk-demo-dbase"),
        canvasElement = mainElement.querySelector(".jtk-demo-canvas"),
        miniviewElement = mainElement.querySelector(".miniview"),
        nodePalette = mainElement.querySelector(".node-palette"),
        controls = mainElement.querySelector(".controls");

    // Declare an instance of the Toolkit, and supply the functions we will use to get ids and types from nodes.
    const toolkit = newInstance({
        nodeFactory: (type:string, data:any, callback:Function) => {
            data.columns = [];
            dialogs.show({
                id: "dlgName",
                title: "Enter " + type + " name:",
                onOK: (d:any) => {
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
            })
            return true
        },
        edgeFactory: (params:any, data:any, callback:Function) => {
            // you must hit the callback if you provide the edgeFactory....
            callback(data)
            return true // ...unless you return false here, which would abort the edge
        },
        // the name of the property in each node's data that is the key for the data for the ports for that node.
        // we used to use portExtractor and portUpdater in this demo, prior to the existence of portDataProperty.
        // for more complex setups, those functions may still be needed.
        portDataProperty:"columns",
        //
        // Prevent connections from a column to itself or to another column on the same table.
        //
        beforeConnect:(source:Vertex, target:Vertex) => {
            return isPort(source) && isPort(target) && source !== target && source.getParent() !== target.getParent()
        }
    })

// ------------------------ / toolkit setup ------------------------------------

// ------------------------- dialogs -------------------------------------
    const dialogs = createDialogManager({
        selector: ".dlg"
    })
// ------------------------- / dialogs ----------------------------------

// ------------------------ rendering ------------------------------------

    // Instruct the toolkit to render to the 'canvas' element. We pass in a model of nodes, edges and ports, which
    // together define the look and feel and behaviour of this renderer.  Note that we can have 0 - N renderers
    // assigned to one instance of the Toolkit..
    const renderer = toolkit.render(canvasElement, {
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
                        "dbltap": (params:{edge:Edge}) => {
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
                                    "tap": (params:{edge:Edge}) => {
                                        toolkit.removeEdge(params.edge)
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
                    maxConnections: -1 // no limit on connections
                }
            }
        },
        // Layout the nodes using a 'Spring' (force directed) layout. This is the best layout in the jsPlumbToolkit
        // for an application such as this.
        layout: {
            type: SpringLayout.type,
            parameters: {
                padding: [150, 150]
            }
        },
        plugins:[
            {
                type: MiniviewPlugin.type,
                options: {
                    container: miniviewElement
                }
            }
        ],
        // Register for certain events from the renderer. Here we have subscribed to the 'nodeRendered' event,
        // which is fired each time a new node is rendered.  We attach listeners to the 'new column' button
        // in each table node.  'data' has 'node' and 'el' as properties: node is the underlying node data,
        // and el is the DOM element. We also attach listeners to all of the columns.
        // At this point we can use our underlying library to attach event listeners etc.
        events: {
            edgeAdded: (params:{edge:Edge, addedByMouse?:boolean}) => {
                // Check here that the edge was not added programmatically, ie. on load.
                if (params.addedByMouse) {
                    _editEdge(params.edge, true)
                }
            },
            canvasClick: (e:Event) => {
                toolkit.clearSelection()
            }
        },
        dragOptions: {
            filter: "i, .view .buttons, .table .buttons, .table-column *, .view-edit, .edit-name, .delete, .add"
        },
        zoomToFit:true,
        consumeRightClick:false
    });

    // listener for mode change on renderer.
    renderer.bind("modeChanged", (mode:string) => {
        forEach(controls.querySelectorAll("[mode]"), (e:Element) => {
            renderer.removeClass(e, "selected-mode")
        })

        renderer.addClass(controls.querySelector("[mode='" + mode + "']"), "selected-mode")
    })

    const undoredo = createUndoRedoManager({
        surface:renderer,
        onChange:(undo:any, undoSize:number, redoSize:number) => {
            controls.setAttribute("can-undo", undoSize > 0 ? "true" : "false");
            controls.setAttribute("can-redo", redoSize > 0 ? "true" : "false");
        },
        compound:true
    });

// ------------------------- behaviour ----------------------------------

    renderer.on(controls, EVENT_CLICK, "[undo]",  () => {
        undoredo.undo()
    });

    renderer.on(controls, EVENT_CLICK, "[redo]", () => {
        undoredo.redo()
    });


    // delete column button
    renderer.on(canvasElement, EVENT_CLICK, ".table-column-delete, .table-column-delete i", (e:Event) => {
        consume(e);
        const info = renderer.getObjectInfo<Vertex>(e.target || e.srcElement);
        dialogs.show({
            id: "dlgConfirm",
            data: {
                msg: "Delete column '" + info.obj.data.name + "'"
            },
            onOK: function(data:Record<string, any>) {
                if (isPort(info.obj)) {
                    toolkit.removePort(info.obj.getParent(), info.id);
                }
            },
            onOpen:function(el:Element) {
                console.dir(el);
            }
        })
    })

    // add new column to table
    renderer.on(canvasElement, "tap", ".new-column, .new-column i", (e:Event) => {
        consume(e);
        const // getObjectInfo is a helper method that retrieves the node or port associated with some
            // element in the DOM.
            info = renderer.getObjectInfo<Vertex>(e.target || e.srcElement);

        dialogs.show({
            id: "dlgColumnEdit",
            title: "Column Details",
            onOK: function(data:Record<string, any>) {
                // if the user supplied a column name, tell the toolkit to add a new port, providing it the
                // id and name of the new column.  This will result in a callback to the portFactory defined above.
                if (data.name) {
                    if (data.name.length < 2)
                        alert("Column names must be at least 2 characters!");
                    else {
                        toolkit.addNewPort(info.id, "column", {
                            id: uuid(),
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
    renderer.on(canvasElement, "tap", ".delete, .view-delete", (e:Event) => {
        consume(e);
        const info = renderer.getObjectInfo<Vertex>(this);

        dialogs.show({
            id: "dlgConfirm",
            data: {
                msg: "Delete '" + info.id
            },
            onOK: function(data:any) {
                toolkit.removeNode(info.id);
            }
        });

    });

    // edit a view's query
    renderer.on(canvasElement, "tap", ".view .view-edit i", (e:Event) => {
        consume(e)
        const info = renderer.getObjectInfo<Vertex>(e.target || e.srcElement)
        dialogs.show({
            id: "dlgViewQuery",
            data: info.obj.data,
            onOK: function(data:Record<string, any>) {
                // update data, and UI (which works only if you use the Toolkit's default template engine, Rotors.
                toolkit.updateNode(info.obj, data)
            }
        });
    });

    // change a view or table's name
    renderer.on(canvasElement, EVENT_CLICK, ".edit-name", (e:Event) => {
        consume(e)
        // getObjectInfo is a method that takes some DOM element (this function's `this` is
        // set to the element that fired the event) and returns the toolkit data object that
        // relates to the element.
        const info = renderer.getObjectInfo<Vertex>(e.target || e.srcElement)
        dialogs.show({
            id: "dlgName",
            data: info.obj.data,
            title: "Edit " + info.obj.data.type + " name",
            onOK: function(data:Record<string, any>) {
                if (data.name && data.name.length > 2) {
                    // if name is at least 2 chars long, update the underlying data and
                    // update the UI.
                    toolkit.updateNode(info.obj, data)
                }
            }
        })
    })

    // edit an edge's detail. If the edge was brand new and the user presses cancel, delete the edge.
    const _editEdge = (edge:Edge, isNew?:boolean) => {
        dialogs.show({
            id: "dlgRelationshipType",
            data: edge.data,
            onOK: function(data:Record<string, any>) {
                // update the type in the edge's data model...it will be re-rendered.
                // `type` is set in the radio buttons in the dialog template.
                toolkit.updateEdge(edge, data);
            },
            onCancel: function() {
                // if the user pressed cancel on a new edge, delete the edge.
                if (isNew) {
                    toolkit.removeEdge(edge);
                }
            }
        })
    }

    // edit a column's details
    renderer.on(canvasElement, EVENT_CLICK, ".table-column-edit i", (e:Event) => {
        consume(e)
        const info = renderer.getObjectInfo<Vertex>(e.target||e.srcElement)
        dialogs.show({
            id: "dlgColumnEdit",
            title: "Column Details",
            data: info.obj.data,
            onOK: function(data:Record<string, any>) {
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
        })
    })

// ------------------------- / behaviour ----------------------------------

    // pan mode/select mode
    renderer.on(controls, EVENT_CLICK, "[mode]",  (e:Event) => {
        const el = (e.target || e.srcElement) as HTMLElement
        renderer.setMode(el.getAttribute("mode"));
    })

    // on home button click, zoom content to fit.
    renderer.on(controls, EVENT_CLICK, "[reset]",  () => {
        toolkit.clearSelection()
        renderer.zoomToFit()
    })

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

    createSurfaceManager({
        source:nodePalette,
        selector:"[data-node-type]",
        surface:renderer,
        dataGenerator: (el:HTMLElement) => {
            return {
                name:el.getAttribute("data-node-type"),
                type:el.getAttribute("data-node-type")
            }
        },
        allowDropOnEdge:false
    })

// ------------------------ / drag and drop new tables/views -----------------

   // var datasetView = jsPlumbToolkitSyntaxHighlighter.newInstance(toolkit, ".jtk-demo-dataset");

// ------------------------ loading  ------------------------------------

    // Load the data.
    toolkit.load({
        url: "../data/schema-1.json"
    });

// ------------------------ /loading  ------------------------------------



});

