var pbxapiconns = [];
var rccapiconns = [];
var userconn = [];
var lastcallid = 0;
var message_calls = [];
var mwi_served_user = [];
var mwi_message_center = [];
var mwi_calls = [];
var messages = [];
var phonemessages = [];
var queues = [];
var queueids = [];
var queuecalls = [];
var callTimers = {};
var rccSrcMap = [];
var actionTimers = {};
var serviceApiTimer = false;
var logFilters = [];

var pbxname = Config.pbxname;
var buttonuserhwid = Config.hwid;
var buttonusere164 = Config.e164;
var httpkey = Config.httpkey;
var httppath = Config.httppath;

var extSocketPath = Config.extsocketpath;
var extSocketRemoteIp = Config.extsocketremoteip;

var appObjectName = "buttons";

var shellyDeviceConfigs = {
    "shellyplusi4": {
        "single_push": 1,
        "double_push": 2,
        "triple_push": 3,
        "long_push": 4,
        "btn_up": 5,
        "btn_down": 6
    },
    "shellyi4g3": {
        "single_push": 1,
        "double_push": 2,
        "triple_push": 3,
        "long_push": 4,
        "btn_up": 5,
        "btn_down": 6
    },
    "shellyplus1": {
        "single_push": 1,
        "double_push": 2,
        "triple_push": 3,
        "long_push": 4,
        "btn_up": 5,
        "btn_down": 6
    }
};

var shellyDefaultConfig = {
    "single_push": 1,
    "double_push": 2,
    "triple_push": 3,
    "long_push": 4,
    "btn_up": 5,
    "btn_down": 6
};


Config.onchanged(function () {
    pbxname = Config.pbxname;
    buttonuserhwid = Config.hwid;
    buttonusere164 = Config.e164;
    httppath = Config.httppath;
    httpkey = Config.httpkey;
    extSocketPath = Config.extsocketpath;
    extSocketRemoteIp = Config.extsocketremoteip;
});

Database.exec("SELECT * from mwi")
    .oncomplete(function (data) {
        data.forEach(function (row) {
            row.sip = String(row.sip);
            mwi_served_user[row.sip] = JSON.parse(row.served_user);
            mwi_message_center[row.sip] = JSON.parse(row.message_center);
        });
    })
    .onerror(function (error, errorText, dbErrorCode) {
        // Error handling
    });

Database.exec("SELECT * from rcc")
    .oncomplete(function (data) {
        data.forEach(function (row) {
            row.cn = String(row.cn);
            pbx = String(row.pbx) || "";
            queues.push({ cn: row.cn, pbx: pbx });
        });
    })
    .onerror(function (error, errorText, dbErrorCode) {
        // Error handling
    });

Database.exec("SELECT cn FROM pbx_waiting")
    .oncomplete(function (data) {
        data.forEach(function (row) {
            var cn = String(row.cn);
            var pbx = Config.pbxname || "";
            var exists = queues.some(function (q) { return q.cn === cn; });
            if (!exists) queues.push({ cn: cn, pbx: pbx });
        });
    })
    .onerror(function () { });


new JsonApi("user").onconnected(function (conn) {
    if (conn.app == "innovaphone-buttons") {
        userconn.push(conn);
        conn.onmessage(function (msg) {
            var obj = JSON.parse(msg);
            if (obj.mt == "UserMessage") {
                conn.send(JSON.stringify({ api: "user", mt: "UserMessageResult", src: obj.src }));
            }
            if (obj.mt == "getNewDevices") {
                for (var i = 0; i < newdevices.length; i++) {
                    conn.send(JSON.stringify({ api: "user", mt: "getNewDevicesResult", id: newdevices[i].id, mac: newdevices[i].mac, ip: newdevices[i].ip }));
                }
            }
            if (obj.mt == "getOnlineDevices") {
                for (var i = 0; i < onlinedevices.length; i++) {
                    conn.send(JSON.stringify({ api: "user", mt: "getOnlineDevicesResult", id: onlinedevices[i].id, mac: onlinedevices[i].mac, ip: onlinedevices[i].ip }));
                }
            }
            if (obj.mt == "addDevices") {
                var secret = Random.string(32);
                Database.exec("UPDATE devices SET secret = '" + secret + "' WHERE dev_id = '" + obj.id + "' RETURNING id")
                    .oncomplete(function (data) {
                        data.forEach(function (data) {
                            newconnections[obj.id].send(JSON.stringify({ mt: "NewSecret", secret: secret }));
                        });
                    })
                    .onerror(function (error, errorText, dbErrorCode) { });
            }
            if (obj.mt == "StartHotkey") {
                if (obj.hotkey) {
                    dohotkeyaction(conn.sip, obj.hotkey);
                }
            }
        });
    }
    conn.onclose(function () {
        log("User: disconnected " + conn.sip);
        userconn.splice(userconn.indexOf(conn), 1);
    });
});

new JsonApi("admin").onconnected(function (conn) {
    if (conn.app == "innovaphone-buttonsadmin") {
        userconn.push(conn);
        conn.onmessage(function (msg) {
            var obj = JSON.parse(msg);
            if (obj.mt == "UserMessage") {
                conn.send(JSON.stringify({ api: "admin", mt: "UserMessageResult", src: obj.src }));
            }
            if (obj.mt == "getNewDevices") {
                for (var i = 0; i < newdevices.length; i++) {
                    conn.send(JSON.stringify({ api: "admin", mt: "getNewDevicesResult", id: newdevices[i].id, mac: newdevices[i].mac, ip: newdevices[i].ip }));
                }
            }
            if (obj.mt == "getOnlineDevices") {
                for (var i = 0; i < onlinedevices.length; i++) {
                    conn.send(JSON.stringify({ api: "admin", mt: "getOnlineDevicesResult", id: onlinedevices[i].id, mac: onlinedevices[i].mac, ip: onlinedevices[i].ip }));
                }
            }
            if (obj.mt == "addDevices") {
                var secret = Random.string(32);
                Database.exec("UPDATE devices SET secret = '" + secret + "' WHERE dev_id = '" + obj.id + "' RETURNING id")
                    .oncomplete(function (data) {
                        data.forEach(function (data) {
                            newconnections[obj.id].send(JSON.stringify({ mt: "NewSecret", secret: secret }));
                        });
                    })
                    .onerror(function (error, errorText, dbErrorCode) { });

            }
            if (obj.mt === "SqlInsertBackend" && obj.statement === "add-queue") {
                var cn = String((obj.args && obj.args.queue) || "");
                if (!cn) return;

                Database.exec("INSERT INTO rcc (cn, pbx) VALUES ('" +
                    Database.escape(cn) + "', '" +
                    Database.escape(pbx || "") + "') RETURNING id"
                ).oncomplete(function (data) {
                    adminConn.send(JSON.stringify({
                        mt: "SqlInsertBackendResult",
                        src: obj.src,
                        statement: obj.statement,
                        id: (data && data[0] && data[0].id) ? data[0].id : null
                    }));
                });
                return;
            }

            if (obj.mt == "GetConnectedShellyDevices") {
                shellyconns.forEach(function (shelly) {
                    conn.send(JSON.stringify({ api: "admin", mt: "GetConnectedShellyDevicesResult", name: shelly.devicename }));
                });
                conn.send(JSON.stringify({ api: "admin", mt: "GetConnectedShellyDevicesResult", count: shellyconns.length }));
            }
            if (obj.mt == "SqlInsertBackend" || obj.mt == "SqlExecBackend") {
                if (obj.statement == "add-device") {
                    addDevice(conn, obj);
                }
                if (obj.statement == "set-action-logging") {
                    setActionLogging(conn, obj);
                }
            }
        });
    }
    conn.onclose(function () {
        log("User: disconnected " + conn.sip);
        userconn.splice(userconn.indexOf(conn), 1);
    });
});

var newconnections = [];
var connections = [];
var newdevices = [];
var onlinedevices = [];
var shellymessages = [];

function addShellyLog(value) {
    shellymessages.push(value);
    if (shellymessages.length > 10) {
        shellymessages.shift();
    }
}

