/// <reference path="../../web1/lib1/innovaphone.lib1.js" />
/// <reference path="../../web1/appwebsocket/innovaphone.appwebsocket.Connection.js" />
/// <reference path="../../web1/ui1.lib/innovaphone.ui1.lib.js" />

var innovaphone = innovaphone || {};
innovaphone.buttons = innovaphone.buttons || function (start, args) {
    this.createNode("body");
    var that = this;

    var ownsip = "";

    var colorSchemes = {
        dark: {
            "--bg": "#191919",
            "--button": "#303030",
            "--modal": "#3f3f3f",
            "--text-standard": "#f2f5f6",
            "--hover-text": "#f2f5f6",

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
            "--hover-text": "#f2f5f6",

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
    start.onlangchanged.attach(function () {
        texts.activate(start.lang);
        if (dt) {
            try { dt.destroy(); } catch (e) { }
            dt = null;
        }
        reloadActions();
    });

    var app = new innovaphone.appwebsocket.Connection(start.url, start.name);
    app.checkBuild = true;
    app.onconnected = app_connected;
    app.onmessage = app_message;
    var dt = null;
    var pendingActionRows = []; // collect "get-actions"
    var actionsDone = null;
    var actionsRenderTimer = null;
    var optionopen = false;
    var pendingDeleteId = null;

    var ICONS = "icons.svg#";

    var main = new innovaphone.ui1.Div(
        "background:var(--bg); color:var(--text-standard); height:100%; display:flex; flex-direction:column;",
        null,
        "bodydiv"
    );
    that.add(main);
    var appView = main.add(new innovaphone.ui1.Div(
        "display:flex; flex-direction:column; height:100%;",
        null,
        "app-view"
    ));
    appView.container.classList.remove("is-ready");

    // Top-Bar
    var topbar = appView.add(new innovaphone.ui1.Div(
        "display:flex; align-items:center; justify-content:space-between; padding:12px 16px; gap:12px; flex:0 0 auto; border-bottom:1px solid rgba(255,255,255,0.08);",
        null,
        "buttons-topbar"
    ));

    topbar.add(new innovaphone.ui1.Div("font-weight:600; font-size:18px;", "Buttons", "buttons-title"));

    var topbarRight = topbar.add(new innovaphone.ui1.Div("display:flex; align-items:center; gap:10px;", null, "buttons-topbar-right"));

    const searchInput = topbarRight.add(new innovaphone.ui1.Input(null, null, texts.text("searchitem"), null, "text", null));
    searchInput.setAttribute("id", "search-input");
    //modal overlay
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


    function openAddDeviceModal() {
        modalOverlay.container.style.display = "block";
        AddDeviceDiv.container.style.display = "flex";
    }

    function openEditModal() {
        modalOverlay.container.style.display = "block";
        optionsdeviceDiv.container.style.display = "flex";

    }

    function closeAllModals() {
        AddDeviceDiv.container.style.display = "none";
        optionsdeviceDiv.container.style.display = "none";
        modalOverlay.container.style.display = "none";
    }

    modalOverlay.container.onclick = function (e) {
        if (e) e.stopPropagation();

    };


    main.add(modalOverlay);


    // Add Device Button 
    const addDevices_Button = topbarRight.add(new innovaphone.ui1.Div(null, texts.text("add_Device"), "button"));
    addDevices_Button.container.addEventListener("click", openAddDeviceModal);

    const AddDeviceDiv = new innovaphone.ui1.Div(null, texts.text("addnewDevice"), "modalDiv");
    AddDeviceDiv.container.style.display = "none";

    // Modal-Style
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

    var content = appView.add(new innovaphone.ui1.Div("flex:1 1 auto; overflow:auto;", null, "buttons-content"));
    var tableHost = content.add(new innovaphone.ui1.Div("width:100%;", null, "buttons-tablehost"));
    var tableEl = document.createElement("table");
    tableEl.id = "dataTable";
    tableEl.style.width = "100%";

    tableHost.container.appendChild(tableEl);

    // table-head
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

    var tbody = null;

    function ensureTbody() {
        tbody = tableEl.tBodies && tableEl.tBodies[0];
        if (!tbody) {
            tbody = document.createElement("tbody");
            tableEl.appendChild(tbody);
        }
        return tbody;
    }



    const devicetypesselect = new innovaphone.ui1.Node("select", null, null, "inputfield");
    const devicestypes = [
        { id: 1, label: texts.text("button") },
        { id: 2, label: texts.text("windowsensor") },
        { id: 3, label: texts.text("motionsensor") },
        { id: 4, label: texts.text("dialinnumber") },
        { id: 5, label: texts.text("hotkey") }
    ];
    devicestypes.forEach(type => {
        const option = new innovaphone.ui1.Node("option", null, type.label, null);
        option.setAttribute("value", type.id);
        devicetypesselect.add(option);
    });
    const addDevice_Mac_Input = new innovaphone.ui1.Input(null, null, "", null, "text", "inputfield");

    function setAddDeviceIdPlaceholder() {
        var t = String(devicetypesselect.container.value || "");
        var ph = "ID";

        if (t === "1" || t === "2" || t === "3") ph = "MAC";
        else if (t === "4") ph = "E164";
        else if (t === "5") ph = "Hotkey"

        addDevice_Mac_Input.container.placeholder = ph;
    }

    devicetypesselect.container.onchange = setAddDeviceIdPlaceholder;
    setAddDeviceIdPlaceholder();

    const addDevice_submitButton = new innovaphone.ui1.Div(null, texts.text("submit"), "button");
    addDevice_submitButton.container.onclick = function () {
        var raw = (addDevice_Mac_Input.getValue() || "").trim();
        var dtype = String(devicetypesselect.container.value || "");

        var id = raw;
        if (dtype === "1" || dtype === "2" || dtype === "3") {
            id = raw.toLowerCase().replace(/[^0-9a-f]/g, "");
        }
        app.send({
            mt: "SqlInsert",
            src: "add-device",
            statement: "add-device",
            args: {
                id: id,
                mac: id,
                dtype: dtype
            }
        });
    };


    const addDevice_closebutton = new innovaphone.ui1.Div(null, texts.text("close"), "button");
    addDevice_closebutton.container.onclick = closeAllModals;

    // Button Row Container
    var addDeviceButtonRow = new innovaphone.ui1.Div(
        "display:flex; gap:10px; margin-top:15px;",
        null,
        "modal-buttons"
    );

    addDeviceButtonRow.add(addDevice_submitButton);
    addDeviceButtonRow.add(addDevice_closebutton);

    AddDeviceDiv.add(AddDeviceLabel);
    AddDeviceDiv.add(devicetypesselect);
    AddDeviceDiv.add(addDevice_Mac_Input);
    AddDeviceDiv.add(addDeviceButtonRow);


    main.add(AddDeviceDiv);

    const optionsdeviceDiv = new innovaphone.ui1.Div(null, null, "modalDiv");
    const optionsdeviceDivLabel = optionsdeviceDiv.add(new innovaphone.ui1.Div("font-weight: 600;", texts.text("columnNames_user")[1] + ": ", null));

    optionsdeviceDiv.container.style.position = "fixed";
    optionsdeviceDiv.container.style.left = "50%";
    optionsdeviceDiv.container.style.top = "20%";
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

    const optionsdeviceLabel = new innovaphone.ui1.Div(null, null, null);
    const optionsdevice = new innovaphone.ui1.Node("span", null, null, null);
    optionsdeviceLabel.add(optionsdevice)

    const buttonsselect = new innovaphone.ui1.Node("select", null, null, "inputfield");
    const buttons = [
        { id: 1, label: "1-Click" },
        { id: 2, label: "2-Click" },
        { id: 3, label: "3-Click" },
        { id: 4, label: "Long" },
        { id: 5, label: "Offen" },
        { id: 6, label: "Geschlossen" }
    ];
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
            queueeselect.container.style.display = "none";
            destinationInput.setValue(ownsip);
            destinationText.setValue("-");
        }
        else if (actionsselect.container.value === "presence") {
            destinationInput.container.style.display = "none";
            destinationText.container.style.display = "none";
            workingselect.container.style.display = "none";
            presenceselect.container.style.display = "block";
            queueeselect.container.style.display = "none";
            destinationInput.setValue(ownsip);
            destinationText.setValue("-");
        }
        else if (actionsselect.container.value === "call") {
            destinationInput.container.style.display = "none";
            destinationText.container.style.display = "none";
            workingselect.container.style.display = "none";
            presenceselect.container.style.display = "none";
            queueeselect.container.style.display = "block";
            destinationText.setValue("-");
        }
        else {
            destinationInput.container.style.display = "block";
            destinationText.container.style.display = "block";
            workingselect.container.style.display = "none";
            presenceselect.container.style.display = "none";
            queueeselect.container.style.display = "none";
        }
    }

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

    const presenceselect = new innovaphone.ui1.Node("select", null, null, "inputfield");
    const presenceactions = [
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

    const queueeselect = new innovaphone.ui1.Node("select", null, null, "inputfield");
    queueeselect.container.style.display = "none";

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
                app.send({ mt: "SqlExec", src: "set-action", statement: "set-action", args: { actionid: "" + choosenaction + "", button: "" + buttonsselect.container.value + "", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + queueeselect.container.value + "" } });
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
                app.send({ mt: "SqlExec", src: "set-action", statement: "set-action", args: { actionid: "" + choosenaction + "", button: "" + windowselect.container.value + "", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + queueeselect.container.value + "" } });
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
                app.send({ mt: "SqlExec", src: "set-action", statement: "set-action", args: { actionid: "" + choosenaction + "", button: "" + motionselect.container.value + "", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + queueeselect.container.value + "" } });
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
                app.send({ mt: "SqlExec", src: "set-action-phone", statement: "set-action-phone", args: { actionid: "" + choosenaction + "", button: "-", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + queueeselect.container.value + "" } });
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
                app.send({ mt: "SqlExec", src: "set-action-hotkey", statement: "set-action-hotkey", args: { actionid: "" + choosenaction + "", button: "-", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + queueeselect.container.value + "" } });
            }
            else {
                app.send({ mt: "SqlExec", src: "set-action-hotkey", statement: "set-action-hotkey", args: { actionid: "" + choosenaction + "", button: "-", option: "" + actionsselect.container.value + "", sipuser: "" + destinationInput.getValue() + "", text: "" + destinationText.getValue() + "" } });
            }
        }
    };

    const closebutton = new innovaphone.ui1.Div(null, texts.text("close"), "button");
    closebutton.container.onclick = function () {
        closeAllModals();
        optionopen = false;
    };

    optionsdeviceDiv.add(optionsdeviceLabel);
    optionsdeviceDiv.add(buttonsselect);
    optionsdeviceDiv.add(windowselect);
    optionsdeviceDiv.add(motionselect);
    optionsdeviceDiv.add(actionsselect);
    optionsdeviceDiv.add(destinationInput);
    optionsdeviceDiv.add(destinationText);
    optionsdeviceDiv.add(workingselect);
    optionsdeviceDiv.add(presenceselect);
    optionsdeviceDiv.add(queueeselect);
    optionsdeviceDiv.add(submitbutton);
    optionsdeviceDiv.add(closebutton);

    main.add(optionsdeviceDiv);

    function openEditFromRow(data) {
        choosenaction = data.id;
        choosendevice = data.d_mac;
        choosentype = data.d_type;

        optionsdeviceDivLabel.container.textContent =
            "Options - ID: " + choosendevice;

        AddDeviceDiv.container.style.display = "none";
        openEditModal();

        // Trigger UI
        buttonsselect.container.style.display = "none";
        windowselect.container.style.display = "none";
        motionselect.container.style.display = "none";

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

        actionsselect.container.value = data.action || "chat";
        if (typeof actionsselect.container.onchange === "function") {
            actionsselect.container.onchange();
        }

        destinationInput.setValue(data.sip || "");

        if ((data.action || "") === "call") {
            queueeselect.container.value = String(data.text || "");
            destinationText.setValue("-");
        }
        else {
            queueeselect.container.value = "";
            destinationText.setValue(data.text || "");
        }
    }


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
        queueeselect.container.innerHTML = "";
        var opt = new innovaphone.ui1.Node("option", null, "-", null);
        opt.setAttribute("value", "");
        queueeselect.add(opt);

        app.send({ mt: "SqlExec", src: "get-rcc-queues", statement: "get-rcc-queues" });
    }


    var buttonDivs = [];
    var choosenaction = "";
    var choosendevice = "";
    var choosentype = "";
    var actionsById = {};

    function app_connected(domain, user, dn, appdomain) {
        if (!loaded) {
            app.send({ api: "user", mt: "UserMessage" });
            app.send({ mt: "SqlExec", src: "get-actions", statement: "get-actions" });
            reloadQueues();
            loaded = true;
        }
        ownsip = app.logindata.sip;
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

    function reloadActions() {
        actionsById = {};
        actionsDone = false;
        pendingActionRows = [];
        if (actionsRenderTimer) {
            clearTimeout(actionsRenderTimer);
            actionsRenderTimer = null;
        }
        app.send({ mt: "SqlExec", src: "get-actions", statement: "get-actions" });
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
                        pendingDeleteId = id;
                        app.send({
                            mt: "SqlExec",
                            src: "deletedevice",
                            statement: "deletedevice",
                            args: { actionid: "" + id }
                        });
                    }
                }, true);
            }
            var columnNames = texts.text("columnNames_user");
            pendingActionRows.forEach(function (r) {
                var tr = document.createElement("tr");
                tr.setAttribute("data-rowid", String(r.id));

                r.row.forEach(function (cell, idx) {
                    var td = document.createElement("td");

                    // label for mobile cards
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

    function renderActionsCell(id) {
        return ""
            + "<div class='ip-actions'>"
            + "  <button type='button' class='ip-iconbtn' data-act='edit' data-id='" + id + "'>"
            + "    <svg viewBox='0 0 20 20'>"
            + "      <use xlink:href='" + ICONS + "edit'></use>"
            + "    </svg>"
            + "  </button>"
            + "  <button type='button' class='ip-iconbtn' data-act='del' data-id='" + id + "'>"
            + "    <svg viewBox='0 0 20 20'>"
            + "      <use xlink:href='" + ICONS + "del'></use>"
            + "    </svg>"
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


    function app_message(obj) {
        if (obj.api == "user" && obj.mt == "UserMessageResult") {
            if (start.args.hotkey) {
                app.send({ api: "user", mt: "StartHotkey", hotkey: start.args.hotkey });
            }
        }
        else if (obj.api == "user" && obj.mt == "getOnlineDevicesResult") {
            buttonDivs[obj.id].container.style.backgroundColor = "green";
        }
        else if (obj.mt == "SqlRow" && obj.statement == "get-rcc-queues") {
            var option = new innovaphone.ui1.Node("option", null, obj.cn, null);
            option.setAttribute("value", obj.cn);
            queueeselect.add(option);
        }
        else if (obj.mt == "SqlRow" && obj.statement == "get-actions") {
            var command = obj.text;
            if (obj.action === "presence") {
                var presence = presenceactions.find(function (b) { return b.id == obj.text; });
                command = presence ? presence.label : null;
            }

            var d_type = devicestypes.find(function (b) { return b.id == obj.d_type; });
            var trigger = obj.button;
            buttons.forEach(function (button) {
                if (button.id == trigger && obj.d_type == 1) trigger = button.label;
            });

            actionsById[obj.id] = {
                id: obj.id,
                d_mac: obj.d_mac,
                d_type: obj.d_type,
                button: obj.button,
                action: obj.action,
                sip: obj.sip,
                text: obj.text
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

        else if (obj.mt === "SqlInsertResult" && obj.statement === "add-device") {
            closeAllModals();
            reloadActions();
        }
        else if (obj.mt === "SqlExecResult" &&
            (obj.statement === "set-action" || obj.statement === "set-action-phone" || obj.statement === "set-action-hotkey")) {

            closeAllModals();
            reloadActions();
        }
        else if (obj.mt === "SqlExecResult" && obj.statement === "get-actions") {
            actionsDone = true;
            scheduleActionsRender();
        }
        else if (obj.mt === "SqlExecResult" && obj.statement === "deletedevice") {
            pendingDeleteId = null;
            closeAllModals();
            reloadActions();
        }
    }

    searchInput.container.addEventListener("input", function () {
        if (dt) dt.search(searchInput.getValue());
    });
};

innovaphone.buttons.prototype = innovaphone.ui1.nodePrototype;
