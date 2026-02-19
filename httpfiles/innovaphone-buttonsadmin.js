/// <reference path="../../web1/lib1/innovaphone.lib1.js" />
/// <reference path="../../web1/appwebsocket/innovaphone.appwebsocket.Connection.js" />
/// <reference path="../../web1/ui1.lib/innovaphone.ui1.lib.js" />

var innovaphone = innovaphone || {};
innovaphone.buttonsAdmin = innovaphone.buttonsAdmin || function (start, args) {
    this.createNode("body");
    var that = this;

    var ownsip = "";

    var colorSchemes = {
        dark: {
            "--bg": "#191919",
            "--button": "#303030",
            "--modal": "#3f3f3f",
            "--text-standard": "#f2f5f6",

            "--field-bg": "#4a4a4a",
            "--field-text": "#f2f5f6",
            "--field-border": "#5a5a5a",
            "--field-focus": "#4a90ff"
        },

        light: {
            "--bg": "#ffffff",
            "--button": "#e0e0e0",
            "--modal": "#d0d0d0",
            "--text-standard": "#4a4a49",

            "--field-bg": "#ffffff",
            "--field-text": "#4a4a49",
            "--field-border": "#c8c8c8",
            "--field-focus": "#4a90ff"
        }
    };

    var loaded = false;
    var schemes = new innovaphone.ui1.CssVariables(colorSchemes, start.scheme);
    start.onschemechanged.attach(function () { schemes.activate(start.scheme) });

    var texts = new innovaphone.lib1.Languages(innovaphone.buttonsTexts, start.lang);
    start.onlangchanged.attach(function () { texts.activate(start.lang) });

    var app = new innovaphone.appwebsocket.Connection(start.url, start.name);
    app.checkBuild = true;
    app.onconnected = app_connected;
    app.onmessage = app_message;
    var dt = null;
    var pendingActionRows = [];
    var actionsDone = false;
    var actionsRenderTimer = null;
    var actionsById = {};
    var ICONS = "icons.svg#";
    var onlineIds = {};
    var waitingQueueSelect = null;
    var activeQueueList = null;
    var rccWaitingQueueSelect = null;

    var presenceselect = null;
    var presenceactions = null;
    var buttons = null;
    var choosenaction = null;
    var choosendevice = null;
    var choosentype = null;
    var optionopen = false;
    var presenceselect = null;

    var main = new innovaphone.ui1.Div("align: center", null, "bodydiv");
    var addButtonDiv = new innovaphone.ui1.Div("display:flex; justify-content:center; align-items:center; gap:10px; margin:auto; width:75%;", null, "btn_menu");

    that.add(main);
    var appView = main.add(new innovaphone.ui1.Div(
        "display:flex; flex-direction:column; height:100%;",
        null,
        "app-view"
    ));
    appView.container.classList.remove("is-ready");

    var modalOverlay = new innovaphone.ui1.Div(null, null, "overlay");
    modalOverlay.container.style.display = "none";
    modalOverlay.container.style.position = "fixed";
    modalOverlay.container.style.left = "0";
    modalOverlay.container.style.top = "0";
    modalOverlay.container.style.right = "0";
    modalOverlay.container.style.bottom = "0";
    modalOverlay.container.style.background = "rgba(0,0,0,0.45)";
    modalOverlay.container.style.zIndex = "999";
    modalOverlay.container.style.pointerEvents = "auto";


    function openModal(div) {
        modalOverlay.container.style.display = "block";
        div.container.style.display = "flex";
        div.container.style.zIndex = "1000";
        div.container.onclick = function (e) { if (e) e.stopPropagation(); };

    }

    function closeAllModals() {
        AddDeviceDiv && (AddDeviceDiv.container.style.display = "none");
        QueueManageDiv && (QueueManageDiv.container.style.display = "none");
        optionsdeviceDiv && (optionsdeviceDiv.container.style.display = "none");
        ShowDevicesDiv && (ShowDevicesDiv.container.style.display = "none");
        modalOverlay.container.style.display = "none";
    }

    modalOverlay.container.onclick = function (e) {
        if (e) e.stopPropagation();

    };
    main.add(modalOverlay);

    const addDevices_Button = new innovaphone.ui1.Div("margin: 10px", texts.text("add_Device"), "button");
    addDevices_Button.container.addEventListener("click", function () {
        openModal(AddDeviceDiv);
    });
    const addQueue_Button = new innovaphone.ui1.Div("margin: 10px", texts.text("add_Queue"), "button");
    addQueue_Button.container.addEventListener("click", function () {
        openModal(QueueManageDiv);
    });
    const showDevices_Button = new innovaphone.ui1.Div("margin: 10px", texts.text("connectedDevices"), "button");
    showDevices_Button.container.addEventListener("click", function () {
        openModal(ShowDevicesDiv);
    });

    addButtonDiv.add(addDevices_Button);
    addButtonDiv.add(addQueue_Button);
    addButtonDiv.add(showDevices_Button);
    appView.add(addButtonDiv);

    const searchOptionsDiv = new innovaphone.ui1.Div("display:flex; justify-content:flex-end; width:75%; margin:auto; padding:6px 12px; box-sizing:border-box;", null, "search-options");

    const searchInputDiv = searchOptionsDiv.add(new innovaphone.ui1.Div("min-width:170px; max-width:420px; width:28%;", null, "search-input-wrap"));

    const searchInput = searchInputDiv.add(new innovaphone.ui1.Input(null, null, texts.text("searchitem"), null, "text", "inputfield"));
    searchInput.setAttribute("id", "search-input");

    // Add Device
    const AddDeviceDiv = new innovaphone.ui1.Div(null, texts.text("addnewDevice"), "modalDiv");
    AddDeviceDiv.container.style.display = "none";
    AddDeviceDiv.container.style.position = "fixed";
    AddDeviceDiv.container.style.left = "50%";
    AddDeviceDiv.container.style.top = "20%";
    AddDeviceDiv.container.style.transform = "translateX(-50%)";
    AddDeviceDiv.container.style.zIndex = "1000";
    AddDeviceDiv.container.style.minWidth = "320px";
    AddDeviceDiv.container.style.maxWidth = "520px";
    AddDeviceDiv.container.style.boxShadow = "0 10px 40px rgba(0,0,0,0.35)";
    AddDeviceDiv.container.style.padding = "14px";
    AddDeviceDiv.container.style.backgroundColor = "var(--modal)";
    AddDeviceDiv.container.style.borderRadius = "12px";
    AddDeviceDiv.container.style.flexDirection = "column";
    AddDeviceDiv.container.style.gap = "12px";

    const AddDeviceLabel = new innovaphone.ui1.Div(null, null, null);
    const adddevice = new innovaphone.ui1.Node("span", null, null, null);
    AddDeviceLabel.add(adddevice)

    const devicetypesselect = new innovaphone.ui1.Node("select", null, null, "inputfield");
    const devicestypes = [
        { id: 1, label: texts.text("button") },
        { id: 2, label: texts.text("windowsensor") },
        { id: 3, label: texts.text("motionsensor") },
        { id: 4, label: texts.text("dialinnumber") },
        { id: 5, label: texts.text("hotkey") },
        { id: 90, label: texts.text("syslog") }
    ];
    devicestypes.forEach(type => {
        const option = new innovaphone.ui1.Node("option", null, type.label, null);
        option.setAttribute("value", type.id);
        devicetypesselect.add(option);
    });

    const addDevice_Mac_Input = new innovaphone.ui1.Input(null, null, "Serialnumber", null, "text", "inputfield");

    devicetypesselect.container.addEventListener('change', () => {
        switch (devicetypesselect.container.value) {
            case '1':
                addDevice_Mac_Input.container.style.display = 'flex';
                addDevice_Mac_Input.container.setAttribute('Placeholder', 'Serialnumber');
                break;
            case '2':
                addDevice_Mac_Input.container.style.display = 'flex';
                addDevice_Mac_Input.container.setAttribute('Placeholder', 'Serialnumber');
                break;
            case '3':
                addDevice_Mac_Input.container.style.display = 'flex';
                addDevice_Mac_Input.container.setAttribute('Placeholder', 'Serialnumber');
                break;
            case '4':
                addDevice_Mac_Input.container.style.display = 'flex';
                addDevice_Mac_Input.container.setAttribute('Placeholder', 'DialIn Number');
                break;
            case '5':
                addDevice_Mac_Input.container.style.display = 'flex';
                addDevice_Mac_Input.container.setAttribute('Placeholder', 'Hotkeynumber');
                break;
            case '90':
                addDevice_Mac_Input.container.style.display = 'none';
                break;
            default:
                break;
        }
    });

    const addDevice_submitButton = new innovaphone.ui1.Div(null, texts.text("submit"), "button");
    addDevice_submitButton.container.onclick = function () {
        const macValue = addDevice_Mac_Input.getValue();
        const macClean = macValue.toLowerCase().replace(/:/g, '');
        app.send({
            mt: "SqlInsertBackend",
            api: "admin",
            src: "add-device",
            statement: "add-device",
            args: {
                id: macClean,
                mac: macClean,
                dtype: devicetypesselect.container.value
            }
        });
    };

    const addDevice_closebutton = new innovaphone.ui1.Div(null, texts.text("close"), "button");
    addDevice_closebutton.container.onclick = closeAllModals;

    AddDeviceDiv.add(AddDeviceLabel);
    AddDeviceDiv.add(devicetypesselect);
    AddDeviceDiv.add(addDevice_Mac_Input);
    AddDeviceDiv.add(addDevice_submitButton);
    AddDeviceDiv.add(addDevice_closebutton);

    main.add(AddDeviceDiv);

    // Queue Management
    const QueueManageDiv = new innovaphone.ui1.Div("text-align: center;", texts.text("add_Queue"), "modalDiv");
    QueueManageDiv.container.style.position = "fixed";
    QueueManageDiv.container.style.left = "50%";
    QueueManageDiv.container.style.top = "20%";
    QueueManageDiv.container.style.transform = "translateX(-50%)";
    QueueManageDiv.container.style.zIndex = "1000";
    QueueManageDiv.container.style.minWidth = "320px";
    QueueManageDiv.container.style.width = "calc(100vw - 40px)";
    QueueManageDiv.container.style.maxWidth = "780px";
    QueueManageDiv.container.style.boxShadow = "0 10px 40px rgba(0,0,0,0.35)";
    QueueManageDiv.container.style.padding = "14px";
    QueueManageDiv.container.style.backgroundColor = "var(--modal)";
    QueueManageDiv.container.style.borderRadius = "12px";
    QueueManageDiv.container.style.display = "none";
    QueueManageDiv.container.style.flexDirection = "column";
    QueueManageDiv.container.style.gap = "12px";

    const queueContent = QueueManageDiv.add(
        new innovaphone.ui1.Div("flex:1 1 auto; overflow-y:auto; padding-right:6px;", null, null)
    );

    activeQueueList = queueContent.add(new innovaphone.ui1.Div());
    //Add Queue
    const AddQueueDiv = QueueManageDiv.add(new innovaphone.ui1.Div(null, texts.text("addnewQueue"), "optionsDiv"));
    const AddQueueLabel = new innovaphone.ui1.Div(null, null, null);
    const addqueue = new innovaphone.ui1.Node("span", null, null, null);
    AddQueueLabel.add(addqueue)
    waitingQueueSelect = new innovaphone.ui1.DropDown(null, null, null, null, "waiting-select");
    waitingQueueSelect.container.style.width = "100%";
    AddQueueDiv.add(waitingQueueSelect);
    //const addQueue_Name_Input = new innovaphone.ui1.Input(null, null, "WaitingQueue Longname", null, "text", "inputfield");
    const addQueue_Pbx_Input = new innovaphone.ui1.Input(null, null, "PBX Name", null, "text", "inputfield");

    const addQueue_submitButton = new innovaphone.ui1.Div(null, texts.text("submit"), "button");
    addQueue_submitButton.container.onclick = function () {
        const queuename = waitingQueueSelect.container.value;
        //const queuename = addQueue_Name_Input.getValue();
        const queuepbx = addQueue_Pbx_Input.getValue();
        if (!queuename) return;
        app.send({
            mt: "SqlInsert",
            src: "add-queue",
            statement: "add-queue",
            args: {
                queue: queuename,
                pbx: queuepbx
            }
        });
    };

    const addQueue_closebutton = new innovaphone.ui1.Div(null, texts.text("close"), "button");
    addQueue_closebutton.container.onclick = closeAllModals;

    AddQueueDiv.add(AddQueueLabel);
    //AddQueueDiv.add(addQueue_Name_Input);
    AddQueueDiv.add(addQueue_Pbx_Input);
    AddQueueDiv.add(addQueue_submitButton);
    AddQueueDiv.add(addQueue_closebutton);


    main.add(QueueManageDiv);

    // Show Devices
    const ShowDevicesDiv = new innovaphone.ui1.Div(null, texts.text("connectedDevices"), "devices-container");
    const ShowDevicesContent = ShowDevicesDiv.add(
        new innovaphone.ui1.Div("flex:1 1 auto; overflow-y:auto; padding-right:6px;", null, null)
    );
    const ShowDevicesList = ShowDevicesContent.add(new innovaphone.ui1.Div(null, null, null));
    ShowDevicesList.container.innerHTML = "";
    ShowDevicesDiv.container.style.maxHeight = "80vh";
    ShowDevicesDiv.container.style.overflow = "hidden";
    ShowDevicesDiv.container.style.display = "none";
    ShowDevicesDiv.container.style.position = "fixed";
    ShowDevicesDiv.container.style.left = "50%";
    ShowDevicesDiv.container.style.top = "20%";
    ShowDevicesDiv.container.style.transform = "translateX(-50%)";
    ShowDevicesDiv.container.style.zIndex = "1000";
    ShowDevicesDiv.container.style.minWidth = "320px";
    ShowDevicesDiv.container.style.maxWidth = "780px";
    ShowDevicesDiv.container.style.padding = "14px";
    ShowDevicesDiv.container.style.backgroundColor = "var(--modal)";
    ShowDevicesDiv.container.style.borderRadius = "12px";
    ShowDevicesDiv.container.style.flexDirection = "column";
    ShowDevicesDiv.container.style.gap = "12px";




    const ShowDevices_closebutton = new innovaphone.ui1.Div(null, texts.text("close"), "button");
    ShowDevices_closebutton.container.onclick = closeAllModals;

    ShowDevicesDiv.add(ShowDevices_closebutton);

    main.add(ShowDevicesDiv);

    // Options

    const optionsdeviceDiv = new innovaphone.ui1.Div(null, null, "modalDiv");
    const optionsHeader = optionsdeviceDiv.add(new innovaphone.ui1.Div("font-weight:600;", null, null));
    optionsdeviceDiv.container.style.position = "fixed";
    optionsdeviceDiv.container.style.left = "50%";
    optionsdeviceDiv.container.style.top = "15%";
    optionsdeviceDiv.container.style.transform = "translateX(-50%)";
    optionsdeviceDiv.container.style.zIndex = "1000";
    optionsdeviceDiv.container.style.minWidth = "420px";
    optionsdeviceDiv.container.style.maxWidth = "720px";
    optionsdeviceDiv.container.style.boxShadow = "0 10px 40px rgba(0,0,0,0.35)";
    optionsdeviceDiv.container.style.padding = "14px";
    optionsdeviceDiv.container.style.backgroundColor = "var(--modal)";
    optionsdeviceDiv.container.style.borderRadius = "12px";
    optionsdeviceDiv.container.style.display = "none";
    optionsdeviceDiv.container.style.flexDirection = "column";
    optionsdeviceDiv.container.style.gap = "12px";
    optionsdeviceDiv.container.style.maxHeight = "80vh";
    optionsdeviceDiv.container.style.overflow = "hidden";
    optionsdeviceDiv.container.style.flexDirection = "column";

    const optionsContent = optionsdeviceDiv.add(
        new innovaphone.ui1.Div("flex:1 1 auto; overflow-y:auto; padding-right:6px;", null, null)
    );
    optionsContent.container.style.display = "flex";
    optionsContent.container.style.flexDirection = "column";
    optionsContent.container.style.gap = "12px";
    optionsContent.container.style.overflowX = "hidden";

    const optionsdeviceLabel = new innovaphone.ui1.Div(null, null, null);
    const optionsdevice = new innovaphone.ui1.Node("span", null, null, null);
    optionsdeviceLabel.add(optionsdevice)

    const buttonsselect = new innovaphone.ui1.Node("select", null, null, "inputfield");
    buttons = [
        { id: 1, label: "1-Click" },
        { id: 2, label: "2-Click" },
        { id: 3, label: "3-Click" },
        { id: 4, label: "Long" },
        { id: 5, label: "Offen" },
        { id: 6, label: "Geschlossen" }
    ]
    buttons.forEach(button => {
        const option = new innovaphone.ui1.Node("option", null, button.label, null);
        option.setAttribute("value", button.id);
        buttonsselect.add(option);
    });

    const windowselect = new innovaphone.ui1.Node("select", null, null, "inputfield");
    const windows = [
        { id: 0, label: texts.text("closed") },
        { id: 1, label: texts.text("open") }
    ];
    windows.forEach(window => {
        const option = new innovaphone.ui1.Node("option", null, window.label, null);
        option.setAttribute("value", window.id);
        windowselect.add(option);
    });

    const motionselect = new innovaphone.ui1.Node("select", null, null, "inputfield");
    const motions = [
        { id: 0, label: texts.text("nomotion") },
        { id: 1, label: texts.text("motion") }
    ];
    motions.forEach(motion => {
        const option = new innovaphone.ui1.Node("option", null, motion.label, null);
        option.setAttribute("value", motion.id);
        motionselect.add(option);
    });

    const actionsselect = new innovaphone.ui1.Node("select", null, null, "inputfield");
    const actions = ["chat", "notify", "chat+notify", "phonemessage", "working", "presence", "connect", "call"];
    actions.forEach(action => {
        const option = new innovaphone.ui1.Node("option", null, action, null);
        option.setAttribute("value", action);
        actionsselect.add(option);
    });
    actionsselect.container.onchange = function () {
        if (actionsselect.container.value === "working") {
            destinationInput.container.style.display = "none";
            destinationText.container.style.display = "none";
            presenceselect.container.style.display = "none";
            workingselect.container.style.display = "block";
            rccWaitingQueueSelect.container.style.display = "none";
            destinationInput.container.style.display = "block";
            destinationText.setValue("-");
        }
        else if (actionsselect.container.value === "presence") {
            destinationInput.container.style.display = "none";
            destinationText.container.style.display = "none";
            workingselect.container.style.display = "none";
            presenceselect.container.style.display = "block";
            rccWaitingQueueSelect.container.style.display = "none";
            destinationInput.container.style.display = "block";
            destinationText.setValue("-");
        }
        else if (actionsselect.container.value === "call") {
            destinationInput.container.style.display = "none";
            destinationText.container.style.display = "none";
            workingselect.container.style.display = "none";
            presenceselect.container.style.display = "none";
            rccWaitingQueueSelect.container.style.display = "block";
            destinationText.setValue("-");
        }
        else {
            destinationInput.container.style.display = "block";
            destinationText.container.style.display = "block";
            workingselect.container.style.display = "none";
            presenceselect.container.style.display = "none";
            rccWaitingQueueSelect.container.style.display = "none";
        }
    }
    const loggingFilterInput = new innovaphone.ui1.Input(null, null, "Message Filter", null, "text", "inputfield");
    const destinationInput = new innovaphone.ui1.Input(null, null, "SIP-Name", null, "text", "inputfield");
    const destinationText = new innovaphone.ui1.Input(null, null, "Text", null, "text", "inputfield");
    const workingselect = new innovaphone.ui1.Node("select", null, null, "inputfield");
    const workingactions = ["start", "stop", "toggle"];
    workingactions.forEach(action => {
        const option = new innovaphone.ui1.Node("option", null, action, null);
        option.setAttribute("value", action);
        workingselect.add(option);
    });
    workingselect.container.style.display = "none";

    presenceselect = new innovaphone.ui1.Node("select", null, null, "inputfield");
    presenceactions = [
        { id: 1, label: texts.text("online") },
        { id: 2, label: texts.text("away") },
        { id: 3, label: texts.text("busy") },
        { id: 4, label: texts.text("dnd") }
    ];
    presenceactions.forEach(action => {
        const option = new innovaphone.ui1.Node("option", null, action.label, null);
        option.setAttribute("value", action.id);
        presenceselect.add(option);
    });
    presenceselect.container.style.display = "none";

    rccWaitingQueueSelect = new innovaphone.ui1.DropDown(null, null, null, null, "rcc-select");
    rccWaitingQueueSelect.container.style.display = "none";

    const submitbutton = new innovaphone.ui1.Div(null, texts.text("submit"), "button");

    submitbutton.container.onclick = function () {
        //Button Submit
        if (choosentype == 1) {
            if (actionsselect.container.value === "working") {
                app.send({ mt: "SqlExec", src: "set-action", statement: "set-action", args: { actionid: "" + choosenaction + "", button: "" + buttonsselect.container.value + "", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + workingselect.container.value + "" } });
            }
            else if (actionsselect.container.value === "presence") {
                app.send({ mt: "SqlExec", src: "set-action", statement: "set-action", args: { actionid: "" + choosenaction + "", button: "" + buttonsselect.container.value + "", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + presenceselect.container.value + "" } });
            }
            else if (actionsselect.container.value === "call") {
                app.send({ mt: "SqlExec", src: "set-action", statement: "set-action", args: { actionid: "" + choosenaction + "", button: "" + buttonsselect.container.value + "", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + rccWaitingQueueSelect.container.value + "" } });
            }
            else {
                app.send({ mt: "SqlExec", src: "set-action", statement: "set-action", args: { actionid: "" + choosenaction + "", button: "" + buttonsselect.container.value + "", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + destinationText.getValue() + "" } });
            }
        }
        // Window Submit
        if (choosentype == 2) {
            if (actionsselect.container.value === "working") {
                app.send({ mt: "SqlExec", src: "set-action", statement: "set-action", args: { actionid: "" + choosenaction + "", button: "" + windowselect.container.value + "", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + workingselect.container.value + "" } });
            }
            else if (actionsselect.container.value === "presence") {
                app.send({ mt: "SqlExec", src: "set-action", statement: "set-action", args: { actionid: "" + choosenaction + "", button: "" + windowselect.container.value + "", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + presenceselect.container.value + "" } });
            }
            else if (actionsselect.container.value === "call") {
                app.send({ mt: "SqlExec", src: "set-action", statement: "set-action", args: { actionid: "" + choosenaction + "", button: "" + windowselect.container.value + "", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + rccWaitingQueueSelect.container.value + "" } });
            }
            else {
                app.send({ mt: "SqlExec", src: "set-action", statement: "set-action", args: { actionid: "" + choosenaction + "", button: "" + windowselect.container.value + "", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + destinationText.getValue() + "" } });
            }
        }
        // Motion Submit
        if (choosentype == 3) {
            if (actionsselect.container.value === "working") {
                app.send({ mt: "SqlExec", src: "set-action", statement: "set-action", args: { actionid: "" + choosenaction + "", button: "" + motionselect.container.value + "", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + workingselect.container.value + "" } });
            }
            else if (actionsselect.container.value === "presence") {
                app.send({ mt: "SqlExec", src: "set-action", statement: "set-action", args: { actionid: "" + choosenaction + "", button: "" + motionselect.container.value + "", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + presenceselect.container.value + "" } });
            }
            else if (actionsselect.container.value === "call") {
                app.send({ mt: "SqlExec", src: "set-action", statement: "set-action", args: { actionid: "" + choosenaction + "", button: "" + motionselect.container.value + "", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + rccWaitingQueueSelect.container.value + "" } });
            }
            else {
                app.send({ mt: "SqlExec", src: "set-action", statement: "set-action", args: { actionid: "" + choosenaction + "", button: "" + motionselect.container.value + "", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + destinationText.getValue() + "" } });
            }
        }
        if (choosentype == 4) {
            if (actionsselect.container.value === "working") {
                app.send({ mt: "SqlExec", src: "set-action-phone", statement: "set-action-phone", args: { actionid: "" + choosenaction + "", button: "-", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + workingselect.container.value + "" } });
            }
            else if (actionsselect.container.value === "presence") {
                app.send({ mt: "SqlExec", src: "set-action-phone", statement: "set-action-phone", args: { actionid: "" + choosenaction + "", button: "-", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + presenceselect.container.value + "" } });
            }
            else if (actionsselect.container.value === "call") {
                app.send({ mt: "SqlExec", src: "set-action-phone", statement: "set-action-phone", args: { actionid: "" + choosenaction + "", button: "-", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + rccWaitingQueueSelect.container.value + "" } });
            }
            else {
                app.send({ mt: "SqlExec", src: "set-action-phone", statement: "set-action-phone", args: { actionid: "" + choosenaction + "", button: "-", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + destinationText.getValue() + "" } });
            }
        }
        if (choosentype == 5) {
            if (actionsselect.container.value === "working") {
                app.send({ mt: "SqlExec", src: "set-action-hotkey", statement: "set-action-hotkey", args: { actionid: "" + choosenaction + "", button: "-", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + workingselect.container.value + "" } });
            }
            else if (actionsselect.container.value === "presence") {
                app.send({ mt: "SqlExec", src: "set-action-hotkey", statement: "set-action-hotkey", args: { actionid: "" + choosenaction + "", button: "-", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + presenceselect.container.value + "" } });
            }
            else if (actionsselect.container.value === "call") {
                app.send({ mt: "SqlExec", src: "set-action-hotkey", statement: "set-action-hotkey", args: { actionid: "" + choosenaction + "", button: "-", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + rccWaitingQueueSelect.container.value + "" } });
            }
            else {
                app.send({ mt: "SqlExec", src: "set-action-hotkey", statement: "set-action-hotkey", args: { actionid: "" + choosenaction + "", button: "-", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + destinationText.getValue() + "" } });
            }
        }
        if (choosentype == 90) {
            if (actionsselect.container.value === "working") {
                app.send({ mt: "SqlExecBackend", src: "set-action-logging", api: "admin", statement: "set-action-logging", args: { actionid: "" + choosenaction + "", msgfilter: "" + loggingFilterInput.container.value + "", option: "" + actionsselect.container.value + "", button: "-", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + workingselect.container.value + "" } });
            }
            else if (actionsselect.container.value === "presence") {
                app.send({ mt: "SqlExecBackend", src: "set-action-logging", api: "admin", statement: "set-action-logging", args: { actionid: "" + choosenaction + "", msgfilter: "" + loggingFilterInput.container.value + "", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + presenceselect.container.value + "" } });
            }
            else if (actionsselect.container.value === "call") {
                app.send({ mt: "SqlExecBackend", src: "set-action-logging", api: "admin", statement: "set-action-logging", args: { actionid: "" + choosenaction + "", msgfilter: "" + loggingFilterInput.container.value + "", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + rccWaitingQueueSelect.container.value + "" } });
            }
            else {
                app.send({ mt: "SqlExecBackend", src: "set-action-logging", api: "admin", statement: "set-action-logging", args: { actionid: "" + choosenaction + "", msgfilter: "" + loggingFilterInput.container.value + "", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + destinationText.getValue() + "" } });
            }
        }
    };

    const closebutton = new innovaphone.ui1.Div(null, texts.text("close"), "button");
    closebutton.container.onclick = function () {
        closeAllModals();
        optionopen = false;
    };

    optionsContent.add(optionsdeviceLabel);
    optionsContent.add(buttonsselect);
    optionsContent.add(windowselect);
    optionsContent.add(motionselect);
    optionsContent.add(actionsselect);
    optionsContent.add(loggingFilterInput);
    optionsContent.add(destinationInput);
    optionsContent.add(destinationText);
    optionsContent.add(workingselect);
    optionsContent.add(presenceselect);
    optionsContent.add(rccWaitingQueueSelect);
    optionsdeviceDiv.add(submitbutton);
    optionsdeviceDiv.add(closebutton);

    main.add(optionsdeviceDiv);

    /** Only for Testing of Location
    // Creating the rectangle with a horizontal line in the middle
    const rectangleContainer = new innovaphone.ui1.Div(null, null, "rectangle-container");
    rectangleContainer.container.style.width = "500px";
    rectangleContainer.container.style.height = "500px";
    rectangleContainer.container.style.border = "2px solid black";
    rectangleContainer.container.style.position = "relative";

    // Creating the horizontal line
    const horizontalLine = new innovaphone.ui1.Div(null, null, "horizontal-line");
    horizontalLine.container.style.position = "absolute";
    horizontalLine.container.style.top = "50%";
    horizontalLine.container.style.left = "0";
    horizontalLine.container.style.width = "100%";
    horizontalLine.container.style.height = "2px";
    horizontalLine.container.style.backgroundColor = "black";

    // Adding the horizontal line to the rectangle container
    rectangleContainer.add(horizontalLine);

    // Adding the rectangle container to the main Div
    main.add(rectangleContainer);

    // Create a red circle for the upper half
    const upperCircle = new innovaphone.ui1.Div(null, null, "upper-circle");
    upperCircle.container.style.position = "absolute";
    upperCircle.container.style.top = "25%"; // Middle of the upper half
    upperCircle.container.style.left = "50%";
    upperCircle.container.style.transform = "translate(-50%, -50%)";
    upperCircle.container.style.width = "30px";
    upperCircle.container.style.height = "30px";
    upperCircle.container.style.backgroundColor = "red";
    upperCircle.container.style.borderRadius = "50%";
    upperCircle.container.style.display = "none"; // Initially hidden

    // Create a red circle for the lower half
    const lowerCircle = new innovaphone.ui1.Div(null, null, "lower-circle");
    lowerCircle.container.style.position = "absolute";
    lowerCircle.container.style.top = "75%"; // Middle of the lower half
    lowerCircle.container.style.left = "50%";
    lowerCircle.container.style.transform = "translate(-50%, -50%)";
    lowerCircle.container.style.width = "30px";
    lowerCircle.container.style.height = "30px";
    lowerCircle.container.style.backgroundColor = "red";
    lowerCircle.container.style.borderRadius = "50%";
    lowerCircle.container.style.display = "none"; // Initially hidden

    // Adding circles to the rectangle container
    rectangleContainer.add(upperCircle);
    rectangleContainer.add(lowerCircle);

    // Adding the rectangle container to the main Div
    main.add(rectangleContainer);
    **/


    function reloadQueues() {
        if (activeQueueList) activeQueueList.container.innerHTML = "";

        if (waitingQueueSelect) {
            waitingQueueSelect.clearOptions();
            waitingQueueSelect.addOption("", null, "-");
        }

        if (rccWaitingQueueSelect) {
            rccWaitingQueueSelect.clearOptions();
            rccWaitingQueueSelect.addOption("", null, "-");
        }


        app.send({ mt: "SqlExec", src: "get-waiting", statement: "get-waiting" });
        app.send({ mt: "SqlExec", src: "get-rcc-queues", statement: "get-rcc-queues" });
    }

    // Table
    var content = appView.add(new innovaphone.ui1.Div("flex:1 1 auto; overflow:auto;", null, "buttons-content"));
    content.container.classList.remove("is-ready");
    var tableHost = content.add(new innovaphone.ui1.Div("width:100%;", null, "buttons-tablehost"));
    var tableEl = document.createElement("table");
    tableEl.id = "dataTable";
    tableEl.style.width = "100%";
    tableHost.container.appendChild(tableEl);

    // thead
    var thead = document.createElement("thead");
    var trh = document.createElement("tr");
    var columnNames = texts.text("columnNames_user");
    columnNames.forEach(function (name) {
        var th = document.createElement("th");
        th.textContent = name;
        trh.appendChild(th);
    });
    thead.appendChild(trh);
    tableEl.appendChild(thead);

    // tbody helper
    var tbody = null;
    function ensureTbody() {
        tbody = tableEl.tBodies && tableEl.tBodies[0];
        if (!tbody) {
            tbody = document.createElement("tbody");
            tableEl.appendChild(tbody);
        }
        return tbody;
    }

    function buildTable() {
        tableHost.container.innerHTML = "";
        tableEl = document.createElement("table");
        tableEl.id = "dataTable";
        tableEl.style.width = "100%";
        tableHost.container.appendChild(tableEl);

        var thead = document.createElement("thead");
        var trh = document.createElement("tr");
        var columnNames = texts.text("columnNames_user");
        columnNames.forEach(function (name) {
            var th = document.createElement("th");
            th.textContent = name;
            trh.appendChild(th);
        });
        thead.appendChild(trh);
        tableEl.appendChild(thead);

        var tb = document.createElement("tbody");
        tableEl.appendChild(tb);
        return tb;
    }

    function app_connected(domain, user, dn, appdomain) {
        if (!loaded) {
            app.send({ api: "admin", mt: "UserMessage" });
            reloadActions();
            reloadQueues();
            app.send({ api: "admin", mt: "GetConnectedShellyDevices" });
            loaded = true;
        }
        ownsip = app.logindata.sip;
    }

    function renderActionsCell(id) {
        return ""
            + "<div class='ip-actions'>"
            + "  <button type='button' class='ip-iconbtn' data-act='edit' data-id='" + id + "'>"
            + "    <svg viewBox='0 0 20 20'><use xlink:href='" + ICONS + "edit'></use></svg>"
            + "  </button>"
            + "  <button type='button' class='ip-iconbtn' data-act='del' data-id='" + id + "'>"
            + "    <svg viewBox='0 0 20 20'><use xlink:href='" + ICONS + "del'></use></svg>"
            + "  </button>"
            + "</div>";
    }

    function restoreActionIcons() {
        var tds = tableEl.querySelectorAll("tbody td");
        for (var i = 0; i < tds.length; i++) {
            var td = tds[i];
            var txt = (td.textContent || "").trim();
            if (txt.indexOf("ACTION:") === 0) {
                var id = txt.substring(7);
                td.innerHTML = renderActionsCell(id);
            }
        }
    }
    function reloadActions() {
        actionsById = {};
        actionsDone = false;
        pendingActionRows = [];
        if (actionsRenderTimer) {
            clearTimeout(actionsRenderTimer);
            actionsRenderTimer = null;
        }
        app.send({ mt: "SqlExec", src: "get-allactions", statement: "get-allactions" });
    }

    function scheduleActionsRender() {
        ensureTbody();
        if (!actionsDone) return;
        if (actionsRenderTimer) clearTimeout(actionsRenderTimer);

        actionsRenderTimer = setTimeout(function () {
            if (dt) {
                try { dt.destroy(); } catch (e) { }
                dt = null;
            }

            var tb = buildTable();

            if (!tableEl._ipActionsBound) {
                tableEl._ipActionsBound = true;

                tableEl.addEventListener("click", function (e) {
                    var btn = e.target.closest && e.target.closest(".ip-iconbtn");
                    if (!btn) return;

                    var id = btn.getAttribute("data-id");
                    var act = btn.getAttribute("data-act");
                    var data = actionsById[id];
                    if (!data) return;

                    if (act === "edit") openEditFromRow(data);
                    else if (act === "del") {
                        app.send({ mt: "SqlExec", src: "deletedevice", statement: "deletedevice", args: { actionid: "" + id } });
                    }
                }, true);
            }

            var columnNames = texts.text("columnNames_user");
            pendingActionRows.forEach(function (r) {
                var tr = document.createElement("tr");
                tr.setAttribute("data-rowid", String(r.id));
                var rid = String(r.id);
                if (onlineIds[rid]) tr.classList.add("device-online");
                r.row.forEach(function (cell, idx) {
                    var td = document.createElement("td");
                    td.setAttribute("data-label", columnNames[idx] || "");
                    if (idx === r.row.length - 1) td.setAttribute("data-col", "actions");
                    td.innerHTML = (cell === null || cell === undefined) ? "" : String(cell);
                    tr.appendChild(td);
                });

                tb.appendChild(tr);
            });

            dt = new simpleDatatables.DataTable(tableEl, {
                searchable: false,
                fixedHeight: false,
                perPage: 20,
                perPageSelect: [10, 25, 50, 100],
                labels: {
                    placeholder: texts.text("dt_search_placeholder"),
                    searchTitle: texts.text("dt_search_title"),
                    perPage: texts.text("dt_per_page"),
                    pageTitle: texts.text("dt_page_title"),
                    noRows: texts.text("dt_no_rows"),
                    noResults: texts.text("dt_no_results"),
                    info: texts.text("dt_info")
                }
            });
            searchInput.container.addEventListener("input", function () {
                if (dt) dt.search(searchInput.getValue());
            });
            try {
                var dtTop = tableHost.container.querySelector('.datatable-top')
                    || (tableEl.parentElement && tableEl.parentElement.querySelector('.datatable-top'));
                if (dtTop && searchOptionsDiv && searchOptionsDiv.container) {
                    searchOptionsDiv.container.style.width = 'auto';
                    searchOptionsDiv.container.style.marginLeft = 'auto';
                    searchOptionsDiv.container.style.padding = '0';
                    dtTop.appendChild(searchOptionsDiv.container);
                }
            } catch (e) { }

            restoreActionIcons();
            requestAnimationFrame(function () {
                appView.container.classList.add("is-ready");
            });

            if (dt && typeof dt.on === "function") {
                dt.on("datatable.page", restoreActionIcons);
                dt.on("datatable.sort", restoreActionIcons);
                dt.on("datatable.search", restoreActionIcons);
                dt.on("datatable.perpage", restoreActionIcons);
            }

            pendingActionRows = [];
            actionsRenderTimer = null;
        }, 0);
    }

    function openEditFromRow(data) {
        optionsHeader.container.textContent = texts.text("columnNames_user")[1] +": "+ String(data.d_mac);
        choosenaction = data.id;
        choosendevice = data.d_mac;
        choosentype = data.d_type;

        //optionsdevice.container.textContent = String(data.id);

        openModal(optionsdeviceDiv);

        // Trigger UI
        buttonsselect.container.style.display = "none";
        windowselect.container.style.display = "none";
        motionselect.container.style.display = "none";
        loggingFilterInput.container.style.display = "none";

        if (data.d_type == 1) {
            buttonsselect.container.style.display = "block";
            buttonsselect.container.value = data.button ? String(data.button) : "1";
        }
        else if (data.d_type == 2) {
            windowselect.container.style.display = "block";
            windowselect.container.value = String(data.button);
        }
        else if (data.d_type == 3) {
            motionselect.container.style.display = "block";
            motionselect.container.value = String(data.button);
        }
        else if (data.d_type == 90) {
            loggingFilterInput.container.style.display = "block";
            loggingFilterInput.container.value = data.msgfilter || "";
        }

        actionsselect.container.value = data.action || "chat";
        if (typeof actionsselect.container.onchange === "function") actionsselect.container.onchange();

        destinationInput.setValue(data.sip || "");
        destinationText.setValue(data.text || "");
    }


    function app_message(obj) {
        if (obj.api == "admin" && obj.mt == "UserMessageResult") {
        }
        if (obj.api == "admin" && obj.mt == "GetConnectedShellyDevicesResult") {
            if (obj.name) {
                ShowDevicesList.add(new innovaphone.ui1.Div(null, obj.name, null));
            }
        }
        if (obj.api === "admin" && obj.mt === "getOnlineDevicesResult") {
            onlineIds[String(obj.id)] = true;

            var tr = tableEl.querySelector('tr[data-rowid="' + String(obj.id) + '"]');
            if (tr) tr.classList.add("device-online");
        }
        // if (obj.mt === "SqlRow" && obj.statement === "get-queues") {
        //     var cn = String(obj.cn || "");
        //     if (!cn) return;

        //     // dropdown option
        //     var opt = new innovaphone.ui1.Node("option", null, cn, null);
        //     opt.setAttribute("value", cn);
        //     waitingQueueSelect .add(opt);

        //     // read-only list entry im QueueManageDiv
        //     var line = new innovaphone.ui1.Div(
        //         "display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.08);",
        //         null, null
        //     );
        //     line.add(new innovaphone.ui1.Div(null, cn, null));
        //     QueueList.add(line);
        // }

        if (obj.mt === "SqlRow" && obj.statement === "get-allactions") {

            // command mapping (presence label)
            var command = obj.text;
            if (obj.action === "presence") {
                var presence = presenceactions.find(function (b) { return b.id == obj.text; });
                command = presence ? presence.label : null;
            }

            var d_type = devicestypes.find(function (b) { return b.id == obj.d_type; });

            var trigger = obj.button;
            buttons.forEach(function (b) {
                if (b.id == trigger && obj.d_type == 1) trigger = b.label;
            });

            // data edit modal
            actionsById[obj.id] = {
                id: obj.id,
                d_mac: obj.d_mac,
                d_type: obj.d_type,
                button: obj.button,
                action: obj.action,
                sip: obj.sip,
                text: obj.text,
                msgfilter: (obj.d_type == 90 ? (obj.button || "") : "")
            };

            var rowData = [
                (d_type ? d_type.label : ""),
                obj.d_mac,
                trigger,
                obj.action,
                obj.sip,
                command,
                "ACTION:" + obj.id
            ];

            pendingActionRows.push({ id: obj.id, row: rowData });
        }

        if (obj.mt === "SqlRow" && obj.statement === "get-waiting") {
            var cn = String(obj.cn || "");
            if (cn && waitingQueueSelect) waitingQueueSelect.addOption(cn, null, cn);
            return;
        }

        if (obj.mt === "SqlRow" && obj.statement === "get-rcc-queues") {
            var cn2 = String(obj.cn || "");
            var id = obj.id;
            if (!cn2) return;

            if (rccWaitingQueueSelect) rccWaitingQueueSelect.addOption(cn2, null, cn2);

            if (activeQueueList) {
                var row = new innovaphone.ui1.Div(
                    "display:flex; align-items:center; justify-content:space-between; gap:16px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.08);",
                    null, null
                );

                var nameDiv = row.add(new innovaphone.ui1.Div("flex:1 1 auto; text-align:left; word-break:break-word;", cn2, null));

                var del = row.add(new innovaphone.ui1.Div("flex:0 0 110px; text-align:center; padding:6px 0;", texts.text("delete"), "button"));

                del.container.onclick = function () {
                    app.send({
                        mt: "SqlExec",
                        src: "deletequeues",
                        statement: "deletequeues",
                        args: { queueid: String(id) }
                    });
                };

                activeQueueList.add(row);
            }
            return;
        }

        if (obj.mt === "SqlInsertResult" && (obj.statement === "add-device" || obj.statement === "add-queue")) {
            closeAllModals();
            reloadQueues();
        }
        else if (obj.mt === "SqlInsertBackendResult" && obj.statement === "add-device") {
            closeAllModals();
            reloadActions();
        }
        else if (obj.mt === "SqlExecResult" && obj.statement === "deletequeues") {
            reloadQueues();
        }
        else if (obj.mt === "SqlExecResult" &&
            (obj.statement === "set-action" || obj.statement === "set-action-phone" || obj.statement === "set-action-hotkey")) {
            closeAllModals();
            reloadActions();
        }
        else if (obj.mt === "SqlExecBackendResult" && obj.statement === "set-action-logging") {
            closeAllModals();
            reloadActions();
        }
        else if (obj.mt === "SqlExecResult" && obj.statement === "deletedevice") {
            closeAllModals();
            reloadActions();
        }

        else if (obj.mt === "SqlExecResult" && obj.statement === "get-allactions") {
            actionsDone = true;
            scheduleActionsRender();
        }
    }

}
innovaphone.buttonsAdmin.prototype = innovaphone.ui1.nodePrototype;