// Socket for ESP 8266 Testdevices
WebServer.onwebsocket("devices", function (websocket) {
    var deviceId = "";
    var deviceMac = "";
    var deviceIp = "";
    var authenticated = false;
    var salt = Random.string(8);
    var secret = "";
    var digest = "";
    var digest_new = "";
    websocket.send(JSON.stringify({ mt: "Identify" }));
    websocket.onmessage(function (ws, msg, isBinary) {
        if (isBinary) {
        }
        else if (authenticated === false) {
            if (isValidJSON(msg)) {
                var obj = JSON.parse(msg);
                log(msg);
                if (obj.mt == "IdentifyResult") {
                    deviceId = obj.id;
                    deviceMac = obj.mac;
                    deviceIp = obj.ip;
                    Database.exec("SELECT secret FROM devices WHERE dev_id = '" + deviceId + "'")
                        .oncomplete(function (data) {
                            if (data[0] != undefined) {
                                secret = data[0].secret.slice(0, -1);
                                //log("Connection from: " + deviceId + " Secret: " + secret + " Salt:" + salt);
                                websocket.send(JSON.stringify({ mt: "Authenticate", salt: salt }));
                                digest = Crypto.hash("SHA256").update(deviceId.toString()).update(secret.toString()).update(salt.toString()).final();
                            }
                            else {
                                //log("New Connection from: " + deviceId + "  Mac: " + deviceMac);
                                digest_new = Crypto.hash("SHA256").update(deviceId.toString()).update(salt.toString()).final();
                                websocket.send(JSON.stringify({ mt: "Authenticate", salt: salt }));
                            }

                        })
                        .onerror(function (error, errorText, dbErrorCode) { });
                }
                if (obj.mt == "AuthenticateResult") {
                    //log("Serverside Digest: " + digest);
                    //log("Serverside Digest New: " + digest_new);
                    //log("Clientside Digest: " + obj.answer);
                    if (obj.answer === salt) {
                        newconnections[deviceId] = websocket;
                        newdevices.push({ "id": deviceId, "mac": deviceMac, "ip": deviceIp });
                    }
                    else if (obj.answer === digest) {
                        log("Digest Ok")
                        authenticated = true;
                        connections[deviceId] = websocket;
                        onlinedevices.push({ "id": deviceId, "mac": deviceMac, "ip": deviceIp });
                        userconn.forEach(function (conn) {
                            conn.send(JSON.stringify({ api: "user", mt: "getOnlineDevicesResult", id: deviceId, mac: deviceMac, ip: deviceIp }));
                        });
                    }
                    else if (obj.answer === digest_new) {
                        log("Digest Ok - New Devics")
                        newconnections[deviceId] = websocket;
                        newdevices.push({ "id": deviceId, "mac": deviceMac, "ip": deviceIp });
                        userconn.forEach(function (conn) {
                            conn.send(JSON.stringify({ api: "user", mt: "getNewDevicesResult", id: deviceId, mac: deviceMac, ip: deviceIp }));
                        });
                    }
                    else {
                        newconnections[deviceId] = websocket;
                        newdevices.push({ "id": deviceId, "mac": deviceMac, "ip": deviceIp });
                        userconn.forEach(function (conn) {
                            conn.send(JSON.stringify({ api: "user", mt: "getNewDevicesResult", id: deviceId, mac: deviceMac, ip: deviceIp }));
                        });
                    }

                }

            }
        }
        else if (authenticated === true) {
            var obj = JSON.parse(msg);
            if (obj.mt == "switch") {
                log("Device: " + deviceId + " Switch:" + obj.key);
                Database.exec("SELECT action, sip, text FROM devices WHERE dev_id = '" + deviceId + "'")
                    .oncomplete(function (data) {
                        data.forEach(function (data) {
                            if (data.action == "chat") {
                                log("Chat to: " + data.sip + " Text: " + data.text);
                                sendMessage(data.sip, data.text);
                            }
                            else if (data.action == "notify") {
                                pbxapiconns.forEach(function (pbxapiconn) {
                                    if (pbxapiconn.pbx == pbxname) {
                                        pbxapiconn.send(JSON.stringify({ api: "PbxApi", mt: "AppNotify", sip: data.sip, title: "Buttons", text: data.text }));
                                    }
                                });
                            }
                            else if (data.action == "chat+notify") {
                                log("Chat to: " + data.sip + " Text: " + data.text);
                                if (pbxapiconn.pbx == pbxname) {
                                    pbxapiconn.send(JSON.stringify({ api: "PbxApi", mt: "AppNotify", sip: data.sip, title: "Buttons", text: data.text }));
                                }
                                sendMessage(data.sip, data.text);
                            }
                            else if (data.action == "toggle-working") {
                                log("Toggle Working: " + data.sip);
                                appwebsocket_working.send(JSON.stringify({ mt: "GetStatus", api: "--innovaphone-client-working-api", sip: data.sip, src: "toggle-xxxxx-" + data.sip }));
                            }
                        });
                    })
                    .onerror(function (error, errorText, dbErrorCode) { });
            }
        }

    });
    websocket.onclose(function () {
        log("connection closed from: " + deviceId);
        onlinedevices.splice(onlinedevices.indexOf(deviceId), 1);
        newdevices.splice(newdevices.indexOf(deviceId), 1);
    })
});


// Socket for shelly Devices
var shellyconns = [];

WebServer.onwebsocket("shelly", function (websocket) {
    var devicename = false;
    shellyconns.push(websocket);
    websocket.onmessage(function (ws, msg, isBinary) {
        if (!isBinary && isValidJSON(msg)) {
            log("===ShellySocket===" + msg);
            var obj = JSON.parse(msg);
            addShellyLog(msg);
            var src = obj.src.split("-");
            var devicetype = src[0];
            var deviceserial = src[1];
            if (devicename) {
                //nothing
            }
            else {
                devicename = obj.src;
                websocket.devicename = obj.src;
            }


            if (obj.params && ('switch:0' in obj.params || 'switch:1' in obj.params || (obj.params.events && obj.params.events[0] && obj.params.events[0].component))) {
                var component = [];
                if (obj.params["switch:0"]) {
                    component[0] = "switch";
                    component[1] = "0";
                }
                else if (obj.params["switch:1"]) {
                    component[0] = "switch";
                    component[1] = "1";
                }
                else {
                    component = obj.params.events[0].component.split(":");
                }

                var address = deviceserial + "-" + component[1];

                if (component[0] == "input") {
                    var event = null;
                    if (obj && obj.params && obj.params.events && obj.params.events[0] && obj.params.events[0].event) {
                        event = obj.params.events[0].event;
                    }

                    log("Shelly Direct Input of Device " + address + " Event: " + event);

                    if (!event) {
                        log("No event found, ignoring.");
                        return;
                    }

                    var config = shellyDeviceConfigs[devicetype];
                    if (!config) {
                        log("Unknown device '" + devicetype + "', using default event interpretation.");
                        config = shellyDefaultConfig;
                    }

                    var button = config[event];
                    if (button == null) {
                        log("Event '" + event + "' not recognized in config for device '" + devicetype + "'.");
                        return;
                    }

                    var data = {
                        address: address,
                        button: button
                    };

                    doaction(data.button, data.address, obj.src, false, function (error, responseData) {
                        if (error) {
                            log(error, responseData);
                        }
                    });
                }
                else if (component[0] == "switch") {
                    var output = 5;
                    if (component[1] === "0") {
                        if (obj.params["switch:0"].output == true) {
                            output = 6;
                        }
                    }
                    else if (component[1] === "1") {
                        if (obj.params["switch:1"].output == true) {
                            output = 6;
                        }
                    }

                    var data = {
                        address: address,
                        button: output
                    };

                    doaction(data.button, data.address, obj.src, false, function (error, responseData) {
                        if (error) {
                            log(error, responseData);
                        }
                    });
                }
                else {
                    if (obj.params.events[0].data) {
                        var data = obj.params.events[0].data;
                        if (Array.isArray(data.button)) {
                            data.button.forEach(function (button, index) {
                                if (button != 0 && button != 254 && button != 128) {
                                    doaction(button, data.address + "-" + index, obj.src, data.rssi, function (error, responseData) {
                                        if (error) {
                                            log(error, responseData);
                                        }
                                    });
                                }
                            });
                        }
                        else if (data.button !== undefined) {
                            doaction(data.button, data.address, obj.src, data.rssi, function (error, responseData) {
                                if (error) {
                                    log(error, responseData);
                                }
                            });
                        }
                        if (data.motion !== undefined) {
                            doaction(data.motion, data.address, obj.src, data.rssi, function (error, responseData) {
                                if (error) {
                                    log(error, responseData);
                                }
                            });
                        }
                        if (data.window !== undefined) {
                            doaction(data.window, data.address, obj.src, data.rssi, function (error, responseData) {
                                if (error) {
                                    log(error, responseData);
                                }
                            });
                        }
                    }
                }
            }
        }
    });

    websocket.onclose(function () {
        log("connection closed");
        shellyconns.splice(shellyconns.indexOf(websocket), 1);
    });
});

// Webserver for Datafox - Integration
WebServer.onrequest("datafox", function (req) {
    if (req.method === "GET") {
        var relativeUri = req.relativeUri;

        // Extrahiere den 'button'- und 'id'-Parameter aus relativeUri
        var button = getQueryParameterValue(relativeUri, "df_col_action");
        var id = getQueryParameterValue(relativeUri, "df_col_mac");
        var table = getQueryParameterValue(relativeUri, "df_table");
        log("Received request from Datafox: " + relativeUri);

        if (table == "Alive" || table == "System") {
            req.responseContentType("application/x-www-form-urlencoded; charset=ISO-8859-1")
                .sendResponse(200)
                .onsend(function (req) {
                    var message = "df_api=1";
                    req.send(message, true);
                });
        }
        else {
            if (button && id) {
                var htmlResponse = "";
                if (id == "1") {
                    htmlResponse = 'df_api=1&df_msg=Willkommen';
                }
                else {
                    htmlResponse = 'df_api=1&df_msg=Auf Wiedersehen';
                }
                doaction(button, id, null, null, function (error, data) {
                    if (error) {
                        log("Error during action: " + error.message);
                        req.responseContentType("text/html; charset=ISO-8859-1")
                            .sendResponse(200)
                            .onsend(function (req) {
                                req.send(htmlResponse, true);
                            });
                    } else if (data) {
                        log("Action succeeded with data: " + data);
                        req.responseContentType("text/html; charset=ISO-8859-1")
                            .sendResponse(200)
                            .onsend(function (req) {
                                req.send(htmlResponse, true);
                            });

                    } else {
                        log("No data returned from action");
                        req.responseContentType("text/html; charset=ISO-8859-1")
                            .sendResponse(200)
                            .onsend(function (req) {
                                req.send(htmlResponse, true);
                            });

                    }
                });
            } else {
                log("Invalid parameters: button or id is missing");
                req.responseContentType("text/html; charset=ISO-8859-1")
                    .sendResponse(200)
                    .onsend(function (req) {
                        req.send(htmlResponse, true);
                    });

            }
        }
    }
});

// Webserver for myStrom Button Requests
WebServer.onrequest("gen", function (req) {
    if (req.method === "GET") {
        var relativeUri = req.relativeUri;

        // Extrahiere den 'button'- und 'id'-Parameter aus relativeUri
        var button = getQueryParameterValue(relativeUri, "action");
        var id = getQueryParameterValue(relativeUri, "mac");

        log("Received request with button: " + button + ", id: " + id);

        if (button && id) {
            doaction(button, id, null, null, function (error, data) {
                if (error) {
                    log("Error during action: " + error.message);
                    req.responseContentType("json")
                        .sendResponse(200)
                        .onsend(function (req) {
                            req.send(new TextEncoder("utf-8").encode(JSON.stringify({ error: error.message })), true);
                        });
                } else if (data) {
                    log("Action succeeded with data: " + data);
                    req.responseContentType("json")
                        .sendResponse(200)
                        .onsend(function (req) {
                            req.send(new TextEncoder("utf-8").encode(JSON.stringify({ "ison": false, "has_timer": false, "timer_started": 0, "timer_duration": 0, "timer_remaining": 0, "source": "http" })), true);
                        });
                } else {
                    log("No data returned from action");
                    req.responseContentType("json")
                        .sendResponse(200)
                        .onsend(function (req) {
                            req.send(new TextEncoder("utf-8").encode(JSON.stringify({ error: "No data found" })), true);
                        });
                }
            });
        } else {
            log("Invalid parameters: button or id is missing");
            req.responseContentType("json")
                .sendResponse(200)
                .onsend(function (req) {
                    req.send(new TextEncoder("utf-8").encode(JSON.stringify({ error: "Invalid parameters" })), true);
                });
        }
    } else {
        log("Invalid request method: " + req.method);
        req.responseContentType("json")
            .sendResponse(200)
            .onsend(function (req) {
                req.send(new TextEncoder("utf-8").encode(JSON.stringify({ error: "Invalid request method" })), true);
            });
    }
});

