
/// <reference path="../../web1/lib1/innovaphone.lib1.js" />
/// <reference path="../../web1/ui1.lib/innovaphone.ui1.lib.js" />
/// <reference path="../../web1/appwebsocket/innovaphone.appwebsocket.Connection.js" />

var plugin = plugin || {};
plugin.innovaphone = plugin.innovaphone || {};
plugin.innovaphone.buttonsmanager = plugin.innovaphone.buttonsmanager || function (start, item, app) {
    this.createNode("div", null, null, "item-node");
    innovaphone.lib1.loadCss(item.uri + ".css");

    var colorSchemes = {
        dark: {
            "--innovaphone-buttons-item": "#333333",
            "--innovaphone-buttons-item-text": "#f2f5f6",
            "--innovaphone-buttons-c1": "#efefef",
            "--innovaphone-buttons-c2": "#939393",
            "--innovaphone-buttons-highlight-bg": "#595959",
            "--innovaphone-buttons-input": "#191919",
            "--innovaphone-buttons-input-text": "#f2f5f6",
            "--innovaphone-buttons-button": "#191919",
            "--innovaphone-buttons-button-text": "#f2f5f6",
            "--innovaphone-buttons-button-bg": "#3D3D3D",
            "--innovaphone-buttons-green": "#7cb270",
            "--button": "#3D3D3D",
        },
        light: {
            "--innovaphone-buttons-item": "#e9eef1",
            "--innovaphone-buttons-item-text": "#4a4a4a",
            "--innovaphone-buttons-c1": "#444444",
            "--innovaphone-buttons-c2": "#777777",
            "--innovaphone-buttons-highlight-bg": "#eaeaea",
            "--innovaphone-buttons-input": "white",
            "--innovaphone-buttons-input-text": "#4a4a49",
            "--innovaphone-buttons-button": "white",
            "--innovaphone-buttons-button-text": "#4a4a49",
            "--innovaphone-buttons-button-bg": "#CCCCCC",
            "--innovaphone-buttons-green": "#7cb270",
            "--button": "#CCCCCC",
        }
    };

    var schemes = new innovaphone.ui1.CssVariables(colorSchemes, start.scheme);
    start.onschemechanged.attach(function () { schemes.activate(start.scheme) });

    var texts, add, buttonsList, templatesList, templatesListCn, instance;

    var body = this.add(new innovaphone.ui1.Div(null, null, "innovaphone-buttons-body"));
    var panel = body.add(new innovaphone.ui1.Div(null, null, "innovaphone-buttons-panel"));
    var panel2 = body.add(new innovaphone.ui1.Div(null, null, "innovaphone-buttons-panel"));

    var configItems = null;
    var configItemsInitialized = false;
    var settingsOkBtn = null;
    var settingsValidators = null;

    var src = new app.Src(pbx);
    var typeText = ["buttons", "buttonsadmin"];
    var typeUrl = ["/innovaphone-buttons", "/innovaphone-buttonsadmin"];
    var typeCheckmarks = [
        { web: false, websocket: true, hidden: false, pbx: true, pbxsignal: true, epsignal: false, messages: false, tableusers: false, admin: false, services: true, rcc: true },
        { web: false, websocket: false, hidden: false, pbx: false, pbxsignal: false, epsignal: false, messages: false, tableusers: false, admin: false, services: false, rcc: false }
    ];

    var copyPwd = null;
    var managerApi = start.consumeApi("com.innovaphone.manager");

    innovaphone.lib1.loadObjectScript(item.uri + "texts", function () {
        texts = new innovaphone.lib1.Languages(innovaphone.buttonsmanagertexts, start.lang);
        instance = new innovaphone.appwebsocket.Connection("ws" + item.uri.slice(4), "-", null, app.domain, instanceConnected, instanceMessage, null, null, instanceLogin);
    });


    function instanceLogin(app, challenge) {
        var src = new managerApi.Src(getlogin);
        src.send({ mt: "GetInstanceLogin", path: item.apUri.slice(0, item.apUri.lastIndexOf("/")), app: app, challenge: challenge }, item.ap);

        function getlogin(obj) {
            instance.login(obj.msg);
        }
    }

    function instanceConnected() {
        console.log("Instance Connected");
        read();
    }

    // function instanceMessage(obj) {
    //     if (obj.mt == "ReadConfigResult") {
    //         if (obj.ConfigItems != undefined) {
    //             pbxname.setValue(obj.ConfigItems.pbxname);
    //             buttons_h323.setValue(obj.ConfigItems.hwid);
    //             buttons_e164.setValue(obj.ConfigItems.e164);
    //             buttons_httppath.setValue(obj.ConfigItems.httppath)
    //             buttons_httpkey.setValue(obj.ConfigItems.httpkey);
    //             buttons_extSocketPath.setValue(obj.ConfigItems.extsocketpath)
    //             buttons_extsocketremoteip.setValue(obj.ConfigItems.extsocketremoteip);
    //         }
    //     }
    // }
    function instanceMessage(obj) {
        if (obj && obj.mt === "ReadConfigResult") {
            settingsCache = (obj.ConfigItems || {});
            if (settingsFields) applySettingsToUi(settingsCache);
        }
        else if (obj && obj.mt === "WriteConfigResult") {
            read();
        }
    }

    function setButtonDisabled(btnDiv, dis) {
        if (!btnDiv || !btnDiv.container) return;
        btnDiv.container.style.opacity = dis ? "0.55" : "1";
        btnDiv.container.style.pointerEvents = dis ? "none" : "auto";
        btnDiv.container.style.filter = dis ? "grayscale(0.3)" : "";
    }
    function addTooltipTranslation(fieldObj, key, args) {
        var el = fieldObj && fieldObj.input && fieldObj.input.container;
        if (!el || !texts || !texts.create) return;
        texts.create(el, "title", key, args);
    }

    function setTooltip(el, text) {
        if (!el) return;
        if (text) el.setAttribute("title", text);
        else el.removeAttribute("title");
    }

    // marks a field as required and sets its error message.
    function markRequiredField(field, isValid, msg) {
        if (field && field.setError) {
            field.setError(!isValid, msg);
        }
        return !!isValid; // true if valid

    }

    // Validates a set of fields. Returns true if all are valid.
    function validateRequiredField(fields) {
        var allValid = true;

        for (var i = 0; i < fields.length; i++) {
            var f = fields[i];
            var v = (typeof f.value === "function") ? f.value() : f.value;
            var ok;
            if (typeof f.validator === "function") ok = !!f.validator(v);
            else ok = !isEmpty(v);

            var msg = null;
            if (!ok) msg = f.msg || "Required";

            if (!markRequiredField(f.field, ok, msg)) allValid = false;
        }
        return allValid;
    }

    function setFieldErrorStyle(el, on) {
        if (!el) return;

        if (on) {
            el.style.border = "1px solid #e53935";
            el.style.backgroundColor = "#fdecea";
        }
        else {
            el.style.border = "";
            el.style.backgroundColor = "";
        }
    }

    // validation helpers
    function trimStr(s) { return String(s || "").replace(/^\s+|\s+$/g, ""); }
    function isEmpty(s) { return trimStr(s) === ""; }

    function sendConfigUpdate() {
        if (!settingsFields) return;
        instance.send({
            api: "Config",
            mt: "WriteConfig",
            ConfigItems: {
                pbxname: settingsFields.pbxname.getValue(),
                hwid: settingsFields.hwid.getValue(),
                e164: settingsFields.e164.getValue(),
                httppath: settingsFields.httppath.getValue(),
                httpkey: settingsFields.httpkey.getValue(),
                extsocketpath: settingsFields.extsocketpath.getValue(),
                extsocketremoteip: settingsFields.extsocketremoteip.getValue()
            }
        });
    }

    var pbxname = null;
    var buttons_h323 = null;
    var buttons_e164 = null;
    var buttons_httppath = null;
    var buttons_httpkey = null;
    var buttons_extSocketPath = null;
    var buttons_extsocketremoteip = null;
    var settingsFields = null;
    var settingsCache = null;

    function read() {
        panel.clear();
        panel2.clear();
        //settings
        var settingsBtn = panel
            .add(new innovaphone.ui1.Div("display:flex; flex-direction:row; position:relative; z-index:2;", null, "innovaphone-buttons-obj"))
            .testId("innovaphone-buttons-settings")
            .addEvent("click", onsettings);
        var settings = settingsBtn.add(new innovaphone.ui1.SvgInline("width:20px; height:20px; margin: 10px 20px 10px 20px; fill:var(--c1); cursor:pointer", "0 0 20 20", "<path d=\'M20,4.64V6.79H18V4.64ZM10,2.5h6V8.93H10V6.79H0V4.64H10Zm1,10.71v2.15h9V13.21ZM3,11.07H9V17.5H3V15.36H0V13.21H3Z'/>"));
        settingsBtn.add(new innovaphone.ui1.Div("font-size: 16px; margin-right: 20px; padding-left: 7px; padding-top: 7px", null, null)).addTranslation(texts, "buttons_settings");

        var header = panel.add(new innovaphone.ui1.Div("display:flex; flex-direction:row; position:relative; margin-top:0px; z-index:2;", null, "innovaphone-buttons-obj")).addEvent("click", onadd).testId("innovaphone-buttons-add");
        add = header.add(new innovaphone.ui1.SvgInline("position:relative; left:10px; width:20px; top:10px; height:20px; fill:var(--innovaphone-buttons-item-text); cursor:pointer", "0 0 20 20", "<path d=\'M8.24,8.24V0h3.52V8.24H20v3.52H11.76V20H8.24V11.76H0V8.24Z'/>"));
        header.add(new innovaphone.ui1.Div("padding: 5px 10px;", null, "innovaphone-buttons-label2")).addTranslation(texts, "addapp");
        buttonsList = panel.add(new innovaphone.ui1.Scrolling("left:0px; right:0px; margin-top:0px; bottom:0px; z-index:1;", -1, -1));

        copyPwd = null;

        // var buttonsconfig1 = panel2.add(new innovaphone.ui1.Div(null, null, "innovaphone-buttons-configpanel"));
        // var buttonsconfig2 = panel2.add(new innovaphone.ui1.Div(null, null, "innovaphone-buttons-configpanel"));
        // var buttonsconfig2_1 = panel2.add(new innovaphone.ui1.Div(null, null, "innovaphone-buttons-configpanel"));
        // var buttonsconfig3 = panel2.add(new innovaphone.ui1.Div(null, null, "innovaphone-buttons-configpanel"));
        // pbxname = buttonsconfig1.add(new ConfigText("pbx", null, 150)).testId("innovaphone-buttons-pbxname");
        // buttons_h323 = buttonsconfig1.add(new ConfigText("buttonuser", null, 150)).testId("innovaphone-buttons-buttonuser");
        // buttons_e164 = buttonsconfig1.add(new ConfigText("buttone164", null, 150)).testId("innovaphone-buttons-buttone164");
        // buttons_httppath = buttonsconfig2.add(new ConfigText("buttonhttppath", null, 150)).testId("innovaphone-buttons-buttone164");
        // buttons_httpkey = buttonsconfig2.add(new ConfigText("buttonhttpkey", null, 150)).testId("innovaphone-buttons-buttone164");
        // buttons_extSocketPath = buttonsconfig2_1.add(new ConfigText("buttonextSocketPath", null, 150)).testId("innovaphone-buttons-buttone164");
        // buttons_extsocketremoteip = buttonsconfig2_1.add(new ConfigText("buttonextsocketremoteip", null, 150)).testId("innovaphone-buttons-buttone164");

        // var savebutton = new innovaphone.ui1.Div(null, texts.text("submit"), "button");
        // savebutton.container.onclick = function () {
        //     sendConfigUpdate();
        // };
        //buttonsconfig3.add(savebutton);
        src.send({ mt: "GetAppObjects", api: "PbxAdminApi", uri: item.httpsUri.slice(0, item.httpsUri.lastIndexOf("/")) });
        instance.send({ api: "Config", mt: "ReadConfig" });
    }

    function onadd() {
        panel.clear();
        var header = panel.add(new innovaphone.ui1.Div("position:absolute; box-sizing:border-box; padding:10px; width:100%; color: var(--innovaphone-buttons-c2); font-size: 18px;")).addTranslation(texts, "addapp");
        var content = panel.add(new innovaphone.ui1.Scrolling("position:absolute; width:100%; top:50px; bottom:40px; margin-top: 5px;", -1, -1, 9, "red"));
        var selection = content.add(new innovaphone.ui1.Div("position:relative; width:100%; display:flex; flex-wrap:wrap; align-content:flex-start"));
        var select = content.add(new innovaphone.ui1.Div("position:relative; width:100%; display:flex; flex-wrap:wrap; align-content:flex-start"));
        addSelect(select, 0, "buttons", "/innovaphone-buttons.png");
        addSelect(select, 1, "buttonsadmin", "/innovaphone-buttonsadmin.png");

        function addSelect(select, typeIndex, appid, iconpath) {
            if (!appid) appid = typeText[typeIndex];
            if (!iconpath) iconpath = typeUrl[typeIndex] + ".png";
            var appselect = select.add(new innovaphone.ui1.Div("width:170px;height:50px;", null, "innovaphone-buttons-choice")).addEvent("click", function () {
                select.clear();
                selection.add(new innovaphone.ui1.Div("text-align: left; background-color: transparent; font-size: 16px;", null, "innovaphone-buttons-selection")).addTranslation(texts, appid);
                new Editbuttons({ type: typeIndex }, content);
            }).testId("innovaphone-buttons-" + appid);
            var appicon = appselect.add(new innovaphone.ui1.Div(null, null, "innovaphone-buttons-appicon"));
            appicon.container.style.backgroundImage = "url(" + item.uri.slice(0, item.uri.lastIndexOf("/")) + iconpath + ")";
            appicon.container.style.backgroundSize = "cover";
            appselect.add(new innovaphone.ui1.Div("position:absolute; left:50px; top:5px; height:30px;", null, "innovaphone-buttons-label2")).addTranslation(texts, appid);
        }
    }

    function onsettings() {
        // settings ui
        panel.clear();
        settingsOkBtn = null;
        settingsValidators = null;
        settingsFields = null;

        function oncancelSettings() {
            settingsFields = null;
            read();
        }
        function optional(validatorFn) {
            return function (value) {
                var v = trimStr(value);
                if (v === "") return true;
                return validatorFn(v);
            };
        }

        function isValidIPv4(ip) {
            var r = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
            return r.test(ip);
        }

        function isValidHttpPath(p) {
            return /^\/[a-zA-Z0-9\-_/]*$/.test(p);
        }

        function isValidE164(e164) {
           return /^\+?[0-9*#]+$/.test(e164);
        }

        var header = panel.add(new innovaphone.ui1.Div("position: absolute; box-sizing: border-box; padding: 10px; width: 100%; color: var(--innovaphone-buttons-c2); font-size: 18px;")).addTranslation(texts, "buttons_settings");
        var content = panel.add(new innovaphone.ui1.Scrolling("position:absolute; width:100%; top:50px; bottom:40px; margin-top: 5px;", -1, -1, 9, "red"));
        content.container.style.overflowY = "auto";
        content.container.style.overflowX = "hidden";
        var footer = panel.add(new innovaphone.ui1.Div("position:absolute; width:100%; bottom:0px; height:40px"));
        settingsOkBtn = footer.add(new innovaphone.ui1.Div("right:140px; bottom:10px", null, "innovaphone-buttons-button")).addTranslation(texts, "ok")
            .addEvent("click", function () {
                if (validateSettings()) sendConfigUpdate();
            })
            .testId("innovaphone-buttons-settings-ok");
        footer.add(new innovaphone.ui1.Div("right:10px; bottom:10px", null, "innovaphone-buttons-button")).addTranslation(texts, "cancel").addEvent("click", oncancelSettings).testId("innovaphone-buttons-settings-cancel");


        settingsFields = {};
        pbxname = content.add(new ConfigText2("pbx", null, 150)).testId("innovaphone-buttons-pbxname");
        pbxname.setAttribute("placeholder", "master");


        settingsFields.pbxname = pbxname;

        buttons_h323 = content.add(new ConfigText2("buttonuser", null, 150)).testId("innovaphone-buttons-buttonuser");
        buttons_h323.setAttribute("placeholder", "H323-Name");
        settingsFields.hwid = buttons_h323;

        buttons_e164 = content.add(new ConfigText2("buttone164", null, 150)).testId("innovaphone-buttons-buttone164");
        buttons_e164.setAttribute("placeholder", "E.164");
        settingsFields.e164 = buttons_e164;

        buttons_httppath = content.add(new ConfigText2("buttonhttppath", null, 150)).testId("innovaphone-buttons-buttone164");
        buttons_httppath.setAttribute("placeholder", "HTTP Path");
        settingsFields.httppath = buttons_httppath;

        buttons_httpkey = content.add(new ConfigText2("buttonhttpkey", null, 150)).testId("innovaphone-buttons-buttone164");
        buttons_httpkey.setAttribute("placeholder", "HTTP API-Key");
        settingsFields.httpkey = buttons_httpkey;

        buttons_extSocketPath = content.add(new ConfigText2("buttonextSocketPath", null, 150)).testId("innovaphone-buttons-buttone164");
        buttons_extSocketPath.setAttribute("placeholder", "Ext Socket Path");
        settingsFields.extsocketpath = buttons_extSocketPath;

        buttons_extsocketremoteip = content.add(new ConfigText2("buttonextSocketRemoteIp", null, 150)).testId("innovaphone-buttons-buttone164");
        buttons_extsocketremoteip.setAttribute("placeholder", "Ext Socket Remote IP");
        settingsFields.extsocketremoteip = buttons_extsocketremoteip;

        addTooltipTranslation(settingsFields.pbxname, "buttons_pbxname_tooltip");
        addTooltipTranslation(settingsFields.hwid, "buttons_h323_tooltip");
        addTooltipTranslation(settingsFields.e164, "buttons_e164_tooltip");
        addTooltipTranslation(settingsFields.httppath, "buttons_httppath_tooltip");
        addTooltipTranslation(settingsFields.httpkey, "buttons_httpkey_tooltip");
        addTooltipTranslation(settingsFields.extsocketpath, "buttons_extSocketPath_tooltip");
        addTooltipTranslation(settingsFields.extsocketremoteip, "buttons_extsocketremoteip_tooltip");

        settingsValidators = [

            // Required
            {
                field: settingsFields.pbxname,
                value: function () { return settingsFields.pbxname.getValue(); },
                msg: "Required"
            },

            // Optional
            {
                field: settingsFields.e164,
                value: function () { return settingsFields.e164.getValue(); },
                validator: optional(isValidE164),
                msg: "Invalid E.164 number"
            },
            {
                field: settingsFields.httppath,
                value: function () { return settingsFields.httppath.getValue(); },
                validator: optional(isValidHttpPath),
                msg: "Invalid HTTP path"
            },
            {
                field: settingsFields.extsocketpath,
                value: function () { return settingsFields.extsocketpath.getValue(); },
                validator: optional(isValidHttpPath),
                msg: "Invalid WebSocket path"
            },
            {
                field: settingsFields.extsocketremoteip,
                value: function () { return settingsFields.extsocketremoteip.getValue(); },
                validator: optional(isValidIPv4),
                msg: "Invalid IPv4 address"
            }
        ];


        function validateSettings() {
            var ok = validateRequiredField(settingsValidators);
            setButtonDisabled(settingsOkBtn, !ok);
            return ok;
        }
        function wireLive(fieldObj) {
            if (!fieldObj) return;
            if (fieldObj.input && fieldObj.input.container) {
                fieldObj.input.container.oninput = function () {
                    if (fieldObj.setError) fieldObj.setError(false);
                    validateSettings();
                };
                fieldObj.input.container.onchange = function () {
                    if (fieldObj.setError) fieldObj.setError(false);
                    validateSettings();
                };
            }
        }

        wireLive(settingsFields.pbxname);
        if (settingsCache) applySettingsToUi(settingsCache);
        else instance.send({ api: "Config", mt: "ReadConfig" });
        validateSettings();

    }
    function applySettingsToUi(cfg) {
        if (!settingsFields) return;
        cfg = cfg || {};

        if (cfg.pbxname !== undefined && settingsFields.pbxname) settingsFields.pbxname.setValue(cfg.pbxname);
        if (cfg.hwid !== undefined && settingsFields.hwid) settingsFields.hwid.setValue(cfg.hwid);
        if (cfg.e164 !== undefined && settingsFields.e164) settingsFields.e164.setValue(cfg.e164);
        if (cfg.httppath !== undefined && settingsFields.httppath) settingsFields.httppath.setValue(cfg.httppath);
        if (cfg.httpkey !== undefined && settingsFields.httpkey) settingsFields.httpkey.setValue(cfg.httpkey);
        if (cfg.extsocketpath !== undefined && settingsFields.extsocketpath) settingsFields.extsocketpath.setValue(cfg.extsocketpath);
        if (cfg.extsocketremoteip !== undefined && settingsFields.extsocketremoteip) settingsFields.extsocketremoteip.setValue(cfg.extsocketremoteip);
    }

    function pbx(msg) {
        if (msg.mt == "GetAppObjectsResult") {
            for (var i = 0; i < msg.objects.length; i++) {
                buttonsList.add(new buttons(msg.objects[i]));
            }
            templatesList = [];
            templatesListCn = [];
            src.send({ mt: "GetConfigObjects", api: "PbxAdminApi" });
        }
        else if (msg.mt == "GetConfigObjectsResult") {
            for (var i = 0; i < msg.objects.length; i++) {
                templatesListCn[templatesListCn.length] = msg.objects[i].cn;
            }
            if (templatesListCn.length > 0) src.send({ mt: "GetObject", api: "PbxAdminApi", cn: templatesListCn[0] });
        }
        else if (msg.mt == "GetObjectResult") {
            var tmpl = new Object();
            tmpl.apps = msg.apps ? msg.apps.split(",") : [];
            tmpl.cn = msg.cn;
            tmpl.guid = msg.guid;
            templatesList[templatesList.length] = tmpl;
            templatesListCn.splice(templatesListCn.indexOf(msg.cn), 1);
            if (templatesListCn.length > 0) src.send({ mt: "GetObject", api: "PbxAdminApi", cn: templatesListCn[0] });
        }
    }

    function buttons(obj) {

        if (obj.type == undefined) {
            obj.type = 0;
            if (obj.url.slice(obj.url.lastIndexOf("/")) == typeUrl[0]) obj.type = 0;
            else if (obj.url.slice(obj.url.lastIndexOf("/")) == typeUrl[1]) obj.type = 1;
        }

        this.createNode("div", null, null, "innovaphone-buttons-obj").testId("innovaphone-buttons-obj-" + obj.sip);
        this.addEvent("click", onedit);
        var appName = this.add(new innovaphone.ui1.Div("width:100px; font-size:15px; color:var(--innovaphone-buttons-item-text);", null, "innovaphone-buttons-label2")).addTranslation(texts, typeText[obj.type]);
        var header = this.add(new innovaphone.ui1.Div(null, null, "innovaphone-buttons-header"));
        var title = header.add(new Text("title", obj.title, 120, 100));
        var sip = header.add(new Text("sip", obj.sip, 120));
        var url = header.add(new Text("url", obj.url.slice(obj.url.lastIndexOf("/")), 220));

        var src = new app.Src(result);
        src.send({ mt: "GetAppLogin", api: "PbxAdminApi", challenge: "1234", app: obj.sip });
        function result(msg) {
            var isrc = new instance.Src(check);
            isrc.send({ mt: "AppCheckLogin", app: msg.app, domain: msg.domain, challenge: "1234", digest: msg.digest });
            function check(msg) {
                if (msg.ok) {
                    if (!copyPwd) copyPwd = obj.sip;
                    header.add(new innovaphone.ui1.SvgInline("position:relative; width:20px; height:20px; margin:5px; fill:var(--innovaphone-buttons-green)", "0 0 20 20", "<path d=\'M6.67,17.5,0,10.81,1.62,9.18l5.05,5.06L18.38,2.5,20,4.13Z'/>"));
                }
            }
        }
        function onedit() {
            panel.clear();
            panel2.clear();
            var header = panel.add(new innovaphone.ui1.Div("position:absolute; box-sizing:border-box; padding:10px; width:100%; color: var(--innovaphone-buttons-c2); font-size: 18px;")).addTranslation(texts, "editapp");
            var content = panel.add(new innovaphone.ui1.Scrolling("position:absolute; width:100%; top:50px; bottom:40px; margin-top: 5px;", -1, -1, 9, "red"));
            new Editbuttons(obj, content);
        }
    }
    buttons.prototype = innovaphone.ui1.nodePrototype;

    function Editbuttons(obj, content) {
        var footer = panel.add(new innovaphone.ui1.Div("position:absolute; width:100%; bottom:0px; height:40px"));
        if (obj.guid) footer.add(new innovaphone.ui1.Div("left:10px; bottom:10px", null, "innovaphone-buttons-button")).addTranslation(texts, "del").addEvent("click", ondel).testId("innovaphone-buttons-del");
        footer.add(new innovaphone.ui1.Div("right:140px; bottom:10px", null, "innovaphone-buttons-button")).addTranslation(texts, "ok").addEvent("click", onok).testId("innovaphone-buttons-ok");
        footer.add(new innovaphone.ui1.Div("right:10px; bottom:10px", null, "innovaphone-buttons-button")).addTranslation(texts, "cancel").addEvent("click", oncancel).testId("innovaphone-buttons-cancel");

        var general = content.add(new innovaphone.ui1.Div("position:relative; display:flex; flex-wrap: wrap;"));
        var title = general.add(new ConfigText("title", obj.title, 150)).testId("innovaphone-buttons-cn");
        var sip = general.add(new ConfigText("sip", obj.sip, 150)).testId("innovaphone-buttons-sip");
        var tmp = [];
        var tmpSelected = [];
        for (var i = 0; i < templatesList.length; i++) {
            tmp[i] = general.add(new ConfigTemplate(obj.sip, templatesList[i])).testId("innovaphone-buttons-temp-" + templatesList[i].cn);
        }

        function ondel() {
            var src = new app.Src(result);
            src.send({ mt: "DeleteObject", api: "PbxAdminApi", guid: obj.guid });

            function result() {
                src.close();
                read();
            }
        }

        function onok() {
            var src = new app.Src(result);
            var pwd = innovaphone.Manager.randomPwd(16);
            tmpSelected = [];
            for (var i = 0; i < tmp.length; i++) {
                if (tmp[i].getValue()) tmpSelected[tmpSelected.length] = tmp[i].getLabel();
            }
            var appObj = { url: item.httpsUri.slice(0, item.httpsUri.lastIndexOf("/")) + typeUrl[obj.type] };
            for (var key in typeCheckmarks[obj.type]) appObj[key] = typeCheckmarks[obj.type][key];
            src.send({ mt: "UpdateObject", api: "PbxAdminApi", hide: true, critical: true, copyPwd: copyPwd, cn: title.getValue(), guid: obj.guid, h323: sip.getValue(), pwd: pwd, pseudo: { type: "app", app: appObj } });

            function result(msg) {
                if (!msg.error) {
                    if (msg.mt == "UpdateObjectResult") {
                        var sent = false;
                        if (tmp.length > 0) {
                            for (var i = 0; i < templatesList.length; i++) {
                                if (templatesList[i].cn == tmp[0].getLabel()) {
                                    var selected = tmp[0].getValue();
                                    tmp.splice(0, 1);
                                    if (selected && templatesList[i].apps.indexOf(sip.getValue()) < 0) {
                                        templatesList[i].apps[templatesList[i].apps.length] = sip.getValue();
                                        src.send({ mt: "UpdateObject", api: "PbxAdminApi", cn: templatesList[i].cn, guid: templatesList[i].guid, apps: templatesList[i].apps.join(",") });
                                        sent = true;
                                        break;
                                    }
                                    else if (!selected && templatesList[i].apps.indexOf(sip.getValue()) >= 0) {
                                        templatesList[i].apps.splice(templatesList[i].apps.indexOf(sip.getValue()), 1);
                                        src.send({ mt: "UpdateObject", api: "PbxAdminApi", cn: templatesList[i].cn, guid: templatesList[i].guid, apps: templatesList[i].apps.join(",") });
                                        sent = true;
                                        break;
                                    }
                                }
                            }
                        }
                        if (!sent) setPwd();
                    }

                    function setPwd() {
                        src.close();
                        if (copyPwd) {
                            read();
                        }
                        else {
                            src = new managerApi.Src(result);
                            src.send({ mt: "SetInstancePassword", path: item.apUri.slice(0, item.apUri.lastIndexOf("/")), pwd: pwd }, item.ap);
                            function result() {
                                src.close();
                                read();
                            }
                        }
                    }
                }
                else {
                    title.setError(true);
                }
            }
        }

        function oncancel() {
            read();
        }
    }
    Editbuttons.prototype = innovaphone.ui1.nodePrototype;

    function Text(label, text, width, lwidth) {
        this.createNode("div", "position:relative; display:flex");
        this.add(new innovaphone.ui1.Div(lwidth ? "width:" + lwidth + "px" : null, null, "innovaphone-buttons-label")).addTranslation(texts, label);
        var text = this.add(new innovaphone.ui1.Div("width:" + width + "px", text, "innovaphone-buttons-value"));
        this.set = function (t) { text.container.innerText = t; };
    }
    Text.prototype = innovaphone.ui1.nodePrototype;

    function ConfigText(label, text, width) {
        this.createNode("div", "position:relative; display:flex");
        var label = this.add(new innovaphone.ui1.Div(null, null, "innovaphone-buttons-label")).addTranslation(texts, label);
        var inputDiv = this.add(new innovaphone.ui1.Div("position:relative; width:" + width + "px"));
        var input = inputDiv.add(new innovaphone.ui1.Input(null, text, null, 100, null, "innovaphone-buttons-input"));

        this.getValue = function () { return input.getValue(); };
        this.setValue = function (value) { input.setValue(value); };
        this.testId = function (id) { input.testId(id); return this; };
        this.setError = function (on) { input.container.style.border = (on ? "1px solid red" : null); };
    }
    ConfigText.prototype = innovaphone.ui1.nodePrototype;

    // Config Text with changed stylesheet, used for the settings panel
    function ConfigText2(label, text, width) {
        this.createNode("div", "position:relative; display:flex; align-items:center; margin-bottom:12px;");
        var label = this.add(new innovaphone.ui1.Div("width:250px; flex-shrink:0;", null, "innovaphone-buttons-label")).addTranslation(texts, label);
        var inputDiv = this.add(new innovaphone.ui1.Div("position:relative; width:" + width + "px"));
        var input = inputDiv.add(new innovaphone.ui1.Input(null, text, null, 100, null, "innovaphone-buttons-input"));
        input.container.oninput = function () { setFieldErrorStyle(input.container, false); };
        var err = this.add(new innovaphone.ui1.Div("margin-left:250px; margin-top:2px; font-size:12px; color:#e53935; display:none;"));

        this.getValue = function () { return input.getValue(); };
        this.setValue = function (value) { input.setValue(value); };
        this.testId = function (id) { input.testId(id); return this; };
        // error handler with tooltips
        this.setError = function (on, msg) {
            setFieldErrorStyle(input.container, !!on);
            if (on) { err.container.style.display = "block"; err.container.innerText = msg || "Required"; }
            else { err.container.style.display = "none"; err.container.innerText = ""; }
        };
        this.setTooltip = function (t) { setTooltip(input.container, t); };
        this.input = input;
        this.setAttribute = function (name, value) { input.container.setAttribute(name, value); };
        this.input = input;
    }
    ConfigText2.prototype = innovaphone.ui1.nodePrototype;
    function ConfigTemplate(sip, template) {
        this.createNode("div", "position:relative; display:flex; margin-right: 5px;");
        var checkbox = this.add(new innovaphone.ui1.Checkbox("position:relative; margin: 7px 0px 7px 15px; width: 20px; height:20px; background-color:var(--innovaphone-buttons-green);", false, null, "var(--innovaphone-buttons-green)", "white", "var(--innovaphone-buttons-c1)"));
        var label = this.add(new innovaphone.ui1.Div("padding: 3px 5px 3px 0px;", template.cn, "innovaphone-buttons-label"));
        if (template.apps.indexOf(sip) >= 0) checkbox.setValue(true);

        this.getValue = function () { return checkbox.getValue(); };
        this.setValue = function (value) { checkbox.setValue(value); };
        this.getLabel = function () { return label.container.innerText; };
        this.testId = function (id) { checkbox.testId(id); return this; };
        this.setError = function (on) { label.container.style.border = (on ? "1px solid red" : null); };
    }
    ConfigTemplate.prototype = innovaphone.ui1.nodePrototype;
}
plugin.innovaphone.buttonsmanager.prototype = innovaphone.ui1.nodePrototype;
