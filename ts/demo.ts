import {
    consume,
    EVENT_DBL_TAP,
    EVENT_SURFACE_MODE_CHANGED,
    EVENT_TAP,
    EVENT_CLICK,
    SurfaceMode,
    EVENT_CANVAS_CLICK
} from "@jsplumbtoolkit/browser-ui"

import {
    ready,
    newInstance
} from "@jsplumbtoolkit/browser-ui-vanilla"

import {
    LabelOverlay,
    DEFAULT,
    AnchorLocations
} from "@jsplumb/core"

import { newInstance as newDialogManager } from "@jsplumbtoolkit/dialogs"
import {
    Edge,
    isPort,
    Vertex,
    ObjectInfo,
    EVENT_UNDOREDO_UPDATE,
    UndoRedoUpdateParams,
    uuid, ObjectData
} from "@jsplumbtoolkit/core"
import {createSurfaceManager} from "@jsplumbtoolkit/drop"
import { newInstance as newSyntaxHighlighter } from "@jsplumb/json-syntax-highlighter"
import {StateMachineConnector} from "@jsplumb/connector-bezier"
import {SpringLayout} from "@jsplumbtoolkit/layout-spring"
import {MiniviewPlugin} from "@jsplumbtoolkit/browser-ui-plugin-miniview"
import {LassoPlugin} from "@jsplumbtoolkit/browser-ui-plugin-lasso"

const COMMON = "common"
const TABLE = "table"
const VIEW = "view"
const ONE_TO_ONE = "1:1"
const ONE_TO_N = "1:N"
const N_TO_M = "N:M"

ready(() => {

// ------------------------ toolkit setup ------------------------------------

    // get the various dom elements
    const mainElement = document.querySelector("#jtk-demo-dbase"),
        canvasElement = mainElement.querySelector(".jtk-demo-canvas"),
        miniviewElement = mainElement.querySelector(".miniview"),
        nodePalette = mainElement.querySelector(".node-palette"),
        controls = mainElement.querySelector(".controls");

    function showEdgeEditDialog(data:ObjectData, continueFunction:Function, abortFunction?:Function) {

    }

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
        edgeFactory:function(type:string, data:any, continueCallback:Function, abortCallback:Function) {
            showEdgeEditDialog(data, continueCallback, abortCallback)
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
                [TABLE]: {
                    templateId: "tmplTable"
                },
                [VIEW]: {
                    templateId: "tmplView"
                }
            },
            // Three edge types  - '1:1', '1:N' and 'N:M',
            // sharing  a common parent, in which the connector type, anchors
            // and appearance is defined.
            edges: {
                [COMMON]: {
                    detachable:false,
                    anchor: [ AnchorLocations.Left, AnchorLocations.Right ], // anchors for the endpoints
                    connector: StateMachineConnector.type,  //  StateMachine connector type
                    cssClass:"common-edge",
                    events: {
                        [EVENT_DBL_TAP]: (params:{edge:Edge}) => {
                            showEdgeEditDialog(params.edge.data, (d:ObjectData) => {
                                toolkit.updateEdge(params.edge, d);
                            })
                        }
                    },
                    overlays: [
                        {
                            type: LabelOverlay.type,
                            options:{
                                cssClass: "delete-relationship",
                                label: "x",
                                events: {
                                    [EVENT_CLICK]: (params:{edge:Edge}) => {
                                        toolkit.removeEdge(params.edge)
                                    }
                                }
                            }
                        }
                    ]
                },
                // each edge type has its own overlays.
                [ONE_TO_ONE]: {
                    parent: COMMON,
                    overlays: [
                        { type:LabelOverlay.type, options:{ label: "1", location: 0.1 }},
                        { type:LabelOverlay.type, options:{ label: "1", location: 0.9 }}
                    ]
                },
                [ONE_TO_N]: {
                    parent: COMMON,
                    overlays: [
                        { type:LabelOverlay.type, options:{ label: "1", location: 0.1 }},
                        { type:LabelOverlay.type, options:{ label: "N", location: 0.9 }}
                    ]
                },
                [N_TO_M]: {
                    parent: COMMON,
                    overlays: [
                        { type:LabelOverlay.type, options:{ label: "N", location: 0.1 }},
                        { type:LabelOverlay.type, options:{ label: "M", location: 0.9 }}
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
                [DEFAULT]: {
                    templateId: "tmplColumn",
                    paintStyle: { fill: "#f76258" },		// the endpoint's appearance
                    hoverPaintStyle: { fill: "#434343" }, // appearance when mouse hovering on endpoint or connection
                    edgeType: COMMON, // the type of edge for connections from this port type
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
            [EVENT_CANVAS_CLICK]: (e:Event) => {
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
    renderer.bind(EVENT_SURFACE_MODE_CHANGED, (mode:string) => {
        renderer.removeClass(controls.querySelectorAll("[mode]"), "selected-mode")
        renderer.addClass(controls.querySelector("[mode='" + mode + "']"), "selected-mode")
    })
   //
    toolkit.bind(EVENT_UNDOREDO_UPDATE, (state:UndoRedoUpdateParams) => {
        controls.setAttribute("can-undo", state.undoCount > 0 ? "true" : "false")
        controls.setAttribute("can-redo", state.redoCount > 0 ? "true" : "false")
    })

    renderer.on(controls, EVENT_TAP, "[undo]",  () => {
        toolkit.undo()
    })

    renderer.on(controls, EVENT_TAP, "[redo]", () => {
        toolkit.redo()
    })

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
        renderer.setMode(el.getAttribute("mode") as SurfaceMode)
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
        url: "./schema-1.json"
    });




});