// Webserver api, only needed for Servicechecks
WebServer.onrequest("api", function (req) {
    if (req.method === "GET") {
        req.responseContentType("txt")
            .sendResponse(200)
            .onsend(function (req) {
                req.send(new TextEncoder("utf-8").encode("ok"), true);
            });
    }
});

// Webserver extapi => configured in SettingsPlugin from PBX
WebServer.onrequest("extapi", function (req) {
    if (req.method === "GET") {
        var path = req.relativeUri.split("?");
        log(path[0]);
        if (httppath) {
            if (path[0] === "/" + httppath) {
                var relativeUri = req.relativeUri;
                var key = getQueryParameterValue(relativeUri, "key");
                var type = getQueryParameterValue(relativeUri, "type");
                var src = getQueryParameterValue(relativeUri, "src");
                var dst = getQueryParameterValue(relativeUri, "dst");
                var msg = getQueryParameterValue(relativeUri, "msg");
                var callto = getQueryParameterValue(relativeUri, "callto");
                var srcqueue = getQueryParameterValue(relativeUri, "queue");
                var numbers = [];
                if (callto) {
                    numbers = callto.split(',');
                }
                var tags = ["buttons"];
                var rawTags = getQueryParameterValue(relativeUri, "tags");

                if (rawTags && typeof rawTags === "string") {
                    var gettags = rawTags.split(',').map(function (tag) {
                        return tag.trim();
                    });

                    if (gettags.length > 0 && gettags[0] !== "") {
                        tags = gettags;
                    }
                }

                if (key === httpkey) {
                    var guid = generateGUID();
                    var data = {};
                    data.action = Database.escape(type);
                    data.sip = Database.escape(dst);
                    data.text = Database.escape(relativeUri);
                    inserthistory(guid, "Webhook", Database.escape(type), data);
                    if (type == "connect") {
                        if (dst[0] === "@") {
                            appsocket_connect.send(JSON.stringify({ "mt": "Post", src: guid, discussionGuid: guid, "topic": appObjectName, "text": "@" + dst + " " + msg, "notify": ["?" + dst.substring(1)], "tags": tags, "private": false, "attaching": 0, "discussionTitle": "#Buttons" }));
                        } else {
                            appsocket_connect.send(JSON.stringify({ "mt": "Post", src: guid, discussionGuid: guid, "topic": appObjectName, "text": "@" + dst + " " + msg, "notify": ["" + dst + ""], "tags": tags, "private": false, "attaching": 0, "discussionTitle": "#Buttons" }));
                        }
                        if (numbers.length > 0) {
                            numbers.forEach(function (number) {
                                log("Start Call To: " + number);
                                const result = queues.find(function (queue) {
                                    return queue.cn === srcqueue;
                                });
                                if (result) {
                                    sendCall(result.pbx, srcqueue, number, guid);
                                } else {
                                    log("===ERROR=== No PBX Found for " + data.text);
                                }
                            });
                        }
                        req.responseContentType("txt")
                            .sendResponse(200)
                            .onsend(function (req) {
                                req.send(new TextEncoder("utf-8").encode("ok"), true);
                            });
                    }
                    else {
                        req.responseContentType("txt")
                            .sendResponse(200)
                            .onsend(function (req) {
                                req.send(new TextEncoder("utf-8").encode("Nothing Happend"), true);
                            });
                    }
                } else {
                    req.cancel(404);
                }
            }
            else {
                req.cancel(500);
            }
        }
        else {
            req.cancel(500);
        }
    }
});

// Universal Websocket Api
WebServer.onwebsocket("extapi", function (websocket) {
    var path = websocket.relativeUri.split("?");
    if (path[0] === "/" + extSocketPath && (websocket.remoteAddr === extSocketRemoteIp || websocket.forwardedFor === extSocketRemoteIp)) {
        websocket.onmessage(function (ws, msg, isBinary) {
            if (!isBinary && isValidJSON(msg)) {
                log("===ExtApi Socket===" + msg);
                var data = JSON.parse(msg);
                if (data.action) {
                    var guid = generateGUID();
                    inserthistory(guid, "extSocket", "extSocket", Database.escape(msg));
                    if (data.action == "chat") {
                        log("Chat to: " + data.sip + " Text: " + data.text);
                        sendMessage(data.sip, data.text);
                    } else if (data.action == "phonemessage") {
                        log("Phonemessage to: " + data.sip + " Text: " + data.text);
                        sendPhoneMessage(data.sip, data.text);
                    } else if (data.action == "notify") {
                        pbxapiconns.forEach(function (pbxapiconn) {
                            if (pbxapiconn.pbx == pbxname) {
                                pbxapiconn.send(JSON.stringify({ api: "PbxApi", mt: "AppNotify", sip: data.sip, title: "Buttons", text: data.text }));
                            }
                        });
                    } else if (data.action == "chat+notify") {
                        log("Chat to: " + data.sip + " Text: " + data.text);
                        pbxapiconns.forEach(function (pbxapiconn) {
                            if (pbxapiconn.pbx == pbxname) {
                                pbxapiconn.send(JSON.stringify({ api: "PbxApi", mt: "AppNotify", sip: data.sip, title: "Buttons", text: data.text }));
                            }
                        });
                        sendMessage(data.sip, data.text);
                    } else if (data.action == "presence") {
                        log("Toggle Presence: " + data.sip + " Presence: " + data.text);

                        var presenceMap = {
                            1: "",
                            2: "away",
                            3: "busy",
                            4: "dnd"
                        };

                        var activity = presenceMap[data.text];
                        if (activity !== undefined) {
                            pbxapiconns.forEach(function (pbxapiconn) {
                                if (pbxapiconn.pbx == pbxname) {
                                    pbxapiconn.send(JSON.stringify({ api: "PbxApi", mt: "SetPresence", sip: data.sip, activity: activity }));
                                }
                            });
                        }
                    } else if (data.action == "working") {
                        var mode = data.text;
                        if (mode == "start") {
                            log("Start Working: " + data.sip);
                            appwebsocket_working.send(JSON.stringify({ mt: "StartWorkingTime", api: "--innovaphone-client-working-api", sip: data.sip, src: data.sip }));
                        } else if (mode == "stop") {
                            log("Stop Working: " + data.sip);
                            appwebsocket_working.send(JSON.stringify({ mt: "StopWorkingTime", api: "--innovaphone-client-working-api", sip: data.sip, src: data.sip }));
                        } else if (mode == "toggle") {
                            log("Toggle Working: " + data.sip);
                            appwebsocket_working.send(JSON.stringify({ mt: "GetStatus", api: "--innovaphone-client-working-api", sip: data.sip, src: "toggle-xxxxx-" + data.sip }));
                        }
                    } else if (data.action == "connect") {
                        if (data.sip[0] === "@") {
                            appsocket_connect.send(JSON.stringify({ "mt": "Post", src: guid, discussionGuid: guid, "topic": appObjectName, "text": "@" + data.sip + " " + data.text, "notify": ["?" + data.sip.substring(1) + ""], "tags": ["Buttons"], "private": false, "attaching": 0, "discussionTitle": "#Buttons" }));
                        }
                        else {
                            appsocket_connect.send(JSON.stringify({ "mt": "Post", src: guid, discussionGuid: guid, "topic": appObjectName, "text": "@" + data.sip + " " + data.text, "notify": ["" + data.sip + ""], "tags": ["Buttons"], "private": false, "attaching": 0, "discussionTitle": "#Buttons" }));
                        }
                    } else if (data.action == "call") {
                        log("Start Call To: " + data.sip);
                        const result = queues.find(function (queue) {
                            return queue.cn === data.text;
                        });
                        if (result) {
                            sendCall(result.pbx, data.text, data.sip, guid);
                        } else {
                            log("===ERROR=== No PBX Found for " + data.text);
                        }
                    }
                    websocket.send(JSON.stringify({ mt: "Result", value: "ok" }));
                }
            }
        });
    }
    else {
        websocket.close();
    }
    websocket.onclose(function () {
        log("Socket for Path: " + path[0] + " was closed")
    })
});

function generateGUID() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + '4' + s4().substr(0, 3) + '-' +
        (8 + Math.floor(Math.random() * 4)).toString(16) + s4().substr(0, 3) + '-' +
        s4() + s4() + s4();
}

//Actionhandling for Buttons and Sensors

