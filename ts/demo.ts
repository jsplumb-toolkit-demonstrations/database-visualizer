import {ready, newInstance, MiniviewPlugin, consume, LassoPlugin} from "@jsplumbtoolkit/browser-ui"
import { newInstance as newDialogManager } from "@jsplumbtoolkit/dialogs"
import {
    Edge,
    isPort,
    Vertex,
    uuid,
    EVENT_CLICK,
    EVENT_TAP,
    SpringLayout,
    forEach,
    StateMachineConnector,
    LabelOverlay,
    ObjectInfo
} from "@jsplumbtoolkit/core"
import { newInstance as createUndoRedoManager } from "@jsplumbtoolkit/undo-redo"
import {createSurfaceManager} from "@jsplumbtoolkit/drop"
import { newInstance as newSyntaxHighlighter } from "@jsplumb/json-syntax-highlighter"

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
        // the name of the property in each node's data that is the key for the data for the ports for that node.
        // for more complex setups you can use `portExtractor` and `portUpdater` functions - see the documentation for examples.
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
    const dialogs = newDialogManager({
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
                    connector: StateMachineConnector.type,  //  StateMachine connector type
                    cssClass:"common-edge",
                    events: {
                        "dbltap": (params:{edge:Edge}) => {
                            _editEdge(params.edge);
                        }
                    },
                    overlays: [
                        {
                            type: LabelOverlay.type,
                            options:{
                                cssClass: "delete-relationship",
                                label: "<i class='fa fa-times'></i>",
                                events: {
                                    "click": (params:{edge:Edge}) => {
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
            options: {
                padding: {x:150, y:150}
            }
        },
        plugins:[
            {
                type: MiniviewPlugin.type,
                options: {
                    container: miniviewElement
                }
            },
            LassoPlugin.type
        ],
        // Register for certain events from the renderer. Here we have subscribed to the 'nodeRendered' event,
        // which is fired each time a new node is rendered.  We attach listeners to the 'new column' button
        // in each table node.  'data' has 'node' and 'el' as properties: node is the underlying node data,
        // and el is the DOM element. We also attach listeners to all of the columns.
        // At this point we can use our underlying library to attach event listeners etc.
        events: {
            "edge:add": (params:{edge:Edge, addedByMouse?:boolean}) => {
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

   //  // listener for mode change on renderer.
    renderer.bind("modeChanged", (mode:string) => {
        renderer.removeClass(controls.querySelectorAll("[mode]"), "selected-mode")
        renderer.addClass(controls.querySelector("[mode='" + mode + "']"), "selected-mode")
    })
   //
    const undoredo = createUndoRedoManager({
        surface:renderer,
        onChange:(undo:any, undoSize:number, redoSize:number) => {
            controls.setAttribute("can-undo", undoSize > 0 ? "true" : "false");
            controls.setAttribute("can-redo", redoSize > 0 ? "true" : "false");
        },
        compound:true
    });
   //
   //
    renderer.on(controls, EVENT_TAP, "[undo]",  () => {
        undoredo.undo()
    });

    renderer.on(controls, EVENT_TAP, "[redo]", () => {
        undoredo.redo()
    });
   //
   //
   //  // delete column button
    renderer.bindModelEvent(EVENT_TAP, ".table-column-delete, .table-column-delete i", (e:Event, el:HTMLElement, info:ObjectInfo<Vertex>) => {
        consume(e)
        dialogs.show({
            id: "dlgConfirm",
            data: {
                msg: "Delete column '" + info.obj.data.name + "'"
            },
            onOK: (data:Record<string, any>) => {
                if (isPort(info.obj)) {
                    toolkit.removePort(info.obj.getParent(), info.id)
                }
            },
            onOpen:(el:Element) => {
                console.dir(el)
            }
        })
    })
   //
   //  // add new column to table
    renderer.bindModelEvent(EVENT_TAP, ".new-column, .new-column i", (e:Event, el:HTMLElement, info:ObjectInfo<Vertex>) => {
        consume(e)
        dialogs.show({
            id: "dlgColumnEdit",
            title: "Column Details",
            onOK: (data:Record<string, any>) => {
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
   //
   //  // delete a table or view
    renderer.bindModelEvent(EVENT_TAP, ".delete, .view-delete", (e:Event, el:HTMLElement, info:ObjectInfo<Vertex>) => {
        consume(e)
        dialogs.show({
            id: "dlgConfirm",
            data: {
                msg: "Delete '" + info.id
            },
            onOK: (data:any) => {
                toolkit.removeNode(info.id);
            }
        });

    });
   //
   //  // edit a view's query
    renderer.bindModelEvent(EVENT_TAP, ".view .view-edit i", (e:Event, el:HTMLElement, info:ObjectInfo<Vertex>) => {
        consume(e)
        dialogs.show({
            id: "dlgViewQuery",
            data: info.obj.data,
            onOK: (data:Record<string, any>) => {
                // update data, and UI (which works only if you use the Toolkit's default template engine, Rotors.
                toolkit.updateNode(info.obj, data)
            }
        });
    });

    // change a view or table's name
    renderer.bindModelEvent(EVENT_TAP, ".edit-name", (e:Event, el:HTMLElement, info:ObjectInfo<Vertex>) => {
        consume(e)
        dialogs.show({
            id: "dlgName",
            data: info.obj.data,
            title: "Edit " + info.obj.data.type + " name",
            onOK: (data:Record<string, any>) => {
                if (data.name && data.name.length > 2) {
                    // if name is at least 2 chars long, update the underlying data and
                    // update the UI.
                    toolkit.updateNode(info.obj, data)
                }
            }
        })
    })
   //
   //  // edit an edge's detail. If the edge was brand new and the user presses cancel, delete the edge.
    const _editEdge = (edge:Edge, isNew?:boolean) => {
        dialogs.show({
            id: "dlgRelationshipType",
            data: edge.data,
            onOK: (data:Record<string, any>) => {
                // update the type in the edge's data model...it will be re-rendered.
                // `type` is set in the radio buttons in the dialog template.
                toolkit.updateEdge(edge, data);
            },
            onCancel: () => {
                // if the user pressed cancel on a new edge, delete the edge.
                if (isNew) {
                    toolkit.removeEdge(edge);
                }
            }
        })
    }
   //
   //  // edit a column's details
    renderer.bindModelEvent(EVENT_TAP, ".table-column-edit i", (e:Event, el:HTMLElement, info:ObjectInfo<Vertex>) => {
        consume(e)
        dialogs.show({
            id: "dlgColumnEdit",
            title: "Column Details",
            data: info.obj.data,
            onOK: (data:Record<string, any>) => {
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

    // pan mode/select mode
    renderer.on(controls, EVENT_TAP, "[mode]",  (e:Event, el:HTMLElement) => {
        renderer.setMode(el.getAttribute("mode"));
    })

    // on home button click, zoom content to fit.
    renderer.on(controls, EVENT_TAP, "[reset]",  () => {
        toolkit.clearSelection()
        renderer.zoomToFit()
    })

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

   newSyntaxHighlighter(toolkit, ".jtk-demo-dataset", 2)

    // Load the data.
    toolkit.load({
        url: "../data/schema-1.json"
    });




});

