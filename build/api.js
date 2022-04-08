function log(m){
	document.getElementById("logs").textContent = document.getElementById("logs").textContent+"\n"+m;
	return m;
}
function status(s){
	document.getElementById("stats").textContent = "STATUS: "+s;
}
async function checkConn(conn){
	var con = false;
	conn.on('open', function() {
		con=true;
		conn.close();
	});
	await new Promise(resolve => setTimeout(resolve, 400));
	return con;
}
async function onReady(id){
	log("readied peerjs with id "+id);
	status("Attempting to join existing network");
	var cb = "nullfound";
	for(var i = 0; i<=10; i++){
		//`openfnm-node${i}-x`
		//"603f7dde-1d37-425b-8f5c-0e2a081a5859"
		var conn = peer.connect(`openfnm-node${i}-x`);
		var w = await checkConn(conn);
		if(!w){
			log(`connection to node${i} failed`);
		} else {
			log(`connection to node${i} succeded`);
			cb=i;
			break;
		}
	}
	if(cb=="nullfound"){
		status("Creating new network");
		log("failed to find existing network, starting network");
		log("rewrite self with data found, init peerjs with specific id");
		window._openfmn = {
			"created": new Date().getTime(),
			"nodes": [
				{id: "0", time: new Date().getTime() }
			]
		}
		window._cid = 0;
		peer.destroy();
		peer = new Peer(`openfnm-node0-x`, {"debug": 1});
		peer.on('open', function(id) {
			status("Created network, waiting for participants");
			log("registered as "+id+", defining join functions");
			participate(peer);
		});
	} else {
		var conn = peer.connect(`openfnm-node${cb}-x`);
		status("Attempting to join discovered network");
		conn.on('open', function() {
			conn.send({
				"type": "join",
				"time": new Date().getTime()
			});
			conn.on("data", function(data){
				if(data.type == "jmap"){
					log("got network map to join");
					console.log(data.map);
					joinNetwork(data.map,cb);
				}
			});
		});
	}
}
function joinNetwork(map,entry){
	var cid = undefined;
	for(var i=0;i>-1;i++){
		var f = true
		for(var k in map.nodes){
			if(map.nodes[k]["id"] == i){
				f=false;
			}
		}
		if(f){
			cid = i;
			break;
		}
		if(i>500) {log("critical no id 500 && throw");throw "";};
	}
	log("register with id "+cid);
	var conn = peer.connect(`openfnm-node${entry}-x`);
	status("Registering in network");
	conn.on('open', function() {
		conn.send({
			"type": "register",
			"id": cid,
			"time": new Date().getTime()
		});
		conn.on("data", function(data){
			if(data.type == "welcome"){
				log("accepted into network with new network map: ");
				log(JSON.stringify(data));
				window._openfmn = data.jmap;
				window._cid = cid;
				conn.close();
				peer.destroy();
				peer = new Peer(`openfnm-node${cid}-x`, {"debug": 1});
				peer.on("open", function(){
					status("Connected and participating in network");
					log("peer opened");
					participate(peer);
					window._con = {};
					connectTo(window._openfmn["nodes"]);
				});
			}
		});
	});
}
function participate(peer){
	peer.on('connection', function(conn) {
		conn.on('data', function(data) {
			log('Received '+JSON.stringify(data));
			if(data.type == "join"){
				log("sent map to discovering peer");
				conn.send({
					type: "jmap",
					map: window._openfmn
				});
			}
			if(data.type == "register"){
				window._openfmn["nodes"].push({
					id: data.id,
					time: new Date().getTime()
				});
				log("made discover to node (type:welcome)");
				conn.send({
					type: "welcome",
					jmap: window._openfmn
				});
				connectTo(window._openfmn["nodes"]);
				setTimeout(function(){
					broadcast({
						"type": "new",
						"jmap": window._openfmn
					});
				}, 1000);
			}
			if(data.type == "new"){
				log("Updating memeber list");
				window._openfmn = data.jmap;
				connectTo(data.jmap["nodes"]);
			}
			executeFunctions(data,conn.peer);
		});
	});
}
function connectTo(net){
	if(window._con == undefined)window._con = {};
	log("establishing new paths from "+JSON.stringify(net));
	for(var i in net){
		console.log(Object.keys(window._con), net[i]["id"]);
		if(net[i]["id"] == window._cid || Object.keys(window._con).indexOf(net[i]["id"]+"") != -1){
			log(`omit ${net[i]["id"]} for ${net[i]["id"] == window._cid}:${Object.keys(window._con).indexOf(net[i]["id"]+"") != -1}`)
			continue;
		}
		log(`paving to node ${net[i]["id"]}`);
		regularParticipate(net[i]["id"]);
	}
	console.log(window._con);
	var s = "";
	if(Object.keys(window._con).length>1) s = "s";
	status(`Connected to ${Object.keys(window._con).length} node${s}`);
}
function regularParticipate(pif){
	var conn = peer.connect(`openfnm-node${pif}-x`);
	window._con[pif] = conn;
	//forward, handle leaves
	conn.on('open', function() {
		log("got regNet "+pif);
	});
	conn.on("data", function(data){
		log("[regularNetwork]: got "+JSON.stringify(data));
	});
	conn.on("close", function(){
		log("regNet: conn closed to id "+pif);
		delete window._con[pif];
		for(var i in window._openfmn["nodes"]){
			if(window._openfmn["nodes"][i]["id"] == pif){
				window._openfmn["nodes"].splice(i, 1);
			}
		}
		log("now connected to "+Object.keys(window._con).length+" nodes");
		status("Connected to "+Object.keys(window._con).length+" nodes");
		console.log(window._con);
	});
}
function broadcast(data){
	log("! - Broadcast: to "+Object.keys(window._con).length+" nodes");
	for(var i in window._con){
		window._con[i].send(data);
		log("sent data to node"+i);
	}
}
//register a function passed as a parameter to the function to window._eventHandlers
function registerFunction(func){
	//if window._eventHandlers is undefined, create it
	if(window._eventHandlers == undefined)window._eventHandlers = [];
	window._eventHandlers.push(func);
}
//execute all functions in list window._eventHandlers with parameter data
function executeFunctions(data,id){
	for(var i in window._eventHandlers){
		window._eventHandlers[i](data,id);
	}
}
try{
	log("started");
	//, "host": "poshsorrowfultruetype.i10.repl.co/peerjs", "port": "8080"
	var peer = new Peer({"debug": 1});
	peer.on('open', function(id) {
		peer.on('open', function(id){
			log("re registered with id "+id);
		});
		log("fired onready event");
		onReady(id)
	});
}catch(e){
	log(e);
}