function doaction(button, id, src, rssi, callback) {
    var guid = generateGUID();
    var mac = "";
    if (id.includes(":")) {
        mac = id.replace(/:/g, "").toLowerCase();
    } else {
        mac = id.toLowerCase();
    }

    var actionKey = mac + "_" + button;

    if (actionTimers[actionKey]) {
        log("Signal from Devices " + id + " with key " + button + " received again between 500ms. Signal will be ignored");
        callback(null, "Signal ignored");
        return;
    }

    actionTimers[actionKey] = Timers.setTimeout(function () {
        Timers.clearTimeout(actionTimers[actionKey]);
        delete actionTimers[actionKey];
    }, 500);

    log("Device: " + id + " Switch:" + button);

    if (src != null) {
        var source = src;
        var device = mac;
        var signal = rssi;
        var location = "";

        // Temp Check for Location, just for demo how localization could be done
        if (Math.abs(signal) < 70) {
            if (source == "shellyblugw-123456789123") {
                location = "2";
            } else if (source == "shellyblugw-987654321987") {
                location = "1";
            }
            userconn.forEach(function (conn) {
                conn.send(JSON.stringify({ api: "user", mt: "Location", device: device, location: location }));
            });
        }
    }

    if (button <= 6) {
        Database.exec("SELECT action, sip, text FROM devices WHERE LOWER(d_mac) = '" + Database.escape(mac) + "' AND button = '" + Database.escape(button) + "' AND d_type != '4'")
            .oncomplete(function (data) {
                if (data.length > 0) {
                    data.forEach(function (data) {
                        inserthistory(guid, Database.escape(mac), Database.escape(button), data);
                        if (data.action == "chat") {
                            log("Chat to: " + data.sip + " Text: " + data.text);
                            sendMessage(data.sip, data.text);
                        } else if (data.action == "phonemessage") {
                            log("Phonemessage to: " + data.sip + " Text: " + data.text);
                            sendPhoneMessage(data.sip, data.text);
                        } else if (data.action == "notify") {
                            pbxapiconns.forEach(function (pbxapiconn) {
                                if (pbxapiconn.pbx == pbxname) {
                                    pbxapiconn.send(JSON.stringify({ api: "PbxApi", mt: "AppNotify", sip: data.sip, title: "Buttons", text: data.text }));
                                }
                            });
                        } else if (data.action == "chat+notify") {
                            log("Chat to: " + data.sip + " Text: " + data.text);
                            pbxapiconns.forEach(function (pbxapiconn) {
                                if (pbxapiconn.pbx == pbxname) {
                                    pbxapiconn.send(JSON.stringify({ api: "PbxApi", mt: "AppNotify", sip: data.sip, title: "Buttons", text: data.text }));
                                }
                            });
                            sendMessage(data.sip, data.text);
                        } else if (data.action == "presence") {
                            log("Toggle Presence: " + data.sip + " Presence: " + data.text);

                            var presenceMap = {
                                1: "",
                                2: "away",
                                3: "busy",
                                4: "dnd"
                            };

                            var activity = presenceMap[data.text];
                            if (activity !== undefined) {
                                pbxapiconns.forEach(function (pbxapiconn) {
                                    if (pbxapiconn.pbx == pbxname) {
                                        pbxapiconn.send(JSON.stringify({ api: "PbxApi", mt: "SetPresence", sip: data.sip, activity: activity }));
                                    }
                                });
                            }
                        } else if (data.action == "working") {
                            var mode = data.text;
                            if (mode == "start") {
                                log("Start Working: " + data.sip);
                                appwebsocket_working.send(JSON.stringify({ mt: "StartWorkingTime", api: "--innovaphone-client-working-api", sip: data.sip, src: data.sip }));
                            } else if (mode == "stop") {
                                log("Stop Working: " + data.sip);
                                appwebsocket_working.send(JSON.stringify({ mt: "StopWorkingTime", api: "--innovaphone-client-working-api", sip: data.sip, src: data.sip }));
                            } else if (mode == "toggle") {
                                log("Toggle Working: " + data.sip);
                                appwebsocket_working.send(JSON.stringify({ mt: "GetStatus", api: "--innovaphone-client-working-api", sip: data.sip, src: "toggle-xxxxx-" + data.sip }));
                            }
                        } else if (data.action == "connect") {
                            if (data.sip[0] === "@") {
                                appsocket_connect.send(JSON.stringify({ "mt": "Post", src: guid, discussionGuid: guid, "topic": appObjectName, "text": "@" + data.sip + " " + data.text, "notify": ["?" + data.sip.substring(1) + ""], "tags": ["Buttons"], "private": false, "attaching": 0, "discussionTitle": "#Buttons" }));
                            }
                            else {
                                appsocket_connect.send(JSON.stringify({ "mt": "Post", src: guid, discussionGuid: guid, "topic": appObjectName, "text": "@" + data.sip + " " + data.text, "notify": ["" + data.sip + ""], "tags": ["Buttons"], "private": false, "attaching": 0, "discussionTitle": "#Buttons" }));
                            }
                        } else if (data.action == "call") {
                            log("Start Call To: " + data.sip);
                            const result = queues.find(function (queue) {
                                return queue.cn === data.text;
                            });
                            if (result) {
                                sendCall(result.pbx, data.text, data.sip, guid);
                            } else {
                                log("===ERROR=== No PBX Found for " + data.text);
                            }

                        }
                        callback(null, "ok");
                    });
                }
                else {
                    callback(null, "No Action Defined");
                }
            })
            .onerror(function (error, errorText, dbErrorCode) {
                callback(error, errorText);
            });
    }
}

//Actionhandling for Calls

function dophoneaction(user, number) {
    var guid = generateGUID();
    var cdpn = removePrefix(buttonusere164, number);
    log("DoPhoneAction " + user + " - " + number + " Number without prefix: " + removePrefix(buttonusere164, cdpn));
    if (cdpn.slice(0, 2) == 99) {
        log("Toggle Working via Phone: " + user)
        appwebsocket_working.send(JSON.stringify({ mt: "GetStatus", api: "--innovaphone-client-working-api", sip: user, src: "phone-xxxxx-" + user }));
    }
    else {
        Database.exec("SELECT action, sip, text FROM devices WHERE LOWER(d_mac) = '" + removePrefix(buttonusere164, number) + "' AND d_type = '4' AND button = '" + user + "'")
            .oncomplete(function (data) {
                if (data.length > 0) {
                    data.forEach(function (data) {
                        inserthistory(guid, Database.escape(number), Database.escape(user), data);
                        if (data.action == "chat") {
                            log("Chat to: " + data.sip + " Text: " + data.text);
                            sendMessage(data.sip, data.text);
                        } else if (data.action == "phonemessage") {
                            log("Phonemessage to: " + data.sip + " Text: " + data.text);
                            sendPhoneMessage(data.sip, data.text);
                        } else if (data.action == "notify") {
                            pbxapiconns.forEach(function (pbxapiconn) {
                                if (pbxapiconn.pbx == pbxname) {
                                    pbxapiconn.send(JSON.stringify({ api: "PbxApi", mt: "AppNotify", sip: data.sip, title: "Buttons", text: data.text }));
                                }
                            });
                        } else if (data.action == "chat+notify") {
                            log("Chat to: " + data.sip + " Text: " + data.text);
                            pbxapiconns.forEach(function (pbxapiconn) {
                                if (pbxapiconn.pbx == pbxname) {
                                    pbxapiconn.send(JSON.stringify({ api: "PbxApi", mt: "AppNotify", sip: data.sip, title: "Buttons", text: data.text }));
                                }
                            });
                            sendMessage(data.sip, data.text);
                        } else if (data.action == "presence") {
                            log("Toggle Presence: " + data.sip + " Presence: " + data.text);

                            var presenceMap = {
                                1: "",
                                2: "away",
                                3: "busy",
                                4: "dnd"
                            };

                            var activity = presenceMap[data.text];
                            if (activity !== undefined) {
                                pbxapiconns.forEach(function (pbxapiconn) {
                                    if (pbxapiconn.pbx == pbxname) {
                                        pbxapiconn.send(JSON.stringify({ api: "PbxApi", mt: "SetPresence", sip: data.sip, activity: activity }));
                                    }
                                });
                            }
                        } else if (data.action == "working") {
                            var mode = data.text;
                            if (mode == "start") {
                                log("Start Working: " + data.sip);
                                appwebsocket_working.send(JSON.stringify({ mt: "StartWorkingTime", api: "--innovaphone-client-working-api", sip: data.sip, src: data.sip }));
                            } else if (mode == "stop") {
                                log("Stop Working: " + data.sip);
                                appwebsocket_working.send(JSON.stringify({ mt: "StopWorkingTime", api: "--innovaphone-client-working-api", sip: data.sip, src: data.sip }));
                            } else if (mode == "toggle") {
                                log("Toggle Working: " + data.sip);
                                appwebsocket_working.send(JSON.stringify({ mt: "GetStatus", api: "--innovaphone-client-working-api", sip: data.sip, src: "toggle-xxxxx-" + data.sip }));
                            }
                        } else if (data.action == "connect") {
                            if (data.sip[0] === "@") {
                                appsocket_connect.send(JSON.stringify({ "mt": "Post", src: guid, discussionGuid: guid, "topic": appObjectName, "text": "@" + data.sip + " " + data.text, "notify": ["?" + data.sip.substring(1) + ""], "tags": ["Buttons"], "private": false, "attaching": 0, "discussionTitle": "#Buttons" }));
                            }
                            else {
                                appsocket_connect.send(JSON.stringify({ "mt": "Post", src: guid, discussionGuid: guid, "topic": appObjectName, "text": "@" + data.sip + " " + data.text, "notify": ["" + data.sip + ""], "tags": ["Buttons"], "private": false, "attaching": 0, "discussionTitle": "#Buttons" }));
                            }
                        } else if (data.action == "call") {
                            log("Start Call To: " + data.sip);
                            const result = queues.find(function (queue) {
                                return queue.cn === data.text;
                            });
                            if (result) {
                                sendCall(result.pbx, data.text, data.sip, guid);
                            } else {
                                log("===ERROR=== No PBX Found for " + data.text);
                            }

                        }
                        log(null, "ok");
                    });
                }
                else {
                    log(null, "No Action Defined");
                }
            })
            .onerror(function (error, errorText, dbErrorCode) {
                log(error, errorText);
            });
    }
}

//Actionhandling Hotkey Signals

function dohotkeyaction(user, key) {
    var guid = generateGUID();
    Database.exec("SELECT action, sip, text FROM devices WHERE LOWER(d_mac) = '" + Database.escape(key) + "' AND d_type = '5' AND button = '" + user + "'")
        .oncomplete(function (data) {
            if (data.length > 0) {
                data.forEach(function (data) {
                    inserthistory(guid, Database.escape(key), Database.escape(user), data);
                    if (data.action == "chat") {
                        log("Chat to: " + data.sip + " Text: " + data.text);
                        sendMessage(data.sip, data.text);
                    } else if (data.action == "phonemessage") {
                        log("Phonemessage to: " + data.sip + " Text: " + data.text);
                        sendPhoneMessage(data.sip, data.text);
                    } else if (data.action == "notify") {
                        pbxapiconns.forEach(function (pbxapiconn) {
                            if (pbxapiconn.pbx == pbxname) {
                                pbxapiconn.send(JSON.stringify({ api: "PbxApi", mt: "AppNotify", sip: data.sip, title: "Buttons", text: data.text }));
                            }
                        });
                    } else if (data.action == "chat+notify") {
                        log("Chat to: " + data.sip + " Text: " + data.text);
                        pbxapiconns.forEach(function (pbxapiconn) {
                            if (pbxapiconn.pbx == pbxname) {
                                pbxapiconn.send(JSON.stringify({ api: "PbxApi", mt: "AppNotify", sip: data.sip, title: "Buttons", text: data.text }));
                            }
                        });
                        sendMessage(data.sip, data.text);
                    } else if (data.action == "presence") {
                        log("Toggle Presence: " + data.sip + " Presence: " + data.text);

                        var presenceMap = {
                            1: "",
                            2: "away",
                            3: "busy",
                            4: "dnd"
                        };

                        var activity = presenceMap[data.text];
                        if (activity !== undefined) {
                            pbxapiconns.forEach(function (pbxapiconn) {
                                if (pbxapiconn.pbx == pbxname) {
                                    pbxapiconn.send(JSON.stringify({ api: "PbxApi", mt: "SetPresence", sip: data.sip, activity: activity }));
                                }
                            });
                        }
                    } else if (data.action == "working") {
                        var mode = data.text;
                        if (mode == "start") {
                            log("Start Working: " + data.sip);
                            appwebsocket_working.send(JSON.stringify({ mt: "StartWorkingTime", api: "--innovaphone-client-working-api", sip: data.sip, src: data.sip }));
                        } else if (mode == "stop") {
                            log("Stop Working: " + data.sip);
                            appwebsocket_working.send(JSON.stringify({ mt: "StopWorkingTime", api: "--innovaphone-client-working-api", sip: data.sip, src: data.sip }));
                        } else if (mode == "toggle") {
                            log("Toggle Working: " + data.sip);
                            appwebsocket_working.send(JSON.stringify({ mt: "GetStatus", api: "--innovaphone-client-working-api", sip: data.sip, src: "toggle-xxxxx-" + data.sip }));
                        }
                    } else if (data.action == "connect") {
                        if (data.sip[0] === "@") {
                            appsocket_connect.send(JSON.stringify({ "mt": "Post", src: guid, discussionGuid: guid, "topic": appObjectName, "text": "@" + data.sip + " " + data.text, "notify": ["?" + data.sip.substring(1) + ""], "tags": ["Buttons"], "private": false, "attaching": 0, "discussionTitle": "#Buttons" }));
                        }
                        else {
                            appsocket_connect.send(JSON.stringify({ "mt": "Post", src: guid, discussionGuid: guid, "topic": appObjectName, "text": "@" + data.sip + " " + data.text, "notify": ["" + data.sip + ""], "tags": ["Buttons"], "private": false, "attaching": 0, "discussionTitle": "#Buttons" }));
                        }
                    } else if (data.action == "call") {
                        log("Start Call To: " + data.sip);
                        const result = queues.find(function (queue) {
                            return queue.cn === data.text;
                        });
                        if (result) {
                            sendCall(result.pbx, data.text, data.sip, guid);
                        } else {
                            log("===ERROR=== No PBX Found for " + data.text);
                        }

                    }
                    log(null, "ok");
                });
            }
            else {
                log(null, "No Action Defined");
            }
        })
        .onerror(function (error, errorText, dbErrorCode) {
            log(error, errorText);
        });
}

//Actionhandling for LogEvents

function doLogAction(id, button, msg) {
    var guid = generateGUID();
    Database.exec("SELECT action, sip, text FROM devices WHERE id = '" + id + "'")
        .oncomplete(function (data) {
            if (data.length > 0) {
                data.forEach(function (data) {
                    inserthistory(guid, "Logging App", Database.escape(button), data);
                    if (data.action == "chat") {
                        log("Chat to: " + data.sip + " Text: " + data.text);
                        sendMessage(data.sip, data.text);
                    } else if (data.action == "phonemessage") {
                        log("Phonemessage to: " + data.sip + " Text: " + msg);
                        sendPhoneMessage(data.sip, msg);
                    } else if (data.action == "notify") {
                        pbxapiconns.forEach(function (pbxapiconn) {
                            if (pbxapiconn.pbx == pbxname) {
                                pbxapiconn.send(JSON.stringify({ api: "PbxApi", mt: "AppNotify", sip: data.sip, title: "Buttons", text: msg }));
                            }
                        });
                    } else if (data.action == "chat+notify") {
                        log("Chat to: " + data.sip + " Text: " + msg);
                        pbxapiconns.forEach(function (pbxapiconn) {
                            if (pbxapiconn.pbx == pbxname) {
                                pbxapiconn.send(JSON.stringify({ api: "PbxApi", mt: "AppNotify", sip: data.sip, title: "Buttons", text: msg }));
                            }
                        });
                        sendMessage(data.sip, msg);
                    } else if (data.action == "presence") {
                        log("Toggle Presence: " + data.sip + " Presence: " + data.text);

                        var presenceMap = {
                            1: "",
                            2: "away",
                            3: "busy",
                            4: "dnd"
                        };

                        var activity = presenceMap[data.text];
                        if (activity !== undefined) {
                            pbxapiconns.forEach(function (pbxapiconn) {
                                if (pbxapiconn.pbx == pbxname) {
                                    pbxapiconn.send(JSON.stringify({ api: "PbxApi", mt: "SetPresence", sip: data.sip, activity: activity }));
                                }
                            });
                        }
                    } else if (data.action == "working") {
                        var mode = data.text;
                        if (mode == "start") {
                            log("Start Working: " + data.sip);
                            appwebsocket_working.send(JSON.stringify({ mt: "StartWorkingTime", api: "--innovaphone-client-working-api", sip: data.sip, src: data.sip }));
                        } else if (mode == "stop") {
                            log("Stop Working: " + data.sip);
                            appwebsocket_working.send(JSON.stringify({ mt: "StopWorkingTime", api: "--innovaphone-client-working-api", sip: data.sip, src: data.sip }));
                        } else if (mode == "toggle") {
                            log("Toggle Working: " + data.sip);
                            appwebsocket_working.send(JSON.stringify({ mt: "GetStatus", api: "--innovaphone-client-working-api", sip: data.sip, src: "toggle-xxxxx-" + data.sip }));
                        }
                    } else if (data.action == "connect") {
                        if (data.sip[0] === "@") {
                            appsocket_connect.send(JSON.stringify({ "mt": "Post", src: guid, discussionGuid: guid, "topic": appObjectName, "text": "@" + data.sip + " " + msg, "notify": ["?" + data.sip.substring(1) + ""], "tags": ["Buttons"], "private": false, "attaching": 0, "discussionTitle": "#Buttons" }));
                        }
                        else {
                            appsocket_connect.send(JSON.stringify({ "mt": "Post", src: guid, discussionGuid: guid, "topic": appObjectName, "text": "@" + data.sip + " " + msg, "notify": ["" + data.sip + ""], "tags": ["Buttons"], "private": false, "attaching": 0, "discussionTitle": "#Buttons" }));
                        }
                    } else if (data.action == "call") {
                        log("Start Call To: " + data.sip);
                        const result = queues.find(function (queue) {
                            return queue.cn === data.text;
                        });
                        if (result) {
                            sendCall(result.pbx, data.text, data.sip, guid);
                        } else {
                            log("===ERROR=== No PBX Found for " + data.text);
                        }

                    }
                    log(null, "ok");
                });
            }
            else {
                log(null, "No Action Defined");
            }
        })
        .onerror(function (error, errorText, dbErrorCode) {
            log(error, errorText);
        });
}

function inserthistory(guid, mac, button, data) {
    Database.exec("INSERT INTO history (guid, mac, button, action, info) VALUES ('" + guid + "', '" + mac + "', '" + button + "','" + data.action + "', '" + data.sip + "-" + data.text + "') RETURNING id")
        .oncomplete(function () {
            log("History Stored with GUID " + guid);
        })
        .onerror(function (error, errorText, dbErrorCode) {
            // Error handling
        });
}

function removePrefix(prefix, number) {
    if (number.startsWith(prefix)) {
        return number.slice(prefix.length);
    }
    return number;
}

function getQueryParameterValue(url, parameter) {
    var queryStart = url.indexOf('?');
    if (queryStart === -1) return null;
    var queryString = url.substring(queryStart + 1);
    var queryParams = queryString.split('&');

    for (var i = 0; i < queryParams.length; i++) {
        var pair = queryParams[i].split('=');
        if (pair[0] === parameter) {
            return decodeURIComponent(pair[1]);
        }
    }

    return null;
}

var pbxsignalconns = [];
var presence_calls = [];

new PbxApi("PbxSignal").onconnected(function (conn) {
    pbxsignalconns.push(conn);
    if (conn.pbx == pbxname) {
        conn.send(JSON.stringify({ "api": "PbxSignal", "mt": "Register", "src": buttonuserhwid, "hw": buttonuserhwid }));
    }

    conn.onmessage(function (msg) {
        var obj = JSON.parse(msg);
        log("PBX Signal: " + msg);
        if (conn.pbx == pbxname) {
            if (obj.mt === "RegisterResult") {
                log("Registration result " + JSON.stringify(obj));
            }
            if (obj.mt === "Signaling") {
                if (obj.sig.type === "setup") {
                    if (obj.sig.channel === -1) {
                        conn.send(JSON.stringify({
                            "api": "PbxSignal",
                            "mt": "Signaling",
                            "call": obj.call,
                            "sig": {
                                "type": "rel",
                                "cau": { "num": 26 }
                            }
                        }));
                        dophoneaction(obj.sig.cg.sip, obj.sig.cd.num);
                    }
                    else {
                        // handle incoming presence_subscribe call
                        // the callid "obj.call" required later for sending badge notifications
                        if (obj.sig.fty.some(function (v) { return v.type === "mwi_interrogate"; })) {
                            log("PbxSignal: incoming MWI Request " + obj.sig.cg.sip);
                            var sipuri = String(obj.sig.cg.sip);
                            mwi_message_center[sipuri] = obj.sig.fty[0].message_center;
                            mwi_served_user[sipuri] = obj.sig.fty[0].served_user;

                            log(JSON.stringify(obj.sig.fty[0].message_center));
                            log(JSON.stringify(obj.sig.fty[0].served_user));

                            Database.exec("INSERT INTO mwi (sip, message_center, served_user) VALUES ('" + obj.sig.cg.sip + "', '" + JSON.stringify(obj.sig.fty[0].message_center) + "', '" + JSON.stringify(obj.sig.fty[0].served_user) + "') ON CONFLICT (sip) DO UPDATE SET message_center = EXCLUDED.message_center, served_user = EXCLUDED.served_user RETURNING id")
                                .oncomplete(function () {
                                    log("MWI added for " + obj.sig.cg.sip);
                                })
                                .onerror(function (error, errorText, dbErrorCode) {
                                    // Error handling
                                });


                            conn.send(JSON.stringify({
                                "api": "PbxSignal",
                                "mt": "Signaling",
                                "call": obj.call,
                                "sig": {
                                    "fty": [
                                        {
                                            "type": "mwi_interrogate_result",
                                            "mwi_activate": {
                                                "served_user": obj.sig.fty[0].served_user,
                                                "message_center": obj.sig.fty[0].message_center,
                                                "number": 1,
                                                "service": 0,
                                                "priority": 0
                                            }
                                        }
                                    ],
                                    "type": "conn"
                                }
                            }));

                            appwebsocket_working.send(JSON.stringify({ mt: "GetStatus", api: "--innovaphone-client-working-api", sip: obj.sig.cg.sip, src: "statusmwi-xxxxx-" + obj.sig.cg.sip }));
                        }
                        if (obj.sig.fty.some(function (v) { return v.type === "presence_subscribe"; })) {
                            log("PbxSignal: incoming presence subscription for user " + obj.sig.cg.sip);
                            /**
                            sendConn(conn, obj.call);
        
                            presence_calls.push({ "sip": obj.sig.cg.sip, "callid": obj.call });
                            log(JSON.stringify(presence_calls));
                            **/

                        }
                    }
                } else if (obj.sig.type === "call_proc") {
                    log("PbxSignal: send message on call " + obj.call);
                    var call = message_calls.filter(function (call) { return call.callid === obj.call })[0];

                    if (call === undefined) {
                        log("Pbxsignal: no call found for callid " + obj.callid);
                        log(JSON.stringify(message_calls));
                    } else {
                        //sendTyping(pbxapiconns, targetApi, call.callid, true);

                        messages.filter(function (message) { return message.call === call.callid; }).
                            forEach(function (message) {
                                sendIMMessage(conn, message.call, message.data);
                            });

                        messages = messages.filter(function (message) { return message.call !== call.callid; });

                        //sendTyping(pbxapiconns, targetApi, call.callid, false);
                    }
                } else if (obj.sig.type === "rel") {
                    log("PbxSignal: removing call " + obj.call);
                    presence_calls = presence_calls.filter(function (call) { return call.callid !== obj.call });
                    log(JSON.stringify(message_calls));
                    message_calls = message_calls.filter(function (call) { return call.callid !== obj.call });
                    log(JSON.stringify(message_calls));
                }
                else if (obj.sig.type === "conn") {
                    log("PbxSignal: Connected call " + obj.call);
                    mwi_calls = mwi_calls.filter(function (call) {
                        if (call.callid === obj.call) {
                            log("Found MWI call with callid: " + call.callid);
                            pbxsignalconns.forEach(function (pbxsignal) {
                                if (pbxsignal.pbx == pbxname) {
                                    pbxsignal.send(JSON.stringify({ "api": "PbxSignal", "mt": "Signaling", "call": obj.call, "sig": { "type": "rel" } }));
                                }
                            });
                        }
                        return call.callid !== obj.call;
                    });
                }
                if (obj.sig.hasOwnProperty('fty')) {
                    if (obj.sig["fty"][0].hasOwnProperty('data')) {
                        // Nachricht des Benutzers
                        var userMessage = obj.sig["fty"][0].data;

                        var botResponse = "Hi, ich kann dir leider nicht antworten. Meine einzige Aufgabe ist es dir Nachrichten über Vorträge zu senden.\n\nHi, unfortunately I can't respond to you. My only task is to send you messages about lectures.";

                        conn.send(JSON.stringify({
                            "api": "PbxSignal",
                            "mt": "Signaling",
                            "call": obj.call,
                            "sig": {
                                "type": "facility",
                                "fty": [
                                    {
                                        "type": "im_message",
                                        "data": botResponse,
                                        "mime": "text/plain"
                                    }
                                ]
                            }
                        }));
                    }
                }
            }
        }
    });
    conn.onclose(function () {
        log("PbxSignal: disconnected");
        pbxsignalconns.splice(pbxsignalconns.indexOf(conn), 1);
    });
});

var serviceconns = [];
var appwebsocket_working = false;
var appsocket_connect = false;
var appsocket_events = false;

new PbxApi("Services").onconnected(function (conn) {
    log("Connected to PBX API with connection: " + JSON.stringify(conn));
    var connInfo = JSON.parse(conn.info);
    serviceconns.push(conn);
    if (conn.pbx == pbxname) {
        conn.send(JSON.stringify({ "mt": "SubscribeServices", "api": "Services" }));
        appObjectName = connInfo.appobj;
    }

    log("Services connected: " + conn.pbx);

    conn.onmessage(function (msg) {
        log("Message received from " + conn.pbx + ": " + msg);
        var obj;
        if (conn.pbx == pbxname) {
            try {
                obj = JSON.parse(msg);
            } catch (e) {
                log("Error parsing message: " + e);
                return;
            }

            if (obj.mt == "ServicesInfo") {
                log("ServicesInfo received: " + JSON.stringify(obj));
                for (var i = 0; i < obj.services.length; i++) {
                    if (obj.services[i].info != null) {
                        if (obj.services[i].info.apis != null) {
                            if (obj.services[i].info.apis.hasOwnProperty("com.innovaphone.working.client")) {
                                log("Connecting to service: " + JSON.stringify(obj.services[i]));
                                connectToWorking(transformUrl(obj.services[i].url), obj.services[i].name);
                            }
                            if (obj.services[i].info.apis.hasOwnProperty("com.innovaphone.connect")) {
                                log("Connecting to service: " + JSON.stringify(obj.services[i]));
                                connectToConnect(transformUrl(obj.services[i].url), obj.services[i].name);
                            }
                            //if (obj.services[i].info.apis.hasOwnProperty("com.innovaphone.events")) {
                            //log("Connecting to service: " + JSON.stringify(obj.services[i]));
                            //connectToEvents(transformUrl(obj.services[i].url), obj.services[i].name);
                            //}
                            log(JSON.stringify(obj.services[i].info.apis));
                        }
                    }
                    if (obj.services[i].url) {
                        var url = obj.services[i].url.split("/");
                        var appname = url[url.length - 1];
                        if (appname && appname == "innovaphone-logging") {
                            connectToEvents(transformUrl(obj.services[i].url), obj.services[i].name);
                        }
                    }
                }
            }
            else if (obj.mt == "GetServiceLoginResult") {
                log("Service Login Result received: " + JSON.stringify(obj));
                if (obj.app == "innovaphone-working-client-api") {
                    if (obj.error) {
                        log("Login failed with error: " + obj.error);
                        appwebsocket_working.close();
                    } else {
                        try {
                            var key = conn.decrypt(obj.salt, obj.key);
                            var info = JSON.stringify(obj.info);
                            appwebsocket_working.auth(obj.domain, obj.sip, obj.guid, obj.dn, obj.pbxObj, obj.app, info, obj.digest, key);
                        } catch (e) {
                            log("Error during authentication process: " + e);
                        }
                    }
                }
                else if (obj.app == "innovaphone-connect") {
                    if (obj.error) {
                        log("Login failed with error: " + obj.error);
                        appsocket_connect.close();
                    } else {
                        try {
                            var key = conn.decrypt(obj.salt, obj.key);
                            var info = JSON.stringify(obj.info);
                            appsocket_connect.auth(obj.domain, obj.sip, obj.guid, obj.dn, obj.pbxObj, obj.app, info, obj.digest, key);
                        } catch (e) {
                            log("Error during authentication process: " + e);
                        }
                    }
                }
                else if (obj.app == "innovaphone-logging") {
                    if (obj.error) {
                        log("Login failed with error: " + obj.error);
                        appsocket_events.close();
                    } else {
                        try {
                            var key = conn.decrypt(obj.salt, obj.key);
                            var info = JSON.stringify(obj.info);
                            appsocket_events.auth(obj.domain, obj.sip, obj.guid, obj.dn, obj.pbxObj, obj.app, info, obj.digest, key);
                        } catch (e) {
                            log("Error during authentication process: " + e);
                        }
                    }
                }

            } else {
                log("Unhandled message type: " + obj.mt);
            }
        }
    });

    conn.onclose(function () {
        log("Service connection closed " + conn.pbx);
        serviceconns.splice(serviceconns.indexOf(conn), 1);
    });
});

function connectToWorking(uri, app) {
    log("Attempting to connect to service at " + uri + " for app " + app);

    var appwebsocket = AppWebsocketClient.connect(uri, null, app);
    appwebsocket_working = appwebsocket;

    appwebsocket.onauth(function (conn, app, challenge) {
        log("Auth challenge received for app " + app + ": " + challenge);
        serviceconns.forEach(function (serviceconn) {
            if (serviceconn.pbx == pbxname) {
                serviceconn.send(JSON.stringify({ api: "Services", mt: "GetServiceLogin", challenge: challenge, app: app }));
            }
        });
    });

    appwebsocket.onopen(function (conn) {
        log("WebSocket Working connection opened");
    });

    appwebsocket.onmessage(function (conn, msg) {
        log("Working WebSocket message received " + msg);
        var obj = JSON.parse(msg);
        if (obj.mt == "GetStatusResult") {
            var srccode = obj.src.split("-xxxxx-");
            var mode = srccode[0];
            var usersip = srccode[1];
            if (mode == "statusmwi") {
                if (obj.state == "stopped") {
                    sendMWI(usersip, false);
                }
                else {
                    sendMWI(usersip, true);
                }
            }
            else {
                if (obj.state == "stopped") {
                    conn.send(JSON.stringify({ mt: "StartWorkingTime", api: "--innovaphone-client-working-api", sip: usersip, src: usersip }));
                }
                if (obj.state == "started") {
                    conn.send(JSON.stringify({ mt: "StopWorkingTime", api: "--innovaphone-client-working-api", sip: usersip, src: usersip }));
                }
            }

        }
        if (obj.mt == "StartWorkingTimeResult" && obj.result == "ok") {
            pbxapiconns.forEach(function (pbxapiconn) {
                if (pbxapiconn.pbx == pbxname) {
                    pbxapiconn.send(JSON.stringify({ api: "PbxApi", mt: "AppNotify", sip: obj.src, title: "Buttons", text: "Working Start" }));
                }
            });
            obj.src = String(obj.src);
            if (mwi_served_user[obj.src] != null) {
                sendMWI(obj.src, true);
            }
        }
        if (obj.mt == "StopWorkingTimeResult" && obj.result == "ok") {
            pbxapiconns.forEach(function (pbxapiconn) {
                if (pbxapiconn.pbx == pbxname) {
                    pbxapiconn.send(JSON.stringify({ api: "PbxApi", mt: "AppNotify", sip: obj.src, title: "Buttons", text: "Working Stop" }));
                }
            });
            obj.src = String(obj.src);
            if (mwi_served_user[obj.src] != null) {
                sendMWI(obj.src, false);
            }
        }
    });

    appwebsocket.onclose(function () {
        log("WebSocket connection closed");
        if (!serviceApiTimer) {
            serviceApiTimer = Timers.setTimeout(function () {
                reconnectServiceApi();
                Timers.clearTimeout(serviceApiTimer);
                serviceApiTimer = false;
            }, 60000);
        }
    });
}

function connectToConnect(uri, app) {
    log("Attempting to connect to service at " + uri + " for app " + app);

    var appwebsocket = AppWebsocketClient.connect(uri, null, app);
    appsocket_connect = appwebsocket;

    appwebsocket.onauth(function (conn, app, challenge) {
        log("Auth challenge received for app " + app + ": " + challenge);
        serviceconns.forEach(function (serviceconn) {
            serviceconn.send(JSON.stringify({ api: "Services", mt: "GetServiceLogin", challenge: challenge, app: app }));
        });
    });

    appwebsocket.onopen(function (conn) {
        log("WebSocket Connect connection opened");
    });

    appwebsocket.onmessage(function (conn, msg) {
        log("Connect message received " + msg);
        var obj = JSON.parse(msg);
        if (obj.mt == "PostResult") {
            if (obj.error) {

            }
            else {
                if (obj.discussionGuid) {
                    Database.exec("UPDATE history SET info = '" + obj.id + "' WHERE guid = '" + obj.discussionGuid + "' AND action = 'connect'")
                        .oncomplete(function (data) {
                            log("Post ID Updated " + obj.discussionGuid + " with id " + obj.id)
                        })
                        .onerror(function (error, errorText, dbErrorCode) {
                            // Error handling
                        });
                }
            }
        }
    });

    appwebsocket.onclose(function () {
        log("Connect-App WebSocket connection closed");
        if (!serviceApiTimer) {
            serviceApiTimer = Timers.setTimeout(function () {
                reconnectServiceApi();
                Timers.clearTimeout(serviceApiTimer);
                serviceApiTimer = false;
            }, 60000);
        }
    });
}

function connectToEvents(uri, app) {
    log("Attempting to connect to service at " + uri + "/logging" + " for app " + app);

    var appwebsocket = AppWebsocketClient.connect(uri + "/logging", null, app);
    appsocket_events = appwebsocket;

    appwebsocket.onauth(function (conn, app, challenge) {
        log("Auth challenge received for app " + app + ": " + challenge);
        serviceconns.forEach(function (serviceconn) {
            serviceconn.send(JSON.stringify({ api: "Services", mt: "GetServiceLogin", challenge: challenge, app: app }));
        });
    });

    appwebsocket.onopen(function (conn) {
        log("WebSocket Events connection opened");
    });

    appwebsocket.onmessage(function (conn, msg) {
        log("Eventsmessage: " + msg);
        var obj = JSON.parse(msg);
        if (obj.msg) {
            logFilters.forEach(function (logfilter) {
                if (checkForString(obj.msg, logfilter.button)) {
                    doLogAction(logfilter.id, logfilter.button, obj.msg)
                }
            });

        }
    });

    appwebsocket.onclose(function () {
        log("EventsApp WebSocket connection closed");
        if (!serviceApiTimer) {
            serviceApiTimer = Timers.setTimeout(function () {
                reconnectServiceApi();
                Timers.clearTimeout(serviceApiTimer);
                serviceApiTimer = false;
            }, 60000);
        }
    });
}

function reconnectServiceApi() {
    serviceconns.forEach(function (serviceconn) {
        serviceconn.send(JSON.stringify({ "mt": "SubscribeServices", "api": "Services" }));
    });
}

// Notifiy
new PbxApi("PbxApi").onconnected(function (conn) {
    pbxapiconns.push(conn);

    conn.onmessage(function (msg) {

    });
    conn.onclose(function () {
        log("PbxApi: disconnected");
        pbxapiconns.splice(pbxapiconns.indexOf(conn), 1);
    });
});

//RCC Api
new PbxApi("RCC").onconnected(function (conn) {
    rccapiconns.push(conn);

    queues.forEach(function (queue) {
        if (queue.pbx === conn.pbx) {
            conn.send(JSON.stringify({ api: "RCC", mt: "UserInitialize", src: queue.cn + "-" + queue.pbx, cn: queue.cn, xfer: false, hw: queue.cn, disc: false }));
        }
    });

    conn.onmessage(function (msg) {
        //log("===RCC-API=== Message => " + msg);
        var obj;
        try {
            obj = JSON.parse(msg);
        } catch (e) {
            log("Error parsing message: " + e);
            return;
        }
        if (obj.mt == "UserInitializeResult") {
            queueids[obj.src] = obj.user;
            log("===RCC-API=== CallId for " + obj.src + " ==> " + queueids[obj.src]);
        }
        if (obj.state == "1" && obj.conf != undefined) {
            log("Call Started: ID: " + obj.call)
            var callTimer = Timers.setInterval(function () {
                cancelCall(conn, obj.user, obj.call);
            }, 60000);
            callTimers[obj.call] = callTimer;
            log("Call Timers:" + JSON.stringify(callTimers));
        }
        if (obj.mt == "UserCallResult") {
            queuecalls[obj.src].call = obj.call;
            queuecalls[obj.src].connected = false;
            queuecalls[obj.src].dtmf = false;
            log(JSON.stringify(queuecalls[obj.src]));
            rccSrcMap[queuecalls[obj.src].rccuser + "-" + obj.call] = queuecalls[obj.src];
            //Not needed anymore. 
            delete queuecalls[obj.src];
        }
        if (obj.mt == "CallInfo") {
            log("===CallInfo=== Message -" + msg);
            if (rccSrcMap[obj.user + "-" + obj.call]) {
                //log("===CallInfo=== ActionObject - " + JSON.stringify(rccSrcMap[obj.user + "-" + obj.call]));
            }
            if (obj.state === 5) {
                rccSrcMap[obj.user + "-" + obj.call].connected = true;
            }
            if (obj.dtmf) {
                if (rccSrcMap[obj.user + "-" + obj.call].dtmf) {
                    rccSrcMap[obj.user + "-" + obj.call].dtmf = rccSrcMap[obj.user + "-" + obj.call].dtmf + obj.dtmf
                }
                else {
                    rccSrcMap[obj.user + "-" + obj.call].dtmf = obj.dtmf;
                }

            }
            if (obj.del) {
                log("===CallInfo=== ActionObject at callend - " + JSON.stringify(rccSrcMap[obj.user + "-" + obj.call]));
                checkForConnectPost(rccSrcMap[obj.user + "-" + obj.call]);
                delete rccSrcMap[obj.user + "-" + obj.call]
                log("Arrays after Call:");
                log(JSON.stringify(queuecalls));
                log(JSON.stringify(rccSrcMap));
                if (callTimers.hasOwnProperty(obj.call)) {
                    Timers.clearInterval(callTimers[obj.call]);
                    delete callTimers[obj.call];
                    log("Call Timers:" + JSON.stringify(callTimers));
                }
            }
        }
    });
    conn.onclose(function () {
        log("PbxApi: disconnected");
        rccapiconns.splice(rccapiconns.indexOf(conn), 1);
    });
});

function sendCall(pbx, cn, sip, guid) {
    var srcmap = sip + "-xxx-" + guid;
    var callobject = { pbx: pbx, queue: cn, dest: sip, guid: guid, rccuser: queueids[cn + "-" + pbx] }
    queuecalls[srcmap] = callobject;
    rccapiconns.forEach(function (rccapiconn) {
        if (rccapiconn.pbx == pbx) {
            if (typeof sip === 'number') {
                rccapiconn.send(JSON.stringify({ "mt": "UserCall", "src": srcmap, "user": queueids[cn + "-" + pbx], "api": "RCC", "e164": sip }));
            }
            else {
                rccapiconn.send(JSON.stringify({ "mt": "UserCall", "src": srcmap, "user": queueids[cn + "-" + pbx], "api": "RCC", "h323": sip }));
            }
        }
    });

}

function cancelCall(conn, userhandle, callid) {
    conn.send(JSON.stringify({ "mt": "UserClear", "user": userhandle, "api": "RCC", "call": callid, "cause": "16" }));
}

function checkForConnectPost(obj) {
    Database.exec("SELECT id, info from history WHERE guid = '" + obj.guid + "' AND action = 'connect'")
        .oncomplete(function (data) {
            log(JSON.stringify(data));
            if (data[0].hasOwnProperty('info')) {
                const infoAsInteger = parseInt(data[0].info, 10);
                appsocket_connect.send(JSON.stringify({
                    "mt": "Post",
                    "author": appObjectName,
                    "topic": appObjectName,
                    "repliesTo": infoAsInteger,
                    "notify": ["" + obj.dest + ""],
                    "text": "Call to: @" + obj.dest + " - Connected: " + obj.connected + " - Pressed Keys: " + obj.dtmf,
                    "reNotify": true,
                    "attaching": 0,
                    "src": obj.guid
                }));
            }
        })
        .onerror(function (error, errorText, dbErrorCode) {
            // Error handling
        });
}

function isValidJSON(str) {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
}

function transformUrl(url) {
    var protocolIndex = url.indexOf("://");
    var protocol = url.substring(0, protocolIndex);
    var remainder = url.substring(protocolIndex + 3);
    var pathIndex = remainder.indexOf("/");
    var host = remainder.substring(0, pathIndex);
    var path = remainder.substring(pathIndex);

    if (protocol === 'https') {
        protocol = 'wss';
    }
    if (protocol === 'http') {
        protocol = 'ws';
    }

    var pathSegments = path.split('/');
    pathSegments.pop();

    var newPath = pathSegments.join('/');

    var newUrl = protocol + '://' + host + newPath;

    return newUrl;
}

function generateCallId(sip) {
    var callid;
    callid = lastcallid + 1;
    lastcallid = callid;
    log("Generate new callid for " + sip + ": " + callid);
    return callid;
}

function getCallId(sip) {
    //log("Get callid for " + sip);
    //log(JSON.stringify(message_calls));

    if (message_calls.length === 0) return false;

    if (message_calls.some(function (v) { return v.sip === sip; })) {
        var usercalls = message_calls.filter(function (v) { return v.sip === sip; });
        // log("Found calls for " + sip + " " + JSON.stringify(usercalls));

        if (usercalls.length === 1) {
            return usercalls[0].callid;
        } else {
            log("ERROR: multiple calls for same user");
        }
    } else {
        return false;
    }

    return false;
}

function sendSetup(conn, sip, call) {
    var msg = {
        "mt": "Signaling", "api": "PbxSignal", "call": call,
        "sig": {
            "type": "setup",
            "channel": 0,
            "cd": { "flags": "U", "sip": sip },
            "fty": [{ "type": "im_setup" }]
        }
    };
    conn.send(JSON.stringify(msg));
}

function sendMessage(sip, data) {
    var callid = getCallId(sip);

    if (callid === false) {
        callid = generateCallId(sip);
        //log("Created new callid " + callid);
        message_calls.push({ "callid": callid, "sip": sip });
        messages.push({ "call": callid, "data": data });
        //log("Message_calls: " + JSON.stringify(message_calls));
        pbxsignalconns.forEach(function (pbxsignal) {
            if (pbxsignal.pbx == pbxname) {
                sendSetup(pbxsignal, sip, callid);
            }

        });

    } else {
        //log("Send message for " + sip + " on existing call " + callid);
        //sendTyping(pbxapiconns, targetApi, callid, true);
        pbxsignalconns.forEach(function (pbxsignal) {
            if (pbxsignal.pbx == pbxname) {
                sendIMMessage(pbxsignal, callid, data);
            }
        });

        //sendTyping(pbxapiconns, targetApi, callid, false);
    }
}

function sendMWI(sip, status) {
    var msg = "";
    var callid = generateCallId(sip);
    mwi_calls.push({ "callid": callid, "sip": sip });
    if (status) {
        msg = {
            "mt": "Signaling",
            "api": "PbxSignal",
            "call": callid,

            "sig": {
                "type": "setup",
                "bc": "a880",
                "cd": { "sip": sip },
                "complete": true,
                "channel": 0,
                "fty": [{
                    "type": "mwi_activate",
                    "served_user": mwi_served_user[sip],
                    "message_center": mwi_message_center[sip],
                    "number": 1,
                    "service": 0,
                    "priority": 0
                }]
            }
        };
    }
    else {
        msg = {
            "mt": "Signaling",
            "api": "PbxSignal",
            "call": callid,
            "sig": {
                "type": "setup",
                "bc": "a880",
                "cd": { "sip": sip },
                "complete": true,
                "channel": 0,
                "fty": [{
                    "type": "mwi_deactivate",
                    "served_user": mwi_served_user[sip],
                    "message_center": mwi_message_center[sip],
                    "service": 0,
                    "call_back": 0
                }],
            }
        };
    }
    pbxsignalconns.forEach(function (pbxsignal) {
        if (pbxsignal.pbx == pbxname) {
            pbxsignal.send(JSON.stringify(msg));
        }
    });

}

function sendIMMessage(conn, call, data) {
    var msg = {
        "mt": "Signaling", "api": "PbxSignal", "call": call,
        "sig": { "type": "facility", "fty": [{ "type": "im_message", "data": data, "mime": "text/html", "attach": "" }] }
    };
    conn.send(JSON.stringify(msg));
}

function sendPhoneMessage(sip, message) {
    var callid = generateCallId(sip);
    phonemessages.push({ "callid": callid, "sip": sip });
    if (typeof sip === 'number') {
        var msg = {
            "mt": "Signaling",
            "api": "PbxSignal",
            "call": callid,

            "sig": {
                "type": "setup",
                "bc": "a880",
                "cd": { "num": sip },
                "complete": true,
                "channel": 0,
                "fty": [{
                    "type": "innovaphone_message",
                    "data": message,
                    "mime_type": "text/plain",
                    "to": { "num": sip }
                }]
            }
        };
    } else {
        var msg = {
            "mt": "Signaling",
            "api": "PbxSignal",
            "call": callid,

            "sig": {
                "type": "setup",
                "bc": "a880",
                "cd": { "sip": sip },
                "complete": true,
                "channel": 0,
                "fty": [{
                    "type": "innovaphone_message",
                    "data": message,
                    "mime_type": "text/plain",
                    "to": { "sip": sip }
                }]
            }
        };
    }

    pbxsignalconns.forEach(function (pbxsignal) {
        if (pbxsignal.pbx == pbxname) {
            pbxsignal.send(JSON.stringify(msg));
        }
    });

}

//Polyfills

if (!Array.prototype.find) {
    Array.prototype.find = function (predicate, thisArg) {
        if (this == null) {
            throw new TypeError('Array.prototype.find called on null or undefined');
        }
        if (typeof predicate !== 'function') {
            throw new TypeError('predicate must be a function');
        }

        var list = Object(this);
        var length = list.length >>> 0;

        for (var i = 0; i < length; i++) {
            var element = list[i];
            if (predicate.call(thisArg, element, i, list)) {
                return element;
            }
        }
        return undefined;
    };
}

if (!String.prototype.includes) {
    String.prototype.includes = function (substring, position) {
        position = position || 0;
        return this.indexOf(substring, position) !== -1;
    };
}

function rfc3986Encode(str) {
    return encodeURIComponent(str)
        .replace(/!/g, '%21')
        .replace(/'/g, '%27')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29')
        .replace(/\*/g, '%2A');
}

function checkForString(msg, searchString) {
    if (msg.indexOf(searchString) !== -1) {
        return true;
    }
    return false;
}

//SQL Backend
function addDevice(conn, obj) {
    var guid = conn.guid;


    const id = Database.escape(obj.args.id);
    const mac = Database.escape(obj.args.mac);
    const dtype = Database.escape(obj.args.dtype);
    const owner = Database.escape(guid);

    if (obj.args.dtype == "90") {
        guid = "admin";
        mac = "Logging App";
    }

    const query = "INSERT INTO devices (dev_id, d_mac, d_type, ownerguid) VALUES ('" +
        id + "', '" + mac + "', " + dtype + ", '" + owner + "') RETURNING id";

    try {
        var result = Database.exec(query);
        conn.send(JSON.stringify({
            mt: obj.mt + "Result",
            status: "finished",
            statement: "add-device",
            result: result
        }));
    } catch (err) {
        conn.send(JSON.stringify({
            mt: obj.mt + "Result",
            status: "error",
            statement: "add-device",
            error: err.message || "Execution error"
        }));
    }
}

function setActionLogging(conn, obj) {
    var button = Database.escape(obj.args.msgfilter);
    var sip = Database.escape(obj.args.sipuser);
    var text = Database.escape(obj.args.text);
    var action = Database.escape(obj.args.option);
    var actionid = Database.escape(obj.args.actionid);

    var query = "UPDATE devices SET button = '" + button +
        "', sip = '" + sip +
        "', text = '" + text +
        "', action = '" + action +
        "' WHERE id = " + actionid;

    try {
        var result = Database.exec(query);
        conn.send(JSON.stringify({
            mt: obj.mt + "Result",
            status: "finished",
            statement: "set-action-logging",
            result: result
        }));
        UpdateLogFilters();
    } catch (err) {
        conn.send(JSON.stringify({
            mt: obj.mt + "Result",
            status: "error",
            statement: "set-action-logging",
            error: err.message || "Execution error"
        }));
    }
}

function UpdateLogFilters() {
    logFilters = [];
    Database.exec("SELECT * from devices WHERE d_type = '90'")
        .oncomplete(function (data) {
            data.forEach(function (row) {
                if (row.button) {
                    logFilters.push(row);
                }
            });
            log("===LogFilters=== " + JSON.stringify(logFilters));
        })
        .onerror(function (error, errorText, dbErrorCode) {
            // Error handling
        });
}

UpdateLogFilters();

//TableUsers Api
var tableUsersConns = [];

function upsertQueueMem(cn, pbx) {
    var i;
    for (i = 0; i < queues.length; i++) {
        if (queues[i].cn === cn) { queues[i].pbx = pbx; return; }
    }
    queues.push({ cn: cn, pbx: pbx });
}

function deleteQueueMemByCn(cn) {
    queues = queues.filter(function (q) { return q.cn !== cn; });
}

new PbxApi("PbxTableUsers").onconnected(function (conn) {
    log("[PbxTableUsers] connected pbx=" + conn.pbx);
    if (Config.pbxname && conn.pbx !== Config.pbxname) return;

    var REPL_SRC = "repl-waiting";

    function sendNext() {
        conn.send(JSON.stringify({
            api: "PbxTableUsers",
            mt: "ReplicateNext",
            src: REPL_SRC
        }));
    }

    conn.send(JSON.stringify({
        api: "PbxTableUsers",
        mt: "ReplicateStart",
        src: REPL_SRC,
        columns: {
            guid: { update: false },
            cn: { update: true },
            pseudo: { update: false }
        },
        add: true,
        del: true,
        pseudo: ["waiting"]
    }));

    conn.onmessage(function (msg) {
        var obj;
        try { obj = JSON.parse(msg); } catch (e) { return; }
        if (obj.api !== "PbxTableUsers") return;
        if (obj.src && obj.src !== REPL_SRC) return;

        var c = obj.columns || obj;

        if (obj.mt === "ReplicateStartResult") {
            if (obj.error) {
                log("[PbxTableUsers] ReplicateStartResult error=" + obj.error);
                return;
            }

            sendNext();
            return;
        }
        else if (obj.mt === "ReplicateNextResult") {
            if (obj.error) {
                log("[PbxTableUsers] ReplicateNextResult error=" + obj.error);
                return;
            }

            // row payload comes via columns
            if (obj.columns && obj.columns.guid && obj.columns.cn) {
                var row = obj.columns;

                Database.exec(
                    "INSERT INTO pbx_waiting (guid, cn, updated) VALUES ('" +
                    Database.escape(String(row.guid)) + "', '" +
                    Database.escape(String(row.cn)) + "', EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000) " +
                    "ON CONFLICT (guid) DO UPDATE SET cn=EXCLUDED.cn, updated=EXCLUDED.updated"
                );

                // keep pulling until PBX sends a NextResult without columns
                sendNext();
                return;
            }

            // no columns => end of initial replication
            log("[PbxTableUsers] replication finished");
            return;
        }


        else if (obj.mt === "ReplicateAdd" || obj.mt === "ReplicateUpdate") {
            if (!c.guid || !c.cn) return;

            Database.exec(
                "INSERT INTO pbx_waiting (guid, cn, updated) VALUES ('" +
                Database.escape(String(c.guid)) + "', '" +
                Database.escape(String(c.cn)) + "', EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000) " +
                "ON CONFLICT (guid) DO UPDATE SET cn=EXCLUDED.cn, updated=EXCLUDED.updated"
            );
            return;
        }

        else if (obj.mt === "ReplicateDel") {
            if (!c.guid) return;
            Database.exec(
                "DELETE FROM pbx_waiting WHERE guid = '" + Database.escape(String(c.guid)) + "'"
            );
            return;
        }
    });
});

